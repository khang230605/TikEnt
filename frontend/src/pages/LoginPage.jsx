import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-tz-peach/20 p-4 rounded-full mb-4">
            <Ticket className="text-tz-orange" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-tz-green">Đăng Nhập TickEnt</h1>
          <p className="text-tz-brown text-sm mt-1">Chào mừng bạn quay lại!</p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Email</label>
            <input 
              type="email" 
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="nhapemail@example.com" 
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-tz-green">Mật khẩu</label>
              <a href="#" className="text-xs text-tz-orange hover:underline font-medium">Quên mật khẩu?</a>
            </div>
            <input 
              type="password" 
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="••••••••" 
            />
          </div>

          <button className="w-full bg-tz-green hover:bg-tz-green/90 text-white font-bold py-3 rounded-lg transition-colors shadow-md mt-2">
            Đăng Nhập
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-tz-brown">
          Chưa có tài khoản? <a href="#" className="text-tz-orange font-bold hover:underline">Đăng ký ngay</a>
        </div>
      </div>
    </div>
  );
}
