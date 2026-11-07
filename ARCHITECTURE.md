# TrustVault Architecture

## System Overview
Enterprise-grade secure document sharing platform.
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: Python 3.14, FastAPI, SQLAlchemy 2 (Async), Pydantic v2.
- Database: PostgreSQL 16+ via `asyncpg` driver.
- Storage: Private encrypted storage outside web root (`./storage/vault/`), UUID filenames, AES-256-GCM authenticated encryption with unique nonces, key versioning, and SHA-256 integrity verification.

## 1. Encryption Design (AES-256-GCM)
- **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data).
- **Nonce**: Cryptographically secure random 12-byte nonce generated per encryption operation, prepended to ciphertext.
- **Key Versioning & Rotation**: Key metadata tracks `key_version`. Rotation utility re-encrypts stored files with new master key version.
- **Key Management**: Keys stored securely via environment secrets (`VAULT_MASTER_KEY`) for local dev, and designated KMS (AWS KMS / HashiCorp Vault) for production. Keys never stored alongside documents.
- **Workflow**:
  - *Upload*: Stream -> Compute SHA-256 -> Encrypt with AES-256-GCM (Key V1 + Unique Nonce) -> Write to vault storage.
  - *Download*: Read ciphertext -> Decrypt using Key V1 and Nonce -> Verify SHA-256 checksum -> Stream decrypted bytes to authorized client.

## 2. Audit Integrity & Hash Chaining
- **Canonical Serialization**: JSON serialization with sorted keys (`json.dumps(obj, sort_keys=True)`) before hashing.
- **Hash Formula**: `record_hash = SHA-256(previous_hash + canonical_json(event_payload))`.
- **Concurrency Protection**: Database transactions with row-level locking (`SELECT ... FOR UPDATE` on latest audit sequence) prevent race conditions during concurrent log appends.
- **Append-Only Security**: PostgreSQL database role permissions restricted to `INSERT` and `SELECT` only on `audit_logs` table (no `UPDATE` or `DELETE` for normal app users).
- **External Checkpoints**: Periodic snapshots of the latest `record_hash` published to an external immutable ledger or append-only log.
- **Verification Utility**: Background service validating chain continuity from genesis entry to current entry.

## 3. Permission History & ACL Model
- **Historical Table**: `document_permissions` table includes:
  - `granted_at`, `granted_by`
  - `revoked_at`, `revoked_by`
  - `permission_type` (read, edit)
  - `status` (ACTIVE, REVOKED)
- **Revocation Enforcement**: Revoked permissions immediately invalidate downstream authorization checks. Deny by default.

## 4. Authentication & Security Controls
- **Tokens**: Short-lived access tokens (15m) in memory (React state/Zustand), never in `localStorage`. Rotating refresh tokens (7d) stored in HttpOnly, Secure, SameSite=Strict cookies.
- **CSRF Protection**: Session-bound CSRF token validation on state-changing requests + Origin header verification.
- **Token Reuse Detection**: Database tracks refresh token family trees. Reusing a revoked refresh token triggers immediate revocation of the entire token family.

## 5. PostgreSQL Driver Selection (`asyncpg`)
- **Driver**: `asyncpg` selected over `psycopg` or sync drivers.
- **Reason**: Native high-performance asynchronous PostgreSQL protocol implementation in Python, superior connection pooling support, robust async query execution matching SQLAlchemy 2 async engine requirements.

## 6. Secure File Storage & Streaming
- **Storage**: Private filesystem storage outside web root with randomized UUID filenames. Physical paths never exposed to clients.
- **Streaming & Revocation**: FastAPI streaming response (`StreamingResponse`) chunks decrypted data. Mid-download permission revocation checks on each chunk or via session validation.
