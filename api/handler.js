const fs = require('fs');
const crypto = require('crypto');

const DATA_FILE = '/tmp/cachos.json';

function loadData() {
  if (global.__cachos) return global.__cachos;
  try {
    global.__cachos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    global.__cachos = { visits: {} };
  }
  return global.__cachos;
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(global.__cachos)); } catch {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, code, id } = req.query;
  const data = loadData();

  if (action === 'track' && code) {
    let dest = req.query.dest;
    if (!dest) return res.status(400).send('Missing destination');
    try { dest = Buffer.from(dest, 'base64url').toString('utf8'); } catch { return res.status(400).send('Invalid destination'); }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || '';
    const country = decodeURIComponent(req.headers['x-vercel-ip-country'] || '');
    const region = decodeURIComponent(req.headers['x-vercel-ip-country-region'] || '');
    const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || '');
    const lat = parseFloat(req.headers['x-vercel-ip-latitude']) || 0;
    const lon = parseFloat(req.headers['x-vercel-ip-longitude']) || 0;
    const ua = req.headers['user-agent'] || '';

    if (!data.visits[code]) data.visits[code] = [];
    data.visits[code].push({
      id: crypto.randomBytes(4).toString('hex'),
      ip, country, region, city, lat, lon,
      user_agent: ua,
      visited_at: new Date().toISOString(),
    });
    saveData();

    res.writeHead(302, { Location: dest });
    return res.end();
  }

  if (action === 'visits' && code) {
    return res.json(data.visits[code] || []);
  }

  if (action === 'clear' && code && req.method === 'DELETE') {
    delete data.visits[code];
    saveData();
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'Invalid action' });
};
