'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userCtrl = require('../controllers/userController');

// ── Middleware auth ───────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Thiếu token.' } });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'change_me_in_production');
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token không hợp lệ.' } });
  }
}

// Lấy danh sách vé đã mua của user
router.get('/me/tickets', authenticate, userCtrl.getMyTickets);

module.exports = router;
