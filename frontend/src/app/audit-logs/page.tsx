"use client";

import { useEffect, useState } from "react";
import {
  Search,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  X,
  Eye,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  ShieldCheck,
  Info
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

  // Detail Modal States
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse details JSON
  const parseLogDetails = (detailsStr: string | null) => {
    if (!detailsStr) return null;
    try {
      return JSON.parse(detailsStr);
    } catch {
      return null;
    }
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
            ประวัติการดำเนินงานทั้งหมด การระงับสิทธิ์ การเข้าถึงระบบ และผลการตอบกลับจาก Active Directory Sync Agent แบบละเอียด (Immutable Audit Trail)
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
              <option value="ADMIN_LOGIN_SUCCESS">ล็อกอินสำเร็จ (LOGIN_SUCCESS)</option>
              <option value="ADMIN_LOGIN_FAILED">ล็อกอินล้มเหลว (LOGIN_FAILED)</option>
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
                <th className="py-3.5 px-4 text-center">วิเคราะห์ / เจาะลึก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    กำลังโหลดประวัติการตรวจสอบ...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    ไม่พบรายการประวัติที่ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                    title="คลิกเพื่อดูรายละเอียดและผลการตอบกลับจากระบบแบบเต็มจอ"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 font-semibold whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {log.actor_username}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold shadow-2xs ${
                          log.action_type === "OFFBOARD_USER" || log.action_type === "ADMIN_LOGIN_FAILED"
                            ? "bg-rose-100 text-rose-900 border border-rose-300"
                            : log.action_type === "ENABLE_USER" || log.action_type === "ADMIN_LOGIN_SUCCESS"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-blue-100 text-blue-900 border border-blue-300"
                        }`}
                      >
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-blue-700 font-bold whitespace-nowrap">
                      {log.target_username}
                    </td>
                    <td className="py-3.5 px-4 uppercase text-xs font-bold text-slate-800 whitespace-nowrap">
                      {log.affected_app_code || "ALL"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {log.execution_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
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
                    <td className="py-3.5 px-4 text-xs text-slate-700 font-medium min-w-[280px]">
                      <div className="whitespace-normal break-words leading-relaxed" title={log.reason || ""}>
                        {log.reason || "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-300 hover:border-blue-600 transition-all shadow-2xs group-hover:bg-blue-600 group-hover:text-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูข้อมูล</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t-2 border-slate-200 bg-slate-100/90 flex items-center justify-between text-xs text-slate-700 font-bold">
          <span>แสดง {logs.length} จากทั้งหมด {total} รายการ (คลิกที่แถวเพื่อเปิดดูข้อมูลเชิงลึกแบบเต็มจอ)</span>
          <span>ตรวจสอบความถูกต้องตามมาตรฐาน ISO 27001 แล้ว</span>
        </div>
      </div>

      {/* Detail / Fullscreen Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`bg-white rounded-xl shadow-2xl border-2 border-slate-400 flex flex-col transition-all duration-200 overflow-hidden ${
              isFullScreen
                ? "w-full h-full fixed inset-0 rounded-none border-none"
                : "w-full max-w-5xl max-h-[90vh]"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-200 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    รายละเอียด Audit Log ID #{selectedLog.id}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                        selectedLog.status === "SUCCESS"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {selectedLog.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {formatDateTime(selectedLog.created_at)} | ผู้ใช้เป้าหมาย: <strong className="text-slate-200">{selectedLog.target_username}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title={isFullScreen ? "ย่อขนาดจอ" : "ขยายจอให้เต็ม (Full Screen)"}
                >
                  {isFullScreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedLog(null);
                    setIsFullScreen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  title="ปิด"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              {/* Metadata Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">การกระทำ (Action)</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 break-words">{selectedLog.action_type}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">ผู้ดำเนินการ (Actor)</span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 break-words">{selectedLog.actor_username}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">IP Address</span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 break-words">{selectedLog.ip_address || "N/A"}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">โหมดการประมวลผล</span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-blue-700 break-words">{selectedLog.execution_mode}</span>
                </div>
              </div>

              {/* Reason / Summary Card */}
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-700">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>เหตุผล / ข้อความสรุปจากระบบ (Reason):</span>
                </div>
                <div className="p-3 bg-slate-100 rounded border border-slate-300 font-mono text-xs sm:text-sm text-slate-900 break-words leading-relaxed">
                  {selectedLog.reason || "ไม่มีข้อความเหตุผล"}
                </div>
              </div>

              {/* Special Section: AD Gateway Responses & Probes */}
              {(() => {
                const parsedDetails = parseLogDetails(selectedLog.details);
                const probes = parsedDetails?.ad_gateway_probes;

                if (probes && Array.isArray(probes) && probes.length > 0) {
                  return (
                    <div className="bg-white rounded-lg border-2 border-blue-300 shadow-xs overflow-hidden">
                      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-blue-700" />
                          <h4 className="text-xs sm:text-sm font-extrabold text-blue-900">
                            ผลการตอบกลับจาก Active Directory Sync Agent (พอร์ต 3100)
                          </h4>
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                          {probes.length} ครั้งที่ส่งทดสอบ
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200">
                        {probes.map((probe: any, idx: number) => (
                          <div key={idx} className="p-4 space-y-2 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-slate-500">#{idx + 1}</span>
                                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded text-slate-800">
                                  App ID: {probe.app_id}
                                </span>
                                <span className="text-xs font-mono text-slate-600">
                                  User: {probe.user}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-500">
                                  {probe.url}
                                </span>
                                {probe.status_code ? (
                                  <span
                                    className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                                      probe.status_code === 200
                                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                        : "bg-rose-100 text-rose-900 border border-rose-300"
                                    }`}
                                  >
                                    HTTP {probe.status_code}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300 rounded">
                                    CONNECTION FAILED
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Raw Return Body from Gateway */}
                            <div>
                              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                                ค่าที่ AD Gateway ส่งกลับมาจริง (Raw Response Body):
                              </span>
                              <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-md overflow-x-auto whitespace-pre-wrap break-all shadow-inner border border-slate-800">
                                {probe.response || probe.error || "ไม่มีเนื้อหาตอบกลับ"}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Complete Raw Details (JSON Viewer) */}
              <div className="bg-white rounded-lg border-2 border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">
                      ข้อมูลบันทึกทางเทคนิคทั้งหมด (Raw Audit Details JSON / Diagnostic):
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyDetails(selectedLog.details || "")}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอก JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-slate-950 text-slate-200 overflow-x-auto">
                  <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-96">
                    {(() => {
                      const parsed = parseLogDetails(selectedLog.details);
                      if (parsed) {
                        return JSON.stringify(parsed, null, 2);
                      }
                      return selectedLog.details || "ไม่มีข้อมูลรายละเอียดเพิ่มเติม";
                    })()}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                ข้อมูลบันทึกนี้เป็นส่วนหนึ่งของระบบตรวจสอบสิทธิ์และป้องกันการแก้ไขย้อนหลัง
              </span>
              <button
                onClick={() => {
                  setSelectedLog(null);
                  setIsFullScreen(false);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
