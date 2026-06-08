require('dotenv').config();
const { pool } = require('./src/config/database');

async function check() {
  try {
    const res = await pool.query('SELECT * FROM booking_domain.bookings');
    console.log('--- ALL BOOKINGS ---');
    console.log(res.rows);

    const users = await pool.query('SELECT id, email FROM user_domain.users');
    console.log('\n--- ALL USERS ---');
    console.log(users.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
