import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center max-w-md w-full">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Invalid Reset Link</h2>
          <p className="text-slate-400 text-sm font-semibold mb-6">This password reset link is missing required parameters. Please request a new one.</p>
          <Link to="/login" className="text-indigo-600 font-bold hover:underline underline-offset-4 text-sm">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full top-1/4 left-1/4 -z-10" />
      <div className="absolute w-[350px] h-[350px] bg-violet-500/5 blur-[100px] rounded-full bottom-1/4 right-1/4 -z-10" />

      <div className="max-w-md w-full relative">
        <Link to="/login" className="absolute -top-12 left-4 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
          ← Back to Login
        </Link>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20 rotate-6 hover:rotate-0 transition-transform duration-300">
            <FileText className="text-white w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Set New Password</h1>
          <p className="text-slate-400 mt-1.5 font-bold tracking-widest text-[9px] uppercase">PhotoBill · Password Reset</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 shadow-[0_20px_50px_-20px_rgba(79,70,229,0.08)]">
          {success ? (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Password Reset!</h3>
                <p className="text-slate-400 text-sm font-semibold mt-1">Your password has been updated successfully. Redirecting you to login...</p>
              </div>
              <Link to="/login" className="inline-block px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl text-sm hover:bg-indigo-700 transition-colors">
                Go to Login →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs font-bold text-indigo-700 flex gap-2 items-center">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Resetting password for <span className="font-mono">{email}</span></span>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700 text-xs font-bold leading-relaxed">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Min. 6 characters"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(p => !p)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Repeat your new password"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowConfirm(p => !p)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-950 text-white font-black rounded-2xl shadow-lg shadow-slate-900/10 hover:bg-indigo-600 hover:shadow-indigo-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5 uppercase tracking-wider text-[10px]"
              >
                {loading ? (
                  <><Loader2 className="w-4.5 h-4.5 animate-spin" /><span>Resetting...</span></>
                ) : (
                  <><span>Reset Password</span><ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
