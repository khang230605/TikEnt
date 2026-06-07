/**
 * api/routes/events.js – Event Catalog Service
 * ============================================================
 * Express Router cho Event API.
 * Kết hợp validation rules + middleware auth + controller.
 * ============================================================
 */
'use strict';

const express    = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router     = express.Router();

const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/events.controller');

// ── Helper: kiểm tra kết quả validation ──────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ.',
        details: errors.array().reduce((acc, e) => { acc[e.path] = e.msg; return acc; }, {}),
      },
    });
  }
  next();
}

// ── Validation rules ──────────────────────────────────────────
const createEventRules = [
  body('title').notEmpty().withMessage('title là bắt buộc').isLength({ max: 512 }),
  body('start_time').notEmpty().isISO8601().withMessage('start_time phải là ISO8601'),
  body('end_time').notEmpty().isISO8601().withMessage('end_time phải là ISO8601')
    .custom((val, { req }) => {
      if (new Date(val) <= new Date(req.body.start_time)) {
        throw new Error('end_time phải sau start_time');
      }
      return true;
    }),
  body('ticket_tiers').isArray({ min: 1 }).withMessage('Cần ít nhất 1 hạng vé'),
  body('ticket_tiers.*.name').notEmpty().withMessage('Tên hạng vé là bắt buộc'),
  body('ticket_tiers.*.price').isFloat({ min: 0 }).withMessage('Giá vé phải >= 0'),
  body('ticket_tiers.*.total_qty').isInt({ min: 1 }).withMessage('Số lượng vé phải >= 1'),
  body('ticket_tiers.*.max_per_order').optional().isInt({ min: 1, max: 100 }),
];

const listEventsRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('from_date').optional().isISO8601(),
  query('to_date').optional().isISO8601(),
];

const eventIdRule = [
  param('eventId').isUUID().withMessage('eventId phải là UUID hợp lệ'),
];

// ── Routes ────────────────────────────────────────────────────

/**
 * GET /api/v1/events
 * FR-01 – Danh sách sự kiện PUBLISHED, lọc theo category/city/search,
 * kèm available_qty real-time từ inventory.
 * Không cần xác thực – endpoint công khai.
 */
router.get(
  '/',
  listEventsRules,
  validate,
  ctrl.listEvents
);

/**
 * GET /api/v1/events/:eventId
 * Chi tiết một sự kiện (công khai).
 */
router.get(
  '/:eventId',
  eventIdRule,
  validate,
  ctrl.getEventById
);

/**
 * POST /api/v1/events
 * FR-09 – Tạo sự kiện mới.
 * Chỉ ORGANIZER hoặc ADMIN mới được tạo.
 */
router.post(
  '/',
  authenticate,
  authorize('ORGANIZER', 'ADMIN'),
  createEventRules,
  validate,
  ctrl.createEvent
);

/**
 * PATCH /api/v1/events/:eventId/publish
 * Chuyển trạng thái DRAFT → PUBLISHED.
 * Chỉ organizer chủ sự kiện hoặc ADMIN.
 */
router.patch(
  '/:eventId/publish',
  authenticate,
  authorize('ORGANIZER', 'ADMIN'),
  eventIdRule,
  validate,
  ctrl.publishEvent
);

module.exports = router;
