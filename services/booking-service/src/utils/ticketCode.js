/**
 * utils/ticketCode.js
 * ============================================================
 * Tiện ích sinh mã vé (ticket_code) duy nhất dùng làm payload
 * QR code / barcode tại cổng soát vé.
 *
 * Format: TKT-<bookingCode>-<index>-<random6>
 * Ví dụ:  TKT-TICK-20241201-A3F9-01-X8K2PQ
 *
 * Tính duy nhất được đảm bảo bởi:
 *  - bookingCode (unique per booking)
 *  - index       (thứ tự vé trong booking)
 *  - random6     (chuỗi ngẫu nhiên 6 ký tự)
 * ============================================================
 */

'use strict';

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Sinh chuỗi ngẫu nhiên n ký tự từ bảng ký tự an toàn.
 * @param {number} length
 * @returns {string}
 */
function randomStr(length = 6) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return result;
}

/**
 * Sinh ticket_code cho vé thứ `index` trong booking `bookingCode`.
 *
 * @param {string} bookingCode - Mã booking (TICK-YYYYMMDD-XXXX)
 * @param {number} index       - Thứ tự vé (1-based)
 * @returns {string}
 */
function generateTicketCode(bookingCode, index) {
  const paddedIndex = String(index).padStart(2, '0');
  return `TKT-${bookingCode}-${paddedIndex}-${randomStr(6)}`;
}

module.exports = { generateTicketCode };
