"""
Compliance reporting API endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.services.compliance_service import ComplianceService, ComplianceFramework
from app.schemas.compliance import (
    FrameworkResponse,
    FrameworkControlsResponse,
    ComplianceReportResponse,
    GenerateReportRequest,
    AuditReadinessResponse,
)

router = APIRouter(prefix="/v1/compliance", tags=["Compliance"])


@router.get("/frameworks", response_model=list[FrameworkResponse])
async def list_frameworks(
    user: CurrentUser = Depends(require_permissions(Permissions.READ_COMPLIANCE)),
    db: AsyncSession = Depends(get_db),
):
    """List available compliance frameworks."""
    service = ComplianceService(db)
    frameworks = await service.get_frameworks()
    return [FrameworkResponse(**f) for f in frameworks]


@router.get("/frameworks/{framework_id}/controls")
async def get_framework_controls(
    framework_id: str,
    user: CurrentUser = Depends(require_permissions(Permissions.READ_COMPLIANCE)),
    db: AsyncSession = Depends(get_db),
):
    """Get controls for a specific framework."""
    try:
        framework = ComplianceFramework(framework_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework '{framework_id}' not found",
        )

    service = ComplianceService(db)
    controls = await service.get_framework_controls(framework)
    return controls


@router.post("/reports", response_model=ComplianceReportResponse)
async def generate_report(
    data: GenerateReportRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.GENERATE_REPORTS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Generate a compliance report."""
    try:
        framework = ComplianceFramework(data.framework)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid framework '{data.framework}'",
        )

    service = ComplianceService(db)
    report = await service.generate_report(
        framework=framework,
        org_context=org_context,
        scoped_query=scoped_query,
        actor=current_user,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    await db.commit()

    return ComplianceReportResponse(**report)


@router.get("/readiness/{framework_id}", response_model=AuditReadinessResponse)
async def get_audit_readiness(
    framework_id: str,
    user: CurrentUser = Depends(require_permissions(Permissions.READ_COMPLIANCE)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Get audit readiness score for a framework."""
    try:
        framework = ComplianceFramework(framework_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework '{framework_id}' not found",
        )

    service = ComplianceService(db)
    readiness = await service.calculate_audit_readiness(
        framework=framework,
        org_context=org_context,
        scoped_query=scoped_query,
    )

    return AuditReadinessResponse(**readiness)
