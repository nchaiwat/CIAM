# Central IAM - System Memory & Technical Context (MEMORY.md)
**Last Updated:** 2026-10-01  
**Version:** 1.9.5 (Zero-Trust Network Policy, VPN Access Restriction & Auto-Detection for On-Prem Spokes)  
**Project:** Centralized Identity & Access Governance System (Central IAM)  
**Organization:** Window Asia Public Company Limited  
**Repository Path:** `d:\Python\Central-IAM`  
**Related Documents:** [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md), [PRD.md](file:///d:/Python/Central-IAM/PRD.md), [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md), [SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md), [AD_SYNC_AGENT_API_SPEC.md](file:///d:/Python/Central-IAM/AD_SYNC_AGENT_API_SPEC.md), [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md)

---

## 1. System Topology & Active Network Ports

| Component | Technology | Host / Bind | Active Port | URL / Access | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Frontend Web App** | Next.js 16 (Turbopack) | `0.0.0.0` / `localhost` | **3000** | [http://localhost:3000](http://localhost:3000) | IRM-Style Left Sidebar Layout (Deep Navy `#0b1329` sidebar, White header, Slate-100 canvas, Thai menu) |
| **Backend API Core** | FastAPI + Uvicorn | `0.0.0.0` | **8001** | [http://localhost:8001](http://localhost:8001)<br>Docs: [http://localhost:8001/docs](http://localhost:8001/docs) | **Note:** Port 8000 is occupied by `mtpulse-api-1`. Always use 8001. |
| **Primary Database** | PostgreSQL 16 Alpine | Docker Container `ciam-postgres` | **5435** | `127.0.0.1:5435/central_iam` | Port mapped: `0.0.0.0:5435->5432/tcp` (5432 is occupied by `mtpulse-db-1`) |
| **Active Directory Agent** | Windows Domain Controller | Internal Network | **3100** | `http://172.18.0.1:3100` | Gateway for AD user verification & deprovisioning |

---

## 2. Connected Spoke Applications & Security Keys

### 2.1 IRM (Incoming Raw Material) — LIVE CONNECTED (Hostinger VPS)
* **Production Domain:** `https://irm.windowasia.com`
* **Connector Type:** `REST_API` (using [rest_api.py](file:///d:/Python/Central-IAM/backend/app/connectors/rest_api.py))
* **M2M Secret API Key (`X-Management-API-Key`):** `sec_irm_mgmt_9a4f21e8d3b76c501e4a`
* **OIDC Client ID:** `irm-spoke-client`
* **OIDC Client Secret:** `sec_irm_oauth_secret_2026`
* **Allowed Callback URIs:** `http://localhost:3000/portal/callback, http://localhost:3001/auth/callback, https://irm.windowasia.com/auth/callback`
* **System Setting Category:** `central_iam` (replaces static `.env` on spoke applications per [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md))
* **IP Whitelist in IRM Server:** `49.231.185.245, 58.8.190.63`
  * *Important Note:* The current machine public dynamic IP is `58.8.188.214`. To ensure live M2M API calls from this machine always succeed, add `58.8.188.214` to the IP Whitelist field in IRM Settings (or leave it blank to allow all IPs).
* **Endpoints:**
  * `GET /api/v1/directory/accounts` (Returns account inventory with `status`, `department`, `search`)
  * `PATCH /api/v1/directory/accounts/{username}/status` (Updates user active status)
* **Live Synced Accounts (6 Users):**
  1. `admin` (System Administrator) - Admin
  2. `Patcha.S` (Patcha Suksawas) - PU User
  3. `Pinyada.S` (Pinyada Rungrattanaporn) - PU User
  4. `Chaiwat.N` (Chaiwat Nilawan) - PU User
  5. `Apichai.P` (Apichai Parimanara) - PU User
  6. `Hermes.N` (Hermess Nilawan) - WH User
* **Health Status:** `ONLINE` (Latency: ~830 - 1050 ms)

### 2.2 QMS (Quality Management System)
* **Base URL:** `https://qms.windowasia.com`
* **Connector Type:** `REST_API`
* **M2M Secret API Key:** `sec_qms_mgmt_f49b10398dc3a011ef`
* **Health Status:** `ONLINE` (Prepared for production M2M cutover)

### 2.3 SAP Business One (ERP) — LIVE SERVICE LAYER
* **Production Domain:** `https://sapb1.waapps.net`
* **Connector Type:** `SAP_B1` (using [sap_b1.py](file:///d:/Python/Central-IAM/backend/app/connectors/sap_b1.py))
* **Engine:** SAP B1 Service Layer REST API (`/b1s/v2`)
* **Session & Cookie Standard:** Natural `requests.Session` cookie lifecycle matching production script `POS2Invoice` (retains `B1SESSION` and `ROUTEID` without cookie jar corruption or duplicate headers).
* **Authorization Header Cascade:** Sends `Authorization` header (`Bearer {session_id}`, `Bearer {api_key}`, `Basic {base64}`, and pure Cookie) to satisfy Service Layer reverse proxy / gateway checks and resolve `HTTP 401 code 300 Authorization header not found`.
* **Superuser & Employee Fallback:** Automatic fallback from `/b1s/v2/Users` (requires Superuser) to `/b1s/v2/EmployeesInfo` (`OHEM` general HR staff table).
* **Isolation Rule:** Strict Spoke Isolation — never mix MasterIdentity or AD accounts into SAP B1 user lists.

### 2.4 Microsoft 365 (Entra ID & Exchange Mailbox) — LIVE CONNECTED
* **API Engine:** Microsoft Graph API (`https://graph.microsoft.com/v1.0`)
* **Connector Type:** `M365` (using [m365_graph.py](file:///d:/Python/Central-IAM/backend/app/connectors/m365_graph.py))
* **Tenant ID:** `3bf476e6-c0a4-4e60-9692-f9a20c16c12b`
* **Client ID:** `1d78dd68-7e09-4daa-8eac-de6331716980`
* **Live Synced Accounts:** 67 Active accounts (including `Chaiwat.N`)
* **Execution Mode:** `SAFE_READ_ONLY` (Audit and monitoring only, bypasses destructive cloud mailbox purge)
* **Health Status:** `ONLINE` (Latency: ~1,400 ms)

### 2.5 pfSense 2.7.2-RELEASE (FreeBSD 14.0-CURRENT) — FIREWALL & OPENVPN
* **Architecture Mode:** Dual-integration:
  1. **Native AD/LDAPS Auth Server:** Direct link to `172.18.0.1` (Ports 389/636) for WebGUI and OpenVPN authentication.
  2. **REST API Spoke Connector:** Community package `pfSense-API` (by Jared Hendrickson) installed via FreeBSD `pkg-static`.
* **Installation Command:**
  `fetch -o + https://github.com/jaredhendrickson13/pfsense-api/releases/latest/download/pfSense-2.7.2-pkg-RESTAPI.txz && pkg-static install -y pfSense-2.7.2-pkg-RESTAPI.txz && rm pfSense-2.7.2-pkg-RESTAPI.txz`
* **Key Endpoints:** `GET /api/v1/user`, `PATCH /api/v1/user` (enable/disable), `GET /api/v1/services/openvpn`
* **Primary Role in CIAM:** 1-Click Offboarding (immediate VPN revocation & account disable) and Ghost VPN Account detection.

---

## 3. Database Credentials & Environment Configuration

### Central IAM Backend (`.env`)
```ini
PROJECT_NAME="Central IAM"
ENVIRONMENT="development"
DEBUG=True

# Database Configuration (Docker container ciam-postgres on port 5435)
POSTGRES_USER=ciam_admin
POSTGRES_PASSWORD=ciam_secure_pass_2026
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5435
POSTGRES_DB=central_iam
DATABASE_URL=postgresql+psycopg://ciam_admin:ciam_secure_pass_2026@127.0.0.1:5435/central_iam

# Fallback SQLite DB
SQLITE_DB_URL=sqlite:///./central_iam.db

# Security & JWT
SECRET_KEY=central_iam_super_secret_jwt_key_2026_change_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Active Directory Gateway
AD_GATEWAY_URL=http://172.18.0.1:3100
AD_SYNC_ENABLED=False

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### Default Super Admin Credentials
* **Username:** `admin`
* **Password:** `admin123`
* **Full Name:** System Administrator (ผู้ดูแลระบบความปลอดภัย IT)
* **Role:** `SUPER_ADMIN`

---

## 4. Key Business Logic & Code Architecture

### 4.1 Frontend Layout Architecture (IRM-Style Shell)
* **[AppShell.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/AppShell.tsx):** Root client wrapper hosting the responsive state (`collapsed`, `mobileOpen`)
* **[Sidebar.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/Sidebar.tsx):** Left navigation panel (`#0b1329`) with active routes, danger action pills, and AD gateway indicator
* **[Header.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/Header.tsx):** Clean white top bar with breadcrumb title, user avatar/status badge, toggle controls, and logout

### 4.2 Application Secret Key Management & Endpoints
* **`PATCH /api/v1/applications/{app_id}`:** Allows updating base URL, connector type, active state, and rotated secret API key. Generates audit records in `IamAuditLog`.
* **`GET /api/v1/applications/{app_id}/credentials`:** Returns full API key and header name `X-Management-API-Key` for administrators.
* **Frontend UI ([applications/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)):** Includes automated secret generator, copy-to-clipboard, eye reveal toggle, and cURL snippets.

### 4.3 Modular Connector Layer ([factory.py](file:///d:/Python/Central-IAM/backend/app/connectors/factory.py))
* Checks `app.connector_type`:
  * If `REST_API`: Instantiates `RestApiConnector(app_code, base_url, api_key)` (supports GET, PATCH status, POST accounts)
  * If `SAP_B1` or `SAP_SERVICE_LAYER`: Instantiates `SapB1Connector(base_url, api_key)` (OData REST Service Layer)
  * If `AD_PROXY` or `AD_GATEWAY`: Instantiates `AdProxyConnector(base_url, api_key)` (communicates with internal AD Sync Agent on port 3100)
  * If `RPA_WORKER`: Instantiates `MockLegacyErpRpaAdapter()` or registered RPA bot adapter

### 4.4 Spec-Compliant Status Provisioning & Account Creation
* According to `CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md`:
  * `PATCH /api/v1/directory/accounts/{username}/status`: Enable/Disable account status
  * `POST /api/v1/directory/accounts`: Provision new user account across child systems
  * `GET /api/v1/directory/accounts`: Reconciliation & inventory sync

### 4.5 Multi-System Provisioning & Re-activation
* Provisioning Orchestrator ([provisioning.py](file:///d:/Python/Central-IAM/backend/app/services/provisioning.py)): Creates `MasterIdentity`, provisions into AD Proxy, and dispatches account creation to selected applications with role assignment.
* Re-activation Orchestrator ([deprovisioning.py](file:///d:/Python/Central-IAM/backend/app/services/deprovisioning.py)): Re-enables identity in AD Proxy and across all linked spoke applications in one click.

### 4.6 Ghost Account (Discrepancy) Detection Rule ([reconciliation.py](file:///d:/Python/Central-IAM/backend/app/services/reconciliation.py))
* Rule: If `MasterIdentity.is_active_in_ad == False` AND `AppAccountMapping.is_active_in_app == True`.
* Flagged automatically in database as `last_sync_status = "DISCREPANCY"` and alerted on the Dashboard KPI.

### 4.7 Instant Offboarding Orchestrator ([deprovisioning.py](file:///d:/Python/Central-IAM/backend/app/services/deprovisioning.py))
1. Disables user in AD via `AdProxyConnector`
2. Iterates across all `AppAccountMapping` for the target identity
3. Invokes `connector.deprovision()` across spokes in parallel (REST PATCH, SAP B1 Locked, RPA)
4. Generates certificate code: `CERT-YYYYMMDD-XXXXXX`
5. Records immutable audit trails in `IamAuditLog`

### 4.8 Dual Login Architecture & Minimal Employee Portal (Version 1.9.3)
* **Separated Login Routes:**
  * **Employee Portal Login (`/login`):** Dedicated, welcoming, and clean corporate login interface for general employees. Uses standard Windows/AD credentials and directs users to `/portal`.
  * **Admin Console Login (`/admin/login`):** Dedicated high-security console for IT Administrators and security officers with honeypot decoys, legal notices, and lockout protection.
* **Role-Based Guards ([AppShell.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/AppShell.tsx)):**
  * Prevents regular employees (`role: PORTAL_USER`) from accessing administrative management views (`/`, `/directory`, `/applications`, `/offboarding`, `/audit-logs`), redirecting them smoothly to `/portal`.
  * Enforces token authentication before viewing `/portal`.
* **Minimalist & Clean App Launcher ([portal/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
  * Stripped of all technical clutter (no latency ms, no raw connector types, no client-ids, no simulator menus).
  * Prominent, high-contrast, responsive app cards with 1-Click Launch.
* **Strict Authorize-based App Filtering ([oauth.py](file:///d:/Python/Central-IAM/backend/app/api/v1/oauth.py)):**
  * `GET /api/v1/oauth/portal/apps`: Queries `AppAccountMapping` for the logged-in user and returns **only** active authorized applications (unauthorized apps are completely hidden). Admins view all active SSO apps.
  * `POST /api/v1/oauth/portal/launch`: Enforces authorization check on launch and issues SSO token under the employee's genuine username instead of static admin.

---

## 5. Critical Developer Gotchas & Troubleshooting

1. **Port 8000 Conflict:**
   * Another service (`mtpulse-api-1`) listens on port 8000. Do not bind Central IAM backend to 8000; keep it on **Port 8001**.
   * Frontend `src/lib/api.ts` defaults to `http://127.0.0.1:8001/api/v1`.
2. **Accessing `localhost` without port:**
   * Browsers default `localhost` to Port 80. If users type `localhost`, explain they need `http://localhost:3000` unless running `npm run dev:80`.
3. **Database Unique Constraint:**
   * Table `app_account_mappings` has a unique constraint: `UNIQUE(application_id, app_username)`. Always query or match by `application_id` and `app_username` before inserting to prevent unique violation errors.
4. **FastAPI Test Suite:**
   * Pytest requires pythonpath configured in `backend/pyproject.toml` (`[tool.pytest.ini_options] pythonpath = ["."]`).
5. **Next.js Build Lock:**
   * Avoid running `npm run build` simultaneously while `npm run dev` is active to prevent lock conflicts on `.next`. Use `npx tsc --noEmit` to verify type integrity during development.

---

## 6. SSO IdP & Break-Glass Architecture Context (Version 1.9.4 Enterprise Standard)
* **Single Sign-On (SSO):** Standard OpenID Connect (OIDC) / OAuth 2.0 with PKCE (RFC 7636).
* **Token Standard:** Asymmetric RS256 JWT Signed by CIAM Private Key; spokes verify via `/.well-known/jwks.json` Public Key.
* **Authorization Code:** One-time use, 60s TTL, exchanged backend-to-backend.
* **Spoke SDK:** [ciam_sso_client.py](file:///d:/Python/Central-IAM/backend/app/sdk/ciam_sso_client.py) with built-in JWKS caching and Circuit Breaker health checks.
* **Pilot Integration (IRM):** IRM backend deployed with [sso.py](file:///D:/Python/IRM/backend/app/routers/sso.py) router and Next.js frontend with SSO Login button and callback route.
* **Standard Step 0 Guard in Spoke Callback (MANDATORY FOR ALL SPOKES):**
  - When SSO is disabled on the Spoke (`ciam_sso_enabled = false` or `ciam_break_glass_active = true`), the callback endpoint `/api/auth/sso/callback` **MUST reject** incoming authorization codes with `HTTP 503 Service Unavailable` before calling CIAM `/token`.
  - Prevents users from bypassing local Spoke SSO lockout by launching from CIAM Portal.
* **Bi-directional Health Probing & Status Sync:**
  - `RestApiConnector.health_check()` probes both `/api/health` (or `/api/v1/health`) and `GET /api/auth/sso/config` on the spoke.
  - Detects if Spoke has disabled SSO locally and updates `connected_applications.spoke_sso_status` (`ACTIVE`, `DISABLED`, `BREAK_GLASS`, `UNAVAILABLE`).
  - `/applications` UI displays real-time badges:
    - `✕ Disabled (ปิด SSO)` (CIAM disabled)
    - `⚠️ Spoke ปิด SSO (Break-Glass)` (Spoke disabled or emergency mode)
    - `✓ SSO Active` (Both sides active)
* **Portal Safety Shields (`/portal`):**
  - If a spoke application is `OFFLINE` (e.g. QMS server down), the portal displays a red badge `🔴 ออฟไลน์` and disables the launch button: `ระบบปิดปรับปรุงชั่วคราว (Offline)`.
  - If a spoke application has disabled SSO or is in break-glass, the portal displays `🔒 Break-Glass` and disables the launch button: `ระบบปิดรับ SSO ชั่วคราว`.
  - Backend guard in `/api/v1/oauth/portal/launch` blocks requests with HTTP 503 if the app is offline or in break-glass mode.
* **Break-Glass Fallback Plan (Emergency Outage):**
  1. Spoke apps maintain local break-glass admin route (`/login?mode=breakglass`) or local fallback credentials in local DB.
  2. Spoke admin toggle: `SSO Enforcement [ON/OFF]` via `/api/auth/sso/break-glass-toggle` or system settings.
  3. Dynamic Failover: Spoke apps can fallback directly to AD Gateway (`http://172.18.0.1:3100/api/v2/login` per `ADAuthen.md`) if CIAM health check fails.
  4. Real-time Telegram/LINE alert triggered on break-glass activation.

---

## 7. VPS Deployment Commands & Docker Service Names

> [!IMPORTANT]
> **CRITICAL RULE FOR AGENT:**
> Service names in `docker-compose.yml` are:
> - Backend: **`api`**
> - Frontend: **`web`** (⚠️ NEVER use `frontend`! The service is named `web`)
> - Database: **`postgres`**
>
> **The EXACT deployment commands on VPS (`/var/www/Ciam`):**
> **กฏเหล็ก:** ต้องเขียนแยกทีละบรรทัด ห้ามต่อด้วย `&&` ยาวเป็นพรืด และต้องมี `git pull` เสมอ:
> ```bash
> cd /var/www/Ciam
> git pull
> docker compose build api web
> docker compose up -d api web
> ```
> - กรณีอัปเดต **Backend อย่างเดียว**:
> ```bash
> cd /var/www/Ciam
> git pull
> docker compose build api
> docker compose up -d api
> ```
> - กรณีอัปเดต **Frontend อย่างเดียว**:
> ```bash
> cd /var/www/Ciam
> git pull
> docker compose build web
> docker compose up -d web
> ```

---

## 8. Admin User Profile & Telegram Health Monitor Schedule

### 8.1 Admin User Profile & Telegram ID (`central_iam_admins`)
* **Database Schema:** `central_iam_admins` contains column `telegram_id VARCHAR(100)` (Telegram username `@username` or numeric Chat ID `123456789`).
* **Auto-Migration:** `initial_data.py` automatically runs `ALTER TABLE central_iam_admins ADD COLUMN telegram_id VARCHAR(100);` if not present.
* **APIs:**
  * `GET /api/v1/auth/me`: Returns profile of logged-in admin (includes `telegram_id`).
  * `PUT /api/v1/auth/profile`: Updates `full_name`, `email`, `telegram_id`, and `new_password` for the active admin, syncing with `MasterIdentity` if present.
  * `GET /api/v1/auth/admins`: Lists all system admins with their `telegram_id`.

### 8.2 System Health & AD Sync Agent Periodic Telegram Alert
* **Monitored Services:**
  1. **Central IAM Engine & PostgreSQL Database:** Real-time query execution & latency (ms).
  2. **Active Directory Sync Agent (Gateway):** Dual probe to `http://172.18.0.1:3100` (`/health` and `/api/v2/login`), checking port 3100 connectivity, DC `wa.net` status, and latency (ms).
  3. **Connected Spoke Applications:** Counts active & online applications.
* **Configurable Schedule (`SystemSetting: health_monitor_schedule`):**
  * `enabled`: boolean toggle.
  * `start_time`: Time string in Bangkok timezone (e.g. `08:00`).
  * `interval_hours`: Frequency dropdown (`1`, `2`, `4`, `6`, `8`, `12`, `24` hours).
  * `bot_token`: Telegram Bot API Token.
  * `chat_id`: Telegram Channel / Group / Admin Chat ID.
  * `notify_admins_enabled`: Automatically distributes alert to all active admins with configured `telegram_id`.
* **Scheduler Engine:** `app/services/scheduler.py` checks target interval every minute and triggers `send_health_report(db, triggered_by="AUTO_SCHEDULED")`.
* **Manual Immediate Testing:** `POST /api/v1/dashboard/health-monitor/test-alert` allows instant test delivery to verify Bot credentials and Telegram connectivity.
* **UI Component:** `frontend/src/components/profile/AdminProfileModal.tsx` accessible via:
  1. Clicking User Profile Card in the Header (`Header.tsx`).
  2. Clicking "🔔 แจ้งเตือน Telegram & AD Agent" in the main Dashboard action bar (`app/page.tsx`).

---

## 9. Zero-Trust Network Policy & VPN Access Restriction (Version 1.9.5)

### 9.1 Background & Problem Solved
* On-premise applications (e.g. SAP B1 Client, local warehouse WMS, internal factory systems) sit inside Window Asia's local network without inbound public internet tunnels.
* When remote employees not connected to OpenVPN accessed the Employee Portal (`/portal`), launching these applications caused browser timeouts or connection errors.

### 9.2 Architecture & Components
1. **Dynamic Client IP Extraction ([network_service.py](file:///d:/Python/Central-IAM/backend/app/services/network_service.py)):**
   - Resolves real client IP using `X-Forwarded-For` (first IP), `X-Real-IP`, or fallback to `client.host`.
2. **Corporate Network CIDRs (`corporate_vpn_networks` in `system_settings`):**
   - **HQ Gateway Public WAN (VPN Egress):** `49.231.185.245/32`, `58.8.190.63/32`
   - **Internal Subnets:** `10.8.0.0/24` (OpenVPN Clients), `192.168.0.0/16` (Office LAN), `172.18.0.0/16` (Docker Network), `127.0.0.1/32`, `::1/128`
3. **Application Attributes ([application.py](file:///d:/Python/Central-IAM/backend/app/models/application.py)):**
   - `network_policy`: `ANYWHERE` (public cloud) vs `VPN_ONLY` (on-prem/LAN).
   - `vpn_restriction_mode`: `HIDE` (completely hidden from Employee Portal) vs `LOCK_WITH_BANNER` (rendered with `[🔒 ต้องต่อ VPN]` badge and disabled launch button `กรุณาเชื่อมต่อ VPN ก่อนเข้าใช้งาน`).
   - `allowed_network_cidrs`: Optional custom CIDRs per application; falls back to corporate VPN networks if null.
4. **Backend Security Guard ([oauth.py](file:///d:/Python/Central-IAM/backend/app/api/v1/oauth.py)):**
   - `POST /api/v1/oauth/portal/launch`: Enforces IP authorization, strictly rejecting unauthorized remote IPs with `HTTP 403 Forbidden`.
   - `GET /api/v1/oauth/portal/apps`: Applies `HIDE` or `LOCK_WITH_BANNER` based on the requester's client IP.
5. **Database Auto-Migration ([initial_data.py](file:///d:/Python/Central-IAM/backend/app/initial_data.py)):**
   - Automatically executes non-destructive `ALTER TABLE connected_applications ADD COLUMN IF NOT EXISTS ...` on startup.



