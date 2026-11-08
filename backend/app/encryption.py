import os
import hashlib
import json
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import AuditLog

load_dotenv()

# Load Master Key from environment or persistent key file
KEY_FILE = "./vault_master.key"
env_key = os.getenv("VAULT_MASTER_KEY")
if env_key:
    MASTER_KEY = env_key.encode()
elif os.path.exists(KEY_FILE):
    with open(KEY_FILE, "rb") as f:
        MASTER_KEY = f.read().strip()
else:
    MASTER_KEY = Fernet.generate_key()
    with open(KEY_FILE, "wb") as f:
        f.write(MASTER_KEY)

fernet = Fernet(MASTER_KEY)

VAULT_STORAGE_DIR = "./storage/vault"
os.makedirs(VAULT_STORAGE_DIR, exist_ok=True)

def encrypt_file_data(data: bytes) -> tuple[bytes, str]:
    """Encrypts file data using Fernet (AES-128-CBC with HMAC / authenticated encryption) and returns (ciphertext, sha256_hash)."""
    sha256_hash = hashlib.sha256(data).hexdigest()
    ciphertext = fernet.encrypt(data)
    return ciphertext, sha256_hash

def decrypt_file_data(ciphertext: bytes) -> bytes:
    """Decrypts file data."""
    return fernet.decrypt(ciphertext)

async def log_audit_event(
    db: AsyncSession,
    actor_id: int | None,
    action: str,
    target_type: str,
    target_id: str | None,
    payload: dict
):
    """Appends cryptographically hash-chained audit log entry."""
    # Get latest sequence & record_hash
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.desc()).limit(1))
    latest = result.scalars().first()
    
    sequence = 1 if not latest else latest.sequence + 1
    previous_hash = "0" * 64 if not latest else latest.record_hash
    
    payload_json = json.dumps(payload, sort_keys=True)
    
    # Formula: record_hash = SHA256(previous_hash + canonical_json)
    h_input = previous_hash + payload_json
    record_hash = hashlib.sha256(h_input.encode()).hexdigest()
    
    audit_entry = AuditLog(
        sequence=sequence,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload_json=payload_json,
        previous_hash=previous_hash,
        record_hash=record_hash
    )
    db.add(audit_entry)
    await db.commit()
