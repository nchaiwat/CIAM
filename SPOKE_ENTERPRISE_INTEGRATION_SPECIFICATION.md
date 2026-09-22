# ข้อกำหนดมาตรฐานกลาง: การเชื่อมต่อระบบลูกกับ Central IAM ผ่าน System Settings & Transaction Logs
**Standard Specification:** Enterprise Central IAM Integration for Spoke Applications  
**Version:** 2.0.0 (Zero `.env` Dependency Edition)  
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
| `ciam_ad_gateway_url` | string | `http://192.168.12.11:3100` | URL เซิร์ฟเวอร์ AD Gateway ภายในองค์กร |
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

ระบบลูก (เช่น IRM) ต้องเปิด Endpoint ตามโครงสร้างมาตรฐาน 2 กลุ่ม ดังต่อไปนี้:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SPOKE APPLICATION API CHANNELS                        │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  Group A: System Setting Channel     │  Group B: SSO Execution Channel      │
│  (สิทธิ์เฉพาะ Administrator)         │  (ระบบยืนยันตัวตนและการเข้าสู่ระบบ)   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • GET  /api/settings/ciam-sso        │ • GET  /api/auth/sso/config          │
│ • PUT  /api/settings/ciam-sso        │ • POST /api/auth/sso/authorize-url   │
│ • POST /api/settings/ciam-sso/test   │ • POST /api/auth/sso/callback        │
│                                      │ • POST /api/auth/sso/break-glass     │
└──────────────────────────────────────┴──────────────────────────────────────┘
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
    "ciam_ad_gateway_url": "http://192.168.12.11:3100",
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
  "ciam_ad_gateway_url": "http://192.168.12.11:3100",
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

## 4. มาตรฐานการบันทึก Audit Logs ในระบบลูก (Log Matrix Specification)

ระบบลูกทุกระบบต้องบันทึกเหตุการณ์ลงในตาราง `transaction_logs` ตามเงื่อนไขดังต่อไปนี้อย่างครบถ้วน:

| Event Code | Category | Action | Status | Message ภาษาไทย | Triggered By | ข้อมูลในฟิลด์ Details (JSON String) |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **SSO-01** | `ciam_sso` | `login_success` | `success` | เข้าสู่ระบบผ่าน Central IAM SSO สำเร็จ: ผู้ใช้ '{username}' | `user:{username}` | `{"username":"...", "ip":"...", "ciam_issuer":"...", "auth_method":"OIDC_PKCE_S256", "roles":{...}}` |
| **SSO-02** | `ciam_sso` | `login_failed` | `failed` | การยืนยันตัวตน SSO ล้มเหลว: {สาเหตุ} | `user:{username}` | `{"error":"SignatureVerificationFailed", "ip":"...", "detail":"Token expired or tampered"}` |
| **SSO-03** | `ciam_sso` | `auto_provision_user` | `info` | สร้างบัญชีผู้ใช้ใหม่อัตโนมัติจาก Central IAM: '{username}' | `system:ciam` | `{"username":"...", "email":"...", "group_assigned":"PU Staff", "claims":{...}}` |
| **SSO-04** | `ciam_sso` | `account_deactivated` | `warning` | ปฏิเสธการเข้าสู่ระบบ: บัญชีพนักงาน '{username}' ถูกระงับสิทธิ์ในระบบนี้ | `user:{username}` | `{"username":"...", "ip":"...", "reason":"is_active is false"}` |
| **BG-01** | `security_break_glass` | `toggle_break_glass` | `warning` / `success` | สลับสถานะระบบ Break-Glass: {ENABLED/DISABLED} | `user:{admin_user}` | `{"break_glass_active":true, "reason":"...", "ip":"...", "prev_state":false}` |
| **BG-02** | `security_break_glass` | `fallback_ad_login` | `success` | เข้าสู่ระบบผ่าน AD Gateway สำรองในช่วง Break-Glass: '{username}' | `user:{username}` | `{"username":"...", "gateway":"http://192.168.12.11:3100", "ip":"..."}` |
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
   * `Active Directory Gateway URL` (Text Input, ค่าเริ่มต้น `http://192.168.12.11:3100`)
   * `กลุ่มสิทธิ์เริ่มต้น (Default Group)` (Dropdown รายชื่อ Group เช่น PU Staff, User)
   * `สวิตช์เปิด/ปิด SSO (Enforce SSO Toggle)`
3. **การ์ดสวิตช์ฉุกเฉิน (Break-Glass Emergency Panel):**
   * กล่องสีเหลือง/แดง พร้อมคำเตือน
   * สวิตช์เปิดโหมด Break-Glass (ต้องพิมพ์ยืนยันเหตุผลก่อนกดยืนยัน)

---

### 5.2 มาตรฐานหน้าจอล็อกอินและพฤติกรรมเมื่อปิด SSO (Zero-Confusion Login Guidelines)

> [!IMPORTANT]
> **กฎความเรียบง่ายและไม่ทำให้ผู้ใช้สับสน (Zero-Confusion Standard):**  
> หน้าจอล็อกอินของระบบลูก (Spoke Login Page) จะต้องปรับเปลี่ยนการแสดงผลตามสถานะของ `ciam_sso_enabled` และ `ciam_break_glass_active` อย่างเคร่งครัดตาม 3 สถานการณ์ดังนี้:

#### สถานการณ์ที่ 1: เปิดใช้งาน SSO ปกติ (`ciam_sso_enabled = true` และ `ciam_break_glass_active = false`)
* **ปุ่มหลัก (Primary CTA):** แสดงปุ่มเด่นชัดสีน้ำเงิน/ฟ้า `[ 🛡️ เข้าสู่ระบบด้วย Central IAM (SSO) ⚡ ]` อยู่ด้านบนสุด
* **เส้นคั่น (Divider):** แสดงเส้นคั่นบางๆ พร้อมข้อความ: `หรือเข้าสู่ระบบด้วยรหัสผ่าน`
* **ฟอร์มรอง (Secondary):** แสดงช่อง Username / Password และปุ่มกด `เข้าสู่ระบบ (Sign In)`

#### สถานการณ์ที่ 2: ปิดใช้งาน SSO ในระบบลูก (`ciam_sso_enabled = false`)
* ❌ **ห้ามแสดงปุ่ม SSO โดยเด็ดขาด:** ไม่ต้องเรนเดอร์ปุ่ม SSO สีฟ้า
* ❌ **ห้ามแสดงแบนเนอร์แจ้งเตือน SSO:** ห้ามมีกล่องข้อความเตือนใดๆ เช่น *"Central IAM SSO ปิดใช้งานชั่วคราว"* หรือ *"SSO Disabled"*
* ❌ **ห้ามแสดงเส้นคั่น Break-Glass:** ห้ามแสดงข้อความ *"หรือเข้าสู่ระบบสำรอง (Break-Glass Login)"*
* ❌ **ห้ามมีคำว่า "สำรอง" บนปุ่มกดยืนยัน:** ปุ่ม Submit ด้านล่างต้องแสดงข้อความมาตรฐานคือ **`เข้าสู่ระบบ (Sign In)`** เท่านั้น (ไม่ใช่ "เข้าสู่ระบบสำรอง")
* ❌ **ห้ามแสดง Footer เกี่ยวกับ Break-Glass:** ซ่อนข้อความ *"Break-Glass Ready"* ท้ายหน้าจอ
* **ผลลัพธ์ที่ต้องการ:** หน้าจอจะกลายเป็นฟอร์ม Login แบบมาตรฐานดั้งเดิม 100% (ช่อง Username, Password และปุ่มเข้าสู่ระบบ) ผู้ใช้ทั่วไปจะไม่เห็นคำว่า SSO หรือคำว่า "สำรอง" ใดๆ ทั้งสิ้น

#### สถานการณ์ที่ 3: โหมดฉุกเฉิน Break-Glass (`ciam_break_glass_active = true`)
* แสดงกล่องแจ้งเตือนสีเหลือง/ส้มด้านบน: `⚠️ ระบบอยู่ในโหมดฉุกเฉิน (Break-Glass Active) - เข้าใช้งานด้วยรหัสผ่านตรง`
* ปุ่มกดยืนยันแสดงข้อความ: `เข้าสู่ระบบฉุกเฉิน (Break-Glass Sign In)`

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

