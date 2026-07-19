const { neon } = require('@neondatabase/serverless');

function getSQL() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTables() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      destination TEXT NOT NULL,
      title TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      ip TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      user_agent TEXT,
      visited_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

module.exports = { getSQL, ensureTables };
