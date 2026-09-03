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
  Zap,
  Bot,
  RefreshCw,
  Clock,
} from "lucide-react";
import { ciamApi, DashboardSummary } from "@/lib/api";

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
    <div className="space-y-8 animate-fadeIn">
      {/* Header with Title and Quick Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Identity Governance Dashboard</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time security monitoring, cross-system reconciliation, and access control overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboard}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <Link
            href="/offboarding"
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-sm font-medium shadow-lg shadow-rose-900/30 transition-all transform hover:-translate-y-0.5"
          >
            <UserX className="w-4 h-4" />
            <span>Instant Offboard</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="ciam-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Enterprise Identities
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {loading ? "..." : data?.kpi.total_identities}
            </span>
            <span className="text-xs text-slate-400 ml-2">in Active Directory</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Source of Truth</span>
            <span className="font-mono text-indigo-400">AD: 192.168.12.11</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="ciam-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Accounts
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {loading ? "..." : data?.kpi.active_accounts}
            </span>
            <span className="text-xs text-emerald-400 ml-2">Authorized</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Compliance Rate</span>
            <span className="text-emerald-400 font-semibold">100% Verified</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="ciam-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              De-provisioned Accounts
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {loading ? "..." : data?.kpi.deprovisioned_accounts}
            </span>
            <span className="text-xs text-rose-400 ml-2">Safely Revoked</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Zero-Access Enforced</span>
            <span className="text-rose-400 font-semibold">Audited</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="ciam-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Connected Systems
            </span>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {loading ? "..." : `${data?.kpi.connected_systems_online}/${data?.kpi.connected_systems_total}`}
            </span>
            <span className="text-xs text-cyan-400 ml-2">Online</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Hybrid Architecture</span>
            <span className="text-cyan-400 font-semibold">REST + RPA Bots</span>
          </div>
        </div>
      </div>

      {/* Reconciliation Warning Box (Ghost Accounts Alert) */}
      {data?.discrepancies && data.discrepancies.length > 0 ? (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 shadow-2xl shadow-amber-950/30 animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-amber-300">
                    Security Alert: {data.discrepancies.length} Orphaned / Ghost Accounts Detected!
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-300 rounded">
                    HIGH RISK
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                  พนักงานถูกระงับสิทธิ์ใน Active Directory แล้ว แต่ยังพบสถานะ <span className="font-semibold text-amber-400">Active</span> ค้างอยู่ในระบบลูก เสี่ยงต่อการรั่วไหลของข้อมูลตามมาตรฐาน ISO 27001
                </p>

                {/* List preview of ghost accounts */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.discrepancies.map((d, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-amber-500/30 text-xs text-slate-200 flex items-center space-x-2"
                    >
                      <span className="font-semibold text-white">{d.full_name}</span>
                      <span className="text-slate-400 font-mono">({d.username})</span>
                      <span className="text-amber-400 font-semibold">in {d.app_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/offboarding"
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <span>Review & Fix Discrepancies</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20 flex items-center space-x-3 text-sm text-emerald-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>No orphaned or ghost accounts detected. All enterprise applications are 100% synchronized with Active Directory.</span>
        </div>
      )}

      {/* Grid: Hybrid Connector Status & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-time Activity Feed */}
        <div className="lg:col-span-2 ciam-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Recent Governance Activity</h2>
              <p className="text-xs text-slate-400">Real-time audit stream of permissions & deprovisioning events</p>
            </div>
            <Link
              href="/audit-logs"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
            >
              <span>View full audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-sm">Loading activity records...</div>
            ) : data?.recent_activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No recent activity logged yet.</div>
            ) : (
              data?.recent_activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        act.action_type === "OFFBOARD_USER"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : act.action_type === "ENABLE_USER"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
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
                      <div className="text-sm font-medium text-slate-200 flex items-center space-x-2">
                        <span>{act.action_type.replace("_", " ")}</span>
                        <span className="text-slate-400">for</span>
                        <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs">
                          {act.target_username}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span>by {act.actor_username}</span>
                        <span>•</span>
                        <span>App: {act.affected_app_code?.toUpperCase() || "ALL"}</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 font-mono text-[10px]">
                          {act.execution_mode === "ASYNC_RPA" ? (
                            <span className="text-cyan-400">RPA Bot Worker</span>
                          ) : act.execution_mode === "SYNC_REST" ? (
                            <span className="text-indigo-400">REST API</span>
                          ) : (
                            <span className="text-emerald-400">AD LDAP</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                        act.status === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {act.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Hybrid Architecture Explainer */}
        <div className="ciam-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Hybrid Connector Status</h2>
            <p className="text-xs text-slate-400 mb-5">Unified execution across modern APIs and legacy bots</p>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span>Direct REST API (M2M)</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 rounded">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Used for modern systems like <strong>IRM</strong> and <strong>QMS</strong> with instant sub-second token de-provisioning.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-2 text-xs font-semibold text-cyan-300">
                    <Bot className="w-4 h-4 text-cyan-400" />
                    <span>In-House RPA Bot Worker</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 rounded">
                    Adapter Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Headless automation runner for legacy apps like <strong>SAP B1 / Legacy ERP</strong> without APIs, logging automated UI clicks.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Security Framework</span>
            <span className="font-semibold text-slate-300">ISO 27001 / PDPA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
