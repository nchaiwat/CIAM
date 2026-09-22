# Central IAM - Developer & Operations Handoff Guide (HANDOFF.md)
**Document Version:** 1.7.0  
**Last Updated:** 2026-09-18  
**Organization:** Window Asia Public Company Limited  
**System Status:** Fully Operational, Feature-Complete, M365 & AD Connected, pfSense 2.7.2 Integration Specified, 22/22 Tests Passing (100%), 0 TypeScript Errors  
**Related Documents:** 
- [AD_SYNC_AGENT_CIAM_EXTENSION.md](file:///d:/Python/Central-IAM/AD_SYNC_AGENT_CIAM_EXTENSION.md) (สเปกสำหรับทีม Active Directory Gateway พอร์ต 3100)
- [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) (สเปกกลาง SSO Zero-.env และ M2M API สำหรับทุกระบบลูก)
- [SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md) (คู่มือขั้นตอน SSO Step-by-Step สำหรับผู้พัฒนาระบบลูก)
- [PRD.md](file:///d:/Python/Central-IAM/PRD.md)
- [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md)

---

## 1. สรุปสถานะล่าสุดและการปรับปรุงสำคัญ (Changelog v1.7.0)

ในรอบการพัฒนานี้ ได้มีการทบทวนความพร้อมระบบ ทดสอบความสมบูรณ์ 100% และจัดทำพิมพ์เขียวการเชื่อมต่อไฟร์วอลล์องค์กร ดังนี้:

### 1.1 ตรวจสอบความสมบูรณ์ของระบบ (System Health Check & Full Test Pass)
* **Backend Test Suite:** ทดสอบผ่าน `pytest -v` ครบถ้วน **22/22 tests passing (100%)**
* **Frontend Compilation:** ผ่านการตรวจสอบ TypeScript `npx tsc --noEmit` โดยมี **0 errors**
* **Active Containers & Services:**
  * PostgreSQL 16 Alpine (`ciam-postgres`) รันปกติที่พอร์ต **5435** (Healthy)
  * FastAPI Core Backend รันอยู่ที่พอร์ต **8001** (Status: `OPERATIONAL`)
  * Next.js 16 Frontend รันอยู่ที่พอร์ต **3000**

### 1.2 พิมพ์เขียวการเชื่อมต่อไฟร์วอลล์ pfSense 2.7.2-RELEASE บน FreeBSD 14
องค์กรใช้ไฟร์วอลล์ **pfSense 2.7.2-RELEASE (FreeBSD 14.0-CURRENT)** จึงได้ออกแบบแนวทางการเชื่อมโยงเข้ากับ Central IAM 2 รูปแบบเพื่อควบคุมสิทธิ์ VPN และ WebGUI จากศูนย์กลาง:

#### รูปแบบที่ 1: Native Active Directory / LDAPS Integration (พร้อมใช้ทันที)
* **การทำงาน:** pfSense มีโมดูล Authentication Server ในตัว ชี้ตรงมาที่ Windows Domain Controller (`192.168.12.11`) พอร์ต `389/636`
* **การ Governance:** Central IAM ควบคุมสิทธิ์ระดับ Master Identity เมื่อพนักงานลาออกแล้วถูกสั่ง Disable ใน AD/CIAM $\rightarrow$ สิทธิ์การเข้าใช้งาน OpenVPN และ pfSense WebGUI จะถูกตัดทิ้งทันทีโดยอัตโนมัติ

#### รูปแบบที่ 2: REST API Spoke Connector (`pfSense-API` บน FreeBSD 14)
* **ข้อเท็จจริงของ Package Manager:** แพ็กเกจ REST API ไม่ได้อยู่ใน Official Package Manager ของ Netgate WebGUI แต่สามารถติดตั้งผ่าน FreeBSD Package Subsystem (`pkg`) ได้ด้วยคำสั่งเดียว:
  ```bash
  fetch -o + https://github.com/jaredhendrickson13/pfsense-api/releases/latest/download/pfSense-2.7.2-pkg-RESTAPI.txz && pkg-static install -y pfSense-2.7.2-pkg-RESTAPI.txz && rm pfSense-2.7.2-pkg-RESTAPI.txz
  ```
* **ความสามารถที่ได้:**
  * เพิ่มเมนู **System > REST API** บน pfSense WebGUI
  * เปิด Endpoint `/api/v1/user` (CRUD & Enable/Disable status)
  * Central IAM สามารถส่งคำสั่ง `PATCH /api/v1/user` เพื่อ Disable User หรือ Revoke OpenVPN Certificate ในขั้นตอน 1-Click Offboard ได้โดยตรง

### 1.3 แก้ไขปัญหาเซสชันหลุดบ่อย (SSO Token TTL Expansion & Session Stability)
* ปรับอายุ Token OIDC/SSO ใน [oidc_service.py](file:///d:/Python/Central-IAM/backend/app/services/oidc_service.py) ตาม `settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60` (8 ชั่วโมงเต็ม / 28,800 วินาที) สอดคล้องกับชั่วโมงการทำงาน
* แก้ไข [spoke_sso_router.py](file:///d:/Python/Central-IAM/backend/app/sdk/spoke_sso_router.py) ให้ส่งพารามิเตอร์ `subject=user.username` ถูกต้อง ป้องกัน Error ในระบบลูก

### 1.4 เชื่อมต่อสด Microsoft 365 (Entra ID & Exchange)
* ต่อเชื่อมผ่าน Microsoft Graph API ด้วย App Registration (OAuth 2.0 Client Credentials Grant)
* ซิงก์ข้อมูลสดพนักงานและกล่องจดหมายสำเร็จ **67 บัญชี** ในโหมด **Safe Read-Only Mode**

### 1.5 มาตรฐานเขตเวลาและรูปแบบวันที่ (`dd/mm/yyyy` Asia/Bangkok)
* โมดูลกลาง [frontend/src/lib/date.ts](file:///d:/Python/Central-IAM/frontend/src/lib/date.ts) บังคับเขตเวลา `Asia/Bangkok` (GMT+7) แสดงผล `dd/mm/yyyy` (24 ชั่วโมง ไม่มี AM/PM) ในทุกหน้าจอ

---

## 2. แผนที่สถาปัตยกรรมและพอร์ตระบบ (System Topology)

```
                       ┌─────────────────────────────────────────┐
                       │        CENTRAL IAM ECOSYSTEM            │
                       │     (Window Asia Public Co., Ltd.)      │
                       └────────────────────┬────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
   ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────────┐
   │    Next.js 16 Web     │   │   FastAPI Core Engine │   │   PostgreSQL 16 Container │
   │      (พอร์ต 3000)      │   │       (พอร์ต 8001)     │   │        (พอร์ต 5435)        │
   │  http://localhost:3000│   │  http://localhost:8001│   │ 127.0.0.1:5435/central_iam│
   └───────────────────────┘   └───────────┬───────────┘   └───────────────────────────┘
                                           │
         ┌──────────────────┬──────────────┼────────────────┬──────────────────┬──────────────────┐
         ▼                  ▼              ▼                ▼                  ▼                  ▼
┌──────────────────┐ ┌─────────────┐ ┌───────────┐ ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  AD Sync Agent   │ │   IRM VPS   │ │  QMS/QOL  │ │  SAP B1 Service │ │Microsoft 365 │ │ pfSense 2.7.2    │
│   (พอร์ต 3100)    │ │(Hostinger)│ │(REST API) │ │Layer (waapps.net│ │ (Graph API)  │ │ (FreeBSD 14 REST)│
│192.168.12.11:3100│ │irm.window...│ │qms/qol... │ │sapb1.waapps.net │ │   Cloud M365 │ │  VPN & Firewall  │
└──────────────────┘ └─────────────┘ └───────────┘ └─────────────────┘ └──────────────┘ └──────────────────┘
```

| องค์ประกอบ | เทคโนโลยี | พอร์ต | URL / การเข้าถึง | บัญชีผู้ดูแล / สิทธิ์ |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend Portal** | Next.js 16 (Turbopack) | **3000** | [http://localhost:3000](http://localhost:3000) | `admin` / `admin123` |
| **Backend API** | FastAPI + Uvicorn | **8001** | [http://localhost:8001](http://localhost:8001)<br>Docs: [http://localhost:8001/docs](http://localhost:8001/docs) | Bearer JWT via `/api/v1/auth/login` |
| **Database** | PostgreSQL 16 Alpine | **5435** | `127.0.0.1:5435/central_iam` | `ciam_admin` / `ciam_secure_pass_2026` |
| **Active Directory** | Windows Domain Controller | **3100** | `http://192.168.12.11:3100` | App ID: `CIAM`, Group: `Domain Users` |
| **Microsoft 365** | Microsoft Graph API | Cloud | `https://graph.microsoft.com` | Tenant ID: `3bf476e6...` (Safe Read-Only) |
| **pfSense Firewall** | FreeBSD 14 / REST API | **443** | `https://<pfsense_ip>/api/v1` | REST API Key / OpenVPN / LDAPS Auth |

---

## 3. Quick Start Guide (คำสั่งเปิดระบบและเริ่มต้นใช้งาน)

เมื่อกลับมาพัฒนาต่อ ให้ทำตาม 3 ขั้นตอนนี้ใน PowerShell:

### ขั้นตอนที่ 1: ตรวจสอบฐานข้อมูล (PostgreSQL บน Docker)
```powershell
docker ps
# คอนเทนเนอร์ ciam-postgres ต้องกำลังทำงานอยู่ที่พอร์ต 5435
# หากยังไม่รัน ให้เปิดด้วยคำสั่ง:
cd d:\Python\Central-IAM
docker compose up -d
```

### ขั้นตอนที่ 2: รัน Backend (FastAPI Core Engine)
```powershell
cd d:\Python\Central-IAM\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
* **Swagger Documentation:** [http://localhost:8001/docs](http://localhost:8001/docs)
* **API Health Check:** [http://localhost:8001/](http://localhost:8001/)

### ขั้นตอนที่ 3: รัน Frontend (Next.js 16)
```powershell
cd d:\Python\Central-IAM\frontend
npm run dev
```
* **Web Application:** [http://localhost:3000](http://localhost:3000)
* **เข้าสู่ระบบผู้ดูแลระบบ:** `admin` / `admin123`

---

## 4. โครงสร้างไฟล์ที่ส่งมอบให้ทีมอื่นๆ (Handoff Artifacts by Team)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      WINDOW ASIA CENTRAL IAM HANDOFF MATRIX                       │
├─────────────────────────────────────────┬─────────────────────────────────────────┤
│ 🏢 1. ทีม AD Sync Agent (พอร์ต 3100)      │ 💻 2. ทีมพัฒนาระบบลูก (IRM/QMS/QOL/ERP) │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ 📄 AD_SYNC_AGENT_CIAM_EXTENSION.md      │ 📄 SPOKE_ENTERPRISE_INTEGRATION_...md   │
│    (สเปก API & คอนฟิก registry.json)     │    (สเปก SSO Zero-.env & M2M Sync)      │
│                                         │ 📄 SPOKE_SSO_INTEGRATION_GUIDE.md       │
│                                         │ 💻 spoke_sso_router.py (Router SDK)     │
│                                         │ 💻 ciam_sso_client.py (Client SDK)      │
├─────────────────────────────────────────┴─────────────────────────────────────────┤
│ 🛡️ 3. ทีมเครือข่ายและความปลอดภัยไฟร์วอลล์ (pfSense Network Admin)                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 📄 pfSense 2.7.2-RELEASE Integration Specification (LDAP Auth & pfSense-API REST)│
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. การตรวจสอบความสมบูรณ์ของระบบ (Verification Commands)

ก่อนเริ่มพัฒนาส่วนใหม่หรือหลังการแก้ไขโค้ด ให้รันชุดคำสั่งทดสอบดังนี้:

1. **ทดสอบ Backend Test Suite ครบวงจร:**
   ```powershell
   cd d:\Python\Central-IAM\backend
   .\.venv\Scripts\pytest.exe -v
   ```
   *ต้องผ่านครบ **22/22 tests passed (100%)***
2. **ทดสอบ Frontend TypeScript Compilation:**
   ```powershell
   cd d:\Python\Central-IAM\frontend
   npx tsc --noEmit
   ```
   *ต้องได้ผลลัพธ์ **0 errors***
3. **ทดสอบการทำงานของ M365 และ Directory API:**
   ```powershell
   powershell -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:8001/api/v1/directory/users?search=Chaiwat' | ConvertTo-Json -Depth 4"
   ```

---

## 6. แผนงานสำหรับรอบการพัฒนาถัดไป (Roadmap for Next Session)

เมื่อกลับมาพัฒนาระบบต่อ มีประเด็นสำคัญที่วางแผนไว้สำหรับดำเนินการปรับปรุง:

1. **การเชื่อมต่อ pfSense Connector ใน Central IAM (`PfSenseConnector`):**
   * เพิ่ม Connector คลาส `PfSenseConnector` ใน `backend/app/connectors/pfsense.py`
   * รองรับการเชื่อมต่อ REST API กับ pfSense ผ่าน `Authorization: Bearer <API_KEY>`
   * ดึงรายการ User และผูกเข้ากับ 1-Click Offboarding Hub เพื่อ Disable User หรือ Revoke OpenVPN Certificate อัตโนมัติ
   * เพิ่มตัวเลือก `PFSENSE` ลงใน `ApplicationType` และหน้า UI เพิ่มระบบใน `/applications`
2. **การตั้งค่า Silent Token Refresh ในระบบลูก (IRM / QMS):**
   * ในระบบลูก เช่น `D:\Python\IRM\frontend\src\lib\api.ts` เพิ่ม Axios Interceptor ส่ง `refresh_token` ไปขอ `access_token` ใหม่เมื่อเจอ Error 401 เพื่อให้เซสชันทำงานต่อเนื่องโดยไม่เด้งหลุด
3. **การนำระบบขึ้น Public Domain (Cloudflare Tunnel):**
   * กำหนดโดเมน เช่น `https://ciam.windowasia.com` เพื่อให้ Spoke Apps บน Hostinger VPS หรือ Cloud ยิง M2M API และ SSO Callback เข้ามาได้โดยไม่ต้องเปิดพอร์ตสาธารณะตรงๆ
4. **การทดสอบ End-to-End SSO Cutover กับ IRM Live:**
   * ทดสอบล็อกอินจริงผ่านปุ่ม `[ ⚡ เข้าสู่ระบบด้วย Window Asia SSO ]` จากหน้าเว็บ IRM ไปยังหน้า Central IAM Login แล้วส่งสิทธิ์กลับไปสร้างเซสชันที่สมบูรณ์
5. **การเปิดสวิตช์ Patch Active Directory จริง (Optional Switch):**
   * ทดสอบเปิดสวิตช์ `ad_allow_status_patch` บนหน้าจอ Applications เพื่อทดสอบการส่งคำสั่ง PowerShell `Disable-ADAccount` ไปยังเครื่อง Domain Controller จริงในสภาพแวดล้อม Staging
