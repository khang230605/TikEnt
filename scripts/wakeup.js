const CORE_SERVICES = [
  { name: 'Payment Service', url: 'https://tikent-user-payment-service.onrender.com/health' },
  { name: 'Event Service', url: 'https://tikent-event-service.onrender.com/health' },
  { name: 'Booking Service', url: 'https://tikent.onrender.com/health' },
];

const GATEWAY_SERVICE = { name: 'API Gateway', url: 'https://tikent-api-gateway.onrender.com/health' };

async function pingService(service) {
  const start = Date.now();
  console.log(`[⏳] Đang đánh thức ${service.name}...`);
  try {
    const res = await fetch(service.url);
    const ms = Date.now() - start;
    if (res.ok) {
      console.log(`[✅] ${service.name} đã thức dậy thành công! (${ms}ms)`);
      return true;
    } else {
      console.log(`[⚠️] ${service.name} phản hồi HTTP ${res.status} (${ms}ms)`);
      return false;
    }
  } catch (error) {
    const ms = Date.now() - start;
    console.error(`[❌] ${service.name} không thể kết nối: ${error.message} (${ms}ms)`);
    return false;
  }
}

async function wakeup() {
  console.log('\n=========================================');
  console.log('🚀 BẮT ĐẦU QUÁ TRÌNH ĐÁNH THỨC HỆ THỐNG');
  console.log('=========================================\n');

  console.log('▶ PHASE 1: Đánh thức các Core Services (Đồng thời)...\n');
  
  const phase1Promises = CORE_SERVICES.map(service => pingService(service));
  await Promise.all(phase1Promises);
  
  console.log('\n▶ PHASE 2: Đánh thức API Gateway...\n');
  const gatewayAwake = await pingService(GATEWAY_SERVICE);

  console.log('\n=========================================');
  if (gatewayAwake) {
    console.log('🎉 TẤT CẢ CÁC SERVICES ĐÃ SẴN SÀNG ĐỂ DEMO!');
  } else {
    console.log('⚠️ QUÁ TRÌNH ĐÁNH THỨC HOÀN TẤT, NHƯNG GATEWAY CÓ LỖI.');
  }
  console.log('=========================================\n');
}

wakeup();
