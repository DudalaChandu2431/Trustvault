import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, AuditLog
from app.schemas import AuditLogResponse
from app.auth import get_current_admin

router = APIRouter(prefix="/api/v1/audit", tags=["Audit Trail"])

@router.get("/logs", response_model=list[AuditLogResponse])
async def get_audit_logs(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
    return result.scalars().all()

@router.post("/verify")
async def verify_audit_chain(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
    logs = result.scalars().all()
    
    expected_previous_hash = "0" * 64
    for log in logs:
        if log.previous_hash != expected_previous_hash:
            return {
                "status": "TAMPERED",
                "broken_at_sequence": log.sequence,
                "detail": f"Previous hash mismatch at sequence {log.sequence}"
            }
        
        h_input = log.previous_hash + log.payload_json
        recomputed_hash = hashlib.sha256(h_input.encode()).hexdigest()
        
        if recomputed_hash != log.record_hash:
            return {
                "status": "TAMPERED",
                "broken_at_sequence": log.sequence,
                "detail": f"Record hash mismatch at sequence {log.sequence}"
            }
        
        expected_previous_hash = log.record_hash
        
    return {
        "status": "VERIFIED",
        "total_records": len(logs),
        "message": "Audit trail hash chain is intact and untampered."
    }
