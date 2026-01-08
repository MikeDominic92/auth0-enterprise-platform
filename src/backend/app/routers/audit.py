"""
Audit log API endpoints.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.dependencies.permissions import require_permissions, Permissions
from app.dependencies.org_isolation import (
    EnforcedOrgContext,
    OrgContext,
    OrgScopedQuery,
    get_org_scoped_query,
)
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditSummaryResponse,
    ChainIntegrityResponse,
)
from app.schemas.common import (
    PaginatedResponse,
    create_pagination_meta,
    create_pagination_links,
)

router = APIRouter(prefix="/v1/audit", tags=["Audit"])


@router.get("", response_model=PaginatedResponse[AuditLogListResponse])
async def list_audit_logs(
    request: Request,
    user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    event_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """List audit logs with filtering and pagination."""
    service = AuditService(db)
    logs, total = await service.get_logs(
        org_context=org_context,
        scoped_query=scoped_query,
        event_type=event_type,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
        severity=severity,
        outcome=outcome,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )

    meta = create_pagination_meta(page, page_size, total)
    links = create_pagination_links(
        str(request.url.path),
        page,
        page_size,
        meta.total_pages,
    )

    return PaginatedResponse(
        data=[AuditLogListResponse.model_validate(log) for log in logs],
        meta=meta,
        links=links,
    )


@router.get("/summary", response_model=AuditSummaryResponse)
async def get_audit_summary(
    user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
):
    """Get audit log summary statistics."""
    service = AuditService(db)
    summary = await service.get_summary(
        org_context=org_context,
        scoped_query=scoped_query,
        days=days,
    )
    return AuditSummaryResponse(**summary)


@router.get("/security", response_model=list[AuditLogResponse])
async def get_security_events(
    user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(100, ge=1, le=500),
):
    """Get recent security-related events."""
    service = AuditService(db)
    events = await service.get_security_events(
        org_context=org_context,
        scoped_query=scoped_query,
        hours=hours,
        limit=limit,
    )
    return [AuditLogResponse.model_validate(e) for e in events]


@router.get("/integrity", response_model=ChainIntegrityResponse)
async def verify_chain_integrity(
    user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(1000, ge=100, le=10000),
):
    """Verify audit log hash chain integrity."""
    service = AuditService(db)
    result = await service.verify_chain_integrity(
        org_context=org_context,
        limit=limit,
    )
    return ChainIntegrityResponse(**result)


@router.get("/users/{user_id}", response_model=list[AuditLogResponse])
async def get_user_activity(
    user_id: str,
    current_user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
):
    """Get audit logs for a specific user."""
    service = AuditService(db)
    logs = await service.get_user_activity(
        user_id=user_id,
        org_context=org_context,
        scoped_query=scoped_query,
        limit=limit,
    )
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.READ_AUDIT_LOGS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Get a single audit log entry."""
    service = AuditService(db)
    log = await service.get_log_by_id(
        log_id=log_id,
        org_context=org_context,
        scoped_query=scoped_query,
    )

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log {log_id} not found",
        )

    return AuditLogResponse.model_validate(log)
