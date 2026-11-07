import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models import User, Document, DocumentPermission, PermissionType, PermissionStatus
from app.schemas import DocumentResponse, PermissionCreate, PermissionResponse
from app.auth import get_current_user
from app.encryption import encrypt_file_data, decrypt_file_data, VAULT_STORAGE_DIR, log_audit_event

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    file_size = len(content)
    doc_id = str(uuid.uuid4())
    
    ciphertext, sha256_hash = encrypt_file_data(content)
    encrypted_filename = f"{doc_id}.enc"
    encrypted_path = os.path.join(VAULT_STORAGE_DIR, encrypted_filename)
    
    with open(encrypted_path, "wb") as f:
        f.write(ciphertext)
        
    document = Document(
        id=doc_id,
        filename=file.filename or "untitled",
        encrypted_path=encrypted_path,
        mime_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        sha256_hash=sha256_hash,
        key_version=1,
        owner_id=current_user.id
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="DOCUMENT_UPLOAD",
        target_type="Document",
        target_id=doc_id,
        payload={"filename": document.filename, "size": file_size, "sha256": sha256_hash}
    )

    return document

@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "ADMIN":
        result = await db.execute(select(Document))
    else:
        # User owns or has active permissions
        subquery = select(DocumentPermission.document_id).where(
            DocumentPermission.user_id == current_user.id,
            DocumentPermission.status == PermissionStatus.ACTIVE
        )
        result = await db.execute(
            select(Document).where(
                or_(Document.owner_id == current_user.id, Document.id.in_(subquery))
            )
        )
    return result.scalars().all()

@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check access
    if current_user.role != "ADMIN" and doc.owner_id != current_user.id:
        perm_res = await db.execute(
            select(DocumentPermission).where(
                DocumentPermission.document_id == document_id,
                DocumentPermission.user_id == current_user.id,
                DocumentPermission.status == PermissionStatus.ACTIVE
            )
        )
        perm = perm_res.scalars().first()
        if not perm:
            await log_audit_event(
                db=db,
                actor_id=current_user.id,
                action="UNAUTHORIZED_ACCESS_BLOCKED",
                target_type="Document",
                target_id=document_id,
                payload={"attempted_by": current_user.email, "reason": "No active permission"}
            )
            raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(doc.encrypted_path):
        raise HTTPException(status_code=500, detail="Encrypted file missing from storage")

    with open(doc.encrypted_path, "rb") as f:
        ciphertext = f.read()

    try:
        plaintext = decrypt_file_data(ciphertext)
    except Exception:
        raise HTTPException(status_code=500, detail="Decryption failed")

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="DOCUMENT_DOWNLOAD",
        target_type="Document",
        target_id=document_id,
        payload={"filename": doc.filename}
    )

    return Response(content=plaintext, media_type=doc.mime_type, headers={
        "Content-Disposition": f'attachment; filename="{doc.filename}"'
    })

@router.post("/{document_id}/permissions", response_model=PermissionResponse)
async def grant_permission(
    document_id: str,
    perm_data: PermissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only owner or admin can grant permissions")

    user_res = await db.execute(select(User).where(User.email == perm_data.user_email))
    target_user = user_res.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Check if permission already exists
    existing_res = await db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == target_user.id
        )
    )
    perm = existing_res.scalars().first()
    if perm:
        perm.status = PermissionStatus.ACTIVE
        perm.permission_type = perm_data.permission_type
        perm.granted_by = current_user.id
    else:
        perm = DocumentPermission(
            document_id=document_id,
            user_id=target_user.id,
            permission_type=perm_data.permission_type,
            status=PermissionStatus.ACTIVE,
            granted_by=current_user.id
        )
        db.add(perm)
    
    await db.commit()
    await db.refresh(perm)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="GRANT_PERMISSION",
        target_type="DocumentPermission",
        target_id=str(perm.id),
        payload={"document_id": document_id, "target_user": perm_data.user_email, "type": perm_data.permission_type}
    )

    perm_dict = {
        "id": perm.id,
        "document_id": perm.document_id,
        "user_id": perm.user_id,
        "user_email": target_user.email,
        "permission_type": perm.permission_type,
        "status": perm.status,
        "granted_by": perm.granted_by,
        "granted_at": perm.granted_at,
        "revoked_at": perm.revoked_at
    }
    return perm_dict

@router.get("/{document_id}/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    perms_res = await db.execute(select(DocumentPermission).where(DocumentPermission.document_id == document_id))
    perms = perms_res.scalars().all()
    
    response_list = []
    for p in perms:
        u_res = await db.execute(select(User).where(User.id == p.user_id))
        u = u_res.scalars().first()
        response_list.append({
            "id": p.id,
            "document_id": p.document_id,
            "user_id": p.user_id,
            "user_email": u.email if u else "unknown",
            "permission_type": p.permission_type,
            "status": p.status,
            "granted_by": p.granted_by,
            "granted_at": p.granted_at,
            "revoked_at": p.revoked_at
        })
    return response_list

@router.delete("/{document_id}/permissions/{user_id}")
async def revoke_permission(
    document_id: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only owner or admin can revoke permissions")

    perm_res = await db.execute(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
            DocumentPermission.status == PermissionStatus.ACTIVE
        )
    )
    perm = perm_res.scalars().first()
    if not perm:
        raise HTTPException(status_code=404, detail="Active permission not found")

    perm.status = PermissionStatus.REVOKED
    import datetime
    perm.revoked_at = datetime.datetime.utcnow()
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="REVOKE_PERMISSION",
        target_type="DocumentPermission",
        target_id=str(perm.id),
        payload={"document_id": document_id, "user_id": user_id, "revoked_by": current_user.email}
    )

    return {"message": "Permission revoked successfully", "status": "REVOKED"}

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only owner or admin can delete document")

    if os.path.exists(doc.encrypted_path):
        os.remove(doc.encrypted_path)

    await db.delete(doc)
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="DOCUMENT_DELETE",
        target_type="Document",
        target_id=document_id,
        payload={"filename": doc.filename, "deleted_by": current_user.email}
    )

    return {"message": "Document deleted successfully"}
