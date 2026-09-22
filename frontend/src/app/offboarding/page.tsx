"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  UserX,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Printer,
  ShieldAlert,
  ArrowRight,
  Zap,
} from "lucide-react";
import { ciamApi, OffboardPreview, OffboardExecuteResult, UserListItem } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/date";

function OffboardingHubContent() {
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("Resigned");
  const [notes, setNotes] = useState("เสร็จสิ้นกระบวนการส่งมอบงานและคืนทรัพย์สินบริษัท");

  const [preview, setPreview] = useState<OffboardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<OffboardExecuteResult | null>(null);

  useEffect(() => {
    ciamApi.getUsers().then(setAllUsers).catch(console.error);
  }, []);

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
      setPreviewError(`ไม่พบข้อมูลพนักงาน: ${err.message || "User not found"}`);
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
      alert(`การระงับสิทธิ์ล้มเหลว: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ศูนย์ระงับสิทธิ์พนักงาน
            </h1>
            <span className="px-3 py-0.5 text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 rounded-full shadow-2xs">
              1-Click Offboarding
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ตัดสิทธิ์พนักงานพร้อมกันข้าม Active Directory และระบบลูกทั้งหมด พร้อมออกใบรับรองสากล
          </p>
        </div>
      </div>

      {/* Step 1: Search and Select Target Employee */}
      <div className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2.5">
          <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
            1
          </span>
          <span>ระบุพนักงานเป้าหมาย</span>
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
              placeholder="กรอกชื่อ, นามสกุล หรือ Username (เช่น Hermes, Patcha, Chaiwat)..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-md text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={previewLoading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-md transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0"
          >
            <span>{previewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบผลกระทบรายระบบ"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Suggestions */}
        {!preview && allUsers.length > 0 && (
          <div className="pt-3 border-t-2 border-slate-200">
            <div className="text-xs text-slate-600 font-bold mb-2">เลือกพนักงานด่วน:</div>
            <div className="flex flex-wrap gap-2">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setUsernameInput(u.username);
                    handlePreview(u.username);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border-2 flex items-center space-x-1.5 transition-all shadow-2xs ${
                    u.has_discrepancy
                      ? "bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200"
                      : "bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  <span>{u.full_name}</span>
                  <span className="font-mono text-slate-600 font-bold">({u.username})</span>
                  {u.has_discrepancy && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-amber-950 rounded font-black">
                      บัญชีผี
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {previewError && (
          <div className="p-3.5 rounded-md bg-rose-50 border-2 border-rose-400 text-rose-900 text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
            <span>{previewError}</span>
          </div>
        )}
      </div>

      {/* Step 2 & 3: Impact Preview & Departure Details */}
      {preview && !executeResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Identity Summary Card */}
            <div className="bg-white p-5 rounded-lg border-2 border-slate-300 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                ข้อมูลพนักงานเป้าหมาย
              </span>
              <div className="flex items-center space-x-3 pt-1">
                <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-800 font-extrabold text-lg shadow-2xs">
                  {preview.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{preview.full_name}</h3>
                  <div className="text-xs font-mono text-blue-700 font-bold">@{preview.username}</div>
                  <div className="text-xs text-slate-600 font-semibold">{preview.department}</div>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-600 font-medium">สถานะใน AD:</span>
                <span
                  className={`font-extrabold ${
                    preview.ad_current_status === "ACTIVE" ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {preview.ad_current_status === "ACTIVE" ? "เปิดใช้งานใน AD" : "ปิดใช้งานใน AD"}
                </span>
              </div>
            </div>

            {/* Departure Metadata Form */}
            <div className="md:col-span-2 bg-white p-5 rounded-lg border-2 border-slate-300 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                รายละเอียดการพ้นสภาพ
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-700 mb-1 font-bold">วันที่มีผล</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-700 mb-1 font-bold">สาเหตุการพ้นสภาพ</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  >
                    <option value="Resigned">ลาออกตามปกติ (Resigned)</option>
                    <option value="Terminated">พ้นสภาพการจ้างงาน (Terminated)</option>
                    <option value="Contract Ended">สิ้นสุดสัญญาจ้าง (Contract Ended)</option>
                    <option value="Security Incident">ระงับสิทธิ์ฉุกเฉิน (Security Incident)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 mb-1 font-bold">บันทึกเพิ่มเติม / หมายเหตุ</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ระบุหมายเหตุสำหรับการตรวจสอบ..."
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Blast Radius Impact Preview */}
          <div className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ระบบเป้าหมายที่จะถูกระงับสิทธิ์ ({preview.total_apps_affected + 1} ระบบ)
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  ระบบจะส่งคำสั่งตัดสิทธิ์ไปยัง Active Directory และระบบลูกพร้อมกัน
                </p>
              </div>

              <span className="px-3 py-1 bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded">
                ทำงานอัตโนมัติ
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Active Directory Target */}
              <div className="p-3.5 rounded-lg bg-slate-50 border-2 border-slate-300 flex items-center justify-between shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                    AD
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Active Directory (Domain Controller)</div>
                    <div className="text-xs text-slate-600 font-medium">ผ่าน AD Sync Agent พอร์ต 3100</div>
                  </div>
                </div>
                <span className="bg-rose-100 text-rose-900 border border-rose-300 px-3 py-1 rounded text-xs font-bold shadow-2xs">
                  Disable sAMAccountName
                </span>
              </div>

              {/* Child Apps Targets */}
              {preview.affected_applications.map((app) => (
                <div
                  key={app.application_id}
                  className="p-3.5 rounded-lg bg-slate-50 border-2 border-slate-300 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-md bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center text-xs shadow-2xs">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <span>{app.app_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-100 text-blue-800 border border-blue-200 font-bold">
                          REST API
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        บัญชี: <span className="font-mono text-slate-900 font-bold">{app.app_username}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-slate-800 bg-white px-3 py-1 rounded-md border-2 border-slate-300 font-bold shadow-2xs">
                    {app.action_to_take}
                  </span>
                </div>
              ))}
            </div>

            {/* Confirmation & One-Click Execute Button */}
            <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs text-slate-600 font-semibold">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <span>ระบบจะบันทึก Audit Trail และออกใบรับรองความปลอดภัยอย่างถาวร</span>
              </div>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full sm:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <UserX className={`w-5 h-5 ${executing ? "animate-spin" : ""}`} />
                <span>{executing ? "กำลังตัดสิทธิ์ทุกระบบ..." : "ยืนยันระงับสิทธิ์ทุกระบบทันที (DISABLE EVERYWHERE)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Execution Results Checklist & Offboarding Certificate */}
      {executeResult && (
        <div className="space-y-6 print:m-0 print:p-0">
          {/* Success Banner */}
          <div className="p-6 rounded-lg bg-emerald-50 border-2 border-emerald-400 text-emerald-950 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-200 border-2 border-emerald-400 text-emerald-900 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black">ระงับสิทธิ์ทุกระบบสำเร็จเรียบร้อย</h2>
                  <p className="text-xs sm:text-sm text-emerald-900 font-medium mt-0.5">
                    พนักงาน <span className="font-bold underline">{executeResult.target_full_name}</span> ได้รับการตัดสิทธิ์ออกจากระบบทั้งหมดแล้ว
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={handlePrintCertificate}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-md shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์ใบรับรอง (PDF)</span>
                </button>
                <button
                  onClick={() => {
                    setExecuteResult(null);
                    setPreview(null);
                    setUsernameInput("");
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md transition-colors shadow-xs"
                >
                  ระงับสิทธิ์พนักงานท่านอื่น
                </button>
              </div>
            </div>
          </div>

          {/* Results Checklist */}
          <div className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              รายการผลการตัดสิทธิ์แยกตามระบบ
            </h3>

            <div className="space-y-2.5">
              {executeResult.checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center ${
                        item.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {item.status === "SUCCESS" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <span>{item.app_name}</span>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold">({item.execution_mode})</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">{item.message}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-extrabold ${
                        item.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : "bg-rose-100 text-rose-900 border border-rose-300"
                      }`}
                    >
                      {item.status === "SUCCESS" ? "สำเร็จ" : "ล้มเหลว"}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.execution_time_ms} ms</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offboarding Certificate Card (Printable) */}
          <div className="bg-white p-8 rounded-lg border-4 border-slate-900 shadow-md space-y-6 text-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-5">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-blue-700 font-black">
                  เอกสารรับรองความมั่นคงปลอดภัยสารสนเทศ
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  ใบรับรองการระงับสิทธิ์การเข้าถึงระบบสารสนเทศ
                </h2>
                <p className="text-xs text-slate-600 font-medium">ISO 27001 / PDPA Access Governance Compliance</p>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-600 font-mono uppercase font-bold">Certificate ID</div>
                <div className="text-sm font-black font-mono text-slate-950 bg-slate-100 px-3 py-1 rounded border-2 border-slate-400 mt-1">
                  {executeResult.certificate_id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-600 font-semibold">ชื่อ-นามสกุล พนักงาน:</span>
                <p className="font-extrabold text-slate-950 text-sm mt-0.5">{executeResult.target_full_name}</p>
              </div>
              <div>
                <span className="text-slate-600 font-semibold">Username:</span>
                <p className="font-mono text-blue-700 font-black text-sm mt-0.5">{executeResult.target_username}</p>
              </div>
              <div>
                <span className="text-slate-600 font-semibold">แผนก:</span>
                <p className="text-slate-900 font-bold mt-0.5">{executeResult.target_department || "ทั่วไป"}</p>
              </div>
              <div>
                <span className="text-slate-600 font-semibold">สาเหตุการพ้นสภาพ:</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{executeResult.reason}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-300 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">วันและเวลาที่ดำเนินการ:</span>
                <span className="font-mono text-slate-900 font-bold">
                  {formatDateTime(executeResult.executed_at)} น.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">เจ้าหน้าที่ผู้ดำเนินการ:</span>
                <span className="text-slate-900 font-bold">{executeResult.actor_username} (ผู้ดูแลระบบความปลอดภัย IT)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">ผลการกำกับดูแล:</span>
                <span className="text-emerald-800 font-black uppercase text-sm">สำเร็จสมบูรณ์ (Zero Access)</span>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-slate-800 flex justify-between items-center text-xs text-slate-600 font-semibold">
              <span>บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) • Central IAM Governance Engine</span>
              <span>เอกสารรับรองทางอิเล็กทรอนิกส์</span>
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
        <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold">กำลังโหลดหน้าศูนย์ระงับสิทธิ์...</p>
        </div>
      }
    >
      <OffboardingHubContent />
    </Suspense>
  );
}
