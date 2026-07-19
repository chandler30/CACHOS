const { getSQL, ensureTables } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  await ensureTables();
  const sql = getSQL();
  const { id } = req.query;

  await sql`DELETE FROM visits WHERE link_id = ${id}`;
  await sql`DELETE FROM links WHERE id = ${id}`;

  res.json({ ok: true });
};
