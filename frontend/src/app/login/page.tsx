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
  Sparkles,
  Building2,
  HelpCircle,
} from "lucide-react";
import { ciamApi } from "@/lib/api";

export default function EmployeeLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/portal");

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
          const user = JSON.parse(existingUser);
          if (user.role === "PORTAL_USER") {
            router.replace(redir || "/portal");
          } else {
            // Admin user can choose or go to dashboard
            router.replace(redir || "/portal");
          }
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
      }, 600);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 flex flex-col items-center justify-center p-4 relative selection:bg-blue-600 selection:text-white">
      {/* Soft Ambient Background Elements */}
      <div className="absolute top-1/6 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/6 right-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Employee Login Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 relative z-10 space-y-6">
        {/* Brand & Organization Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="pt-2">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 leading-snug">
              Window Asia<br />
              Single Sign-On
            </h1>
          </div>
        </div>

        {/* Error Alert Message */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-left animate-in fade-in zoom-in-95 duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 leading-snug font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-left text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>เข้าสู่ระบบสำเร็จ กำลังนำท่านเข้าสู่ App Portal...</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Username Input */}
          <div className="space-y-1.5">
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
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
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
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

          {/* Helpful Information Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-2.5 text-slate-500 text-[11px] leading-relaxed">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              เข้าใช้งานด้วยชื่อบัญชีและรหัสผ่าน Windows (Active Directory) ชุดเดียวกับที่ใช้เปิดเครื่องคอมพิวเตอร์ทำงานของบริษัท
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || success}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                <span>เข้าสู่ระบบ App Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link for IT Administrators */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center gap-1.5 text-slate-500 hover:text-blue-600 text-xs font-semibold transition-colors"
          >
            <span>⚙️ สำหรับเจ้าหน้าที่ไอที / ผู้ดูแลระบบ (Admin Console) ➜</span>
          </Link>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="mt-8 text-center text-xs text-slate-500 font-medium space-y-1 relative z-10">
        <p>© 2026 บริษัท วินโดว์ เอเชีย จำกัด (มหาชน). สงวนลิขสิทธิ์ทั้งหมด</p>
        <p className="text-[11px] text-slate-400">
          Window Asia Centralized Identity & Single Sign-On Infrastructure
        </p>
      </div>
    </div>
  );
}
