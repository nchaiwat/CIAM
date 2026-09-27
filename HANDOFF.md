# Central-IAM — Project Handoff & Development Context

> **Date Updated:** 27 กันยายน 2026 (Local Time: ~10:50 ICT)  
> **Repository:** [https://github.com/nchaiwat/CIAM](https://github.com/nchaiwat/CIAM)  
> **Workspace Local:** `D:\Python\Central-IAM`  
> **Production VPS:** `/var/www/Ciam` (Linux Ubuntu, IP: `157.173.219.153`)

---

## 1. ภาพรวมระบบ (System Overview)
**Central-IAM** คือระบบบริหารจัดการตัวตนผู้ใช้งานศูนย์กลาง (Centralized Identity and Access Management) และ Single Sign-On (SSO) Portal ขององค์กร Window Asia ทำหน้าที่เป็นศูนย์กลางในการ:
1. **Master Identity Directory:** จัดเก็บและซิงค์ฐานข้อมูลตัวตนพนักงานศูนย์กลางจาก Active Directory (DC)
2. **Spoke Enterprise Connectors:** เชื่อมต่อกับระบบย่อยในองค์กร ได้แก่:
   - **Active Directory (AD DC Gateway):** ผ่าน REST Agent Gateway Port 3100 (`http://172.18.0.1:3100`) และ LDAP Direct Fallback
   - **SAP Business One (ERP):** เชื่อมต่อผ่าน SAP B1 Service Layer REST API (`https://sapb1.waapps.net/b1s/v2`)
   - **IRM System:** ระบบจัดซื้อ/ทรัพยากรภายใน เชื่อมต่อผ่าน REST API M2M
   - **Microsoft 365 (Entra ID / Exchange):** เชื่อมต่อผ่าน Microsoft Graph API
3. **Enterprise SSO Portal (`/portal`):** ระบบ Launchpad สำหรับให้พนักงาน Login ด้วยรหัสผ่าน AD และเปิดใช้งานระบบ Spoke ต่างๆ ผ่าน OIDC/OAuth2
4. **Automated Deprovisioning & Offboarding:** ปิดการใช้งานบัญชีทุกระบบพร้อมกันทันทีเมื่อพนักงานลาออก
5. **Reconciliation & Audit Logging:** ตรวจจับบัญชีแปลกปลอม (Ghost accounts) และเก็บประวัติความปลอดภัย

---

## 2. โครงสร้างและการ Deploy (Deployment & Architecture)

### บริการใน `docker-compose.yml`
| Service Name | บทบาท | Port ภายใน | Port ภายนอก | เทคโนโลยี | Volume Mounts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | PostgreSQL Database (v16 Alpine) | 5432 | 5438 | PostgreSQL | `ciam_pgdata:/var/lib/postgresql/data` |
| **`api`** | Backend Core API | 8001 | 8001 (Traefik) | FastAPI (Python 3.12), SQLAlchemy 2 | `./backend:/app`, `ciam_keys:/app/keys` |
| **`web`** | Frontend Web Dashboard & Portal | 3000 | 3000 (Traefik) | Next.js 14 (TypeScript, TailwindCSS) | - |

> ⚠️ **ข้อควรระวังสำคัญอย่างยิ่ง (Critical Deployment Rules):**  
> 1. ชื่อ Service ของ Frontend ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด)
> 2. Backend Service **`api`** มีการ mount `./backend:/app` แล้วใน Commit `ba03928` ทำให้การแก้ไข Python Code ใน `./backend` บน VPS จะถูกโหลดทันทีเมื่อสั่ง `docker compose restart api` โดยไม่ต้องเสียเวลา rebuild ทั้ง container ทุกครั้ง

### คำสั่งมาตรฐานสำหรับ Deploy / Update บน VPS (`/var/www/Ciam`):
```bash
cd /var/www/Ciam
git pull origin main
docker compose up -d api web
```

---

## 3. สรุปความคืบหน้าและการแก้ไขล่าสุด (Recent Progress & Key Commits)

### 1) การแก้ปัญหา SAP Business One Service Layer (Complete & Verified)
- **ปัญหาเดิม:** 
  1. การยิง API ไปยัง SAP Service Layer ติด `HTTP 401 code 300 (Authorization header not found)`
  2. โดนจำกัดไว้แค่ `$top=10` ทำให้ดึงข้อมูลได้ไม่ครบ
  3. รายชื่อบัญชีที่ดึงมาไม่มี User ERP ในรูปแบบ `Firstname.L` (เช่น `Chaiwat.N`) และสถานะ Locked ไม่ถูกต้อง
- **การแก้ไข:**
  - **Commit `89da958`:** แก้ไขการทำความสะอาด `base_url` ด้วย Regex `re.sub(r'/b1s(/v[12])?(/.*)?$', '', raw_base_url)` กำจัดบั๊กที่ URL มี `/Login` ต่อท้าย ซึ่งทำให้คำขอ GET วิ่งไปชน `/b1s/v2/Login/b1s/v2/Users` และถูกปฏิเสธด้วย 401
  - **Commit `fc1f084`:** ปลดล็อก `$top=10` และเพิ่มระบบ Pagination ติดตาม `@odata.nextLink` สูงสุด 100 หน้า ดึงข้อมูลได้ครบถ้วน 308 รายการ
  - **Commit `b513510`:** ปรับ Priority ให้ดึงข้อมูลจาก `/b1s/v2/Users` ก่อน `/b1s/v2/EmployeesInfo` ทำให้ได้ Username รูปแบบเดียวกับ AD (`Chaiwat.N`) พร้อมสถานะ `Locked` ที่ถูกต้องตามระบบ ERP จริง

---

### 2) ปัญหาตัวเลขนับบัญชี Active Directory ไม่ตรงกับ Live Inventory (279 ➔ 225 ➔ 195)
- **อาการที่พบ:**
  - เมื่อคลิกปุ่ม **"ดูบัญชีสด"** (Live Inventory) Modal แสดงผล **195 Accounts**
  - แต่การ์ดระบบหน้า Applications หัวข้อ **"จำนวนบัญชีที่ผูก"** แสดง **279 บัญชี** และพอกดซิงก์รอบแรกลดลงมาเหลือ **225 บัญชี** แต่ไม่ยอมลงไปที่ **195 บัญชี**
  - และพอกดซิงก์รอบถัดมา เกิดข้อผิดพลาด **`API Error [500]: Internal Server Error`**
- **การวิเคราะห์ Root Cause 4 จุด:**
  1. **Stale Mappings (279 ➔ 225):** ระบบในอดีตเคย Sync บัญชี service/computer accounts มาเก็บไว้ 279 บัญชี แก้ไขโดยเพิ่ม Stale Mapping Pruning (`~func.trim(func.lower(AppAccountMapping.app_username)).in_(live_usernames)`) ลบออกไปได้ 54 บัญชี เหลือ 225 บัญชี
  2. **Duplicate Case-Sensitive Rows (225 - 195 = 30):** ใน PostgreSQL ตาราง `app_account_mappings` มี **30 แถวซ้ำ** ที่เกิดจากตัวพิมพ์เล็ก/ใหญ่ต่างกัน (เช่น `Chaiwat.N` กับ `chaiwat.n`) เนื่องจากเดิมค้นหาด้วย `== uname` แบบ Case-sensitive เมื่อรันคำสั่ง `NOT IN` ทั้งสองตัวอยู่ใน live list จึงไม่มีแถวใดถูกลบ
  3. **Docker Container Not Reloading Code:** บน VPS คอนเทนเนอร์ไม่ได้ mount `./backend` คำสั่ง `docker compose restart api` จึงรัน Image เก่าตลอดเวลา
  4. **SQLAlchemy Order-of-Execution Causing Error 500:** เมื่อ Docker โหลดโค้ด Deduplicate ใหม่ กลไก Unit-of-Work ของ SQLAlchemy รัน `UPDATE` ก่อน `DELETE` เสมอ เมื่อพยายาม update ชื่อ `Chaiwat.N` ➔ `chaiwat.n` ขณะที่แถวคู่แฝดยังไม่ถูกลบออกจากตาราง PostgreSQL จึงเกิด **`UniqueViolation: duplicate key value violates unique constraint "uq_app_username_per_app"`** ส่งผลให้เป็น Error 500
- **การแก้ไขใน Commit `ba03928` และ `8fd9a5d`:**
  - เพิ่ม Volume Mount `./backend:/app` ใน `docker-compose.yml`
  - ปรับการค้นหาและ Deduplicate ใน [`applications.py`](file:///d:/Python/Central-IAM/backend/app/api/v1/applications.py) และ [`scheduler.py`](file:///d:/Python/Central-IAM/backend/app/services/scheduler.py):
    1. ตรวจสอบแถวซ้ำด้วย `func.lower(AppAccountMapping.app_username) == uname.lower()`
    2. คัดเลือกแถวที่มีตัวสะกดตรงเป๊ะ (`app_username == uname`) มาใช้งานทันทีโดยไม่ต้อง rename
    3. บังคับสั่ง `db.delete(dup)` และ **`db.flush()` ทันที** เพื่อลบแถวแฝดออกจาก PostgreSQL ก่อนจะแตะต้องแถวหลัก ป้องกัน Unique Key Violation 100%
    4. รันรอบกวาดล้างครั้งสุดท้าย (`all_app_mappings`) ลบแถวซ้ำที่เหลือ
    5. ครอบการทำงานด้วย `try ... except ... db.rollback()` เพื่อความปลอดภัยของ DB Transaction

---

## 4. สถานะ Git ล่าสุด (Current Git State)
- **Branch:** `main`
- **Head Commit:** [`8fd9a5d`](https://github.com/nchaiwat/CIAM/commit/8fd9a5d) - `fix(sync): immediate flush on duplicate deletion to prevent unique constraint conflict on update`
- **Working Tree:** สะอาด (Clean) ไม่มี uncommitted changes

---

## 5. สิ่งที่ต้องทำต่อเมื่อกลับมาทำงาน (Next Steps to Resume)

### ขั้นตอนที่ 1: อัปเดตและทดสอบ Sync บน VPS
เข้า VPS และรันคำสั่ง:
```bash
cd /var/www/Ciam
git pull origin main
docker compose restart api
```
จากนั้น:
1. เปิดหน้าเว็บ Central-IAM ➔ เมนู **Applications**
2. คลิกปุ่ม **"ซิงก์"** ที่การ์ด **Active Directory (DC Gateway)**
3. ตรวจสอบ:
   - Toast ขึ้นแจ้งเตือนซิงก์สำเร็จ (ดึงข้อมูล 195 บัญชี)
   - ตัวเลข **"จำนวนบัญชีที่ผูก"** เปลี่ยนจาก 225 บัญชี เป็น **195 บัญชี** เท่ากับรายการบัญชีสดในปุ่ม "ดูบัญชีสด"

### ขั้นตอนที่ 2: ตรวจสอบ Spoke อื่นๆ (SAP B1, IRM)
1. กด "ซิงก์" ที่การ์ด **SAP Business One** ตรวจสอบว่าจำนวนบัญชีที่ผูกตรงกับจำนวน Users จาก SAP Service Layer
2. กด "ซิงก์" ที่การ์ด **IRM**
3. ตรวจสอบว่าระบบไม่มี Spoke ใดมีปัญหา Duplicate Mapping หรือ Stale Mapping ค้างอีก

### ขั้นตอนที่ 3: Single Sign-On (SSO) Portal & Offboarding Verification
1. ทดสอบ Login พนักงานทั่วไปเข้าหน้า `/portal`
2. ทดสอบ Launch แอปพลิเคชันผ่าน OIDC
3. ทดสอบการรัน Offboard พนักงาน 1 คน และตรวจสอบว่าส่งคำสั่ง Lock ไปยัง AD และ SAP B1 สำเร็จทั้งคู่
