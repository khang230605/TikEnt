import { useState, useEffect } from 'react';
import { Search, MapPin, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getEvents } from '../services/api';

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log("Đang gọi API tới:", import.meta.env.VITE_API_URL + '/events');
        const response = await getEvents();
        console.log("Dữ liệu nhận từ API:", response.data);
        
        // Xử lý cơ chế bóc tách dữ liệu linh hoạt
        let eventsData = [];
        if (Array.isArray(response.data)) {
          eventsData = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          eventsData = response.data.data;
        } else if (response.data && Array.isArray(response.data.events)) {
          eventsData = response.data.events;
        } else {
          console.warn("Dữ liệu API không phải là mảng hợp lệ, kiểm tra lại cấu trúc:", response.data);
        }
        
        setEvents(eventsData);
      } catch (error) {
        console.error("Lỗi gọi API cụ thể:", error);
        if (error.name === 'AxiosError' && error.code === 'ERR_NETWORK') {
          console.error("Gợi ý: Lỗi này thường do cấu hình CORS trên server chưa cấp phép cho http://localhost:5173, hoặc API server đang tắt/chưa khởi động xong trên Render.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative bg-tz-green text-white py-24 px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Trải nghiệm những sự kiện đỉnh cao</h1>
          <p className="text-lg md:text-xl mb-10 text-white/80">Khám phá và đặt vé các sự kiện âm nhạc, hội thảo, thể thao dễ dàng hơn bao giờ hết.</p>
          
          {/* Search Bar */}
          <div className="bg-white rounded-lg p-2 flex flex-col md:flex-row gap-2 shadow-lg">
            <div className="flex-1 flex items-center bg-gray-100 rounded-md px-4 py-3">
              <Search className="text-tz-brown mr-2" size={20} />
              <input type="text" placeholder="Tìm tên sự kiện..." className="bg-transparent border-none outline-none w-full text-tz-green placeholder:text-tz-brown/70" />
            </div>
            <div className="flex-1 flex items-center bg-gray-100 rounded-md px-4 py-3 md:border-l md:border-gray-200">
              <MapPin className="text-tz-brown mr-2" size={20} />
              <select className="bg-transparent border-none outline-none w-full text-tz-green cursor-pointer">
                <option value="">Tất cả thành phố</option>
                <option value="hcm">Hồ Chí Minh</option>
                <option value="hn">Hà Nội</option>
              </select>
            </div>
            <button className="bg-tz-orange hover:bg-opacity-90 text-white font-bold py-3 px-8 rounded-md transition-colors">
              Tìm Kiếm
            </button>
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-tz-green border-l-4 border-tz-orange pl-4">Sự Kiện Nổi Bật</h2>
          <a href="#" className="text-tz-brown font-semibold hover:text-tz-orange transition-colors">Xem tất cả &rarr;</a>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-xl font-bold text-tz-orange animate-pulse">
              Đang tải sự kiện...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map(event => (
              <div key={event.id} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col border border-transparent hover:border-tz-peach">
                {/* Hình ảnh */}
                <div className="relative h-56 overflow-hidden rounded-t-xl">
                  <img 
                    src={event.banner_url || 'https://images.unsplash.com/photo-1540039155732-68ee23e15b51?auto=format&fit=crop&q=80&w=800'} 
                    alt={event.title || 'Event Cover'} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                  />
                  {event.category && (
                    <div className="absolute top-3 left-3 bg-tz-orange text-white text-xs font-bold px-2 py-1 rounded shadow-md uppercase">
                      {event.category}
                    </div>
                  )}
                </div>
                
                {/* Nội dung Card */}
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="font-bold text-xl mb-3 text-tz-green line-clamp-2">
                    {event.title}
                  </h3>
                  
                  <div className="flex items-center text-sm text-tz-brown mb-2">
                    <Calendar size={16} className="mr-2 shrink-0 text-tz-orange" />
                    <span className="truncate">
                      {event.start_time ? new Date(event.start_time).toLocaleString('vi-VN') : 'Đang cập nhật'}
                    </span>
                  </div>
                  
                  <div className="flex items-start text-sm text-tz-brown mb-6">
                    <MapPin size={16} className="mr-2 shrink-0 mt-0.5 text-tz-orange" />
                    <span className="line-clamp-2">
                      {event.venue_name}{event.city ? `, ${event.city}` : ''}
                    </span>
                  </div>

                  {/* Nút Xem chi tiết ở góc phải dưới */}
                  <div className="mt-auto flex justify-end">
                    <Link 
                      to={`/event/${event.id}`} 
                      className="bg-tz-orange text-white px-5 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-colors shadow-sm"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            
            {events.length === 0 && (
              <div className="col-span-full text-center py-10 text-tz-brown">
                Không tìm thấy sự kiện nào.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
