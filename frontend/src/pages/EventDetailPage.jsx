import { useState, useEffect, useMemo } from 'react';
import { Calendar, MapPin, Share2, Heart, Clock, Minus, Plus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEventById } from '../services/api';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State quản lý số lượng vé được chọn: { [ticket_tier_id]: quantity }
  const [selectedTickets, setSelectedTickets] = useState({});

  useEffect(() => {
    const fetchEventDetail = async () => {
      try {
        setLoading(true);
        const response = await getEventById(id);
        const eventData = response.data?.data || response.data?.event || response.data;
        setEvent(eventData);
      } catch (error) {
        console.error("Lỗi khi tải chi tiết sự kiện:", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchEventDetail();
  }, [id]);

  // Xử lý tăng giảm số lượng vé
  const handleQuantityChange = (tierId, delta) => {
    setSelectedTickets(prev => {
      const currentQty = prev[tierId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return {
        ...prev,
        [tierId]: newQty
      };
    });
  };

  // Tính tổng số tiền và tổng số vé
  const { totalAmount, totalQty } = useMemo(() => {
    let amount = 0;
    let qty = 0;
    if (event?.ticket_tiers) {
      event.ticket_tiers.forEach(tier => {
        const selectedQty = selectedTickets[tier.id] || 0;
        amount += selectedQty * Number(tier.price);
        qty += selectedQty;
      });
    }
    return { totalAmount: amount, totalQty: qty };
  }, [selectedTickets, event]);

  const handleCheckout = () => {
    if (totalQty > 0) {
      // Chuyển hướng sang trang checkout và truyền dữ liệu giỏ vé
      navigate(`/checkout`, { state: { eventId: id, selectedTickets, event, totalAmount, totalQty } });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tz-beige">
        <div className="text-xl font-bold text-tz-orange animate-pulse">Đang tải chi tiết sự kiện...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tz-beige">
        <div className="text-xl font-bold text-tz-brown">Sự kiện không tồn tại hoặc đã bị xóa.</div>
      </div>
    );
  }

  return (
    <div className="pb-32 lg:pb-20 bg-tz-beige min-h-screen">
      {/* Hero Banner */}
      <div className="w-full h-96 relative">
        <img 
          src={event.banner_url || "https://images.unsplash.com/photo-1540039155732-68ee23e15b51?auto=format&fit=crop&q=80&w=2000"} 
          alt={event.title || "Event Cover"} 
          className="w-full h-full object-cover"
        />
        {/* Overlay màu tz-green trong suốt nhẹ */}
        <div className="absolute inset-0 bg-tz-green/50"></div>
        
        {/* Thông tin nổi bật trên Banner */}
        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-8 flex flex-col justify-end pb-12 z-10 text-white">
          <div className="flex justify-between items-end">
            <div>
              <div className="mb-4 inline-block bg-tz-orange text-white text-sm font-bold px-3 py-1 rounded shadow-md uppercase tracking-wider">
                {event.category || 'Event'}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">{event.title}</h1>
              <div className="flex flex-wrap gap-6 text-white/95 drop-shadow-md">
                <div className="flex items-center gap-2">
                  <Calendar size={20} />
                  <span className="font-medium">{event.start_time ? new Date(event.start_time).toLocaleString('vi-VN') : 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={20} />
                  <span className="font-medium">{event.venue_name}{event.city ? `, ${event.city}` : ''}</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex gap-3">
              <button className="p-3 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors shadow-lg"><Share2 size={24} /></button>
              <button className="p-3 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors text-tz-peach shadow-lg"><Heart size={24} fill="currentColor" /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 flex flex-col lg:flex-row gap-8 relative">
        
        {/* Cột Trái: Nội dung chi tiết (70%) */}
        <div className="w-full lg:w-[70%]">
          <div className="bg-white rounded-xl shadow-md p-6 lg:p-8 border border-gray-100">
            <h3 className="text-2xl font-bold border-l-4 border-tz-orange pl-3 text-tz-green mb-6">Giới Thiệu Sự Kiện</h3>
            <div className="prose max-w-none text-tz-brown leading-relaxed whitespace-pre-line text-lg">
              {event.description || 'Chưa có thông tin mô tả chi tiết cho sự kiện này.'}
            </div>
          </div>
        </div>

        {/* Cột Phải: Khu vực chọn vé (30%) */}
        <div className="w-full lg:w-[30%]">
          <div className="bg-white rounded-xl shadow-md p-6 sticky top-6 border-t-4 border-tz-orange">
            <h3 className="text-xl font-bold text-tz-green mb-6 border-b border-gray-100 pb-4">Mua Vé</h3>
            
            <div className="space-y-4 mb-24 lg:mb-6">
              {event.ticket_tiers && event.ticket_tiers.length > 0 ? (
                event.ticket_tiers.map(tier => (
                  <div key={tier.id} className="p-4 rounded-xl border border-gray-200 flex flex-col gap-3 hover:border-tz-orange/50 transition-colors bg-white shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h4 className="font-bold text-tz-green text-lg">{tier.name}</h4>
                        {tier.description && <p className="text-sm text-tz-brown mt-1">{tier.description}</p>}
                      </div>
                      <div className="font-bold text-tz-orange text-lg whitespace-nowrap">
                        {Number(tier.price).toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100">
                      <span className="text-sm text-tz-brown font-medium">Số lượng:</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleQuantityChange(tier.id, -1)}
                          disabled={!selectedTickets[tier.id]}
                          className="p-1.5 rounded-lg border border-gray-300 text-tz-brown hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-bold w-6 text-center text-tz-green text-lg">{selectedTickets[tier.id] || 0}</span>
                        <button 
                          onClick={() => handleQuantityChange(tier.id, 1)}
                          className="p-1.5 rounded-lg border border-gray-300 text-tz-brown hover:bg-gray-100 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-tz-brown py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Sự kiện chưa mở bán vé.
                </div>
              )}
            </div>

            {/* Khối Tổng thanh toán */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] p-4 lg:relative lg:p-0 lg:shadow-none lg:border-none lg:bg-transparent z-20">
              <div className="max-w-7xl mx-auto flex lg:flex-col justify-between items-center lg:items-stretch gap-4">
                <div className="lg:mb-4 lg:bg-tz-beige lg:p-4 lg:rounded-xl">
                  <div className="text-sm text-tz-brown font-medium mb-1">Tổng cộng ({totalQty} vé)</div>
                  <div className="text-2xl font-bold text-tz-orange">
                    {totalAmount.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={totalQty === 0}
                  className="bg-tz-orange text-white font-bold py-3.5 px-8 lg:w-full rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 hover:shadow-lg transition-all shadow-md whitespace-nowrap text-lg"
                >
                  Tiếp tục thanh toán
                </button>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
