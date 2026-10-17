"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import CiamCopilotWidget from "@/components/ai/CiamCopilotWidget";
import {
  useSessionWatchdog,
  checkSessionExpiration,
  checkTokenValidOnReturn,
  clearSessionStorage,
  markSessionActivity,
} from "@/lib/session";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const isStandalone =
    pathname?.startsWith("/oauth/authorize") ||
    pathname?.startsWith("/oauth/logout") ||
    pathname?.startsWith("/portal") ||
    pathname === "/login" ||
    pathname?.startsWith("/admin/login");

  // Run proactive session watchdog for protected Admin Console routes
  useSessionWatchdog({ enabled: !isStandalone && authChecked });

  useEffect(() => {
    const token = localStorage.getItem("ciam_token");
    const tokenReturnCheck = checkTokenValidOnReturn();
    const sessionCheck = checkSessionExpiration();

    const storedUserStr = localStorage.getItem("ciam_user");
    let userRole = "";
    if (storedUserStr) {
      try {
        const u = JSON.parse(storedUserStr);
        userRole = u.role || "";
      } catch {}
    }

    if (pathname?.startsWith("/portal")) {
      // Returning to /portal from an App Client: only verify JWT token validity (do NOT apply old idle time)
      if (!tokenReturnCheck.valid) {
        if (token) clearSessionStorage();
        const expiredParam = token && tokenReturnCheck.reason === "token_expired" ? "expired=1&" : "";
        router.replace(`/login?${expiredParam}redirect=/portal`);
        return;
      }
      markSessionActivity();
      setAuthChecked(true);
      return;
    }

    const isTokenValid = Boolean(token && !sessionCheck.expired);
    if (token && sessionCheck.expired) {
      clearSessionStorage();
    }

    if (pathname === "/login") {
      // If already logged in with valid active session, redirect to portal
      if (isTokenValid) {
        router.replace("/portal");
        return;
      }
      setAuthChecked(true);
    } else if (pathname?.startsWith("/admin/login")) {
      // Forward any /admin/login traffic directly to unified /login
      if (isTokenValid) {
        if (userRole === "PORTAL_USER") {
          router.replace("/portal");
        } else {
          router.replace("/");
        }
        return;
      }
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.replace(`/login${search}`);
      return;
    } else if (!isStandalone) {
      // Protected Admin Console routes (/, /directory, /applications, /offboarding, /audit-logs)
      if (!isTokenValid) {
        const expiredQuery = token && sessionCheck.expired ? "expired=1" : "";
        const redirectQuery =
          pathname && pathname !== "/" ? `redirect=${encodeURIComponent(pathname)}` : "";
        const combined = [expiredQuery, redirectQuery].filter(Boolean).join("&");
        router.replace(`/login${combined ? `?${combined}` : ""}`);
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
        <main className="flex-1 w-full px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3.5">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-300 bg-white py-4 text-center text-xs text-slate-600 font-medium shadow-inner">
          <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
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

      {/* Central IAM AI Copilot Floating Assistant */}
      <CiamCopilotWidget />
    </div>
  );
}
