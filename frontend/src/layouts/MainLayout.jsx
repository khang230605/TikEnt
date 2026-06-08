import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Ticket, User, LogOut, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function MainLayout() {
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  // Kiểm tra đăng nhập mỗi khi render
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
    window.location.reload(); // Force reload to clear state cleanly
  };

  return (
    <div className="min-h-screen flex flex-col bg-tz-beige text-tz-green">
      {/* Header */}
      <header className="bg-tz-green text-white py-4 px-8 flex items-center justify-between shadow-md relative z-50">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold">
          <Ticket className="text-tz-orange" size={32} />
          <span>TickEnt</span>
        </Link>
        <nav className="flex gap-6 items-center font-medium relative">
          <Link to="/" className="hover:text-tz-orange transition-colors">Sự kiện</Link>
          
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-all border border-white/20"
              >
                <div className="bg-tz-orange rounded-full p-1">
                  <User size={16} className="text-white" />
                </div>
                <span>{user.full_name || 'Tài khoản'}</span>
                <ChevronDown size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-xl py-2 text-tz-brown border border-gray-100 animate-fade-in origin-top-right">
                  <Link 
                    to="/my-tickets" 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-tz-beige hover:text-tz-green transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <Ticket size={18} />
                    <span className="font-medium">Vé của tôi</span>
                  </Link>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="font-medium">Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="bg-tz-orange text-white px-5 py-2 rounded-md hover:bg-opacity-90 transition-all font-semibold shadow-md">
              Đăng Nhập
            </Link>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-tz-green text-white/80 py-8 text-center mt-12">
        <p>&copy; 2026 TickEnt. All rights reserved.</p>
      </footer>
    </div>
  );
}
