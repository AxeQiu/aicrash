const sharp = require('sharp');

const WIDTH = 1200;
const HEIGHT = 630;

const SEVERITY_COLORS = {
  5: '#ff1a1a',
  4: '#ff5533',
  3: '#ff8833',
  2: '#ffbb33',
  1: '#ffdd44',
  0: '#00d084',
};

function wrapText(text, maxCharsPerLine) {
  const lines = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf(' ', maxCharsPerLine);
    if (breakAt <= 0) breakAt = maxCharsPerLine;
    lines.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt).trimStart();
  }
  return lines;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateArticleOgImage({ title, severity, source, category }) {
  const sev = severity === 0 ? 0 : (severity || 1);
  const sevColor = SEVERITY_COLORS[sev] || '#ff3b3b';
  const sevLabel = sev === 0 ? 'BULLISH' : `SEV ${sev}`;

  const titleLines = wrapText(title, 38);
  const titleLinesSvg = titleLines
    .map((line, i) => {
      const y = 260 + i * 56;
      return `<text x="80" y="${y}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="42" font-weight="700" fill="#e8e8f0">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#1a1a26"/>
    </linearGradient>
    <linearGradient id="accent-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${sevColor}"/>
      <stop offset="100%" stop-color="${sevColor}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Grid pattern -->
  <g opacity="0.05" stroke="#ffffff" stroke-width="0.5">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${HEIGHT}"/>`).join('\n')}
    ${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="${WIDTH}" y2="${i * 50}"/>`).join('\n')}
  </g>

  <!-- Top accent line -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="url(#accent-line)"/>

  <!-- Severity badge -->
  <rect x="80" y="50" width="120" height="36" rx="4" fill="${sevColor}" opacity="0.2"/>
  <rect x="80" y="50" width="120" height="36" rx="4" fill="none" stroke="${sevColor}" stroke-width="1.5"/>
  <text x="140" y="74" font-family="'Courier New', monospace" font-size="14" font-weight="700" fill="${sevColor}" text-anchor="middle">${sevLabel}</text>

  <!-- Logo -->
  <text x="1120" y="74" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#e8e8f0" text-anchor="end">AICrash<tspan fill="${sevColor}">.news</tspan></text>

  <!-- Terminal prefix -->
  <text x="80" y="200" font-family="'Courier New', monospace" font-size="20" fill="#00ff88" font-weight="700">&gt;_</text>

  <!-- Title -->
  ${titleLinesSvg}

  <!-- Bottom bar -->
  <rect x="0" y="${HEIGHT - 80}" width="${WIDTH}" height="80" fill="#0f0f18" opacity="0.8"/>
  <rect x="0" y="${HEIGHT - 80}" width="${WIDTH}" height="1" fill="#2a2a3a"/>

  <!-- Source & Category -->
  ${source ? `<text x="80" y="${HEIGHT - 42}" font-family="system-ui, sans-serif" font-size="16" fill="#ff3b3b" font-weight="500">${escapeXml(source)}</text>` : ''}
  ${category ? `<text x="${source ? 280 : 80}" y="${HEIGHT - 42}" font-family="system-ui, sans-serif" font-size="14" fill="#555570">${escapeXml(category)}</text>` : ''}

  <!-- Monitor label -->
  <text x="1120" y="${HEIGHT - 42}" font-family="'Courier New', monospace" font-size="13" fill="#555570" text-anchor="end">MONITORING ACTIVE</text>
  <circle cx="1040" cy="${HEIGHT - 47}" r="4" fill="#ff3b3b" opacity="0.8"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateHomeOgImage() {
  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#1a1a26"/>
    </linearGradient>
    <linearGradient id="accent-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff3b3b"/>
      <stop offset="100%" stop-color="#ff3b3b" stop-opacity="0.3"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Grid pattern -->
  <g opacity="0.05" stroke="#ffffff" stroke-width="0.5">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${HEIGHT}"/>`).join('\n')}
    ${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="${WIDTH}" y2="${i * 50}"/>`).join('\n')}
  </g>

  <!-- Top accent line -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="url(#accent-line)"/>

  <!-- Terminal prefix -->
  <text x="${WIDTH / 2}" y="260" font-family="'Courier New', monospace" font-size="28" fill="#00ff88" text-anchor="middle" font-weight="700">&gt;_</text>

  <!-- Main title -->
  <text x="${WIDTH / 2}" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="700" fill="#e8e8f0" text-anchor="middle">AICrash<tspan fill="#ff3b3b">.news</tspan></text>

  <!-- Subtitle -->
  <text x="${WIDTH / 2}" y="390" font-family="system-ui, sans-serif" font-size="24" fill="#8888a0" text-anchor="middle">AI Industry Crash Monitor</text>

  <!-- Description -->
  <text x="${WIDTH / 2}" y="450" font-family="system-ui, sans-serif" font-size="18" fill="#555570" text-anchor="middle">Real-time AI incident tracking &amp; severity analysis</text>

  <!-- Bottom bar -->
  <rect x="0" y="${HEIGHT - 80}" width="${WIDTH}" height="80" fill="#0f0f18" opacity="0.8"/>
  <rect x="0" y="${HEIGHT - 80}" width="${WIDTH}" height="1" fill="#2a2a3a"/>

  <!-- Monitor label -->
  <circle cx="${WIDTH / 2 - 80}" cy="${HEIGHT - 47}" r="5" fill="#ff3b3b" opacity="0.8"/>
  <text x="${WIDTH / 2 - 60}" y="${HEIGHT - 42}" font-family="'Courier New', monospace" font-size="15" fill="#ff3b3b" font-weight="700" letter-spacing="2">MONITORING ACTIVE</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateArticleOgImage, generateHomeOgImage };
