# Central-IAM — Project Handoff & Development Context

> **Date Updated:** 10 ตุลาคม 2026 (Local Time: ~09:30 ICT)  
> **Repository (CIAM):** [https://github.com/nchaiwat/CIAM](https://github.com/nchaiwat/CIAM)  
> **Repository (IRM):** [https://github.com/nchaiwat/IRM](https://github.com/nchaiwat/IRM)  
> **Workspace Local:** `D:\Python\Central-IAM` และ `D:\Python\IRM`  
> **Production VPS (CIAM):** `/var/www/Ciam` (Linux Ubuntu, IP: `157.173.219.153`)  
> **Production VPS (IRM):** `/var/www/Irm` (Hostinger VPS)

---

## 0.00 อัปเดตล่าสุด: เพิ่มปุ่มและฟังก์ชันดาวน์โหลดทะเบียนผู้ใช้เป็น Excel (.xlsx) พร้อมไอคอน Excel (/directory) (10 ต.ค. 2026)
### รายละเอียดฟีเจอร์การส่งออก Excel:
1. **ไอคอน Microsoft Excel เฉพาะตัว (Custom Green Spreadsheet Icon):**
   - ออกแบบไอคอน SVG คมชัดสีเขียวเข้มสไตล์ Microsoft Excel พร้อมตัวอักษร X และตารางสเปรดชีต
   - วางปุ่มดาวน์โหลดใน 2 จุดยุทธศาสตร์ที่เข้าถึงง่าย:
     1. **Header Action Bar:** วางเคียงข้างปุ่ม `+ เพิ่มผู้ใช้` และ `ศูนย์ระงับสิทธิ์`
     2. **Search & Filter Toolbar:** วางถัดจากปุ่ม `ค้นหา` สะดวกต่อการค้นหา/กรองแล้วกดดาวน์โหลดทันที
2. **การรวบรวมข้อมูลครบถ้วน 17 คอลัมน์ (Comprehensive Columns):**
   - ลำดับ, รหัสพนักงาน, Username, ชื่อ-นามสกุล, อีเมล, แผนก, เบอร์โทรศัพท์, Telegram ID
   - สถานะใน Active Directory (`Active` / `Inactive`)
   - บทบาทใน CIAM (`Super Admin`, `Power User`, `IT Helpdesk`, `Auditor`, `Portal User`)
   - จำนวนระบบลูก และรายชื่อระบบลูกที่ผูกสิทธิ์ (Spokes)
   - รายละเอียดสิทธิ์รายระบบ (แสดงทั้งสถานะ Active/Inactive และประเภท SSO/Direct)
   - สถานะความผิดปกติ (Discrepancy / บัญชีตกค้าง)
   - สถานะการได้รับข้อยกเว้น (Exception Type)
   - ประวัติการเข้าสู่ระบบ AD ล่าสุด, ประวัติเข้าใช้งานระบบลูกล่าสุด, และวันที่บันทึก
3. **การจัดฟอร์แมตเอกสาร Excel:**
   - ปรับความกว้างคอลัมน์อัตโนมัติ (`!cols` auto-width) เพื่อให้อ่านง่ายเมื่อเปิดใน Microsoft Excel หรือ Google Sheets
   - ตั้งชื่อไฟล์อัตโนมัติระบุระบบที่กรองและวันที่ปัจจุบัน: `CIAM_User_Directory_[APP]_[YYYY-MM-DD].xlsx`
- **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## 0.0 อัปเดตก่อนหน้า: Data Analytics & Spoke Accounts Breakdown & IAM Operational KPIs (/page.tsx, /applications) (10 ต.ค. 2026)
### รายละเอียดฟีเจอร์และการวิเคราะห์ข้อมูล (KPI & Roadmap):
1. **การแจกแจงสัดส่วนบัญชีแต่ละระบบลูก (Spoke Account Breakdown):**
   - **Backend API (`GET /api/v1/applications`):** เชื่อมโยง `AppAccountMapping` เข้ากับ `MasterIdentity` เพื่อประมวลผลตัวเลขจริงแบบเรียลไทม์:
     - `active_accounts_count`: บัญชีที่มีสิทธิ์ใช้งานจริงในแอป
     - `inactive_accounts_count`: บัญชีที่ถูกระงับสิทธิ์ (Disabled/Suspended)
     - `synced_ad_accounts_count`: บัญชีที่ผูกกับตัวตน AD องค์กรและสถานะ In-Sync
     - `unsynced_ad_accounts_count`: บัญชีที่สถานะไม่สอดคล้องกับ AD (รอ Reconcile)
     - `local_accounts_count`: บัญชี Local/Service Account เฉพาะระบบ ที่ไม่มีตัวตน AD
   - **Frontend UI (`/page.tsx`):** เพิ่มโหมดสลับมุมมอง 3 มิติ:
     - 🔵 **มิติ AD Sync & Local:** แสดงสัดส่วนแถบ 3 สี (น้ำเงิน = AD Synced, ส้ม = Pending Sync, เทาเข้ม = Local Account)
     - 🟢 **มิติ Active / Inactive:** แสดงสัดส่วนแถบ 2 สี (เขียว = Active, เทา = Inactive/Suspended)
     - 📋 **ตาราง Matrix:** ตารางเปรียบเทียบทุกมิติพร้อมป้ายสถานะ Badge และ Action Link เข้าสู่การจัดการ
2. **IAM Data Analytics & Operational KPIs:**
   - **AD Coverage Ratio (อัตราการผูก AD):** วัดการกำจัด Silo บัญชีแบบดั้งเดิม
   - **Deprovision Backlog (สัดส่วนบัญชี Inactive ค้าง):** ตรวจจับบัญชีที่พ้นสภาพแต่ยังไม่ถูก Revoke ออกจากระบบลูก
   - **SSO Adoption Rate:** สัดส่วนระบบลูกที่รองรับ Centralized SSO
3. **IAM Strategic Improvement Roadmap (จุดที่จะนำไปพัฒนา ปรับปรุงต่อ):**
   - 🛡️ **Shadow Account Elimination:** แผนลดบัญชี Local บน SAP B1 และ Spoke ต่างๆ
   - ⚡ **Inactive Deprovision Backlog:** แผนล้างบัญชี Inactive ค้างท่อเพื่อลดค่าใช้จ่าย License
   - 🚀 **SSO Modernization Roadmap:** ยกระดับ QMS และระบบ Direct Connector สู่ OIDC SSO Standard
- **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## 0.1 อัปเดตก่อนหน้า: ปรับปรุงหน้าแสดงทะเบียนผู้ใช้ (/directory), Header กะทัดรัด Sticky Freeze, และแดชบอร์ดกราฟวิเคราะห์ (/page.tsx) (10 ต.ค. 2026)
### รายการปรับปรุงตามความต้องการของผู้ใช้ (9 ข้อ):
1. **ช่องสถานะ AD (`/directory`):** เปลี่ยนจากป้ายตัวหนังสือ `Active`/`Inactive` เป็นจุดกลมคลีน:
   - 🟢 **กลมสีเขียว (พัลส์เรืองแสง):** เมื่อเปิดใช้งานใน AD (`is_active_in_ad == true`)
   - ⚪ **กลมสีเทา:** เมื่อปิดใช้งานใน AD หรือไม่มีบัญชีใน AD
2. **สิทธิ์ระบบลูก (`/directory`):** แยกการแสดงผลชัดเจนระหว่างระบบที่ **รองรับ SSO (ป้ายฟ้า `SSO`)** กับระบบที่ **Non-SSO / Direct (ป้ายเทา `Direct`)**
3. **คอลัมน์การจัดการ (`/directory`):** รวมทุกปุ่มกระจัดกระจาย (`ผูกกับ AD`, `อนุมัติยกเว้น`, `คืนสิทธิ์`, `ดูสิทธิ์`, `ระงับสิทธิ์`) ให้เหลือ **ปุ่มเดียว `[ จัดการสิทธิ์ ⚙️ ]`** โดยเมื่อกดจะเปิด Popup ที่มีเครื่องมือจัดการครบถ้วนทุกฟังก์ชัน
4. **คำอธิบายเรื่องแผนก:** 
   - Central IAM ยึดแผนกจาก Active Directory (`wa.net`) หรือตอนสร้างผู้ใช้ในระบบ CIAM (`MasterIdentity.department`) เป็น Single Source of Truth
   - ระบบลูกที่ซิงก์กลับมาจะไม่สามารถเขียนทับแผนกของ Master Identity ได้หากมีอยู่แล้ว จึง **ไม่เกิด Conflict ข้ามระบบ**
5. **ย่อ Header เล็กลง 50% และ Freeze ส่วนหัว:**
   - ย่อแถบ Header หลักจาก `h-16` (64px) เหลือ `h-11` (44px)
   - ตัดช่องว่างด้านบนและระหว่าง Header/KPI Cards/Toolbar ออก (เปลี่ยน `space-y-6` เป็น `space-y-2`, ลด padding ใน `AppShell.tsx`, และปรับการ์ด KPI เป็น single-row pills ~30px) คืนพื้นที่แสดงผลตารางได้เพิ่มขึ้นอีกเกือบเท่าตัว
   - ตรึง Search/Filter Toolbar (`sticky top-11 z-20`) และหัวตาราง `<thead>` (`sticky top-0 z-10`) ให้อยู่กับที่เมื่อเลื่อน Scroll ข้อมูลลงมาด้านล่าง
6. **คงค่าสถานะตัวกรอง (Sticky Filter Persistence):** จดจำค่าที่เลือก (`statusFilter`, `appFilter`, `ghostOnly`) ลงใน `localStorage` เข้ามาใหม่ค่าเดิมยังอยู่ครบ
7. **ปุ่มออกจากระบบ:** ปรับเป็นไอคอนรูปประตู (`LogOut`) เพียงอย่างเดียว ไม่มีข้อความตัวหนังสือ
8. **สถานะ AD Sync Agent บน Header:** แสดงปุ่มสถานะสีเขียว 🟢 `AD Sync Agent: ONLINE (2ms)` พร้อมตรวจจับ Latency อัตโนมัติทุก 30 วินาที
9. **เปลี่ยนหน้าแรกเป็น Graphs & Analytics Dashboard (`/`):**
   - **Donut Graph (SVG):** สัดส่วนระบบลูก SSO vs Non-SSO และเปอร์เซ็นต์ Adoption
   - **Horizontal Bar Graph:** จำนวนและสัดส่วนบัญชีในแต่ละระบบลูก (Accounts per Spoke)
   - **Security Architecture Matrix:** ข้อมูล Gateway 3100, OIDC PKCE และ Audit Trail
   - ถอด Recent Activity Feed ด้านล่างออกเพื่อความสะอาดตาตามคำสั่ง
- **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## 0.1 อัปเดตก่อนหน้า (10 ต.ค. 2026): แก้ไขปัญหา QOL Account ขึ้น AD Disable, Wimonpan.P/Ronnakorn.P ถูก Auto-Disable และถอด Rogue Autonomous Loop ออกถาวร
### ปัญหาที่พบและสาเหตุรากเหง้า (Root Cause Analysis):
1. **บัญชีบน QOL (เช่น `Patcharakorn.T`, `Thidarat.S`, `Patsara.P`, `Worakit.K`, `Natthaset.S`, `Sompon.P`, `Punyanut.T`, `Supitchaya.P`) ที่เป็นบัญชีใน AD แต่แสดงสถานะ AD เป็น Inactive และติดป้าย "บัญชีผี" (Ghost Account):**
   - **สาเหตุ 1 (Sync Stale Absence Bug เดิม):** บัญชีเหล่านี้เคยถูกโค้ดซิงก์รอบ 04:00 น. เดิมตั้ง `is_active_in_ad = False` ค้างในฐานข้อมูล เมื่อ AD Sync ส่งข้อมูลมาไม่ครบ
   - **สาเหตุ 2 (Auto-Heal บังคับ Email):** ใน `initial_data.py` ฟังก์ชัน Auto-Heal เดิมมีเงื่อนไข `(has_corp_dept and has_corp_email)` ซึ่งบังคับว่าต้องมี email `@windowasia.com` แต่ผู้ใช้จาก QOL ที่ซิงก์เข้ามานั้นมี email เป็น `None` (แสดงผล `N/A`) ทำให้ระบบ Auto-Heal ข้ามพนักงานกลุ่ม Sale/Sale Admin ไปทั้งหมด
2. **บัญชี `Wimonpan.P` และ `Ronnakorn.P` อยู่ดีๆ CIAM สั่ง Disable ทั้ง AD และ MTPulse ไปเอง:**
   - **สาเหตุ (Rogue Auto-Disable Feedback Loop ใน `agent.py`):** ใน `agent.py` (Mode C Reverse Heartbeat) มีบล็อกโค้ดที่ตรวจสอบว่า หาก `ident and not ident.is_active_in_ad` ให้ CIAM **สร้างคำสั่ง `DISABLE_USER` ส่งกลับไปให้ MTPulse อัตโนมัติทันที** โดยที่ไม่มี Admin สั่งการใดๆ! เมื่อ MTPulse ได้รับคำสั่งจึงสั่งระงับสิทธิ์ในเครื่องตนเอง แล้วรายงานกลับมาเป็น Inactive เกิดลูกโซ่ทำลายล้างอัตโนมัติ

### การแก้ไขและปรับปรุงถาวร:
1. **ถอด Rogue Auto-Disable Loop ใน `agent.py` ออก 100%:**
   - การส่งคำสั่ง `DISABLE_USER` ไปยังระบบลูกจะเกิดขึ้นได้ **เฉพาะเมื่อ Admin สั่ง 1-Click Offboard หรือสั่งระงับสิทธิ์เฉพาะระบบผ่านหน้าจอเท่านั้น** (ผ่านคิว `spoke_pending_commands`) ยกเลิกการแอบสร้างคำสั่ง Disable อัตโนมัติใน Heartbeat
   - เมื่อ Agent ส่งบัญชีใหม่เข้ามา ให้ตรวจจับความเป็น Corporate Identity จากทั้ง Email, Format พนักงาน (`Firstname.L`) และแผนกองค์กร โดยตั้ง `is_active_in_ad = True` อัตโนมัติ
2. **ปรับปรุง Auto-Heal ใน `initial_data.py` ครอบคลุม 100%:**
   - คลายเงื่อนไข Auto-Heal: หากมีแผนกองค์กร (Sale, Sale Admin, IT, PU, ฯลฯ) หรือ Username format `Firstname.L` หรือมีบัญชีในระบบงานลูก (QOL, IRM, M365, SAP B1) ระบบจะกู้คืนเป็น `is_active_in_ad = True` ทันทีโดยไม่ต้องมี Email
   - เติม Email อัตโนมัติ `username@windowasia.com` ให้กับตัวตนที่ Email ว่าง เพื่อตัดปัญหา `N/A`
   - เพิ่มการแมป AD ให้กับ `Wimonpan.P` และ `Ronnakorn.P` พร้อมส่งคำสั่ง `ENABLE_USER` ไปยัง MTPulse เพื่อปลดล็อกคืนสิทธิ์ทันที
3. **ปรับปรุง `applications.py`, `scheduler.py`, และ `reconciliation.py`:**
   - ตัวกรอง Discrepancy (บัญชีผี) ตรวจสอบเฉพาะบัญชี AD องค์กรจริง และไม่สร้าง Discrepancy มั่วซั่วกับบัญชีที่ไม่มี Email
   - เมื่อ QOL หรือ Spoke ซิงก์รายชื่อเข้ามา จะสร้าง MasterIdentity เริ่มต้นด้วย `is_active_in_ad = True` เสมอ
4. **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend tsc 0 errors (100%)

---

## 0.1 อัปเดตก่อนหน้า (9 ต.ค. 2026): แก้ไขปัญหา AD Inactive, Ghost Account False Positives และ Pinyada.S
### ปัญหาที่พบและสาเหตุ:
1. **บัญชี `Patcha.S`, `Apichai.P`, `Praewwalee.K`, `pinyada.r`, `Ronnakorn.P`, `Wimonpan.P` ขึ้น AD Inactive / บัญชีผี (Ghost Account):**
   - สาเหตุ 1: ใน `agent.py` เมื่อ MTPulse ยิง heartbeat ส่งรายชื่อผู้ใช้ โค้ดสร้าง MasterIdentity โดยตั้งค่า `is_active_in_ad = False` ส่งผลให้กลายเป็น Inactive ใน AD ทันที
   - สาเหตุ 2: ใน `initial_data.py` auto-heal ข้ามผู้ใช้ที่แผนกไม่ได้อยู่ในกลุ่มเดิม หรือสะกดผิด เช่น `pinyada.r` มีแผนกเป็น `M365 User`
   - สาเหตุ 3: เมื่อ `is_active_in_ad == False` แต่ใน Spoke (IRM, MTPulse) มีสถานะ Active ระบบจึงตัดสินว่าเป็นบัญชีผี (Discrepancy)
2. **กรณี `Pinyada.S` สับสนกับ `Pinyada.R` และกลับมา On เสมอ:**
   - ใน IRM มี 2 บัญชี: `pinyada.r` (AD, Active) และ `Pinyada.S` (Local Pass, Inactive)
   - แต่ใน `initial_data.py` มีการ hardcode seed ข้อมูลว่า `Pinyada.S` คือ `Pinyada Rungrattanaporn` และตั้ง `is_active_in_ad = True` ทับข้อมูลทุกครั้งที่ start
   - ใน `directory.py` ตัวกรอง `status="active"` ตรวจเพียง overall active และตัวกรอง `app_code="irm"` ไม่ได้ตรวจว่าใน IRM เป็น Active หรือไม่ ทำให้ `Pinyada.S` ยังคงแสดงผลในตัวกรอง Active

### การแก้ไขและปรับปรุง:
- **`initial_data.py`:** 
  - ลบการ hardcode AD Active ของ `Pinyada.S` และตั้งให้ `Pinyada.S` เป็น Local Spoke Account โดยลบ AD mapping ออก
  - ใส่บัญชี AD ที่ถูกต้อง: `pinyada.r` (Pinyada Rungrattanaporn), `Praewwalee.K`, `Ronnakorn.P`, `Wimonpan.P` ใน `real_identities`
  - ปรับ auto-heal ให้ครอบคลุมทุกแผนกองค์กรรวมถึง M365 และ format พนักงานบริษัท (`Firstname.L`)
- **`agent.py`:** ตรวจสอบอีเมลองค์กร `@windowasia.com` หากเป็นพนักงานองค์กรจะตั้ง `is_active_in_ad = True` ส่วน Local Account จะไม่ถูกดึงเข้า AD
- **`directory.py` & `reconciliation.py`:**
  - ปรับตัวกรองร่วมระหว่าง `app_code` และ `status`: หากเลือกระบบงานเฉพาะ เช่น `app_code="irm"` และ `status="active"` จะคัดกรองเฉพาะบัญชีที่ Active ภายในระบบ IRM เท่านั้น (ผู้ใช้ที่ Inactive ใน IRM อย่าง `Pinyada.S` จะไม่แสดงผล)
  - ปรับเงื่อนไข Ghost Account / Discrepancy: ตรวจจับเฉพาะบัญชีที่เป็น AD Corporate Account จริงๆ เท่านั้น บัญชี Local Spoke จะไม่ถูกตีเป็นบัญชีผี
- **Frontend SSO Portal (`portal/page.tsx`):**
  - นำข้อความ `(VPN พร้อม)` ออกจากปุ่มกดเข้าใช้งานระบบ เหลือเพียง `เข้าใช้งานระบบ ↗` เพื่อลดความซ้ำซ้อนกับ Badge สถานะ `🛡️ VPN พร้อม` ที่มีอยู่แล้วบริเวณมุมขวาบนของการ์ด
- **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend tsc 0 errors (100%)

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

### 4) การปรับปรุง Audit Log แจกแจงระบบที่ล้มเหลว และการตรวจสอบ VPN IP บน Portal (Complete & Verified)
- **เจาะลึกระบบที่ล้มเหลวใน Sync All Apps (`SYNC_ALL_APPS`):**
  - ปรับ `scheduler.py` ให้ระบุชื่อและ Error ของระบบที่ล้มเหลวไว้ที่ข้อความสรุปทันที เช่น `"ซิงก์สำเร็จ 7 ระบบ, ล้มเหลว 1 ระบบ [พบปัญหา: Quality Management System (QMS): Connection refused / Offline]"`
  - บันทึก JSON รายละเอียดรายระบบ (Status, Accounts, Error reason) ลง `IamAuditLog.details` ครบถ้วน
  - ปรับ Frontend `/audit-logs` ใน Modal "เจาะลึก Audit Trail" ให้มีกล่องสีแดงเด่นชัด **"ระบบที่ซิงก์ล้มเหลว (FAILED SPOKES)"** พร้อมชื่อระบบ รหัสแอป และสาเหตุความผิดพลาด
- **ความโปร่งใสเรื่อง VPN Restriction บน Portal (`/portal`):**
  - เพิ่มฟิลด์ `detected_client_ip` ลงใน `PortalAppItem` (`oauth.py`, `schemas/oauth.py`)
  - อัปเดตหน้า `/portal` ให้ปุ่มที่ติดล็อก VPN แสดง IP จริงที่ Server ตรวจพบ เช่น `กรุณาเชื่อมต่อ VPN ก่อนเข้าใช้งาน (IP ตรวจพบ: 49.231.185.245)` ทำให้ผู้ใช้งานและแอดมินเข้าใจทันทีว่าทำไมถึงถูกล็อก

---

### 5) การแสดงรายชื่อบัญชีปัจจุบันสำหรับแอป Outbound Agent (Complete & Verified)
- **ปัญหาเดิม:** สำหรับแอปพลิเคชันประเภท Mode C / Outbound Agent (`SSO_ONLY`) เช่น MTPulse เดิมปุ่มกดมีข้อความว่า "ดูบัญชีสด" และเรียก API ไปยัง Connector ซึ่งไม่มี Inbound Port จึงคืนค่า 0 บัญชี แม้ว่าในฐานข้อมูล CIAM จะมีบัญชีที่บันทึกไว้จากการ Push ของ Agent แล้วก็ตาม
- **การแก้ไข:**
  - **ปรับปุ่มบนการ์ดระบบเชื่อมต่อ:** สำหรับแอปที่เป็น `SSO_ONLY` ปุ่มจะแสดงข้อความว่า **`ดูบัญชีปัจจุบัน`** (แทนคำว่า "ดูบัญชีสด") เพื่อสื่อความหมายที่ถูกต้องว่ากำลังดูข้อมูลบัญชีล่าสุดที่ได้รับจากการซิงก์
  - **Backend Inventory Endpoint (`/applications/{app_id}/inventory`):** ปรับให้ดึงข้อมูลจาก `AppAccountMapping` ร่วมกับ `MasterIdentity` มาแสดงรายชื่อผู้ใช้ที่แมปไว้ในระบบทันที พร้อมบอกเวลา `last_sync_at`
  - **Backend Manual Sync (`/applications/{app_id}/sync`):** สำหรับแอป `SSO_ONLY` ปรับให้ตรวจสอบและยืนยันจำนวนบัญชีปัจจุบันที่บันทึกไว้ แทนที่จะคืน 0 บัญชี
  - **Modal ปรับปรุงใหม่:** หัวข้อแสดงเป็น "รายชื่อผู้ใช้ปัจจุบันในระบบ {ชื่อระบบ}" พร้อม Subtitle ระบุเวลาที่ซิงก์ล่าสุด และแถบ Notice สีฟ้าแจ้งว่าข้อมูลนี้มาจาก Outbound Agent Push รอบล่าสุด

### 7) การมอบสิทธิ์ระบบลูกให้กับผู้ใช้เดิมในระบบ (Assign Spoke App to Existing Users) (Complete & Verified)
- **ปัญหา & ความต้องการ:** เมื่อมีผู้ใช้เดิมใน Active Directory หรือ Master Identity (เช่น `Ronnakorn.P`) แต่ยังไม่มีสิทธิ์ในระบบลูกใหม่ (เช่น MTPulse) เดิมไม่มีปุ่มให้ Admin มอบสิทธิ์ระบบลูกใหม่แก่ผู้ใช้ที่มีอยู่แล้วในระบบโดยตรง
- **การแก้ไข:**
  - **Backend Endpoint:** เพิ่ม `POST /api/v1/directory/users/{identity_id}/assign-app` (`directory.py`, `schemas/directory.py`) รับ `application_id`, `app_username`, `app_group_name` พร้อมสร้าง `AppAccountMapping` แบบเปิดใช้งานทันที และบันทึก `IamAuditLog(action_type="ASSIGN_SPOKE_ACCESS")`
  - **Frontend UI:** ในหน้าต่าง Modal "ดูสิทธิ์ & ตั้งค่า" ของ `/directory` เพิ่มปุ่ม **`[ + มอบสิทธิ์ระบบลูกใหม่ ]`** และฟอร์ม Inline ให้เลือกแอปพลิเคชันที่ยังไม่เคยมีสิทธิ์ (เช่น MTPulse) กำหนด Username และสิทธิ์ แล้วกดบันทึกได้ทันที โดยจะสะท้อนผลลัพธ์ทั้งใน Badge ของหน้า Directory และการแสดงการ์ดบน Employee Portal ของผู้ใช้ทันที

---

### 8) การกรองสถานะ (Active/Inactive/All), ค้นหาด่วน และเรียงตามตัวอักษรใน Modal ผู้ใช้สด (Complete & Verified)
- **ปัญหา & ความต้องการ:** ในหน้าจอ Modal "รายชื่อผู้ใช้สดในระบบ" (เช่น SAP Business One ซึ่งมี 266 บัญชี) เดิมไม่มีตัวกรองสถานะ และไม่มีการเรียงตามตัวอักษร ทำให้ค้นหาชื่อผู้ใช้ได้ยาก
- **การแก้ไข:**
  - เพิ่ม **Status Filter Pills:** ปุ่มตัวกรอง `ทั้งหมด ({allCount})`, `🟢 เปิดใช้งาน ({activeCount})`, `🔴 ปิดใช้งาน ({inactiveCount})`
  - เพิ่ม **Alphabetical Sorting Button:** ปุ่มสลับการเรียงลำดับตามตัวอักษร `[ เรียง A ➔ Z / เรียง Z ➔ A ]`
  - เพิ่ม **Quick Search Input:** ช่องค้นหาด่วนแบบ Real-time ให้พิมพ์ค้นหาชื่อ, username, แผนก หรืออีเมลได้ทันที
  - ขยายความกว้าง Modal เป็น `max-w-2xl` เพิ่มพื้นที่แสดงผลและข้อความสรุปจำนวนที่กรองได้

---

### 9) รองรับ Portal Launch URL แยกจาก Callback สำหรับการเปิดระบบแบบ RFC 9700 Seamless SSO Bounce (Complete & Verified)
- **ปัญหา & ข้อเสนอแนะจากทีม MTPulse:** เมื่อคลิกการ์ด MTPulse จากหน้า Central IAM Portal (`/portal`) เกิดข้อความเตือน "SSO session ไม่ถูกต้องหรือหมดอายุ กรุณาเริ่มใหม่" เนื่องจากโค้ดเดิมของ CIAM ส่ง Code ตรงเข้า `/auth/callback` โดยที่ MTPulse ยังไม่มี `SsoAttempt` และ Cookie `__Host-mtpulse_sso` ในเบราว์เซอร์
- **ทีม MTPulse ยืนยันสถาปัตยกรรม:** MTPulse มี Endpoint `/auth/start` พร้อมใช้งานแล้วบน Production (commit `0e852d7`) สำหรับเริ่ม SSO อัตโนมัติ (Seamless SSO Initiation Bounce ตาม RFC 9700) โดยต้องแยก URL สำหรับเปิดการ์ด (`Portal Launch URL: https://wa-mtpulse.wa.net/auth/start`) ออกจาก URL รับผลหลังยืนยันตัวตน (`Redirect URIs / Callback: https://wa-mtpulse.wa.net/auth/callback`)
- **การแก้ไขใน Central IAM:**
  - **Database & Model (`application.py`):** เพิ่มคอลัมน์ `portal_launch_url VARCHAR(500)` ในตาราง `connected_applications` พร้อม Safe Auto-Migration
  - **Data Seeding & Auto-Upgrade (`initial_data.py`):** บันทึกค่าเริ่มต้นสำหรับ MTPulse: `portal_launch_url = "https://wa-mtpulse.wa.net/auth/start"` และคง `redirect_uris = "https://wa-mtpulse.wa.net/auth/callback,..."`
  - **Backend API (`oauth.py`, `applications.py`):**
    - ใน `POST /oauth/portal/launch`: หากแอปมี `portal_launch_url` ให้ตอบกลับ URL ดังกล่าวทันที เพื่อให้เบราว์เซอร์เปิดเข้าสู่จุดเริ่มต้นสร้าง State/PKCE/Cookie ของระบบลูกอย่างถูกต้อง
    - ใน `GET /oauth/portal/apps`: เพิ่มฟิลด์ `portal_launch_url` ใน `PortalAppItem`
    - ใน `GET/PATCH /applications`: รองรับการอ่านและแก้ไข `portal_launch_url` ผ่าน API
  - **Frontend UI (`applications/page.tsx`):** เพิ่มช่องกรอก **`Portal Launch URL`** ใน Modal แก้ไขแอปพลิเคชัน (แท็บ SSO / OIDC) แยกจาก Whitelisted Redirect URIs พร้อมคำอธิบายการทำงาน RFC 9700
  - **การทดสอบ:** `pytest` ผ่าน 41/41 (100%), `tsc` 0 errors

---


### 7) แก้ไขสถานะ AD ในสิทธิ์ระบบลูก (Spokes), การจัดเรียงตัวอักษร A-Z, และระบบระงับสิทธิ์รายระบบ (Granular Access Control) (Complete & Verified)
- **1. แก้ไขสถานะ AD Badge ไม่ให้แสดงแดง/Disabled:**
  - **สาเหตุ:** ข้อมูล `AppAccountMapping` สำหรับ `app_code == 'ad'` ในฐานข้อมูลมีค่า `is_active_in_app` เป็น False หรือไม่ซิงก์ตรงกับสถานะจริงของตัวตนหลัก (`is_active_in_ad`), และผู้ใช้กลุ่ม Sale/Sale Admin ถูกระบุเป็น `is_ad_account = False` เนื่องจากคีย์เวิร์ดตรวจสอบแผนกไม่ครอบคลุม
  - **การแก้ไข:**
    - ปรับ `_build_app_summaries` ใน `directory.py`: เมื่อ `app_code == 'ad'` ให้ค่า `is_active_in_app` ซิงก์ตรงกับ `MasterIdentity.is_active_in_ad` เสมอ และ Auto-heal ข้อมูลในฐานข้อมูลให้ถูกต้อง
    - ปรับการระบุตัวตน AD (`is_ad`): ตรวจจับจาก `has_ad_mapping` และครอบคลุมแผนก `"Sale"`, `"Sale Admin"`, `"Purchasing"` ป้องกันการตกหล่นเป็น "ระบบลูกเท่านั้น" โดยไม่ตั้งใจ
    - ฝั่ง Frontend (`directory/page.tsx`): Badge ของ AD จะยึดตาม `isEffectiveActive` ที่อ้างอิง `user.is_active_in_ad` เสมอ
- **2. จัดเรียงสิทธิ์ระบบลูก (Spokes) ตามตัวอักษร (Alphabetical Order A-Z):**
  - ใน `directory.py` (`_build_app_summaries`) และหน้า Frontend (`directory/page.tsx` ทั้งในตารางและ Modal ดูสิทธิ์) ทำการ Sort รายชื่อแอปตาม `app_code` (เช่น `AD` ➔ `IRM` ➔ `M365` ➔ `QMS` ➔ `QOL` ➔ `SAP_B1`) ทำให้พนักงานทุกคนมีลำดับ Badge ที่เป็นระเบียบและสม่ำเสมอเหมือนกัน 100%
- **3. ระบบระงับสิทธิ์ / เปิดสิทธิ์เฉพาะระบบ (Granular Per-System Access Control):**
  - **Backend Endpoint ใหม่:** `PATCH /api/v1/directory/accounts/{mapping_id}/status`
    - รองรับการเปิด/ปิดสิทธิ์เฉพาะระบบของพนักงานรายบุคคล (เช่น ย้ายแผนกหรือหมดความจำเป็นในบางแอป แต่ยังไม่ได้ลาออก)
    - ส่งคำสั่ง Deprovision/Activate ไปยัง Spoke Connector (Mode A REST API เช่น IRM, Mode C Outbound Agent เช่น MTPulse, และ AD Proxy)
    - บันทึกประวัติใน `IamAuditLog` (Action: `DISABLE_SPOKE_ACCESS` / `ENABLE_SPOKE_ACCESS`)
  - **Frontend UI:** เพิ่มปุ่ม `[ ระงับสิทธิ์ระบบนี้ ]` และ `[ เปิดใช้งานระบบนี้ ]` ใน Modal "ดูสิทธิ์ & ตั้งค่า" พร้อมอัปเดตสถานะแบบ Real-time ทันที




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

### 10) ปรับปรุง UX การเปิดระบบและลดการเปิดแท็บ Chrome ซ้ำซ้อน (3 ต.ค. 2026 — Commit `f55fa65` และ `9439921`)
- **ปัญหาเดิม:** เมื่อพนักงานกดเปิดระบบงานจาก Central-IAM Employee Portal (`/portal`) ระบบเดิมใช้ `window.open(..., "_blank")` ทำให้เกิดการเปิดแท็บ Chrome ใหม่สะสมทุกครั้ง หากพนักงานเปิดหลายครั้งหรือสลับไปมาระหว่างระบบ แท็บจะค้างหลายสิบแท็บ กิน RAM เครื่องและทำให้เครื่องช้าลง
- **การแก้ไข:**
  1. **Central-IAM Portal ([portal/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
     - ปรับฟังก์ชัน `handleLaunch` ให้เปลี่ยนหน้าโดยตรงในแท็บเดิมด้วย `window.location.href = res.launch_url`
     - คงสถานะปุ่มกดให้หมุนแสดง `กำลังนำทางเข้าสู่ระบบ...` อย่างราบรื่นขณะที่เบราว์เซอร์กำลังโหลดเข้าสู่ Spoke
     - เบราว์เซอร์จะไม่สร้างแท็บ Chrome ใหม่ ประหยัดทรัพยากรเครื่องของผู้ใช้งาน 100%
  2. **IRM Header Switcher ([Header.tsx](file:///d:/Python/IRM/frontend/src/components/layout/Header.tsx)):**
     - เพิ่มปุ่ม **`[🏢 สลับระบบ (Portal)]`** บนแถบ Header สำหรับผู้ใช้งานที่ล็อกอินผ่าน SSO
     - พนักงานสามารถคลิกกลับมายังหน้า Central-IAM Portal ในแท็บเดิมได้ทันทีตลอดเวลาโดยไม่ต้องพิมพ์ URL ใหม่ และไม่ต้องกดออกจากระบบ
     - หากกด "ออกจากระบบ" (Logout) ระบบเดิมจะ Redirect กลับมาหน้า Portal ให้โดยอัตโนมัติอยู่แล้ว

---

### 11) แก้ไข One-Click Offboarding ให้สร้างคำสั่ง Outbound Agent (Mode C) และระบุ Label ให้ชัดเจน (3 ต.ค. 2026)
- **ปัญหาเดิมที่พบจาก Codex (MTPulse):**
  1. เมื่อทำการ 1-Click Offboard บัญชีพนักงาน ปรากฏว่าบัญชีใน MTPulse ไม่ถูกตัดสิทธิ์ เนื่องจากใน `SsoOnlyConnector.deprovision()` ส่งคืนเฉพาะ static message แจ้งยกเลิก SSO โดยไม่ได้สร้างคิวคำสั่ง `DISABLE_USER` ลงในตาราง `spoke_pending_commands`
  2. ตัวเลือก Dropdown ประเภทการเชื่อมต่อบน Admin UI ใช้ชื่อ `SSO_ONLY (โหมดลูกข่าย On-Premise)` ทำให้สับสนว่ารองรับ Outbound Agent (Mode C) หรือไม่
- **การแก้ไข:**
  1. **Connector Layer ([sso_only.py](file:///d:/Python/Central-IAM/backend/app/connectors/sso_only.py)):**
     - ปรับปรุงเมธอด `deprovision()` ให้เรียก `set_account_status(username, is_active=False, reason)` เหมือนกับ Connectors อื่นๆ
     - คำสั่ง `DISABLE_USER` จะถูกสร้างลงใน `spoke_pending_commands` ด้วยสถานะ `PENDING` ทันทีเมื่อ Admin กด Offboard
     - เมื่อ Spoke Agent (เช่น MTPulse) ส่ง Heartbeat รอบถัดไป (`POST /api/v1/agent/heartbeat`) ระบบจะดึงคำสั่งที่รออยู่ส่งกลับไปในก้อน `pending_commands` ให้ Agent นำไปรันตัดสิทธิ์บนฐานข้อมูล On-Premise ทันที
  2. **Admin UI ([applications/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)):**
     - ปรับข้อความตัวเลือก Dropdown ทั้งหน้าสร้างและแก้ไขระบบเป็น `SSO_ONLY (โหมดลูกข่าย On-Premise / Outbound Agent Mode C)` เพื่อความเข้าใจที่ชัดเจน
- **เงื่อนไขสำคัญที่ต้องมีเพื่อให้ Offboard ส่งคำสั่งไปยัง Spoke:**
  - บัญชีพนักงานรายนั้นจะต้องมี `AppAccountMapping` ผูกกับแอปพลิเคชันนั้นใน CIAM (สร้างผ่าน `sync_type: "FULL_SYNC"` ของ Agent หรือพนักงานเคย SSO เข้าใช้งานครั้งแรก)

### 12) มาตรฐานหน้าจอล็อกอิน Spoke แบบ Responsive: Mobile-Familiar 100% & Desktop-Flexible Compact SSO (7 ต.ค. 2026)
- **โจทย์และความต้องการ:**
  - พนักงานที่เข้าใช้งานระบบลูก (เช่น IRM, WMS) ผ่าน Mobile (หน้างาน คลังสินค้า ผลิต) มักใช้แค่แอปนั้นแอปเดียว หน้าจอเดิมที่ซ่อนฟอร์มแล้วแสดงเฉพาะปุ่ม SSO ขนาดยักษ์ทำให้ผู้ใช้สับสนและรู้สึกว่าระบบเปลี่ยนไป
  - บน Mobile ต้องการให้หน้าตา Login **แทบจะเหมือนเดิม 100%** (ฟอร์ม Username, Password, Remember Me, และปุ่ม Sign In สีเด่นชัดเป็นหลัก) โดยมีปุ่ม SSO เป็นตัวเลือกขนาดย่อมอยู่ด้านล่างสุด
  - บน Desktop พนักงานทำงานหลายระบบ ต้องการเปิดโอกาสให้เลือกเข้าใช้งานตามความต้องการ (Dual Freedom of Choice) จึงให้**ปุ่ม SSO มีขนาดเล็กลง (Compact)** จัดวางควบคู่ไปกับฟอร์มมาตรฐาน
- **การดำเนินการ:**
  1. **เอกสารสเปกกลาง ([SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md)):**
     - ปรับปรุงข้อ 5.2 เป็น *"มาตรฐานหน้าจอล็อกอินแบบ Responsive: คุ้นเคยเดิมบน Mobile 100% & เลือกได้ยืดหยุ่นบน Desktop"*
     - เพิ่มตารางเปรียบเทียบ UX ระหว่าง Mobile vs Desktop และมอบโค้ดตัวอย่าง JSX + Tailwind CSS (`hidden md:block` และ `block md:hidden`)
  2. **คู่มือ SSO สรุป ([SPOKE_SSO_INTEGRATION_GUIDE.md](file:///d:/Python/Central-IAM/SPOKE_SSO_INTEGRATION_GUIDE.md)):**
     - อัปเดตข้อ 4.2 ฝั่ง Frontend ให้ตรงกับ Responsive Design Standard ใหม่
  3. **Admin Console ([applications/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)):**
     - อัปเดตคำอธิบายใน Modal คู่มือสำหรับ Dev (Dev Spec Modal) ให้เป็น Responsive Login Standard
  4. **ระบบนำร่อง IRM ([page.tsx](file:///d:/Python/IRM/frontend/src/app/login/page.tsx)):**
     - ปรับปรุงหน้าจอ Login ของ IRM ให้ตรงตามสเปกใหม่ 100%: ฟอร์มแสดงผลเด่นชัดเสมอ บน Desktop มีปุ่ม SSO กะทัดรัดด้านบน และบน Mobile มีปุ่ม SSO ขนาดเล็กด้านล่างต่อจากฟอร์ม
     - ผ่านการตรวจสอบ TypeScript `0 TS errors` ทั้งฝั่ง CIAM และ IRM

---

## 4. สถานะ Git ล่าสุด (Current Git State)

### Repository Central-IAM (`D:\Python\Central-IAM`)
- **Branch:** `main`
- **Head Commit:** [`85b2743`](https://github.com/nchaiwat/CIAM/commit/85b2743) - `fix(connectors): route sso_only deprovision to queue DISABLE_USER command for Mode C agent`
- **Prior Commit:** `8e69876` - `feat(applications): clarify SSO_ONLY label as Outbound Agent Mode C in create and edit modal dropdowns`
- **Features Completed:**
  - Route `SsoOnlyConnector.deprovision()` to `set_account_status(is_active=False)` เพื่อสร้างคำสั่ง `DISABLE_USER` ลงใน `spoke_pending_commands` สำหรับ Mode C Outbound Agent
  - Dropdown Label ชัดเจน: `SSO_ONLY (โหมดลูกข่าย On-Premise / Outbound Agent Mode C)`
  - Same-Tab Portal Launch UX (`window.location.href`)
  - IRM Header Portal Switcher button `[🏢 สลับระบบ (Portal)]`
  - Zero-Trust VPN Access Guard & Allowed CIDRs
  - Reverse Heartbeat & Outbound Agent API `/api/v1/agent/heartbeat` (Mode C)
  - ตารางฐานข้อมูล `spoke_pending_commands` พร้อม Auto-migration
- **Working Tree:** สะอาด (Test Suites `39 passed`, `0 TS errors`)
- **Remote Sync:** Synced กับ `origin/main` 100%

### Repository IRM (`D:\Python\IRM`)
- **Branch:** `main`
- **Head Commit:** [`9439921`](https://github.com/nchaiwat/IRM/commit/9439921) - `feat(header): add return to Central IAM portal switcher button for SSO users`
- **Prior Commit:** `754323e` - `fix(suppliers): allow clearing email and contact fields to null/blank in update_supplier`
- **Working Tree:** สะอาด (TypeScript `0 TS errors`)
- **Remote Sync:** Synced กับ `origin/main` 100%

---

## 5. คำสั่งมาตรฐานสำหรับ Deploy บน VPS (Production Runbook)

> ⚠️ **กฎเหล็กการ Deploy (Critical Rules):**  
> 1. ชื่อ Service ของ Frontend ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด) และ Backend คือ **`api`**  
> 2. **ต้องเขียนคำสั่งแยกทีละบรรทัด ห้ามเชื่อมด้วย `&&` ยาวเป็นพรืด**  
> 3. ต้องมี `git pull` นำหน้าเสมอ  
> 4. หากมีการแก้ไขระบบลูก (เช่น IRM): ต้องแสดงคำสั่ง Deploy ของระบบลูกคู่กันไปด้วยเสมอ  

### ฝั่ง Central-IAM (VPS: `/var/www/Ciam` - IP: `157.173.219.153`):
- กรณีแก้ **Frontend** (`web`):
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build web
  docker compose up -d web
  ```
- กรณีแก้ **Backend** (`api`):
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api
  docker compose up -d api
  ```
- กรณีแก้ทั้ง **Backend และ Frontend**:
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api web
  docker compose up -d api web
  ```

### ฝั่ง IRM (VPS: `/var/www/Irm` - Hostinger):
- กรณีแก้ **Frontend**:
  ```bash
  cd /var/www/Irm
  git pull
  docker compose build frontend
  docker compose up -d frontend
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

เมื่อกลับมาทำงานต่อ ให้ดำเนินงานตามลำดับดังนี้:

### ลำดับที่ 1: Deploy การแก้ไขล่าสุดขึ้น Production VPS (`157.173.219.153`)
- นำคำสั่ง Runbook ในข้อ 5 ไปรันบน VPS เพื่อให้โค้ด `sso_only.py` (Commit `85b2743`) ที่แก้ให้ 1-Click Offboard บันทึกคำสั่ง `DISABLE_USER` ลงตาราง `spoke_pending_commands` มีผลบน Production
```bash
cd /var/www/Ciam
git pull
docker compose build api web
docker compose up -d api web
```

### ลำดับที่ 2: ทดสอบ SSO เข้า MTPulse ร่วมกับทีมพัฒนา MTPulse (Codex)
- **กรณีที่ 1 (Spoke-Initiated SSO):** ให้ทดลองคลิกปุ่ม **`[ เข้าสู่ระบบด้วย CIAM ]`** บนหน้า Login ของ MTPulse (`https://wa-mtpulse.wa.net`) โดยตรง
  - หากผ่านเข้าหน้า Dashboard ได้ แสดงว่า Credentials (Client ID, Secret, Redirect URI) ถูกต้อง 100%
- **กรณีที่ 2 (Portal / IdP-Initiated SSO):** หากกดเปิดจากหน้า CIAM Portal แล้วยังขึ้น *"SSO session ไม่ถูกต้องหรือหมดอายุ"*
  - ให้แจ้งทีม Codex (MTPulse) ตรวจสอบไฟล์ `/auth/callback` ของ MTPulse โดยปรับให้รองรับกรณีที่ไม่มีค่า `sessionStorage` (เหมือนที่ทำใน IRM [page.tsx](file:///D:/Python/IRM/frontend/src/app/auth/callback/page.tsx))

### ลำดับที่ 3: ทดสอบ Outbound Agent & 1-Click Offboard ระหว่าง CIAM กับ MTPulse (Mode C)
1. **Directory Push:** ให้ MTPulse Agent ยิง Heartbeat แบบ `sync_type: "FULL_SYNC"` พร้อมข้อมูลบัญชี (`accounts`) มายัง `POST /api/v1/agent/heartbeat` เพื่อสร้าง `AppAccountMapping` บน CIAM
2. **1-Click Offboard:** แอดมินทดลองกดตัดสิทธิ์ผู้ใช้จากหน้า CIAM Offboarding Hub ➔ ตรวจสอบว่ามีแถวคำสั่ง `DISABLE_USER` สถานะ `PENDING` ในตาราง `spoke_pending_commands`
3. **Command Execution:** เมื่อ MTPulse Agent ยิง Heartbeat รอบถัดไป ➔ ตรวจสอบว่าได้รับคำสั่ง `DISABLE_USER` ใน Response ก้อน `pending_commands` และสั่งระงับสิทธิ์ใน DB ของ MTPulse สำเร็จ พร้อมส่งผลลัพธ์ `COMPLETED` กลับมา

### ลำดับที่ 6: อัปเดตความเสถียรของ UI หน้าระบบเชื่อมต่อ (Deterministic Card Sorting)
- **ปัญหาเดิม:** เมื่อกด Trigger ซิงค์ข้อมูล, Ping หรือแก้ไขระบบลูก การ์ดบนหน้าจอจะกระโดดสลับตำแหน่งไปมา เกิดจาก PostgreSQL อัปเดตตำแหน่ง Heap Tuple ของแถวในตาราง `connected_applications` โดยที่ API ไม่ได้ระบุ `order_by`
- **การแก้ไข:**
  1. **Backend:** ใส่ `.order_by(ConnectedApplication.id.asc())` ใน `list_applications` (`applications.py`) และ `get_portal_apps` (`oauth.py`)
  2. **Frontend:** เพิ่ม `sortedApps` ที่คงตำแหน่งตาม ID เริ่มต้นเสมอ พร้อมเพิ่ม Dropdown เมนูให้ผู้ใช้เลือกเรียงตาม:
     - ลำดับระบบ (ID คงที่ - ค่าเริ่มต้น)
     - ชื่อระบบ (ก-ฮ / A-Z)
     - รหัสระบบ (App Code)

### ลำดับที่ 7: ปรับปรุงเอกสารสเปกกลางมาตรฐาน (`SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md`)
- **การปรับปรุง:**
  1. **Dual SSO Launch Modes:** ระบุมาตรฐานการรองรับทั้ง Spoke-Initiated (มี PKCE ใน sessionStorage) และ IdP-Initiated / Portal Launch (ไม่มี sessionStorage) ไว้อย่างชัดเจนในหมวด B.3
  2. **กฎเหล็ก Frontend `/auth/callback`:** ห้ามบล็อกผู้ใช้หรือขึ้น Error "SSO session ไม่ถูกต้อง" เมื่อเปิดผ่าน Portal โดยให้ fallback ส่ง `code_verifier: ""` ไปยัง Backend ทันที
  3. **กฎเหล็ก Backend `/api/auth/sso/callback`:** กำหนด `code_verifier` และ `state` เป็น Optional ไม่บังคับตรวจ Session Memory และแนบ `code_verifier` เฉพาะเมื่อมีค่า
  4. **แจกโค้ดมาตรฐานพร้อมใช้:** เพิ่ม Section 10.5 ตัวอย่างโค้ด Frontend Callback (Next.js 14 / React App Router) และปรับโค้ดตัวอย่าง Backend (FastAPI, Express/Node.js) ในภาคผนวกให้เป็นมาตรฐานเดียวกับที่ IRM ใช้งานจริง
  5. **Document Revision History & UI Changelog:**
     - เพิ่มหมวด **0. ประวัติการแก้ไขเอกสาร (Document Revision History)** ในไฟล์ markdown แสดงประวัติตั้งแต่ v1.0.0 จนถึง v2.5.0 พร้อมสรุปสิ่งที่เปลี่ยนแปลง
     - เพิ่มแท็บ **"📜 ประวัติการปรับปรุงสเปก (Revision Changelog)"** ใน Modal คู่มือสำหรับ Dev บนหน้าจอ `/applications` ให้ผู้ดูแลระบบและ Dev เปิดดู Log ความแตกต่างย้อนหลังผ่านหน้าเว็บได้ทันที

### ลำดับที่ 8: ยกระดับสเปกกลางสู่ Version 2.6.0 ตามข้อเสนอแนะเชิงสถาปัตยกรรมของทีม MTPulse
- **การปรับปรุงครบ 4 ประเด็น:**
  1. **RFC 9700 Seamless SSO Initiation Bounce (หมวด B.3):**
     - กำหนดให้ Portal Card เปิดไปที่ SSO Start Endpoint ของระบบลูก (เช่น `/auth/start`)
     - Spoke สร้าง PKCE & State ผูกกับเบราว์เซอร์ 100% -> Redirect ไปยัง CIAM `/oauth/authorize`
     - CIAM อาศัย Active Portal Session ทำ Seamless Auto-Approval (<400ms) แล้วส่งกลับ Callback
     - คงประสบการณ์ Seamless 1-Click Launch โดยไม่เสียมาตรฐานความปลอดภัย RFC 9700 §4.7
  2. **Architecture Equivalence Principles (หมวด 1.4):**
     - ระบุชัดเจนว่าระบบลูกไม่จำเป็นต้องแก้โค้ดให้เหมือนตัวอย่างทุกบรรทัด หากมีผลลัพธ์ความปลอดภัยเทียบเท่า
     - ยอมรับการเก็บ PKCE ฝั่ง Backend, การใช้ HttpOnly Session Cookie แทน JS Tokens, การอ่าน DB ต่อ Request, และการผูกตัวตนด้วย `sub` หรือ `preferred_username`
  3. **Mode C Outbound Sync Protocol & REQUEST_FULL_SYNC (หมวด D.2 & Backend):**
     - ระบบ Mode C ไม่ต้องเปิด Inbound Port และไม่ต้องเปิด Group C API
     - การสั่ง Sync สดจากหน้าจอ CIAM หรือรอบ 04:00 น. จะสร้างคำสั่ง `REQUEST_FULL_SYNC` เข้า Command Queue
     - Agent ตรวจพบคำสั่งและส่ง Full Directory Push ในรอบ Heartbeat ถัดไป
  4. **Asynchronous Deprovisioning & Local Admin Protection (หมวด D.3):**
     - กำหนด Lifecycle คำสั่งอย่างเป็นทางการ (`PENDING` ➔ `SENT` ➔ `COMPLETED` / `FAILED`)
     - รับรองสิทธิ์ของ Spoke ในการปฏิเสธคำสั่ง `DISABLE_USER` สำหรับ Emergency Local Admin หรือ Admin คนสุดท้าย โดยส่งผลลัพธ์ `FAILED` พร้อมเหตุผล

### ลำดับที่ 9: ปรับปรุงชื่อไฟล์ Spec ติด Version, แก้ถาวร AD Sync Inactive Bug & เพิ่ม UI Loading Feedback
- **การปรับปรุง 3 จุดสำคัญ:**
  1. **Spec Filename Versioning:** ปรับชื่อไฟล์ที่ดาวน์โหลดออกมาให้มีเวอร์ชันติดที่ชื่อไฟล์เสมอ: `CIAM_SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION_v2.6.0.md` ทั้งใน Backend (`applications.py`) และ Frontend พร้อมแสดง Loading State บนปุ่ม
  2. **ถอนการตัดสิทธิ์ Stale AD Identity อัตโนมัติ (AD Inactive Root Cause Fix):**
     - ลบโค้ด `stale_identities` deactivation ใน `scheduler.py` (รอบ 04:00 น.) และ `applications.py` เพื่อไม่ให้ปิดสิทธิ์พนักงาน AD เพียงเพราะไม่มีชื่อใน Sync Batch ชั่วคราว
     - ปรับให้รอบ Sync AD อัปเดต `identity.is_active_in_ad = is_active` อย่างถูกต้อง
     - เพิ่มระบบ Auto-Healing ใน `init_db()` (`initial_data.py`) ฟื้นฟูสถานะ Active ให้พนักงานที่ถูกตั้งเป็น Inactive ผิดพลาดโดยอัตโนมัติเมื่อสตาร์ทเซิร์ฟเวอร์
### ลำดับที่ 10: แก้ปัญหา Redirect URI ไม่ได้รับอนุญาตสำหรับ MTPulse (wa-mtpulse.wa.net)
- **ปัญหา:** เมื่อเปิด App Portal ไปยัง MTPulse หรือคลิก SSO จาก MTPulse เกิด Error: `Redirect URI 'https://wa-mtpulse.wa.net/auth/callback' is not authorized for client 'mtpulse-spoke-client'`
- **สาเหตุ:**
  1. `mtpulse` ยังไม่ได้ถูก seed อยู่ใน `apps_data` ใน `initial_data.py` ทำให้ไม่มีการกำหนด `redirect_uris` เริ่มต้นที่ครบถ้วน
  2. ใน `oidc_service.py` การตรวจ `validate_client_and_redirect_uri` เทียบเฉพาะ exact match กับสตริงในฐานข้อมูล โดยยังไม่ได้รวม standard callbacks (`/auth/callback`, `/api/auth/callback`) บน `base_url` และยังไม่ได้รองรับ same-origin matching
- **การแก้ไข:**
  1. **Backend ([oidc_service.py](file:///d:/Python/Central-IAM/backend/app/services/oidc_service.py)):**
     - ขยาย `allowed_uris` ให้ครอบคลุม `${base_url}/auth/callback`, `${base_url}/api/auth/callback`, `${base_url}/portal/callback` โดยอัตโนมัติ
     - เพิ่ม Same-Origin Matcher สำหรับ Path มาตรฐาน (`/auth/callback`, `/api/auth/callback`) บน Origin เดียวกันกับที่ลงทะเบียนไว้
  2. **Database Auto-Upgrade ([initial_data.py](file:///d:/Python/Central-IAM/backend/app/initial_data.py)):**
     - บรรจุ `mtpulse` เข้า `apps_data`
     - เพิ่มบล็อก Auto-Upgrade ใน `init_db()` ตรวจสอบแอป `mtpulse-spoke-client` และเพิ่ม `https://wa-mtpulse.wa.net/auth/callback,https://wa-mtpulse.wa.net/api/auth/callback,http://localhost:3000/portal/callback` ให้อัตโนมัติเมื่อสตาร์ท container
### ลำดับที่ 11: เพิ่มฟิลด์ Portal Launch URL รองรับ RFC 9700 Seamless SSO Bounce ไปยัง /auth/start
- **ปัญหา:** เมื่อคลิกการ์ด MTPulse จาก Central IAM Portal เดิมที CIAM ยิงตรงเข้า `/auth/callback?code=...` ทำให้ MTPulse ไม่มี `SsoAttempt` และ Cookie ที่ผูกกับเบราว์เซอร์ จึงขึ้น Error สีแดง *"SSO session ไม่ถูกต้องหรือหมดอายุ"*
- **การแก้ไข:**
  1. เพิ่มฟิลด์ `portal_launch_url` ใน `ConnectedApplication` (Model, Schemas, DB Auto-Migration, UI)
  2. กำหนดให้ `mtpulse` ใช้ `portal_launch_url = "https://wa-mtpulse.wa.net/auth/start"` แยกต่างหากจาก `redirect_uris = "https://wa-mtpulse.wa.net/auth/callback"`
  3. เมื่อคลิกการ์ด CIAM Portal ระบบจะส่งผู้ใช้ไปที่ `portal_launch_url` เพื่อให้ Spoke สร้าง State/PKCE และ Cookie ผูกกับเบราว์เซอร์ แล้วเด้งมาแลก Token กับ CIAM ได้อย่างราบรื่น

### ลำดับที่ 12: ยกระดับสเปกกลางสู่ Version 2.7.0 — Two-Way Directory Reconciliation & Mandatory Immediate Sync Button
- **ปัญหา & ข้อกำหนดใหม่:** เมื่อผู้ดูแลระบบมอบหมายสิทธิ์ให้พนักงานบน CIAM (เช่น `Ronnakorn.P` ได้รับแท็ก `• MTPULSE`) ในระบบ Spoke Mode C (เช่น MTPulse) กลับยังไม่มี Account นี้จนกว่าจะล็อกอิน และไม่มีปุ่มให้สั่ง Sync แลกเปลี่ยนสถานะกันได้ทันทีแบบ Two-Way
- **การแก้ไขและกำหนดมาตรฐานกลาง:**
  1. **Two-Way Directory Reconciliation for Mode C:**
     - ใน `/api/v1/agent/heartbeat` เมื่อ Spoke ส่ง `FULL_SYNC` หรือรายชื่อบัญชีขึ้นมา CIAM จะตรวจสอบ Diff กับบัญชีที่ได้รับสิทธิ์ใน CIAM (`AppAccountMapping`)
     - หาก CIAM มีบัญชีที่ได้รับสิทธิ์เพิ่มขึ้นที่ Spoke ยังไม่มี CIAM จะส่ง `assigned_accounts` และออกคำสั่ง **`PROVISION_USER`** ให้ Spoke นำไปสร้างใน Local Database ทันที (Role เริ่มต้น `Viewer`, `is_active: true`)
     - หากพนักงานถูกปิดสิทธิ์บน CIAM แต่ใน Spoke ยังเปิดอยู่ CIAM จะส่งคำสั่ง **`DISABLE_USER`** ไปปิดทันที
  2. **Mandatory Immediate Sync Button on Spoke UI:**
     - กำหนดข้อบังคับในหมวด D.4 และ 5.1 ให้ Spoke ใน Mode C ทุกระบบ **ต้องมีปุ่ม `[ ⚡ ซิงก์บัญชีผู้ใช้กับ CIAM ทันที ]` (Immediate Account Sync)** บนหน้าจอ System Setting (User Management หรือ Central IAM)
     - เมื่อกดปุ่ม ระบบลูกจะรัน Outbound Full Sync ไปยัง CIAM ทันที นำบัญชีที่ขาดมาสร้าง และปรับสถานะ Active/Inactive ให้ตรงกัน 100% แบบเรียลไทม์ โดยไม่ต้องรอรอบ Background 120 วินาที
  3. **Backend CIAM ([agent.py](file:///d:/Python/Central-IAM/backend/app/api/v1/agent.py)):**
     - เพิ่ม `AssignedAccountItem` และ `assigned_accounts` ใน `AgentHeartbeatResponse`
     - เพิ่ม Logic คำนวณ Two-Way Reconciliation และสร้างคำสั่ง `PROVISION_USER` / `DISABLE_USER` ส่งกลับให้อัตโนมัติ

### ลำดับที่ 13: แก้ปัญหา Badge ซ้ำซ้อน (MTPulse Duplication), บัญชีสะกดผิดใน Spoke ถูกนับเป็น AD (Winmonpan.P), และปรับคำเรียกเป็น Local Acc
- **ปัญหา 3 ประเด็นที่ตรวจพบ:**
  1. **Badge สิทธิ์ระบบลูกเบิ้ล 2 อัน:** เช่น `Wimonpan.P` และ `Ronnakorn.P` แสดง `• MTPULSE` ซ้ำกันสองแถบ เนื่องจากการเปรียบเทียบใน Agent Heartbeat ใช้ exact match (`app_username == username_clean`) โดยไม่ได้เทียบ case-insensitive หรือ identity_id ทำให้สร้าง mapping ซ้ำ และ `_build_app_summaries` เดิมไม่ได้ทำการ deduplicate ตาม `app_code`
  2. **บัญชี `Winmonpan.P` ไม่มีใน AD แต่ถูกระบุเป็น Active ใน AD:** เกิดจากใน MTPulse สะกดชื่อพนักงานผิดเป็น `Winmonpan.P` (มีตัว `n`) เมื่อซิงก์มายัง CIAM โค้ดใน `agent.py` เดิมสร้าง MasterIdentity ใหม่โดยใส่ `is_active_in_ad = True` ประกอบกับฟังก์ชัน auto-heal เดิมตรวจพบจุด `.` ในชื่อผู้ใช้ (`is_dotted_username`) จึงสร้าง mapping ของ AD ให้โดยเข้าใจว่าเป็นบัญชี AD
  3. **คำแสดงผลสถานะ:** คำว่า "ระบบลูกเท่านั้น" / "ระบบลูก" สื่อสารยาก ผู้ใช้ต้องการให้แสดงเป็นคำว่า **"Local Acc"** ให้ชัดเจน
- **การแก้ไข:**
  1. **Deduplication ระบบลูก ([directory.py](file:///d:/Python/Central-IAM/backend/app/api/v1/directory.py) & [agent.py](file:///d:/Python/Central-IAM/backend/app/api/v1/agent.py)):**
     - ใน `_build_app_summaries`: รวม mapping และ deduplicate ตาม `app_code.upper()` ให้แสดงแอปละ 1 badge เสมอ โดยเลือกอันที่มีสถานะ Active หรือมีประวัติ Login ล่าสุด
     - ใน `agent.py`: ตรวจสอบ mapping ที่มีอยู่แล้วด้วย `(identity_id == ident.id | func.lower(app_username) == username_clean.lower())` และลบแถว mapping ที่ซ้ำซ้อนในฐานข้อมูล
  2. **สิทธิ์บัญชีจาก Spoke ([agent.py](file:///d:/Python/Central-IAM/backend/app/api/v1/agent.py) & [initial_data.py](file:///d:/Python/Central-IAM/backend/app/initial_data.py)):**
     - ใน `agent.py`: กำหนดให้บัญชีที่ถูกส่งขึ้นมาจาก Spoke Agent มี `is_active_in_ad = False` โดยเด็ดขาด
     - ใน `initial_data.py`: ตัดเงื่อนไข `is_dotted_username` ออกจากตัวตรวจจับ AD เพื่อไม่ให้บัญชีระบบลูกที่มีจุด `.` ถูกดึงเข้า AD อัตโนมัติ พร้อมทั้งปรับแก้ `Winmonpan.P` ให้มี `is_active_in_ad = False` และลบ mapping ของ AD ออก
     - เพิ่มตัวเก็บกวาด Mapping ซ้ำซ้อน (`AppAccountMapping` deduplication) อัตโนมัติเมื่อรัน `init_db()`
  3. **Frontend UI Terminology ([page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/directory/page.tsx)):**
     - ปรับข้อความ Badge จาก `"ระบบลูก"` ➔ **`"Local Acc"`**
     - ปรับข้อความสถานะ AD จาก `"ระบบลูกเท่านั้น"` ➔ **`"Local Acc"`**
### ลำดับที่ 14: พัฒนาระบบ Client-Side Reachability Probe Engine สำหรับตรวจสอบการเชื่อมต่อ VPN อัตโนมัติ (Modern Zero-Trust Access)
- **ปัญหา & ข้อกำหนดใหม่จากผู้ใช้:**
  1. การนำ Public IP (`147.50.223.20`) มาใส่ Whitelist ไม่ตอบโจทย์ความปลอดภัยระดับ Enterprise เนื่องจากพนักงานสามารถเชื่อมต่อทำงานได้จากหลากหลายสถานที่ทั่วโลก และ Public IP สามารถเปลี่ยนแปลงได้ตลอดเวลา
  2. การปล่อยให้ผู้ใช้กดเข้าไปแล้วเจอปัญหาหมุนค้าง (แนวทางที่ 2) ทำให้ผู้ใช้เข้าใจว่าระบบ Failed หรือไม่เสถียร
  3. ผู้ใช้เลือก **แนวทางที่ 1 (Client-Side Reachability Probe)** ซึ่งเป็นแนวทาง Modern Web Application ที่ Automate และตรวจสอบความพร้อมจริงจากเบราว์เซอร์ของผู้ใช้งาน หากพร้อมให้เปลี่ยนเป็น **สีฟ้า (Sky/Blue)** ทันที
- **การแก้ไขและพัฒนาระบบ:**
  1. **ถอด Whitelist Public IP ชั่วคราวออก:** นำ `147.50.223.20/32` ออกจาก `DEFAULT_CORPORATE_NETWORKS` ใน `network_service.py` และ `initial_data.py` คงไว้เฉพาะ Subnet ภายในองค์กรแท้จริง
  2. **Client-Side Browser Reachability Probe ([page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
     - สร้างฟังก์ชัน `probeAppVpn` ยิงตรวจสอบการเข้าถึง Spoke On-Premise Host (`https://wa-mtpulse.wa.net`) ผ่าน `fetch(..., { mode: 'no-cors', cache: 'no-store' })` พร้อม AbortController 2.5 วินาที
     - รันตรวจเช็กแบบอัตโนมัติทันทีที่โหลดหน้ารายการแอป
     - มีตัวดักจับ `window.addEventListener("focus")` เมื่อผู้ใช้สลับหน้าต่างไปเชื่อมต่อ OpenVPN แล้วคลิกกลับมาที่หน้าต่างเบราว์เซอร์ ระบบจะ Probe ซ้ำและปลดล็อกให้อัตโนมัติโดยไม่ต้องรีเฟรชหน้าจอ
  3. **สถานะแสดงผลบน UI (โทนสีฟ้าสดใสเมื่อพร้อมใช้งาน):**
     - **สถานะกำลังตรวจสอบ (`checking`):** การ์ดแสดงป้ายสีเทาอ่อน `ตรวจสอบ VPN...` พร้อม Spinner หมุน
     - **สถานะ VPN พร้อมใช้งาน (`connected`):** การ์ดและป้ายปรับเป็น **สีฟ้า (Sky/Blue)** `🛡️ VPN พร้อม` และปุ่มเปลี่ยนเป็นสีฟ้า Gradient `เข้าใช้งานระบบ (VPN พร้อม) ↗` อนุญาตให้คลิกเข้าใช้งานได้ทันที
     - **สถานะยังไม่ได้ต่อ VPN (`disconnected`):** ป้ายสีส้ม `🔒 ต้องต่อ VPN` พร้อมปุ่มสีส้ม `🔒 กรุณาต่อ VPN แล้วคลิกตรวจใหม่` ที่สามารถคลิกเพื่อ Re-probe ได้ทันที
  4. **Backend Portal Launch Authorization ([oauth.py](file:///d:/Python/Central-IAM/backend/app/api/v1/oauth.py)):**
     - เพิ่มฟิลด์ `client_vpn_verified: bool` ในสคีมา `PortalLaunchRequest`
     - ใน `/oauth/portal/launch`: อนุญาตให้ผู้ใช้ที่ผ่าน Client Reachability Probe ทำการ Launch และรับ SSO Authorization Code เพื่อนำทางต่อไปยัง `https://wa-mtpulse.wa.net/auth/start` ได้อย่างปลอดภัยและราบรื่น

---

## 4. สถานะระบบปัจจุบัน และ แผนงานที่จะปรับปรุงต่อในรอบถัดไป (Current Status & Next Steps Roadmap)

### 4.1 สถานะระบบที่ตรวจสอบและส่งมอบแล้ว (Verified & Production Ready)
* **Git Commits ล่าสุด:**
  - `223100d` — `feat(portal): implement client-side VPN reachability probe with automated sky blue ready state`
  - Push สู่ `origin/main` เรียบร้อยแล้ว 100%
* **ผลการทดสอบความถูกต้อง (Test & Type Integrity):**
  - **Backend:** `pytest backend\tests` ผ่านครบ **43/43 tests (100% Passed)**
  - **Frontend:** `npx tsc --noEmit` ผ่าน **0 errors**
* **สรุปฟังก์ชันที่พร้อมใช้งานในปัจจุบัน:**
  1. ถอด Whitelist IP สาธารณะ `147.50.223.20` ออกหมดจด เพื่อความปลอดภัย Enterprise Zero-Trust รองรับพนักงานที่เชื่อมต่อจากทุกเครือข่าย
  2. ระบบ Probe อัตโนมัติจากเบราว์เซอร์ผู้ใช้ ตรวจสอบ Reachability ไปยัง On-Premise Spoke (`wa-mtpulse.wa.net`)
  3. เมื่อต่อ VPN พร้อม การ์ด ป้ายสถานะ และปุ่มจะเปลี่ยนเป็น **สีฟ้าสดใส (Sky/Blue)** `🛡️ VPN พร้อม` และ `เข้าใช้งานระบบ (VPN พร้อม) ↗` โดยอัตโนมัติ
  4. ดักจับ Event `window.focus` ทำให้เมื่อผู้ใช้สลับไปต่อ OpenVPN แล้วคลิกกลับมาที่หน้าเว็บ CIAM ระบบจะ Re-check ปลดล็อกเป็นสีฟ้าให้อัตโนมัติทันที
  5. หากยังไม่ต่อ VPN แสดงปุ่มสีส้มพร้อมฟังก์ชันคลิกตรวจเช็กซ้ำได้ทันที

### 4.2 แผนงานและข้อสังเกตสำหรับการปรับปรุงในรอบถัดไป (Next Iteration Roadmap)
เมื่อกลับมาพัฒนาต่อ ให้โฟกัสและตรวจสอบตามประเด็นต่อไปนี้:
1. **User Acceptance Testing (UAT) การเชื่อมต่อ MTPulse จริงบน Production:**
   - **ทดสอบเคสที่ 1 (ยังไม่ต่อ VPN):** เข้าหน้า `/portal` จากภายนอก ➔ การ์ด MTPulse ต้องขึ้นสีส้ม `🔒 ต้องต่อ VPN` และมีปุ่ม `🔒 กรุณาต่อ VPN แล้วคลิกตรวจใหม่`
   - **ทดสอบเคสที่ 2 (ต่อ VPN OpenVPN 192.168.42.0/24):** เปิด OpenVPN Connect บนเครื่อง ➔ สลับแท็บกลับมาหน้า CIAM ➔ การ์ดต้องสลับเป็นสีฟ้า `🛡️ VPN พร้อม` และปุ่มเปลี่ยนเป็น `เข้าใช้งานระบบ (VPN พร้อม) ↗` ทันที
   - **ทดสอบเคสที่ 3 (กดเข้าใช้งาน):** คลิกปุ่มสีฟ้า ➔ CIAM ต้องออก Single-use Authorization Code และ Redirect ไปยัง `https://wa-mtpulse.wa.net/auth/start` เข้าสู่ระบบ MTPulse ได้อย่างราบรื่นโดยไม่ขึ้น error เซสชันหมดอายุ
2. **การปรับแต่ง Edge Cases ของ Client Probe (Fine-tuning):**
   - ตรวจสอบค่า Probe Timeout (ปัจจุบันตั้งไว้ 2.5 วินาที) หากพบว่าการต่อ VPN ผ่านเครือข่ายมือถือบางค่ายมี Latency สูง สามารถขยายเป็น 3.0-3.5 วินาที หรือปรับเป็น Adaptive Timeout
   - หาก Spoke มีการพัฒนา endpoint เฉพาะ เช่น `/api/health` หรือ `/auth/ping` สามารถปรับเป้าหมาย Probe ให้เจาะจงยิ่งขึ้น
   - หากมีระบบลูก On-Premise อื่นๆ ในอนาคต (เช่น WMS, ERP โรงงาน) ที่ตั้งเป็น `VPN_ONLY` สามารถนำ Probe Engine นี้ไปใช้ได้ทันที
3. **การติดตามความร่วมมือกับทีม Spoke Mode C (MTPulse):**
   - ตรวจสอบว่าทีม MTPulse ได้เพิ่มปุ่ม **`[ ⚡ ซิงก์บัญชีผู้ใช้กับ CIAM ทันที ]`** ในหน้า User Management หรือ Central IAM ตามสเปก v2.7.0 เรียบร้อยแล้วหรือไม่
   - ทดสอบรอบ Two-Way Reconciliation เมื่อ Admin สร้างหรือเปิดสิทธิ์ User ใหม่บน CIAM เพื่อให้ Spoke Mode C นำไป Provision สร้างในเครื่องลูกแบบ Real-Time

---

## 5. คำสั่ง Deploy บน VPS ประจำรอบ (Deploy Instructions)

เมื่อต้องการ Deploy โค้ดล่าสุดขึ้นสู่ VPS Ubuntu (`/var/www/Ciam`):

```bash
cd /var/www/Ciam
git pull
docker compose build api web
docker compose up -d api web
```

