# Central IAM - System Memory & Technical Context (MEMORY.md)
**Last Updated:** 2026-10-17  
**Version:** 2.9.0 (Core Model Context Protocol (MCP) Server for AI Agents, Spoke Data Bridge)  
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
* **Connected Spokes:**
  1. **pfSense FAC (`pfsense_fac`):** Factory Firewall & FreeRADIUS VPN Gateway via AD Sync Agent Proxy (`http://172.18.0.1:3100/api/v1/pfsense/fac`).
  2. **pfSense HO (`pfsense_ho`):** Head Office Firewall & FreeRADIUS VPN Gateway via AD Sync Agent Proxy (`http://172.18.0.1:3100/api/v1/pfsense/ho`), forwarding to `https://192.168.10.1:8088` (or 443 with auto-fallback).
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

### 4.8 Single Unified Front Door & Post-Login Flow (Version 2.6.0)
* **Single Unified Front Door (`/login`):**
  * ทุกคำขอที่ไม่ระบุตัวตน (Unauthenticated Requests) รวมถึงการเข้า Root Path `ciam.windowasia.com` (`/`) หรือกรณีเซสชันหลุด จะถูกนำทางเข้าสู่หน้า **`/login`** (Window Asia App Portal สีขาว-น้ำเงิน) เสมอ 100%
  * หน้า `/admin/login` มีระบบ Auto-Forward ส่งต่อทราฟฟิกเข้ามาที่ `/login` ป้องกันไม่ให้พนักงานทั่วไปหลุดเข้าไปเห็นหน้า Admin Console
* **Unified Post-Login Redirection:**
  * ทั้งพนักงานทั่วไปและผู้ดูแลระบบ (Admin) ใช้หน้า `/login` เดียวกัน และเมื่อเข้าสู่ระบบจะถูกส่งเข้าสู่ **`/portal`** เป็นค่าเริ่มต้น
  * พนักงานทั่วไป (`role: PORTAL_USER`): แสดงเฉพาะแอปพลิเคชันที่ตนเองได้รับสิทธิ์ และไม่สามารถเข้าถึงเส้นทาง Admin (`/`, `/directory`, ฯลฯ)
  * ผู้ดูแลระบบ (`role: SUPER_ADMIN` / `ADMIN`): แสดงแอปพลิเคชันทั้งหมด พร้อมปุ่มลัด **`[ 🛡️ Admin Console ]`** บนแถบ Header (แสดงผลทั้งบน Desktop และ Mobile) เพื่อคลิกสลับเข้าสู่แดชบอร์ดบริหารจัดการได้ทันที
* **Deep Link Preservation:**
  * หาก Admin เปิดลิงก์เฉพาะทาง (เช่น `/directory`, `/applications`, `/offboarding`) โดยที่ยังไม่ได้ล็อกอิน ระบบจะส่งมาที่ `/login?redirect=...` และเมื่อล็อกอินผ่านจะนำทางกลับไปหน้าดังกล่าวโดยอัตโนมัติ

### 4.9 Password Management & Security Policies (Version 2.3.0)
  * Active Directory users authenticated via Windows Domain Controller (`is_ad_user: true`) **do not have the change password button 🔑** on the Employee Portal Header (`/portal`).
  * `is_ad_user` Determination Rule: Only built-in admins (`admin`, `superadmin`) and accounts explicitly flagged with `ident.exception_type == "LOCAL_ACCOUNT"` return `is_ad_user: false`. All other corporate identities return `is_ad_user: true` (regardless of whether `ad_guid` is populated in DB).
  * AD passwords cannot and should not be changed via Central IAM web interface; employees must change domain credentials on domain joined computers via `Ctrl + Alt + Del` or through IT Helpdesk.
* **Enterprise Password Complexity Policy (Local Accounts):**
  * Local Accounts created for non-AD users or third-party contractors must strictly adhere to the following enterprise complexity rules (enforced at both Backend and Client-side):
    - **Length:** Strict 8-10 characters.
    - **Uppercase Letter:** At least 1 character (`A-Z`).
    - **Lowercase Letter:** At least 1 character (`a-z`).
    - **Digit:** At least 1 character (`0-9`).
    - **Special Character:** At least 1 character (`!@#$%^&*()_+-=[]{}|;:,.<>?`).
    - **Confirmation:** Must match confirmation field.
* **Forced Password Change on First Login (`must_change_password`):**
  * When IT Administrators create or reset a Local Account in `/directory`, the option "บังคับให้ผู้ใช้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก" is enabled by default.
  * When a flagged user signs into Central IAM, `/portal` automatically displays a blocking Modal requiring an immediate password change before granting access.
* **Spoke Direct Access Clarification:**
  * Local Accounts created on Central IAM **cannot log in directly to spoke applications** (e.g. IRM) using traditional login forms because spokes never receive or store plaintext passwords. Users must always authenticate via Central IAM SSO (`/portal`) to access connected spokes.

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
* **Download Filename:** กำหนดชื่อไฟล์ที่ดาวน์โหลดจากระบบให้ระบุเลขเวอร์ชันชัดเจนเสมอคือ `CIAM_SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION_v2.8.0.md` (ดึงเลขเวอร์ชันแบบไดนามิกจาก Content-Disposition และหัวเอกสารสเปก) เพื่อป้องกันปัญหา Dev นำไฟล์ไปใช้ผิดเวอร์ชัน
* **Download Feedback:** เพิ่ม `isDownloadingSpec` State บนหน้าจอพร้อมแสดง Animated Spinner และข้อความ `กำลังเตรียมไฟล์ (v2.8.0)...` และปุ่ม `📥 สเปกเชื่อมต่อ (.md v2.8.0)`

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

---

## 17. Real-Time AD Sync Agent Monitoring & Hourly Telegram Alerts (Version 2.0.7 & 2.0.8)

### 17.1 Background Architecture & Operational Rules
* **Continuous Monitoring Loop (ตรวจทุก 1 นาทีเป็นค่าเริ่มต้น, กำหนดค่าได้เองโดย Admin):**
  - รันผ่าน Background Scheduler Worker (`run_scheduler_worker` ใน `scheduler.py`) ซึ่งทำงาน 24/7 (Scheduler loop wake up ทุกๆ 15 วินาที เพื่อให้ตรงรอบเวลา)
  - ความถี่เริ่มต้นเปลี่ยนจาก 30 วินาทีเป็น **1 นาที (60 วินาที)**
  - Admin สามารถปรับเปลี่ยนความถี่ในการ Probe ตรวจสอบได้เองผ่านหน้า Settings: 30 วินาที, 1 นาที (ค่าเริ่มต้น), 2 นาที, 3 นาที, 5 นาที, หรือ 10 นาที
  - ค่าความถี่ถูกบันทึกและอ่านจากฟิลด์ `check_interval_seconds` ใน `ad_status_monitor` (`system_settings`)
  - ตรวจสอบความพร้อมของ AD Gateway (`http://172.18.0.1:3100`) ผ่าน `AdProxyConnector.health_check()`
* **Alert Triggering Rules (3 ระดับ):**
  1. **🚨 OFFLINE_IMMEDIATE (ส่งทันทีเมื่อหลุด):** เมื่อสถานะเปลี่ยนจาก `ONLINE` ➔ `OFFLINE` ระบบจะส่งแจ้งเตือน Telegram เข้ากลุ่มและ DM ถึงแอดมินทันที พร้อมบันทึกเวลาที่เริ่มขัดข้อง (`offline_since`)
  2. **⚠️ OFFLINE_REMINDER (เตือนซ้ำทุก 1 ชั่วโมง):** ตราบใดที่สถานะยังคงเป็น `OFFLINE` ระบบจะจับเวลาและส่งแจ้งเตือนซ้ำทุกๆ 3,600 วินาที (1 ชั่วโมง) พร้อมสรุปเวลารวมที่ขัดข้องสะสม (Cumulative Downtime)
  3. **✅ ONLINE_RECOVERED (แจ้งเตือนกู้คืนทันที):** เมื่อ AD กลับมาเป็น `ONLINE` ระบบจะส่งข้อความแจ้งเตือนทันที พร้อมสรุปรวมระยะเวลา Downtime ทั้งหมด และรีเซ็ตเคาน์เตอร์การเตือน
* **State Persistence:**
  - สถานะถูกบันทึกในฐานข้อมูล PostgreSQL ตาราง `system_settings` คีย์ `ad_status_monitor` โครงสร้าง JSON:
    `{ current_status, is_online, offline_since, last_notified_at, total_offline_alerts_sent, last_check_at, last_latency_ms, last_message, check_interval_seconds }`
* **API Endpoints & UI Diagnostics:**
  - `GET /api/v1/dashboard/health-monitor`: ส่งคืน `config`, `live_health`, และ `ad_monitor`
  - `PUT /api/v1/dashboard/health-monitor/ad-interval`: บันทึกความถี่การตรวจสอบ `check_interval_seconds`
  - `POST /api/v1/dashboard/health-monitor/test-ad-alert`: ทดสอบยิงข้อความจำลองทั้ง 3 รูปแบบ
  - `POST /api/v1/dashboard/health-monitor/check-ad-now`: บังคับตรวจเช็คสถานะทันทีแบบ Real-time
  - หน้าเว็บ `frontend/src/app/settings/page.tsx` มีการ์ดควบคุม, Dropdown เลือกความถี่ตรวจสอบ (30s - 10m) พร้อมปุ่มบันทึก และปุ่มทดสอบครบถ้วน

---

## 18. Modern Executive SSO App Portal & Strict AD Authority Boundary (Version 2.0.9)

### 18.1 Modern Executive SSO App Portal Architecture (`/portal`)
* **Design System & Aesthetics:**
  - พัฒนาในรูปแบบ Frosted Glassmorphism พร้อม Ambient Glow แสงนุ่มลึก
  - **Squircle 3D App Icons:** กล่องไอคอนมนทรง Squircle 3D พร้อมแสงเงาและเฉดสีเฉพาะของแต่ละระบบ (IRM: สีส้มอำพัน, QMS: สีเขียวมรกต, QOL: สีน้ำเงิน, SAP B1: สีน้ำเงินรอยัล, MTPulse: สีฟ้าไซแอน, WorkSync: สีม่วง)
  - **Interactive Toolbar:** ระบบค้นหาแบบเรียลไทม์ (Instant Live Search) และ Filter Pills แยกตามหมวดหมู่ (`ทั้งหมด`, `การผลิต & คลัง`, `การขาย & ลูกค้า`, `ERP & บริหาร`, `VPN Only`)
  - **Security Trust Badge:** การ์ด Hero แสดงสถานะ `🟢 SSO Core Active (RS256)` ยืนยันความปลอดภัยระดับ Enterprise
  - **Interactive Micro-Animations:** ปุ่มเปิดระบบมีลูกศรพุ่งขึ้น (`↗`) ขยับเมื่อ Hover พร้อมการตรวจสอบเงื่อนไขความพร้อมของ VPN/Offline อัตโนมัติ

### 18.2 Strict AD Authority Boundary & Local Spoke Account Safeguard
* **ตัดสิทธิ์ Spoke Agent ในการกำหนดสถานะ AD:** ปรับปรุง `agent.py` และ `directory.py` ให้ Spoke Application ไม่มีสิทธิ์กำหนด `is_active_in_ad = True` โดยเด็ดขาด การเป็นบัญชี AD ต้องมาจากการซิงก์ของ AD Gateway, การมี `ad_guid`, หรือ `has_ad_mapping` เท่านั้น
* **แก้ไขกรณี `Winmonpan.P` สะกดผิด:** ตัดการใช้ `is_ad_username_fmt` (ตรวจจุดในชื่อ) ตัดสิน AD ออก และเพิ่ม Auto-heal ใน `initial_data.py` กำหนดให้ `Winmonpan.P` เป็น `is_active_in_ad = False` แสดงผลเป็น Local Acc ขีด `-` เสมอ

### 18.3 Minimalist Header & Spoke Settings Clean-up
* นำ Pill `[ ⬡ Central IAM ]` บนแถบ Header ด้านบนสุดออก เพื่อความสะอาดตา
* นำปุ่มกำหนดเวลาซิงก์และตัวเลือกเรียงตามลำดับในหน้า `/applications` ออก (ย้ายไปรวมอยู่ที่หน้า Settings)

---

## 19. AD Authority Integrity & Department Sanitation (Version 2.3.1)

### 19.1 Single Source of Truth for Active Directory Status
* **ปัญหาเดิม:** เมื่อผู้ใช้ถูกระงับสิทธิ์ใน Active Directory (AD Disable) เช่น `Chanpen.K` แต่ยังคงมีบัญชีค้างอยู่ใน Spoke Application (เช่น pfSense `PFSENSE_HO`), ฟังก์ชัน `persist_spoke_inventory` ใน `scheduler.py` และ Auto-heal เดิมใน `initial_data.py` ได้เขียนทับ `is_active_in_ad = True` อัตโนมัติเนื่องจากชื่อมี Format พนักงานองค์กร (`Firstname.L`) ทำให้ระบบ Central IAM ไม่ตรวจจับ Ghost Account (บัญชีผี/ตกค้าง)
* **การแก้ไข:** 
  - ตัดสิทธิ์ Inbound Spoke Poller (`scheduler.py`) และตัด Routine Auto-heal ใน `initial_data.py` โดยเด็ดขาด ห้ามระบบลูกหรือ Spoke อื่นเปลี่ยนแปลงค่า `identity.is_active_in_ad`
  - สถานะ `is_active_in_ad` ต้องมาจาก Active Directory Connector (`is_ad_item = True`) เท่านั้น
  - เมื่อผู้ใช้ถูกปิดใน AD แต่ยังมีบัญชีใน Spoke ระบบจะจัดสถานะเป็น `DISCREPANCY` (บัญชีผี / ตกค้าง) ทันทีอย่างถูกต้องตามมาตรฐาน Identity Governance

### 19.2 รองรับโครงสร้าง OU `Users TC` และกรอง Role "Administrator" ออกจากแผนก
* **ปัญหาเดิม:** โครงสร้าง AD ของ Window Asia มีทั้ง OU `Users WA` (สำนักงานใหญ่/โรงงานหลัก) และ `Users TC` (ไซต์ TC) แต่ฟังก์ชัน `extract_ou_department` และ `ciam-extension.js` รองรับเฉพาะ `users wa` ส่งผลให้ผู้ใช้ใต้ `Users TC` ไม่ถูกสกัด Leaf OU อย่างถูกต้อง และหาก AD มีการกรอกฟิลด์ Department เป็น `Administrator` หรือ `Admin` ระบบจะนำมาแสดงในคอลัมน์ "แผนก" ทำให้เกิดความสับสนว่าเป็นผู้ดูแลระบบ (Admin)
* **การแก้ไข:**
  - เพิ่มการตรวจจับ Root OU ทั้ง `users wa`, `users tc`, และ `users` ใน `extract_ou_department` (`ad_proxy.py`) และ `ciam-extension.js`
  - เพิ่มคำว่า `administrator`, `admin`, `domain admins`, `domain users` ใน `junk_exact` และ `junkDepts` เพื่อป้องกันไม่ให้คำนำหน้าสิทธิ์ระบบหลุดเข้ามาเป็นชื่อแผนก
  - อัปเดต `corporate_depts` และ `corporate_keywords` ใน `directory.py` และ `scheduler.py` โดยเปลี่ยนจาก `Administrator` เป็น `Administration` (ธุรการ) เพื่อความถูกต้องตามหลักผังองค์กร

---

## 20. Login SSO UX Refinements & IT Support LINE QR Integration (Version 2.3.2)
* **ตัด SAP Business One ออกจากแบนเนอร์ข้อมูล Login:**
  - ปรับปรุงข้อความระบบงานที่รองรับใน `login/page.tsx` จาก `รองรับการเข้าถึงระบบ IRM, SAP Business One, QMS และระบบงานภายในทั้งหมด` ให้เหลือเฉพาะ `รองรับการเข้าถึงระบบ IRM, QMS และระบบงานภายในทั้งหมด` เพื่อความถูกต้องตามสถานะการเปิดใช้งานจริง
* **LINE QR Code IT Support Asset & Interaction:**
  - เพิ่มไฟล์ภาพ `/line-it-support-qr.png` ใน `frontend/public/`

## 21. AD Inactive Status Reconciliation & Ghost Account Auto-Heal (Version 2.7.0)

### 21.1 ปัญหาผู้ใช้ที่ถูกลบออกจาก AD แต่สถานะยังแสดงเป็น On (เขียว 🟢) - กรณี `Worawut.S`
* **สาเหตุ:**
  - `worawut.s` (Worawut Seelanuan) เป็นบัญชีที่มีอยู่เดิมใน Spoke Applications (เช่น M365 และ SAP B1) แต่ได้ถูกนำออกจาก Active Directory ไปแล้ว
  - ในโมเดล `MasterIdentity` ฟิลด์ `is_active_in_ad` มีค่าเริ่มต้นเป็น `True` และยังไม่เคยถูกปรับเป็น `False` เนื่องจากตอนรัน AD Sync ครั้งถัดมา ระบบจะ sync เฉพาะบัญชีที่ AD ส่งมา และลบเฉพาะแถว `AppAccountMapping` ของ AD แต่ไม่ได้ปรับฟิลด์ `is_active_in_ad` บน `MasterIdentity`
  - ใน `directory.py` การตรวจสอบ `is_ad` เดิมอาศัยเงื่อนไขว่าถ้ามีอีเมล `@windowasia.com` (ซึ่งมาจาก M365) ก็ถูกนับเป็น `is_ad = True` จึงทำให้ `is_active_in_ad` ดึงค่า `True` ออกมา และแสดงสถานะเป็น On (จุดเขียว 🟢)
* **การแก้ไข:**
  - **Automated Deactivation on AD Sync (`scheduler.py`):** เมื่อเชื่อมต่อ AD Sync Agent แล้ว หากพบบัญชีเดิมที่หลุดออกจากรายการ AD สด (`live_usernames`) ระบบจะปรับ `stale.identity.is_active_in_ad = False` ทันที พร้อมลบการแมป AD และมี Reconciliation Sweep กวาดตรวจตัวตนที่ค้างอยู่
  - **Effective AD Status & Auto-Healing (`directory.py`):** คำนวณ `has_direct_ad = bool(has_ad_mapping or identity.ad_guid or identity.last_login_ad_at)` และ `effective_ad_active = bool(identity.is_active_in_ad and has_direct_ad)` ป้องกันไม่ให้ตัวตนที่ไม่มีความเชื่อมโยงกับ AD แสดงสถานะเขียว พร้อม auto-heal บันทึกลงฐานข้อมูล
  - **Database Auto-Healing (`initial_data.py`):** ปรับ `worawut.s` เป็น `is_active_in_ad = False` และมี auto-heal กวาดตรวจตัวตนที่ไม่มี AD footprint
  - **Tooltip Clarity (`frontend/src/app/directory/page.tsx`):** ปรับ Tooltip เป็น `"Inactive: บัญชีถูกปิดใช้งาน หรือไม่มีตัวตนใน Active Directory"`

### 21.2 ปัญหาบัญชีร้านค้าสาขา (`WA-Shop_*`) หลุดแสดงในตัวกรอง Active Directory
* **สาเหตุ:**
  - บัญชีร้านค้าสาขา (`WA-Shop_*`) มีการเชื่อมต่อ pfSense VPN แต่ในอดีตหรือบน Windows DC มีอ็อบเจกต์เหล่านี้ ทำให้เกิดแถวใน `AppAccountMapping` กับ AD
  - ใน `directory.py` เงื่อนไขเดิม `if not has_ad_mapping and not is_ad: continue` ทำให้บัญชีที่มี mapping ของ AD ผ่านตัวกรองเข้ามาได้ แม้ระบบจะจัดเป็น `is_shop_acc` ก็ตาม
* **การแก้ไข:**
  - **Strict AD Filtering:** ใน `directory.py` การกรอง `app_code == 'ad'` บังคับต้องเป็น `is_ad == True` เท่านั้น บัญชีประเภท `is_shop_acc` จะถูกตัดทิ้งทันที
  - **Prune AD Badge on Shop Accounts:** กรองป้ายและ mapping ของ AD ออกจากบัญชีร้านค้า ทำให้คอลัมน์ Spokes แสดงเฉพาะ Spoke ที่เกี่ยวข้องจริง (เช่น `PFSENSE_FAC`)
  - **Prevent Ingestion:** ใน `scheduler.py` ให้ข้ามการ sync บัญชีร้านค้าจาก AD และลบ AD mapping ตกค้างออกอัตโนมัติ
  - **DB Sanitation:** ใน `initial_data.py` ปรับให้ลบ AD mapping ของบัญชีร้านค้าทั้งหมด และตั้งค่า `is_active_in_ad = False`

---

## 22. Model Context Protocol (MCP) Server Architecture (Version 2.9.0)

### 22.1 Background & Capabilities
* **Official MCP 2.x Architecture:** Central IAM integrates `mcp` SDK (`mcp.server.mcpserver.MCPServer`) as an identity and spoke management command bridge for AI Agents (Antigravity IDE, Cursor, Claude Desktop).
* **Location:** `backend/app/mcp/server.py` and `backend/app/mcp/remote.py`
* **Transports Supported:**
  1. **Remote Cloud SSE (`https://ciam.windowasia.com/mcp/sse`):** Allows any developer or AI Agent to connect from remote laptops over HTTPS with Bearer token authentication.
  2. **Local Stdio (`python -m app.mcp.server`):** Direct process execution for local development.
  3. **SSH Remote Bridge:** Direct command execution via SSH into production Docker container.
* **Security Guard:** `RemoteMcpAuthMiddleware` validates Bearer token against `MCP_API_KEY`, `SECRET_KEY`, or Admin JWT token.
* **Zero AI API Cost on Server:** When used via IDE Desktop (Cursor/Antigravity/Claude), all LLM inference cost is borne by the Client Host. CIAM executes as an MCP Tool Provider with zero server-side token cost.

### 22.2 Registered MCP Tools
1. `ciam_health_check`: Real-time probe of all connected child applications (IRM, MTPulse, SAP B1, pfSense, M365, AD)
2. `ciam_list_users`: Master identity query with department, email, AD status, and mapped spoke systems
3. `ciam_get_ghost_accounts`: 04:00 AM Reconciliation engine detection for accounts inactive in AD but active in spokes
4. `ciam_get_spoke_data`: Spoke-specific deep inspection (e.g. `app_code='mtpulse'` for contractor mappings and Mode C queue)
5. `ciam_deprovision_user`: 1-Click Offboarding across AD, pfSense VPN, SAP B1, M365, IRM, and MTPulse
6. `ciam_reactivate_user`: 1-Click Reactivation and re-provisioning across child systems
7. `ciam_get_audit_logs`: Query immutable security audit trail
8. `ciam_dispatch_spoke_command`: Queue Mode C async commands (`DISABLE_USER`, `ENABLE_USER`, `REQUEST_FULL_SYNC`)

### 22.3 IDE Integration Config (`mcp_config.json`)
```json
{
  "mcpServers": {
    "central-iam-cloud": {
      "url": "https://ciam.windowasia.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer <YOUR_ADMIN_JWT_OR_MCP_KEY>"
      }
    },
    "central-iam-local": {
      "command": "d:\\Python\\Central-IAM\\backend\\.venv\\Scripts\\python.exe",
      "args": ["-m", "app.mcp.server"],
      "cwd": "d:\\Python\\Central-IAM\\backend",
      "env": {
        "PYTHONPATH": "."
      }
    }
  }
}
```

---

## 23. Central IAM In-House AI Copilot & Spoke Framework (Sprint 40)

### 23.1 In-House AI Copilot Architecture
* **Frontend Widget:** `frontend/src/components/ai/CiamCopilotWidget.tsx` ฝังอยู่ใน `AppShell.tsx` เรนเดอร์เป็น Floating Assistant Drawer หรูหรา พร้อมสถานะ On/Off อัตโนมัติตาม `ai_copilot_settings`
* **System Settings Configuration:** หน้า `frontend/src/app/settings/page.tsx` มี Section **AI Copilot & Intelligence Engine** สำหรับ:
  - สวิตช์ Master Toggle เปิด/ปิดหน้าต่างแชท (`enabled`)
  - เลือก Provider: Google Gemini, OpenAI, Anthropic, Local Ollama, Custom API
  - กำหนด Model Identifier: e.g. `gemini-1.5-flash`, `gpt-4o-mini`, `deepseek-r1`
  - กรอกและ Masking API Key พร้อมปุ่ม **[ ⚡ ทดสอบเชื่อมต่อ (Test Connection) ]**
  - สวิตช์เปิด/ปิดให้ AI เรียกใช้ Central IAM & Spoke MCP Tools (`allow_mcp_tools`)
* **Backend Engine:**
  - Schemas: `backend/app/schemas/ai.py`
  - Service: `backend/app/services/ai_service.py`
  - Router: `backend/app/api/v1/ai.py` (`GET /settings`, `PUT /settings`, `POST /test`, `POST /chat`)
* **Zero External Cost Fallback:** หากไม่มีการตั้งค่า API Key หรือ API ภายนอกขัดข้อง ระบบจะสลับไปใช้ **Central IAM Rule-based Intelligence Engine** โดยประมวลผลคำถามผู้ใช้และดึงข้อมูลสดผ่าน MCP Tools (`ciam_health_check`, `ciam_get_ghost_accounts`, `ciam_list_users`, `ciam_get_spoke_data`) คืนกลับมาได้ 100%

### 23.2 Spoke Framework Standard (หมวด E ใน Spec v2.8.0)
* ระบบลูก (MTPulse, IRM, QMS, SAP B1 Service) ที่ต้องการมีหน้าต่างแชท AI ประจำระบบ ต้องปฏิบัติตามมาตรฐานกลาง:
  1. เก็บการตั้งค่าลงในตาราง `system_settings`
  2. ต้องซ่อนหน้าต่างหรือปุ่มแชทอัตโนมัติหาก `ai_copilot_enabled == false`
  3. API Key ต้องผ่านการ Masking เสมอ
  4. สามารถเชื่อมต่อกับ Central IAM MCP Server ผ่าน Remote SSE (`https://ciam.windowasia.com/mcp/sse`) ด้วย Bearer token เพื่อเรียกใช้ Enterprise Tools ส่วนกลางได้

---

## 24. AI Factual Grounding, SSO Portal Muted Gray UI & Spoke Spec v2.8.0 Synchronization (Version 2.9.1)

### 24.1 AI Factual Grounding & Zero-Hallucination Policy
* **Parameter Alignment:** ปรับปรุง `execute_internal_mcp_tool` ใน `ai_service.py` ให้แปลงค่าอาร์กิวเมนต์ตรงกับพารามิเตอร์จริงของ `server.py` (`is_active` แทน `status`, `app_code` แทน `app_client_id`, `action_type` แทน `category`) ป้องกัน Tool Crash 100%
* **Direct App Filtering in `ciam_list_users`:** เพิ่มพารามิเตอร์ `app_code` ให้สามารถกรองผู้ใช้งานตามระบบลูก (เช่น MTPulse, IRM, SAP B1) ได้ผลลัพธ์และจำนวนตรงกับหน้า User Directory (`/directory`) แบบ 1:1
* **Context-Aware Intent Detection:** ฟังก์ชัน `detect_tool_intent` สแกนประวัติการสนทนา 4 ข้อความย้อนหลัง ทำให้เมื่อผู้ใช้ถามคำถามติดตาม (เช่น *"แล้วแสดงในหน้าทะเบียนกี่บัญชี"*, *"ยืนยันใช่ไหม"*) ระบบสามารถตรวจจับระบบลูกที่กำลังพูดถึงได้อย่างแม่นยำ
* **Strict Anti-Hallucination & Anti-Sycophancy Directives:** เพิ่มกฎเหล็กใน System Prompt และ Ground-Truth Context บังคับให้ AI ยึดตัวเลขจาก Tool Output เป็นความจริงสูงสุด ห้ามเออออตามตัวเลขผิดที่ผู้ใช้ถามนำเด็ดขาด และห้ามตอบ *"ยืนยันตามนี้ครับ"* หากตัวเลขไม่ตรงกับฐานข้อมูลจริง

### 24.2 SSO Portal Muted Gray UI for Unavailable Applications
* **Visual Hierarchy:** แอปพลิเคชันที่ยังไม่สามารถใช้งานได้ (ต้องต่อ VPN แต่ยังไม่ได้เชื่อมต่อ, ระบบออฟไลน์, หรือปิดรับ SSO):
  - การ์ด: ปรับเป็นสีเทาหม่น (`bg-slate-100/70`, `border-slate-300`, `opacity-80`) ตัดเอฟเฟกต์แสงเงากระพริบ
  - ไอคอน: ปรับเป็น 3D Grayscale (`bg-slate-200 text-slate-400 grayscale`) ตัดความสดใสออก
  - ป้ายสถานะ & ปุ่มกด: ปรับเป็นโทน Slate (`bg-slate-200 text-slate-600 border-slate-300`)
  - ข้อความ Greeting Header: ปรับเป็น `{apps.length} ระบบงานที่ได้รับสิทธิ์` เพื่อป้องกันความสับสน

### 24.3 Spoke Integration Specification v2.8.0 Synchronization
* **Backend Build Context Sync:** ซิงก์ไฟล์ `SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md` v2.8.0 เข้าสู่โฟลเดอร์ `backend/` ซึ่งเป็น Build Context ของ Docker
* **Dynamic Spec Download:** ปรับปรุง `handleDownloadSpec` ใน `applications/page.tsx` ให้อ่านชื่อไฟล์จาก `Content-Disposition` Header ของ API แบบไดนามิก พร้อมอัปเดตปุ่มดาวน์โหลดเป็น `📥 สเปกเชื่อมต่อ (.md v2.8.0)` และบันทึกประวัติ Revision Changelog ใน Dev Guide Modal

### 24.4 Phonetic Identity Unification (`Duanghathai.P` <-> `Duanghatai.P`) & Spoke Username Search
* **สาเหตุ:** ใน Active Directory คอลัมน์ `Name`/`DisplayName` ของคุณดวงหทัย ผาสุข (แผนก AC) สะกดเป็น `Duanghatai.P` (ไม่มี `h`) แต่ `sAMAccountName` (User logon name) สะกดเป็น `Duanghathai.P` (มี `h`) ในขณะที่ฝั่ง SAP B1 ใช้ `Duanghatai.P`
* **การแก้ไข:**
  - รวมตัวตน `Duanghatai.P` เข้ากับตัวตนหลัก `Duanghathai.P` บน Production และเพิ่มคู่ `("duanghathai.p", "duanghatai.p")` ใน Auto-heal routine (`initial_data.py`, `directory.py`)
  - เพิ่มกฎเทียบเสียง `thai` $\leftrightarrow$ `tai` ใน `persist_spoke_inventory` (`scheduler.py`) พร้อมตรวจเช็ค `identity_id` ใน `AppAccountMapping` เพื่อไม่ให้เกิดแถวซ้ำเมื่อซิงก์ SAP B1 รอบถัดไป
  - ขยายระบบค้นหาใน `list_users` (`directory.py`) และ `ciam_list_users` (`mcp/server.py`) ให้ค้นหาครอบคลุมทั้ง `AppAccountMapping.app_username` และคำค้นหาเทียบเสียง (`thai` $\leftrightarrow$ `tai`, `wut` $\leftrightarrow$ `woot`)

### 24.5 AI Copilot Specific Username Lookup (`Chaiwat.N`) & Active AD Priority Ordering
* **สาเหตุ:**
  1. `detect_tool_intent` ใน `backend/app/services/ai_service.py` เดิมไม่ได้สกัดชื่อบัญชี (`Chaiwat.N`) ส่งเข้าพารามิเตอร์ `search` ของ `ciam_list_users` และหากข้อความไม่มีคีย์เวิร์ดทั่วไป (เช่น พิมพ์สั้นๆ ว่า `"Chaiwat.N ตรวจดูดีๆ"`) ระบบจะไม่เรียก MCP Tool เลย
  2. เมื่อเรียก `ciam_list_users(limit=30)` โดยไม่มี `search` คิวรีเรียงตาม `MasterIdentity.username.asc()` (ASCII Order) ทำให้ 30 แถวแรกเป็นบัญชี VPN สาขาที่ขึ้นต้นด้วยตัวเลข (`01-WS_...`, `03-WS_...`, `25 WA Shop...`) ส่งผลให้ `Chaiwat.N` (หมวดตัวอักษร C) หลุดอยู่นอก Limit 30 และ AI เข้าใจผิดว่าไม่มีในระบบ
  3. ฟิลด์ `is_ad_account` ใน `ciam_list_users` เดิมเช็คแค่ `bool(ident.ad_guid or ident.employee_id)` ทำให้บัญชี AD ที่ซิงก์ผ่าน AD Sync Agent (ซึ่งใช้ `is_active_in_ad=True` และ `AppAccountMapping` ของ `ad`) แสดง `is_ad_account: False`
* **การแก้ไข:**
  - เพิ่มฟังก์ชัน `extract_user_search_term` ใน `ai_service.py` เพื่อสกัด Username (`Firstname.L`), อีเมล หรือชื่อผู้ใช้จากทั้งข้อความปัจจุบันและประวัติการสนทนา แล้วส่ง `search=user_search` เข้า `ciam_list_users` ทันที
  - ปรับการเรียงลำดับใน `ciam_list_users` (`mcp/server.py`) เป็น `MasterIdentity.is_active_in_ad.desc(), MasterIdentity.username.asc()` เพื่อให้บัญชี AD ที่ Active แสดงขึ้นมาก่อนบัญชีรหัสสาขาเสมอ พร้อมเพิ่ม Prefix Fallback (`Firstname`) และปรับ `is_ad_account` ให้เช็ค `bool(ident.is_active_in_ad or has_ad_spoke or ident.ad_guid or ident.employee_id)`

### 24.6 Proactive Zero-Action Session Auto-Logoff Watchdog & App Client Logout Return to `/portal` (Sprint 46)
* **ค่ากำหนดเวลาเซสชัน (Session Timeout Policy):**
  - **Portal Idle Timeout (เปิดหน้า `/portal` ทิ้งไว้โดยไม่มีการขยับเมาส์/คีย์บอร์ด/คลิก):** **30 นาที** (`DEFAULT_IDLE_TIMEOUT_MINUTES = 30` ใน `frontend/src/lib/session.ts`)
  - **Absolute JWT Token Lifetime:** **480 นาที / 8 ชั่วโมง** (`ACCESS_TOKEN_EXPIRE_MINUTES = 480` ใน `backend/app/core/config.py`)
  - **Server Session Heartbeat:** ตรวจสอบ `/api/v1/auth/me` อัตโนมัติทุก **60 วินาที** (ตรวจจับกรณีถูกระงับสิทธิ์จากฝั่ง Server)
* **กลไก Proactive Auto-Logoff บนหน้า SSO Portal (ตัดทันทีเมื่อถึงเวลาโดยไม่ต้องรอ User คลิก):**
  - ใช้ `useSessionWatchdog()` ใน `portal/page.tsx` และ `AppShell.tsx` ตั้งทั้ง `setTimeout` ที่มิลลิวินาทีหมดอายุจริง + `setInterval` ทุก 1 วินาที + Cross-Tab `storage` listener
  - เมื่อเปิดหน้า `/portal` ทิ้งไว้ครบ 30 นาทีโดยไม่ได้เข้าใช้งาน App Client ระบบจะล้าง `ciam_token`, `ciam_user`, `ciam_last_activity` ทันที และสั่ง `window.location.replace("/login?expired=1&reason=...")` โดยอัตโนมัติ
* **กฎสำคัญ: เมื่อผู้ใช้ออกไปใช้งาน App Client (Spoke App) จะไม่นำ Idle Time 30 นาทีของ SSO Portal มาคิด และเมื่อกด Logout จาก App Client จะกลับมาหน้า `/portal` ทันที:**
  1. เมื่อผู้ใช้กดเข้าสู่ระบบลูกจากหน้า `/portal` (`handleLaunch`) หรือผ่าน `/oauth/authorize` ระบบเรียก `markNavigatingToSpokeApp()` (`ciam_in_spoke_app = "1"`) เพื่อพักการนับ Idle Time ของ SSO Portal
  2. เมื่อผู้ใช้ทำงานใน App Client (เช่น IRM, MTPulse, QMS) นานเท่าใดก็ตาม (ตราบใดที่ JWT 8 ชม. ยังไม่หมดอายุ) แล้วกด **Logout จากหน้า App Client**:
     - หาก App Client พากลับมาที่ `https://ciam.windowasia.com/portal` (เช่น IRM) หรือเรียก `/oauth/logout`: ระบบตรวจเช็คด้วย `checkTokenValidOnReturn()` (ไม่คิด Idle Time ย้อนหลัง) แล้วพาผู้ใช้เข้าสู่หน้า **SSO Portal (`/portal`) ของ CIAM ทันที** พร้อมรีเซ็ตเวลา Idle Time ของหน้า SSO Portal เริ่มนับ `30:00` นาทีใหม่!
  3. **เมื่อผู้ใช้กดปุ่ม `ออกจากระบบ` เอง (`performManualLogout`):** ระบบตั้งแฟล็ก `ciam_manual_logout` ป้องกันไม่ให้ Watchdog ยิง `expired=1` แทรกขณะปิดป๊อปอัปยืนยัน และเปิดหน้า `/login` แบบสะอาด **โดยไม่แสดงกล่องแจ้งเตือนเรื่องเซสชันหมดอายุ** (กล่องแจ้งเตือนสีเหลืองจะแสดงเฉพาะเมื่อหมดเวลา `idle_timeout`, `token_expired`, หรือ `revoked` จริงเท่านั้น)
* **Remote MCP Routing (`/api/v1/mcp/sse` & `/mcp/sse`):**
  - Mount MCP SSE Starlette App ทั้งที่ `/api/v1/mcp` และ `/mcp` ใน `backend/app/main.py` พร้อมเพิ่ม `PathPrefix(/mcp)` ใน `docker-compose.yml` และ `ARG BACKEND_INTERNAL_URL=http://api:8001` ใน `frontend/Dockerfile` เพื่อให้การเรียก `/mcp/sse` และ `/api/v1/mcp/sse` วิ่งตรงถึง FastAPI Backend เสมอ (ตอบ `401 UNAUTHORIZED_MCP_ACCESS` เมื่อไม่มี Token แทนที่จะเกิด 500 จาก Next.js Rewrite)


