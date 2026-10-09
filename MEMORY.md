# Central IAM - System Memory & Technical Context (MEMORY.md)
**Last Updated:** 2026-10-07  
**Version:** 2.0.0 (Responsive Spoke Login Standard: Mobile-Familiar 100% & Desktop-Flexible Compact SSO)  
**Project:** Centralized Identity & Access Governance System (Central IAM)  
**Organization:** Window Asia Public Company Limited  
**Repository Path:** `d:\Python\Central-IAM`  
**Related Documents:** [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md), [PRD.md](file:///d:/Python/Central-IAM/PRD.md), [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md), [SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md), [AD_SYNC_AGENT_API_SPEC.md](file:///d:/Python/Central-IAM/AD_SYNC_AGENT_API_SPEC.md), [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md)

---

## 0. กฎเหล็กและข้อบังคับในการทำงานของ AI Agent (Critical Operational Protocols)

> [!CAUTION]
> **AI Agent ทุกตัวที่เข้ามารับช่วงต่อในโปรเจกต์นี้ ต้องปฏิบัติตามกฎเหล็กต่อไปนี้ 100% โดยไม่มีข้อยกเว้น และห้ามรอให้ผู้ใช้ต้องคอยทวงถาม:**

### 0.1 กฎการเริ่มต้นบทสนทนา (Session Startup Protocol)
เมื่อเริ่มรอบงานใหม่หรือเริ่มแชทใหม่ AI Agent **ต้องอ่านและทำความเข้าใจไฟล์บริบท 3 ไฟล์นี้โดยอัตโนมัติทันที** ก่อนเริ่มตอบคำถามหรือลงมือเขียนโค้ด:
1. [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md) — ระบบเน็ตเวิร์ก พอร์ต คีย์เชื่อมต่อ และกฎเกณฑ์ความปลอดภัย
2. [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md) — สถานะความคืบหน้าล่าสุด Git Commits และ Roadmap งานที่จะทำต่อ
3. [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) — สเปกการเชื่อมต่อ Mode A, Mode B, Mode C

### 0.2 กฎการส่งมอบและ Deploy โค้ด (Post-Modification & Deployment Protocol)
เมื่อมีการเพิ่มฟีเจอร์หรือแก้ไขบั๊กเสร็จสิ้นในแต่ละรอบ:
1. **ตรวจสอบความถูกต้อง (Verification):**
   - Backend: รัน `.venv\Scripts\pytest.exe` (ต้องผ่าน 100%)
   - Frontend: รัน `npx tsc --noEmit` (ต้องได้ 0 errors)
2. **Git Commit & Push:**
   - ทำ `git add` และ `git commit` ด้วยข้อความ Conventional Commits
   - อัปเดตบันทึกใน [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md) และ [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md)
   - รัน `git push origin main` เสมอ
3. **สรุปคำสั่ง Deploy บน VPS ตามกฎเหล็ก (Critical VPS Deployment Rules):**
   - **กฎข้อ 1:** ชื่อ Service ของ Frontend ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด) และ Backend คือ **`api`**
   - **กฎข้อ 2:** **ต้องเขียนคำสั่งแยกทีละบรรทัด ห้ามต่อด้วย `&&` ยาวเป็นพรืด**
   - **กฎข้อ 3:** ต้องมี `git pull` นำหน้าเสมอ
   - **กฎข้อ 4:** หากมีการแก้ไขระบบลูก (เช่น IRM): ต้องแสดงคำสั่ง Deploy ของระบบลูกคู่กันไปด้วยเสมอ

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
* **Installation Command (pfSense 2.7.2):**
  `pkg-static -C /dev/null add https://github.com/pfrest/pfSense-pkg-RESTAPI/releases/download/v2.4.3/pfSense-2.7.2-pkg-RESTAPI.pkg`
  *(Note: v2.4.3 is the latest release specifically built for pfSense 2.7.2; latest v2.10+ targets 2.8+)*
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

### 6.1 Enterprise Spoke Specification Standard (Version 2.6.0)
* **RFC 9700 Seamless SSO Initiation Bounce:**
  - กำหนดให้การ์ดใน Central IAM Portal ชี้ไปยัง SSO Start Endpoint ของระบบลูก (เช่น `/auth/start`)
  - เบราว์เซอร์ของผู้ใช้เริ่ม SSO ในระบบลูก -> ระบบลูกสร้าง PKCE และ State ผูกกับเบราว์เซอร์ 100% -> Redirect ไปยัง CIAM `/oauth/authorize`
  - CIAM มี Active Session Cookie บนเบราว์เซอร์อยู่แล้ว จึงทำ **Auto-Approval (Zero-Prompt)** ให้อัตโนมัติใน <400ms และ Redirect กลับ Callback ของระบบลูก
  - ป้องกัน CSRF / Login Injection ตาม RFC 9700 §4.7 โดยผู้ใช้ยังคงได้ประสบการณ์ Seamless Single-Click เสมือนเดิม
* **Architecture Equivalence Principles (ความยืดหยุ่นเชิงสถาปัตยกรรม):**
  - ไม่บังคับให้ระบบลูกแก้โค้ดให้เหมือนตัวอย่างทุกบรรทัด หากระบบลูกมีสถาปัตยกรรมภายในที่บรรลุมาตรฐานความปลอดภัยเทียบเท่า
  - รองรับ Backend PKCE Storage (Session / DB), การใช้ HttpOnly Session Cookie แทน JavaScript Tokens, การ Query DB ต่อ Request, และการผูกตัวตนด้วย `sub` หรือ `preferred_username`
* **Mode C Outbound Sync & Command Queue Protocol:**
  - ระบบ On-Premise (Mode C เช่น MTPulse) ไม่ต้องเปิดพอร์ต Inbound และไม่ต้องเปิด API หมวด C
  - การสั่ง Sync สดจาก CIAM หรือรอบ 04:00 น. Reconciliation จะสร้างคำสั่ง `REQUEST_FULL_SYNC` เข้า Command Queue
  - เมื่อ Agent ยิง Heartbeat เข้ามาจะดึงคำสั่งไปส่งข้อมูล Full Sync ในรอบถัดไป
* **Asynchronous Deprovisioning Lifecycle & Local Admin Protection:**
  - สถานะคำสั่ง: `PENDING` ➔ `SENT` ➔ `COMPLETED` / `FAILED`
  - รองรับการปฏิเสธคำสั่ง `DISABLE_USER` (ตอบกลับ `FAILED`) สำหรับบัญชีผู้ดูแลระบบฉุกเฉิน (Emergency Local Admin) หรือ Admin คนสุดท้าย

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

### 9.3 Spoke Developer Specifications & Documentation Standards (v2.3.0)
* **[SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) (v2.3.0):**
  - Downloaded via button `📥 สเปกเชื่อมต่อ (.md)` on `/applications`.
  - Defines **Mode A (Full Two-Way Integration)** for cloud spokes with inbound webhooks vs **Mode B (SSO-Only Client Mode)** for isolated on-premise spokes (no inbound ports required; only Outbound HTTPS 443 to CIAM).
  - Documents corporate VPN/Office CIDRs (`49.231.185.245`, `58.8.190.63`, `10.8.0.0/24`, `192.168.0.0/16`) for spoke-side firewall/reverse-proxy whitelisting.
* **[SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md):**
  - Documents internal LAN redirect URIs (e.g. `http://wms.wa.local/auth/callback`), Network Policy configuration steps, and off-VPN HTTP 403 handling.
* **Interactive Developer Guide Modal (`frontend/src/app/applications/page.tsx`):**
  - Opened via button `📋 คู่มือสำหรับ Dev`.
  - Displays prominent Zero-Trust On-Premise vs Cloud topology card and corporate VPN network whitelist directly within the administrative UI.

---

## 10. On-Premise SSO Client Mode (`SSO_ONLY` Connector) (Version 1.9.6)

### 10.1 Background & Problem Solved
* On-premise spoke systems (e.g. MTPulse, WMS, Factory ERP) run inside private subnets without inbound public ports or tunnels from Cloud VPS.
* When registered as `REST_API`, Cloud CIAM attempted to HTTP GET the internal private base URL (e.g. `https://wa-mtpulse.wa...`). This network failure caused:
  1. Health status to flip to `🔴 ออฟไลน์`.
  2. Spoke SSO status to flip to `⚠️ Spoke ปิด SSO (Break-Glass)`.
  3. The Employee Portal launch button to become disabled (`ระบบปิดปรับปรุงชั่วคราว (Offline)`).
* In reality, Mode B SSO does NOT require Cloud-to-On-Prem inbound connectivity. All authentication occurs via user browser redirect and spoke outbound token verification.

### 10.2 Technical Implementation
1. **Dedicated Connector ([sso_only.py](file:///d:/Python/Central-IAM/backend/app/connectors/sso_only.py)):**
   - Implements `SsoOnlyConnector`.
   - `health_check()`: Always reports `ONLINE` (`latency_ms=1`, `spoke_sso_active=True`, message: `"SSO Client Mode Active (พร้อมรับการล็อกอินผ่านเบราว์เซอร์และ VPN)"`).
   - `sync_inventory()`: Reports that accounts are provisioned Just-In-Time (JIT) upon SSO login.
   - `deprovision()` & `set_account_status()`: Centrally revokes CIAM session/access for the user.
2. **Connector Factory & Auto-Activation ([factory.py](file:///d:/Python/Central-IAM/backend/app/connectors/factory.py), [applications.py](file:///d:/Python/Central-IAM/backend/app/api/v1/applications.py)):**
   - Automatically activates and sets `health_status="ONLINE"`, `spoke_sso_status="ACTIVE"` when registered or updated with `connector_type="SSO_ONLY"`.
3. **Portal Launch & Guardrails ([oauth.py](file:///d:/Python/Central-IAM/backend/app/api/v1/oauth.py), [page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
   - Bypasses offline/break-glass launch block for `SSO_ONLY` / `SSO_CLIENT` connectors.
   - Portal displays `[MTPULSE]` with unlocked active button `เข้าใช้งานระบบ ↗`.
4. **Admin UI ([page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)):**
   - Adds `SSO_ONLY (โหมดลูกข่าย On-Premise / ขาออกอย่างเดียว)` option to both Create and Edit Application modals.
   - Renders `SSO_CLIENT` badge, `✓ SSO Active (Client Mode)`, and `🟢 ออนไลน์ (Client Mode)`.

---

## 11. Reverse Heartbeat & Outbound Agent Architecture for Mode C (Version 1.9.7)

### 11.1 Problem & Motivation
* สำหรับระบบ On-Premise (เช่น MTPulse, WMS, SAP B1 Local) ที่ต้องการการควบคุมบัญชีสองทาง (Two-Way):
  1. ส่ง Inventory บัญชีขึ้นมาให้ CIAM ตรวจนับและกวาดบัญชีผี (Ghost Accounts)
  2. รับคำสั่ง 1-Click Offboarding (`DISABLE_USER`) และ Reactivate (`ENABLE_USER`) จาก CIAM ไปตัดสิทธิ์บน Database ของตนเอง
* แต่เซิร์ฟเวอร์ On-Premise **ไม่สามารถเปิด Inbound Port หรือ Public IP** จากอินเทอร์เน็ตเข้ามาได้ (Security Policy ภายในองค์กร)

### 11.2 Architecture Solution (Reverse Heartbeat & Pull Pattern)
แทนที่จะให้ Cloud CIAM ยิง Inbound Webhook เข้าไปหา On-Premise เราเปลี่ยนทิศทางการเชื่อมต่อให้ระบบ On-Premise เป็นฝ่ายยิง Outbound HTTPS (Port 443) ออกมาหา CIAM:
1. **Outbound Reverse Heartbeat:** Agent ของ Spoke ยิงมาที่ `POST /api/v1/agent/heartbeat` ทุก 30–60 วินาที
2. **Directory Inventory Sync:** สามารถแนบ `sync_type: "FULL_SYNC"` พร้อมรายชื่อบัญชีเพื่ออัปเดตสถิติและ Master Directory อัตโนมัติ
3. **Pull Command Queue:** CIAM มีตาราง `spoke_pending_commands` เมื่อ Admin สั่ง Disable/Enable บนหน้าจอ CIAM คำสั่งจะถูกบันทึกเป็น `PENDING` และถูกส่งกลับไปใน Response ของรอบ Heartbeat ถัดไป เพื่อให้ Spoke นำไปประมวลผลบน DB ตนเอง
4. **Command Execution Feedback:** ในรอบ Heartbeat ถัดมา Spoke ส่ง `command_results: [{"command_id": "...", "status": "COMPLETED"}]` กลับมา CIAM จะอัปเดตสถานะคำสั่งและบันทึก IamAuditLog ทันที
5. **Dead Man's Switch (5-Minute Rule):** หาก CIAM ไม่ได้รับ Heartbeat จาก Spoke เกิน 5 นาที ระบบจะตัดสถานะเป็น `health_status="OFFLINE"` อัตโนมัติ

### 11.3 Key Source Files & Endpoints
* **Database Model ([application.py](file:///d:/Python/Central-IAM/backend/app/models/application.py)):**
  - `SpokePendingCommand`: `command_id`, `app_code`, `action`, `username`, `reason`, `status` (`PENDING`, `SENT`, `COMPLETED`, `FAILED`), `issued_by`, `created_at`, `executed_at`, `result_message`.
* **API Router ([agent.py](file:///d:/Python/Central-IAM/backend/app/api/v1/agent.py)):**
  - `POST /api/v1/agent/heartbeat`
  - Authentication: `X-Spoke-Client-ID` และ `X-Spoke-API-Key`
  - Schema: `AgentHeartbeatRequest` (`timestamp`, `agent_version`, `sync_type`, `accounts`, `command_results`)
  - Response: `AgentHeartbeatResponse` (`status="ACK"`, `server_time`, `commands_dispatched: [...]`, `accounts_synced`)
* **Connector Integration ([sso_only.py](file:///d:/Python/Central-IAM/backend/app/connectors/sso_only.py)):**
  - เมธอด `set_account_status()` และ `deprovision()` ของ `SsoOnlyConnector` ถูกอัปเกรดให้สร้างคำสั่ง `SpokePendingCommand` (`DISABLE_USER` / `ENABLE_USER`) ลงตารางทันที เพื่อรอให้ Spoke Agent เข้ามาดึงไปรันในเครื่อง On-Premise
* **Developer Specifications & Agent Script:**
  - [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) หมวด D บันทึกสเปกฉบับเต็ม, JSON Schemas, ตัวอย่างสคริปต์ `ciam_agent.py` ที่พร้อม Copy ไปรันได้ทันที, พร้อมคู่มือ Systemd Service, Linux Crontab, และ Windows Task Scheduler

---

## 12. Same-Tab Portal Launch & Spoke Portal Switcher Architecture (Version 1.9.8)

### 12.1 Problem Solved
* เดิมการเปิดแอปจาก Employee Portal (`/portal`) ใช้ `window.open(..., "_blank")` ส่งผลให้เบราว์เซอร์เปิด Chrome แท็บใหม่ทุกครั้ง หากพนักงานเปิดหลายครั้งหรือสลับหลายระบบ แท็บจะสะสมนับสิบแท็บ กินหน่วยความจำ RAM และทำให้เครื่องคอมพิวเตอร์ของพนักงานทำงานช้าลง

### 12.2 Technical Solution
1. **Central-IAM Portal ([portal/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
   - เปลี่ยนจากการเปิดแท็บใหม่ เป็นการนำทางในหน้าต่างเดิม: `window.location.href = res.launch_url;`
   - ค้างสถานะปุ่มและแสดงข้อความ `กำลังนำทางเข้าสู่ระบบ...` ขณะที่เบราว์เซอร์กำลังโหลดเข้าสู่ Spoke อย่างราบรื่น
   - ป้องกันการเกิดแท็บใหม่ซ้ำซ้อน ช่วยประหยัด RAM ได้ 100%
2. **Spoke Portal Switcher Button ([Header.tsx](file:///d:/Python/IRM/frontend/src/components/layout/Header.tsx)):**
   - ในระบบลูก (เช่น IRM) เพิ่มปุ่มลัด `[🏢 สลับระบบ (Portal)]` บนแถบ Header สำหรับผู้ใช้งาน SSO เพื่อให้คลิกกลับมายังหน้า Central IAM Portal ในแท็บเดิมได้ทันทีโดยไม่ต้องกดออกจากระบบ
   - เมื่อกด Logout จากระบบลูก ระบบจะ Redirect กลับมายังหน้า Portal (`https://ciam.windowasia.com/portal`) ในแท็บเดิมโดยอัตโนมัติ

---

## 13. Responsive Spoke Login Architecture (Version 2.0.0)

### 13.1 Problem & Motivation
* ในการใช้งานจริง พนักงานที่เข้าใช้งานระบบลูก (เช่น IRM, WMS) ผ่าน Mobile (หน้างาน คลังสินค้า ขนส่ง โรงงาน) มักเป็นพนักงานที่ใช้ระบบนั้นเพียงระบบเดียว การซ่อนฟอร์มล็อกอินเดิมแล้วบังคับแสดงเฉพาะปุ่ม SSO ขนาดยักษ์ ทำให้ผู้ใช้งานสับสนและรู้สึกว่าระบบเปลี่ยนไป
* ในขณะที่พนักงานสำนักงานบน Desktop ทำงานหลายระบบพร้อมกัน ต้องการทางเลือกในการเข้าใช้งาน ทั้งแบบ SSO รวดเร็ว 1-Click หรือแบบพิมพ์ Username / Password ในฟอร์มเดิม

### 13.2 Specification & Implementation Rule
1. **Mobile View (หน้าจอมือถือ / แท็บเล็ต):**
   - หน้าตา Login **เหมือนเดิม 100%**: ฟอร์ม Username, Password, Remember Me, และปุ่ม Sign In ดั้งเดิมสีเด่นชัด แสดงเป็นหน้าจอหลักทันที
   - ปุ่ม SSO เป็นตัวเลือกเสริม (Secondary Option) ขนาดกะทัดรัด อยู่ด้านล่างฟอร์มใต้เส้นคั่น `— หรือเข้าสู่ระบบด้วย —`
2. **Desktop View (หน้าจอคอมพิวเตอร์):**
   - ปุ่ม SSO **มีขนาดเล็กลง (Compact height `py-2.5`, text-xs/sm)** อยู่ด้านบน คั่นด้วย `— หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน —`
   - ฟอร์ม Username / Password แสดงควบคู่กันทันที
   - ผู้ใช้มีอิสระเลือกล็อกอินด้วยวิธีที่ตนเองสะดวก (Dual Freedom of Choice)
3. **Reference Implementation & Guides:**
   - ต้นแบบนำร่องติดตั้งใน IRM: `d:\Python\IRM\frontend\src\app\login\page.tsx`
   - บันทึกสเปกใน [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) ข้อ 5.2
   - บันทึกคู่มือใน [SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md) ข้อ 4.2

---

## 14. Network Access Control, VPN IP Detection & Audit Log Diagnostics (Version 2.0.1)

### 14.1 Network Architecture & IP Detection (Cloud VPS vs Office LAN vs VPN)
* **Cloud VPS Egress & Ingress:** CIAM โฮสต์อยู่บน Cloud VPS (`157.173.219.153`) นอกวง LAN สำนักงาน
* **Office LAN Traffic (`192.168.10.0/24`):** เมื่อพนักงานในออฟฟิศเชื่อมต่ออินเทอร์เน็ตเข้ามาหา CIAM VPS ทราฟฟิกจะวิ่งผ่าน NAT Firewall Gateway ของสำนักงาน ดังนั้น CIAM จะมองเห็นเป็น **Public WAN IP** (เช่น `49.231.185.245`) เสมอ ไม่เคยเห็น IP วงภายใน (`192.168.10.x`)
* **VPN Egress:** เมื่อผู้ใช้งานเชื่อมต่อ Window Asia OpenVPN (Full-Tunnel) ทราฟฟิกขาออกทั้งหมดจะ Egress ออกทาง Gateway สำนักงาน IP `49.231.185.245` หรือ VPN Subnet Pool `10.8.0.0/24`
* **CIDR Whitelist Logic (`network_service.py`):**
  - หากแอปพลิเคชัน (เช่น MTPulse) มีการกรอก `allowed_network_cidrs`: ระบบจะใช้ค่านั้นแบบ **Strict Override** (ไม่รวมค่า Default)
  - ดังนั้น หากกรอกเฉพาะ `192.168.10.0/24` แต่เครื่องไคลเอนต์วิ่งผ่าน WAN `49.231.185.245` เข้ามา แอปจะขึ้นล็อก VPN ทันที
  - **แนวทางปฏิบัติ:**
    - หากเว้นว่าง `allowed_network_cidrs` ไว้: ระบบจะ fallback ไปใช้ `DEFAULT_CORPORATE_NETWORKS` (`49.231.185.245/32`, `10.8.0.0/24`, `192.168.0.0/16`, ฯลฯ)
    - หากต้องการระบุเฉพาะ: ต้องใส่ Public IP ของ HQ ร่วมด้วย เช่น `49.231.185.245/32, 10.8.0.0/24, 192.168.10.0/24`
* **Client IP Transparency บน Portal (`/portal`):**
  - Backend ส่ง `detected_client_ip` ผ่าน `PortalAppItem`
  - บนปุ่มล็อกแสดง IP ที่ตรวจพบทันที: `"กรุณาเชื่อมต่อ VPN ก่อนเข้าใช้งาน (IP ตรวจพบ: 49.231.185.245)"`

### 14.2 Enhanced Audit Log for Automated Tasks (`scheduler.py` & `/audit-logs`)
* **Prioritize Failure Information:** ในงาน `SYNC_ALL_APPS` หรือ Batch Tasks อื่นๆ หากมีระบบใดระบบหนึ่งล้มเหลว ข้อความ `reason` จะระบุชื่อและ Error สาเหตุที่ล้มเหลวทันที
* **Full Spoke Details in Modal:** รายละเอียดผลลัพธ์รายระบบถูกบันทึกเป็น JSON ใน `IamAuditLog.details` และ Modal เจาะลึก Audit Trail บนหน้าเว็บจะมีกล่องแดงเด่นชัด **"ระบบที่ซิงก์ล้มเหลว (FAILED SPOKES)"** ให้แอดมินแก้ไขปัญหาได้ตรงจุดทันที

---

## 15. Granular Spoke Access Control & Directory Identity Presentation Standards (Version 2.0.2)

### 15.1 Granular Per-System Access Control (ระงับสิทธิ์เฉพาะระบบโดยไม่ Offboard ตัวตนหลัก)
* **API Endpoint:** `PATCH /api/v1/directory/accounts/{mapping_id}/status`
* **Schema:** `AccountStatusUpdateRequest(is_active: bool, reason: Optional[str])`
* **Flow & Integration:**
  1. อัปเดต `AppAccountMapping.is_active_in_app = payload.is_active`
  2. หากแอปที่ถูกปรับคือ Active Directory (`app_code == 'ad'`) จะซิงก์สถานะไปยัง `MasterIdentity.is_active_in_ad` ให้สอดคล้องกัน
  3. ยิงคำสั่งไปยัง Spoke Application โดยตรง:
     - **Mode A (REST API เช่น IRM):** เรียก `connector.deprovision()` หรือ `connector.activate()`
     - **Mode C (Outbound Agent เช่น MTPulse):** สร้างคำสั่ง `DISABLE_USER` / `ENABLE_USER` ใน `SpokePendingCommand` ให้ Agent บนเครื่องลูกมารับไปปิด/เปิดการใช้งาน
     - **Mode B (SAP B1):** ปรับสถานะใน CIAM
  4. บันทึกประวัติใน `IamAuditLog` (Action: `DISABLE_SPOKE_ACCESS` หรือ `ENABLE_SPOKE_ACCESS`)
* **Admin UI:** ในหน้า Directory Modal "ดูสิทธิ์ & ตั้งค่า" เพิ่มปุ่มสลับสิทธิ์รายแอป:
  - หากเปิดอยู่: `[ 🚫 ระงับสิทธิ์ระบบนี้ ]`
  - หากถูกระงับ: `[ ✅ เปิดใช้งานระบบนี้ ]` พร้อมแสดงสถานะแบบ Real-time ทันที

### 15.2 Directory Presentation Standards (Alphabetical Sorting & AD Status Integrity)
* **Alphabetical Sequence (A-Z):** สิทธิ์ระบบลูก (Spokes) ในตารางทะเบียนผู้ใช้และใน Modal จะถูกจัดเรียงตามลำดับตัวอักษรของ `app_code` เสมอ (เช่น `AD` ➔ `IRM` ➔ `M365` ➔ `QMS` ➔ `QOL` ➔ `SAP_B1`) เพื่อให้การแสดงผลของพนักงานทุกคนมีลำดับสม่ำเสมอเหมือนกัน 100%
* **AD Status Mirroring:** สิทธิ์ของ `AD` ในคอลัมน์ระบบลูกจะสะท้อนค่าจริงของ `MasterIdentity.is_active_in_ad` เสมอ และมีการ Auto-heal ใน Backend ป้องกันปัญหา AD แสดงผลเป็นสีแดง/Disable โดยไม่ตั้งใจ
* **Broad Department & AD Detection:** ขยายขอบเขตการตรวจจับตัวตน AD ครอบคลุมพนักงานขาย (`Sale`, `Sale Admin`), จัดซื้อ (`Purchasing`), ฯลฯ ไม่ให้ตกหล่นเป็น "ระบบลูกเท่านั้น"

---

## 16. Versioned Spec Download, Non-Destructive AD Sync & Responsive Loading Feedback (Version 2.0.3)

### 16.1 Versioned Specification Filename
* **Download Filename:** กำหนดชื่อไฟล์ที่ดาวน์โหลดจากระบบให้ระบุเลขเวอร์ชันชัดเจนเสมอคือ `CIAM_SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION_v2.7.0.md` (ดึงเลขเวอร์ชันแบบไดนามิกจากหัวเอกสารสเปก) เพื่อป้องกันปัญหา Dev นำไฟล์ไปใช้ผิดเวอร์ชัน
* **Download Feedback:** เพิ่ม `isDownloadingSpec` State บนหน้าจอพร้อมแสดง Animated Spinner และข้อความ `กำลังเตรียมไฟล์ (v2.7.0)...` และปุ่ม `📥 สเปกเชื่อมต่อ (.md v2.7.0)`

### 16.2 Non-Destructive AD Sync & Startup Auto-Healing (แก้ไขถาวรปัญหา AD แสดง Inactive / บัญชีผี)
* **Root Cause:** ก่อนหน้านี้ ใน `scheduler.py` (รอบ 04:00 น.) และ `applications.py` มีโค้ดค้นหา `stale_identities` โดยเทียบ `~func.lower(MasterIdentity.username).in_(live_usernames)` และสั่ง `st_id.is_active_in_ad = False` ส่งผลให้ผู้ใช้ใดๆ ที่ไม่ได้ถูกส่งกลับมาในรอบ Batch Sync ของ AD ถูกปรับเป็น Inactive ทันที ทำให้ตอนเช้ากลายเป็น "บัญชีผี"
* **Permanent Fix:**
  1. ลบ Logic ตัดสิทธิ์ `stale_identities` สำหรับ Active Directory ออก 100% ทั้งใน `scheduler.py` และ `applications.py` โดยในมาตรฐาน IAM การปรับ `is_active_in_ad = False` ต้องเกิดจากการที่ AD ส่งสถานะปิดใช้งาน (`is_active: False` / `userAccountControl & 2`) มาอย่างชัดเจน หรือจากการ Offboard ของแอดมินเท่านั้น
  2. ปรับให้รอบ Sync AD อัปเดต `identity.is_active_in_ad = is_active` อย่างถูกต้อง
  3. เพิ่มระบบ **Auto-Healing Routine** ใน `init_db()` (`initial_data.py`) ให้กวาดคืนค่า `is_active_in_ad = True` ให้กับพนักงานองค์กร (ฝ่าย Sale, Purchasing, PU, IT, Admin, หรือมีอีเมล `@windowasia.com` และมีบัญชีในระบบลูก) ที่ไม่ได้ถูกบันทึกประวัติการ Offboard อย่างเป็นทางการ พร้อมเชื่อมต่อ mapping ใน AD ให้ Active อัตโนมัติ

### 16.3 Instant UI Loading & Responsive Feedback ("ดูบัญชีสด", "ซิงค์", "ดาวน์โหลด")
* **ปัญหาเดิม:** การกด "ดูบัญชีสด" บนการ์ดระบบลูก (เช่น SAP B1 Service Layer) ต้องรอการเชื่อมต่อภายนอก 1-2 วินาที โดยที่ Modal ยังไม่เปิดและปุ่มไม่มี Spinner ทำให้ผู้ใช้รู้สึกว่าระบบค้าง (Freeze)
* **การแก้ไข:**
  1. เพิ่ม `inspectingApp` และ `inspectingId` เพื่อควบคุมการทำงานแบบ Real-Time
  2. บนปุ่มการ์ด: แสดง Spinner หมุน `<RefreshCw className="animate-spin" />` พร้อมข้อความ `กำลังดึงข้อมูล...` ทันทีที่คลิก
  3. บนหน้าจอ: **เปิด Modal ทันที 0ms (Instant Open)** โดยแสดงหน้าจอ Loading State ที่สวยงามทันสมัย:
     - Header แสดงชื่อระบบและสถานะ `⏳ กำลังเชื่อมต่อ Service Layer / REST API...`
     - Body แสดง Glowing Spinner + ข้อมูลอธิบาย + Shimmer Skeleton Placeholder 3 แถว
     - เมื่อข้อมูลโหลดเสร็จ จะสลับไปแสดงตารางบัญชีสดพร้อมสถิติอย่างลื่นไหล

### 16.4 Spoke Redirect URI Auto-Expansion & Same-Origin Standard Callback Authorization
* **ปัญหา:** Spoke Application (เช่น MTPulse: `wa-mtpulse.wa.net`) ยิงขอ SSO Authorization Code แล้วเกิด Error `Redirect URI 'https://wa-mtpulse.wa.net/auth/callback' is not authorized for client 'mtpulse-spoke-client'`
* **การแก้ไข:**
  1. ใน `oidc_service.py`: ให้ขยาย `allowed_uris` ของ client โดยอัตโนมัติให้รวม `${base_url}/auth/callback`, `${base_url}/api/auth/callback`, `${base_url}/portal/callback`
  2. อนุญาต Same-Origin Matching สำหรับ standard callback paths (`/auth/callback`, `/api/auth/callback`) หากมี Origin/Host ตรงกับระบบลูกที่ลงทะเบียนไว้
  3. บรรจุ `mtpulse` ใน `apps_data` และรัน Auto-Upgrade ใน `initial_data.py` รับประกันว่า callback URIs สำหรับ MTPulse จะถูกบันทึกในฐานข้อมูลเสมอ

### 16.5 Spoke Badge Deduplication & Local Acc Terminology (Version 2.0.4)
* **Badge Deduplication:** ใน `_build_app_summaries` ([directory.py](file:///d:/Python/Central-IAM/backend/app/api/v1/directory.py)) ทำการ deduplicate ตาม `app_code.upper()` เพื่อรับประกันว่าระบบลูกแต่ละระบบจะแสดงเพียง 1 Badge เสมอ แม้ในฐานข้อมูลจะมี mapping ซ้ำจากการ Sync หรือตัวพิมพ์เล็ก/ใหญ่
* **Spoke Agent Non-AD Creation:** ใน `agent.py` กำหนดให้บัญชีใหม่ที่ซิงก์มาจาก Outbound Spoke Agent มี `is_active_in_ad = False` เสมอ (ป้องกันกรณีบัญชีที่สะกดผิดบนเครื่องลูก เช่น `Winmonpan.P` ถูกเข้าใจผิดว่าเป็นผู้ใช้ AD)
### 16.7 Enterprise Identity Status Source of Truth & Local vs AD Accounts Architecture (Version 2.0.6)
* **หลักการ Source of Truth (Top-Down vs Bottom-Up):**
  1. **Corporate AD Accounts (พนักงานองค์กร):**
     - **Source of Truth คือ Active Directory / Central IAM**
     - การกำหนดสถานะเป็นไปในทิศทาง Top-Down จาก CIAM ไปยังระบบลูก (Spokes)
     - ระบบ Spoke ไม่มีสิทธิ์ปิด/เปลี่ยนสถานะ `is_active_in_ad` ของพนักงาน
  2. **Local Spoke Accounts (บัญชีเฉพาะระบบย่อย):**
     - **Source of Truth คือ Spoke Application นั้นๆ** (เช่น บัญชี Vendor, Maintenance Local Pass ใน IRM)
     - CIAM รับรู้สถานะเฉพาะระดับ `is_active_in_app` เท่านั้น และไม่นำ Local Account ไปเปรียบเทียบกับ `is_active_in_ad` เพื่อตัดสินว่าเป็นบัญชีผี (Ghost Account False Positives)
* **การแก้ไขปัญหา AD Inactive และ Ghost Discrepancy:**
  - **`pinyada.r` vs `Pinyada.S`:** แก้ไขการ Seed ที่ผิดพลาด โดยกำหนดให้ `pinyada.r` (Pinyada Rungrattanaporn) เป็นพนักงาน AD Active ที่ถูกต้อง และแยก `Pinyada.S` เป็น Local Pass ของ IRM ที่ถูก Inactive โดยไม่ผูกกับ AD
  - **เพิ่มพนักงาน AD ที่ถูกต้อง:** `Patcha.S`, `Apichai.P`, `Praewwalee.K`, `pinyada.r`, `Ronnakorn.P`, `Wimonpan.P` ในรายการ Identity ศูนย์กลาง
  - **Agent Sync Refinement (`agent.py`):** เมื่อ MTPulse หรือ Spoke Agent ยิงส่งบัญชีเข้ามา หากมีอีเมลองค์กร `@windowasia.com` จะกำหนดเป็น `is_active_in_ad = True` แทนการตั้งค่า `False` อัตโนมัติ
  - **Context-Aware Directory Filtering (`directory.py`):** ตัวกรองผสม เช่น `app_code="irm"` ร่วมกับ `status="active"` จะตรวจสอบสถานะ Active ภายในระบบ IRM โดยตรง (`spoke_active == True`) ทำให้บัญชีที่ปิดใช้งานใน IRM ไม่โผล่มาแสดงผล
  - **Ghost Account Guardrails (`reconciliation.py`):** ป้องกันไม่ให้ Local Spoke Accounts ถูกนำไปประเมินเป็น Discrepancy หรือ Ghost Account


