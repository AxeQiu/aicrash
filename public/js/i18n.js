const i18n = {
  zh: {
    siteName: 'aicrash',
    siteDot: '.news',
    totalLabel: '总收录',
    todayLabel: '今日新增',
    avgSeverityLabel: '平均严重度',
    searchPlaceholder: '搜索标题或摘要...',
    searchTitle: '搜索',
    severityTitle: '严重程度',
    all: '全部',
    positive: '利好',
    categoryTitle: '分类',
    sourceTitle: '来源',
    dateRangeTitle: '时间范围',
    allTime: '全部时间',
    last1d: '最近1天',
    last7d: '最近7天',
    last30d: '最近30天',
    last90d: '最近90天',
    trendsTitle: '趋势',
    byDay: '按天',
    byWeek: '按周',
    loadMore: '加载更多',
    loading: '加载中...',
    emptyIcon: '📭',
    emptyText: '暂无匹配的新闻数据',
    countLabel: '新闻数量',
    severityLineLabel: '平均严重度',
    minutesAgo: '分钟前',
    hoursAgo: '小时前',
    daysAgo: '天前',
    articleInfo: '文章信息',
    publishedAt: '发布时间',
    addedAt: '入库时间',
    readOriginal: '阅读原文 →',
    backHome: '返回首页',
    backToHome: '← 返回首页',
    viewCountTitle: '被查看次数',
    viewsUnit: '次',
    heroBadge: 'MONITORING ACTIVE',
    heroTitle: 'AI Industry Crash Monitor',
    heroAvgSeverity: '平均严重度',
    heroScrollDown: '▼ 进入监控台',
  },
  en: {
    siteName: 'aicrash',
    siteDot: '.news',
    totalLabel: 'Total',
    todayLabel: 'Today',
    avgSeverityLabel: 'Avg Severity',
    searchPlaceholder: 'Search title or summary...',
    searchTitle: 'Search',
    severityTitle: 'Severity',
    all: 'All',
    positive: 'Bullish',
    categoryTitle: 'Category',
    sourceTitle: 'Source',
    dateRangeTitle: 'Date Range',
    allTime: 'All Time',
    last1d: 'Last 1 Day',
    last7d: 'Last 7 Days',
    last30d: 'Last 30 Days',
    last90d: 'Last 90 Days',
    trendsTitle: 'Trends',
    byDay: 'By Day',
    byWeek: 'By Week',
    loadMore: 'Load More',
    loading: 'Loading...',
    emptyIcon: '📭',
    emptyText: 'No matching news found',
    countLabel: 'News Count',
    severityLineLabel: 'Avg Severity',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    articleInfo: 'Article Info',
    publishedAt: 'Published',
    addedAt: 'Added',
    readOriginal: 'Read Original →',
    backHome: 'Back to Home',
    backToHome: '← Back to Home',
    viewCountTitle: 'View count',
    viewsUnit: 'views',
    heroBadge: 'MONITORING ACTIVE',
    heroTitle: 'AI Industry Crash Monitor',
    heroAvgSeverity: 'Avg Severity',
    heroScrollDown: '▼ Enter Console',
  },
};

function detectLanguage() {
  const saved = localStorage.getItem('aicrash_lang');
  if (saved && i18n[saved]) return saved;
  const browserLang = navigator.language || navigator.userLanguage || 'zh';
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

let currentLang = detectLanguage();

function t(key) {
  return i18n[currentLang][key] || i18n['zh'][key] || key;
}

function setLanguage(lang) {
  if (!i18n[lang]) return;
  currentLang = lang;
  localStorage.setItem('aicrash_lang', lang);
}

function getLang() {
  return currentLang;
}
