import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Ticket } from 'lucide-react';

export default function BookingPage() {
  const { eventId } = useParams();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8 text-tz-green">
        <Ticket className="text-tz-orange" size={32} />
        <h1 className="text-3xl font-bold">Thanh Toán Đơn Hàng</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Form Checkout */}
        <div className="flex-1 bg-white p-6 md:p-8 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-6 border-b pb-2">Thông Tin Người Mua</h2>
          
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-tz-green mb-1">Họ và tên *</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent" placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-tz-green mb-1">Số điện thoại *</label>
                <input type="tel" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent" placeholder="0901234567" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-tz-green mb-1">Email *</label>
              <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent" placeholder="email@example.com" />
              <p className="text-xs text-tz-brown mt-1">Vé điện tử (QR code) sẽ được gửi về email này.</p>
            </div>
            
            <h2 className="text-xl font-bold mt-8 mb-6 border-b pb-2">Phương Thức Thanh Toán</h2>
            <div className="space-y-3">
              <label className="flex items-center p-4 border border-tz-peach rounded-md bg-tz-peach/5 cursor-pointer">
                <input type="radio" name="payment" className="text-tz-orange focus:ring-tz-orange w-4 h-4" defaultChecked />
                <span className="ml-3 font-medium">Thẻ tín dụng / Ghi nợ (Visa, Master, JCB)</span>
              </label>
              <label className="flex items-center p-4 border border-gray-200 rounded-md cursor-pointer hover:border-tz-peach transition-colors">
                <input type="radio" name="payment" className="text-tz-orange focus:ring-tz-orange w-4 h-4" />
                <span className="ml-3 font-medium">Thanh toán qua Momo</span>
              </label>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="w-full md:w-80 shrink-0">
          <div className="bg-white p-6 rounded-xl shadow-md sticky top-6">
            <h2 className="text-lg font-bold mb-4">Tóm Tắt Đơn Hàng</h2>
            
            <div className="mb-4 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-tz-green mb-1">Đêm Nhạc Hội Mùa Hè 2026</h3>
              <p className="text-sm text-tz-brown">15/07/2026 | SVĐ Quân Khu 7</p>
            </div>

            <div className="space-y-2 mb-4 pb-4 border-b border-gray-100 text-sm">
              <div className="flex justify-between">
                <span>Hạng vé: <span className="font-bold">VVIP</span></span>
                <span>2.500.000đ</span>
              </div>
              <div className="flex justify-between">
                <span>Số lượng:</span>
                <span>x 2</span>
              </div>
              <div className="flex justify-between text-tz-brown">
                <span>Phí dịch vụ:</span>
                <span>20.000đ</span>
              </div>
            </div>

            <div className="flex justify-between items-center font-bold text-lg mb-6">
              <span>Tổng cộng:</span>
              <span className="text-tz-orange">5.020.000đ</span>
            </div>

            <button className="w-full bg-tz-green hover:bg-opacity-90 text-white font-bold py-3 rounded-md transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 size={20} />
              Xác Nhận Thanh Toán
            </button>
            <p className="text-center text-xs text-tz-brown mt-4">
              Bằng việc bấm xác nhận, bạn đồng ý với các điều khoản mua vé của TickEnt.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
