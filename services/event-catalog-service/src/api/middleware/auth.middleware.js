/**
 * api/middleware/auth.middleware.js  – Event Catalog Service
 * ============================================================
 * Middleware xác thực JWT và phân quyền theo role.
 *
 * JWT được phát hành bởi user-payment-service.
 * Mọi service trong hệ thống dùng chung JWT_SECRET để verify.
 * ============================================================
 */
'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

/**
 * Middleware verify JWT từ Authorization header.
 * Gắn thông tin user đã decode vào req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Kiểm tra header tồn tại và đúng format "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Thiếu hoặc sai định dạng Authorization header.' },
    });
  }

  const token = authHeader.slice(7); // bỏ "Bearer "

  try {
    // Verify chữ ký và thời hạn của token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, iat, exp }
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token đã hết hạn, vui lòng đăng nhập lại.'
      : 'Token không hợp lệ.';
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message } });
  }
}

/**
 * Middleware phân quyền: chỉ cho phép những role được chỉ định.
 *
 * @param {...string} roles - Các role được phép, VD: 'ORGANIZER', 'ADMIN'
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/', authenticate, authorize('ORGANIZER', 'ADMIN'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Chưa xác thực.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Vai trò "${req.user.role}" không có quyền thực hiện hành động này.`,
        },
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
