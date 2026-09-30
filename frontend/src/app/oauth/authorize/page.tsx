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
  Eye,
  EyeOff,
  Fingerprint,
  RefreshCw,
  Info,
  UserCheck,
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

  // Seamless SSO states
  const [checkingSeamless, setCheckingSeamless] = useState(false);
  const [seamlessUser, setSeamlessUser] = useState<{
    username: string;
    full_name: string;
    department?: string;
  } | null>(null);
  const [switchAccount, setSwitchAccount] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    const checkMetaAndSession = async () => {
      setLoadingMeta(true);
      setValidationError(null);

      let fetchedMeta: AuthorizeMeta | null = null;
      try {
        fetchedMeta = await api.getAuthorizeMeta({
          response_type: responseType,
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        });
        setMeta(fetchedMeta);
      } catch (err: any) {
        console.error("Authorize check error:", err);
        setValidationError(
          err.message || "ไม่สามารถยืนยันข้อมูล Spoke Client ได้ หรือ Redirect URI ไม่ตรงกับที่ลงทะเบียนไว้"
        );
        setLoadingMeta(false);
        return;
      }

      // Check if user already has an active CIAM session
      const savedToken = typeof window !== "undefined" ? localStorage.getItem("ciam_token") : null;
      const savedUserStr = typeof window !== "undefined" ? localStorage.getItem("ciam_user") : null;

      if (savedToken && !switchAccount) {
        let cachedUser = null;
        try {
          if (savedUserStr) cachedUser = JSON.parse(savedUserStr);
        } catch {
          // ignore parse error
        }

        if (cachedUser) {
          setSeamlessUser(cachedUser);
        }
        setCheckingSeamless(true);
        setLoadingMeta(false);

        try {
          const ssoRes = await api.submitSeamlessAuthorize({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope,
            state: state || undefined,
            code_challenge: codeChallenge || undefined,
            code_challenge_method: codeChallengeMethod || undefined,
          });

          if (ssoRes.status === "SUCCESS" && ssoRes.redirect_to) {
            if (ssoRes.user) {
              setSeamlessUser(ssoRes.user);
            }
            setRedirecting(true);
            setRedirectTarget(ssoRes.redirect_to);
            setTimeout(() => {
              window.location.href = ssoRes.redirect_to;
            }, 800);
            return;
          }
        } catch (err: any) {
          console.warn("Seamless SSO attempt failed:", err);
          if (
            err.status === 403 ||
            (typeof err.message === "string" &&
              (err.message.includes("สิทธิ์") || err.message.includes("ระงับ")))
          ) {
            setValidationError(err.message || "ท่านไม่ได้รับสิทธิ์เข้าใช้งานระบบนี้");
            setCheckingSeamless(false);
            return;
          }

          // In case session expired (401) or invalid, silently clear and drop back to login form
          if (typeof window !== "undefined") {
            localStorage.removeItem("ciam_token");
            localStorage.removeItem("ciam_user");
          }
          setCheckingSeamless(false);
          setSeamlessUser(null);
        }
      } else {
        setLoadingMeta(false);
      }
    };

    checkMetaAndSession();
  }, [clientId, redirectUri, responseType, scope, state, codeChallenge, codeChallengeMethod, switchAccount]);

  const handleSwitchAccount = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ciam_token");
      localStorage.removeItem("ciam_user");
    }
    setSwitchAccount(true);
    setCheckingSeamless(false);
    setSeamlessUser(null);
    setLoginError(null);
  };

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
        state: state || undefined,
        code_challenge: codeChallenge || undefined,
        code_challenge_method: codeChallengeMethod || undefined,
      });

      if (res.status === "SUCCESS" && res.redirect_to) {
        // Save token and user for subsequent Seamless SSO across apps
        if (typeof window !== "undefined") {
          if (res.access_token) {
            localStorage.setItem("ciam_token", res.access_token);
          }
          if (res.user) {
            localStorage.setItem("ciam_user", JSON.stringify(res.user));
          }
        }

        if (res.user) {
          setSeamlessUser(res.user);
        }
        setRedirecting(true);
        setRedirectTarget(res.redirect_to);
        // Smooth transition before redirect
        setTimeout(() => {
          window.location.href = res.redirect_to;
        }, 1000);
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
                  <span>คำขอเข้าสู่ระบบไม่ถูกต้อง (Access Denied)</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-300">
                  {validationError}
                </p>
              </div>

              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
                <div>Client ID: {clientId || "None"}</div>
                <div className="truncate">Redirect URI: {redirectUri || "None"}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.history.back()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={handleSwitchAccount}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  สลับบัญชีผู้ใช้
                </button>
              </div>
            </div>
          )}

          {/* Seamless SSO In-Progress State */}
          {!loadingMeta && !validationError && checkingSeamless && !redirecting && (
            <div className="py-8 text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-blue-500/20 border border-blue-400/40 rounded-full flex items-center justify-center mx-auto text-blue-400 ring-8 ring-blue-500/10">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ตรวจพบเซสชันการเข้าสู่ระบบ (Active Session)</span>
                </div>
                <h3 className="text-base font-bold text-white pt-1">
                  {seamlessUser ? `กำลังเข้าสู่ระบบในชื่อ ${seamlessUser.full_name || seamlessUser.username}` : "กำลังยืนยันตัวตนอัตโนมัติ..."}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  กำลังนำทางกลับสู่ระบบ <span className="text-blue-300 font-semibold">{meta?.app_name || "เป้าหมาย"}</span> โดยไม่ต้องกรอกรหัสผ่านซ้ำ...
                </p>
              </div>

              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                <div className="w-full h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-pulse" />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4 transition-colors cursor-pointer"
                >
                  ไม่ใช่บัญชีของคุณ? สลับบัญชี / เข้าสู่ระบบด้วยบัญชีอื่น
                </button>
              </div>
            </div>
          )}

          {/* Redirecting Success State */}
          {!loadingMeta && !validationError && redirecting && (
            <div className="py-10 text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-400/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-9 h-9 animate-bounce text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {seamlessUser ? `ยืนยันตัวตนสำเร็จ: ${seamlessUser.full_name || seamlessUser.username}` : "ยืนยันตัวตนสำเร็จ!"}
                </h3>
                <p className="text-xs text-slate-400">
                  กำลังนำทางกลับสู่ระบบ <span className="text-white font-medium">{meta?.app_name || "เป้าหมาย"}</span>...
                </p>
              </div>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                <div className="w-full h-full bg-gradient-to-r from-blue-500 to-emerald-400 animate-pulse" />
              </div>
            </div>
          )}

          {/* Ready & Active Login Form */}
          {!loadingMeta && !validationError && !checkingSeamless && !redirecting && meta && (
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
                    <span className="text-[11px] text-slate-500 font-normal">เช่น admin, Chaiwat.N</span>
                  </label>
                  <div className="relative">
                    <Fingerprint className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="กรอกชื่อผู้ใช้ (AD Username)..."
                      required
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>รหัสผ่าน (Password)</span>
                    <span className="text-[11px] text-blue-400/80">
                      รหัสผ่าน Active Directory
                    </span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านของคุณ..."
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all [color-scheme:dark]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
