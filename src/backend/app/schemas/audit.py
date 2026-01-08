"""
Audit-related Pydantic schemas.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: UUID
    timestamp: datetime
    event_type: str
    event_category: Optional[str] = None
    severity: str
    outcome: str
    actor_id: Optional[UUID] = None
    actor_type: Optional[str] = None
    actor_email: Optional[str] = None
    actor_ip: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    organization_id: Optional[UUID] = None
    description: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None
    geo_country: Optional[str] = None
    geo_city: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Audit log list item (condensed)."""
    id: UUID
    timestamp: datetime
    event_type: str
    severity: str
    outcome: str
    actor_email: Optional[str] = None
    target_type: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogQueryParams(BaseModel):
    """Audit log query parameters."""
    event_type: Optional[str] = None
    actor_id: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    severity: Optional[str] = None
    outcome: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class AuditSummaryResponse(BaseModel):
    """Audit log summary statistics."""
    period_days: int
    total_events: int
    by_category: Dict[str, int]
    failed_events: int
    high_severity_events: int


class AuditExportRequest(BaseModel):
    """Audit log export request."""
    format: str = Field(default="json", pattern=r"^(json|csv)$")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_types: Optional[List[str]] = None


class ChainIntegrityResponse(BaseModel):
    """Audit chain integrity check response."""
    verified_count: int
    is_valid: bool
    broken_links: List[Dict[str, Any]] = []
