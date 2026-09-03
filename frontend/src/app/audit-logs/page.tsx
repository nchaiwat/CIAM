"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2,
  Download,
  Search,
  Filter,
  Shield,
  Clock,
  User,
  Layers,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { ciamApi, AuditLogItem } from "@/lib/api";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await ciamApi.getAuditLogs({
        search: search || undefined,
        action_type: actionFilter || undefined,
        status: statusFilter || undefined,
        page: page,
        page_size: 25,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Audit Trail & Compliance Records</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              ISO 27001 Ready
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable transaction history of all identity lifecycle actions, access revocations, and automated bot runs.
          </p>
        </div>

        {/* CSV Export Button */}
        <a
          href={ciamApi.getExportCsvUrl()}
          download="ciam_audit_logs.csv"
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold transition-all shadow-md self-start"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export Audit to CSV</span>
        </a>
      </div>

      {/* Filter Bar */}
      <div className="ciam-card p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by actor, target employee username, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="OFFBOARD_USER">OFFBOARD_USER</option>
              <option value="ENABLE_USER">ENABLE_USER</option>
              <option value="SYNC">SYNC</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Audit Table */}
      <div className="ciam-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
                <th className="py-3.5 px-4">Authorizing Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Identity</th>
                <th className="py-3.5 px-4">Affected Spoke</th>
                <th className="py-3.5 px-4">Execution Mode</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {log.actor_username}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          log.action_type === "OFFBOARD_USER"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : log.action_type === "ENABLE_USER"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}
                      >
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-indigo-300 font-semibold">
                      {log.target_username}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-xs font-semibold text-slate-300">
                      {log.affected_app_code || "ALL"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          log.execution_mode === "ASYNC_RPA"
                            ? "badge-rpa"
                            : log.execution_mode === "SYNC_REST"
                            ? "badge-rest"
                            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        }`}
                      >
                        {log.execution_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          log.status === "SUCCESS"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-rose-400 bg-rose-500/10"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 truncate max-w-xs">
                      {log.reason || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {logs.length} of {total} total audit records</span>
          <span className="font-mono text-slate-500">Non-repudiation verified</span>
        </div>
      </div>
    </div>
  );
}
