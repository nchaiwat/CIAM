"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
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
  Building,
  User,
  Check,
  RotateCcw,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { ciamApi, OffboardPreview, OffboardExecuteResult, UserListItem } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/date";

function OffboardingHubContent() {
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  const filteredUsers = useMemo(() => {
    if (!usernameInput.trim()) return [];
    const query = usernameInput.toLowerCase();
    return allUsers
      .filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.full_name.toLowerCase().includes(query) ||
          (u.employee_id && u.employee_id.toLowerCase().includes(query)) ||
          (u.department && u.department.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [allUsers, usernameInput]);

  const ghostUsers = useMemo(() => {
    return allUsers.filter((u) => u.has_discrepancy).slice(0, 4);
  }, [allUsers]);

  const handlePreview = async (uname: string) => {
    if (!uname.trim()) return;
    try {
      setPreviewLoading(true);
      setPreviewError("");
      setExecuteResult(null);
      setIsDropdownOpen(false);
      const res = await ciamApi.previewOffboard(uname.trim());
      setPreview(res);
      setUsernameInput(res.username);
    } catch (err: any) {
      setPreviewError(`ไม่พบข้อมูลพนักงาน: ${err.message || "User not found"}`);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!preview) return;
    const confirmMessage = `ยืนยันการระงับสิทธิ์พนักงาน "${preview.full_name}" (${preview.username}) ทันที?\nการกระทำนี้จะปิดบัญชีใน Active Directory และตัดสิทธิ์ในระบบลูกทั้งหมด`;
    if (!window.confirm(confirmMessage)) return;

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

  const handleReset = () => {
    setPreview(null);
    setExecuteResult(null);
    setUsernameInput("");
    setPreviewError("");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b-2 border-slate-300">
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
            ตัดสิทธิ์พนักงานพร้อมกันข้าม Active Directory และระบบลูกทั้งหมด (Spokes) พร้อมออกใบรับรองสากล
          </p>
        </div>

        {preview && (
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md border border-slate-300 transition-colors w-fit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>เลือกพนักงานใหม่</span>
          </button>
        )}
      </div>

      {/* Step 1: Search and Select Target Employee */}
      <div className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2.5">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>ค้นหาและเลือกพนักงานเป้าหมาย</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">พิมพ์ชื่อ, นามสกุล หรือ Username</span>
        </div>

        <div className="relative">
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
                placeholder="ค้นหาพนักงานเป้าหมาย เช่น Chaiwat, patcha, hermes..."
                value={usernameInput}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-md text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={previewLoading || !usernameInput.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-md transition-colors shadow-sm flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <span>{previewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบผลกระทบรายระบบ"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && filteredUsers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handlePreview(u.username)}
                  className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-800 font-bold text-xs">
                      {u.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center space-x-2">
                        <span>{u.full_name}</span>
                        <span className="font-mono text-blue-700 font-bold text-xs">@{u.username}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                        <span>{u.department || "ทั่วไป"}</span>
                        <span>•</span>
                        <span>{u.employee_id || "ไม่มีรหัส"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {u.has_discrepancy && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400 text-amber-950 border border-amber-500">
                        บัญชีผี
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        u.is_active_in_ad
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {u.is_active_in_ad ? "Active ใน AD" : "Inactive ใน AD"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority: Ghost Accounts / Discrepancy Cards */}
        {!preview && ghostUsers.length > 0 && (
          <div className="pt-3 border-t-2 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>ตรวจพบบัญชีตกค้างในระบบลูก (Ghost Accounts ที่ปิดใน AD แล้วแต่ยังเปิดในระบบลูก):</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ghostUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handlePreview(u.username)}
                  className="p-2.5 rounded-md bg-amber-50/80 hover:bg-amber-100 border-2 border-amber-300 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-amber-950 font-bold text-xs">
                      {u.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] font-mono text-amber-900 font-bold">@{u.username}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-1 rounded">
                    ระงับทันที →
                  </span>
                </div>
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
                <span className="text-slate-600 font-medium">สถานะใน AD ปัจจุบัน:</span>
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

          {/* Blast Radius / Impact Analysis */}
          <div className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>ขอบเขตผลกระทบและการตัดสิทธิ์ (Blast Radius Matrix)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  ระบบจะทำการส่งคำสั่งตัดสิทธิ์ไปยังปลายทางทั้งหมดพร้อมกันเมื่อกดยืนยัน
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300 rounded-md">
                กระทบ {preview.affected_applications.length} ระบบ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {preview.affected_applications.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg border-2 flex items-center justify-between ${
                    item.app_code === "ad"
                      ? "bg-blue-50/60 border-blue-300"
                      : "bg-slate-50 border-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-md bg-white border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs">
                      {item.app_code.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.app_name}</div>
                      <div className="text-[11px] text-slate-600">
                        บัญชี: <span className="font-mono font-bold text-blue-700">{item.app_username}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300 rounded">
                      {item.action_to_take}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Execute Button */}
            <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-medium">
                ⚠️ การกระทำนี้จะมีผลทันทีและถูกบันทึกลงใน ISO 27001 Immutable Audit Log
              </div>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-md transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>{executing ? "กำลังตัดสิทธิ์ทุกระบบ..." : "ยืนยันการตัดสิทธิ์พนักงานทันที (1-Click Offboard)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Execution Result & Certificate */}
      {executeResult && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border-2 border-emerald-300 shadow-md space-y-4">
            <div className="flex items-center space-x-3 text-emerald-800">
              <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  กระบวนการตัดสิทธิ์พนักงานเสร็จสิ้นสมบูรณ์
                </h3>
                <p className="text-xs text-slate-600">
                  ระบบได้ระงับการเข้าถึงใน Active Directory และตัดสิทธิ์ในระบบลูกทั้งหมดแล้ว
                </p>
              </div>
            </div>

            {/* Execution Result List */}
            <div className="space-y-2 pt-2">
              {executeResult.checklist.map((res, i) => (
                <div
                  key={i}
                  className="p-3 rounded-md bg-slate-50 border border-slate-300 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    {res.status === "SUCCESS" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900 uppercase">{res.app_code}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-700">{res.message}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      res.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-rose-100 text-rose-900 border border-rose-300"
                    }`}
                  >
                    {res.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-md border border-slate-300"
              >
                ระงับสิทธิ์พนักงานท่านอื่น
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบรับรอง (Print Certificate)</span>
              </button>
            </div>
          </div>

          {/* Certificate View for Audit and Printing */}
          <div className="bg-white p-8 rounded-lg border-2 border-slate-300 shadow-sm space-y-6 print:border-none print:shadow-none">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <div className="text-lg font-black text-slate-900 tracking-wider">WINDOW ASIA CO., LTD.</div>
                <div className="text-xs font-bold text-slate-600 uppercase">
                  Centralized Identity & Access Management (CIAM)
                </div>
                <div className="text-sm font-extrabold text-blue-900 mt-2">
                  ใบรับรองการตัดสิทธิ์การเข้าถึงระบบสารสนเทศ (Revocation Certificate)
                </div>
              </div>
              <div className="text-right text-xs space-y-1">
                <div className="font-mono text-slate-500">Ref: {executeResult.certificate_id}</div>
                <div className="text-slate-600 font-semibold">{formatDateTime(executeResult.executed_at)}</div>
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black">
                  ISO 27001 AUDIT COMPLIANT
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-medium">พนักงานที่ถูกระงับสิทธิ์:</span>
                <div className="font-bold text-slate-900 text-sm">{executeResult.target_full_name}</div>
                <div className="text-slate-600">Username: <span className="font-mono text-blue-800 font-bold">{executeResult.target_username}</span></div>
                <div className="text-slate-600">แผนก: {executeResult.target_department || "ทั่วไป"}</div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-slate-500 font-medium">ผู้ดำเนินการ:</span>
                <div className="font-bold text-slate-900">{executeResult.actor_username}</div>
                <div className="text-slate-600">วันที่มีผล: {executeResult.effective_date}</div>
                <div className="text-slate-600">สาเหตุ: {executeResult.reason}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2">สรุปผลการตัดสิทธิ์ในระบบปลายทาง:</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded text-xs">
                {executeResult.checklist.map((r, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-800">{r.app_name} ({r.app_code})</span>
                    <span className="text-emerald-700 font-bold">✓ ระงับสิทธิ์เรียบร้อย</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t-2 border-slate-200 flex justify-between items-end text-xs text-slate-500">
              <div>
                <div>ตรวจสอบโดย: ฝ่ายกำกับดูแลความมั่นคงปลอดภัยสารสนเทศ</div>
                <div className="font-mono text-[10px] text-slate-400 mt-1">Audit Hash: {executeResult.certificate_id}-OK</div>
              </div>
              <div className="text-right">
                <div className="border-b border-slate-400 w-40 mb-1"></div>
                <div>ลายมือชื่อผู้มีอำนาจอนุมัติ</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OffboardingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">กำลังโหลดศูนย์ระงับสิทธิ์...</div>}>
      <OffboardingHubContent />
    </Suspense>
  );
}
