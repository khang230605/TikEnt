'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

/**
 * POST /api/v1/payments/vnpay/create-url
 * Tạo URL thanh toán VNPAY và trả về cho Frontend
 */
router.post('/vnpay/create-url', paymentController.createVnpayUrl);

/**
 * GET /api/v1/payments/vnpay/vnpay-return
 * Endpoint Redirect khách hàng về từ VNPAY
 */
router.get('/vnpay/vnpay-return', paymentController.vnpayReturn);

/**
 * GET /api/v1/payments/vnpay-ipn
 * Webhook Server-to-Server từ VNPAY để cập nhật trạng thái đơn hàng
 */
router.get('/vnpay-ipn', paymentController.vnpayIpn);

module.exports = router;
