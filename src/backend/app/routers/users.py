"""
User management API endpoints.
"""
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import AuthenticatedUser, CurrentUser
from app.dependencies.permissions import require_permissions, Permissions
from app.dependencies.org_isolation import (
    EnforcedOrgContext,
    OrgContext,
    OrgScopedQuery,
    get_org_scoped_query,
)
from app.services.user_service import UserService
from app.models.user import UserStatus
from app.schemas.user import (
    UserResponse,
    UserListResponse,
    UserCreateRequest,
    UserUpdateRequest,
    RoleAssignRequest,
    RoleRemoveRequest,
    UserBlockRequest,
)
from app.schemas.common import (
    PaginatedResponse,
    SuccessResponse,
    create_pagination_meta,
    create_pagination_links,
)
from app.utils.errors import NotFoundError, ConflictError

router = APIRouter(prefix="/v1/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse[UserListResponse])
async def list_users(
    request: Request,
    user: CurrentUser = Depends(require_permissions(Permissions.READ_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    status: Optional[UserStatus] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List users with pagination and filtering."""
    service = UserService(db)
    users, total = await service.list_users(
        org_context=org_context,
        scoped_query=scoped_query,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    )

    meta = create_pagination_meta(page, page_size, total)
    links = create_pagination_links(
        str(request.url.path),
        page,
        page_size,
        meta.total_pages,
    )

    return PaginatedResponse(
        data=[UserListResponse.model_validate(u) for u in users],
        meta=meta,
        links=links,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.READ_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID."""
    service = UserService(db)
    user = await service.get_user_by_id(
        user_id=user_id,
        org_context=org_context,
        scoped_query=scoped_query,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreateRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user."""
    service = UserService(db)

    try:
        user = await service.create_user(
            auth0_id=data.auth0_id,
            email=data.email,
            org_context=org_context,
            actor=current_user,
            name=data.name,
            nickname=data.nickname,
            picture=data.picture,
            email_verified=data.email_verified,
            app_metadata=data.app_metadata,
            user_metadata=data.user_metadata,
        )
        await db.commit()
        return UserResponse.model_validate(user)
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Update a user."""
    service = UserService(db)

    try:
        user = await service.update_user(
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            name=data.name,
            nickname=data.nickname,
            picture=data.picture,
            user_metadata=data.user_metadata,
        )
        await db.commit()
        return UserResponse.model_validate(user)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.delete("/{user_id}", response_model=SuccessResponse)
async def delete_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.DELETE_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    hard_delete: bool = Query(False),
):
    """Delete a user (soft delete by default)."""
    service = UserService(db)

    try:
        await service.delete_user(
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            hard_delete=hard_delete,
        )
        await db.commit()
        return SuccessResponse(message=f"User {user_id} deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.post("/{user_id}/block", response_model=UserResponse)
async def block_user(
    user_id: UUID,
    data: UserBlockRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Block a user."""
    service = UserService(db)

    try:
        user = await service.block_user(
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            reason=data.reason,
        )
        await db.commit()
        return UserResponse.model_validate(user)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.post("/{user_id}/unblock", response_model=UserResponse)
async def unblock_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_USERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Unblock a user."""
    service = UserService(db)

    try:
        user = await service.unblock_user(
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
        )
        await db.commit()
        return UserResponse.model_validate(user)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.post("/{user_id}/roles", response_model=SuccessResponse)
async def assign_role(
    user_id: UUID,
    data: RoleAssignRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.MANAGE_USER_ROLES)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user."""
    service = UserService(db)

    try:
        await service.assign_role(
            user_id=user_id,
            role_name=data.role_name,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            role_id=data.role_id,
            permissions=data.permissions,
        )
        await db.commit()
        return SuccessResponse(message=f"Role {data.role_name} assigned to user {user_id}")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )


@router.delete("/{user_id}/roles", response_model=SuccessResponse)
async def remove_role(
    user_id: UUID,
    data: RoleRemoveRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.MANAGE_USER_ROLES)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from a user."""
    service = UserService(db)

    try:
        await service.remove_role(
            user_id=user_id,
            role_name=data.role_name,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
        )
        await db.commit()
        return SuccessResponse(message=f"Role {data.role_name} removed from user {user_id}")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: AuthenticatedUser,
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user's information."""
    service = UserService(db)
    user = await service.get_user_by_auth0_id(current_user.auth0_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database",
        )

    return UserResponse.model_validate(user)
