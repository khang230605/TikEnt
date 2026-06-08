'use strict';

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Không tìm thấy token xác thực' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Invalid token:', error.message);
    return res.status(401).json({ error: { message: 'Token không hợp lệ hoặc đã hết hạn' } });
  }
};

module.exports = { verifyToken };
