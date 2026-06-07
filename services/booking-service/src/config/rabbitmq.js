/**
 * config/rabbitmq.js
 * ============================================================
 * Quản lý kết nối và channel đến RabbitMQ dùng thư viện `amqplib`.
 *
 * Thiết kế:
 *  - Singleton connection + channel được chia sẻ toàn service.
 *  - Tự động reconnect khi connection bị đóng bất ngờ.
 *  - Khai báo đầy đủ topology: main exchange, DLX, các queue.
 *
 * ── Topology tổng thể ─────────────────────────────────────────
 *
 *  [booking.exchange]  ──routing_key: booking.created──►  [booking_requests_queue]
 *                       │                                        │  (BookingConsumer)
 *                       │
 *                       ├──routing_key: booking.hold──────►  [booking_hold_queue]
 *                       │                                    (TTL = 10 phút, no consumer)
 *                       │                                         │ hết TTL → dead-letter
 *                       │                                         ▼
 *                       │  [booking.deadletter.exchange] ──► [booking_timeout_queue]
 *                       │                                    (BookingTimeoutConsumer)
 *                       │                                     Hủy PENDING, hoàn trả inventory
 *                       │
 *                       └──routing_key: booking.confirmed──► [booking_notification_queue]
 *                                                            (BookingNotificationConsumer)
 *                                                             Cấp QR + Gửi email xác nhận
 *
 * ============================================================
 */

'use strict';

require('dotenv').config();
const amqp = require('amqplib');

// ── Cấu hình từ biến môi trường ──────────────────────────────
const RABBITMQ_URL       = process.env.RABBITMQ_URL         || 'amqp://guest:guest@localhost:5672';
const RECONNECT_DELAY_MS = parseInt(process.env.RABBITMQ_RECONNECT_DELAY_MS || '5000', 10);
const BOOKING_TTL_MS     = parseInt(process.env.BOOKING_HOLD_MINUTES || '10', 10) * 60 * 1000;

// ── Tên Exchange ──────────────────────────────────────────────
const EXCHANGE_NAME    = 'booking.exchange';          // Exchange chính (topic)
const DLX_EXCHANGE     = 'booking.deadletter.exchange'; // Dead Letter Exchange (direct)

// ── Tên Queue ─────────────────────────────────────────────────
const BOOKING_REQUESTS_QUEUE      = 'booking_requests_queue';      // Queue xử lý đặt vé
const BOOKING_HOLD_QUEUE          = 'booking_hold_queue';          // Queue giữ chỗ, có TTL
const BOOKING_TIMEOUT_QUEUE       = 'booking_timeout_queue';       // Queue nhận message hết hạn (DLX)
const BOOKING_NOTIFICATION_QUEUE  = 'booking_notification_queue';  // Queue gửi email + QR (FR-06)

// ── Routing Keys ──────────────────────────────────────────────
const RK_BOOKING_CREATED   = 'booking.created';   // Publisher   → booking_requests_queue
const RK_BOOKING_HOLD      = 'booking.hold';      // Consumer    → booking_hold_queue
const RK_BOOKING_EXPIRED   = 'booking.expired';   // DLX         → booking_timeout_queue
const RK_BOOKING_CONFIRMED = 'booking.confirmed'; // WebhookRoute → booking_notification_queue

// ── Singleton state ───────────────────────────────────────────
let connection = null;
let channel    = null;

/**
 * Khai báo toàn bộ topology RabbitMQ:
 *  1. Exchange chính (topic)
 *  2. Dead Letter Exchange (direct)
 *  3. booking_requests_queue  → bind booking.exchange / booking.created
 *  4. booking_hold_queue      → TTL + DLX config → bind booking.exchange / booking.hold
 *  5. booking_timeout_queue   → bind booking.deadletter.exchange / booking.expired
 *
 * @param {amqp.Channel} ch - Channel đã được tạo
 */
async function setupTopology(ch) {
  // ── 1. Exchange chính (topic, durable) ───────────────────────
  // Dùng type "topic" để một exchange có thể route đến nhiều queue
  // bằng các routing key khác nhau.
  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  console.log(`[RabbitMQ] ✓ Exchange : ${EXCHANGE_NAME} (topic)`);

  // ── 2. Dead Letter Exchange (direct, durable) ─────────────────
  // DLX nhận message "chết" (hết TTL, bị reject) từ booking_hold_queue.
  // Dùng type "direct" vì chỉ cần route chính xác đến 1 queue.
  await ch.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });
  console.log(`[RabbitMQ] ✓ DL Exchange: ${DLX_EXCHANGE} (direct)`);

  // ── 3. booking_requests_queue (queue xử lý đặt vé) ───────────
  // Queue thông thường, không có TTL hay DLX.
  await ch.assertQueue(BOOKING_REQUESTS_QUEUE, { durable: true });
  await ch.bindQueue(BOOKING_REQUESTS_QUEUE, EXCHANGE_NAME, RK_BOOKING_CREATED);
  console.log(`[RabbitMQ] ✓ Queue    : ${BOOKING_REQUESTS_QUEUE} → ${RK_BOOKING_CREATED}`);

  // ── 4. booking_hold_queue (queue giữ chỗ với TTL + DLX) ──────
  //
  // *** ĐÂY LÀ TRÁI TIM CỦA CƠ CHẾ TỰ ĐỘNG HỦY VÉ ***
  //
  // Khi consumer tạo booking PENDING thành công, nó publish một
  // message vào queue này. Message sẽ nằm đây trong BOOKING_TTL_MS.
  //
  // Nếu sau TTL vẫn chưa bị consume (không có consumer nào đọc),
  // RabbitMQ tự động chuyển (dead-letter) message sang DLX với
  // routing key x-dead-letter-routing-key.
  //
  // QUAN TRỌNG: booking_hold_queue cố tình KHÔNG có consumer!
  // Mục đích của nó chỉ là làm "bộ đếm thời gian" (timer).
  await ch.assertQueue(BOOKING_HOLD_QUEUE, {
    durable: true,
    arguments: {
      // Sau BOOKING_TTL_MS mili-giây, message bị "chết" và
      // chuyển sang exchange bên dưới.
      'x-message-ttl':              BOOKING_TTL_MS,

      // Exchange nhận message "chết" – chính là DLX của chúng ta.
      'x-dead-letter-exchange':     DLX_EXCHANGE,

      // Routing key mà DLX sẽ dùng để route message "chết"
      // đến booking_timeout_queue.
      'x-dead-letter-routing-key':  RK_BOOKING_EXPIRED,
    },
  });
  await ch.bindQueue(BOOKING_HOLD_QUEUE, EXCHANGE_NAME, RK_BOOKING_HOLD);
  console.log(`[RabbitMQ] ✓ Queue    : ${BOOKING_HOLD_QUEUE} (TTL=${BOOKING_TTL_MS}ms, DLX=${DLX_EXCHANGE})`);

  // ── 5. booking_timeout_queue (queue nhận message hết hạn) ─────
  // Consumer bookingTimeoutConsumer.js sẽ lắng nghe queue này.
  // Khi nhận được message → booking đã quá hạn → hủy + hoàn trả vé.
  await ch.assertQueue(BOOKING_TIMEOUT_QUEUE, { durable: true });
  await ch.bindQueue(BOOKING_TIMEOUT_QUEUE, DLX_EXCHANGE, RK_BOOKING_EXPIRED);
  console.log(`[RabbitMQ] ✓ Queue    : ${BOOKING_TIMEOUT_QUEUE} → ${RK_BOOKING_EXPIRED} (DLX sink)`);

  // ── 6. booking_notification_queue (FR-06: cấp QR + gửi email) ─
  // Webhook route publish message vào đây SAU KHI commit DB thành công.
  // BookingNotificationConsumer lắng nghe, đọc ticket_codes từ DB
  // rồi render QR và gửi email xác nhận cho user.
  // Tách hoàn toàn khỏi luồng HTTP → không block response webhook.
  await ch.assertQueue(BOOKING_NOTIFICATION_QUEUE, { durable: true });
  await ch.bindQueue(BOOKING_NOTIFICATION_QUEUE, EXCHANGE_NAME, RK_BOOKING_CONFIRMED);
  console.log(`[RabbitMQ] ✓ Queue    : ${BOOKING_NOTIFICATION_QUEUE} → ${RK_BOOKING_CONFIRMED} (notification)`);
}

/**
 * Khởi tạo kết nối tới RabbitMQ và setup toàn bộ topology.
 * Tự động retry vô hạn nếu broker chưa sẵn sàng.
 *
 * @returns {Promise<amqp.Channel>}
 */
async function connect() {
  try {
    console.log('[RabbitMQ] Đang kết nối tới:', RABBITMQ_URL);
    connection = await amqp.connect(RABBITMQ_URL);

    // Lắng nghe lỗi và sự kiện đóng kết nối để tự động reconnect
    connection.on('error', (err) => {
      console.error('[RabbitMQ] Connection error:', err.message);
    });
    connection.on('close', () => {
      console.warn('[RabbitMQ] Connection closed. Reconnecting sau', RECONNECT_DELAY_MS, 'ms...');
      channel    = null;
      connection = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    // Tạo channel dùng chung
    channel = await connection.createChannel();

    // Giới hạn mỗi consumer chỉ xử lý 1 message tại một thời điểm
    await channel.prefetch(1);

    // Khai báo đầy đủ exchanges, queues và bindings
    await setupTopology(channel);

    console.log('[RabbitMQ] ✓ Kết nối và topology thiết lập thành công.');
    return channel;

  } catch (err) {
    console.error('[RabbitMQ] Không thể kết nối:', err.message);
    console.log(`[RabbitMQ] Thử lại sau ${RECONNECT_DELAY_MS}ms...`);
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    return connect(); // Đệ quy retry
  }
}

/**
 * Lấy channel singleton hiện tại.
 *
 * @returns {amqp.Channel}
 * @throws {Error} nếu chưa gọi connect()
 */
function getChannel() {
  if (!channel) {
    throw new Error('[RabbitMQ] Channel chưa được khởi tạo. Hãy gọi connect() trước.');
  }
  return channel;
}

/**
 * Đóng kết nối RabbitMQ (graceful shutdown).
 */
async function disconnect() {
  try {
    if (channel)    await channel.close();
    if (connection) await connection.close();
    console.log('[RabbitMQ] Đã đóng kết nối.');
  } catch (err) {
    console.error('[RabbitMQ] Lỗi khi đóng kết nối:', err.message);
  }
}

module.exports = {
  connect,
  getChannel,
  disconnect,
  // Tên exchange
  EXCHANGE_NAME,
  DLX_EXCHANGE,
  // Tên queue
  BOOKING_REQUESTS_QUEUE,
  BOOKING_HOLD_QUEUE,
  BOOKING_TIMEOUT_QUEUE,
  BOOKING_NOTIFICATION_QUEUE,
  // Routing keys
  RK_BOOKING_CREATED,
  RK_BOOKING_HOLD,
  RK_BOOKING_EXPIRED,
  RK_BOOKING_CONFIRMED,
};
