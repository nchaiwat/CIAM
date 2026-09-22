# Central IAM - Spoke Application Single Sign-On (SSO) Integration Guide
**Document Version:** 1.0.0  
**Security Standard:** ISO 27001 & OpenID Connect (OIDC) / OAuth 2.0 with PKCE (RFC 7636)  
**Organization:** Window Asia Public Company Limited  
**Target Systems:** IRM, QMS, QOL (QT-Online), SAP B1, and future corporate applications  

---

## 1. ภาพรวมสถาปัตยกรรม (Architecture Overview)

Central IAM ทำหน้าที่เป็น **Centralized Identity Provider (IdP)** ประจำองค์กร บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) เพื่อให้พนักงานสามารถยืนยันตัวตนเพียงครั้งเดียวผ่านหน้า Portal กลาง แล้วเข้าใช้งานระบบลูก (Spoke Applications) ทั้งหมดได้โดยไม่ต้องกรอกรหัสผ่านซ้ำ (Single Sign-On)

### หลักการความมั่นคงปลอดภัยสูงสุด (Zero Credential Sharing):
1. **ระบบลูกไม่ต้องแตะต้องหรือจัดเก็บรหัสผ่านของพนักงานอีกต่อไป:**  
   พนักงานกรอกรหัสผ่านที่หน้าจอ Central IAM เท่านั้น ระบบลูกจะได้รับเฉพาะ **Asymmetric RS256 ID Token** ที่ลงนามด้วย Private Key ของ Central IAM
2. **การป้องกัน Replay Attack ด้วย One-Time Authorization Code:**  
   รหัส Code ที่ส่งผ่าน Browser Redirect มีอายุสั้นมาก (TTL 60 วินาที) และถูกทำลายทิ้งทันทีหลังการแลกเปลี่ยนครั้งแรก (Anti-Replay Code Burn)
3. **PKCE (Proof Key for Code Exchange) S256:**  
   ป้องกันการดักจับ Authorization Code จากเบราว์เซอร์หรือเครือข่ายภายนอก
4. **Asymmetric Cryptography (RS256 & JWKS):**  
   ระบบลูกสามารถ Verify ลายเซ็นดิจิทัลของ Token ได้ด้วย Public Key จาก `/.well-known/jwks.json` โดยไม่ต้องเก็บ Private Key หรือติดต่อเซิร์ฟเวอร์ CIAM ซ้ำในทุก Request

---

## 2. ลำดับขั้นตอนการทำงาน (End-to-End Sequence Diagram)

```
┌──────────────┐           ┌─────────────────────┐           ┌────────────────────────┐
│ User Browser │           │ Spoke App (IRM/QMS) │           │   Central IAM Portal   │
└──────┬───────┘           └──────────┬──────────┘           └───────────┬────────────┘
       │                                  │                                      │
       │ 1. คลิก [⚡ ล็อกอินด้วย CIAM SSO] │                                      │
       ├─────────────────────────────────▶│                                      │
       │                                  │ 2. สร้าง Code Verifier & Challenge   │
       │                                  │    (S256) และขอ Authorize URL        │
       │◀─────────────────────────────────┤                                      │
       │ 3. Redirect ไปยัง Central IAM    │                                      │
       ├──────────────────────────────────┼─────────────────────────────────────▶│
       │                                  │                                      │
       │ 4. พนักงานกรอก AD User / Pass     │                                      │
       ├──────────────────────────────────┼─────────────────────────────────────▶│
       │                                  │                                      │ 5. CIAM ตรวจสอบกับ
       │                                  │                                      │    AD Gateway (:3100)
       │                                  │ 6. Redirect กลับ Callback URL        │
       │◀─────────────────────────────────┴──────────────────────────────────────┤
       │     พร้อม One-Time Code (TTL 60s) & State                               │
       │                                  │                                      │
       │ 7. Browser ส่ง Code กลับระบบลูก   │                                      │
       ├─────────────────────────────────▶│                                      │
       │                                  │ 8. Backend-to-Backend Token Exchange │
       │                                  │    ส่ง Code + Verifier + Secret      │
       │                                  ├─────────────────────────────────────▶│
       │                                  │ 9. มอบ RS256 ID Token & Access Token │
       │                                  │◀─────────────────────────────────────┤
       │                                  │                                      │
       │                                  │ 10. Verify RS256 Signature ด้วย JWKS │
       │                                  │     ออก Session / JWT ของระบบลูก     │
       │ 11. เข้าสู่หน้า Dashboard สำเร็จ  │                                      │
       │◀─────────────────────────────────┤                                      │
```

---

## 3. การลงทะเบียนระบบลูกใน Central IAM Web UI (`/applications`)

ก่อนเริ่มเชื่อมต่อ ผู้ดูแลระบบ IT Security ต้องลงทะเบียนระบบลูกที่หน้า **Applications** ใน Central IAM:

1. เข้าหน้าจอ [http://localhost:3000/applications](http://localhost:3000/applications)
2. กดปุ่ม **"SSO"** หรือ **"ตั้งค่าระบบ"** บนการ์ดของระบบลูกที่ต้องการ
3. เลือกแท็บ **Single Sign-On (OIDC / PKCE)**:
   * **OIDC Client ID:** กำหนดรหัสระบุระบบ (เช่น `irm-spoke-client`)
   * **OIDC Client Secret:** กดปุ่ม *"สุ่มสร้าง Secret ใหม่"* เพื่อสร้างคีย์ความยาว 24 ไบต์ และกดคัดลอก
   * **Whitelisted Redirect URIs:** ระบุ Callback URL ของระบบลูก โดยสามารถใส่ได้หลาย URL คั่นด้วยจุลภาค (`,`) เช่น:  
     `https://irm.windowasia.com/auth/callback, http://localhost:3001/auth/callback`
   * **SSO Enforcement Switch:** สวิตช์เปิด/ปิดการบังคับใช้ SSO สำหรับระบบนี้
4. กดปุ่ม **"บันทึกการตั้งค่า"**

---

## 4. โค้ดตัวอย่างการเชื่อมต่อสำหรับระบบลูก (Implementation Guide)

### 4.1 ฝั่ง Backend (Python FastAPI)

นำไฟล์ [ciam_sso_client.py](file:///d:/Python/Central-IAM/backend/app/sdk/ciam_sso_client.py) ไปวางในโปรเจกต์ระบบลูก (เช่น `app/services/ciam_sso_client.py`) แล้วเรียกใช้งานดังนี้:

```python
from app.services.ciam_sso_client import CiamSsoClient

# 1. กำหนดค่า Client
sso_client = CiamSsoClient(
    ciam_base_url="http://127.0.0.1:8001",           # หรือ https://ciam.windowasia.com
    client_id="irm-spoke-client",
    client_secret="sec_irm_oauth_secret_2026",
    ad_gateway_url="http://192.168.12.11:3100"       # สำหรับ Break-Glass Fallback
)

# 2. เมื่อผู้ใช้กดปุ่ม SSO: สร้าง PKCE และ Authorize URL
code_verifier, code_challenge = sso_client.generate_pkce()
# เก็บ code_verifier ไว้ใน SessionStorage หรือ Secure Cookie
authorize_url = sso_client.get_authorize_url(
    redirect_uri="https://irm.windowasia.com/auth/callback",
    code_challenge=code_challenge,
    code_challenge_method="S256",
    scope="openid profile email"
)

# 3. เมื่อ Central IAM Redirect กลับมาพร้อม One-Time Code:
# ส่ง Code + Verifier แลก Token (Backend-to-Backend)
tokens = sso_client.exchange_code_for_tokens(
    code=code,
    redirect_uri="https://irm.windowasia.com/auth/callback",
    code_verifier=code_verifier
)

# 4. ตรวจสอบความถูกต้องของ RS256 Signature ด้วย JWKS
claims = sso_client.verify_id_token(tokens["id_token"])
username = claims["sub"]
full_name = claims.get("name")
email = claims.get("email")

# 5. ออก Session Token ประจำระบบลูกและอนุญาตให้เข้าทำงาน
```

---

### 4.2 ฝั่ง Frontend (Next.js / React)

#### หน้าล็อกอิน (`login/page.tsx`):
```tsx
const handleCiamSso = async () => {
  const redirectUri = window.location.origin + '/auth/callback';
  const res = await api.post('/api/auth/sso/authorize-url', { redirect_uri: redirectUri });
  
  // จัดเก็บ verifier ชั่วคราว
  sessionStorage.setItem('sso_code_verifier', res.data.code_verifier);
  sessionStorage.setItem('sso_state', res.data.state);
  
  // นำทางไปยัง Central IAM
  window.location.href = res.data.authorize_url;
};
```

#### หน้า Callback (`auth/callback/page.tsx`):
```tsx
useEffect(() => {
  const code = searchParams.get('code');
  const codeVerifier = sessionStorage.getItem('sso_code_verifier') || '';
  
  api.post('/api/auth/sso/callback', {
    code,
    code_verifier: codeVerifier,
    redirect_uri: window.location.origin + '/auth/callback'
  }).then((res) => {
    login(res.data.access_token, res.data.refresh_token);
    router.push('/dashboard');
  });
}, []);
```

---

## 5. กลไกความต่อเนื่องทางธุรกิจ (Business Continuity & Break-Glass Fallback)

เพื่อให้การปฏิบัติงานในโรงงานและคลังสินค้า (IRM, ERP, จัดส่ง) ดำเนินไปได้อย่างต่อเนื่อง 100% แม้ในกรณีที่เครือข่ายขัดข้องหรือเซิร์ฟเวอร์ Central IAM หยุดทำงานชั่วคราว:

### 5.1 Smart Circuit Breaker Health Detection
`CiamSsoClient.is_ciam_healthy()` จะทำการตรวจสอบ Discovery Endpoint `/.well-known/openid-configuration` อัตโนมัติ:
* หากเซิร์ฟเวอร์ CIAM ไม่ตอบสนอง (Timeout > 1.5s หรือ HTTP 5xx)
* ระบบลูกสามารถเรียกใช้ `fallback_ad_authenticate(username, password)` เพื่อส่งตรงไปยัง **Active Directory Gateway (พอร์ต 3100)** ตามมาตรฐาน `ADAuthen.md` ได้ทันที

### 5.2 Emergency Break-Glass Admin Toggle
* ผู้ดูแลระบบลูกสามารถเรียก Endpoint:  
  `POST /api/auth/sso/break-glass-toggle`  
  พร้อม Body: `{"sso_enabled": false, "reason": "CIAM server emergency maintenance"}`
* ระบบลูกจะปลดระบบ SSO และสลับเข้าสู่โหมด **Local Database / Active Directory Login** ทันที พร้อมบันทึก Audit Log และแจ้งเตือนทีม Security

---

## 6. สรุปผลระบบนำร่อง (Pilot Production: IRM)

| คุณสมบัติ | การดำเนินการในระบบ IRM | สถานะ |
| :--- | :--- | :---: |
| **OIDC Client ID** | `irm-spoke-client` | พร้อมใช้งาน |
| **OIDC Client Secret** | `sec_irm_oauth_secret_2026` | บันทึกใน CIAM & IRM Backend |
| **Whitelisted Callbacks** | `https://irm.windowasia.com/auth/callback`, `http://localhost:3001/auth/callback` | บันทึกใน CIAM |
| **Backend Integration** | [sso.py](file:///D:/Python/IRM/backend/app/routers/sso.py) + [ciam_sso_client.py](file:///D:/Python/IRM/backend/app/services/ciam_sso_client.py) | สมบูรณ์ |
| **Frontend UI** | ปุ่ม SSO และหน้า Callback [page.tsx](file:///D:/Python/IRM/frontend/src/app/auth/callback/page.tsx) | สมบูรณ์ (0 TypeScript Errors) |
| **Break-Glass Fallback** | สลับไปล็อกอินตรงด้วยรหัส AD หรือ Local Admin ได้ทันที | ผ่านการทดสอบ |
