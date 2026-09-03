"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Plus,
  Zap,
  Bot,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Globe,
  Key,
  RefreshCw,
} from "lucide-react";
import { ciamApi, ConnectedApp } from "@/lib/api";

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new app
  const [appCode, setAppCode] = useState("");
  const [appName, setAppName] = useState("");
  const [connectorType, setConnectorType] = useState<"REST_API" | "RPA_WORKER">("REST_API");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const data = await ciamApi.getApplications();
      setApps(data);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handlePing = async (id: number) => {
    try {
      setPingingId(id);
      const res = await ciamApi.pingApplication(id);
      // Update local state
      setApps((prev) =>
        prev.map((app) =>
          app.id === id
            ? {
                ...app,
                health_status: res.status as any,
                latency_ms: res.latency_ms,
                last_health_check_at: new Date().toISOString(),
              }
            : app
        )
      );
    } catch (err) {
      alert("Ping test failed");
    } finally {
      setPingingId(null);
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await ciamApi.registerApplication({
        app_code: appCode,
        app_name: appName,
        connector_type: connectorType,
        base_url: baseUrl || undefined,
        api_key: apiKey || undefined,
      });
      setShowAddModal(false);
      setAppCode("");
      setAppName("");
      setBaseUrl("");
      setApiKey("");
      fetchApps();
    } catch (err: any) {
      alert(`Error creating app: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Connected Applications & Spokes</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
              {apps.length} Connected
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Hybrid spoke registry orchestrating M2M REST APIs and In-House RPA Automation Bot Workers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-900/20 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Application</span>
        </button>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            Loading connected applications...
          </div>
        ) : (
          apps.map((app) => (
            <div key={app.id} className="ciam-card p-6 flex flex-col justify-between space-y-5">
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        app.connector_type === "RPA_WORKER"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}
                    >
                      {app.connector_type === "RPA_WORKER" ? <Bot className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{app.app_name}</h3>
                      <div className="text-xs text-slate-400 font-mono mt-0.5 uppercase tracking-wider">
                        Code: {app.app_code}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      app.connector_type === "RPA_WORKER" ? "badge-rpa" : "badge-rest"
                    }`}
                  >
                    {app.connector_type === "RPA_WORKER" ? "RPA BOT" : "REST API"}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Endpoint:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {app.base_url || "Local Headless Agent"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Linked Accounts:</span>
                    <span className="font-semibold text-white">{app.total_linked_accounts} users</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status & Health:</span>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          app.health_status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                        }`}
                      ></span>
                      <span
                        className={`font-semibold ${
                          app.health_status === "ONLINE" ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {app.health_status}
                      </span>
                      {app.latency_ms && (
                        <span className="text-[10px] font-mono text-slate-500">({app.latency_ms} ms)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ping Diagnostic Tool */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {app.last_health_check_at
                    ? `Checked ${new Date(app.last_health_check_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "No test run yet"}
                </span>

                <button
                  onClick={() => handlePing(app.id)}
                  disabled={pingingId === app.id}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 transition-all"
                >
                  <Activity className={`w-3.5 h-3.5 ${pingingId === app.id ? "animate-spin text-cyan-400" : ""}`} />
                  <span>{pingingId === app.id ? "Pinging..." : "Test Connection"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="ciam-card max-w-lg w-full p-6 space-y-5 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Register Connected Spoke</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Application Code</label>
                <input
                  type="text"
                  placeholder="e.g. wms, crm, pos"
                  value={appCode}
                  onChange={(e) => setAppCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Application Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse Management System"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Integration Connector Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConnectorType("REST_API")}
                    className={`p-3 rounded-lg border text-left flex flex-col space-y-1 ${
                      connectorType === "REST_API"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Direct REST API</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Standard HTTP M2M</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectorType("RPA_WORKER")}
                    className={`p-3 rounded-lg border text-left flex flex-col space-y-1 ${
                      connectorType === "RPA_WORKER"
                        ? "bg-cyan-600/10 border-cyan-500 text-cyan-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center space-x-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      <span>RPA Bot Worker</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Headless UI Automation</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Base URL or Web Portal Address
                </label>
                <input
                  type="text"
                  placeholder="https://spoke.windowasia.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                >
                  {submitting ? "Registering..." : "Confirm Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
