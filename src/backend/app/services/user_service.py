"""
User service for user management operations.
Integrates with Auth0 and local database.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserRole, UserStatus
from app.models.audit_log import AuditEventType
from app.dependencies.auth import CurrentUser
from app.dependencies.org_isolation import OrgContext, OrgScopedQuery
from app.services.audit_service import AuditService
from app.utils.logging import get_logger
from app.utils.errors import NotFoundError, ConflictError, ValidationError, ErrorCode

logger = get_logger(__name__)


class UserService:
    """Service for user management operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def get_user_by_id(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        include_roles: bool = True,
    ) -> Optional[User]:
        """Get a user by ID."""
        stmt = select(User).where(User.id == user_id)
        stmt = scoped_query.scope_select(stmt, User)

        if include_roles:
            stmt = stmt.options(selectinload(User.roles))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_auth0_id(
        self,
        auth0_id: str,
        include_roles: bool = True,
    ) -> Optional[User]:
        """Get a user by Auth0 ID (no org scope)."""
        stmt = select(User).where(User.auth0_id == auth0_id)

        if include_roles:
            stmt = stmt.options(selectinload(User.roles))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(
        self,
        email: str,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> Optional[User]:
        """Get a user by email within organization."""
        stmt = select(User).where(User.email == email.lower())
        stmt = scoped_query.scope_select(stmt, User)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_users(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        status: Optional[UserStatus] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[User], int]:
        """
        List users with filtering and pagination.
        Returns (users, total_count).
        """
        stmt = select(User)
        stmt = scoped_query.scope_select(stmt, User)

        # Apply filters
        conditions = []

        if status:
            conditions.append(User.status == status)

        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    User.email.ilike(search_term),
                    User.name.ilike(search_term),
                    User.nickname.ilike(search_term),
                )
            )

        # Exclude soft-deleted
        conditions.append(User.deleted_at.is_(None))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.db.scalar(count_stmt) or 0

        # Add ordering and pagination
        stmt = stmt.order_by(User.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        stmt = stmt.options(selectinload(User.roles))

        result = await self.db.execute(stmt)
        users = list(result.scalars().all())

        return users, total

    async def create_user(
        self,
        auth0_id: str,
        email: str,
        org_context: OrgContext,
        actor: CurrentUser,
        name: Optional[str] = None,
        nickname: Optional[str] = None,
        picture: Optional[str] = None,
        email_verified: bool = False,
        app_metadata: Optional[Dict[str, Any]] = None,
        user_metadata: Optional[Dict[str, Any]] = None,
    ) -> User:
        """Create a new user."""
        # Check for existing user
        existing = await self.get_user_by_auth0_id(auth0_id)
        if existing:
            raise ConflictError(
                message=f"User with auth0_id {auth0_id} already exists",
                code=ErrorCode.RESOURCE_ALREADY_EXISTS,
            )

        user = User(
            auth0_id=auth0_id,
            email=email.lower(),
            name=name,
            nickname=nickname,
            picture=picture,
            email_verified=email_verified,
            organization_id=org_context.org_id,
            status=UserStatus.ACTIVE,
            app_metadata=app_metadata or {},
            user_metadata=user_metadata or {},
        )

        self.db.add(user)
        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.USER_CREATED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=email,
            description=f"User {email} created",
        )

        logger.info(
            "user_created",
            user_id=str(user.id),
            email=email,
            org_id=org_context.org_id,
        )

        return user

    async def update_user(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        name: Optional[str] = None,
        nickname: Optional[str] = None,
        picture: Optional[str] = None,
        user_metadata: Optional[Dict[str, Any]] = None,
    ) -> User:
        """Update user profile."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        before = {
            "name": user.name,
            "nickname": user.nickname,
            "picture": user.picture,
        }

        if name is not None:
            user.name = name
        if nickname is not None:
            user.nickname = nickname
        if picture is not None:
            user.picture = picture
        if user_metadata is not None:
            user.user_metadata = user_metadata

        after = {
            "name": user.name,
            "nickname": user.nickname,
            "picture": user.picture,
        }

        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.USER_UPDATED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=user.email,
            changes={"before": before, "after": after},
            description=f"User {user.email} updated",
        )

        return user

    async def delete_user(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        hard_delete: bool = False,
    ) -> bool:
        """Delete a user (soft delete by default)."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        if hard_delete:
            await self.db.delete(user)
        else:
            user.deleted_at = datetime.utcnow()
            user.deleted_by = actor.sub

        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.USER_DELETED.value,
            actor=actor,
            target_user_id=str(user_id),
            target_email=user.email,
            description=f"User {user.email} {'hard' if hard_delete else 'soft'} deleted",
        )

        logger.info(
            "user_deleted",
            user_id=str(user_id),
            hard_delete=hard_delete,
        )

        return True

    async def block_user(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        reason: Optional[str] = None,
    ) -> User:
        """Block a user."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        user.status = UserStatus.BLOCKED

        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.USER_BLOCKED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=user.email,
            description=f"User {user.email} blocked. Reason: {reason or 'Not specified'}",
        )

        return user

    async def unblock_user(
        self,
        user_id: UUID,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
    ) -> User:
        """Unblock a user."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        user.status = UserStatus.ACTIVE

        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.USER_UNBLOCKED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=user.email,
            description=f"User {user.email} unblocked",
        )

        return user

    async def assign_role(
        self,
        user_id: UUID,
        role_name: str,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
        role_id: Optional[str] = None,
        permissions: Optional[List[str]] = None,
    ) -> UserRole:
        """Assign a role to a user."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        # Check if role already assigned
        for existing_role in user.roles:
            if existing_role.role_name == role_name:
                raise ConflictError(
                    message=f"Role {role_name} already assigned to user",
                    code=ErrorCode.RESOURCE_ALREADY_EXISTS,
                )

        role = UserRole(
            user_id=user.id,
            role_id=role_id,
            role_name=role_name,
            permissions=permissions or [],
        )

        self.db.add(role)
        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.ROLE_ASSIGNED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=user.email,
            changes={"after": {"role": role_name}},
            description=f"Role {role_name} assigned to {user.email}",
        )

        return role

    async def remove_role(
        self,
        user_id: UUID,
        role_name: str,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
        actor: CurrentUser,
    ) -> bool:
        """Remove a role from a user."""
        user = await self.get_user_by_id(user_id, org_context, scoped_query)
        if not user:
            raise NotFoundError(
                message=f"User {user_id} not found",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        role_to_remove = None
        for role in user.roles:
            if role.role_name == role_name:
                role_to_remove = role
                break

        if not role_to_remove:
            raise NotFoundError(
                message=f"Role {role_name} not found on user",
                code=ErrorCode.RESOURCE_NOT_FOUND,
            )

        await self.db.delete(role_to_remove)
        await self.db.flush()

        # Audit log
        await self.audit.log_user_action(
            event_type=AuditEventType.ROLE_REMOVED.value,
            actor=actor,
            target_user_id=str(user.id),
            target_email=user.email,
            changes={"before": {"role": role_name}},
            description=f"Role {role_name} removed from {user.email}",
        )

        return True

    async def update_login_stats(
        self,
        auth0_id: str,
    ) -> Optional[User]:
        """Update user login statistics."""
        user = await self.get_user_by_auth0_id(auth0_id)
        if not user:
            return None

        user.last_login = datetime.utcnow()
        user.logins_count += 1

        await self.db.flush()

        return user

    async def sync_from_auth0(
        self,
        auth0_id: str,
        auth0_data: Dict[str, Any],
    ) -> User:
        """Sync user data from Auth0."""
        user = await self.get_user_by_auth0_id(auth0_id)

        if user:
            # Update existing user
            user.email = auth0_data.get("email", user.email).lower()
            user.email_verified = auth0_data.get("email_verified", user.email_verified)
            user.name = auth0_data.get("name", user.name)
            user.nickname = auth0_data.get("nickname", user.nickname)
            user.picture = auth0_data.get("picture", user.picture)

            if "app_metadata" in auth0_data:
                user.app_metadata = auth0_data["app_metadata"]
            if "user_metadata" in auth0_data:
                user.user_metadata = auth0_data["user_metadata"]
        else:
            # Create new user
            user = User(
                auth0_id=auth0_id,
                email=auth0_data.get("email", "").lower(),
                email_verified=auth0_data.get("email_verified", False),
                name=auth0_data.get("name"),
                nickname=auth0_data.get("nickname"),
                picture=auth0_data.get("picture"),
                organization_id=auth0_data.get("org_id"),
                status=UserStatus.ACTIVE,
                app_metadata=auth0_data.get("app_metadata", {}),
                user_metadata=auth0_data.get("user_metadata", {}),
            )
            self.db.add(user)

        await self.db.flush()

        logger.info(
            "user_synced_from_auth0",
            user_id=str(user.id),
            auth0_id=auth0_id,
        )

        return user

    async def get_user_count(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> int:
        """Get total user count for organization."""
        stmt = select(func.count(User.id)).where(User.deleted_at.is_(None))
        stmt = scoped_query.scope_select(stmt, User)

        return await self.db.scalar(stmt) or 0

    async def get_active_user_count(
        self,
        org_context: OrgContext,
        scoped_query: OrgScopedQuery,
    ) -> int:
        """Get active user count for organization."""
        stmt = select(func.count(User.id)).where(
            and_(
                User.deleted_at.is_(None),
                User.status == UserStatus.ACTIVE,
            )
        )
        stmt = scoped_query.scope_select(stmt, User)

        return await self.db.scalar(stmt) or 0
