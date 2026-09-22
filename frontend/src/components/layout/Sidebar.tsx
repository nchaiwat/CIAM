"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserX,
  Layers,
  FileCheck2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Server,
  FileCode,
  ExternalLink,
  ChevronDown,
  Lock,
  Rocket,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(true);

  const mainNavItems = [
    {
      name: "Dashboard",
      labelTh: "ภาพรวม",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "App Launcher",
      labelTh: "พอร์ทัลแอป (SSO)",
      href: "/portal",
      icon: Rocket,
    },
    {
      name: "Directory",
      labelTh: "ทะเบียนผู้ใช้",
      href: "/directory",
      icon: Users,
    },
    {
      name: "Offboarding",
      labelTh: "ระงับสิทธิ์พนักงาน",
      href: "/offboarding",
      icon: UserX,
      isDanger: true,
    },
    {
      name: "Connected Apps",
      labelTh: "ระบบที่เชื่อมต่อ",
      href: "/applications",
      icon: Layers,
    },
    {
      name: "Audit Trail",
      labelTh: "ประวัติการใช้งาน",
      href: "/audit-logs",
      icon: FileCheck2,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0b1329] text-slate-200 border-r border-slate-800 transition-all duration-300 ease-in-out ${
          collapsed ? "w-20" : "w-64"
        } ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header / Brand Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-[#080e1e]">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center space-x-3 overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 shrink-0 ring-2 ring-blue-400/20">
              <ShieldCheck className="w-6 h-6" />
            </div>

            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-white text-base tracking-tight leading-tight flex items-center gap-1.5">
                  CIAM System
                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded">
                    PROD
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal truncate">
                  Window Asia Co., Ltd.
                </span>
              </div>
            )}
          </Link>

          {/* Collapse button on desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            className="hidden lg:flex w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white items-center justify-center transition-colors shrink-0"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 select-none scrollbar-thin">
          {/* Main Navigation */}
          <div className="space-y-1.5">
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                เมนูหลัก (Core Menu)
              </div>
            )}

            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.labelTh : undefined}
                  className={`group relative flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? item.isDanger
                        ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                        : "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : item.isDanger
                      ? "text-rose-400 hover:text-white hover:bg-rose-600/20"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive
                        ? "text-white"
                        : item.isDanger
                        ? "text-rose-400"
                        : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.labelTh}</span>
                      {item.isDanger && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-950/60 text-rose-300 border border-rose-500/40">
                          1-Click
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin & Integration Section */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            {!collapsed && (
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200"
              >
                <span>ระบบและเชื่อมต่อ (Admin)</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    adminOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}

            {(adminOpen || collapsed) && (
              <div className="space-y-1">
                {/* Active Directory Gateway Info */}
                <div
                  title={collapsed ? "Active Directory Gateway: 192.168.12.11" : undefined}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/60 border border-slate-800 ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <Server className="w-4 h-4 text-emerald-400 shrink-0" />
                  {!collapsed && (
                    <div className="flex-1 truncate">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">AD Gateway</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400"></span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        192.168.12.11:3100
                      </span>
                    </div>
                  )}
                </div>

                {/* Spoke API Specs link */}
                <Link
                  href="/applications"
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? "M2M Spoke API Spec" : undefined}
                  className={`flex items-center space-x-3 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">สเปกเชื่อมต่อ (Spoke API)</span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#080e1e]">
          {!collapsed ? (
            <div className="text-[11px] text-slate-400 space-y-0.5 px-2">
              <div className="flex items-center justify-between font-semibold text-slate-300">
                <span>CIAM v1.3.0</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                  ISO 27001
                </span>
              </div>
              <p className="truncate text-slate-400 text-[10px]">
                Window Asia Security System
              </p>
            </div>
          ) : (
            <div className="text-center text-[10px] font-mono text-slate-400">
              v1.3
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
