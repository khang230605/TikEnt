import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  
  const rspCode = searchParams.get('vnp_ResponseCode');
  const txnRef = searchParams.get('vnp_TxnRef');

  useEffect(() => {
    // VNPAY return params: vnp_ResponseCode == '00' là thành công
    if (rspCode === '00') {
      setStatus('success');
    } else if (rspCode) {
      setStatus('failed');
    } else {
      setStatus('failed');
    }
  }, [rspCode]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-tz-beige p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-gray-100">
        
        {status === 'processing' && (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin text-tz-orange mb-4" size={64} />
            <h1 className="text-2xl font-bold text-tz-green mb-2">Đang xử lý kết quả...</h1>
            <p className="text-tz-brown">Vui lòng không đóng trình duyệt.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="bg-green-100 p-4 rounded-full mb-6">
              <CheckCircle2 className="text-green-500" size={80} />
            </div>
            <h1 className="text-3xl font-bold text-tz-green mb-2">Thanh Toán Thành Công!</h1>
            <p className="text-tz-brown mb-6">
              Cảm ơn bạn đã mua vé. Mã đơn hàng của bạn là: <br/>
              <span className="font-mono font-bold text-lg text-tz-orange">{txnRef}</span>
            </p>
            <div className="w-full bg-gray-50 p-4 rounded-lg mb-8 text-sm text-gray-600 border border-gray-100">
              Vé điện tử (QR Code) đã được lưu vào tài khoản của bạn và gửi qua email đăng ký.
            </div>
            <Link 
              to="/my-tickets" 
              className="w-full bg-tz-green hover:bg-tz-green/90 text-white font-bold py-4 rounded-xl transition-colors shadow-md block"
            >
              Xem Vé Của Tôi
            </Link>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="bg-red-100 p-4 rounded-full mb-6">
              <XCircle className="text-red-500" size={80} />
            </div>
            <h1 className="text-3xl font-bold text-tz-green mb-2">Thanh Toán Thất Bại</h1>
            <p className="text-tz-brown mb-6">
              Rất tiếc, giao dịch của bạn không thể hoàn tất. 
              <br/>Mã lỗi: <span className="font-mono font-bold">{rspCode || 'Unknown'}</span>
            </p>
            <div className="w-full space-y-3">
              <Link 
                to="/" 
                className="w-full bg-tz-orange hover:bg-opacity-90 text-white font-bold py-4 rounded-xl transition-colors shadow-md block"
              >
                Thử lại đặt vé khác
              </Link>
              <Link 
                to="/my-tickets" 
                className="w-full bg-white hover:bg-gray-50 text-tz-green border border-tz-green font-bold py-4 rounded-xl transition-colors block"
              >
                Kiểm tra đơn hàng PENDING
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
