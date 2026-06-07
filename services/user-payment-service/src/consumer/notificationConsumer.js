/**
 * consumer/notificationConsumer.js – User Payment Service
 * ============================================================
 * Notification Worker (di chuyển từ booking-service).
 *
 * Lắng nghe booking_notification_queue, khi nhận message:
 *  1. Query DB lấy thông tin vé, sự kiện, user
 *  2. Sinh QR URL cho từng ticket_code
 *  3. Gửi email xác nhận (mock log / SendGrid thật)
 *  4. ACK message
 *
 * Chạy: npm run consumer:notification
 * ============================================================
 */
'use strict';

require('dotenv').config();

const { connect, BOOKING_NOTIFICATION_QUEUE } = require('../config/rabbitmq');
const { pool } = require('../config/database');

const QR_BASE_URL = process.env.QR_BASE_URL || 'https://qr.tickent.io/verify';

// ── Build QR URL ──────────────────────────────────────────────
function buildQrUrl(ticketCode) {
  return `${QR_BASE_URL}?code=${encodeURIComponent(ticketCode)}`;
}

// ── Mock Email Service ────────────────────────────────────────
/**
 * TODO: Thay bằng SendGrid thực tế:
 *   const sgMail = require('@sendgrid/mail');
 *   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
 *   await sgMail.send({ to, from, subject, html });
 */
const emailService = {
  async sendConfirmation({ to, userName, bookingCode, eventTitle, eventDate, venueName, tickets }) {
    // ── Mock: In ra console thay vì gửi email thật ────────────
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  📧 [EmailService] MOCK – Email xác nhận đặt vé          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  To       : ${to}`);
    console.log(`  Tên      : ${userName || 'Khách hàng'}`);
    console.log(`  Booking  : ${bookingCode}`);
    console.log(`  Sự kiện  : ${eventTitle}`);
    console.log(`  Ngày     : ${eventDate}`);
    console.log(`  Địa điểm : ${venueName}`);
    console.log(`  Số vé    : ${tickets.length}`);
    console.log('  ── Vé & QR Code ──────────────────────────────────────────');
    tickets.forEach((t, i) => {
      console.log(`    [${i + 1}] ${t.tierName} – ${t.ticketCode}`);
      console.log(`         QR: ${t.qrUrl}`);
    });
    console.log('');

    return { messageId: `mock-${Date.now()}` };
  },
};

// ── Notification Handler ──────────────────────────────────────

/**
 * Xử lý một booking.confirmed message.
 *
 * @param {Object}       payload - { bookingCode, userId, ticketCodes }
 * @param {amqp.Channel} channel
 * @param {amqp.Message} msg
 */
async function handleNotificationMessage(payload, channel, msg) {
  const { bookingCode, userId, ticketCodes } = payload;
  console.log(`\n[NotifConsumer] ► bookingCode=${bookingCode}, ${ticketCodes?.length || 0} vé`);

  const dbClient = await pool.connect();
  try {
    // ── Bước 1: Query DB lấy thông tin đầy đủ ────────────────
    // JOIN qua 3 schema: booking_domain, event_domain, user_domain
    const queryRes = await dbClient.query(
      `SELECT
           b.booking_code,
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
         FROM booking_domain.bookings  b
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
      console.warn(`[NotifConsumer] [${bookingCode}] Không tìm thấy vé trong DB.`);
      channel.nack(msg, false, false);
      return;
    }

    const firstRow  = queryRes.rows[0];
    const eventDate = new Date(firstRow.event_start).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const tickets = queryRes.rows.map((row) => ({
      ticketCode: row.ticket_code,
      tierName:   row.tier_name,
      unitPrice:  parseFloat(row.unit_price),
      currency:   row.currency,
      qrUrl:      buildQrUrl(row.ticket_code),
    }));

    // ── Bước 2: Gửi email xác nhận ───────────────────────────
    const sendResult = await emailService.sendConfirmation({
      to:          firstRow.user_email,
      userName:    firstRow.user_name,
      bookingCode: firstRow.booking_code,
      eventTitle:  firstRow.event_title,
      eventDate,
      venueName:   `${firstRow.venue_name || ''} – ${firstRow.venue_address || ''}`,
      tickets,
    });

    console.log(`[NotifConsumer] [${bookingCode}] ✓ Email sent: msgId=${sendResult.messageId}`);

    // ── Bước 3: ACK ──────────────────────────────────────────
    channel.ack(msg);
    console.log(`[NotifConsumer] [${bookingCode}] ✓ ACK.`);

  } catch (err) {
    console.error(`[NotifConsumer] [${bookingCode}] ✗ Lỗi:`, err.message);
    channel.nack(msg, false, true); // requeue=true để retry
  } finally {
    dbClient.release();
  }
}

// ── Khởi động Consumer ────────────────────────────────────────
async function startNotificationConsumer() {
  console.log('══════════════════════════════════════════════════════');
  console.log(' TickEnt – Notification Consumer (User Payment Service)');
  console.log(' FR-06: Cấp mã QR + Gửi email xác nhận đặt vé');
  console.log('══════════════════════════════════════════════════════');

  const channel = await connect();
  console.log(`[NotifConsumer] Lắng nghe: "${BOOKING_NOTIFICATION_QUEUE}"`);

  channel.consume(BOOKING_NOTIFICATION_QUEUE, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (e) {
      console.error('[NotifConsumer] Không parse được message:', e.message);
      channel.nack(msg, false, false);
      return;
    }

    await handleNotificationMessage(payload, channel, msg);
  }, { noAck: false });
}

startNotificationConsumer().catch((err) => {
  console.error('[NotifConsumer] Lỗi khởi động:', err);
  process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n[NotifConsumer] Đang dừng...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[NotifConsumer] Đang dừng...'); process.exit(0); });
