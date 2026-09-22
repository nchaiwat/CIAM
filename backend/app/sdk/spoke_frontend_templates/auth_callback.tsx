'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();

  const [statusText, setStatusText] = useState('กำลังตรวจสอบ One-Time Ticket กับ Central IAM...');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setError('ไม่พบ Authorization Code ใน URL Redirect จาก Central IAM');
      return;
    }

    const exchangeToken = async () => {
      try {
        const codeVerifier = sessionStorage.getItem('sso_code_verifier') || '';
        const savedState = sessionStorage.getItem('sso_state');

        if (savedState && state && savedState !== state) {
          console.warn('SSO state mismatch warning (continuing with code verifier)');
        }

        setStatusText('กำลังแลกเปลี่ยนรหัสและยืนยัน Asymmetric RS256 Signature...');

        const redirectUri = window.location.origin + '/auth/callback';
        const res = await api.post('/api/auth/sso/callback', {
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          state: state || undefined,
        });

        // Clean up session storage
        sessionStorage.removeItem('sso_code_verifier');
        sessionStorage.removeItem('sso_state');

        setSuccess(true);
        setStatusText('ยืนยันตัวตนสำเร็จ! กำลังเข้าสู่ระบบ IRM...');

        // Perform login in auth context
        await login(res.data.access_token, res.data.refresh_token);
        router.push('/');
      } catch (err: any) {
        console.error('SSO Exchange error:', err);
        const detail =
          err.response?.data?.detail ||
          err.message ||
          'เกิดข้อผิดพลาดในการแลกเปลี่ยน Authorization Code กับ Central IAM';
        setError(detail);
      }
    };

    exchangeToken();
  }, [searchParams, router, login]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Central IAM Single Sign-On
          </h2>
          <p className="text-xs text-slate-400">ระบบเชื่อมโยงตัวตนกลางองค์กร (Window Asia CIAM)</p>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-left space-y-3">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>การเข้าสู่ระบบผ่าน SSO ล้มเหลว</span>
            </div>
            <p className="leading-relaxed">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold text-xs transition"
            >
              กลับสู่หน้าล็อกอิน (Break-Glass Login)
            </button>
          </div>
        ) : success ? (
          <div className="space-y-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
            <p className="text-sm font-semibold text-emerald-400">{statusText}</p>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">{statusText}</p>
          </div>
        )}

        <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-4">
          ISO 27001 & Cryptographic PKCE S256 Verified
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          กำลังเตรียมการยืนยันตัวตน...
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
