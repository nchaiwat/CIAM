# Product Requirements Document (PRD)
# Centralized Identity Management & Access Governance System (Central IAM)
**Document Version:** 1.0.0  
**Target Project:** Central IAM Application  
**Organization:** Window Asia Public Company Limited  
**Status:** Approved for Implementation  
**Related Documents:** CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md, API-Integration-Guide.md

---

## 1. บทนำและวิสัยทัศน์โครงการ (Executive Summary & Vision)

### 1.1 ที่มาและปัญหาเดิม (Problem Statement)
ปัจจุบันบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) มีการพัฒนาและใช้งานซอฟต์แวร์หลากหลายระบบภายในองค์กร เช่น **IRM (Incoming Raw Material)**, **QMS (Quality Management System)**, **ERP/SAP B1**, และ **WMS** โดยแต่ละระบบมีฐานข้อมูลผู้ใช้งาน (User Database) แยกจากกันอย่างอิสระ ส่งผลให้เกิดปัญหาสำคัญดังนี้:
1. **บัญชีผี / บัญชีค้างในระบบ (Orphaned / Ghost Accounts):** เมื่อพนักงานลาออก ฝ่ายบุคคล (HR) หรือผู้ดูแลระบบอาจลืมปิดสิทธิ์ในบางระบบ ทำให้พนักงานที่พ้นสภาพยังสามารถเข้าถึงข้อมูลลับของบริษัทได้
2. **ไม่มีศูนย์กลางควบคุมการเข้าถึง (Lack of Centralized Governance):** ผู้บริหารและทีม IT Audit ไม่สามารถตรวจสอบได้ในหน้าจอเดียวว่าพนักงาน 1 คน มีสิทธิ์เข้าถึงระบบใดบ้างในองค์กร
3. **ภาระงานซ้ำซ้อน (High Operational Overhead):** การเปิดสิทธิ์พนักงานใหม่ (Onboarding) หรือปิดสิทธิ์พนักงานลาออก (Offboarding) ต้องล็อกอินเข้าไปทำรายการทีละระบบ ส่งผลให้ล่าช้าและเกิดข้อผิดพลาดจากมนุษย์ (Human Error)

### 1.2 วัตถุประสงค์โครงการ (Project Objectives)
สร้างระบบ **Central IAM (Centralized Identity & Access Management Application)** ทำหน้าที่เป็น **"Single Pane of Glass"** ศูนย์กลางในการบริหารจัดการตัวตน บัญชีผู้ใช้งาน และสิทธิ์การเข้าถึงทุกระบบในเครือบริษัท โดยมีเป้าหมายหลัก:
* **Instant Offboarding:** ระงับสิทธิ์พนักงานที่ลาออกจากทุกระบบ (IRM, QMS, AD) ได้ทันทีด้วยการคลิกเพียงครั้งเดียว (One-Click De-provisioning)
* **Automated Reconciliation:** ตรวจจับบัญชีตกค้าง (Ghost Accounts) ระหว่าง Active Directory กับระบบลูกโดยอัตโนมัติ
* **Compliance & Audit Ready:** บันทึกประวัติการเปลี่ยนแปลงสิทธิ์ทุกขั้นตอนอย่างโปร่งใส รองรับมาตรฐาน **ISO 27001** และ **PDPA**

---

## 2. สถาปัตยกรรมระบบ (System Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Central IAM Management App                            │
│                 (Next.js Dashboard + FastAPI Core Engine)                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│   Active Directory     │  │   IRM Application      │  │   QMS Application      │
│   (Windows Server)     │  │   (Production VPS)     │  │   (Quality System)     │
│   IP: 192.168.12.11    │  │   https://irm.wa.com   │  │   https://qms.wa.com   │
│   Port: 3100 (Gateway) │  │   M2M Token Protected  │  │   M2M Token Protected  │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

### องค์ประกอบหลักในระบบ:
1. **Identity Source of Truth:** ดึงข้อมูลพนักงานหลักจาก **Active Directory (AD Server 192.168.12.11)** ผ่าน AD Sync Gateway (Port 3100)
2. **Child Applications (Spokes):** ระบบลูกทุกระบบในเครือ (เช่น IRM, QMS) เชื่อมต่อด้วย **Standard Central Identity Management API (SCIM-Like REST API)**
3. **Security Transport:** สื่อสารผ่านโปรโตคอล HTTPS พร้อมยืนยันตัวตนระดับเครื่องต่อเครื่องด้วย `X-Management-API-Key` และการจำกัด IP Whitelisting

---

## 3. โครงสร้างเมนูและหน้าจอการทำงาน (Menu & Page Architecture)

ตัวแอปพลิเคชัน Central IAM จะประกอบด้วย **5 เมนูหลัก** ดังต่อไปนี้:

| ลำดับ | ชื่อเมนู (Menu Name) | Path | วัตถุประสงค์หลัก |
| :---: | :--- | :--- | :--- |
| **1** | **Dashboard** | `/dashboard` | ภาพรวมสถานะตัวตนผู้ใช้ทั้งองค์กร และสรุปเตือนบัญชีผิดปกติ |
| **2** | **User Directory** | `/directory` | ทะเบียนรายชื่อพนักงานและตารางสิทธิ์ข้ามระบบ (Cross-App Matrix) |
| **3** | **Offboarding Hub** | `/offboarding` | ศูนย์สั่งการระงับสิทธิ์พนักงานลาออกพร้อมกันทุกระบบ (One-Click) |
| **4** | **Connected Apps** | `/applications` | ทะเบียนระบบลูก, จัดการ API Keys, และทดสอบสถานะ Health Check |
| **5** | **Audit Trail & Logs**| `/audit-logs` | ประวัติการให้และระงับสิทธิ์ทั้งหมด เพื่อการตรวจสอบตามมาตรฐาน ISO |

---

## 4. รายละเอียดฟังก์ชันแต่ละหน้าจอ (Functional Specifications)

### 4.1 หน้า Dashboard (`/dashboard`)
หน้าแรกสำหรับผู้ดูแลระบบ แสดงสถานะความมั่นคงปลอดภัยด้านสิทธิ์แบบ Real-time:
* **KPI Metrics Cards:**
  * **Total Enterprise Identities:** จำนวนพนักงานทั้งหมดใน Active Directory
  * **Active Accounts:** จำนวนบัญชีที่กำลังเปิดใช้งานอยู่ในปัจจุบัน
  * **De-provisioned Accounts:** จำนวนบัญชีที่ถูกระงับสิทธิ์แล้ว
  * **Connected Systems:** จำนวนระบบที่เชื่อมต่อสำเร็จและออนไลน์ (เช่น 2/2 ระบบ: IRM, QMS)
* **Reconciliation Warning Box (กล่องเตือนภัยบัญชีผี):**
  * แสดงตัวเลขเตือนหากพบพนักงานที่ลาออกจาก AD แล้วแต่ยังมีสถานะ Active อยู่ในระบบลูก
  * มีปุ่มทางลัด **"Review & Fix Discrepancies"** เพื่อเข้าสู่กระบวนการปิดสิทธิ์ทันที
* **Real-time Activity Feed:** แสดงรายการที่มีการเปลี่ยนแปลงสิทธิ์ 10 รายการล่าสุด

---

### 4.2 หน้า User Directory (`/directory`)
ศูนย์รวมข้อมูลพนักงานทุกคนและการถือครองสิทธิ์ในระบบต่างๆ:
* **ระบบค้นหาและตัวกรองอัจฉริยะ (Universal Filter):**
  * ค้นหาจาก: รหัสพนักงาน, ชื่อ-นามสกุล, Username, อีเมล, หรือแผนก
  * กรองตามสถานะ: Active, Inactive, หรือ กรองตามระบบที่สังกัด (เช่น ดูเฉพาะผู้ที่มีบัญชีใน IRM)
* **ตารางรายชื่อพนักงาน (Directory Table):**
  * คอลัมน์: รหัสพนักงาน | ชื่อ-สกุล | Username | แผนก | สถานะใน AD | สิทธิ์ในระบบลูก (Badges) | การจัดการ
* **หน้ารายละเอียดรายบุคคล (User Cross-App Access View):**
  * เมื่อคลิกที่ชื่อพนักงาน จะแสดงการ์ดสรุปข้อมูล:
    * ข้อมูลจาก AD: รหัส, อีเมล, แผนก, เบอร์โทร, วันที่ล็อกอินล่าสุด
    * **Cross-Application Matrix:**
      * **IRM System:** 🟢 Active (กลุ่ม: `PU User`, เข้าใช้งานล่าสุด: `03/09/2026`)
      * **QMS System:** 🟢 Active (กลุ่ม: `QA Inspector`, เข้าใช้งานล่าสุด: `01/09/2026`)
      * **SAP B1:** 🔴 Inactive (ไม่มีสิทธิ์)

---

### 4.3 หน้า Offboarding Hub (`/offboarding`) — ฟังก์ชันพระเอก
หน้าจอสำคัญสำหรับจัดการเมื่อพนักงานลาออกจากบริษัท เพื่อตัดความเสี่ยงด้านความปลอดภัย 100%:
* **ขั้นตอนการทำงาน (Instant Offboarding Workflow):**
  1. **เลือกพนักงาน:** พิมพ์ค้นหาชื่อหรือ Username พนักงานที่ลาออก
  2. **ระบุข้อมูลการพ้นสภาพ:** ใส่วันที่สิ้นสุดการทำงาน และเหตุผล (เช่น `Resigned`, `Terminated`)
  3. **ระบบพรีวิวผลกระทบ (Impact Preview):**
     * แสดงรายการระบบทั้งหมดที่พนักงานคนนี้มีบัญชีอยู่ (เช่น จะระงับสิทธิ์ใน: 1. AD, 2. IRM, 3. QMS)
  4. **กดปุ่มยืนยัน "Disable Everywhere (ระงับสิทธิ์ทุกระบบ)":**
     * ระบบจะยิงคำสั่ง Asynchronous HTTP PATCH ไปยังทุกระบบลูกพร้อมกัน
     * ยิงคำสั่งปิดบัญชีใน Active Directory
  5. **ผลลัพธ์แบบ Checklist:**
     * ✅ Active Directory: Disabled
     * ✅ IRM System: Disabled (HTTP 200 OK)
     * ✅ QMS System: Disabled (HTTP 200 OK)
  6. **สร้างเอกสารรับรอง (Offboarding Certificate):**
     * สามารถกดปุ่ม **"Print / Export PDF"** ใบยืนยันการตัดสิทธิ์เพื่อแนบส่งฝ่ายบุคคลและฝ่ายตรวจสอบ

---

### 4.4 หน้า Connected Applications (`/applications`)
ทะเบียนควบคุมระบบซอฟต์แวร์ทั้งหมดที่นำมาผูกกับ Central IAM:
* **การเพิ่ม/แก้ไขระบบลูก (App Registration):**
  * Application Name (เช่น `IRM System`, `QMS System`)
  * Base URL (เช่น `https://irm.windowasia.com`)
  * Health Check Endpoint (เช่น `/api/health`)
  * Management API Key (สร้างแบบสุ่ม 32 Bytes เข้ารหัส `sec_irm_mgmt_...`)
  * Allowed Outbound IPs (IP ของ Central Server สำหรับทำ Whitelist)
* **เครื่องมือทดสอบ (Diagnostic Tools):**
  * ปุ่ม **"Ping / Test Connection"**: ตรวจสอบ Latency และความพร้อมของ API ปลายทาง
  * ปุ่ม **"Sync Account Inventory"**: สั่งดึงรายชื่อผู้ใช้ทั้งหมดจากระบบนั้นทันที (`GET /api/v1/directory/accounts`)

---

### 4.5 หน้า Audit Trail & Compliance (`/audit-logs`)
บันทึกประวัติการดำเนินงานทั้งหมด ป้องกันการปฏิเสธความรับผิดชอบ:
* บันทึกข้อมูลละเอียดทุกธุรกรรม:
  * วันที่และเวลา (Timestamp ISO 8601)
  * ผู้ดำเนินการ (Admin Actor เช่น `admin_somchai`)
  * พนักงานเป้าหมาย (Target User)
  * การกระทำ (Action: `OFFBOARD_USER`, `ENABLE_USER`, `MANUAL_SYNC`)
  * ระบบที่ส่งผลกระทบ (Affected Apps)
  * สถานะผลลัพธ์ (Success / Partial Failed / Error)
  * IP Address ของผู้สั่งการ
* ฟังก์ชันการส่งออก: **Export to Excel / CSV** สำหรับใช้ยื่นการตรวจประเมินความปลอดภัยประจำปี

---

## 5. การออกแบบฐานข้อมูล (Database Schema)

ระบบ Central IAM ใช้ฐานข้อมูลเชิงสัมพันธ์ (PostgreSQL) ประกอบด้วยตารางหลักดังนี้:

```sql
-- 1. ตารางระบบลูกที่เชื่อมต่อ
CREATE TABLE connected_applications (
    id SERIAL PRIMARY KEY,
    app_code VARCHAR(50) UNIQUE NOT NULL,      -- เช่น 'irm', 'qms'
    app_name VARCHAR(100) NOT NULL,            -- เช่น 'Incoming Raw Material'
    base_url VARCHAR(255) NOT NULL,            -- เช่น 'https://irm.windowasia.com'
    api_key VARCHAR(255) NOT NULL,             -- Machine-to-Machine Secret Key
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางพนักงานหลัก (Sync มาจาก Active Directory)
CREATE TABLE master_identities (
    id SERIAL PRIMARY KEY,
    ad_guid VARCHAR(100) UNIQUE,
    employee_id VARCHAR(50),
    username VARCHAR(100) UNIQUE NOT NULL,     -- sAMAccountName
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(150),
    department VARCHAR(100),
    telephone VARCHAR(50),
    is_active_in_ad BOOLEAN DEFAULT TRUE,
    last_login_ad_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางการถือครองบัญชีในระบบลูก (Cross-App Mapping)
CREATE TABLE app_account_mappings (
    id SERIAL PRIMARY KEY,
    identity_id INTEGER REFERENCES master_identities(id) ON DELETE CASCADE,
    application_id INTEGER REFERENCES connected_applications(id) ON DELETE CASCADE,
    app_username VARCHAR(100) NOT NULL,
    app_user_id VARCHAR(50),
    app_group_name VARCHAR(100),
    is_active_in_app BOOLEAN NOT NULL,
    last_sync_status VARCHAR(50),              -- 'IN_SYNC', 'DISCREPANCY'
    last_app_login_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id, app_username)
);

-- 4. ตารางบันทึกประวัติการตรวจสอบสิทธิ์ (Audit Logs)
CREATE TABLE iam_audit_logs (
    id SERIAL PRIMARY KEY,
    actor_username VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,          -- 'OFFBOARD_USER', 'ENABLE_USER', 'SYNC'
    target_username VARCHAR(100) NOT NULL,
    affected_app_code VARCHAR(50),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT,
    ip_address VARCHAR(50),
    status VARCHAR(20) NOT NULL,               -- 'SUCCESS', 'FAILED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. ข้อกำหนดด้านความปลอดภัย (Security & Compliance Requirements)

1. **การเข้ารหัสข้อมูล (Encryption):**
   * ข้อมูลการสื่อสารทั้งหมดต้องผ่าน TLS 1.3 (HTTPS)
   * API Key ของระบบลูกต้องเข้ารหัสในฐานข้อมูล
2. **การป้องกัน Replay Attack & Tampering:**
   * ตรวจสอบ Timestamp ใน Header ให้คลาดเคลื่อนไม่เกิน 300 วินาที
   * เปรียบเทียบ API Key ด้วยวิธี Constant-Time Comparison (`secrets.compare_digest`)
3. **การแจ้งเตือนเหตุการณ์สำคัญ (Critical Alerts):**
   * เมื่อมีการทำรายการ Instant Offboarding สำเร็จ ระบบต้องยิงสรุปแจ้งเตือนเข้ากลุ่ม **Telegram IT Security** ทันที

---

## 7. แผนการพัฒนาและเป้าหมายในแต่ละเฟส (Implementation Roadmap)

* **Phase 1 (MVP - Core Offboarding & Directory):**
  * สร้างหน้า Dashboard, Directory, Connected Apps
  * เชื่อมต่อ API ระงับสิทธิ์กับระบบ **IRM** และ **QMS**
  * ฟังก์ชัน Instant Offboarding แบบคลิกเดียว
* **Phase 2 (Automated AD Sync & Reconciliation):**
  * เชื่อมต่อ AD Gateway เพื่อดึงรายชื่อพนักงานจาก Active Directory 192.168.12.11 อัตโนมัติทุกคืน
  * ระบบตรวจจับและแจ้งเตือนบัญชีผี (Ghost Account Detection)
* **Phase 3 (Full SCIM 2.0 & Auto-Provisioning):**
  * ยกระดับเป็นมาตรฐาน Full SCIM 2.0 Protocol
  * รองรับการ Provision สร้างผู้ใช้ใหม่อัตโนมัติเมื่อพนักงานเข้างาน

---
**เอกสารฉบับนี้พร้อมใช้งานเป็นพิมพ์เขียว (Blueprint) สำหรับทีมพัฒนาระบบ Central IAM ทันที**
