/**
 * api/validators/booking.validator.js
 * ============================================================
 * Định nghĩa các rules validation cho POST /bookings
 * sử dụng thư viện express-validator.
 * ============================================================
 */

'use strict';

const { body, validationResult } = require('express-validator');

/**
 * Danh sách các rule validate cho request tạo booking.
 * Ánh xạ đúng với CreateBookingRequest trong openapi.yaml.
 */
const createBookingRules = [
  body('user_id')
    .notEmpty().withMessage('user_id là bắt buộc')
    .isUUID().withMessage('user_id phải là UUID hợp lệ'),

  body('event_id')
    .notEmpty().withMessage('event_id là bắt buộc')
    .isUUID().withMessage('event_id phải là UUID hợp lệ'),

  body('ticket_tier_id')
    .notEmpty().withMessage('ticket_tier_id là bắt buộc')
    .isUUID().withMessage('ticket_tier_id phải là UUID hợp lệ'),

  body('quantity')
    .notEmpty().withMessage('quantity là bắt buộc')
    .isInt({ min: 1, max: 10 }).withMessage('quantity phải là số nguyên từ 1 đến 10'),

  body('payment_method')
    .notEmpty().withMessage('payment_method là bắt buộc')
    .isIn(['VNPAY', 'MOMO', 'STRIPE', 'ZALOPAY', 'BANK_TRANSFER'])
    .withMessage('payment_method không hợp lệ'),

  // attendees là optional, nhưng nếu có thì phải đúng cấu trúc
  body('attendees')
    .optional()
    .isArray().withMessage('attendees phải là một mảng'),

  body('attendees.*.name')
    .optional()
    .isString().withMessage('Tên người tham dự phải là chuỗi ký tự')
    .isLength({ max: 255 }),

  body('attendees.*.email')
    .optional()
    .isEmail().withMessage('Email người tham dự không hợp lệ'),
];

/**
 * Middleware kiểm tra kết quả validation.
 * Nếu có lỗi, trả về 400 Bad Request kèm danh sách lỗi.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ.',
        details: errors.array().reduce((acc, err) => {
          acc[err.path] = err.msg;
          return acc;
        }, {}),
      },
    });
  }
  next();
}

module.exports = { createBookingRules, handleValidationErrors };
