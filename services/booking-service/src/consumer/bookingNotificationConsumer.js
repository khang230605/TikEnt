/**
 * consumer/bookingNotificationConsumer.js
 * ============================================================
 * BOOKING NOTIFICATION CONSUMER – FR-06: Cấp mã QR + Gửi Email
 * ============================================================
 *
 * Script worker chạy độc lập: npm run consumer:notification
 *
 * Luồng hoạt động trong nền (Event-Driven):
 *
 *  [Webhook Route]
 *      │  (sau COMMIT thành công)
 *      │  publish → booking.exchange / booking.confirmed
 *      ▼
 *  [booking_notification_queue]
 *      │
 *      ▼ consume
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  BookingNotificationConsumer                            │
 *  │                                                         │
 *  │  1. Parse message { bookingCode, userId, ticketCodes }  │
 *  │                                                         │
 *  │  2. Query DB: lấy đầy đủ thông tin vé                   │
 *  │     SELECT tickets JOIN bookings JOIN events            │
 *  │                                                         │
 *  │  3. Sinh QR payload URL cho từng ticket_code            │
 *  │     https://qr.tickent.io/verify?code=TKT-...          │
 *  │                                                         │
 *  │  4. Gọi emailService.sendConfirmation() (mock/SendGrid) │
 *  │     → Log chi tiết nếu mock, gửi thật nếu production   │
 *  │                                                         │
 *  │  5. ACK message → RabbitMQ xóa khỏi queue              │
 *  └─────────────────────────────────────────────────────────┘
 *
 * ============================================================
 */

'use strict';

require('dotenv').config();

const {
  connect,
  BOOKING_NOTIFICATION_QUEUE,
} = require('../config/rabbitmq');
const { pool } = require('../config/database');

// ============================================================
// EMAIL SERVICE (Mock – thay bằng SendGrid / Nodemailer thật)
// ============================================================

/**
 * Mock Email Service.
 *
 * Trong production, thay bằng:
 *   const sgMail = require('@sendgrid/mail');
 *   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
 *
 * Hoặc Nodemailer:
 *   const transporter = nodemailer.createTransport({ ... });
 */
const emailService = {
  /**
   * Gửi email xác nhận đặt vé kèm danh sách mã QR.
   *
   * @param {Object}   params
   * @param {string}   params.to           - Địa chỉ email người nhận
   * @param {string}   params.userName     - Tên người nhận
   * @param {string}   params.bookingCode  - Mã đặt vé
   * @param {string}   params.eventTitle   - Tên sự kiện
   * @param {string}   params.eventDate    - Ngày sự kiện (formatted)
   * @param {string}   params.venueName    - Địa điểm tổ chức
   * @param {Array}    params.tickets      - Danh sách vé kèm qrUrl
   *
   * @returns {Promise<{ messageId: string }>}
   */
  async sendConfirmation({ to, userName, bookingCode, eventTitle, eventDate, venueName, tickets }) {
    // TODO: Thay block này bằng lời gọi SendGrid/Nodemailer thực tế.
    //
    // Ví dụ SendGrid:
    //   await sgMail.send({
    //     to,
    //     from:    process.env.SENDGRID_FROM_EMAIL || 'noreply@tickent.io',
    //     subject: `[TickEnt] Xác nhận đặt vé – ${bookingCode}`,
    //     html:    renderHtmlTemplate({ userName, bookingCode, eventTitle, tickets }),
    //   });
    //
    // Ví dụ Nodemailer:
    //   await transporter.sendMail({
    //     from: '"TickEnt" <noreply@tickent.io>',
    //     to, subject, html,
    //   });

    // ── Mock: in log ra console thay vì gửi thật ──────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  📧 [EmailService] MOCK – Email xác nhận đặt vé      ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`  To       : ${to}`);
    console.log(`  Tên      : ${userName || 'Khách hàng'}`);
    console.log(`  Booking  : ${bookingCode}`);
    console.log(`  Sự kiện  : ${eventTitle}`);
    console.log(`  Ngày     : ${eventDate}`);
    console.log(`  Địa điểm : ${venueName}`);
    console.log(`  Số vé    : ${tickets.length}`);
    console.log('  ── Danh sách vé & QR Code ──');
    tickets.forEach((t, idx) => {
      console.log(`    [${idx + 1}] ticket_code : ${t.ticketCode}`);
      console.log(`         QR URL     : ${t.qrUrl}`);
    });
    console.log('');

    // Trả về mock message ID (SendGrid thực tế trả về messageId từ response)
    return { messageId: `mock-${Date.now()}` };
  },
};

// ============================================================
// HELPER: Sinh QR URL từ ticket_code
// ============================================================

/**
 * Tạo URL cho QR code dựa trên ticket_code.
 * URL này được nhúng vào hình QR để scanner đọc tại cổng soát vé.
 *
 * Trong production: URL trỏ đến check-in endpoint của Gate Service.
 * QR generator (client-side hoặc email template) sẽ render hình ảnh
 * từ URL này.
 *
 * @param {string} ticketCode - Mã vé duy nhất
 * @returns {string} URL đầy đủ
 */
function buildQrUrl(ticketCode) {
  const baseUrl = process.env.QR_BASE_URL || 'https://qr.tickent.io/verify';
  // Encode ticket_code để đảm bảo URL an toàn
  return `${baseUrl}?code=${encodeURIComponent(ticketCode)}`;
}

// ============================================================
// HANDLER: Xử lý mỗi notification message
// ============================================================

/**
 * Xử lý một booking.confirmed message.
 *
 * @param {Object}       payload - JSON đã parse
 * @param {amqp.Channel} channel - RabbitMQ channel
 * @param {amqp.Message} msg     - Raw message
 */
async function handleNotificationMessage(payload, channel, msg) {
  const { bookingCode, userId, ticketCodes } = payload;

  console.log(
    `\n[NotifConsumer] ► Nhận message: bookingCode=${bookingCode}, ` +
    `userId=${userId}, tickets=${ticketCodes?.length || 0}`
  );

  try {
    // ═══════════════════════════════════════════════════════
    // BƯỚC 1: Truy vấn DB lấy thông tin đầy đủ
    //
    // Lấy: thông tin booking, sự kiện, user và danh sách vé
    // để điền vào template email.
    //
    // Không cần Transaction ở đây vì đây là READ-ONLY query,
    // booking đã CONFIRMED không thể bị thay đổi ngược lại.
    // ═══════════════════════════════════════════════════════
    const dbClient = await pool.connect();
    let emailData;

    try {
      const queryRes = await dbClient.query(
        `SELECT
            b.booking_code,
            b.confirmed_at,
            u.full_name      AS user_name,
            u.email          AS user_email,
            e.title          AS event_title,
            e.start_time     AS event_start,
            e.venue_name,
            e.venue_address,
            t.ticket_code,
            t.unit_price,
            t.currency,
            tier.name        AS tier_name
           FROM booking_domain.bookings b
           JOIN user_domain.users        u    ON u.id    = b.user_id
           JOIN event_domain.events      e    ON e.id    = b.event_id
           JOIN booking_domain.tickets   t    ON t.booking_id = b.id
           JOIN event_domain.ticket_tiers tier ON tier.id = t.ticket_tier_id
          WHERE b.booking_code = $1
            AND t.status       = 'ACTIVE'
          ORDER BY t.created_at ASC`,
        [bookingCode]
      );

      if (queryRes.rowCount === 0) {
        // Không tìm thấy booking hoặc vé – dữ liệu bất thường.
        // Có thể booking bị xóa hoặc vé chưa được INSERT kịp (race condition nhỏ).
        console.warn(`[NotifConsumer] [${bookingCode}] Không tìm thấy dữ liệu trong DB. Bỏ qua.`);
        channel.nack(msg, false, false); // Không requeue
        return;
      }

      const firstRow = queryRes.rows[0];

      // Xây dựng danh sách vé kèm QR URL
      const tickets = queryRes.rows.map((row) => ({
        ticketCode: row.ticket_code,
        tierName:   row.tier_name,
        unitPrice:  parseFloat(row.unit_price),
        currency:   row.currency,
        qrUrl:      buildQrUrl(row.ticket_code), // URL để render thành hình QR
      }));

      // Format ngày sự kiện (VD: 31/12/2024, 18:00)
      const eventDate = new Date(firstRow.event_start).toLocaleString('vi-VN', {
        timeZone:    'Asia/Ho_Chi_Minh',
        day:         '2-digit',
        month:       '2-digit',
        year:        'numeric',
        hour:        '2-digit',
        minute:      '2-digit',
      });

      emailData = {
        to:          firstRow.user_email,
        userName:    firstRow.user_name,
        bookingCode: firstRow.booking_code,
        eventTitle:  firstRow.event_title,
        eventDate,
        venueName:   `${firstRow.venue_name} – ${firstRow.venue_address}`,
        tickets,
      };

      console.log(
        `[NotifConsumer] [${bookingCode}] ✓ Lấy được ${tickets.length} vé từ DB ` +
        `cho user: ${firstRow.user_email}`
      );

    } finally {
      // Luôn trả client về pool
      dbClient.release();
    }

    // ═══════════════════════════════════════════════════════
    // BƯỚC 2: Gửi email xác nhận kèm QR codes
    //
    // emailService.sendConfirmation() là mock trong dev,
    // cần thay bằng SendGrid/Nodemailer trong production.
    // ═══════════════════════════════════════════════════════
    const sendResult = await emailService.sendConfirmation(emailData);

    console.log(
      `[NotifConsumer] [${bookingCode}] ✓ Email gửi thành công: ` +
      `messageId=${sendResult.messageId}, to=${emailData.to}`
    );

    // ═══════════════════════════════════════════════════════
    // BƯỚC 3: ACK message
    // Chỉ ACK sau khi email đã được gửi (hoặc enqueue thành công).
    // Nếu emailService throw exception → nack(requeue=true) → retry.
    // ═══════════════════════════════════════════════════════
    channel.ack(msg);
    console.log(`[NotifConsumer] [${bookingCode}] ✓ Message ACK.`);

  } catch (err) {
    // Lỗi bất ngờ: lỗi DB query, SMTP timeout, lỗi parse…
    console.error(`[NotifConsumer] [${bookingCode}] ✗ Lỗi:`, err.message);

    // Requeue=true → RabbitMQ gửi lại message để retry.
    // Hữu ích khi DB tạm thời down hoặc SMTP timeout.
    // Lưu ý: nếu lỗi do dữ liệu sai (không có user_email),
    // nên requeue=false để tránh infinite loop.
    channel.nack(msg, false, true);
    console.log(`[NotifConsumer] [${bookingCode}] Message NACK (requeue=true).`);
  }
}

// ============================================================
// Khởi động Notification Consumer Worker
// ============================================================

async function startNotificationConsumer() {
  console.log('══════════════════════════════════════════════════════');
  console.log(' TickEnt – Booking Notification Consumer (FR-06)');
  console.log(' Cấp mã QR + Gửi email xác nhận bất đồng bộ');
  console.log('══════════════════════════════════════════════════════');

  // Kết nối RabbitMQ – setup toàn bộ topology (exchanges, queues, bindings)
  const channel = await connect();

  console.log(`[NotifConsumer] Đang lắng nghe queue: "${BOOKING_NOTIFICATION_QUEUE}"...`);

  // Consume từ booking_notification_queue
  // noAck: false → manual acknowledgement
  channel.consume(BOOKING_NOTIFICATION_QUEUE, async (msg) => {
    if (msg === null) {
      console.warn('[NotifConsumer] Nhận được null message (consumer bị cancel).');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      console.error('[NotifConsumer] Không thể parse JSON message:', parseErr.message);
      channel.nack(msg, false, false); // Loại bỏ message không hợp lệ
      return;
    }

    await handleNotificationMessage(payload, channel, msg);

  }, { noAck: false });
}

// ── Entry Point ──────────────────────────────────────────────
startNotificationConsumer().catch((err) => {
  console.error('[NotifConsumer] Lỗi khởi động:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT',  () => { console.log('\n[NotifConsumer] SIGINT received. Đang dừng...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[NotifConsumer] SIGTERM received. Đang dừng...'); process.exit(0); });
