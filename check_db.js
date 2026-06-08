const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tickent_db'
});

async function checkBookings() {
  try {
    const res = await pool.query('SELECT id, user_id, status FROM booking_domain.bookings');
    console.log('Bookings in DB:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkBookings();
