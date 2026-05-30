const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/news', async (req, res) => {
  try {
    const { page = 1, limit = 50, source, category, severity, search, start_date, end_date } = req.query;
    const limitVal = parseInt(limit, 10);
    const offsetVal = (parseInt(page, 10) - 1) * limitVal;

    let where = ['1=1'];
    let params = [];

    if (source) {
      where.push('source = ?');
      params.push(source);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (severity) {
      where.push('severity = ?');
      params.push(parseInt(severity, 10));
    }
    if (search) {
      where.push('(title LIKE ? OR summary LIKE ? OR title_en LIKE ? OR summary_en LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (start_date) {
      where.push('published_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('published_at <= ?');
      params.push(end_date);
    }

    const whereClause = where.join(' AND ');

    const countSql = `SELECT COUNT(*) as total FROM news WHERE ${whereClause}`;
    const [countRows] = await db.query(countSql, params);
    const total = countRows[0].total;

    const dataSql = `SELECT * FROM news WHERE ${whereClause} ORDER BY published_at DESC LIMIT ${limitVal} OFFSET ${offsetVal}`;
    const [rows] = await db.query(dataSql, params);

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
    const { period = 'day', days = 30 } = req.query;
    const dateFormat = period === 'week' ? '%Y-%u' : '%Y-%m-%d';

    const sql = `
      SELECT
        DATE_FORMAT(published_at, '${dateFormat}') AS period,
        COUNT(*) AS count,
        AVG(severity) AS avg_severity
      FROM news
      WHERE published_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY period
      ORDER BY period ASC
    `;
    const [rows] = await db.query(sql, [parseInt(days, 10)]);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

router.get('/news/filters', async (req, res) => {
  try {
    const [sources] = await db.query('SELECT DISTINCT source FROM news WHERE source IS NOT NULL ORDER BY source');
    const [categories] = await db.query('SELECT DISTINCT category FROM news WHERE category IS NOT NULL ORDER BY category');
    res.json({
      sources: sources.map(r => r.source),
      categories: categories.map(r => r.category),
    });
  } catch (err) {
    console.error('Failed to fetch filters:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

module.exports = router;
