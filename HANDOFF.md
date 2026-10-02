# Central-IAM — Project Handoff & Development Context

> **Date Updated:** 2 ตุลาคม 2026 (Local Time: ~22:45 ICT)  
> **Repository (CIAM):** [https://github.com/nchaiwat/CIAM](https://github.com/nchaiwat/CIAM)  
> **Repository (IRM):** [https://github.com/nchaiwat/IRM](https://github.com/nchaiwat/IRM)  
> **Workspace Local:** `D:\Python\Central-IAM` และ `D:\Python\IRM`  
> **Production VPS (CIAM):** `/var/www/Ciam` (Linux Ubuntu, IP: `157.173.219.153`)  
> **Production VPS (IRM):** `/var/www/Irm` (Hostinger VPS)

---

## 1. ภาพรวมระบบ (System Overview)
**Central-IAM** คือระบบบริหารจัดการตัวตนผู้ใช้งานศูนย์กลาง (Centralized Identity and Access Management) และ Single Sign-On (SSO) Portal ขององค์กร Window Asia ทำหน้าที่เป็นศูนย์กลางในการ:
1. **Master Identity Directory:** จัดเก็บและซิงค์ฐานข้อมูลตัวตนพนักงานศูนย์กลางจาก Active Directory (DC)
2. **Spoke Enterprise Connectors:** เชื่อมต่อกับระบบย่อยในองค์กร ได้แก่:
   - **Active Directory (AD DC Gateway):** ผ่าน REST Agent Gateway Port 3100 (`http://172.18.0.1:3100`) และ LDAP Direct Fallback
   - **SAP Business One (ERP):** เชื่อมต่อผ่าน SAP B1 Service Layer REST API (`https://sapb1.waapps.net/b1s/v2`)
   - **IRM System:** ระบบจัดซื้อ/ทรัพยากรภายใน เชื่อมต่อผ่าน REST API M2M และ Single Sign-On (OIDC / PKCE)
   - **QMS System:** ระบบควบคุมคุณภาพ เชื่อมต่อผ่าน REST API M2M
   - **Microsoft 365 (Entra ID / Exchange):** เชื่อมต่อผ่าน Microsoft Graph API
3. **Enterprise SSO Portal (`/portal`):** ระบบ Launchpad สำหรับให้พนักงาน Login ด้วยรหัสผ่าน AD และเปิดใช้งานระบบ Spoke ต่างๆ ผ่าน OIDC/OAuth2
4. **Automated Deprovisioning & Offboarding:** ปิดการใช้งานบัญชีทุกระบบพร้อมกันทันทีเมื่อพนักงานลาออก
5. **Reconciliation & Audit Logging:** ตรวจจับบัญชีแปลกปลอม (Ghost accounts) และเก็บประวัติความปลอดภัย

---

## 2. โครงสร้างและการ Deploy (Deployment & Architecture)

### บริการ Central-IAM (`docker-compose.yml`)
| Service Name | บทบาท | Port ภายใน | Port ภายนอก | เทคโนโลยี | Volume Mounts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | PostgreSQL Database (v16 Alpine) | 5432 | 5438 | PostgreSQL | `ciam_pgdata:/var/lib/postgresql/data` |
| **`api`** | Backend Core API | 8001 | 8001 (Traefik) | FastAPI (Python 3.12), SQLAlchemy 2 | `./backend:/app`, `ciam_keys:/app/keys` |
| **`web`** | Frontend Web Dashboard & Portal | 3000 | 3000 (Traefik) | Next.js 14 (TypeScript, TailwindCSS) | - |

> ⚠️ **ข้อควรระวังสำคัญอย่างยิ่ง (Critical Deployment Rules):**  
> 1. ชื่อ Service ของ Frontend ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด)
> 2. Backend Service **`api`** มีการ mount `./backend:/app` แล้วใน Commit `ba03928` ทำให้การแก้ไข Python Code ใน `./backend` บน VPS จะถูกโหลดทันทีเมื่อสั่ง `docker compose restart api` โดยไม่ต้องเสียเวลา rebuild ทั้ง container ทุกครั้ง

---

## 3. สรุปความคืบหน้าและการแก้ไขล่าสุด (Recent Progress & Key Commits)

### 1) การแก้ปัญหา SAP Business One Service Layer (Complete & Verified)
- ทำความสะอาด URL Service Layer ไม่ให้ติด `/Login` ซ้ำ (Commit `89da958`)
- เพิ่ม Pagination `@odata.nextLink` ดึงข้อมูลครบ 308 รายการ (Commit `fc1f084`)
- ปรับ Priority ดึงข้อมูลจาก `/b1s/v2/Users` ก่อน `/b1s/v2/EmployeesInfo` (Commit `b513510`)

---

### 2) ปัญหาตัวเลขนับบัญชี Active Directory (Complete & Verified)
- Stale mapping pruning ลบบัญชี service เก่า 54 บัญชี
- แก้ Duplicate case-sensitive rows ซ้ำ 30 แถวด้วย immediate `db.delete()` + `db.flush()` ป้องกัน SQLAlchemy UniqueViolation 500 (Commit `8fd9a5d`)

---

### 3) การปรับปรุงระบบ Login & Employee Portal v1.9.3 (Complete & Verified)
- แยก `/login` สำหรับพนักงาน (Clean/Modern Window Asia SSO ➔ เข้า `/portal`)
- แยก `/admin/login` สำหรับ Admin IT (Cyber Dark Theme, Honeypot, Lockout)
- กรองแอปตามสิทธิ์ `AppAccountMapping.is_active_in_app == True`

---

### 4) ระบบมาตรฐาน Spoke SSO Break-Glass & Guard Step 0 (1 ต.ค. 2026 — Commit `6a145b3`)
- **ปัญหาเดิม:** เมื่อ Spoke (เช่น IRM) ปิดสวิตช์ SSO ภายในตนเอง (`ciam_sso_enabled = false` หรือเปิด Break-Glass) หน้า Login ตรงของ IRM ซ่อนปุ่ม SSO ถูกต้อง แต่ถ้าพนักงานกด Launch จาก Central-IAM Portal ตัว endpoint `/api/auth/sso/callback` ของ IRM ยังคงยอมรับโค้ดและพา Login ผ่าน SSO ได้เนื่องจากไม่มีการตรวจเช็คสถานะ SSO ใน Callback
- **การแก้ไข:**
  - **IRM Backend (`sso.py`):** เพิ่ม **Step 0 Check** ใน `handle_sso_callback` ตรวจสอบ `ciam_sso_enabled` และ `ciam_break_glass_active` หากปิดอยู่ จะปฏิเสธคำขอด้วย `HTTP 503 Service Unavailable` และบันทึก `transaction_logs` หมวด `ciam_sso`
  - **Standard SDK & Reference Router (`spoke_sso_router.py`):** เพิ่ม Step 0 Check ใน reference template ของ CIAM
  - **Standard Specifications:** บันทึก Step 0 เข้าไปใน `SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md` และ `SPOKE_SSO_INTEGRATION_GUIDE.md` ให้ทุกระบบลูกถือปฏิบัติเหมือนกัน 100%

---

### 5) การตรวจจับสถานะ SSO ของ Spoke และระบบป้องกัน Offline ใน Portal (Commit `6a145b3`)
- **Spoke SSO Probing:** ปรับ `RestApiConnector.health_check()` ให้ probe ไปที่ `GET /api/auth/sso/config` ของ Spoke ด้วย เพื่อดึงสถานะ `sso_enabled` และ `break_glass_active` มาบันทึกลงในคอลัมน์ `spoke_sso_status` ของ `connected_applications`
- **Applications Page Badge (`/applications`):**
  - แสดง `✕ Disabled (ปิด SSO)` หาก CIAM ปิด SSO
  - แสดง `⚠️ Spoke ปิด SSO (Break-Glass)` หาก Spoke ปิด SSO หรือเข้าโหมดฉุกเฉิน
  - แสดง `✓ SSO Active` หากเปิดใช้งานปกติทั้งสองฝั่ง
- **Employee Portal Safety Guards (`/portal`):**
  - หากระบบปลายทางออฟไลน์ (เช่น QMS ที่ยังไม่เปิด Server): การ์ดแสดงป้าย `🔴 ออฟไลน์` และปุ่มถูก Disable: `ระบบปิดปรับปรุงชั่วคราว (Offline)`
  - หากระบบปิดรับ SSO: การ์ดแสดงป้าย `🔒 Break-Glass` และปุ่มถูก Disable: `ระบบปิดรับ SSO ชั่วคราว`
  - Backend Guard ใน `/api/v1/oauth/portal/launch` บล็อกการยิง API ด้วย HTTP 503 พร้อมข้อความภาษาไทยแจ้งเตือนที่ชัดเจน

---

### 6) แก้บั๊กการบันทึกข้อมูลใน IRM (Supplier Master & Item Master — Commits `704b646`, `754323e`)
- **ปัญหาเดิม:** 
  1. เมื่อแก้ไข Email ของ Supplier หรือข้อมูล Item Master แล้วกดบันทึก หน้าจอไม่ Refresh ค่าใหม่ทันที ต้องกด Hard Reload จึงจะเห็นผลลัพธ์
  2. เมื่อต้องการลบ Email ให้เป็นค่าว่าง (Blank) แต่ระบบยังคงจำและเซฟค่า Email เดิมไว้
- **Root Cause & การแก้ไข:**
  1. **Backend (`suppliers.py`):** โค้ดเดิมใช้ `if data.email is not None:` เมื่อผู้ใช้ส่ง `email: null` เข้ามา Python ข้ามการอัปเดตไปเลย แก้ไขโดยใช้ `data.model_dump(exclude_unset=True)` ตรวจจับฟิลด์ที่ส่งมาจริง หากเป็นค่าว่างจะบันทึกเป็น `NULL` ลงในฐานข้อมูลทันที (รวมถึงเบอร์โทรและชื่อผู้ติดต่อ)
  2. **Frontend (`suppliers/page.tsx` & `items/page.tsx`):**
     - เพิ่ม **Instant Optimistic State Update** นำผลลัพธ์ `res.data` จากเซิร์ฟเวอร์ไปอัปเดตลง State `suppliers` และ `items` ทันทีหลังกดบันทึก
     - เพิ่ม Anti-Cache Parameters `{ params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } }` ใน `fetchSuppliers()` และ `fetchItems()` ป้องกัน Browser HTTP Cache 100%

---

### 7) ระบบ Zero-Trust Network Policy & VPN Restriction สำหรับ On-Premise Spoke Applications (1 ต.ค. 2026)
- **โจทย์และความท้าทาย:**
  - แอปพลิเคชัน On-Premise (เช่น SAP B1 Client, WMS ในโรงงาน, Internal Local Web Apps) ติดตั้งอยู่ภายใน Local Network ของ Window Asia และไม่มี Inbound Public Tunnel ให้คนภายนอกเข้าถึงโดยตรง
  - พนักงานที่อยู่นอกออฟฟิศและไม่ได้ต่อ OpenVPN หากกดเปิดใช้งานผ่าน Employee Portal (`/portal`) จะเจอ Browser Timeout หรือ Connection Refused ทำให้เกิดความสับสนและร้องเรียนปัญหาไปยังทีม IT
- **การออกแบบสถาปัตยกรรม (Hybrid Approach):**
  - **Dynamic Client IP Inspection:** เซิร์ฟเวอร์ CIAM บน Cloud จะตรวจสอบ Egress Public IP ของพนักงานขณะร้องขอหน้า Portal (`/oauth/portal/apps`) และจังหวะกดเปิดแอป (`/oauth/portal/launch`)
  - **Corporate VPN Networks:** ค่ากลางของบริษัทที่รองรับการเข้าถึง On-Prem ประกอบด้วย:
    - OpenVPN WAN Egress IP ของสำนักงานใหญ่ Window Asia: `49.231.185.245/32`, `58.8.190.63/32`
    - Subnet ภายใน: `10.8.0.0/24` (OpenVPN Client Subnet), `192.168.0.0/16` (Office LAN Subnet), `172.18.0.0/16` (Docker Network), `127.0.0.1/32`
  - **Per-Application Granular Control:**
    1. `network_policy`: เลือกระหว่าง `ANYWHERE` (เข้าได้จากทุกที่ สำหรับ Cloud / SaaS) กับ `VPN_ONLY` (จำกัดเฉพาะต่อ VPN / ในออฟฟิศ)
    2. `vpn_restriction_mode`: (เมื่อเป็น `VPN_ONLY`) เลือกระหว่าง:
       - `HIDE`: ซ่อนการ์ดแอปพลิเคชันออกจาก Employee Portal ทันทีหากไม่ได้ต่อ VPN
       - `LOCK_WITH_BANNER`: แสดงการ์ดใน Portal พร้อมไอคอน `🔒 ต้องต่อ VPN` และ Disable ปุ่มเปิดระบบเป็น `กรุณาเชื่อมต่อ VPN ก่อนเข้าใช้งาน`
    3. `allowed_network_cidrs`: สามารถระบุวง IP/CIDRs เฉพาะของระบบนั้นๆ เพิ่มเติมได้ (หากเว้นว่างจะใช้วง VPN กลางของบริษัทโดยอัตโนมัติ)
  - **Strict Backend Guard:** เอนด์พอยต์ `/api/v1/oauth/portal/launch` ตรวจสอบ IP แบบเข้มงวด หากอยู่นอกเครือข่ายจะส่งกลับ `HTTP 403 Forbidden` พร้อมข้อความแจ้งเตือนทันที ป้องกันการแอบขอ Authorization Code จากภายนอก
  - **Database Migration:** เพิ่มคอลัมน์ `network_policy`, `vpn_restriction_mode`, `allowed_network_cidrs` ในตาราง `connected_applications` แบบ Non-destructive พร้อม Auto-Migration ใน `initial_data.py`

---

### 8) ระบบ On-Premise SSO Client Mode (`SSO_ONLY` Connector) (2 ต.ค. 2026)
- **โจทย์และความท้าทาย:**
  - แอป On-Premise (เช่น MTPulse, WMS ภายใน) อยู่ในวงแลนออฟฟิศ ไม่มี Inbound Public Tunnel จากภายนอก
  - เมื่อลงทะเบียนเป็น `REST_API` (Two-Way) ระบบ CIAM Cloud ยิง Ping Inbound เข้าหา URL ภายในไม่ได้ ทำให้ขึ้น `🔴 ออฟไลน์` และ `⚠️ Spoke ปิด SSO (Break-Glass)` ส่งผลให้ปุ่มบน Employee Portal ถูกล็อกเป็น `ระบบปิดปรับปรุงชั่วคราว (Offline)`
- **การแก้ไข:**
  - เพิ่ม Connector ตัวใหม่ `SsoOnlyConnector` (`backend/app/connectors/sso_only.py`)
  - รองรับประเภท `connector_type = "SSO_ONLY"` ใน `factory.py`, `applications.py`, และ `oauth.py`
  - เมื่อเปิดเป็น `SSO_ONLY`:
    - สถานะจะกลายเป็น `🟢 ออนไลน์ (Client Mode)` และ `✓ SSO Active (Client Mode)` อัตโนมัติ
    - Backend ข้ามการบล็อก Launch สำหรับ SSO Client Mode
    - Employee Portal ปลดล็อกปุ่มเป็น `เข้าใช้งานระบบ ↗` ให้พนักงานล็อกอินผ่านเบราว์เซอร์ได้ทันที
    - เพิ่มตัวเลือก `SSO_ONLY` ใน Dropdown ของทั้งหน้าเพิ่มและแก้ไขระบบบน Admin Console

---

### 9) ระบบ Outbound Agent & Reverse Heartbeat สองทางสำหรับ On-Premise Spokes (Mode C) (2 ต.ค. 2026)
- **โจทย์และความต้องการ:**
  - ระบบ On-Premise (เช่น MTPulse, WMS, SAP B1 Local) อยู่ในวง LAN โรงงาน ไม่สามารถเปิด Inbound Port หรือ Public Domain จากอินเทอร์เน็ตได้
  - แต่ต้องการฟังก์ชันสองทาง: ให้ Spoke มี Schedule หรือ Daemon ส่งข้อมูลบัญชีขึ้นมาหา CIAM (Directory Inventory Sync) และคอยเช็คคำสั่งตัดสิทธิ์/คืนสิทธิ์ (`DISABLE_USER`, `ENABLE_USER`) จาก CIAM ไปจัดการบน DB ของตนเอง
  - หากระบบ On-Premise ขาดการติดต่อนานเกิน 5 นาที ให้ CIAM สลับสถานะเป็น Offline (Dead Man's Switch)
- **สิ่งที่พัฒนาและทดสอบแล้ว:**
  1. **Model & Database Table (`backend/app/models/application.py`):**
     - เพิ่มตาราง `spoke_pending_commands` สำหรับเก็บคิวคำสั่ง (`command_id`, `app_code`, `action`, `username`, `reason`, `status`, `issued_by`, `created_at`, `executed_at`, `result_message`)
     - ปรับ `backend/app/initial_data.py` ให้ Auto-migrate สร้างตารางและ Index อัตโนมัติเมื่อ Start
  2. **Reverse Heartbeat & Pull API (`backend/app/api/v1/agent.py`):**
     - Endpoint: `POST /api/v1/agent/heartbeat`
     - ตรวจสอบ `X-Spoke-Client-ID` และ `X-Spoke-API-Key`
     - อัปเดต `health_status="ONLINE"`, `spoke_sso_status="ACTIVE"`, `latency_ms=1`, และ `last_health_check_at=now()`
     - รับผลลัพธ์คำสั่งรอบก่อนหน้า (`command_results`) เพื่อ Mark `COMPLETED` / `FAILED` พร้อมบันทึก `IamAuditLog`
     - รองรับ `sync_type="FULL_SYNC"` อัปเดต `MasterIdentity` และ `AppAccountMapping` พร้อมนับ `total_linked_accounts`
     - คืนคำสั่งที่ค้างอยู่ (`commands_dispatched`) สูงสุด 10 คำสั่ง และ Mark เป็น `SENT`
  3. **Connector Integration (`backend/app/connectors/sso_only.py`):**
     - อัปเกรด `set_account_status()` ให้สร้าง `SpokePendingCommand` เข้าคิวเมื่อ Admin สั่งเปิด/ปิดผู้ใช้
  4. **Developer Specification & Production Guides:**
     - อัปเดต [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) เป็น v2.4.0
     - เพิ่มหมวด D: Reverse Heartbeat & Outbound Sync Channel
     - แนบสคริปต์ [ciam_agent.py](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) พร้อมวิธีติดตั้ง Linux Systemd Service, Linux Crontab, และ Windows Task Scheduler
     - อัปเดต Modal คู่มือสำหรับ Dev บนหน้า [applications/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)
  5. **การทดสอบ:**
     - เพิ่ม Test Cases `test_sso_only_connector_lifecycle` และ `test_agent_heartbeat_and_command_queue`
     - Pytest: **39 passed** ใน `test_api_flow.py` (0 failed)
     - TypeScript: **0 errors** (`npx tsc --noEmit`)

---

## 4. สถานะ Git ล่าสุด (Current Git State)

### Repository Central-IAM (`D:\Python\Central-IAM`)
- **Branch:** `main`
- **Head Commit:** [`af96c18`](https://github.com/nchaiwat/CIAM/commit/af96c18) - `feat(agent): implement reverse heartbeat and outbound agent for on-premise spokes (Mode C)`
- **Prior Commit:** [`951fab6`](https://github.com/nchaiwat/CIAM/commit/951fab6) - `feat(connectors): implement SSO_ONLY connector for on-premise spokes`
- **Features Completed:**
  - `SSO_ONLY` Connector สำหรับ Isolated On-Premise Spokes (Mode B)
  - Reverse Heartbeat & Outbound Agent API `/api/v1/agent/heartbeat` (Mode C)
  - ตารางฐานข้อมูล `spoke_pending_commands` พร้อม Auto-migration
  - Integration Specification v2.4.0 (หมวด D พร้อม `ciam_agent.py` code)
  - Developer Guide Modal 3-Column Topology บนหน้าเว็บ `/applications`
- **Working Tree:** สะอาด (Test Suites `39 passed`, `0 TS errors`)

### Repository IRM (`D:\Python\IRM`)
- **Branch:** `main`
- **Head Commit:** [`754323e`](https://github.com/nchaiwat/IRM/commit/754323e) - `fix(suppliers): allow clearing email and contact fields to null/blank in update_supplier`
- **Working Tree:** สะอาด

---

## 5. คำสั่งมาตรฐานสำหรับ Deploy บน VPS (Production Runbook)

### ฝั่ง Central-IAM (VPS: `/var/www/Ciam` - IP: `157.173.219.153`):
```bash
cd /var/www/Ciam
git pull origin main
docker compose build api web
docker compose up -d api web
```

---

## 6. สรุปความพร้อมของระบบสำหรับ Developer นำไปใช้งาน

1. **ตัวเลือกระบบเชื่อมต่อ 3 รูปแบบ (Architectural Modes):**
   - **Mode A (Cloud Two-Way):** สำหรับระบบที่มี Public Domain (เช่น IRM, QMS) — CIAM ยิง Inbound Webhook ไปตรวจสถานะและบริหารจัดการบัญชี
   - **Mode B (On-Premise SSO-Only):** สำหรับระบบ On-Premise ในโรงงานที่ต้องการเพียง OIDC SSO — ไม่ต้องเปิด Inbound Port และไม่ต้องรัน Agent
   - **Mode C (On-Premise Outbound Agent):** สำหรับระบบ On-Premise ที่ต้องการ Sync บัญชีสองทางและ 1-Click Offboarding — ไม่ต้องเปิด Inbound Port แต่ใช้สคริปต์ `ciam_agent.py` ยิง Reverse Heartbeat ขาออก (Port 443) มาหา CIAM
2. **เอกสารคู่มือสำหรับทีม Dev:**
   - ดาวน์โหลดเอกสารฉบับเต็มได้จากปุ่ม `📥 สเปกเชื่อมต่อ (.md)` บนหน้า Admin Console (`/applications`)
   - หรือเปิดดูสรุปภาพรวมจากปุ่ม `📋 คู่มือสำหรับ Dev` บนหน้าจอได้ทันที

---

## 7. แผนงานและจุดที่จะกลับมาพัฒนาต่อ (Roadmap & Next Steps to Resume)

เมื่อกลับมาพัฒนาต่อ ให้เริ่มจากลำดับงานดังนี้:

1. **ทดสอบใช้งาน Mode C กับระบบ MTPulse จริง:**
   - นำสคริปต์ `ciam_agent.py` ไปวางในโปรเจกต์ MTPulse (On-Prem)
   - ผูกฟังก์ชัน `execute_local_command()` เข้ากับฐานข้อมูลจริงของ MTPulse (อัปเดต `status` หรือ `is_active` ของ User)
   - ทดสอบสั่ง Disable ผู้ใช้จาก CIAM Cloud ➔ ตรวจสอบว่าคำสั่งถูกส่งไปที่ Agent ในรอบ Heartbeat และ User ใน MTPulse ถูกระงับสิทธิ์จริง
2. **พัฒนาระบบ Background Dead Man's Switch Worker บน CIAM:**
   - สร้าง Background Task หรือ Scheduler (เช่น APScheduler / Cron) บนเซิร์ฟเวอร์ CIAM
   - คอยตรวจเช็คแอปพลิเคชันที่เป็น Mode C ทุกๆ 1 นาที หาก `last_health_check_at` ขาดการติดต่อนานเกิน 5 นาที (300 วินาที) ให้สลับสถานะเป็น `health_status="OFFLINE"` และตัดปุ่ม Launch บน Portal เป็น `ระบบปิดปรับปรุงชั่วคราว (Offline)` ทันที
3. **กลับมาทำ pfSense Integration (ที่พักไว้):**
   - ศึกษาวิธีการจัดการบัญชีผู้ใช้บน pfSense (User Management / Captive Portal / OpenVPN Users)
   - พิจารณาแนวทางเชื่อมต่อ:
     - ทางเลือกที่ 1: ผ่าน pfSense REST API Package (เช่น `pfsense-api` หรือ `FauxAPI`)
     - ทางเลือกที่ 2: ผ่าน XML-RPC หรือ SSH Scripting
     - ทางเลือกที่ 3: ให้ pfSense ทำการ Authen ผู้ใช้ผ่าน LDAP/RADIUS ส่งมาที่ Active Directory หรือ CIAM โดยตรง
4. **เพิ่ม UI ดู Command Queue และ Agent Logs บน Admin Console:**
   - ใน Modal "ตรวจสอบบัญชี (Inspect)" บนหน้า `/applications` เพิ่มแท็บ **"Outbound Agent Commands"**
   - แสดงประวัติคำสั่งที่ CIAM ส่งไปให้ Spoke Agent (`PENDING`, `SENT`, `COMPLETED`, `FAILED`) พร้อม Timestamp และ Error Message เพื่อให้ Admin ตรวจสอบได้ว่าคำสั่งถูกนำไปรันที่ On-Prem สำเร็จหรือไม่
5. **การ Deploy ขึ้น Production VPS (`157.173.219.153`):**
   - สั่งรันคำสั่งใน Runbook บน VPS และตรวจสอบ Log ด้วย `docker compose logs -f api`
   - ตรวจสอบว่า Auto-migration สร้างตาราง `spoke_pending_commands` ใน Production PostgreSQL สำเร็จ เรียบร้อย 100%
