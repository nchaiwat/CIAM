"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Users,
  UserX,
  Layers,
  FileCheck2,
  LayoutDashboard,
  Menu,
  X,
  Server,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "ภาพรวม", href: "/", icon: LayoutDashboard },
    { name: "ทะเบียนผู้ใช้", href: "/directory", icon: Users },
    {
      name: "ระงับสิทธิ์พนักงาน",
      href: "/offboarding",
      icon: UserX,
      isDanger: true,
    },
    { name: "ระบบที่เชื่อมต่อ", href: "/applications", icon: Layers },
    { name: "ประวัติการใช้งาน", href: "/audit-logs", icon: FileCheck2 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Organization */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-base tracking-tight">
                    Central IAM
                  </span>
                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
                    องค์กร
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-normal">
                  บริษัท วินโดว์ เอเชีย จำกัด (มหาชน)
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-md text-sm font-semibold transition-all ${
                    isActive
                      ? item.isDanger
                        ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-500"
                        : "bg-blue-600 text-white shadow-sm ring-1 ring-blue-500"
                      : item.isDanger
                      ? "text-rose-400 hover:text-white hover:bg-rose-600/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? "text-white"
                        : item.isDanger
                        ? "text-rose-400"
                        : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* System Status & Admin Profile */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-slate-200">AD:</span>
              <span className="font-mono text-emerald-300 font-bold">192.168.12.11</span>
            </div>

            <div className="flex items-center space-x-2.5 pl-2.5 border-l border-slate-700">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                IT
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">
                  ผู้ดูแลระบบ
                </div>
                <div className="text-[10px] text-slate-400">IT Administrator</div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="เปิดเมนู"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2.5 pb-4 space-y-1.5 shadow-xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-sm font-semibold ${
                  isActive
                    ? item.isDanger
                      ? "bg-rose-600 text-white"
                      : "bg-blue-600 text-white"
                    : item.isDanger
                    ? "text-rose-400 hover:bg-rose-950/40"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-800 mt-2 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 font-medium">AD Gateway: 192.168.12.11</span>
            </div>
            <span className="font-bold text-white">ผู้ดูแลระบบ IT</span>
          </div>
        </div>
      )}
    </header>
  );
}
