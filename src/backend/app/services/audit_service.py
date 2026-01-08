"""
Audit logging service.
Provides methods for creating and querying audit logs.
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import (
    AuditLog,
    AuditLogBuilder,
    AuditEventType,
    AuditSeverity,
    AuditOutcome,
)
from app.dependencies.auth import CurrentUser
from app.dependencies.org_isolation import OrgContext, OrgScopedQuery
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AuditService:
    """Service for audit log operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_log(
        self,
        event_type: str,
        actor: Optional[CurrentUser] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        target_name: Optional[str] = None,
        organization_id: Optional[str] = None,
        description: Optional[str] = None,
        outcome: AuditOutcome = AuditOutcome.SUCCESS,
        severity: AuditSeverity = AuditSeverity.INFO,
        changes: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        geo_country: Optional[str] = None,
        geo_city: Optional[str] = None,
    ) -> AuditLog:
        """
        Create a new audit log entry.
        """
        builder = AuditLogBuilder()
        builder.event(event_type)
        builder.severity(severity)

        if outcome == AuditOutcome.SUCCESS:
            builder.success()
        else:
            builder.failure()

        if actor:
            builder.actor(
                actor_id=actor.sub,
                actor_type="user",
                email=actor.email,
                ip=ip_address,
                user_agent=user_agent,
            )

        if target_type:
            builder.target(target_type, target_id, target_name)

        if organization_id:
            builder.organization(organization_id)

        if description:
            builder.describe(description)

        if changes:
            builder.changes(changes.get("before"), changes.get("after"))

        if metadata:
            builder.meta(**metadata)

        if request_id:
            builder.request(request_id=request_id)

        if geo_country or geo_city:
            builder.geo(country=geo_country, city=geo_city)

        audit_log = builder.build()

        # Calculate hash chain
        audit_log.current_hash = self._calculate_hash(audit_log)
        last_log = await self._get_last_log(organization_id)
        if last_log:
            audit_log.previous_hash = last_log.current_hash

        self.db.add(audit_log)
        await self.db.flush()

        logger.info(
            "audit_log_created",
            event_type=event_type,
            actor_id=actor.sub if actor else None,
            target_type=target_type,
            target_id=target_id,
        )

        return audit_log

    async def log_auth_event(
        self,
        event_type: str,
        user: CurrentUser,
        success: bool = True,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Log authentication event."""
        return await self.create_log(
            event_type=event_type,
            actor=user,
            target_type="user",
            target_id=user.sub,
            organization_id=user.org_id,
            outcome=AuditOutcome.SUCCESS if success else AuditOutcome.FAILURE,
            severity=AuditSeverity.INFO if success else AuditSeverity.WARNING,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    async def log_user_action(
        self,
        event_type: str,
        actor: CurrentUser,
        target_user_id: str,
        target_email: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> AuditLog:
        """Log user management action."""
        return await self.create_log(
            event_type=event_type,
            actor=actor,
            target_type="user",
            target_id=target_user_id,
            target_name=target_email,
            organization_id=actor.org_id,
            changes=changes,
            description=description,
        )

    async def log_team_action(
        self,
        event_type: str,
        actor: CurrentUser,
        team_id: str,
        team_name: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> AuditLog:
        """Log team management action."""
        return await self.create_log(
            event_type=event_type,
            actor=actor,
            target_type="team",
            target_id=team_id,
            target_name=team_name,
            organization_id=actor.org_id,
            changes=changes,
            description=description,
        )

    async def log_access_denied(
        self,
        user: CurrentUser,
        resource_type: str,
        resource_id: Optional[str] = None,
        reason: str = "Permission denied",
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Log access denied event."""
        return await self.create_log(
            event_type=AuditEventType.ACCESS_DENIED.value,
            actor=user,
            target_type=resource_type,
            target_id=resource_id,
            organization_id=user.org_id,
            description=reason,
            outcome=AuditOutcome.FAILURE,
            severity=AuditSeverity.WARNING,
            ip_address=ip_address,
        )

    async def get_logs(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        event_type: Optional[str] = None,
        actor_id: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        severity: Optional[str] = None,
        outcome: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[AuditLog], int]:
        """
        Query audit logs with filters.
        Returns (logs, total_count).
        """
        # Build base query
        stmt = select(AuditLog)
        stmt = scoped_query.scope_select(stmt, AuditLog)

        # Apply filters
        conditions = []

        if event_type:
            conditions.append(AuditLog.event_type == event_type)

        if actor_id:
            conditions.append(AuditLog.actor_id == actor_id)

        if target_type:
            conditions.append(AuditLog.target_type == target_type)

        if target_id:
            conditions.append(AuditLog.target_id == target_id)

        if severity:
            conditions.append(AuditLog.severity == severity)

        if outcome:
            conditions.append(AuditLog.outcome == outcome)

        if start_date:
            conditions.append(AuditLog.timestamp >= start_date)

        if end_date:
            conditions.append(AuditLog.timestamp <= end_date)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.db.scalar(count_stmt) or 0

        # Add ordering and pagination
        stmt = stmt.order_by(desc(AuditLog.timestamp))
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        logs = list(result.scalars().all())

        return logs, total

    async def get_log_by_id(
        self,
        log_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> Optional[AuditLog]:
        """Get a single audit log by ID."""
        stmt = select(AuditLog).where(AuditLog.id == log_id)
        stmt = scoped_query.scope_select(stmt, AuditLog)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_activity(
        self,
        user_id: str,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get audit logs for a specific user."""
        stmt = select(AuditLog).where(
            or_(
                AuditLog.actor_id == user_id,
                and_(AuditLog.target_type == "user", AuditLog.target_id == user_id),
            )
        )
        stmt = scoped_query.scope_select(stmt, AuditLog)
        stmt = stmt.order_by(desc(AuditLog.timestamp)).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_security_events(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        hours: int = 24,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get recent security-related events."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        stmt = select(AuditLog).where(
            and_(
                AuditLog.timestamp >= cutoff,
                or_(
                    AuditLog.event_type.like("auth.%"),
                    AuditLog.event_type.like("access.%"),
                    AuditLog.event_type.like("admin.%"),
                    AuditLog.severity.in_([
                        AuditSeverity.ERROR.value,
                        AuditSeverity.CRITICAL.value,
                        AuditSeverity.ALERT.value,
                    ]),
                )
            )
        )
        stmt = scoped_query.scope_select(stmt, AuditLog)
        stmt = stmt.order_by(desc(AuditLog.timestamp)).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_summary(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Get audit log summary statistics."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Total events
        total_stmt = select(func.count(AuditLog.id)).where(
            AuditLog.timestamp >= cutoff
        )
        if org_context.org_id:
            total_stmt = total_stmt.where(
                AuditLog.organization_id == org_context.org_id
            )
        total = await self.db.scalar(total_stmt) or 0

        # Events by type
        type_stmt = select(
            AuditLog.event_category,
            func.count(AuditLog.id).label("count")
        ).where(AuditLog.timestamp >= cutoff)
        if org_context.org_id:
            type_stmt = type_stmt.where(
                AuditLog.organization_id == org_context.org_id
            )
        type_stmt = type_stmt.group_by(AuditLog.event_category)

        type_result = await self.db.execute(type_stmt)
        by_category = {row[0]: row[1] for row in type_result.all() if row[0]}

        # Failed events
        failed_stmt = select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.timestamp >= cutoff,
                AuditLog.outcome == AuditOutcome.FAILURE.value,
            )
        )
        if org_context.org_id:
            failed_stmt = failed_stmt.where(
                AuditLog.organization_id == org_context.org_id
            )
        failed = await self.db.scalar(failed_stmt) or 0

        # High severity events
        high_severity_stmt = select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.timestamp >= cutoff,
                AuditLog.severity.in_([
                    AuditSeverity.ERROR.value,
                    AuditSeverity.CRITICAL.value,
                    AuditSeverity.ALERT.value,
                ]),
            )
        )
        if org_context.org_id:
            high_severity_stmt = high_severity_stmt.where(
                AuditLog.organization_id == org_context.org_id
            )
        high_severity = await self.db.scalar(high_severity_stmt) or 0

        return {
            "period_days": days,
            "total_events": total,
            "by_category": by_category,
            "failed_events": failed,
            "high_severity_events": high_severity,
        }

    def _calculate_hash(self, audit_log: AuditLog) -> str:
        """Calculate SHA-256 hash for tamper detection."""
        data = {
            "timestamp": audit_log.timestamp.isoformat() if audit_log.timestamp else "",
            "event_type": audit_log.event_type,
            "actor_id": str(audit_log.actor_id) if audit_log.actor_id else "",
            "target_id": audit_log.target_id or "",
            "organization_id": str(audit_log.organization_id) if audit_log.organization_id else "",
            "outcome": audit_log.outcome,
            "description": audit_log.description or "",
        }
        content = json.dumps(data, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    async def _get_last_log(
        self,
        organization_id: Optional[str] = None,
    ) -> Optional[AuditLog]:
        """Get the most recent audit log for hash chain."""
        stmt = select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(1)
        if organization_id:
            stmt = stmt.where(AuditLog.organization_id == organization_id)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def verify_chain_integrity(
        self,
        org_context: OrgContext,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        """Verify the integrity of the audit log hash chain."""
        stmt = select(AuditLog).order_by(AuditLog.timestamp).limit(limit)
        if org_context.org_id:
            stmt = stmt.where(AuditLog.organization_id == org_context.org_id)

        result = await self.db.execute(stmt)
        logs = list(result.scalars().all())

        broken_links = []
        for i, log in enumerate(logs):
            # Verify current hash
            expected_hash = self._calculate_hash(log)
            if log.current_hash and log.current_hash != expected_hash:
                broken_links.append({
                    "id": str(log.id),
                    "issue": "hash_mismatch",
                    "expected": expected_hash,
                    "actual": log.current_hash,
                })

            # Verify chain link
            if i > 0 and log.previous_hash:
                if log.previous_hash != logs[i - 1].current_hash:
                    broken_links.append({
                        "id": str(log.id),
                        "issue": "chain_broken",
                        "expected_previous": logs[i - 1].current_hash,
                        "actual_previous": log.previous_hash,
                    })

        return {
            "verified_count": len(logs),
            "is_valid": len(broken_links) == 0,
            "broken_links": broken_links,
        }
