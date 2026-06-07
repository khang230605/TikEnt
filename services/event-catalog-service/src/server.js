/**
 * server.js – Event Catalog Service
 */
'use strict';

require('dotenv').config();
const app = require('./api/app');
const { testConnection } = require('./config/database');

const PORT = parseInt(process.env.PORT || '3002', 10);

async function bootstrap() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log('══════════════════════════════════════════════');
      console.log(` TickEnt – Event Catalog Service`);
      console.log(` Listening on http://localhost:${PORT}`);
      console.log('══════════════════════════════════════════════');
    });
  } catch (err) {
    console.error('[Server] Không thể khởi động:', err.message);
    process.exit(1);
  }
}

bootstrap();
