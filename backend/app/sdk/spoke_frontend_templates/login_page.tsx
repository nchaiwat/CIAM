'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const { login } = useAuth();

  // Load remembered username from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('irm_remembered_username');
    const savedRememberState = localStorage.getItem('irm_remember_me');

    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (savedRememberState !== null) {
      setRememberMe(savedRememberState === 'true');
    }
  }, []);

  const handleCiamSso = async () => {
    setError(null);
    setSsoLoading(true);
    try {
      const redirectUri = window.location.origin + '/auth/callback';
      const res = await api.post('/api/auth/sso/authorize-url', { redirect_uri: redirectUri });
      if (res.data?.authorize_url) {
        // Store PKCE code_verifier and state in session storage
        sessionStorage.setItem('sso_code_verifier', res.data.code_verifier);
        sessionStorage.setItem('sso_state', res.data.state);
        // Redirect browser to Central IAM Authorize Portal
        window.location.href = res.data.authorize_url;
      } else {
        setError('ไม่สามารถรับ Authorize URL จาก Central IAM ได้');
      }
    } catch (err: any) {
      console.error('SSO Initiation error:', err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'ไม่สามารถเชื่อมต่อไปยัง Central IAM ได้ (ระบบกำลังทำงานในโหมด Break-Glass)';
      setError(detail);
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await api.post('/api/auth/login', { username, password });

      // Save or clear remembered username
      if (rememberMe) {
        localStorage.setItem('irm_remembered_username', username);
        localStorage.setItem('irm_remember_me', 'true');
      } else {
        localStorage.removeItem('irm_remembered_username');
        localStorage.setItem('irm_remember_me', 'false');
      }

      await login(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((d: any) => d.msg).join(', '));
        } else {
          setError(`HTTP Error ${err.response.status}: ${err.response.statusText}`);
        }
      } else if (err.request) {
        setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (Network Error)');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-2xl shadow-lg shadow-sky-500/30">
            IRM
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Incoming Raw Material</h1>
          <p className="text-sm text-slate-400 mt-1">ระบบติดตามการรับวัตถุดิบ ฝ่ายจัดซื้อ</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Action: 1-Click Central IAM SSO Button */}
        <button
          type="button"
          onClick={handleCiamSso}
          disabled={ssoLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
        >
          {ssoLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-cyan-300" />
              <span>เข้าสู่ระบบด้วย Central IAM (SSO)</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 ml-0.5" />
            </>
          )}
        </button>

        {/* Break-Glass / Local Pass Divider */}
        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
            หรือเข้าสู่ระบบสำรอง (Break-Glass Login)
          </span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Fallback Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้ (เช่น admin)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
            </div>
          </div>

          {/* Password Input with Show/Hide Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">รหัสผ่าน (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span>จำฉันไว้ในระบบ (Remember Me)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>เข้าสู่ระบบสำรอง (Sign In)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-[10px] text-slate-500 font-mono">
          ISO 27001 Business Continuity & Break-Glass Ready
        </div>
      </div>
    </div>
  );
}
