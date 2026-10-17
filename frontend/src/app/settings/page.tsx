"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Send,
  Clock,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Bell,
  Save,
  Database,
  Server,
  Layers,
  Info,
  Calendar,
  Zap,
  Radio,
  Wifi,
  WifiOff,
  Sparkles,
  Bot,
  Wrench,
  Key,
} from "lucide-react";
import {
  ciamApi,
  HealthMonitorConfig,
  LiveHealthSnapshot,
  SyncSchedule,
  SyncAllResult,
  AdMonitorState,
  AICopilotSettings,
} from "@/lib/api";
import { formatDateTime } from "@/lib/date";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Telegram Alert State
  const [telegramConfig, setTelegramConfig] = useState<HealthMonitorConfig>({
    enabled: false,
    start_time: "08:00",
    interval_hours: 4,
    bot_token: "",
    chat_id: "",
    notify_admins_enabled: true,
  });
  const [showBotToken, setShowBotToken] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSaveMessage, setTelegramSaveMessage] = useState<string | null>(null);
  const [telegramTestLoading, setTelegramTestLoading] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Real-Time AD Monitor State
  const [adMonitor, setAdMonitor] = useState<AdMonitorState | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<number>(60);
  const [adIntervalSaving, setAdIntervalSaving] = useState(false);
  const [adIntervalSaveMessage, setAdIntervalSaveMessage] = useState<string | null>(null);
  const [adTestLoading, setAdTestLoading] = useState(false);
  const [adTestResult, setAdTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [adChecking, setAdChecking] = useState(false);

  // Sync Schedule State
  const [syncSchedule, setSyncSchedule] = useState<SyncSchedule>({
    enabled: true,
    time: "04:00",
    timezone: "Asia/Bangkok",
    last_run_at: null,
    last_status: "IDLE",
    last_summary: null,
    next_run_at: null,
  });
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncSaveMessage, setSyncSaveMessage] = useState<string | null>(null);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null);

  // Live System Health
  const [liveHealth, setLiveHealth] = useState<LiveHealthSnapshot | null>(null);

  // AI Copilot State
  const [aiSettings, setAiSettings] = useState<AICopilotSettings>({
    enabled: false,
    provider: "google",
    model: "gemini-1.5-flash",
    api_key_masked: null,
    has_api_key: false,
    base_url: null,
    system_prompt: "",
    allow_mcp_tools: true,
  });
  const [inputApiKey, setInputApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [healthData, scheduleData, aiData] = await Promise.all([
        ciamApi.getHealthMonitorStatus().catch(() => null),
        ciamApi.getSyncSchedule().catch(() => null),
        ciamApi.getAICopilotSettings().catch(() => null),
      ]);

      if (healthData) {
        setTelegramConfig(healthData.config);
        setLiveHealth(healthData.live_health);
        if (healthData.ad_monitor) {
          setAdMonitor(healthData.ad_monitor);
          if (healthData.ad_monitor.check_interval_seconds) {
            setSelectedInterval(healthData.ad_monitor.check_interval_seconds);
          }
        }
      }
      if (scheduleData) {
        setSyncSchedule(scheduleData);
      }
      if (aiData) {
        setAiSettings(aiData);
      }
    } catch (err) {
      console.error("Error loading system settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAICopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAiSaving(true);
      setAiSaveMessage(null);
      const res = await ciamApi.updateAICopilotSettings({
        enabled: aiSettings.enabled,
        provider: aiSettings.provider,
        model: aiSettings.model,
        api_key: inputApiKey.trim() ? inputApiKey.trim() : undefined,
        base_url: aiSettings.base_url || undefined,
        system_prompt: aiSettings.system_prompt || undefined,
        allow_mcp_tools: aiSettings.allow_mcp_tools,
      });
      setAiSettings(res);
      setInputApiKey("");
      setAiSaveMessage("บันทึกการตั้งค่า AI Copilot สำเร็จเรียบร้อย");
      setTimeout(() => setAiSaveMessage(null), 5000);
    } catch (err: any) {
      alert(`บันทึกการตั้งค่า AI ล้มเหลว: ${err.message || err}`);
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAICopilot = async () => {
    try {
      setAiTesting(true);
      setAiTestResult(null);
      const res = await ciamApi.testAICopilotConnection({
        provider: aiSettings.provider,
        model: aiSettings.model,
        api_key: inputApiKey.trim() || undefined,
        base_url: aiSettings.base_url || undefined,
      });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: `ข้อผิดพลาด: ${err.message || err}`,
      });
    } finally {
      setAiTesting(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTelegramSaving(true);
      setTelegramSaveMessage(null);
      const res = await ciamApi.updateHealthMonitor({
        enabled: telegramConfig.enabled,
        start_time: telegramConfig.start_time,
        interval_hours: telegramConfig.interval_hours,
        bot_token: telegramConfig.bot_token,
        chat_id: telegramConfig.chat_id,
        notify_admins_enabled: telegramConfig.notify_admins_enabled,
      });
      setTelegramConfig(res.config);
      setTelegramSaveMessage("บันทึกการตั้งค่า Telegram สำเร็จเรียบร้อย");
      setTimeout(() => setTelegramSaveMessage(null), 5000);
    } catch (err: any) {
      alert(`บันทึกการตั้งค่าล้มเหลว: ${err.message || err}`);
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleTriggerTestTelegramAlert = async () => {
    try {
      setTelegramTestLoading(true);
      setTelegramTestResult(null);
      const res = await ciamApi.triggerTestHealthAlert({
        bot_token: telegramConfig.bot_token,
        chat_id: telegramConfig.chat_id,
      });
      setTelegramTestResult({
        success: res.success,
        message: res.success
          ? `ส่งการแจ้งเตือนสำเร็จ (${res.summary})`
          : `ไม่สามารถส่งการแจ้งเตือนได้: ${res.errors?.join(", ") || res.error || "เกิดข้อผิดพลาด"}`,
      });
      if (res.health) {
        setLiveHealth(res.health);
      }
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        message: `เกิดข้อผิดพลาดในการทดสอบส่ง Alert: ${err.message || err}`,
      });
    } finally {
      setTelegramTestLoading(false);
    }
  };

  const handleTestAdAlert = async (type: "OFFLINE_IMMEDIATE" | "OFFLINE_REMINDER" | "ONLINE_RECOVERED") => {
    try {
      setAdTestLoading(true);
      setAdTestResult(null);
      const res = await ciamApi.triggerTestAdAlert({
        alert_type: type,
        bot_token: telegramConfig.bot_token,
        chat_id: telegramConfig.chat_id,
      });
      setAdTestResult({
        success: res.success,
        message: res.success
          ? `ส่งการแจ้งเตือนจำลอง (${type}) เข้า Telegram สำเร็จ (${res.message})`
          : `ส่งการแจ้งเตือนไม่สำเร็จ: ${res.message}`,
      });
    } catch (err: any) {
      setAdTestResult({
        success: false,
        message: `ข้อผิดพลาดในการทดสอบ AD Alert: ${err.message || err}`,
      });
    } finally {
      setAdTestLoading(false);
    }
  };

  const handleCheckAdNow = async () => {
    try {
      setAdChecking(true);
      const res = await ciamApi.checkAdNow();
      if (res.state) {
        setAdMonitor(res.state);
      }
      await fetchSettings();
      alert(`ตรวจวัดสถานะ AD Sync Agent สำเร็จ: สถานะ ${res.status} (${res.is_online ? "ONLINE ปกติ" : "OFFLINE หลุดการเชื่อมต่อ"})`);
    } catch (err: any) {
      alert(`ไม่สามารถตรวจสอบ AD ได้: ${err.message || err}`);
    } finally {
      setAdChecking(false);
    }
  };

  const handleSaveAdInterval = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setAdIntervalSaving(true);
      setAdIntervalSaveMessage(null);
      const res = await ciamApi.updateAdInterval(selectedInterval);
      if (res.ad_monitor) {
        setAdMonitor(res.ad_monitor);
        setSelectedInterval(res.ad_monitor.check_interval_seconds);
      }
      setAdIntervalSaveMessage(res.message || "บันทึกความถี่การตรวจสอบสำเร็จ");
      setTimeout(() => setAdIntervalSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`บันทึกความถี่ล้มเหลว: ${err.message || err}`);
    } finally {
      setAdIntervalSaving(false);
    }
  };

  const handleSaveSyncSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSyncSaving(true);
      setSyncSaveMessage(null);
      const res = await ciamApi.updateSyncSchedule({
        enabled: syncSchedule.enabled,
        time: syncSchedule.time,
      });
      setSyncSchedule(res);
      setSyncSaveMessage("บันทึกเวลากำหนดการซิงก์สำเร็จเรียบร้อย");
      setTimeout(() => setSyncSaveMessage(null), 5000);
    } catch (err: any) {
      alert(`บันทึกกำหนดการซิงก์ล้มเหลว: ${err.message || err}`);
    } finally {
      setSyncSaving(false);
    }
  };

  const handleSyncAllNow = async () => {
    if (!confirm("คุณต้องการสั่งซิงก์ข้อมูลบัญชีจาก Active Directory และระบบลูกทั้งหมดทันทีใช่หรือไม่?")) {
      return;
    }
    try {
      setSyncAllLoading(true);
      setSyncAllResult(null);
      const res = await ciamApi.syncAllApplications();
      setSyncAllResult(res);
      await fetchSettings();
      alert(`ซิงก์ระบบเรียบร้อย: ${res.summary}`);
    } catch (err: any) {
      alert(`ซิงก์ระบบล้มเหลว: ${err.message || err}`);
    } finally {
      setSyncAllLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                ตั้งค่าระบบและบูรณาการ (System Settings)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                จัดการการแจ้งเตือน Telegram Bot, กำหนดเวลาซิงก์ข้อมูล และตรวจสอบความพร้อมระบบ Central-IAM
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
          <button
            type="button"
            onClick={handleSyncAllNow}
            disabled={syncAllLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
          >
            {syncAllLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>ซิงก์ระบบทั้งหมดทันที</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: Telegram Notifications */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm tracking-tight">การแจ้งเตือน Telegram Bot</h2>
                <p className="text-[11px] text-slate-300">บอทแจ้งเตือนเหตุการณ์, สถานะระบบ และส่ง DM ผู้ใช้</p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                telegramConfig.enabled
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                  : "bg-slate-700 text-slate-300 border-slate-600"
              }`}
            >
              {telegramConfig.enabled ? "เปิดใช้งาน Alert" : "ปิดชั่วคราว"}
            </span>
          </div>

          <form onSubmit={handleSaveTelegramConfig} className="p-5 space-y-4 flex-1 flex flex-col">
            {/* Bot Token */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Telegram Bot Token <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showBotToken ? "text" : "password"}
                  value={telegramConfig.bot_token || ""}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({ ...prev, bot_token: e.target.value }))
                  }
                  placeholder="เช่น 7654321098:AAHxy..."
                  className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                โทเค็นที่ได้จาก @BotFather ใช้ทั้งส่งเข้า Group Alert และส่งข้อความ DM ถึงพนักงาน (อิง AD Pager)
              </p>
            </div>

            {/* Group Chat ID */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Group Chat ID สำหรับ Alert กลาง <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={telegramConfig.chat_id || ""}
                onChange={(e) =>
                  setTelegramConfig((prev) => ({ ...prev, chat_id: e.target.value }))
                }
                placeholder="เช่น -1001234567890 หรือหมายเลขแชทกลุ่ม"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                หมายเลขห้องแชทกลุ่ม IT/Security สำหรับรับรายงานสุขภาพระบบและการระงับสิทธิ์อัตโนมัติ
              </p>
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  เวลาเริ่มส่งสรุปประจำวัน
                </label>
                <input
                  type="time"
                  value={telegramConfig.start_time || "08:00"}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  ความถี่ในการตรวจเช็ค (Interval)
                </label>
                <select
                  value={telegramConfig.interval_hours ?? 4}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({
                      ...prev,
                      interval_hours: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>ทุกๆ 1 ชั่วโมง</option>
                  <option value={2}>ทุกๆ 2 ชั่วโมง</option>
                  <option value={4}>ทุกๆ 4 ชั่วโมง (แนะนำ)</option>
                  <option value={6}>ทุกๆ 6 ชั่วโมง</option>
                  <option value={8}>ทุกๆ 8 ชั่วโมง</option>
                  <option value={12}>ทุกๆ 12 ชั่วโมง</option>
                  <option value={24}>วันละ 1 ครั้ง</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 pt-2">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramConfig.enabled}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  เปิดระบบส่ง Health Report และ Security Alert เข้ากลุ่มอัตโนมัติ
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramConfig.notify_admins_enabled}
                  onChange={(e) =>
                    setTelegramConfig((prev) => ({
                      ...prev,
                      notify_admins_enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  ส่งข้อความ DM แจ้งเตือนผู้ดูแลระบบแต่ละคนโดยตรงเมื่อระบบขัดข้อง
                </span>
              </label>
            </div>

            {/* Feedback message */}
            {telegramSaveMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{telegramSaveMessage}</span>
              </div>
            )}

            {telegramTestResult && (
              <div
                className={`p-2.5 border rounded-lg text-xs font-bold flex items-start space-x-1.5 ${
                  telegramTestResult.success
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-rose-50 border-rose-300 text-rose-800"
                }`}
              >
                {telegramTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{telegramTestResult.message}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="pt-3 mt-auto flex flex-col sm:flex-row items-center gap-2">
              <button
                type="submit"
                disabled={telegramSaving}
                className="w-full sm:flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                {telegramSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>บันทึกการตั้งค่า Telegram</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerTestTelegramAlert}
                disabled={telegramTestLoading}
                className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition"
              >
                {telegramTestLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                )}
                <span>ทดสอบส่ง Alert เข้ากลุ่ม</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: Automated Sync Schedule */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm tracking-tight">กำหนดเวลาซิงก์ข้อมูลอัตโนมัติ</h2>
                <p className="text-[11px] text-slate-300">ดึงบัญชีจาก AD และ Spoke Apps ทุกวัน</p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                syncSchedule.enabled
                  ? "bg-blue-500/20 text-blue-300 border-blue-400/30"
                  : "bg-slate-700 text-slate-300 border-slate-600"
              }`}
            >
              {syncSchedule.enabled ? "เปิดระบบ Sync" : "ปิดระบบ Sync"}
            </span>
          </div>

          <form onSubmit={handleSaveSyncSchedule} className="p-5 space-y-4 flex-1 flex flex-col">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                เวลาที่ทำงานประจำวัน (Bangkok Time UTC+7) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="time"
                  value={syncSchedule.time || "04:00"}
                  onChange={(e) =>
                    setSyncSchedule((prev) => ({ ...prev, time: e.target.value }))
                  }
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 font-medium">
                  ค่าเริ่มต้น: 04:00 น. (ช่วงเช้าตรู่ก่อนเริ่มวันทำงานเพื่อลดโหลดเซิร์ฟเวอร์)
                </span>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncSchedule.enabled}
                  onChange={(e) =>
                    setSyncSchedule((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  เปิดการทำงานอัตโนมัติประจำวัน (Background Scheduler Daemon)
                </span>
              </label>
            </div>

            {/* Run Info Box */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">รอบการซิงก์ถัดไป:</span>
                <span className="font-mono text-blue-800 font-bold">
                  {syncSchedule.next_run_at ? formatDateTime(syncSchedule.next_run_at) : "ยังไม่มีกำหนด"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">รอบที่ทำงานล่าสุด:</span>
                <span className="font-mono text-slate-800 font-bold">
                  {syncSchedule.last_run_at ? formatDateTime(syncSchedule.last_run_at) : "ยังไม่เคยทำงาน"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">สถานะรอบล่าสุด:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                    syncSchedule.last_status === "SUCCESS"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : syncSchedule.last_status === "PARTIAL_SUCCESS"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-slate-200 text-slate-700 border-slate-300"
                  }`}
                >
                  {syncSchedule.last_status || "IDLE"}
                </span>
              </div>
              {syncSchedule.last_summary && (
                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200 font-mono">
                  {syncSchedule.last_summary}
                </div>
              )}
            </div>

            {/* Feedback message */}
            {syncSaveMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncSaveMessage}</span>
              </div>
            )}

            {syncAllResult && (
              <div className="p-2.5 bg-blue-50 border border-blue-300 text-blue-900 rounded-lg text-xs font-bold flex items-start space-x-1.5">
                <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div>{syncAllResult.summary}</div>
                  <div className="text-[10px] font-normal text-blue-700 mt-1">
                    สำเร็จ {syncAllResult.success_count}/{syncAllResult.total_apps} ระบบ
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="pt-3 mt-auto flex flex-col sm:flex-row items-center gap-2">
              <button
                type="submit"
                disabled={syncSaving}
                className="w-full sm:flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                {syncSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>บันทึกเวลากำหนดการ Sync</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CARD: Real-Time AD Monitor & Hourly Telegram Alert Engine */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm tracking-tight">
                  ระบบเฝ้าระวัง AD Sync Agent &amp; แจ้งเตือน Telegram ฉุกเฉิน
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">
                  ตรวจทุก {selectedInterval >= 60 ? `${selectedInterval / 60} นาที` : `${selectedInterval} วินาที`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                ตรวจสอบ AD ทุก {selectedInterval >= 60 ? `${selectedInterval / 60} นาที` : `${selectedInterval} วินาที`} • แจ้งเตือนทันทีเมื่อ OFF • เตือนซ้ำทุก 1 ชั่วโมง จนกว่าจะกลับมาเป็น ON
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black border flex items-center space-x-1.5 shadow-2xs ${
                (adMonitor?.is_online ?? liveHealth?.ad_sync_agent.is_online)
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                  : "bg-rose-500/20 text-rose-300 border-rose-400/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${(adMonitor?.is_online ?? liveHealth?.ad_sync_agent.is_online) ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`}></span>
              <span>{(adMonitor?.is_online ?? liveHealth?.ad_sync_agent.is_online) ? "🟢 ONLINE ปกติ" : "🔴 OFFLINE หลุดการเชื่อมต่อ"}</span>
            </span>

            <button
              type="button"
              onClick={handleCheckAdNow}
              disabled={adChecking}
              className="flex items-center space-x-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${adChecking ? "animate-spin" : ""}`} />
              <span>ตรวจเช็คทันที</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Rules Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-xs">
              <div className="font-extrabold text-rose-900 flex items-center space-x-1.5 mb-1">
                <span>🚨 กฎที่ 1: แจ้งเตือนทันทีเมื่อหลุด</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                เมื่อสถานะของ AD เปลี่ยนเป็น <b>OFF (Offline / Unreachable)</b> ระบบจะยิง Telegram แจ้งเตือนแอดมินและกลุ่มทันที
              </p>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
              <div className="font-extrabold text-amber-900 flex items-center space-x-1.5 mb-1">
                <span>⏱️ กฎที่ 2: เตือนซ้ำทุกๆ 1 ชั่วโมง</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                ตราบใดที่ยังไม่สามารถติดต่อ AD ได้ ระบบจะส่งแจ้งเตือนเตือนซ้ำต่อเนื่อง<b>ทุกๆ 1 ชั่วโมง (3,600 วินาที)</b>
              </p>
            </div>

            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs">
              <div className="font-extrabold text-emerald-900 flex items-center space-x-1.5 mb-1">
                <span>✅ กฎที่ 3: สรุปเมื่อกลับมาเป็น ON</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                เมื่อ AD กลับมาเป็น <b>ON (Online)</b> ระบบจะส่งข้อความแจ้งกู้คืนสำเร็จทันที พร้อมคำนวณเวลารวมที่ล่ม (Downtime)
              </p>
            </div>
          </div>

          {/* Configurable Probe Interval Box */}
          <form
            onSubmit={handleSaveAdInterval}
            className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-0.5">
              <div className="font-extrabold text-blue-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>ความถี่ในการตรวจสอบสถานะ AD (Probe Interval):</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-200 text-blue-900 font-black">
                  กำหนดค่าได้โดย Admin
                </span>
              </div>
              <p className="text-[11px] text-blue-800">
                กำหนดระยะเวลาที่ระบบจะวนรอบตรวจสอบความพร้อมของ AD Gateway อัตโนมัติ (ค่าเริ่มต้น: ทุก 1 นาที)
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              >
                <option value={30}>ทุกๆ 30 วินาที</option>
                <option value={60}>ทุกๆ 1 นาที (ค่าเริ่มต้น / แนะนำ)</option>
                <option value={120}>ทุกๆ 2 นาที</option>
                <option value={180}>ทุกๆ 3 นาที</option>
                <option value={300}>ทุกๆ 5 นาที</option>
                <option value={600}>ทุกๆ 10 นาที</option>
              </select>

              <button
                type="submit"
                disabled={adIntervalSaving}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {adIntervalSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>บันทึกความถี่</span>
              </button>
            </div>
          </form>

          {adIntervalSaveMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{adIntervalSaveMessage}</span>
            </div>
          )}

          {/* Status Metrics Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-500 font-medium text-[11px]">สถานะปัจจุบัน:</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {(adMonitor?.is_online ?? liveHealth?.ad_sync_agent.is_online) ? "ONLINE (พร้อมใช้งาน)" : "OFFLINE (ตัดการเชื่อมต่อ)"}
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium text-[11px]">ตรวจวัดล่าสุด:</div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                {adMonitor?.last_check_at ? formatDateTime(adMonitor.last_check_at) : (liveHealth?.timestamp_bkk || "กำลังตรวจวัด")}
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium text-[11px]">Response Latency:</div>
              <div className="font-mono font-bold text-slate-800 mt-0.5">
                {adMonitor?.last_latency_ms ?? liveHealth?.ad_sync_agent.latency_ms ?? 0} ms
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium text-[11px]">ความถี่ที่ตั้งไว้:</div>
              <div className="font-mono font-bold text-blue-800 mt-0.5">
                ทุก {selectedInterval >= 60 ? `${selectedInterval / 60} นาที` : `${selectedInterval} วินาที`}
              </div>
            </div>
          </div>

          {/* Test Alert Buttons */}
          <div className="pt-2 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>🧪 ทดสอบการส่งข้อความแจ้งเตือน AD ไปยัง Telegram:</span>
              <span className="text-[11px] text-slate-500 font-normal">
                (ใช้ Bot Token และ Chat ID ที่กำหนดไว้ด้านบน)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleTestAdAlert("OFFLINE_IMMEDIATE")}
                disabled={adTestLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>🚨 ทดสอบจำลอง: AD หลุด (OFFLINE ทันที)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestAdAlert("OFFLINE_REMINDER")}
                disabled={adTestLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>⚠️ ทดสอบจำลอง: เตือนซ้ำทุก 1 ชม. (Hourly Reminder)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestAdAlert("ONLINE_RECOVERED")}
                disabled={adTestLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>✅ ทดสอบจำลอง: กู้คืนสำเร็จ (ONLINE Recovery)</span>
              </button>
            </div>

            {adTestResult && (
              <div
                className={`mt-3 p-2.5 border rounded-lg text-xs font-bold flex items-start space-x-1.5 ${
                  adTestResult.success
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-rose-50 border-rose-300 text-rose-800"
                }`}
              >
                {adTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{adTestResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CARD 3 & 4: AD Integration Specs & Live Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Directory & Proxy Specs */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200">
            <Shield className="w-5 h-5 text-blue-700" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                ข้อกำหนดการเชื่อมต่อ Active Directory (AD Specs)
              </h3>
              <p className="text-[11px] text-slate-500">
                กฎเกณฑ์การดึงแผนกจาก OU และหมายเลข Telegram ID จาก Pager
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200">
              <div className="font-bold text-blue-900 mb-1 flex items-center space-x-1.5">
                <span>📁 แผนกอิงตามโครงสร้าง OU (Users WA)</span>
              </div>
              <p className="text-[11px] text-slate-700">
                ระบบ Central-IAM จะสกัดชื่อแผนกจาก DistinguishedName ของผู้ใช้โดยตรง เช่น ผู้ใช้อยู่ใน{" "}
                <code className="font-mono bg-blue-100 px-1 rounded text-blue-900">
                  OU=Purchasing,OU=Users WA,DC=wa,DC=net
                </code>{" "}
                จะถูกจัดให้อยู่ในแผนก <b>&quot;Purchasing&quot;</b> อัตโนมัติ
              </p>
            </div>

            <div className="p-3 bg-sky-50/80 rounded-lg border border-sky-200">
              <div className="font-bold text-sky-900 mb-1 flex items-center space-x-1.5">
                <span>✈️ Telegram ID อิงตามฟิลด์ Pager</span>
              </div>
              <p className="text-[11px] text-slate-700">
                ในหน้า AD User Properties แถบ <b>Telephones &gt; Pager</b> จะถูกดึงมาเป็นหมายเลข{" "}
                <b>Telegram ID</b> สำหรับส่งการแจ้งเตือนส่วนตัว (DM) ผ่านบอทกลาง
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">AD Gateway Endpoint:</span>
                <span className="font-mono text-slate-800 font-bold">http://172.18.0.1:3100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">สิทธิ์แก้ไขสถานะใน AD (PATCH):</span>
                <span className="font-bold text-slate-700 bg-slate-200 px-1.5 rounded text-[10px]">
                  Read-Only (โหมดสังเกตการณ์)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Base DN Domain Controller:</span>
                <span className="font-mono text-slate-800 font-bold">DC=wa,DC=net</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live System Health Snapshot */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200">
            <Activity className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                ความพร้อมของระบบแบบ Real-Time (System Health)
              </h3>
              <p className="text-[11px] text-slate-500">
                สถานะการเชื่อมต่อฐานข้อมูล, AD Proxy และระบบลูก
              </p>
            </div>
          </div>

          {liveHealth ? (
            <div className="space-y-3 text-xs">
              {/* Database */}
              <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <Database className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="font-bold text-slate-900">ฐานข้อมูลกลาง (PostgreSQL)</div>
                    <div className="text-[10px] text-slate-500">เครื่องยนต์จัดเก็บข้อมูลตัวตนและสิทธิ์</div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                      liveHealth.database.is_connected
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-rose-100 text-rose-900 border-rose-300"
                    }`}
                  >
                    {liveHealth.database.is_connected ? "ONLINE" : "OFFLINE"}
                  </span>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {liveHealth.database.latency_ms} ms
                  </div>
                </div>
              </div>

              {/* AD Proxy */}
              <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <Server className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="font-bold text-slate-900">AD Sync Agent (Port 3100)</div>
                    <div className="text-[10px] text-slate-500">{liveHealth.ad_sync_agent.base_url}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                      liveHealth.ad_sync_agent.is_online
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-rose-100 text-rose-900 border-rose-300"
                    }`}
                  >
                    {liveHealth.ad_sync_agent.is_online ? "ONLINE" : "OFFLINE"}
                  </span>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {liveHealth.ad_sync_agent.latency_ms} ms
                  </div>
                </div>
              </div>

              {/* Connected Apps */}
              <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="font-bold text-slate-900">ระบบที่เชื่อมต่อ (Spoke Applications)</div>
                    <div className="text-[10px] text-slate-500">ระบบลูกทั้งหมดในเครือ Window Asia</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-800">
                    {liveHealth.connected_apps.online} / {liveHealth.connected_apps.total} ระบบออนไลน์
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              กำลังโหลดสถานะความพร้อมของระบบ...
            </div>
          )}
        </div>

        {/* AI Copilot & Intelligence Engine Card */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-5 space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <span>AI Copilot & Intelligence Engine</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                      aiSettings.enabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {aiSettings.enabled ? "ACTIVE / ONLINE" : "DISABLED"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  ตั้งค่าผู้ช่วย AI ประจำองค์กร, ใส่ API Key และเปิด/ปิดหน้าต่างแชทอัจฉริยะร่วมกับ MCP Tools
                </p>
              </div>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer self-start sm:self-auto">
              <span className="text-xs font-semibold text-slate-700">เปิดใช้งาน AI Copilot:</span>
              <input
                type="checkbox"
                checked={aiSettings.enabled}
                onChange={(e) =>
                  setAiSettings({ ...aiSettings, enabled: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </label>
          </div>

          <form onSubmit={handleSaveAICopilot} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AI Provider (ผู้ให้บริการ)
                </label>
                <select
                  value={aiSettings.provider}
                  onChange={(e) => {
                    const prov = e.target.value;
                    let defaultModel = "gemini-1.5-flash";
                    if (prov === "openai") defaultModel = "gpt-4o-mini";
                    else if (prov === "anthropic") defaultModel = "claude-3-5-sonnet";
                    else if (prov === "ollama") defaultModel = "deepseek-r1";
                    setAiSettings({ ...aiSettings, provider: prov, model: defaultModel });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="google">Google Gemini (แนะนำสำหรับองค์กร)</option>
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="ollama">Local Ollama (Self-Hosted LLM)</option>
                  <option value="custom">Custom OpenAI-Compatible API</option>
                </select>
              </div>

              {/* Model ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model Identifier (รหัสโมเดล)
                </label>
                <input
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, model: e.target.value })
                  }
                  placeholder="e.g. gemini-1.5-flash, gpt-4o-mini"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* API Key Input */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>API Key ({aiSettings.provider.toUpperCase()})</span>
                  </label>
                  {aiSettings.has_api_key && (
                    <span className="text-[10px] text-emerald-600 font-mono font-medium">
                      ✓ มีคีย์ในระบบแล้ว: {aiSettings.api_key_masked}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      placeholder={
                        aiSettings.has_api_key
                          ? "ปล่อยว่างไว้เพื่อใช้คีย์เดิม หรือกรอกใหม่เพื่อแทนที่..."
                          : "กรอก API Key เช่น AIzaSy... หรือ sk-..."
                      }
                      className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestAICopilot}
                    disabled={aiTesting}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    {aiTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>{aiTesting ? "กำลังทดสอบ..." : "ทดสอบเชื่อมต่อ"}</span>
                  </button>
                </div>

                {/* Test Result Alert */}
                {aiTestResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                      aiTestResult.success
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span className="flex-1">{aiTestResult.message}</span>
                    {aiTestResult.latency_ms !== undefined && (
                      <span className="text-[10px] font-mono font-bold">
                        {aiTestResult.latency_ms} ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Base URL (Optional for Ollama/Custom) */}
              {(aiSettings.provider === "ollama" || aiSettings.provider === "custom") && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Base URL (Endpoint)
                  </label>
                  <input
                    type="text"
                    value={aiSettings.base_url || ""}
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, base_url: e.target.value })
                    }
                    placeholder="http://localhost:11434 หรือ https://api.custom-llm.com/v1"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              {/* MCP Tool Execution Toggle */}
              <div className="md:col-span-2 p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold text-blue-950">
                      อนุญาตให้ AI เรียกใช้งาน Central IAM & Spoke MCP Tools
                    </div>
                    <div className="text-[10px] text-blue-700">
                      เปิดให้ AI ดึงข้อมูล Ghost Accounts, สถานะระบบลูก (MTPulse/IRM), Health Check และ Audit Logs แบบเรียลไทม์
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={aiSettings.allow_mcp_tools}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, allow_mcp_tools: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* System Prompt Persona */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  System Prompt & Agent Constraints (คำสั่งกำกับพฤติกรรม AI)
                </label>
                <textarea
                  rows={2}
                  value={aiSettings.system_prompt || ""}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, system_prompt: e.target.value })
                  }
                  placeholder="กำหนดกรอบการตอบ เช่น You are Central IAM Enterprise Copilot for Window Asia..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            {/* Save Button & Feedback Message */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              {aiSaveMessage ? (
                <div className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{aiSaveMessage}</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  ระบบรองรับ Fallback ดึงข้อมูลผ่าน MCP Tools อัตโนมัติแม้ยังไม่มี API Key ภายนอก
                </div>
              )}

              <button
                type="submit"
                disabled={aiSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {aiSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{aiSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า AI Copilot"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
