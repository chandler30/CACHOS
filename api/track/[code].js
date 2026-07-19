const { getSQL, ensureTables } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  await ensureTables();
  const sql = getSQL();
  const { code } = req.query;

  const rows = await sql`SELECT * FROM links WHERE code = ${code}`;
  if (rows.length === 0) return res.status(404).send('Link no encontrado');

  const link = rows[0];

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '';

  const country = req.headers['x-vercel-ip-country'] || '';
  const region = req.headers['x-vercel-ip-country-region'] || '';
  const city = req.headers['x-vercel-ip-city'] || '';
  const lat = parseFloat(req.headers['x-vercel-ip-latitude']) || 0;
  const lon = parseFloat(req.headers['x-vercel-ip-longitude']) || 0;
  const ua = req.headers['user-agent'] || '';

  await sql`
    INSERT INTO visits (link_id, ip, country, region, city, lat, lon, user_agent)
    VALUES (${link.id}, ${ip}, ${country}, ${region}, ${city}, ${lat}, ${lon}, ${ua})
  `;

  res.writeHead(302, { Location: link.destination });
  res.end();
};
