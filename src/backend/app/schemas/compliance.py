"""
Compliance-related Pydantic schemas.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FrameworkResponse(BaseModel):
    """Compliance framework response."""
    id: str
    name: str
    description: str


class ControlResponse(BaseModel):
    """Compliance control response."""
    id: str
    name: str
    description: str


class ControlCategoryResponse(BaseModel):
    """Control category response."""
    name: str
    controls: List[ControlResponse]


class FrameworkControlsResponse(BaseModel):
    """Framework controls response."""
    framework: str
    categories: Dict[str, ControlCategoryResponse]


class ControlStatusResponse(BaseModel):
    """Individual control status in report."""
    category: str
    category_name: str
    control_id: str
    control_name: str
    description: str
    status: str
    evidence_count: int
    last_evaluated: str


class ReportSummaryResponse(BaseModel):
    """Report summary statistics."""
    overall_score: float
    total_controls: int
    compliant: int
    non_compliant: int
    partial: int
    not_applicable: int


class AuditSummaryInReport(BaseModel):
    """Audit summary within compliance report."""
    total_events: int
    security_events: int
    failed_authentications: int
    access_denied_events: int


class UserStatsInReport(BaseModel):
    """User statistics within compliance report."""
    total_users: int
    active_users: int
    blocked_users: int
    email_verified_users: int
    verification_rate: float


class RecommendationResponse(BaseModel):
    """Compliance recommendation."""
    priority: str
    control_id: str
    control_name: str
    recommendation: str
    impact: str


class ComplianceReportResponse(BaseModel):
    """Full compliance report response."""
    id: str
    framework: str
    organization_id: Optional[str] = None
    generated_at: str
    generated_by: str
    period: Dict[str, str]
    summary: ReportSummaryResponse
    audit_summary: AuditSummaryInReport
    user_statistics: UserStatsInReport
    controls: List[ControlStatusResponse]
    recommendations: List[RecommendationResponse]


class GenerateReportRequest(BaseModel):
    """Generate compliance report request."""
    framework: str = Field(..., pattern=r"^(soc2|hipaa|gdpr|iso27001|pci_dss|nist)$")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AuditReadinessResponse(BaseModel):
    """Audit readiness assessment response."""
    framework: str
    score: float
    readiness_level: str
    readiness_color: str
    evaluated_at: str
    period_days: int
    summary: Dict[str, int]
