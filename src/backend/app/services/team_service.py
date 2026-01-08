"""
Team service for team management operations.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.team import Team, TeamMember, TeamType, TeamVisibility, TeamStatus, TeamMemberRole
from app.models.user import User
from app.models.audit_log import AuditEventType
from app.dependencies.auth import CurrentUser
from app.dependencies.org_isolation import OrgContext, OrgScopedQuery
from app.services.audit_service import AuditService
from app.utils.logging import get_logger
from app.utils.errors import NotFoundError, ConflictError, ValidationError, ErrorCode

logger = get_logger(__name__)


class TeamService:
    """Service for team management operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def get_team_by_id(
        self,
        team_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        include_members: bool = False,
    ) -> Optional[Team]:
        """Get a team by ID."""
        stmt = select(Team).where(
            and_(
                Team.id == team_id,
                Team.deleted_at.is_(None),
            )
        )
        stmt = scoped_query.scope_select(stmt, Team)

        if include_members:
            stmt = stmt.options(selectinload(Team.members).selectinload(TeamMember.user))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_team_by_slug(
        self,
        slug: str,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> Optional[Team]:
        """Get a team by slug within organization."""
        stmt = select(Team).where(
            and_(
                Team.slug == slug,
                Team.deleted_at.is_(None),
            )
        )
        stmt = scoped_query.scope_select(stmt, Team)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_teams(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        team_type: Optional[TeamType] = None,
        status: Optional[TeamStatus] = None,
        visibility: Optional[TeamVisibility] = None,
        search: Optional[str] = None,
        parent_team_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Team], int]:
        """
        List teams with filtering and pagination.
        Returns (teams, total_count).
        """
        stmt = select(Team)
        stmt = scoped_query.scope_select(stmt, Team)

        # Apply filters
        conditions = [Team.deleted_at.is_(None)]

        if team_type:
            conditions.append(Team.team_type == team_type)

        if status:
            conditions.append(Team.status == status)

        if visibility:
            conditions.append(Team.visibility == visibility)

        if parent_team_id:
            conditions.append(Team.parent_team_id == parent_team_id)

        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    Team.name.ilike(search_term),
                    Team.description.ilike(search_term),
                )
            )

        stmt = stmt.where(and_(*conditions))

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.db.scalar(count_stmt) or 0

        # Add ordering and pagination
        stmt = stmt.order_by(Team.name)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        teams = list(result.scalars().all())

        return teams, total

    async def create_team(
        self,
        name: str,
        slug: str,
        org_context: OrgContext,
        actor: CurrentUser,
        description: Optional[str] = None,
        team_type: TeamType = TeamType.FUNCTIONAL,
        visibility: TeamVisibility = TeamVisibility.PRIVATE,
        parent_team_id: Optional[UUID] = None,
        max_members: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Team:
        """Create a new team."""
        scoped_query = OrgScopedQuery(org_context, actor)

        # Check for existing team with same slug
        existing = await self.get_team_by_slug(slug, org_context, scoped_query)
        if existing:
            raise ConflictError(
                message=f"Team with slug '{slug}' already exists",
                code=ErrorCode.RESOURCE_ALREADY_EXISTS,
            )

        # Validate parent team if specified
        if parent_team_id:
            parent = await self.get_team_by_id(parent_team_id, org_context, scoped_query)
            if not parent:
                raise NotFoundError(
                    message=f"Parent team {parent_team_id} not found",
                    code=ErrorCode.RESOURCE_NOT_FOUND,
                )

        team = Team(
            name=name,
            slug=slug,
            description=description,
            team_type=team_type,
            visibility=visibility,
            status=TeamStatus.ACTIVE,
            organization_id=org_context.org_id,
            parent_team_id=parent_team_id,
            max_members=max_members,
            metadata=metadata or {},
            settings=settings or {},
        )

        self.db.add(team)
        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_CREATED.value,
            actor=actor,
            team_id=str(team.id),
            team_name=team.name,
            description=f"Team '{team.name}' created",
        )

        logger.info(
            "team_created",
            team_id=str(team.id),
            name=name,
            org_id=org_context.org_id,
        )

        return team

    async def update_team(
        self,
        team_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        name: Optional[str] = None,
        description: Optional[str] = None,
        visibility: Optional[TeamVisibility] = None,
        status: Optional[TeamStatus] = None,
        max_members: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Team:
        """Update team details."""
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        before = {
            "name": team.name,
            "description": team.description,
            "visibility": team.visibility.value if team.visibility else None,
            "status": team.status.value if team.status else None,
        }

        if name is not None:
            team.name = name
        if description is not None:
            team.description = description
        if visibility is not None:
            team.visibility = visibility
        if status is not None:
            team.status = status
        if max_members is not None:
            team.max_members = max_members
        if metadata is not None:
            team.metadata = metadata
        if settings is not None:
            team.settings = settings

        after = {
            "name": team.name,
            "description": team.description,
            "visibility": team.visibility.value if team.visibility else None,
            "status": team.status.value if team.status else None,
        }

        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_UPDATED.value,
            actor=actor,
            team_id=str(team.id),
            team_name=team.name,
            changes={"before": before, "after": after},
            description=f"Team '{team.name}' updated",
        )

        return team

    async def delete_team(
        self,
        team_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        hard_delete: bool = False,
    ) -> bool:
        """Delete a team (soft delete by default)."""
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        team_name = team.name

        if hard_delete:
            await self.db.delete(team)
        else:
            team.deleted_at = datetime.utcnow()
            team.deleted_by = actor.sub

        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_DELETED.value,
            actor=actor,
            team_id=str(team_id),
            team_name=team_name,
            description=f"Team '{team_name}' {'hard' if hard_delete else 'soft'} deleted",
        )

        logger.info(
            "team_deleted",
            team_id=str(team_id),
            hard_delete=hard_delete,
        )

        return True

    async def get_team_members(
        self,
        team_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        role: Optional[TeamMemberRole] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[TeamMember], int]:
        """Get team members with pagination."""
        # First verify team exists and belongs to org
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        stmt = select(TeamMember).where(TeamMember.team_id == team_id)

        if role:
            stmt = stmt.where(TeamMember.role == role)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.db.scalar(count_stmt) or 0

        # Add ordering and pagination
        stmt = stmt.order_by(TeamMember.joined_at)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        stmt = stmt.options(selectinload(TeamMember.user))

        result = await self.db.execute(stmt)
        members = list(result.scalars().all())

        return members, total

    async def add_member(
        self,
        team_id: UUID,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        role: TeamMemberRole = TeamMemberRole.MEMBER,
        team_permissions: Optional[List[str]] = None,
    ) -> TeamMember:
        """Add a member to a team."""
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        # Check if user is already a member
        existing_stmt = select(TeamMember).where(
            and_(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        existing = await self.db.execute(existing_stmt)
        if existing.scalar_one_or_none():
            raise ConflictError(
                message="User is already a member of this team",
                code=ErrorCode.RESOURCE_ALREADY_EXISTS,
            )

        # Check max members limit
        if team.max_members:
            member_count = team.member_count
            if member_count >= team.max_members:
                raise ValidationError(
                    message=f"Team has reached maximum member limit ({team.max_members})",
                    code=ErrorCode.VALIDATION_ERROR,
                )

        member = TeamMember(
            team_id=team_id,
            user_id=user_id,
            role=role,
            team_permissions=team_permissions or [],
        )

        self.db.add(member)
        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_MEMBER_ADDED.value,
            actor=actor,
            team_id=str(team_id),
            team_name=team.name,
            changes={"after": {"user_id": str(user_id), "role": role.value}},
            description=f"User {user_id} added to team '{team.name}' as {role.value}",
        )

        logger.info(
            "team_member_added",
            team_id=str(team_id),
            user_id=str(user_id),
            role=role.value,
        )

        return member

    async def remove_member(
        self,
        team_id: UUID,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
    ) -> bool:
        """Remove a member from a team."""
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        stmt = select(TeamMember).where(
            and_(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        result = await self.db.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                message="User is not a member of this team",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        await self.db.delete(member)
        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_MEMBER_REMOVED.value,
            actor=actor,
            team_id=str(team_id),
            team_name=team.name,
            changes={"before": {"user_id": str(user_id)}},
            description=f"User {user_id} removed from team '{team.name}'",
        )

        logger.info(
            "team_member_removed",
            team_id=str(team_id),
            user_id=str(user_id),
        )

        return True

    async def update_member_role(
        self,
        team_id: UUID,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        new_role: TeamMemberRole,
    ) -> TeamMember:
        """Update a team member's role."""
        team = await self.get_team_by_id(team_id, org_context, scoped_query)
        if not team:
            raise NotFoundError(
                message=f"Team {team_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        stmt = select(TeamMember).where(
            and_(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        result = await self.db.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                message="User is not a member of this team",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        old_role = member.role
        member.role = new_role

        await self.db.flush()

        # Audit log
        await self.audit.log_team_action(
            event_type=AuditEventType.TEAM_UPDATED.value,
            actor=actor,
            team_id=str(team_id),
            team_name=team.name,
            changes={
                "before": {"user_id": str(user_id), "role": old_role.value},
                "after": {"user_id": str(user_id), "role": new_role.value},
            },
            description=f"User {user_id} role changed from {old_role.value} to {new_role.value}",
        )

        return member

    async def get_user_teams(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> List[Team]:
        """Get all teams a user belongs to."""
        stmt = (
            select(Team)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(
                and_(
                    TeamMember.user_id == user_id,
                    Team.deleted_at.is_(None),
                )
            )
        )
        stmt = scoped_query.scope_select(stmt, Team)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_team_count(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> int:
        """Get total team count for organization."""
        stmt = select(func.count(Team.id)).where(Team.deleted_at.is_(None))
        stmt = scoped_query.scope_select(stmt, Team)

        return await self.db.scalar(stmt) or 0
