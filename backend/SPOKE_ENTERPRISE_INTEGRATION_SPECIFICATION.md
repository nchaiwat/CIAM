# ข้อกำหนดมาตรฐานกลาง: การเชื่อมต่อระบบลูกกับ Central IAM ผ่าน System Settings & Transaction Logs
**Standard Specification:** Enterprise Central IAM Integration for Spoke Applications  
**Version:** 2.2.0 (Production-Verified IRM Standard & Non-AD Exception Handling Edition)  
**Organization:** บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (Window Asia Public Company Limited)  
**Target Systems:** IRM, QMS, QOL (QT-Online), SAP B1 Service และระบบงานทั้งหมดที่จะพัฒนาขึ้นใหม่  
**Compliance:** ISO 27001 / OpenID Connect (OIDC) / OAuth 2.0 with PKCE (RFC 7636)

---

## 1. บทนำและหลักการออกแบบ (Architecture Principles)

เอกสารฉบับนี้กำหนดมาตรฐานการเชื่อมต่อระบบสารสนเทศภายในเครือบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทั้งหมด เข้ากับระบบพิสูจน์ตัวตนกลาง **Window Asia Central IAM** เพื่อให้ทุกระบบย่อย (Spoke Applications) มีโครงสร้าง API, สถาปัตยกรรมการจัดเก็บการตั้งค่า และรูปแบบการบันทึก Audit Log เป็น **Template มาตรฐานเดียวกัน 100%**

### ❌ ข้อห้ามสำคัญ (Zero `.env` Dependency):
* **ห้าม Hardcode ค่าการเชื่อมต่อ Central IAM ลงในไฟล์ `.env` บน Production:**  
  การเปลี่ยน URL, หมุนเวียน Client Secret หรือสลับโหมด Break-Glass จะต้องทำได้ทันทีผ่านฐานข้อมูล/หน้าจอ System Setting **โดยไม่ต้อง SSH เข้าเซิร์ฟเวอร์ VPS, ไม่ต้องแก้ไฟล์ `.env`, และไม่ต้องสั่ง Rebuild หรือ Restart Docker Containers**
* **Dynamic In-Memory Caching:**  
  ระบบลูกจะอ่านค่าคอนฟิกจากตารางฐานข้อมูล `system_settings` และแคชไว้ในหน่วยความจำ โดยจะโหลดใหม่ทันทีเมื่อมีการอัปเดตผ่าน API Channel

---

## 2. โครงสร้างฐานข้อมูลมาตรฐาน (Database Schema Standard)

ระบบลูกทุกระบบต้องมีตารางฐานข้อมูล 2 ตารางนี้ (หรือเทียบเท่า) เพื่อรองรับการตั้งค่าและการตรวจสอบย้อนกลับ:

### 2.1 ตาราง `system_settings` (Dynamic Runtime Configuration)

```sql
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NULL,
    description VARCHAR(250) NULL,
    category VARCHAR(50) DEFAULT 'general',
    data_type VARCHAR(20) DEFAULT 'string', -- 'string', 'boolean', 'integer', 'encrypted'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(key);
```

#### ชุดข้อมูลมาตรฐานตั้งต้น (Seed Data) สำหรับหมวด `central_iam`:

| Key | Data Type | Default Value ตัวอย่าง (IRM) | คำอธิบาย |
| :--- | :---: | :--- | :--- |
| `ciam_base_url` | string | `https://ciam.windowasia.com` | URL หลักของ Central IAM Engine (ห้ามมี `/` ต่อท้าย) |
| `ciam_client_id` | string | `irm-spoke-client` | Client ID ที่ลงทะเบียนไว้ในหน้า Central IAM Portal |
| `ciam_client_secret` | encrypted | `sec_irm_oauth_secret_2026` | รหัสลับเฉพาะของระบบลูก (ห้ามส่งคืนค่าเต็มผ่าน GET API) |
| `ciam_sso_enabled` | boolean | `true` | สวิตช์หลักเปิด/ปิดการเข้าใช้งานด้วย Central IAM SSO |
| `ciam_break_glass_active` | boolean | `false` | โหมดปลดระบบฉุกเฉิน (สลับไปล็อกอินตรงด้วย AD Gateway) |
| `ciam_ad_gateway_url` | string | `http://172.18.0.1:3100` | URL เซิร์ฟเวอร์ AD Gateway ภายในองค์กร |
| `ciam_auto_provision_group`| string | `PU Staff` | ชื่อกลุ่มสิทธิ์เริ่มต้นสำหรับพนักงานใหม่ที่ล็อกอินผ่าน SSO ครั้งแรก |
| `ciam_session_ttl_minutes` | integer | `480` | อายุ Access Token ของระบบลูก (ค่าแนะนำ: 8 ชั่วโมง / 480 นาที) |

---

### 2.2 ตาราง `transaction_logs` (ISO 27001 Security Audit Trail)

```sql
CREATE TABLE transaction_logs (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,          -- 'ciam_sso', 'security_break_glass', 'system_setting'
    action VARCHAR(100) NOT NULL,           -- เช่น 'login_success', 'login_failed', 'toggle_break_glass'
    status VARCHAR(20) DEFAULT 'success',   -- 'success', 'failed', 'warning', 'info'
    message VARCHAR(500) NOT NULL,          -- ข้อความสรุปเหตุการณ์ภาษาไทยที่อ่านเข้าใจง่าย
    details TEXT NULL,                      -- บันทึก JSON String รายละเอียด เช่น IP, Claims, Error, Diff
    records_count INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    triggered_by VARCHAR(100) NOT NULL,     -- 'user:<username>', 'system:ciam', 'system:emergency_admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trans_logs_category ON transaction_logs(category);
CREATE INDEX idx_trans_logs_created_at ON transaction_logs(created_at DESC);
```

---

## 3. ช่องทาง API มาตรฐานที่ระบบลูกต้องพัฒนา (Required API Channels)

ระบบลูก (เช่น IRM, QMS, QOL, SAP B1 Service) ต้องเปิด Endpoint ตามโครงสร้างมาตรฐาน **3 กลุ่มหลัก** ดังต่อไปนี้:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SPOKE APPLICATION API CHANNELS                                    │
├──────────────────────────────┬──────────────────────────────────┬─────────────────────────────────┤
│ Group A: Settings Channel    │ Group B: SSO Authentication Flow │ Group C: Directory & Governance │
│ (สิทธิ์เฉพาะ Admin ของระบบ)   │ (ยืนยันตัวตนกับ AD ผ่าน CIAM)     │ (CIAM สั่งการเข้ามาแบบ M2M)     │
├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ • GET  /api/settings/ciam-sso│ • GET  /api/auth/sso/config      │ • GET   /api/v1/directory/      │
│ • PUT  /api/settings/ciam-sso│ • POST /api/auth/sso/            │         accounts                │
│ • POST /api/settings/ciam-sso│         authorize-url            │ • POST  /api/v1/directory/      │
│        /test-connection      │ • POST /api/auth/sso/callback    │         accounts                │
│                              │ • POST /api/auth/sso/            │ • PATCH /api/v1/directory/      │
│                              │         break-glass-toggle       │         accounts/{user}/status  │
└──────────────────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

---

### หมวด A: System Settings Management Channel (สำหรับ Admin)

#### A.1 `GET /api/settings/ciam-sso` (ดึงค่าคอนฟิกปัจจุบัน)
* **การจำกัดสิทธิ์:** ต้องตรวจสอบ JWT ของผู้ดูแลระบบ (`require_admin` หรือสิทธิ์ดู System Settings)
* **เงื่อนไขความปลอดภัย:** ต้อง Mask รหัสลับ `ciam_client_secret` ให้แสดงเฉพาะ 4 ตัวท้าย เช่น `sec_****_2026`

**Response Example (200 OK):**
```json
{
  "status": "success",
  "settings": {
    "ciam_base_url": "https://ciam.windowasia.com",
    "ciam_client_id": "irm-spoke-client",
    "ciam_client_secret_masked": "sec_****_2026",
    "ciam_sso_enabled": true,
    "ciam_break_glass_active": false,
    "ciam_ad_gateway_url": "http://172.18.0.1:3100",
    "ciam_auto_provision_group": "PU Staff",
    "ciam_session_ttl_minutes": 480,
    "updated_at": "2026-09-11T07:15:30Z"
  }
}
```

---

#### A.2 `PUT /api/settings/ciam-sso` (แก้ไขค่าคอนฟิก Central IAM แบบ Real-Time)
* **การจำกัดสิทธิ์:** Administrator เท่านั้น
* **พฤติกรรมระบบ:**
  1. บันทึกค่าใหม่ลงตาราง `system_settings`
  2. หากฟิลด์ `ciam_client_secret` ส่งมาเป็นค่าว่าง หรือขึ้นต้นด้วย `sec_****` ให้คงค่าเดิมไว้ ไม่เขียนทับ
  3. ล้าง In-Memory Cache เพื่อให้ Service อ่านค่าใหม่ทันที
  4. บันทึก `transaction_logs` หมวด `system_setting` พร้อมระบุ username ผู้แก้ไข และรายการฟิลด์ที่เปลี่ยน

**Request Body:**
```json
{
  "ciam_base_url": "https://ciam.windowasia.com",
  "ciam_client_id": "irm-spoke-client",
  "ciam_client_secret": "sec_irm_oauth_new_secret_2026", // ใส่เฉพาะเมื่อต้องการเปลี่ยน
  "ciam_sso_enabled": true,
  "ciam_ad_gateway_url": "http://172.18.0.1:3100",
  "ciam_auto_provision_group": "PU Staff",
  "ciam_session_ttl_minutes": 480
}
```

---

#### A.3 `POST /api/settings/ciam-sso/test-connection` (ทดสอบการเชื่อมต่อจาก VPS)
* **วัตถุประสงค์:** ใช้ตรวจสอบว่าเซิร์ฟเวอร์ IRM บน VPS สามารถยิงออกไปหาเซิร์ฟเวอร์ Central IAM ได้จริงหรือไม่
* **การทำงาน:**
  1. ดึง `ciam_base_url` จาก `system_settings`
  2. ยิง HTTP GET ไปยัง `${ciam_base_url}/.well-known/openid-configuration` ด้วย Timeout 3 วินาที
  3. ตรวจสอบสถานะการเชื่อมต่อ และทดสอบดึง JWKS Public Keys
  4. ส่งผลสรุปสถานะ ค่า Latency (ms) และ Key ID (kid) ให้ Admin ทราบ

**Response Example (200 OK):**
```json
{
  "status": "connected",
  "latency_ms": 38,
  "ciam_issuer": "https://ciam.windowasia.com",
  "jwks_uri": "https://ciam.windowasia.com/.well-known/jwks.json",
  "keys_found": 1,
  "key_id": "ciam-key-2026-01",
  "message": "สามารถเชื่อมต่อไปยัง Window Asia Central IAM ได้อย่างสมบูรณ์"
}
```

---

### หมวด B: Single Sign-On Execution Channel (สำหรับพนักงานและระบบ)

#### B.1 `GET /api/auth/sso/config` (อ่านสถานะเพื่อนำไปแสดงผลบนหน้าจอ Login)
* **การจำกัดสิทธิ์:** Public (ไม่ต้องล็อกอิน)

**Response Example (200 OK):**
```json
{
  "sso_enabled": true,
  "break_glass_active": false,
  "ciam_base_url": "https://ciam.windowasia.com",
  "client_id": "irm-spoke-client",
  "login_button_label": "เข้าสู่ระบบด้วย Central IAM (SSO)",
  "fallback_ad_available": true
}
```
* **ข้อกำหนดการแสดงผลฝั่ง Frontend:** หาก `sso_enabled == false` ให้ Frontend ซ่อนปุ่ม SSO และเข้าสู่โหมด Clean Standard Login ตามข้อ 5.2 โดยอัตโนมัติ (ไม่แสดงปุ่ม SSO และไม่แสดงข้อความเตือนใดๆ)

---

#### B.2 `POST /api/auth/sso/authorize-url` (สร้างความปลอดภัย PKCE S256)
* **การจำกัดสิทธิ์:** Public
* **พฤติกรรมระบบ:**
  1. ตรวจสอบว่า `ciam_sso_enabled == true` และ `ciam_break_glass_active == false` (หากปิดอยู่ ให้ตอบกลับ HTTP 503 เพื่อให้ Frontend สลับไปใช้ AD Password แทน)
  2. สุ่มสร้าง `code_verifier` ความยาวขั้นต่ำ 64 ตัวอักษร
  3. คำนวณ SHA-256 Digest แล้วเข้ารหัสแบบ Base64URL ได้เป็น `code_challenge` (ตาม RFC 7636)
  4. ส่งค่า `authorize_url`, `code_verifier`, และ `state` คืนให้ Frontend

**Request Body:**
```json
{
  "redirect_uri": "https://irm.windowasia.com/auth/callback"
}
```

**Response Example (200 OK):**
```json
{
  "authorize_url": "https://ciam.windowasia.com/oauth/authorize?response_type=code&client_id=irm-spoke-client&redirect_uri=https%3A%2F%2Firm.windowasia.com%2Fauth%2Fcallback&scope=openid+profile+email&state=state_1726038491&code_challenge=E9Mel-2Gq3...&code_challenge_method=S256",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk...",
  "state": "state_1726038491"
}
```

---

#### B.3 `POST /api/auth/sso/callback` (แลกเปลี่ยน One-Time Code และออก Session ประจำระบบลูก)
* **การจำกัดสิทธิ์:** Public (เบราว์เซอร์ส่งมาหลัง Redirect จาก Central IAM)
* **ขั้นตอนการประมวลผล (Backend-to-Backend):**
  1. Backend ของระบบลูกส่งคำขอ HTTP POST (พร้อม `code`, `code_verifier`, `client_id`, `client_secret`) ตรงไปยัง `${ciam_base_url}/api/v1/oauth/token`
  2. ตรวจสอบ Asymmetric Signature ของ `id_token` ที่ได้รับด้วย Public Key จาก `${ciam_base_url}/.well-known/jwks.json` (อัลกอริทึม RS256)
  3. ตรวจสอบค่า Claims:
     * `iss` ต้องตรงกับ `ciam_base_url`
     * `aud` ต้องตรงกับ `client_id` ของตนเอง
     * `exp` ต้องยังไม่หมดอายุ
  4. **User Resolution & Auto-Provisioning:**
     * ค้นหาผู้ใช้จากตาราง `users` ด้วย `username` หรือ `email`
     * หากยังไม่เคยมีบัญชีในระบบลูก ให้สร้างบัญชีใหม่ทันที โดยผูกกับกลุ่มสิทธิ์ตามค่า `ciam_auto_provision_group` ใน System Settings และตั้งสถานะ `is_active = true`
  5. บันทึก `transaction_logs` หมวด `ciam_sso`
  6. ออก Session Token (JWT) ประจำระบบลูก และตอบกลับให้เบราว์เซอร์

**Request Body:**
```json
{
  "code": "auth_code_9a8b7c6d5e...",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk...",
  "redirect_uri": "https://irm.windowasia.com/auth/callback"
}
```

**Response Example (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 14,
    "username": "somchai.p",
    "full_name": "นายสมชาย พร้อมพงษ์",
    "email": "somchai.p@windowasia.com",
    "department": "Purchasing",
    "group_id": 2,
    "group_name": "PU Staff"
  }
}
```

---

#### B.4 `POST /api/auth/sso/break-glass-toggle` (สวิตช์ปลดระบบฉุกเฉินระดับ ISO 27001)
* **การจำกัดสิทธิ์:** ต้องตรวจสอบสิทธิ์ Admin พิเศษ (Security Administrator)
* **พฤติกรรมระบบ:**
  1. อัปเดตฟิลด์ `ciam_break_glass_active` ในตาราง `system_settings`
  2. บันทึก Audit Log ระดับความสำคัญสูงสุด
  3. ส่งแจ้งเตือนฉุกเฉินไปยัง Telegram / LINE Notify ของทีมผู้บริหารไอทีทันที
  4. เมื่อ Break-Glass เปิดอยู่ หน้าจอ Login ของระบบลูกจะอนุญาตให้พนักงานกรอกรหัสผ่าน Active Directory หรือ Local Admin เพื่อยิงตรงไปยัง `ciam_ad_gateway_url` ได้ทันที

**Request Body:**
```json
{
  "break_glass_active": true,
  "reason": "Central IAM Cloud Network Partition Maintenance"
}
```

---

### หมวด C: Directory Governance & Remote Provisioning Channel (CIAM สั่งการเข้ามาแบบ M2M)

> [!IMPORTANT]
> **ความปลอดภัยระดับองค์กร (Enterprise Security Constraints):**
> 1. **IP Whitelist:** ไฟร์วอลล์และ Reverse Proxy ของระบบลูกต้องอนุญาตเฉพาะ IP VPS ของ Central IAM: **`157.173.219.153`** (ระบบ CIAM จะแนบ Header `X-Forwarded-For: 157.173.219.153` มาด้วยเสมอ)
> 2. **Authentication Header:** ทุก Endpoint ในหมวด C ต้องส่ง HTTP Header: **`X-Management-API-Key: <SPOKE_API_KEY>`** (นำมาจากปุ่ม `🔑 M2M Key` ในหน้าทะเบียนระบบลูกของ Central IAM)
> 3. **Timestamp Verification:** CIAM จะส่ง `X-Request-Timestamp` เพื่อตรวจสอบและป้องกัน Replay Attacks
> 4. **Idempotent:** ทุก Endpoint ต้องรองรับการเรียกซ้ำได้โดยไม่เกิด Error ซ้ำซ้อน (Idempotent Execution)

---

#### C.1 `GET /api/v1/directory/accounts` (Ping, Health Check & 04:00 AM Reconciliation)
* **วัตถุประสงค์:** 
  1. ใช้เป็น **Health Check & Latency Ping** แบบ Real-Time เมื่อ Central IAM ทดสอบสถานะระบบลูก
  2. ใช้สำหรับ **Auto-Reconciliation ประจำวันเวลา 04:00 น.** เพื่อดึงบัญชีผู้ใช้ทั้งหมดมาตรวจสอบ Ghost Account เปรียบเทียบกับ Active Directory
* **Query Parameters ที่รองรับ:**
  * `status`: กรองสถานะ เช่น `all` (ค่าเริ่มต้น), `active`, `inactive`
  * `department`: กรองตามแผนก (Optional)
  * `search`: ค้นหาชื่อหรือ username (Optional)
* **Response Example (200 OK):**
```json
{
  "application_name": "IRM (Incoming Raw Material)",
  "total_accounts": 2,
  "active_accounts": 2,
  "inactive_accounts": 0,
  "accounts": [
    {
      "id": 1,
      "username": "somchai.p",
      "full_name": "นายสมชาย พร้อมพงษ์",
      "email": "somchai.p@windowasia.com",
      "department": "Purchasing",
      "telegram_chat_id": "@somchai_p",
      "group_name": "PU User",
      "use_ad_auth": true,
      "is_active": true,
      "last_login_at": "2026-09-30T08:30:00Z",
      "created_at": "2026-09-20T10:00:00Z",
      "updated_at": "2026-09-30T08:30:00Z"
    },
    {
      "id": 2,
      "username": "local_supplier_01",
      "full_name": "Supplier Partner User",
      "email": "supplier01@partner.com",
      "department": "External Partner",
      "telegram_chat_id": null,
      "group_name": "Supplier Portal",
      "use_ad_auth": false,
      "is_active": true,
      "last_login_at": null,
      "created_at": "2026-09-25T14:20:00Z",
      "updated_at": "2026-09-25T14:20:00Z"
    }
  ]
}
```

---

#### C.2 `POST /api/v1/directory/accounts` (Remote User Provisioning)
* **วัตถุประสงค์:** เรียกใช้เมื่อ Super Admin สร้างหรือแจกจ่ายบัญชีผู้ใช้ใหม่จาก Central IAM ไปยังระบบลูก
* **Request Body:**
```json
{
  "username": "somchai.p",
  "full_name": "นายสมชาย พร้อมพงษ์",
  "email": "somchai.p@windowasia.com",
  "department": "Purchasing",
  "group_name": "PU User",
  "use_ad_auth": true,
  "created_by": "Central-IAM-Service"
}
```
* **พฤติกรรมระบบลูก:**
  1. ค้นหา `username` ในตาราง `users`
  2. หากยังไม่มี ให้บันทึกสร้างบัญชีใหม่ โดยกำหนดกลุ่มสิทธิ์ตาม `group_name` และตั้ง `is_active = true`
  3. หากมีอยู่แล้ว ให้คืนสถานะ `409 Conflict` (Central IAM จะถือว่ามีบัญชีอยู่แล้วและทำการ Link เข้าสู่ระบบ)
  4. บันทึกเหตุการณ์ลงใน `transaction_logs`
* **Response Example (201 Created):**
```json
{
  "success": true,
  "id": 15,
  "username": "somchai.p",
  "message": "Account 'somchai.p' created successfully.",
  "group_name": "PU User",
  "is_active": true,
  "created_at": "2026-09-30T22:00:00Z"
}
```

---

#### C.3 `PATCH /api/v1/directory/accounts/{username}/status` (1-Click Offboarding & Reactivate)
* **วัตถุประสงค์:** 
  1. **1-Click Offboarding:** ตัดสิทธิ์และระงับบัญชีทันทีเมื่อพนักงานลาออกหรือพ้นสภาพ
  2. **Reactivate:** คืนสิทธิ์การใช้งานเมื่อพนักงานกลับมาปฏิบัติหน้าที่
* **Request Body:**
```json
{
  "is_active": false,
  "reason": "1-Click Offboarding via Central Identity Management",
  "updated_by": "Central-IAM-Service"
}
```
* **พฤติกรรมระบบลูก (CRITICAL):**
  1. อัปเดต `is_active = false` (หรือ `true` กรณีคืนสิทธิ์)
  2. **Revoke Active Sessions ทันที (เมื่อ is_active = false):** ล้าง Refresh Token และยกเลิก Session ของผู้ใช้นี้ทันที เพื่อให้หลุดจากระบบแบบ Real-time
  3. บันทึก `transaction_logs` หมวด `ciam_sso` ระบุเหตุการณ์ระงับสิทธิ์หรือคืนสิทธิ์
* **Response Example (200 OK):**
```json
{
  "username": "somchai.p",
  "is_active": false,
  "message": "Account status updated successfully",
  "updated_at": "2026-09-30T22:00:00Z"
}
```

---

#### C.4 การจัดการผู้ใช้ Local Account (Non-AD Users) และข้อยกเว้นการใช้งาน App Portal
* **ที่มาและความจำเป็น:**
  * ในองค์กรจริง อาจมีผู้ใช้บางกลุ่มที่**ไม่ได้อยู่ใน Active Directory** แต่ถูกสร้างขึ้นโดยตรงในระบบลูก เช่น ผู้ใช้งานชั่วคราว, ช่างภายนอก หรือ Supplier ในระบบ IRM
  * บัญชีเหล่านี้จะมีแฟล็ก `use_ad_auth: false` ในตาราง `users`
* **มาตรฐานการเชื่อมต่อ:**
  1. เมื่อ Central IAM สั่ง Sync ผ่าน `GET /api/v1/directory/accounts` ระบบลูกจะส่งฟิลด์ `use_ad_auth: false` กลับมาในรายการบัญชี
  2. ฝั่ง Central IAM จะระบุบัญชีนี้เป็น **"Local Account ใน Spoke"** โดยอัตโนมัติ
  3. ผู้ดูแลระบบสามารถตั้งรหัสผ่าน Portal Password หรือสร้าง **"ข้อยกเว้นการเชื่อมโยงตัวตน (Identity Exception)"** ในหน้า Portal & Directory ให้กับผู้ใช้รายนี้ได้
  4. เมื่อผู้ใช้ดังกล่าวล็อกอินเข้า Central IAM Portal ด้วยรหัสผ่าน Portal:
     * **หน้า App Portal จะแสดงเฉพาะแอปที่เขามีสิทธิ์ (เช่น IRM) เท่านั้น** และซ่อนระบบอื่นที่ไม่มีสิทธิ์ออกไปโดยอัตโนมัติ
     * ผู้ใช้สามารถคลิกเข้าสู่ระบบลูกผ่าน Single Sign-On ได้อย่างราบรื่น
  5. หากผู้ใช้รายเดียวกันมีบัญชีใน 2 ระบบลูกที่ไม่ได้ใช้ AD ทั้งคู่ และรหัสผ่านไม่ตรงกัน ผู้ดูแลระบบสามารถใช้ฟังก์ชัน **"รวมตัวตน (Unified Identity Link)"** ในหน้าบัญชีผู้ใช้ Central IAM เพื่อผูกบัญชีทั้งสองเข้ากับ Portal Identity เดียวกันได้อย่างปลอดภัย

---

## 4. มาตรฐานการบันทึก Audit Logs ในระบบลูก (Log Matrix Specification)

ระบบลูกทุกระบบต้องบันทึกเหตุการณ์ลงในตาราง `transaction_logs` ตามเงื่อนไขดังต่อไปนี้อย่างครบถ้วน:

| Event Code | Category | Action | Status | Message ภาษาไทย | Triggered By | ข้อมูลในฟิลด์ Details (JSON String) |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **SSO-01** | `ciam_sso` | `login_success` | `success` | เข้าสู่ระบบผ่าน Central IAM SSO สำเร็จ: ผู้ใช้ '{username}' | `user:{username}` | `{"username":"...", "ip":"...", "ciam_issuer":"...", "auth_method":"OIDC_PKCE_S256", "roles":{...}}` |
| **SSO-02** | `ciam_sso` | `login_failed` | `failed` | การยืนยันตัวตน SSO ล้มเหลว: {สาเหตุ} | `user:{username}` | `{"error":"SignatureVerificationFailed", "ip":"...", "detail":"Token expired or tampered"}` |
| **SSO-03** | `ciam_sso` | `auto_provision_user` | `info` | สร้างบัญชีผู้ใช้ใหม่อัตโนมัติจาก Central IAM: '{username}' | `system:ciam` | `{"username":"...", "email":"...", "group_assigned":"PU Staff", "claims":{...}}` |
| **SSO-04** | `ciam_sso` | `account_deactivated` | `warning` | ปฏิเสธการเข้าสู่ระบบ: บัญชีพนักงาน '{username}' ถูกระงับสิทธิ์ในระบบนี้ | `user:{username}` | `{"username":"...", "ip":"...", "reason":"is_active is false"}` |
| **BG-01** | `security_break_glass` | `toggle_break_glass` | `warning` / `success` | สลับสถานะระบบ Break-Glass: {ENABLED/DISABLED} | `user:{admin_user}` | `{"break_glass_active":true, "reason":"...", "ip":"...", "prev_state":false}` |
| **BG-02** | `security_break_glass` | `fallback_ad_login` | `success` | เข้าสู่ระบบผ่าน AD Gateway สำรองในช่วง Break-Glass: '{username}' | `user:{username}` | `{"username":"...", "gateway":"http://172.18.0.1:3100", "ip":"..."}` |
| **CFG-01**| `system_setting` | `update_ciam_settings`| `success` | แก้ไขการตั้งค่าระบบ Central IAM SSO | `user:{admin_user}` | `{"changed_fields":["ciam_base_url","ciam_session_ttl_minutes"], "ip":"..."}` |

---

## 5. มาตรฐานหน้าจอจัดการบน Frontend (UI Guidelines)

### 5.1 หน้าจอ System Settings (แท็บ "Central IAM SSO")
ให้ผู้พัฒนาฝั่ง Frontend สร้างฟอร์มการตั้งค่าในหน้าผู้ดูแลระบบ ประกอบด้วย:

1. **การ์ดสถานะการเชื่อมต่อ (Health & Status Banner):**
   * ป้ายไฟสถานะ: `🟢 เชื่อมต่อปกติ (Online)` หรือ `🔴 ไม่สามารถเชื่อมต่อได้ (Offline)`
   * ปุ่ม `[ ⚡ ทดสอบการเชื่อมต่อไปยัง Central IAM ]` เรียกใช้ API `POST /api/settings/ciam-sso/test-connection`
2. **ฟิลด์แบบฟอร์มการตั้งค่า:**
   * `Central IAM Base URL` (Text Input, เช่น `https://ciam.windowasia.com`)
   * `OIDC Client ID` (Text Input, เช่น `irm-spoke-client`)
   * `OIDC Client Secret` (Password Input มีปุ่มคลิกเพื่อเปิดดู และปุ่มสลับเพื่อกรอก Secret ใหม่)
   * `Active Directory Gateway URL` (Text Input, ค่าเริ่มต้น `http://172.18.0.1:3100`)
   * `กลุ่มสิทธิ์เริ่มต้น (Default Group)` (Dropdown รายชื่อ Group เช่น PU Staff, User)
   * `สวิตช์เปิด/ปิด SSO (Enforce SSO Toggle)`
3. **การ์ดสวิตช์ฉุกเฉิน (Break-Glass Emergency Panel):**
   * กล่องสีเหลือง/แดง พร้อมคำเตือน
   * สวิตช์เปิดโหมด Break-Glass (ต้องพิมพ์ยืนยันเหตุผลก่อนกดยืนยัน)

---

### 5.2 มาตรฐานหน้าจอล็อกอินและพฤติกรรมเมื่อปิด SSO (Zero-Confusion Single-Button Standard)

> [!IMPORTANT]
> **กฎความเรียบง่ายและไม่ทำให้ผู้ใช้สับสน (Zero-Confusion Standard):**  
> หน้าจอล็อกอินของระบบลูก (Spoke Login Page) จะต้องปรับเปลี่ยนการแสดงผลตามสถานะของ `ciam_sso_enabled` และ `ciam_break_glass_active` อย่างเคร่งครัดตาม 3 สถานการณ์ดังนี้:

#### สถานการณ์ที่ 1: เปิดใช้งาน SSO ปกติ (`ciam_sso_enabled = true` และ `ciam_break_glass_active = false`)
* **ปุ่มหลักเพียงปุ่มเดียว (Single Primary CTA):** แสดงปุ่มเด่นชัดสีน้ำเงิน/ฟ้า **`[ 🛡️ เข้าสู่ระบบด้วย Window Asia SSO ✨ ]`** เป็นปุ่มหลักเพียงปุ่มเดียวในหน้าจอ
* **ซ่อนฟอร์ม Local Login เริ่มต้น (Hidden by Default):** **ซ่อนช่อง Username, Password และปุ่ม Sign In ดั้งเดิมไว้โดยเริ่มต้น** เพื่อไม่ให้พนักงานทั่วไปเกิดความสับสนว่าต้องพิมพ์รหัสตรงนี้หรือกดปุ่ม SSO ด้านบน
* **ลิงก์สำรองสำหรับผู้ดูแลระบบ (Local Admin Link):** ทำเป็นข้อความลิงก์เล็กๆ ด้านล่าง เช่น *"เข้าสู่ระบบด้วยบัญชี Local (กรณีฉุกเฉิน) →"* สำหรับให้แอดมินคลิกเพื่อกางฟอร์มกรอกรหัสผ่านในกรณีพิเศษ (เช่น บัญชี `admin`)
* **รองรับ Seamless True SSO:** เมื่อพนักงานมีเซสชันเดิมบน Central IAM (หรือเปิดมาจาก Portal) การคลิกปุ่ม SSO จะทำการยืนยันตัวตนและนำทางเข้าสู่ระบบลูกโดยอัตโนมัติใน ~0.8 วินาทีโดยไม่ต้องพิมพ์ชื่อและรหัสผ่านซ้ำอีก

#### สถานการณ์ที่ 2: ปิดใช้งาน SSO ในระบบลูก (`ciam_sso_enabled = false`)
* ❌ **ห้ามแสดงปุ่ม SSO โดยเด็ดขาด:** ไม่ต้องเรนเดอร์ปุ่ม SSO สีฟ้า
* ❌ **ห้ามแสดงแบนเนอร์แจ้งเตือน SSO:** ห้ามมีกล่องข้อความเตือนใดๆ เช่น *"Central IAM SSO ปิดใช้งานชั่วคราว"* หรือ *"SSO Disabled"*
* ❌ **ห้ามแสดงเส้นคั่น Break-Glass:** ห้ามแสดงข้อความ *"หรือเข้าสู่ระบบสำรอง (Break-Glass Login)"*
* ❌ **ห้ามมีคำว่า "สำรอง" บนปุ่มกดยืนยัน:** ปุ่ม Submit ด้านล่างต้องแสดงข้อความมาตรฐานคือ **`เข้าสู่ระบบ (Sign In)`** เท่านั้น (ไม่ใช่ "เข้าสู่ระบบสำรอง")
* ❌ **ห้ามแสดง Footer เกี่ยวกับ Break-Glass:** ซ่อนข้อความ *"Break-Glass Ready"* ท้ายหน้าจอ
* **ผลลัพธ์ที่ต้องการ:** หน้าจอจะกลายเป็นฟอร์ม Login แบบมาตรฐานดั้งเดิม 100% (ช่อง Username, Password และปุ่มเข้าสู่ระบบ) ผู้ใช้ทั่วไปจะไม่เห็นคำว่า SSO หรือคำว่า "สำรอง" ใดๆ ทั้งสิ้น

#### สถานการณ์ที่ 3: โหมดฉุกเฉิน Break-Glass (`ciam_break_glass_active = true`)
* แสดงกล่องแจ้งเตือนสีเหลือง/ส้มด้านบน: `⚠️ ระบบอยู่ในโหมดฉุกเฉิน (Break-Glass Active) - เข้าใช้งานด้วยรหัสผ่านตรง`
* เปิดฟอร์ม Username และ Password ให้อัตโนมัติ โดยปุ่มกดยืนยันแสดงข้อความ: `เข้าสู่ระบบฉุกเฉิน (Break-Glass Sign In)`

---

### 5.3 มาตรฐานการออกจากระบบและการหมดอายุของเซสชัน (Seamless Logout & Expired Lifecycle)

เพื่อให้ประสบการณ์การทำงานข้ามระบบของพนักงาน (Cross-App Experience) เป็นไปอย่างไร้รอยต่อตามหลักการ Enterprise Launchpad:

1. **เมื่อพนักงานกด "ออกจากระบบ (Logout)" ในระบบลูก:**
   * **กรณีล็อกอินผ่าน SSO (พนักงาน 99%):**
     * ระบบลูกทำการล้าง Token และ Session เฉพาะของระบบลูกเอง
     * นำทางผู้ใช้กลับไปยังหน้า **Central IAM Portal (`https://ciam.windowasia.com/portal`)** ทันที
     * **ผลลัพธ์:** พนักงานกลับมาที่หน้าโต๊ะทำงานกลาง โดยที่เซสชันของ Central IAM ยังคงอยู่ ทำให้สามารถคลิกเปิดระบบงานอื่น (เช่น SAP B1, QMS, QOL, HR) ต่อได้ทันทีโดยไม่ต้องล็อกอินใหม่
   * **กรณีล็อกอินผ่าน Local Admin (`admin` กรณีฉุกเฉิน):**
     * นำทางกลับไปยังหน้า `/login` ของระบบลูกตามเดิม
2. **เมื่อเซสชันในระบบลูกหมดอายุ (HTTP 401 Unauthorized):**
   * หาก Request ในระบบลูกได้รับ HTTP 401 (Token Expired):
     * ให้ล้าง Token ของระบบลูก และนำทางผู้ใช้กลับไปยัง Central IAM Portal (`https://ciam.windowasia.com/portal`) เช่นเดียวกัน
     * หากเซสชันบน Central IAM ยังไม่หมดอายุ พนักงานสามารถคลิกเปิดระบบลูกใหม่ได้ทันทีใน 1 วินาที (Seamless Re-auth) โดยงานไม่สะดุด

---

## 6. ลำดับขั้นตอนการพัฒนาสำหรับทีม Dev (Step-by-Step Implementation Checklist)

1. [ ] **สร้างตารางและ Seed ข้อมูล:** ตรวจสอบตาราง `system_settings` และใส่ Seed Keys สำหรับหมวด `central_iam`
2. [ ] **ปรับปรุง Service Config:** เปลี่ยน `get_sso_client()` ให้อ่านค่าจากตาราง `system_settings` (ไม่ใช่จากไฟล์ `.env`)
3. [ ] **สร้าง API Channel หมวด A (Settings):** พัฒนา Endpoint `GET`, `PUT`, และ `POST /test-connection` สำหรับ System Settings
4. [ ] **เชื่อมโยงการบันทึก Audit Logs:** ติดตั้งคำสั่ง `record_transaction_log` ตาม Event Code ทั้ง 7 เคส ในตารางข้อ 4
5. [ ] **ทดสอบบน VPS:** 
   * เข้าหน้า System Settings บนแอปพลิเคชัน
   * ระบุ `ciam_base_url` และกดปุ่มทดสอบการเชื่อมต่อ
   * ตรวจสอบว่าหน้า Login แสดงปุ่ม *"เข้าสู่ระบบด้วย Central IAM (SSO)"*
   * ทดสอบคลิกเข้าใช้งานจริง และตรวจสอบตาราง `transaction_logs` ว่ามีข้อมูลครบถ้วน

---

## 7. มาตรฐานการซิงก์ข้อมูลอัตโนมัติประจำวัน (Daily Scheduled Sync & Manual Trigger)

เพื่อให้ข้อมูลสถานะบัญชีพนักงานและเวลาใช้งานล่าสุดข้ามระบบ (Cross-System Activity) มีความแม่นยำสูงสุด Central IAM ได้กำหนดมาตรฐานรอบการซิงก์ข้อมูลดังนี้:

1. **รอบการซิงก์อัตโนมัติ (Automated Daily Schedule):**
   * ระบบ Central IAM จะเริ่มกระบวนการซิงก์ข้อมูลรอบประจำวันทุกวันเวลา **04:00 AM (เวลาไทย Asia/Bangkok, GMT+7)**
   * เป็นช่วงเวลาที่มีปริมาณการใช้งานระบบต่ำ (Off-Peak Hours) ป้องกันผลกระทบต่อภาระการทำงานของเซิร์ฟเวอร์ (Server Load)
   * ข้อมูลสรุปสถานะการเข้าใช้งานและบัญชีคงค้างจะพร้อมแสดงผลบน Dashboard ให้ฝ่ายบุคคล (HR) และผู้บริหารก่อนเวลาเริ่มงาน 08:00 น.
2. **การสั่งซิงก์ด้วยตนเอง (On-Demand Manual Sync):**
   * **ปุ่มซิงก์แยกตามระบบ (Per-App Sync):** อยู่ที่การ์ดของแต่ละระบบ สามารถกดเพื่อตรวจสอบสถานะของระบบใดระบบหนึ่งได้ทันที
   * **ปุ่มซิงก์ทุกระบบพร้อมกัน (Sync All):** ปุ่ม `[ ⚡ ซิงก์ทุกระบบทันที ]` ที่ส่วนหัวของหน้า Applications สำหรับผู้ดูแลระบบที่ต้องการให้ทุก Spoke อัปเดตข้อมูลพร้อมกันในทันที
3. **การตั้งค่ากำหนดเวลา (Customizable Schedule):**
   * ผู้ดูแลระบบสามารถปรับเปลี่ยนเวลาซิงก์ หรือเปิด/ปิดระบบ Auto-Sync ได้ผ่านหน้าต่าง **"กำหนดเวลาซิงก์อัตโนมัติ"** บนหน้าเว็บ Central IAM

---

## 8. นโยบายการตรวจสอบ Active Directory (AD Read-Only Audit Policy)

เพื่อให้เป็นไปตามมาตรฐานความปลอดภัยข้อมูลสารสนเทศ (ISO 27001 / Zero Trust Architecture) และหลักการจำกัดสิทธิ์ขั้นต่ำ (Principle of Least Privilege):

1. **บทบาทการทำงานแบบ Read-Only Audit:**
   * การเชื่อมต่อของ Central IAM ไปยัง Active Directory Domain Services (AD DS) กำหนดให้ใช้สิทธิ์ระดับ **อ่านอย่างเดียว (Read-Only)**
   * Central IAM จะดึงเฉพาะรายชื่อพนักงาน (`sAMAccountName`, `displayName`, `mail`, `department`, `employeeID`) และตรวจสอบสถานะ Flag `userAccountControl` (512 = Enabled, 514 = Disabled)
2. **การไม่แตะต้อง Domain Controller (Zero-Risk Operations):**
   * Central IAM **ไม่มีความจำเป็นและไม่ได้รับอนุญาตให้ส่งคำสั่งแก้ไขหรือ Disable บัญชีบน AD Domain Controller โดยตรง**
   * ขั้นตอนการระงับหรือปิดบัญชีบน AD ยังคงเป็นหน้าที่ตามขั้นตอนทางการของ IT Helpdesk / ฝ่ายบุคคล (HR)
3. **การตัดสิทธิ์เฉพาะระบบลูก (Targeted Spoke Deprovisioning):**
   * หน้าที่สำคัญของ Central IAM คือการเป็น **Governance & Reconciliation Hub**
   * เมื่อตรวจพบว่าบัญชีบน AD ถูกปิดใช้งาน (`userAccountControl` = 514) แต่ในระบบลูก (เช่น IRM, QOL, SAP B1) ยังเปิดค้างอยู่ ระบบจะระบุเป็น **"บัญชีผี (Discrepancy)"** และส่งคำสั่งระงับสิทธิ์ (Deprovision) ไปยังระบบลูกเป้าหมายเพื่อปิดความเสี่ยงทันที โดยไม่รบกวน AD DC

---

## 9. สรุปความสัมพันธ์ด้านการยืนยันตัวตนกับ Active Directory (AD Authentication Clarification)

> [!NOTE]
> **คำถามพบบ่อย: ทำไมนักพัฒนาระบบลูกถึงไม่ต้องเชื่อมต่อกับ Active Directory / LDAP โดยตรง?**
> 
> ในสถาปัตยกรรม Central IAM บริษัท วินโดว์ เอเชีย จำกัด (มหาชน):
> 1. **Central IAM ทำหน้าที่เป็น Identity Provider (IdP) กลางเพียงจุดเดียว:**
>    * เมื่อผู้ใช้คลิก *"เข้าสู่ระบบด้วย Central IAM (SSO)"* ระบบลูกจะ Redirect ผู้ใช้มายังหน้าล็อกอินของ Central IAM
>    * Central IAM จะทำการตรวจสอบชื่อผู้ใช้และรหัสผ่านกับ Domain Controller (ผ่าน AD Proxy Service ภายใน) โดยตรง
> 2. **ความปลอดภัยระดับสูงสุด (Zero Domain Exposure):**
>    * ระบบลูก **ไม่ต้องเปิด Port 389/636 (LDAP) ข้ามเครือข่าย**
>    * ระบบลูก **ไม่ต้องเก็บ Service Account หรือรหัสผ่านของ Domain Controller ไว้ในซอร์สโค้ด**
>    * ระบบลูกเพียงแค่รอรับ JWT Token (RS256) ที่ผ่านการพิสูจน์ตัวตนจาก AD แล้วเท่านั้น
> 3. **โหมดสำรองฉุกเฉิน (Break-Glass Mode):**
>    * เฉพาะในกรณีที่ระบบคลาวด์หรือเน็ตเวิร์กของ Central IAM ขัดข้อง ระบบลูกสามารถเปิดใช้งาน `ciam_break_glass_active = true` เพื่อสลับไปยืนยันตัวตนตรงกับ Local AD Gateway (`http://172.18.0.1:3100`) ผ่าน API ได้ทันที

---

## 10. โค้ดตัวอย่างพร้อมใช้งานสำหรับทีม Developer (Implementation Boilerplate)

### 10.1 ตัวอย่าง Python (FastAPI): Group C Inbound Directory & Governance Channel (ตามมาตรฐาน IRM)

```python
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Header, HTTPException, Depends, Request, status
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/directory", tags=["Central Management"])

# ดึงค่า M2M Key จากตาราง system_settings (key: ciam_m2m_key) หรือค่าคงที่
EXPECTED_M2M_KEY = "sec_your_app_mgmt_key_here"
ALLOWED_CIAM_IP = "157.173.219.153" # IP ของเซิร์ฟเวอร์ Central IAM

def verify_ciam_management_access(
    request: Request,
    x_management_api_key: Optional[str] = Header(None, alias="X-Management-API-Key"),
):
    # 1. ตรวจสอบ M2M API Key
    if not x_management_api_key or x_management_api_key != EXPECTED_M2M_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Management-API-Key header.",
        )
    # 2. ตรวจสอบ IP Whitelist (ถ้าต้องการจำกัดระดับ Network)
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    # ใน Local/Dev ให้ยกเว้น localhost
    if client_ip not in [ALLOWED_CIAM_IP, "127.0.0.1", "localhost", "::1"]:
        # raise HTTPException(status_code=403, detail=f"IP {client_ip} not allowed")
        pass
    return {"client_ip": client_ip}

class CreateAccountRequest(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    group_name: Optional[str] = None
    use_ad_auth: bool = True
    created_by: Optional[str] = "Central-IAM-Service"

class UpdateStatusRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = "Status updated via Central Management API"
    updated_by: Optional[str] = "Central-IAM-Service"

@router.get("/accounts", dependencies=[Depends(verify_ciam_management_access)])
def list_accounts_for_ciam(status: str = "all", department: Optional[str] = None, search: Optional[str] = None):
    """ใช้ทั้ง Ping/Health Check และ Reconciliation ประจำวันเวลา 04:00 น."""
    # TODO: Query จากตาราง users ในฐานข้อมูลของระบบลูก
    return {
        "application_name": "My Spoke Application",
        "total_accounts": 1,
        "active_accounts": 1,
        "inactive_accounts": 0,
        "accounts": [
            {
                "id": 1,
                "username": "somchai.p",
                "full_name": "นายสมชาย พร้อมพงษ์",
                "email": "somchai.p@windowasia.com",
                "department": "Purchasing",
                "group_name": "PU User",
                "use_ad_auth": True,
                "is_active": True,
                "last_login_at": "2026-09-30T08:30:00Z",
                "created_at": "2026-09-20T10:00:00Z",
                "updated_at": "2026-09-30T08:30:00Z"
            }
        ]
    }

@router.post("/accounts", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_ciam_management_access)])
def create_account_from_ciam(payload: CreateAccountRequest):
    """สร้างหรือ Provision บัญชีผู้ใช้ใหม่จาก Central IAM"""
    # TODO: ตรวจสอบว่ามีอยู่แล้วหรือไม่ ถ้ามีให้ raise HTTPException(409, detail="User exists")
    # TODO: สร้าง User ใหม่ และบันทึกลงฐานข้อมูล
    return {
        "success": True,
        "id": 99,
        "username": payload.username,
        "message": f"Account '{payload.username}' created successfully.",
        "group_name": payload.group_name,
        "is_active": True,
        "created_at": datetime.now()
    }

@router.patch("/accounts/{username}/status", dependencies=[Depends(verify_ciam_management_access)])
def update_account_status_from_ciam(username: str, payload: UpdateStatusRequest):
    """1-Click Offboarding (ระงับสิทธิ์ทันที) หรือ คืนสิทธิ์การใช้งาน"""
    # TODO: อัปเดต user.is_active = payload.is_active
    # TODO: ถ้า payload.is_active == False ให้เตะ Session และ Revoke Refresh Tokens ทั้งหมดทันที
    return {
        "username": username,
        "is_active": payload.is_active,
        "message": f"Status for '{username}' updated successfully.",
        "updated_at": datetime.now()
    }
```

### 10.2 ตัวอย่าง Node.js (Express.js): Group C Inbound Directory Channel

```javascript
const express = require('express');
const router = express.Router();

const EXPECTED_M2M_KEY = process.env.CIAM_M2M_KEY || "sec_your_app_mgmt_key_here";
const ALLOWED_CIAM_IP = "157.173.219.153";

// Middleware ตรวจสอบความปลอดภัย
function verifyCiamManagementAccess(req, res, next) {
  const apiKey = req.headers['x-management-api-key'];
  if (!apiKey || apiKey !== EXPECTED_M2M_KEY) {
    return res.status(401).json({ status: "FAILED", message: "Invalid or missing X-Management-API-Key" });
  }
  next();
}

// 1. Directory Inventory & Health Check
router.get('/api/v1/directory/accounts', verifyCiamManagementAccess, async (req, res) => {
  // TODO: Query users จากฐานข้อมูล
  res.json({
    application_name: "Node Spoke App",
    total_accounts: 1,
    active_accounts: 1,
    inactive_accounts: 0,
    accounts: [
      {
        id: 1,
        username: "somchai.p",
        full_name: "นายสมชาย พร้อมพงษ์",
        email: "somchai.p@windowasia.com",
        department: "Purchasing",
        group_name: "Standard User",
        use_ad_auth: true,
        is_active: true,
        created_at: new Date()
      }
    ]
  });
});

// 2. Remote User Provisioning
router.post('/api/v1/directory/accounts', verifyCiamManagementAccess, async (req, res) => {
  const { username, full_name, email, department, group_name, use_ad_auth } = req.body;
  // TODO: Insert user หรือตอบกลับ 409 Conflict หากมีอยู่แล้ว
  res.status(201).json({
    success: true,
    id: 100,
    username,
    message: `Account '${username}' provisioned successfully`,
    is_active: true,
    created_at: new Date()
  });
});

// 3. 1-Click Offboarding & Reactivate
router.patch('/api/v1/directory/accounts/:username/status', verifyCiamManagementAccess, async (req, res) => {
  const { username } = req.params;
  const { is_active, reason } = req.body;
  // TODO: อัปเดต is_active และถ้า false ให้เตะ Session ออกจากระบบทันที
  res.json({
    username,
    is_active,
    message: `Account status updated to ${is_active}`,
    updated_at: new Date()
  });
});

module.exports = router;
```

---

### 10.3 ตัวอย่างการทำ SSO Client ฝั่งระบบลูก (Python FastAPI / Backend)

ตัวอย่างโค้ดที่ระบบลูกนำไปใช้สำหรับ:
1. สร้าง PKCE และส่ง User ไปหน้า Login ของ Central IAM
2. รับ Callback แลก Token และตรวจสอบสิทธิ์พนักงานจาก Active Directory

```python
import hashlib
import base64
import secrets
import httpx
import jwt # pip install pyjwt cryptography
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth/sso", tags=["SSO Client"])

CIAM_BASE_URL = "https://ciam.windowasia.com"
CLIENT_ID = "irm-spoke-client"                  # ดึงจาก system_settings
CLIENT_SECRET = "sec_irm_oauth_secret_2026"     # ดึงจาก system_settings
REDIRECT_URI = "https://irm.windowasia.com/auth/callback"

# เก็บ code_verifier ชั่วคราว (ใน Production ควรเก็บใน Redis หรือ Encrypted Session Cookie)
pkce_sessions = {}

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').replace('=', '')

@router.get("/login")
def sso_login():
    """Step 1: สร้าง PKCE S256 Challenge และ Redirect ผู้ใช้ไปที่ Central IAM"""
    # 1. สร้าง Code Verifier & Challenge
    verifier = base64url_encode(secrets.token_bytes(32))
    challenge = base64url_encode(hashlib.sha256(verifier.encode('utf-8')).digest())
    state = secrets.token_hex(16)

    pkce_sessions[state] = verifier

    # 2. สร้าง Authorize URL
    auth_url = (
        f"{CIAM_BASE_URL}/oauth/authorize?"
        f"response_type=code&"
        f"client_id={CLIENT_ID}&"
        f"redirect_uri={REDIRECT_URI}&"
        f"scope=openid+profile+email&"
        f"state={state}&"
        f"code_challenge={challenge}&"
        f"code_challenge_method=S256"
    )
    return RedirectResponse(url=auth_url)

class CallbackPayload(BaseModel):
    code: str
    state: str

@router.post("/callback")
async def sso_callback(payload: CallbackPayload):
    """Step 2: รับ Code จาก Central IAM แลกเปลี่ยน Token และดึง Claims จาก AD"""
    verifier = pkce_sessions.pop(payload.state, None)
    if not verifier:
        raise HTTPException(status_code=400, detail="Invalid state session or CSRF detected")

    # 1. แลก Authorization Code เป็น Tokens
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_res = await client.post(
            f"{CIAM_BASE_URL}/api/v1/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": payload.code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": verifier
            }
        )

        if token_res.status_code != 200:
            raise HTTPException(status_code=401, detail=f"Token exchange failed: {token_res.text}")

        token_data = token_res.json()
        id_token = token_data.get("id_token")

        # 2. ดึง JWKS Public Keys เพื่อตรวจสอบ Asymmetric Signature (RS256)
        jwks_res = await client.get(f"{CIAM_BASE_URL}/.well-known/jwks.json")
        jwks = jwks_res.json()

    # 3. ตรวจสอบ Signature และอ่าน Claims จาก AD
    jwks_client = jwt.PyJWKClient(f"{CIAM_BASE_URL}/.well-known/jwks.json")
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)

    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=CLIENT_ID,
        issuer=CIAM_BASE_URL
    )

    # 4. ข้อมูลพนักงานที่ผ่านการตรวจสอบจาก Active Directory เรียบร้อยแล้ว:
    username = claims.get("preferred_username") # sAMAccountName เช่น somchai.p
    full_name = claims.get("name")              # ชื่อ-นามสกุล เช่น นายสมชาย พร้อมพงษ์
    email = claims.get("email")                 # อีเมลบริษัท
    department = claims.get("department")       # แผนก เช่น Purchasing
    employee_id = claims.get("employee_id")     # รหัสพนักงาน เช่น WA-1029
    groups = claims.get("groups", [])           # AD Security Groups

    # 5. ออก Session หรือ JWT ของระบบลูก และอนุญาตให้เข้าใช้งาน Dashboard ได้ทันที
    return {
        "status": "success",
        "message": f"เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {full_name}",
        "user": {
            "username": username,
            "full_name": full_name,
            "email": email,
            "department": department,
            "employee_id": employee_id,
            "groups": groups
        },
        "spoke_token": "your_app_session_jwt_token_here"
    }
```

---

### 10.4 ตัวอย่างการทำ SSO Client ฝั่งระบบลูก (Node.js / Express / Next.js)

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const router = express.Router();

const CIAM_BASE_URL = "https://ciam.windowasia.com";
const CLIENT_ID = "irm-spoke-client";
const CLIENT_SECRET = "sec_irm_oauth_secret_2026";
const REDIRECT_URI = "https://irm.windowasia.com/auth/callback";

// JWKS Client สำหรับดึง Public Key ของ CIAM
const jwks = jwksClient({
  jwksUri: `${CIAM_BASE_URL}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, function (err, key) {
    const signingKey = key?.publicKey || key?.rsaPublicKey;
    callback(null, signingKey);
  });
}

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 1. Endpoint ส่ง User ไปล็อกอินที่ Central IAM
router.get('/login', (req, res) => {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = crypto.randomBytes(16).toString('hex');

  // บันทึก verifier ใน Session หรือ Cookie
  res.cookie('sso_verifier', verifier, { httpOnly: true, secure: true, maxAge: 300000 });

  const authUrl = `${CIAM_BASE_URL}/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=openid+profile+email` +
    `&state=${state}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`;

  res.redirect(authUrl);
});

// 2. Endpoint รับ Callback และดึงข้อมูลพนักงานจาก AD
router.post('/callback', async (req, res) => {
  const { code } = req.body;
  const verifier = req.cookies['sso_verifier'];

  try {
    // 2.1 แลก Authorization Code เป็น Tokens
    const tokenRes = await axios.post(`${CIAM_BASE_URL}/api/v1/oauth/token`, new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { id_token } = tokenRes.data;

    // 2.2 ตรวจสอบ Signature ของ ID Token ด้วย JWKS
    jwt.verify(id_token, getKey, {
      algorithms: ['RS256'],
      audience: CLIENT_ID,
      issuer: CIAM_BASE_URL
    }, (err, claims) => {
      if (err) {
        return res.status(401).json({ status: "FAILED", message: "Invalid ID Token Signature" });
      }

      // 2.3 อ่านข้อมูลพนักงานจาก AD
      const { preferred_username, name, email, department, employee_id, groups } = claims;

      // TODO: ออก Session Token ของระบบลูก และส่งกลับให้ Frontend
      res.json({
        status: "SUCCESS",
        user: { username: preferred_username, name, email, department, employee_id, groups }
      });
    });
  } catch (error) {
    res.status(500).json({ status: "FAILED", message: error.response?.data || error.message });
  }
});

module.exports = router;
```

---

### 10.5 ตัวอย่างการจัดการ Logout และ 401 Session Expired บน Frontend (React / Next.js / Vue)

ตัวอย่างโค้ดฝั่ง Client ของระบบลูกที่ช่วยให้รองรับ Seamless Return to Portal:

```typescript
// 1. ฟังก์ชัน Logout ในระบบลูก (เช่น ใน Header หรือ User Menu)
export const handleLogout = () => {
  const authProvider = typeof window !== 'undefined' ? localStorage.getItem('app_auth_provider') : null;
  const ciamPortalUrl =
    (typeof window !== 'undefined' && localStorage.getItem('app_ciam_portal_url')) ||
    'https://ciam.windowasia.com/portal';

  // ล้าง Token เฉพาะของระบบลูก
  if (typeof window !== 'undefined') {
    localStorage.removeItem('app_access_token');
    localStorage.removeItem('app_refresh_token');
    localStorage.removeItem('app_auth_provider');
  }

  if (authProvider === 'local') {
    // ผู้ใช้ที่เป็น Local Admin -> เด้งไปหน้า Login ของระบบลูก
    window.location.href = '/login';
  } else {
    // ผู้ใช้ที่เข้าผ่าน SSO -> นำทางกลับสู่ Central IAM Portal กลางอย่างไร้รอยต่อ
    window.location.href = ciamPortalUrl;
  }
};

// 2. การดักจับ HTTP 401 (Session Expired Interceptor ใน Axios หรือ Fetch)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isLoginPage = window.location.pathname === '/login';
      const isAuthCallback = window.location.pathname === '/auth/callback';
      if (!isLoginPage && !isAuthCallback) {
        handleLogout();
      }
    }
    return Promise.reject(error);
  }
);
```
