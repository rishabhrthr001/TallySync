import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Loader2, Lock, Mail, ChevronRight, ShieldAlert } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Welcome back!', 'success');
        login(data.token, data.user);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 grid-bg relative overflow-hidden">
      {/* Background glow elements */}
      <div className="absolute w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full top-1/4 left-1/4 -z-10" />
      <div className="absolute w-[350px] h-[350px] bg-violet-500/5 blur-[100px] rounded-full bottom-1/4 right-1/4 -z-10" />

      <div className="max-w-md w-full relative">
        {/* Back Link to Landing */}
        <Link 
          to="/" 
          className="absolute -top-12 left-4 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
        >
          ← Return to Home
        </Link>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20 rotate-6 hover:rotate-0 transition-transform duration-300">
            <FileText className="text-white w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Access PhotoBill</h1>
          <p className="text-slate-400 mt-1.5 font-bold tracking-widest text-[9px] uppercase">Secure Accounting Gateway</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 shadow-[0_20px_50px_-20px_rgba(79,70,229,0.08)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700 text-xs font-bold leading-relaxed">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    placeholder="name@firm.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <a href="#" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-950 text-white font-black rounded-2xl shadow-lg shadow-slate-900/10 hover:bg-indigo-600 hover:shadow-indigo-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 uppercase tracking-wider text-[10px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Unlock Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100/80 text-center space-y-3">
            <p className="text-xs text-slate-500 font-bold">
              New to PhotoBill?{' '}
              <Link to="/signup" className="text-indigo-600 hover:underline underline-offset-4">Register Firm</Link>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-400 font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-300" />
              <span>Authorized personnel access only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

