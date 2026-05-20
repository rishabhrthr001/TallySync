import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Loader2, Building, Hash } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    gstin: '',
    role: 'client'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Account created successfully!', 'success');
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          login(loginData.token, loginData.user);
          navigate('/dashboard');
        }
      } else {
        setError(data.error || 'Signup failed');
        showToast(data.error || 'Signup failed', 'error');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200 rotate-3">
            <FileText className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Onboard your Firm</h1>
          <p className="text-slate-500 mt-2 font-medium">Join PhotoBill and automate your ledger sync</p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Firm / Company Name</label>
              <div className="relative">
                <Building className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                  placeholder="Acme Solutions Pvt Ltd"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">GST Number</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                    placeholder="22AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Initializing...' : 'Create Firm Profile'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 font-bold">
              Existing firm?{' '}
              <Link to="/login" className="text-indigo-600 hover:underline underline-offset-4">Access Ledger</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
