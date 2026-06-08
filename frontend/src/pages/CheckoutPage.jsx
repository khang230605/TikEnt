import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ticket, User, Mail, Phone } from 'lucide-react';
import { createBooking } from '../services/api';

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  const [userInfo, setUserInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. CHỐT CHẶN BẢO VỆ: Kiểm tra đăng nhập và state hợp lệ
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      alert('Vui lòng đăng nhập để tiếp tục đặt vé.');
      // Pass the current location context so login can redirect back with the cart
      navigate('/login', { state: { from: location } });
      return;
    }

    setUserInfo(JSON.parse(userStr));

    if (!state || !state.eventId || !state.selectedTickets) {
      navigate('/');
    }
  }, [state, navigate, location]);

  if (!state || !userInfo) return null;

  const { eventId, selectedTickets, event, totalAmount, totalQty } = state;
  const selectedTiers = event?.ticket_tiers?.filter(tier => selectedTickets[tier.id] > 0) || [];

  const handleCheckout = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    
    // Gom dữ liệu gửi lên API Backend
    const ticketsPayload = selectedTiers.map(tier => ({
      ticket_tier_id: tier.id,
      quantity: selectedTickets[tier.id]
    }));

    // Payload chuẩn hóa yêu cầu Backend: user_id, event_id, tickets
    const payload = {
      user_id: userInfo.id,
      event_id: eventId,
      tickets: ticketsPayload,
      total_amount: totalAmount
    };

    try {
      await createBooking(payload);
      alert('🎉 Đặt vé thành công! Ghế của bạn đang được giữ trong 10 phút.');
      navigate('/');
    } catch (error) {
      console.error('Lỗi đặt vé:', error);
      setErrorMsg(error.response?.data?.message || error.response?.data?.error?.message || 'Có lỗi xảy ra khi đặt vé hoặc đã hết vé. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-tz-beige min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Thông tin người đặt vé (Text tĩnh) */}
        <div className="w-full md:w-3/5">
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-tz-green mb-6 border-l-4 border-tz-orange pl-3">Thông Tin Người Đặt</h2>
            
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-tz-green">
                  <div className="bg-white p-2 rounded-lg border border-gray-200"><User size={20} className="text-tz-orange" /></div>
                  <div>
                    <div className="text-sm text-tz-brown font-medium">Người đặt</div>
                    <div className="font-bold text-lg">{userInfo.full_name || 'Khách Hàng'}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-tz-green">
                  <div className="bg-white p-2 rounded-lg border border-gray-200"><Mail size={20} className="text-tz-orange" /></div>
                  <div>
                    <div className="text-sm text-tz-brown font-medium">Email liên hệ</div>
                    <div className="font-bold">{userInfo.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-tz-green">
                  <div className="bg-white p-2 rounded-lg border border-gray-200"><Phone size={20} className="text-tz-orange" /></div>
                  <div>
                    <div className="text-sm text-tz-brown font-medium">Số điện thoại</div>
                    <div className="font-bold">{userInfo.phone || 'Chưa cập nhật'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-tz-brown italic">
                Vé điện tử sẽ được gửi về email và được lưu trực tiếp vào tài khoản của bạn.
              </div>
            </div>

            <form onSubmit={handleCheckout}>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-tz-orange text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 hover:shadow-lg transition-all shadow-md text-lg flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : (
                  <>Xác nhận đặt vé <Ticket size={20} /></>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Tóm tắt đơn hàng (40%) */}
        <div className="w-full md:w-2/5">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6 border-t-4 border-tz-orange">
            <h2 className="text-xl font-bold text-tz-green mb-6 border-b border-gray-100 pb-4">Tóm Tắt Đơn Hàng</h2>
            
            <div className="mb-6">
              <h3 className="font-bold text-tz-green text-lg mb-2">{event?.title}</h3>
              <p className="text-sm text-tz-brown">
                {event?.start_time ? new Date(event.start_time).toLocaleString('vi-VN') : ''}
              </p>
              <p className="text-sm text-tz-brown">
                {event?.venue_name}{event?.city ? `, ${event.city}` : ''}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {selectedTiers.map(tier => (
                <div key={tier.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div>
                    <span className="font-bold text-tz-green">{tier.name}</span>
                    <span className="text-tz-brown ml-2 text-sm">x {selectedTickets[tier.id]}</span>
                  </div>
                  <div className="font-medium text-tz-brown">
                    {(Number(tier.price) * selectedTickets[tier.id]).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-tz-beige p-4 rounded-xl flex justify-between items-center">
              <span className="font-bold text-tz-brown">Tổng cộng ({totalQty} vé)</span>
              <span className="text-2xl font-bold text-tz-green">
                {totalAmount?.toLocaleString('vi-VN')} đ
              </span>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
