"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Building2,
  Layers,
  LogOut,
  User,
  Shield,
  Sparkles,
  Inbox,
  Lock,
  Key,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Activity,
  Search,
  X,
} from "lucide-react";
import { api, PortalAppItem, AdminUserOut } from "@/lib/api";

export default function PortalPage() {
  const router = useRouter();

  const [apps, setApps] = useState<PortalAppItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [launchingAppCode, setLaunchingAppCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Client-Side VPN Reachability Probe Engine
  type VpnState = "checking" | "connected" | "disconnected";
  const [vpnReachability, setVpnReachability] = useState<Record<string, VpnState>>({});
  const appsRef = useRef<PortalAppItem[]>([]);

  useEffect(() => {
    appsRef.current = apps;
  }, [apps]);

  const probeAppVpn = async (targetUrl: string, timeoutMs: number = 2500): Promise<boolean> => {
    if (!targetUrl) return false;
    try {
      let cleanUrl = targetUrl.trim();
      try {
        const parsed = new URL(cleanUrl);
        cleanUrl = `${parsed.protocol}//${parsed.host}`;
      } catch {}

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      await fetch(cleanUrl, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return true;
    } catch {
      return false;
    }
  };

  const checkVpnForApp = async (app: PortalAppItem) => {
    if (app.network_policy !== "VPN_ONLY") return;
    setVpnReachability((prev) => ({ ...prev, [app.app_code]: "checking" }));
    const targetUrl = app.base_url || app.portal_launch_url || app.launch_url || "";
    const reachable = await probeAppVpn(targetUrl);
    setVpnReachability((prev) => ({
      ...prev,
      [app.app_code]: reachable ? "connected" : "disconnected",
    }));
  };

  const checkVpnForApps = async (appsList: PortalAppItem[]) => {
    const vpnApps = appsList.filter((a) => a.network_policy === "VPN_ONLY");
    if (vpnApps.length === 0) return;

    setVpnReachability((prev) => {
      const next = { ...prev };
      for (const a of vpnApps) {
        next[a.app_code] = "checking";
      }
      return next;
    });

    await Promise.all(
      vpnApps.map(async (a) => {
        const targetUrl = a.base_url || a.portal_launch_url || a.launch_url || "";
        const reachable = await probeAppVpn(targetUrl);
        setVpnReachability((prev) => ({
          ...prev,
          [a.app_code]: reachable ? "connected" : "disconnected",
        }));
      })
    );
  };

  // Automatically re-probe whenever the user switches back to this browser tab (e.g. after connecting VPN in desktop app)
  useEffect(() => {
    const handleFocus = () => {
      if (appsRef.current.length > 0) {
        checkVpnForApps(appsRef.current);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Load user profile & authorized apps
  useEffect(() => {
    const token = localStorage.getItem("ciam_token");
    if (!token) {
      router.replace("/login?redirect=/portal");
      return;
    }

    const storedUser = localStorage.getItem("ciam_user");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch {}
    }

    // Refresh profile from server to ensure fresh department & role
    api
      .getAdminMe()
      .then((me) => {
        setCurrentUser(me);
        localStorage.setItem("ciam_user", JSON.stringify(me));
      })
      .catch(() => {});

    loadApps();
  }, [router]);

  const loadApps = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getPortalApps();
      setApps(data);
      checkVpnForApps(data);
    } catch (err: any) {
      console.error("Failed to load portal apps:", err);
      setErrorMsg("ไม่สามารถโหลดรายการระบบงานได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("คุณต้องการออกจากระบบ Single Sign-On หรือไม่?")) {
      localStorage.removeItem("ciam_token");
      localStorage.removeItem("ciam_user");
      router.replace("/login");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      await api.updateAdminProfile({ new_password: newPassword });
      setPasswordSuccess(true);
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLaunch = async (app: PortalAppItem) => {
    if (!app.client_id) return;
    setLaunchingAppCode(app.app_code);
    try {
      const isVerified = app.network_policy === "VPN_ONLY" ? vpnReachability[app.app_code] === "connected" : true;
      const res = await api.launchPortalApp(app.client_id, undefined, undefined, isVerified);
      if (res && res.launch_url) {
        // Navigate directly in the same tab to save RAM and avoid spawning duplicate browser tabs
        window.location.href = res.launch_url;
        return;
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการเปิดระบบ: " + (err.message || "ไม่สามารถสร้าง SSO Ticket ได้"));
      setLaunchingAppCode(null);
    }
  };


  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const getAppTheme = (appCode: string) => {
    switch (appCode.toLowerCase()) {
      case "irm":
        return {
          icon: <Boxes className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-amber-500 to-orange-600 shadow-md shadow-amber-500/25",
          cardGlow: "hover:border-amber-400/90 hover:shadow-amber-500/10",
          btn: "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm shadow-amber-500/25",
        };
      case "qms":
        return {
          icon: <ClipboardCheck className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25",
          cardGlow: "hover:border-emerald-400/90 hover:shadow-emerald-500/10",
          btn: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm shadow-emerald-500/25",
        };
      case "qol":
        return {
          icon: <FileSpreadsheet className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-md shadow-blue-500/25",
          cardGlow: "hover:border-blue-400/90 hover:shadow-blue-500/10",
          btn: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25",
        };
      case "sap_b1":
        return {
          icon: <Building2 className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/25",
          cardGlow: "hover:border-indigo-400/90 hover:shadow-indigo-500/10",
          btn: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm shadow-indigo-500/25",
        };
      case "mtpulse":
        return {
          icon: <Activity className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/25",
          cardGlow: "hover:border-cyan-400/90 hover:shadow-cyan-500/10",
          btn: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-sm shadow-cyan-500/25",
        };
      case "worksync":
        return {
          icon: <Layers className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-violet-500 to-fuchsia-600 shadow-md shadow-violet-500/25",
          cardGlow: "hover:border-violet-400/90 hover:shadow-violet-500/10",
          btn: "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-sm shadow-violet-500/25",
        };
      default:
        return {
          icon: <Layers className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-slate-600 to-slate-800 shadow-md shadow-slate-500/25",
          cardGlow: "hover:border-slate-400/90 hover:shadow-slate-500/10",
          btn: "bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white shadow-sm shadow-slate-700/25",
        };
    }
  };

  const isAdmin = currentUser?.role && currentUser.role !== "PORTAL_USER";

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        app.app_name.toLowerCase().includes(q) ||
        app.app_code.toLowerCase().includes(q) ||
        (app.description && app.description.toLowerCase().includes(q)) ||
        (app.category && app.category.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      if (selectedCategory === "all") return true;
      if (selectedCategory === "vpn") return app.network_policy === "VPN_ONLY";
      if (selectedCategory === "prod") {
        return (
          app.app_code.toLowerCase() === "irm" ||
          app.app_code.toLowerCase() === "qms" ||
          (app.category && app.category.includes("ผลิต"))
        );
      }
      if (selectedCategory === "sales") {
        return (
          app.app_code.toLowerCase() === "qol" ||
          app.app_code.toLowerCase() === "mtpulse" ||
          (app.category && (app.category.includes("ขาย") || app.category.includes("เสนอราคา")))
        );
      }
      if (selectedCategory === "erp") {
        return (
          app.app_code.toLowerCase() === "sap_b1" ||
          app.app_code.toLowerCase() === "worksync" ||
          (app.category && (app.category.includes("ERP") || app.category.includes("บริหาร")))
        );
      }

      return true;
    });
  }, [apps, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100/90 via-sky-50/80 to-blue-100/70 text-slate-800 flex flex-col font-sans relative">
      {/* ─── Ambient Glow Decorative Elements ──────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-sky-200/50 via-blue-100/30 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-24 right-8 w-96 h-96 bg-blue-300/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 left-10 w-80 h-80 bg-sky-300/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ─── 1. Frozen Top Navigation Bar ──────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-b border-sky-200/80 px-4 sm:px-8 h-16 flex items-center justify-between shadow-xs">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 ring-2 ring-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
              <span>Window Asia</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 shadow-2xs">
                SSO App Portal
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              ระบบศูนย์รวมแอปพลิเคชัน Single Sign-On
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Admin Console Switcher (Visible to Admins only) */}
          {isAdmin && (
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              title="สลับไปยังหน้าจัดการ Admin Console"
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Admin Console</span>
            </Link>
          )}

          {/* User Info Chip */}
          <div className="flex items-center gap-2 pl-2.5 py-1 bg-sky-50/90 rounded-full border border-sky-200/90 shadow-2xs pr-1.5 backdrop-blur-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-2xs">
              {currentUser?.full_name ? currentUser.full_name.charAt(0) : "U"}
            </div>
            <div className="text-left text-xs pr-1">
              <div className="font-bold text-slate-900 leading-tight">
                {currentUser?.full_name || currentUser?.username || "พนักงาน"}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {currentUser?.department || (isAdmin ? "ผู้ดูแลระบบ IT" : "พนักงานองค์กร")}
              </div>
            </div>

            <div className="w-px h-4 bg-sky-200" />

            <button
              onClick={() => {
                setNewPassword("");
                setConfirmPassword("");
                setPasswordError(null);
                setPasswordSuccess(false);
                setIsPasswordModalOpen(true);
              }}
              className="p-1 rounded-full text-slate-500 hover:text-blue-600 hover:bg-white transition-colors cursor-pointer"
              title="เปลี่ยนรหัสผ่าน Single Sign-On"
            >
              <Key className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleLogout}
              className="p-1 rounded-full text-slate-500 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Portal Content (Offset for fixed header) ─────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 space-y-4">
        {/* ─── 2. Compact, Friendly Greeting Bar (No technical jargon) ───────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-sky-200/60">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>สวัสดี, {currentUser?.full_name || currentUser?.username || "พนักงาน"}</span>
              <span className="text-xl">👋</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              เลือกระบบงานที่ต้องการเข้าใช้งาน หรือค้นหาจากแถบด้านล่าง
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-sky-200 text-xs font-bold text-sky-900 shadow-2xs self-start sm:self-auto">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>{apps.length} ระบบพร้อมใช้งาน</span>
          </div>
        </div>

        {/* ─── Compact Search & Category Filter Toolbar ────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/70 backdrop-blur-md p-2.5 rounded-2xl border border-sky-200/70 shadow-2xs">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "ทั้งหมด" },
              { id: "prod", label: "🏭 การผลิต & คลัง" },
              { id: "sales", label: "📊 การขาย" },
              { id: "erp", label: "💼 ERP & บริหาร" },
              { id: "vpn", label: "🛡️ ต้องใช้ VPN" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-sky-50 text-slate-700 border border-slate-200/80"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาระบบงาน..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs transition-all"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <span>{errorMsg}</span>
            <button
              onClick={loadApps}
              className="text-xs font-bold text-rose-900 underline hover:no-underline cursor-pointer"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white/90 rounded-2xl border border-sky-200/80 p-4 animate-pulse space-y-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-2/3 h-3.5 bg-slate-200 rounded" />
                    <div className="w-1/3 h-2.5 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-8 bg-slate-100 rounded-lg" />
                <div className="w-full h-9 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* ─── 3. Compact, Space-Efficient 4-Column App Cards Grid ─────────── */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredApps.map((app) => {
              const theme = getAppTheme(app.app_code);
              const isLaunching = launchingAppCode === app.app_code;
              const isSsoClientMode = app.connector_type === "SSO_ONLY" || app.connector_type === "SSO_CLIENT";
              const isOffline = app.health_status === "OFFLINE" && !isSsoClientMode;
              const isSpokeSsoDisabled = app.spoke_sso_status === "DISABLED" && !isSsoClientMode;
              
              const isVpnRequired = app.network_policy === "VPN_ONLY";
              const vpnStatus = isVpnRequired ? (vpnReachability[app.app_code] || (app.is_vpn_locked ? "disconnected" : "checking")) : "connected";
              const isVpnChecking = isVpnRequired && vpnStatus === "checking";
              const isVpnConnected = isVpnRequired && vpnStatus === "connected";
              const isVpnLocked = isVpnRequired && !isVpnConnected;

              return (
                <div
                  key={app.id}
                  className={`group relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur-md border p-4 sm:p-4.5 shadow-2xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-3.5 ${
                    isOffline
                      ? "border-rose-200 bg-rose-50/20"
                      : isSpokeSsoDisabled
                      ? "border-amber-200 bg-amber-50/20"
                      : isVpnChecking
                      ? "border-slate-200"
                      : isVpnConnected
                      ? "border-sky-300 hover:border-sky-400"
                      : isVpnLocked
                      ? "border-amber-300 bg-amber-50/25"
                      : `border-slate-200/90 ${theme.cardGlow}`
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Top: App Icon, Code & Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      {/* Compact Squircle 3D Icon */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ring-2 ring-white ${
                          isOffline
                            ? "bg-slate-300 text-slate-500 shadow-xs"
                            : isVpnChecking
                            ? "bg-slate-200 text-slate-600 shadow-xs"
                            : isVpnConnected
                            ? "bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25"
                            : isVpnLocked
                            ? "bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25"
                            : theme.iconContainer
                        }`}
                      >
                        {theme.icon}
                      </div>

                      {/* Code Pill & Live Status Indicators */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                          {app.app_code}
                        </span>

                        {isOffline ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            ออฟไลน์
                          </span>
                        ) : isSpokeSsoDisabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                            Break-Glass
                          </span>
                        ) : isVpnRequired ? (
                          isVpnChecking ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-500" />
                              ตรวจ VPN
                            </span>
                          ) : isVpnConnected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 text-sky-700 border border-sky-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                              VPN พร้อม
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-2.5 h-2.5 text-amber-600" />
                              ต้องต่อ VPN
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            พร้อมใช้
                          </span>
                        )}
                      </div>
                    </div>

                    {/* App Name & Category */}
                    <div>
                      <h2 className={`font-black text-sm leading-snug transition-colors line-clamp-1 ${
                        isOffline ? "text-slate-500" : "text-slate-900 group-hover:text-blue-600"
                      }`}>
                        {app.app_name}
                      </h2>
                      {app.category && (
                        <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">
                          {app.category.split(" (")[0]}
                        </span>
                      )}
                    </div>

                    {/* Compact App Description */}
                    {(() => {
                      const desc = app.description || "แอปพลิเคชันสำหรับบุคลากรภายในองค์กร";
                      const match = desc.match(/^(.*?)\s*\((.*?)\)$/);
                      const displayDesc = match ? match[1].trim() : desc;
                      return (
                        <p className="text-xs text-slate-600 leading-snug line-clamp-2 min-h-[2.5rem]">
                          {displayDesc}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Bottom: Compact Single Launch Button */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        if (isVpnLocked) {
                          checkVpnForApp(app);
                        } else {
                          handleLaunch(app);
                        }
                      }}
                      disabled={isLaunching || isOffline || isSpokeSsoDisabled || isVpnChecking}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                        isOffline
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                          : isSpokeSsoDisabled
                          ? "bg-amber-50 text-amber-700 border border-amber-300 cursor-not-allowed shadow-none"
                          : isVpnChecking
                          ? "bg-slate-100 text-slate-600 border border-slate-200 cursor-wait shadow-none font-semibold"
                          : isVpnConnected
                          ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20 cursor-pointer"
                          : isVpnLocked
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer shadow-none font-bold"
                          : `${theme.btn} cursor-pointer`
                      }`}
                    >
                      {isLaunching ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังนำทาง...</span>
                        </>
                      ) : isOffline ? (
                        <span>ปิดปรับปรุง (Offline)</span>
                      ) : isSpokeSsoDisabled ? (
                        <span>ปิดรับ SSO</span>
                      ) : isVpnChecking ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                          <span>กำลังตรวจ VPN...</span>
                        </span>
                      ) : isVpnConnected ? (
                        <>
                          <span>เข้าใช้งานระบบ</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </>
                      ) : isVpnLocked ? (
                        <span className="flex items-center justify-center gap-1 text-center">
                          <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>ต่อ VPN แล้วตรวจใหม่</span>
                          <RefreshCw className="w-3 h-3 ml-0.5 text-amber-700 shrink-0" />
                        </span>
                      ) : (
                        <>
                          <span>เข้าใช้งานระบบ</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Empty Search Result ─────────────────────────────────────────── */}
        {!loading && apps.length > 0 && filteredApps.length === 0 && (
          <div className="text-center py-12 bg-white/90 backdrop-blur-md rounded-2xl border border-dashed border-sky-300 p-6 space-y-2 shadow-2xs">
            <div className="w-10 h-10 mx-auto rounded-xl bg-sky-100 flex items-center justify-center text-sky-600">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">ไม่พบระบบงานที่ตรงกับคำค้นหา &quot;{searchQuery}&quot;</h3>
            <p className="text-[11px] text-slate-500">กรุณาลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="text-xs font-bold text-blue-600 underline hover:no-underline cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}

        {/* ─── Empty State: No Authorized Apps ────────────────────────────── */}
        {!loading && apps.length === 0 && (
          <div className="text-center py-12 bg-white/90 backdrop-blur-md rounded-2xl border border-dashed border-sky-300 p-6 space-y-3 shadow-2xs">
            <div className="w-12 h-12 mx-auto rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-sm font-bold text-slate-900">
                ยังไม่มีระบบงานที่ได้รับสิทธิ์
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                บัญชีของท่านยังไม่ได้รับสิทธิ์เข้าใช้งานระบบงานใดในขณะนี้ หากต้องการขอสิทธิ์เข้าใช้งาน กรุณาติดต่อฝ่ายเทคโนโลยีสารสนเทศ (IT Support)
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ─── Clean Minimal Footer ─────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-sky-200/60 bg-white/80 backdrop-blur-md py-3 px-4 text-center text-xs text-slate-500 font-medium">
        <p>© 2026 บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) • Central Single Sign-On Portal</p>
      </footer>

      {/* ─── Password Change Modal ────────────────────────────────────────── */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-sm w-full p-6 space-y-4 rounded-xl border border-slate-200 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">เปลี่ยนรหัสผ่าน Single Sign-On</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    รหัสผ่านนี้ใช้ล็อกอินเข้า App Portal ทุกครั้ง
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {passwordSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm text-emerald-900">เปลี่ยนรหัสผ่านสำเร็จ!</div>
                <p className="text-slate-600 font-medium">ระบบได้อัปเดตรหัสผ่านกลางของคุณเรียบร้อยแล้ว</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3.5">
                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold">
                    {passwordError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่"
                      className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยืนยันรหัสผ่านใหม่อีกครั้ง *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                  >
                    {passwordSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <span>บันทึกรหัสผ่านใหม่</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

