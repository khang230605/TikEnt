/**
 * server.js – User Payment Service
 * Khởi động theo thứ tự: DB → RabbitMQ → HTTP server
 */
'use strict';

require('dotenv').config();
const app = require('./api/app');
const { testConnection } = require('./config/database');
const { connect: connectMQ } = require('./config/rabbitmq');

const PORT = parseInt(process.env.PORT || '3003', 10);

async function bootstrap() {
  try {
    await testConnection();
    // Kết nối RabbitMQ ở background – không block HTTP startup
    connectMQ().catch((err) => {
      console.warn('[Server] RabbitMQ kết nối lỗi ban đầu (đang retry):', err.message);
    });
    app.listen(PORT, () => {
      console.log('══════════════════════════════════════════════');
      console.log(' TickEnt – User & Payment Service');
      console.log(` Listening on http://localhost:${PORT}`);
      console.log('══════════════════════════════════════════════');
    });
  } catch (err) {
    console.error('[Server] Không thể khởi động:', err.message);
    process.exit(1);
  }
}

bootstrap();
