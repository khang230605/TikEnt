const { pool } = require('../services/booking-service/src/config/database');

async function runMigration() {
  try {
    console.log('Connecting to DB...');
    const dbClient = await pool.connect();
    console.log('Running ALTER TABLE...');
    await dbClient.query(`
      ALTER TABLE booking_domain.bookings 
      ADD COLUMN IF NOT EXISTS ticket_tier_id UUID;
    `);
    console.log('Migration successful!');
    dbClient.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
