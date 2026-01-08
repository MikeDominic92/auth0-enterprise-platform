"""
Audit log model for compliance and security tracking.
Implements immutable audit trail with builder pattern.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Any, Dict
from uuid import uuid4

from sqlalchemy import String, Integer, Boolean, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditEventType(str, Enum):
    """Types of audit events."""
    # Authentication
    AUTH_LOGIN_SUCCESS = "auth.login.success"
    AUTH_LOGIN_FAILED = "auth.login.failed"
    AUTH_LOGOUT = "auth.logout"
    AUTH_MFA_ENROLLED = "auth.mfa.enrolled"
    AUTH_MFA_CHALLENGE = "auth.mfa.challenge"
    AUTH_PASSWORD_RESET = "auth.password.reset"
    AUTH_PASSWORD_CHANGED = "auth.password.changed"

    # User management
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_BLOCKED = "user.blocked"
    USER_UNBLOCKED = "user.unblocked"

    # Role management
    ROLE_ASSIGNED = "role.assigned"
    ROLE_REMOVED = "role.removed"

    # Team management
    TEAM_CREATED = "team.created"
    TEAM_UPDATED = "team.updated"
    TEAM_DELETED = "team.deleted"
    TEAM_MEMBER_ADDED = "team.member.added"
    TEAM_MEMBER_REMOVED = "team.member.removed"

    # Organization
    ORG_CREATED = "org.created"
    ORG_UPDATED = "org.updated"
    ORG_DELETED = "org.deleted"

    # Access control
    ACCESS_DENIED = "access.denied"
    ACCESS_GRANTED = "access.granted"

    # Compliance
    COMPLIANCE_REPORT_GENERATED = "compliance.report.generated"
    COMPLIANCE_EXPORT = "compliance.export"

    # Admin actions
    ADMIN_OVERRIDE = "admin.override"
    ADMIN_CONFIG_CHANGED = "admin.config.changed"

    # System
    SYSTEM_ERROR = "system.error"
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"


class AuditSeverity(str, Enum):
    """Severity levels for audit events."""
    DEBUG = "debug"
    INFO = "info"
    NOTICE = "notice"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    ALERT = "alert"


class AuditOutcome(str, Enum):
    """Outcome of the audited action."""
    SUCCESS = "success"
    FAILURE = "failure"
    UNKNOWN = "unknown"


class AuditLog(Base):
    """
    Immutable audit log entry.
    Designed for compliance requirements (SOC 2, HIPAA, GDPR).
    """

    __tablename__ = "audit_logs"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Timestamp (immutable)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Event classification
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    event_category: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        default=AuditSeverity.INFO.value,
        nullable=False,
    )
    outcome: Mapped[str] = mapped_column(
        String(20),
        default=AuditOutcome.SUCCESS.value,
        nullable=False,
    )

    # Actor information
    actor_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    actor_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    actor_email: Mapped[Optional[str]] = mapped_column(
        String(254),
        nullable=True,
    )
    actor_ip: Mapped[Optional[str]] = mapped_column(
        INET,
        nullable=True,
    )
    actor_user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Target information
    target_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    target_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    target_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Organization context
    organization_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Event details
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    changes: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Request context
    request_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    # Geographic information
    geo_country: Mapped[Optional[str]] = mapped_column(
        String(2),
        nullable=True,
    )
    geo_city: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    # Hash chain for tamper detection
    previous_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    current_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )

    # Indexes for common queries
    __table_args__ = (
        Index("ix_audit_org_timestamp", "organization_id", "timestamp"),
        Index("ix_audit_actor_timestamp", "actor_id", "timestamp"),
        Index("ix_audit_type_org", "event_type", "organization_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.event_type} at {self.timestamp}>"

    @property
    def is_security_event(self) -> bool:
        """Check if this is a security-related event."""
        security_types = ["auth.", "access.", "admin."]
        return any(self.event_type.startswith(t) for t in security_types)

    @property
    def is_failure(self) -> bool:
        """Check if this event represents a failure."""
        return self.outcome == AuditOutcome.FAILURE.value

    @property
    def is_high_severity(self) -> bool:
        """Check if this is a high severity event."""
        high_severities = [
            AuditSeverity.ERROR.value,
            AuditSeverity.CRITICAL.value,
            AuditSeverity.ALERT.value,
        ]
        return self.severity in high_severities


class AuditLogBuilder:
    """
    Builder pattern for creating audit log entries.
    Provides fluent interface for constructing audit logs.
    """

    def __init__(self):
        self._event_type: Optional[str] = None
        self._event_category: Optional[str] = None
        self._severity: str = AuditSeverity.INFO.value
        self._outcome: str = AuditOutcome.SUCCESS.value
        self._actor_id: Optional[str] = None
        self._actor_type: Optional[str] = None
        self._actor_email: Optional[str] = None
        self._actor_ip: Optional[str] = None
        self._actor_user_agent: Optional[str] = None
        self._target_type: Optional[str] = None
        self._target_id: Optional[str] = None
        self._target_name: Optional[str] = None
        self._organization_id: Optional[str] = None
        self._description: Optional[str] = None
        self._changes: Optional[dict] = None
        self._metadata: Dict[str, Any] = {}
        self._request_id: Optional[str] = None
        self._session_id: Optional[str] = None
        self._geo_country: Optional[str] = None
        self._geo_city: Optional[str] = None

    def event(self, event_type: str) -> "AuditLogBuilder":
        """Set event type."""
        self._event_type = event_type
        self._event_category = event_type.split(".")[0] if "." in event_type else None
        return self

    def severity(self, severity: AuditSeverity) -> "AuditLogBuilder":
        """Set severity level."""
        self._severity = severity.value if isinstance(severity, AuditSeverity) else severity
        return self

    def success(self) -> "AuditLogBuilder":
        """Mark as successful outcome."""
        self._outcome = AuditOutcome.SUCCESS.value
        return self

    def failure(self) -> "AuditLogBuilder":
        """Mark as failed outcome."""
        self._outcome = AuditOutcome.FAILURE.value
        return self

    def actor(
        self,
        actor_id: str = None,
        actor_type: str = None,
        email: str = None,
        ip: str = None,
        user_agent: str = None,
    ) -> "AuditLogBuilder":
        """Set actor information."""
        self._actor_id = actor_id
        self._actor_type = actor_type
        self._actor_email = email
        self._actor_ip = ip
        self._actor_user_agent = user_agent
        return self

    def target(
        self,
        target_type: str,
        target_id: str = None,
        target_name: str = None,
    ) -> "AuditLogBuilder":
        """Set target information."""
        self._target_type = target_type
        self._target_id = target_id
        self._target_name = target_name
        return self

    def organization(self, org_id: str) -> "AuditLogBuilder":
        """Set organization context."""
        self._organization_id = org_id
        return self

    def describe(self, description: str) -> "AuditLogBuilder":
        """Set description."""
        self._description = description
        return self

    def changes(self, before: dict = None, after: dict = None) -> "AuditLogBuilder":
        """Set changes (before/after)."""
        self._changes = {"before": before, "after": after}
        return self

    def meta(self, **kwargs) -> "AuditLogBuilder":
        """Add metadata."""
        self._metadata.update(kwargs)
        return self

    def request(
        self,
        request_id: str = None,
        session_id: str = None,
    ) -> "AuditLogBuilder":
        """Set request context."""
        self._request_id = request_id
        self._session_id = session_id
        return self

    def geo(self, country: str = None, city: str = None) -> "AuditLogBuilder":
        """Set geographic information."""
        self._geo_country = country
        self._geo_city = city
        return self

    def build(self) -> AuditLog:
        """Build the AuditLog instance."""
        if not self._event_type:
            raise ValueError("Event type is required")

        return AuditLog(
            event_type=self._event_type,
            event_category=self._event_category,
            severity=self._severity,
            outcome=self._outcome,
            actor_id=self._actor_id,
            actor_type=self._actor_type,
            actor_email=self._actor_email,
            actor_ip=self._actor_ip,
            actor_user_agent=self._actor_user_agent,
            target_type=self._target_type,
            target_id=self._target_id,
            target_name=self._target_name,
            organization_id=self._organization_id,
            description=self._description,
            changes=self._changes,
            metadata=self._metadata if self._metadata else None,
            request_id=self._request_id,
            session_id=self._session_id,
            geo_country=self._geo_country,
            geo_city=self._geo_city,
        )
