"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Shield,
  Bell,
  Clock,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Activity,
  Radio,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import {
  api,
  AdminUserOut,
  HealthMonitorConfig,
  LiveHealthSnapshot
} from "@/lib/api";

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AdminUserOut | null;
  onUserUpdated?: (updated: AdminUserOut) => void;
}

export default function AdminProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}: AdminProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "telegram">("profile");

  // Profile Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [profileErrorMsg, setProfileErrorMsg] = useState("");

  // Telegram Health Monitor State
  const [monitorConfig, setMonitorConfig] = useState<HealthMonitorConfig>({
    enabled: false,
    start_time: "08:00",
    interval_hours: 4,
    bot_token: "",
    chat_id: "",
    notify_admins_enabled: true,
  });
  const [liveHealth, setLiveHealth] = useState<LiveHealthSnapshot | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);
  const [monitorSuccessMsg, setMonitorSuccessMsg] = useState("");
  const [monitorErrorMsg, setMonitorErrorMsg] = useState("");

  // Test Alert State
  const [testingAlert, setTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    summary: string;
    details?: string;
  } | null>(null);

  // Sync profile form when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || "");
      setEmail(currentUser.email || "");
      setTelegramId(currentUser.telegram_id || "");
    }
  }, [currentUser]);

  // Load Health Monitor data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadHealthMonitor();
      setProfileSuccessMsg("");
      setProfileErrorMsg("");
      setMonitorSuccessMsg("");
      setMonitorErrorMsg("");
      setTestResult(null);
    }
  }, [isOpen]);

  const loadHealthMonitor = async () => {
    setMonitorLoading(true);
    try {
      const data = await api.getHealthMonitorStatus();
      if (data.config) setMonitorConfig(data.config);
      if (data.live_health) setLiveHealth(data.live_health);
    } catch (err: any) {
      setMonitorErrorMsg(err.message || "ไม่สามารถโหลดการตั้งค่า Health Monitor ได้");
    } finally {
      setMonitorLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccessMsg("");
    setProfileErrorMsg("");

    try {
      const updated = await api.updateAdminProfile({
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        telegram_id: telegramId.trim() || undefined,
        new_password: newPassword.trim() || undefined,
      });

      // Update local storage
      localStorage.setItem("ciam_user", JSON.stringify(updated));

      setProfileSuccessMsg("บันทึกข้อมูลโปรไฟล์และ Telegram ID สำเร็จเรียบร้อย");
      setNewPassword("");
      if (onUserUpdated) onUserUpdated(updated);
    } catch (err: any) {
      setProfileErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกโปรไฟล์");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setMonitorSaving(true);
    setMonitorSuccessMsg("");
    setMonitorErrorMsg("");

    try {
      const res = await api.updateHealthMonitor(monitorConfig);
      if (res.config) setMonitorConfig(res.config);
      setMonitorSuccessMsg("บันทึกตารางเวลาและการตั้งค่าแจ้งเตือน Telegram สำเร็จเรียบร้อย");
    } catch (err: any) {
      setMonitorErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า");
    } finally {
      setMonitorSaving(false);
    }
  };

  const handleTriggerTestAlert = async () => {
    setTestingAlert(true);
    setTestResult(null);
    try {
      const res = await api.triggerTestHealthAlert({
        bot_token: monitorConfig.bot_token,
        chat_id: monitorConfig.chat_id,
      });

      if (res.success) {
        setTestResult({
          success: true,
          summary: res.summary || "ส่งข้อความทดสอบเข้า Telegram สำเร็จเรียบร้อย",
          details: `ส่งสำเร็จ ${res.success_deliveries}/${res.recipients_count} ช่องทาง`,
        });
      } else {
        setTestResult({
          success: false,
          summary: res.error || res.summary || "ไม่สามารถส่งข้อความเข้า Telegram ได้",
          details: res.errors && res.errors.length > 0 ? res.errors.join(", ") : undefined,
        });
      }

      // Refresh live health data
      loadHealthMonitor();
    } catch (err: any) {
      setTestResult({
        success: false,
        summary: err.message || "เกิดข้อผิดพลาดในการส่งข้อความทดสอบ",
      });
    } finally {
      setTestingAlert(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide">
                จัดการโปรไฟล์ & แจ้งเตือน Telegram
              </h2>
              <p className="text-xs text-blue-200/80">
                User Profile & Active Directory Agent Health Monitor Schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "profile"
                ? "bg-white border-blue-600 text-blue-700 shadow-2xs -mb-px"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <User className="w-4 h-4" />
            <span>ข้อมูลโปรไฟล์ (Admin Profile)</span>
          </button>

          <button
            onClick={() => setActiveTab("telegram")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === "telegram"
                ? "bg-white border-blue-600 text-blue-700 shadow-2xs -mb-px"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>แจ้งเตือน Health & AD Agent</span>
            {monitorConfig.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: Profile Form */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {/* Username & Role Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    ชื่อบัญชีผู้ใช้ระบบ (Username)
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {currentUser?.username || "admin"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                    <Shield className="w-3.5 h-3.5" />
                    {currentUser?.role || "SUPER_ADMIN"}
                  </span>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ชื่อ - นามสกุลจริง (Full Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น นายชัยวัฒน์ นิลวรรณ"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  อีเมลองค์กร (Corporate Email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="name@windowasia.com"
                />
              </div>

              {/* Telegram ID Field */}
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80">
                <label className="block text-xs font-extrabold text-sky-950 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-sky-600" />
                    Telegram ID / Chat ID สำหรับรับแจ้งเตือน
                  </span>
                  <span className="text-[10px] text-sky-600 font-semibold">แนะนำ</span>
                </label>
                <input
                  type="text"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-sky-300 bg-white text-xs font-mono font-bold text-sky-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  placeholder="เช่น @chaiwat_n หรือตัวเลข Chat ID เช่น 123456789"
                />
                <p className="text-[11px] text-sky-800/90 mt-2 leading-relaxed">
                  💡 <b>วิธีดู Telegram Chat ID:</b> ในแอป Telegram ให้ค้นหาบอท{" "}
                  <code className="bg-sky-100 px-1.5 py-0.5 rounded text-sky-900 font-mono font-bold">@userinfobot</code>{" "}
                  หรือ{" "}
                  <code className="bg-sky-100 px-1.5 py-0.5 rounded text-sky-900 font-mono font-bold">@myidbot</code>{" "}
                  แล้วกด <b>/start</b> จะได้รับตัวเลข <b>Id</b> นำมากรอกในช่องนี้เพื่อรับการแจ้งเตือนสด
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เปลี่ยนรหัสผ่านใหม่ (หากไม่ต้องการเปลี่ยน ให้เว้นว่างไว้)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {profileSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{profileSaving ? "กำลังบันทึก..." : "💾 บันทึกโปรไฟล์"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Telegram Health Alerts & Schedule */}
          {activeTab === "telegram" && (
            <div className="space-y-5">
              {monitorSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{monitorSuccessMsg}</span>
                </div>
              )}

              {monitorErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{monitorErrorMsg}</span>
                </div>
              )}

              {/* Live AD Sync Agent Status Banner */}
              <div className="p-4 rounded-xl border-2 bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-xs font-bold tracking-wide uppercase text-blue-200">
                      สถานะระบบสด (Live Health Status)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={loadHealthMonitor}
                    disabled={monitorLoading}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${monitorLoading ? "animate-spin" : ""}`} />
                    <span>รีเฟรช</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* AD Sync Agent */}
                  <div className="p-3 rounded-lg bg-white/10 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 font-bold">AD Sync Agent (Gateway)</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          liveHealth?.ad_sync_agent.is_online
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                        }`}
                      >
                        {liveHealth?.ad_sync_agent.is_online ? "🟢 ONLINE" : "🔴 OFFLINE"}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-blue-200">
                      {liveHealth?.ad_sync_agent.base_url || "http://172.18.0.1:3100"}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">
                      Latency: <b className="text-white">{liveHealth?.ad_sync_agent.latency_ms ?? 0} ms</b>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {liveHealth?.ad_sync_agent.message || "กำลังตรวจวัด..."}
                    </div>
                  </div>

                  {/* Core & DB */}
                  <div className="p-3 rounded-lg bg-white/10 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 font-bold">Central IAM & Database</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                        🟢 OPERATIONAL
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      DB Latency: <b className="text-white">{liveHealth?.database.latency_ms ?? 0} ms</b>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">
                      ระบบลูกที่เชื่อมต่อ:{" "}
                      <b className="text-white">
                        {liveHealth?.connected_apps.online ?? 0} / {liveHealth?.connected_apps.total ?? 0}
                      </b>{" "}
                      ออนไลน์
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule & Telegram Settings Form */}
              <form onSubmit={handleSaveMonitor} className="space-y-4">
                {/* Master Toggle */}
                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-extrabold text-blue-950 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      เปิดการส่งแจ้งเตือนอัตโนมัติตามตาราง (Periodic Health Alerts)
                    </div>
                    <div className="text-[11px] text-blue-800">
                      ระบบจะส่งรายงาน System Health และ AD Sync Agent เข้า Telegram อัตโนมัติตามรอบเวลาที่กำหนด
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorConfig.enabled}
                      onChange={(e) =>
                        setMonitorConfig({ ...monitorConfig, enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Schedule Configuration: Time & Interval */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      เวลาเริ่มส่งรอบแรกของวัน (Start Time)
                    </label>
                    <input
                      type="time"
                      value={monitorConfig.start_time}
                      onChange={(e) =>
                        setMonitorConfig({ ...monitorConfig, start_time: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      เวลาประเทศไทย (Asia/Bangkok)
                    </span>
                  </div>

                  {/* Interval */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                      ความถี่ในการส่ง (Interval)
                    </label>
                    <select
                      value={monitorConfig.interval_hours}
                      onChange={(e) =>
                        setMonitorConfig({
                          ...monitorConfig,
                          interval_hours: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>ทุกๆ 1 ชั่วโมง (Every 1 Hour)</option>
                      <option value={2}>ทุกๆ 2 ชั่วโมง (Every 2 Hours)</option>
                      <option value={4}>ทุกๆ 4 ชั่วโมง (Every 4 Hours - แนะนำ)</option>
                      <option value={6}>ทุกๆ 6 ชั่วโมง (Every 6 Hours)</option>
                      <option value={8}>ทุกๆ 8 ชั่วโมง (Every 8 Hours)</option>
                      <option value={12}>ทุกๆ 12 ชั่วโมง (Every 12 Hours)</option>
                      <option value={24}>วันละ 1 ครั้ง (Every 24 Hours)</option>
                    </select>
                    {monitorConfig.next_run_at && (
                      <span className="text-[10px] text-blue-700 font-semibold mt-1 block">
                        รอบถัดไป: {new Date(monitorConfig.next_run_at).toLocaleString("th-TH")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Telegram Credentials */}
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    การเชื่อมต่อ Telegram Bot API
                  </div>

                  {/* Bot Token */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Telegram Bot Token
                    </label>
                    <div className="relative">
                      <input
                        type={showBotToken ? "text" : "password"}
                        value={monitorConfig.bot_token || ""}
                        onChange={(e) =>
                          setMonitorConfig({ ...monitorConfig, bot_token: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium text-slate-800 pr-10"
                        placeholder="เช่น 7123456789:AAHq_xxxxxxxxx..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowBotToken(!showBotToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showBotToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Chat ID */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Telegram Group / Channel / Admin Chat ID
                    </label>
                    <input
                      type="text"
                      value={monitorConfig.chat_id || ""}
                      onChange={(e) =>
                        setMonitorConfig({ ...monitorConfig, chat_id: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium text-slate-800"
                      placeholder="เช่น -1001234567890 (Group/Channel) หรือ 987654321 (User ID)"
                    />
                  </div>

                  {/* Checkbox for notifying all admins with telegram_id */}
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={monitorConfig.notify_admins_enabled}
                      onChange={(e) =>
                        setMonitorConfig({
                          ...monitorConfig,
                          notify_admins_enabled: e.target.checked,
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>
                      ส่งแจ้งเตือนไปยังผู้ดูแลระบบ (Admin) ทุกคนที่มีการระบุ Telegram ID ไว้ในโปรไฟล์ด้วย
                    </span>
                  </label>
                </div>

                {/* Test Alert Result Box */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs font-bold flex items-start space-x-2.5 animate-in fade-in duration-150 ${
                      testResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>{testResult.summary}</div>
                      {testResult.details && (
                        <div className="text-[11px] font-normal mt-0.5 text-slate-600 font-mono">
                          {testResult.details}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Test Alert Button */}
                  <button
                    type="button"
                    onClick={handleTriggerTestAlert}
                    disabled={testingAlert || !monitorConfig.bot_token}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border-2 border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-extrabold transition-all shadow-2xs disabled:opacity-50"
                  >
                    {testingAlert ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-sky-600" />
                    )}
                    <span>{testingAlert ? "กำลังยิงทดสอบ..." : "🔔 ทดสอบส่งเข้า Telegram เดี๋ยวนี้"}</span>
                  </button>

                  {/* Save Settings Button */}
                  <button
                    type="submit"
                    disabled={monitorSaving}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    {monitorSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{monitorSaving ? "กำลังบันทึก..." : "💾 บันทึกการตั้งค่า Schedule"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
