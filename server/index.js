require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const newsRouter = require('./routes/news');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/article/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'article.html'));
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = req.query.base || 'https://aicrash.news';
    const [rows] = await db.query(`
      SELECT n.url, MAX(n.created_at) as lastmod
      FROM news n
      INNER JOIN (
        SELECT url, MAX(created_at) as max_created
        FROM news
        GROUP BY url
      ) sub ON n.url = sub.url AND n.created_at = sub.max_created
      GROUP BY n.url
      ORDER BY n.created_at DESC
      LIMIT 5000
    `);

    const urls = rows.map(row => {
      const articleUrl = `${baseUrl}/article/${encodeURIComponent(row.url)}`;
      const lastmod = row.lastmod ? new Date(row.lastmod).toISOString().split('T')[0] : '';
      return `  <url>
    <loc>${articleUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', newsRouter);

const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('event: connected\ndata: {}\n\n');

  const client = { res, id: Date.now() };
  sseClients.add(client);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

function broadcastPing() {
  const payload = 'event: ping\ndata: {}\n\n';
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

setInterval(broadcastPing, 25000);

function broadcastToSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

let lastCheckTime = new Date();

setInterval(async () => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM news WHERE created_at > ? ORDER BY created_at DESC',
      [lastCheckTime]
    );
    if (rows.length > 0) {
      broadcastToSSE('new_news', rows);
      lastCheckTime = new Date();
    }
  } catch (err) {
    console.error('SSE poll error:', err);
  }
}, 5000);

app.listen(PORT, () => {
  console.log(`aicrash.news server running on http://localhost:${PORT}`);
});
