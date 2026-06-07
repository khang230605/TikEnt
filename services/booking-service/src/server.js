/**
 * server.js
 * ============================================================
 * Entry point cho Booking Service API.
 * Khởi động theo thứ tự:
 *   1. Kết nối PostgreSQL (fail-fast nếu DB không sẵn sàng)
 *   2. Kết nối RabbitMQ (fail-fast nếu broker không sẵn sàng)
 *   3. Khởi động Express HTTP server
 *
 * Để chạy Consumer Worker riêng biệt:
 *   npm run consumer
 * ============================================================
 */

'use strict';

require('dotenv').config();

const app                      = require('./api/app');
const { testConnection }       = require('./config/database');
const { connect: connectMQ }   = require('./config/rabbitmq');

const PORT = parseInt(process.env.PORT || '3001', 10);

async function bootstrap() {
  try {
    // Bước 1: Kiểm tra kết nối PostgreSQL (fail-fast nếu DB không sẵn sàng)
    await testConnection();

    // Bước 2: Kết nối RabbitMQ ở background (không block HTTP startup)
    // Cho phép service nhận HTTP request ngay cả khi RabbitMQ chưa sẵn sàng.
    // Các route cần publish sẽ throw lỗi nếu channel chưa có, nhưng service vẫn sống.
    connectMQ().catch((err) => {
      console.warn('[Server] RabbitMQ kết nối lỗi ban đầu (đang retry):', err.message);
    });

    // Bước 3: Khởi động HTTP server ngay lập tức
    app.listen(PORT, () => {
      console.log('══════════════════════════════════════════════');
      console.log(` TickEnt – Booking Service API`);
      console.log(` Listening on http://localhost:${PORT}`);
      console.log(` ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log('══════════════════════════════════════════════');
    });

  } catch (err) {
    console.error('[Server] Không thể khởi động service:', err.message);
    process.exit(1); // Fail-fast: để orchestrator (Docker/k8s) restart
  }
}

bootstrap();
