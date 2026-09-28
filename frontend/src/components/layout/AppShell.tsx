"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const isStandalone =
    pathname?.startsWith("/oauth/authorize") ||
    pathname?.startsWith("/portal") ||
    pathname === "/login" ||
    pathname?.startsWith("/admin/login");

  useEffect(() => {
    const token = localStorage.getItem("ciam_token");
    const storedUserStr = localStorage.getItem("ciam_user");
    let userRole = "";
    if (storedUserStr) {
      try {
        const u = JSON.parse(storedUserStr);
        userRole = u.role || "";
      } catch {}
    }

    if (pathname?.startsWith("/portal")) {
      // Portal requires authentication
      if (!token) {
        router.replace("/login?redirect=/portal");
        return;
      }
      setAuthChecked(true);
    } else if (pathname === "/login") {
      // If already logged in, redirect to portal or dashboard
      if (token) {
        if (userRole === "PORTAL_USER") {
          router.replace("/portal");
        } else {
          router.replace("/portal");
        }
        return;
      }
      setAuthChecked(true);
    } else if (pathname?.startsWith("/admin/login")) {
      if (token && userRole !== "PORTAL_USER") {
        router.replace("/");
        return;
      }
      setAuthChecked(true);
    } else if (!isStandalone) {
      // Protected Admin Console routes (/, /directory, /applications, /offboarding, /audit-logs)
      if (!token) {
        router.replace(`/admin/login?redirect=${encodeURIComponent(pathname || "/")}`);
        return;
      }
      if (userRole === "PORTAL_USER") {
        // Regular employees must not access admin console
        router.replace("/portal");
        return;
      }
      setAuthChecked(true);
    } else {
      setAuthChecked(true);
    }
  }, [pathname, isStandalone, router]);

  // Standalone pages (Employee Login, Admin Login, Portal, OIDC Authorize) render without admin sidebar & header
  if (isStandalone) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Prevent flashing protected admin dashboard before token check completes
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-900">
      {/* Left Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Top Header */}
        <Header
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
        />

        {/* Page Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-300 bg-white py-4 text-center text-xs text-slate-600 font-medium shadow-inner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 บริษัท วินโดว์ เอเชีย จำกัด (มหาชน). สงวนลิขสิทธิ์ทั้งหมด</p>
            <p className="flex items-center space-x-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span className="text-slate-700 font-semibold">
                ระบบกำกับดูแลความมั่นคงปลอดภัยตามมาตรฐาน ISO 27001 & PDPA
              </span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
