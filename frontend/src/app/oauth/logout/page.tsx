"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { clearSessionStorage } from "@/lib/session";

function OAuthLogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postLogoutRedirectUri =
    searchParams.get("post_logout_redirect_uri") ||
    searchParams.get("redirect_uri") ||
    "";

  useEffect(() => {
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
        router.replace("/login?logged_out=1&redirect=/portal");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [postLogoutRedirectUri, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070d1e] via-[#0b1426] to-[#0f2347] flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg mx-auto">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-lg font-extrabold text-white">
          กำลังออกจากระบบ Single Sign-On...
        </h1>
        <p className="text-xs text-slate-400">
          ระบบได้ล้างเซสชันการใช้งานของคุณเรียบร้อยแล้ว กำลังนำทางไปยังหน้าเข้าสู่ระบบ
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
          กำลังออกจากระบบ...
        </div>
      }
    >
      <OAuthLogoutContent />
    </Suspense>
  );
}
