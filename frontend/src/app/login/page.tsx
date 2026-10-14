"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  X,
  KeyRound,
  Check,
  QrCode,
} from "lucide-react";
import { ciamApi } from "@/lib/api";

export default function EmployeeLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/portal");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redir = params.get("redirect");
      if (redir && !redir.includes("/login")) {
        setRedirectTarget(redir);
      }

      // Check if already authenticated
      const existingToken = localStorage.getItem("ciam_token");
      const existingUser = localStorage.getItem("ciam_user");
      if (existingToken && existingUser) {
        try {
          router.replace(redir || "/portal");
        } catch {
          router.replace("/portal");
        }
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await ciamApi.loginAdmin({
        username: username.trim(),
        password,
      });

      // Save token & user metadata in browser storage
      localStorage.setItem("ciam_token", res.access_token);
      localStorage.setItem("ciam_user", JSON.stringify(res.user));

      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTarget);
      }, 500);
    } catch (err: any) {
      console.error("Employee login failed:", err);
      const detail =
        err.message ||
        "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง";
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white lg:bg-[#081a38] text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* ========================================================= */}
      {/* LEFT PANEL: Enterprise Brand Showcase (Hidden on Mobile) */}
      {/* ========================================================= */}
      <div className="relative hidden lg:flex w-full lg:w-[54%] xl:w-[56%] bg-gradient-to-br from-[#06193b] via-[#0c2957] to-[#041229] text-white p-8 sm:p-12 lg:p-16 flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-blue-900/40">
        {/* Subtle Architectural Blueprint / Engineering Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #93c5fd 1px, transparent 1px),
              linear-gradient(to bottom, #93c5fd 1px, transparent 1px)
            `,
            backgroundSize: "44px 44px",
          }}
        />

        {/* Soft Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Corporate Identifier */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-sky-300 text-xs font-semibold tracking-wide backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Window Asia Single Sign-On
          </div>
        </div>

        {/* Middle: Clean, Concise Enterprise Information */}
        <div className="relative z-10 my-10 lg:my-auto max-w-lg space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl xl:text-[40px] font-black tracking-tight leading-tight text-white">
              ระบบเข้าใช้งานรวมศูนย์
              <span className="block text-sky-400 font-extrabold mt-1">
                เชื่อมต่อทุกระบบงานด้วยบัญชีเดียว
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1">
              เข้าถึงระบบสารสนเทศของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ได้อย่างสะดวก รวดเร็ว และปลอดภัย
            </p>
          </div>

          <div className="space-y-3 pt-1 text-slate-200 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                ยืนยันตัวตนด้วยชื่อบัญชีและรหัสผ่าน Windows Active Directory
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                รองรับการเข้าถึงระบบ IRM, QMS และระบบงานภายในทั้งหมด
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                มาตรฐานความปลอดภัยและการควบคุมสิทธิ์การเข้าถึงข้อมูลระดับองค์กร
              </span>
            </div>
          </div>
        </div>

        {/* Left Footer */}
        <div className="relative z-10 pt-6 border-t border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 gap-2">
          <div>© 2026 Window Asia Public Company Limited. All rights reserved.</div>
          <div className="text-[11px] text-slate-400/80">Corporate Identity & Access Management</div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Enterprise Login Card (Full on Mobile)       */}
      {/* ========================================================= */}
      <div className="w-full min-h-screen lg:w-[46%] xl:w-[44%] bg-white flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Ambient Top Decorative Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

        <div className="w-full max-w-[420px] space-y-6 my-auto">
          {/* Header & Official Logo Moved to Right Side */}
          <div className="text-center space-y-3">
            {/* Official Window Asia Corporate Logo (Emblem + Text) */}
            <div className="flex justify-center pb-1">
              <img
                src="/window-asia-logo.png"
                alt="Window Asia วินโดว์ เอเชีย"
                className="h-12 sm:h-14 w-auto object-contain block select-none"
              />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                ยินดีต้อนรับ
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                เข้าสู่ระบบ <strong className="text-blue-700">Window Asia App Portal</strong>
              </p>
            </div>
          </div>

          {/* Error Alert Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-left animate-in fade-in zoom-in-95 duration-200 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-700 leading-snug font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-left text-emerald-800 text-xs font-semibold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>เข้าสู่ระบบสำเร็จ กำลังนำท่านเข้าสู่ App Portal...</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-700">
                ชื่อผู้ใช้งาน (Windows / AD Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น Chaiwat.N"
                  disabled={submitting || success}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านเพื่อเข้าใช้งาน"
                  disabled={submitting || success}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Help Links */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                <span className="font-medium">จดจำฉัน</span>
              </label>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
              >
                ลืมรหัสผ่าน / ช่วยเหลือ?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || success}
              className="w-full mt-2 py-3 px-5 rounded-xl bg-[#0f3468] hover:bg-[#0c2a55] text-white font-bold text-sm shadow-md shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>เข้าสู่ระบบเรียบร้อย</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Helpdesk Notice */}
          <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-100">
            ยังไม่มีบัญชีหรือพบปัญหาเข้าสู่ระบบ?{" "}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer transition-colors"
            >
              ติดต่อฝ่าย IT
            </button>
          </div>

          {/* Mobile-only Subtle Footer */}
          <div className="lg:hidden text-center text-[11px] text-slate-400 pt-3">
            © 2026 Window Asia Public Company Limited
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Help Modal: Reset Password & IT Guidance                  */}
      {/* ========================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <span>การช่วยเหลือเรื่องรหัสผ่าน</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                ระบบ <strong>Window Asia Single Sign-On</strong> ใช้ฐานข้อมูลบัญชีผู้ใช้งานจาก{" "}
                <strong className="text-slate-900">Windows Active Directory</strong> ของบริษัท
              </p>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5 text-blue-950">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>กรณีลืมรหัสผ่านหรือรหัสผ่านหมดอายุ</span>
                </div>
                <div className="text-xs text-blue-900/90 pl-5">
                  1. หากคุณอยู่ที่เครื่องคอมพิวเตอร์ทำงาน ให้กด <strong>Ctrl + Alt + Del</strong> แล้วเลือก <em>Change a password</em> เพื่อเปลี่ยนรหัสผ่าน
                </div>
                <div className="text-xs text-blue-900/90 pl-5">
                  2. หากเข้าใช้งานไม่ได้หรือบัญชีถูกล็อก ให้ติดต่อ <strong>ฝ่ายไอที (IT Support)</strong> โทรภายใน หรือสแกน LINE
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHelpModal(false);
                        setShowQrModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>สแกน QR Code ติดต่อฝ่ายไอที (LINE)</span>
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                * เพื่อความปลอดภัยของข้อมูลองค์กร ระบบจะไม่อนุญาตให้รีเซ็ตรหัสผ่านผ่านอีเมลภายนอก
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* IT Support LINE QR Code Modal                            */}
      {/* ========================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <QrCode className="w-4 h-4" />
                </div>
                <span>ติดต่อฝ่ายไอที (IT Support)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 shadow-inner">
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <img
                    src="/line-it-support-qr.png"
                    alt="LINE QR Code IT Support"
                    className="w-48 h-48 object-contain rounded-lg block select-none"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#06C755]/10 border border-[#06C755]/30 text-[#06C755] font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#06C755] animate-pulse" />
                  <span>LINE Official IT Support</span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 text-left bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-800">ขั้นตอนการติดต่อ:</div>
                <div className="text-slate-500 leading-relaxed text-[11.5px]">
                  1. เปิดแอปพลิเคชัน <strong>LINE</strong> บนสมาร์ตโฟน<br />
                  2. ไปที่แท็บ <strong>หน้าหลัก (Home)</strong> แล้วกดไอคอน <strong>สแกน QR Code</strong><br />
                  3. สแกนภาพด้านบนเพื่อเริ่มสนทนากับเจ้าหน้าที่ฝ่ายไอที
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                เข้าใจแล้ว / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Quick Contact IT Button (Bottom Right) */}
      <button
        type="button"
        onClick={() => setShowQrModal(true)}
        className="fixed bottom-4 right-4 z-40 bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-full px-3.5 py-2 shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-md transition-all hover:scale-105 cursor-pointer group"
        title="คลิกเพื่อสแกน LINE ติดต่อฝ่ายไอที (IT Support)"
      >
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
          <QrCode className="w-3 h-3" />
        </div>
        <span className="hidden sm:inline">ติดต่อ IT Support</span>
      </button>
    </div>
  );
}
