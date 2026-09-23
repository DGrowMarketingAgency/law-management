# Legal Practice Management Platform

> **Technical Foundation (Prompt 1)**  
> Production-ready, web-only legal practice management platform designed specifically for an advocate's chambers and junior associates in India.

---

## 1. Project Overview

The Legal Practice Management Platform functions as a private digital chambers-management system for an advocate's office. It is strictly an internal practice-management portal—not a public lawyer directory, advertising platform, or client-matching marketplace.

This repository currently implements the **Phase 1 Technical Foundation**: full-stack plumbing, MySQL 8+ connection pooling, modular Express routing with security middleware, centralized error handling, and a React SPA with real-time API/Database health verification.

---

## 2. Technology Stack

- **Frontend**:
  - React.js (v18+)
  - JavaScript (ES6+)
  - Vite (Build Tool & Dev Server)
  - React Router (v6)
  - Axios (HTTP Client)
  - Vanilla CSS (Desktop-first, minimalist design system)

- **Backend**:
  - Node.js (v18+ / v20+ / v22+)
  - Express.js (v4)
  - JavaScript (CommonJS `require` / `module.exports`)
  - mysql2/promise (Connection pooling & async queries)
  - Helmet, CORS, Express-Rate-Limit (Security foundations)
  - Dotenv (Centralized environment configuration)

- **Database**:
  - MySQL 8+ (`utf8mb4` character set, `utf8mb4_unicode_ci` collation)

---

## 3. Folder Structure

```
legal-practice-management/
├── client/
│   ├── public/
│   │   └── .gitkeep
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   └── HealthStatus.jsx
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── NotFound.jsx
│   │   ├── routes/
│   │   │   └── AppRoutes.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── config/
│   │   ├── database.js
│   │   └── env.js
│   ├── controllers/
│   │   └── healthController.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   └── requestLogger.js
│   ├── models/
│   ├── routes/
│   │   └── index.js
│   ├── services/
│   ├── validators/
│   ├── utils/
│   │   └── apiResponse.js
│   ├── constants/
│   ├── database/
│   ├── app.js
│   ├── package.json
│   └── server.js
│
├── database/
│   ├── schema.sql
│   └── seed.sql
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Prerequisites

Before setting up the project, ensure you have the following installed:

1. **Node.js**: v18.0.0 or higher (`node -v`)
2. **npm**: v9.0.0 or higher (`npm -v`)
3. **MySQL Server**: v8.0 or higher running locally or on a reachable network host.

---

## 5. MySQL Setup

1. Start your local MySQL service (e.g. `MySQL80` on Windows):
   ```powershell
   # Windows PowerShell
   Start-Service MySQL80
   ```

2. Initialize the database using the provided `schema.sql`:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   *Alternatively, via the MySQL command line client:*
   ```sql
   CREATE DATABASE IF NOT EXISTS `legal_practice`
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

> **Note**: Prompt 1 creates **only** the `legal_practice` database. No business tables (users, cases, clients, invoices, etc.) are created yet.

---

## 6. Environment Variables

### Root / Backend (`.env`)

Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```

Configure your local MySQL credentials:
```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=legal_practice
DB_USER=root
DB_PASSWORD=your_mysql_password_here

CLIENT_URL=http://localhost:5173

# Placeholders for future authentication (not active in Prompt 1)
JWT_SECRET=replace_this_later
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_this_later
JWT_REFRESH_EXPIRES_IN=7d
```

### Client (`client/.env`)

Copy `client/.env.example` to `client/.env`:
```bash
cp client/.env.example client/.env
```
Ensure the API base URL matches the backend:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 7. Installation

Install all dependencies across root, server, and client:

```bash
# Option A: One-command installation from root
npm install

# Option B: Manual step-by-step installation
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

---

## 8. Development Commands

### Run Both Client and Server Concurrently (Recommended)
```bash
npm run dev
```
- Starts the Express backend on `http://localhost:5000`
- Starts the Vite React frontend on `http://localhost:5173`

### Run Individually
- **Backend only**:
  ```bash
  npm run server
  ```
- **Frontend only**:
  ```bash
  npm run client
  ```

---

## 9. API Health Endpoint

- **Endpoint**: `GET /api/v1/health`
- **Response Format (Connected Database)**:
  ```json
  {
    "success": true,
    "message": "API is healthy",
    "data": {
      "status": "ok",
      "database": "connected",
      "timestamp": "2026-09-11T09:30:00.000Z"
    }
  }
  ```
- **Response Format (Disconnected Database)**:
  ```json
  {
    "success": true,
    "message": "API is healthy",
    "data": {
      "status": "ok",
      "database": "disconnected",
      "timestamp": "2026-09-11T09:30:00.000Z"
    }
  }
  ```

---

---

## 10. Implemented Modules Overview

- **Prompt 1**: Technical Foundation, MySQL 8+ pooling, REST API versioning, React SPA, Health monitoring.
- **Prompt 2**: User Authentication, Session Management, JWT & Refresh Tokens, Profile Management.
- **Prompt 3**: RBAC & Permissions Engine (Senior Advocates, Junior Associates, Clerks, Interns, Clients).
- **Prompt 4**: Case Management, Cause List, Hearings, Case Diary, Transfer History, Stages.
- **Prompt 5**: Court Limitation Calculator & Statutory Deadline Engine.
- **Prompt 6**: CRM, Lead Intake, Follow-ups, Client Onboarding, Retainers.
- **Prompt 7**: Time Tracking, Fee Structures, Invoicing, GST Receipts, Ledger.
- **Prompt 8**: Payment Gateway Integration & Trust Account Compliance.
- **Prompt 9**: Real-time Notifications, Escalations, Chambers Communication.
- **Prompt 10**: Internal Workforce, HR, Employee & Internship Management System.
- **Prompt 11**: **Legal Document Management + Version Control + Approval Workflow + Electronic Signature (E-Sign) System**.

---

## 11. Prompt 11 — Legal Document Management & E-Sign System

### Features Implemented
- **Case-Linked & Firm Repository**: Hierarchical folders (`01_Pleadings`, `02_Applications`, `03_Affidavits`, `04_Orders_Judgments`, `05_Evidence`, etc.) with case or general firm isolation.
- **21 Configurable Legal Document Types**: Pre-seeded Indian legal taxonomy (Plaint, Written Statement, Bail Application, Writ Petition, Vakalatnama, SLP, Legal Notice, Affidavits, etc.).
- **Strict Version Control & Immutability**:
  - Incremental versioning (`v1`, `v2`, ...).
  - SHA-256 cryptographic checksum computation on upload/creation.
  - Historical versions are strictly immutable and read-only.
- **Legal Document Templates**:
  - Variable syntax (`{{CLIENT_NAME}}`, `{{COURT_NAME}}`, `{{CASE_NUMBER}}`, etc.).
  - Automatic template variable validation and draft instantiation with live case pre-filling.
- **Approval & Review Workflow**:
  - Multi-state lifecycle: `DRAFT` ➔ `IN_REVIEW` ➔ `CHANGES_REQUESTED` ➔ `APPROVED` ➔ `SIGNED` ➔ `ARCHIVED`.
  - Advocate-only approval enforcement with automatic document locking on approval.
  - Threaded nested comments and change request annotations.
- **Pluggable E-Signature Engine (`ESignProvider`)**:
  - Unified provider abstraction supporting **Digio**, **Leegality**, and **MockESignProvider**.
  - Multi-party signing with sequential or parallel signing orders.
  - Webhook processing with HMAC-SHA256 signature verification and idempotency protection.
  - Signed PDF artifacts sealed with digital certificates and SHA-256 hashes, saved as new immutable versions.
  - Zero-dependency Node.js binary PDF 1.4 generation.
- **Comprehensive RBAC & Security**:
  - Advocate-only confidentiality enforcement.
  - Case assignment isolation preventing unauthorized associate access.
  - Client portal isolation restricting clients to approved/signed documents.

### API Routes Added
- `GET /api/v1/documents/stats` — Document analytics KPI counters.
- `GET /api/v1/documents` — Search, filter, and paginate documents.
- `POST /api/v1/documents` — Upload new document or instantiate from template.
- `GET /api/v1/documents/:id` — Detailed document view with version history.
- `GET /api/v1/documents/types` — Pre-seeded document classifications.
- `GET /api/v1/documents/templates` — Standard legal document template library.
- `POST /api/v1/documents/:id/review` — Submit for review, request changes, or advocate approve.
- `POST /api/v1/documents/:id/comments` — Threaded review comments.
- `POST /api/v1/documents/:id/lock` — Manual / automatic tamper-evident locking.
- `POST /api/v1/documents/:id/esign` — Dispatch multi-signer electronic signature request.
- `POST /api/v1/webhooks/esign/:provider` — External e-sign webhook receiver.

### Running Test Suites
```bash
# Document Lifecycle & Review State Machine Tests (8/8)
node server/tests/document_lifecycle_test.js

# E-Signature Multi-Signer & Webhook Tests (7/7)
node server/tests/document_esign_test.js

# Security, RBAC, Case & Client Isolation Tests (4/4)
node server/tests/document_security_test.js
```

### Dedicated Documentation
- [docs/document-management.md](docs/document-management.md) — Architecture, folders, and templates.
- [docs/document-workflow.md](docs/document-workflow.md) — Review states, comments, and advocate approval.
- [docs/document-security.md](docs/document-security.md) — RBAC, confidentiality, tamper-evidence, and client isolation.
- [docs/esign-integration.md](docs/esign-integration.md) — E-Signature providers, multi-signer workflows, and statutory compliance.

