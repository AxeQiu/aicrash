(async function () {
  if (!document.getElementById('news-feed')) return;

  await window.headerPromise;

  const API_BASE = '/api';
  let currentPage = 1;
  let hasMore = true;
  let isLoading = false;

  const state = {
    search: '',
    source: '',
    category: '',
    severity: '',
    days: '30',
    trendPeriod: 'day',
  };

  const newsFeed = document.getElementById('news-feed');
  const contentEl = document.querySelector('.content');
  const loadingEl = document.getElementById('loading');
  const loadMoreEl = document.getElementById('load-more');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const liveIndicator = document.getElementById('live-indicator');

  let trendChart = null;

  const HOME_STATE_KEY = 'aicrash_home_state';
  const VIEWED_NEWS_KEY = 'aicrash_viewed_news';

  function getViewedSet() {
    try {
      const raw = localStorage.getItem(VIEWED_NEWS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function getViewedIds() {
    const viewed = getViewedSet();
    return Object.keys(viewed).filter(k => viewed[k]).join(',');
  }

  async function markViewed(url, id) {
    if (!url) return;
    const viewed = getViewedSet();
    if (viewed[url]) return;
    viewed[url] = true;
    try {
      localStorage.setItem(VIEWED_NEWS_KEY, JSON.stringify(viewed));
    } catch (err) {
      console.error('Failed to save viewed set:', err);
    }
    // Call server API to increment view_count (idempotent per user)
    if (id) {
      try {
        await fetch('/api/news/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Viewed-Key': getViewedIds(),
          },
          body: JSON.stringify({ id }),
        });
      } catch (err) {
        console.error('Failed to record view:', err);
      }
    }
  }

  function readHomeState() {
    try {
      const raw = sessionStorage.getItem(HOME_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveHomeState(articleUrl) {
    try {
      sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify({
        scrollTop: contentEl ? contentEl.scrollTop : 0,
        currentPage,
        state: { ...state },
        articleUrl,
      }));
    } catch (err) {
      console.error('Failed to save home scroll state:', err);
    }
  }

  function applyFilterStateToUI(savedState) {
    document.getElementById('search-input').value = savedState.search || '';
    document.getElementById('date-range').value = savedState.days ?? '30';

    document.querySelectorAll('.severity-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.severity === String(savedState.severity ?? ''));
    });

    const setActive = (containerId, btnClass, attr, value) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.querySelectorAll(`.${btnClass}`).forEach(btn => {
        btn.classList.toggle('active', (btn.dataset[attr] || '') === (value || ''));
      });
    };
    setActive('category-filter', 'category-btn', 'category', savedState.category);
    setActive('source-filter', 'source-btn', 'source', savedState.source);

    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === (savedState.trendPeriod || 'day'));
    });
  }

  async function loadPagesUpTo(targetPage) {
    currentPage = 1;
    hasMore = true;
    await fetchNews(false);
    while (currentPage < targetPage && hasMore) {
      currentPage++;
      await fetchNews(true);
    }
  }

  function restoreHomeScroll(saved) {
    if (!contentEl) return;
    contentEl.scrollTop = saved.scrollTop || 0;
    if (saved.articleUrl) {
      const urlKey = CSS.escape(saved.articleUrl);
      const el = newsFeed.querySelector(`[data-url="${urlKey}"]`);
      if (el) {
        el.classList.add('news-item-returned');
        setTimeout(() => el.classList.remove('news-item-returned'), 2500);
      }
    }
  }

  function applyI18n() {
    const lang = getLang();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    rebuildDynamicFilters();
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const lang = getLang();
    if (diff < 3600000) return Math.floor(diff / 60000) + ' ' + t('minutesAgo');
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ' + t('hoursAgo');
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' ' + t('daysAgo');
    return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
  }

  function createNewsItem(item) {
    const el = document.createElement('a');
    const sev = item.severity === 0 ? 0 : (item.severity || 1);
    const isViewed = !!getViewedSet()[item.url];
    el.className = `news-item s${sev}${isViewed ? ' read' : ''}`;
    el.href = `/article/${encodeURIComponent(item.url)}`;
    el.dataset.id = item.id;
    el.dataset.url = item.url;

    const severityBadge = item.severity === 0
      ? '<div class="severity-badge s0">✓</div>'
      : `<div class="severity-badge s${item.severity || 1}">${item.severity || 1}</div>`;

    const viewCount = item.view_count || 0;

    el.innerHTML = `
      <div class="news-item-header">
        ${severityBadge}
        <div class="news-title">${escapeHtml(item.title)}</div>
      </div>
      ${item.summary ? `<div class="news-summary">${escapeHtml(item.summary)}</div>` : ''}
      <div class="news-item-footer">
        <div class="news-meta">
          ${item.source ? `<span class="news-source">${escapeHtml(item.source)}</span>` : ''}
          ${item.category_label ? `<span class="news-category">${escapeHtml(item.category_label)}</span>` : ''}
          <span class="news-time" data-created-at="${item.created_at}">${formatTime(item.created_at)}</span>
        </div>
        <div class="news-view-count" title="${t('viewCountTitle')}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span class="view-count-number">${viewCount}</span>
        </div>
      </div>
    `;
    return el;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function buildParams() {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 50,
      lang: getLang(),
    });
    if (state.search) params.set('search', state.search);
    if (state.source) params.set('source', state.source);
    if (state.category) params.set('category', state.category);
    if (state.severity !== '') params.set('severity', state.severity);
    if (state.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(state.days));
      params.set('start_date', startDate.toISOString().slice(0, 19).replace('T', ' '));
    }
    return params;
  }

  function matchesFilters(item) {
    if (item.lang !== getLang()) return false;
    if (state.source && item.source !== state.source) return false;
    if (state.category && item.category !== state.category) return false;
    if (state.severity !== '') {
      const sev = parseInt(state.severity, 10);
      if ((item.severity ?? 1) !== sev) return false;
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      const title = (item.title || '').toLowerCase();
      const summary = (item.summary || '').toLowerCase();
      if (!title.includes(q) && !summary.includes(q)) return false;
    }
    if (state.days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(state.days, 10));
      startDate.setHours(0, 0, 0, 0);
      const published = item.published_at ? new Date(item.published_at) : null;
      if (!published || published < startDate) return false;
    }
    return true;
  }

  async function fetchNews(append = false) {
    if (isLoading) return;
    isLoading = true;
    loadingEl.style.display = append ? 'none' : 'block';

    try {
      const params = buildParams();
      const res = await fetch(`${API_BASE}/news?${params}`);
      const data = await res.json();

      if (!append) {
        newsFeed.innerHTML = '';
      }

      if (data.data.length === 0 && !append) {
        newsFeed.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${t('emptyIcon')}</div>
            <div class="empty-state-text">${t('emptyText')}</div>
          </div>
        `;
      } else {
        data.data.forEach(item => {
          newsFeed.appendChild(createNewsItem(item));
        });
      }

      hasMore = currentPage < data.pagination.totalPages;
      loadMoreEl.style.display = hasMore ? 'block' : 'none';
    } catch (err) {
      console.error('Failed to fetch news:', err);
    } finally {
      isLoading = false;
      loadingEl.style.display = 'none';
    }
  }

  async function fetchTrends() {
    try {
      const params = new URLSearchParams({
        period: state.trendPeriod,
        days: state.days || 30,
        lang: getLang(),
      });
      const res = await fetch(`${API_BASE}/news/trends?${params}`);
      const data = await res.json();
      renderTrendChart(data);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  }

  function renderTrendChart(data) {
    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) {
      trendChart.destroy();
    }

    const labels = data.map(d => d.period);
    const counts = data.map(d => d.count);
    const severities = data.map(d => parseFloat(d.avg_severity).toFixed(1));

    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: t('countLabel'),
            data: counts,
            backgroundColor: 'rgba(255, 59, 59, 0.6)',
            borderColor: 'rgba(255, 59, 59, 1)',
            borderWidth: 1,
            yAxisID: 'y',
            order: 2,
          },
          {
            label: t('severityLineLabel'),
            data: severities,
            type: 'line',
            borderColor: 'rgba(255, 187, 51, 1)',
            backgroundColor: 'rgba(255, 187, 51, 0.1)',
            pointRadius: 3,
            pointBackgroundColor: 'rgba(255, 187, 51, 1)',
            borderWidth: 2,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#8888a0', font: { size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: '#555570', font: { size: 10 }, maxRotation: 45 },
            grid: { color: 'rgba(42,42,58,0.5)' },
          },
          y: {
            position: 'left',
            ticks: { color: '#8888a0', font: { size: 10 } },
            grid: { color: 'rgba(42,42,58,0.5)' },
          },
          y1: {
            position: 'right',
            min: 0,
            max: 5,
            ticks: { color: '#ffbb33', font: { size: 10 }, stepSize: 1 },
            grid: { display: false },
          },
        },
      },
    });

    // Mobile sparkline
    renderMobileSparkline(data);
  }

  let _lastTrendData = null;

  function renderMobileSparkline(data) {
    if (data) _lastTrendData = data;
    const trendData = _lastTrendData;
    const canvas = document.getElementById('mobile-trend-chart');
    if (!canvas || !trendData) return;
    const ctx = canvas.getContext('2d');
    const counts = trendData.map(d => d.count);
    if (counts.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = 4;
    const max = Math.max(...counts, 1);
    const step = (w - pad * 2) / Math.max(counts.length - 1, 1);

    ctx.clearRect(0, 0, w, h);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    counts.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad + (counts.length - 1) * step, h - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255, 59, 59, 0.3)');
    grad.addColorStop(1, 'rgba(255, 59, 59, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    counts.forEach((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255, 59, 59, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Last point dot
    const lastX = pad + (counts.length - 1) * step;
    const lastY = h - pad - (counts[counts.length - 1] / max) * (h - pad * 2);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 59, 59, 1)';
    ctx.fill();
  }

  let cachedFilterData = null;

  async function fetchFilters() {
    try {
      const params = new URLSearchParams({ lang: getLang() });
      const res = await fetch(`${API_BASE}/news/filters?${params}`);
      cachedFilterData = await res.json();
      rebuildDynamicFilters();
    } catch (err) {
      console.error('Failed to fetch filters:', err);
    }
  }

  function rebuildDynamicFilters() {
    if (!cachedFilterData) return;

    const categoryFilter = document.getElementById('category-filter');
    const activeCategory = categoryFilter.querySelector('.category-btn.active');
    const activeCatValue = activeCategory ? activeCategory.dataset.category : '';

    categoryFilter.innerHTML = '';
    const allCatBtn = document.createElement('button');
    allCatBtn.className = 'category-btn' + (activeCatValue === '' ? ' active' : '');
    allCatBtn.dataset.category = '';
    const allCatTotal = cachedFilterData.categories.reduce((sum, c) => sum + (c.count || 0), 0);
    allCatBtn.innerHTML = `<span class="category-name">${t('all')}</span>` +
      `<span class="category-count">${allCatTotal}</span>`;
    categoryFilter.appendChild(allCatBtn);

    cachedFilterData.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn' + (activeCatValue === cat.code ? ' active' : '');
      btn.dataset.category = cat.code;
      btn.innerHTML = `<span class="category-name">${escapeHtml(cat.name)}</span>` +
        `<span class="category-count">${cat.count || 0}</span>`;
      categoryFilter.appendChild(btn);
    });

    const sourceFilter = document.getElementById('source-filter');
    const activeSource = sourceFilter.querySelector('.source-btn.active');
    const activeSrcValue = activeSource ? activeSource.dataset.source : '';

    sourceFilter.innerHTML = '';
    const allSrcBtn = document.createElement('button');
    allSrcBtn.className = 'source-btn' + (activeSrcValue === '' ? ' active' : '');
    allSrcBtn.dataset.source = '';
    allSrcBtn.innerHTML = `<span class="source-name">${t('all')}</span>` +
      (cachedFilterData.sourcesTotal
        ? `<span class="source-count">${cachedFilterData.sourcesTotal}</span>`
        : '');
    sourceFilter.appendChild(allSrcBtn);

    cachedFilterData.sources.forEach(src => {
      const btn = document.createElement('button');
      btn.className = 'source-btn' + (activeSrcValue === src.name ? ' active' : '');
      btn.dataset.source = src.name;
      btn.innerHTML = `<span class="source-name">${escapeHtml(src.name)}</span>` +
        `<span class="source-count">${src.count}</span>`;
      sourceFilter.appendChild(btn);
    });

    // Mobile category filter
    const mobileCatFilter = document.getElementById('mobile-category-filter');
    if (mobileCatFilter) {
      mobileCatFilter.innerHTML = '';
      const allTag = document.createElement('button');
      allTag.className = 'mobile-tag' + (activeCatValue === '' ? ' active' : '');
      allTag.dataset.category = '';
      allTag.textContent = t('all');
      mobileCatFilter.appendChild(allTag);
      cachedFilterData.categories.forEach(cat => {
        const tag = document.createElement('button');
        tag.className = 'mobile-tag' + (activeCatValue === cat.code ? ' active' : '');
        tag.dataset.category = cat.code;
        tag.textContent = cat.name;
        mobileCatFilter.appendChild(tag);
      });
    }

    // Mobile source filter
    const mobileSrcFilter = document.getElementById('mobile-source-filter');
    if (mobileSrcFilter) {
      mobileSrcFilter.innerHTML = '';
      const allTag = document.createElement('button');
      allTag.className = 'mobile-tag' + (activeSrcValue === '' ? ' active' : '');
      allTag.dataset.source = '';
      allTag.textContent = t('all');
      mobileSrcFilter.appendChild(allTag);
      cachedFilterData.sources.forEach(src => {
        const tag = document.createElement('button');
        tag.className = 'mobile-tag' + (activeSrcValue === src.name ? ' active' : '');
        tag.dataset.source = src.name;
        tag.textContent = src.name;
        mobileSrcFilter.appendChild(tag);
      });
    }
  }

  function resetAndFetch() {
    currentPage = 1;
    hasMore = true;
    fetchNews(false);
    fetchTrends();
  }

  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = e.target.value.trim();
      resetAndFetch();
    }, 300);
  });

  document.querySelectorAll('.severity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Sync active state across desktop & mobile severity buttons
      document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`.severity-btn[data-severity="${btn.dataset.severity}"]`).forEach(b => b.classList.add('active'));
      state.severity = btn.dataset.severity;
      resetAndFetch();
    });
  });

  // Mobile severity filter
  const mobileSevFilter = document.getElementById('mobile-severity-filter');
  if (mobileSevFilter) {
    mobileSevFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.severity-btn');
      if (!btn) return;
      document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`.severity-btn[data-severity="${btn.dataset.severity}"]`).forEach(b => b.classList.add('active'));
      state.severity = btn.dataset.severity;
      resetAndFetch();
    });
  }

  // Mobile category filter
  document.addEventListener('click', (e) => {
    const tag = e.target.closest('.mobile-tag[data-category]');
    if (tag) {
      document.querySelectorAll('.mobile-tag[data-category]').forEach(b => b.classList.remove('active'));
      tag.classList.add('active');
      // Sync desktop
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      const desktopBtn = document.querySelector(`.category-btn[data-category="${tag.dataset.category}"]`);
      if (desktopBtn) desktopBtn.classList.add('active');
      state.category = tag.dataset.category;
      resetAndFetch();
    }
  });

  // Mobile source filter
  document.addEventListener('click', (e) => {
    const tag = e.target.closest('.mobile-tag[data-source]');
    if (tag) {
      document.querySelectorAll('.mobile-tag[data-source]').forEach(b => b.classList.remove('active'));
      tag.classList.add('active');
      // Sync desktop
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      const desktopBtn = document.querySelector(`.source-btn[data-source="${tag.dataset.source}"]`);
      if (desktopBtn) desktopBtn.classList.add('active');
      state.source = tag.dataset.source;
      resetAndFetch();
    }
  });

  document.getElementById('category-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Sync mobile
      document.querySelectorAll('.mobile-tag[data-category]').forEach(b => b.classList.remove('active'));
      const mobileTag = document.querySelector(`.mobile-tag[data-category="${btn.dataset.category}"]`);
      if (mobileTag) mobileTag.classList.add('active');
      state.category = btn.dataset.category;
      resetAndFetch();
    }
  });

  document.getElementById('source-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.source-btn');
    if (btn) {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Sync mobile
      document.querySelectorAll('.mobile-tag[data-source]').forEach(b => b.classList.remove('active'));
      const mobileTag = document.querySelector(`.mobile-tag[data-source="${btn.dataset.source}"]`);
      if (mobileTag) mobileTag.classList.add('active');
      state.source = btn.dataset.source;
      resetAndFetch();
    }
  });

  document.getElementById('date-range').addEventListener('change', (e) => {
    state.days = e.target.value;
    resetAndFetch();
  });

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.trendPeriod = btn.dataset.period;
      fetchTrends();
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    if (hasMore && !isLoading) {
      currentPage++;
      fetchNews(true);
    }
  });

  newsFeed.addEventListener('click', (e) => {
    const item = e.target.closest('.news-item');
    if (item?.dataset.url) {
      markViewed(item.dataset.url, item.dataset.id);
      item.classList.add('read');
      saveHomeState(item.dataset.url);
    }
  });

  document.getElementById('lang-switch').addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-btn')) {
      const newLang = e.target.dataset.lang;
      if (newLang !== getLang()) {
        setLanguage(newLang);
        applyI18n();
        resetAndFetch();
        loadHeaderStats();
        fetchFilters();
        loadHeroStats();
        if (window._resetHeroTypewriter) window._resetHeroTypewriter();
      }
    }
  });

  const sse = new SSEClient(`${API_BASE}/events`);
  sse.onMessage = (items) => {
    let hasLangNews = false;

    items.forEach(item => {
      if (item.lang !== getLang()) return;
      hasLangNews = true;
      if (!matchesFilters(item)) return;

      const urlKey = CSS.escape(item.url);
      const existing = newsFeed.querySelector(`[data-url="${urlKey}"]`);
      if (existing) return;

      const emptyState = newsFeed.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      const el = createNewsItem(item);
      newsFeed.insertBefore(el, newsFeed.firstChild);
    });

    if (hasLangNews) {
      loadHeaderStats();
      fetchFilters();
      fetchTrends();
      liveIndicator.style.color = '#00ff88';
      setTimeout(() => {
        liveIndicator.style.color = '';
      }, 1000);
    }
  };

  sse.onConnect = () => {
    liveIndicator.querySelector('span:last-child').textContent = 'LIVE';
  };

  sse.onReconnect = (remaining) => {
    liveIndicator.querySelector('span:last-child').textContent = 'RETRY';
  };

  sse.onDisconnect = () => {
    liveIndicator.querySelector('span:last-child').textContent = 'OFFLINE';
  };

  // ===== Hero Section Logic =====
  const heroCanvas = document.getElementById('hero-canvas');
  const heroTypewriterEl = document.getElementById('hero-typewriter-text');
  const heroScrollBtn = document.getElementById('hero-scroll-btn');

  function initHeroCanvas() {
    if (!heroCanvas) return;
    const ctx = heroCanvas.getContext('2d');
    let cols, drops;
    const fontSize = 14;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]';

    function resize() {
      heroCanvas.width = heroCanvas.offsetWidth;
      heroCanvas.height = heroCanvas.offsetHeight;
      cols = Math.floor(heroCanvas.width / fontSize);
      drops = Array(cols).fill(1);
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.05)';
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.fillStyle = 'rgba(255, 59, 59, 0.15)';
      ctx.font = fontSize + 'px Courier New';

      for (let i = 0; i < cols; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > heroCanvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  function getTypewriterLines() {
    const lang = getLang();
    return lang === 'zh'
      ? [
          '正在扫描 AI 行业异常信号...',
          '检测到 3 起严重事故',
          'OpenAI 发布紧急安全公告',
          '自动驾驶系统出现致命故障',
          'AI 生成内容引发版权诉讼',
          '数据泄露影响 200 万用户',
        ]
      : [
          'Scanning AI industry anomalies...',
          '3 critical incidents detected',
          'OpenAI issues emergency safety bulletin',
          'Autonomous driving system fatal failure',
          'AI-generated content sparks copyright lawsuit',
          'Data breach affects 2M users',
        ];
  }

  let typewriterTimer = null;

  function initHeroTypewriter() {
    if (!heroTypewriterEl) return;

    let lines = getTypewriterLines();
    let lineIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    function tick() {
      const currentLine = lines[lineIdx];

      if (!isDeleting) {
        heroTypewriterEl.textContent = currentLine.substring(0, charIdx + 1);
        charIdx++;
        if (charIdx >= currentLine.length) {
          isDeleting = true;
          typewriterTimer = setTimeout(tick, 2000);
          return;
        }
      } else {
        heroTypewriterEl.textContent = currentLine.substring(0, charIdx - 1);
        charIdx--;
        if (charIdx <= 0) {
          isDeleting = false;
          lineIdx = (lineIdx + 1) % lines.length;
          typewriterTimer = setTimeout(tick, 500);
          return;
        }
      }

      typewriterTimer = setTimeout(tick, isDeleting ? 30 : 60);
    }

    typewriterTimer = setTimeout(tick, 1000);

    window._resetHeroTypewriter = function () {
      if (typewriterTimer) clearTimeout(typewriterTimer);
      lines = getTypewriterLines();
      lineIdx = 0;
      charIdx = 0;
    };

    window._renderMobileSparkline = function () {
      renderMobileSparkline();
    };
  }

  async function loadHeroStats() {
    try {
      const res = await fetch(`/api/news/stats?lang=${getLang()}`);
      if (!res.ok) return;
      const { total, today, avg_severity } = await res.json();

      const heroTotal = document.getElementById('hero-total');
      const heroToday = document.getElementById('hero-today');
      const heroSeverity = document.getElementById('hero-severity');

      if (heroTotal) heroTotal.textContent = total.toLocaleString();
      if (heroToday) heroToday.textContent = today.toLocaleString();
      if (heroSeverity) heroSeverity.textContent = avg_severity ? avg_severity.toFixed(1) : '—';
    } catch (err) {
      console.error('Failed to load hero stats:', err);
    }
  }

  if (heroScrollBtn) {
    heroScrollBtn.addEventListener('click', () => {
      const mainLayout = document.querySelector('.main-layout');
      if (mainLayout) {
        mainLayout.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  initHeroCanvas();
  initHeroTypewriter();
  loadHeroStats();

  async function bootstrap() {
    applyI18n();
    await fetchFilters();

    const saved = readHomeState();
    const skipToMonitor = window.location.hash === '#monitor';

    if (skipToMonitor || saved?.state) {
      if (saved?.state) {
        Object.assign(state, saved.state);
        applyFilterStateToUI(saved.state);
        await loadPagesUpTo(saved.currentPage || 1);
      } else {
        await fetchNews(false);
      }

      requestAnimationFrame(() => {
        if (skipToMonitor) {
          const mainLayout = document.querySelector('.main-layout');
          if (mainLayout) mainLayout.scrollIntoView({ behavior: 'auto' });
        } else {
          restoreHomeScroll(saved);
        }
      });
      sessionStorage.removeItem(HOME_STATE_KEY);
    } else {
      await fetchNews(false);
    }

    fetchTrends();
    loadHeaderStats();
  }

  setInterval(() => {
    document.querySelectorAll('.news-time[data-created-at]').forEach(el => {
      const createdAt = el.dataset.createdAt;
      if (createdAt) {
        el.textContent = formatTime(createdAt);
      }
    });
  }, 60000);

  bootstrap();
})();
