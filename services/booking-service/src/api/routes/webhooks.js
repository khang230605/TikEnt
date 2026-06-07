/**
 * api/routes/webhooks.js
 * ============================================================
 * Webhook Route – nhận callback kết quả thanh toán từ cổng
 * thanh toán bên thứ ba (VNPay, Momo, Stripe…).
 *
 * POST /api/v1/webhooks/payment/callback
 *
 * ── Luồng xử lý khi payment_status = SUCCESS ─────────────────
 *
 *   Request đến
 *       │
 *       ▼
 *  [1] Verify chữ ký (HMAC-SHA256) ── FAIL ──► 400 Invalid Signature
 *       │ OK
 *       ▼
 *  [2] BEGIN Transaction
 *       │
 *       ▼
 *  [3] SELECT bookings WHERE booking_code = ? FOR UPDATE
 *       │
 *       ├─ Không tìm thấy ──────────────────────────────────► 404
 *       │
 *       ├─ status = CONFIRMED (idempotent) ─────────────────► 200 ACK (bỏ qua)
 *       │
 *       ├─ status = EXPIRED | CANCELLED (đã bị Timeout Worker hủy trước)
 *       │        └─► Ghi log, chuẩn bị Refund ─────────────► 200 ACK + refund flag
 *       │
 *       └─ status = PENDING ─────────────────────────────────►
 *               │
 *               ▼
 *          [4] UPDATE bookings → CONFIRMED
 *               │
 *               ▼
 *          [5] UPDATE inventory (OL):
 *                sold_qty    += quantity
 *                reserved_qty -= quantity
 *                version     += 1
 *               │
 *               ├─ rowCount=0 (OL conflict) → ROLLBACK → 409
 *               │
 *               └─ rowCount=1 → INSERT tickets (qty bản ghi)
 *                               COMMIT → 200 ACK
 *
 * ── Luồng xử lý khi payment_status = FAILED | CANCELLED ──────
 *   UPDATE bookings → CANCELLED
 *   UPDATE inventory: reserved_qty -= quantity (hoàn trả)
 *   COMMIT → 200 ACK
 *
 * ============================================================
 */

'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

const { pool }                 = require('../../config/database');
const { generateTicketCode }   = require('../../utils/ticketCode');
const {
  getChannel,
  EXCHANGE_NAME,
  RK_BOOKING_CONFIRMED,
}                              = require('../../config/rabbitmq');

// ============================================================
// SECURITY: Xác thực chữ ký Webhook
// ============================================================

/**
 * TODO: Thay thế hàm mock này bằng xác thực HMAC-SHA256 thực tế.
 *
 * Logic thực tế (ví dụ VNPay):
 *   const secretKey    = process.env.VNPAY_WEBHOOK_SECRET;
 *   const rawBody      = req.rawBody;           // cần middleware lưu raw body
 *   const receivedSig  = req.headers['x-webhook-signature'];
 *   const expectedSig  = 'sha256=' + crypto
 *     .createHmac('sha256', secretKey)
 *     .update(rawBody)
 *     .digest('hex');
 *   return crypto.timingSafeEqual(
 *     Buffer.from(receivedSig),
 *     Buffer.from(expectedSig)
 *   );
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function verifySignature(req) {
  // TODO: Cấu hình Secret Key thật và implement HMAC-SHA256 verify
  // Tạm thời trả về true để dễ test luồng end-to-end
  console.warn('[Webhook] ⚠ verifySignature đang dùng mock (luôn trả true). Cần implement thực tế trước khi production!');
  return true;
}

// ============================================================
// HELPER: Ghi log giao dịch lỗi (chuẩn bị Refund)
// ============================================================

/**
 * Ghi log trường hợp tiền về sau khi booking đã bị hủy/hết hạn.
 * Đây là điểm khởi đầu cho luồng hoàn tiền (Refund).
 *
 * Trong production: insert vào bảng payment_refund_queue hoặc
 * publish message sang Refund Service.
 *
 * @param {Object} params
 */
async function logLatePaymentForRefund({ bookingCode, transactionId, amount, currency, provider, dbClient }) {
  // TODO: Thay thế bằng INSERT vào bảng refund_requests hoặc publish event
  // Ví dụ:
  //   await dbClient.query(
  //     `INSERT INTO booking_domain.refund_requests
  //        (id, booking_code, transaction_id, amount, currency, reason, created_at)
  //      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'LATE_PAYMENT_BOOKING_EXPIRED', NOW())`,
  //     [bookingCode, transactionId, amount, currency]
  //   );

  console.warn(
    `[Webhook] ⚠ LATE PAYMENT – bookingCode=${bookingCode}, ` +
    `transactionId=${transactionId}, amount=${amount} ${currency}. ` +
    `Cần khởi tạo luồng Refund!`
  );
}

// ============================================================
// HELPER: Publish notification event sau khi booking CONFIRMED
// ============================================================

/**
 * Publish message vào booking_notification_queue sau khi
 * DB Transaction commit thành công.
 *
 * Consumer BookingNotificationConsumer sẽ lắng nghe queue này
 * và thực hiện gửi email + cấp QR code bất đồng bộ.
 *
 * Lý do không gửi email trực tiếp trong route handler:
 *  - Gửi email có thể chậm (SMTP timeout) → block HTTP response.
 *  - Cổng thanh toán cần nhận 200 nhanh để dừng retry.
 *  - Nếu email lỗi, không được làm rollback booking đã CONFIRMED.
 *
 * @param {Object} params
 * @param {string} params.bookingCode - Mã đặt vé
 * @param {string} params.userId      - UUID người đặt vé
 * @param {Array}  params.tickets     - Danh sách vé vừa phát hành
 */
async function publishNotificationEvent({ bookingCode, userId, tickets }) {
  try {
    const payload = {
      bookingCode,
      userId,
      // Gửi kèm danh sách ticket_code được INSERT trong DB.
      // Consumer sẽ dùng để render QR và đính kèm vào email.
      ticketCodes: tickets.map((t) => t.ticket_code),
      publishedAt: new Date().toISOString(),
    };

    const publishChannel = getChannel();
    publishChannel.publish(
      EXCHANGE_NAME,
      RK_BOOKING_CONFIRMED,                          // → booking_notification_queue
      Buffer.from(JSON.stringify(payload)),
      {
        persistent:  true,                           // bền vững qua restart
        contentType: 'application/json',
        messageId:   `notif-${bookingCode}`,
      }
    );

    console.log(
      `[Webhook][${bookingCode}] ✓ Notification event published ` +
      `→ ${EXCHANGE_NAME}/${RK_BOOKING_CONFIRMED} (${tickets.length} vé).`
    );
  } catch (publishErr) {
    // Lỗi publish KHÔNG được thả exception – booking đã COMMIT thành công.
    // Chỉ log cảnh báo để monitor/alert, không rollback.
    console.error(
      `[Webhook][${bookingCode}] ⚠ Không thể publish notification event:`,
      publishErr.message
    );
  }
}

// ============================================================
// HANDLER: Xử lý payment_status = SUCCESS
// ============================================================

/**
 * Xử lý webhook thanh toán thành công trong một DB Transaction.
 * Bao gồm: lock booking, kiểm tra trạng thái, cập nhật inventory,
 * phát hành vé.
 *
 * @param {Object} params
 * @returns {Promise<{ httpStatus: number, body: Object }>}
 */
async function handlePaymentSuccess({ bookingCode, transactionId, amount, currency, provider, providerMetadata }) {
  const dbClient = await pool.connect();

  try {
    // ── Bước 1: Bắt đầu Transaction ───────────────────────
    await dbClient.query('BEGIN');
    console.log(`[Webhook][${bookingCode}] Transaction bắt đầu (SUCCESS flow).`);

    // ── Bước 2: SELECT booking FOR UPDATE ─────────────────
    // FOR UPDATE → lock dòng này lại, ngăn Timeout Worker
    // cùng lúc chạy UPDATE booking.status = EXPIRED.
    // Ai lock trước thì xử lý trước; người đến sau phải đợi.
    const bookingRes = await dbClient.query(
      `SELECT b.id          AS booking_id,
              b.status,
              b.user_id,
              b.event_id,
              b.payment_method,
              b.total_amount,
              b.currency     AS booking_currency,
              bt.id          AS tier_id,
              bt.price       AS unit_price,
              bt.name        AS tier_name,
              t.id           AS ticket_count_check,
              -- Đếm số vé đã phát hành (để idempotency check phát vé)
              (SELECT COUNT(*) FROM booking_domain.tickets tk WHERE tk.booking_id = b.id) AS issued_ticket_count,
              -- Lấy quantity từ inventory reserved (không lưu trong bookings)
              inv.reserved_qty,
              -- Dùng để tính lại quantity cần xử lý
              (SELECT COUNT(*) FROM booking_domain.tickets tk WHERE tk.booking_id = b.id) AS existing_tickets
         FROM booking_domain.bookings b
         JOIN event_domain.ticket_tiers bt ON bt.event_id = b.event_id
         JOIN event_domain.inventory inv   ON inv.ticket_tier_id = bt.id
         LEFT JOIN booking_domain.tickets t ON t.booking_id = b.id
        WHERE b.booking_code = $1
          FOR UPDATE OF b, inv -- Lock cả booking lẫn inventory
      `,
      [bookingCode]
    );

    if (bookingRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return {
        httpStatus: 404,
        body: { error: { code: 'BOOKING_NOT_FOUND', message: `Không tìm thấy booking: ${bookingCode}` } },
      };
    }

    const row           = bookingRes.rows[0];
    const bookingStatus = row.status;
    const bookingId     = row.booking_id;

    console.log(`[Webhook][${bookingCode}] Booking status hiện tại: ${bookingStatus}`);

    // ── Bước 3: Phân nhánh theo trạng thái booking ────────

    // ── TRƯỜNG HỢP A: Đã CONFIRMED (idempotent) ───────────
    // Cổng thanh toán có thể gửi webhook nhiều lần (retry).
    // Nếu ta đã xử lý rồi → trả về 200 ngay, không làm gì thêm.
    if (bookingStatus === 'CONFIRMED') {
      await dbClient.query('ROLLBACK');
      console.log(`[Webhook][${bookingCode}] Đã CONFIRMED trước đó → idempotent ACK.`);
      return {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   bookingCode,
          booking_status: 'CONFIRMED',
          processed_at:   new Date().toISOString(),
          note:           'Already processed',
        },
      };
    }

    // ── TRƯỜNG HỢP B: Đã EXPIRED hoặc CANCELLED ───────────
    // Timeout Worker đã hủy đơn trước khi tiền về.
    // → Ghi log + chuẩn bị Refund, KHÔNG phát hành vé.
    if (bookingStatus === 'EXPIRED' || bookingStatus === 'CANCELLED') {
      console.warn(
        `[Webhook][${bookingCode}] Booking đã ở trạng thái "${bookingStatus}" ` +
        `trước khi nhận payment. Cần Refund!`
      );

      // Ghi log để Refund Service xử lý sau
      await logLatePaymentForRefund({
        bookingCode, transactionId, amount, currency,
        provider, dbClient,
      });

      await dbClient.query('ROLLBACK');
      return {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   bookingCode,
          booking_status: bookingStatus,
          processed_at:   new Date().toISOString(),
          note:           `Booking đã ${bookingStatus} trước khi thanh toán về. Refund đang được khởi tạo.`,
        },
      };
    }

    // ── TRƯỜNG HỢP C: PENDING → tiến hành xác nhận ────────
    if (bookingStatus !== 'PENDING') {
      // Trạng thái không hợp lệ (REFUNDED, …) → log và bỏ qua
      await dbClient.query('ROLLBACK');
      console.error(`[Webhook][${bookingCode}] Trạng thái không mong đợi: ${bookingStatus}`);
      return {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   bookingCode,
          booking_status: bookingStatus,
          processed_at:   new Date().toISOString(),
          note:           `Trạng thái "${bookingStatus}" không xử lý được trong flow này.`,
        },
      };
    }

    // ═══════════════════════════════════════════════════════
    // Bước 4: UPDATE bookings → CONFIRMED
    // ═══════════════════════════════════════════════════════
    await dbClient.query(
      `UPDATE booking_domain.bookings
          SET status        = 'CONFIRMED',
              payment_ref   = $1,
              total_amount  = $2,
              confirmed_at  = NOW(),
              updated_at    = NOW()
        WHERE id = $3`,
      [transactionId, amount, bookingId]
    );
    console.log(`[Webhook][${bookingCode}] ✓ Booking → CONFIRMED.`);

    // ═══════════════════════════════════════════════════════
    // Bước 5: Lấy thông tin cần thiết để xử lý inventory & vé
    //
    // Lấy chi tiết ticket_tier và inventory qua booking_code.
    // Cần: ticket_tier_id, quantity (tính từ reserved_qty),
    //      unit_price, event_id, user_id.
    // ═══════════════════════════════════════════════════════
    const detailRes = await dbClient.query(
      `SELECT b.user_id,
              b.event_id,
              bt.id           AS ticket_tier_id,
              bt.price        AS unit_price,
              bt.name         AS tier_name,
              inv.id          AS inventory_id,
              inv.reserved_qty,
              inv.sold_qty,
              inv.version     AS current_version,
              -- Tính lại quantity = số vé đang reserve (chưa released)
              -- Đây là số vé thực tế user đặt trong booking này.
              -- Vì booking_domain.bookings không lưu quantity trực tiếp,
              -- ta đọc từ tickets nếu đã có, hoặc cần thêm cột quantity vào bookings.
              -- TODO: Thêm cột quantity vào bookings để lấy dễ hơn.
              -- Tạm thời: dùng reserved_qty của tier (chỉ đúng khi 1 booking / tier)
              COALESCE(
                (SELECT COUNT(*) FROM booking_domain.tickets tk WHERE tk.booking_id = b.id),
                0
              )::INT AS already_issued
         FROM booking_domain.bookings b
         JOIN event_domain.ticket_tiers bt ON bt.event_id = b.event_id
         JOIN event_domain.inventory   inv ON inv.ticket_tier_id = bt.id
        WHERE b.id = $1`,
      [bookingId]
    );

    // Lấy quantity từ message ban đầu qua provider_metadata hoặc payload.
    // Lưu ý: trong production nên thêm cột quantity vào bảng bookings.
    // Ở đây ta đọc qua provider metadata (webhook payload truyền vào).
    const detailRow      = detailRes.rows[0];
    const ticketTierId   = detailRow.ticket_tier_id;
    const unitPrice      = parseFloat(detailRow.unit_price);
    const tierName       = detailRow.tier_name;
    const eventId        = detailRow.event_id;
    const userId         = detailRow.user_id;
    const currentVersion = parseInt(detailRow.current_version, 10);
    const alreadyIssued  = parseInt(detailRow.already_issued, 10);

    // quantity được truyền qua providerMetadata.quantity
    // (BookingConsumer đã embed khi publish message ban đầu)
    // Fallback: 1 nếu không có
    const quantity = parseInt(providerMetadata?.quantity || 1, 10);

    console.log(
      `[Webhook][${bookingCode}] Detail: tierId=${ticketTierId}, qty=${quantity}, ` +
      `unitPrice=${unitPrice}, version=${currentVersion}`
    );

    // Guard: Nếu vé đã được phát hành trước đó (idempotency ở cấp vé)
    if (alreadyIssued >= quantity) {
      await dbClient.query('COMMIT');
      console.log(`[Webhook][${bookingCode}] Vé đã được phát hành trước đó (alreadyIssued=${alreadyIssued}).`);
      return {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   bookingCode,
          booking_status: 'CONFIRMED',
          processed_at:   new Date().toISOString(),
          note:           'Tickets already issued',
        },
      };
    }

    // ═══════════════════════════════════════════════════════
    // Bước 6: UPDATE inventory với Optimistic Locking
    //
    // Chuyển vé từ reserved sang sold:
    //   sold_qty    += quantity  (vé đã bán chính thức)
    //   reserved_qty -= quantity (giải phóng chỗ giữ)
    //   version     += 1        (OL counter)
    //
    // Điều kiện WHERE:
    //   version = currentVersion → OL check
    //   reserved_qty >= quantity → đảm bảo không âm
    // ═══════════════════════════════════════════════════════
    const updateInventorySQL = `
      UPDATE event_domain.inventory
         SET sold_qty     = sold_qty     + $1,
             reserved_qty = reserved_qty - $1,
             version      = version + 1,
             updated_at   = NOW()
       WHERE ticket_tier_id = $2
         AND version        = $3
         AND reserved_qty   >= $1
      RETURNING version AS new_version, sold_qty AS new_sold_qty
    `;

    const invUpdateRes = await dbClient.query(updateInventorySQL, [
      quantity,        // $1: số vé
      ticketTierId,    // $2
      currentVersion,  // $3: OL check
    ]);

    if (invUpdateRes.rowCount === 0) {
      // Optimistic Lock Conflict:
      // Có thể Timeout Worker hoặc một webhook trùng đang chạy cùng lúc.
      // → ROLLBACK và trả 409 để cổng thanh toán retry.
      await dbClient.query('ROLLBACK');
      console.warn(`[Webhook][${bookingCode}] ⚠ OL Conflict khi cập nhật inventory! version=${currentVersion}`);
      return {
        httpStatus: 409,
        body: {
          error: {
            code:    'INVENTORY_CONFLICT',
            message: 'Xung đột tồn kho, vui lòng thử lại.',
          },
        },
      };
    }

    const { new_version, new_sold_qty } = invUpdateRes.rows[0];
    console.log(
      `[Webhook][${bookingCode}] ✓ Inventory updated: ` +
      `sold_qty=${new_sold_qty}, version: ${currentVersion}→${new_version}`
    );

    // ═══════════════════════════════════════════════════════
    // Bước 7: INSERT tickets – Phát hành vé
    //
    // Mỗi vé là một bản ghi độc lập trong booking_domain.tickets.
    // ticket_code là payload QR code duy nhất để scan tại cổng vào.
    //
    // Số bản ghi = quantity (ví dụ đặt 2 vé → INSERT 2 dòng).
    // ═══════════════════════════════════════════════════════
    const insertedTickets = [];

    for (let i = 1; i <= quantity; i++) {
      const ticketCode = generateTicketCode(bookingCode, i);

      const insertTicketRes = await dbClient.query(
        `INSERT INTO booking_domain.tickets
           (id, booking_id, ticket_tier_id, event_id, user_id,
            ticket_code, unit_price, currency, status,
            created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7, 'ACTIVE',
            NOW(), NOW())
         RETURNING id, ticket_code, status`,
        [
          bookingId,    // $1
          ticketTierId, // $2
          eventId,      // $3
          userId,       // $4
          ticketCode,   // $5 – QR code payload
          unitPrice,    // $6
          currency,     // $7
        ]
      );

      const ticket = insertTicketRes.rows[0];
      insertedTickets.push(ticket);
      console.log(`[Webhook][${bookingCode}] ✓ Vé ${i}/${quantity} phát hành: ticket_code=${ticket.ticket_code}`);
    }

    // ═══════════════════════════════════════════════════════
    // Bước 8: COMMIT Transaction
    // Tất cả thao tác đã thành công:
    //  ✓ bookings.status = CONFIRMED
    //  ✓ inventory: sold_qty ↑, reserved_qty ↓, version ↑
    //  ✓ tickets: quantity bản ghi ACTIVE với ticket_code duy nhất
    // ═══════════════════════════════════════════════════════
    await dbClient.query('COMMIT');
    console.log(`[Webhook][${bookingCode}] ✓ COMMIT – Phát hành ${quantity} vé thành công.`);

    // ═══════════════════════════════════════════════════════
    // Bước 9: Publish Notification Event (bất đồng bộ, sau COMMIT)
    //
    // Mục đích: kích hoạt luồng gửi email xác nhận + cấp QR cho user.
    // Thực hiện SAU COMMIT để đảm bảo DB đã ghi nhận thành công trước.
    // Không block HTTP response – consumer xử lý nghiệm trong nền.
    // ═══════════════════════════════════════════════════════
    await publishNotificationEvent({
      bookingCode,
      userId,
      tickets: insertedTickets,  // mảng { id, ticket_code, status } từ INSERT
    });

    return {
      httpStatus: 200,
      body: {
        acknowledged:   true,
        booking_code:   bookingCode,
        booking_status: 'CONFIRMED',
        processed_at:   new Date().toISOString(),
      },
    };

  } catch (err) {
    // Lỗi bất ngờ – rollback để DB không ở trạng thái dở dang
    console.error(`[Webhook][${bookingCode}] ✗ Lỗi không mong muốn:`, err.message);
    try {
      await dbClient.query('ROLLBACK');
    } catch (rbErr) {
      console.error(`[Webhook][${bookingCode}] Lỗi khi ROLLBACK:`, rbErr.message);
    }
    throw err; // Ném ra ngoài để route handler trả về 500

  } finally {
    dbClient.release();
  }
}

// ============================================================
// HANDLER: Xử lý payment_status = FAILED | CANCELLED
// ============================================================

/**
 * Xử lý webhook thanh toán thất bại/bị hủy.
 * Cập nhật booking → CANCELLED và hoàn trả reserved_qty.
 *
 * @param {Object} params
 * @returns {Promise<{ httpStatus: number, body: Object }>}
 */
async function handlePaymentFailed({ bookingCode, failureReason }) {
  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');
    console.log(`[Webhook][${bookingCode}] Transaction bắt đầu (FAILED flow).`);

    // Lock booking và inventory
    const bookingRes = await dbClient.query(
      `SELECT b.id, b.status, bt.id AS ticket_tier_id, inv.reserved_qty, inv.version
         FROM booking_domain.bookings b
         JOIN event_domain.ticket_tiers bt ON bt.event_id = b.event_id
         JOIN event_domain.inventory   inv ON inv.ticket_tier_id = bt.id
        WHERE b.booking_code = $1
          FOR UPDATE OF b, inv
      `,
      [bookingCode]
    );

    if (bookingRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return {
        httpStatus: 404,
        body: { error: { code: 'BOOKING_NOT_FOUND', message: `Không tìm thấy booking: ${bookingCode}` } },
      };
    }

    const row           = bookingRes.rows[0];
    const bookingStatus = row.status;

    // Nếu không còn PENDING → idempotent (đã xử lý rồi)
    if (bookingStatus !== 'PENDING') {
      await dbClient.query('ROLLBACK');
      console.log(`[Webhook][${bookingCode}] Status="${bookingStatus}" → bỏ qua FAILED webhook.`);
      return {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   bookingCode,
          booking_status: bookingStatus,
          processed_at:   new Date().toISOString(),
          note:           'Already processed',
        },
      };
    }

    // Lấy quantity từ reserved (tương tự trên)
    const quantity       = parseInt(row.reserved_qty, 10);  // xem TODO trên
    const ticketTierId   = row.ticket_tier_id;
    const currentVersion = parseInt(row.version, 10);

    // Cập nhật booking → CANCELLED
    await dbClient.query(
      `UPDATE booking_domain.bookings
          SET status        = 'CANCELLED',
              cancelled_at  = NOW(),
              cancel_reason = $1,
              updated_at    = NOW()
        WHERE id = $2`,
      [failureReason || 'Thanh toán thất bại', row.id]
    );

    // Hoàn trả reserved_qty (Optimistic Locking)
    const restoreRes = await dbClient.query(
      `UPDATE event_domain.inventory
          SET reserved_qty = reserved_qty - $1,
              version      = version + 1,
              updated_at   = NOW()
        WHERE ticket_tier_id = $2
          AND version        = $3
          AND reserved_qty   >= $1
        RETURNING version AS new_version`,
      [quantity, ticketTierId, currentVersion]
    );

    if (restoreRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      console.warn(`[Webhook][${bookingCode}] OL Conflict khi hoàn trả inventory (FAILED flow).`);
      return {
        httpStatus: 409,
        body: { error: { code: 'INVENTORY_CONFLICT', message: 'Xung đột tồn kho khi hoàn trả.' } },
      };
    }

    await dbClient.query('COMMIT');
    console.log(`[Webhook][${bookingCode}] ✓ Booking CANCELLED + inventory hoàn trả.`);

    return {
      httpStatus: 200,
      body: {
        acknowledged:   true,
        booking_code:   bookingCode,
        booking_status: 'CANCELLED',
        processed_at:   new Date().toISOString(),
      },
    };

  } catch (err) {
    console.error(`[Webhook][${bookingCode}] ✗ Lỗi (FAILED flow):`, err.message);
    try { await dbClient.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    dbClient.release();
  }
}

// ============================================================
// ROUTE: POST /webhooks/payment/callback
// ============================================================

/**
 * POST /api/v1/webhooks/payment/callback
 * ──────────────────────────────────────────────────────────────
 * Nhận IPN/webhook từ payment provider sau khi giao dịch hoàn tất.
 * Ánh xạ với PaymentWebhookRequest trong openapi.yaml.
 * ──────────────────────────────────────────────────────────────
 */
router.post('/payment/callback', async (req, res) => {
  const provider = req.headers['x-provider'] || 'UNKNOWN';
  console.log(`\n[Webhook] ► Nhận callback từ provider: ${provider}`);

  // ── Bước 1: Verify chữ ký ─────────────────────────────────
  if (!verifySignature(req)) {
    console.error('[Webhook] ✗ Chữ ký không hợp lệ!');
    return res.status(400).json({
      error: { code: 'INVALID_SIGNATURE', message: 'Chữ ký webhook không hợp lệ.' },
    });
  }

  // ── Bước 2: Validate các trường bắt buộc trong payload ────
  const {
    transaction_id,
    booking_code,
    payment_status,
    amount,
    currency     = 'VND',
    payment_method,
    paid_at,
    failure_reason,
    provider_metadata = {},
  } = req.body;

  if (!transaction_id || !booking_code || !payment_status) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Thiếu các trường bắt buộc: transaction_id, booking_code, payment_status.',
      },
    });
  }

  console.log(
    `[Webhook] Payload: transactionId=${transaction_id}, ` +
    `bookingCode=${booking_code}, status=${payment_status}`
  );

  try {
    let result;

    // ── Bước 3: Phân nhánh theo payment_status ─────────────
    if (payment_status === 'SUCCESS') {
      result = await handlePaymentSuccess({
        bookingCode:      booking_code,
        transactionId:    transaction_id,
        amount:           parseFloat(amount) || 0,
        currency,
        provider,
        providerMetadata: provider_metadata,
      });

    } else if (['FAILED', 'CANCELLED'].includes(payment_status)) {
      result = await handlePaymentFailed({
        bookingCode:   booking_code,
        failureReason: failure_reason,
      });

    } else {
      // payment_status = PENDING hoặc giá trị không xác định → bỏ qua
      console.log(`[Webhook] payment_status="${payment_status}" không cần xử lý.`);
      result = {
        httpStatus: 200,
        body: {
          acknowledged:   true,
          booking_code:   booking_code,
          booking_status: 'PENDING',
          processed_at:   new Date().toISOString(),
          note:           `payment_status "${payment_status}" không cần xử lý.`,
        },
      };
    }

    return res.status(result.httpStatus).json(result.body);

  } catch (err) {
    // Lỗi bất ngờ (DB down, OOM…) – trả về 500
    // Cổng thanh toán sẽ retry theo schedule của họ.
    console.error('[Webhook] ✗ Lỗi server không mong muốn:', err.message);
    return res.status(500).json({
      error: {
        code:    'INTERNAL_ERROR',
        message: 'Đã xảy ra lỗi máy chủ khi xử lý webhook.',
      },
    });
  }
});

module.exports = router;
