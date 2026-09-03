"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  UserX,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
  Bot,
  Zap,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { ciamApi, OffboardPreview, OffboardExecuteResult } from "@/lib/api";

function OffboardingHubContent() {
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [effectiveDate, setEffectiveDate] = useState("2026-09-03");
  const [reason, setReason] = useState("Resigned");
  const [notes, setNotes] = useState("Standard employee exit clearance completed.");

  const [preview, setPreview] = useState<OffboardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<OffboardExecuteResult | null>(null);

  // Auto preview if username passed in URL
  useEffect(() => {
    if (initialUsername) {
      handlePreview(initialUsername);
    }
  }, [initialUsername]);

  const handlePreview = async (uname: string) => {
    if (!uname.trim()) return;
    try {
      setPreviewLoading(true);
      setPreviewError("");
      setExecuteResult(null);
      const res = await ciamApi.previewOffboard(uname.trim());
      setPreview(res);
    } catch (err: any) {
      setPreviewError(`Failed to fetch user preview: ${err.message || "User not found"}`);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!preview) return;
    try {
      setExecuting(true);
      const res = await ciamApi.executeOffboard({
        username: preview.username,
        effective_date: effectiveDate,
        reason: reason,
        notes: notes,
      });
      setExecuteResult(res);
    } catch (err: any) {
      alert(`Offboarding failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Instant Offboarding Hub</span>
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
              KILLER FEATURE
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            One-Click de-provisioning across Active Directory, Cloud REST APIs, and Legacy RPA Bot Workers.
          </p>
        </div>

        {/* Quick Demo Pre-fills */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">Quick Test:</span>
          <button
            onClick={() => {
              setUsernameInput("kittisak.s");
              handlePreview("kittisak.s");
            }}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-all"
          >
            ⚠️ Ghost: kittisak.s
          </button>
          <button
            onClick={() => {
              setUsernameInput("anuson.t");
              handlePreview("anuson.t");
            }}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded hover:bg-slate-700 transition-all"
          >
            Multi-app: anuson.t
          </button>
        </div>
      </div>

      {/* Step 1: Search and Select Target Employee */}
      <div className="ciam-card p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
            1
          </span>
          <span>Identify Offboarding Target</span>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePreview(usernameInput);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Enter employee username (e.g. kittisak.s, anuson.t, somchai.p)..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={previewLoading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-900/30 flex items-center justify-center space-x-2 shrink-0"
          >
            <span>{previewLoading ? "Calculating..." : "Inspect Blast Radius"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {previewError && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{previewError}</span>
          </div>
        )}
      </div>

      {/* Step 2 & 3: Impact Preview & Departure Details */}
      {preview && !executeResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity Summary Card */}
            <div className="ciam-card p-5 space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Target Identity Profile
              </span>
              <div className="flex items-center space-x-3 pt-1">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold text-lg">
                  {preview.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{preview.full_name}</h3>
                  <div className="text-xs text-slate-400 font-mono">@{preview.username}</div>
                  <div className="text-xs text-slate-400">{preview.department}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">Current AD Status:</span>
                <span
                  className={`font-bold ${
                    preview.ad_current_status === "ACTIVE" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {preview.ad_current_status}
                </span>
              </div>
            </div>

            {/* Departure Metadata Form */}
            <div className="md:col-span-2 ciam-card p-5 space-y-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Departure Clearance Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Effective Departure Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Reason for Departure</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Resigned">Resigned (ลาออกตามปกติ)</option>
                    <option value="Terminated">Terminated (พ้นสภาพการจ้างงาน)</option>
                    <option value="Contract Ended">Contract Ended (สิ้นสุดสัญญาจ้าง)</option>
                    <option value="Security Incident">Security Incident (ระงับสิทธิ์ฉุกเฉิน)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Audit Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional IT Audit remarks..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Blast Radius Impact Preview */}
          <div className="ciam-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Blast Radius: {preview.total_apps_affected + 1} Target Systems Will Be Deactivated
                </h3>
                <p className="text-xs text-slate-400">
                  Executing this action will simultaneously revoke credentials in Active Directory and all child applications.
                </p>
              </div>

              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold rounded-lg">
                Orchestrated Execution
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Active Directory Target */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                    AD
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Active Directory (Domain Controller)</div>
                    <div className="text-xs text-slate-400">Sync Gateway at 192.168.12.11:3100</div>
                  </div>
                </div>
                <span className="badge-active px-2.5 py-1 rounded text-xs font-semibold">
                  Disable sAMAccountName
                </span>
              </div>

              {/* Child Apps Targets */}
              {preview.affected_applications.map((app) => (
                <div
                  key={app.application_id}
                  className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        app.connector_type === "RPA_WORKER"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}
                    >
                      {app.connector_type === "RPA_WORKER" ? <Bot className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center space-x-2">
                        <span>{app.app_name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            app.connector_type === "RPA_WORKER" ? "badge-rpa" : "badge-rest"
                          }`}
                        >
                          {app.connector_type === "RPA_WORKER" ? "RPA BOT" : "REST API"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Account: <span className="font-mono text-slate-300">{app.app_username}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-slate-300 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    {app.action_to_take}
                  </span>
                </div>
              ))}
            </div>

            {/* Confirmation & One-Click Execute Button */}
            <div className="pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Audit trail and certificate will be permanently recorded in PostgreSQL.</span>
              </div>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm rounded-xl shadow-xl shadow-rose-900/40 transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                <UserX className={`w-5 h-5 ${executing ? "animate-spin" : ""}`} />
                <span>{executing ? "Executing Across All Systems..." : "DISABLE EVERYWHERE (ระงับสิทธิ์ทุกระบบ)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 & 5: Execution Results Checklist & Offboarding Certificate */}
      {executeResult && (
        <div className="space-y-6 animate-fadeIn print:m-0 print:p-0">
          {/* Success Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/30 to-slate-900 border border-emerald-500/40 shadow-2xl shadow-emerald-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Instant Offboarding Complete!</h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Target identity <span className="font-bold text-white">{executeResult.target_full_name}</span> has been revoked across all enterprise systems.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintCertificate}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-white text-slate-950 hover:bg-slate-200 font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate (PDF)</span>
                </button>
                <button
                  onClick={() => {
                    setExecuteResult(null);
                    setPreview(null);
                    setUsernameInput("");
                  }}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                >
                  New Offboard
                </button>
              </div>
            </div>
          </div>

          {/* Results Checklist */}
          <div className="ciam-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Execution Results Checklist
            </h3>

            <div className="space-y-2.5">
              {executeResult.checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        item.status === "SUCCESS" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {item.status === "SUCCESS" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center space-x-2">
                        <span>{item.app_name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({item.execution_mode})</span>
                      </div>
                      <div className="text-xs text-slate-400">{item.message}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.status === "SUCCESS" ? "badge-active" : "badge-inactive"
                      }`}
                    >
                      {item.status}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.execution_time_ms} ms</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offboarding Certificate Card (Printable) */}
          <div className="ciam-card-glow p-8 space-y-6 bg-slate-950 border border-slate-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 font-bold">
                  Official Verification Document
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  Enterprise Access De-provisioning Certificate
                </h2>
                <p className="text-xs text-slate-400">ISO 27001 / PDPA Access Governance Compliance</p>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Certificate ID</div>
                <div className="text-sm font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 mt-0.5">
                  {executeResult.certificate_id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Employee Name:</span>
                <p className="font-bold text-white text-sm mt-0.5">{executeResult.target_full_name}</p>
              </div>
              <div>
                <span className="text-slate-400">Username:</span>
                <p className="font-mono text-indigo-300 mt-0.5">{executeResult.target_username}</p>
              </div>
              <div>
                <span className="text-slate-400">Department:</span>
                <p className="text-white mt-0.5">{executeResult.target_department || "General"}</p>
              </div>
              <div>
                <span className="text-slate-400">Departure Reason:</span>
                <p className="font-semibold text-amber-300 mt-0.5">{executeResult.reason}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Executed At (UTC):</span>
                <span className="font-mono text-slate-200">
                  {new Date(executeResult.executed_at).toUTCString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Authorizing Officer:</span>
                <span className="text-slate-200">{executeResult.actor_username} (IT Security Lead)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Overall Governance Status:</span>
                <span className="text-emerald-400 font-bold uppercase">{executeResult.overall_status}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
              <span>Window Asia Public Company Limited • Central IAM Governance Engine</span>
              <span>Digitally Signed & Validated</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OffboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Loading Instant Offboarding Hub...</p>
        </div>
      }
    >
      <OffboardingHubContent />
    </Suspense>
  );
}
