"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, RefreshCw } from "lucide-react";
import {
  checkTokenValidOnReturn,
  clearSessionStorage,
  markSessionActivity,
} from "@/lib/session";

function OAuthLogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postLogoutRedirectUri =
    searchParams.get("post_logout_redirect_uri") ||
    searchParams.get("redirect_uri") ||
    "";
  const fullLogout = searchParams.get("full_logout") === "1";

  useEffect(() => {
    const tokenCheck = checkTokenValidOnReturn();

    // If full_logout=1 is explicitly requested or CIAM JWT token is missing/expired, perform full sign-out to /login
    if (fullLogout || !tokenCheck.valid) {
      clearSessionStorage();
      const timer = setTimeout(() => {
        if (
          postLogoutRedirectUri &&
          (postLogoutRedirectUri.startsWith("http://") ||
            postLogoutRedirectUri.startsWith("https://") ||
            postLogoutRedirectUri.startsWith("/"))
        ) {
          window.location.replace(postLogoutRedirectUri);
        } else {
          router.replace("/login");
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    // Standard Logout from a Spoke App Client:
    // Keep CIAM SSO Portal session active, reset the 30-minute Portal Idle Timer, and return directly to /portal!
    markSessionActivity();

    const timer = setTimeout(() => {
      if (
        postLogoutRedirectUri &&
        (postLogoutRedirectUri.startsWith("http://") ||
          postLogoutRedirectUri.startsWith("https://") ||
          postLogoutRedirectUri.startsWith("/"))
      ) {
        window.location.replace(postLogoutRedirectUri);
      } else {
        router.replace("/portal");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [postLogoutRedirectUri, fullLogout, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070d1e] via-[#0b1426] to-[#0f2347] flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg mx-auto">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-lg font-extrabold text-white">
          กำลังกลับสู่หน้า SSO App Portal...
        </h1>
        <p className="text-xs text-slate-400">
          ออกจากระบบลูกเรียบร้อยแล้ว กำลังนำท่านกลับไปยังหน้า Central IAM SSO Portal
        </p>
        <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto" />
      </div>
    </div>
  );
}

export default function OAuthLogoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070d1e] flex items-center justify-center text-slate-300 text-sm">
          กำลังนำทางกลับสู่หน้า SSO Portal...
        </div>
      }
    >
      <OAuthLogoutContent />
    </Suspense>
  );
}
