"""
Team model with membership management.
Supports hierarchical teams and role-based membership.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class TeamType(str, Enum):
    """Type of team."""
    DEPARTMENT = "department"
    PROJECT = "project"
    FUNCTIONAL = "functional"
    CROSS_FUNCTIONAL = "cross_functional"
    TEMPORARY = "temporary"


class TeamVisibility(str, Enum):
    """Team visibility level."""
    PUBLIC = "public"
    PRIVATE = "private"
    HIDDEN = "hidden"


class TeamStatus(str, Enum):
    """Team status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class TeamMemberRole(str, Enum):
    """Role within a team."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class Team(Base, TimestampMixin, SoftDeleteMixin):
    """
    Team model representing a group of users.
    Supports hierarchical organization with parent teams.
    """

    __tablename__ = "teams"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Organization (multi-tenant)
    organization_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Parent team (hierarchical)
    parent_team_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Team details
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Classification
    team_type: Mapped[TeamType] = mapped_column(
        SQLEnum(TeamType),
        default=TeamType.FUNCTIONAL,
        nullable=False,
    )
    visibility: Mapped[TeamVisibility] = mapped_column(
        SQLEnum(TeamVisibility),
        default=TeamVisibility.PRIVATE,
        nullable=False,
    )
    status: Mapped[TeamStatus] = mapped_column(
        SQLEnum(TeamStatus),
        default=TeamStatus.ACTIVE,
        nullable=False,
    )

    # Limits
    max_members: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    # Metadata
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Settings
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        back_populates="teams",
    )
    parent_team: Mapped[Optional["Team"]] = relationship(
        "Team",
        remote_side=[id],
        backref="child_teams",
    )
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    # Unique constraint on slug within organization
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_team_org_slug"),
    )

    def __repr__(self) -> str:
        return f"<Team {self.name} ({self.slug})>"

    @property
    def is_active(self) -> bool:
        """Check if team is active."""
        return self.status == TeamStatus.ACTIVE

    @property
    def member_count(self) -> int:
        """Get number of members."""
        return self.members.count() if hasattr(self.members, "count") else len(list(self.members))


class TeamMember(Base, TimestampMixin):
    """
    Team membership linking users to teams with roles.
    """

    __tablename__ = "team_members"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Team reference
    team_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User reference
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role within team
    role: Mapped[TeamMemberRole] = mapped_column(
        SQLEnum(TeamMemberRole),
        default=TeamMemberRole.MEMBER,
        nullable=False,
    )

    # Membership details
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Additional permissions specific to this team
    team_permissions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
    )

    # Relationships
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="members",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="team_memberships",
    )

    # Unique constraint to prevent duplicate memberships
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    def __repr__(self) -> str:
        return f"<TeamMember {self.user_id} in {self.team_id} as {self.role}>"

    @property
    def is_admin(self) -> bool:
        """Check if member has admin privileges."""
        return self.role in [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
