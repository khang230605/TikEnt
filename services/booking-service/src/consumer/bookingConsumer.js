/**
 * consumer/bookingConsumer.js
 * ============================================================
 * BOOKING CONSUMER – Thành phần 2/2
 * ============================================================
 *
 * Script worker chạy độc lập (npm run consumer).
 * Lắng nghe queue "booking_requests_queue" và xử lý từng
 * message đặt vé theo luồng:
 *
 *  [booking_requests_queue]
 *       │
 *       ▼
 *  1. Parse message JSON
 *       │
 *       ▼
 *  2. Bắt đầu DB Transaction
 *       │
 *       ├─► UPDATE inventory (Optimistic Locking check version)
 *       │        │
 *       │        ├─ rowCount = 0 → CONFLICT (hết vé / version lỗi)
 *       │        │       └─► ROLLBACK → nack(requeue=false)
 *       │        │
 *       │        └─ rowCount = 1 → SUCCESS
 *       │                └─► INSERT bookings (status=PENDING, expires_at)
 *       │                         └─► COMMIT → ack message
 *       │                                │
 *       │                                ▼
 *       │                    9. Publish hold message
 *       │                       → [booking_hold_queue] (TTL 10 phút)
 *       │                              │ hết TTL (không ai consume)
 *       │                              ▼
 *       │                    [booking.deadletter.exchange]
 *       │                              │ routing key: booking.expired
 *       │                              ▼
 *       │                    [booking_timeout_queue]
 *       │                       (bookingTimeoutConsumer xử lý)
 *       │
 *       └─ Lỗi DB bất ngờ → ROLLBACK → nack(requeue=true) → retry
 *
 * ============================================================
 */

'use strict';

require('dotenv').config();

const {
  connect,
  getChannel,
  BOOKING_REQUESTS_QUEUE,
  EXCHANGE_NAME,
  RK_BOOKING_HOLD,
} = require('../config/rabbitmq');
const { pool } = require('../config/database');

const BOOKING_HOLD_MINUTES = parseInt(process.env.BOOKING_HOLD_MINUTES || '10', 10);

// ── Hàm xử lý chính cho mỗi message nhận được ───────────────

/**
 * Xử lý một booking message từ RabbitMQ.
 *
 * Toàn bộ logic DB chạy trong một transaction duy nhất để đảm bảo
 * tính nguyên tử (atomicity): inventory update và booking insert
 * phải cùng thành công hoặc cùng thất bại.
 *
 * @param {Object} payload       - JSON đã parse từ message
 * @param {amqp.Channel} channel - RabbitMQ channel để ack/nack
 * @param {amqp.Message} msg     - Raw message object từ amqplib
 */
async function handleBookingMessage(payload, channel, msg) {
  const {
    bookingCode,
    userId,
    eventId,
    ticketTierId,
    quantity,
    paymentMethod,
    attendees,
  } = payload;

  console.log(`\n[Consumer] ► Nhận message: bookingCode=${bookingCode}, tierId=${ticketTierId}, qty=${quantity}`);
  console.log("Đang kết nối tới DB: " + process.env.DATABASE_URL);
  // Lấy một client từ pool (giữ client này suốt transaction)
  const dbClient = await pool.connect();

  try {
    // ═══════════════════════════════════════════════════════
    // BƯỚC 1: Bắt đầu Database Transaction
    // ═══════════════════════════════════════════════════════
    await dbClient.query('BEGIN');
    console.log(`[Consumer] [${bookingCode}] Transaction bắt đầu.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 2: Đọc trạng thái inventory hiện tại (với FOR UPDATE)
    // FOR UPDATE → lock dòng này lại trong suốt transaction
    // để tránh 2 transaction đọc cùng version tại một thời điểm
    // ═══════════════════════════════════════════════════════
    const inventoryRes = await dbClient.query(
      `SELECT id, total_qty, reserved_qty, sold_qty, version
         FROM event_domain.inventory
        WHERE ticket_tier_id = $1
          FOR UPDATE`,            // Pessimistic lock cho dòng inventory
      [ticketTierId]
    );

    // Kiểm tra xem hạng vé có tồn tại trong inventory không
    if (inventoryRes.rowCount === 0) {
      console.warn(`[Consumer] [${bookingCode}] Không tìm thấy inventory cho tier=${ticketTierId}.`);
      await dbClient.query('ROLLBACK');
      // Không requeue vì message này sẽ luôn thất bại
      channel.nack(msg, false, false);
      return;
    }

    const inventory = inventoryRes.rows[0];
    const currentVersion = inventory.version;
    const availableQty = inventory.total_qty - inventory.reserved_qty - inventory.sold_qty;

    console.log(`[Consumer] [${bookingCode}] Inventory: available=${availableQty}, version=${currentVersion}`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 3: Kiểm tra số lượng vé có đủ không
    // ═══════════════════════════════════════════════════════
    if (availableQty < quantity) {
      console.warn(`[Consumer] [${bookingCode}] Hết vé: yêu cầu ${quantity}, còn ${availableQty}.`);
      await dbClient.query('ROLLBACK');
      // Không requeue – vé đã hết, retry cũng vô nghĩa
      channel.nack(msg, false, false);

      // TODO: Gửi notification cho user biết đặt vé thất bại
      // await notificationService.notifyBookingFailed(userId, bookingCode, 'SOLD_OUT');
      return;
    }

    // ═══════════════════════════════════════════════════════
    // BƯỚC 4: UPDATE inventory với Optimistic Locking
    //
    // Điều kiện WHERE kiểm tra:
    //   - ticket_tier_id = đúng hạng vé
    //   - version = version hiện tại (Optimistic Lock check)
    //   - còn đủ vé (total - reserved - sold >= quantity)
    //
    // Nếu từ khi đọc (BƯỚC 2) đến giờ có worker khác đã UPDATE
    // cùng dòng này → version sẽ khác → rowCount = 0 → conflict
    // ═══════════════════════════════════════════════════════
    const updateInventorySQL = `
      UPDATE event_domain.inventory
         SET reserved_qty = reserved_qty + $1,
             version      = version + 1,
             updated_at   = NOW()
       WHERE ticket_tier_id = $2
         AND version        = $3
         AND (total_qty - reserved_qty - sold_qty) >= $1
      RETURNING version AS new_version
    `;

    const updateRes = await dbClient.query(updateInventorySQL, [
      quantity,       // $1: số vé cần reserve
      ticketTierId,   // $2: UUID hạng vé
      currentVersion, // $3: version hiện tại (Optimistic Lock check)
    ]);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 5: Kiểm tra kết quả UPDATE
    // ═══════════════════════════════════════════════════════

    if (updateRes.rowCount === 0) {
      // ── THẤT BẠI: Optimistic Lock Conflict ───────────────
      // rowCount = 0 có nghĩa là:
      //   a) version đã bị worker khác thay đổi (race condition), HOẶC
      //   b) không còn đủ vé sau khi check lại
      console.warn(
        `[Consumer] [${bookingCode}] ⚠ Optimistic Lock Conflict! ` +
        `version mong đợi=${currentVersion} nhưng đã bị thay đổi.`
      );

      // ROLLBACK – huỷ transaction, không có gì thay đổi trong DB
      await dbClient.query('ROLLBACK');
      console.log(`[Consumer] [${bookingCode}] Transaction đã ROLLBACK.`);

      // Nack message và KHÔNG requeue (requeue=false).
      // Trong production, có thể requeue với delay để retry,
      // hoặc đẩy vào Dead Letter Queue.
      channel.nack(msg, false, false);

      // TODO: Gửi notification cho user biết bị conflict, yêu cầu thử lại
      return;
    }

    // ── THÀNH CÔNG: inventory đã được cập nhật ─────────────
    const newVersion = updateRes.rows[0].new_version;
    console.log(`[Consumer] [${bookingCode}] ✓ Inventory updated. version: ${currentVersion} → ${newVersion}`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 6: INSERT booking mới vào bảng bookings
    //
    // Status = PENDING: đang chờ thanh toán
    // expires_at      : thời điểm booking hết hạn nếu chưa thanh toán
    //                   (BOOKING_HOLD_MINUTES phút kể từ bây giờ)
    // ═══════════════════════════════════════════════════════
    const expiresAt = new Date(Date.now() + BOOKING_HOLD_MINUTES * 60 * 1000);

    const insertBookingSQL = `
      INSERT INTO booking_domain.bookings
        (id, user_id, event_id, booking_code, status,
         total_amount, currency, payment_method, expires_at,
         created_at, updated_at)
      VALUES
        (gen_random_uuid(), $1, $2, $3, 'PENDING',
         0.00, 'VND', $4, $5,
         NOW(), NOW())
      RETURNING id, booking_code, status, expires_at
    `;
    // Ghi chú: total_amount = 0.00 tạm thời, Payment Service sẽ
    //          cập nhật lại sau khi tính giá từ ticket_tiers.price

    const insertRes = await dbClient.query(insertBookingSQL, [
      userId,         // $1
      eventId,        // $2
      bookingCode,    // $3
      paymentMethod,  // $4
      expiresAt,      // $5
    ]);

    const newBooking = insertRes.rows[0];
    console.log(
      `[Consumer] [${bookingCode}] ✓ Booking inserted: id=${newBooking.id}, ` +
      `status=${newBooking.status}, expires_at=${newBooking.expires_at}`
    );

    // ═══════════════════════════════════════════════════════
    // BƯỚC 7: COMMIT Transaction
    // Tại thời điểm này cả 2 thao tác DB đều thành công:
    //  ✓ inventory.reserved_qty tăng lên
    //  ✓ bookings mới được tạo với status PENDING
    // ═══════════════════════════════════════════════════════
    await dbClient.query('COMMIT');
    console.log(`[Consumer] [${bookingCode}] ✓ Transaction COMMIT thành công.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 8: ACK message → RabbitMQ xóa message khỏi queue
    // Chỉ ACK SAU KHI commit DB thành công để đảm bảo
    // không mất message nếu service crash giữa chừng.
    // ═══════════════════════════════════════════════════════
    channel.ack(msg);
    console.log(`[Consumer] [${bookingCode}] ✓ Message đã được ACK.`);

    // ═══════════════════════════════════════════════════════
    // BƯỚC 9: Publish Hold Message vào booking_hold_queue
    //
    // Mục đích: kích hoạt bộ đếm thời gian TTL cho booking này.
    // Message sẽ nằm yên trong booking_hold_queue BOOKING_TTL_MS ms.
    // Nếu booking được thanh toán → webhook sẽ CONFIRM và message
    //   này chỉ việc hết TTL rồi bị route sang timeout queue,
    //   lúc đó TimeoutConsumer kiểm tra status thấy CONFIRMED → bỏ qua.
    // Nếu không thanh toán → sau TTL, DLX route sang booking_timeout_queue
    //   → TimeoutConsumer hủy booking và hoàn trả inventory.
    // ═══════════════════════════════════════════════════════
    try {
      const holdPayload = {
        bookingCode,
        ticketTierId,
        quantity,
        scheduledAt: new Date().toISOString(),
      };

      // Dùng getChannel() để lấy channel singleton hiện tại
      // (cùng channel đang consume, hoàn toàn an toàn để publish)
      const publishChannel = getChannel();
      publishChannel.publish(
        EXCHANGE_NAME,
        RK_BOOKING_HOLD,                          // routing key → booking_hold_queue
        Buffer.from(JSON.stringify(holdPayload)),
        {
          persistent: true,                      // message bền vững qua restart
          contentType: 'application/json',
          messageId: `hold-${bookingCode}`,     // ID duy nhất để debug
          expiration: String(BOOKING_HOLD_MINUTES * 60 * 1000), // TTL per-message (ms)
          // Ghi chú: expiration per-message và x-message-ttl trên queue
          // đều được set – RabbitMQ lấy giá trị nào nhỏ hơn.
        }
      );

      console.log(
        `[Consumer] [${bookingCode}] ✓ Hold message published → ${EXCHANGE_NAME}/${RK_BOOKING_HOLD} ` +
        `(TTL=${BOOKING_HOLD_MINUTES * 60 * 1000}ms)`
      );
    } catch (holdErr) {
      // Lỗi publish hold message không nên làm hỏng luồng chính.
      // Booking đã được tạo thành công trong DB.
      // Trong production: alert/monitor để biết timer không được set.
      console.error(`[Consumer] [${bookingCode}] ⚠ Không thể publish hold message:`, holdErr.message);
    }

    // TODO: Trigger Payment Service để bắt đầu quá trình thanh toán
    // Ví dụ: publish sang exchange khác hoặc gọi internal API
    // await publishPaymentRequest({ bookingCode, userId, amount, paymentMethod });

  } catch (err) {
    // ═══════════════════════════════════════════════════════
    // XỬ LÝ LỖI NGOÀI Ý MUỐN (lỗi DB, network timeout…)
    // ═══════════════════════════════════════════════════════
    console.error(`[Consumer] [${bookingCode}] ✗ Lỗi không mong muốn:`, err.message);

    try {
      // Rollback để đảm bảo DB không ở trạng thái dở dang
      await dbClient.query('ROLLBACK');
      console.log(`[Consumer] [${bookingCode}] Transaction đã ROLLBACK do lỗi.`);
    } catch (rollbackErr) {
      console.error(`[Consumer] [${bookingCode}] Lỗi khi ROLLBACK:`, rollbackErr.message);
    }

    // Nack và requeue=true → RabbitMQ sẽ gửi lại message để retry
    // Chú ý: nếu lỗi là do dữ liệu sai (business logic), nên requeue=false
    channel.nack(msg, false, true);
    console.log(`[Consumer] [${bookingCode}] Message đã được NACK (requeue=true).`);

  } finally {
    // Luôn trả client về pool dù thành công hay thất bại
    dbClient.release();
  }
}

// ── Hàm khởi động Consumer ───────────────────────────────────

/**
 * Khởi động Booking Consumer Worker.
 * Kết nối RabbitMQ, sau đó bắt đầu consume từ queue.
 */
async function startConsumer() {
  console.log('══════════════════════════════════════════════');
  console.log(' TickEnt – Booking Consumer Worker');
  console.log('══════════════════════════════════════════════');

  // Kết nối RabbitMQ (hàm connect tự retry nếu thất bại)
  // connect() cũng setup đầy đủ topology (exchanges + queues + bindings)
  const channel = await connect();

  console.log(`[Consumer] Đang lắng nghe queue: "${BOOKING_REQUESTS_QUEUE}"...`);

  // Bắt đầu consume message từ queue
  // noAck: false → manual acknowledgement (ta tự gọi ack/nack)
  channel.consume(BOOKING_REQUESTS_QUEUE, async (msg) => {
    // msg có thể là null nếu consumer bị cancel phía broker
    if (msg === null) {
      console.warn('[Consumer] Nhận được null message (consumer bị cancel).');
      return;
    }

    let payload;
    try {
      // Parse JSON payload từ message content
      payload = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      console.error('[Consumer] Không thể parse JSON message:', parseErr.message);
      // Message không hợp lệ → nack và không requeue
      channel.nack(msg, false, false);
      return;
    }

    // Xử lý message (toàn bộ logic trong try/catch bên trong)
    await handleBookingMessage(payload, channel, msg);

  }, { noAck: false }); // noAck=false = manual ack mode
}

// ── Entry Point ──────────────────────────────────────────────
// Script này được chạy trực tiếp: node src/consumer/bookingConsumer.js
startConsumer().catch((err) => {
  console.error('[Consumer] Lỗi khởi động:', err);
  process.exit(1);
});

// Graceful shutdown khi nhận tín hiệu dừng (Ctrl+C / SIGTERM từ Docker/k8s)
process.on('SIGINT', () => { console.log('\n[Consumer] SIGINT received. Đang dừng...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[Consumer] SIGTERM received. Đang dừng...'); process.exit(0); });
