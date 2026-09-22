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
} from "lucide-react";
import { ciamApi, DashboardSummary } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const res = await ciamApi.getDashboardSummary();
      setData(res);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ภาพรวมการจัดการสิทธิ์
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              ระบบออนไลน์
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ระบบติดตามสถานะบัญชีพนักงาน การตรวจจับสิทธิ์ไม่ตรงกัน และการเชื่อมต่อระบบ
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchDashboard}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white border-2 border-slate-300 text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-100 hover:border-slate-400 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : "text-slate-600"}`} />
            <span>{refreshing ? "กำลังรีเฟรช..." : "รีเฟรช"}</span>
          </button>
          <Link
            href="/offboarding"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <UserX className="w-4 h-4" />
            <span>ระงับสิทธิ์พนักงาน</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid - High Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Identities */}
        <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              จำนวนตัวตนทั้งหมด
            </span>
            <div className="w-9 h-9 rounded-md bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? "..." : data?.kpi.total_identities}
            </span>
            <span className="text-xs text-slate-600 font-semibold ml-2">ใน Active Directory</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>แหล่งข้อมูลหลัก:</span>
            <span className="font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              192.168.12.11
            </span>
          </div>
        </div>

        {/* KPI 2: Active Accounts */}
        <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              บัญชีที่เปิดใช้งาน
            </span>
            <div className="w-9 h-9 rounded-md bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-2xs">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? "..." : data?.kpi.active_accounts}
            </span>
            <span className="text-xs text-emerald-700 ml-2 font-bold">มีสิทธิ์ใช้งาน</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>สถานะระบบ:</span>
            <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ปกติ 100%
            </span>
          </div>
        </div>

        {/* KPI 3: Deprovisioned Accounts */}
        <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs hover:border-rose-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              บัญชีที่ถูกระงับสิทธิ์
            </span>
            <div className="w-9 h-9 rounded-md bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shadow-2xs">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? "..." : data?.kpi.deprovisioned_accounts}
            </span>
            <span className="text-xs text-rose-700 ml-2 font-bold">ตัดสิทธิ์สมบูรณ์</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>การระงับสิทธิ์:</span>
            <span className="text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Zero-Access
            </span>
          </div>
        </div>

        {/* KPI 4: Connected Systems */}
        <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs hover:border-cyan-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              ระบบที่เชื่อมต่อ
            </span>
            <div className="w-9 h-9 rounded-md bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? "..." : `${data?.kpi.connected_systems_online}/${data?.kpi.connected_systems_total}`}
            </span>
            <span className="text-xs text-cyan-800 ml-2 font-bold">ระบบพร้อมใช้งาน</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>โปรโตคอล:</span>
            <span className="text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              M2M REST API
            </span>
          </div>
        </div>
      </div>

      {/* Discrepancies Alert Box (Ghost Accounts) - Strong Contrast */}
      {data?.discrepancies && data.discrepancies.length > 0 ? (
        <div className="p-5 rounded-lg bg-amber-50 border-2 border-amber-400 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-amber-900 shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-amber-950">
                    ตรวจพบบัญชีตกค้างในระบบลูก (Ghost Accounts) จำนวน {data.discrepancies.length} รายการ
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-extrabold bg-amber-500 text-white rounded shadow-2xs">
                    ความเสี่ยงสูง
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-900 font-medium mt-1 max-w-2xl leading-relaxed">
                  พนักงานถูกปิดการใช้งานใน Active Directory แล้ว แต่ยังพบสถานะเปิดใช้งานอยู่ในระบบลูก เสี่ยงต่อการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาตตามมาตรฐาน ISO 27001
                </p>

                {/* List preview of ghost accounts */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.discrepancies.map((d, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded bg-white border-2 border-amber-300 text-xs text-slate-900 flex items-center space-x-2 shadow-xs"
                    >
                      <span className="font-bold text-slate-900">{d.full_name}</span>
                      <span className="text-slate-600 font-mono font-semibold">({d.username})</span>
                      <span className="text-amber-900 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                        ในระบบ {d.app_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/offboarding"
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm transition-colors shrink-0 shadow-sm"
            >
              <span>จัดการสิทธิ์พนักงาน</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-300 flex items-center space-x-3 text-xs sm:text-sm text-emerald-900 font-bold shadow-2xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>ไม่พบบัญชีตกค้าง ทุกระบบลูกสอดคล้องกับ Active Directory 100%</span>
        </div>
      )}

      {/* Grid: Recent Activity Feed & Connection Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Activity Feed */}
        <div className="lg:col-span-2 bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">ประวัติกิจกรรมล่าสุด</h2>
              <p className="text-xs text-slate-600 font-medium">บันทึกเหตุการณ์การจัดการสิทธิ์และระงับบัญชี</p>
            </div>
            <Link
              href="/audit-logs"
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
            >
              <span>ดูประวัติทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-xs sm:text-sm font-medium">กำลังโหลดข้อมูล...</div>
            ) : data?.recent_activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs sm:text-sm font-medium">ยังไม่มีบันทึกกิจกรรมล่าสุด</div>
            ) : (
              data?.recent_activities.map((act) => {
                const actionLabels: Record<string, string> = {
                  OFFBOARD_USER: "ระงับสิทธิ์",
                  ENABLE_USER: "เปิดใช้งานสิทธิ์",
                  CREATE_USER: "สร้างผู้ใช้ใหม่",
                  PROVISION_USER: "แจกจ่ายสิทธิ์",
                  SYNC: "ซิงก์ข้อมูล",
                  PING: "ทดสอบการเชื่อมต่อ",
                };

                return (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-300 hover:bg-blue-50/40 hover:border-blue-300 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shadow-2xs ${
                          act.action_type === "OFFBOARD_USER"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : act.action_type === "ENABLE_USER"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        {act.action_type === "OFFBOARD_USER" ? (
                          <UserX className="w-4 h-4" />
                        ) : act.action_type === "ENABLE_USER" ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-2">
                          <span>{actionLabels[act.action_type] || act.action_type}</span>
                          <span className="text-slate-500 font-normal">สำหรับ</span>
                          <span className="font-mono text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.2 rounded text-xs font-bold">
                            {act.target_username}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium flex items-center space-x-2 mt-0.5">
                          <span>โดย {act.actor_username}</span>
                          <span>•</span>
                          <span>ระบบ: <strong className="text-slate-800">{act.affected_app_code?.toUpperCase() || "ALL"}</strong></span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-700 font-semibold">
                            {act.execution_mode}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded shadow-2xs ${
                          act.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-rose-100 text-rose-900 border border-rose-300"
                        }`}
                      >
                        {act.status === "SUCCESS" ? "สำเร็จ" : "ล้มเหลว"}
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono font-medium mt-1">
                        {formatDateTime(act.created_at, false)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Connector Architecture Explainer */}
        <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">การเชื่อมต่อระบบ</h2>
            <p className="text-xs text-slate-600 font-medium mb-4">รูปแบบการทำงานระหว่าง CIAM กับระบบปลายทาง</p>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span>M2M REST API</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 border border-blue-200 rounded font-bold">
                    ระบบลูก
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  เชื่อมต่อตรงกับระบบ <strong>IRM</strong> และ <strong>QMS</strong> เพื่อจัดการสิทธิ์ สร้างบัญชี และระงับบัญชีแบบเรียลไทม์
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <span>AD Sync Agent</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-bold">
                    พอร์ต 3100
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  ควบคุมการ Disable / Enable บัญชีใน Domain Controller ผ่าน Security Gateway ป้องกันความเสี่ยงตามมาตรฐาน ISO 27001
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t-2 border-slate-200 text-xs text-slate-600 font-semibold flex items-center justify-between">
            <span>มาตรฐานกำกับดูแล:</span>
            <span className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
              ISO 27001 / PDPA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
