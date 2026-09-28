"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, User, Shield, PanelLeft, Rocket } from "lucide-react";
import { AdminUserOut } from "@/lib/api";
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ciam_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    if (confirm("คุณต้องการออกจากระบบ Central IAM หรือไม่?")) {
      localStorage.removeItem("ciam_token");
      localStorage.removeItem("ciam_user");
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b-2 border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      {/* Left section: Toggle Sidebar + App Title Breadcrumb */}
      <div className="flex items-center space-x-3">
        {/* Mobile Toggle Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="เปิดเมนู"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Toggle Button: "ซ่อนเมนู" */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-2xs"
          title={collapsed ? "ขยายเมนู" : "ซ่อนเมนู"}
        >
          <PanelLeft className="w-4 h-4 text-slate-600" />
          <span>{collapsed ? "แสดงเมนู" : "ซ่อนเมนู"}</span>
        </button>

        {/* Breadcrumb / System Name Pill */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100/90 border border-slate-200 text-xs font-bold text-slate-700">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Centralized Identity Management System</span>
        </div>
      </div>

      {/* Right section: User Profile + Logout */}
      <div className="flex items-center space-x-4">
        {/* Quick App Portal Switcher */}
        <Link
          href="/portal"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold transition-all shadow-2xs"
          title="ไปยังหน้า App Portal (Single Sign-On สำหรับพนักงาน)"
        >
          <Rocket className="w-3.5 h-3.5 text-sky-600" />
          <span className="hidden md:inline">App Portal</span>
        </Link>

        {/* User Profile Card (Clickable to open Profile & Telegram Alert Settings) */}
        <button
          onClick={() => setProfileModalOpen(true)}
          className="flex items-center space-x-2.5 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-100/90 border border-transparent hover:border-slate-200 transition-all text-left group cursor-pointer"
          title="คลิกเพื่อแก้ไขโปรไฟล์ & ตั้งค่าแจ้งเตือน Telegram"
        >
          <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-700 font-bold shadow-2xs group-hover:scale-105 transition-transform relative">
            <User className="w-4 h-4" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>
          <div className="leading-tight hidden md:block">
            <div className="text-xs font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
              <span>{currentUser?.full_name || "Chaiwat Nilawan"}</span>
            </div>
            <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1.5">
              <span>{currentUser?.role || "SUPER_ADMIN"}</span>
              {currentUser?.telegram_id && (
                <span className="text-[10px] text-sky-700 font-mono font-bold bg-sky-100/80 px-1.5 py-0.2 rounded">
                  {currentUser.telegram_id}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          title="ออกจากระบบ"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
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
