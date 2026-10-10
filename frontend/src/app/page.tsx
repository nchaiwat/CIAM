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
  TrendingUp,
  SlidersHorizontal,
  Table as TableIcon,
  BarChart3,
  Lightbulb,
  CheckCircle,
  XCircle,
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

  // Spoke Analytics Dimension View Toggle (Point Requested by User)
  const [spokeDimension, setSpokeDimension] = useState<"SYNC_AD" | "ACTIVE_STATUS" | "MATRIX_TABLE">("SYNC_AD");

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

  // Calculated Core Metrics
  const totalIdentities = data?.kpi.total_identities || 0;
  const activeAd = data?.kpi.active_accounts || 0;
  const totalApps = apps.length;
  const ssoApps = apps.filter((a) => a.sso_enabled === true);
  const nonSsoApps = apps.filter((a) => a.sso_enabled !== true);
  const ssoCount = ssoApps.length;
  const nonSsoCount = nonSsoApps.length;
  const onlineApps = apps.filter((a) => a.health_status === "ONLINE").length;
  const ghostCount = data?.discrepancies.length || 0;

  // Spoke Aggregate Breakdown Metrics (Active, Inactive, Synced AD, Unsynced, Local)
  const totalLinkedAccounts = apps.reduce((sum, a) => sum + (a.total_linked_accounts || 0), 0);
  const totalActiveInSpokes = apps.reduce((sum, a) => sum + (a.active_accounts_count || 0), 0);
  const totalInactiveInSpokes = apps.reduce((sum, a) => sum + (a.inactive_accounts_count || 0), 0);
  const totalSyncedWithAd = apps.reduce((sum, a) => sum + (a.synced_ad_accounts_count || 0), 0);
  const totalUnsyncedWithAd = apps.reduce((sum, a) => sum + (a.unsynced_ad_accounts_count || 0), 0);
  const totalLocalAccounts = apps.reduce((sum, a) => sum + (a.local_accounts_count || 0), 0);

  // IAM Governance Rates
  const ssoPercentage = totalApps > 0 ? Math.round((ssoCount / totalApps) * 100) : 0;
  const globalAdSyncRate = totalLinkedAccounts > 0 ? Math.round((totalSyncedWithAd / totalLinkedAccounts) * 100) : 100;
  const globalActiveRate = totalLinkedAccounts > 0 ? Math.round((totalActiveInSpokes / totalLinkedAccounts) * 100) : 100;
  const globalLocalRatio = totalLinkedAccounts > 0 ? Math.round((totalLocalAccounts / totalLinkedAccounts) * 100) : 0;

  // Donut SVG circumference math (Radius = 38)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const ssoStroke = (ssoPercentage / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
              CIAM Analytics & Governance Dashboard
            </h1>
            <span className="px-2 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ระบบออนไลน์
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            การวิเคราะห์ข้อมูลความสอดคล้องของตัวตน (AD Sync Rate), สัดส่วน SSO, การกระจายตัวของบัญชี และการชี้เป้าจุดพัฒนา
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-300 text-sky-800 text-xs font-bold hover:bg-sky-100 transition-colors shadow-2xs"
            title="ตั้งค่าแจ้งเตือน Telegram & ตรวจสอบสถานะ AD Sync Agent"
          >
            <Bell className="w-3.5 h-3.5 text-sky-600" />
            <span>Telegram & AD Agent</span>
          </button>

          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600" : "text-slate-600"}`} />
            <span>{refreshing ? "กำลังรีเฟรช..." : "รีเฟรช"}</span>
          </button>

          <Link
            href="/directory"
            className="flex items-center space-x-1 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span>ทะเบียนผู้ใช้</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip - High Level Identity Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Total Identities */}
        <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              ตัวตนกลาง (Active Directory)
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? "..." : totalIdentities}
            </div>
            <span className="text-[11px] text-emerald-700 font-bold">
              {loading ? "" : `${activeAd} บัญชีเปิดใช้งาน`}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 2: AD Synchronization Health */}
        <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              AD Synchronization Rate
            </span>
            <div className="text-xl font-black text-sky-700 mt-0.5">
              {loading ? "..." : `${globalAdSyncRate}%`}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {loading ? "" : `${totalSyncedWithAd} จาก ${totalLinkedAccounts} บัญชีตรง AD`}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 3: Total Spokes & SSO Adoption */}
        <div className="bg-white px-3.5 py-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              ระบบลูก (Spokes) & SSO Rate
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? "..." : `${ssoCount}/${totalApps}`}
            </div>
            <span className="text-[11px] text-indigo-700 font-bold">
              {loading ? "" : `SSO Adoption ${ssoPercentage}%`}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 4: Ghost & Local Account Exposure */}
        <div className={`px-3.5 py-2.5 rounded-lg border shadow-2xs flex items-center justify-between ${
          ghostCount > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"
        }`}>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              บัญชีผี / Local Account เสี่ยง
            </span>
            <div className={`text-xl font-black mt-0.5 ${ghostCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {loading ? "..." : `${ghostCount} ผี / ${totalLocalAccounts} Local`}
            </div>
            <Link
              href="/directory?ghostOnly=true"
              className="text-[11px] text-slate-600 hover:text-blue-700 font-bold underline"
            >
              {ghostCount > 0 ? "คลิกเพื่อจัดการรายการตกค้าง" : `ความเสี่ยง Local ${globalLocalRatio}%`}
            </Link>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            ghostCount > 0 ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {ghostCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Donut Chart - SSO vs Non-SSO Spokes (4 cols) */}
        <div className="lg:col-span-4 bg-white p-4 rounded-lg border border-slate-300 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>สัดส่วนระบบลูก SSO vs Non-SSO</span>
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  อัตราส่วนการเชื่อมต่อ Single Sign-On (OIDC)
                </p>
              </div>
              <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {ssoCount}/{totalApps} Spokes
              </span>
            </div>

            {/* Circular Donut Graph */}
            <div className="py-4 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
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
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-sky-50/80 border border-sky-200">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  <span className="text-xs font-bold text-sky-950">SSO Enabled</span>
                </div>
                <div className="text-base font-black text-sky-900 mt-0.5">
                  {ssoCount} <span className="text-[11px] font-medium text-sky-700">ระบบ</span>
                </div>
                <div className="text-[10px] text-sky-800 font-medium mt-0.5 truncate">
                  {ssoApps.map((a) => a.app_code.toUpperCase()).join(", ") || "-"}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span className="text-xs font-bold text-slate-800">Non-SSO / Direct</span>
                </div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {nonSsoCount} <span className="text-[11px] font-medium text-slate-600">ระบบ</span>
                </div>
                <div className="text-[10px] text-slate-600 font-medium mt-0.5 truncate">
                  {nonSsoApps.map((a) => a.app_code.toUpperCase()).join(", ") || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span>สถานะเซิร์ฟเวอร์ Spoke:</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ออนไลน์ {onlineApps}/{totalApps} ระบบ
            </span>
          </div>
        </div>

        {/* Right Column: Multi-Dimensional Spoke Analytics (8 cols) */}
        <div className="lg:col-span-8 bg-white p-4 rounded-lg border border-slate-300 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header Toolbar with Dimension Toggle (Core Feature Requested by User) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>การวิเคราะห์สถานะบัญชีแต่ละ Spoke (Accounts & Health Analytics)</span>
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  จำแนกความสอดคล้องกับ AD, บัญชีที่ Active/Inactive, และ Local Accounts ในแต่ละระบบ
                </p>
              </div>

              {/* View / Dimension Mode Selector */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSpokeDimension("SYNC_AD")}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    spokeDimension === "SYNC_AD"
                      ? "bg-white text-blue-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="ดูกราฟจำแนก: Sync กับ AD / ไม่ Sync / Local Account"
                >
                  🔵 มิติ AD Sync & Local
                </button>

                <button
                  type="button"
                  onClick={() => setSpokeDimension("ACTIVE_STATUS")}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    spokeDimension === "ACTIVE_STATUS"
                      ? "bg-white text-emerald-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="ดูกราฟจำแนก: Active vs Inactive"
                >
                  🟢 มิติ Active / Inactive
                </button>

                <button
                  type="button"
                  onClick={() => setSpokeDimension("MATRIX_TABLE")}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    spokeDimension === "MATRIX_TABLE"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="ดูเป็นตารางตัวเลขสรุป Matrix ทุกระบบ"
                >
                  📋 ตาราง Matrix
                </button>
              </div>
            </div>

            {/* View Mode 1 & 2: Stacked Segmented Progress Bars */}
            {spokeDimension !== "MATRIX_TABLE" ? (
              <div className="space-y-3 pt-3">
                {apps.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">ยังไม่มีข้อมูลระบบลูก</div>
                ) : (
                  [...apps]
                    .sort((a, b) => (b.total_linked_accounts || 0) - (a.total_linked_accounts || 0))
                    .map((app) => {
                      const total = app.total_linked_accounts || 0;
                      const act = app.active_accounts_count || 0;
                      const inact = app.inactive_accounts_count || 0;
                      const synced = app.synced_ad_accounts_count || 0;
                      const unsynced = app.unsynced_ad_accounts_count || 0;
                      const local = app.local_accounts_count || 0;

                      const isSso = app.sso_enabled === true;
                      const adSyncPct = total > 0 ? Math.round((synced / total) * 100) : 100;
                      const activePct = total > 0 ? Math.round((act / total) * 100) : 100;

                      // Width calculations for segments
                      const syncedWidth = total > 0 ? (synced / total) * 100 : 0;
                      const unsyncedWidth = total > 0 ? (unsynced / total) * 100 : 0;
                      const localWidth = total > 0 ? (local / total) * 100 : 0;

                      const actWidth = total > 0 ? (act / total) * 100 : 0;
                      const inactWidth = total > 0 ? (inact / total) * 100 : 0;

                      return (
                        <div key={app.id} className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 space-y-1.5 shadow-2xs">
                          {/* Row Top: Spoke Info & Headline */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0 bg-blue-600"></span>
                              <span className="font-extrabold text-slate-900">{app.app_name}</span>
                              <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-1 rounded uppercase">
                                {app.app_code}
                              </span>
                              {isSso ? (
                                <span className="text-[9px] font-black tracking-wider uppercase text-sky-700 bg-sky-100 border border-sky-200 px-1 rounded">
                                  SSO
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1 rounded">
                                  Direct
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 font-mono text-xs">
                                {total} <span className="text-slate-400 font-normal">บัญชี</span>
                              </span>
                              <span className={`w-2 h-2 rounded-full ${app.health_status === "ONLINE" ? "bg-emerald-500" : "bg-rose-500"}`} title={`${app.health_status} (${app.latency_ms || 0}ms)`}></span>
                            </div>
                          </div>

                          {/* Multi-Segment Stacked Progress Bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex shadow-inner">
                            {spokeDimension === "SYNC_AD" ? (
                              <>
                                <div
                                  className="h-full bg-sky-600 transition-all duration-500"
                                  style={{ width: `${syncedWidth}%` }}
                                  title={`Sync กับ AD: ${synced} บัญชี (${Math.round(syncedWidth)}%)`}
                                ></div>
                                <div
                                  className="h-full bg-amber-500 transition-all duration-500"
                                  style={{ width: `${unsyncedWidth}%` }}
                                  title={`ไม่ Sync / ตกค้าง: ${unsynced} บัญชี (${Math.round(unsyncedWidth)}%)`}
                                ></div>
                                <div
                                  className="h-full bg-purple-500 transition-all duration-500"
                                  style={{ width: `${localWidth}%` }}
                                  title={`Local Account: ${local} บัญชี (${Math.round(localWidth)}%)`}
                                ></div>
                              </>
                            ) : (
                              <>
                                <div
                                  className="h-full bg-emerald-600 transition-all duration-500"
                                  style={{ width: `${actWidth}%` }}
                                  title={`Active ในระบบ: ${act} บัญชี (${Math.round(actWidth)}%)`}
                                ></div>
                                <div
                                  className="h-full bg-rose-500 transition-all duration-500"
                                  style={{ width: `${inactWidth}%` }}
                                  title={`Inactive / ถูกระงับ: ${inact} บัญชี (${Math.round(inactWidth)}%)`}
                                ></div>
                              </>
                            )}
                          </div>

                          {/* Row Bottom: Badges with Exact Breakdown Numbers */}
                          <div className="flex flex-wrap items-center justify-between text-[11px] gap-1 pt-0.5">
                            {spokeDimension === "SYNC_AD" ? (
                              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded font-mono">
                                  🔵 Sync AD: {synced}
                                </span>
                                {unsynced > 0 && (
                                  <span className="text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-mono">
                                    🟠 ไม่ Sync: {unsynced}
                                  </span>
                                )}
                                {local > 0 && (
                                  <span className="text-purple-900 bg-purple-100 border border-purple-300 px-1.5 py-0.2 rounded font-mono">
                                    🟣 Local: {local}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                                  🟢 Active: {act}
                                </span>
                                {inact > 0 && (
                                  <span className="text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-mono">
                                    🔴 Inactive: {inact}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span>
                                {spokeDimension === "SYNC_AD" ? (
                                  <>Sync Rate: <strong className="text-blue-700 font-bold">{adSyncPct}%</strong></>
                                ) : (
                                  <>Active Rate: <strong className="text-emerald-700 font-bold">{activePct}%</strong></>
                                )}
                              </span>
                              <Link
                                href={`/directory?app_code=${app.app_code}`}
                                className="text-blue-600 hover:text-blue-800 font-semibold underline"
                              >
                                กรองในทะเบียน →
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            ) : (
              /* View Mode 3: Detailed Spoke Matrix Table */
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-2.5">ระบบลูก (Spoke)</th>
                      <th className="py-2 px-2 text-center">โหมด</th>
                      <th className="py-2 px-2 text-center">Server</th>
                      <th className="py-2 px-2 text-right">บัญชีรวม</th>
                      <th className="py-2 px-2 text-right text-emerald-800">🟢 Active</th>
                      <th className="py-2 px-2 text-right text-rose-800">🔴 Inactive</th>
                      <th className="py-2 px-2 text-right text-sky-800">🔵 Sync AD</th>
                      <th className="py-2 px-2 text-right text-amber-800">🟠 ไม่ Sync</th>
                      <th className="py-2 px-2 text-right text-purple-800">🟣 Local</th>
                      <th className="py-2 px-2 text-right">Sync %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[...apps]
                      .sort((a, b) => (b.total_linked_accounts || 0) - (a.total_linked_accounts || 0))
                      .map((app) => {
                        const total = app.total_linked_accounts || 0;
                        const act = app.active_accounts_count || 0;
                        const inact = app.inactive_accounts_count || 0;
                        const synced = app.synced_ad_accounts_count || 0;
                        const unsynced = app.unsynced_ad_accounts_count || 0;
                        const local = app.local_accounts_count || 0;
                        const syncPct = total > 0 ? Math.round((synced / total) * 100) : 100;

                        return (
                          <tr key={app.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2 px-2.5 font-bold text-slate-900">
                              <div className="flex items-center space-x-1.5">
                                <span>{app.app_name}</span>
                                <span className="font-mono text-[9px] text-slate-500 uppercase bg-slate-100 px-1 rounded">
                                  {app.app_code}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {app.sso_enabled ? (
                                <span className="text-[9px] font-black text-sky-700 bg-sky-100 px-1 py-0.2 rounded border border-sky-200">
                                  SSO
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                  Direct
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-[10px] font-bold ${app.health_status === "ONLINE" ? "text-emerald-700" : "text-rose-700"}`}>
                                {app.health_status === "ONLINE" ? "ONLINE" : "OFFLINE"}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-black font-mono text-slate-900">{total}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">{act}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-rose-700">{inact}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-sky-700">{synced}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-amber-700">{unsynced}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-purple-700">{local}</td>
                            <td className="py-2 px-2 text-right font-bold text-blue-800">{syncPct}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>ผลรวมบัญชีทุกระบบลูก:</span>
            <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {totalLinkedAccounts} บัญชี (🟢 Active {totalActiveInSpokes} • 🔵 Sync AD {totalSyncedWithAd} • 🟣 Local {totalLocalAccounts})
            </span>
          </div>
        </div>
      </div>

      {/* Strategic IAM Data Analysis & Improvement Roadmap (Skill Data Analysis Output) */}
      <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                การวิเคราะห์ข้อมูลและจุดที่นำไปพัฒนาปรับปรุงต่อ (IAM Strategic Improvement Roadmap)
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                ประมวลผลจากสถิติจริงในฐานข้อมูล CIAM เพื่อระบุความเสี่ยงและแนวทางยกระดับระบบ
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            Zero Trust & ISO 27001
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Shadow / Local Account Elimination */}
          <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-700" />
                <span>1. กำจัดบัญชี Local (Shadow Accounts)</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-purple-200 text-purple-900 px-1 rounded">
                พบ {totalLocalAccounts} บัญชี
              </span>
            </div>
            <p className="text-[11px] text-purple-900/80 leading-relaxed">
              พบบัญชีที่สร้างแยกในระบบลูก (Local Credentials) ซึ่งไม่ผ่านการจัดการจาก AD Domain Controller ทำให้ควบคุม Password Policy และการระงับสิทธิ์แบบรวมศูนย์ไม่ได้ 100%
            </p>
            <div className="pt-1 text-[11px]">
              <Link href="/directory" className="text-purple-800 hover:text-purple-950 font-bold underline">
                → ใช้ฟังก์ชัน &ldquo;ผูกกับ AD&rdquo; ในทะเบียนผู้ใช้เพื่อรวมศูนย์
              </Link>
            </div>
          </div>

          {/* Card 2: Inactive Cleanup Backlog */}
          <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 text-rose-700" />
                <span>2. กวาดล้างสิทธิ์ตกค้าง (Inactive Backlog)</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-rose-200 text-rose-900 px-1 rounded">
                {totalInactiveInSpokes} บัญชี Inactive
              </span>
            </div>
            <p className="text-[11px] text-rose-900/80 leading-relaxed">
              พบบัญชีที่ถูกระงับสิทธิ์แล้วใน Spoke แต่ยังค้างอยู่ในฐานข้อมูลระบบลูก ซึ่งสิ้นเปลือง License (เช่น SAP B1) และเพิ่มความเสี่ยงจากการพยายามเข้าถึงแบบ Unauthorized
            </p>
            <div className="pt-1 text-[11px]">
              <Link href="/offboarding" className="text-rose-800 hover:text-rose-950 font-bold underline">
                → เข้าสู่ศูนย์ระงับสิทธิ์เพื่อตรวจสอบประวัติการตัดสิทธิ์
              </Link>
            </div>
          </div>

          {/* Card 3: Modernize SSO Adoption */}
          <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-700" />
                <span>3. ขยายผล Single Sign-On (SSO Mode)</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-200 text-sky-900 px-1 rounded">
                {nonSsoCount} ระบบยังไม่ต่อ SSO
              </span>
            </div>
            <p className="text-[11px] text-sky-900/80 leading-relaxed">
              ระบบอย่าง SAP B1, QMS, และ M365 ยังใช้ Direct Authentication การปรับไปใช้ OIDC PKCE (Mode A/B) จะลด Ticket การรีเซ็ตรหัสผ่านของฝ่าย IT ลงได้มากกว่า 85%
            </p>
            <div className="pt-1 text-[11px]">
              <Link href="/applications" className="text-sky-800 hover:text-sky-950 font-bold underline">
                → ดูคู่มือและเปิดใช้งาน SSO Mode ในหน้าตั้งค่าระบบลูก
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Security Architecture & AD Gateway Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: AD Sync Agent Gateway */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-2xs space-y-2">
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
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 flex justify-between">
            <span>Gateway Host:</span>
            <span className="text-blue-700 font-bold">http://172.18.0.1:3100</span>
          </div>
        </div>

        {/* Card 2: Single Sign-On Infrastructure */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-2xs space-y-2">
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
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 flex justify-between">
            <span>Issuer URL:</span>
            <span className="text-blue-700 font-bold">https://ciam.windowasia.com</span>
          </div>
        </div>

        {/* Card 3: Governance & Compliance */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-2xs space-y-2">
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
          <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 flex justify-between">
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
