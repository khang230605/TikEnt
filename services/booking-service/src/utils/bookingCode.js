/**
 * utils/bookingCode.js
 * ============================================================
 * Tiện ích sinh mã đặt vé (booking_code) theo định dạng:
 *   TICK-YYYYMMDD-XXXX
 *   Ví dụ: TICK-20241201-A3F9
 *
 * - YYYYMMDD : ngày tạo đơn (UTC)
 * - XXXX     : 4 ký tự ngẫu nhiên từ bảng chữ cái A-Z + số 0-9
 *              (tránh ký tự dễ nhầm: O, 0, I, 1)
 * ============================================================
 */

'use strict';

// Bảng ký tự an toàn – loại bỏ O/0 và I/1 để tránh nhầm lẫn khi đọc
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Sinh một chuỗi ngẫu nhiên gồm n ký tự từ SAFE_CHARS.
 *
 * @param {number} length - Số ký tự cần sinh
 * @returns {string}
 */
function randomSuffix(length = 4) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * SAFE_CHARS.length);
    result += SAFE_CHARS[index];
  }
  return result;
}

/**
 * Sinh mã booking_code theo định dạng TICK-YYYYMMDD-XXXX.
 *
 * @returns {string} Ví dụ: "TICK-20241201-A3F9"
 */
function generateBookingCode() {
  const now = new Date();

  // Lấy thành phần ngày theo UTC
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day   = String(now.getUTCDate()).padStart(2, '0');

  const datePart   = `${year}${month}${day}`;   // YYYYMMDD
  const randomPart = randomSuffix(4);            // XXXX

  return `TICK-${datePart}-${randomPart}`;
}

module.exports = { generateBookingCode };
