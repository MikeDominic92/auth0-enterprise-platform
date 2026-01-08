"""
User model with Auth0 integration.
Handles user data, roles, and permissions.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.team import TeamMember


class UserStatus(str, Enum):
    """User account status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"
    PENDING = "pending"


class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    User model representing an authenticated user.
    Synced with Auth0 user data.
    """

    __tablename__ = "users"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Auth0 integration
    auth0_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    # Organization (multi-tenant)
    organization_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # User identity
    email: Mapped[str] = mapped_column(
        String(254),
        nullable=False,
        index=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    nickname: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    picture: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Status
    status: Mapped[UserStatus] = mapped_column(
        SQLEnum(UserStatus),
        default=UserStatus.ACTIVE,
        nullable=False,
    )

    # Login tracking
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    logins_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    # Auth0 metadata
    app_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )
    user_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
    )

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        back_populates="users",
    )
    roles: Mapped[List["UserRole"]] = relationship(
        "UserRole",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    team_memberships: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="user",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.auth0_id})>"

    @property
    def display_name(self) -> str:
        """Get display name with fallback."""
        return self.name or self.nickname or self.email.split("@")[0]

    @property
    def is_active(self) -> bool:
        """Check if user is active."""
        return self.status == UserStatus.ACTIVE

    @property
    def is_blocked(self) -> bool:
        """Check if user is blocked."""
        return self.status == UserStatus.BLOCKED

    @property
    def role_names(self) -> List[str]:
        """Get list of role names."""
        return [role.role_name for role in self.roles]

    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role."""
        return role_name.lower() in [r.lower() for r in self.role_names]


class UserRole(Base, TimestampMixin):
    """
    User role assignment.
    Links users to roles with optional organization scoping.
    """

    __tablename__ = "user_roles"

    # Primary key
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # User reference
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role information
    role_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    role_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Permissions (denormalized for quick access)
    permissions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="roles",
    )

    def __repr__(self) -> str:
        return f"<UserRole {self.role_name} for user {self.user_id}>"
