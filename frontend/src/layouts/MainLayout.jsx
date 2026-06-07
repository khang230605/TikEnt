import { Outlet, Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-tz-beige text-tz-green">
      {/* Header */}
      <header className="bg-tz-green text-white py-4 px-8 flex items-center justify-between shadow-md">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold">
          <Ticket className="text-tz-orange" size={32} />
          <span>TickEnt</span>
        </Link>
        <nav className="flex gap-6 items-center font-medium">
          <Link to="/" className="hover:text-tz-orange transition-colors">Sự kiện</Link>
          <Link to="/login" className="bg-tz-orange text-white px-5 py-2 rounded-md hover:bg-opacity-90 transition-all font-semibold">
            Đăng Nhập
          </Link>
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
