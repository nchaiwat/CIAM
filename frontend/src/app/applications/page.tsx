"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Zap,
  Activity,
  RefreshCw,
  Users,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Code2,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
  Info,
  Lock,
  Globe,
  Terminal,
  ArrowUpRight,
  Shield,
  Database,
  Server,
  Clock,
  Calendar,
  Cloud,
} from "lucide-react";
import { ciamApi, ConnectedApp, SyncSchedule, SyncAllResult } from "@/lib/api";
import { formatDateTime } from "@/lib/date";


export default function ApplicationsPage() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [liveInventory, setLiveInventory] = useState<{
    appName: string;
    total: number;
    accounts: any[];
    notice?: string;
  } | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Form states for new app
  const [appCode, setAppCode] = useState("");
  const [appName, setAppName] = useState("");
  const [connectorType, setConnectorType] = useState<"REST_API" | "RPA_WORKER" | "SAP_B1">("REST_API");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sapCompanyDb, setSapCompanyDb] = useState("WA_PROD");
  const [sapUsername, setSapUsername] = useState("");
  const [sapPassword, setSapPassword] = useState("");
  const [showNewSapPassword, setShowNewSapPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  // Delete App states
  const [deleteConfirmApp, setDeleteConfirmApp] = useState<ConnectedApp | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Notification and Error Notice Modal states
  const [errorNotice, setErrorNotice] = useState<{
    title: string;
    message: string;
    isIpWhitelistError?: boolean;
    detectedIp?: string;
    solution?: string;
  } | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Scheduled Sync & Sync-All States
  const [scheduleData, setScheduleData] = useState<SyncSchedule | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTime, setScheduleTime] = useState("04:00");
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null);


  // Settings / Secret Key & SSO Modal states
  const [editApp, setEditApp] = useState<ConnectedApp | null>(null);
  const [editTab, setEditTab] = useState<"M2M" | "SSO" | "SAP_B1" | "AD_PROXY" | "M365">("M2M");
  const [editAppName, setEditAppName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editConnectorType, setEditConnectorType] = useState<string>("REST_API");
  const [editSapCompanyDb, setEditSapCompanyDb] = useState("");
  const [editSapUsername, setEditSapUsername] = useState("");
  const [editSapPassword, setEditSapPassword] = useState("");
  const [showEditSapPassword, setShowEditSapPassword] = useState(false);
  const [editAdAllowStatusPatch, setEditAdAllowStatusPatch] = useState(false);
  const [editClientId, setEditClientId] = useState("");
  const [editClientSecret, setEditClientSecret] = useState("");
  const [editRedirectUris, setEditRedirectUris] = useState("");
  const [editSsoEnabled, setEditSsoEnabled] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [copiedEditKey, setCopiedEditKey] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedClientSecret, setCopiedClientSecret] = useState(false);
  const [snippetLang, setSnippetLang] = useState<"python" | "js">("python");

  const generateRandomSecret = (code: string) => {
    const chars = "0123456789abcdef";
    let hex = "";
    for (let i = 0; i < 24; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }
    return `sec_${code ? code.toLowerCase().trim() : "spoke"}_oauth_${hex}`;
  };

  const generateRandomKey = (code: string) => {
    const chars = "0123456789abcdef";
    let hex = "";
    for (let i = 0; i < 20; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }
    return `sec_${code ? code.toLowerCase().trim() : "spoke"}_mgmt_${hex}`;
  };

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleOpenEdit = async (app: ConnectedApp, defaultTab: "M2M" | "SSO" | "SAP_B1" | "AD_PROXY" | "M365" = "M2M") => {
    setEditApp(app);
    setEditAppName(app.app_name);
    setEditBaseUrl(app.base_url || "");
    setEditConnectorType(app.connector_type);
    setEditAdAllowStatusPatch(Boolean(app.ad_allow_status_patch));
    setShowSecret(false);
    setShowClientSecret(false);
    setShowEditSapPassword(false);
    setCopiedEditKey(false);
    setCopiedClientId(false);
    setCopiedClientSecret(false);
    
    // Auto-select tab if AD, SAP, or M365 application
    const isAd = app.connector_type === "AD_PROXY" || app.app_code.toLowerCase() === "ad";
    const isSap = app.connector_type === "SAP_B1" || app.app_code.toLowerCase().includes("sap");
    const isM365 = app.connector_type === "M365" || app.app_code.toLowerCase().includes("m365");
    if (isAd) setEditTab("AD_PROXY");
    else if (isSap) setEditTab("SAP_B1");
    else if (isM365) setEditTab("M365");
    else setEditTab(defaultTab);

    try {
      const creds = await ciamApi.getApplicationCredentials(app.id);
      setEditApiKey(creds.api_key || "");
      setEditClientId(creds.client_id || (isAd ? "CIAM" : `${app.app_code.toLowerCase()}-spoke-client`));
      setEditClientSecret(creds.client_secret || "");
      setEditRedirectUris(
        creds.redirect_uris ||
          `${app.base_url || "https://" + app.app_code + ".windowasia.com"}/api/auth/callback,http://localhost:3000/portal/callback`
      );
      setEditSsoEnabled(creds.sso_enabled ?? true);
      setEditSapCompanyDb(creds.sap_company_db || (isAd ? "157.173.219.153" : "WA_PROD"));
      setEditSapUsername(creds.sap_username || "");
      setEditSapPassword(creds.sap_password || "");
    } catch {
      setEditApiKey("");
      setEditClientId(isAd ? "CIAM" : `${app.app_code.toLowerCase()}-spoke-client`);
      setEditClientSecret("");
      setEditRedirectUris("");
      setEditSsoEnabled(true);
      setEditSapCompanyDb(isAd ? "157.173.219.153" : "WA_PROD");
      setEditSapUsername("");
      setEditSapPassword("");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApp) return;
    try {
      setSavingEdit(true);
      const effectiveApiKey = editApp.app_code === "ad" && (!editApiKey || editApiKey === "mgmt_ciam_key_9a88b1c0d2e3f4a5")
        ? (editClientSecret || "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823")
        : editApiKey;
      await ciamApi.updateApplication(editApp.id, {
        app_name: editAppName,
        base_url: editBaseUrl || undefined,
        api_key: effectiveApiKey || undefined,
        connector_type: editConnectorType,
        client_id: editClientId || undefined,
        client_secret: editClientSecret || undefined,
        redirect_uris: editRedirectUris || undefined,
        sso_enabled: editSsoEnabled,
        sap_company_db: editSapCompanyDb || undefined,
        sap_username: editSapUsername || undefined,
        sap_password: editSapPassword || undefined,
        ad_allow_status_patch: editAdAllowStatusPatch,
      });
      alert("บันทึกการตั้งค่าระบบ, M2M Key และ Active Directory สำเร็จ");
      setEditApp(null);
      fetchApps();
    } catch (err: any) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const fetchApps = async () => {
    try {
      setLoading(true);
      const data = await ciamApi.getApplications();
      setApps(data);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      const data = await ciamApi.getSyncSchedule();
      setScheduleData(data);
      setScheduleEnabled(data.enabled);
      setScheduleTime(data.time || "04:00");
    } catch (err) {
      console.error("Failed to load sync schedule:", err);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchSchedule();
  }, []);

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      const res = await ciamApi.syncAllApplications();
      setSyncAllResult(res);
      setSuccessToast(res.summary);
      setTimeout(() => setSuccessToast(null), 6000);
      fetchApps();
      fetchSchedule();
    } catch (err: any) {
      setErrorNotice({
        title: "การซิงก์ทุกระบบล้มเหลว",
        message: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อไปยังระบบลูก",
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleOpenScheduleModal = () => {
    if (scheduleData) {
      setScheduleEnabled(scheduleData.enabled);
      setScheduleTime(scheduleData.time || "04:00");
    }
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    try {
      setScheduleSaving(true);
      const updated = await ciamApi.updateSyncSchedule({
        enabled: scheduleEnabled,
        time: scheduleTime,
      });
      setScheduleData(updated);
      setShowScheduleModal(false);
      setSuccessToast(
        `บันทึกการตั้งค่ากำหนดเวลาซิงก์ข้อมูล (${updated.enabled ? `ทุกวันเวลา ${updated.time} น.` : "ปิดการซิงก์อัตโนมัติ"}) เรียบร้อยแล้ว`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      alert(`บันทึกการตั้งค่าล้มเหลว: ${err.message}`);
    } finally {
      setScheduleSaving(false);
    }
  };


  const handlePing = async (id: number) => {
    try {
      setPingingId(id);
      const res = await ciamApi.pingApplication(id);
      setApps((prev) =>
        prev.map((app) =>
          app.id === id
            ? {
                ...app,
                health_status: res.status as any,
                latency_ms: res.latency_ms,
                last_health_check_at: new Date().toISOString(),
              }
            : app
        )
      );
      if (res.status === "ONLINE") {
        setSuccessToast(`ทดสอบเชื่อมต่อสำเร็จ (${res.latency_ms} ms)`);
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setErrorNotice({
          title: "ระบบปลายทางออฟไลน์ (Offline)",
          message: res.message || "ไม่สามารถเชื่อมต่อไปยังระบบปลายทางได้ กรุณาตรวจสอบ Network หรือ Base URL",
        });
      }
    } catch (err: any) {
      setErrorNotice({
        title: "การทดสอบ Ping ล้มเหลว",
        message: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ",
      });
    } finally {
      setPingingId(null);
    }
  };

  const handleSync = async (id: number) => {
    try {
      setSyncingId(id);
      const res = await ciamApi.syncApplicationInventory(id);
      setSuccessToast(`ซิงก์ข้อมูลสำเร็จ: ดึงข้อมูลมาได้ ${res.total_accounts_fetched} บัญชีจาก ${res.app_code.toUpperCase()}`);
      setTimeout(() => setSuccessToast(null), 5000);
      fetchApps();
    } catch (err: any) {
      const msg = err.message || "";
      const isIpError = msg.includes("IP Whitelist") || msg.includes("Origin IP") || msg.includes("403");
      const ipMatch = msg.match(/Origin IP ['"]?([0-9.]+)['"]?/i);
      const detectedIp = ipMatch ? ipMatch[1] : "58.8.188.214";

      if (isIpError) {
        setErrorNotice({
          title: "ติดระบบความปลอดภัย IP Whitelist (HTTP 403)",
          message: `เซิร์ฟเวอร์ปลายทางปฏิเสธคำขอ เนื่องจาก Public IP ของเซิร์ฟเวอร์เรา (${detectedIp}) ยังไม่ได้รับอนุญาตใน IP Whitelist ของระบบลูก`,
          isIpWhitelistError: true,
          detectedIp: detectedIp,
          solution: `กรุณาเข้าสู่ระบบตั้งค่าของระบบลูก แล้วเพิ่ม IP "${detectedIp}" ในช่อง IP Whitelist หรือติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์`,
        });
      } else {
        setErrorNotice({
          title: "การซิงก์ข้อมูลล้มเหลว",
          message: msg,
          isIpWhitelistError: false,
        });
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteApp = async () => {
    if (!deleteConfirmApp) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await ciamApi.deleteApplication(deleteConfirmApp.id);
      setDeleteConfirmApp(null);
      setSuccessToast(res.message);
      setTimeout(() => setSuccessToast(null), 5000);
      fetchApps();
    } catch (err: any) {
      setDeleteError(err.message || "เกิดข้อผิดพลาดในการลบระบบ");
    } finally {
      setDeleting(false);
    }
  };

  const handleInspectAccounts = async (app: ConnectedApp) => {
    try {
      setInventoryLoading(true);
      setLiveInventory(null);
      const res = await ciamApi.getApplicationInventory(app.id);
      setLiveInventory({
        appName: app.app_name,
        total: res.total_accounts || res.accounts?.length || 0,
        accounts: res.accounts || [],
        notice: res.notice,
      });
    } catch (err: any) {
      const msg = err.message || "";
      const isIpError = msg.includes("IP Whitelist") || msg.includes("Origin IP") || msg.includes("403");
      const ipMatch = msg.match(/Origin IP ['"]?([0-9.]+)['"]?/i);
      const detectedIp = ipMatch ? ipMatch[1] : "58.8.188.214";

      if (isIpError) {
        setErrorNotice({
          title: `ติด IP Whitelist: ไม่สามารถดูบัญชีสดของ ${app.app_name}`,
          message: `เซิร์ฟเวอร์ ${app.app_code.toUpperCase()} ปฏิเสธการเชื่อมต่อ เนื่องจาก IP ${detectedIp} ยังไม่ได้รับอนุญาต`,
          isIpWhitelistError: true,
          detectedIp: detectedIp,
          solution: `กรุณาเพิ่ม IP "${detectedIp}" ในการตั้งค่าของ ${app.app_name}`,
        });
      } else {
        setErrorNotice({
          title: `ไม่สามารถดึงข้อมูลบัญชีจาก ${app.app_code.toUpperCase()}`,
          message: msg,
        });
      }
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await ciamApi.registerApplication({
        app_code: appCode,
        app_name: appName,
        connector_type: connectorType,
        base_url: baseUrl || undefined,
        api_key: apiKey || undefined,
        sap_company_db: connectorType === "SAP_B1" ? sapCompanyDb : undefined,
        sap_username: connectorType === "SAP_B1" ? sapUsername : undefined,
        sap_password: connectorType === "SAP_B1" ? sapPassword : undefined,
      });
      setShowAddModal(false);
      setAppCode("");
      setAppName("");
      setBaseUrl("");
      setApiKey("");
      setSapCompanyDb("WA_PROD");
      setSapUsername("");
      setSapPassword("");
      fetchApps();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลงทะเบียนระบบ: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ระบบที่เชื่อมต่อ
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full shadow-2xs">
              {apps.length} ระบบพร้อมใช้งาน
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ทะเบียนระบบลูกที่เชื่อมต่อผ่าน M2M REST API สำหรับการตรวจสอบและควบคุมสิทธิ์จากส่วนกลาง
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Scheduled Sync Settings Button */}
          <button
            onClick={handleOpenScheduleModal}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md text-xs sm:text-sm font-bold transition-colors shadow-2xs cursor-pointer"
            title="ตั้งค่ากำหนดเวลาการซิงก์ข้อมูลอัตโนมัติประจำวัน"
          >
            <Clock className="w-4 h-4 text-slate-600" />
            <span>
              กำหนดเวลาซิงก์:{" "}
              {scheduleData?.enabled ? (
                <span className="text-emerald-700 font-extrabold">{scheduleData.time} น.</span>
              ) : (
                <span className="text-slate-400 font-normal">ปิดใช้งาน</span>
              )}
            </span>
          </button>

          {/* Sync All Button */}
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-md text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            title="ดึงข้อมูลบัญชีล่าสุดจากระบบลูกทั้งหมดพร้อมกันทันที"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
            <span>{syncingAll ? "กำลังซิงก์ทุกระบบ..." : "⚡ ซิงก์ทุกระบบทันที"}</span>
          </button>

          {/* Register New App Button */}
          <button
            onClick={() => {
              const initialKey = generateRandomKey(appCode || "spoke");
              setApiKey(initialKey);
              setShowAddModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ ลงทะเบียนระบบใหม่</span>
          </button>
        </div>
      </div>


      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm font-semibold">
            กำลังโหลดข้อมูลระบบที่เชื่อมต่อ...
          </div>
        ) : (
          apps.map((app) => (
            <div key={app.id} className="bg-white p-6 rounded-lg border-2 border-slate-300 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-400 transition-all">
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 border-2 border-blue-300 flex items-center justify-center font-bold text-sm shadow-2xs">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight">{app.app_name}</h3>
                      <div className="text-xs text-slate-600 font-mono font-bold mt-0.5 uppercase">
                        รหัสระบบ: {app.app_code}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded text-[11px] font-bold">
                      {app.connector_type}
                    </span>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteConfirmApp(app);
                      }}
                      title={`ลบระบบ ${app.app_name}`}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 pt-4 border-t-2 border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">URL ปลายทาง:</span>
                    <span className="font-mono text-slate-900 font-bold truncate max-w-[170px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {app.base_url || "Local"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">จำนวนบัญชีที่ผูก:</span>
                    <span className="font-bold text-slate-900">{app.total_linked_accounts} บัญชี</span>
                  </div>

                  {app.connector_type === "AD_PROXY" || app.app_code === "ad" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">สิทธิ์คำสั่ง PATCH AD:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.ad_allow_status_patch
                            ? "bg-rose-100 text-rose-900 border border-rose-300"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        }`}
                      >
                        {app.ad_allow_status_patch ? "⚠️ อนุญาตคำสั่ง PATCH" : "🛡️ ปิด PATCH (Read-Only)"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Single Sign-On (SSO):</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.sso_enabled !== false
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {app.sso_enabled !== false ? "✓ SSO Active" : "✕ Disabled"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">สถานะการเชื่อมต่อ:</span>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          app.health_status === "ONLINE" ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      ></span>
                      <span
                        className={`font-bold ${
                          app.health_status === "ONLINE" ? "text-emerald-800" : "text-rose-800"
                        }`}
                      >
                        {app.health_status === "ONLINE" ? "ออนไลน์" : "ออฟไลน์"}
                      </span>
                      {app.latency_ms && (
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">({app.latency_ms} ms)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-3.5 border-t-2 border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>
                    {app.last_sync_at
                      ? `ซิงก์ล่าสุด ${formatDateTime(app.last_sync_at, false)}`
                      : "ยังไม่เคยซิงก์"}
                  </span>
                  {app.latency_ms && (
                    <span className="font-mono text-emerald-800 font-bold">{app.latency_ms} ms</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleInspectAccounts(app)}
                    disabled={inventoryLoading}
                    className="flex-1 min-w-[85px] flex items-center justify-center space-x-1 px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded-md text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>ดูบัญชีสด</span>
                  </button>

                  <button
                    onClick={() => handleSync(app.id)}
                    disabled={syncingId === app.id}
                    title="ซิงก์รายชื่อบัญชีผู้ใช้ทั้งหมด"
                    className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === app.id ? "animate-spin text-blue-600" : "text-slate-600"}`} />
                    <span>ซิงก์</span>
                  </button>

                  <button
                    onClick={() => handlePing(app.id)}
                    disabled={pingingId === app.id}
                    title="ทดสอบการเชื่อมต่อ"
                    className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <Activity className={`w-3.5 h-3.5 ${pingingId === app.id ? "animate-spin text-blue-600" : "text-slate-600"}`} />
                    <span>Ping</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(app, "SSO")}
                    title="ตั้งค่า Single Sign-On (OIDC / PKCE)"
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border-2 border-blue-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-700" />
                    <span>SSO</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(app, "M2M")}
                    title="ตั้งค่าระบบและจัดการ M2M API Key"
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-700" />
                    <span>M2M Key</span>
                  </button>

                  {(app.connector_type === "SAP_B1" || app.app_code.toLowerCase().includes("sap")) && (
                    <button
                      onClick={() => handleOpenEdit(app, "SAP_B1")}
                      title="ตั้งค่าเชื่อมต่อ SAP Business One Service Layer v2"
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-2 border-emerald-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-emerald-700" />
                      <span>SAP B1</span>
                    </button>
                  )}

                  {(app.connector_type === "AD_PROXY" || app.app_code.toLowerCase() === "ad") && (
                    <button
                      onClick={() => handleOpenEdit(app, "AD_PROXY")}
                      title="ตั้งค่า Active Directory Gateway และความปลอดภัยคำสั่ง PATCH"
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border-2 border-purple-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                      <span>AD Settings</span>
                    </button>
                  )}

                  {(app.connector_type === "M365" || app.app_code.toLowerCase().includes("m365")) && (
                    <button
                      onClick={() => handleOpenEdit(app, "M365")}
                      title="ตั้งค่าเชื่อมต่อ Microsoft 365 (Entra ID & Graph API)"
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border-2 border-sky-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5 text-sky-700" />
                      <span>M365</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit System & Secret Key / SSO Modal */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-2xl w-full p-6 space-y-4 rounded-xl border-2 border-slate-300 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200 shrink-0">
              <div className="flex items-center space-x-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  editTab === "AD_PROXY"
                    ? "bg-purple-100 border-2 border-purple-300 text-purple-800"
                    : editTab === "SAP_B1"
                    ? "bg-emerald-100 border-2 border-emerald-300 text-emerald-800"
                    : editTab === "M365"
                    ? "bg-sky-100 border-2 border-sky-300 text-sky-800"
                    : editTab === "SSO"
                    ? "bg-blue-100 border-2 border-blue-300 text-blue-800"
                    : "bg-amber-100 border-2 border-amber-300 text-amber-800"
                }`}>
                  {editTab === "AD_PROXY" ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : editTab === "SAP_B1" ? (
                    <Database className="w-4 h-4" />
                  ) : editTab === "M365" ? (
                    <Cloud className="w-4 h-4" />
                  ) : editTab === "SSO" ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>ตั้งค่าระบบ {editApp.app_name}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      {editApp.app_code.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    จัดการความปลอดภัย M2M API Keys, AD Gateway Guardrails และ OpenID Connect SSO
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditApp(null)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 gap-1 shrink-0">
              {(editApp.connector_type === "AD_PROXY" || editApp.app_code.toLowerCase() === "ad") && (
                <button
                  type="button"
                  onClick={() => setEditTab("AD_PROXY")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    editTab === "AD_PROXY"
                      ? "border-purple-600 text-purple-800 bg-purple-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Active Directory & Guardrails</span>
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                </button>
              )}
              {(editApp.connector_type === "SAP_B1" || editApp.app_code.toLowerCase().includes("sap")) && (
                <button
                  type="button"
                  onClick={() => setEditTab("SAP_B1")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    editTab === "SAP_B1"
                      ? "border-emerald-600 text-emerald-800 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SAP B1 Service Layer v2</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </button>
              )}
              {(editApp.connector_type === "M365" || editApp.app_code.toLowerCase().includes("m365")) && (
                <button
                  type="button"
                  onClick={() => setEditTab("M365")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    editTab === "M365"
                      ? "border-sky-600 text-sky-800 bg-sky-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-sky-600" />
                  <span>Microsoft 365 (Graph API)</span>
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditTab("M2M")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  editTab === "M2M"
                    ? "border-amber-600 text-amber-800 bg-amber-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>M2M Management API</span>
              </button>
              <button
                type="button"
                onClick={() => setEditTab("SSO")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  editTab === "SSO"
                    ? "border-blue-600 text-blue-800 bg-blue-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Single Sign-On (OIDC / PKCE)</span>
                {editSsoEnabled ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                )}
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              {/* Common Details: Name & Base URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อระบบเต็ม</label>
                  <input
                    type="text"
                    value={editAppName}
                    onChange={(e) => setEditAppName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base URL ของระบบ</label>
                  <input
                    type="text"
                    value={editBaseUrl}
                    onChange={(e) => setEditBaseUrl(e.target.value)}
                    placeholder="https://spoke.windowasia.com"
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* TAB 1: M2M Management API */}
              {editTab === "M2M" && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>Secret Key (X-Management-API-Key)</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditApiKey(generateRandomKey(editApp.app_code))}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>สุ่มสร้างใหม่</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {showSecret ? "ซ่อน" : "แสดง"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type={showSecret ? "text" : "password"}
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder="sec_app_mgmt_..."
                        className="flex-1 px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(editApiKey, setCopiedEditKey)}
                        className="px-3 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedEditKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>คัดลอก</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-amber-50/90 border border-amber-200 p-2.5 rounded text-left space-y-1 mt-2">
                      <div className="font-bold text-amber-900 flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                        <span>ข้อกำหนดการเชื่อมต่อ M2M:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1">
                        <li>
                          ส่งใน Request Header: <code className="bg-white px-1 py-0.2 rounded border border-amber-300 font-mono font-bold text-amber-900">X-Management-API-Key</code>
                        </li>
                        <li>
                          Whitelist IP เซิร์ฟเวอร์ CIAM: <code className="bg-white px-1 py-0.2 rounded border border-amber-300 font-mono text-slate-900">58.8.188.214</code>
                        </li>
                      </ul>
                    </div>

                    {/* cURL Snippet */}
                    <div className="p-2.5 bg-slate-900 rounded text-slate-200 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Code2 className="w-3 h-3 text-blue-400" />
                        <span>ตัวอย่างคำสั่งทดสอบเชื่อมต่อ (cURL):</span>
                      </div>
                      <pre className="text-[10px] font-mono overflow-x-auto text-emerald-400 whitespace-pre-wrap p-1.5 bg-slate-950 rounded border border-slate-800">
                        {`curl -X GET "${editBaseUrl || "https://spoke.windowasia.com"}/api/v1/directory/accounts" \\\n  -H "X-Management-API-Key: ${editApiKey || "<SECRET_KEY>"}"`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Single Sign-On (OIDC / PKCE) */}
              {editTab === "SSO" && (
                <div className="space-y-3.5">
                  {/* SSO Enable Toggle */}
                  <div className="p-3 bg-blue-50/70 border-2 border-blue-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span>สถานะ Single Sign-On (SSO Enforcement)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        เมื่อเปิดใช้งาน พนักงานจะล็อกอินผ่าน Central IAM Portal กลาง และใช้ Asymmetric RS256 Tokens
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSsoEnabled}
                        onChange={(e) => setEditSsoEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Client ID & Secret */}
                  <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-3">
                    {/* Client ID */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        OIDC Client ID
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editClientId}
                          onChange={(e) => setEditClientId(e.target.value)}
                          placeholder="e.g. irm-spoke-client"
                          className="flex-1 px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(editClientId, setCopiedClientId)}
                          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-md font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedClientId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Client Secret */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700">
                          OIDC Client Secret
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditClientSecret(generateRandomSecret(editApp.app_code))}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>สุ่มสร้าง Secret ใหม่</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            {showClientSecret ? "ซ่อน" : "แสดง"}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type={showClientSecret ? "text" : "password"}
                          value={editClientSecret}
                          onChange={(e) => setEditClientSecret(e.target.value)}
                          placeholder="sec_spoke_oauth_..."
                          className="flex-1 px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(editClientSecret, setCopiedClientSecret)}
                          className="px-3 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedClientSecret ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Redirect URIs */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Whitelisted Redirect URIs (คั่นด้วยจุลภาค ,)
                      </label>
                      <textarea
                        rows={2}
                        value={editRedirectUris}
                        onChange={(e) => setEditRedirectUris(e.target.value)}
                        placeholder="https://spoke.windowasia.com/api/auth/callback, http://localhost:3000/portal/callback"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600"
                      />
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        ระบุ URL ปลายทางที่อนุญาตให้ส่ง One-Time Authorization Code กลับไปหลังล็อกอินสำเร็จ
                      </span>
                    </div>
                  </div>

                  {/* Spoke SDK Code Integration Snippet */}
                  <div className="p-3 bg-slate-900 rounded-lg text-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>ตัวอย่างโค้ดเชื่อมต่อ Spoke Client SDK:</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSnippetLang("python")}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            snippetLang === "python"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Python FastAPI
                        </button>
                        <button
                          type="button"
                          onClick={() => setSnippetLang("js")}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            snippetLang === "js"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Next.js / JS
                        </button>
                      </div>
                    </div>

                    <pre className="text-[10px] font-mono overflow-x-auto text-emerald-400 p-2 bg-slate-950 rounded border border-slate-800 max-h-40 leading-relaxed">
                      {snippetLang === "python"
                        ? `# 1. ติดตั้งหรือนำ ciam_sso_client.py ไปวางในโปรเจกต์ระบบลูก\nfrom app.sdk.ciam_sso_client import CiamSsoClient\n\nclient = CiamSsoClient(\n    ciam_base_url="http://127.0.0.1:8001",\n    client_id="${editClientId || editApp.app_code + "-spoke-client"}",\n    client_secret="${editClientSecret || "<CLIENT_SECRET>"}",\n    ad_gateway_url="http://192.168.12.11:3100"\n)\n\n# 2. ขอ Authorize URL พร้อม PKCE\nverifier, challenge = client.generate_pkce()\nlogin_url = client.get_authorize_url(\n    redirect_uri="${(editRedirectUris.split(",")[0] || "").trim() || "https://spoke.windowasia.com/api/auth/callback"}",\n    code_challenge=challenge\n)\n\n# 3. แลก Token และ Verify RS256 Signature อัตโนมัติ\ntokens = client.exchange_code_for_tokens(code, redirect_uri, verifier)\nclaims = client.verify_id_token(tokens["id_token"])`
                        : `// Frontend Redirect to Central IAM SSO\nconst ciamUrl = "http://localhost:3000/oauth/authorize?" + new URLSearchParams({\n  response_type: "code",\n  client_id: "${editClientId || editApp.app_code + "-spoke-client"}",\n  redirect_uri: "${(editRedirectUris.split(",")[0] || "").trim() || "https://spoke.windowasia.com/api/auth/callback"}",\n  code_challenge: challenge,\n  code_challenge_method: "S256",\n  scope: "openid profile email"\n});\nwindow.location.href = ciamUrl;`}
                    </pre>
                  </div>

                  {/* Break-Glass Notice */}
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1 text-rose-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Break-Glass Fallback Strategy (ISO 27001):</span>
                    </div>
                    <p className="leading-relaxed">
                      หาก Central IAM ขัดข้อง ให้ระบบลูกสลับเข้าสู่โหมด Fallback ไปยัง Active Directory Gateway (:3100)
                      หรือเปิดสวิตช์ Emergency Local Admin เพื่อให้โรงงานและคลังสินค้าทำงานต่อได้ทันทีโดยไม่สะดุด
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: SAP Business One Service Layer v2 */}
              {editTab === "SAP_B1" && (
                <div className="space-y-3.5">
                  {/* Info Alert */}
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg space-y-1">
                    <div className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-700" />
                      <span>SAP Business One Service Layer v2 (Session Authentication)</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      ระบบจะทำการล็อกอินผ่าน <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono font-bold text-emerald-900">/b1s/v2/Login</code> เพื่อขอ Session Cookie ในการตรวจสอบการมีอยู่และสถานะบัญชีในตาราง Users (Read-Only Audit)
                    </p>
                  </div>

                  {/* Credentials Form Box */}
                  <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-3">
                    {/* Service Layer URL */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        SAP Service Layer Base URL
                      </label>
                      <input
                        type="text"
                        value={editBaseUrl}
                        onChange={(e) => setEditBaseUrl(e.target.value)}
                        placeholder="https://sapb1.waapps.net"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        ระบุ URL ของเซิร์ฟเวอร์ Service Layer เช่น <code>https://sapb1.waapps.net</code> (ระบบจะเชื่อมต่อไปยัง /b1s/v2/Login)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Company Database */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Company Database (CompanyDB)
                        </label>
                        <input
                          type="text"
                          value={editSapCompanyDb}
                          onChange={(e) => setEditSapCompanyDb(e.target.value)}
                          placeholder="เช่น WA_PROD"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          ชื่อฐานข้อมูลบริษัทใน SAP
                        </span>
                      </div>

                      {/* SAP Username */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          SAP Username (UserName)
                        </label>
                        <input
                          type="text"
                          value={editSapUsername}
                          onChange={(e) => setEditSapUsername(e.target.value)}
                          placeholder="เช่น ciam_reader หรือ manager"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          บัญชีสำหรับเชื่อมต่อ Service Layer
                        </span>
                      </div>
                    </div>

                    {/* SAP Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">
                          SAP Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowEditSapPassword(!showEditSapPassword)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                        >
                          {showEditSapPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showEditSapPassword ? "ซ่อนรหัส" : "แสดงรหัส"}</span>
                        </button>
                      </div>
                      <input
                        type={showEditSapPassword ? "text" : "password"}
                        value={editSapPassword}
                        onChange={(e) => setEditSapPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านบัญชี SAP"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    {/* Test Connection Button */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        ทดสอบส่งคำขอ Login ไปยัง Service Layer
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePing(editApp.id)}
                        disabled={pingingId === editApp.id}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Activity className={`w-3.5 h-3.5 ${pingingId === editApp.id ? "animate-spin text-emerald-600" : "text-emerald-700"}`} />
                        <span>{pingingId === editApp.id ? "กำลังทดสอบ..." : "⚡ ทดสอบ Login SAP B1"}</span>
                      </button>
                    </div>

                    {/* API Preview */}
                    <div className="p-2.5 bg-slate-900 rounded text-slate-200 space-y-1 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Code2 className="w-3 h-3 text-emerald-400" />
                        <span>Endpoints ที่ Central IAM เรียกใช้:</span>
                      </div>
                      <pre className="text-[10px] font-mono overflow-x-auto text-emerald-400 whitespace-pre-wrap p-1.5 bg-slate-950 rounded border border-slate-800">
                        {`1. Session Login:  POST ${editBaseUrl || "https://sapb1.waapps.net"}/b1s/v2/Login\n2. User Status:    GET ${editBaseUrl || "https://sapb1.waapps.net"}/b1s/v2/Users('{username}')?$select=UserCode,UserName,Locked\n   (Locked: "tNO" = Active | "tYES" = Disactive / Locked)`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Microsoft 365 Entra ID & Graph API */}
              {editTab === "M365" && (
                <div className="space-y-4">
                  {/* Info Alert */}
                  <div className="p-3 bg-sky-50 border-2 border-sky-200 rounded-lg space-y-1">
                    <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-sky-700" />
                      <span>Microsoft 365 / Microsoft Entra ID (Graph API Read-Only Monitor)</span>
                    </div>
                    <p className="text-[11px] text-sky-900 leading-relaxed">
                      เชื่อมต่อกับ Microsoft Graph API เพื่อดึงรายชื่อผู้ใช้ อีเมล และตรวจจับสิทธิ์ไม่ตรงกัน (Ghost Accounts) ตามมาตรฐานความปลอดภัย ISO 27001 (Safe Read-Only Mode)
                    </p>
                  </div>

                  {/* Warning on Azure Client Secret Value vs ID */}
                  <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-950 space-y-1.5 shadow-2xs">
                    <div className="font-extrabold flex items-center gap-1.5 text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>ข้อควรระวังสำคัญมากในการคัดลอก Client Secret จาก Azure Portal:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900">
                      ใน <strong>portal.azure.com</strong> &gt; <strong>App registrations</strong> &gt; แอปพลิเคชัน &gt; <strong>Certificates & secrets</strong>:
                      <br />• ให้คัดลอกค่าจากคอลัมน์ <strong>&quot;Value&quot;</strong> เท่านั้น (เป็นสตริง เช่น <code>wxy~8Q...</code>)
                      <br />• <strong>ห้ามคัดลอกคอลัมน์ &quot;Secret ID&quot;</strong> (เพราะ Secret ID เป็นเพียง UUID อ้างอิง จะทำให้เกิดข้อผิดพลาด <code>HTTP 401: AADSTS7000215: Invalid client secret provided</code> ทันที)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                    {/* Tenant ID */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Directory (Tenant) ID
                      </label>
                      <input
                        type="text"
                        value={editSapCompanyDb}
                        onChange={(e) => setEditSapCompanyDb(e.target.value)}
                        placeholder="เช่น 3bf476e6-c0a4-4e60-9692-f9a20c16c12b"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-sky-600"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        คัดลอกจากหน้า Overview ของ App Registration ใน Azure
                      </span>
                    </div>

                    {/* Client ID */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Application (Client) ID
                      </label>
                      <input
                        type="text"
                        value={editClientId}
                        onChange={(e) => setEditClientId(e.target.value)}
                        placeholder="เช่น 1d78dd68-7e09-4daa-8eac-de6331716980"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-sky-600"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Application ID ของ Entra App ที่ได้รับสิทธิ์ User.Read.All
                      </span>
                    </div>
                  </div>

                  {/* Client Secret Value */}
                  <div className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">
                        Client Secret Value (รหัสลับ Value - ไม่ใช่ Secret ID)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        {showClientSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showClientSecret ? "ซ่อนรหัส" : "แสดงรหัส"}</span>
                      </button>
                    </div>
                    <input
                      type={showClientSecret ? "text" : "password"}
                      value={editClientSecret}
                      onChange={(e) => setEditClientSecret(e.target.value)}
                      placeholder="วางค่า Value ของ Client Secret จาก Azure (ไม่ใช่ Secret ID)"
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-600"
                    />
                  </div>

                  {/* Base URL */}
                  <div className="text-xs">
                    <label className="block font-bold text-slate-700 mb-1">
                      Microsoft Graph Base URL
                    </label>
                    <input
                      type="text"
                      value={editBaseUrl || "https://graph.microsoft.com"}
                      onChange={(e) => setEditBaseUrl(e.target.value)}
                      placeholder="https://graph.microsoft.com"
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-600"
                    />
                  </div>

                  {/* Ping Test Button */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      ทดสอบขอ Access Token ผ่าน OAuth 2.0 Client Credentials
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePing(editApp.id)}
                      disabled={pingingId === editApp.id}
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border-2 border-sky-300 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Activity className={`w-3.5 h-3.5 ${pingingId === editApp.id ? "animate-spin text-sky-600" : "text-sky-700"}`} />
                      <span>{pingingId === editApp.id ? "กำลังทดสอบ..." : "⚡ ทดสอบต่อ Microsoft Graph"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: Active Directory & Safety Guardrails */}
              {editTab === "AD_PROXY" && (
                <div className="space-y-3.5">
                  {/* VPS Network Routing Alert & One-Click Preset */}
                  <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-2 border-purple-300 rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-extrabold text-purple-950 text-xs flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-purple-700" />
                          <span>การกำหนดค่าสำหรับเซิร์ฟเวอร์ Cloud VPS (Hostinger) ที่เชื่อมต่อ VPN ไปยัง On-Premise</span>
                        </div>
                        <p className="text-[11px] text-purple-900 leading-relaxed">
                          เนื่องจาก Central IAM รันอยู่บน Docker Container บนเซิร์ฟเวอร์ VPS ที่ต่อ VPN ไปยัง On-Premise Domain Controller 
                          การเชื่อมต่อไปยัง AD Gateway จึงต้องชี้ไปที่ <strong>Docker Host Gateway (<code>http://172.18.0.1:3100</code>)</strong> 
                          และส่ง Header <strong><code>X-Forwarded-For: 157.173.219.153</code></strong> เพื่อให้ผ่านการตรวจสอบ IP Whitelist ของ AD Sync Agent (แบบเดียวกับระบบ IRM)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditBaseUrl("http://172.18.0.1:3100");
                          setEditSapCompanyDb("157.173.219.153");
                          setEditClientId("CIAM");
                          setEditClientSecret("aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823");
                          setEditApiKey("aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823");
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold text-xs shrink-0 flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ ตั้งค่าเป็น VPS Gateway ทันที</span>
                      </button>
                    </div>
                  </div>

                  {/* Safety Guardrail Toggle Box */}
                  <div className={`p-4 rounded-lg border-2 transition-all ${
                    editAdAllowStatusPatch
                      ? "bg-rose-50 border-rose-300 shadow-xs"
                      : "bg-emerald-50 border-emerald-300 shadow-xs"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-xs">
                            เปิดใช้งานระบบ Active Directory (AD Master Switch & Status PATCH)
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            editAdAllowStatusPatch
                              ? "bg-rose-200 text-rose-900 border border-rose-400"
                              : "bg-emerald-200 text-emerald-900 border border-emerald-400"
                          }`}>
                            {editAdAllowStatusPatch ? "⚠️ เปิดใช้งาน (อนุญาตคำสั่ง PATCH)" : "🛡️ ปิดใช้งาน (โหมด Read-Only / สังเกตการณ์)"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {editAdAllowStatusPatch
                            ? "เมื่อ Admin สั่งระงับสิทธิ์หรือคืนสิทธิ์พนักงานในหน้า Offboarding ระบบ Central IAM จะส่งคำสั่ง PATCH ไปยัง AD Gateway เพื่อ Enable/Disable บัญชีจริงบน Windows Server"
                            : "ระบบ Central IAM จะทำหน้าที่เพียงแค่อ่านและตรวจสอบบัญชีจาก AD เพื่อเปรียบเทียบและตรวจหาบัญชีผี (Ghost Accounts) เท่านั้น โดยจะไม่แตะต้องหรือแก้ไขบัญชีใดๆ บน AD ทั้งสิ้น"}
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={editAdAllowStatusPatch}
                          onChange={(e) => setEditAdAllowStatusPatch(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Gateway Connection Details (Matching IRM Configuration Form) */}
                  <div className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* AD Gateway Endpoint URL */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 text-xs">
                            AD Gateway Endpoint URL *
                          </label>
                          <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200">
                            พอร์ต 3100
                          </span>
                        </div>
                        <input
                          type="text"
                          value={editBaseUrl}
                          onChange={(e) => setEditBaseUrl(e.target.value)}
                          placeholder="http://172.18.0.1:3100"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-purple-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          VPS Docker ใช้: <code>http://172.18.0.1:3100</code> | เครื่อง Local LAN ใช้: <code>http://192.168.12.11:3100</code>
                        </span>
                      </div>

                      {/* App ID (app_id) */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          App ID (app_id) *
                        </label>
                        <input
                          type="text"
                          value={editClientId}
                          onChange={(e) => setEditClientId(e.target.value)}
                          placeholder="CIAM หรือ IRM"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-purple-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          รหัสระบบที่ลงทะเบียนไว้ใน registry.json บนเซิร์ฟเวอร์ AD (เช่น CIAM หรือ IRM)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Secret Key (secret_key) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 text-xs">
                            Secret Key (secret_key) *
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                          >
                            {showClientSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showClientSecret ? "ซ่อน" : "แสดง"}</span>
                          </button>
                        </div>
                        <input
                          type={showClientSecret ? "text" : "password"}
                          value={editClientSecret}
                          onChange={(e) => setEditClientSecret(e.target.value)}
                          placeholder="aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-purple-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          คีย์ลับสำหรับยืนยันสิทธิ์ของ App ID ในการส่งคำขอตรวจสอบรหัสผ่าน
                        </span>
                      </div>

                      {/* Origin IP Header (X-Forwarded-For) */}
                      <div>
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          Origin IP Header (X-Forwarded-For) *
                        </label>
                        <input
                          type="text"
                          value={editSapCompanyDb}
                          onChange={(e) => setEditSapCompanyDb(e.target.value)}
                          placeholder="157.173.219.153"
                          className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-purple-600"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          IP ของเซิร์ฟเวอร์ที่อยู่ใน allowed_ips ของ AD Gateway (VPS: 157.173.219.153)
                        </span>
                      </div>
                    </div>

                    {/* Management API Key */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700 text-xs">
                          Management API Key / Secret Key (x-management-api-key)
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditApiKey(editClientSecret || "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823")}
                          className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                        >
                          คัดลอกจาก Secret Key ด้านบน
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder="aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-purple-600"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        ใช้สำหรับเรียก Endpoint ดึงข้อมูลผู้ใช้ (/api/v1/ad/users) เพื่อทำ Reconciliation (เทียบกับ secret_key ใน registry.json ฝั่ง On-Premise)
                      </span>
                    </div>

                    {/* Test Connection Button */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        ทดสอบส่งคำขอ Ping ตรวจสอบการเชื่อมต่อพอร์ต 3100
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePing(editApp.id)}
                        disabled={pingingId === editApp.id}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border-2 border-purple-300 rounded-md font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Activity className={`w-3.5 h-3.5 ${pingingId === editApp.id ? "animate-spin text-purple-600" : "text-purple-700"}`} />
                        <span>{pingingId === editApp.id ? "กำลังทดสอบ..." : "⚡ ทดสอบต่อ AD Gateway"}</span>
                      </button>
                    </div>

                    {/* Endpoints Documentation Box */}
                    <div className="p-2.5 bg-slate-900 rounded text-slate-200 space-y-1 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Code2 className="w-3 h-3 text-purple-400" />
                        <span>การทำงานและการส่ง Header ของ Central IAM ไปยัง AD Gateway:</span>
                      </div>
                      <pre className="text-[10px] font-mono overflow-x-auto text-purple-300 whitespace-pre-wrap p-1.5 bg-slate-950 rounded border border-slate-800">
                        {`• Base Gateway URL:   ${editBaseUrl || "http://172.18.0.1:3100"}\n• Header X-Forwarded-For: ${editSapCompanyDb || "157.173.219.153"} (ส่งทุก Request เพื่อผ่าน IP Whitelist)\n• Health Check:       GET  ${(editBaseUrl || "http://172.18.0.1:3100").replace("/api/v2/login", "")}/health\n• User Inventory:     GET  ${(editBaseUrl || "http://172.18.0.1:3100").replace("/api/v2/login", "")}/api/v1/ad/users\n• Verify Password:    POST ${(editBaseUrl || "http://172.18.0.1:3100").replace("/api/v2/login", "")}/api/v2/login`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t-2 border-slate-200 flex justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditApp(null)}
                  className="px-4 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-sm cursor-pointer"
                >
                  {savingEdit ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Inventory Accounts Modal */}
      {liveInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-xl w-full p-6 space-y-4 rounded-lg border-2 border-slate-300 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-800 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>รายชื่อผู้ใช้สดในระบบ {liveInventory.appName}</span>
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full">
                      {liveInventory.total} บัญชี
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    ข้อมูลสดจาก M2M REST Endpoint
                  </p>
                </div>
              </div>

              <button
                onClick={() => setLiveInventory(null)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Accounts Table */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {liveInventory.notice && (
                <div className="p-3 mb-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-start space-x-2">
                  <span className="text-base shrink-0">ℹ️</span>
                  <div className="leading-relaxed">{liveInventory.notice}</div>
                </div>
              )}
              {liveInventory.accounts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-medium">
                  {liveInventory.notice ? "ยังไม่มีข้อมูลบัญชีตอบกลับจากปลายทาง (โปรดดูรายละเอียดในแถบแจ้งเตือนด้านบน)" : "ไม่พบบัญชีผู้ใช้ในระบบลูกนี้"}
                </div>
              ) : (
                liveInventory.accounts.map((acc: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center font-bold text-blue-900 shadow-2xs">
                        {acc.full_name?.charAt(0) || acc.username?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center space-x-2">
                          <span>{acc.full_name || acc.username}</span>
                          <span className="font-mono text-blue-700 font-bold">({acc.username})</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                          อีเมล: {acc.email || "N/A"} • บทบาท: <strong className="text-slate-900">{acc.group_name || "User"}</strong>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        acc.is_active
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : "bg-rose-100 text-rose-900 border border-rose-300"
                      }`}
                    >
                      {acc.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center text-xs text-slate-600 font-semibold">
              <span>เชื่อมต่อผ่าน M2M REST API</span>
              <button
                onClick={() => setLiveInventory(null)}
                className="px-4 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md font-bold shadow-2xs cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 space-y-4 rounded-lg border-2 border-slate-300 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
              <h3 className="text-base font-bold text-slate-900">ลงทะเบียนระบบลูกใหม่</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">รหัสระบบ (Code)</label>
                <input
                  type="text"
                  placeholder="เช่น wms, qms, qol, erp"
                  value={appCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setAppCode(code);
                    if (!apiKey || apiKey.startsWith("sec_spoke_") || apiKey.startsWith("sec_")) {
                      setApiKey(generateRandomKey(code || "spoke"));
                    }
                  }}
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อระบบเต็ม</label>
                <input
                  type="text"
                  placeholder="เช่น QT Online System"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ประเภทการเชื่อมต่อ (Connector Type)</label>
                <select
                  value={connectorType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setConnectorType(val);
                    if (val === "SAP_B1" && !baseUrl) {
                      setBaseUrl("https://sapb1.waapps.net");
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-bold focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="REST_API">REST API (มาตรฐาน Spoke M2M Specification)</option>
                  <option value="SAP_B1">SAP Business One (Service Layer v2 OData)</option>
                  <option value="RPA_WORKER">RPA Worker (ระบบ Legacy ผ่าน Bot Automation)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {connectorType === "SAP_B1" ? "SAP Service Layer Base URL" : "Base URL ของระบบ"}
                </label>
                <input
                  type="text"
                  placeholder={connectorType === "SAP_B1" ? "https://sapb1.waapps.net" : "https://qol.windowasia.com"}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* SAP B1 Specific Fields */}
              {connectorType === "SAP_B1" ? (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg space-y-3">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-700" />
                    <span>ข้อมูลยืนยันตัวตน SAP Service Layer</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Company Database</label>
                      <input
                        type="text"
                        placeholder="เช่น WA_PROD"
                        value={sapCompanyDb}
                        onChange={(e) => setSapCompanyDb(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">SAP Username</label>
                      <input
                        type="text"
                        placeholder="เช่น ciam_reader"
                        value={sapUsername}
                        onChange={(e) => setSapUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">SAP Password</label>
                      <button
                        type="button"
                        onClick={() => setShowNewSapPassword(!showNewSapPassword)}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        {showNewSapPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showNewSapPassword ? "ซ่อนรหัส" : "แสดงรหัส"}</span>
                      </button>
                    </div>
                    <input
                      type={showNewSapPassword ? "text" : "password"}
                      placeholder="รหัสผ่าน SAP Service Layer"
                      value={sapPassword}
                      onChange={(e) => setSapPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              ) : (
                /* Secret Key Input with Generate & Copy */
                <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Secret Key (X-Management-API-Key)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setApiKey(generateRandomKey(appCode || "spoke"))}
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>สุ่มสร้างอัตโนมัติ</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sec_spoke_..."
                    className="flex-1 px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(apiKey, setCopiedNewKey)}
                    disabled={!apiKey}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-md font-bold flex items-center space-x-1 shadow-2xs shrink-0 cursor-pointer"
                  >
                    {copiedNewKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  กำหนดคีย์นี้ให้กับทีมพัฒนาระบบลูกเพื่อใส่ใน Header <code>X-Management-API-Key</code>
                </span>
              </div>
              )}

              <div className="pt-3 border-t-2 border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-sm cursor-pointer"
                >
                  {submitting ? "กำลังบันทึก..." : "ยืนยันลงทะเบียน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Application Confirmation Modal */}
      {deleteConfirmApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 space-y-4 rounded-lg border-2 border-rose-300 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  ยืนยันการลบระบบเชื่อมต่อ
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  คุณต้องการถอนการเชื่อมต่อและลบระบบ{" "}
                  <span className="font-bold text-slate-900 underline">
                    {deleteConfirmApp.app_name} ({deleteConfirmApp.app_code.toUpperCase()})
                  </span>{" "}
                  ออกจาก Central IAM ใช่หรือไม่?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>ผลกระทบที่จะเกิดขึ้น:</span>
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
                <li>
                  ยกเลิกการผูกบัญชีในระบบนี้จำนวน{" "}
                  <span className="font-bold">{deleteConfirmApp.total_linked_accounts} บัญชี</span>
                </li>
                <li>
                  ตัวตนหลักของพนักงานใน Active Directory จะ
                  <span className="font-bold"> ไม่ถูกลบ</span>
                </li>
                <li>การตั้งค่าและ API Secret Key ของระบบนี้จะถูกลบออกจากฐานข้อมูล</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-medium">
                {deleteError}
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2 border-t-2 border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteConfirmApp(null)}
                disabled={deleting}
                className="px-4 py-2 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteApp}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? "กำลังลบ..." : "ยืนยันลบระบบ"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Sync Schedule Settings Modal */}

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-lg w-full p-6 space-y-5 rounded-xl border-2 border-slate-300 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 border-2 border-indigo-300 text-indigo-800 flex items-center justify-center shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    กำหนดเวลาการซิงก์ข้อมูลอัตโนมัติ (Auto-Sync)
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">
                    รอบการดึงและรวบรวมข้อมูลสถานะผู้ใช้จากทุกระบบลูก (Spokes)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs text-slate-700">
              {/* Enable Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="font-bold text-slate-900 text-sm">เปิดใช้งานการซิงก์อัตโนมัติประจำวัน</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    รัน Background Job อัตโนมัติทุกวันโดยไม่ต้องมีผู้ดูแลระบบมากด
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Time Configuration */}
              <div className={`space-y-2 p-3.5 rounded-lg border transition-opacity ${scheduleEnabled ? "bg-white border-slate-300" : "bg-slate-100/70 border-slate-200 opacity-60 pointer-events-none"}`}>
                <label className="font-bold text-slate-900 flex items-center justify-between">
                  <span>เวลาที่ต้องการซิงก์ (เวลาไทย Asia/Bangkok, GMT+7):</span>
                  <span className="text-[11px] font-normal text-slate-500">รูปแบบ 24 ชั่วโมง (HH:MM)</span>
                </label>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      disabled={!scheduleEnabled}
                      className="w-full font-mono text-base font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 focus:border-indigo-600 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduleTime("04:00")}
                      className={`px-2.5 py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${
                        scheduleTime === "04:00"
                          ? "bg-indigo-100 text-indigo-900 border-indigo-400"
                          : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      04:00 น. (แนะนำ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleTime("02:00")}
                      className={`px-2.5 py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${
                        scheduleTime === "02:00"
                          ? "bg-indigo-100 text-indigo-900 border-indigo-400"
                          : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      02:00 น.
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 font-medium pt-1">
                  💡 แนะนำเวลา <strong>04:00 น.</strong> เนื่องจากเป็นช่วงที่มีการใช้งานต่ำ ข้อมูลพร้อมสำหรับผู้บริหารและ HR ก่อนเริ่มงาน 08:00 น.
                </p>
              </div>

              {/* Status & Next Run info */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5 text-blue-950">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-blue-900 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>รอบการซิงก์ถัดไป (Next Run):</span>
                  </span>
                  <span className="font-mono font-bold text-blue-800">
                    {scheduleEnabled && scheduleData?.next_run_at
                      ? `${formatDateTime(scheduleData.next_run_at, false)} น.`
                      : "ปิดใช้งาน"}
                  </span>
                </div>

                {scheduleData?.last_run_at && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-blue-200/60">
                    <span className="text-blue-800 font-medium">รอบล่าสุด:</span>
                    <span className="font-mono text-blue-700">
                      {formatDateTime(scheduleData.last_run_at, false)} น.
                      {scheduleData.last_summary ? ` (${scheduleData.last_summary})` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 flex items-center justify-between border-t-2 border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  handleSyncAll();
                }}
                disabled={syncingAll}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-md text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin" : ""}`} />
                <span>ซิงก์ทุกระบบทันที</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {scheduleSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Error / IP Whitelist Notice Modal */}
      {errorNotice && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 space-y-4 rounded-lg border-2 border-slate-300 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    errorNotice.isIpWhitelistError
                      ? "bg-amber-100 border-2 border-amber-300 text-amber-800"
                      : "bg-rose-100 border-2 border-rose-300 text-rose-800"
                  }`}
                >
                  {errorNotice.isIpWhitelistError ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {errorNotice.title}
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">
                    ระบบกำกับดูแลความปลอดภัยการเชื่อมต่อ M2M
                  </div>
                </div>
              </div>
              <button
                onClick={() => setErrorNotice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 text-slate-800">
                {errorNotice.message}
              </p>

              {errorNotice.isIpWhitelistError && errorNotice.detectedIp && (
                <div className="p-3 bg-amber-50 rounded-md border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-900 flex items-center space-x-1">
                    <span>Public IP ของเครื่อง Central IAM ปัจจุบัน:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={errorNotice.detectedIp}
                      className="flex-1 font-mono text-xs bg-white border border-amber-300 rounded px-2.5 py-1.5 font-bold text-amber-950 shadow-inner"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(errorNotice.detectedIp || "");
                        setCopiedIp(true);
                        setTimeout(() => setCopiedIp(false), 2500);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      {copiedIp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIp ? "คัดลอกแล้ว" : "คัดลอก IP"}</span>
                    </button>
                  </div>
                  {errorNotice.solution && (
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      💡 <strong>วิธีแก้ไข:</strong> {errorNotice.solution}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t-2 border-slate-200">
              <button
                onClick={() => setErrorNotice(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                รับทราบและปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-xl text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Check className="w-4 h-4 text-emerald-100" />
          <span>{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
