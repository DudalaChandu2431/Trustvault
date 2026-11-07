# Security Threat Analysis & Mitigations

## 1. IDOR / BOLA (Broken Object Level Authorization)
- **Threat**: Attendant or malicious user accesses `/api/v1/documents/{id}` for unassigned document.
- **Mitigation**: Database query filters by explicit ownership OR active entry in `document_permissions`. Deny by default.

## 2. Token Reuse & Session Hijacking
- **Threat**: Stolen refresh token used after logout or compromise.
- **Mitigation**: Rotating refresh tokens. Database tracks active refresh token hashes; detection of revoked/reused token invalidates full session tree.

## 3. Audit Log Tampering
- **Threat**: Attacker or DB admin modifies/deletes historical audit entries.
- **Mitigation**: Cryptographic hash chain (`record_hash = SHA-256(...)`). Any modification invalidates downstream hashes. Verification service detects break.

## 4. File Upload Exploits (Malware, Path Traversal)
- **Threat**: Uploading executable binaries, HTML payload for XSS, or path traversal paths (`../../etc/passwd`).
- **Mitigation**: Magic byte magic number inspection (python-magic / pure signature check), randomized storage UUID filename, strict extension allowlist, stored outside web root.

## 5. Admin Privilege Overreach
- **Threat**: Compromised admin reads sensitive user documents without permission.
- **Mitigation**: Admins manage system metadata & audit logs but cannot bypass document ACL authorization checks without explicit access grant. Emergency access audit logged as critical alarm event.
