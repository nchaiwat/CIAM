# Antigravity Agent Workspace Guidelines & Operational Protocols (AGENTS.md)
**Target Workspace:** `d:\Python\Central-IAM` และ Spoke Applications ที่เกี่ยวข้อง  
**Organization:** Window Asia Public Company Limited

---

## 1. กฎการเริ่มต้นบทสนทนา (Session Startup Protocol)
เมื่อเริ่มต้นบทสนทนาใหม่หรือเริ่มงานใหม่ในแต่ละรอบ AI Agent **ต้องอ่านและทำความเข้าใจไฟล์บริบทต่อไปนี้โดยอัตโนมัติทันที** ก่อนเริ่มตอบคำถามหรือลงมือเขียนโค้ด โดยที่ผู้ใช้ไม่ต้องคอยทวงถาม:
1. [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md) — ฐานความรู้ระบบ พอร์ต คีย์เชื่อมต่อ นโยบายความปลอดภัย และข้อควรระวังสำคัญ
2. [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md) — สถานะความคืบหน้าล่าสุด Git commits และ Roadmap งานที่จะทำต่อ
3. [SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md](file:///d:/Python/Central-IAM/SPOKE_ENTERPRISE_INTEGRATION_SPECIFICATION.md) — สเปกกลางการเชื่อมต่อ Mode A, Mode B, Mode C

---

## 2. ขั้นตอนเมื่อมีการแก้ไขโค้ด (Post-Modification & Deployment Protocol)
เมื่อมีการเพิ่มฟีเจอร์หรือแก้ไขบั๊กเสร็จสิ้นในแต่ละรอบ AI Agent **ต้องปฏิบัติตามลำดับงานต่อไปนี้อย่างเคร่งครัด**:

### ขั้นที่ 1: ตรวจสอบความถูกต้องและ Type Integrity
- **Backend:** รัน `.venv\Scripts\pytest.exe` (ต้องผ่าน 100%)
- **Frontend:** รัน `npx tsc --noEmit` (ต้องได้ 0 errors)

### ขั้นที่ 2: บันทึกประวัติและอัปเดตเอกสารระบบ
- อัปเดตบันทึกการเปลี่ยนแปลงใน [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md) และ [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md)
- ทำ `git add` และ `git commit` ด้วยข้อความ Conventional Commits
- ดำเนินการ `git push origin main` หรือเตรียมคำสั่ง push ให้ผู้ใช้

### ขั้นที่ 3: สรุปคำสั่ง Deploy บน VPS ตามกฎเหล็กใน MEMORY.md เสมอ
> ⚠️ **กฎเหล็กการ Deploy:**
> 1. ชื่อ Service ใน `docker-compose.yml` คือ **`web`** (ห้ามใช้คำว่า `frontend` เด็ดขาด) และ **`api`**
> 2. **ต้องเขียนคำสั่งแยกทีละบรรทัด ห้ามเชื่อมด้วย `&&` ยาวเป็นพรืด**
> 3. ต้องมี `git pull` นำหน้าเสมอ

**ตัวอย่างรูปแบบคำสั่งที่ต้องแสดงให้ผู้ใช้ทุกครั้ง:**
- หากแก้ **Frontend**:
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build web
  docker compose up -d web
  ```
- หากแก้ **Backend**:
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api
  docker compose up -d api
  ```
- หากแก้ทั้ง **Backend และ Frontend**:
  ```bash
  cd /var/www/Ciam
  git pull
  docker compose build api web
  docker compose up -d api web
  ```
- หากมีการแก้ไขระบบลูก (เช่น IRM): ให้แสดงคำสั่ง Deploy ของระบบลูกคู่กันไปด้วยเสมอ
