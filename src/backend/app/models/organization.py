"""
Organization model for multi-tenant support.
Maps to Auth0 Organizations for tenant isolation.
"""
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Integer, Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.team import Team


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    """
    Organization model representing a tenant in the multi-tenant system.
    Maps to Auth0 Organizations.
    """

    __tablename__ = "organizations"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Auth0 integration
    auth0_org_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    # Organization details
    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Subscription and tier
    subscription_tier: Mapped[str] = mapped_column(
        String(50),
        default="free",
        nullable=False,
    )

    # Limits
    max_users: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
    )
    max_teams: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False,
    )
    max_api_calls_per_month: Mapped[int] = mapped_column(
        Integer,
        default=10000,
        nullable=False,
    )

    # Settings stored as JSONB
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Branding
    branding: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Feature flags
    features: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Metadata
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="organization",
        lazy="dynamic",
    )
    teams: Mapped[List["Team"]] = relationship(
        "Team",
        back_populates="organization",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Organization {self.name} ({self.auth0_org_id})>"

    @property
    def tier_limits(self) -> dict:
        """Get limits based on subscription tier."""
        tier_configs = {
            "free": {"max_users": 10, "max_teams": 5, "max_api_calls": 10000},
            "starter": {"max_users": 50, "max_teams": 20, "max_api_calls": 100000},
            "professional": {"max_users": 500, "max_teams": 100, "max_api_calls": 1000000},
            "enterprise": {"max_users": -1, "max_teams": -1, "max_api_calls": -1},  # unlimited
        }
        return tier_configs.get(self.subscription_tier, tier_configs["free"])

    def has_feature(self, feature: str) -> bool:
        """Check if organization has a specific feature enabled."""
        if not self.features:
            return False
        return self.features.get(feature, False)
