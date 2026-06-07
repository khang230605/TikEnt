/**
 * api/app.js – Event Catalog Service
 */
'use strict';

require('dotenv').config();
const express    = require('express');
const eventsRouter = require('./routes/events');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'event-catalog-service', timestamp: new Date().toISOString() })
);

app.use('/api/v1/events', eventsRouter);

app.use((_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại.' } })
);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ.' } });
});

module.exports = app;
