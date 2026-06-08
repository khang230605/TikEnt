'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');

const register = async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: { message: 'Thiếu thông tin bắt buộc (email, password, full_name)' } });
  }

  try {
    // Check if user exists
    const checkQuery = 'SELECT id FROM user_domain.users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email đã được sử dụng' } });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const insertQuery = `
      INSERT INTO user_domain.users (email, password_hash, full_name, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name, role, phone;
    `;
    const result = await pool.query(insertQuery, [email, password_hash, full_name, phone]);
    const newUser = result.rows[0];

    return res.status(201).json({
      message: 'Đăng ký thành công',
      user: newUser
    });
  } catch (error) {
    console.error('[Auth Controller] Register error:', error);
    return res.status(500).json({ error: { message: 'Lỗi server' } });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Vui lòng cung cấp email và password' } });
  }

  try {
    // Find user
    const query = 'SELECT id, email, password_hash, full_name, role, phone FROM user_domain.users WHERE email = $1 AND deleted_at IS NULL';
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Email hoặc mật khẩu không chính xác' } });
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: { message: 'Email hoặc mật khẩu không chính xác' } });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    delete user.password_hash; // Don't send hash back

    return res.status(200).json({
      message: 'Đăng nhập thành công',
      token,
      user
    });
  } catch (error) {
    console.error('[Auth Controller] Login error:', error);
    return res.status(500).json({ error: { message: 'Lỗi server' } });
  }
};

module.exports = { register, login };
