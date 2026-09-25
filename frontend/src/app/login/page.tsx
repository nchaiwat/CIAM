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
  Fingerprint,
  Building2,
  CheckCircle2,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { ciamApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Honeypot Decoy Trap States (Hidden from human UI, traps automated bot scrapers)
  const [corporateFax, setCorporateFax] = useState("");
  const [securityHoney, setSecurityHoney] = useState("");

  const [sessionExpired, setSessionExpired] = useState(false);

  // Check if already authenticated or session expired
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "1") {
        setSessionExpired(true);
        localStorage.removeItem("ciam_token");
        localStorage.removeItem("ciam_user");
        return;
      }
    }
    const existingToken = localStorage.getItem("ciam_token");
    if (existingToken) {
      router.replace("/");
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
        corporate_fax: corporateFax || undefined,
        security_honey: securityHoney || undefined,
      });

      // Save token & user metadata in browser storage
      localStorage.setItem("ciam_token", res.access_token);
      localStorage.setItem("ciam_user", JSON.stringify(res.user));

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      const detail =
        err.message ||
        "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ISO 27001 Security Defense)";
      setErrorMsg(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Background Cyber Ambient Lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 p-0.5 shadow-xl shadow-sky-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-9 h-9 text-sky-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              Central IAM
              <span className="text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Admin Console
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              ระบบศูนย์กลางการยืนยันตัวตนและการเข้าถึงระดับองค์กร
            </p>
            <p className="text-[11px] text-slate-500 font-semibold">
              บริษัท วินโดว์ เอเชีย จำกัด (มหาชน)
            </p>
          </div>
        </div>

        {/* ISO 27001 A.9.4.2 Legal Warning Banner */}
        <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-left">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <span className="font-bold text-amber-300">ประกาศความมั่นคงปลอดภัย:</span>{" "}
            ระบบนี้สำหรับผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น การพยายามเข้าถึงโดยไม่ได้รับอนุญาตมีโทษตาม พ.ร.บ. คอมพิวเตอร์ พ.ศ. 2560 และมีการบันทึก Audit Logs ตลอดเวลา
          </div>
        </div>

        {/* Session Expired Banner */}
        {sessionExpired && !errorMsg && (
          <div className="bg-amber-950/80 border border-amber-500/80 rounded-xl p-3.5 flex items-start gap-2.5 text-left animate-in fade-in zoom-in-95 duration-200">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-snug">
              <span className="font-bold">เซสชันการใช้งานของคุณหมดอายุ:</span> กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อความปลอดภัยในการเข้าถึง
            </div>
          </div>
        )}

        {/* Error Alert Message */}
        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3.5 flex items-start gap-2.5 text-left animate-in fade-in zoom-in-95 duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 leading-snug">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-emerald-950/60 border border-emerald-700/80 rounded-xl p-3.5 flex items-center gap-2.5 text-left text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>ยืนยันตัวตนสำเร็จ กำลังเข้าสู่แดชบอร์ดการจัดการ...</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* ─── HONEYPOT TRAP FIELDS (INVISIBLE DECOYS) ─────────────────── */}
          {/* Legitimate human users never see or interact with these fields. */}
          {/* Automated bots that scrape forms will populate them and get trapped. */}
          <div
            aria-hidden="true"
            style={{
              opacity: 0,
              position: "absolute",
              top: 0,
              left: 0,
              height: 0,
              width: 0,
              zIndex: -1,
              overflow: "hidden",
            }}
          >
            <label htmlFor="corporate_fax">Corporate Fax Address</label>
            <input
              type="text"
              id="corporate_fax"
              name="corporate_fax"
              value={corporateFax}
              onChange={(e) => setCorporateFax(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
            <label htmlFor="security_honey">Security Token Decoy</label>
            <input
              type="text"
              id="security_honey"
              name="security_honey"
              value={securityHoney}
              onChange={(e) => setSecurityHoney(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          {/* ───────────────────────────────────────────────────────────── */}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              ชื่อผู้ดูแลระบบ (Admin Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น admin"
                disabled={submitting || success}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเพื่อเข้าใช้งาน"
                disabled={submitting || success}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || success}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>กำลังตรวจสอบสิทธิ์ผ่านระบบความปลอดภัย...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>เข้าสู่ระบบเรียบร้อย</span>
              </>
            ) : (
              <>
                <span>เข้าสู่ระบบกำกับดูแล (Sign In)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Portal Entry for Employees */}
        <div className="pt-2 text-center">
          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-sky-400 hover:text-sky-300 text-xs font-semibold border border-slate-700/80 transition-all shadow-xs"
          >
            <span>🏢 พนักงานทั่วไป: ไปยังหน้า App Portal (Single Sign-On) ➜</span>
          </Link>
        </div>

        {/* Security Compliance Badges */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>ISO 27001:2022 A.9.4.2</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>Honeypot Active Trap</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>Anti-Brute Force Lockout</span>
          </div>
        </div>
      </div>

      {/* Footer System Metadata */}
      <div className="mt-8 text-center text-xs text-slate-600 font-medium space-y-1 relative z-10">
        <p>© 2026 Window Asia Public Company Limited. All rights reserved.</p>
        <p className="text-[11px] text-slate-600">
          Central Identity & Access Management Governance Infrastructure
        </p>
      </div>
    </div>
  );
}
