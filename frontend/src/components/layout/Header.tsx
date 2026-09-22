"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User, Shield, PanelLeft } from "lucide-react";
import { AdminUserOut } from "@/lib/api";

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
        {/* User Profile Card */}
        <div className="flex items-center space-x-2.5 pl-2">
          <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-700 font-bold shadow-2xs">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left leading-tight hidden md:block">
            <div className="text-xs font-extrabold text-slate-900">
              {currentUser?.full_name || "Chaiwat Nilawan"}
            </div>
            <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {currentUser?.role || "SUPER_ADMIN"}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-bold transition-all shadow-2xs"
          title="ออกจากระบบ"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </header>
  );
}
