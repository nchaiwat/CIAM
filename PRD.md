# Product Requirements Document (PRD)
# Centralized Identity Management & Access Governance System (Central IAM)
**Document Version:** 1.3.0  
**Target Project:** Central IAM Application  
**Organization:** Window Asia Public Company Limited  
**Status:** In Production / Active Multi-Spoke Integration  
**Last Updated:** 2026-09-05  
**Related Documents:** [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md), [AD_SYNC_AGENT_API_SPEC.md](file:///d:/Python/Central-IAM/AD_SYNC_AGENT_API_SPEC.md), [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md), [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md), [ADAuthen.md](file:///d:/Python/Central-IAM/ADAuthen.md)

---

## 1. บทนำและวิสัยทัศน์โครงการ (Executive Summary & Vision)

### 1.1 ที่มาและปัญหาเดิม (Problem Statement)
ปัจจุบัน บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) มีการพัฒนาและใช้งานซอฟต์แวร์หลากหลายระบบภายในองค์กร เช่น:
* **IRM (Incoming Raw Material):** ระบบรับและตรวจสอบวัตถุดิบขาเข้า (`https://irm.windowasia.com`)
* **QMS (Quality Management System):** ระบบบริหารคุณภาพ (`https://qms.windowasia.com`)
* **SAP Business One (SAP B1):** ระบบ ERP หลักขององค์กร (รองรับ SAP Service Layer REST API)
* **Legacy ERP:** ระบบคลังสินค้าดั้งเดิม (ควบคุมผ่าน RPA Bot Worker)
* **Active Directory (AD):** ศูนย์กลาง Domain Controller หลักขององค์กร (เชื่อมต่อผ่าน AD Sync Agent / AD Proxy ที่พอร์ต `3100`)

เดิมฐานข้อมูลผู้ใช้ (User DB) แยกกันอย่างอิสระ ส่งผลให้เกิดความเสี่ยงระดับองค์กร:
1. **Orphaned / Ghost Accounts:** เมื่อพนักงานลาออก HR แจ้ง IT แต่ IT ลืมปิดสิทธิ์ในบางระบบ ทำให้พนักงานเก่าที่พ้นสภาพยังเข้าถึงข้อมูลความลับทางการค้าและสต็อกสินค้าได้
2. **Lack of Central Governance:** ฝ่ายตรวจสอบ (IT Audit / ISO 27001) ไม่สามารถดูภาพรวมในหน้าจอเดียวได้ว่า พนักงาน 1 คน มีสิทธิ์อยู่ในระบบใดบ้าง
3. **High Operational Overhead & Delay:** การระงับสิทธิ์หรือสร้างสิทธิ์พนักงานต้องไล่ล็อกอินทีละแอปพลิเคชัน ใช้เวลานานและเสี่ยงต่อ Human Error

### 1.2 วัตถุประสงค์หลัก (Project Objectives)
สร้างระบบ **Central IAM** เพื่อทำหน้าที่เป็น **Single Pane of Glass** ในการควบคุมสิทธิ์และวงจรชีวิตตัวตน (Identity Lifecycle) ทั่วทั้งองค์กร:
1. **Instant One-Click Offboarding (Killer Feature):** ปิดสิทธิ์พนักงานที่ลาออกจากทุกระบบ (AD, IRM, QMS, SAP B1) พร้อมกันในคลิกเดียว ภายในเสี้ยววินาที
2. **Multi-System User Provisioning (New):** สร้างบัญชีพนักงานและแจกจ่ายสิทธิ์ (Provisioning) ไปยัง Active Directory และระบบลูกต่างๆ ที่เลือก พร้อมระบุ Role/Group ได้จากศูนย์กลาง
3. **Multi-System Re-activation (New):** เปิดใช้งานสิทธิ์คืน (Re-enable) ข้ามระบบพร้อมกันในคลิกเดียวเมื่อพนักงานกลับมาปฏิบัติงาน
4. **Automated Reconciliation & Ghost Detection:** ตรวจจับและแจ้งเตือนบัญชีผี (ผู้ใช้ที่ถูก Disable ใน AD แล้วแต่ยังเปิดใช้งานอยู่ในระบบลูก) ทันที
5. **Modular Connector Architecture:** แยก Connector แต่ละระบบอย่างชัดเจน (AD Proxy, M2M REST API, SAP B1 Service Layer, และ RPA Worker)
6. **Audit Trail & ISO 27001 / PDPA Compliance:** ออกเอกสารรับรองการปิดสิทธิ์ (**Offboarding Certificate**) พร้อมบันทึกหลักฐาน Immutable Audit Trail ส่งออก CSV ได้

---

## 2. สถาปัตยกรรมระบบ (System Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Central IAM Management Web App                             │
│                  Frontend: Next.js 16 (Port 3000) | Backend: FastAPI (Port 8001)        │
│                           Database: PostgreSQL 16 (Port 5435)                           │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        │                   │                               │                   │
 [AD Proxy Connector] [REST Connector]              [SAP B1 Connector]    [RPA Adapter]
        │                   │                               │                   │
        ▼                   ▼                               ▼                   ▼
┌───────────────┐   ┌───────────────────────────┐   ┌───────────────┐   ┌───────────────┐
│   AD Sync     │   │   Modern M2M Spokes       │   │    SAP B1     │   │  Legacy ERP   │
│  Agent Proxy  │   │ - IRM (irm.windowasia)    │   │ Service Layer │   │  Automation   │
│  (Port 3100)  │   │ - QMS (qms.windowasia)    │   │ (OData REST)  │   │  Bot Worker   │
└───────┬───────┘   └───────────────────────────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│  Active Dir   │
│ Windows Server│
│Domain Controlr│
└───────────────┘
```

---

## 3. โครงสร้างเมนูและหน้าจอการทำงาน (Menu & UI Architecture)

| ลำดับ | หน้าจอ (Page) | Route | หน้าที่หลัก |
| :---: | :--- | :--- | :--- |
| **1** | **Dashboard** | `/` | ภาพรวม KPI, สรุปจำนวน Ghost Accounts, และ Real-time Activity Logs |
| **2** | **User Directory** | `/directory` | ทะเบียนพนักงานส่วนกลาง, ตารางสิทธิ์ข้ามระบบ (Cross-App Matrix), ปุ่ม **+ Create New User** (Provisioning), และปุ่ม **Re-activate User** |
| **3** | **Offboarding Hub** | `/offboarding` | ศูนย์สั่งการตัดสิทธิ์พนักงานลาออก 1-Click พร้อมพิมพ์ใบรับรอง Certificate (`CERT-YYYYMMDD-XXXXXX`) |
| **4** | **Connected Applications** | `/applications` | ทะเบียนระบบลูก, ตรวจสอบสถานะ Ping, ดึงดู Live Accounts, และ Sync Inventory เข้า DB |
| **5** | **Audit Trail & Logs** | `/audit-logs` | ประวัติการดำเนินงานทั้งหมด (`OFFBOARD_USER`, `ENABLE_USER`, `CREATE_USER`, `PROVISION_USER`) พร้อมปุ่ม Export CSV |

---

## 4. รายละเอียดข้อกำหนดการทำงาน (Functional Requirements)

### 4.1 หน้า Dashboard (`/`)
* **KPI Metrics Cards:**
  * **Total Identities:** จำนวนตัวตนพนักงานทั้งหมดในระบบ
  * **Active Accounts:** จำนวนบัญชีที่ยัง Active อยู่ในองค์กร
  * **De-provisioned Accounts:** จำนวนบัญชีที่ถูกตัดสิทธิ์ไปแล้ว
  * **Connected Systems Online:** อัตราความพร้อมของระบบลูก (เช่น 3/3 ระบบ Online)
  * **Ghost Accounts Alert:** จำนวนบัญชีผิดปกติที่พนักงานลาออกจาก AD แล้วแต่ยังมีสิทธิ์ในระบบลูก
* **Discrepancy Remediation Table:** รายการบัญชีผีที่ตรวจพบ พร้อมปุ่มลัดนำทางไปยัง Offboarding Hub
* **Recent Activity Feed:** รายการเคลื่อนไหว 10 รายการล่าสุด แสดง Actor, Action, และ Application ที่เกี่ยวข้อง

### 4.2 หน้า User Directory & Provisioning (`/directory`)
* **Universal Search & Filter:** ค้นหาตามชื่อ, Username, แผนก, หรืออีเมล พร้อมฟิลเตอร์กรองตามสถานะและแอปพลิเคชัน
* **Cross-App Matrix Table:**
  * ข้อมูล Master Identity: ชื่อ-สกุล, แผนก, รหัสพนักงาน, สถานะใน AD
  * Spoke Access Badges: แสดงสถานะการมีบัญชีใน IRM, QMS, SAP B1, และ Legacy ERP พร้อมระบุ Role/Group (เช่น `PU User`, `QA Inspector`, `SAP User`)
* **Create & Provision New Employee Modal (`+ Create New User`):**
  * ฟอร์มบันทึกข้อมูลพนักงาน: Username, ชื่อ-นามสกุล, อีเมล, แผนก, เบอร์โทร, รหัสพนักงาน
  * สวิตช์เปิด/ปิด: สร้าง Identity ใน Active Directory ผ่าน AD Proxy
  * รายการ Checkbox เลือกระบบลูกที่ต้องการสร้างบัญชี พร้อมช่องระบุ Role/Group
  * แสดง Checklist ผลลัพธ์การ Provision แยกรายระบบแบบเรียลไทม์
* **Re-activate User Action:**
  * ปุ่ม **Re-activate User** ในตารางและในหน้าต่าง Inspect Matrix (แสดงเมื่อบัญชีถูกระงับ)
  * ส่งคำสั่งเปิดใช้งานคืนพร้อมกันทั้งใน AD (ผ่าน AD Proxy) และในระบบลูกทั้งหมดที่ผูกไว้

### 4.3 หน้า Offboarding Hub (`/offboarding`)
* **Step 1 - Select Target User:** ค้นหาพนักงานที่ต้องการระงับสิทธิ์
* **Step 2 - Dynamic Blast Radius Preview:** แสดงรายการระบบทั้งหมดที่จะได้รับผลกระทบทันที
* **Step 3 - Single-Click Execute ("Disable Everywhere"):**
  * สั่ง Disable ใน Active Directory ผ่าน AD Proxy Connector
  * ส่งคำสั่ง `PATCH /api/v1/directory/accounts/{username}/status` ไปยัง REST API Spokes (เช่น IRM, QMS)
  * ส่งคำสั่ง Lock บัญชีไปยัง SAP B1 Service Layer (`Locked: "tYES"`)
  * ส่งงาน deprovision ไปยัง RPA Worker สำหรับ Legacy Spokes
* **Step 4 - Execution Checklist & Compliance Certificate:**
  * แสดงผลการปิดสิทธิ์แยกระบบแบบเรียลไทม์ พร้อม Response Code และ Latency
  * สร้างรหัสใบรับรองสากล `CERT-YYYYMMDD-XXXXXX`
  * ปุ่ม **"Print Certificate"** สำหรับส่งมอบให้ฝ่ายบุคคลและผู้ตรวจประเมิน ISO

### 4.4 หน้า Connected Applications (`/applications`)
* **Spoke Registry:** แสดงการ์ดของแต่ละระบบลูก (IRM, QMS, SAP B1, Legacy ERP)
* **Diagnostic Tools:**
  * **Ping:** วัดค่า Latency และตรวจสอบการยืนยันตัวตน
  * **Live Accounts:** เปิด Modal แสดงรายชื่อผู้ใช้ที่ดึงสดจาก Spoke API
  * **Sync Inventory:** ซิงก์ข้อมูลรายชื่อและสถานะจากระบบลูกเข้าสู่ Central IAM Database

### 4.5 หน้า Audit Trail (`/audit-logs`)
* บันทึกทุก Action (`OFFBOARD_USER`, `ENABLE_USER`, `CREATE_USER`, `PROVISION_USER`, `SYNC`, `PING`) แบบ Non-repudiation
* เก็บรวบรวม Actor, Target Username, Execution Mode, Status, IP Address, และรายละเอียด JSON
* ปุ่ม **Export CSV** ดาวน์โหลดไฟล์รายงานสำหรับใช้ยื่นตรวจประเมินความปลอดภัยประจำปี

---

## 5. มาตรฐานการเชื่อมต่อ API ของระบบลูก (Spoke API Standard)

ระบบลูกประเภท REST API ทั้งหมดต้องปฏิบัติตามมาตรฐานกลาง [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md):

1. **GET `/api/v1/directory/accounts`**: สำหรับส่งคืน Inventory บัญชีผู้ใช้ในระบบทั้งหมด (Reconciliation)
2. **PATCH `/api/v1/directory/accounts/{username}/status`**: สำหรับรับคำสั่งเปิด/ระงับบัญชีผู้ใช้ (`is_active: true/false`)
3. **POST `/api/v1/directory/accounts`**: สำหรับรับคำสั่งสร้างบัญชีผู้ใช้ใหม่ (Provisioning)
   * Headers: `X-Management-API-Key: sec_<app>_mgmt_<hex32>`, `Content-Type: application/json`
   * Body: `username`, `full_name`, `email`, `department`, `group_name`, `use_ad_auth`, `created_by`
4. **Security:** อนุญาตเฉพาะ IP Whitelist ของ Central Management Server

### 5.1 แนวทางปฏิบัติสำหรับระบบลูก (No DB Schema Alteration Needed)
* **ระบบลูกไม่ต้องแก้ Database Schema เดิม:** ไม่จำเป็นต้องมี Field เท่ากัน เพียงแต่ใน API Controller ให้แปลงค่า (Map) ฟิลด์เดิมใน DB ส่งออกมาเป็นชื่อมาตรฐานของ CIAM
* **ใช้ `username` เดียวกันเป็นแกนหลัก:** แนะนำให้ใช้ `sAMAccountName` จาก AD หรือ รหัสพนักงาน

### 5.2 การเชื่อมต่อกับ Active Directory (AD Proxy & OU Strategy)
* **AD Proxy Agent:** CIAM จะไม่ต่อตรงกับ Domain Controller แต่คุยผ่าน AD Sync Agent (พอร์ต `3100`) ที่มีอยู่เดิม โดยเพิ่ม Endpoint สำหรับ Disable/Enable ด้วยคำสั่ง PowerShell บนเครื่อง Agent
* **OU Management Strategy:**
  * **แบบที่แนะนำ (AD-First Approach):** ให้ฝ่าย IT สร้าง User ใน AD ตาม OU และ Group Policy ปกติ $\rightarrow$ Central IAM ซิงก์ดึงข้อมูลเข้ามา $\rightarrow$ Admin กด 1-Click Provision กระจายต่อไปยัง IRM, QMS, SAP B1 ได้ทันทีโดยไม่ต้องเสี่ยงสร้าง OU ผิดใน AD
  * **แบบ Staging OU:** กำหนดให้สร้างลงใน `OU=Pending_Users,DC=windowasia,DC=local` เป็นจุดพักก่อนให้ IT ย้ายเข้า OU ประจำ

---

## 6. แผนงานและการต่อยอดในอนาคต (Roadmap)
* [x] **Phase 1 (Completed):** Core Engine, M2M REST Connector, RPA Mock Adapter, Offboarding Hub, ISO Certificate Export
* [x] **Phase 2 (Completed):** เชื่อมต่อระบบจริงกับ **IRM (Incoming Raw Material)** ดึงบัญชีจริงและทดสอบ Health Check สำเร็จ
* [x] **Phase 3 (Completed):** 
  * ออกแบบและพัฒนา `SapB1Connector` รองรับ SAP B1 Service Layer REST API
  * พัฒนา `AdProxyConnector` รองรับการสื่อสารกับ AD Sync Agent Proxy
  * ขยายสเปกกลางรองรับ `POST /accounts` (User Provisioning)
  * พัฒนาฟังก์ชัน Multi-System User Creation และ Re-activation ทั้ง Backend และ Frontend UI
* [ ] **Phase 4:** 
  * ให้ทีม AD Sync Agent เพิ่ม Endpoint สำหรับ `Disable-ADAccount` / `Enable-ADAccount`
  * ติดตั้งและทดสอบ Spoke API บนระบบ **QMS**
  * เชื่อมต่อ Production URL ของ **SAP B1 Service Layer**
