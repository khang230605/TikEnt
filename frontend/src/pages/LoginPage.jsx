import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { loginUser } from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await loginUser({ email, password });
      const data = response.data?.data || response.data;
      
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        const fromLocation = location.state?.from || { pathname: '/' };
        navigate(fromLocation.pathname, { replace: true, state: fromLocation.state });
      } else {
        throw new Error('Đăng nhập thất bại. Không nhận được token.');
      }
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      setErrorMsg(error.response?.data?.message || error.response?.data?.error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-tz-beige">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-tz-peach/20 p-4 rounded-full mb-4">
            <Ticket className="text-tz-orange" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-tz-green">Đăng Nhập TickEnt</h1>
          <p className="text-tz-brown text-sm mt-1">Vui lòng đăng nhập để tiếp tục!</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 border border-red-200 text-sm font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="nhapemail@example.com" 
              required
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-tz-green">Mật khẩu</label>
              <a href="#" className="text-xs text-tz-orange hover:underline font-medium">Quên mật khẩu?</a>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="••••••••" 
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-tz-green hover:bg-tz-green/90 text-white font-bold py-3 rounded-lg transition-colors shadow-md mt-2 disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? <span className="animate-pulse">Đang xử lý...</span> : 'Đăng Nhập'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-tz-brown">
          Chưa có tài khoản? <Link to="/register" className="text-tz-orange font-bold hover:underline">Đăng ký ngay</Link>
        </div>
      </div>
    </div>
  );
}
