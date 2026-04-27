const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

/**
 * Execute a callback inside a transaction with the tenant context locked.
 *
 * RLS policies read app.current_tenant_id to enforce row isolation.
 * SET LOCAL scopes the variable to this transaction only — it is never
 * visible to other connections or transactions in the pool.
 *
 * @param {string} tenantId  - UUID of the authenticated tenant
 * @param {Function} callback - async (client) => result
 */
async function withTenantContext(tenantId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(key, value, is_local=true) is the parameterized equivalent of
    // SET LOCAL — scopes the variable to this transaction only.
    // SET LOCAL doesn't accept $1 placeholders; set_config does.
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_tenant_id',
      tenantId,
    ]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTenantContext };
