export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? "/api/v1" : "http://127.0.0.1:8001/api/v1");

export interface KpiMetrics {
  total_identities: number;
  active_accounts: number;
  deprovisioned_accounts: number;
  connected_systems_online: number;
  connected_systems_total: number;
  ghost_accounts_count: number;
}

export interface DiscrepancyItem {
  identity_id: number;
  username: string;
  full_name: string;
  department: string | null;
  app_code: string;
  app_name: string;
  ad_status: string;
  app_status: string;
  reason: string;
}

export interface ActivityItem {
  id: number;
  actor_username: string;
  action_type: string;
  target_username: string;
  affected_app_code: string | null;
  execution_mode: string;
  status: string;
  created_at: string;
}

export interface DashboardSummary {
  kpi: KpiMetrics;
  discrepancies: DiscrepancyItem[];
  recent_activities: ActivityItem[];
}

export interface AppAccountSummary {
  mapping_id?: number;
  application_id: number;
  app_code: string;
  app_name: string;
  connector_type: string;
  app_username: string;
  app_group_name: string | null;
  is_active_in_app: boolean;
  last_sync_status: string;
  last_app_login_at: string | null;
  created_at?: string | null;
  days_since_last_login?: number | null;
  is_approved_exception?: boolean;
  exception_type?: string | null;
  exception_reason?: string | null;
  exception_approved_by?: string | null;
  exception_approved_at?: string | null;
}

export interface SpokeProvisionTarget {
  application_id: number;
  group_name?: string;
  custom_username?: string;
}

export interface UserCreatePayload {
  employee_id?: string;
  username: string;
  full_name: string;
  email?: string;
  department?: string;
  telephone?: string;
  telegram_id?: string;
  create_in_ad: boolean;
  target_spokes: SpokeProvisionTarget[];
}

export interface SpokeProvisionResult {
  application_id: number;
  app_code: string;
  app_name: string;
  connector_type: string;
  execution_mode: string;
  success: boolean;
  status_code?: number;
  message: string;
  execution_time_ms: number;
}

export interface UserCreateResponse {
  identity_id: number;
  employee_id?: string;
  username: string;
  full_name: string;
  department?: string;
  ad_status: string;
  overall_status: string;
  spoke_results: SpokeProvisionResult[];
}

export interface AppActivationResult {
  app_code: string;
  app_name: string;
  connector_type: string;
  execution_mode: string;
  status: string;
  message: string;
  http_code?: number;
  execution_time_ms: number;
}

export interface UserActivateResponse {
  identity_id: number;
  username: string;
  full_name: string;
  ad_status: string;
  overall_status: string;
  checklist: AppActivationResult[];
}

export interface LocalPortalAccountResponse {
  status: string;
  message: string;
  username: string;
  full_name: string;
  temporary_password: string;
  role: string;
  is_approved_exception: boolean;
}

export interface UserListItem {
  id: number;
  employee_id: string | null;
  username: string;
  full_name: string;
  email: string | null;
  department: string | null;
  telephone: string | null;
  telegram_id?: string | null;
  is_active_in_ad: boolean;
  last_login_ad_at: string | null;
  created_at?: string | null;
  last_access_at?: string | null;
  days_since_last_access?: number | null;
  connected_apps: AppAccountSummary[];
  has_discrepancy: boolean;
  is_ad_account?: boolean;
  is_approved_exception?: boolean;
  exception_type?: string | null;
  exception_reason?: string | null;
  exception_approved_by?: string | null;
}

export interface AccountLinkPayload {
  target_identity_id: number;
  reason: string;
}

export interface AccountExceptionPayload {
  exception_type: "NAME_MISMATCH" | "SERVICE_ACCOUNT" | "EXTERNAL_VENDOR" | "LEGACY_EXCEPTION" | "OTHER" | string;
  reason: string;
  expires_at?: string | null;
}

export interface AccountActionResponse {
  status: string;
  message: string;
  details?: Record<string, any>;
}



export interface ConnectedApp {
  id: number;
  app_code: string;
  app_name: string;
  connector_type: "REST_API" | "RPA_WORKER" | "SAP_B1" | "AD_PROXY" | "M365" | string;
  base_url: string | null;
  rpa_adapter_name: string | null;
  is_active: boolean;
  health_status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  latency_ms: number | null;
  last_health_check_at: string | null;
  last_sync_at: string | null;
  total_linked_accounts: number;
  client_id?: string | null;
  redirect_uris?: string | null;
  sso_enabled?: boolean;
  spoke_sso_status?: "ACTIVE" | "DISABLED" | "UNKNOWN" | string;
  sap_company_db?: string | null;
  sap_username?: string | null;
  sap_password?: string | null;
  ad_allow_status_patch?: boolean;
  network_policy?: "ANYWHERE" | "VPN_ONLY" | string;
  vpn_restriction_mode?: "HIDE" | "LOCK_WITH_BANNER" | string;
  allowed_network_cidrs?: string | null;
  created_at: string;
}

export interface SyncSchedule {
  enabled: boolean;
  time: string;
  timezone: string;
  last_run_at: string | null;
  last_status: string | null;
  last_summary: string | null;
  next_run_at: string | null;
}

export interface SyncScheduleUpdate {
  enabled?: boolean;
  time?: string;
}

export interface SyncAppResult {
  app_code: string;
  app_name: string;
  success: boolean;
  accounts_synced: number;
  error: string | null;
}

export interface SyncAllResult {
  success: boolean;
  total_apps: number;
  success_count: number;
  fail_count: number;
  summary: string;
  results: SyncAppResult[];
  timestamp: string;
}


export interface AffectedAppInfo {
  application_id: number;
  app_code: string;
  app_name: string;
  connector_type: string;
  app_username: string;
  current_status: string;
  action_to_take: string;
}

export interface OffboardPreview {
  identity_id: number;
  employee_id: string | null;
  username: string;
  full_name: string;
  department: string | null;
  ad_current_status: string;
  affected_applications: AffectedAppInfo[];
  total_apps_affected: number;
}

export interface AppExecutionResult {
  app_code: string;
  app_name: string;
  connector_type: string;
  execution_mode: string;
  status: string;
  message: string;
  http_code: number | null;
  execution_time_ms: number;
}

export interface OffboardExecuteResult {
  certificate_id: string;
  executed_at: string;
  actor_username: string;
  target_username: string;
  target_full_name: string;
  target_employee_id: string | null;
  target_department: string | null;
  reason: string;
  effective_date: string;
  overall_status: string;
  checklist: AppExecutionResult[];
}

export interface AuditLogItem {
  id: number;
  actor_username: string;
  action_type: string;
  target_username: string;
  affected_app_code: string | null;
  previous_status: string | null;
  new_status: string | null;
  execution_mode: string;
  reason: string | null;
  ip_address: string | null;
  status: string;
  details: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
}

// Fetch helper
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("ciam_token") : null;
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("ciam_token");
        localStorage.removeItem("ciam_user");
        const currentPath = window.location.pathname;
        if (
          !currentPath.includes("/login") &&
          !currentPath.includes("/portal/callback") &&
          !currentPath.includes("/oauth/authorize")
        ) {
          window.location.href = `/login?expired=1&redirect=${encodeURIComponent(currentPath + window.location.search)}`;
          return Promise.reject(new Error("เซสชันการใช้งานของคุณหมดอายุแล้ว กำลังนำทางไปหน้าเข้าสู่ระบบ...")) as any;
        }
      }

      const errBody = await res.text();
      let errorMsg = `API Error [${res.status}]: ${errBody}`;
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.detail) {
          errorMsg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err: any) {
    // Avoid noisy console.error that triggers Next.js dev overlays for normal API operational errors
    throw err;
  }
}

export const ciamApi = {
  // Dashboard
  getDashboardSummary: () => fetchApi<DashboardSummary>("/dashboard/summary"),

  // Directory
  getUsers: (params?: { search?: string; status?: string; app_code?: string; has_ghost?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.app_code) query.set("app_code", params.app_code);
    if (params?.has_ghost !== undefined) query.set("has_ghost", String(params.has_ghost));
    const qs = query.toString();
    return fetchApi<UserListItem[]>(`/directory/users${qs ? `?${qs}` : ""}`);
  },

  getUserDetail: (id: number) => fetchApi<{ user: UserListItem; accounts: AppAccountSummary[] }>(`/directory/users/${id}`),

  createUser: (payload: UserCreatePayload) =>
    fetchApi<UserCreateResponse>("/directory/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  activateUser: (userId: number, reason: string) =>
    fetchApi<UserActivateResponse>(`/directory/users/${userId}/activate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Account Linking & Approved Exceptions
  linkAccountToIdentity: (mappingId: number, payload: AccountLinkPayload) =>
    fetchApi<AccountActionResponse>(`/directory/accounts/${mappingId}/link-identity`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  mergeIdentityToTarget: (sourceIdentityId: number, targetIdentityId: number, payload: AccountLinkPayload) =>
    fetchApi<AccountActionResponse>(`/directory/users/${sourceIdentityId}/link-to/${targetIdentityId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  approveAccountException: (mappingId: number, payload: AccountExceptionPayload) =>
    fetchApi<AccountActionResponse>(`/directory/accounts/${mappingId}/exception`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  revokeAccountException: (mappingId: number) =>
    fetchApi<AccountActionResponse>(`/directory/accounts/${mappingId}/exception`, {
      method: "DELETE",
    }),

  approveUserException: (identityId: number, payload: AccountExceptionPayload) =>
    fetchApi<AccountActionResponse>(`/directory/users/${identityId}/exception`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  revokeUserException: (identityId: number) =>
    fetchApi<AccountActionResponse>(`/directory/users/${identityId}/exception`, {
      method: "DELETE",
    }),

  createLocalPortalAccount: (
    identityId: number,
    payload: { password?: string; notes?: string }
  ) =>
    fetchApi<LocalPortalAccountResponse>(`/directory/users/${identityId}/local-account`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),


  // Offboarding
  previewOffboard: (username: string) =>
    fetchApi<OffboardPreview>("/offboarding/preview", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  executeOffboard: (payload: { username: string; effective_date: string; reason: string; notes?: string }) =>
    fetchApi<OffboardExecuteResult>("/offboarding/execute", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Applications
  getApplications: () => fetchApi<ConnectedApp[]>("/applications"),

  registerApplication: (payload: {
    app_code: string;
    app_name: string;
    connector_type: "REST_API" | "RPA_WORKER" | "SAP_B1";
    base_url?: string;
    api_key?: string;
    rpa_adapter_name?: string;
    sap_company_db?: string;
    sap_username?: string;
    sap_password?: string;
    network_policy?: string;
    vpn_restriction_mode?: string;
    allowed_network_cidrs?: string;
  }) =>
    fetchApi<ConnectedApp>("/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getApplicationCredentials: (id: number) =>
    fetchApi<{
      id: number;
      app_code: string;
      app_name: string;
      connector_type: string;
      base_url: string | null;
      api_key: string | null;
      header_name: string;
      client_id?: string | null;
      client_secret?: string | null;
      redirect_uris?: string | null;
      sso_enabled?: boolean;
      sap_company_db?: string | null;
      sap_username?: string | null;
      sap_password?: string | null;
      network_policy?: string | null;
      vpn_restriction_mode?: string | null;
      allowed_network_cidrs?: string | null;
    }>(`/applications/${id}/credentials`),

  updateApplication: (
    id: number,
    payload: {
      app_name?: string;
      connector_type?: string;
      base_url?: string;
      api_key?: string;
      rpa_adapter_name?: string;
      is_active?: boolean;
      client_id?: string;
      client_secret?: string;
      redirect_uris?: string;
      sso_enabled?: boolean;
      sap_company_db?: string;
      sap_username?: string;
      sap_password?: string;
      ad_allow_status_patch?: boolean;
      network_policy?: string;
      vpn_restriction_mode?: string;
      allowed_network_cidrs?: string;
    }
  ) =>
    fetchApi<ConnectedApp>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  pingApplication: (id: number) =>
    fetchApi<{ app_code: string; status: string; latency_ms: number; message: string }>(`/applications/${id}/ping`, {
      method: "POST",
    }),

  getApplicationInventory: (id: number) =>
    fetchApi<{ application_name: string; total_accounts: number; active_accounts: number; accounts: any[]; notice?: string }>(
      `/applications/${id}/inventory`
    ),

  syncApplicationInventory: (id: number) =>
    fetchApi<{ success: boolean; app_code: string; total_accounts_fetched: number; synced_count: number; synced_at: string }>(
      `/applications/${id}/sync`,
      { method: "POST" }
    ),

  syncAllApplications: () =>
    fetchApi<SyncAllResult>("/applications/sync-all", {
      method: "POST",
    }),

  getSyncSchedule: () =>
    fetchApi<SyncSchedule>("/applications/sync-schedule"),

  updateSyncSchedule: (payload: SyncScheduleUpdate) =>
    fetchApi<SyncSchedule>("/applications/sync-schedule", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),


  deleteApplication: (id: number) =>
    fetchApi<{ success: boolean; message: string; deleted_app_code: string; removed_mappings: number }>(
      `/applications/${id}`,
      { method: "DELETE" }
    ),

  // Audit Logs
  getAuditLogs: (params?: { search?: string; action_type?: string; status?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.action_type) query.set("action_type", params.action_type);
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    const qs = query.toString();
    return fetchApi<AuditLogsResponse>(`/audit-logs${qs ? `?${qs}` : ""}`);
  },

  getExportCsvUrl: () => `${API_BASE_URL}/audit-logs/export-csv`,

  // Portal & SSO
  getPortalApps: () => fetchApi<PortalAppItem[]>("/oauth/portal/apps"),

  launchPortalApp: (clientId: string, state?: string, targetRedirectUri?: string) =>
    fetchApi<PortalLaunchResponse>("/oauth/portal/launch", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId, state, target_redirect_uri: targetRedirectUri }),
    }),

  exchangePortalCode: (code: string, redirectUri: string) =>
    fetchApi<PortalExchangeResponse>("/oauth/portal/exchange", {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),

  getAuthorizeMeta: (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...params, format: "json" }).toString();
    return fetchApi<AuthorizeMeta>(`/oauth/authorize?${qs}`);
  },

  submitAuthorizeLogin: (payload: PortalLoginPayload) =>
    fetchApi<PortalLoginResponse>("/oauth/authorize", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitSeamlessAuthorize: (payload: {
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }) =>
    fetchApi<PortalLoginResponse>("/oauth/authorize/seamless", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  loginAdmin: (payload: LoginPayload) =>
    fetchApi<AdminTokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminMe: () => fetchApi<AdminUserOut>("/auth/me"),

  getAdminUsers: () => fetchApi<AdminUserOut[]>("/auth/admins"),

  updateUserRole: (username: string, role: string) =>
    fetchApi<AdminUserOut>(`/auth/admins/${encodeURIComponent(username)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  updateAdminProfile: (payload: {
    full_name?: string;
    email?: string;
    telegram_id?: string;
    new_password?: string;
  }) =>
    fetchApi<AdminUserOut>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getHealthMonitorStatus: () =>
    fetchApi<{
      config: HealthMonitorConfig;
      live_health: LiveHealthSnapshot;
    }>("/dashboard/health-monitor"),

  updateHealthMonitor: (payload: Partial<HealthMonitorConfig>) =>
    fetchApi<{
      status: string;
      message: string;
      config: HealthMonitorConfig;
    }>("/dashboard/health-monitor", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  triggerTestHealthAlert: (payload?: { bot_token?: string; chat_id?: string }) =>
    fetchApi<{
      success: boolean;
      summary: string;
      health: LiveHealthSnapshot;
      recipients_count: number;
      success_deliveries: number;
      errors: string[];
      timestamp: string;
      error?: string;
    }>("/dashboard/health-monitor/test-alert", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
};

export const api = ciamApi;


export interface PortalAppItem {
  id: number;
  app_code: string;
  app_name: string;
  category: string;
  description?: string;
  connector_type: string;
  base_url?: string;
  client_id?: string;
  sso_enabled: boolean;
  spoke_sso_status?: string;
  health_status: string;
  latency_ms?: number;
  launch_url?: string;
  redirect_uris?: string;
  network_policy?: string;
  is_vpn_locked?: boolean;
  vpn_lock_message?: string | null;
}

export interface PortalLaunchResponse {
  status: string;
  app_code: string;
  app_name: string;
  launch_url: string;
  code: string;
  expires_in: number;
}

export interface PortalExchangeResponse {
  status: string;
  app_code: string;
  app_name: string;
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  user_info: {
    sub?: string;
    username?: string;
    full_name?: string;
    email?: string;
    employee_id?: string;
    department?: string;
    roles?: Record<string, string>;
    [key: string]: any;
  };
}

export interface AuthorizeMeta {
  client_id: string;
  app_name: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  status: string;
}

export interface PortalLoginPayload {
  username: string;
  password: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface PortalLoginResponse {
  status: string;
  code: string;
  state?: string;
  redirect_to: string;
  access_token?: string;
  token_type?: string;
  user: {
    username: string;
    full_name: string;
    department?: string;
  };
}

export interface LoginPayload {
  username: string;
  password: string;
  corporate_fax?: string;
  security_honey?: string;
}

export interface AdminUserOut {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  department?: string | null;
  employee_id?: string | null;
  telegram_id?: string | null;
}

export interface AdminTokenResponse {
  access_token: string;
  token_type: string;
  user: AdminUserOut;
}

export interface HealthMonitorConfig {
  enabled: boolean;
  start_time: string;
  interval_hours: number;
  bot_token?: string;
  chat_id?: string;
  notify_admins_enabled: boolean;
  last_run_at?: string | null;
  last_status?: string;
  last_summary?: string | null;
  last_error?: string | null;
  next_run_at?: string | null;
}

export interface LiveHealthSnapshot {
  timestamp_bkk: string;
  all_healthy: boolean;
  database: {
    is_connected: boolean;
    latency_ms: number;
    engine: string;
  };
  ad_sync_agent: {
    is_online: boolean;
    latency_ms: number;
    message: string;
    base_url: string;
  };
  connected_apps: {
    total: number;
    online: number;
    offline: number;
  };
}


