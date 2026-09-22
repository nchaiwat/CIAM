# AD Sync Agent - Administration API Specification
# (ข้อกำหนดการพัฒนา API สำหรับ AD Sync Agent เพื่อเชื่อมต่อกับ Central IAM)

**Document Version:** 1.0.0  
**Target Audience:** AD Sync Agent Developer, Windows System Administrator, Network & Security Engineer  
**Organization:** บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (Window Asia Public Company Limited)  
**Related Documents:** [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md), [ADAuthen.md](file:///d:/Python/Central-IAM/ADAuthen.md), [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md), [PRD.md](file:///d:/Python/Central-IAM/PRD.md)

---

## 1. บทนำและสถาปัตยกรรมความปลอดภัย (Overview & Security Architecture)

เอกสารฉบับนี้จัดทำขึ้นสำหรับทีมพัฒนา **AD Sync Agent (พอร์ต 3100)** เพื่อเพิ่ม Endpoint ฝั่งบริหารจัดการ (Administration API) ให้กับระบบ **Central IAM (CIAM)** 

### 1.1 ทำไมต้องผ่าน AD Sync Agent (ทำไม CIAM ไม่ต่อตรงเข้า Domain Controller)
เพื่อความมั่นคงปลอดภัยสูงสุดตามมาตรฐาน ISO 27001 และ PDPA ระบบ Central IAM จะ **ไม่มีการเชื่อมต่อตรง (Direct LDAP) เข้า Domain Controller** โดยเด็ดขาด แต่จะสั่งการผ่าน **AD Sync Agent** ที่ทำหน้าที่เป็น **Security Gateway & Policy Enforcement Point** ประจำเครือข่ายภายใน:

```
┌────────────────────────┐              ┌────────────────────────┐              ┌────────────────────────┐
│   Central IAM Server   │              │     AD Sync Agent      │              │   Domain Controller    │
│ (FastAPI Port 8001 /   │──(HTTP REST)─▶│ (Windows Service /     │──(PowerShell)▶│ (Active Directory      │
│  Next.js Port 3000)    │  Port 3100   │  Proxy Port 3100)      │   / ActiveDir)│  LDAP Port 389/636)    │
└────────────────────────┘              └────────────────────────┘              └────────────────────────┘
  - HRIS / Identity Governance            - IP Whitelisting Validation            - Master User Directory
  - 1-Click Offboarding Hub               - Secret Key & Timestamp Check          - Domain Security Policy
  - Cross-App Matrix                      - Account Protection Guardrails
                                          - Local Audit Event Logging
```

---

## 2. มาตรการความปลอดภัยและเงื่อนไขป้องกันความผิดพลาด (Guardrails & Security Controls)

ทีมพัฒนา AD Sync Agent **ต้องใส่กลไกป้องกัน (Guardrails)** ในตัว Agent ก่อนดำเนินการคำสั่งกับ Active Directory ดังต่อไปนี้:

### 2.1 รายชื่อบัญชีที่ห้ามแตะต้องเด็ดขาด (Protected Accounts Hard-block)
หากคำขอที่ส่งมามีเป้าหมายเป็นบัญชีดังต่อไปนี้ ตัว Agent **ต้องปฏิเสธคำขอทันที (HTTP 403 Forbidden)** โดยไม่ต้องรันคำสั่ง PowerShell:
1. **System & Built-in Accounts:** `Administrator`, `krbtgt`, `Guest`
2. **Administrative Groups:** บัญชีใดๆ ที่เป็นสมาชิกของ `Domain Admins`, `Enterprise Admins`, `Schema Admins`, `Account Operators`, `Backup Operators`
3. **Service Accounts:** บัญชีที่ขึ้นต้นด้วย Prefix: `svc_`, `app_`, `sa_`, `sql_` หรือมี Tag Service Account

### 2.2 การจำกัดขอบเขต OU (Scope of Delegation)
* อนุญาตให้คำสั่ง `Disable-ADAccount`, `Enable-ADAccount`, หรือแก้ไข Attribute มีผลเฉพาะกับผู้ใช้ที่อยู่ภายใต้ OU ที่กำหนด เช่น:
  `OU=Employees,DC=windowasia,DC=local` หรือ `OU=Users,OU=WindowAsia,DC=windowasia,DC=local`
* บัญชีที่อยู่นอก OU ที่ได้รับมอบหมาย จะต้องถูกปฏิเสธ (HTTP 403 Forbidden)

### 2.3 การยืนยันตัวตนและการตรวจสอบสิทธิ์ (M2M Authentication)
ทุก Request ที่มาจาก Central IAM จะต้องแนบ Headers:
* `X-Management-API-Key`: คีย์ลับประจำ Agent (เช่น `sec_ad_agent_mgmt_8f1b4c92...`)
* `X-Request-Timestamp`: เวลา Unix timestamp (หรือตามฟอร์แมต `ADAuthen.md` ที่ใช้เวลาไทยปิดท้ายด้วย `Z` ไม่เกิน 5 นาที)

### 2.4 การจำกัดการเข้าถึงผ่าน IP (IP Whitelisting)
* ตรวจสอบ Client IP ต้นทาง ต้องตรงกับ IP ของ Central IAM Server เท่านั้น (กำหนดใน `registry.json` ของ Agent)

### 2.5 Audit Logging บน Windows Event Log
* ทุกครั้งที่มีการสั่ง Enable/Disable ต้องบันทึก Windows Application Event Log:
  * **Event Source:** `ADSyncAgent`
  * **Event ID:** `1001` (Disable), `1002` (Enable), `1003` (Blocked by Guardrail)
  * **รายละเอียด:** `TargetUser`, `Action`, `UpdatedBy`, `Reason`, `SourceIP`

---

## 3. รายละเอียด API Endpoints ที่ต้องเพิ่มใน AD Sync Agent

**Base URL:** `http://192.168.12.8:3100` หรือ `http://192.168.12.11:3100`

---

### 3.1 Endpoint 1: เปิด / ระงับการใช้งานบัญชีใน AD (Status Management)

ใช้สำหรับรับคำสั่งระงับสิทธิ์ (Offboarding) หรือเปิดใช้งานคืน (Re-activation) จาก Central IAM

* **Method:** `PATCH`
* **Path:** `/api/v1/ad/users/{username}/status`
* **Request Headers:**
  | Header Name | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `Content-Type` | String | **Yes** | `application/json` |
  | `X-Management-API-Key` | String | **Yes** | รหัสความปลอดภัยที่ตกลงไว้ร่วมกัน |
  | `X-Request-Timestamp` | String | Optional | Unix timestamp หรือ ISO timestamp |

* **Request Body:**
  ```json
  {
    "is_active": false,
    "reason": "Resigned - HR Ticket #9901",
    "updated_by": "Central-IAM-Service"
  }
  ```

* **คำสั่ง PowerShell ฝั่ง Agent (Logic):**
  * ถ้า `is_active == false`:
    ```powershell
    Disable-ADAccount -Identity $username
    ```
  * ถ้า `is_active == true`:
    ```powershell
    Enable-ADAccount -Identity $username
    ```

* **Response (เมื่อสำเร็จ - HTTP 200 OK):**
  ```json
  {
    "success": true,
    "sAMAccountName": "somchai.p",
    "is_active": false,
    "message": "AD Account 'somchai.p' disabled successfully",
    "updated_at": "2026-09-09T11:20:00Z"
  }
  ```

* **Response กรณีเกิดข้อผิดพลาด:**
  * **HTTP 404 Not Found (หาบัญชีไม่พบ):**
    ```json
    {
      "success": false,
      "error_code": "USER_NOT_FOUND",
      "message": "Account 'somchai.p' was not found in Active Directory domain."
    }
    ```
  * **HTTP 403 Forbidden (ติด Guardrail บัญชีคุ้มครอง):**
    ```json
    {
      "success": false,
      "error_code": "PROTECTED_ACCOUNT",
      "message": "Account 'admin_domain' is a protected administrator account and cannot be modified via CIAM."
    }
    ```

---

### 3.2 Endpoint 2: ตรวจสอบสถานะการเชื่อมต่อ (Health Check)

ใช้สำหรับให้ Central IAM เช็กสถานะการพร้อมให้บริการและวัด Latency

* **Method:** `GET`
* **Path:** `/health`
* **Response (HTTP 200 OK):**
  ```json
  {
    "status": "healthy",
    "service": "AD Sync Agent",
    "version": "2.1.0",
    "domain_controller": "DC01.windowasia.local",
    "timestamp": "2026-09-09T11:20:00Z"
  }
  ```

---

### 3.3 Endpoint 3: ดึงรายชื่อบัญชีทั้งหมดจาก AD (Reconciliation / Inventory)

ใช้สำหรับนำข้อมูลผู้ใช้และสถานะใน AD ไปเปรียบเทียบกับระบบลูก (IRM, QMS, SAP B1) เพื่อตรวจหา Ghost Accounts

* **Method:** `GET`
* **Path:** `/api/v1/ad/users`
* **Request Headers:**
  | Header Name | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `X-Management-API-Key` | String | **Yes** | Secret Token |

* **Query Parameters (Optional):**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :---: | :--- |
  | `search` | String | - | ค้นหาจาก `sAMAccountName`, `displayName`, `mail` |
  | `status` | String | `all` | `all`, `active`, `inactive` |

* **คำสั่ง PowerShell ฝั่ง Agent (Logic):**
  ```powershell
  Get-ADUser -Filter * -Properties Enabled, DisplayName, EmailAddress, Department, EmployeeID, Title | 
    Select-Object sAMAccountName, DisplayName, EmailAddress, Department, EmployeeID, Title, Enabled
  ```

* **Response (HTTP 200 OK):**
  ```json
  {
    "total_accounts": 2,
    "accounts": [
      {
        "username": "somchai.p",
        "full_name": "Somchai Prasert",
        "email": "somchai.p@windowasia.com",
        "department": "IT",
        "employee_id": "WA00102",
        "is_active": true
      },
      {
        "username": "wichai.k",
        "full_name": "Wichai Kaewmanee",
        "email": "wichai.k@windowasia.com",
        "department": "Purchasing",
        "employee_id": "WA00244",
        "is_active": false
      }
    ]
  }
  ```

---

### 3.4 Endpoint 4: สร้างบัญชีผู้ใช้ใหม่ใน AD (New User Provisioning - รองรับเฟสถัดไป)

* **Method:** `POST`
* **Path:** `/api/v1/ad/users`
* **Request Body:**
  ```json
  {
    "sAMAccountName": "somchai.n",
    "displayName": "Somchai Nilawan",
    "mail": "somchai.n@windowasia.com",
    "department": "IT",
    "employeeID": "WA00921",
    "telephoneNumber": "0812345678",
    "enabled": true,
    "created_by": "Central-IAM-Service"
  }
  ```

* **คำสั่ง PowerShell ฝั่ง Agent (Logic):**
  ```powershell
  New-ADUser -SamAccountName $body.sAMAccountName `
             -Name $body.displayName `
             -DisplayName $body.displayName `
             -EmailAddress $body.mail `
             -Department $body.department `
             -EmployeeID $body.employeeID `
             -Enabled:$body.enabled `
             -Path "OU=Employees,DC=windowasia,DC=local"
  ```

* **Response (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "sAMAccountName": "somchai.n",
    "message": "User 'somchai.n' created successfully in Active Directory",
    "created_at": "2026-09-09T11:20:00Z"
  }
  ```

---

## 4. ตัวอย่าง Code Implementation ฝั่ง AD Sync Agent (Node.js / Express หรือ C# Web API)

ตัวอย่างการตรวจสอบ Guardrail ในโค้ดตัวรับของ AD Agent (Node.js Express):

```javascript
const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

// รายชื่อบัญชีที่คุ้มครอง ห้าม Disable โดยเด็ดขาด
const PROTECTED_ACCOUNTS = [
  'administrator', 'krbtgt', 'guest',
  'svc_backup', 'svc_sql', 'app_portal'
];

app.patch('/api/v1/ad/users/:username/status', (req, res) => {
  const username = req.params.username.toLowerCase();
  const { is_active, reason, updated_by } = req.body;
  const apiKey = req.headers['x-management-api-key'];

  // 1. ตรวจสอบ API Key
  if (apiKey !== process.env.AD_MANAGEMENT_SECRET_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API Key' });
  }

  // 2. Guardrail: ตรวจสอบบัญชีคุ้มครอง
  if (PROTECTED_ACCOUNTS.includes(username)) {
    console.warn(`[BLOCKED] Attempted to modify protected account: ${username} by ${updated_by}`);
    return res.status(403).json({
      success: false,
      error_code: 'PROTECTED_ACCOUNT',
      message: `Account '${username}' is protected and cannot be altered via CIAM.`
    });
  }

  // 3. กำหนดคำสั่ง PowerShell ตามสถานะ
  const psCommand = is_active 
    ? `Enable-ADAccount -Identity "${username}"`
    : `Disable-ADAccount -Identity "${username}"`;

  exec(`powershell.exe -Command "${psCommand}"`, (error, stdout, stderr) => {
    if (error) {
      if (stderr.includes('Cannot find an object with identity')) {
        return res.status(404).json({ success: false, message: `User '${username}' not found in AD.` });
      }
      return res.status(500).json({ success: false, message: stderr || error.message });
    }

    console.log(`[AUDIT] AD Account '${username}' set to is_active=${is_active} by ${updated_by}. Reason: ${reason}`);
    return res.json({
      success: true,
      sAMAccountName: username,
      is_active: is_active,
      message: `AD Account '${username}' status updated to ${is_active ? 'ENABLED' : 'DISABLED'}.`
    });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'AD Sync Agent', port: 3100 });
});

app.listen(3100, () => {
  console.log('AD Sync Agent Administration API running on port 3100');
});
```

---

## 5. สรุป Checklists ในการส่งมอบงานกับทีม AD Sync Agent

1. [ ] **IP Whitelist:** เพิ่ม IP ของ Central IAM เข้าไปในตัวกรอง IP ของ Agent
2. [ ] **Secret Key:** กำหนด `X-Management-API-Key` ประจำตัว Agent และส่งให้ทีม CIAM นำไปบันทึก
3. [ ] **Implement Endpoint:** พัฒนา Endpoint `/api/v1/ad/users/{username}/status` และ `/health`
4. [ ] **Safety Guardrail:** ใส่ Hard-block ห้ามแตะต้องบัญชี `Administrator`, `krbtgt`, และ Service Accounts
5. [ ] **Testing:** ทดสอบยิง `curl` คำสั่ง Disable/Enable บัญชีทดสอบ (Test User) เพื่อยืนยันว่าคำสั่งบน AD ทำงานได้จริง
