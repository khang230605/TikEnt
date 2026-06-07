import { Search, MapPin, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const MOCK_EVENTS = [
  { id: 1, name: 'Đêm Nhạc Hội Mùa Hè 2026', time: '20:00 - 15/07/2026', price: 'Từ 500.000đ', location: 'Hồ Chí Minh', image: 'https://images.unsplash.com/photo-1540039155732-68ee23e15b51?auto=format&fit=crop&q=80&w=800' },
  { id: 2, name: 'Triển Lãm Nghệ Thuật Đương Đại', time: '09:00 - 20/07/2026', price: 'Từ 200.000đ', location: 'Hà Nội', image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&q=80&w=800' },
  { id: 3, name: 'Lễ Hội Âm Nhạc EDM', time: '18:00 - 05/08/2026', price: 'Từ 800.000đ', location: 'Đà Nẵng', image: 'https://images.unsplash.com/photo-1470229722913-7c090be5f524?auto=format&fit=crop&q=80&w=800' },
  { id: 4, name: 'Hài Kịch: Chuyện Xóm Tui', time: '20:00 - 10/08/2026', price: 'Từ 300.000đ', location: 'Hồ Chí Minh', image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&q=80&w=800' },
];

export default function HomePage() {
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_EVENTS.map(event => (
            <Link to={`/event/${event.id}`} key={event.id} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-transparent hover:border-tz-peach block">
              <div className="relative h-48 overflow-hidden">
                <img src={event.image} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 left-3 bg-tz-orange text-white text-xs font-bold px-2 py-1 rounded shadow-md uppercase">Hot</div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2 text-tz-green line-clamp-2 group-hover:text-tz-orange transition-colors">{event.name}</h3>
                <div className="flex items-center text-sm text-tz-brown mb-2">
                  <Calendar size={16} className="mr-2" />
                  {event.time}
                </div>
                <div className="flex items-center text-sm text-tz-brown mb-4">
                  <MapPin size={16} className="mr-2" />
                  {event.location}
                </div>
                <div className="font-bold text-tz-orange text-lg">
                  {event.price}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
