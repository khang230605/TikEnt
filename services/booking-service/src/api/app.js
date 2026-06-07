/**
 * api/app.js
 * ============================================================
 * Cấu hình Express Application (không chứa logic khởi động server).
 * Tách riêng app và server để dễ viết unit test.
 * ============================================================
 */

'use strict';

require('dotenv').config();
const express = require('express');

const bookingsRouter = require('./routes/bookings');
const webhooksRouter = require('./routes/webhooks');

const app = express();

// ── Middleware toàn cục ───────────────────────────────────────
// Thu thập raw body (Buffer) trước khi parse JSON.
// Cần thiết để verifySignature() có thể xác thực HMAC-SHA256
// trên body gốc (trước khi bị parse và sửa đổi bởi JSON.parse).
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf; // lưu Buffer gốc vào req.rawBody
  },
}));
app.use(express.urlencoded({ extended: false }));

// ── Health Check ─────────────────────────────────────────────
// Endpoint đơn giản để load balancer / k8s kiểm tra trạng thái service
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'booking-service', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/webhooks', webhooksRouter);  // POST /api/v1/webhooks/payment/callback

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại.' } });
});

// ── Global Error Handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi máy chủ.' } });
});

module.exports = app;
