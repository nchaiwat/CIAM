"use client";

import { useEffect, useState } from "react";
import {
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { ciamApi, AuditLogItem } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ประวัติการใช้งานและตรวจสอบ
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full shadow-2xs">
              ISO 27001 Ready
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ประวัติการดำเนินงานทั้งหมด การระงับสิทธิ์ และการเข้าถึงระบบ แบบไม่สามารถแก้ไขย้อนหลังได้ (Immutable Audit Trail)
          </p>
        </div>

        {/* CSV Export Button */}
        <a
          href={ciamApi.getExportCsvUrl()}
          download="ciam_audit_logs.csv"
          className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-md text-xs sm:text-sm font-bold transition-colors shadow-xs self-start"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          <span>ส่งออก Audit เป็น CSV</span>
        </a>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border-2 border-slate-300 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาตามผู้ดำเนินการ, Username เป้าหมาย หรือเหตุผล..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-white border-2 border-slate-300 rounded-md text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">ทุกการกระทำ</option>
              <option value="OFFBOARD_USER">ระงับสิทธิ์ (OFFBOARD_USER)</option>
              <option value="ENABLE_USER">เปิดใช้งานสิทธิ์ (ENABLE_USER)</option>
              <option value="CREATE_USER">สร้างผู้ใช้ (CREATE_USER)</option>
              <option value="PROVISION_USER">แจกจ่ายสิทธิ์ (PROVISION_USER)</option>
              <option value="SYNC">ซิงก์ข้อมูล (SYNC)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">ทุกสถานะ</option>
              <option value="SUCCESS">สำเร็จ (SUCCESS)</option>
              <option value="FAILED">ล้มเหลว (FAILED)</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
            >
              กรองข้อมูล
            </button>
          </div>
        </form>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-lg border-2 border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-800">
            <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">วันและเวลา</th>
                <th className="py-3.5 px-4">ผู้ดำเนินการ</th>
                <th className="py-3.5 px-4">การกระทำ</th>
                <th className="py-3.5 px-4">ผู้ใช้เป้าหมาย</th>
                <th className="py-3.5 px-4">ระบบที่เกี่ยวข้อง</th>
                <th className="py-3.5 px-4">โหมด</th>
                <th className="py-3.5 px-4">สถานะ</th>
                <th className="py-3.5 px-4">เหตุผล / หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    กำลังโหลดประวัติการตรวจสอบ...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    ไม่พบรายการประวัติที่ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 font-semibold whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {log.actor_username}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold shadow-2xs ${
                          log.action_type === "OFFBOARD_USER"
                            ? "bg-rose-100 text-rose-900 border border-rose-300"
                            : log.action_type === "ENABLE_USER"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-blue-100 text-blue-900 border border-blue-300"
                        }`}
                      >
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-blue-700 font-bold">
                      {log.target_username}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-xs font-bold text-slate-800">
                      {log.affected_app_code || "ALL"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {log.execution_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold shadow-2xs ${
                          log.status === "SUCCESS"
                            ? "text-emerald-900 bg-emerald-100 border border-emerald-300"
                            : "text-rose-900 bg-rose-100 border border-rose-300"
                        }`}
                      >
                        {log.status === "SUCCESS" ? "สำเร็จ" : "ล้มเหลว"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium truncate max-w-xs">
                      {log.reason || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t-2 border-slate-200 bg-slate-100/90 flex items-center justify-between text-xs text-slate-700 font-bold">
          <span>แสดง {logs.length} จากทั้งหมด {total} รายการ</span>
          <span>ตรวจสอบความถูกต้องตามมาตรฐาน ISO 27001 แล้ว</span>
        </div>
      </div>
    </div>
  );
}
