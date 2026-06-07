/**
 * consumer/bookingTimeoutConsumer.js
 * ============================================================
 * BOOKING TIMEOUT CONSUMER – Worker xử lý vé hết hạn
 * ============================================================
 *
 * Script chạy độc lập: npm run consumer:timeout
 *
 * Cơ chế hoạt động (DLX Pattern):
 *
 *  [booking_hold_queue]  ──(hết TTL 10 phút)──►  [booking.deadletter.exchange]
 *                                                          │  routing key: booking.expired
 *                                                          ▼
 *                                               [booking_timeout_queue]
 *                                                          │
 *                                                          ▼
 *                                              ┌────────────────────────┐
 *                                              │  bookingTimeoutConsumer │
 *                                              └────────────────────────┘
 *                                                          │
 *                      ┌─────────────────────────────────────────────┐
 *                      │  Mở DB Transaction                          │
 *                      │                                              │
 *                      │  SELECT bookings WHERE booking_code = ?      │
 *                      │          │                                   │
 *                      │          ├─ status = CONFIRMED → ACK (bỏ qua) │
 *                      │          │   (đã thanh toán, không cần làm gì)│
 *                      │          │                                   │
 *                      │          └─ status = PENDING                 │
 *                      │                  │                           │
 *                      │                  ├─► UPDATE bookings         │
 *                      │                  │   status = EXPIRED        │
 *                      │                  │                           │
 *                      │                  └─► UPDATE inventory (OL)   │
 *                      │                      reserved_qty -= quantity │
 *                      │                      version += 1            │
 *                      │                             │                │
 *                      │                             ├─ rowCount=0    │
 *                      │                             │  (OL conflict) │
 *                      │                             │  → ROLLBACK    │
 *                      │                             │  → nack(retry) │
 *                      │                             │                │
 *                      │                             └─ rowCount=1    │
 *                      │                                → COMMIT      │
 *                      │                                → ACK ✓       │
 *                      └─────────────────────────────────────────────┘
 *
 * ============================================================
 */

'use strict';

require('dotenv').config();

const {
  connect,
  BOOKING_TIMEOUT_QUEUE,
} = require('../config/rabbitmq');
const { pool } = require('../config/database');

// ── Hàm xử lý chính cho mỗi message timeout ──────────────────

/**
 * Xử lý một expired booking message từ booking_timeout_queue.
 *
 * Logic chính:
 *  1. Đọc trạng thái booking từ DB
 *  2a. Nếu CONFIRMED → ACK và bỏ qua (đã thanh toán thành công)
 *  2b. Nếu PENDING   → hủy booking + hoàn trả inventory (OL)
 *
 * @param {Object}       payload - JSON đã parse
 * @param {amqp.Channel} channel - RabbitMQ channel
 * @param {amqp.Message} msg     - Raw message từ amqplib
 */
async function handleTimeoutMessage(payload, channel, msg) {
  const { bookingCode, ticketTierId, quantity } = payload;

  console.log(`\n[TimeoutConsumer] ► Nhận expired message: bookingCode=${bookingCode}, qty=${quantity}`);

  // Lấy client riêng từ pool để giữ suốt transaction
  const dbClient = await pool.connect();

  try {
    // ═══════════════════════════════════════════════════════
    // BƯỚC 1: Bắt đầu DB Transaction
    // ═══════════════════════════════════════════════════════
    await dbClient.query('BEGIN');
    console.log(`[TimeoutConsumer] [${bookingCode}] Transaction bắt đầu.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 2: Đọc trạng thái booking hiện tại
    //
    // FOR UPDATE → lock dòng booking này để tránh race condition
    // với webhook thanh toán đang cố CONFIRM cùng lúc.
    // ═══════════════════════════════════════════════════════
    const bookingRes = await dbClient.query(
      `SELECT id, status, expires_at
         FROM booking_domain.bookings
        WHERE booking_code = $1
          FOR UPDATE`,
      [bookingCode]
    );

    // Trường hợp không tìm thấy booking (dữ liệu bất thường)
    if (bookingRes.rowCount === 0) {
      console.warn(`[TimeoutConsumer] [${bookingCode}] Không tìm thấy booking trong DB.`);
      await dbClient.query('ROLLBACK');
      // Không requeue – message không hợp lệ, bỏ vào DLQ nếu có
      channel.nack(msg, false, false);
      return;
    }

    const booking       = bookingRes.rows[0];
    const bookingStatus = booking.status;

    console.log(`[TimeoutConsumer] [${bookingCode}] Trạng thái hiện tại: ${bookingStatus}`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 3: Kiểm tra trạng thái → quyết định hành động
    // ═══════════════════════════════════════════════════════

    // ── TRƯỜNG HỢP A: Booking đã CONFIRMED (đã thanh toán) ──
    // Message TTL hết sau khi user thanh toán thành công.
    // Không cần làm gì → ACK và thoát.
    if (['CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED'].includes(bookingStatus)) {
      console.log(
        `[TimeoutConsumer] [${bookingCode}] Booking đã ở trạng thái "${bookingStatus}". ` +
        `Bỏ qua message này.`
      );
      await dbClient.query('ROLLBACK'); // Không có gì thay đổi → ROLLBACK (no-op)
      channel.ack(msg);
      console.log(`[TimeoutConsumer] [${bookingCode}] ✓ Message ACK (bỏ qua).`);
      return;
    }

    // ── TRƯỜNG HỢP B: Booking vẫn PENDING → cần hủy ─────────
    // User không thanh toán trong thời gian quy định.
    console.log(`[TimeoutConsumer] [${bookingCode}] Booking quá hạn. Bắt đầu hủy...`);

    // ── BƯỚC 4: Đọc inventory hiện tại (FOR UPDATE) ──────────
    // Lấy version hiện tại để thực hiện Optimistic Locking khi hoàn trả
    const inventoryRes = await dbClient.query(
      `SELECT id, reserved_qty, version
         FROM event_domain.inventory
        WHERE ticket_tier_id = $1
          FOR UPDATE`,
      [ticketTierId]
    );

    if (inventoryRes.rowCount === 0) {
      // Inventory không tồn tại – dữ liệu bất thường
      console.error(`[TimeoutConsumer] [${bookingCode}] Không tìm thấy inventory cho tier=${ticketTierId}.`);
      await dbClient.query('ROLLBACK');
      channel.nack(msg, false, false); // Không requeue, dữ liệu sai
      return;
    }

    const inventory    = inventoryRes.rows[0];
    const currentVersion = inventory.version;

    console.log(
      `[TimeoutConsumer] [${bookingCode}] Inventory: reserved_qty=${inventory.reserved_qty}, version=${currentVersion}`
    );

    // ═══════════════════════════════════════════════════════
    // BƯỚC 5: UPDATE bookings → EXPIRED
    //
    // Cập nhật trạng thái đơn hàng thành EXPIRED và ghi thời điểm hủy.
    // ═══════════════════════════════════════════════════════
    await dbClient.query(
      `UPDATE booking_domain.bookings
          SET status       = 'EXPIRED',
              cancelled_at = NOW(),
              cancel_reason = 'Hết thời gian giữ vé (timeout sau 10 phút)',
              updated_at   = NOW()
        WHERE booking_code = $1
          AND status       = 'PENDING'`,
      [bookingCode]
    );
    console.log(`[TimeoutConsumer] [${bookingCode}] ✓ Booking status → EXPIRED.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 6: UPDATE inventory – Hoàn trả reserved_qty (Optimistic Locking)
    //
    // Điều kiện WHERE:
    //   - ticket_tier_id = đúng hạng vé
    //   - version = version hiện tại (OL check)
    //   - reserved_qty >= quantity (không để âm)
    //
    // Nếu version đã bị thay đổi bởi process khác → rowCount = 0 → retry
    // ═══════════════════════════════════════════════════════
    const restoreInventorySQL = `
      UPDATE event_domain.inventory
         SET reserved_qty = reserved_qty - $1,
             version      = version + 1,
             updated_at   = NOW()
       WHERE ticket_tier_id = $2
         AND version        = $3
         AND reserved_qty   >= $1
      RETURNING version AS new_version, reserved_qty AS new_reserved_qty
    `;

    const restoreRes = await dbClient.query(restoreInventorySQL, [
      quantity,        // $1: số vé cần hoàn trả
      ticketTierId,    // $2: UUID hạng vé
      currentVersion,  // $3: version hiện tại (OL check)
    ]);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 7: Kiểm tra kết quả UPDATE inventory
    // ═══════════════════════════════════════════════════════

    if (restoreRes.rowCount === 0) {
      // Optimistic Lock Conflict – version đã bị thay đổi
      // (ví dụ: một timeout consumer khác đang xử lý cùng tier)
      console.warn(
        `[TimeoutConsumer] [${bookingCode}] ⚠ OL Conflict khi hoàn trả inventory! ` +
        `version mong đợi=${currentVersion} đã bị thay đổi.`
      );

      await dbClient.query('ROLLBACK');
      console.log(`[TimeoutConsumer] [${bookingCode}] Transaction ROLLBACK.`);

      // Requeue=true → RabbitMQ gửi lại message để retry
      // Lần retry này inventory version sẽ được đọc lại → OL pass
      channel.nack(msg, false, true);
      console.log(`[TimeoutConsumer] [${bookingCode}] Message NACK (requeue=true, sẽ retry).`);
      return;
    }

    const { new_version, new_reserved_qty } = restoreRes.rows[0];
    console.log(
      `[TimeoutConsumer] [${bookingCode}] ✓ Inventory hoàn trả: ` +
      `reserved_qty → ${new_reserved_qty}, version: ${currentVersion} → ${new_version}`
    );

    // ═══════════════════════════════════════════════════════
    // BƯỚC 8: COMMIT Transaction
    // Tại thời điểm này cả 2 thao tác đều thành công:
    //  ✓ bookings.status = EXPIRED
    //  ✓ inventory.reserved_qty giảm (vé được hoàn trả)
    // ═══════════════════════════════════════════════════════
    await dbClient.query('COMMIT');
    console.log(`[TimeoutConsumer] [${bookingCode}] ✓ Transaction COMMIT thành công.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 9: ACK message → RabbitMQ xóa khỏi queue
    // ACK SAU KHI COMMIT để đảm bảo at-least-once processing
    // ═══════════════════════════════════════════════════════
    channel.ack(msg);
    console.log(`[TimeoutConsumer] [${bookingCode}] ✓ Message ACK. Booking đã bị hủy.`);

    // TODO: Gửi email/notification thông báo booking đã hết hạn
    // await notificationService.notifyBookingExpired(booking.userId, bookingCode);

  } catch (err) {
    // ═══════════════════════════════════════════════════════
    // XỬ LÝ LỖI NGOÀI Ý MUỐN
    // ═══════════════════════════════════════════════════════
    console.error(`[TimeoutConsumer] [${bookingCode}] ✗ Lỗi không mong muốn:`, err.message);

    try {
      await dbClient.query('ROLLBACK');
      console.log(`[TimeoutConsumer] [${bookingCode}] Transaction ROLLBACK do lỗi.`);
    } catch (rollbackErr) {
      console.error(`[TimeoutConsumer] [${bookingCode}] Lỗi khi ROLLBACK:`, rollbackErr.message);
    }

    // Requeue=true → retry khi gặp lỗi tạm thời (DB timeout, network...)
    channel.nack(msg, false, true);
    console.log(`[TimeoutConsumer] [${bookingCode}] Message NACK (requeue=true).`);

  } finally {
    // Luôn trả client về pool
    dbClient.release();
  }
}

// ── Hàm khởi động Timeout Consumer ───────────────────────────

/**
 * Khởi động Booking Timeout Consumer Worker.
 */
async function startTimeoutConsumer() {
  console.log('══════════════════════════════════════════════');
  console.log(' TickEnt – Booking Timeout Consumer Worker');
  console.log(' (DLX Pattern – xử lý vé hết hạn 10 phút)');
  console.log('══════════════════════════════════════════════');

  // Kết nối RabbitMQ – setup topology đầy đủ (exchanges, queues, bindings)
  const channel = await connect();

  console.log(`[TimeoutConsumer] Đang lắng nghe queue: "${BOOKING_TIMEOUT_QUEUE}"...`);

  // Consume từ booking_timeout_queue (nơi DLX route các message hết TTL đến)
  channel.consume(BOOKING_TIMEOUT_QUEUE, async (msg) => {
    if (msg === null) {
      console.warn('[TimeoutConsumer] Nhận được null message (consumer bị cancel).');
      return;
    }

    let payload;
    try {
      // Parse JSON payload từ message content
      // Lưu ý: RabbitMQ giữ nguyên body của message gốc khi dead-letter,
      // chỉ thêm header x-death vào properties.
      payload = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      console.error('[TimeoutConsumer] Không thể parse JSON message:', parseErr.message);
      console.error('[TimeoutConsumer] Raw content:', msg.content.toString());
      channel.nack(msg, false, false); // Message không hợp lệ → loại bỏ
      return;
    }

    // Log thêm thông tin x-death để debug (nếu có)
    const xDeath = msg.properties?.headers?.['x-death'];
    if (xDeath && xDeath.length > 0) {
      const deathInfo = xDeath[0];
      console.log(
        `[TimeoutConsumer] x-death info: queue=${deathInfo.queue}, ` +
        `reason=${deathInfo.reason}, count=${deathInfo.count}`
      );
    }

    await handleTimeoutMessage(payload, channel, msg);

  }, { noAck: false });
}

// ── Entry Point ──────────────────────────────────────────────
startTimeoutConsumer().catch((err) => {
  console.error('[TimeoutConsumer] Lỗi khởi động:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT',  () => { console.log('\n[TimeoutConsumer] SIGINT received. Đang dừng...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[TimeoutConsumer] SIGTERM received. Đang dừng...'); process.exit(0); });
