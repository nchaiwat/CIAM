"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Rocket,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Server,
  Key,
  Layers,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Building2,
  Lock,
  ChevronDown,
  Info,
  FlaskConical,
  Laptop,
  Globe,
} from "lucide-react";
import { api, PortalAppItem } from "@/lib/api";

export default function PortalPage() {
  const [apps, setApps] = useState<PortalAppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [launchingAppCode, setLaunchingAppCode] = useState<string | null>(null);
  const [copiedAppCode, setCopiedAppCode] = useState<string | null>(null);
  const [openMenuAppCode, setOpenMenuAppCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getPortalApps();
      setApps(data);
    } catch (err: any) {
      console.error("Failed to load portal apps:", err);
      setErrorMsg("ไม่สามารถดึงรายการแอปพลิเคชันได้ กรุณาตรวจสอบการเชื่อมต่อกับเซิร์ฟเวอร์ Backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    apps.forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return ["ALL", ...Array.from(cats)];
  }, [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        app.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.app_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === "ALL" || app.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [apps, searchQuery, selectedCategory]);

  const handleLaunchSSO = async (app: PortalAppItem, targetUri?: string) => {
    if (!app.client_id) return;
    setLaunchingAppCode(app.app_code);
    setOpenMenuAppCode(null);
    try {
      // Determine production destination if targetUri not specified
      let destUri = targetUri;
      if (!destUri) {
        const targets = getAppTargets(app);
        const prod = targets.find((t) => !t.isSimulator && !t.isLocal);
        destUri = prod?.uri || app.base_url || undefined;
      }

      const res = await api.launchPortalApp(app.client_id, undefined, destUri);
      if (res && res.launch_url) {
        // Open the target app with one-time SSO code in a new tab
        window.open(res.launch_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการสร้าง SSO Ticket: " + (err.message || "Unknown error"));
    } finally {
      setTimeout(() => setLaunchingAppCode(null), 800);
    }
  };

  const getAppTargets = (app: PortalAppItem) => {
    const raw = app.redirect_uris
      ? app.redirect_uris.split(",").map((u) => u.trim()).filter(Boolean)
      : [];
    if (raw.length === 0 && app.base_url) {
      raw.push(app.base_url);
    }
    // Filter out simulator callback by default for normal production portal usage
    const filtered = raw.filter((uri) => !uri.includes("localhost:3000/portal/callback"));
    const listToMap = filtered.length > 0 ? filtered : raw;

    return listToMap.map((uri) => {
      let label = uri;
      let isSimulator = false;
      let isLocal = false;
      let note = "";

      if (uri.includes("localhost:3000/portal/callback")) {
        label = "Portal Simulator (CIAM Test)";
        isSimulator = true;
        note = "ทดสอบรับ Token & Claims ในหน้า Portal";
      } else if (uri.includes("localhost:")) {
        label = `Local Dev Server (${uri})`;
        isLocal = true;
        note = "เปิดเข้าแอปบนเครื่อง Development";
      } else if (uri.includes("windowasia.com")) {
        label = "ระบบจริง (Production Cloud)";
        note = uri;
      }

      return { uri, label, note, isSimulator, isLocal };
    });
  };

  const handleCopyLink = (app: PortalAppItem) => {
    const link = app.base_url || app.launch_url || "";
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedAppCode(app.app_code);
    setTimeout(() => setCopiedAppCode(null), 2000);
  };

  const getAppIcon = (appCode: string) => {
    switch (appCode.toLowerCase()) {
      case "irm":
        return <Boxes className="w-7 h-7 text-amber-500" />;
      case "qms":
        return <ClipboardCheck className="w-7 h-7 text-emerald-500" />;
      case "qol":
        return <FileSpreadsheet className="w-7 h-7 text-blue-500" />;
      case "sap_b1":
        return <Building2 className="w-7 h-7 text-indigo-500" />;
      default:
        return <Layers className="w-7 h-7 text-sky-500" />;
    }
  };

  const getAppColorGradient = (appCode: string) => {
    switch (appCode.toLowerCase()) {
      case "irm":
        return "from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-600";
      case "qms":
        return "from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-600";
      case "qol":
        return "from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-600";
      case "sap_b1":
        return "from-indigo-500/10 to-purple-500/10 border-indigo-500/30 text-indigo-600";
      default:
        return "from-sky-500/10 to-cyan-500/10 border-sky-500/30 text-sky-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0b1329] via-[#101e42] to-[#0f2858] text-white p-6 sm:p-8 shadow-xl border border-blue-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Corporate Single Sign-On (SSO) Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              พอร์ทัลแอปพลิเคชันองค์กร (App Launcher)
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              เข้าใช้งานระบบสารสนเทศภายในเครือ บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ได้ในคลิกเดียว
              ด้วยการยืนยันตัวตนความปลอดภัยระดับองค์กร (OIDC / OAuth 2.0 with PKCE)
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-3 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 font-medium">ระบบที่พร้อมใช้</div>
              <div className="text-2xl font-bold text-white">{apps.length}</div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-3 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 font-medium">สถานะออนไลน์</div>
              <div className="text-2xl font-bold text-emerald-400">
                {apps.filter((a) => a.health_status === "ONLINE").length}/{apps.length}
              </div>
            </div>
            <button
              onClick={fetchApps}
              title="รีเฟรชรายการ"
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30 self-stretch sm:self-auto flex items-center justify-center"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Decorative ambient lighting */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามชื่อระบบ, รหัสย่อ (เช่น IRM, QMS, QOL) หรือฟังก์ชันงาน..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {cat === "ALL" ? "ทั้งหมด (All Systems)" : cat.split(" (")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SSO Instructions Banner */}
      <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4 flex items-start gap-3.5 text-xs text-blue-900 shadow-xs">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-blue-950 flex items-center gap-2">
            <span>คำแนะนำการใช้งานระบบ Single Sign-On (SSO Launch)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">ระบบพร้อมใช้งาน</span>
          </div>
          <p className="text-blue-800 leading-relaxed">
            • <strong>คลิกเพื่อเข้าสู่ระบบทันที:</strong> กดปุ่ม <strong>&quot;เข้าสู่ระบบ (SSO Launch)&quot;</strong> บนการ์ดระบบงานที่ท่านต้องการ ระบบจะเปิดหน้าต่างใหม่และยืนยันตัวตนอัตโนมัติด้วยมาตรฐานความปลอดภัยระดับองค์กร<br />
            • <strong>เข้าผ่านระบบปลายทางโดยตรง (SP-Initiated):</strong> ท่านยังสามารถเข้าเว็บของระบบนั้นๆ โดยตรง (เช่น <code>irm.windowasia.com</code>) แล้วกดปุ่ม <strong>&quot;เข้าสู่ระบบด้วย Window Asia SSO&quot;</strong> ได้เช่นเดียวกัน
          </p>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-white border border-slate-200 p-6 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <div className="w-2/3 h-4 bg-slate-200 rounded" />
                  <div className="w-1/3 h-3 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="w-full h-16 bg-slate-100 rounded-lg" />
              <div className="w-full h-10 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* App Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app) => {
            const isLaunching = launchingAppCode === app.app_code;
            const isCopied = copiedAppCode === app.app_code;
            const colorClass = getAppColorGradient(app.app_code);
            const targets = getAppTargets(app);

            return (
              <div
                key={app.id}
                className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-blue-400/50 transition-all duration-300 flex flex-col justify-between overflow-visible"
              >
                {/* Top colored accent bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${colorClass}`} />

                <div className="p-6 space-y-4">
                  {/* Card Header: Icon, Name & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-xs ${colorClass}`}
                      >
                        {getAppIcon(app.app_code)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                          {app.app_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider">
                            {app.app_code}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {app.connector_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Health indicator */}
                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{app.health_status}</span>
                      {app.latency_ms && (
                        <span className="text-[10px] text-emerald-600 font-normal">
                          ({app.latency_ms}ms)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category Pill */}
                  <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 inline-block">
                    📂 {app.category}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {app.description || "แอปพลิเคชันสำหรับบุคลากรภายในองค์กร"}
                  </p>

                  {/* Technical Metadata */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-blue-500" />
                      <span>OIDC / PKCE Single Sign-On</span>
                    </div>
                    {app.client_id && (
                      <span className="font-mono text-slate-400 text-[10px] truncate max-w-[120px]" title={app.client_id}>
                        {app.client_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 relative">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLaunchSSO(app)}
                      disabled={isLaunching}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-98 disabled:opacity-70 cursor-pointer"
                    >
                      {isLaunching ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังออก SSO Ticket...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>เข้าสู่ระบบ (SSO Launch)</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                        </>
                      )}
                    </button>

                    {targets.length > 1 && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuAppCode(openMenuAppCode === app.app_code ? null : app.app_code)}
                          title="เลือกปลายทาง SSO (Simulator, Local Dev, Cloud)"
                          className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center cursor-pointer ${
                            openMenuAppCode === app.app_code
                              ? "bg-blue-50 border-blue-400 text-blue-600"
                              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600"
                          }`}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openMenuAppCode === app.app_code ? "rotate-180" : ""}`} />
                        </button>

                        {openMenuAppCode === app.app_code && (
                          <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                              เลือกปลายทางการเชื่อมต่อ SSO
                            </div>
                            <div className="p-1 space-y-1">
                              {targets.map((t, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleLaunchSSO(app, t.uri)}
                                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5 group/opt cursor-pointer"
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {t.isSimulator ? (
                                      <FlaskConical className="w-4 h-4 text-blue-500" />
                                    ) : t.isLocal ? (
                                      <Laptop className="w-4 h-4 text-amber-500" />
                                    ) : (
                                      <Globe className="w-4 h-4 text-slate-400 group-hover/opt:text-blue-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-800 group-hover/opt:text-blue-600 truncate">
                                      {t.label}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {t.note || t.uri}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => handleCopyLink(app)}
                      title={isCopied ? "คัดลอกลิงก์แล้ว!" : "คัดลอก Direct URL"}
                      className="p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* Empty State */}
      {!loading && filteredApps.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
          <Layers className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">ไม่พบระบบงานที่ตรงกับคำค้นหา</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            ลองปรับเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นเพื่อดูระบบที่พร้อมใช้งาน
          </p>
        </div>
      )}

      {/* Security & Compliance Footer Card */}
      <div className="rounded-xl p-4 bg-slate-900 text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white">ISO 27001 & Corporate Security Compliant</span>
            <p className="text-slate-400 text-[11px]">
              เซสชันทั้งหมดได้รับการเข้ารหัสด้วย Asymmetric RS256 Keypair และบังคับใช้ One-Time Authorization Code (TTL 60s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px] self-end sm:self-auto">
          <span>Break-Glass Fallback:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-blue-400 border border-slate-700">
            AD Gateway :3100
          </span>
        </div>
      </div>
    </div>
  );
}
