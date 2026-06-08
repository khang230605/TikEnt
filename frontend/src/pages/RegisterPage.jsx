import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { registerUser } from '../services/api';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.password !== formData.confirm_password) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });
      
      // Đăng ký thành công, chuyển về login
      navigate('/login', { replace: true, state: { message: 'Đăng ký thành công. Vui lòng đăng nhập!' } });
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      setErrorMsg(error.response?.data?.error?.message || error.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-tz-beige py-12">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-tz-peach/20 p-4 rounded-full mb-4">
            <Ticket className="text-tz-orange" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-tz-green">Đăng Ký TickEnt</h1>
          <p className="text-tz-brown text-sm mt-1">Tạo tài khoản để đặt vé ngay!</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 border border-red-200 text-sm font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Họ và Tên</label>
            <input 
              type="text" 
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="Nguyễn Văn A" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Email</label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="nhapemail@example.com" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Số điện thoại</label>
            <input 
              type="tel" 
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="0912345678" 
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Mật khẩu</label>
            <input 
              type="password" 
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="••••••••" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tz-green mb-1">Xác nhận Mật khẩu</label>
            <input 
              type="password" 
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tz-orange focus:border-transparent transition-all" 
              placeholder="••••••••" 
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-tz-green hover:bg-tz-green/90 text-white font-bold py-3 rounded-lg transition-colors shadow-md mt-4 disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? <span className="animate-pulse">Đang xử lý...</span> : 'Đăng Ký'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-tz-brown">
          Đã có tài khoản? <Link to="/login" className="text-tz-orange font-bold hover:underline">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
