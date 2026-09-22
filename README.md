# Central IAM (Centralized Identity & Access Governance System)

Enterprise Identity Governance and Access Management application for **Window Asia Public Company Limited**.

Provides a **"Single Pane of Glass"** to eliminate orphaned/ghost accounts across disparate enterprise systems (IRM, QMS, Legacy ERP / SAP B1, WMS) and enables audited **One-Click Instant Offboarding**.

---

## 🌟 Key Features

1. **Hybrid Connector Architecture**:
   - **M2M REST API**: For modern systems (IRM, QMS) with token authentication and sub-second de-provisioning.
   - **In-House RPA Bot Workers**: Pluggable headless automation adapters for legacy apps without APIs (e.g., SAP B1 / Legacy ERP).
2. **Automated Reconciliation & Ghost Account Detection**:
   - Compares active user accounts across spoke systems against Active Directory.
   - Highlights high-risk discrepancies with instant 1-click remediation.
3. **Instant Offboarding Hub (Killer Feature)**:
   - Dynamic Blast Radius Impact Calculator.
   - Single-button **"Disable Everywhere"** executing in parallel across AD, REST APIs, and RPA Workers.
   - Real-time Execution Checklist & Printable / PDF **Offboarding Certificate** for ISO 27001 / PDPA compliance.
4. **Audit Trail & Compliance**:
   - Complete non-repudiation audit stream with 1-click CSV export.

---

## 🚀 Quick Start

### 1. Database (PostgreSQL 16)
```bash
# Start PostgreSQL container on port 5435 (avoids conflict with port 5432)
docker compose up -d
```

### 2. Backend (FastAPI Core Engine)
```bash
cd backend
# Activate virtual environment
.\.venv\Scripts\Activate.ps1
# Initialize database tables and seed real data
python -m app.initial_data
# Launch FastAPI server on port 8001 (port 8000 is reserved)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
Swagger API docs: `http://localhost:8001/docs`

### 3. Frontend (Next.js 16 - IRM-Style Layout)
```bash
cd frontend
npm install
# Run development server (Port 3000)
npm run dev
```

---

## 🏛️ Project Structure

```
.
├── docker-compose.yml          # PostgreSQL 16 service (Port 5435)
├── PRD.md                      # Product Requirements Document
├── .env.example                # Environment configuration template
├── backend/                    # FastAPI Core Governance Engine & Connectors
│   ├── app/
│   │   ├── api/v1/             # Endpoints (auth, dashboard, directory, offboard, apps, audit)
│   │   ├── connectors/         # Hybrid Connector Layer (REST API + RPA Adapters + SAP B1 + AD)
│   │   ├── models/             # SQLAlchemy ORM Models
│   │   ├── services/           # Offboarding orchestrator, Provisioning & Ghost account detector
│   │   └── initial_data.py     # Database seed data
│   └── tests/                  # Pytest API integration test suite
└── frontend/                   # Next.js App Router (IRM-Style Design System)
    ├── src/app/
    │   ├── page.tsx            # / (Dashboard)
    │   ├── directory/page.tsx  # /directory (Cross-App Matrix & Quick Disable)
    │   ├── offboarding/page.tsx# /offboarding (Instant Offboarding Hub)
    │   ├── applications/page.tsx # /applications (Spokes Registry, Ping & Secret Key Modal)
    │   └── audit-logs/page.tsx # /audit-logs (Audit Trail & CSV Export)
    └── src/components/layout/  # IRM-Style Layout (Sidebar, Header, AppShell)
```

---

## 📜 Compliance & Security
- Prepared for **ISO 27001** and **PDPA** compliance audits.
- Constant-time secret comparison (`secrets.compare_digest`).
- Machine-to-Machine security tokens (`X-Management-API-Key`).

---

## 📚 Technical Specifications & Guides
- [PRD.md](file:///d:/Python/Central-IAM/PRD.md) - Product Requirements Document
- [HANDOFF.md](file:///d:/Python/Central-IAM/HANDOFF.md) - Developer & Operations Handoff Guide
- [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/Central-IAM/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md) - Standard API Blueprint for Spoke Applications (IRM, QMS, ERP)
- [AD_SYNC_AGENT_API_SPEC.md](file:///d:/Python/Central-IAM/AD_SYNC_AGENT_API_SPEC.md) - Administration API Blueprint for In-House AD Sync Agent
- [ADAuthen.md](file:///d:/Python/Central-IAM/ADAuthen.md) - Active Directory Authentication Guide (Port 3100)
- [MEMORY.md](file:///d:/Python/Central-IAM/MEMORY.md) - System Technical Memory & Ports

