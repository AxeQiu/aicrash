const CATEGORIES = [
  { code: '1', zh: '产业格局', en: 'Industry Landscape' },
  { code: '2', zh: '商业与财务', en: 'Business & Finance' },
  { code: '3', zh: '安全与隐私', en: 'Safety & Privacy' },
  { code: '4', zh: '就业与经济', en: 'Employment & Economy' },
  { code: '5', zh: '技术风险', en: 'Technical Risk' },
  { code: '6', zh: '监管与政策', en: 'Regulation & Policy' },
  { code: '7', zh: '社会影响', en: 'Social Impact' },
  { code: '0', zh: '其他', en: 'Other' },
];

const CATEGORY_BY_CODE = CATEGORIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

const LEGACY_ALIAS = {
  '裁员': '4', 'layoffs': '4', 'layoff': '4',
  '算力': '2', 'compute': '2',
  '安全': '3', 'safety': '3',
  '监管': '6', 'regulation': '6',
  '诉讼': '6', 'lawsuit': '6', 'litigation': '6',
  '技术': '5', 'tech': '5', 'technical': '5',
  '社会': '7', 'society': '7', 'social': '7',
  '产业': '1', 'industry': '1',
  '商业': '2', 'business': '2', 'finance': '2',
  '隐私': '3', 'privacy': '3',
  '经济': '4', 'economy': '4', 'employment': '4',
  '政策': '6', 'policy': '6',
  '其他': '0', 'other': '0', 'misc': '0', 'miscellaneous': '0',
};

function normalizeCategoryCode(raw) {
  if (raw == null) return '0';
  const trimmed = String(raw).trim();
  if (!trimmed) return '0';
  if (CATEGORY_BY_CODE[trimmed]) return trimmed;
  const lower = trimmed.toLowerCase();
  if (LEGACY_ALIAS[lower]) return LEGACY_ALIAS[lower];
  if (LEGACY_ALIAS[trimmed]) return LEGACY_ALIAS[trimmed];
  for (const c of CATEGORIES) {
    if (c.zh === trimmed || c.en.toLowerCase() === lower) return c.code;
  }
  return '0';
}

function getCategoryLabel(code, lang) {
  const cat = CATEGORY_BY_CODE[code] || CATEGORY_BY_CODE['0'];
  return lang === 'en' ? cat.en : cat.zh;
}

function listCategories(lang) {
  return CATEGORIES.map(c => ({
    code: c.code,
    name: lang === 'en' ? c.en : c.zh,
  }));
}

module.exports = {
  CATEGORIES,
  normalizeCategoryCode,
  getCategoryLabel,
  listCategories,
};
