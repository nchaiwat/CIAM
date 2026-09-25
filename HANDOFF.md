# Central-IAM — Project Handoff & Development Context

> **Date:** 25 กันยายน 2026 (Local Time: ~21:45 ICT)  
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
- **ปัญหาเดิม:** เมื่อพนักงานหรือ Admin ที่มีบัญชีอยู่บน Active Directory (เช่น `Chaiwat.N`) เข้าใช้งานผ่านหน้า Login ระบบตรวจสอบเฉพาะตาราง `AdminUser` ในฐานข้อมูลท้องถิ่น ทำให้ฟ้อง `ADMIN_LOGIN_FAILED | User not found in Central IAM Admin directory`
- **การแก้ไข (Commit `d855850`):**
  - เพิ่ม Fallback ให้ตรวจสอบรหัสผ่านคู่ขนานกับ **Active Directory Gateway (`/api/v2/login`)**
  - หาก Authen ผ่าน AD สำเร็จ:
    - ถ้าเป็นบัญชีผู้ดูแลระบบ (`Chaiwat.N` / `admin`) จะได้สิทธิ์ `SUPER_ADMIN` และเข้า Dashboard หลัก (`/`)
    - ถ้าเป็นพนักงานทั่วไป จะได้สิทธิ์ `PORTAL_USER` และ Redirect ไปยังหน้า SSO Portal (`/portal`) ทันที

### 2) การแก้ไข Spoke SAP Business One (`sap_b1.py`)
- **ปัญหาเดิม:** 
  1. เมื่อทดสอบบน VPS การยิงดึงบัญชีจาก SAP B1 Service Layer ผ่าน Domain `https://sapb1.waapps.net` มีปัญหาติด `HTTP 401 code 300 (Authorization header not found)`
  2. โค้ดมี Fallback ชั่วคราวที่ดึงเอา `MasterIdentity` (ซึ่งเป็นบัญชี AD เช่น `uploader`, `Test_Sale1`, `Patcharakorn.T`) มาแสดงแทน ทำให้เกิดการสับสน
- **การแก้ไข (Commit `901a09a`):**
  - **ตัด Fallback ของ MasterIdentity ออก 100%:** บังคับใช้ **Strict Spoke Isolation Rule** ว่าแต่ละ Spoke จะต้องแสดงผลเฉพาะบัญชีที่ดึงสดมาจากระบบนั้นๆ เท่านั้น ห้ามนำบัญชีจากระบบอื่นมาปน
  - **ใส่ `$select=UserCode,UserName,eMail,Department,Locked`:** ช่วยให้ Service Layer query ข้อมูลผู้ใช้จากตาราง `OUSR` ได้รวดเร็ว และไม่ถูกบล็อกด้วย permission ย่อย
  - **จัดการ Cookie Domain อัตโนมัติ:** ใช้ `requests.Session` จัดเก็บและส่ง `B1SESSION` + `ROUTEID` ไปยัง Domain ปลายทางโดยอัตโนมัติแบบเดียวกับในสคริปต์ `POS2Invoice` ที่ใช้งานได้บน Production

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

1. **ทดสอบ SAP B1 Live Query บน VPS:**
   - ตรวจสอบการดึงรายชื่อผู้ใช้สดใน SAP B1 Spoke ด้วยบัญชี Admin/Superuser ของ SAP
   - ตรวจสอบการแสดงผลสถานะ Active/Disactive ของ User ใน SAP B1
2. **SSO Portal App Launcher & Single Sign-On:**
   - ทดสอบการกด Launch Application จากหน้า `/portal` ไปยังระบบต่างๆ เช่น IRM ด้วย OIDC Token
   - ปรับแต่งหน้า Portal ให้แสดงเฉพาะ Application ที่ผู้ใช้ได้รับสิทธิ์ (Mapped Roles)
3. **Deprovisioning / Offboarding Flow:**
   - ทดสอบการกด Offboard พนักงาน 1 คน และตรวจสอบว่าระบบส่งคำสั่ง deprovision ไปยัง AD, SAP B1, และ IRM ครบทุก Spoke หรือไม่
4. **Audit Trail & Reporting:**
   - ตรวจสอบหน้า Logs และบันทึกประวัติการเข้าใช้งาน (Login Events) และประวัติการเปลี่ยนแปลงสิทธิ์ (Sync/Deprovision Events)

---

> 📌 **สรุปสถานะล่าสุด:** Code ทั้งหมดได้รับการ Commit และ Push ขึ้นสาขา `main` เรียบร้อยแล้ว (Latest Commit: `901a09a`). เมื่อกลับมาทำงานต่อ สามารถดึงสถานะนี้ขึ้นมาพัฒนาต่อได้ทันทีครับ!
