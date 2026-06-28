const { Pool } = require('pg');
const { config } = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl
});

async function findLinkByCode(code) {
  const result = await pool.query(
    'SELECT code, long_url, created_at FROM links WHERE code = $1',
    [code]
  );

  return result.rows[0] || null;
}

async function createLink(code, longUrl) {
  const result = await pool.query(
    `INSERT INTO links (code, long_url)
     VALUES ($1, $2)
     ON CONFLICT (code) DO NOTHING
     RETURNING code, long_url, created_at`,
    [code, longUrl]
  );

  return result.rows[0] || null;
}

module.exports = {
  pool,
  findLinkByCode,
  createLink
};
