"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  UserX,
  AlertTriangle,
  Layers,
  ChevronRight,
  ExternalLink,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { ciamApi, UserListItem } from "@/lib/api";

export default function DirectoryPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [ghostOnly, setGhostOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await ciamApi.getUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        app_code: appFilter || undefined,
        has_ghost: ghostOnly ? true : undefined,
      });
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, appFilter, ghostOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Enterprise User Directory</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              {users.length} Identities
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Master employee identities synchronized from Active Directory and their cross-system permission footprint.
          </p>
        </div>

        <Link
          href="/offboarding"
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-all shadow-lg shadow-rose-900/20"
        >
          <UserX className="w-4 h-4" />
          <span>Launch Offboarding Hub</span>
        </Link>
      </div>

      {/* Universal Search & Filters Toolbar */}
      <div className="ciam-card p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Employee ID, Name, Username, Department, or Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All AD Statuses</option>
              <option value="active">Active in AD</option>
              <option value="inactive">Disabled in AD</option>
            </select>

            {/* App Filter */}
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Applications</option>
              <option value="irm">IRM System</option>
              <option value="qms">QMS System</option>
              <option value="legacy_erp">Legacy ERP / SAP B1</option>
            </select>

            {/* Ghost Account Quick Filter Button */}
            <button
              type="button"
              onClick={() => setGhostOnly(!ghostOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                ghostOnly
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${ghostOnly ? "text-amber-400" : "text-slate-500"}`} />
              <span>Ghost Accounts Only</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Directory Table */}
      <div className="ciam-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 border-b border-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Employee / Identity</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">AD Status</th>
                <th className="py-3.5 px-4">Cross-App Permissions (Spokes)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Loading enterprise directory records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No employees matching the specified criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-900/40 transition-colors ${
                      user.has_discrepancy ? "bg-amber-950/10" : ""
                    }`}
                  >
                    {/* Identity Details */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center space-x-2">
                            <span>{user.full_name}</span>
                            {user.has_discrepancy && (
                              <span className="badge-ghost px-1.5 py-0.5 rounded text-[10px] font-bold">
                                GHOST ACCOUNT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                            <span className="font-mono text-indigo-300">{user.username}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{user.employee_id || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-4 px-4 text-xs font-medium text-slate-300">
                      {user.department || "General Enterprise"}
                    </td>

                    {/* AD Status */}
                    <td className="py-4 px-4">
                      {user.is_active_in_ad ? (
                        <span className="badge-active px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Active in AD</span>
                        </span>
                      ) : (
                        <span className="badge-inactive px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>Disabled in AD</span>
                        </span>
                      )}
                    </td>

                    {/* Cross-App Badges Matrix */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.connected_apps.length === 0 ? (
                          <span className="text-xs text-slate-500">No linked spoke accounts</span>
                        ) : (
                          user.connected_apps.map((app) => (
                            <div
                              key={app.application_id}
                              className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1.5 border ${
                                !user.is_active_in_ad && app.is_active_in_app
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                                  : app.is_active_in_app
                                  ? "bg-slate-900 text-slate-200 border-slate-700/80"
                                  : "bg-slate-950 text-slate-500 border-slate-800 line-through"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  app.is_active_in_app ? "bg-emerald-400" : "bg-rose-500"
                                }`}
                              ></span>
                              <span className="font-semibold uppercase">{app.app_code}</span>
                              {app.app_group_name && (
                                <span className="text-[10px] text-slate-400">({app.app_group_name})</span>
                              )}
                              {app.connector_type === "RPA_WORKER" && (
                                <span className="text-[9px] px-1 bg-cyan-500/20 text-cyan-300 rounded">
                                  RPA
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                      >
                        Inspect Matrix
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="ciam-card max-w-xl w-full p-6 space-y-5 border border-slate-700 shadow-2xl relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                  {selectedUser.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.full_name}</h3>
                  <div className="text-xs text-slate-400 flex items-center space-x-2">
                    <span className="font-mono text-indigo-300">{selectedUser.username}</span>
                    <span>•</span>
                    <span>{selectedUser.department}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* AD Details */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee ID:</span>
                <span className="font-mono text-slate-200">{selectedUser.employee_id || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email Address:</span>
                <span className="text-slate-200">{selectedUser.email || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Directory Status:</span>
                <span className={selectedUser.is_active_in_ad ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {selectedUser.is_active_in_ad ? "Active in AD" : "Disabled in AD"}
                </span>
              </div>
            </div>

            {/* Cross-App Access Matrix */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Cross-Application Access Footprint
              </h4>
              <div className="space-y-2">
                {selectedUser.connected_apps.map((app) => (
                  <div
                    key={app.application_id}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          app.is_active_in_app ? "bg-emerald-400" : "bg-rose-500"
                        }`}
                      ></div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                          <span>{app.app_name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                              app.connector_type === "RPA_WORKER" ? "badge-rpa" : "badge-rest"
                            }`}
                          >
                            {app.connector_type === "RPA_WORKER" ? "RPA BOT" : "REST API"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Role: <span className="text-slate-300">{app.app_group_name || "Standard User"}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        app.is_active_in_app ? "badge-active" : "badge-inactive"
                      }`}
                    >
                      {app.is_active_in_app ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>

              <Link
                href={`/offboarding?username=${selectedUser.username}`}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/30"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Offboard Employee</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
