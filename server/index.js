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
  res.write('data: {"type":"connected"}\n\n');

  const client = { res, id: Date.now() };
  sseClients.add(client);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

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
