# Central-IAM — Project Handoff & Development Context

> **Date:** 26 กันยายน 2026 (Local Time: ~15:05 ICT)  
> **Repository:** [https://github.com/nchaiwat/CIAM](https://github.com/nchaiwat/CIAM)  
> **Workspace Local:** `D:\Python\Central-IAM`  
> **Production VPS:** `/var/www/Ciam` (Linux Ubuntu)

---

## 1. ภาพรวมระบบ (System Overview)
**Central-IAM** คือระบบบริหารจัดการตัวตนผู้ใช้งานศูนย์กลาง (Centralized Identity and Access Management) และ Single Sign-On (SSO) Portal ขององค์กร Window Asia ทำหน้าที่เป็นศูนย์กลางในการ:
1. **Master Identity Directory:** จัดเก็บและซิงค์ฐานข้อมูลตัวตนพนักงานศูนย์กลางจาก Active Directory (DC)
2. **Spoke Enterprise Connectors:** เชื่อมต่อกับระบบย่อยในองค์กร ได้แก่:
   - **Active Directory (AD DC Gateway):** ผ่าน REST Agent Gateway Port 3100
   - **SAP Business One (ERP):** เชื่อมต่อผ่าน SAP B1 Service Layer REST API (`/b1s/v2`)
   - **IRM System:** ระบบจัดซื้อ/ทรัพยากรภายใน เชื่อมต่อผ่าน REST API M2M
   - **Microsoft 365 (Entra ID / Exchange):** เชื่อมต่อผ่าน Microsoft Graph API
3. **Enterprise SSO Portal (`/portal`):** ระบบ Launchpad สำหรับให้พนักงาน Login ด้วยรหัสผ่าน AD และกดเปิดเข้าใช้งานระบบ Spoke ต่างๆ ได้ผ่าน OIDC/OAuth2
4. **Automated Deprovisioning & Offboarding:** ปิดการใช้งานบัญชีทุกระบบพร้อมกันทันทีเมื่อพนักงานลาออก
5. **Reconciliation & Audit Logging:** ตรวจจับบัญชีแปลกปลอม (Ghost accounts) และเก็บประวัติการทำงานความปลอดภัย

---

## 2. โครงสร้างและการ Deploy (Deployment & Architecture)

### บริการใน `docker-compose.yml`
| Service Name | บทบาท | Port ภายใน | Port ภายนอก | เทคโนโลยี |
| :--- | :--- | :--- | :--- | :--- |
| **`api`** | Backend Core API | 8000 | 8000 (ผ่าน Reverse Proxy) | FastAPI (Python 3.11+), SQLite/SQLAlchemy |
| **`web`** | Frontend Web Dashboard & Portal | 3000 | 3000 (ผ่าน Reverse Proxy) | Next.js 14 (TypeScript, TailwindCSS) |

> ⚠️ **ข้อควรระวังสำคัญอย่างยิ่ง (Critical Deployment Rule):**  
> ชื่อ Service ของ Frontend ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด เพราะจะเกิดข้อผิดพลาด `no such service: frontend`)

### คำสั่งมาตรฐานสำหรับ Deploy / Update บน VPS (`/var/www/Ciam`):
```bash
cd /var/www/Ciam
git pull
docker compose build api web
docker compose up -d api web
```

---

## 3. สถานะการพัฒนางานล่าสุด (Recent Progress & Key Commits)

### 1) การแก้ไข Authentication & SSO Login (`auth.py` & `login/page.tsx`)
- **การแก้ไข (Commit `d855850` & `fdabed3`):**
  - เพิ่ม Fallback ให้ตรวจสอบรหัสผ่านคู่ขนานกับ **Active Directory Gateway (`/api/v2/login`)**
  - **ส่ง Security Headers ครบถ้วน:** ส่ง `X-App-Id`, `X-Secret-Key`, `X-Management-API-Key`, `X-Request-Timestamp`, `X-Forwarded-For`
  - **Flexible Response Evaluation:** ตรวจสอบทั้ง `success: true`, `authenticated: true`, `status: "success"`, `code: 200` และ User Data Object
  - **Case-Insensitive & Clean Username:** ตัด Domain Prefix (`wa\`) และ Suffix (`@windowasia.com`) ออก และค้นหาด้วย `ilike`
  - **Role & Portal Redirect (ข้อกำหนดข้อ 3):**
    - บัญชี Admin (`Chaiwat.N`, `admin`, `superadmin`) ได้สิทธิ์ `SUPER_ADMIN` และเข้าสู่ Dashboard หลัก (`/`)
    - พนักงานทั่วไปได้สิทธิ์ `PORTAL_USER` และ Redirect ไปยังหน้า SSO Portal (`/portal`) ทันทีเพื่อ Launch แอปอื่นๆ ผ่าน OIDC โดยไม่ต้องพึ่งพาการดึง List ทั้งหมดจาก AD

### 2) การแก้ไข Spoke SAP Business One (`sap_b1.py`)
- **ปัญหาเดิม:** 
  1. เมื่อทดสอบบน VPS การยิงดึงบัญชีจาก SAP B1 Service Layer ติด `HTTP 401 code 300 (Authorization header not found)`
  2. มีการเรียก `session.cookies.set(...)` ซ้ำซ้อนลงใน Jar หลายครั้ง ทำให้ส่งคุกกี้ `B1SESSION` ซ้ำ 3 ตัว ส่งผลให้ Apache LB ของ SAP Service Layer ปฏิเสธ
- **การแก้ไข (Commit `901a09a` & `fdabed3`):**
  - **แก้ไข Cookie Handling:** ปล่อยให้ `requests.Session` บริหารจัดการ Cookie ตามธรรมชาติแบบเดียวกับ `POS2Invoice` ที่ใช้งานได้บน Production และป้องกันไม่ให้เกิดคุกกี้ซ้ำซ้อน
  - **Superuser vs EmployeesInfo Fallback:** เนื่องจาก Endpoint `/b1s/v2/Users` (ตาราง `OUSR`) ต้องใช้สิทธิ์ Superuser หากผู้ใช้ SAP ที่นำมาเชื่อมต่อไม่ใช่ Superuser ระบบจะ Fallback ไปดึงจาก `/b1s/v2/EmployeesInfo` (ตาราง `OHEM` พนักงาน) ซึ่งเป็นสิทธิ์ทั่วไปให้อัตโนมัติ
  - **Strict Spoke Isolation:** ดึงเฉพาะบัญชีจริงจาก SAP B1 ไม่นำ MasterIdentity หรือ AD มาปน

### 3) การแก้ไข Factory & AD Proxy (`factory.py` & `ad_proxy.py`)
- เพิ่ม `from app.core.config import settings` ใน `factory.py`
- ตัด `/api/v2/login` ออกจาก `base_url` ใน `ad_proxy.py` อัตโนมัติ

---

## 4. กฎเหล็กและข้อกำหนดสำคัญ (Strict Architecture Rules)

1. **Strict Spoke Isolation (ห้ามนำ User ข้ามระบบมาปะปน):**
   - Modal หรือหน้ารายชื่อบัญชีของ Spoke ใด (เช่น SAP B1, IRM, AD) จะต้องแสดงผลเฉพาะบัญชีที่มีอยู่ในระบบปลายทางนั้นจริงๆ เท่านั้น
   - ห้ามทำ Fallback ดึง Master Identity หรือ Active Directory มาแสดงในหน้าต่างของ SAP B1 หรือ IRM โดยเด็ดขาด หากระบบปลายทางเชื่อมต่อไม่ได้ ให้แสดง Error จริงของระบบนั้นๆ
2. **VPS Service Names:**
   - Backend = `api`
   - Frontend = `web`
3. **Central Directory Reconciliation:**
   - การเชื่อมโยง Identity ข้ามระบบต้องเกิดขึ้นผ่านตาราง `AppAccountMapping` (เชื่อม `MasterIdentity` กับ Spoke App ID) เท่านั้น ไม่ปะปนในระดับ Connector

---

## 5. แผนงานสำหรับพัฒนาต่อ (Next Steps)

1. **ทดสอบ Login และ SAP B1 บน VPS:**
   - อัปเดต Backend ด้วยคำสั่ง `docker compose build api && docker compose up -d api`
   - ทดสอบล็อกอินด้วยบัญชี AD `Chaiwat.N` และบัญชีพนักงานทั่วไป
   - ทดสอบการดึงข้อมูลบัญชีผู้ใช้สดในหน้า SAP B1 Spoke
2. **SSO Portal App Launcher & Single Sign-On:**
   - ทดสอบการกด Launch Application จากหน้า `/portal` ไปยังระบบต่างๆ เช่น IRM ด้วย OIDC Token
   - ปรับแต่งหน้า Portal ให้แสดงเฉพาะ Application ที่ผู้ใช้ได้รับสิทธิ์ (Mapped Roles)
3. **Deprovisioning / Offboarding Flow:**
   - ทดสอบการกด Offboard พนักงาน 1 คน และตรวจสอบว่าระบบส่งคำสั่ง deprovision ไปยัง AD, SAP B1, และ IRM ครบทุก Spoke หรือไม่
4. **Audit Trail & Reporting:**
   - ตรวจสอบหน้า Logs และบันทึกประวัติการเข้าใช้งาน (Login Events) และประวัติการเปลี่ยนแปลงสิทธิ์ (Sync/Deprovision Events)

---

> 📌 **สรุปสถานะล่าสุด:** Code ทั้งหมดได้รับการ Commit และ Push ขึ้นสาขา `main` เรียบร้อยแล้ว (Latest Commit: `fdabed3`).  
> **คำสั่ง Deploy บน VPS (`/var/www/Ciam`):**
> ```bash
> cd /var/www/Ciam
> git pull
> docker compose build api
> docker compose up -d api
> ```

