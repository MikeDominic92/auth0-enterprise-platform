"""
User-related Pydantic schemas.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

from app.models.user import UserStatus


class UserRoleResponse(BaseModel):
    """User role response."""
    id: UUID
    role_id: Optional[str] = None
    role_name: str
    permissions: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """User response schema."""
    id: UUID
    auth0_id: str
    email: str
    email_verified: bool
    name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    status: UserStatus
    organization_id: Optional[UUID] = None
    last_login: Optional[datetime] = None
    logins_count: int = 0
    roles: List[UserRoleResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """User list item (condensed)."""
    id: UUID
    email: str
    name: Optional[str] = None
    status: UserStatus
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    """User creation request."""
    auth0_id: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    name: Optional[str] = Field(None, max_length=255)
    nickname: Optional[str] = Field(None, max_length=100)
    picture: Optional[str] = None
    email_verified: bool = False
    app_metadata: Optional[Dict[str, Any]] = None
    user_metadata: Optional[Dict[str, Any]] = None


class UserUpdateRequest(BaseModel):
    """User update request."""
    name: Optional[str] = Field(None, max_length=255)
    nickname: Optional[str] = Field(None, max_length=100)
    picture: Optional[str] = None
    user_metadata: Optional[Dict[str, Any]] = None


class RoleAssignRequest(BaseModel):
    """Role assignment request."""
    role_name: str = Field(..., min_length=1, max_length=100)
    role_id: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleRemoveRequest(BaseModel):
    """Role removal request."""
    role_name: str = Field(..., min_length=1, max_length=100)


class UserBlockRequest(BaseModel):
    """User block request."""
    reason: Optional[str] = Field(None, max_length=500)
