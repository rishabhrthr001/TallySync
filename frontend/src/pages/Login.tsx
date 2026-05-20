import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-100 rotate-12 group-hover:rotate-0 transition-all duration-500">
            <FileText className="text-indigo-600 w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Firm Access</h1>
          <p className="text-slate-500 mt-2 font-bold tracking-widest text-[10px] uppercase">Secure Accounting Gateway</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Email ID</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    placeholder="email@firm.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between px-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Secret Key</label>
                  <a href="#" className="text-xs font-bold text-indigo-600">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
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
              className="w-full py-5 bg-slate-900 text-white font-black rounded-[2rem] shadow-xl shadow-slate-200 hover:bg-black hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Authenticating...' : 'Unlock Ledger'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              Authorized Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
