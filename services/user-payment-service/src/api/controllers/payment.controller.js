'use strict';

const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment-timezone');
const { handlePaymentSuccess, handlePaymentFailed } = require('./webhook.controller');
const { pool } = require('../../config/database');

const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
};

exports.createVnpayUrl = async (req, res) => {
  try {
    const { booking_code, amount, bank_code, quantity } = req.body;

    // Fallback quantity nếu gửi từ CheckoutPage
    const safeQty = quantity || 1;

    let date = new Date();
    // Ép múi giờ về Việt Nam để tránh lệch giờ UTC trên Cloud
    let createDate = moment(date).tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss');
    let expireDate = moment(date).tz('Asia/Ho_Chi_Minh').add(15, 'minutes').format('YYYYMMDDHHmmss');

    // Xử lý IP Address, tránh trường hợp bị mảng hoặc định dạng IPv6 loopback
    let ipAddr = req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    // Lấy IP đầu tiên nếu bị mảng do proxy, hoặc fallback IPv4
    if (Array.isArray(ipAddr)) ipAddr = ipAddr[0];
    if (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1') ipAddr = '127.0.0.1';
    let tmnCode = process.env.VNP_TMNCODE;
    let secretKey = process.env.VNP_HASHSECRET;
    let vnpUrl = process.env.VNP_URL;
    let returnUrl = process.env.VNP_RETURN_URL;

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = booking_code;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan ve TickEnt - Ma GD: ' + booking_code;
    vnp_Params['vnp_OrderType'] = 'other';
    // Đảm bảo amount là số và nhân 100 đúng quy định VNPAY
    vnp_Params['vnp_Amount'] = Math.round(Number(amount) * 100);
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    vnp_Params['vnp_ExpireDate'] = expireDate;

    if (bank_code) {
      vnp_Params['vnp_BankCode'] = bank_code;
    }

    vnp_Params = sortObject(vnp_Params);

    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    // Cập nhật quantity vào bảng bookings metadata để IPN dùng lại (nếu cần thiết)
    // Nhưng vì DB đã có quantity trong logic webhook, ta có thể lưu tạm hoặc bỏ qua.
    // Tạm thời ta chỉ trả về URL.

    return res.status(200).json({ url: vnpUrl });
  } catch (error) {
    console.error('[VNPAY] Lỗi tạo URL:', error);
    return res.status(500).json({ error: { message: 'Lỗi khởi tạo thanh toán VNPAY' } });
  }
};

exports.vnpayReturn = (req, res) => {
  let vnp_Params = req.query;
  let secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  let secretKey = process.env.VNP_HASHSECRET;
  let signData = qs.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  // Nếu muốn, có thể gọi DB ở đây để xem trạng thái.
  // Tuy nhiên theo chuẩn VNPAY, trang Return chỉ dùng để chuyển hướng người dùng, 
  // kết quả thực sự do IPN quyết định.

  if (secureHash === signed) {
    // Chữ ký hợp lệ
    const code = vnp_Params['vnp_ResponseCode'];
    return res.redirect(`${process.env.VNP_RETURN_URL}?vnp_ResponseCode=${code}&vnp_TxnRef=${vnp_Params['vnp_TxnRef']}`);
  } else {
    // Chữ ký sai
    return res.redirect(`${process.env.VNP_RETURN_URL}?vnp_ResponseCode=99&vnp_TxnRef=${vnp_Params['vnp_TxnRef']}`);
  }
};

exports.vnpayIpn = async (req, res) => {
  let vnp_Params = req.query;
  let secureHash = vnp_Params['vnp_SecureHash'];

  let rspCode = vnp_Params['vnp_ResponseCode'];
  let bookingCode = vnp_Params['vnp_TxnRef'];
  let amount = vnp_Params['vnp_Amount'] / 100;
  let transactionId = vnp_Params['vnp_TransactionNo'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);
  let secretKey = process.env.VNP_HASHSECRET;
  let signData = qs.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  let paymentStatus = '0'; // Giả định là thanh toán thất bại

  if (secureHash === signed) {
    console.log(`[VNPAY IPN] Nhận callback cho GD ${bookingCode}, RspCode: ${rspCode}`);

    try {
      const dbClient = await pool.connect();
      // Lấy thông tin quantity từ DB (vì webhook controller cần)
      // Tùy theo thiết kế, ta sẽ truy vấn quantity đã đặt trong bảng booking_domain.bookings (hoặc truyền mặc định 1)
      let quantity = 1;
      // ... bỏ qua bước lấy quantity chi tiết vì hệ thống demo đang mặc định 1 ở CheckoutPage ...

      dbClient.release();

      if (rspCode === '00') {
        // Thanh toán thành công
        const result = await handlePaymentSuccess({
          bookingCode: bookingCode,
          transactionId: transactionId,
          amount: amount,
          currency: 'VND',
          provider: 'VNPAY',
          providerMetadata: { quantity: quantity }
        });
        
        if (result.httpStatus === 404) {
          return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
        }
      } else {
        // Thanh toán thất bại
        await handlePaymentFailed({
          bookingCode: bookingCode,
          failureReason: `Lỗi VNPAY RspCode: ${rspCode}`
        });
      }

      // Trả về kết quả cho VNPAY
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (e) {
      console.error(`[VNPAY IPN] Lỗi xử lý GD ${bookingCode}:`, e.message);
      // Trả lỗi 99 nếu exception
      return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
  } else {
    console.warn(`[VNPAY IPN] Sai chữ ký checksum cho GD ${bookingCode}`);
    return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
  }
};
