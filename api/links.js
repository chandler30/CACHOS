const crypto = require('crypto');
const { getSQL, ensureTables } = require('../lib/db');

module.exports = async function handler(req, res) {
  await ensureTables();
  const sql = getSQL();

  if (req.method === 'POST') {
    const { destination, title } = req.body;
    if (!destination) return res.status(400).json({ error: 'URL de destino requerida' });

    const id = crypto.randomUUID();
    const code = crypto.randomBytes(4).toString('hex');

    await sql`
      INSERT INTO links (id, code, destination, title)
      VALUES (${id}, ${code}, ${destination}, ${title || ''})
    `;

    const rows = await sql`SELECT * FROM links WHERE id = ${id}`;
    return res.json(rows[0]);
  }

  if (req.method === 'GET') {
    const links = await sql`SELECT * FROM links ORDER BY created_at DESC`;
    const enriched = [];
    for (const l of links) {
      const visits = await sql`SELECT COUNT(*)::int AS count FROM visits WHERE link_id = ${l.id}`;
      enriched.push({ ...l, visit_count: visits[0].count });
    }
    return res.json(enriched);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
