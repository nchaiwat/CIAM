"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, User, Shield, PanelLeft, Rocket, Activity } from "lucide-react";
import { AdminUserOut, ciamApi } from "@/lib/api";
import AdminProfileModal from "@/components/profile/AdminProfileModal";

interface HeaderProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export default function Header({
  collapsed,
  setCollapsed,
  setMobileOpen,
}: HeaderProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AdminUserOut | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adAgentStatus, setAdAgentStatus] = useState<{
    is_online: boolean;
    latency_ms: number;
    base_url: string;
  }>({
    is_online: true,
    latency_ms: 2,
    base_url: "http://172.18.0.1:3100",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ciam_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}

    // Check AD Sync Agent Status
    const checkAdStatus = async () => {
      try {
        const res = await ciamApi.getHealthMonitorStatus();
        if (res?.live_health?.ad_sync_agent) {
          setAdAgentStatus(res.live_health.ad_sync_agent);
        }
      } catch (err) {
        console.warn("Could not check AD Agent status:", err);
      }
    };

    checkAdStatus();
    const timer = setInterval(checkAdStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    if (confirm("คุณต้องการออกจากระบบ Central IAM หรือไม่?")) {
      localStorage.removeItem("ciam_token");
      localStorage.removeItem("ciam_user");
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 h-11 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between shadow-2xs">
      {/* Left section: Toggle Sidebar + App Title Breadcrumb + AD Agent Status */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Mobile Toggle Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="เปิดเมนู"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Toggle Button: "ซ่อนเมนู" */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all shadow-2xs"
          title={collapsed ? "ขยายเมนู" : "ซ่อนเมนู"}
        >
          <PanelLeft className="w-3.5 h-3.5 text-slate-600" />
          <span>{collapsed ? "แสดงเมนู" : "ซ่อนเมนู"}</span>
        </button>

        {/* Breadcrumb / System Name Pill */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
          <Shield className="w-3 h-3 text-blue-600" />
          <span>Central IAM</span>
        </div>

        {/* AD Sync Agent Status Indicator (Point 8) */}
        <div
          onClick={() => setProfileModalOpen(true)}
          className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
            adAgentStatus.is_online
              ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              : "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100"
          }`}
          title={`AD Sync Agent (${adAgentStatus.base_url || "172.18.0.1:3100"}): ${
            adAgentStatus.is_online ? "ONLINE ปกติ" : "OFFLINE"
          } (Latency: ${adAgentStatus.latency_ms || 0}ms)`}
        >
          <span className="relative flex h-2 w-2">
            {adAgentStatus.is_online && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                adAgentStatus.is_online ? "bg-emerald-500" : "bg-rose-500"
              }`}
            ></span>
          </span>
          <span className="hidden sm:inline font-semibold">AD Sync Agent</span>
          <span
            className={`font-mono text-[10px] px-1 rounded ${
              adAgentStatus.is_online
                ? "bg-emerald-100 text-emerald-900 font-extrabold"
                : "bg-rose-100 text-rose-900 font-extrabold"
            }`}
          >
            {adAgentStatus.is_online ? "ONLINE" : "OFFLINE"}
          </span>
          {adAgentStatus.latency_ms > 0 && (
            <span className="hidden xl:inline text-[10px] text-emerald-700 font-mono">
              {adAgentStatus.latency_ms}ms
            </span>
          )}
        </div>
      </div>

      {/* Right section: App Portal + User Profile + Logout (Icon Only) */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Quick App Portal Switcher */}
        <Link
          href="/portal"
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-bold transition-all shadow-2xs"
          title="ไปยังหน้า App Portal (Single Sign-On สำหรับพนักงาน)"
        >
          <Rocket className="w-3 h-3 text-sky-600" />
          <span className="hidden sm:inline">App Portal</span>
        </Link>

        {/* User Profile Card */}
        <button
          onClick={() => setProfileModalOpen(true)}
          className="flex items-center space-x-2 pl-1.5 pr-2.5 py-0.5 rounded-lg hover:bg-slate-100/90 border border-transparent hover:border-slate-200 transition-all text-left cursor-pointer"
          title="คลิกเพื่อแก้ไขโปรไฟล์ & ตั้งค่าแจ้งเตือน Telegram"
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 font-bold shadow-2xs relative">
            <User className="w-3.5 h-3.5" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-white rounded-full"></span>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-[11px] font-extrabold text-slate-900 leading-none">
              {currentUser?.full_name || "Chaiwat Nilawan"}
            </div>
            <div className="text-[9px] font-semibold text-blue-600 leading-none mt-0.5">
              {currentUser?.role || "SUPER_ADMIN"}
            </div>
          </div>
        </button>

        {/* Logout Button: Pure Icon Only (Point 7) */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-slate-500 transition-all shadow-2xs cursor-pointer"
          title="ออกจากระบบ (Sign Out)"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
        </button>
      </div>

      {/* Admin Profile & Telegram Health Monitor Modal */}
      <AdminProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => setCurrentUser(updated)}
      />
    </header>
  );
}
