const { getSQL, ensureTables } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await ensureTables();
  const sql = getSQL();
  const { id } = req.query;

  const visits = await sql`
    SELECT * FROM visits WHERE link_id = ${id} ORDER BY visited_at DESC
  `;

  res.json(visits);
};
