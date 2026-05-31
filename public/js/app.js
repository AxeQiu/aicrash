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
    el.className = 'news-item';
    el.href = `/article/${encodeURIComponent(item.url)}`;
    el.dataset.id = item.id;
    el.dataset.url = item.url;

    const severityBadge = item.severity === 0
      ? '<div class="severity-badge s0">✓</div>'
      : `<div class="severity-badge s${item.severity || 1}">${item.severity || 1}</div>`;

    el.innerHTML = `
      <div class="news-item-header">
        ${severityBadge}
        <div class="news-title">${escapeHtml(item.title)}</div>
      </div>
      ${item.summary ? `<div class="news-summary">${escapeHtml(item.summary)}</div>` : ''}
      <div class="news-meta">
        ${item.source ? `<span class="news-source">${escapeHtml(item.source)}</span>` : ''}
        ${item.category ? `<span class="news-category">${escapeHtml(item.category)}</span>` : ''}
        <span class="news-time">${formatTime(item.published_at)}</span>
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
    allCatBtn.textContent = t('all');
    categoryFilter.appendChild(allCatBtn);

    cachedFilterData.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn' + (activeCatValue === cat ? ' active' : '');
      btn.dataset.category = cat;
      btn.textContent = cat;
      categoryFilter.appendChild(btn);
    });

    const sourceFilter = document.getElementById('source-filter');
    const activeSource = sourceFilter.querySelector('.source-btn.active');
    const activeSrcValue = activeSource ? activeSource.dataset.source : '';

    sourceFilter.innerHTML = '';
    const allSrcBtn = document.createElement('button');
    allSrcBtn.className = 'source-btn' + (activeSrcValue === '' ? ' active' : '');
    allSrcBtn.dataset.source = '';
    allSrcBtn.textContent = t('all');
    sourceFilter.appendChild(allSrcBtn);

    cachedFilterData.sources.forEach(src => {
      const btn = document.createElement('button');
      btn.className = 'source-btn' + (activeSrcValue === src ? ' active' : '');
      btn.dataset.source = src;
      btn.textContent = src;
      sourceFilter.appendChild(btn);
    });
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
      document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.severity = btn.dataset.severity;
      resetAndFetch();
    });
  });

  document.getElementById('category-filter').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-btn')) {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.category = e.target.dataset.category;
      resetAndFetch();
    }
  });

  document.getElementById('source-filter').addEventListener('click', (e) => {
    if (e.target.classList.contains('source-btn')) {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.source = e.target.dataset.source;
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
    if (item?.dataset.url) saveHomeState(item.dataset.url);
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

  async function bootstrap() {
    applyI18n();
    await fetchFilters();

    const saved = readHomeState();
    if (saved?.state) {
      Object.assign(state, saved.state);
      applyFilterStateToUI(saved.state);
      await loadPagesUpTo(saved.currentPage || 1);
      requestAnimationFrame(() => restoreHomeScroll(saved));
      sessionStorage.removeItem(HOME_STATE_KEY);
    } else {
      await fetchNews(false);
    }

    fetchTrends();
    loadHeaderStats();
  }

  bootstrap();
})();
