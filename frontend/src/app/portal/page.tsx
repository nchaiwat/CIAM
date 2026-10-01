"use client";

import React, { useState, useEffect, useMemo } from "react";
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
      const res = await api.launchPortalApp(app.client_id);
      if (res && res.launch_url) {
        window.open(res.launch_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการเปิดระบบ: " + (err.message || "ไม่สามารถสร้าง SSO Ticket ได้"));
    } finally {
      setTimeout(() => setLaunchingAppCode(null), 800);
    }
  };


  const getAppTheme = (appCode: string) => {
    switch (appCode.toLowerCase()) {
      case "irm":
        return {
          icon: <Boxes className="w-8 h-8 text-amber-600" />,
          bg: "bg-amber-50 group-hover:bg-amber-100/80 border-amber-200/60",
          btn: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20",
          accent: "text-amber-700",
        };
      case "qms":
        return {
          icon: <ClipboardCheck className="w-8 h-8 text-emerald-600" />,
          bg: "bg-emerald-50 group-hover:bg-emerald-100/80 border-emerald-200/60",
          btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
          accent: "text-emerald-700",
        };
      case "qol":
        return {
          icon: <FileSpreadsheet className="w-8 h-8 text-blue-600" />,
          bg: "bg-blue-50 group-hover:bg-blue-100/80 border-blue-200/60",
          btn: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
          accent: "text-blue-700",
        };
      case "sap_b1":
        return {
          icon: <Building2 className="w-8 h-8 text-indigo-600" />,
          bg: "bg-indigo-50 group-hover:bg-indigo-100/80 border-indigo-200/60",
          btn: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20",
          accent: "text-indigo-700",
        };
      default:
        return {
          icon: <Layers className="w-8 h-8 text-sky-600" />,
          bg: "bg-sky-50 group-hover:bg-sky-100/80 border-sky-200/60",
          btn: "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20",
          accent: "text-sky-700",
        };
    }
  };

  const isAdmin = currentUser?.role && currentUser.role !== "PORTAL_USER";

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col font-sans">
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between shadow-2xs">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
              Window Asia
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
                App Portal
              </span>
            </div>
          </div>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-3">
          {/* Admin Console Switcher (Visible to Admins only) */}
          {isAdmin && (
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
              title="สลับไปยังหน้าจัดการ Admin Console"
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Admin Console</span>
            </Link>
          )}

          {/* User Info Chip */}
          <div className="flex items-center gap-2.5 pl-3 py-1 bg-slate-100/80 rounded-full border border-slate-200/80 pr-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
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

            <button
              onClick={() => {
                setNewPassword("");
                setConfirmPassword("");
                setPasswordError(null);
                setPasswordSuccess(false);
                setIsPasswordModalOpen(true);
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="เปลี่ยนรหัสผ่าน Single Sign-On"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Portal Content ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Welcome Hero Greeting */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>สวัสดี, {currentUser?.full_name || currentUser?.username || "พนักงาน"}</span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-sm text-slate-600">
            ระบบงานภายในองค์กรที่คุณได้รับสิทธิ์เข้าใช้งาน คลิกปุ่ม <strong>&quot;เข้าใช้งานระบบ&quot;</strong> เพื่อเปิดเข้าสู่ระบบได้ทันที
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={loadApps}
              className="text-xs font-bold text-rose-800 underline hover:no-underline"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <div className="w-2/3 h-4 bg-slate-100 rounded" />
                    <div className="w-1/3 h-3 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-8 bg-slate-50 rounded" />
                <div className="w-full h-11 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* ─── App Cards Grid ─────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => {
              const theme = getAppTheme(app.app_code);
              const isLaunching = launchingAppCode === app.app_code;
              const isOffline = app.health_status === "OFFLINE";
              const isSpokeSsoDisabled = app.spoke_sso_status === "DISABLED";
              const isVpnLocked = Boolean(app.is_vpn_locked);
              const isLaunchDisabled = isLaunching || isOffline || isSpokeSsoDisabled || isVpnLocked;

              return (
                <div
                  key={app.id}
                  className={`group bg-white rounded-2xl border p-6 shadow-2xs transition-all duration-200 flex flex-col justify-between space-y-6 ${
                    isOffline
                      ? "border-rose-200/80 bg-slate-50/50"
                      : isSpokeSsoDisabled
                      ? "border-amber-200/80 bg-amber-50/20"
                      : isVpnLocked
                      ? "border-amber-300/80 bg-amber-50/15"
                      : "border-slate-200/90 hover:border-blue-400/80 hover:shadow-lg"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top: App Icon & Name */}
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 transition-colors ${
                          isOffline
                            ? "bg-slate-200/60 border-slate-300 text-slate-400"
                            : isVpnLocked
                            ? "bg-amber-100/70 border-amber-300 text-amber-700"
                            : theme.bg
                        }`}
                      >
                        {theme.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {app.app_code}
                          </span>
                          {isOffline ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                              ออฟไลน์
                            </span>
                          ) : isSpokeSsoDisabled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Break-Glass
                            </span>
                          ) : isVpnLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-600" />
                              ต้องต่อ VPN
                            </span>
                          ) : null}
                        </div>
                        <h2 className={`font-bold text-base leading-snug transition-colors ${
                          isOffline ? "text-slate-600" : "text-slate-900 group-hover:text-blue-600"
                        }`}>
                          {app.app_name}
                        </h2>
                        {app.category && (
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                            {app.category.split(" (")[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* App Description (Thai on line 1, English on line 2) */}
                    {(() => {
                      const desc = app.description || "แอปพลิเคชันสำหรับบุคลากรภายในองค์กร";
                      const match = desc.match(/^(.*?)\s*\((.*?)\)$/);
                      if (match) {
                        const thaiText = match[1].trim();
                        const engText = match[2].trim();
                        return (
                          <div className="space-y-1 min-h-[3.25rem]">
                            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                              {thaiText}
                            </p>
                            <p className="text-[11px] text-slate-500 font-normal leading-normal">
                              {engText}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <p className="text-xs text-slate-600 leading-relaxed min-h-[3.25rem]">
                          {desc}
                        </p>
                      );
                    })()}
                  </div>

                  {/* Bottom: Single Launch Button */}
                  <div>
                    <button
                      onClick={() => handleLaunch(app)}
                      disabled={isLaunchDisabled}
                      className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98] ${
                        isOffline
                          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                          : isSpokeSsoDisabled
                          ? "bg-amber-50 text-amber-700 border border-amber-300 cursor-not-allowed shadow-none"
                          : isVpnLocked
                          ? "bg-amber-50 text-amber-800 border border-amber-300 cursor-not-allowed shadow-none font-semibold"
                          : `${theme.btn} cursor-pointer`
                      }`}
                    >
                      {isLaunching ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>กำลังเปิดใช้งานระบบ...</span>
                        </>
                      ) : isOffline ? (
                        <span>ระบบปิดปรับปรุงชั่วคราว (Offline)</span>
                      ) : isSpokeSsoDisabled ? (
                        <span>ระบบปิดรับ SSO ชั่วคราว</span>
                      ) : isVpnLocked ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>กรุณาเชื่อมต่อ VPN ก่อนเข้าใช้งาน</span>
                        </span>
                      ) : (
                        <>
                          <span>เข้าใช้งานระบบ</span>
                          <ArrowUpRight className="w-4 h-4 opacity-80" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Empty State: No Authorized Apps ────────────────────────────── */}
        {!loading && apps.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-4 shadow-2xs">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Inbox className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">
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
      <footer className="mt-auto border-t border-slate-200/70 bg-white py-4 px-4 text-center text-xs text-slate-400 font-medium">
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

