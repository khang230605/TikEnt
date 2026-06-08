'use strict';

const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment-timezone');
const { handlePaymentSuccess, handlePaymentFailed } = require('./webhook.controller');
const { pool } = require('../../config/database');

function sortObject(obj) {
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
}

exports.createVnpayUrl = async (req, res) => {
  try {
    const { booking_code, amount, bank_code, quantity } = req.body;
    const safeQty = quantity || 1;

    let date = new Date();
    let createDate = moment(date).tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss');
    let expireDate = moment(date).tz('Asia/Ho_Chi_Minh').add(15, 'minutes').format('YYYYMMDDHHmmss');

    let ipAddr = req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

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

    return res.status(200).json({ url: vnpUrl });
  } catch (error) {
    console.error('[VNPAY] Lỗi tạo URL:', error);
    return res.status(500).json({ error: { message: 'Lỗi khởi tạo thanh toán VNPAY' } });
  }
};

exports.vnpayReturn = (req, res) => {
  let vnp_Params = { ...req.query };
  let secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  let secretKey = process.env.VNP_HASHSECRET;
  let signData = qs.stringify(vnp_Params, { encode: false });
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 

  if (secureHash === signed) {
    const code = vnp_Params['vnp_ResponseCode'];
    return res.redirect(`${process.env.VNP_RETURN_URL}?vnp_ResponseCode=${code}&vnp_TxnRef=${vnp_Params['vnp_TxnRef']}`);
  } else {
    return res.redirect(`${process.env.VNP_RETURN_URL}?vnp_ResponseCode=99&vnp_TxnRef=${vnp_Params['vnp_TxnRef']}`);
  }
};

exports.vnpayIpn = async (req, res) => {
  console.log("================================");
  console.log("[RADAR IPN] ĐÃ CÓ REQUEST TỪ VNPAY:", req.query);

  let vnp_Params = { ...req.query };
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

  let paymentStatus = '0';

  if (secureHash === signed) {
    console.log(`[VNPAY IPN] Nhận callback cho GD ${bookingCode}, RspCode: ${rspCode}`);

    try {
      const dbClient = await pool.connect();
      let quantity = 1;
      dbClient.release();

      if (rspCode === '00') {
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
        await handlePaymentFailed({
          bookingCode: bookingCode,
          failureReason: `Lỗi VNPAY RspCode: ${rspCode}`
        });
      }

      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (e) {
      console.error(`[VNPAY IPN] Lỗi xử lý GD ${bookingCode}:`, e.message);
      return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
  } else {
    console.warn(`[VNPAY IPN] Sai chữ ký checksum cho GD ${bookingCode}`);
    return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
  }
};
