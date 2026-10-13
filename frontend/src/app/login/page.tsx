"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Shield,
  Zap,
  Server,
  Layers,
  X,
  KeyRound,
  Check,
} from "lucide-react";
import { ciamApi } from "@/lib/api";
import { WindowAsiaLogo, Modern3DWindowIcon } from "@/components/WindowAsiaLogo";

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#081a38] text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* ========================================================= */}
      {/* LEFT PANEL: Enterprise Brand Showcase (55% on desktop)   */}
      {/* ========================================================= */}
      <div className="relative w-full lg:w-[54%] xl:w-[56%] bg-gradient-to-br from-[#06193b] via-[#0c2957] to-[#041229] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-blue-900/40">
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

        {/* Top: Window Asia Corporate Logo */}
        <div className="relative z-10">
          <WindowAsiaLogo variant="dark" size="lg" />
        </div>

        {/* Middle: Value Proposition & Security Assurances */}
        <div className="relative z-10 my-10 lg:my-auto max-w-xl space-y-7">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-sky-300 text-xs font-semibold tracking-wide backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Window Asia Central Single Sign-On
            </div>
            <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-black tracking-tight leading-tight text-white">
              ความปลอดภัยที่คุณวางใจ
              <span className="block text-sky-400 font-extrabold mt-1">
                เชื่อมต่อทุกระบบงานด้วยบัญชีเดียว
              </span>
            </h1>
          </div>

          {/* Bullet Points with Checkmarks */}
          <div className="space-y-3.5 pt-2 text-slate-200 text-sm sm:text-base">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                <strong>Single Sign-On รวมศูนย์</strong> — ล็อกอินครั้งเดียว เข้าถึงทุกระบบงานในองค์กรได้ทันที
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                <strong>Active Directory Integrated</strong> — ยืนยันตัวตนด้วยชื่อบัญชีและรหัสผ่าน Windows ประจำตัว
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center shrink-0 mt-0.5 text-sky-300">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                <strong>มาตรฐานความปลอดภัยระดับ Enterprise</strong> — เข้ารหัสข้อมูลและควบคุมสิทธิ์แบบ Real-time
              </span>
            </div>
          </div>

          {/* Shield Guarantee Card (Matching reference mockup) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-blue-800/30 to-indigo-900/30 border border-blue-400/30 backdrop-blur-md shadow-lg shadow-blue-950/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-white text-sm sm:text-base">
                รับประกันความปลอดภัยตลอดการใช้งาน
              </div>
              <div className="text-xs text-sky-200/80 leading-relaxed mt-0.5">
                มั่นใจในระบบความปลอดภัย ดูแลและปกป้องข้อมูลสำคัญขององค์กรตลอด 24 ชม.
              </div>
            </div>
          </div>

          {/* Bottom 4 Feature Cards (Pillars) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-blue-500/20 text-sky-300 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">ปลอดภัย</div>
              <div className="text-[10px] text-slate-300/80 leading-tight">
                ควบคุมการเข้าถึงรัดกุม
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">รวดเร็ว</div>
              <div className="text-[10px] text-slate-300/80 leading-tight">
                เข้าสู่ระบบทันใจ ไม่ซ้ำซ้อน
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">เสถียรภาพ</div>
              <div className="text-[10px] text-slate-300/80 leading-tight">
                High Availability 99.9%
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-center space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">ครบวงจร</div>
              <div className="text-[10px] text-slate-300/80 leading-tight">
                เชื่อมต่อทุกระบบงาน
              </div>
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
      {/* RIGHT PANEL: Enterprise Login Card (46% on desktop)      */}
      {/* ========================================================= */}
      <div className="w-full lg:w-[46%] xl:w-[44%] bg-[#f8fafc] flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Ambient Top Decorative Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

        <div className="w-full max-w-[430px] space-y-6 my-auto">
          {/* Header & 3D Window Emblem */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ยินดีต้อนรับ
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              เข้าสู่ระบบ <strong className="text-blue-700">Window Asia App Portal</strong>
            </p>

            {/* Modern 3D Window Icon (Matching Mockup) */}
            <div className="py-2">
              <Modern3DWindowIcon className="w-20 h-20 mx-auto transform hover:scale-105 transition-transform duration-300" />
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
                  placeholder="เช่น Chaiwat.N หรือ Somchai.S"
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

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-[#f8fafc] px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              หรือเข้าสู่ระบบด้วย
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* Active Directory Corporate Sign-in Information Box */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800">
                Internal Active Directory
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                ยืนยันตัวตนผ่านระบบ Windows AD ของบริษัท (ชุดเดียวกับเปิดคอมพิวเตอร์)
              </div>
            </div>
          </div>

          {/* Admin Console Shortcut */}
          <div className="pt-2 text-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center gap-1.5 text-slate-500 hover:text-blue-700 text-xs font-semibold transition-colors py-1 px-3 rounded-lg hover:bg-slate-100"
            >
              <span>⚙️ สำหรับเจ้าหน้าที่ไอที / ผู้ดูแลระบบ (Admin Console) ➜</span>
            </Link>
          </div>

          {/* Helpdesk Notice */}
          <div className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-200/80">
            ยังไม่มีบัญชีหรือพบปัญหาเข้าสู่ระบบ? กรุณาติดต่อฝ่ายไอที (IT Support)
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
                  2. หากเข้าใช้งานไม่ได้หรือบัญชีถูกล็อก ให้ติดต่อ <strong>ฝ่ายไอที (IT Support)</strong> โทรภายใน หรือแจ้งผ่านระบบแจ้งซ่อม IT เพื่อให้เจ้าหน้าที่ช่วยรีเซ็ตรหัสผ่านให้
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
    </div>
  );
}
