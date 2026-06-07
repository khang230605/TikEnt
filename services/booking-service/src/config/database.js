/**
 * config/database.js
 * ============================================================
 * Cấu hình kết nối PostgreSQL dùng connection pool của thư viện `pg`.
 * Pool được tạo một lần duy nhất (singleton) và tái sử dụng xuyên suốt
 * vòng đời của service để tránh overhead kết nối lại.
 * ============================================================
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

// Tạo pool kết nối:
// Ưu tiên DATABASE_URL (Supabase / production) nếu có,
// ngược lại fallback về các biến DB_* riêng lẻ (local dev).
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Supabase dùng pgbouncer → cần ssl và tắt prepared statements
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis:       parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS        || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '5000',  10),
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'tickent',
      user:     process.env.DB_USER     || 'tickent_user',
      password: process.env.DB_PASSWORD || '',
      max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis:       parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS        || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '5000',  10),
    };

const pool = new Pool(poolConfig);

// Lắng nghe sự kiện lỗi của pool để tránh crash process khi connection bị drop
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

// Hàm kiểm tra kết nối DB khi khởi động service
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS now');
    console.log(`[DB] Connected to PostgreSQL. Server time: ${rows[0].now}`);
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    throw err; // Ném lỗi ra ngoài để server dừng khởi động
  } finally {
    if (client) client.release(); // Luôn trả connection về pool
  }
}

module.exports = { pool, testConnection };
