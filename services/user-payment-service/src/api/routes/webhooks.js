/**
 * api/routes/webhooks.js – User Payment Service
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { paymentCallback } = require('../controllers/webhook.controller');

/**
 * POST /api/v1/webhooks/payment/callback
 * Nhận IPN/Webhook từ payment provider (VNPay, Momo, Stripe…).
 * Security: HMAC-SHA256 signature verification (mock hiện tại).
 */
router.post('/payment/callback', paymentCallback);

module.exports = router;
