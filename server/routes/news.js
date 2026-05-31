const express = require('express');
const router = express.Router();
const db = require('../db');

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
      filterWhere.push('category = ?');
      filterParams.push(category);
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

    res.json({
      data: rows,
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
        COUNT(DISTINCT CASE WHEN created_at >= ? THEN url END) AS today
      FROM news
      WHERE lang = ?
    `;
    const [rows] = await db.query(sql, [todayStart, langVal]);

    res.json({
      total: rows[0].total,
      today: rows[0].today,
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
    const [sources] = await db.query(
      `SELECT DISTINCT source FROM news WHERE lang = ? AND source IS NOT NULL AND url IN (${urlSubSql}) ORDER BY source`,
      [langVal]
    );
    const [categories] = await db.query(
      `SELECT DISTINCT category FROM news WHERE lang = ? AND category IS NOT NULL AND url IN (${urlSubSql}) ORDER BY category`,
      [langVal]
    );
    res.json({
      sources: sources.map(r => r.source),
      categories: categories.map(r => r.category),
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

    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch article:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

module.exports = router;
