/**
 * server.js – TickEnt API Gateway
 * ============================================================
 * Định tuyến (Routing) request từ client đến đúng Microservice.
 * Bảo vệ hệ thống bằng Rate Limiting.
 * ============================================================
 */
'use strict';

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const https     = require('https');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');
const { URL }   = require('url');

const app  = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// ── Biến môi trường cho Service URLs ────────────────────────
const BOOKING_SERVICE_URL      = process.env.BOOKING_SERVICE_URL      || 'http://localhost:3001';
const EVENT_SERVICE_URL        = process.env.EVENT_SERVICE_URL
                               || process.env.EVENT_CATALOG_SERVICE_URL
                               || 'http://localhost:3002';
const USER_PAYMENT_SERVICE_URL = process.env.USER_PAYMENT_SERVICE_URL || 'http://localhost:3003';

// ── Middleware: CORS ────────────────────────────────────────
// Đặt CORS trước tất cả middleware khác để preflight OPTIONS
// không bị rate-limit chặn và trả về header đúng cho browser.
const CORS_ORIGIN = process.env.CORS_ORIGIN; // VD: "https://tickent.vercel.app"
app.use(cors({
  origin: CORS_ORIGIN
    ? CORS_ORIGIN.split(',').map(o => o.trim())
    : true,                        // true = mirror Origin header (mọi origin) – chỉ dùng cho dev
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,                   // cache preflight 24h
}));
app.options('*', cors());          // Trả 200 cho mọi preflight OPTIONS

// ── Middleware: Access Log ──────────────────────────────────
app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));

// ── Middleware: Rate Limiting ────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error: {
      code:    'TOO_MANY_REQUESTS',
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
    }
  }
});
app.use('/api/', limiter);

// ── Health Check (Gateway) ──────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    service:   'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// ── Hàm proxy thủ công dùng http module native ──────────────
// Dùng native http thay vì http-proxy-middleware để tránh
// breaking change của v3 (path stripping).
function createProxy(targetBase) {
  const target = new URL(targetBase);
  const lib    = target.protocol === 'https:' ? https : http;

  return (req, res) => {
    const options = {
      hostname: target.hostname,
      port:     target.port || (target.protocol === 'https:' ? 443 : 80),
      path:     req.originalUrl,  // giữ nguyên path đầy đủ (VD: /api/v1/events?page=1)
      method:   req.method,
      headers:  {
        ...req.headers,
        host: target.host,        // override host header về service
      },
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy Error] ${req.method} ${req.originalUrl} -> ${targetBase}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: { code: 'BAD_GATEWAY', message: 'Không thể kết nối đến service đích.' }
        });
      }
    });

    // Pipe request body (POST/PUT/PATCH)
    req.pipe(proxyReq, { end: true });
  };
}

// ============================================================
// ĐỊNH TUYẾN (ROUTING)
// ============================================================

// 1. Event Catalog Service
app.use('/api/v1/events', createProxy(EVENT_SERVICE_URL));

// 2. User & Payment Service
app.use('/api/v1/auth',     createProxy(USER_PAYMENT_SERVICE_URL));
app.use('/api/v1/webhooks', createProxy(USER_PAYMENT_SERVICE_URL));

// 3. Booking Service
app.use('/api/v1/bookings', createProxy(BOOKING_SERVICE_URL));
app.use('/api/v1/tickets',  createProxy(BOOKING_SERVICE_URL));

// ── Fallback 404 ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: {
      code:    'NOT_FOUND',
      message: 'Endpoint không tồn tại trên API Gateway.'
    }
  });
});

// ── Khởi động ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('══════════════════════════════════════════════');
  console.log(' TickEnt – API Gateway');
  console.log(` Listening on http://localhost:${PORT}`);
  console.log('══════════════════════════════════════════════');
  console.log(` [Route] /api/v1/events            -> ${EVENT_SERVICE_URL}`);
  console.log(` [Route] /api/v1/auth|webhooks     -> ${USER_PAYMENT_SERVICE_URL}`);
  console.log(` [Route] /api/v1/bookings|tickets  -> ${BOOKING_SERVICE_URL}`);
  console.log('══════════════════════════════════════════════');
});
