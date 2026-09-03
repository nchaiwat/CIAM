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
# Start PostgreSQL container (default port 5432)
docker compose up -d
```

### 2. Backend (FastAPI Core Engine)
```bash
cd backend
# Install dependencies using uv or venv
uv sync
# Initialize database tables and seed sample data
uv run python -m app.initial_data
# Launch FastAPI server (default: port 8000 or 8001)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Swagger API docs: `http://localhost:8000/docs`

### 3. Frontend (Next.js 16 - Impeccable GUI)
```bash
cd frontend
npm install
# Run development server (Port 3000 or Port 80)
npm run dev
# Or run on standard Port 80
npm run dev:80
```

---

## 🏛️ Project Structure

```
.
├── docker-compose.yml          # PostgreSQL 16 service
├── PRD.md                      # Product Requirements Document
├── .env.example                # Environment configuration template
├── backend/                    # FastAPI Core Governance Engine & Connectors
│   ├── app/
│   │   ├── api/v1/             # Endpoints (auth, dashboard, directory, offboard, apps, audit)
│   │   ├── connectors/         # Hybrid Connector Layer (REST API + RPA Adapters)
│   │   ├── models/             # SQLAlchemy ORM Models
│   │   ├── services/           # Offboarding orchestrator & Ghost account detector
│   │   └── initial_data.py     # Database seed data
│   └── tests/                  # Pytest API integration test suite
└── frontend/                   # Next.js App Router (Impeccable Design System)
    ├── src/app/
    │   ├── page.tsx            # / (Dashboard)
    │   ├── directory/page.tsx  # /directory (Cross-App Matrix)
    │   ├── offboarding/page.tsx# /offboarding (Instant Offboarding Hub)
    │   ├── applications/page.tsx # /applications (Spokes Registry & Ping)
    │   └── audit-logs/page.tsx # /audit-logs (Audit Trail & CSV Export)
    └── src/components/layout/  # Enterprise Navbar & Layout
```

---

## 📜 Compliance & Security
- Prepared for **ISO 27001** and **PDPA** compliance audits.
- Constant-time secret comparison (`secrets.compare_digest`).
- Machine-to-Machine security tokens (`X-Management-API-Key`).
