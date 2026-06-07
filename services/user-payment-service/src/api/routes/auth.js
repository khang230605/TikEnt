/**
 * api/routes/auth.js – User Payment Service
 */
'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const jwt    = require('jsonwebtoken');

const ctrl = require('../controllers/auth.controller');

// ── Helper validate ───────────────────────────────────────────
const { validationResult } = require('express-validator');
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ.',
        details: errors.array().reduce((acc, e) => { acc[e.path] = e.msg; return acc; }, {}),
      },
    });
  }
  next();
}

// ── Middleware auth đơn giản (dùng nội bộ) ───────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Thiếu token.' } });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'change_me');
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token không hợp lệ.' } });
  }
}

// ── Validation rules ──────────────────────────────────────────
const registerRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Mật khẩu tối thiểu 8 ký tự'),
  body('full_name').notEmpty().withMessage('Họ tên là bắt buộc').isLength({ max: 255 }),
  body('role').optional().isIn(['CUSTOMER', 'ORGANIZER']).withMessage('role không hợp lệ'),
  body('phone').optional().isMobilePhone('any').withMessage('Số điện thoại không hợp lệ'),
];

const loginRules = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
];

// ── Routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * FR-02 – Đăng ký tài khoản mới (CUSTOMER hoặc ORGANIZER).
 */
router.post('/register', registerRules, validate, ctrl.register);

/**
 * POST /api/v1/auth/login
 * FR-02 – Đăng nhập, nhận JWT Access Token.
 */
router.post('/login', loginRules, validate, ctrl.login);

/**
 * GET /api/v1/auth/me
 * Lấy thông tin profile của user đang đăng nhập.
 */
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
