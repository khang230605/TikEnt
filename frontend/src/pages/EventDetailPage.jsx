import { Calendar, MapPin, Share2, Heart, Clock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export default function EventDetailPage() {
  const { id } = useParams();

  return (
    <div className="pb-20">
      {/* Cover Image */}
      <div className="w-full h-[40vh] md:h-[50vh] relative">
        <img 
          src="https://images.unsplash.com/photo-1540039155732-68ee23e15b51?auto=format&fit=crop&q=80&w=2000" 
          alt="Event Cover" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-32 relative z-10 flex flex-col lg:flex-row gap-8">
        
        {/* Main Content */}
        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 lg:p-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-tz-green">Đêm Nhạc Hội Mùa Hè 2026 (Event #{id})</h1>
            <div className="flex gap-2 text-tz-brown">
              <button className="p-2 hover:bg-tz-peach/30 rounded-full transition-colors"><Share2 size={24} /></button>
              <button className="p-2 hover:bg-tz-peach/30 rounded-full transition-colors"><Heart size={24} /></button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-6 mb-8 text-tz-green">
            <div className="flex items-center gap-2">
              <Calendar className="text-tz-orange" size={20} />
              <span className="font-medium">15/07/2026</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-tz-orange" size={20} />
              <span className="font-medium">20:00 - 23:00</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="text-tz-orange" size={20} />
              <span className="font-medium">Sân Vận Động Quân Khu 7, TP.HCM</span>
            </div>
          </div>

          <div className="prose max-w-none text-tz-green">
            <h3 className="text-xl font-bold border-b border-gray-200 pb-2 mb-4">Giới Thiệu Sự Kiện</h3>
            <p className="mb-4">
              Đêm nhạc được mong chờ nhất mùa hè 2026 đã chính thức quay trở lại với quy mô hoành tráng hơn bao giờ hết. Cùng dàn lineup siêu khủng, hệ thống âm thanh ánh sáng đạt chuẩn quốc tế, hứa hẹn sẽ mang đến những màn trình diễn bùng nổ và khó quên.
            </p>
            <p>
              Hãy nhanh tay sở hữu những tấm vé để cùng hòa mình vào không khí cuồng nhiệt này!
            </p>
          </div>
        </div>

        {/* Ticket Selection Sidebar */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6 border-t-4 border-tz-orange">
            <h3 className="text-xl font-bold text-tz-green mb-6 border-b border-gray-100 pb-4">Thông Tin Vé</h3>
            
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-lg border-2 border-tz-peach bg-tz-peach/10 flex justify-between items-center cursor-pointer hover:bg-tz-peach/20 transition-colors">
                <div>
                  <h4 className="font-bold text-tz-green">VVIP</h4>
                  <p className="text-sm text-tz-brown">Sát sân khấu + Quà tặng</p>
                </div>
                <div className="font-bold text-tz-orange">2.500.000đ</div>
              </div>

              <div className="p-4 rounded-lg border border-gray-200 flex justify-between items-center cursor-pointer hover:border-tz-orange transition-colors">
                <div>
                  <h4 className="font-bold text-tz-green">VIP</h4>
                  <p className="text-sm text-tz-brown">Khu vực trung tâm</p>
                </div>
                <div className="font-bold text-tz-orange">1.500.000đ</div>
              </div>

              <div className="p-4 rounded-lg border border-gray-200 flex justify-between items-center cursor-pointer hover:border-tz-orange transition-colors">
                <div>
                  <h4 className="font-bold text-tz-green">GA</h4>
                  <p className="text-sm text-tz-brown">Vé đứng tự do</p>
                </div>
                <div className="font-bold text-tz-orange">500.000đ</div>
              </div>
            </div>

            <Link 
              to={`/booking/${id}`} 
              className="block w-full text-center bg-tz-orange hover:bg-opacity-90 text-white font-bold py-4 rounded-lg transition-colors text-lg shadow-md"
            >
              Mua Vé Ngay
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
