import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  TrendingUp, 
  History,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Create Entry', icon: FileText, path: '/create-entry' },
    { name: 'Reports', icon: TrendingUp, path: '/reports' },
    { name: 'Inventory', icon: Package, path: '/inventory' },
    { name: 'Ledgers', icon: Users, path: '/ledgers' },
    { name: 'Recent Entries', icon: History, path: '/entries' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ name: 'Admin Panel', icon: ShieldCheck, path: '/admin' });
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="p-6 flex items-center space-x-3">
          <img src="/favicon.svg" alt="Logo" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
              PhotoBill
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
              {user?.companyName || 'Accounting OS'}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center space-x-3 px-4 py-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-50">
        <div className="flex items-center space-x-2">
          <img src="/favicon.svg" alt="Logo" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-indigo-600">PhotoBill</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="fixed inset-0 bg-white z-40 md:hidden pt-16 flex flex-col"
          >
            <nav className="flex-1 px-4 py-4 space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-4 text-slate-700 active:bg-slate-50 rounded-lg"
                >
                  <item.icon className="h-6 w-6 text-slate-400" />
                  <span className="text-lg">{item.name}</span>
                </Link>
              ))}
            </nav>
            <div className="p-6 border-t">
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 text-red-600 font-bold">
                <LogOut className="h-6 w-6" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 overflow-x-hidden min-h-screen">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
        
        {/* Footer */}
        <footer className="py-6 mt-auto border-t border-slate-200 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
          <img src="/favicon.svg" alt="Logo" className="w-8 h-8 mb-2 opacity-60" />
          <p className="text-slate-400 text-sm font-medium">© {new Date().getFullYear()} PhotoBill. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Layout;
