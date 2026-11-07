# TrustVault

Enterprise-Grade Secure Document Sharing Platform with Tamper-Evident Audit Trail.

## Features
- Secure Authentication: Argon2id password hashing, JWT + rotating HttpOnly refresh cookies, session revocation.
- Fine-Grained Authorization: Per-document ACL (read, edit), deny-by-default, BOLA/IDOR protection.
- Authenticated Storage: AES-256 (Fernet) encryption at rest, randomized UUID paths, SHA-256 integrity verification.
- Tamper-Evident Audit Trail: Cryptographic SHA-256 hash chaining for all system actions.
- Enterprise UI: React, TypeScript, Vite, Tailwind CSS, shadcn/ui.

## Tech Stack
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query.
- Backend: Python 3.14, FastAPI, SQLAlchemy 2 (Async), PostgreSQL, Pydantic v2, Alembic.
- Security: Argon2id, Cryptography (Fernet), PyJWT.

## Architecture & Docs
- `ARCHITECTURE.md`: Technical overview & security model.
- `DATABASE_DESIGN.md`: DB schema, tables, indexes & hash-chain specification.
- `API_DESIGN.md`: REST API endpoints and payloads.
- `THREATS.md`: Threat model & mitigation strategies.
- `PROMPTS.md`: Prompt evolution log.
