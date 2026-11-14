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
  AlertTriangle,
  Clock,
  Monitor,
  Download,
  Terminal,
  Sun,
  Moon,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { api, PortalAppItem, AdminUserOut } from "@/lib/api";
import {
  useSessionWatchdog,
  checkTokenValidOnReturn,
  clearSessionStorage,
  markSessionActivity,
  markNavigatingToSpokeApp,
  performManualLogout,
} from "@/lib/session";

export default function PortalPage() {
  const router = useRouter();
  const { remainingSeconds } = useSessionWatchdog({ enabled: true });

  const formatRemainingTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`;
  };

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

  // Per-user Personalization State: Light/Dark Theme & Drag-and-Drop Card Order
  const [portalTheme, setPortalTheme] = useState<"light" | "dark">("light");
  const [appOrder, setAppOrder] = useState<string[]>([]);
  const [draggedAppCode, setDraggedAppCode] = useState<string | null>(null);
  const [dragOverAppCode, setDragOverAppCode] = useState<string | null>(null);

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
      // For RDP protocol or relative download URLs, probe via relative check or backend
      if (cleanUrl.startsWith("rdp://") || cleanUrl.startsWith("/")) {
        cleanUrl = `${window.location.origin}/api/v1/auth/me`;
      } else {
        try {
          const parsed = new URL(cleanUrl);
          cleanUrl = `${parsed.protocol}//${parsed.host}`;
        } catch {}
      }

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
    // For RDP apps, probe using the RDP download endpoint with HEAD/GET or server auth check
    const targetUrl = app.connector_type === "RDP"
      ? (app.portal_launch_url || "/api/v1/oauth/portal/rdp/wa_rdt2.rdp")
      : (app.base_url || app.portal_launch_url || app.launch_url || "");
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
        const targetUrl = a.connector_type === "RDP"
          ? (a.portal_launch_url || "/api/v1/oauth/portal/rdp/wa_rdt2.rdp")
          : (a.base_url || a.portal_launch_url || a.launch_url || "");
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
    const tokenCheck = checkTokenValidOnReturn();
    if (!tokenCheck.valid) {
      clearSessionStorage();
      if (tokenCheck.reason === "token_expired") {
        router.replace(`/login?expired=1&reason=token_expired&redirect=/portal`);
      } else {
        router.replace(`/login?redirect=/portal`);
      }
      return;
    }

    // Returning to /portal (e.g. after logging out from a Spoke App Client) starts a fresh 30-min Portal Idle Timer
    markSessionActivity();

    const storedTheme = localStorage.getItem("ciam_portal_theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setPortalTheme(storedTheme);
    }
    const storedOrder = localStorage.getItem("ciam_portal_app_order");
    if (storedOrder) {
      try {
        const parsedOrder = JSON.parse(storedOrder);
        if (Array.isArray(parsedOrder)) setAppOrder(parsedOrder);
      } catch {}
    }

    const storedUser = localStorage.getItem("ciam_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        if (parsedUser?.portal_preferences?.theme === "dark" || parsedUser?.portal_preferences?.theme === "light") {
          setPortalTheme(parsedUser.portal_preferences.theme);
        }
        if (Array.isArray(parsedUser?.portal_preferences?.app_order)) {
          setAppOrder(parsedUser.portal_preferences.app_order);
        }
      } catch {}
    }

    // Refresh profile from server to ensure fresh department, role & portal preferences
    api
      .getAdminMe()
      .then((me) => {
        setCurrentUser(me);
        localStorage.setItem("ciam_user", JSON.stringify(me));
        const serverTheme = me.portal_preferences?.theme;
        if (serverTheme === "dark" || serverTheme === "light") {
          setPortalTheme(serverTheme);
          localStorage.setItem("ciam_portal_theme", serverTheme);
        }
        const serverOrder = me.portal_preferences?.app_order;
        if (Array.isArray(serverOrder)) {
          setAppOrder(serverOrder);
          localStorage.setItem("ciam_portal_app_order", JSON.stringify(serverOrder));
        }
        if (me.is_ad_user === false && me.must_change_password === true) {
          setIsPasswordModalOpen(true);
        }
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
      performManualLogout("/login");
    }
  };

  const validatePasswordComplexityClient = (pwd: string, username?: string): string | null => {
    if (pwd.length < 8 || pwd.length > 16) {
      return `รหัสผ่านต้องมีความยาวระหว่าง 8 ถึง 16 ตัวอักษร (ปัจจุบัน ${pwd.length} ตัวอักษร)`;
    }
    if (!/[A-Z]/.test(pwd)) {
      return "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว";
    }
    if (!/[a-z]/.test(pwd)) {
      return "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว";
    }
    if (!/[0-9]/.test(pwd)) {
      return "รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pwd)) {
      return "รหัสผ่านต้องมีอักขระพิเศษ (!@#$%^&*...) อย่างน้อย 1 ตัว";
    }
    if (username && username.trim().length >= 3) {
      const cleanUser = username.trim().toLowerCase();
      if (pwd.toLowerCase().includes(cleanUser)) {
        return "รหัสผ่านต้องไม่มีชื่อผู้ใช้ (Username) ปะปนอยู่";
      }
    }
    return null;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const complexityErr = validatePasswordComplexityClient(newPassword, currentUser?.username);
    if (complexityErr) {
      setPasswordError(complexityErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      const res = await api.updateAdminProfile({ new_password: newPassword });
      setPasswordSuccess(true);
      setCurrentUser(res);
      localStorage.setItem("ciam_user", JSON.stringify(res));
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
        if (app.connector_type === "RDP" || app.app_code === "wa_rdt2") {
          // Trigger file download for RDP connection file without leaving the portal page
          const link = document.createElement("a");
          link.href = res.launch_url;
          link.download = "wa-rdt2.rdp";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => setLaunchingAppCode(null), 1200);
          return;
        }

        // Pause SSO Portal 30-min Idle Timer while the user is working in the Spoke App Client
        markNavigatingToSpokeApp();
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
      case "wa_rdt2":
        return {
          icon: <Monitor className="w-5.5 h-5.5 text-white" />,
          iconContainer: "bg-gradient-to-tr from-blue-600 to-slate-800 shadow-md shadow-blue-500/25",
          cardGlow: "hover:border-blue-500/90 hover:shadow-blue-500/15",
          btn: "bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white shadow-sm shadow-blue-700/25",
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
  const isDark = portalTheme === "dark";

  const togglePortalTheme = () => {
    const nextTheme: "light" | "dark" = portalTheme === "dark" ? "light" : "dark";
    setPortalTheme(nextTheme);
    localStorage.setItem("ciam_portal_theme", nextTheme);
    api
      .updatePortalPreferences({ theme: nextTheme })
      .then((updated) => {
        setCurrentUser(updated);
        localStorage.setItem("ciam_user", JSON.stringify(updated));
      })
      .catch(() => {});
  };

  const persistAppOrder = (nextOrder: string[]) => {
    setAppOrder(nextOrder);
    localStorage.setItem("ciam_portal_app_order", JSON.stringify(nextOrder));
    api
      .updatePortalPreferences({ app_order: nextOrder })
      .then((updated) => {
        setCurrentUser(updated);
        localStorage.setItem("ciam_user", JSON.stringify(updated));
      })
      .catch(() => {});
  };

  const resetAppOrder = () => {
    setAppOrder([]);
    localStorage.removeItem("ciam_portal_app_order");
    api
      .updatePortalPreferences({ app_order: [] })
      .then((updated) => {
        setCurrentUser(updated);
        localStorage.setItem("ciam_user", JSON.stringify(updated));
      })
      .catch(() => {});
  };

  // Ordered full app list honoring user's personal drag-and-drop sequence
  const orderedApps = useMemo(() => {
    if (!appOrder || appOrder.length === 0) return apps;
    const rank = new Map<string, number>();
    appOrder.forEach((code, idx) => rank.set(code.toLowerCase(), idx));
    return [...apps].sort((a, b) => {
      const ra = rank.has(a.app_code.toLowerCase()) ? rank.get(a.app_code.toLowerCase())! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.app_code.toLowerCase()) ? rank.get(b.app_code.toLowerCase())! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return apps.indexOf(a) - apps.indexOf(b);
    });
  }, [apps, appOrder]);

  const handleCardDrop = (targetAppCode: string) => {
    if (!draggedAppCode || draggedAppCode.toLowerCase() === targetAppCode.toLowerCase()) {
      setDraggedAppCode(null);
      setDragOverAppCode(null);
      return;
    }
    const baseOrder = orderedApps.map((a) => a.app_code.toLowerCase());
    const fromIdx = baseOrder.indexOf(draggedAppCode.toLowerCase());
    const toIdx = baseOrder.indexOf(targetAppCode.toLowerCase());
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedAppCode(null);
      setDragOverAppCode(null);
      return;
    }
    const nextOrder = [...baseOrder];
    const [moved] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, moved);
    setDraggedAppCode(null);
    setDragOverAppCode(null);
    persistAppOrder(nextOrder);
  };

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return orderedApps.filter((app) => {
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
  }, [orderedApps, searchQuery, selectedCategory]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans relative transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
          : "bg-gradient-to-br from-sky-100/90 via-sky-50/80 to-blue-100/70 text-slate-800"
      }`}
    >
      {/* ─── Ambient Glow Decorative Elements ──────────────────────────────── */}
      <div
        className={`absolute top-0 inset-x-0 h-80 pointer-events-none -z-10 ${
          isDark
            ? "bg-gradient-to-b from-sky-900/20 via-indigo-950/20 to-transparent"
            : "bg-gradient-to-b from-sky-200/50 via-blue-100/30 to-transparent"
        }`}
      />
      <div className="absolute top-24 right-8 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 left-10 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ─── 1. Frozen Top Navigation Bar ──────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b px-4 sm:px-8 h-16 flex items-center justify-between shadow-xs transition-colors ${
          isDark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-sky-200/80"
        }`}
      >
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 ring-2 ${isDark ? "ring-slate-800" : "ring-white"}`}>
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className={`font-black text-sm sm:text-base tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              <span>Window Asia</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs ${
                isDark
                  ? "bg-sky-950/80 text-sky-300 border-sky-800"
                  : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200"
              }`}>
                SSO App Portal
              </span>
            </div>
            <div className={`text-[11px] font-medium hidden sm:block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ระบบศูนย์รวมแอปพลิเคชัน Single Sign-On
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={togglePortalTheme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                : "bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 border-slate-200"
            }`}
            title={isDark ? "สลับเป็นโหมดสว่าง (Light Mode)" : "สลับเป็นโหมดมืด (Dark Mode)"}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isDark ? "Light" : "Dark"}</span>
          </button>

          {/* Live Session Auto-Logoff Timer Pill */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              remainingSeconds <= 300
                ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                : isDark
                ? "bg-slate-800/90 text-slate-300 border-slate-700"
                : "bg-slate-50/90 text-slate-600 border-slate-200/90"
            }`}
            title="ระบบจะออกจากระบบอัตโนมัติทันทีเมื่อครบกำหนดเวลาว่าง (Idle 30 นาที) หรือเมื่อเซสชันหมดอายุ โดยไม่ต้องรอการคลิก"
          >
            <Clock className={`w-3.5 h-3.5 ${remainingSeconds <= 300 ? "text-amber-600" : "text-sky-500"}`} />
            <span>เซสชัน {formatRemainingTime(remainingSeconds)}</span>
          </div>

          {/* Admin Console Switcher (Visible to Admins only) */}
          {isAdmin && (
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98] ${
                isDark
                  ? "bg-sky-600 hover:bg-sky-500 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
              title="สลับไปยังหน้าจัดการ Admin Console"
            >
              <Shield className={`w-3.5 h-3.5 ${isDark ? "text-white" : "text-sky-400"}`} />
              <span className="hidden sm:inline">Admin Console</span>
              <span className="sm:hidden text-[10px]">Admin</span>
            </Link>
          )}

          {/* User Info Chip */}
          <div
            className={`flex items-center gap-2 pl-2.5 py-1 rounded-full border shadow-2xs pr-1.5 backdrop-blur-sm ${
              isDark ? "bg-slate-800/90 border-slate-700" : "bg-sky-50/90 border-sky-200/90"
            }`}
          >
            <div className={`w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 shadow-2xs ${isDark ? "ring-slate-800" : "ring-white"}`}>
              {currentUser?.full_name ? currentUser.full_name.charAt(0) : "U"}
            </div>
            <div className="text-left text-xs pr-1">
              <div className={`font-bold leading-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {currentUser?.full_name || currentUser?.username || "พนักงาน"}
              </div>
              <div className={`text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentUser?.department || (isAdmin ? "ผู้ดูแลระบบ IT" : "พนักงานองค์กร")}
              </div>
            </div>

            {/* Show Change Password button ONLY for Local non-AD Accounts */}
            {currentUser && currentUser.is_ad_user === false && (
              <>
                <div className={`w-px h-4 ${isDark ? "bg-slate-700" : "bg-sky-200"}`} />
                <button
                  onClick={() => {
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError(null);
                    setPasswordSuccess(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className={`px-1.5 py-1 rounded-full transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
                    currentUser.is_password_expired
                      ? "text-rose-700 bg-rose-100 hover:bg-rose-200 animate-pulse border border-rose-300"
                      : currentUser.days_until_password_expiry !== undefined && currentUser.days_until_password_expiry !== null && currentUser.days_until_password_expiry <= 14
                      ? "text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300"
                      : isDark
                      ? "text-slate-300 hover:text-sky-400 hover:bg-slate-700"
                      : "text-slate-500 hover:text-blue-600 hover:bg-white"
                  }`}
                  title={
                    currentUser.is_password_expired
                      ? "รหัสผ่านหมดอายุ 90 วันแล้ว - กรุณาเปลี่ยนรหัสผ่าน"
                      : currentUser.days_until_password_expiry !== undefined && currentUser.days_until_password_expiry !== null
                      ? `รหัสผ่านมีอายุเหลืออีก ${currentUser.days_until_password_expiry} วัน (รอบ 90 วัน)`
                      : "เปลี่ยนรหัสผ่าน Single Sign-On (Local Account)"
                  }
                >
                  <Key className="w-3.5 h-3.5" />
                  {currentUser.is_password_expired && (
                    <span className="text-[10px] text-rose-700">หมดอายุ</span>
                  )}
                  {!currentUser.is_password_expired && currentUser.days_until_password_expiry !== undefined && currentUser.days_until_password_expiry !== null && currentUser.days_until_password_expiry <= 14 && (
                    <span className="text-[10px] text-amber-800">{currentUser.days_until_password_expiry} วัน</span>
                  )}
                </button>
              </>
            )}

            <button
              onClick={handleLogout}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:text-rose-400 hover:bg-slate-700" : "text-slate-500 hover:text-rose-600 hover:bg-white"
              }`}
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
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b ${isDark ? "border-slate-800" : "border-sky-200/60"}`}>
          <div>
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              <span>สวัสดี, {currentUser?.full_name || currentUser?.username || "พนักงาน"}</span>
              <span className="text-xl">👋</span>
            </h1>
            <p className={`text-xs sm:text-sm font-medium mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              เลือกระบบงานที่ต้องการเข้าใช้งาน หรือใช้เมาส์ลากการ์ดเพื่อเรียงลำดับตามโปรไฟล์ของคุณ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {appOrder.length > 0 && (
              <button
                onClick={resetAppOrder}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                    : "bg-white/90 hover:bg-slate-100 border-slate-200 text-slate-600"
                }`}
                title="คืนค่าลำดับการ์ดเริ่มต้น"
              >
                <RotateCcw className="w-3 h-3" />
                <span>รีเซ็ตลำดับ</span>
              </button>
            )}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold shadow-2xs ${
                isDark
                  ? "bg-slate-800/90 border-slate-700 text-sky-300"
                  : "bg-white/90 border-sky-200 text-sky-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-500" />
              <span>{apps.length} ระบบงานที่ได้รับสิทธิ์</span>
            </div>
          </div>
        </div>

        {/* ─── Compact Search & Category Filter Toolbar ────────────────────── */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 backdrop-blur-md p-2.5 rounded-2xl border shadow-2xs transition-colors ${
            isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/70 border-sky-200/70"
          }`}
        >
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
                    ? isDark
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-slate-900 text-white shadow-xs"
                    : isDark
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
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
              className={`w-full pl-8 pr-7 py-1.5 border rounded-full text-xs focus:outline-none focus:border-blue-500 focus:ring-2 shadow-2xs transition-all ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400 focus:ring-sky-900"
                  : "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-blue-100"
              }`}
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full cursor-pointer ${
                  isDark ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                }`}
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
                className={`rounded-2xl border p-4 animate-pulse space-y-3 shadow-2xs ${
                  isDark ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-sky-200/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                  <div className="space-y-1.5 flex-1">
                    <div className={`w-2/3 h-3.5 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                    <div className={`w-1/3 h-2.5 rounded ${isDark ? "bg-slate-800/70" : "bg-slate-100"}`} />
                  </div>
                </div>
                <div className={`w-full h-8 rounded-lg ${isDark ? "bg-slate-800/70" : "bg-slate-100"}`} />
                <div className={`w-full h-9 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
              </div>
            ))}
          </div>
        )}

        {/* ─── 3. Compact, Space-Efficient Draggable 4-Column App Cards Grid ─── */}
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
              const isUnavailable = isOffline || isSpokeSsoDisabled || isVpnLocked;

              const isBeingDragged = draggedAppCode?.toLowerCase() === app.app_code.toLowerCase();
              const isDropTarget = dragOverAppCode?.toLowerCase() === app.app_code.toLowerCase() && !isBeingDragged;

              return (
                <div
                  key={app.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedAppCode(app.app_code);
                    try {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", app.app_code);
                    } catch {}
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    try {
                      e.dataTransfer.dropEffect = "move";
                    } catch {}
                    if (dragOverAppCode !== app.app_code) {
                      setDragOverAppCode(app.app_code);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverAppCode === app.app_code) {
                      setDragOverAppCode(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleCardDrop(app.app_code);
                  }}
                  onDragEnd={() => {
                    setDraggedAppCode(null);
                    setDragOverAppCode(null);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-4.5 transition-all duration-200 flex flex-col justify-between space-y-3.5 select-none ${
                    isBeingDragged ? "opacity-50 scale-[0.98]" : ""
                  } ${
                    isDropTarget ? "ring-2 ring-sky-400 border-sky-400 scale-[1.02]" : ""
                  } ${
                    isOffline || isSpokeSsoDisabled
                      ? isDark
                        ? "border-slate-800 bg-slate-900/50 shadow-none opacity-75"
                        : "border-slate-300/80 bg-slate-100/70 shadow-none opacity-75"
                      : isVpnChecking
                      ? isDark
                        ? "border-slate-800 bg-slate-900/70 shadow-none"
                        : "border-slate-200 bg-slate-50/80 shadow-none"
                      : isVpnConnected
                      ? isDark
                        ? "border-sky-700/70 hover:border-sky-500 bg-slate-900/90 backdrop-blur-md shadow-md hover:shadow-xl hover:-translate-y-1"
                        : "border-sky-300 hover:border-sky-400 bg-white/95 backdrop-blur-md shadow-2xs hover:shadow-lg hover:-translate-y-1"
                      : isVpnLocked
                      ? isDark
                        ? "border-slate-800 bg-slate-900/60 shadow-none opacity-80 hover:opacity-100 hover:border-slate-700"
                        : "border-slate-300/80 bg-slate-100/70 shadow-none opacity-80 hover:opacity-100 hover:border-slate-400"
                      : isDark
                      ? "bg-slate-900/90 backdrop-blur-md shadow-md hover:shadow-xl hover:-translate-y-1 border-slate-700/90 hover:border-sky-500/70"
                      : `bg-white/95 backdrop-blur-md shadow-2xs hover:shadow-lg hover:-translate-y-1 border-slate-200/90 ${theme.cardGlow}`
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Top: App Icon, Grip Handle, Code & Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      {/* Compact Squircle 3D Icon - Grayed out when unavailable */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ring-2 ${
                          isDark ? "ring-slate-800" : "ring-white"
                        } ${
                          isOffline || isSpokeSsoDisabled || isVpnLocked || isVpnChecking
                            ? isDark
                              ? "bg-slate-800 text-slate-500 shadow-none grayscale"
                              : "bg-slate-200 text-slate-400 shadow-none grayscale"
                            : isVpnConnected
                            ? "bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 group-hover:scale-105"
                            : `${theme.iconContainer} group-hover:scale-105`
                        }`}
                      >
                        {theme.icon}
                      </div>

                      {/* Code Pill, Drag Grip & Live Status Indicators */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center justify-center p-0.5 rounded cursor-grab active:cursor-grabbing transition-colors ${
                              isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                            }`}
                            title="ลากการ์ดนี้เพื่อสลับลำดับการแสดงผล"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded border font-mono ${
                              isDark
                                ? "bg-slate-800 text-slate-200 border-slate-700"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {app.app_code}
                          </span>
                        </div>

                        {isOffline ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                              isDark
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : "bg-slate-200 text-slate-600 border-slate-300"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            ออฟไลน์
                          </span>
                        ) : isSpokeSsoDisabled ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                              isDark
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : "bg-slate-200 text-slate-600 border-slate-300"
                            }`}
                          >
                            Break-Glass
                          </span>
                        ) : isVpnRequired ? (
                          isVpnChecking ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                                isDark
                                  ? "bg-slate-800 text-slate-300 border-slate-700"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-500" />
                              ตรวจ VPN
                            </span>
                          ) : isVpnConnected ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                                isDark
                                  ? "bg-sky-950/80 text-sky-300 border-sky-700"
                                  : "bg-sky-50 text-sky-700 border-sky-300"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                              VPN พร้อม
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                                isDark
                                  ? "bg-slate-800 text-slate-300 border-slate-700"
                                  : "bg-slate-200 text-slate-600 border-slate-300"
                              }`}
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-500" />
                              ต้องต่อ VPN
                            </span>
                          )
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border font-sans ${
                              isDark
                                ? "bg-emerald-950/70 text-emerald-300 border-emerald-800"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            พร้อมใช้
                          </span>
                        )}
                      </div>
                    </div>

                    {/* App Name & Category */}
                    <div>
                      <h2
                        className={`font-black text-sm leading-snug transition-colors line-clamp-1 ${
                          isUnavailable
                            ? isDark
                              ? "text-slate-400"
                              : "text-slate-600"
                            : isDark
                            ? "text-white group-hover:text-sky-400"
                            : "text-slate-900 group-hover:text-blue-600"
                        }`}
                      >
                        {app.app_name}
                      </h2>
                      {app.category && (
                        <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
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
                        <p
                          className={`text-xs leading-snug line-clamp-2 min-h-[2.5rem] ${
                            isUnavailable
                              ? isDark
                                ? "text-slate-500"
                                : "text-slate-500"
                              : isDark
                              ? "text-slate-300"
                              : "text-slate-600"
                          }`}
                        >
                          {displayDesc}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Bottom: Compact Single Launch Button */}
                  <div className={`pt-2 border-t ${isDark ? "border-slate-800" : isUnavailable ? "border-slate-200" : "border-slate-100"}`}>
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
                        isOffline || isSpokeSsoDisabled
                          ? isDark
                            ? "bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none"
                            : "bg-slate-200/70 text-slate-400 border border-slate-300/60 cursor-not-allowed shadow-none"
                          : isVpnChecking
                          ? isDark
                            ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-wait shadow-none font-semibold"
                            : "bg-slate-200/70 text-slate-500 border border-slate-300/60 cursor-wait shadow-none font-semibold"
                          : isVpnConnected
                          ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/20 cursor-pointer"
                          : isVpnLocked
                          ? isDark
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer shadow-none font-bold"
                            : "bg-slate-200/90 hover:bg-slate-300 text-slate-600 border border-slate-300 cursor-pointer shadow-none font-bold"
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
                        app.connector_type === "RDP" || app.app_code === "wa_rdt2" ? (
                          <>
                            <Download className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                            <span>เปิด Remote Desktop (.rdp)</span>
                          </>
                        ) : (
                          <>
                            <span>เข้าใช้งานระบบ</span>
                            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </>
                        )
                      ) : isVpnLocked ? (
                        <span className="flex items-center justify-center gap-1 text-center">
                          <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>ต่อ VPN แล้วตรวจใหม่</span>
                          <RefreshCw className="w-3 h-3 ml-0.5 text-slate-500 shrink-0" />
                        </span>
                      ) : app.connector_type === "RDP" || app.app_code === "wa_rdt2" ? (
                        <>
                          <Download className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                          <span>เปิด Remote Desktop (.rdp)</span>
                        </>
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
          <div
            className={`text-center py-12 backdrop-blur-md rounded-2xl border border-dashed p-6 space-y-2 shadow-2xs ${
              isDark ? "bg-slate-900/80 border-slate-700" : "bg-white/90 border-sky-300"
            }`}
          >
            <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${isDark ? "bg-slate-800 text-sky-400" : "bg-sky-100 text-sky-600"}`}>
              <Search className="w-5 h-5" />
            </div>
            <h3 className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
              ไม่พบระบบงานที่ตรงกับคำค้นหา &quot;{searchQuery}&quot;
            </h3>
            <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              กรุณาลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="text-xs font-bold text-sky-500 underline hover:no-underline cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}

        {/* ─── Empty State: No Authorized Apps ────────────────────────────── */}
        {!loading && apps.length === 0 && (
          <div
            className={`text-center py-12 backdrop-blur-md rounded-2xl border border-dashed p-6 space-y-3 shadow-2xs ${
              isDark ? "bg-slate-900/80 border-slate-700" : "bg-white/90 border-sky-300"
            }`}
          >
            <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center ${isDark ? "bg-slate-800 text-sky-400" : "bg-sky-50 text-sky-500"}`}>
              <Inbox className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                ยังไม่มีระบบงานที่ได้รับสิทธิ์
              </h2>
              <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                บัญชีของท่านยังไม่ได้รับสิทธิ์เข้าใช้งานระบบงานใดในขณะนี้ หากต้องการขอสิทธิ์เข้าใช้งาน กรุณาติดต่อฝ่ายเทคโนโลยีสารสนเทศ (IT Support)
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ─── Clean Minimal Footer ─────────────────────────────────────────── */}
      <footer
        className={`mt-auto border-t backdrop-blur-md py-3 px-4 text-center text-xs font-medium ${
          isDark ? "border-slate-800 bg-slate-900/80 text-slate-400" : "border-sky-200/60 bg-white/80 text-slate-500"
        }`}
      >
        <p>© 2026 บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) • Central Single Sign-On Portal</p>
      </footer>

      {/* ─── Password Change Modal (Local Account Only) ────────────────────────── */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 space-y-4 rounded-2xl border border-slate-200 shadow-2xl relative text-left">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    เปลี่ยนรหัสผ่าน Single Sign-On
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                      Local Account
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    รหัสผ่านนี้ใช้ล็อกอินเข้า Central IAM App Portal
                  </p>
                </div>
              </div>

              {!currentUser?.must_change_password && (
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Force Password Change Warning Banner */}
            {currentUser?.must_change_password && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                currentUser.is_password_expired
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                  currentUser.is_password_expired ? "text-rose-600" : "text-amber-600"
                }`} />
                <div>
                  <span className="font-bold">
                    {currentUser.is_password_expired
                      ? "รหัสผ่านหมดอายุตามรอบความปลอดภัย 90 วัน:"
                      : "จำเป็นต้องเปลี่ยนรหัสผ่าน:"}
                  </span>
                  <p className={`text-[11px] mt-0.5 leading-snug ${
                    currentUser.is_password_expired ? "text-rose-800" : "text-amber-800"
                  }`}>
                    {currentUser.is_password_expired
                      ? "รหัสผ่านของคุณมีอายุครบ 90 วันตามนโยบายความปลอดภัยขององค์กร กรุณาตั้งรหัสผ่านใหม่เพื่อเข้าใช้งานระบบงาน"
                      : "ผู้ดูแลระบบกำหนดให้คุณต้องตั้งรหัสผ่านใหม่ก่อนเข้าใช้งานระบบงาน App Portal"}
                  </p>
                </div>
              </div>
            )}

            {passwordSuccess ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm text-emerald-900">เปลี่ยนรหัสผ่านสำเร็จ!</div>
                <p className="text-slate-600 font-medium">ระบบได้อัปเดตรหัสผ่านกลางของคุณเรียบร้อยแล้ว (มีอายุ 90 วัน)</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3.5">
                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold">
                    {passwordError}
                  </div>
                )}

                {/* Password Complexity Checklist Guide */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
                  <div className="font-bold text-slate-700">ข้อกำหนดความปลอดภัยของรหัสผ่าน (รอบเปลี่ยนทุก 90 วัน):</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 && newPassword.length <= 16 ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• ความยาว 8 - 16 ตัวอักษร</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• ตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• ตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• ตัวเลข (0-9) อย่างน้อย 1 ตัว</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(newPassword) ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• อักขระพิเศษ (!@#$%^&*...)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${currentUser?.username && currentUser.username.trim().length >= 3 && !newPassword.toLowerCase().includes(currentUser.username.trim().toLowerCase()) ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      <span>• ห้ามมี Username ในรหัสผ่าน</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่านใหม่ (ความยาว 8-16 ตัวอักษร) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      maxLength={16}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่ (8-16 ตัวอักษร)"
                      className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    maxLength={16}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2">
                  {!currentUser?.must_change_password && (
                    <button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
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

