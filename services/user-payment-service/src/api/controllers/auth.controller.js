/**
 * api/controllers/auth.controller.js – User Payment Service
 * ============================================================
 * Xử lý đăng ký và đăng nhập người dùng.
 *
 * Thao tác trên schema user_domain.users (Shared Database).
 * Phát hành JWT Token phân quyền theo role: CUSTOMER | ORGANIZER | ADMIN.
 * ============================================================
 */
'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { pool } = require('../../config/database');

const JWT_SECRET      = process.env.JWT_SECRET      || 'change_me_in_production';
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN  || '24h';
const BCRYPT_ROUNDS   = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// ── Helper: Ký JWT ────────────────────────────────────────────

/**
 * Tạo JWT Access Token chứa thông tin user và role.
 *
 * Payload:
 *  { id, email, role, full_name }
 *
 * @param {Object} user - Bản ghi user từ DB
 * @returns {string} JWT token
 */
function signToken(user) {
  return jwt.sign(
    {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ============================================================
// POST /api/v1/auth/register  – FR-02: Đăng ký tài khoản
// ============================================================

/**
 * Đăng ký tài khoản mới.
 *
 * - Role mặc định là CUSTOMER.
 * - Để đăng ký ORGANIZER, truyền role: "ORGANIZER" trong body.
 *   (Trong production nên yêu cầu admin phê duyệt.)
 * - Password được hash bằng bcrypt trước khi lưu DB.
 *
 * @route  POST /api/v1/auth/register
 * @access Public
 */
async function register(req, res) {
  const {
    email,
    password,
    full_name,
    phone,
    role = 'CUSTOMER',  // mặc định CUSTOMER
  } = req.body;

  // Chỉ cho phép role hợp lệ (không cho tự đặt ADMIN qua API)
  const allowedRoles = ['CUSTOMER', 'ORGANIZER'];
  const assignedRole = allowedRoles.includes(role) ? role : 'CUSTOMER';

  try {
    // ── Kiểm tra email đã tồn tại chưa ───────────────────────
    const existingRes = await pool.query(
      `SELECT id FROM user_domain.users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (existingRes.rowCount > 0) {
      return res.status(409).json({
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email đã được sử dụng.' },
      });
    }

    // ── Hash password ─────────────────────────────────────────
    // bcrypt tự động tạo salt và nhúng vào hash.
    // BCRYPT_ROUNDS=12 cho mức độ bảo mật phù hợp (khoảng 250ms/hash)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── INSERT user mới ───────────────────────────────────────
    const insertRes = await pool.query(
      `INSERT INTO user_domain.users
         (id, email, password_hash, full_name, phone, role,
          is_active, email_verified, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5,
          TRUE, FALSE, NOW(), NOW())
       RETURNING id, email, full_name, role, created_at`,
      [email, passwordHash, full_name, phone || null, assignedRole]
    );

    const newUser = insertRes.rows[0];
    console.log(`[Auth] Đăng ký thành công: email=${email}, role=${assignedRole}`);

    // ── Phát hành JWT ngay sau khi đăng ký ────────────────────
    const token = signToken(newUser);

    return res.status(201).json({
      message: 'Đăng ký thành công.',
      data: {
        user: {
          id:         newUser.id,
          email:      newUser.email,
          full_name:  newUser.full_name,
          role:       newUser.role,
          created_at: newUser.created_at,
        },
        token,
        expires_in: JWT_EXPIRES_IN,
      },
    });

  } catch (err) {
    console.error('[Auth] Lỗi đăng ký:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể đăng ký, vui lòng thử lại.' },
    });
  }
}

// ============================================================
// POST /api/v1/auth/login  – FR-02: Đăng nhập
// ============================================================

/**
 * Đăng nhập và nhận JWT Token.
 *
 * - Verify email tồn tại và account đang active.
 * - So sánh password với hash bằng bcrypt.compare().
 * - Phát hành JWT chứa id, email, role.
 *
 * @route  POST /api/v1/auth/login
 * @access Public
 */
async function login(req, res) {
  const { email, password } = req.body;

  try {
    // ── Tìm user theo email ───────────────────────────────────
    const userRes = await pool.query(
      `SELECT id, email, password_hash, full_name, role, is_active
         FROM user_domain.users
        WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (userRes.rowCount === 0) {
      // Không tiết lộ "email không tồn tại" để tránh user enumeration attack.
      // Luôn trả về thông báo chung.
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
      });
    }

    const user = userRes.rows[0];

    // ── Kiểm tra account có đang active không ─────────────────
    if (!user.is_active) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_DISABLED', message: 'Tài khoản đã bị vô hiệu hóa.' },
      });
    }

    // ── So sánh password với hash ─────────────────────────────
    // bcrypt.compare() an toàn với timing attack.
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
      });
    }

    // ── Phát hành JWT ─────────────────────────────────────────
    const token = signToken(user);

    console.log(`[Auth] Đăng nhập thành công: email=${email}, role=${user.role}`);

    return res.status(200).json({
      message: 'Đăng nhập thành công.',
      data: {
        user: {
          id:        user.id,
          email:     user.email,
          full_name: user.full_name,
          role:      user.role,
        },
        token,
        expires_in: JWT_EXPIRES_IN,
      },
    });

  } catch (err) {
    console.error('[Auth] Lỗi đăng nhập:', err.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể đăng nhập, vui lòng thử lại.' },
    });
  }
}

// ============================================================
// GET /api/v1/auth/me  – Lấy thông tin user hiện tại
// ============================================================

/**
 * Trả về thông tin profile của user đang đăng nhập.
 * req.user đã được inject bởi authenticate middleware.
 *
 * @route  GET /api/v1/auth/me
 * @access Authenticated
 */
async function getMe(req, res) {
  try {
    const userRes = await pool.query(
      `SELECT id, email, full_name, phone, avatar_url, role, is_active,
              email_verified, created_at, updated_at
         FROM user_domain.users
        WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User không tồn tại.' } });
    }

    return res.status(200).json({ data: userRes.rows[0] });

  } catch (err) {
    console.error('[Auth] Lỗi getMe:', err.message);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi server.' } });
  }
}

module.exports = { register, login, getMe };
