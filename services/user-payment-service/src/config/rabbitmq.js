/**
 * config/rabbitmq.js – User Payment Service
 * ============================================================
 * Kết nối RabbitMQ để:
 *  1. Publish booking.confirmed → booking_notification_queue
 *     (từ webhook controller sau khi payment SUCCESS)
 *  2. Notification Consumer lắng nghe booking_notification_queue
 *     để gửi email + QR.
 * ============================================================
 */
'use strict';

require('dotenv').config();
const amqp = require('amqplib');

const RABBITMQ_URL       = process.env.RABBITMQ_URL         || 'amqp://guest:guest@localhost:5672';
const RECONNECT_DELAY_MS = parseInt(process.env.RABBITMQ_RECONNECT_DELAY_MS || '5000', 10);

// Tên exchange và queue (phải khớp với booking-service)
const EXCHANGE_NAME             = 'booking.exchange';
const BOOKING_NOTIFICATION_QUEUE = 'booking_notification_queue';
const RK_BOOKING_CONFIRMED      = 'booking.confirmed';

let connection = null;
let channel    = null;

async function setupTopology(ch) {
  // Assert exchange (idempotent – nếu đã tồn tại, không tạo lại)
  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  // Assert notification queue
  await ch.assertQueue(BOOKING_NOTIFICATION_QUEUE, { durable: true });
  await ch.bindQueue(BOOKING_NOTIFICATION_QUEUE, EXCHANGE_NAME, RK_BOOKING_CONFIRMED);

  console.log(`[RabbitMQ] ✓ Exchange : ${EXCHANGE_NAME}`);
  console.log(`[RabbitMQ] ✓ Queue    : ${BOOKING_NOTIFICATION_QUEUE} → ${RK_BOOKING_CONFIRMED}`);
}

async function connect() {
  try {
    console.log('[RabbitMQ] Đang kết nối:', RABBITMQ_URL);
    connection = await amqp.connect(RABBITMQ_URL);

    connection.on('error', (err) => console.error('[RabbitMQ] Connection error:', err.message));
    connection.on('close', () => {
      console.warn('[RabbitMQ] Mất kết nối. Reconnecting...');
      channel = null; connection = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    channel = await connection.createChannel();
    await channel.prefetch(1);
    await setupTopology(channel);

    console.log('[RabbitMQ] ✓ Kết nối thành công.');
    return channel;
  } catch (err) {
    console.error('[RabbitMQ] Lỗi kết nối:', err.message);
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    return connect();
  }
}

function getChannel() {
  if (!channel) throw new Error('[RabbitMQ] Channel chưa khởi tạo.');
  return channel;
}

async function disconnect() {
  try {
    if (channel)    await channel.close();
    if (connection) await connection.close();
  } catch (err) {
    console.error('[RabbitMQ] Lỗi disconnect:', err.message);
  }
}

module.exports = {
  connect, getChannel, disconnect,
  EXCHANGE_NAME, BOOKING_NOTIFICATION_QUEUE, RK_BOOKING_CONFIRMED,
};
