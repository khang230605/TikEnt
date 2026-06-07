/**
 * api/routes/bookings.js
 * ============================================================
 * Express Router cho Booking API
 *
 * POST /bookings  →  Booking Publisher
 * ============================================================
 */

'use strict';

const express = require('express');
const router  = express.Router();

const { generateBookingCode }            = require('../../utils/bookingCode');
const { publishBookingCreated }          = require('../../publisher/bookingPublisher');
const { createBookingRules,
        handleValidationErrors }         = require('../validators/booking.validator');

const BOOKING_HOLD_MINUTES = parseInt(process.env.BOOKING_HOLD_MINUTES || '10', 10);

/**
 * POST /api/v1/bookings
 * ──────────────────────────────────────────────────────────────
 * Luồng xử lý:
 *  1. Validate request body (express-validator)
 *  2. Sinh booking_code
 *  3. Publish message vào RabbitMQ (KHÔNG ghi DB)
 *  4. Trả về 202 Accepted với booking_code
 * ──────────────────────────────────────────────────────────────
 */
router.post(
  '/',
  createBookingRules,         // Bước 1a: chạy validation rules
  handleValidationErrors,     // Bước 1b: kiểm tra kết quả, nếu sai → 400
  async (req, res) => {
    const { user_id, event_id, ticket_tier_id, quantity, payment_method, attendees } = req.body;

    try {
      // ── Bước 2: Sinh mã booking_code ──────────────────────
      // Format: TICK-YYYYMMDD-XXXX (xem utils/bookingCode.js)
      const bookingCode = generateBookingCode();

      // ── Bước 3: Publish message vào RabbitMQ ──────────────
      // Đóng gói toàn bộ thông tin cần thiết cho consumer
      await publishBookingCreated({
        bookingCode,
        userId:        user_id,
        eventId:       event_id,
        ticketTierId:  ticket_tier_id,
        quantity:      Number(quantity),
        paymentMethod: payment_method,
        attendees:     attendees || [],
      });

      // ── Bước 4: Tính expires_at và trả về 202 ─────────────
      const expiresAt = new Date(Date.now() + BOOKING_HOLD_MINUTES * 60 * 1000);

      return res.status(202).json({
        message: 'Đang xử lý',
        data: {
          booking_code:                  bookingCode,
          status:                        'PENDING',
          expires_at:                    expiresAt.toISOString(),
          estimated_processing_seconds:  5,
        },
      });

    } catch (err) {
      // Lỗi publish RabbitMQ hoặc lỗi bất ngờ
      console.error('[POST /bookings] Lỗi:', err.message);
      return res.status(500).json({
        error: {
          code:    'INTERNAL_ERROR',
          message: 'Không thể xử lý yêu cầu đặt vé, vui lòng thử lại sau.',
        },
      });
    }
  }
);

module.exports = router;
