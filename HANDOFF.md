# Central-IAM — Project Handoff & Development Context

> **Date Updated:** 17 ตุลาคม 2026 (Local Time: ~19:50 ICT)  
> **Repository (CIAM):** [https://github.com/nchaiwat/CIAM](https://github.com/nchaiwat/CIAM)  
> **Repository (IRM):** [https://github.com/nchaiwat/IRM](https://github.com/nchaiwat/IRM)  
> **Workspace Local:** `D:\Python\Central-IAM` และ `D:\Python\IRM`  
> **Production VPS (CIAM):** `/var/www/Ciam` (Linux Ubuntu, IP: `157.173.219.153`)  
> **Production VPS (IRM):** `/var/www/Irm` (Hostinger VPS)  
> **Test Integrity:** Backend Pytest: 68/68 passed (100%), Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)  
> **Git Status:** Production Ready (Sprint 46 - Proactive Zero-Action Session Auto-Logoff Watchdog & OIDC Single Logout Return Flow)

---

## 0. ภาพรวมสรุปสำหรับทีมงานและ AI Agent ในการกลับมาพัฒนาต่อ (Executive Resume & Handover Protocol)

### 0.1 สถานะโครงการและความคืบหน้าล่าสุด (Current State & Recent Sprints)
ระบบ **Central IAM** ได้รับการพัฒนา ตรวจสอบ และทดสอบคุณภาพอย่างเข้มข้นจนอยู่ในสถานะ **Production-Ready 100%**:
1. **Proactive Zero-Action Session Auto-Logoff Watchdog & App Client Logout Return to SSO Portal (Sprint 46):**
   - **สาเหตุปัญหาเดิม:** หน้า SSO Portal (`/portal`) และ Admin Console เดิมตรวจสอบเซสชันหมดอายุเฉพาะเมื่อผู้ใช้คลิกปุ่มที่ยิง API แล้วได้ HTTP 401 เท่านั้น (อายุ Token `ACCESS_TOKEN_EXPIRE_MINUTES = 480` นาที / 8 ชม.) หากเปิดหน้าจอทิ้งไว้เฉยๆ จะไม่ตัดออกจากระบบเอง
   - **สร้าง Proactive Session Watchdog (`frontend/src/lib/session.ts`):** ติดตั้งระบบจับเวลาถอยหลังแบบ Real-Time (`useSessionWatchdog`) ตรวจสอบ **Portal Idle Timeout (30 นาที)** และ **JWT Absolute Expiration (8 ชั่วโมง)** พร้อม Server Heartbeat (`/api/v1/auth/me` ทุก 60 วินาที) และ Cross-Tab Sync เมื่อเปิดหน้า SSO Portal ทิ้งไว้ครบ 30 นาทีโดยไม่ไปที่ระบบลูก ระบบจะสั่ง **Logoff ทันทีโดยไม่ต้องรอให้ User คลิกหรือกระทำการใดๆ** พร้อมแสดงป้ายนับเวลา `เซสชัน MM:SS` บนหัวเว็บ `/portal`
   - **ไม่คิด Idle Time ของ SSO Portal ขณะผู้ใช้อยู่ใน App Client (Spoke App) & กด Logout จาก App Client แล้วกลับมาหน้า `/portal` ทันที:**
     1. **เมื่อกดเปิด App Client จาก `/portal` หรือผ่าน `/oauth/authorize`:** ระบบเรียก `markNavigatingToSpokeApp()` (`ciam_in_spoke_app = "1"`) เพื่อ **หยุดนับ Idle Time 30 นาทีของ SSO Portal** ตลอดเวลาที่ผู้ใช้กำลังทำงานอยู่ในระบบลูก (เช่น IRM, MTPulse, QMS)
     2. **เมื่อผู้ใช้กด Logout จากหน้า App Client (เช่น กดออกจากระบบใน IRM หรือวิ่งมาที่ `/oauth/logout` / `/portal`):** ระบบตรวจสอบเฉพาะอายุ JWT Token หลัก (`checkTokenValidOnReturn()`) โดยไม่นำเวลาที่อยู่ใน App Client มาคิดเป็น Idle Time แล้วพาผู้ใช้ **กลับมาที่หน้า SSO Portal (`https://ciam.windowasia.com/portal`) ของ CIAM ทันที** พร้อมรีเซ็ตตัวนับ Idle Time ของหน้า SSO Portal เริ่มต้นใหม่ที่ `30:00` นาที!
     3. **กรณีผู้ใช้กด Logout เอง (`performManualLogout`):** เมื่อกดปุ่ม `ออกจากระบบ` บนหน้า SSO Portal หรือ Admin Console ระบบจะตั้งแฟล็ก `ciam_manual_logout` เพื่อไม่ให้ Watchdog แทรกแซง และพาไปหน้า `/login` ที่สะอาด **โดยไม่แสดงกล่องข้อความเตือนเรื่องเซสชันหมดอายุ (แสดงเฉพาะกรณีเซสชันหมดเวลา Idle 30 นาที หรือ JWT 8 ชม. หมดอายุจริงเท่านั้น)**
2. **AI Copilot Specific Username Search Extraction & Active AD Priority Ranking (Sprint 45):**
   - **สาเหตุปัญหาที่พบ:** เมื่อผู้ใช้ถาม AI Copilot ถึงบัญชีเฉพาะเจาะจง เช่น `"Chaiwat.N ตรวจดูดีๆ"` ระบบ `detect_tool_intent` เดิมไม่ได้สกัดชื่อบัญชีไปใส่ในพารามิเตอร์ `search` ของ `ciam_list_users` (หรือกรณีไม่มีคีย์เวิร์ดคำว่า `"ผู้ใช้"` ก็จะไม่เรียก Tool เลย) และเมื่อเรียก `ciam_list_users(limit=30)` โดยไม่มี `search` ระบบเรียงลำดับตาม ASCII (`username.asc()`) ทำให้ 30 รายการแรกเป็นบัญชีสาขาที่ขึ้นต้นด้วยตัวเลข (`01-WS_...`, `03-WS_...`) ส่งผลให้ AI มองไม่เห็น `Chaiwat.N` และเข้าใจผิดว่าไม่มีในระบบ
   - **เพิ่มฟังก์ชัน `extract_user_search_term` ใน `ai_service.py`:** สกัดชื่อบัญชีรูปแบบ `Firstname.L` (เช่น `Chaiwat.N`), อีเมล, หรือคำค้นชื่อคนจากข้อความปัจจุบันและประวัติการสนทนา แล้วส่งเข้า `ciam_list_users(search=..., limit=50)` โดยตรง แม้ผู้ใช้พิมพ์แค่ `"Chaiwat.N ตรวจดูดีๆ"` ก็จะเรียกค้นหาทันที
   - **จัดเรียง Active AD Users ขึ้นก่อนใน `ciam_list_users` (`mcp/server.py`):** เปลี่ยนการเรียงลำดับเป็น `MasterIdentity.is_active_in_ad.desc(), MasterIdentity.username.asc()` เพื่อให้พนักงานจริงใน AD แสดงก่อนรหัสสาขา `01-WS_...` เสมอ พร้อมรองรับ Fallback ค้นหาด้วยชื่อต้น (Prefix) และแก้ไขการคำนวณ `is_ad_account` ให้ตรวจเช็คจาก `is_active_in_ad` และ `has_ad_spoke` อย่างถูกต้อง
2. **Identity Unification (`Duanghathai.P` <-> `Duanghatai.P`) & Phonetic Directory Search + Facebook Technical Article (Sprint 44):**
   - **รวมตัวตนบน Production สำเร็จทันที:** ผสานบัญชี `Duanghatai.P` (ID 427 จาก SAP B1) เข้ากับตัวตนหลักใน Active Directory `Duanghathai.P` (`Duanghathai Phasuk` แผนก `AC`, ID 164) ทำให้แสดงสถานะ 🟢 Active ใน AD พร้อมผูกสิทธิ์ `AD` และ `SAP_B1` ครบในแถวเดียว
   - **เพิ่ม Phonetic Transliteration Matching (`thai` <-> `tai`):** อัปเดต `scheduler.py` (`persist_spoke_inventory`), `initial_data.py`, และ `directory.py` (`sync_active_directory_users`) ให้จับคู่ตัวสะกด `thai` <-> `tai` อัตโนมัติ ป้องกันไม่ให้การซิงก์ SAP B1 รอบถัดไปสร้างแถวซ้ำขึ้นมาอีก
   - **ขยายระบบค้นหาใน User Directory & MCP Tool (`list_users` & `ciam_list_users`):** รองรับการค้นหาด้วย `app_username` ของระบบลูก และคำค้นหาแบบเทียบเสียง (`Duanghatai.P` หรือ `Duanghathai.P`) ให้แสดงผลตัวตนหลักได้ตรงกัน 100%
   - **จัดทำบทความเชิงวิชาการและภาพประกอบสถาปัตยกรรมสำหรับโพสต์ Facebook (`docs/facebook_article/`):** สร้างบทความฉบับเต็มพร้อมภาพ Infographic 3 ภาพ (`01_ciam_cover_architecture.jpg`, `02_ciam_pain_vs_solution.jpg`, `03_ciam_hybrid_3_modes.jpg`) ใน `docs/facebook_article/FACEBOOK_POST_CIAM.md`
3. **Spoke Spec v2.8.0 Synchronized across Backend & Frontend (Sprint 43):**
   - **ซิงก์ไฟล์สเปกสู่โฟลเดอร์ Backend:** ทำการคัดลอก `SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md` v2.8.0 (ที่มีหมวด E: In-App AI Copilot & MCP Tools) เข้าสู่โฟลเดอร์ `backend/` ซึ่งเป็น Build Context ของ Docker Container `/app` ทำให้ Backend ให้บริการไฟล์ v2.8.0 จริง
   - **ปรับปรุง API Endpoint `/applications/spec/download`:** อัปเดตการดึงเวอร์ชันไดนามิกและ fallback เป็น `v2.8.0` ใน `backend/app/api/v1/applications.py` และอัปเดต `tests/test_api_flow.py` ให้ตรวจเช็ค `v2.8.0` (ผ่าน 100%)
   - **ปรับปรุงปุ่มดาวน์โหลดและ Modal บน Frontend:** ปรับปุ่มดาวน์โหลด `📥 สเปกเชื่อมต่อ (.md v2.8.0)` ใน `frontend/src/app/applications/page.tsx` และเปลี่ยนการตั้งชื่อไฟล์ดาวน์โหลดให้อ่านจาก `Content-Disposition` แบบไดนามิก พร้อมเพิ่มรายละเอียดสเปก v2.8.0 ลงในแท็บประวัติการปรับปรุง (Revision Changelog) ในป๊อปอัปคู่มือ Dev
4. **SSO Portal Muted Gray UI for Unavailable & VPN-Locked Apps (Sprint 42):**
   - **ปรับโทนสีการ์ดระบบที่ยังไม่พร้อมใช้งาน (MTPulse VPN Locked / Offline / Disabled):** เปลี่ยนจากการ์ดสีขาวขอบส้มสดใส เป็นโทนสีเทาหม่น (`bg-slate-100/70`, `border-slate-300`, `opacity-80`)
   - **ไอคอน 3D Grayscale:** แปลงสีไอคอนระบบลูกที่ล็อกหรือไม่พร้อมใช้งาน (เช่น ไอคอนชีพจรสีส้มของ MTPulse) ให้เป็นสีเทา Muted Grayscale (`bg-slate-200 text-slate-400 grayscale`) ตัดความสดใสออกทั้งหมด
   - **ป้ายสถานะและปุ่มกดสีเทาชัดเจน:** เปลี่ยนป้าย `ต้องต่อ VPN` และปุ่ม `ต่อ VPN แล้วตรวจใหม่` ให้เป็นโทนสีเทา Slate เพื่อให้ผู้ใช้งานมองเห็นความแตกต่างได้ทันทีว่าระบบยังไม่พร้อมใช้งาน ต้องต่อ VPN เสียก่อน จึงจะไม่สับสนกับการ์ดระบบงานที่พร้อมใช้งาน (สีขาว ขอบสดใส ปุ่มไล่เฉดสีฟ้า-ส้ม-ม่วง)
   - **ปรับข้อความส่วนหัว Greeting Bar:** ปรับข้อความ `{apps.length} ระบบพร้อมใช้งาน` เป็น `{apps.length} ระบบงานที่ได้รับสิทธิ์` เพื่อความถูกต้องชัดเจนตามสถานะสิทธิ์ของผู้ใช้
5. **AI Factual Grounding, Zero-Hallucination Policy & MCP Parameter Alignment (Sprint 41):**
   - **แก้ไข Tool Signature Mismatch 100%:** แก้ไข `execute_internal_mcp_tool` ใน `backend/app/services/ai_service.py` ให้ส่งอาร์กิวเมนต์ตรงกับฟังก์ชันจริงใน `server.py` (`ciam_list_users`, `ciam_get_spoke_data`, `ciam_get_audit_logs`) ไม่เกิด Exception จากพารามิเตอร์ผิดพลาดอีกต่อไป
   - **เพิ่มตัวกรองระบบลูกใน `ciam_list_users`:** เพิ่มพารามิเตอร์ `app_code` ใน `ciam_list_users` เพื่อให้สามารถค้นหาและนับจำนวนบัญชีที่ผูกกับระบบลูกแต่ละระบบ (MTPulse, IRM, SAP, pfSense) ได้ตรงเป๊ะกับหน้าทะเบียนผู้ใช้ (`/directory`)
   - **สร้าง Context-Aware Intent Detection:** ปรับปรุง `detect_tool_intent` ให้ตรวจจับบริบทจากประวัติการสนทนา 4 ข้อความย้อนหลัง ทำให้เมื่อผู้ใช้ถามคำถามต่อเนื่อง (เช่น "แล้วแสดงในหน้าทะเบียนกี่บัญชี", "ยืนยันใช่ไหม") ระบบยังคงระบุระบบลูก (เช่น MTPulse) ได้อย่างแม่นยำ
   - **บรรจุ Zero-Hallucination & Anti-Sycophancy Policy:** เพิ่มกฎเหล็กใน System Prompt และ Context Injection ให้ AI ยึดตัวเลขจริงจาก Tool Context 100% ห้ามเออออหรือตอบรับ "ยืนยันตามนี้ครับ" กับตัวเลขที่ผู้ใช้ถามนำเด็ดขาด หากตัวเลขไม่ตรง (เช่น ผู้ใช้ถาม 120 บัญชี แต่ข้อมูลจริงมี 6 บัญชี) AI จะปฏิเสธและแก้ไขตัวเลขจริงจากฐานข้อมูลทันที
   - **Explicit Factual Summaries ใน MCP Return:** เพิ่มฟิลด์ `summary`, `total_users_in_directory`, `total_accounts_in_directory` ในผลลัพธ์ของ Tool เพื่อให้ LLM อ่านและเข้าใจตัวเลขได้ทันที
6. **Central IAM In-House AI Copilot, Remote MCP Server & Spoke Framework (Sprint 40):**
   - **Phase 1: Central IAM Core MCP Server (Remote Cloud Transport):**
     - พัฒนา MCP Server ด้วย SDK `mcp` (v2.3) ติดตั้ง 8 Enterprise Tools (`ciam_health_check`, `ciam_list_users`, `ciam_get_ghost_accounts`, `ciam_get_spoke_data`, `ciam_deprovision_user`, `ciam_reactivate_user`, `ciam_get_audit_logs`, `ciam_dispatch_spoke_command`)
     - รองรับการเชื่อมต่อข้าม Cloud ผ่าน Remote SSE Transport (`https://ciam.windowasia.com/mcp/sse`) ป้องกันด้วย `RemoteMcpAuthMiddleware` รองรับ Bearer token (Admin JWT, `MCP_API_KEY`)
     - มีไฟล์คอนฟิก `mcp_config.json` สำหรับเชื่อมต่อ Cursor, Antigravity IDE, Claude Desktop
   - **Phase 2: In-House AI Copilot & Settings UI บนหน้าเว็บ Central IAM:**
     - สร้าง Backend AI Engine: `schemas/ai.py`, `services/ai_service.py`, `api/v1/ai.py` รองรับ Provider ยอดนิยม (Google Gemini, OpenAI, Anthropic, Local Ollama, Custom API) พร้อม Zero-Cost Fallback ทำงานร่วมกับ MCP Tools อัตโนมัติแม้ไม่มี External API Key
     - สร้างหน้าจอตั้งค่าใน `settings/page.tsx`: Section **AI Copilot & Intelligence Engine** มีปุ่ม On/Off Toggle, ช่องกรอกและ Masking API Key, และปุ่ม **[ ⚡ ทดสอบเชื่อมต่อ (Test Connection) ]**
     - สร้าง Floating Chat Widget `components/ai/CiamCopilotWidget.tsx` ฝังลงใน `AppShell.tsx` แสดงผลเมื่อเปิดใช้งาน AI Copilot เท่านั้น
   - **Phase 3: Spoke Enterprise Integration Specification (v2.8.0):**
     - อัปเดต [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) เป็นเวอร์ชัน **2.8.0**
     - เพิ่ม **หมวด E: ข้อกำหนดมาตรฐานการพัฒนา In-App AI Copilot & MCP Tools ประจำระบบลูก** ให้คำแนะนำในการสร้างตาราง `system_settings` (`ai_copilot_enabled`, `ai_api_key`), กฎการปิดหน้า Chat เมื่อไม่มี Key, และโค้ดตัวอย่าง Backend/Frontend สำหรับทีมผู้พัฒนาระบบลูก (MTPulse, IRM, QMS, SAP B1 Service)
   - **Test Suite 100%:** Pytest ผ่าน 68/68 tests (100%), Frontend TypeScript `npx tsc --noEmit` 0 errors (100%)
7. **Spoke UI Consolidation & AD Sync 500 Fix (Sprint 39):**
   - **ลบสวิตช์ซ้ำซ้อนใน Modal:** นำสวิตช์เปิด/ปิด Spoke ออกจากป๊อปอัปตั้งค่าระบบ (`applications/page.tsx`) เนื่องจากหน้าการ์ดหลักมีสวิตช์เปิด/ปิดอยู่แล้ว และปรับฟอร์มส่วนหัวเป็น 3 คอลัมน์กว้างสบายตา
   - **รวมปุ่มตั้งค่าระบบลูกเป็นการตั้งค่าเดียว (Unified Settings Modal):** รวมปุ่มแยกตามประเภทระบบ (`SAP B1`, `AD Settings`, `M365`) เข้าเป็นปุ่มเดียว `[ ⚙️ ตั้งค่าเชื่อมต่อ ]` โดยเมื่อกดปุ่ม ระบบจะสลับไปแท็บที่ถูกต้องของระบบนั้นๆ โดยอัตโนมัติ (AD_PROXY, SAP_B1, M365, SSO, M2M)
   - **แสดง Base URL เต็มไม่ถูกตัดทอน:** ปรับการแสดงผล URL ปลายทางบนการ์ดระบบลูกให้แสดง URL เต็ม ไม่ตัดคำด้วย `...` (ใช้ `break-all`)
   - **แก้ไขบั๊ก 500 NameError ในการซิงก์จาก AD:** แก้ไข `backend/app/api/v1/directory.py` ที่เรียกใช้ `func.lower()` แต่ไม่ได้ import `func` จาก `sqlalchemy` ทำให้เกิด HTTP 500 เมื่อกดปุ่ม "ซิงก์จาก AD" ในหน้าทะเบียนผู้ใช้
8. **Shop Accounts Sanitization from AD Filter & Spokes Matrix (Sprint 38 - บัญชี WA-Shop_*):**
   - แก้ไขปัญหาบัญชีสาขาร้านค้า (เช่น `25 WA Shop - น่าน`, `46 WA Shop - โคราช`) หลุดไปแสดงในตัวกรอง `Active Directory (DC Gateway)` และตัวกรอง `เฉพาะที่ยังใช้งานอยู่ (Active)` ทั้งที่คอลัมน์สถานะ AD เป็นขีด `-` (Local Acc)
   - ปรับปรุง `directory.py`: เมื่อกรอง `app_code == 'ad'` บัญชีจะต้องเป็นตัวตน AD จริง (`is_ad == True`) เท่านั้น บัญชีประเภท Shop (`is_shop_acc`) ถูกตัดสิทธิ์จากการแสดงในตัวกรอง AD อย่างเด็ดขาด และตัดป้าย `🔴 AD` ออกจากคอลัมน์ Spokes ของร้านค้า (แสดงเฉพาะ Spoke ที่ใช้งานจริง เช่น `PFSENSE_FAC`)
   - ปรับปรุง `scheduler.py`: ข้ามการ sync บัญชีร้านค้าจาก AD และลบการแมป AD ตกค้างของร้านค้าทิ้ง
   - ปรับปรุง `initial_data.py`: กวาดล้างและตัด AD mapping ของบัญชีร้านค้าทั้งหมดในฐานข้อมูล
9. **AD Inactive Status Reconciliation & Auto-heal (Sprint 37 - กรณี Worawut.S):**
   - แก้ไขปัญหาผู้ใช้ที่ถูกลบหรือไม่มีตัวตนใน Active Directory แล้ว (เช่น `worawut.s`) แต่ยังคงแสดงสถานะเป็น On (จุดเขียวกระพริบ 🟢) ในหน้า User Directory
   - ปรับปรุง `persist_spoke_inventory` ใน `scheduler.py`: เมื่อเชื่อมต่อ AD Sync Agent และดึงรายชื่อผู้ใช้ล่าสุด บัญชีใดที่ไม่อยู่ใน AD แล้วจะถูกปรับ `is_active_in_ad = False` ทันที และลบการแมปกับ AD ออก
   - ปรับปรุง `directory.py`: คำนวณ `effective_ad_active = bool(identity.is_active_in_ad and (has_ad_mapping or identity.ad_guid or identity.last_login_ad_at))` และมีกลไก Auto-heal ปรับตัวตนที่ไม่มี AD Footprint ให้เป็น `is_active_in_ad = False`
   - ปรับปรุง Tooltip ใน `frontend/src/app/directory/page.tsx` แสดงคำอธิบายสถานะให้ชัดเจนว่าบัญชีถูกปิดหรือไม่มีใน AD
10. **Single Unified Front Door (Sprint 36):** ปรับปรุงโครงสร้าง Routing และ Authentication Guard ใน `AppShell.tsx` ให้ทุกคำขอที่ยังไม่ได้ล็อกอิน ไม่ว่าจะเป็นการพิมพ์ `ciam.windowasia.com` (Root Path `/`) หรือเปิดลิงก์ที่เซสชันหลุด จะวิ่งเข้าสู่หน้า `/login` (Window Asia App Portal สีขาว-น้ำเงิน) เสมอ 100% ป้องกันไม่ให้ผู้ใช้ทั่วไปหลุดเข้าไปเห็นหน้า `/admin/login` (Admin Console จอดำทะมึน พ.ร.บ.คอมฯ) ซึ่งสร้างความสับสนและตื่นตระหนกให้ผู้ใช้งาน

---

## Sprint 44 & 45: Phonetic Identity Unification (`Duanghathai.P` <-> `Duanghatai.P`), AI Copilot Specific Username Search (`Chaiwat.N`) & Active AD Priority Ranking (17 ต.ค. 2026)

### 1. การรวมตัวตน `Duanghathai.P` และ `Duanghatai.P` & ระบบค้นหาเทียบเสียง (Sprint 44):
- **ปัญหาที่พบ:** ใน Active Directory ชื่อแสดงผล (`Name` / `DisplayName`) สะกดว่า `Duanghatai.P` (ไม่มี `h`) แต่ `sAMAccountName` (User logon name) สะกดว่า `Duanghathai.P` (มี `h`) ในขณะที่ระบบ SAP B1 ใช้ `Duanghatai.P` ส่งผลให้เมื่อค้นหาคำว่า `Duanghatai` บนหน้าทะเบียนผู้ใช้ของ CIAM จึงพบเฉพาะแถวของ SAP B1 ที่ขึ้นสถานะ AD เป็น `-` (Local Acc)
- **การแก้ไข:**
  1. ผสานบัญชี `Duanghatai.P` (ID 427) เข้ากับ `Duanghathai.P` (ID 164, แผนก AC) บน Production ทันที และเพิ่มคู่ `("duanghathai.p", "duanghatai.p")` ใน Auto-heal routine (`backend/app/db/initial_data.py` และ `backend/app/api/v1/directory.py`)
  2. เพิ่มกฎเทียบเสียง `thai` $\leftrightarrow$ `tai` ใน `persist_spoke_inventory` (`backend/app/services/scheduler.py`) พร้อมตรวจเช็ค `identity_id` ใน `AppAccountMapping` เพื่อป้องกันไม่ให้เกิดแถวซ้ำเมื่อซิงก์ SAP B1 รอบถัดไป
  3. ขยายระบบค้นหาใน `list_users` (`directory.py`) และ `ciam_list_users` (`mcp/server.py`) ให้ค้นหาครอบคลุมทั้ง `AppAccountMapping.app_username` และคำค้นหาเทียบเสียง (`thai` $\leftrightarrow$ `tai`, `wut` $\leftrightarrow$ `woot`)

### 2. การสกัดชื่อบัญชีเฉพาะเจาะจงใน AI Copilot (`Chaiwat.N`) & การจัดเรียง Active AD Users ขึ้นก่อน (Sprint 45):
- **ปัญหาที่พบ:** เมื่อถาม AI Copilot ถึงบัญชี `Chaiwat.N` (เช่น พิมพ์ `"Chaiwat.N ตรวจดูดีๆ"`) AI ตอบว่าไม่พบบัญชีนี้ในระบบและเข้าใจผิดว่าบัญชีในระบบมีแต่รหัสสาขา `03-WS_...` เนื่องจาก:
  1. `detect_tool_intent` ใน `backend/app/services/ai_service.py` เดิมไม่ได้สกัดชื่อบัญชี (`Chaiwat.N`) ส่งเข้าพารามิเตอร์ `search` ของ `ciam_list_users` และเมื่อข้อความไม่มีคำว่า `"ผู้ใช้"` หรือ `"พนักงาน"` ระบบจึงไม่เรียก Tool เลย
  2. เมื่อเรียก `ciam_list_users(limit=30)` โดยไม่มี `search` คิวรีเรียงตาม `MasterIdentity.username.asc()` (ASCII) ทำให้ 30 แถวแรกเป็นรหัสสาขาที่ขึ้นต้นด้วยตัวเลข (`01-WS_...`, `03-WS_...`) ทั้งหมด
  3. ฟิลด์ `is_ad_account` ใน `ciam_list_users` เดิมเช็คแค่ `bool(ident.ad_guid or ident.employee_id)` ไม่ได้เช็ค `ident.is_active_in_ad` หรือ `has_ad_spoke`
- **การแก้ไข:**
  1. เพิ่มฟังก์ชัน `extract_user_search_term()` ใน [`backend/app/services/ai_service.py`](file:///d:/Python/Central-IAM/backend/app/services/ai_service.py) สกัดชื่อบัญชีรูปแบบ `Firstname.L` (เช่น `Chaiwat.N`), อีเมล หรือชื่อผู้ใช้จากทั้งข้อความปัจจุบันและประวัติการสนทนา แล้วส่ง `search=user_search` เข้า `ciam_list_users` ทันที
  2. ปรับการเรียงลำดับใน `ciam_list_users()` ([`backend/app/mcp/server.py`](file:///d:/Python/Central-IAM/backend/app/mcp/server.py)) เป็น `MasterIdentity.is_active_in_ad.desc(), MasterIdentity.username.asc()` เพื่อให้พนักงาน Active ใน AD แสดงขึ้นมาก่อนรหัสสาขา `01-WS_...` เสมอ พร้อมเพิ่ม Prefix Fallback (`Firstname`) และปรับ `is_ad_account` ให้เช็ค `bool(ident.is_active_in_ad or has_ad_spoke or ident.ad_guid or ident.employee_id)`
  3. เพิ่มชุดทดสอบ `test_ai_chat_specific_username_lookup` ใน [`backend/tests/test_ai_service.py`](file:///d:/Python/Central-IAM/backend/tests/test_ai_service.py) (ผ่าน 68/68 tests 100%)

---

## Sprint 40: Central IAM AI Ecosystem — Core MCP Server, In-House AI Copilot & Spoke Spec v2.8.0 (17 ต.ค. 2026)

### 1. ความต้องการและเป้าหมาย (Requirements & Objectives):
1. **Phase 1: Central IAM Core Model Context Protocol (MCP) Server:**
   - ต้องการให้ AI Agents (Antigravity IDE, Cursor, Claude Desktop) สามารถเชื่อมต่อระบบ Central IAM เพื่อตรวจสอบสถานะระบบ ค้นหาบัญชีผู้ใช้ บัญชีผี (Ghost Accounts) และออกคำสั่งบริหารจัดการได้โดยตรง
   - เนื่องจาก Central IAM Production อยู่บน Cloud VPS (`157.173.219.153`) ไม่สามารถใช้ Local Stdio เพียงอย่างเดียวได้ จึงต้องรองรับ **Remote SSE Transport (over HTTPS)** พร้อมระบบความปลอดภัย Bearer Authentication
2. **Phase 2: In-House AI Copilot บนหน้าเว็บ Central IAM:**
   - จัดทำหน้าจอตั้งค่า AI Provider (Google Gemini, OpenAI, Anthropic, Ollama, Custom API) พร้อมฟิลด์ Masking API Key และปุ่มทดสอบเชื่อมต่อ (Test Connection)
   - ผู้ดูแลระบบสามารถเปิด/ปิดการทำงานของ AI ได้ หากปิดจะซ่อนปุ่มและหน้าจอแชททั้งหมด
   - มีระบบความฉลาดภายใน (Zero-External Fallback) ที่วิเคราะห์ Intent ดึงข้อมูลสดผ่าน MCP Tools ภายในระบบโดยอัตโนมัติ แม้ไม่ได้ใส่ External API Key
   - จัดทำ Floating Chat Widget บน Frontend สะดวกในการสอบถามสถานะระบบ
3. **Phase 3: Spoke Enterprise Integration Specification (v2.8.0):**
   - เพิ่ม **หมวด E: ข้อกำหนดมาตรฐานการพัฒนา In-App AI Copilot & MCP Tools ประจำระบบลูก** เพื่อให้ระบบลูก (เช่น MTPulse, IRM) นำมาตรฐานไปพัฒนาต่อยอดได้อย่างสอดคล้องกัน

### 2. รายละเอียดการทำงานและการเปลี่ยนแปลง (Implementation Details):
1. **Core MCP Server & Remote Transport ([backend/app/mcp/](file:///d:/Python/Central-IAM/backend/app/mcp/)):**
   - พัฒนา `server.py` พร้อม 8 Enterprise Tools (`ciam_health_check`, `ciam_list_users`, `ciam_get_ghost_accounts`, `ciam_get_spoke_data`, `ciam_deprovision_user`, `ciam_reactivate_user`, `ciam_get_audit_logs`, `ciam_dispatch_spoke_command`)
   - พัฒนา `remote.py` ให้บริการ `/mcp/sse` และ `/mcp/messages/` ควบคุมการเข้าถึงด้วย `RemoteMcpAuthMiddleware`
   - จัดเตรียมไฟล์คอนฟิก `mcp_config.json` ให้พร้อมนำไปตั้งค่าบน IDE ทันที
2. **In-House AI Engine & Backend APIs ([backend/app/api/v1/ai.py](file:///d:/Python/Central-IAM/backend/app/api/v1/ai.py)):**
   - พัฒนา Schema `AICopilotSettings`, `AIChatRequest`, `AITestRequest` ใน `schemas/ai.py`
   - พัฒนา Service `ai_service.py` จัดเก็บการตั้งค่าลง `system_settings` (คีย์ `ai_copilot_settings`), ฟังก์ชันเชื่อมต่อ Gemini/OpenAI/Ollama, และตัวเชื่อมต่อไปยัง MCP Tools
   - ลงทะเบียน Router `/api/v1/ai` ใน `backend/app/main.py`
3. **Frontend UI Components & Settings Integration:**
   - เพิ่มฟังก์ชัน API ใน `frontend/src/lib/api.ts` (`getAiSettings`, `updateAiSettings`, `testAiConnection`, `chatWithAi`)
   - พัฒนา Floating Widget [CiamCopilotWidget.tsx](file:///d:/Python/Central-IAM/frontend/src/components/ai/CiamCopilotWidget.tsx) และผูกใน [AppShell.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/AppShell.tsx)
   - เพิ่มแท็บการตั้งค่า **AI Copilot & Intelligence Engine** ใน [settings/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/settings/page.tsx)
4. **Spoke Spec v2.8.0 ([SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md)):**
   - บรรจุหมวด E ครบถ้วนตามมาตรฐาน ISO 27001
5. **Quality Assurance:**
   - Backend Pytest: 67/67 passed (100%) รวมถึง `test_ai_service.py` และ `test_mcp_server.py`
   - Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)
6. **Fix Deployment Dependency & Next.js Proxy Rewrites:**
   - เพิ่ม `mcp>=2.3.0` ใน `backend/requirements.txt` ป้องกัน Container `api` เกิด `ModuleNotFoundError: No module named 'mcp'` ตอน build บน VPS
   - เพิ่ม `rewrites()` ใน `frontend/next.config.ts` ให้ proxy ทราฟฟิก `/api/v1` และ `/mcp` ไปยัง Backend Engine อัตโนมัติ (`BACKEND_INTERNAL_URL` หรือ `http://127.0.0.1:8001`) ป้องกัน Error 404 HTML
   - เพิ่ม `BACKEND_INTERNAL_URL=http://api:8001` ใน `docker-compose.yml` service `web`
8. **Dynamic Gemini Model Discovery & Smart Diagnostic Engine:**
   - พัฒนาระบบ Auto-Discovery ผ่าน Google Generative Language API (`GET /v1beta/models?key={api_key}`) ก่อนทดสอบข้อความ
   - ตรวจจับรายการโมเดลจริงที่ได้รับสิทธิ์ในโปรเจกต์ Google Cloud อัตโนมัติ (เช่น `gemini-2.5-flash`, `gemini-flash-latest`, `gemini-flash-lite-latest`)
   - ระบบ auto-select โมเดลที่เหมาะสมให้อัตโนมัติ พร้อมแสดง Clickable Badges บนหน้า Settings ให้อนุญาตสลับโมเดลได้ทันที
   - หากเกิด Error จาก Google (เช่น โปรเจกต์ยังไม่ได้เปิดใช้งาน API หรือคีย์ผิด) ระบบจะดึงข้อความแจ้งเตือนที่แท้จริงจาก Google API Response มาแสดงใน UI อย่างชัดเจน ช่วยชี้เป้าสาเหตุให้ผู้ดูแลระบบแก้ไขได้ตรงจุด 100%
9. **Copilot Thai Language Enforcement, High-Speed Response & Model Sync:**
   - บังคับการตอบกลับเป็น **ภาษาไทย 100%** ผ่าน `DEFAULT_SYSTEM_PROMPT` และ `ensure_thai_directive()` ห้ามแสดง Internal Chain-of-Thought หรือแปลคำถามซ้ำเป็นภาษาอังกฤษ
   - เร่งความเร็วการตอบสนอง (Response Latency) ให้เร็วขึ้นหลายเท่า โดยใช้ `generationConfig` กำหนด `temperature: 0.2` และ `maxOutputTokens: 2048` พร้อมจัดลำดับโมเดลตระกูล Flash (`gemini-2.5-flash`, `gemini-flash-lite-latest`) ขึ้นเป็นอันดับแรก หลีกเลี่ยงโมเดลขนาดใหญ่ที่ช้า
   - ซิงก์ป้ายชื่อโมเดลบน Copilot Widget ให้ตรงกับการตั้งค่าที่บันทึกไว้ในหน้า Settings เสมอผ่าน Custom Event `ciam-ai-settings-updated` และฟิลด์ `model_used` ในคำตอบ

---



## Sprint 39: ปรับแต่ง Spoke Settings UI ให้กระชับ รวม Modal การตั้งค่า และแก้ไข Error 500 ตอนซิงก์จาก AD (15 ต.ค. 2026)
### 1. ความต้องการและปัญหาที่พบ (Requirements & Problem Statement):
1. **สวิตช์เปิด/ปิด Spoke ในป๊อปอัปตั้งค่าซ้ำซ้อน:** ป๊อปอัปการตั้งค่าระบบ (`applications/page.tsx`) มีสวิตช์ ON/OFF อยู่ด้านใน ทั้งที่การ์ดภายนอกมีสวิตช์เปิด/ปิดหลักอยู่แล้ว ทำให้หน้าจอดูรกและซ้ำซ้อน
2. **ปุ่ม Setting กระจัดกระจาย:** การ์ดของแต่ละระบบมีปุ่มตั้งค่าเฉพาะแยกย่อย เช่น `[ SAP B1 ]`, `[ AD Settings ]`, `[ M365 ]` นอกเหนือจากปุ่ม `[ ⚙️ ตั้งค่าเชื่อมต่อ ]` ต้องการรวมให้อยู่ในปุ่มตั้งค่าเดียว
3. **URL Base โดนตัดคำ:** ข้อความ URL ปลายทางของการ์ดแสดงไม่ครบ เช่น `https://sapb1.waapps.n...` เนื่องจากมีคลาส `truncate max-w-[170px]` ต้องการให้แสดง URL เต็ม
4. **ซิงก์จาก AD แล้วขึ้น Error 500:** เมื่อกดปุ่ม "ซิงก์จาก AD" ในหน้าทะเบียนผู้ใช้ (`/directory`) เกิด `HTTP 500: Internal Server Error`

### 2. รายละเอียดการแก้ไข (Implementation Details):
1. **ลบสวิตช์ซ้ำซ้อนใน Modal ([applications/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/applications/page.tsx)):**
   - ตัดคอลัมน์สวิตช์เปิด/ปิดออกจากป๊อปอัปตั้งค่า และปรับกริดฟอร์มจาก `grid-cols-4` เป็น `grid-cols-3` (ชื่อระบบเต็ม, Base URL ของระบบ, ประเภทการเชื่อมต่อ)
   - ปรับ `handleSaveEdit` ให้คงค่า `is_active: editApp.is_active` จากการ์ดหลัก
2. **รวมปุ่มตั้งค่าเป็นการตั้งค่าเดียว (Unified Setting Button):**
   - นำปุ่มแยก `[ SAP B1 ]`, `[ AD Settings ]`, `[ M365 ]` ออกจากการ์ด เหลือเพียงปุ่มหลัก `[ ⚙️ ตั้งค่าเชื่อมต่อ ]`
   - เมื่อกดปุ่ม `handleOpenEdit` ระบบจะเปิดแท็บที่เกี่ยวข้องโดยอัตโนมัติตาม Connector Type (`AD_PROXY`, `SAP_B1`, `M365`, `SSO`, `M2M`) และผู้ใช้สามารถสลับแท็บใดๆ ภายใน Modal ได้อย่างอิสระ
3. **แสดง Base URL เต็มแบบไม่ตัดคำ:**
   - เปลี่ยนจากการใช้ `truncate max-w-[170px]` เป็น `break-all` พร้อมการจัด layout แบบ flexbox responsive ทำให้ URL ปลายทางแสดงครบถ้วน 100%
4. **แก้ไข Error 500 ใน Directory Sync AD ([directory.py](file:///d:/Python/Central-IAM/backend/app/api/v1/directory.py) & [scheduler.py](file:///d:/Python/Central-IAM/backend/app/services/scheduler.py)):**
   - เพิ่มการ import `func` จาก `sqlalchemy`: `from sqlalchemy import or_, func` เพื่อแก้ไข `NameError: name 'func' is not defined` ในฟังก์ชัน `sync_active_directory_users` (บรรทัดที่ 1195, 1218, 1219)
   - ประกาศ `is_ad_item = (app.app_code or "").lower() == "ad"` ที่ส่วนหัวของฟังก์ชัน `persist_spoke_inventory` ใน `scheduler.py` เพื่อป้องกัน unbound variable

---

## Sprint 38: แก้ไขบัญชีร้านค้าสาขา (WA-Shop_*) หลุดแสดงใน Filter ของ Active Directory (15 ต.ค. 2026)
### 1. สาเหตุของปัญหา (Root Cause Analysis):
- บัญชีร้านค้าสาขา (`WA-Shop_*`) มีวัตถุประสงค์เพื่อเชื่อมต่อเครือข่าย VPN ของแต่ละสาขาเข้า pfSense (FreeRADIUS / OpenVPN) แต่ในอดีตหรือบน Windows Domain Controller มี Account อ็อบเจกต์เหล่านี้อยู่ด้วย
- ใน `directory.py` เงื่อนไขตัวกรอง `target_app == "ad"` เดิมเขียนไว้ว่า `if not has_ad_mapping and not is_ad: continue` ซึ่งหากบัญชีมีแถวใน `AppAccountMapping` กับ AD แม้ว่าตัวระบบจะตรวจพบว่าเป็น `is_shop_acc` และตั้งค่า `is_ad = False` แล้วก็ตาม เงื่อนไขก็ยังยอมให้บัญชีนี้ผ่านตัวกรองเข้ามาได้
- และเนื่องจากฟิลด์ `is_active_in_ad` ใน MasterIdentity เดิมเป็น `True` ทำให้เมื่อเลือก Filter `Active (เปิดใช้งาน)` บัญชีร้านค้าเหล่านี้จึงผ่านเงื่อนไขเข้ามาแสดงผลทั้งหมด ทั้งที่ในตารางหน้าจอแสดงป้ายเป็น `Local Acc` และสถานะ AD เป็นขีด `-`

### 2. รายละเอียดการแก้ไข (Implementation Details):
1. **Strict AD Filtering ใน Directory ([directory.py](file:///d:/Python/Central-IAM/backend/app/api/v1/directory.py)):**
   - ใน `list_users` เมื่อกรองระบบ `target_app == "ad"` บัญชีจะต้องเป็น `is_ad == True` เท่านั้น หากเป็นบัญชีร้านค้า (`is_shop_acc`) หรือ Local Account จะถูกตัดทิ้ง (`continue`) ทันที 100%
   - สำหรับบัญชีร้านค้า ให้กรองป้ายและ mapping ของ AD ออกจาก `mappings` และ `app_summaries` ทำให้ไม่แสดงป้าย `🔴 AD` ที่สร้างความเข้าใจผิดอีกต่อไป (จะแสดงเฉพาะ `PFSENSE_FAC` / Spoke ที่เกี่ยวข้องจริง)
2. **Prevent AD Ingestion of Shop Accounts ([scheduler.py](file:///d:/Python/Central-IAM/backend/app/services/scheduler.py)):**
   - เมื่อเชื่อมต่อและดึงข้อมูลจาก AD Agent หากพบว่าเป็นบัญชีร้านค้า (`is_shop_acc`) ให้ข้าม (`continue`) ไม่นำเข้าหรือสร้าง AD mapping เด็ดขาด
   - เมื่อซิงก์จาก pfSense ให้ลบ AD mapping ตกค้างของบัญชีร้านค้านั้นๆ ออกอัตโนมัติ
3. **Database Cleansing Routine ([initial_data.py](file:///d:/Python/Central-IAM/backend/app/initial_data.py)):**
   - ปรับรูทีนใน `init_db()` ให้กวาดล้างบัญชีร้านค้า (`WA-Shop_*`) ทั้งหมด: ลบ AD mapping ออกทั้งหมด และตั้งค่า `is_active_in_ad = False`

---

## Sprint 37: ปรับปรุงการตรวจสอบสถานะ Active Directory ให้แม่นยำ และแก้ปัญหาผู้ใช้ที่ไม่อยู่ใน AD แล้ว (Worawut.S) (15 ต.ค. 2026)
### 1. สาเหตุของปัญหา (Root Cause Analysis):
- `worawut.s` (Worawut Seelanuan) เป็นบัญชีที่มีอยู่เดิมใน Spoke Applications (เช่น M365 และ SAP B1) แต่ได้ถูกนำออกจาก Active Directory ไปแล้ว
- ในโมเดล `MasterIdentity` ฟิลด์ `is_active_in_ad` มีค่าเริ่มต้นเป็น `True` และยังไม่เคยถูกปรับเป็น `False` เนื่องจากตอนรัน AD Sync ครั้งถัดมา ระบบจะ sync เฉพาะบัญชีที่ AD ส่งมา และลบเฉพาะแถว `AppAccountMapping` ของ AD แต่ไม่ได้ปรับฟิลด์ `is_active_in_ad` บน `MasterIdentity`
- ใน `directory.py` การตรวจสอบ `is_ad` เดิมอาศัยเงื่อนไขว่าถ้ามีอีเมล `@windowasia.com` (ซึ่งมาจาก M365) ก็ถูกนับเป็น `is_ad = True` จึงทำให้ `is_active_in_ad` ดึงค่า `True` ออกมา และแสดงสถานะเป็น On (จุดเขียว 🟢)

### 2. รายละเอียดการแก้ไข (Implementation Details):
1. **Automated Deactivation on AD Sync ([scheduler.py](file:///d:/Python/Central-IAM/backend/app/services/scheduler.py)):**
   - ปรับปรุงฟังก์ชัน `persist_spoke_inventory`: เมื่อตัวเชื่อมต่อเป็น Active Directory หากบัญชีเดิมหลุดออกจากรายการ AD สด (`live_usernames`) ระบบจะปรับ `stale.identity.is_active_in_ad = False` ทันที พร้อมลบการแมป AD
   - เพิ่มระบบกวาดตรวจ (Reconciliation Sweep): หากผลลัพธ์ sync จาก AD มีผู้ใช้จริงมากกว่า 5 รายการ ตัวตนใดที่คงค้าง `is_active_in_ad = True` แต่ไม่มีใน `live_usernames` จะถูกปรับเป็น `is_active_in_ad = False`
2. **Effective AD Status & Auto-Healing ([directory.py](file:///d:/Python/Central-IAM/backend/app/api/v1/directory.py)):**
   - คำนวณสถานะ `has_direct_ad = bool(has_ad_mapping or identity.ad_guid or identity.last_login_ad_at)`
   - คำนวณ `effective_ad_active = bool(identity.is_active_in_ad and has_direct_ad)` ป้องกันไม่ให้ตัวตนที่ไม่มีความเชื่อมโยงกับ AD แสดงสถานะเขียว
   - ทำ Auto-heal ในตัว: หากพบตัวตนที่ `is_active_in_ad == True` แต่ไม่มีความเชื่อมโยงกับ AD จะอัปเดตให้เป็น `False` ทันที
3. **Database Auto-Healing & Seeding ([initial_data.py](file:///d:/Python/Central-IAM/backend/app/initial_data.py)):**
   - เพิ่มการตั้งค่า explicitly deactive สำหรับ `worawut.s` (`is_active_in_ad = False`) และถอน AD mapping
   - เพิ่มกลไก auto-heal ให้กวาดตรวจและแก้ไขตัวตนที่ตกค้างทั้งหมด
4. **Enhanced UI Tooltips ([directory/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/directory/page.tsx)):**
   - ปรับข้อความ Tooltip เมื่อ AD เป็น Inactive: `"Inactive: บัญชีถูกปิดใช้งาน หรือไม่มีตัวตนใน Active Directory"`
5. **Quality Assurance:**
   - Backend Pytest: 52/52 passed (100%) รวมถึงการทดสอบใหม่ `test_ad_sync_marks_removed_ad_users_inactive`
   - Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)
4. **Mobile Responsive Login UX:** ปรับปรุงหน้าเข้าสู่ระบบ SSO บนสมาร์ตโฟนและแท็บเล็ตขนาดเล็ก โดยซ่อนแผงแบนเนอร์สีน้ำเงินฝั่งซ้าย (`hidden lg:flex`) เพื่อให้การ์ดกรอก Username/Password แสดงผลเต็มจอทันที (`min-h-screen`) ผู้ใช้งานสามารถพิมพ์ข้อมูลและเข้าสู่ระบบได้ทันทีโดยไม่ต้องเลื่อนหน้าจอลงมา
5. **Helpdesk & Support Interaction:** ปรับข้อความช่วยเหลือใต้การ์ดเข้าสู่ระบบเป็นลิงก์ปกติ `"ยังไม่มีบัญชีหรือพบปัญหาเข้าสู่ระบบ? ติดต่อฝ่าย IT"` ที่คลิกแล้วจะเปิด Modal แสดงภาพ LINE QR Code ของฝ่ายไอที พร้อมคงปุ่ม Floating Quick Contact ที่มุมขวาล่างของจอไว้
6. **Username Placeholder:** ปรับตัวอย่างในช่องกรอกชื่อผู้ใช้งานให้กระชับเป็น `เช่น Chaiwat.N` (ตัดคำว่า `หรือ Somchai.S` ออก)
7. **App Directory Hygiene (ตัด SAP B1):** นำคำว่า SAP Business One ออกจากข้อความประชาสัมพันธ์ระบบงานที่รองรับบนหน้า Login เนื่องจากยังไม่เปิดให้ผู้ใช้งานทั่วไปเข้าตรงผ่านเว็บ
8. **Active Directory Single Source of Truth (กรณี Chanpen.K):** เฉพาะ Active Directory Connector เท่านั้นที่มีสิทธิ์กำหนด `identity.is_active_in_ad` ป้องกัน Spoke Connectors เขียนทับ
9. **Department & Role Sanitization:** กรองคำว่า `"Administrator"`, `"Admin"` ออกจากรายการแผนก และแทนที่ด้วย `"Administration"` หรือ `"ธุรการ"`
10. **Zero-Trust Client-Side VPN Reachability Probe Engine:** ระบบตรวจจับ Reachability ไปยัง Spoke On-Premise (`wa-mtpulse.wa.net`) อัตโนมัติจากเบราว์เซอร์ผู้ใช้

---

### 0.2 กฎเหล็กเชิงสถาปัตยกรรมที่ห้ามฝ่าฝืนโดยเด็ดขาด (Architectural Invariants)
- **Single Unified Front Door:** ประตูเข้าสู่ระบบหน้าเดียวสำหรับทุกคนคือ `/login` ห้าม Redirect ผู้ใช้ทั่วไปหรือคำขอที่ไม่ล็อกอินไปที่ `/admin/login`
- **AD เป็น Single Source of Truth:** ห้ามให้ Spoke ใดๆ ปรับเปลี่ยน `is_active_in_ad` เป็นอันขาด หากบัญชีไม่มีใน AD หรือถูก Disable ใน AD แต่พบใน Spoke จะต้องจัดเป็น Discrepancy
- **Zero-Password-Spoke Architecture:** Central IAM ไม่เคยและจะไม่ส่งรหัสผ่าน Plaintext ไปบันทึกในฐานข้อมูลของ Spoke แอปพลิเคชันลูกต้องยืนยันตัวตนผ่าน OIDC SSO Authorization Code Flow with PKCE เท่านั้น
- **RFC 9700 Seamless SSO Initiation:** การเปิดระบบลูก On-Premise จาก Central IAM Portal ให้เด้งผ่าน Portal Launch URL (`/auth/start`) เพื่อให้ Spoke ผูก State/PKCE เข้ากับ Browser Cookie ป้องกันปัญหา Session Expired
- **Docker Compose Service Names:** ชื่อ Service ของ Frontend คือ **`web`** (ห้ามใช้ `frontend` เด็ดขาด) และ Backend คือ **`api`**
- **VPS Deployment Rule:** เขียนคำสั่งแยกทีละบรรทัด ห้ามเชื่อมด้วย `&&` ยาวเป็นพรืด และต้องมี `git pull` นำหน้าเสมอ

---

## Sprint 36: รวมศูนย์ประตูเข้าสู่ระบบหน้าเดียว (Single Unified Front Door) ป้องกัน User หลุดเข้าหน้า Admin Console (15 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Single Unified Front Door & Post-Login Flow):
1. **Unauthenticated Redirection to `/login` ([AppShell.tsx](file:///d:/Python/Central-IAM/frontend/src/components/layout/AppShell.tsx)):**
   - ปรับ Routing Guard สำหรับคำขอที่ยังไม่ได้ล็อกอิน (`!token`):
     - เมื่อผู้ใช้เข้าผ่าน Root URL `ciam.windowasia.com` (Path `/`) หรือเซสชันหลุด ระบบจะนำทางไปยังหน้าเข้าสู่ระบบรวมศูนย์ `/login` ทันที โดยไม่ต่อ Query Parameter ที่ไม่จำเป็น
     - ลบการ Redirect อัตโนมัติไปยัง `/admin/login` ออกอย่างสมบูรณ์
     - หากมีการเข้าลิงก์ตรงไปยังหน้าจัดการเฉพาะทาง (เช่น `/directory`, `/applications`, `/offboarding`) ระบบจะคงพารามิเตอร์ `?redirect=...` ไว้เพื่อพากลับมาหน้าเดิมหลังล็อกอิน
2. **Auto-Forward `/admin/login` ไปยัง `/login` ([admin/login/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/admin/login/page.tsx)):**
   - เพิ่ม Auto-Forward Guard ในหน้า `/admin/login` ส่งต่อทราฟฟิกหรือ Bookmark เก่าทั้งหมดเข้ามาที่ `/login` โดยอัตโนมัติ เพื่อให้เหลือหน้าแรกหน้าเดียว
3. **Default Landing to `/portal` ([login/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/login/page.tsx)):**
   - เมื่อล็อกอินสำเร็จ ทั้งพนักงานทั่วไปและแอดมินจะเข้าสู่ `/portal` เป็นค่าเริ่มต้น (ยกเว้นกรณีเข้าผ่าน Deep Link เฉพาะทาง เช่น `/directory`)
   - พนักงานทั่วไปจะเห็นเฉพาะระบบงานที่ตนเองได้รับสิทธิ์
   - แอดมินจะเห็นระบบงานทั้งหมด พร้อมปุ่มสลับไปยัง `Admin Console` บน Header
4. **Responsive Admin Switcher on Portal ([portal/page.tsx](file:///d:/Python/Central-IAM/frontend/src/app/portal/page.tsx)):**
   - ปรับปุ่ม `Admin Console` บนแถบ Header ของ `/portal` ให้แสดงผลบน Mobile (`[ 🛡️ Admin ]`) ควบคู่กับ Desktop (`[ 🛡️ Admin Console ]`) สำหรับผู้ดูแลระบบ
5. **Quality Assurance:**
   - Frontend TypeScript: `npx tsc --noEmit` ผ่าน 0 errors (100%)
   - Backend Pytest: ผ่าน 51/51 tests (100%)

---

## Sprint 35: ปรับปรุง Responsive หน้า Login SSO: ซ่อนแบนเนอร์สีน้ำเงินบน Mobile เพื่อให้แสดงการ์ด Login ทันทีโดยไม่ต้องเลื่อนหน้าจอ (14 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Mobile Responsive Refinement):
- ใน `frontend/src/app/login/page.tsx` ปรับส่วนแสดงผลของแผงข้อมูลสีน้ำเงินฝั่งซ้าย (Left Panel) ให้เป็น `hidden lg:flex`
- เมื่อผู้ใช้งานเปิดผ่านสมาร์ตโฟนหรือแท็บเล็ตขนาดเล็ก (จอ < `lg`):
  - ส่วนแผงสีน้ำเงินจะถูกซ่อนโดยสมบูรณ์
  - การ์ดเข้าสู่ระบบสีขาวจะแสดงผลเต็มหน้าจอทันที (`w-full min-h-screen`) ผู้ใช้สามารถพิมพ์ Username/Password และเข้าสู่ระบบได้ทันทีโดยไม่ต้องเลื่อนหน้าจอลงมา
  - เพิ่มข้อความลิขสิทธิ์ขนาดกะทัดรัดใต้การ์ดสำหรับหน้าจอมือถือ (`lg:hidden`)
- บนหน้าจอคอมพิวเตอร์ (Desktop >= `lg`):
  - ยังคงแสดงผลแบบ 2 คอลัมน์เคียงข้างกันอย่างสง่างามเช่นเดิม
- ตรวจสอบความถูกต้อง TypeScript `npx tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 34: ปรับปรุงหน้า Login SSO: เปลี่ยนปุ่มติดต่อไอทีเป็นการ์ดข้อความปกติ "ติดต่อฝ่าย IT" ไม่ซ้ำซ้อนกับด้านล่าง (14 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Login Helpdesk Link Refinement):
- ใน `frontend/src/app/login/page.tsx` ปรับส่วนแจ้งเตือนความช่วยเหลือใต้การ์ดเข้าสู่ระบบ โดยตัดปุ่มสีเขียว `[ 📱 ติดต่อฝ่ายไอที (Scan LINE) ]` ออก เพื่อไม่ให้ซ้ำซ้อนกับปุ่ม Floating ด้านล่าง
- ปรับเปลี่ยนเป็นข้อความลิงก์ปกติ:
  `ยังไม่มีบัญชีหรือพบปัญหาเข้าสู่ระบบ? ติดต่อฝ่าย IT`
  (โดยคำว่า "ติดต่อฝ่าย IT" สามารถคลิกเพื่อเปิด Modal แสดง QR Code ติดต่อฝ่ายไอทีได้เช่นเดิม)
- ตรวจสอบความถูกต้อง TypeScript `npx tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 33: ปรับปรุงหน้า Login SSO: ตัด "หรือ Somchai.S" ออกจากช่องกรอกชื่อผู้ใช้งาน (14 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Login Placeholder Refinement):
- ใน `frontend/src/app/login/page.tsx` แก้ไข Placeholder ของช่องกรอกชื่อผู้ใช้งาน (Username) จากเดิม:
  `placeholder="เช่น Chaiwat.N หรือ Somchai.S"`
  ปรับปรุงให้กระชับเป็น:
  `placeholder="เช่น Chaiwat.N"`
- ตรวจสอบความถูกต้อง TypeScript `npx tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 32: ปรับปรุงหน้า Login SSO: นำ SAP Business One ออก และเพิ่มปุ่มเปิด Scan LINE QR Code ติดต่อฝ่ายไอที (14 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Login Page UX & Support Updates):
1. **นำคำว่า SAP Business One ออกจากแบนเนอร์ข้อมูลฝั่งซ้าย:**
   - ใน `frontend/src/app/login/page.tsx` แก้ไขข้อความในรายการรองรับระบบงาน จาก:
     `รองรับการเข้าถึงระบบ IRM, SAP Business One, QMS และระบบงานภายในทั้งหมด`
     เป็น:
     `รองรับการเข้าถึงระบบ IRM, QMS และระบบงานภายในทั้งหมด`
   - เพื่อป้องกันความสับสนของผู้ใช้งานเนื่องจากระบบ SAP B1 ยังไม่เปิดให้เข้าใช้งานตรงผ่านเว็บ
2. **เพิ่มปุ่มและ Modal สำหรับสแกน LINE QR Code ติดต่อฝ่ายไอที (IT Support):**
   - นำภาพ LINE QR Code ทางการที่ผู้ใช้ส่งมอบมาบันทึกเป็น Asset กลางที่ `frontend/public/line-it-support-qr.png`
   - เพิ่มปุ่มไอคอนขนาดกะทัดรัดบริเวณด้านล่างการ์ดเข้าสู่ระบบ: `[ 📱 ติดต่อฝ่ายไอที (Scan LINE) ]`
   - เพิ่มปุ่ม Floating Quick Contact บริเวณมุมขวาล่างของหน้าจอ ให้ผู้ใช้งานคลิกเปิดสแกนได้สะดวกรวดเร็ว
   - เพิ่มปุ่มเปิด QR Code ภายในหน้าต่าง "ลืมรหัสผ่าน / ช่วยเหลือ?" (Help Modal)
   - เมื่อคลิก จะแสดง Modal Pop-up ปรากฏภาพ QR Code ชัดเจน พร้อมระบุขั้นตอนการสแกนผ่านแอป LINE 1-2-3 อย่างเป็นระเบียบ เรียบหรู ใช้งานง่าย

### 2. ผลการตรวจสอบคุณภาพ (Quality Assurance):
- Backend Tests: ผ่าน 23/23 (100%)
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 31: ตรวจสอบและแก้ไขกรณี User Chanpen.K: ซ่อมสถานะ AD ถูก Spoke เขียนทับ และล้าง Role Administrator ออกจากชื่อแผนก (14 ต.ค. 2026)
### 1. สาเหตุของปัญหา (Root Cause Analysis):
1. **ทำไมสถานะ AD ของ `Chanpen.K` แสดงเป็นสีเขียว (Active) ทั้งที่บน AD ถูก Disable แล้ว:**
   - ใน AD ผู้ใช้ `Chanpen.K` ถูกระงับสิทธิ์จริง (ไอคอนลูกศรชี้ลง ⬇️ ใน OU `Users TC`)
   - แต่ผู้ใช้ยังมีบัญชีตกค้างอยู่ในระบบลูก pfSense (`DIRECT ● AD ● PFSENSE_HO`)
   - ใน `backend/app/services/scheduler.py` ฟังก์ชัน `persist_spoke_inventory` เดิมมีเงื่อนไข:
     `elif is_corp and not identity.is_active_in_ad and uname.lower() != "pinyada.s": identity.is_active_in_ad = True`
     เมื่อระบบซิงก์ pfSense เข้ามา พบว่า `chanpen.k` มีรูปแบบชื่อพนักงานองค์กร (`Firstname.L`) จึงบังคับเปลี่ยน `is_active_in_ad` ให้กลับมาเป็น `True` เสมอ!
   - นอกจากนี้ Routine Auto-heal เดิมใน `backend/app/initial_data.py` ก็คอยบังคับเปลี่ยน `is_active_in_ad = True` ทับทุกครั้งที่เปิดเซิร์ฟเวอร์
   - ส่งผลให้สถานะที่ AD ปิดไว้ถูก Spoke อื่นเขียนทับกลับมาเป็น Active และทำให้ระบบไม่ยอมตรวจจับเป็นบัญชีผี (Discrepancy)
2. **ทำไมผู้ใช้ไม่ใช่ Admin แต่คอลัมน์ "แผนก" แสดงเป็น `Administrator`:**
   - ใน Active Directory ผู้ใช้คนนี้อยู่ใน OU `Users TC` และอาจมีฟิลด์ Department ระบุไว้ว่า `Administrator` (ตั้งใจจะสื่อถึง ธุรการ หรือเลือกผิด)
   - ฟังก์ชัน `extract_ou_department` ใน `ad_proxy.py` และ `ciam-extension.js` เดิมรองรับเฉพาะ `users wa` แต่ไม่รู้จัก `users tc` จึงไม่สามารถสกัด Leaf OU ที่ถูกต้องได้
   - คำว่า `Administrator` และ `Admin` ไม่ได้อยู่ในรายการ `junk_exact` จึงไม่ถูกคัดกรองออก ซ้ำร้ายใน `directory.py` และ `scheduler.py` ยังมี `Administrator` บรรจุอยู่ในรายการ `corporate_depts` ระบบจึงมองว่าเป็นแผนกและแสดงผลออกมา ทำให้ผู้ใช้เข้าใจผิดว่าระบบให้สิทธิ์ Admin แก่พนักงาน

### 2. การแก้ไข (Technical Implementation):
- **`backend/app/services/scheduler.py`:**
  - ลบเงื่อนไขที่อนุญาตให้ Spoke เปลี่ยน `identity.is_active_in_ad = True` ออกโดยเด็ดขาด กำหนดให้เฉพาะ Active Directory Connector (`is_ad_item = True`) เท่านั้นที่มีสิทธิ์ระบุสถานะนี้
  - หากเป็นผู้ใช้ใหม่ที่พบจาก Spoke ให้กำหนด `is_active_in_ad = False`
  - ลบคำว่า `administrator` และ `admin` ออกจาก `corporate_depts` โดยแทนที่ด้วย `administration` และ `ธุรการ`
- **`backend/app/initial_data.py`:**
  - ลบ Routine Auto-heal ที่กวาดเปลี่ยน `is_active_in_ad = True` บนบัญชีทั้งหมดทิ้ง คงไว้เฉพาะการเคลียร์บัญชีสาขา shop ให้เป็น False
- **`backend/app/connectors/ad_proxy.py` & `ciam-extension.js`:**
  - ปรับ `extract_ou_department` ให้รองรับทั้ง Root OU `users wa`, `users tc`, และ `users`
  - เพิ่ม `administrator`, `admin`, `domain admins`, `domain users` ใน `system_ous`, `junk_exact`, และ `junkDepts`
- **`backend/app/api/v1/directory.py`:**
  - เพิ่ม `administrator`, `admin`, `domain admins`, `domain users` ลงใน `junk_exact` ของ `_clean_directory_attributes`
  - เปลี่ยน `Administrator` ใน `corporate_depts` เป็น `Administration`
- **Unit Tests:**
  - เพิ่มการทดสอบใน `backend/tests/test_agent_deduplication.py` ครอบคลุมทั้งการสกัด OU ใต้ `Users TC`, การคัดกรองคำว่า `Administrator` ทิ้งเป็น `None`, และการยืนยันว่าการซิงก์ Spoke (เช่น pfSense) จะไม่เปลี่ยน `is_active_in_ad` ของผู้ใช้ที่ถูก Disable ใน AD กลับมาเป็น True พร้อมจัดสถานะเป็น `DISCREPANCY` (Ghost Account) อย่างถูกต้อง
- **ผลการทดสอบ:** Backend Pytest ผ่าน 100%, Frontend TypeScript `npx tsc --noEmit` 0 errors (100%)

---

## Sprint 30: แก้ไขบั๊กปุ่มเปลี่ยนรหัสผ่านยังแสดงบนบัญชี AD: ปรับปรุงการตรวจสอบ is_ad_user ให้แม่นยำ ไม่ผูกติดกับ ad_guid (13 ต.ค. 2026)
### 1. สาเหตุและการแก้ไข (Root Cause Analysis & Fix):
- **สาเหตุที่เกิดปัญหา:** ใน `backend/app/api/v1/auth.py` ของ Endpoint `GET /api/v1/auth/me` เดิมมีโค้ดตรวจสอบ:
  `out.is_ad_user = bool(ident.is_active_in_ad and ident.ad_guid)`
  เนื่องจากบัญชีพนักงานส่วนใหญ่ในระบบ (รวมถึง `Chaiwat.N`) ไม่มีฟิลด์ `ad_guid` ในฐานข้อมูล จึงทำให้เงื่อนไข `bool(True and None)` กลายเป็น **`False`** เสมอ ส่งผลให้ Frontend ได้รับ `is_ad_user: false` และมองว่าเป็น Local Account จึงแสดงปุ่มรูปกุญแจ 🔑 บนหน้า Portal
- **การแก้ไข:** ปรับปรุงฟังก์ชัน `_resolve_is_ad_user(username, ident)` ในระดับ Module ของ `auth.py`:
  - บัญชีที่เป็น Local Account มีเพียง 2 กรณีเท่านั้น คือ:
    1. บัญชีผู้ดูแลระบบตั้งต้น (`admin`, `superadmin`)
    2. บัญชีที่ได้รับการอนุมัติเป็นข้อยกเว้นพิเศษ (`ident.exception_type == "LOCAL_ACCOUNT"`)
  - บัญชีพนักงานองค์กรอื่นๆ ทั้งหมด (เช่น `Chaiwat.N`, `Thanaphat.C`, `Patcha.S`, `Wimonpan.P`) จะได้ค่า `is_ad_user = True` เสมอ
  - ใช้ฟังก์ชันเดียวกันนี้ทั้งใน `POST /api/v1/auth/login` และ `GET /api/v1/auth/me` ป้องกันค่าตีกัน
- **ผลลัพธ์:** บัญชี `Chaiwat.N` และพนักงาน AD ทุกคนจะได้รับ `is_ad_user = True` 100% ทำให้ปุ่มเปลี่ยนรหัสผ่าน 🔑 บน Header ของ `/portal` ถูกซ่อนไปโดยอัตโนมัติ

### 2. ผลการตรวจสอบคุณภาพ (Quality Assurance):
- Backend Tests: ผ่าน 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 29: ปรับปรุงหน้า Login SSO: ย้าย Logo ทางการมาฝั่งขวา, ตัดกล่อง Local/AD ด้านล่างออก, และปรับกระชับ Wording ฝั่งซ้ายให้เรียบหรู Enterprise (13 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Login SSO Visual & Structural Refinements):
1. **ย้าย Official Logo มาอยู่ฝั่งขวาด้านบนการ์ด Login:**
   - ย้ายโลโก้ทางการของบริษัท วินโดว์ เอเชีย (`/window-asia-logo.png`) ที่มีทั้งตราสัญลักษณ์วงกลมและตัวหนังสือ "Window Asia / วินโดว์ เอเชีย" มาไว้ด้านบนสุดของการ์ดเข้าสู่ระบบฝั่งขวา เหนือคำว่า "ยินดีต้อนรับ"
   - ลบ `WindowAsiaEmblem` ที่แสดงผลผิดส่วน (`[Emblem] V`) ออกอย่างสมบูรณ์
   - ปรับพื้นหลังการ์ดฝั่งขวาเป็น `bg-white` สะอาดตา เพื่อให้โลโก้ทางการแสดงผลได้อย่างคมชัด ไร้รอยต่อ
2. **ตัดกล่อง Local / Internal Active Directory และส่วนเกินด้านล่างฝั่งขวาออก:**
   - นำเส้นแบ่ง `หรือเข้าสู่ระบบด้วย`, การ์ด `Internal Active Directory (ยืนยันตัวตนผ่าน Windows AD...)`, และปุ่ม `Admin Console` ด้านล่างออกทั้งหมด
   - ป้องกันความสับสนของผู้ใช้งาน ทำให้หน้าเข้าสู่ระบบสะอาด กระชับ เป็นมาตรฐานองค์กรเดียว
   - คงไว้เพียงข้อความช่วยเหลือฝ่ายไอทีขนาดกะทัดรัดด้านล่าง: *"ยังไม่มีบัญชีหรือพบปัญหาเข้าสู่ระบบ? กรุณาติดต่อฝ่ายไอที (IT Support)"*
3. **ปรับ Wording ฝั่งซ้ายให้สั้น กระชับ ตรงประเด็น (Enterprise Dignified Tone):**
   - ตัด Wording ที่เยิ่นเย้อออกทั้งหมด เช่น บัตรรับประกันความปลอดภัย 24 ชม. และการ์ด 4 เสาหลัก (ปลอดภัย รวดเร็ว เสถียรภาพ ครบวงจร)
   - ปรับเป็นหัวข้อและข้อความสั้นๆ 3 ประเด็นหลัก:
     1. ยืนยันตัวตนด้วยชื่อบัญชีและรหัสผ่าน Windows Active Directory
     2. รองรับการเข้าถึงระบบ IRM, SAP Business One, QMS และระบบงานภายในทั้งหมด
     3. มาตรฐานความปลอดภัยและการควบคุมสิทธิ์การเข้าถึงข้อมูลระดับองค์กร
   - รักษาความสวยงามแบบ Modern Enterprise ด้วย Deep Navy Gradient และ Blueprint Grid Pattern

### 2. ผลการตรวจสอบคุณภาพ (Quality Assurance):
- Backend Tests: ผ่าน 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 28: ซ่อนปุ่มเปลี่ยน Password สำหรับ AD, บังคับใช้นโยบายรหัสผ่าน Enterprise สำหรับ Local Account (8-10 ตัวอักษร), และระบบบังคับเปลี่ยนรหัสผ่านครั้งแรก (13 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (AD Password Protection & Enterprise Local Account Policy):
1. **ซ่อนปุ่มเปลี่ยน Password สำหรับบัญชี AD บน Employee Portal (`/portal`):**
   - ตรวจสอบชนิดบัญชีผ่าน API `/auth/me` และ `/auth/login` โดยเพิ่มฟิลด์ `is_ad_user: bool`
   - หากผู้ใช้เป็น Active Directory User (`is_ad_user === true`) จะ**ไม่แสดงปุ่มรูปกุญแจ 🔑** บนแถบ Header ของ Employee App Portal เพื่อป้องกันความสับสน เนื่องจากรหัสผ่าน AD ต้องเปลี่ยนผ่าน Windows Domain Computer (`Ctrl + Alt + Del`) เท่านั้น
   - หากเป็น Local Account หรือ Admin ทั่วไป (`is_ad_user === false`) จะมีปุ่มรูปกุญแจ 🔑 ให้เปลี่ยนรหัสผ่านได้ตามปกติ
2. **นโยบายความปลอดภัยรหัสผ่าน Enterprise Password Complexity Policy (สำหรับ Local Account):**
   - ปรับใช้ทั้งใน Backend (`validate_password_complexity` ใน `backend/app/core/security.py`) และ Frontend Client-side validation:
     - **ความยาว 8-10 ตัวอักษร** (Strict Enterprise Length 8-10 characters)
     - มีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว
     - มีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว
     - มีตัวเลข (0-9) อย่างน้อย 1 ตัว
     - มีอักขระพิเศษ (`!@#$%^&*()_+-=[]{}|;:,.<>?`) อย่างน้อย 1 ตัว
     - ตรวจสอบการกรอกรหัสผ่านใหม่ตรงกัน 2 ครั้ง
3. **ระบบบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก (`must_change_password`):**
   - เพิ่มคอลัมน์ `must_change_password: bool` ในโมเดล `AdminUser` พร้อมระบบ Auto-migration ใน `initial_data.py`
   - ในหน้าทะเบียนผู้ใช้ (`/directory`): เพิ่ม Checkbox "บังคับให้ผู้ใช้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก" ทั้งตอนสร้างบัญชีใหม่และรีเซ็ตรหัสผ่าน
   - เมื่อผู้ใช้ที่มีสถานะ `must_change_password === true` ล็อกอินเข้าสู่ระบบ:
     - หน้า Employee App Portal (`/portal`) จะเปิด Modal บังคับเปลี่ยนรหัสผ่านทันทีอัตโนมัติ
     - ซ่อนปุ่มปิด/ยกเลิก บังคับให้ผู้ใช้ต้องตั้งรหัสผ่านใหม่ตาม Enterprise Complexity Policy ก่อนจึงจะสามารถใช้งานระบบได้
     - เมื่อเปลี่ยนรหัสผ่านสำเร็จ ระบบจะรีเซ็ตสถานะ `must_change_password` เป็น `false` โดยอัตโนมัติ
4. **ข้อชี้แจงการเข้าใช้งานระบบ Spoke โดยตรง (Direct Spoke Login):**
   - Local Account ที่สร้างบน Central IAM เพื่อไปใช้งาน Spoke App (เช่น IRM) **ไม่สามารถล็อกอินตรงผ่าน Form Login ดั้งเดิมของระบบ Spoke ได้** เนื่องจาก Spoke App ไม่ได้รับ Plaintext Password ไปบันทึกในฐานข้อมูลตนเอง (Zero-Password-Spoke Architecture)
   - ผู้ใช้งานกลุ่มนี้ต้องล็อกอินผ่าน Central IAM SSO (`/portal`) แล้วคลิกเข้าสู่ Spoke Application เท่านั้น ซึ่งปลอดภัยและเป็นไปตามหลักการ Single Sign-On มาตรฐานองค์กร

### 2. ผลการตรวจสอบคุณภาพ (Quality Assurance):
- Backend pytest: ผ่าน 49/49 tests (100%)
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 27: ออกแบบหน้า Login SSO ใหม่แบบ Split-Screen Enterprise Layout ด้วย Official Logo ตรงตาม Brand Identity (13 ต.ค. 2026)
### 1. รายละเอียดการทำงาน (Enterprise SSO Login Redesign & Authentic Branding):
1. **นำเข้าและใช้งาน Official Logo Asset โดยตรง (Brand Identity 100%):**
   - นำไฟล์รูปภาพโลโก้ทางการของบริษัท วินโดว์ เอเชีย (`media_1791888237535.png`) ที่ผู้ใช้ส่งให้ มาใช้เป็น Asset หลักโดยตรงใน `frontend/public/window-asia-logo.png`
   - สกัดวงกลมตราสัญลักษณ์ Window Emblem ความละเอียดสูงเป็น `frontend/public/window-asia-emblem.png` สำหรับแสดงผลแบบไอคอน
   - ปรับแต่ง [WindowAsiaLogo.tsx](file:///d:/Python/Central-IAM/frontend/src/components/WindowAsiaLogo.tsx) ให้รองรับการแสดงผลทั้งบนพื้นหลังสีเข้ม (ฝังในการ์ดแคปซูลสีขาวมนสวยงาม คมชัด 100% ไม่บิดเบือนสี) และพื้นหลังสีสว่าง
2. **เค้าโครง 2 คอลัมน์ (Split-Screen Layout):**
   - **ฝั่งซ้าย (Enterprise Corporate Showcase ~55%):**
     - พื้นหลัง Deep Navy Blue (`#06193b` ถึง `#041229`) พร้อมลวดลาย Architectural Blueprint Grid (ตารางวิศวกรรม/สถาปัตยกรรม 44px) และ Ambient Blue Glows
     - แสดง Official Logo **Window Asia** พร้อมข้อความภาษาไทยกำกับ "วินโดว์ เอเชีย" และ "ประตูหน้าต่าง Alu/uPVC คุณภาพสูง"
     - สรุปจุดเด่นระบบ SSO 3 ข้อ: Single Sign-On รวมศูนย์, ยืนยันตัวตนผ่าน Active Directory, มาตรฐานความปลอดภัย Enterprise
     - แถบรับประกันความปลอดภัยตลอดการใช้งาน (Shield Guarantee Card) ดูแลและปกป้องข้อมูลตลอด 24 ชม.
     - 4 เสาหลักฟีเจอร์ด้านล่าง: ปลอดภัย, รวดเร็ว, เสถียรภาพ (HA 99.9%), ครบวงจร
     - Footer ด้านล่างแสดงลิขสิทธิ์ © 2026 Window Asia Public Company Limited
   - **ฝั่งขวา (Enterprise Login Card ~45%):**
     - โทนสะอาด คลีน สบายตา ผิวสว่างโทน `#f8fafc`
     - หัวข้อ "ยินดีต้อนรับ เข้าสู่ระบบ Window Asia App Portal"
     - ตราสัญลักษณ์หน้าต่างทางการ (`WindowAsiaEmblem`) จากไฟล์ของบริษัท
     - ฟิลด์กรอกข้อมูล: ชื่อผู้ใช้งาน (Windows / AD Username) และรหัสผ่าน พร้อมปุ่มสลับการมองเห็น (Eye toggle)
     - เช็กบ็อกซ์ "จดจำฉัน" และปุ่ม "ลืมรหัสผ่าน / ช่วยเหลือ?" (เปิด Modal แนะนำวิธีเปลี่ยนรหัสผ่าน AD และช่องทางติดต่อ IT Helpdesk)
     - ปุ่ม "เข้าสู่ระบบ" สีน้ำเงิน Enterprise พร้อมไอคอนลูกศร
     - แถบระบุตัวตน Active Directory ("ยืนยันตัวตนผ่านระบบ Windows AD ของบริษัท ชุดเดียวกับเปิดคอมพิวเตอร์")
     - ลิงก์ตรงสำหรับเจ้าหน้าที่ไอที / ผู้ดูแลระบบ ไปยัง Admin Console (`/admin/login`)
     - รองรับ Responsive บนหน้าจอมือถือจะแสดงผลโลโก้ทางการด้านบนอย่างพอดี ไม่ล้นจอ และใช้งานง่าย

### 2. ผลการทดสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests (100%)
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 26: รวมบัญชี Wachirawut.B/wachirawoot.b อัตโนมัติ, แก้ไขแผนก Chaiwat (IT) และ Wimonpan.P (SC) ให้ถูกต้องตามจริง, และเพิ่มปุ่มซิงก์สดจาก AD (13 ต.ค. 2026)
### 1. รายละเอียดการทำงานและตอบข้อสงสัยของผู้ใช้:
1. **การรวมบัญชี Wachirawut.B กับ wachirawoot.b (Case Insensitive & Transliteration Merge):**
   - **สาเหตุที่แยกเป็น 2 แถว:** บัญชีใน AD สะกดว่า `wachirawoot.b` (ใช้ `oo`) ส่วนบัญชีใน pfSense HO สะกดว่า `Wachirawut.B` (ใช้ตัวใหญ่และใช้ `u`) ระบบเดิมจึงมองเป็นคนละ username
   - **การแก้ไข:** 
     - เพิ่มฟังก์ชัน Auto-healing ใน `initial_data.py` ควบรวมบัญชี `Wachirawut.B` เข้ากับ `wachirawoot.b` ทันที ย้ายสิทธิ์ `PFSENSE_HO` มารวมไว้ที่บัญชีหลัก และลบบัญชีซ้ำซ้อนออก
     - ใน `scheduler.py`: เพิ่มการจับคู่แบบ Case-Insensitive และถอดเสียง (Transliteration `wut` <-> `woot`) ทำให้ทุกครั้งที่ pfSense ซิงก์เข้ามา ระบบจะผูกเข้ากับ `wachirawoot.b` โดยอัตโนมัติ ไม่แยกแถวอีกต่อไป
2. **ที่มาของแผนก Chaiwat (IT) และ Wimonpan.P (SC) — เลิกใช้ Mock Seed Data 100%:**
   - **ที่มาเดิม:** แผนก "Purchasing" ของ Chaiwat และ "IT" ของ Wimonpan.P เกิดจากข้อมูลตัวอย่าง (Mock Data) ที่ถูกใส่ไว้ใน `real_identities` ของไฟล์ `initial_data.py` ก่อนหน้านี้ ไม่ได้อ่านมาจาก Active Directory จริง ซึ่งผู้ใช้ตรวจพบว่าข้อมูลผิดพลาด (ความจริงคือคุณ Chaiwat อยู่ **IT** และคุณ Wimonpan.P อยู่ **SC**)
   - **การแก้ไข:** แก้ไขค่าให้ถูกต้องตามที่คุณ Chaiwat ระบุ (`Chaiwat.N` = **IT**, `Wimonpan.P` = **SC**) และตัดการคาดเดาแผนกทิ้งทั้งหมด เพื่อรอรับค่าจริงจากการซิงก์ Active Directory OU
3. **การซิงก์ข้อมูลสดจาก Active Directory:**
   - เพิ่ม Endpoint `POST /api/v1/directory/sync-ad` สำหรับให้ผู้ดูแลระบบสั่ง Query สดจาก AD Sync Agent (พอร์ต 3100) ได้ทันทีตามต้องการ เพื่ออัปเดต OU, Department, และสถานะของพนักงานทุกคนให้เป็นปัจจุบันที่สุด
   - เพิ่มปุ่ม **`[ 🔄 ซิงก์จาก AD ]`** บนแถบเครื่องมือของหน้าทะเบียนผู้ใช้ (`/directory`) เพื่อให้ Admin กดซิงก์ดึงข้อมูลล่าสุดจาก AD เข้าสู่ Central IAM ได้ทันทีโดยไม่ต้องรอรอบ 04:00 น.

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 25: แก้ไขบั๊กคอลัมน์แผนก Blank (-): แก้ไข Empty String ใน Junk Depts, ปรับปรุงการดึง OU จาก DistinguishedName และฟื้นฟูข้อมูลแผนก (13 ต.ค. 2026)
### 1. สาเหตุที่คอลัมน์แผนก (Department) แสดงผลเป็นขีด `-` (Blank) ทั้งหมด:
1. **Empty String ในตัวกรอง `junk_depts`:** ใน `backend/app/api/v1/directory.py` และ `backend/app/initial_data.py` เดิมมีลิสต์ `junk_depts` ที่บรรจุสตริงว่าง `""` อยู่ท้ายลิสต์ เมื่อมีเงื่อนไข `any(j in dept_str.lower() for j in junk_depts)` ในภาษา Python สตริงว่าง `""` จะเป็นซับสตริงของสตริงทุกตัวเสมอ (`"" in "Purchasing"` ได้ `True`) ส่งผลให้แผนกของทุกบัญชีถูกมองว่าเป็น Junk และถูกเปลี่ยนเป็น `None` 100% ทั้งใน API และการล้างข้อมูลตอนเริ่มเซิร์ฟเวอร์
2. **ไม่รองรับคีย์ `distinguished_name` และ `department` ใน `_normalize_ad_users`:** ใน `backend/app/connectors/ad_proxy.py` โค้ดเดิมค้นหาเฉพาะ `distinguishedName`, `DistinguishedName`, และ `dn` (ไม่มีแบบ `distinguished_name` ที่ส่งจาก `ciam-extension.js`) และไม่ได้อ่านค่า `department` ที่ `ciam-extension.js` สกัดมาจาก OU ส่งผลให้เมื่อซิงก์จาก AD ข้อมูลแผนกจึงกลายเป็น `None` เสมอ
3. **การสกัด OU จาก DistinguishedName:** ปรับปรุงให้อ่านทั้ง Leaf OU ใต้ `Users WA` (เช่น `Purchasing`, `IT`, `HR`, `Accounting`, `Warehouse`) และรองรับ Fallback ไปยังฟิลด์ `Department` ของ AD ในกรณีที่ผู้ใช้อยู่ใต้รูท OU โดยตรง

### 2. รายละเอียดการแก้ไข:
1. **`backend/app/api/v1/directory.py`:**
   - นำสตริงว่าง `""` ออกจาก `junk_depts` และแยกเป็น `junk_exact` (ตรงกันทั้งคำ) กับ `junk_substrings` (คำไม่พึงประสงค์ เช่น `openvpn`, `captive portal`, `active directory`, `wa shop`)
   - คืนค่าแผนกจริงได้อย่างถูกต้องเมื่อผู้ใช้เป็น AD Account
2. **`backend/app/connectors/ad_proxy.py`:**
   - แก้ไข `_normalize_ad_users` ให้อ่านทั้ง `distinguished_name`, `distinguishedName`, และค่า `department` / `Department`
   - ปรับปรุง `extract_ou_department` ให้ดึง Leaf OU ใต้ `Users WA` ได้อย่างแม่นยำ และรองรับ fallback
3. **`backend/app/initial_data.py`:**
   - แก้ไข `junk_exact` และ `junk_substrings` ไม่ให้มีสตริงว่าง
   - เพิ่ม Routine คืนค่าแผนกจริงสำหรับ Master Identities ที่เป็นบัญชีหลัก (เช่น `Chaiwat.N`, `Patcha.S`, `Apichai.P` -> `Purchasing`, `Ronnakorn.P`, `Wimonpan.P` -> `IT`, `Hermes.N` -> `Warehouse`)
4. **`ciam-extension.js`:**
   - เพิ่ม `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` ก่อนรัน `Get-ADUser` ใน PowerShell ป้องกันภาษาไทยในชื่อ OU เพี้ยน
   - ส่งออกทั้ง `distinguishedName`, `distinguished_name`, และ `department`

### 3. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 24: ปรับปรุงหน้า SSO Portal ใหม่: Freeze Header, กระชับ Header รอง, ย่อขนาด App Cards 4 คอลัมน์, และพื้นหลังเฉดสีฟ้าอ่อน Modern (13 ต.ค. 2026)
### 1. รายละเอียดการปรับปรุง (SSO App Portal Refinement):
1. **Freeze Top Header:**
   - เปลี่ยนจาก static/sticky header เป็น `fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-b border-sky-200/80 h-16`
   - เพิ่ม `pt-20` บนคอนเทนเนอร์หลัก (`<main>`) เพื่อตรึง Header ไว้ด้านบนตลอดเวลา ไม่เลื่อนหายไปไหนเมื่อ Scroll หน้าจอ
2. **ปรับปรุงส่วน Header รองให้กระชับ ไม่กินพื้นที่:**
   - ยกเลิกกล่อง Hero Banner ขนาดใหญ่ที่กินพื้นที่หน้าจอ
   - ลบคำศัพท์เทคนิค เช่น `SSO Core Active (RS256)` และ `Enterprise Identity Portal` ออกทั้งหมด เพื่อให้ผู้ใช้งานทั่วไปเข้าใจง่าย ไม่สับสน
   - เปลี่ยนเป็นแถบทักทายกระชับแบบบรรทัดเดียว: `สวัสดี, คุณ [ชื่อ-นามสกุล] 👋 เลือกระบบงานที่ต้องการเข้าใช้งาน หรือค้นหาจากแถบด้านล่าง` พร้อม Badge สรุปจำนวนระบบพร้อมใช้งาน
3. **ปรับการ์ด App ให้กะทัดรัด (Compact Cards Grid):**
   - ปรับการจัดวางเป็น 4 คอลัมน์บนหน้าจอเดสก์ท็อป (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`)
   - ย่อขนาดกล่องไอคอนทรง Squircle 3D เป็น `w-11 h-11` (ไอคอน `w-5.5 h-5.5`)
   - ย่อระยะขอบด้านใน (padding) และข้อความคำอธิบายให้กระชับ
   - ย่อปุ่มเปิดระบบเป็น `py-2.5 px-3 rounded-xl text-xs font-black`
   - ลดความสูงรวมของการ์ดลงกว่า 45% ทำให้ผู้ใช้งานเห็นระบบงานทั้งหมดได้ครบในหน้าจอเดียวโดยไม่ต้องเลื่อนหน้าจอ
4. **พื้นหลังไล่เฉดสีฟ้าอ่อนสไตล์ Modern (Soft Blue Gradient & Ambient Glow):**
   - เปลี่ยนพื้นหลังจากสีขาวโพลน เป็น `bg-gradient-to-br from-sky-100/90 via-sky-50/80 to-blue-100/70`
   - เพิ่ม Ambient Glow แสงฟุ้งสีฟ้าอ่อน (`from-sky-200/50 via-blue-100/30` และ blur orbs) ให้ความรู้สึกพรีเมียม นุ่มนวล สบายตา และมีมิติ

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 23: ยกเครื่องดีไซน์ Modern SSO App Portal, แก้ไข Winmonpan.P แสดง AD เขียว, และปรับแถบ Header & ระบบเชื่อมต่อ (13 ต.ค. 2026)
### 1. รายละเอียดการทำงาน:
1. **แก้ไขความถูกต้องของสถานะ AD สำหรับ `Winmonpan.P`:**
   - **สาเหตุ:** `agent.py` เดิมมี logic `is_ad_format` ที่ตรวจสอบจุดในชื่อผู้ใช้ (`first.last`) เมื่อ Spoke MTPulse ซิงก์บัญชีที่สะกดผิดเป็น `Winmonpan.P` จึงเข้าใจผิดว่าเป็นบัญชี AD และตั้ง `is_active_in_ad = True` ประกอบกับ `directory.py` นำ `is_ad_username_fmt` มาใช้ตัดสิน `is_ad`
   - **การแก้ไข:** 
     - ใน `agent.py`: ยกเลิกการอนุญาตให้ Spoke Agent กำหนดสถานะ AD เอง โดยบัญชีที่สร้างจาก Spoke จะเป็น `is_active_in_ad = False` เสมอ
     - ใน `directory.py`: ตัด `is_ad_username_fmt` ออก และกำหนด `u_clean not in ("pinyada.s", "winmonpan.p")` พร้อมสะท้อน `is_active_in_ad = False`
     - ใน `initial_data.py`: เพิ่ม Auto-healing routine แก้ไข `Winmonpan.P` เป็น `is_active_in_ad = False` และลบ mapping ของ AD ออกถาวร ทำให้แสดงผลเป็นขีด `-` พร้อมป้าย `Local Acc`
2. **ยกเครื่องหน้า Single Sign-On (SSO App Portal - `/portal`):**
   - ออกแบบใหม่ด้วยสไตล์ **Modern Executive Glassmorphism & Ambient Glow**
   - ไอคอนระบบงานในกล่องทรง Squircle 3D พร้อมแสงเงาเฉพาะตัว (IRM สีส้มอำพัน, QMS สีเขียวมรกต, QOL สีน้ำเงิน, SAP B1 สีน้ำเงินรอยัล, MTPulse สีฟ้าไซแอน, WorkSync สีม่วง)
   - เพิ่ม Toolbar ค้นหาระบบงานแบบพิมพ์หาได้ทันที (Instant Live Search)
   - เพิ่มแถบเลือกหมวดหมู่: `ทั้งหมด`, `🏭 การผลิต & คลัง`, `📊 การขาย & ลูกค้า`, `💼 ERP & บริหาร`, `🛡️ ต้องใช้ VPN`
   - ปุ่มกดเข้าสู่ระบบพร้อมแอนิเมชันลูกศรพุ่งเฉียงขึ้น (`↗`) และสถานะ VPN/SSO ที่ชัดเจน
3. **ปรับปรุงแถบ Header และหน้าระบบเชื่อมต่อ (`/applications`):**
   - นำ Breadcrumb Pill คำว่า `[ ⬡ Central IAM ]` บนแถบ Header ด้านบนสุดออก เพื่อความสะอาดตา
   - นำปุ่ม `[ 🕒 กำหนดเวลาซิงก์: 04:00 น. ]` บน Toolbar ของหน้าระบบเชื่อมต่อออก (เนื่องจากมีอยู่ในหน้า Setting แล้ว)
   - นำ Dropdown `เรียงตาม: [ลำดับระบบ (ID คงที่)]` ออก

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 22: ปรับเปลี่ยนการตรวจสถานะ AD เป็นทุก 1 นาที (ค่าเริ่มต้น) และรองรับการตั้งค่าความถี่ได้เองโดย Admin (13 ต.ค. 2026)
### 1. รายละเอียดการปรับปรุง (Configurable AD Monitor Probe Interval):
1. **เปลี่ยนค่าความถี่เริ่มต้น (Default Interval):**
   - เปลี่ยนจากการตรวจทุก 30 วินาที เป็น **ทุก 1 นาที (60 วินาที)**
   - ปรับ `DEFAULT_AD_MONITOR` ใน `backend/app/services/telegram_service.py` ให้มี `"check_interval_seconds": 60`
2. **ระบบตั้งค่าความถี่โดย Admin ในหน้า Settings:**
   - เพิ่ม Dropdown ให้ Admin สามารถเลือกความถี่การ Probe AD ได้เอง:
     - `30 วินาที` (30s - ตรวจถี่พิเศษ)
     - `1 นาที` (60s - ค่าเริ่มต้นแนะนำ)
     - `2 นาที` (120s)
     - `3 นาที` (180s)
     - `5 นาที` (300s)
     - `10 นาที` (600s)
   - มีปุ่ม **"💾 บันทึกความถี่"** พร้อมกล่อง Feedback แจ้งสถานะบันทึกสำเร็จทันที
3. **Backend API & Dynamic Scheduler Execution:**
   - เพิ่ม Endpoint `PUT /api/v1/dashboard/health-monitor/ad-interval` รับ `{ "check_interval_seconds": int }`
   - ปรับ Background Scheduler (`backend/app/services/scheduler.py`) ให้วนรอบตรวจสอบทุกๆ 15 วินาที เพื่อรองรับการ Trigger ที่ตรงตามรอบเวลาที่ตั้งไว้ทุกช่วง
   - ใน `check_and_notify_ad_status()`: มีการคำนวณ `elapsed_since_last_check` เทียบกับ `check_interval_seconds` หากยังไม่ถึงรอบจะ skip โดยไม่ยิง probe AD พร่ำเพรื่อ
4. **Frontend UI Integration:**
   - ปรับปรุง `frontend/src/app/settings/page.tsx`:
     - เพิ่มกล่องตั้งค่าความถี่ในการตรวจสอบสถานะ AD (Probe Interval)
     - ปรับ Badge แสดงสถานะและคำบรรยายให้แสดงผลตามค่าความถี่ที่ตั้งไว้แบบไดนามิก
   - ปรับปรุง `frontend/src/components/profile/AdminProfileModal.tsx`:
     - ระบุสถานะ `ACTIVE (ทุก 1 นาที)` พร้อมหมายเหตุแนะนำการตั้งค่าในหน้า Settings

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100%
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 21: ระบบเฝ้าระวัง AD Sync Agent: แจ้งเตือน Telegram ทันทีเมื่อ OFF และเตือนซ้ำทุกๆ 1 ชั่วโมง จนกว่าจะกลับมาเป็น ON (13 ต.ค. 2026)
### 1. รายละเอียดการทำงานของระบบเฝ้าระวัง (Real-Time AD Monitor Engine):
1. **Background Scheduler Daemon (ตรวจสอบทุก 30 วินาที):**
   - ทำงานตลอด 24/7 ผ่าน `run_scheduler_worker()` ใน `backend/app/services/scheduler.py`
   - เรียกฟังก์ชัน `check_and_notify_ad_status(db)` เพื่อ Probe สถานะ AD Gateway (`http://172.18.0.1:3100`)
2. **State Machine & Notification Rules:**
   - **กฎที่ 1 (แจ้งเตือนทันทีเมื่อหลุด):** เมื่อสถานะ AD เปลี่ยนเป็น `OFFLINE` ระบบจะยิงข้อความแจ้งเตือนสีแดง `🚨 [CIAM ALERT] AD Sync Agent หลุดการเชื่อมต่อ` เข้ากลุ่ม Telegram และส่ง DM ถึงแอดมินทันที พร้อมระบุเวลาตรวจพบและสาเหตุข้อผิดพลาด
   - **กฎที่ 2 (เตือนซ้ำทุกๆ 1 ชั่วโมง):** ตราบใดที่สถานะยังคงเป็น `OFFLINE` ระบบจะตรวจเวลาว่าผ่านไป >= 3,600 วินาทีจากรอบก่อนหรือไม่ หากครบ 1 ชั่วโมง จะส่งแจ้งเตือนสีส้ม `⚠️ [CIAM REMINDER] AD Sync Agent ยังคง OFFLINE (เตือนรอบที่ N)` พร้อมคำนวณเวลารวมที่ล่มต่อเนื่อง (Cumulative Downtime)
   - **กฎที่ 3 (แจ้งเตือนกู้คืนเมื่อกลับมา ON):** เมื่อ AD กลับมาตอบสนองปกติ (`ONLINE`) ระบบจะส่งแจ้งเตือนสีเขียว `✅ [CIAM RECOVERY] AD Sync Agent กลับมา ONLINE ปกติแล้ว` ทันที พร้อมสรุปรวมเวลาขัดข้องทั้งหมด และรีเซ็ตวงรอบการเตือน
3. **Database State Persistence:**
   - บันทึกสถานะลงตาราง `system_settings` ในคีย์ `ad_status_monitor` ป้องกันการสูญหายของ State และเวลานับถอยหลังข้ามการรีสตาร์ตเซิร์ฟเวอร์
4. **Interactive Dashboard & Settings UI:**
   - หน้า **Settings (`/settings`)**: เพิ่มการ์ด **"ระบบเฝ้าระวัง AD Sync Agent & แจ้งเตือน Telegram ฉุกเฉิน"** แสดงสถานะสด, Response Latency, เวลาตรวจสอบล่าสุด, ปุ่มตรวจเช็คทันที, และปุ่มทดสอบจำลองส่งข้อความทั้ง 3 รูปแบบ (OFFLINE ทันที, เตือนซ้ำทุก 1 ชม., และ RECOVERY กู้คืน)
   - โมดอล **AdminProfileModal**: เพิ่มแถบแจ้งเตือนสถานะ Real-Time 30s ในแท็บ Telegram Health & AD Agent

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: ผ่าน 49/49 tests 100% (รวม unit tests สำหรับ State Machine และ Endpoints ใหม่)
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 20: เพิ่มการ Sort ที่ Header ตาราง, เปลี่ยนชื่อคอลัมน์เป็น "บัญชีผู้ใช้", และปรับปุ่มจัดการสิทธิ์เป็นไอคอนล้วน (13 ต.ค. 2026)
### 1. รายละเอียดการปรับปรุงหน้า Directory:
1. **กดที่ Header เพื่อเรียงลำดับ (Interactive Column Sorting):**
   - สามารถคลิกที่หัวตารางเพื่อสลับการเรียงลำดับ (Ascending ⬆️ / Descending ⬇️ / Default)
   - รองรับทุกคอลัมน์สำคัญ: `บัญชีผู้ใช้` (ตามชื่อภาษาไทย/อังกฤษ), `แผนก`, `สถานะ AD`, `สิทธิ์ระบบลูก (Spokes)`, และ `การเข้าใช้งาน`
   - แสดงไอคอน `ArrowUpDown`, `ArrowUp`, และ `ArrowDown` พร้อมเอฟเฟกต์ Hover และ Tooltip
   - การส่งออก Excel รองรับการเรียงลำดับตามที่ผู้ใช้จัดเรียงไว้ทันที
2. **เปลี่ยนชื่อหัวตาราง:**
   - เปลี่ยนจาก `พนักงาน / บัญชีผู้ใช้` เป็น **`บัญชีผู้ใช้`** กระชับและชัดเจน
3. **ปรับปุ่มจัดการสิทธิ์ในแต่ละบรรทัดเป็นไอคอนล้วน:**
   - นำข้อความ "จัดการสิทธิ์" ออก เหลือเฉพาะไอคอนรูปเฟือง `[⚙️ Settings]` ขนาดพอดี สไตล์โมเดิร์นพร้อม Tooltip ช่วยให้ตารางสะอาดตา ไม่กินพื้นที่แนวนอน

### 2. ผลการตรวจสอบคุณภาพ:
- Frontend TypeScript `npx tsc --noEmit`: ผ่าน 0 errors (100%)

---

## Sprint 19: ปรับปรุงความถูกต้องข้อมูล: แสดงอีเมลเฉพาะผู้ใช้ M365 เท่านั้น และแสดงแผนกเฉพาะที่ดึงได้จาก AD OU เท่านั้น ห้ามใส่ค่าทดแทน (13 ต.ค. 2026)
### 1. นโยบายการแสดงผลข้อมูลที่ถูกต้องตามคำสั่งผู้ใช้:
- **อีเมล (Email):** ผู้ใช้ที่มีอีเมลคือผู้ที่ใช้งาน **Microsoft 365** เท่านั้น หากผู้ใช้ไม่ได้เชื่อมต่อหรือไม่มีสิทธิ์ใน M365 จะไม่แสดงอีเมลโดยเด็ดขาด (`email = null`) ห้ามสังเคราะห์อีเมลสมมติหรือนำอีเมลจาก Spoke อื่นมาใส่
- **แผนก (Department):** ผู้ใช้ที่จะมีแผนกจะต้องเป็นผู้ใช้ใน **Active Directory (AD)** และต้องสามารถดึง **Organizational Unit (OU)** ออกมาได้จริงเท่านั้น หากดึง OU ไม่ได้ หรือเป็นบัญชีเฉพาะระบบ/Spoke ให้แสดงผลเป็นขีด `-` ห้ามใส่ชื่อกลุ่ม pfSense (เช่น OpenVPN Client, Captive Portal), ห้ามใส่ "M365 User", "Firewall Local", "Active Directory", หรือ "ทั่วไป" โดยเด็ดขาด เพราะการใส่ค่าทดแทนทำให้เข้าใจผิด

### 2. รายละเอียดการปรับปรุงโค้ด:
- **`backend/app/api/v1/directory.py`:** เพิ่มฟังก์ชัน `_clean_directory_attributes` ตรวจสอบสิทธิ์ M365 ก่อนคืนค่าอีเมล และกรองค่าแผนกที่ไม่ใช่ AD OU ทิ้ง (คืนค่าเป็น `None`)
- **`backend/app/services/scheduler.py`:** แยกเงื่อนไขการบันทึก `MasterIdentity` ชัดเจน: ฟิลด์ `email` จะรับค่าเฉพาะเมื่อซิงก์จาก M365 เท่านั้น และฟิลด์ `department` จะรับค่าเฉพาะเมื่อซิงก์จาก AD เท่านั้น (ไม่รับค่ากลุ่มจาก pfSense/Spoke อื่น)
- **`backend/app/connectors/pfsense.py`:** กำหนด `email: None` และ `department: None` สำหรับบัญชี pfSense ทั้งหมด
- **`backend/app/connectors/m365_graph.py`:** ตัด fallback `dept = "M365 User"` ออก กำหนด `department: None` เพื่อให้แผนกมาจาก AD OU เท่านั้น
- **`backend/app/connectors/ad_proxy.py`:** กำหนด `email: None` (ให้อีเมลมาจาก M365) และดึง `department` จาก `extract_ou_department` โดยหากไม่พบ OU ให้คืนค่า `None` (ตัด fallback "Active Directory" ออก)
- **`backend/app/initial_data.py`:** เพิ่มกระบวนการ Auto-Cleanup เมื่อเซิร์ฟเวอร์เริ่มทำงาน ล้างอีเมลของผู้ใช้ที่ไม่มีบัญชี M365 และล้างแผนกที่ไม่ได้มาจาก AD OU อัตโนมัติในฐานข้อมูล
- **`ciam-extension.js`:** ปรับโค้ดบน AD Sync Agent ให้ดึง OU จาก `DistinguishedName` และไม่สังเคราะห์อีเมล
- **`frontend/src/app/directory/page.tsx`:** ปรับการแสดงผลคอลัมน์แผนกให้แสดงเฉพาะเมื่อมีค่า OU จริง หากไม่มีให้แสดงขีด `-` สีจาง (นำ Badge "ทั่วไป" ออก)

### 3. ผลการตรวจสอบคุณภาพ:
- Frontend TypeScript `npx tsc --noEmit`: 0 errors (100%)
- Backend pytest: 46/46 passed (100%)

---

## Sprint 18: ตัดปุ่มทางลัดที่ซ้ำซ้อนบน Header และ Dashboard ให้ UI สะอาดตา (12 ต.ค. 2026)
### 1. ลบปุ่มทางลัดที่ไม่จำเป็นตามคำขอผู้ใช้:
- ผู้ใช้ระบุว่าปุ่มทางลัดต่างๆ บนหน้าจอรกเกินไป และสามารถคลิกเข้าสู่เมนูหลักผ่าน Sidebar ด้านซ้ายได้โดยตรง
- **จุดที่นำออก:**
  1. ปุ่ม `[⚙️ ตั้งค่าระบบ]` ใน Header ด้านขวาบน (คงเหลือไว้เฉพาะปุ่ม App Portal, กล่องโปรไฟล์ผู้ใช้ และปุ่ม Sign out)
  2. ปุ่ม `[🔔 Telegram & AD Agent]` บนแถบควบคุมของ Dashboard (สามารถคลิกดูผ่านโปรไฟล์ผู้ใช้ใน Header หรือเข้าเมนูตั้งค่าระบบได้)
  3. ปุ่ม `[👥 ทะเบียนผู้ใช้]` บนแถบควบคุมของ Dashboard (สามารถคลิกเข้าเมนู "สารบบผู้ใช้ (Directory)" บน Sidebar ได้)
- คงเหลือไว้เฉพาะปุ่ม **`[🔄 รีเฟรช]`** สำหรับอัปเดตข้อมูลสรุปของ Dashboard

### 2. ผลการตรวจสอบคุณภาพ:
- Backend pytest: 46/46 passed (100%)
- Frontend TypeScript `npx tsc --noEmit`: 0 errors (100%)

---

## Sprint 17: อัปเดตล่าสุด: ปุ่ม Excel ไอคอนล้วน, ยกเลิกสร้างอีเมลสมมติ (@windowasia.com), จำจำนวนแถวต่อหน้าใน LocalStorage, ปรับสวิตช์ Spoke เป็น On/Off และยุบปุ่มตั้งค่าเชื่อมต่อ (12 ต.ค. 2026)
### 1. ปุ่มดาวน์โหลด Excel เป็น Icon ล้วน (Directory Page):
- นำข้อความ `ดาวน์โหลด Excel` ออก เหลือเฉพาะไอคอนเอกสาร Excel สีเขียว พร้อม Tooltip สวยงามและ Micro-animation ขณะคลิก

### 2. ตรวจสอบที่มาของ Email และยกเลิกการสร้างอีเมลสมมติอัตโนมัติ:
- **สาเหตุที่เคยแสดงอีเมลทั้งที่ไม่มีใน M365:** ในโค้ดเดิม (`ad_proxy.py`, `scheduler.py`, `agent.py`, `initial_data.py`) มี Fallback อัตโนมัติว่าหากบัญชีไม่มีอีเมลแต่เป็นบัญชีองค์กร จะสังเคราะห์อีเมลปลอมขึ้นมาเป็น `{username}@windowasia.com` (เช่น `vip2@windowasia.com`)
- **การแก้ไข:** ลบตรรกะการสังเคราะห์อีเมลสมมติออกทั้งหมด หากผู้ใช้ไม่มีบัญชีใน M365 และไม่มี Attribute `mail` ใน Active Directory ฟิลด์ Email จะมีค่าเป็น `null` และหน้าเว็บจะไม่แสดงอีเมลหลอกตา

### 3. จำค่า Dropdown จำนวนแถวต่อหน้า (Pagination Limit) ตลอดการใช้งาน:
- บันทึกค่าที่เลือก (10, 25, 50, 100) ลง `localStorage` (`ciam_directory_page_size`)
- เมื่อเปิดหน้า Directory ครั้งถัดไประบบจะโหลดค่าเดิมกลับมาแสดงผลทันทีโดยไม่ต้องเลือกใหม่

### 4. ที่มาของแผนก "Engineering" และบัญชี Lifecycle Test:
- บัญชี `Lifecycle Test efa45e` (`test.user.efa45e`) ที่มีแผนก `Engineering` เกิดขึ้นจากการรัน Automated API Tests (`test_api_flow.py`) ทดสอบวงจร Provisioning & Deprovisioning บัญชี
- ได้เพิ่มการทำ Cleanup ล้างบัญชีทดสอบ `test.user.%` อัตโนมัติหลังรัน Test เสร็จสิ้นทุกครั้ง

### 5. ปรับปุ่ม Spoke เป็นสวิตช์เปิด/ปิด (ON / OFF):
- เปลี่ยนจากปุ่ม Badge ข้อความ Active/Disabled มาเป็น **Toggle Switch On/Off สไตล์โมเดิร์น**:
  - เมื่อเปิดใช้งาน (ON): พื้นหลังสีเขียว `bg-emerald-600` สวิตช์เลื่อนไปทางขวา แสดงข้อความ `ON`
  - เมื่อปิดใช้งาน (OFF): พื้นหลังสีเทา `bg-slate-300` สวิตช์เลื่อนไปทางซ้าย แสดงข้อความ `OFF`
- ปรับสวิตช์ใน Edit Modal ให้เป็น On/Off ในรูปแบบเดียวกัน

### 6. ยุบปุ่ม SSO และ M2M Key รวมเป็นปุ่มเดียว:
- ยุบปุ่ม `[🔒 SSO]` และ `[🔑 M2M Key]` ที่เปิดหน้าต่างเดียวกัน รวมเป็นปุ่มเดียวชื่อ **`[⚙️ ตั้งค่าเชื่อมต่อ]`**

### 7. การตรวจสอบคุณภาพ:
- Backend pytest: 46/46 passed (100%)
- Frontend TypeScript `npx tsc --noEmit`: 0 errors (100%)

---

## Sprint 16: อัปเดตก่อนหน้า: แก้ไขปัญหาบันทึกความถี่แจ้งเตือน Telegram (interval_hours) เด้งกลับเป็น 4 ชั่วโมง (12 ต.ค. 2026)
### ปัญหาที่พบและสาเหตุ (Root Cause):
- เมื่อผู้ใช้เลือกความถี่ในการตรวจเช็คเป็น **"ทุกๆ 1 ชั่วโมง"** แล้วกด **"บันทึกการตั้งค่า Telegram"** ค่าจะเด้งกลับมาเป็น **4 ชั่วโมง** เสมอ
- **สาเหตุ:** คอลัมน์ `setting_value` ในโมเดล `SystemSetting` (`setting.py`) ถูกประกาศเป็น `Column(JSON)` แบบพื้นฐาน ซึ่ง SQLAlchemy ไม่ตรวจจับการแก้ไขค่าใน Dictionary ภายใน (In-place mutation) ทำให้เมื่อรันคำสั่ง `setting.setting_value = current_val` โดยที่เป็นออบเจกต์เดิม SQLAlchemy ถือว่าไม่มีฟิลด์ใดเปลี่ยนแปลง (No-op) และไม่ส่งคำสั่ง `UPDATE system_settings` ไปยัง PostgreSQL เลย เมื่อตอบกลับหรือรีโหลด Session ใหม่ ค่าจึงดึงของเดิม (4 ชั่วโมง) กลับมาแสดง
- **การแก้ไข:**
  1. ใน `backend/app/models/setting.py`: ปรับ `setting_value` เป็น `Column(MutableDict.as_mutable(JSON))` เพื่อให้ SQLAlchemy ตรวจจับการเปลี่ยนแปลงของ Dictionary ใน JSON โดยอัตโนมัติ
  2. ใน `telegram_service.py` และ `scheduler.py`: คัดลอก Dict ด้วย `dict(...)` พร้อมเรียกใช้ `flag_modified(setting, "setting_value")` และ `db.refresh(setting)` เพื่อรับประกันว่าการ `UPDATE` จะถูกบันทึกลงฐานข้อมูล 100%
  3. ใน `frontend/src/app/settings/page.tsx`: ปรับการผูกค่าเป็น `telegramConfig.interval_hours ?? 4` และเพิ่มตัวเลือกความถี่ `ทุกๆ 8 ชั่วโมง` ให้ครบถ้วน
- **การตรวจสอบคุณภาพ:**
  - เพิ่ม Unit Test ใน `test_api_flow.py` ยืนยันการอัปเดต `interval_hours = 1` และตรวจสอบการเรียก `GET` ซ้ำ ผ่าน 100%
  - Frontend TypeScript `npx tsc --noEmit`: 0 errors

---

## Sprint 15: อัปเดตก่อนหน้า: แก้ไข Modal เลื่อนหลุดขอบบน, เพิ่มเมนู System Settings ใน Sidebar & Header, แก้ไข Error ซิงก์ทุกระบบทันที (now_utc), และเพิ่มปุ่ม Enable/Disable Spoke (12 ต.ค. 2026)
### 1. แก้ไขปัญหากดชื่อผู้ดูแลระบบแล้วหน้าจอหลุดหายไปด้านบน (Admin Profile Modal Cutoff):
- **สาเหตุ:** การใช้ CSS Flexbox `items-center` ร่วมกับ `overflow-y-auto` บน Container modal ที่มีความสูงมากกว่า Viewport ทำให้หัว Modal ถูกดันขึ้นไปในพื้นที่พิกัดติดลบ ไม่สามารถเลื่อนกลับลงมาได้
- **การแก้ไข:** ใน `AdminProfileModal.tsx` ปรับโครงสร้าง Wrapper เป็น `items-start sm:items-center py-6 sm:py-10 max-h-[90vh] flex flex-col my-auto` พร้อมยึด Header แบบ `shrink-0` ทำให้หัวข้อและปุ่ม `[X]` ปิดหน้าต่างแสดงผลอยู่บนหน้าจอตลอดเวลา เลื่อนเนื้อหาภายในได้อย่างราบรื่น
- เพิ่มแบนเนอร์ในแท็บ 2 สำหรับเข้าถึงหน้า **"ตั้งค่าระบบส่วนกลาง (System Settings)"** ได้โดยตรง

### 2. เพิ่มลิงก์และเมนูเข้าสู่หน้า System Settings (/settings):
- เพิ่มเมนู `ตั้งค่าระบบ (System Settings)` ใน `Sidebar.tsx` ของแผงควบคุมหลัก
- เพิ่มปุ่มลัด `ตั้งค่าระบบ` บน Header มุมขวาบนติดกับชื่อผู้ดูแลระบบ
- หน้านี้เป็นศูนย์กลางกำหนดค่าระดับ System-Wide ได้แก่: Telegram Bot Token, Group Chat ID, เวลา Scheduled Sync ประจำวัน, และ Live Health Status

### 3. แก้ไขข้อผิดพลาด "การซิงก์ทุกระบบล้มเหลว [500 Internal Server Error]":
- **สาเหตุ:** ใน `backend/app/services/scheduler.py` ฟังก์ชัน `execute_sync_all` มีการเรียกใช้ตัวแปร `now_utc` แต่ไม่ได้ประกาศไว้ในบรรทัดเริ่มต้น ส่งผลให้เกิด `NameError: name 'now_utc' is not defined`
- **การแก้ไข:** ประกาศ `now_utc = datetime.now(timezone.utc)` ตั้งแต่บรรทัดแรกของ `execute_sync_all`

### 4. เพิ่มปุ่ม Enable / Disable Spoke และตัดการใช้งาน Spoke ที่ถูกปิดออกจากทุกส่วนของ CIAM:
- **บนหน้า Applications (`/applications`):**
  - เพิ่มปุ่มสลับสถานะ `Active / Disabled` บนการ์ดระบบแต่ละตัว พร้อมมีไฟบอกสถานะ
  - แสดงการ์ดระบบที่ปิดใช้งานในลักษณะจางลง (Dimmed & Opacity 75%)
  - เพิ่มสวิตช์สถานะ Spoke ในหน้าต่างแก้ไขระบบ (Edit Modal)
- **การคัดกรอง Spoke ที่ถูกปิด (Disabled) ออกจากระบบ:**
  - **Directory (`/directory`):** ใน `list_users` และ `get_user_detail` กรองเฉพาะ `ConnectedApplication.is_active == True` ทำให้ระบบที่ปิดใช้งานไม่ปรากฏใน Badge สถานะหรือรายละเอียดบัญชี
  - **Dashboard & KPIs (`/dashboard`):** กรองนับเฉพาะระบบที่ `is_active == True` ไม่นำ Spoke ที่ปิดมานับรวม
  - **Ghost Account Reconciliation:** กรองไม่นำ Spoke ที่ปิดมาตรวจสอบ Ghost Accounts
  - **Offboarding Preview & Execution (`/offboarding`):** กรองไม่นำ Spoke ที่ปิดมาระงับบัญชี
  - **Automated Sync (`execute_sync_all`):** ข้ามการซิงก์ Spoke ที่ปิดโดยอัตโนมัติ

### 5. การตรวจสอบคุณภาพ:
- Backend pytest: 46/46 passed (100%)
- Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)

---

## Sprint 14: อัปเดตก่อนหน้า: สกัดแผนกจาก AD OU (Users WA), ดึง Telegram ID จาก AD Pager พร้อมปุ่มทดสอบ DM และหน้าตั้งค่าระบบ (/settings) (12 ต.ค. 2026)
### 1. สกัดแผนกอิงตามโครงสร้าง OU (Users WA) ใน Active Directory:
- **เหตุผล:** ผู้ใช้ทั้งหมดอยู่ภายใต้ `OU=Users WA,DC=wa,DC=net` ซึ่งแบ่งแผนกเป็น OU ย่อย (เช่น `Purchasing`, `IT`, `HR`, `Account`, `Sales`, `Production`)
- **การแก้ไข:** ใน `ad_proxy.py` เพิ่มฟังก์ชัน `extract_ou_department(dn)` สกัดชื่อแผนกจาก DistinguishedName โดยอัตโนมัติ ทั้งในโหมดผ่าน AD Sync Agent (`_normalize_ad_users`) และ LDAP Direct Connection (`_query_ldap_users`) พร้อมอัปเดตลงตาราง `MasterIdentity.department` ใน `scheduler.py`

### 2. นำฟิลด์ Telegram ID จาก AD Pager มาใช้งานแทน `• N/A` พร้อมปุ่มทดสอบ DM:
- **ฟิลด์ Pager ใน AD Properties:** ผู้ใช้บน Active Directory มีหมายเลข Telegram ID บันทึกอยู่ที่ `Telephones > Pager` (เช่น `7656347433`)
- **การเชื่อมโยงระบบ:** ดึง `pager` แมปเข้าสู่ `telegram_id` ใน `MasterIdentity` และแสดงในหน้า `/directory` ด้วยไอคอน Telegram (เครื่องบินกระดาษ)
- **ปุ่มทดสอบ DM:** ปรับแต่ง UI ให้สะอาดตา โดยเปลี่ยนจากปุ่มข้อความเหลี่ยม `ทดสอบ DM` มาเป็นปุ่มลูกศรไอคอน Telegram ด้านหน้าหมายเลข Telegram ID โดยตรง (กดที่ลูกศรเพื่อยิง DM ทดสอบได้ทันที) พร้อมมี Loading Spinner และ Tooltip บอกวิธีใช้งานชัดเจน

### 3. หน้าตั้งค่าระบบแบบรวมศูนย์ (/settings) และเมนูใหม่บน Navbar:
- **หน้าเว็บใหม่:** `frontend/src/app/settings/page.tsx` รวบรวมการตั้งค่าสำคัญทั้งหมด:
  - **Telegram Bot & Group Alerts:** ตั้งค่า Bot Token (แสดง/ซ่อนได้), Group Chat ID, เวลาเริ่มแจ้งเตือน, ความถี่ (Interval 1-24 ชม.), และปุ่ม "ทดสอบส่ง Alert เข้ากลุ่ม Telegram"
  - **Automated Directory Sync Schedule:** ตั้งเวลาซิงก์ประจำวัน (เช่น 04:00 น.), สวิตช์เปิด/ปิด, ข้อมูล Next Run, และปุ่ม "ซิงก์ระบบทั้งหมดทันที"
  - **Active Directory Integration Specs:** อธิบายการสกัดแผนกจาก OU และ Telegram ID จาก Pager
  - **Live System Health Snapshot:** มอนิเตอร์สถานะฐานข้อมูล PostgreSQL, AD Gateway Port 3100, และระบบลูกที่ออนไลน์
- **การตรวจสอบคุณภาพ:**
  - Backend pytest: 46/46 passed (100%)
  - Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)

---

## Sprint 13: อัปเดตก่อนหน้า: แก้ไข 500 Internal Server Error จาก Duplicate Username และปฏิบัติตามกฎ Sandbox อย่างเคร่งครัด (12 ต.ค. 2026)
### 1. ปัญหาและสาเหตุที่พบ (Root Cause of 500 Error):
- Terminal ฝั่ง AD Sync Agent ดึงบัญชี HO สำเร็จสมบูรณ์: `Total 41 accounts (1 FreeRADIUS + 40 Local)` และส่ง `SUCCESS 200` กลับมายัง Central IAM
- แต่หน้าเว็บขึ้นแจ้งเตือน `ไม่สามารถดึงข้อมูลบัญชีจาก PFSENSE_HO: API Error [500]: Internal Server Error`
- **สาเหตุ:** ในฟังก์ชัน `persist_spoke_inventory` (`scheduler.py`) หากมีชื่อผู้ใช้ซ้ำกันระหว่างกลุ่ม FreeRADIUS VPN และ Local Users (หรือมีรายการชื่อผู้ใช้ซ้ำกันในชุดข้อมูลที่ดึงมา) ระบบจะพยายามสร้างแถวใน `app_account_mappings` ซ้ำซ้อน ซึ่งละเมิด Unique Constraint (`uq_app_username_per_app`) ในฐานข้อมูล ส่งผลให้เกิดข้อผิดพลาด 500
- **การแก้ไข:** เพิ่มการ Deduplicate รายชื่อบัญชีตาม `username.lower()` ก่อนนำเข้าลูปประมวลผลใน `persist_spoke_inventory` เพื่อป้องกันการเกิด Unique Violation อย่างเด็ดขาด

### 2. กฎเหล็กการไม่แตะต้องไฟล์นอก Sandbox (Strict Sandbox Boundary Protocol):
- **ห้ามแก้ไขไฟล์ใดๆ นอกโฟลเดอร์ Workspace (`D:\Python\Central-IAM`) โดยเด็ดขาด** (เช่น `D:\Python\ADSyncAgent` หรือที่อื่นๆ) เว้นแต่ผู้ใช้จะอนุญาตก่อน
- ทุกครั้งที่ต้องมีการอัปเดตโค้ดสำหรับรันบน Server / Spoke Agent ภายนอก **ต้องแสดงโค้ดออกมาในบทสนทนาให้ผู้ใช้ตรวจสอบและ Copy ไปวางเองเท่านั้น**

---

## Sprint 12: อัปเดตก่อนหน้า: แก้ปัญหาดูข้อมูลสด pfSense HO ไม่แสดง (AD Sync Agent Gateway Routing & Endpoints) (12 ต.ค. 2026)
### ปัญหาที่พบและการวิเคราะห์รากเหง้า (Root Cause):
- เมื่อกดดูข้อมูลสดของ pfSense FAC ดึงได้ปกติ 168 บัญชี (77 FreeRADIUS + 91 Local) แต่ pfSense HO ขึ้นแจ้งเตือน:
  `ระบบปลายทางออฟไลน์ (Offline) - pfSense ไม่ตอบรับ (http://172.18.0.1:3100/api/v1/pfsense/ho)`
- Log ฝั่ง AD Sync Agent Terminal (Port 3100): บันทึก `ERROR 404 | User: N/A | App: WA_PROD | IP: WA_PROD` 3 ครั้งติดกัน
- **สาเหตุ:**
  1. เนื่องจาก Central IAM อยู่บน Cloud VPS (`157.173.219.153`) ไม่สามารถคุยตรงกับ LAN IP ภายใน (`192.168.10.1`) ได้ ต้องวิ่งผ่าน SSH Tunnel Gateway Port 3100 (`http://172.18.0.1:3100/api/v1/pfsense/ho`)
  2. ตัว Agent บน Windows Server ยังไม่มี Endpoint `/api/v1/pfsense/ho/users` และ `/api/v1/pfsense/ho` หรือยังไม่ได้เพิ่ม Route ให้ชี้ไปยัง `192.168.10.1` (Port 8088/443) จึงส่งผลให้ Express ตอบกลับ 404
  3. ใน `pfsense.py` ฟังก์ชัน `health_check()` และ `sync_inventory()` เดิมยังไม่ได้ probe รวม endpoint `/users` สำหรับทดสอบผ่าน Gateway Proxy

### รายละเอียดการแก้ไข:
1. **Connector Layer (`pfsense.py` & `factory.py`):**
   - กำหนด default Base URL ของ `pfsense_ho` ให้วิ่งผ่าน Gateway `http://172.18.0.1:3100/api/v1/pfsense/ho` ให้ตรงกับสถาปัตยกรรมเดียวกับ FAC
   - ปรับปรุง `health_check()` และ `sync_inventory()` ให้ probe Candidate Endpoints ครอบคลุมทั้ง `/users`, `/health`, และ Native pfSense Endpoints
2. **AD Sync Agent Gateway Extension (`pfsense-extension.js`):**
   - ปรับปรุง Extension สำหรับรันบน AD Sync Agent Server ให้รองรับทั้งไซต์ `FAC` (`https://192.168.12.1:8088`) และ `HO` (`https://192.168.10.1:8088`)
   - รองรับ Auto-Fallback Port (8088 <-> 443) อัตโนมัติในกรณีที่ pfSense แต่ละไซต์ตั้งพอร์ต WebConfigurator ต่างกัน
   - เพิ่ม Route `/api/v1/pfsense/ho/users` และ `/api/v1/pfsense/ho` พร้อมทั้ง Endpoint Health และ 1-Click Offboarding
3. **ผลการทดสอบความถูกต้อง:**
   - Backend Pytest: 46/46 passed (100%)
   - Frontend TypeScript: `npx tsc --noEmit` 0 errors (100%)

---

## Sprint 11: อัปเดตก่อนหน้า: เพิ่ม Spoke Connector สำหรับ pfSense HO (Head Office: 192.168.10.1) (12 ต.ค. 2026)
### รายละเอียดฟีเจอร์การเชื่อมต่อ pfSense HO:
1. **Spoke Registration & Seed Data (`initial_data.py`):**
   - เพิ่มระบบเชื่อมต่อ `pfsense_ho` (pfSense Firewall & VPN - Head Office) เข้าสู่ตาราง `connected_applications`
   - รหัสแอป: `pfsense_ho`, ชื่อ: `pfSense Firewall & VPN (Head Office)`
   - ประเภท Connector: `PFSENSE`, Network Policy: `VPN_ONLY`
   - Base URL: `https://192.168.10.1` (REST API สำนักงานใหญ่)
   - ปรับการ Auto-heal ให้เจาะจงเฉพาะ IP เก่า `192.168.12.11` ไม่ให้กระทบ `192.168.10.1` ของ pfSense HO
2. **Connector Layer & Multi-Endpoint Resilience (`pfsense.py` & `factory.py`):**
   - รองรับการเชื่อมต่อตรงผ่าน HTTPS ด้วย `verify=False` (สำหรับ Self-signed certs บน pfSense WebGUI)
   - ปรับ `health_check()` ให้รองรับทั้ง Endpoint Proxy (`/health`) และ Native pfSense-pkg-RESTAPI (`/api/v1/system/status`, `/api/v1/status`, `/api/v1/user`)
   - ปรับ `sync_inventory()` ให้นำข้อมูลรายชื่อทั้งรูปแบบ CIAM (`accounts`) และ Native pfSense (`data`) มา Normalize เป็นโครงสร้างเดียวกัน
   - ปรับ `set_account_status()` ให้รองรับทั้ง Endpoint `/users/{username}/status` และ `PATCH /api/v1/user` (`{"username": username, "disabled": bool}`)
   - เพิ่ม Fast-fail เมื่อตรวจพบ `ConnectError` หรือ `ConnectTimeout` เพื่อไม่ให้วนซ้ำรอ Timeout เสียเวลา
3. **ผลการทดสอบความถูกต้อง (Type Integrity & Test Suite):**
   - Backend Pytest: ผ่าน 46/46 (100% รวม unit tests `tests/test_pfsense_connector.py`)
   - Frontend TypeScript: ผ่าน `tsc --noEmit` ได้ 0 errors (100%)

---

## Sprint 10: สรุปแผนงานและแนวทางการพัฒนา: นำ Spoke Integration Framework ไปใช้กับระบบ On-Premise PHP + MySQL (12 ต.ค. 2026)
### บริบทและโจทย์งาน:
- เตรียมให้ทีม Dev ภายในนำ Framework การซิงก์และเชื่อมต่อกับ Central IAM ([SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) v2.7.0) ไปใช้กับแอปพลิเคชันภายใน
- สภาพแวดล้อมระบบของทีม Dev: พัฒนาแบบ **Manual (Native/Custom PHP)** ติดตั้งบนเซิร์ฟเวอร์ **On-Premise** ภายในองค์กร และเชื่อมต่อกับ **MySQL**

### ข้อสรุปและการวิเคราะห์ทางเทคนิค:
1. **ความเข้ากันได้ของ Framework (100% Compatible):**
   - สเปกกลางของ CIAM เป็น Technology-Agnostic อิงตามมาตรฐานสากล (REST API, JSON, OIDC/OAuth 2.0 with PKCE) PHP ดั้งเดิมรองรับครบถ้วนผ่าน `cURL`, `json_encode()` / `json_decode()`, และ `PDO`/`mysqli`
   - **โหมดการเชื่อมต่อที่แนะนำสำหรับ On-Premise:**
     - **Mode C (Outbound Agent Mode):** เหมาะที่สุดสำหรับระบบ On-Premise ที่ไม่มี Public Inbound IP โดยให้เขียนสคริปต์ PHP เล็กๆ (เช่น `ciam_agent.php`) ตั้งรันผ่าน Windows Task Scheduler หรือ Linux Cronjob ทุก 1–2 นาที ยิง Outbound HTTPS 443 ไปที่ `POST /api/v1/agent/heartbeat` เพื่อส่งรายชื่อและดึงคำสั่งระงับสิทธิ์ (1-Click Offboard)
     - **Mode B (SSO-Only Client Mode):** หากระบบต้องการแค่ฟังก์ชันล็อกอินผ่าน CIAM (ไม่ต้องการ Offboard อัตโนมัติ) สามารถทำแค่หน้า OIDC PKCE Login & Callback
2. **การนำ Git มาใช้ในกระบวนการพัฒนา (Git Workflow สำหรับ On-Premise):**
   - ช่วยเปลี่ยนผ่านจากการแก้โค้ดสดบนเซิร์ฟเวอร์ (Direct FTP/Live Edit) สู่ Version Control ตามมาตรฐาน ISO 27001
   - Dev พัฒนาบนเครื่องตนเอง `git commit` / `git push` และบน On-Premise Server ใช้คำสั่ง `git pull` เพื่ออัปเดตโค้ดอย่างปลอดภัย
   - **กฎเหล็กด้านความปลอดภัย:** รหัสผ่าน MySQL, CIAM Client Secret, และ API Key ต้องแยกเก็บใน `.env` หรือ `config.php` และใส่ใน `.gitignore` เสมอ ห้าม commit ขึ้น Git
3. **การปรับแต่งฐานข้อมูล MySQL เดิม:**
   - ตาราง `users` เดิมเพิ่มเพียง 3 คอลัมน์: `ciam_sub` VARCHAR(100), `auth_provider` VARCHAR(20) DEFAULT 'local', `is_active` TINYINT(1) DEFAULT 1
   - เพิ่มตาราง `system_settings` เก็บค่า Config (Client ID, Client Secret, CIAM Base URL)
4. **ความต่อเนื่องของระบบงาน (Break-Glass Fallback):**
   - ต้องมีทางเลือกให้ Admin สามารถล็อกอินผ่านรหัสผ่าน Local Admin เดิมของ MySQL ได้ เผื่อกรณีเครือข่ายอินเทอร์เน็ตโรงงานขัดข้อง

---

## Sprint 9: อัปเดตก่อนหน้า: ถอดปุ่มซิงก์ซ้ำซ้อนออกจากหน้าทะเบียนผู้ใช้ (Single Responsibility) (11 ต.ค. 2026)
### รายละเอียดการปรับปรุง:
1. **หน้าทะเบียนผู้ใช้ (`frontend/src/app/directory/page.tsx`):**
   - ถอดปุ่ม `🔄 ซิงก์ข้อมูล` ใน Toolbar ออกตามหลักสถาปัตยกรรม Single Responsibility
   - หน้าทะเบียนผู้ใช้ทำหน้าที่ดูและจัดการสิทธิ์ ส่วนการจัดการซิงก์ Spoke เป็นหน้าที่ของหน้าระบบลูก (`/applications`) และตัวตั้งเวลาอัตโนมัติประจำวัน (04:00 AM) ไม่ปะปนกัน
2. **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 8: อัปเดตก่อนหน้า: บันทึกบัญชีสดเข้าฐานข้อมูลอัตโนมัติ (Auto-persist) (11 ต.ค. 2026)
### สาเหตุที่หน้าทะเบียนผู้ใช้ยังขึ้น 90 คน:
- Modal "รายชื่อผู้ใช้สด" ดึงข้อมูลจาก M2M Endpoint สด (`168 บัญชี`) แต่เดิมไม่ได้บันทึกลงฐานข้อมูล `app_account_mappings` โดยอัตโนมัติ
- หน้าทะเบียนผู้ใช้ (`/directory`) อ่านข้อมูลจากฐานข้อมูลของ Central IAM ซึ่งเดิมค้างอยู่ที่รอบการซิงก์ครั้งแรก (90 บัญชี Local)
### รายละเอียดการแก้ไข:
1. **บันทึกบัญชีสดลงฐานข้อมูลอัตโนมัติ (`backend/app/api/v1/applications.py`):**
   - เมื่อเปิดดู Modal บัญชีสด (`get_application_inventory`) ระบบจะเรียก `_persist_inventory()` เพื่อบันทึกบัญชีสดทั้ง 168 บัญชีเข้า `app_account_mappings` และ `MasterIdentity` ทันที
   - กักกันบัญชี Shop (`is_shop_acc`) ให้ `is_active_in_ad = False` และ `is_corp = False` เพื่อไม่ให้ถูกเข้าใจผิดว่าเป็นบัญชีองค์กรใน AD
2. **ความสอดคล้องของ Scheduler ตี 4 (`backend/app/services/scheduler.py`):**
   - รวมศูนย์การบันทึกบัญชีของรอบอัตโนมัติประจำวัน (04:00 AM) ให้ใช้ฟังก์ชัน `persist_spoke_inventory()` ตัวเดียวกัน เพื่อรับประกันว่าบัญชีจากทุก Spoke จะถูกอัปเดตลงทะเบียนผู้ใช้ครบถ้วนโดยไม่มีข้อผิดพลาด
3. **ปรับ Modal ให้สะอาดตา (`frontend/src/app/applications/page.tsx`):**
   - ถอดปุ่มซิงก์แมนนวลใน Modal ออก เพื่อไม่ให้สับสนว่าผู้ใช้จำเป็นต้องคอยกดทุกครั้ง (ระบบซิงก์อัตโนมัติอยู่แล้วทั้งรอบตี 4 และรอบที่กดเปิดดูรายชื่อสด)
4. **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 7: อัปเดตก่อนหน้า: ปรับปรุงการแยกแยะบัญชี pfSense Local / FreeRADIUS และตัดปุ่ม Excel ซ้ำซ้อน (11 ต.ค. 2026)
### รายละเอียดการปรับปรุง:
1. **หน้าทะเบียนผู้ใช้ (`frontend/src/app/directory/page.tsx`):**
   - ตัดปุ่ม "ดาวน์โหลด Excel" ใน Header ด้านบนออก เหลือเฉพาะปุ่มไอคอน Excel ถัดจากปุ่มค้นหาใน Toolbar
   - ปรับการคำนวณ `ACTIVE ใน AD` และการแสดงผลคอลัมน์ "สถานะ AD" สำหรับบัญชีสาขา (WA Shop) ให้แสดงเป็น `-` (ไม่ใช่จุดเขียว Active ใน AD)
2. **ระบบการจำแนกประเภทบัญชี (`backend/app/api/v1/directory.py` & `initial_data.py`):**
   - แยกบัญชีสาขา pfSense Local / FreeRADIUS (`wa-shop...`, `ws-...`) ออกจากบัญชี AD องค์กรอย่างเด็ดขาด
   - ป้องกันการสร้างสิทธิ์ `DIRECT • AD` ให้กับบัญชี Shop โดยไม่ตั้งใจ
3. **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 6: อัปเดตก่อนหน้า: เพิ่ม Spoke Connector สำหรับ pfSense FAC (Firewall, FreeRADIUS VPN & Captive Portal) (11 ต.ค. 2026)
### รายละเอียดฟีเจอร์การเชื่อมต่อ pfSense FAC:
1. **PfSenseConnector Class (`backend/app/connectors/pfsense.py`):**
   - พัฒนา Connector เฉพาะทางสำหรับ pfSense สื่อสารผ่าน AD Sync Agent Security Proxy (`http://172.18.0.1:3100/api/v1/pfsense/fac`)
   - รองรับ `health_check()` ตรวจสอบสถานะ Online และ Latency ของ pfSense
   - รองรับ `sync_inventory()` กวาดบัญชี FreeRADIUS VPN และ Local Users ขึ้นมาแสดงบน CIAM
   - รองรับ `set_account_status()` และ `deprovision()` ส่งคำสั่ง 1-Click Offboarding สั่งระงับสิทธิ์ VPN และตัดเซสชัน Captive Portal ทันที
2. **Connector Factory & Initial Data (`factory.py` & `initial_data.py`):**
   - ลงทะเบียนประเภท `PFSENSE` ใน Connector Factory
   - เพิ่ม `pfsense_fac` ในรายการ Spoke เริ่มต้น:
     - `app_code`: `pfsense_fac`
     - `app_name`: `pfSense Firewall & VPN (Factory)`
     - `connector_type`: `PFSENSE`
     - `base_url`: `http://172.18.0.1:3100/api/v1/pfsense/fac`
     - `network_policy`: `VPN_ONLY`
- **ผลการทดสอบ:** Backend Pytest ผ่าน 43/43 (100%), Frontend TypeScript `tsc --noEmit` ผ่าน 0 errors (100%)

---

## Sprint 5: อัปเดตก่อนหน้า: เพิ่มปุ่มและฟังก์ชันดาวน์โหลดทะเบียนผู้ใช้เป็น Excel (.xlsx) พร้อมไอคอน Excel (/directory) (10 ต.ค. 2026)
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

## Sprint 4: อัปเดตก่อนหน้า: Data Analytics & Spoke Accounts Breakdown & IAM Operational KPIs (/page.tsx, /applications) (10 ต.ค. 2026)
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

## Sprint 3: อัปเดตก่อนหน้า: ปรับปรุงหน้าแสดงทะเบียนผู้ใช้ (/directory), Header กะทัดรัด Sticky Freeze, และแดชบอร์ดกราฟวิเคราะห์ (/page.tsx) (10 ต.ค. 2026)
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

## Sprint 2: อัปเดตก่อนหน้า (10 ต.ค. 2026): แก้ไขปัญหา QOL Account ขึ้น AD Disable, Wimonpan.P/Ronnakorn.P ถูก Auto-Disable และถอด Rogue Autonomous Loop ออกถาวร
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

## Sprint 1: อัปเดตก่อนหน้า (9 ต.ค. 2026): แก้ไขปัญหา AD Inactive, Ghost Account False Positives และ Pinyada.S
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

> **ปรับปรุงล่าสุด:** 15 ตุลาคม 2026 (Local Time: ~20:45 ICT)  
> **สถานะภาพรวม:** Production Ready 100% บน Git Branch `main` (ทุกการเปลี่ยนแปลงได้ผ่านการทดสอบ 100% และ Push สู่ `origin/main` ที่ Commit `2e73e5e` เรียบร้อยแล้ว)

### 4.1 สถานะระบบที่ตรวจสอบและส่งมอบแล้ว (Verified & Production Ready)
* **Git Commits ล่าสุด (10 Commits ล่าสุดบน `origin/main`):**
  - `f02e978` — `fix(ai): extract specific username queries in AI Copilot and prioritize active AD users in ciam_list_users` (Sprint 45)
  - `8f5d84a` — `fix(directory): unify Duanghathai.P and Duanghatai.P identity and support phonetic search` (Sprint 44)
  - `3f7627b` — `docs(memory): document Sprints 41-43 and spec v2.8.0 synchronization` (Sprint 43)
  - `e913ed5` — `fix(spec): sync Spoke Specification v2.8.0 across backend and frontend download button` (Sprint 43)
  - `fb7b817` — `style(portal): display unavailable and vpn-locked app cards in muted gray` (Sprint 42)
  - `88c7b7e` — `fix(ai): enforce zero-hallucination policy and align internal mcp tool parameters` (Sprint 41)
  - `fb3f046` — `fix(copilot): enforce Thai response, accelerate latency with Flash models, and sync active model` (Sprint 40)
  - `e4551a5` — `feat(ai): integrate dynamic Gemini ListModels auto-discovery and smart error diagnostics` (Sprint 40)
  - `09a0a56` — `feat(ai): support gemini-2.0-flash with resilient multi-version fallbacks and quick model selectors` (Sprint 40)
  - `baba904` — `fix(deploy): add mcp>=2.3.0 to requirements.txt and add api rewrites to next.config.ts` (Sprint 40)

* **ผลการตรวจสอบคุณภาพและความถูกต้อง (Test & Type Integrity):**
  - **Backend Test Suite:** รัน `pytest` ผ่านครบถ้วน **68/68 tests (100% Passed)**
  - **Frontend Type Check:** รัน `npx tsc --noEmit` ผ่านสมบูรณ์ **0 TypeScript Errors**
  - **Git Working Tree:** สะอาด (Working tree clean, synced with `origin/main` at commit `f02e978`)

* **สรุปฟังก์ชันและสถาปัตยกรรมหลักที่ส่งมอบแล้วในรอบล่าสุด (Sprints 40 - 45):**
  1. **AI Copilot Specific Username Search & Active AD Priority Ranking (Sprint 45):** เพิ่ม `extract_user_search_term` ใน `ai_service.py` เพื่อสกัดชื่อบัญชี (`Chaiwat.N`, อีเมล, ชื่อพนักงาน) ส่งเข้า `ciam_list_users(search=...)` โดยตรง และจัดเรียงผู้ใช้ที่ Active ใน AD ขึ้นก่อนบัญชีรหัสสาขา (`01-WS_...`) เสมอ พร้อมแก้ไข `is_ad_account` ใน `mcp/server.py`
  2. **Phonetic Identity Unification (`Duanghathai.P` <-> `Duanghatai.P`) & Directory Search (Sprint 44):** รวมตัวตนของคุณดวงหทัย ผาสุข บน Production และเพิ่มระบบจับคู่ตัวสะกดเทียบเสียง `thai` $\leftrightarrow$ `tai` ใน `scheduler.py`, `directory.py`, `initial_data.py`, และ `mcp/server.py` พร้อมจัดทำบทความวิชาการและภาพประกอบสถาปัตยกรรมสำหรับโพสต์ Facebook ใน `docs/facebook_article/FACEBOOK_POST_CIAM.md`
  3. **Spoke Spec v2.8.0 Synchronized across Backend & Frontend (Sprint 43):** ซิงก์ไฟล์ `SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md` v2.8.0 เข้าสู่โฟลเดอร์ `backend/` และอัปเดตปุ่มดาวน์โหลดบนหน้า `/applications` ให้แสดงเวอร์ชัน v2.8.0
  4. **SSO Portal Muted Gray UI for Unavailable Apps (Sprint 42):** ปรับโทนสีการ์ดแอปพลิเคชันที่ยังไม่พร้อมใช้งานหรือต้องต่อ VPN (เช่น MTPulse เมื่ออยู่นอกวงแลน) เป็นสีเทาหม่น (`grayscale`) แยกความแตกต่างจากระบบที่พร้อมใช้งานอย่างชัดเจน
  5. **AI Factual Grounding & Zero-Hallucination Policy (Sprint 41):** บังคับให้ AI Copilot ยึดตัวเลขจริงจากฐานข้อมูล 100% ห้ามเออออตามตัวเลขที่ผู้ใช้ถามนำ และปรับพารามิเตอร์ Tool Calling ให้ตรงกับ `mcp/server.py` ทุกฟังก์ชัน
  6. **Central IAM In-House AI Copilot & Remote MCP Server (Sprint 40):** พัฒนา MCP Server (8 Tools) รองรับ Remote SSE Transport (`/mcp/sse`) และสร้าง Floating AI Copilot Widget พร้อมหน้าตั้งค่า Provider (Gemini, OpenAI, Anthropic, Ollama)

---

### 4.2 แผนงานและข้อสังเกตสำหรับการปรับปรุงในรอบถัดไป (Next Iteration Roadmap)
เมื่อกลับมาทำงานต่อในรอบถัดไป ให้ดำเนินการตามลำดับความสำคัญดังต่อไปนี้:

1. **อัปเดต Production VPS (`/var/www/Ciam`) และทดสอบ AI Copilot ล่าสุด:**
   - รันคำสั่ง Deploy `api` บน Production Server (`/var/www/Ciam`) เพื่อนำโค้ด Sprint 44-45 ขึ้นใช้งานจริง
   - ทดสอบถาม AI Copilot ด้วยชื่อบัญชีเฉพาะเจาะจง เช่น `"Chaiwat.N"`, `"Duanghathai.P"` เพื่อยืนยันว่า AI แสดงข้อมูลสถานะ AD และระบบลูกที่ผูกอยู่ได้ถูกต้องแม่นยำ 100%

2. **การทดสอบความร่วมมือกับ Spoke Mode C (MTPulse) และระบบลูกอื่นๆ (QMS, IRM):**
   - ติดตามผลการเชื่อมโยงข้อมูลผ่าน Outbound Reverse Heartbeat API (`/api/v1/agent/heartbeat`) และทดสอบการส่งคำสั่ง `DISABLE_USER` / `ENABLE_USER` / `REQUEST_FULL_SYNC`
   - ตรวจสอบการนำมาตรฐาน Spoke Spec v2.8.0 (รวมถึงหมวด E: In-App AI Copilot & MCP Tools) ไปประยุกต์ใช้ในระบบลูก

3. **ระบบจัดการพนักงานลาออกอัตโนมัติ (Offboarding & Deprovisioning Orchestration):**
   - ตรวจสอบหน้า `/offboarding` สำหรับการปิดสิทธิ์พนักงานออกจากทุก Spoke Applications แบบ One-Click Kill Switch (AD, pfSense, M365, SAP B1, IRM, MTPulse)
   - ทดสอบการออกใบรับรองการเพิกถอนสิทธิ์ (ISO/IEC 27001 Revocation Certificate)

4. **การเตรียม Starter Template ภาษา Native PHP + MySQL:**
   - เตรียมตัวอย่างโค้ด PHP ดั้งเดิม (Native PHP 3 ไฟล์: `ciam_sso.php`, `ciam_callback.php`, `ciam_agent.php`) เพื่อส่งมอบให้ทีม Dev ภายในองค์กรนำไปเชื่อมต่อกับระบบ On-Premise เดิมของบริษัท

---

## 5. คำสั่ง Deploy บน VPS ประจำรอบ (Deploy Instructions)

> ⚠️ **กฎเหล็กการ Deploy (Critical Deployment Protocols):**
> 1. ชื่อ Service ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด) และ **`api`**
> 2. **ต้องเขียนคำสั่งแยกทีละบรรทัด ห้ามเชื่อมด้วย `&&` ยาวเป็นพรืด**
> 3. ต้องมี `git pull` นำหน้าเสมอ
> 4. หากมีการแก้ไขระบบลูก (เช่น IRM): ให้แสดงคำสั่ง Deploy ของระบบลูกคู่กันไปด้วยเสมอ

### กรณี Deploy ฝั่ง Central-IAM (VPS: `/var/www/Ciam` - IP: `157.173.219.153`):
- หากต้องการ Deploy การเปลี่ยนแปลงล่าสุด (Frontend & Backend):
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api web
  docker compose up -d api web
  ```
- หาก Deploy เฉพาะ Frontend (`web`):
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build web
  docker compose up -d web
  ```
- หาก Deploy เฉพาะ Backend (`api`):
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api
  docker compose up -d api
  ```

### กรณี Deploy ฝั่ง IRM (Hostinger VPS: `/var/www/Irm`):
- เมื่อมีการอัปเดตระบบลูก IRM:
  ```bash
  cd /var/www/Irm
  git pull
  docker compose build frontend
  docker compose up -d frontend
  ```
