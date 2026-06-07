/**
 * config/database.js
 * PostgreSQL connection pool singleton.
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'tickent',
      user:     process.env.DB_USER     || 'tickent_user',
      password: process.env.DB_PASSWORD || '',
      max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis:       30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS now');
    console.log(`[DB] Connected. Server time: ${rows[0].now}`);
  } catch (err) {
    console.error('[DB] Failed to connect:', err.message);
    throw err;
  } finally {
    if (client) client.release();
  }
}

module.exports = { pool, testConnection };
