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
  ShieldCheck,
  User,
  ChevronRight,
  MoreHorizontal,
  Plus
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
    { 
      name: 'Reports', 
      icon: TrendingUp, 
      path: user?.role === 'admin' ? '/admin?tab=reports' : '/reports' 
    },
    ...(user?.role !== 'admin' ? [{ name: 'Inventory', icon: Package, path: '/inventory' }] : []),
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

  // Determine mobile tab bar items (max 5)
  const mobileTabs = [
    { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'History', icon: History, path: '/entries' },
    { name: 'Create', icon: Plus, path: '/create-entry', isFAB: true },
    { name: 'Ledgers', icon: Users, path: '/ledgers' },
    { name: 'More', icon: MoreHorizontal, path: '#more', isMore: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row grid-bg">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/60 sticky top-0 h-screen z-20 overflow-y-auto">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <FileText className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent leading-none">
              PhotoBill
            </h1>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Ledger</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 relative group ${
                  isActive 
                    ? 'text-indigo-600 font-bold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-indigo-50/70 border-l-4 border-indigo-600 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon className={`h-5 w-5 z-10 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span className="z-10 text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100/80 bg-white/40">
          <div className="flex items-center space-x-3 px-3 py-2.5 mb-3 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold uppercase shadow-sm">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{user?.companyName || user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all font-medium text-sm"
          >
            <LogOut className="h-4.5 w-4.5 text-slate-400 group-hover:text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Navigation Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-slate-200/60 px-5 py-3.5 flex items-center justify-between z-40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <FileText className="text-white w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 leading-none">PhotoBill</h1>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{user?.companyName}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {user?.role === 'admin' && (
            <Link to="/admin" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </Link>
          )}
          <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
            {user?.name?.[0] || 'U'}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/60 px-2 py-1 flex items-center justify-around z-40 pb-safe shadow-[0_-10px_30px_rgba(15,23,42,0.03)]">
        {mobileTabs.map((tab, idx) => {
          const isActive = location.pathname === tab.path;

          if (tab.isFAB) {
            return (
              <Link
                key={idx}
                to={tab.path}
                className="relative -top-4 w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </Link>
            );
          }

          return (
            <button
              key={idx}
              onClick={() => {
                if (tab.isMore) {
                  setIsMobileMenuOpen(true);
                } else {
                  navigate(tab.path);
                }
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                isActive && !tab.isMore
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-5.5 h-5.5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile More Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] z-50 md:hidden px-6 pt-5 pb-8 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] max-h-[85vh] overflow-y-auto"
            >
              {/* Drag Handle Indicator */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

              <div className="flex items-center space-x-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-extrabold uppercase shadow-sm">
                  {user?.name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 leading-tight">{user?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.companyName || user?.role}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Navigator</p>
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-700 font-bold' 
                          : 'text-slate-600 active:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className={`h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="text-sm font-semibold">{item.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center space-x-2.5 py-4 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-2xl transition-all active:scale-98"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm">Logout Account</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-14 pb-20 md:pb-0 overflow-x-hidden min-h-screen">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
        
        {/* Footer */}
        <footer className="py-6 mt-auto border-t border-slate-200/50 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm hidden md:flex">
          <p className="text-slate-400 text-xs font-semibold">© {new Date().getFullYear()} PhotoBill. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Layout;

