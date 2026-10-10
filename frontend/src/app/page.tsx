"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Layers,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
  Bell,
  Key,
  Shield,
  ExternalLink,
  Activity,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { ciamApi, DashboardSummary, AdminUserOut, ConnectedApp } from "@/lib/api";
import AdminProfileModal from "@/components/profile/AdminProfileModal";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminUserOut | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ciam_user");
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const [summaryRes, appsRes] = await Promise.all([
        ciamApi.getDashboardSummary(),
        ciamApi.getApplications(),
      ]);
      setData(summaryRes);
      setApps(appsRes);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Calculated Metrics for Graphs
  const totalIdentities = data?.kpi.total_identities || 0;
  const activeAd = data?.kpi.active_accounts || 0;
  const totalApps = apps.length;
  const ssoApps = apps.filter((a) => a.sso_enabled === true);
  const nonSsoApps = apps.filter((a) => a.sso_enabled !== true);
  const ssoCount = ssoApps.length;
  const nonSsoCount = nonSsoApps.length;
  const onlineApps = apps.filter((a) => a.health_status === "ONLINE").length;
  const ghostCount = data?.discrepancies.length || 0;

  const totalLinkedAccounts = apps.reduce((sum, a) => sum + (a.total_linked_accounts || 0), 0);
  const ssoLinkedAccounts = ssoApps.reduce((sum, a) => sum + (a.total_linked_accounts || 0), 0);
  const nonSsoLinkedAccounts = nonSsoApps.reduce((sum, a) => sum + (a.total_linked_accounts || 0), 0);

  const ssoPercentage = totalApps > 0 ? Math.round((ssoCount / totalApps) * 100) : 0;
  const nonSsoPercentage = 100 - ssoPercentage;

  // Donut SVG circumference math (Radius = 38)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const ssoStroke = (ssoPercentage / 100) * circumference;
  const nonSsoStroke = circumference - ssoStroke;

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              CIAM Analytics & Dashboard
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ระบบออนไลน์
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            ภาพรวมการเชื่อมต่อระบบลูก (Spokes), อัตราส่วน SSO, และการกระจายตัวของบัญชีผู้ใช้ในระบบทั้งหมด
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-sky-50 border border-sky-300 text-sky-800 text-xs font-bold hover:bg-sky-100 transition-colors shadow-2xs"
            title="ตั้งค่าแจ้งเตือน Telegram & ตรวจสอบสถานะ AD Sync Agent"
          >
            <Bell className="w-3.5 h-3.5 text-sky-600" />
            <span>Telegram & AD Agent</span>
          </button>

          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : "text-slate-600"}`} />
            <span>{refreshing ? "กำลังรีเฟรช..." : "รีเฟรช"}</span>
          </button>

          <Link
            href="/directory"
            className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span>ทะเบียนผู้ใช้</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Identities */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              ตัวตนกลาง (Active Directory)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? "..." : totalIdentities}
            </div>
            <span className="text-[11px] text-emerald-700 font-bold">
              {loading ? "" : `${activeAd} บัญชีเปิดใช้งาน`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total Spokes */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              ระบบลูกทั้งหมด (Spokes)
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? "..." : totalApps}
            </div>
            <span className="text-[11px] text-sky-700 font-bold">
              {loading ? "" : `${ssoCount} ระบบรองรับ SSO`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Total Linked Accounts */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              สิทธิ์บัญชีในระบบลูกรวม
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {loading ? "..." : totalLinkedAccounts}
            </div>
            <span className="text-[11px] text-indigo-700 font-bold">
              {loading ? "" : `${ssoLinkedAccounts} บัญชีใช้ SSO`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Key className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Ghost / Discrepancy Watch */}
        <div className={`p-3.5 rounded-lg border shadow-2xs flex items-center justify-between ${
          ghostCount > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"
        }`}>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              บัญชีผี / ความไม่ตรงกัน
            </span>
            <div className={`text-2xl font-black mt-0.5 ${ghostCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {loading ? "..." : ghostCount}
            </div>
            <Link
              href="/directory?ghostOnly=true"
              className="text-[11px] text-slate-600 hover:text-blue-700 font-bold underline"
            >
              {ghostCount > 0 ? "คลิกเพื่อจัดการรายการตกค้าง" : "ความสอดคล้อง 100% ปกติ"}
            </Link>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            ghostCount > 0 ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {ghostCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Main Charts Section (Point 9: Spoke SSO Distribution & Account Volume) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Donut Chart - SSO vs Non-SSO Spokes (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-slate-300 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>สัดส่วนระบบลูก SSO vs Non-SSO</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  การเปิดใช้งาน Single Sign-On (OIDC) ของระบบ Spokes
                </p>
              </div>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {ssoCount}/{totalApps} Spokes
              </span>
            </div>

            {/* Circular Donut Graph */}
            <div className="py-6 flex flex-col items-center justify-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
                  {/* Non-SSO Arc (Slate) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#94a3b8"
                    strokeWidth="12"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset="0"
                    className="transition-all duration-1000"
                  />
                  {/* SSO Arc (Sky-500) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth="12"
                    strokeDasharray={`${ssoStroke} ${circumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {ssoPercentage}%
                  </span>
                  <span className="text-[10px] font-bold uppercase text-sky-700 tracking-wider mt-1">
                    SSO Enabled
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {ssoCount} จาก {totalApps} ระบบ
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown Legend Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <div className="p-3 rounded-lg bg-sky-50/80 border border-sky-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                  <span className="text-xs font-bold text-sky-950">SSO Enabled</span>
                </div>
                <div className="text-lg font-black text-sky-900 mt-1">
                  {ssoCount} <span className="text-xs font-medium text-sky-700">ระบบ</span>
                </div>
                <div className="text-[10px] text-sky-800 font-medium mt-1 truncate">
                  {ssoApps.map((a) => a.app_code.toUpperCase()).join(", ") || "-"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span className="text-xs font-bold text-slate-800">Non-SSO / Direct</span>
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {nonSsoCount} <span className="text-xs font-medium text-slate-600">ระบบ</span>
                </div>
                <div className="text-[10px] text-slate-600 font-medium mt-1 truncate">
                  {nonSsoApps.map((a) => a.app_code.toUpperCase()).join(", ") || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>สถานะเซิร์ฟเวอร์ Spoke:</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ออนไลน์ {onlineApps}/{totalApps} ระบบ
            </span>
          </div>
        </div>

        {/* Right Column: Account Distribution per Spoke (Horizontal Bar Graph - 7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-slate-300 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>การกระจายตัวของบัญชีในแต่ละระบบลูก (Accounts per Spoke)</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  จำนวนผู้ใช้และสัดส่วนบัญชีที่ผูกอยู่ในแต่ละแอปพลิเคชัน
                </p>
              </div>
              <Link
                href="/applications"
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <span>จัดการระบบลูก</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Horizontal Bar Graph List */}
            <div className="space-y-3.5 pt-4">
              {apps.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">ยังไม่มีข้อมูลระบบลูก</div>
              ) : (
                [...apps]
                  .sort((a, b) => (b.total_linked_accounts || 0) - (a.total_linked_accounts || 0))
                  .map((app) => {
                    const count = app.total_linked_accounts || 0;
                    const percentOfTotal = totalIdentities > 0 ? Math.round((count / totalIdentities) * 100) : 0;
                    const isSso = app.sso_enabled === true;

                    return (
                      <div key={app.id} className="space-y-1">
                        {/* Row Header */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full shrink-0 bg-blue-600"></span>
                            <span className="font-extrabold text-slate-900">{app.app_name}</span>
                            <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 rounded uppercase">
                              {app.app_code}
                            </span>
                            {isSso ? (
                              <span className="text-[9px] font-black tracking-wider uppercase text-sky-700 bg-sky-100 border border-sky-200 px-1 rounded">
                                SSO
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 rounded">
                                Direct
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 font-mono">
                              {count} <span className="text-slate-400 font-normal">บัญชี</span>
                            </span>
                            <span className="text-[11px] font-bold text-blue-700 font-mono w-10 text-right">
                              {percentOfTotal}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isSso
                                ? "bg-gradient-to-r from-sky-500 to-blue-600"
                                : "bg-gradient-to-r from-slate-400 to-slate-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(3, percentOfTotal))}%` }}
                          ></div>
                        </div>

                        {/* Sub details: Connector type & Latency */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span>ชนิดการเชื่อมต่อ: {app.connector_type}</span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${app.health_status === "ONLINE" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                            <span className={app.health_status === "ONLINE" ? "text-emerald-700 font-semibold" : "text-rose-700"}>
                              {app.health_status} {app.latency_ms ? `(${app.latency_ms}ms)` : ""}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>ฐานข้อมูลบัญชีผู้ใช้ทั้งหมด:</span>
            <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {totalLinkedAccounts} บัญชี รวมทุก Spoke
            </span>
          </div>
        </div>
      </div>

      {/* Security Architecture & AD Gateway Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: AD Sync Agent Gateway */}
        <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
              <Server className="w-4 h-4 text-emerald-600" />
              <span>AD Sync Agent Gateway</span>
            </span>
            <span className="px-2 py-0.2 text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-bold">
              ONLINE
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            เชื่อมต่อกับ Active Directory Domain Controller (wa.net) ผ่าน Security Gateway พอร์ต 3100
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 flex justify-between">
            <span>Gateway Host:</span>
            <span className="text-blue-700 font-bold">http://172.18.0.1:3100</span>
          </div>
        </div>

        {/* Card 2: Single Sign-On Infrastructure */}
        <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
              <Lock className="w-4 h-4 text-sky-600" />
              <span>OIDC Single Sign-On</span>
            </span>
            <span className="px-2 py-0.2 text-[10px] bg-sky-100 text-sky-900 border border-sky-300 rounded font-bold">
              PKCE Active
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            รองรับมาตรฐาน OpenID Connect Discovery & PKCE สำหรับ SSO App Portal และระบบลูก Mode A, B, C
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 flex justify-between">
            <span>Issuer URL:</span>
            <span className="text-blue-700 font-bold">https://ciam.windowasia.com</span>
          </div>
        </div>

        {/* Card 3: Governance & Compliance */}
        <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>ISO 27001 / PDPA Compliance</span>
            </span>
            <span className="px-2 py-0.2 text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-300 rounded font-bold">
              Audited
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            บันทึกการตัดสิทธิ์ทันทีข้ามระบบ (Atomic Offboarding) พร้อมออกใบรับรอง Certificate of Revocation
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 flex justify-between">
            <span>Audit Trail:</span>
            <Link href="/audit-logs" className="text-blue-700 font-bold hover:underline">
              ดูประวัติกิจกรรมทั้งหมด →
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Profile & Telegram Health Monitor Modal */}
      <AdminProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}
