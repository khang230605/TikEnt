/**
 * api/controllers/webhook.controller.js – User Payment Service
 * ============================================================
 * Xử lý Webhook callback thanh toán từ Payment Provider.
 * Logic được di chuyển từ booking-service sang đây theo thiết kế
 * Container: User Payment Service chịu trách nhiệm thanh toán.
 *
 * Tham chiếu đến booking-service qua Shared Database (cross-schema).
 * ============================================================
 */
'use strict';

const crypto = require('crypto');
const { pool } = require('../../config/database');
const { getChannel, EXCHANGE_NAME, RK_BOOKING_CONFIRMED } = require('../../config/rabbitmq');

// ── Hàm sinh ticket code ──────────────────────────────────────
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomStr(n = 6) {
  let r = '';
  for (let i = 0; i < n; i++) r += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  return r;
}
function generateTicketCode(bookingCode, index) {
  return `TKT-${bookingCode}-${String(index).padStart(2, '0')}-${randomStr(6)}`;
}

// ── Mock Signature Verification ───────────────────────────────
/**
 * TODO: Implement HMAC-SHA256 verify với secret từ từng provider.
 * Xem booking-service/src/api/routes/webhooks.js để tham khảo logic đầy đủ.
 */
function verifySignature(req) {
  console.warn('[WebhookCtrl] ⚠ verifySignature mock – cần implement trước production!');
  return true;
}

// ── Log Late Payment (Refund) ─────────────────────────────────
async function logLatePaymentForRefund({ bookingCode, transactionId, amount, currency }) {
  // TODO: INSERT vào bảng refund_requests hoặc publish event sang Refund Service
  console.warn(
    `[WebhookCtrl] ⚠ LATE PAYMENT – bookingCode=${bookingCode}, ` +
    `txn=${transactionId}, amount=${amount} ${currency}. Cần Refund!`
  );
}

// ── Publish Notification Event ────────────────────────────────
async function publishNotificationEvent({ bookingCode, userId, tickets }) {
  try {
    const ch = getChannel();
    ch.publish(
      EXCHANGE_NAME,
      RK_BOOKING_CONFIRMED,
      Buffer.from(JSON.stringify({
        bookingCode,
        userId,
        ticketCodes: tickets.map((t) => t.ticket_code),
        publishedAt: new Date().toISOString(),
      })),
      { persistent: true, contentType: 'application/json', messageId: `notif-${bookingCode}` }
    );
    console.log(`[WebhookCtrl][${bookingCode}] ✓ Notification event published.`);
  } catch (err) {
    console.error(`[WebhookCtrl][${bookingCode}] ⚠ Lỗi publish notification:`, err.message);
  }
}

// ============================================================
// HANDLER: payment_status = SUCCESS
// ============================================================
async function handlePaymentSuccess({ bookingCode, transactionId, amount, currency, providerMetadata }) {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Bước 1: Lock booking + inventory
    const bookingRes = await dbClient.query(
      `SELECT b.id AS booking_id, b.status, b.user_id, b.event_id, b.ticket_tier_id,
              bt.price AS unit_price,
              inv.version AS current_version, inv.reserved_qty
         FROM booking_domain.bookings b
         JOIN event_domain.ticket_tiers bt ON bt.id = b.ticket_tier_id
         JOIN event_domain.inventory   inv ON inv.ticket_tier_id = bt.id
        WHERE b.booking_code = $1
          FOR UPDATE OF b, inv`,
      [bookingCode]
    );

    if (bookingRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      console.error(`[handlePaymentSuccess] Lỗi: Không tìm thấy booking: ${bookingCode}`);
      return { httpStatus: 404, body: { error: { code: 'BOOKING_NOT_FOUND', message: `Không tìm thấy booking: ${bookingCode}` } } };
    }

    const row = bookingRes.rows[0];
    const { booking_id: bookingId, status: bookingStatus, user_id: userId,
            event_id: eventId, ticket_tier_id: ticketTierId,
            unit_price: unitPrice, current_version: currentVersion, reserved_qty } = row;

    if (bookingStatus === 'CONFIRMED') {
      await dbClient.query('ROLLBACK');
      return { httpStatus: 200, body: { acknowledged: true, booking_code: bookingCode, booking_status: 'CONFIRMED', processed_at: new Date().toISOString(), note: 'Already processed' } };
    }

    if (['EXPIRED', 'CANCELLED'].includes(bookingStatus)) {
      await logLatePaymentForRefund({ bookingCode, transactionId, amount, currency });
      await dbClient.query('ROLLBACK');
      return { httpStatus: 200, body: { acknowledged: true, booking_code: bookingCode, booking_status: bookingStatus, processed_at: new Date().toISOString(), note: `Booking đã ${bookingStatus}. Refund đang được khởi tạo.` } };
    }

    // Bước 2: Cập nhật trạng thái booking
    // Chú ý: Theo Schema DB của TickEnt, Enum hợp lệ là 'CONFIRMED', KHÔNG PHẢI 'PAID'.
    try {
      await dbClient.query(
        `UPDATE booking_domain.bookings
            SET status = 'CONFIRMED', 
                payment_ref = $2, 
                total_amount = $3,
                confirmed_at = NOW(), 
                updated_at = NOW()
          WHERE booking_code = $1 
          RETURNING *`,
        [bookingCode, transactionId, amount]
      );
    } catch (err) {
      console.error('[handlePaymentSuccess] Lỗi Update DB (Bảng bookings):', err.message);
      throw err;
    }

    const quantity = parseInt(providerMetadata?.quantity || 1, 10);

    // Bước 3: Cập nhật inventory – chuyển từ reserved sang sold (OL)
    try {
      const invRes = await dbClient.query(
        `UPDATE event_domain.inventory
            SET sold_qty = sold_qty + $1, reserved_qty = reserved_qty - $1,
                version = version + 1, updated_at = NOW()
          WHERE ticket_tier_id = $2 AND version = $3 AND reserved_qty >= $1
          RETURNING version AS new_version`,
        [quantity, ticketTierId, currentVersion]
      );

      if (invRes.rowCount === 0) {
        console.error(`[handlePaymentSuccess] Lỗi Update DB (Inventory): Xung đột tồn kho hoặc không đủ vé đang giữ (Cần ${quantity}, đang có ${reserved_qty})`);
        await dbClient.query('ROLLBACK');
        return { httpStatus: 409, body: { error: { code: 'INVENTORY_CONFLICT', message: 'Xung đột tồn kho.' } } };
      }
    } catch (err) {
      console.error('[handlePaymentSuccess] Lỗi Update DB (Bảng inventory):', err.message);
      throw err;
    }

    // Bước 4: Phát hành vé (INSERT tickets)
    const insertedTickets = [];
    try {
      for (let i = 1; i <= quantity; i++) {
        const ticketCode = generateTicketCode(bookingCode, i);
        const tRes = await dbClient.query(
          `INSERT INTO booking_domain.tickets
             (id, booking_id, ticket_tier_id, event_id, user_id,
              ticket_code, unit_price, currency, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())
           RETURNING id, ticket_code, status`,
          [bookingId, ticketTierId, eventId, userId, ticketCode, parseFloat(unitPrice), currency]
        );
        insertedTickets.push(tRes.rows[0]);
        console.log(`[WebhookCtrl][${bookingCode}] ✓ Vé ${i}/${quantity}: ${ticketCode}`);
      }
    } catch (err) {
      console.error('[handlePaymentSuccess] Lỗi Update DB (Bảng tickets):', err.message);
      throw err;
    }

    await dbClient.query('COMMIT');
    console.log(`[WebhookCtrl][${bookingCode}] ✓ COMMIT – ${quantity} vé phát hành.`);

    // Bước 5: Publish notification
    await publishNotificationEvent({ bookingCode, userId, tickets: insertedTickets });

    return { httpStatus: 200, body: { acknowledged: true, booking_code: bookingCode, booking_status: 'CONFIRMED', processed_at: new Date().toISOString() } };

  } catch (err) {
    console.error(`[handlePaymentSuccess] ✗ Lỗi tổng quát:`, err.message);
    try { await dbClient.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    dbClient.release();
  }
}

// ============================================================
// HANDLER: payment_status = FAILED | CANCELLED
// ============================================================
async function handlePaymentFailed({ bookingCode, failureReason }) {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const res = await dbClient.query(
      `SELECT b.id, b.status, b.ticket_tier_id, inv.reserved_qty, inv.version
         FROM booking_domain.bookings b
         JOIN event_domain.ticket_tiers bt ON bt.id = b.ticket_tier_id
         JOIN event_domain.inventory   inv ON inv.ticket_tier_id = bt.id
        WHERE b.booking_code = $1 FOR UPDATE OF b, inv`,
      [bookingCode]
    );

    if (res.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return { httpStatus: 404, body: { error: { code: 'BOOKING_NOT_FOUND', message: `Không tìm thấy: ${bookingCode}` } } };
    }

    const { id, status, ticket_tier_id, reserved_qty, version } = res.rows[0];

    if (status !== 'PENDING') {
      await dbClient.query('ROLLBACK');
      return { httpStatus: 200, body: { acknowledged: true, booking_code: bookingCode, booking_status: status, processed_at: new Date().toISOString(), note: 'Already processed' } };
    }

    await dbClient.query(
      `UPDATE booking_domain.bookings
          SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
        WHERE id = $2`,
      [failureReason || 'Thanh toán thất bại', id]
    );

    const restoreRes = await dbClient.query(
      `UPDATE event_domain.inventory
          SET reserved_qty = reserved_qty - $1, version = version + 1, updated_at = NOW()
        WHERE ticket_tier_id = $2 AND version = $3 AND reserved_qty >= $1
        RETURNING version`,
      [parseInt(reserved_qty, 10), ticket_tier_id, parseInt(version, 10)]
    );

    if (restoreRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return { httpStatus: 409, body: { error: { code: 'INVENTORY_CONFLICT', message: 'Xung đột tồn kho khi hoàn trả.' } } };
    }

    await dbClient.query('COMMIT');
    return { httpStatus: 200, body: { acknowledged: true, booking_code: bookingCode, booking_status: 'CANCELLED', processed_at: new Date().toISOString() } };

  } catch (err) {
    try { await dbClient.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    dbClient.release();
  }
}

// ============================================================
// ROUTE HANDLER: POST /webhooks/payment/callback
// ============================================================
async function paymentCallback(req, res) {
  const provider = req.headers['x-provider'] || 'UNKNOWN';
  console.log(`\n[WebhookCtrl] ► Callback từ provider: ${provider}`);

  if (!verifySignature(req)) {
    return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Chữ ký webhook không hợp lệ.' } });
  }

  const { transaction_id, booking_code, payment_status, amount, currency = 'VND', failure_reason, provider_metadata = {} } = req.body;

  if (!transaction_id || !booking_code || !payment_status) {
    return res.status(400).json({ error: { code: 'MISSING_REQUIRED_FIELDS', message: 'Thiếu: transaction_id, booking_code, payment_status.' } });
  }

  try {
    let result;
    if (payment_status === 'SUCCESS') {
      result = await handlePaymentSuccess({ bookingCode: booking_code, transactionId: transaction_id, amount: parseFloat(amount) || 0, currency, provider, providerMetadata: provider_metadata });
    } else if (['FAILED', 'CANCELLED'].includes(payment_status)) {
      result = await handlePaymentFailed({ bookingCode: booking_code, failureReason: failure_reason });
    } else {
      result = { httpStatus: 200, body: { acknowledged: true, booking_code, booking_status: 'PENDING', processed_at: new Date().toISOString(), note: `payment_status "${payment_status}" không cần xử lý.` } };
    }
    return res.status(result.httpStatus).json(result.body);
  } catch (err) {
    console.error('[WebhookCtrl] ✗ Lỗi server:', err.message);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi server khi xử lý webhook.' } });
  }
}

module.exports = { paymentCallback, handlePaymentSuccess, handlePaymentFailed };
