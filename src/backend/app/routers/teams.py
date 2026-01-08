"""
Team management API endpoints.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.dependencies.permissions import require_permissions, Permissions
from app.dependencies.org_isolation import (
    EnforcedOrgContext,
    OrgContext,
    OrgScopedQuery,
    get_org_scoped_query,
)
from app.services.team_service import TeamService
from app.models.team import TeamType, TeamStatus, TeamVisibility, TeamMemberRole
from app.schemas.team import (
    TeamResponse,
    TeamListResponse,
    TeamCreateRequest,
    TeamUpdateRequest,
    TeamMemberResponse,
    TeamMemberAddRequest,
    TeamMemberUpdateRequest,
)
from app.schemas.common import (
    PaginatedResponse,
    SuccessResponse,
    create_pagination_meta,
    create_pagination_links,
)
from app.utils.errors import NotFoundError, ConflictError, ValidationError

router = APIRouter(prefix="/v1/teams", tags=["Teams"])


@router.get("", response_model=PaginatedResponse[TeamListResponse])
async def list_teams(
    request: Request,
    user: CurrentUser = Depends(require_permissions(Permissions.READ_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    team_type: Optional[TeamType] = Query(None),
    status: Optional[TeamStatus] = Query(None),
    visibility: Optional[TeamVisibility] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    parent_team_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List teams with pagination and filtering."""
    service = TeamService(db)
    teams, total = await service.list_teams(
        org_context=org_context,
        scoped_query=scoped_query,
        team_type=team_type,
        status=status,
        visibility=visibility,
        search=search,
        parent_team_id=parent_team_id,
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
        data=[TeamListResponse.model_validate(t) for t in teams],
        meta=meta,
        links=links,
    )


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.READ_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Get a team by ID."""
    service = TeamService(db)
    team = await service.get_team_by_id(
        team_id=team_id,
        org_context=org_context,
        scoped_query=scoped_query,
    )

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found",
        )

    return TeamResponse.model_validate(team)


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreateRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team."""
    service = TeamService(db)

    try:
        team = await service.create_team(
            name=data.name,
            slug=data.slug,
            org_context=org_context,
            actor=current_user,
            description=data.description,
            team_type=data.team_type,
            visibility=data.visibility,
            parent_team_id=data.parent_team_id,
            max_members=data.max_members,
            metadata=data.metadata,
            settings=data.settings,
        )
        await db.commit()
        return TeamResponse.model_validate(team)
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    data: TeamUpdateRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.WRITE_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Update a team."""
    service = TeamService(db)

    try:
        team = await service.update_team(
            team_id=team_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            name=data.name,
            description=data.description,
            visibility=data.visibility,
            status=data.status,
            max_members=data.max_members,
            metadata=data.metadata,
            settings=data.settings,
        )
        await db.commit()
        return TeamResponse.model_validate(team)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.delete("/{team_id}", response_model=SuccessResponse)
async def delete_team(
    team_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.DELETE_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    hard_delete: bool = Query(False),
):
    """Delete a team (soft delete by default)."""
    service = TeamService(db)

    try:
        await service.delete_team(
            team_id=team_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            hard_delete=hard_delete,
        )
        await db.commit()
        return SuccessResponse(message=f"Team {team_id} deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.get("/{team_id}/members", response_model=PaginatedResponse[TeamMemberResponse])
async def list_team_members(
    request: Request,
    team_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.READ_TEAMS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
    role: Optional[TeamMemberRole] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """List team members."""
    service = TeamService(db)

    try:
        members, total = await service.get_team_members(
            team_id=team_id,
            org_context=org_context,
            scoped_query=scoped_query,
            role=role,
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
            data=[TeamMemberResponse.model_validate(m) for m in members],
            meta=meta,
            links=links,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: UUID,
    data: TeamMemberAddRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.MANAGE_TEAM_MEMBERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to a team."""
    service = TeamService(db)

    try:
        member = await service.add_member(
            team_id=team_id,
            user_id=data.user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            role=data.role,
            team_permissions=data.team_permissions,
        )
        await db.commit()
        return TeamMemberResponse.model_validate(member)
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
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )


@router.put("/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: UUID,
    user_id: UUID,
    data: TeamMemberUpdateRequest,
    current_user: CurrentUser = Depends(require_permissions(Permissions.MANAGE_TEAM_MEMBERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Update a team member's role."""
    service = TeamService(db)

    try:
        member = await service.update_member_role(
            team_id=team_id,
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
            new_role=data.role,
        )
        await db.commit()
        return TeamMemberResponse.model_validate(member)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )


@router.delete("/{team_id}/members/{user_id}", response_model=SuccessResponse)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(require_permissions(Permissions.MANAGE_TEAM_MEMBERS)),
    org_context: OrgContext = Depends(EnforcedOrgContext),
    scoped_query: OrgScopedQuery = Depends(get_org_scoped_query),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a team."""
    service = TeamService(db)

    try:
        await service.remove_member(
            team_id=team_id,
            user_id=user_id,
            org_context=org_context,
            scoped_query=scoped_query,
            actor=current_user,
        )
        await db.commit()
        return SuccessResponse(message=f"User {user_id} removed from team {team_id}")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )
