const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);

// --- Database ---
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    destination TEXT NOT NULL,
    title TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    ip TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    lat REAL,
    lon REAL,
    isp TEXT,
    user_agent TEXT,
    visited_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (link_id) REFERENCES links(id)
  );
`);

const insertLink = db.prepare('INSERT INTO links (id, code, destination, title) VALUES (?, ?, ?, ?)');
const findByCode = db.prepare('SELECT * FROM links WHERE code = ?');
const getAllLinks = db.prepare('SELECT * FROM links ORDER BY created_at DESC');
const deleteLink = db.prepare('DELETE FROM links WHERE id = ?');
const deleteVisitsByLink = db.prepare('DELETE FROM visits WHERE link_id = ?');
const insertVisit = db.prepare('INSERT INTO visits (link_id, ip, country, region, city, lat, lon, isp, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const getVisitsByLink = db.prepare('SELECT * FROM visits WHERE link_id = ? ORDER BY visited_at DESC');

function generateCode() {
  return crypto.randomBytes(4).toString('hex');
}

function geolocate(ip) {
  return new Promise((resolve) => {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return resolve({ country: 'Local', region: 'Local', city: 'Localhost', lat: 0, lon: 0, isp: 'Local' });
    }
    const cleanIp = ip.replace('::ffff:', '');
    const url = `http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city,lat,lon,isp`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success') {
            resolve({
              country: parsed.country || 'Desconocido',
              region: parsed.regionName || 'Desconocido',
              city: parsed.city || 'Desconocido',
              lat: parsed.lat || 0,
              lon: parsed.lon || 0,
              isp: parsed.isp || 'Desconocido',
            });
          } else {
            resolve({ country: 'Desconocido', region: '', city: '', lat: 0, lon: 0, isp: '' });
          }
        } catch {
          resolve({ country: 'Error', region: '', city: '', lat: 0, lon: 0, isp: '' });
        }
      });
    }).on('error', () => {
      resolve({ country: 'Error', region: '', city: '', lat: 0, lon: 0, isp: '' });
    });
  });
}

// --- API Routes ---

// Create link
app.post('/api/links', (req, res) => {
  const { destination, title } = req.body;
  if (!destination) return res.status(400).json({ error: 'URL de destino requerida' });

  const id = crypto.randomUUID();
  const code = generateCode();
  insertLink.run(id, code, destination, title || '');
  const link = findByCode.get(code);
  res.json(link);
});

// List links
app.get('/api/links', (_req, res) => {
  const links = getAllLinks.all();
  const enriched = links.map(l => {
    const visits = getVisitsByLink.all(l.id);
    return { ...l, visit_count: visits.length };
  });
  res.json(enriched);
});

// Get visits for a link
app.get('/api/links/:id/visits', (req, res) => {
  const visits = getVisitsByLink.all(req.params.id);
  res.json(visits);
});

// Delete link
app.delete('/api/links/:id', (req, res) => {
  deleteVisitsByLink.run(req.params.id);
  deleteLink.run(req.params.id);
  res.json({ ok: true });
});

// --- Tracking redirect ---
app.get('/t/:code', async (req, res) => {
  const link = findByCode.get(req.params.code);
  if (!link) return res.status(404).send('Link no encontrado');

  const ip = req.ip || req.connection.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  const geo = await geolocate(ip);
  insertVisit.run(link.id, ip, geo.country, geo.region, geo.city, geo.lat, geo.lon, geo.isp, ua);

  res.redirect(link.destination);
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CACHOS corriendo en http://localhost:${PORT}`);
});
