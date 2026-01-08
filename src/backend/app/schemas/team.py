"""
Team-related Pydantic schemas.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.team import TeamType, TeamVisibility, TeamStatus, TeamMemberRole


class TeamMemberUserResponse(BaseModel):
    """User info within team member response."""
    id: UUID
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None

    class Config:
        from_attributes = True


class TeamMemberResponse(BaseModel):
    """Team member response."""
    id: UUID
    user_id: UUID
    role: TeamMemberRole
    joined_at: datetime
    team_permissions: List[str] = []
    user: Optional[TeamMemberUserResponse] = None

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    """Team response schema."""
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    team_type: TeamType
    visibility: TeamVisibility
    status: TeamStatus
    organization_id: Optional[UUID] = None
    parent_team_id: Optional[UUID] = None
    max_members: Optional[int] = None
    member_count: int = 0
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamListResponse(BaseModel):
    """Team list item (condensed)."""
    id: UUID
    name: str
    slug: str
    team_type: TeamType
    status: TeamStatus
    member_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class TeamCreateRequest(BaseModel):
    """Team creation request."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=1000)
    team_type: TeamType = TeamType.FUNCTIONAL
    visibility: TeamVisibility = TeamVisibility.PRIVATE
    parent_team_id: Optional[UUID] = None
    max_members: Optional[int] = Field(None, ge=1)
    metadata: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class TeamUpdateRequest(BaseModel):
    """Team update request."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[TeamVisibility] = None
    status: Optional[TeamStatus] = None
    max_members: Optional[int] = Field(None, ge=1)
    metadata: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class TeamMemberAddRequest(BaseModel):
    """Add member to team request."""
    user_id: UUID
    role: TeamMemberRole = TeamMemberRole.MEMBER
    team_permissions: Optional[List[str]] = None


class TeamMemberUpdateRequest(BaseModel):
    """Update team member request."""
    role: TeamMemberRole
