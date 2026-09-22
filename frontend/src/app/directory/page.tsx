"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  UserX,
  AlertTriangle,
  Layers,
  Shield,
  CheckCircle2,
  UserCheck,
  UserPlus,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  ciamApi,
  UserListItem,
  ConnectedApp,
  UserCreateResponse,
  UserActivateResponse,
} from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date";

export default function DirectoryPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [appFilter, setAppFilter] = useState("");

  const [ghostOnly, setGhostOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    employee_id: "",
    username: "",
    full_name: "",
    email: "",
    department: "",
    telephone: "",
    create_in_ad: true,
  });
  const [selectedSpokes, setSelectedSpokes] = useState<Record<number, { selected: boolean; group_name: string }>>({});
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<UserCreateResponse | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Activate User Modal State
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<UserListItem | null>(null);
  const [activateReason, setActivateReason] = useState("พนักงานกลับมาปฏิบัติงาน / HR อนุมัติคืนสิทธิ์");
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateResult, setActivateResult] = useState<UserActivateResponse | null>(null);

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

  const fetchApplications = async () => {
    try {
      const appList = await ciamApi.getApplications();
      setApps(appList);
      const initialSpokes: Record<number, { selected: boolean; group_name: string }> = {};
      appList.forEach((app) => {
        let defaultRole = "Standard User";
        if (app.app_code === "irm") defaultRole = "PU User";
        else if (app.app_code === "qms") defaultRole = "QA Inspector";
        initialSpokes[app.id] = { selected: false, group_name: defaultRole };
      });
      setSelectedSpokes(initialSpokes);
    } catch (err) {
      console.error("Error fetching applications:", err);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchUsers();
  }, [statusFilter, appFilter, ghostOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  // Calculate Pagination
  const totalUsers = users.length;
  const effectivePageSize = pageSize === 0 ? (totalUsers || 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalUsers / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedUsers = pageSize === 0 ? users : users.slice((safeCurrentPage - 1) * effectivePageSize, safeCurrentPage * effectivePageSize);
  const startIndex = totalUsers === 0 ? 0 : (safeCurrentPage - 1) * effectivePageSize + 1;
  const endIndex = Math.min(safeCurrentPage * effectivePageSize, totalUsers);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenCreateModal = () => {
    setCreateResult(null);
    setCreateError(null);
    setCreateForm({
      employee_id: "",
      username: "",
      full_name: "",
      email: "",
      department: "",
      telephone: "",
      create_in_ad: true,
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.full_name.trim()) {
      setCreateError("กรุณากรอก Username และชื่อ-นามสกุล");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);

      const target_spokes = Object.entries(selectedSpokes)
        .filter(([_, val]) => val.selected)
        .map(([appId, val]) => ({
          application_id: Number(appId),
          group_name: val.group_name || "Standard User",
        }));

      const res = await ciamApi.createUser({
        employee_id: createForm.employee_id.trim() || undefined,
        username: createForm.username.trim(),
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim() || undefined,
        department: createForm.department.trim() || undefined,
        telephone: createForm.telephone.trim() || undefined,
        create_in_ad: createForm.create_in_ad,
        target_spokes,
      });

      setCreateResult(res);
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || "เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenActivateModal = (user: UserListItem) => {
    setActivateTarget(user);
    setActivateReason("พนักงานกลับมาปฏิบัติงาน / HR อนุมัติคืนสิทธิ์");
    setActivateResult(null);
    setIsActivateModalOpen(true);
  };

  const handleActivateSubmit = async () => {
    if (!activateTarget) return;
    try {
      setActivateLoading(true);
      const res = await ciamApi.activateUser(activateTarget.id, activateReason);
      setActivateResult(res);
      await fetchUsers();
      if (selectedUser && selectedUser.id === activateTarget.id) {
        setSelectedUser(null);
      }
    } catch (err: any) {
      alert(`การเปิดสิทธิ์คืนล้มเหลว: ${err.message}`);
    } finally {
      setActivateLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b-2 border-slate-300">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ทะเบียนผู้ใช้และสิทธิ์ระบบ
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 rounded-full shadow-2xs">
              {users.length} บัญชีในระบบ
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ข้อมูลตัวตนพนักงานหลักใน Active Directory และสิทธิ์การเข้าถึงระบบต่างๆ ในองค์กร
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ เพิ่มผู้ใช้ใหม่</span>
          </button>

          <Link
            href="/offboarding"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <UserX className="w-4 h-4" />
            <span>ศูนย์ระงับสิทธิ์</span>
          </Link>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white p-4 rounded-lg border-2 border-slate-300 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาด้วย รหัสพนักงาน, ชื่อ, Username หรือ แผนก..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-white border-2 border-slate-300 rounded-md text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="active">🟢 เฉพาะที่ยังใช้งานอยู่ (Active)</option>
              <option value="terminated">⚪ ปิดใช้งานทั้งหมดแล้ว (Terminated)</option>
              <option value="ad_active">เฉพาะเปิดใช้งานใน AD</option>
              <option value="ad_inactive">เฉพาะปิดใช้งานใน AD</option>
              <option value="all">แสดงทั้งหมด (All Accounts)</option>
            </select>


            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">ทุกระบบลูก</option>
              {apps.map((app) => (
                <option key={app.id} value={app.app_code}>
                  {app.app_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setGhostOnly(!ghostOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all border-2 ${
                ghostOnly
                  ? "bg-amber-400 text-amber-950 border-amber-500 shadow-2xs"
                  : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${ghostOnly ? "text-amber-950" : "text-slate-500"}`} />
              <span>เฉพาะบัญชีตกค้าง (Ghost)</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
            >
              ค้นหา
            </button>
          </div>
        </form>
      </div>

      {/* Directory Table - High Contrast Structure */}
      <div className="bg-white rounded-lg border-2 border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-800">
            <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">พนักงาน / บัญชีผู้ใช้</th>
                <th className="py-3.5 px-4">แผนก</th>
                <th className="py-3.5 px-4">สถานะใน Active Directory</th>
                <th className="py-3.5 px-4">สิทธิ์ในระบบลูก (Spokes)</th>
                <th className="py-3.5 px-4">ประวัติการใช้งาน (Activity)</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm font-semibold">
                    กำลังโหลดข้อมูลทะเบียนผู้ใช้...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm font-semibold">
                    ไม่พบข้อมูลผู้ใช้ที่ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      user.has_discrepancy ? "bg-amber-50/80 border-l-4 border-l-amber-500" : ""
                    }`}
                  >
                    {/* Identity Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center font-bold text-sm text-blue-800 shadow-2xs">
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <span>{user.full_name}</span>
                            {user.is_ad_account === false && (
                              <span className="bg-slate-200 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                ระบบลูก
                              </span>
                            )}
                            {user.has_discrepancy && (
                              <span className="bg-amber-300 text-amber-950 border border-amber-500 px-1.5 py-0.2 rounded text-[10px] font-black">
                                บัญชีผี
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-medium flex items-center space-x-1.5 mt-0.5">
                            <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              {user.username}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{user.employee_id || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      {user.department || "ทั่วไป"}
                    </td>

                    {/* AD Status */}
                    <td className="py-3.5 px-4">
                      {user.is_ad_account === false ? (
                        <span className="bg-slate-100 text-slate-600 border border-slate-300 px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>เฉพาะระบบลูก (ไม่มีใน AD)</span>
                        </span>
                      ) : user.is_active_in_ad ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>เปิดใช้งานใน AD</span>
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                          <span>ปิดใช้งานใน AD</span>
                        </span>
                      )}
                    </td>

                    {/* Connected Apps Badges */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.connected_apps.length === 0 ? (
                          <span className="text-xs text-slate-400 font-medium">ไม่มีบัญชีในระบบลูก</span>
                        ) : (
                          user.connected_apps.map((app) => (
                            <div
                              key={`${app.application_id}-${app.app_username}`}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 border shadow-2xs ${

                                !user.is_active_in_ad && app.is_active_in_app
                                  ? "bg-amber-200 text-amber-950 border-amber-400"
                                  : app.is_active_in_app
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : "bg-slate-50 text-slate-400 border-slate-200 line-through"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  app.is_active_in_app ? "bg-emerald-600" : "bg-rose-600"
                                }`}
                              ></span>
                              <span className="uppercase">{app.app_code}</span>
                              {app.app_group_name && (
                                <span className="text-[10px] text-slate-600 font-normal">({app.app_group_name})</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Activity: Created Date, Last Access, and Days Ago */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {/* Days Ago Badge */}
                        <div>
                          {user.days_since_last_access !== null && user.days_since_last_access !== undefined ? (
                            user.days_since_last_access === 0 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                <span>ใช้งานวันนี้</span>
                              </span>
                            ) : user.days_since_last_access <= 7 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                <span>{user.days_since_last_access} วันที่แล้ว</span>
                              </span>
                            ) : user.days_since_last_access <= 30 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                <span>{user.days_since_last_access} วันที่แล้ว</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                <span>ไม่ได้ใช้ {user.days_since_last_access} วัน</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <span>ไม่เคยเข้าใช้งาน</span>
                            </span>
                          )}
                        </div>

                        {/* Last Access Details */}
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400 font-medium">เข้าใช้ล่าสุด:</span>
                            <span className="font-semibold text-slate-800">
                              {formatDate(user.last_access_at)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 text-slate-500">
                            <span>สร้างเมื่อ:</span>
                            <span>
                              {formatDate(user.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {(!user.is_active_in_ad || user.connected_apps.some((a) => !a.is_active_in_app)) && (
                          <button
                            onClick={() => handleOpenActivateModal(user)}
                            title="เปิดใช้งานสิทธิ์คืน"
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>คืนสิทธิ์</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                        >
                          ดูสิทธิ์
                        </button>
                        <Link
                          href={`/offboarding?username=${user.username}`}
                          className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs"
                          title="ไปที่หน้าศูนย์ระงับสิทธิ์พนักงานท่านนี้"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>ระงับสิทธิ์</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && totalUsers > 0 && (
          <div className="bg-slate-50 px-4 py-3 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700">
            {/* Info & Page Size Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-medium text-slate-600">
                แสดง <strong className="text-slate-900 font-bold">{startIndex} - {endIndex}</strong> จากทั้งหมด{" "}
                <strong className="text-slate-900 font-bold">{totalUsers}</strong> บัญชี
              </span>

              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-300">
                <span className="text-slate-500 font-medium">ต่อหน้า:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>ทั้งหมด ({totalUsers})</option>
                </select>
              </div>
            </div>

            {/* Navigation Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-1">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าแรก"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Prev Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-colors flex items-center space-x-0.5 cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden md:inline pr-1">ก่อนหน้า</span>
                </button>

                {/* Page Number Chips */}
                <div className="flex items-center space-x-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push("...");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      typeof item === "string" ? (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                          ...
                        </span>
                      ) : (
                        <button
                          key={`page-${item}`}
                          type="button"
                          onClick={() => handlePageChange(item)}
                          className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                            item === safeCurrentPage
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-colors flex items-center space-x-0.5 cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าถัดไป"
                >
                  <span className="hidden md:inline pl-1">ถัดไป</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าสุดท้าย"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inspect Modal Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 space-y-5 rounded-lg border-2 border-slate-300 shadow-2xl relative">
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-800 font-extrabold text-lg shadow-2xs">
                  {selectedUser.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedUser.full_name}</h3>
                  <div className="text-xs text-slate-600 font-medium flex items-center space-x-1.5">
                    <span className="font-mono text-blue-700 font-bold">{selectedUser.username}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{selectedUser.department}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* AD & Identity Activity Details */}
            <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-300 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">รหัสพนักงาน:</span>
                <span className="font-mono text-slate-900 font-bold">{selectedUser.employee_id || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">อีเมล:</span>
                <span className="text-slate-900 font-bold">{selectedUser.email || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">สถานะใน Active Directory:</span>
                {selectedUser.is_ad_account === false ? (
                  <span className="text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded border border-slate-300 text-xs">
                    เฉพาะระบบลูก (ไม่มีใน AD)
                  </span>
                ) : (
                  <span className={selectedUser.is_active_in_ad ? "text-emerald-800 font-extrabold" : "text-rose-800 font-extrabold"}>
                    {selectedUser.is_active_in_ad ? "เปิดใช้งานใน AD" : "ปิดใช้งานใน AD"}
                  </span>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">วันที่ลงทะเบียน / สร้างบัญชี:</span>
                  <span className="font-semibold text-slate-800 font-mono text-xs">
                    {selectedUser.created_at
                      ? formatDateTime(selectedUser.created_at)
                      : "ไม่ระบุ"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">เข้าใช้งานระบบองค์กรล่าสุด:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-800 font-mono text-xs">
                      {selectedUser.last_access_at
                        ? formatDateTime(selectedUser.last_access_at)
                        : "ไม่เคยเข้าใช้งาน"}
                    </span>
                    {selectedUser.days_since_last_access !== null && selectedUser.days_since_last_access !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        {selectedUser.days_since_last_access === 0
                          ? "วันนี้"
                          : `${selectedUser.days_since_last_access} วันที่แล้ว`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cross-App Access Matrix */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                สิทธิ์การเข้าถึงระบบต่างๆ
              </h4>
              <div className="space-y-2">
                {selectedUser.connected_apps.map((app) => (
                  <div
                    key={`${app.application_id}-${app.app_username}`}
                    className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-between"
                  >

                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          app.is_active_in_app ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      ></div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{app.app_name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-100 text-blue-800 border border-blue-200 font-bold">
                            {app.connector_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          บทบาท: <strong className="text-slate-800">{app.app_group_name || "Standard User"}</strong>
                        </div>
                        {app.last_app_login_at && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            เข้าใช้ล่าสุด: <span className="font-mono">{formatDate(app.last_app_login_at)}</span>
                            {app.days_since_last_login !== null && app.days_since_last_login !== undefined && (
                              <span className="ml-1 text-slate-600 font-bold">
                                ({app.days_since_last_login === 0 ? "วันนี้" : `${app.days_since_last_login} วันที่แล้ว`})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                        app.is_active_in_app
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : "bg-rose-100 text-rose-900 border border-rose-300"
                      }`}
                    >
                      {app.is_active_in_app ? "เปิดใช้งาน" : "ถูกระงับ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-md bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-2xs"
              >
                ปิด
              </button>

              <div className="flex items-center space-x-2">
                {(!selectedUser.is_active_in_ad || selectedUser.connected_apps.some((a) => !a.is_active_in_app)) && (
                  <button
                    onClick={() => {
                      const u = selectedUser;
                      setSelectedUser(null);
                      handleOpenActivateModal(u);
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>เปิดสิทธิ์คืน</span>
                  </button>
                )}

                <Link
                  href={`/offboarding?username=${selectedUser.username}`}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
                >
                  <UserX className="w-4 h-4" />
                  <span>ระงับสิทธิ์พนักงาน</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-xl w-full p-6 space-y-4 rounded-lg border-2 border-slate-300 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b-2 border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">เพิ่มและแจกจ่ายสิทธิ์ผู้ใช้ใหม่</h3>
                  <p className="text-xs text-slate-600 font-medium">
                    บันทึกข้อมูลตัวตนหลักและส่งคำสั่งสร้างบัญชีไปยัง Active Directory และระบบลูก
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {createResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-400 text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>สร้างและแจกจ่ายสิทธิ์ผู้ใช้สำเร็จเรียบร้อย</span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    บัญชี <span className="font-mono font-bold text-slate-950">{createResult.username}</span> บันทึกเข้าสู่ระบบเรียบร้อยแล้ว
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ผลการดำเนินการแยกรายระบบ
                  </h4>

                  <div className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">Active Directory (ผ่าน AD Proxy)</div>
                      <div className="text-[11px] text-slate-600 font-mono">sAMAccountName: {createResult.username}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {createResult.ad_status === "ACTIVE" ? "สร้างสำเร็จ" : createResult.ad_status}
                    </span>
                  </div>

                  {createResult.spoke_results.map((spoke, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{spoke.app_name}</div>
                        <div className="text-[11px] text-slate-600">{spoke.message}</div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          spoke.success
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-rose-100 text-rose-900 border border-rose-300"
                        }`}
                      >
                        {spoke.success ? "สำเร็จ" : "ล้มเหลว"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t-2 border-slate-200 flex justify-end">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {createError && (
                  <div className="p-3 rounded-md bg-rose-50 border-2 border-rose-400 text-xs text-rose-900 font-bold flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">Username (sAMAccountName) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น patcha.s"
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">ชื่อ-นามสกุล *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น พัชรา สุขใจ"
                      value={createForm.full_name}
                      onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">รหัสพนักงาน</label>
                    <input
                      type="text"
                      placeholder="เช่น WA-10492"
                      value={createForm.employee_id}
                      onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">อีเมลบริษัท</label>
                    <input
                      type="email"
                      placeholder="เช่น patcha.s@windowasia.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">แผนก</label>
                    <input
                      type="text"
                      placeholder="เช่น บัญชี, จัดซื้อ, IT"
                      value={createForm.department}
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-bold">เบอร์โทรศัพท์</label>
                    <input
                      type="text"
                      placeholder="เช่น 081-234-5678"
                      value={createForm.telephone}
                      onChange={(e) => setCreateForm({ ...createForm, telephone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* AD Toggle */}
                <div className="p-3.5 rounded-lg bg-slate-50 border-2 border-slate-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">สร้างบัญชีใน Active Directory (ผ่าน AD Proxy)</div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        ส่งคำขอไปยัง AD Sync Agent เพื่อสร้างบัญชีใน Domain Controller
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={createForm.create_in_ad}
                    onChange={(e) => setCreateForm({ ...createForm, create_in_ad: e.target.checked })}
                    className="w-5 h-5 rounded text-blue-600 border-2 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Spoke Systems */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    เลือกระบบลูกที่ต้องการสร้างบัญชีและกำหนดบทบาท
                  </label>

                  <div className="space-y-2">
                    {apps.map((app) => {
                      const spokeState = selectedSpokes[app.id] || { selected: false, group_name: "Standard User" };
                      return (
                        <div
                          key={app.id}
                          className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-between gap-2 text-xs ${
                            spokeState.selected
                              ? "bg-blue-50 border-blue-400"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={spokeState.selected}
                              onChange={(e) =>
                                setSelectedSpokes({
                                  ...selectedSpokes,
                                  [app.id]: { ...spokeState, selected: e.target.checked },
                                })
                              }
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-bold text-slate-900">{app.app_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded font-bold">
                              REST API
                            </span>
                          </label>

                          {spokeState.selected && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs text-slate-600 font-bold">บทบาท:</span>
                              <input
                                type="text"
                                value={spokeState.group_name}
                                onChange={(e) =>
                                  setSelectedSpokes({
                                    ...selectedSpokes,
                                    [app.id]: { ...spokeState, group_name: e.target.value },
                                  })
                                }
                                className="px-2.5 py-1 bg-white border-2 border-slate-300 rounded text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600 w-36"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    {createLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังดำเนินการ...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>บันทึกและสร้างบัญชี</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Activate User Modal */}
      {isActivateModalOpen && activateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 space-y-4 rounded-lg border-2 border-slate-300 shadow-2xl relative">
            <div className="flex items-start justify-between border-b-2 border-slate-200 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-md bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">เปิดใช้งานสิทธิ์พนักงานคืน</h3>
                  <div className="text-xs text-slate-600 font-medium">
                    เปิดสิทธิ์ <span className="font-mono text-emerald-800 font-bold">{activateTarget.username}</span> ใน AD และระบบลูก
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsActivateModalOpen(false)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {activateResult ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-md bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs">
                  <div className="font-bold flex items-center space-x-1.5 mb-1 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>เปิดใช้งานสิทธิ์คืนสำเร็จเรียบร้อย</span>
                  </div>
                  <span className="font-medium">สถานะบัญชีได้รับการตั้งค่าเป็น ACTIVE ในระบบทั้งหมด</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setIsActivateModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-md bg-slate-50 border-2 border-slate-300 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">พนักงาน:</span>
                    <span className="font-bold text-slate-900">{activateTarget.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Username:</span>
                    <span className="font-mono text-blue-700 font-bold">{activateTarget.username}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-700 mb-1 font-bold">เหตุผลการคืนสิทธิ์</label>
                  <textarea
                    rows={2}
                    value={activateReason}
                    onChange={(e) => setActivateReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-md text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="pt-2 border-t-2 border-slate-200 flex items-center justify-end space-x-2.5">
                  <button
                    onClick={() => setIsActivateModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleActivateSubmit}
                    disabled={activateLoading}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    {activateLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังดำเนินการ...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>ยืนยันคืนสิทธิ์</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
