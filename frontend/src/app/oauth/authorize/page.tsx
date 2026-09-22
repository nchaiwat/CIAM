"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Sparkles,
  KeyRound,
  UserCheck,
  Mail,
  Fingerprint,
  RefreshCw,
  Info,
} from "lucide-react";
import { api, AuthorizeMeta } from "@/lib/api";

function AuthorizeContent() {
  const searchParams = useSearchParams();

  const responseType = searchParams.get("response_type") || "code";
  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const scope = searchParams.get("scope") || "openid profile email";
  const state = searchParams.get("state") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";

  const [meta, setMeta] = useState<AuthorizeMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !redirectUri) {
      setValidationError("พารามิเตอร์ไม่ครบถ้วน: จำเป็นต้องระบุ 'client_id' และ 'redirect_uri'");
      setLoadingMeta(false);
      return;
    }

    const checkMeta = async () => {
      setLoadingMeta(true);
      setValidationError(null);
      try {
        const res = await api.getAuthorizeMeta({
          response_type: responseType,
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        });
        setMeta(res);
      } catch (err: any) {
        console.error("Authorize check error:", err);
        setValidationError(
          err.message || "ไม่สามารถยืนยันข้อมูล Spoke Client ได้ หรือ Redirect URI ไม่ตรงกับที่ลงทะเบียนไว้"
        );
      } finally {
        setLoadingMeta(false);
      }
    };

    checkMeta();
  }, [clientId, redirectUri, responseType, scope, state, codeChallenge, codeChallengeMethod]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setSubmitting(true);
    setLoginError(null);

    try {
      const res = await api.submitAuthorizeLogin({
        username: username.trim(),
        password,
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge || undefined,
        code_challenge_method: codeChallengeMethod || undefined,
      });

      if (res.status === "SUCCESS" && res.redirect_to) {
        setRedirecting(true);
        setRedirectTarget(res.redirect_to);
        // Smooth transition before redirect
        setTimeout(() => {
          window.location.href = res.redirect_to;
        }, 1200);
      }
    } catch (err: any) {
      console.error("Authorize login failed:", err);
      setLoginError(err.message || "ชื่อผู้ใช้หรือรหัสผ่าน Active Directory ไม่ถูกต้อง");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070d1e] via-[#0b1426] to-[#0f2347] flex flex-col items-center justify-center p-4 text-slate-100 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-xl shadow-blue-500/30 ring-4 ring-blue-500/20 mb-1">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Window Asia Central IAM
          </h1>
          <p className="text-xs text-slate-400">
            ระบบยืนยันตัวตนกลาง Single Sign-On (OIDC / OAuth 2.0)
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Loading Meta State */}
          {loadingMeta && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-medium">
                กำลังตรวจสอบความปลอดภัยและสิทธิ์ของระบบลูก...
              </p>
            </div>
          )}

          {/* Validation Error State */}
          {!loadingMeta && validationError && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>คำขอเข้าสู่ระบบไม่ถูกต้อง (Invalid Request)</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-300">
                  {validationError}
                </p>
              </div>

              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                <div>Client ID: {clientId || "None"}</div>
                <div className="truncate">Redirect URI: {redirectUri || "None"}</div>
              </div>

              <button
                onClick={() => window.history.back()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                ย้อนกลับ (Go Back)
              </button>
            </div>
          )}

          {/* Redirecting Success State */}
          {redirecting && (
            <div className="py-10 text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  ยืนยันตัวตนสำเร็จ!
                </h3>
                <p className="text-xs text-slate-400">
                  กำลังนำทางกลับสู่ระบบ {meta?.app_name || "เป้าหมาย"}...
                </p>
              </div>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                <div className="w-full h-full bg-gradient-to-r from-blue-500 to-emerald-400 animate-[shimmer_1s_infinite]" />
              </div>
            </div>
          )}

          {/* Ready & Active Login Form */}
          {!loadingMeta && !validationError && !redirecting && meta && (
            <>
              {/* Spoke Application Banner */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                    กำลังขอสิทธิ์เข้าสู่ระบบ:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                    SSO Active
                  </span>
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>{meta.app_name}</span>
                </div>
              </div>

              {/* Scopes requested */}
              <div className="space-y-2 text-xs text-slate-400">
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  สิทธิ์ที่ระบบลูกจะได้รับ (Scopes):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ชื่อ-นามสกุล / แผนก</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>อีเมลองค์กร</span>
                  </div>
                </div>
              </div>

              {/* Login Error Alert */}
              {loginError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Credentials Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>ชื่อผู้ใช้ (AD Username)</span>
                    <span className="text-[11px] text-slate-500 font-normal">เช่น admin, Patcha.S</span>
                  </label>
                  <div className="relative">
                    <Fingerprint className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="กรอกชื่อผู้ใช้..."
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>รหัสผ่าน (Password)</span>
                    <span className="text-[11px] text-blue-400/80 hover:text-blue-400 cursor-pointer">
                      รหัสผ่าน Active Directory
                    </span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านของคุณ..."
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-70 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังยืนยันตัวตน...</span>
                    </>
                  ) : (
                    <>
                      <span>ยืนยันตัวตนและเข้าสู่ระบบ (Sign In)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Security Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 space-y-1">
          <p>Window Asia Public Company Limited • IT Security Division</p>
          <p className="font-mono text-slate-600">PKCE S256 Cryptographically Secured</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070d1e] flex items-center justify-center text-slate-300 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          กำลังโหลดหน้าต่างยืนยันตัวตน...
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
