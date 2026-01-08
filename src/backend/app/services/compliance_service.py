"""
Compliance service for generating compliance reports.
Supports SOC 2, HIPAA, GDPR, and other frameworks.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog, AuditEventType, AuditSeverity, AuditOutcome
from app.models.user import User, UserStatus
from app.models.team import Team
from app.dependencies.auth import CurrentUser
from app.dependencies.org_isolation import OrgContext, OrgScopedQuery
from app.services.audit_service import AuditService
from app.utils.logging import get_logger

logger = get_logger(__name__)


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""
    SOC2 = "soc2"
    HIPAA = "hipaa"
    GDPR = "gdpr"
    ISO27001 = "iso27001"
    PCI_DSS = "pci_dss"
    NIST = "nist"


class ControlStatus(str, Enum):
    """Status of a compliance control."""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIAL = "partial"
    NOT_APPLICABLE = "not_applicable"
    PENDING_REVIEW = "pending_review"


class ComplianceService:
    """Service for compliance reporting and analysis."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    # Framework control mappings
    FRAMEWORK_CONTROLS = {
        ComplianceFramework.SOC2: {
            "CC1": {
                "name": "Control Environment",
                "controls": [
                    {"id": "CC1.1", "name": "COSO Principle 1", "description": "Demonstrates commitment to integrity"},
                    {"id": "CC1.2", "name": "COSO Principle 2", "description": "Board oversight"},
                    {"id": "CC1.3", "name": "COSO Principle 3", "description": "Management structure"},
                    {"id": "CC1.4", "name": "COSO Principle 4", "description": "Commitment to competence"},
                    {"id": "CC1.5", "name": "COSO Principle 5", "description": "Accountability"},
                ],
            },
            "CC2": {
                "name": "Communication and Information",
                "controls": [
                    {"id": "CC2.1", "name": "COSO Principle 13", "description": "Quality information"},
                    {"id": "CC2.2", "name": "COSO Principle 14", "description": "Internal communication"},
                    {"id": "CC2.3", "name": "COSO Principle 15", "description": "External communication"},
                ],
            },
            "CC6": {
                "name": "Logical and Physical Access Controls",
                "controls": [
                    {"id": "CC6.1", "name": "Logical access security", "description": "Access control policies"},
                    {"id": "CC6.2", "name": "Access provisioning", "description": "User provisioning/deprovisioning"},
                    {"id": "CC6.3", "name": "Access modification", "description": "Role changes"},
                    {"id": "CC6.6", "name": "System boundaries", "description": "Network security"},
                    {"id": "CC6.7", "name": "Data transmission", "description": "Encryption in transit"},
                ],
            },
            "CC7": {
                "name": "System Operations",
                "controls": [
                    {"id": "CC7.1", "name": "Vulnerability management", "description": "Security monitoring"},
                    {"id": "CC7.2", "name": "Anomaly detection", "description": "Incident detection"},
                    {"id": "CC7.3", "name": "Security incidents", "description": "Incident response"},
                    {"id": "CC7.4", "name": "Incident recovery", "description": "Recovery procedures"},
                ],
            },
        },
        ComplianceFramework.HIPAA: {
            "Administrative": {
                "name": "Administrative Safeguards",
                "controls": [
                    {"id": "164.308(a)(1)", "name": "Security Management", "description": "Risk analysis and management"},
                    {"id": "164.308(a)(3)", "name": "Workforce Security", "description": "Authorization procedures"},
                    {"id": "164.308(a)(4)", "name": "Information Access", "description": "Access authorization"},
                    {"id": "164.308(a)(5)", "name": "Security Awareness", "description": "Training programs"},
                    {"id": "164.308(a)(6)", "name": "Security Incidents", "description": "Incident procedures"},
                ],
            },
            "Technical": {
                "name": "Technical Safeguards",
                "controls": [
                    {"id": "164.312(a)(1)", "name": "Access Control", "description": "Unique user identification"},
                    {"id": "164.312(b)", "name": "Audit Controls", "description": "Activity logging"},
                    {"id": "164.312(c)(1)", "name": "Integrity", "description": "Data integrity mechanisms"},
                    {"id": "164.312(d)", "name": "Authentication", "description": "Person/entity authentication"},
                    {"id": "164.312(e)(1)", "name": "Transmission Security", "description": "Encryption"},
                ],
            },
        },
        ComplianceFramework.GDPR: {
            "Article5": {
                "name": "Principles",
                "controls": [
                    {"id": "Art5.1a", "name": "Lawfulness", "description": "Lawful processing"},
                    {"id": "Art5.1b", "name": "Purpose Limitation", "description": "Specified purposes"},
                    {"id": "Art5.1c", "name": "Data Minimization", "description": "Adequate, relevant, limited"},
                    {"id": "Art5.1d", "name": "Accuracy", "description": "Accurate and up to date"},
                    {"id": "Art5.1f", "name": "Security", "description": "Integrity and confidentiality"},
                ],
            },
            "Article32": {
                "name": "Security of Processing",
                "controls": [
                    {"id": "Art32.1a", "name": "Pseudonymization", "description": "Data pseudonymization"},
                    {"id": "Art32.1b", "name": "CIA", "description": "Confidentiality, integrity, availability"},
                    {"id": "Art32.1c", "name": "Resilience", "description": "System resilience"},
                    {"id": "Art32.1d", "name": "Testing", "description": "Regular testing"},
                ],
            },
        },
    }

    # Event type to control mapping
    CONTROL_EVENT_MAPPING = {
        "CC6.1": [AuditEventType.AUTH_LOGIN_SUCCESS.value, AuditEventType.AUTH_LOGIN_FAILED.value],
        "CC6.2": [AuditEventType.USER_CREATED.value, AuditEventType.USER_DELETED.value],
        "CC6.3": [AuditEventType.ROLE_ASSIGNED.value, AuditEventType.ROLE_REMOVED.value],
        "CC7.2": [AuditEventType.ACCESS_DENIED.value, AuditEventType.AUTH_LOGIN_FAILED.value],
        "164.312(b)": [AuditEventType.AUTH_LOGIN_SUCCESS.value, AuditEventType.USER_UPDATED.value],
        "164.312(a)(1)": [AuditEventType.AUTH_MFA_ENROLLED.value, AuditEventType.AUTH_MFA_CHALLENGE.value],
    }

    async def get_frameworks(self) -> List[Dict[str, Any]]:
        """Get list of supported compliance frameworks."""
        return [
            {
                "id": framework.value,
                "name": framework.name.replace("_", " "),
                "description": f"{framework.name} compliance framework",
            }
            for framework in ComplianceFramework
        ]

    async def get_framework_controls(
        self,
        framework: ComplianceFramework,
    ) -> Dict[str, Any]:
        """Get controls for a specific framework."""
        controls = self.FRAMEWORK_CONTROLS.get(framework, {})
        return {
            "framework": framework.value,
            "categories": controls,
        }

    async def generate_report(
        self,
        framework: ComplianceFramework,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Generate a compliance report for a framework.
        """
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=90)
        if not end_date:
            end_date = datetime.utcnow()

        report_id = str(uuid4())

        # Get audit data
        audit_summary = await self._get_audit_summary(
            org_context, scoped_query, start_date, end_date
        )

        # Get user statistics
        user_stats = await self._get_user_statistics(org_context, scoped_query)

        # Evaluate controls
        controls_status = await self._evaluate_controls(
            framework, org_context, scoped_query, start_date, end_date
        )

        # Calculate overall score
        overall_score = self._calculate_compliance_score(controls_status)

        report = {
            "id": report_id,
            "framework": framework.value,
            "organization_id": org_context.org_id,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": actor.sub,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "overall_score": overall_score,
                "total_controls": len(controls_status),
                "compliant": sum(1 for c in controls_status if c["status"] == ControlStatus.COMPLIANT.value),
                "non_compliant": sum(1 for c in controls_status if c["status"] == ControlStatus.NON_COMPLIANT.value),
                "partial": sum(1 for c in controls_status if c["status"] == ControlStatus.PARTIAL.value),
                "not_applicable": sum(1 for c in controls_status if c["status"] == ControlStatus.NOT_APPLICABLE.value),
            },
            "audit_summary": audit_summary,
            "user_statistics": user_stats,
            "controls": controls_status,
            "recommendations": self._generate_recommendations(controls_status),
        }

        # Log report generation
        await self.audit.create_log(
            event_type=AuditEventType.COMPLIANCE_REPORT_GENERATED.value,
            actor=actor,
            target_type="compliance_report",
            target_id=report_id,
            organization_id=org_context.org_id,
            description=f"Generated {framework.value} compliance report",
            metadata={"framework": framework.value, "period_days": (end_date - start_date).days},
        )

        logger.info(
            "compliance_report_generated",
            report_id=report_id,
            framework=framework.value,
            org_id=org_context.org_id,
            score=overall_score,
        )

        return report

    async def _get_audit_summary(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """Get audit log summary for reporting period."""
        base_conditions = [
            AuditLog.timestamp >= start_date,
            AuditLog.timestamp <= end_date,
        ]
        if org_context.org_id:
            base_conditions.append(AuditLog.organization_id == org_context.org_id)

        # Total events
        total_stmt = select(func.count(AuditLog.id)).where(and_(*base_conditions))
        total = await self.db.scalar(total_stmt) or 0

        # Security events
        security_conditions = base_conditions + [
            AuditLog.event_type.like("auth.%") | AuditLog.event_type.like("access.%")
        ]
        security_stmt = select(func.count(AuditLog.id)).where(and_(*security_conditions))
        security_events = await self.db.scalar(security_stmt) or 0

        # Failed authentications
        failed_auth_conditions = base_conditions + [
            AuditLog.event_type == AuditEventType.AUTH_LOGIN_FAILED.value
        ]
        failed_auth_stmt = select(func.count(AuditLog.id)).where(and_(*failed_auth_conditions))
        failed_auth = await self.db.scalar(failed_auth_stmt) or 0

        # Access denied events
        access_denied_conditions = base_conditions + [
            AuditLog.event_type == AuditEventType.ACCESS_DENIED.value
        ]
        access_denied_stmt = select(func.count(AuditLog.id)).where(and_(*access_denied_conditions))
        access_denied = await self.db.scalar(access_denied_stmt) or 0

        return {
            "total_events": total,
            "security_events": security_events,
            "failed_authentications": failed_auth,
            "access_denied_events": access_denied,
        }

    async def _get_user_statistics(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> Dict[str, Any]:
        """Get user statistics for compliance reporting."""
        base_stmt = select(func.count(User.id)).where(User.deleted_at.is_(None))
        if org_context.org_id:
            base_stmt = base_stmt.where(User.organization_id == org_context.org_id)

        total_users = await self.db.scalar(base_stmt) or 0

        # Active users
        active_stmt = base_stmt.where(User.status == UserStatus.ACTIVE)
        active_users = await self.db.scalar(active_stmt) or 0

        # Blocked users
        blocked_stmt = select(func.count(User.id)).where(
            and_(
                User.deleted_at.is_(None),
                User.status == UserStatus.BLOCKED,
            )
        )
        if org_context.org_id:
            blocked_stmt = blocked_stmt.where(User.organization_id == org_context.org_id)
        blocked_users = await self.db.scalar(blocked_stmt) or 0

        # Users with verified email
        verified_stmt = select(func.count(User.id)).where(
            and_(
                User.deleted_at.is_(None),
                User.email_verified == True,
            )
        )
        if org_context.org_id:
            verified_stmt = verified_stmt.where(User.organization_id == org_context.org_id)
        verified_users = await self.db.scalar(verified_stmt) or 0

        return {
            "total_users": total_users,
            "active_users": active_users,
            "blocked_users": blocked_users,
            "email_verified_users": verified_users,
            "verification_rate": (verified_users / total_users * 100) if total_users > 0 else 0,
        }

    async def _evaluate_controls(
        self,
        framework: ComplianceFramework,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        start_date: datetime,
        end_date: datetime,
    ) -> List[Dict[str, Any]]:
        """Evaluate compliance controls for a framework."""
        controls_status = []
        framework_controls = self.FRAMEWORK_CONTROLS.get(framework, {})

        for category_id, category_data in framework_controls.items():
            for control in category_data.get("controls", []):
                control_id = control["id"]

                # Get relevant events for this control
                event_types = self.CONTROL_EVENT_MAPPING.get(control_id, [])
                evidence_count = 0

                if event_types:
                    conditions = [
                        AuditLog.timestamp >= start_date,
                        AuditLog.timestamp <= end_date,
                        AuditLog.event_type.in_(event_types),
                    ]
                    if org_context.org_id:
                        conditions.append(AuditLog.organization_id == org_context.org_id)

                    count_stmt = select(func.count(AuditLog.id)).where(and_(*conditions))
                    evidence_count = await self.db.scalar(count_stmt) or 0

                # Determine control status based on evidence
                status = self._determine_control_status(control_id, evidence_count)

                controls_status.append({
                    "category": category_id,
                    "category_name": category_data["name"],
                    "control_id": control_id,
                    "control_name": control["name"],
                    "description": control["description"],
                    "status": status.value,
                    "evidence_count": evidence_count,
                    "last_evaluated": datetime.utcnow().isoformat(),
                })

        return controls_status

    def _determine_control_status(
        self,
        control_id: str,
        evidence_count: int,
    ) -> ControlStatus:
        """Determine control status based on evidence."""
        # Simple logic - can be enhanced based on specific control requirements
        if evidence_count >= 100:
            return ControlStatus.COMPLIANT
        elif evidence_count >= 10:
            return ControlStatus.PARTIAL
        elif evidence_count > 0:
            return ControlStatus.PENDING_REVIEW
        else:
            # No evidence - might be N/A or non-compliant depending on control
            return ControlStatus.NOT_APPLICABLE

    def _calculate_compliance_score(
        self,
        controls_status: List[Dict[str, Any]],
    ) -> float:
        """Calculate overall compliance score (0-100)."""
        if not controls_status:
            return 0.0

        weights = {
            ControlStatus.COMPLIANT.value: 1.0,
            ControlStatus.PARTIAL.value: 0.5,
            ControlStatus.PENDING_REVIEW.value: 0.25,
            ControlStatus.NON_COMPLIANT.value: 0.0,
            ControlStatus.NOT_APPLICABLE.value: None,  # Excluded from calculation
        }

        total_weight = 0.0
        total_score = 0.0

        for control in controls_status:
            weight = weights.get(control["status"])
            if weight is not None:
                total_weight += 1.0
                total_score += weight

        if total_weight == 0:
            return 100.0  # All controls N/A

        return round((total_score / total_weight) * 100, 2)

    def _generate_recommendations(
        self,
        controls_status: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on control status."""
        recommendations = []

        for control in controls_status:
            if control["status"] == ControlStatus.NON_COMPLIANT.value:
                recommendations.append({
                    "priority": "high",
                    "control_id": control["control_id"],
                    "control_name": control["control_name"],
                    "recommendation": f"Implement {control['description']} to achieve compliance",
                    "impact": "Critical for compliance certification",
                })
            elif control["status"] == ControlStatus.PARTIAL.value:
                recommendations.append({
                    "priority": "medium",
                    "control_id": control["control_id"],
                    "control_name": control["control_name"],
                    "recommendation": f"Enhance {control['description']} coverage",
                    "impact": "Improve compliance posture",
                })
            elif control["status"] == ControlStatus.PENDING_REVIEW.value:
                recommendations.append({
                    "priority": "low",
                    "control_id": control["control_id"],
                    "control_name": control["control_name"],
                    "recommendation": f"Review evidence for {control['control_name']}",
                    "impact": "Validate compliance status",
                })

        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 99))

        return recommendations

    async def calculate_audit_readiness(
        self,
        framework: ComplianceFramework,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> Dict[str, Any]:
        """Calculate audit readiness score."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=90)

        controls_status = await self._evaluate_controls(
            framework, org_context, scoped_query, start_date, end_date
        )

        overall_score = self._calculate_compliance_score(controls_status)

        # Categorize readiness
        if overall_score >= 90:
            readiness_level = "Audit Ready"
            readiness_color = "green"
        elif overall_score >= 70:
            readiness_level = "Nearly Ready"
            readiness_color = "yellow"
        elif overall_score >= 50:
            readiness_level = "Needs Work"
            readiness_color = "orange"
        else:
            readiness_level = "Not Ready"
            readiness_color = "red"

        return {
            "framework": framework.value,
            "score": overall_score,
            "readiness_level": readiness_level,
            "readiness_color": readiness_color,
            "evaluated_at": datetime.utcnow().isoformat(),
            "period_days": 90,
            "summary": {
                "total_controls": len(controls_status),
                "compliant": sum(1 for c in controls_status if c["status"] == ControlStatus.COMPLIANT.value),
                "needs_attention": sum(1 for c in controls_status if c["status"] in [
                    ControlStatus.NON_COMPLIANT.value,
                    ControlStatus.PARTIAL.value,
                ]),
            },
        }
