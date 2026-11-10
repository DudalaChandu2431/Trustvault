# TrustVault — Cryptographic Document Platform

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Demo-000000?style=flat&logo=vercel)](https://trustvault-vert.vercel.app)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?style=flat&logo=react)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

An enterprise-grade document storage and verification platform featuring end-to-end cryptographic integrity, tamper-evident SHA-256 audit trails, and granular RBAC.

---

## 🌐 Live Demo & Deployment

- **Frontend Production URL**: [https://trustvault-vert.vercel.app](https://trustvault-vert.vercel.app)
- **GitHub Repository**: [https://github.com/DudalaChandu2431/Trustvault](https://github.com/DudalaChandu2431/Trustvault)

---

## 🔐 Core Capabilities

- **Tamper-Evident Audit Chaining**: Every system event (uploads, downloads, logins, permission updates) is hashed with SHA-256 and cryptographically linked to the previous block hash (`previous_hash` + `record_data` -> `current_hash`).
- **Cryptographic Document Verification**: Uploaded assets generate real-time SHA-256 hashes upon upload, verified against on-disk copies on every retrieval to detect bit-rot or unauthorized modifications.
- **Strict Role-Based Access Control (RBAC)**: Enforces access tiers (`ADMIN`, `USER`) alongside document-level ownership models (`OWNER`, `EDITOR`, `VIEWER`).
- **OAuth 2.0 & Identity Integration**:
  - Google Identity Services (One Tap + OAuth 2.0 token verification)
  - X / Twitter OAuth 2.0 with PKCE (`code_challenge` / `code_verifier`)
- **Interactive Security Hardening**:
  - Argon2id password hashing with strict complexity rules
  - Rate limiting & brute-force mitigation
  - Account deactivation & session revocation

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Framer Motion |
| **Backend** | Python 3, FastAPI, SQLAlchemy 2 (Async), aiosqlite / SQLite |
| **Security & Auth** | Argon2id, PyJWT, Fernet (AES-256), SHA-256 Chaining |
| **Hosting & CI/CD** | Vercel (SPA Frontend), Render-ready (`render.yaml`, `Dockerfile`) |

---

## 🚀 Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/DudalaChandu2431/Trustvault.git
cd Trustvault
```

### 2. Backend Setup
```bash
cd backend
python -m venv test_env
source test_env/bin/activate  # Or `test_env\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👤 Default Test Accounts

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@trustvault.local` | `Admin@123` |
| **User (Alice)** | `alice@trustvault.local` | `Password@123` |
| **User (Bob)** | `bob@trustvault.local` | `Password@123` |

---

## 📂 Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System design, security boundaries, and data flow.
- [`API_DESIGN.md`](./API_DESIGN.md): Complete OpenAPI REST endpoints and schemas.
- [`THREATS.md`](./THREATS.md): STRIDE threat modeling & security mitigations.
- [`PROMPTS.md`](./PROMPTS.md): Development logs and iteration history.
