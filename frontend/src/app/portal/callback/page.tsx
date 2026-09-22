"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Key,
  UserCheck,
  Building,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { api, PortalExchangeResponse } from "@/lib/api";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const [loading, setLoading] = useState(true);
  const [exchangeResult, setExchangeResult] = useState<PortalExchangeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    if (!code) {
      setError("ไม่พบพารามิเตอร์ 'code' (Authorization Code) ใน URL สำหรับการยืนยันตัวตน SSO");
      setLoading(false);
      return;
    }

    const runExchange = async () => {
      setLoading(true);
      setError(null);
      try {
        const redirectUri = window.location.origin + "/portal/callback";
        const result = await api.exchangePortalCode(code, redirectUri);
        setExchangeResult(result);
      } catch (err: any) {
        console.error("SSO Portal Exchange error:", err);
        setError(err.message || "เกิดข้อผิดพลาดในการแลกเปลี่ยน Authorization Code กับเซิร์ฟเวอร์ Central IAM");
      } finally {
        setLoading(false);
      }
    };

    runExchange();
  }, [code]);

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="w-full flex items-center justify-between">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับสู่ Employee Portal</span>
        </Link>
        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
          OIDC / OAuth 2.0 PKCE Callback
        </span>
      </div>

      {loading && (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-8 sm:p-12 text-center space-y-6">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-inner">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-600" />
            <div className="absolute inset-0 rounded-2xl ring-4 ring-blue-500/20 animate-pulse" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900">กำลังตรวจสอบและยืนยัน Single Sign-On Ticket</h2>
            <p className="text-sm text-slate-500">
              ระบบกำลังส่งรหัส Authorization Code ไปยัง Central IAM OIDC Engine เพื่อยืนยัน Asymmetric RS256 และดึงข้อมูลสิทธิ์บุคลากร...
            </p>
          </div>
          <div className="flex justify-center items-center gap-2 text-xs font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-2.5 max-w-lg mx-auto overflow-hidden text-ellipsis whitespace-nowrap">
            <span>Code: {code ? code.slice(0, 16) + "..." : ""}</span>
            <span>•</span>
            <span>State: {state || "ciam_launch"}</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="w-full bg-white rounded-2xl border border-red-200 shadow-xl p-8 sm:p-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">ไม่สามารถแลกเปลี่ยน SSO Ticket ได้</h2>
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <p className="text-xs text-slate-500 mt-2">
                สาเหตุที่พบบ่อย: Authorization Code มีอายุ 60 วินาทีและใช้ได้เพียงครั้งเดียว (Single-Use Ticket) หากกด Refresh ซ้ำหรือรหัสหมดอายุ จะต้องสร้าง SSO Ticket ใหม่จาก Portal
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
            <button
              onClick={() => router.push("/portal")}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md shadow-blue-600/20"
            >
              กลับสู่ Employee Portal แล้วลองใหม่อีกครั้ง
            </button>
          </div>
        </div>
      )}

      {!loading && exchangeResult && (
        <div className="w-full bg-white rounded-2xl border border-emerald-200/80 shadow-xl overflow-hidden space-y-0">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" />
                  SSO Authenticated via Central IAM
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight">ยืนยันตัวตนสำเร็จ (Single Sign-On Verified)</h1>
                <p className="text-emerald-100 text-xs sm:text-sm">
                  ออกโทเค็นความปลอดภัยมาตรฐาน OpenID Connect (RS256 JWT) ให้แก่ {exchangeResult.app_name} เรียบร้อยแล้ว
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* User Claims Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>ข้อมูลบุคลากร (Employee Claims)</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">ชื่อ-นามสกุล:</span>
                    <span className="font-semibold text-slate-800">{exchangeResult.user_info.full_name || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">รหัสพนักงาน:</span>
                    <span className="font-mono font-bold text-blue-600">{exchangeResult.user_info.employee_id || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">Username (AD):</span>
                    <span className="font-mono text-slate-700">{exchangeResult.user_info.username || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">อีเมลองค์กร:</span>
                    <span className="text-slate-700">{exchangeResult.user_info.email || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">แผนก/ฝ่าย:</span>
                    <span className="font-medium text-slate-800">{exchangeResult.user_info.department || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Target Spoke App & Security Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>ระบบปลายทาง (Spoke Application)</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">ชื่อระบบ:</span>
                    <span className="font-bold text-slate-800">{exchangeResult.app_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">รหัสระบบ (App Code):</span>
                    <span className="font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {exchangeResult.app_code}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">สิทธิ์ในระบบนี้ (Assigned Role):</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {exchangeResult.user_info.roles?.[exchangeResult.app_code] || "มาตรฐาน (Standard Role)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">อัลกอริทึม Token:</span>
                    <span className="font-mono text-emerald-600 font-semibold">RS256 (Asymmetric JWT)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">อายุ Token:</span>
                    <span className="text-slate-700">{exchangeResult.expires_in} วินาที (1 ชั่วโมง)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Inspector Toggle */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTokens(!showTokens)}
                className="w-full bg-slate-100 hover:bg-slate-200/80 px-4 py-3 text-left flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>ดูรายละเอียด OIDC Tokens (ID Token & Access Token)</span>
                </div>
                {showTokens ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTokens && (
                <div className="p-4 bg-slate-900 text-slate-200 font-mono text-xs space-y-4 overflow-x-auto">
                  <div>
                    <div className="text-slate-400 text-[11px] mb-1 font-sans font-semibold">Access Token (Bearer):</div>
                    <div className="bg-black/50 p-2.5 rounded-lg border border-slate-700 break-all text-emerald-400">
                      {exchangeResult.access_token}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] mb-1 font-sans font-semibold">ID Token (Signed RS256):</div>
                    <div className="bg-black/50 p-2.5 rounded-lg border border-slate-700 break-all text-cyan-400">
                      {exchangeResult.id_token}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] mb-1 font-sans font-semibold">User Info Claims (JSON):</div>
                    <pre className="bg-black/50 p-2.5 rounded-lg border border-slate-700 text-slate-300 overflow-x-auto">
                      {JSON.stringify(exchangeResult.user_info, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link
                href="/portal"
                className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                ← กลับไปยัง Employee Portal
              </Link>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/portal")}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                >
                  เสร็จสิ้น (ไปหน้ารวมแอป)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortalCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
