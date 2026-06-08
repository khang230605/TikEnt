import { useState, useEffect } from 'react';
import { getMyTickets } from '../services/api';
import { Ticket, Calendar, MapPin, QrCode } from 'lucide-react';

export default function MyTicketsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await getMyTickets();
        setBookings(response.data?.data || []);
      } catch (error) {
        console.error('Lỗi lấy danh sách vé:', error);
        setErrorMsg('Không thể tải danh sách vé. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-tz-beige flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 border-4 border-tz-orange border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-tz-brown font-medium">Đang tải danh sách vé...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-[60vh] bg-tz-beige flex flex-col items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md border border-gray-100">
          <p className="text-red-500 font-medium mb-4">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-tz-green text-white px-6 py-2 rounded-lg font-bold"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tz-beige py-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-tz-peach/30 p-3 rounded-full">
            <Ticket className="text-tz-orange" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-tz-green">Vé của tôi</h1>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <Ticket className="mx-auto text-gray-300 mb-4" size={64} />
            <h2 className="text-xl font-bold text-gray-700 mb-2">Bạn chưa có vé nào</h2>
            <p className="text-gray-500 mb-6">Hãy khám phá các sự kiện hấp dẫn và đặt vé ngay nhé!</p>
            <a href="/" className="inline-block bg-tz-orange hover:bg-tz-orange/90 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-md">
              Khám phá Sự kiện
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <div key={booking.booking_id} className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col md:flex-row border border-gray-100 hover:shadow-lg transition-shadow">
                
                {/* Cột trái: Hình ảnh */}
                <div className="md:w-1/3 h-48 md:h-auto relative">
                  <img 
                    src={booking.banner_url || 'https://images.unsplash.com/photo-1540039155732-68c3cb0f1522?auto=format&fit=crop&q=80&w=1000'} 
                    alt={booking.event_title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                      booking.booking_status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      booking.booking_status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {booking.booking_status}
                    </span>
                  </div>
                </div>

                {/* Cột giữa: Thông tin */}
                <div className="p-6 md:w-1/2 flex flex-col justify-center border-r border-gray-100 border-dashed">
                  <h3 className="text-xl font-bold text-tz-green mb-3">{booking.event_title}</h3>
                  <div className="space-y-2 text-sm text-tz-brown">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-tz-orange" />
                      <span>{new Date(booking.start_time).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-tz-orange" />
                      <span>{booking.venue_name}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-500 mb-2">Chi tiết vé:</p>
                    <div className="space-y-1">
                      {booking.tickets && booking.tickets[0]?.ticket_id ? (
                        booking.tickets.map((t, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                            <span className="font-medium text-tz-green">{t.tier_name}</span>
                            <span className="text-gray-500 font-mono text-xs">{t.ticket_code}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm bg-yellow-50 text-yellow-600 p-2 rounded italic">
                          Hệ thống đang xử lý xuất vé. Vui lòng chờ trong giây lát...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cột phải: QR Code giả lập */}
                <div className="p-6 md:w-1/4 bg-gray-50 flex flex-col items-center justify-center">
                  <div className="bg-white p-3 rounded-xl shadow-sm mb-3">
                    <QrCode size={80} className="text-tz-green" />
                  </div>
                  <p className="text-xs text-center text-gray-500 font-mono mb-2">
                    {booking.booking_code}
                  </p>
                  <button className="text-sm text-tz-orange font-bold hover:underline">
                    Tải vé PDF
                  </button>
                </div>
                
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
