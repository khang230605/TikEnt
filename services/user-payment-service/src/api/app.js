/**
 * api/app.js – User Payment Service
 */
'use strict';

require('dotenv').config();
const express       = require('express');
const authRouter    = require('./routes/auth');
const usersRouter   = require('./routes/users');
const webhookRouter = require('./routes/webhooks');

const app = express();

// Raw body capture cho HMAC webhook verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'user-payment-service', timestamp: new Date().toISOString() })
);

const paymentsRouter = require('./routes/payments');

app.use('/api/v1/auth',     authRouter);
app.use('/api/v1/users',    usersRouter);
app.use('/api/v1/webhooks', webhookRouter);
app.use('/api/v1/payments', paymentsRouter);

app.use((_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại.' } })
);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ.' } });
});

module.exports = app;
