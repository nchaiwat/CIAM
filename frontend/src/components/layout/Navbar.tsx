"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  Users,
  UserX,
  Layers,
  FileCheck2,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/", icon: Activity },
    { name: "User Directory", href: "/directory", icon: Users },
    {
      name: "Offboarding Hub",
      href: "/offboarding",
      icon: UserX,
      highlight: true,
    },
    { name: "Connected Apps", href: "/applications", icon: Layers },
    { name: "Audit Trail", href: "/audit-logs", icon: FileCheck2 },
  ];

  return (
    <header className="sticky top-0 z-50 ciam-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Organization */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-lg tracking-tight">
                    Central IAM
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                    ENTERPRISE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                  Window Asia Public Company Limited
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center space-x-1">
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
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                    isActive
                      ? "text-white bg-slate-800/80 shadow-sm border border-slate-700/60"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  } ${
                    item.highlight && !isActive
                      ? "text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/10"
                      : ""
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? item.highlight
                          ? "text-rose-400"
                          : "text-indigo-400"
                        : item.highlight
                        ? "text-rose-400/80"
                        : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                  {item.highlight && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* System Status & Admin Profile */}
          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-400">AD Gateway</span>
              <span className="text-slate-300 font-mono text-[11px]">
                192.168.12.11
              </span>
            </div>

            <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                SN
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200">
                  Somchai N.
                </div>
                <div className="text-[10px] text-slate-400">IT Security Lead</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
