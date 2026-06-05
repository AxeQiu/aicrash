const express = require('express');
const router = express.Router();
const db = require('../db');
const { normalizeCategoryCode, getCategoryLabel, listCategories } = require('../categories');

const LEGACY_NAMES_BY_CODE = {
  '1': ['产业格局', 'industry', 'industry landscape'],
  '2': ['商业与财务', '算力', 'compute', 'business', 'finance', '商业', 'business & finance'],
  '3': ['安全与隐私', '安全', 'safety', 'privacy', '安全', 'safety & privacy'],
  '4': ['就业与经济', '裁员', 'layoffs', 'economy', 'employment', '就业', 'employment & economy'],
  '5': ['技术风险', '技术', 'tech', 'technical', 'technical risk'],
  '6': ['监管与政策', '监管', 'regulation', 'policy', '诉讼', 'lawsuit', 'litigation', '监管与政策', 'regulation & policy'],
  '7': ['社会影响', '社会', 'society', 'social', 'social impact'],
  '0': ['其他', 'other', 'misc', 'miscellaneous'],
};

function legacyNameListForCode(code) {
  return LEGACY_NAMES_BY_CODE[code] || [];
}

router.get('/news', async (req, res) => {
  try {
    const { page = 1, limit = 50, source, category, severity, search, start_date, end_date, created_after, lang } = req.query;
    const limitVal = parseInt(limit, 10);
    const offsetVal = (parseInt(page, 10) - 1) * limitVal;
    const langVal = lang === 'en' ? 'en' : 'zh';

    let filterWhere = ['1=1'];
    let filterParams = [];

    if (source) {
      filterWhere.push('source = ?');
      filterParams.push(source);
    }
    if (category) {
      const categoryCode = normalizeCategoryCode(category);
      filterWhere.push(`(
        category = ?
        OR LOWER(IFNULL(category, '')) = LOWER(?)
        OR LOWER(IFNULL(category, '')) IN (${legacyNameListForCode(categoryCode).map(() => '?').join(',') || 'NULL'})
      )`);
      filterParams.push(categoryCode);
      filterParams.push(categoryCode);
      filterParams.push(...legacyNameListForCode(categoryCode));
    }
    if (severity !== undefined && severity !== '') {
      filterWhere.push('severity = ?');
      filterParams.push(parseInt(severity, 10));
    }
    if (search) {
      filterWhere.push('(title LIKE ? OR summary LIKE ?)');
      const s = `%${search}%`;
      filterParams.push(s, s);
    }
    if (start_date) {
      filterWhere.push('published_at >= ?');
      filterParams.push(start_date);
    }
    if (end_date) {
      filterWhere.push('published_at <= ?');
      filterParams.push(end_date);
    }
    if (created_after) {
      filterWhere.push('created_at >= ?');
      filterParams.push(created_after);
    }

    const filterClause = filterWhere.join(' AND ');
    const subParams = [langVal, langVal, ...filterParams];

    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT 1 FROM news
        WHERE url IN (SELECT url FROM news WHERE lang = ? AND ${filterClause} GROUP BY url)
        GROUP BY url
      ) t
    `;
    const [countRows] = await db.query(countSql, [langVal, ...filterParams]);
    const total = countRows[0].total;

    const dataSql = `
      SELECT n.* FROM news n
      INNER JOIN (
        SELECT url, MAX(created_at) AS max_created_at
        FROM news
        WHERE lang = ? AND url IN (SELECT url FROM news WHERE lang = ? AND ${filterClause} GROUP BY url)
        GROUP BY url
      ) sub ON n.url = sub.url AND n.created_at = sub.max_created_at
      ORDER BY n.created_at DESC
      LIMIT ${limitVal} OFFSET ${offsetVal}
    `;
    const [rows] = await db.query(dataSql, subParams);

    const data = rows.map(r => {
      const code = normalizeCategoryCode(r.category);
      return {
        ...r,
        category: code,
        category_label: getCategoryLabel(code, langVal),
      };
    });

    res.json({
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: limitVal,
        total,
        totalPages: Math.ceil(total / limitVal),
      },
    });
  } catch (err) {
    console.error('Failed to fetch news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

router.get('/news/trends', async (req, res) => {
  try {
    const { period = 'day', days = 30, lang } = req.query;
    const dateFormat = period === 'week' ? '%Y-%u' : '%Y-%m-%d';
    const langVal = lang === 'en' ? 'en' : 'zh';

    const sql = `
      SELECT
        n.period,
        COUNT(*) AS count,
        AVG(n.avg_severity) AS avg_severity
      FROM (
        SELECT
          DATE_FORMAT(published_at, '${dateFormat}') AS period,
          url,
          MAX(severity) AS avg_severity
        FROM news
        WHERE lang = ? AND published_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY url, DATE_FORMAT(published_at, '${dateFormat}')
      ) n
      GROUP BY n.period
      ORDER BY n.period ASC
    `;
    const [rows] = await db.query(sql, [langVal, parseInt(days, 10)]);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

router.get('/news/stats', async (req, res) => {
  try {
    const { lang } = req.query;
    const langVal = lang === 'en' ? 'en' : 'zh';
    const todayStart = new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT
        COUNT(DISTINCT url) AS total,
        COUNT(DISTINCT CASE WHEN created_at >= ? THEN url END) AS today,
        (SELECT AVG(severity) FROM news WHERE lang = ? AND severity > 0) AS avg_severity
      FROM news
      WHERE lang = ?
    `;
    const [rows] = await db.query(sql, [todayStart, langVal, langVal]);

    res.json({
      total: rows[0].total,
      today: rows[0].today,
      avg_severity: rows[0].avg_severity ? Math.round(rows[0].avg_severity * 10) / 10 : null,
    });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/news/filters', async (req, res) => {
  try {
    const { lang } = req.query;
    const langVal = lang === 'en' ? 'en' : 'zh';

    const urlSubSql = `SELECT url FROM news WHERE lang = '${langVal}' GROUP BY url`;
    const [sourceRows] = await db.query(
      `SELECT source, COUNT(DISTINCT url) AS count FROM news
       WHERE lang = ? AND source IS NOT NULL AND url IN (${urlSubSql})
       GROUP BY source
       ORDER BY count DESC, source ASC
       LIMIT 10`,
      [langVal]
    );
    const [{ total: sourcesTotal }] = await db.query(
      `SELECT COUNT(DISTINCT source) AS total FROM news
       WHERE lang = ? AND source IS NOT NULL AND url IN (${urlSubSql})`,
      [langVal]
    );

    const [categoryRows] = await db.query(
      `SELECT category, COUNT(DISTINCT url) AS count FROM news
       WHERE lang = ? AND category IS NOT NULL AND url IN (${urlSubSql})
       GROUP BY category`,
      [langVal]
    );
    const codeCounts = {};
    for (const r of categoryRows) {
      const code = normalizeCategoryCode(r.category);
      codeCounts[code] = (codeCounts[code] || 0) + r.count;
    }
    const categories = listCategories(langVal).map(c => ({
      code: c.code,
      name: c.name,
      count: codeCounts[c.code] || 0,
    }));

    res.json({
      sources: sourceRows.map(r => ({ name: r.source, count: r.count })),
      sourcesTotal,
      categories,
    });
  } catch (err) {
    console.error('Failed to fetch filters:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

router.get('/news/article', async (req, res) => {
  try {
    const { id, lang } = req.query;
    const langVal = lang === 'en' ? 'en' : 'zh';

    let sql, params;
    if (id) {
      sql = `
        SELECT n.* FROM news n
        INNER JOIN (
          SELECT url, MAX(created_at) AS max_created_at
          FROM news
          WHERE lang = ?
          GROUP BY url
        ) sub ON n.url = sub.url AND n.created_at = sub.max_created_at
        WHERE n.url = ? OR n.id = ?
        LIMIT 1
      `;
      params = [langVal, id, id];
    } else {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    const [rows] = await db.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const row = rows[0];
    const code = normalizeCategoryCode(row.category);
    res.json({
      ...row,
      category: code,
      category_label: getCategoryLabel(code, langVal),
    });
  } catch (err) {
    console.error('Failed to fetch article:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

module.exports = router;
