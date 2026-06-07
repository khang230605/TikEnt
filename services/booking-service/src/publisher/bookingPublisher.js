/**
 * publisher/bookingPublisher.js
 * ============================================================
 * BOOKING PUBLISHER – Thành phần 1/2
 * ============================================================
 *
 * Trách nhiệm:
 *  1. Đóng gói thông tin đặt vé thành JSON message.
 *  2. Publish message vào RabbitMQ Exchange với Routing Key
 *     tương ứng.
 *  3. KHÔNG ghi trực tiếp xuống Database.
 *
 * Message schema (published to RabbitMQ):
 * {
 *   bookingCode    : "TICK-20241201-A3F9",
 *   userId         : "uuid",
 *   eventId        : "uuid",
 *   ticketTierId   : "uuid",
 *   quantity       : 2,
 *   paymentMethod  : "VNPAY",
 *   attendees      : [...],
 *   publishedAt    : "ISO8601 timestamp"
 * }
 * ============================================================
 */

'use strict';

const { getChannel, EXCHANGE_NAME, ROUTING_KEY } = require('../config/rabbitmq');

/**
 * Publish một booking request message vào RabbitMQ.
 *
 * @param {Object} bookingData - Dữ liệu đặt vé đã được validate
 * @param {string} bookingData.bookingCode    - Mã đặt vé đã sinh
 * @param {string} bookingData.userId         - UUID người đặt vé
 * @param {string} bookingData.eventId        - UUID sự kiện
 * @param {string} bookingData.ticketTierId   - UUID hạng vé
 * @param {number} bookingData.quantity       - Số lượng vé
 * @param {string} bookingData.paymentMethod  - Phương thức thanh toán
 * @param {Array}  bookingData.attendees      - Danh sách người tham dự (optional)
 *
 * @returns {Promise<void>}
 * @throws {Error} nếu publish thất bại
 */
async function publishBookingCreated(bookingData) {
  // Lấy channel đã được khởi tạo từ singleton
  const channel = getChannel();

  // Đóng gói payload – thêm timestamp để consumer biết thời điểm publish
  const message = {
    bookingCode:   bookingData.bookingCode,
    userId:        bookingData.userId,
    eventId:       bookingData.eventId,
    ticketTierId:  bookingData.ticketTierId,
    quantity:      bookingData.quantity,
    paymentMethod: bookingData.paymentMethod,
    attendees:     bookingData.attendees || [],
    publishedAt:   new Date().toISOString(),
  };

  // Chuyển object thành Buffer (RabbitMQ chỉ nhận Buffer / string)
  const messageBuffer = Buffer.from(JSON.stringify(message));

  // Publish vào exchange với routing key
  // persistent: true → message được ghi disk, không mất nếu RabbitMQ restart
  const published = channel.publish(
    EXCHANGE_NAME,
    ROUTING_KEY,
    messageBuffer,
    {
      persistent:  true,                    // message bền vững
      contentType: 'application/json',
      messageId:   bookingData.bookingCode, // dùng bookingCode làm message ID (idempotency)
      timestamp:   Math.floor(Date.now() / 1000),
    }
  );

  if (!published) {
    // channel.publish trả về false khi internal buffer đầy (back-pressure)
    throw new Error('RabbitMQ channel buffer đầy, không thể publish message.');
  }

  console.log(`[Publisher] ✓ Đã publish message: bookingCode=${message.bookingCode}, routingKey=${ROUTING_KEY}`);
}

module.exports = { publishBookingCreated };
