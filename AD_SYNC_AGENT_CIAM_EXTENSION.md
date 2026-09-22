# คู่มือการพัฒนา Endpoint เพิ่มเติมสำหรับ AD Sync Agent
## เพื่อเชื่อมต่อกับระบบ Window Asia Central IAM (CIAM) & SSO

**สำหรับ:** ทีมพัฒนา AD Sync Agent (Windows Service / API Gateway Port 3100)  
**องค์กร:** บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (Window Asia Public Company Limited)  
**สถานะ:** เอกสารส่งมอบงานพัฒนา (Ready for Implementation)  
**วันที่:** 14 กันยายน 2026  

---

## 1. สรุปความต้องการ (Scope of Work)

เพื่อให้ระบบ **Central IAM (CIAM)** และ **SSO** สามารถสื่อสารกับ Active Directory (AD) ได้อย่างสมบูรณ์แบบทั้งการล็อกอิน การตรวจสอบรายชื่อพนักงาน และการระงับสิทธิ์พนักงานลาออก ทีมพัฒนา AD Sync Agent มีงานที่ต้องดำเนินการ 2 ส่วนหลัก:

1. **การตั้งค่า Configuration (`registry.json`)**: เพิ่มระบบ `CIAM` และเปิดให้ทุกคนใน `Domain Users` ล็อกอินได้
2. **การสร้าง REST API Endpoints เพิ่มเติม 3 จุด**:
   * `GET /health` : เช็กสถานะการเชื่อมต่อ (Ping)
   * `GET /api/v1/ad/users` : ดึงรายชื่อผู้ใช้ทั้งหมดใน AD ไปทำ Reconciliation (ตรวจหาบัญชีผี)
   * `PATCH /api/v1/ad/users/:username/status` : ปิด/เปิดการใช้งานบัญชีใน AD เมื่อพนักงานลาออก

---

## 2. การตั้งค่า `registry.json` ใน AD Sync Agent

ในไฟล์คอนฟิก `registry.json` ของตัว Agent ให้เพิ่มบล็อกการตั้งค่าสำหรับแอปพลิเคชัน **`CIAM`** ดังนี้:

```json
{
  "apps": [
    {
      "app_id": "CIAM",
      "secret_key": "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823",
      "allowed_ips": ["157.173.219.153", "192.168.10.140", "::1"],
      "required_group": "Domain Users"
    }
  ]
}
```

### 📌 คำอธิบายจุดสำคัญ:
1. **`required_group: "Domain Users"`**:
   * **สะดวกที่สุดและเป็น Best Practice:** พนักงานทุกคนในองค์กรที่มี Account ใน Active Directory จะเป็นสมาชิกของกลุ่ม `Domain Users` โดยอัตโนมัติอยู่แล้ว 100%
   * ทำให้พนักงานทุกคนสามารถใช้รหัส AD มาล็อกอิน Central IAM SSO ได้ทันที โดยที่ทีม Admin **ไม่ต้องสร้าง Group ใหม่ หรือไปไล่แอดคนเข้ากลุ่มบน AD เลย**
2. **`allowed_ips`**:
   * กำหนด IP ที่อนุญาตให้ส่ง Request เข้ามา ได้แก่ VPS Hostinger (`157.173.219.153`), เครื่องเครือข่ายภายใน (`192.168.10.140`), และ Localhost (`::1`)

---

## 3. รายละเอียด Endpoints ที่ต้องพัฒนาเพิ่ม

### 3.1 Endpoint ที่ 1: ตรวจสอบสถานะการเชื่อมต่อ (Health Check)
ใช้สำหรับให้ Central IAM ยิง Ping วัดค่า Latency (ms) และเช็กว่า Agent ยังทำงานอยู่

* **Method:** `GET`
* **Path:** `/health`
* **Authentication:** ไม่จำเป็นต้องมี Header (หรืออนุญาตผ่าน IP Whitelist)
* **Response (HTTP 200 OK):**
```json
{
  "status": "healthy",
  "service": "AD Sync Agent",
  "version": "2.1.0",
  "domain_controller": "DC01.windowasia.local",
  "timestamp": "2026-09-14T16:30:00Z"
}
```

---

### 3.2 Endpoint ที่ 2: ดึงรายชื่อผู้ใช้และสถานะทั้งหมด (Inventory & Ghost Detection)
ใช้สำหรับดึงรายชื่อพนักงานทั้งหมดบน AD ส่งกลับมาให้ Central IAM เปรียบเทียบกับระบบลูก (IRM, QMS, SAP B1) เพื่อแสดงผลบนหน้าทะเบียนและตรวจจับบัญชีตกค้าง

* **Method:** `GET`
* **Path:** `/api/v1/ad/users`
* **Request Headers:**
  * `X-Management-API-Key`: `mgmt_ciam_key_9a88b1c0d2e3f4a5` (เทียบกับใน `registry.json`)
* **Query Parameters (Optional):**
  * `search` : ค้นหาจากชื่อ, Username หรือ Email (ถ้ามี)
  * `status` : `all` (ทั้งหมด), `active` (เฉพาะเปิดใช้งาน), `inactive` (เฉพาะปิดใช้งาน)

* **คำสั่ง PowerShell ฝั่ง Agent (Logic):**
```powershell
Get-ADUser -Filter * -Properties Enabled, DisplayName, EmailAddress, Department, EmployeeID, Title | 
  Select-Object sAMAccountName, DisplayName, EmailAddress, Department, EmployeeID, Title, Enabled
```

* **Response (HTTP 200 OK):**
```json
{
  "total_accounts": 3,
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
    },
    {
      "username": "chaiwat.n",
      "full_name": "Chaiwat Nilawan",
      "email": "chaiwat.n@windowasia.com",
      "department": "IT",
      "employee_id": "WA00999",
      "is_active": true
    }
  ]
}
```

---

### 3.3 Endpoint ที่ 3: ปิด / เปิดการใช้งานบัญชีใน AD (Account Status Management)
ใช้สำหรับรับคำสั่งระงับสิทธิ์ (Offboarding) จาก Central IAM เมื่อพนักงานลาออก หรือคืนสิทธิ์

* **Method:** `PATCH`
* **Path:** `/api/v1/ad/users/:username/status` (เช่น `/api/v1/ad/users/somchai.p/status`)
* **Request Headers:**
  * `Content-Type`: `application/json`
  * `X-Management-API-Key`: `mgmt_ciam_key_9a88b1c0d2e3f4a5`
* **Request Body:**
```json
{
  "is_active": false,
  "reason": "พนักงานลาออก - อนุมัติผ่านระบบ Central IAM",
  "updated_by": "Central-IAM-Service"
}
```

* **มาตรการป้องกันความปลอดภัย (Guardrail - สำคัญมาก):**
  * **ห้ามแตะต้องบัญชีระบบเด็ดขาด:** หาก `:username` คือ `Administrator`, `krbtgt`, `Guest`, หรือบัญชีที่ขึ้นต้นด้วย `svc_`, `app_`, `sa_` ให้ปฏิเสธและตอบกลับเป็น **HTTP 403 Forbidden** ทันทีโดยไม่ต้องรันคำสั่ง PowerShell

* **คำสั่ง PowerShell ฝั่ง Agent (Logic):**
  * ถ้า `is_active == false`:
    ```powershell
    Disable-ADAccount -Identity $username
    ```
  * ถ้า `is_active == true`:
    ```powershell
    Enable-ADAccount -Identity $username
    ```

* **Response (HTTP 200 OK):**
```json
{
  "success": true,
  "sAMAccountName": "somchai.p",
  "is_active": false,
  "message": "AD Account 'somchai.p' disabled successfully",
  "updated_at": "2026-09-14T16:30:00Z"
}
```

* **Response กรณีไม่พบบัญชี (HTTP 404 Not Found):**
```json
{
  "success": false,
  "error_code": "USER_NOT_FOUND",
  "message": "Account 'somchai.p' was not found in Active Directory"
}
```

---

## 4. Endpoint เดิมสำหรับการล็อกอิน (`POST /api/v2/login`)

สำหรับ Endpoint การตรวจสอบรหัสผ่านเพื่อเข้าสู่ระบบ SSO **ให้ใช้ Endpoint เดิมที่ระบบอื่นๆ (เช่น ProRegis) ใช้งานอยู่แล้วได้เลย โดยไม่ต้องแก้โค้ดใหม่**:

* **Method:** `POST`
* **Path:** `/api/v2/login`
* **Request Body ที่ Central IAM จะส่งไป:**
```json
{
  "app_id": "CIAM",
  "secret_key": "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823",
  "username": "somchai.p",
  "password": "UserPassword123",
  "timestamp": "2026-09-14T16:30:00Z"
}
```
*(ระบบ Central IAM จะคำนวณเวลาไทย +07:00 ปิดท้ายด้วย Z และไม่เกิน 5 นาที ตามข้อกำหนดใน `ADAuthen.md` อย่างเคร่งครัด)*

---

## 5. ตัวอย่าง Code Implementation ฝั่ง AD Agent (Node.js Express)

```javascript
const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const app = express();

app.use(express.json());

// รายชื่อบัญชีที่ห้ามแตะต้องเด็ดขาด
const PROTECTED_ACCOUNTS = ['administrator', 'krbtgt', 'guest', 'svc_backup', 'svc_sql'];

// Middleware ตรวจสอบ Management API Key
function verifyManagementKey(req, res, next) {
  const apiKey = req.headers['x-management-api-key'];
  if (apiKey !== 'mgmt_ciam_key_9a88b1c0d2e3f4a5') {
    return res.status(401).json({ error: 'Unauthorized: Invalid Management API Key' });
  }
  next();
}

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AD Sync Agent',
    timestamp: new Date().toISOString()
  });
});

// 2. ดึงรายชื่อ User ทั้งหมดบน AD
app.get('/api/v1/ad/users', verifyManagementKey, async (req, res) => {
  try {
    const psScript = `
      Get-ADUser -Filter * -Properties Enabled, DisplayName, EmailAddress, Department, EmployeeID |
      Select-Object @{N='username';E={$_.sAMAccountName}},
                    @{N='full_name';E={$_.DisplayName}},
                    @{N='email';E={$_.EmailAddress}},
                    @{N='department';E={$_.Department}},
                    @{N='employee_id';E={$_.EmployeeID}},
                    @{N='is_active';E={$_.Enabled}} |
      ConvertTo-Json -Depth 2
    `;
    const { stdout } = await execPromise(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
    const accounts = stdout ? JSON.parse(stdout) : [];
    const accountsArray = Array.isArray(accounts) ? accounts : [accounts];
    res.json({
      total_accounts: accountsArray.length,
      accounts: accountsArray
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to query Active Directory: ' + error.message });
  }
});

// 3. ปิด / เปิด บัญชีผู้ใช้ใน AD
app.patch('/api/v1/ad/users/:username/status', verifyManagementKey, async (req, res) => {
  const username = req.params.username.toLowerCase();
  const { is_active } = req.body;

  // ตรวจสอบ Guardrail บัญชีคุ้มครอง
  if (PROTECTED_ACCOUNTS.includes(username)) {
    return res.status(403).json({
      success: false,
      error_code: 'PROTECTED_ACCOUNT',
      message: `Account '${username}' is protected and cannot be modified via API.`
    });
  }

  try {
    const actionCmd = is_active ? `Enable-ADAccount -Identity "${username}"` : `Disable-ADAccount -Identity "${username}"`;
    await execPromise(`powershell -Command "${actionCmd}"`);

    res.json({
      success: true,
      sAMAccountName: username,
      is_active: !!is_active,
      message: `AD Account '${username}' ${is_active ? 'enabled' : 'disabled'} successfully`,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3100, () => {
  console.log('AD Sync Agent running on port 3100');
});
```

---

## 6. สรุปสิ่งที่ทีม AD Sync Agent ต้องดำเนินการ

| สิ่งที่ต้องทำ | รายละเอียด |
| :--- | :--- |
| 1. อัปเดต `registry.json` | เพิ่ม `app_id: "CIAM"`, กำหนด `allowed_groups: ["Domain Users"]` และใส่ IP VPS CIAM |
| 2. สร้าง Endpoint `GET /health` | ส่งสถานะ `healthy` เพื่อให้ CIAM ยิงเช็ก Ping |
| 3. สร้าง Endpoint `GET /api/v1/ad/users` | รันคำสั่ง `Get-ADUser` ส่งรายชื่อผู้ใช้กลับมาเป็น JSON |
| 4. สร้าง Endpoint `PATCH /api/v1/ad/users/:username/status` | รันคำสั่ง `Disable-ADAccount` / `Enable-ADAccount` พร้อม Guardrail บัญชี Admin |
