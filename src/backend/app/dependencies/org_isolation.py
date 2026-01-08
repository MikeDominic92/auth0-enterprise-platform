"""
Multi-tenant organization isolation for FastAPI.
Enforces tenant boundaries and provides org-scoped query helpers.
"""
from typing import Optional, Any, Dict, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, Header, status
from sqlalchemy import Select, Insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser, get_current_user, AuthenticatedUser
from app.database import get_db
from app.utils.errors import AuthorizationError, ErrorCode
from app.utils.logging import get_logger

logger = get_logger(__name__)


class OrgContext(BaseModel):
    """Organization context for the current request."""
    org_id: Optional[str] = None
    org_name: Optional[str] = None
    is_override: bool = False
    original_org_id: Optional[str] = None

    @property
    def has_org(self) -> bool:
        """Check if org context is set."""
        return self.org_id is not None

    def validate_org_id(self) -> str:
        """Get org_id or raise if not set."""
        if not self.org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization context required",
            )
        return self.org_id


async def get_org_context(
    request: Request,
    user: AuthenticatedUser,
    x_organization_override: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> OrgContext:
    """
    Get organization context from JWT or header override.

    System admins can use X-Organization-Override header to access
    other organizations. Regular users are restricted to their own org.
    """
    # Default org from user's JWT
    user_org_id = user.org_id

    # Check for override header
    if x_organization_override:
        if not user.is_system_admin:
            logger.warning(
                "org_override_denied",
                user_id=user.sub,
                attempted_org=x_organization_override,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization override requires system admin privileges",
            )

        logger.info(
            "org_override_granted",
            user_id=user.sub,
            original_org=user_org_id,
            override_org=x_organization_override,
        )

        return OrgContext(
            org_id=x_organization_override,
            is_override=True,
            original_org_id=user_org_id,
        )

    return OrgContext(
        org_id=user_org_id,
        is_override=False,
    )


async def enforce_org_isolation(
    request: Request,
    user: AuthenticatedUser,
    x_organization_override: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> OrgContext:
    """
    Enforce organization isolation - requires org context.
    Raises 400 if user has no organization.
    """
    org_ctx = await get_org_context(request, user, x_organization_override, db)

    if not org_ctx.has_org:
        logger.warning(
            "org_context_missing",
            user_id=user.sub,
            path=request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required for this operation",
        )

    # Store in request state for access in route handlers
    request.state.org_context = org_ctx

    return org_ctx


def validate_resource_org(
    resource: Any,
    org_context: OrgContext,
    user: CurrentUser,
) -> bool:
    """
    Validate that a resource belongs to the current organization.

    Args:
        resource: The resource to validate (must have organization_id attribute)
        org_context: Current organization context
        user: Current user

    Returns:
        True if access is allowed

    Raises:
        HTTPException 403 if access denied
    """
    # System admins with override can access any org
    if user.is_system_admin and org_context.is_override:
        return True

    resource_org_id = getattr(resource, "organization_id", None)

    # If resource has no org, it's global - allow access
    if resource_org_id is None:
        return True

    # Check org match
    if str(resource_org_id) != str(org_context.org_id):
        logger.warning(
            "cross_org_access_denied",
            user_id=user.sub,
            user_org=org_context.org_id,
            resource_org=str(resource_org_id),
            resource_type=type(resource).__name__,
            resource_id=getattr(resource, "id", None),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource belongs to different organization",
        )

    return True


class OrgScopedQuery:
    """
    Helper for building organization-scoped database queries.
    Automatically adds organization_id filter to queries.
    """

    def __init__(self, org_context: OrgContext, user: CurrentUser):
        self.org_context = org_context
        self.user = user

    def scope_select(
        self,
        stmt: Select,
        model: Any,
        allow_null_org: bool = False,
    ) -> Select:
        """
        Add organization scope to a SELECT statement.

        Args:
            stmt: SQLAlchemy select statement
            model: Model class being queried
            allow_null_org: If True, also include resources with null organization_id

        Returns:
            Modified select statement with org filter
        """
        if not hasattr(model, "organization_id"):
            return stmt

        # System admin with override can see all orgs
        if self.user.is_system_admin and self.org_context.is_override:
            # If override is set to specific org, filter to that org
            if self.org_context.org_id:
                if allow_null_org:
                    return stmt.where(
                        (model.organization_id == self.org_context.org_id) |
                        (model.organization_id.is_(None))
                    )
                return stmt.where(model.organization_id == self.org_context.org_id)
            # No specific org in override = global access
            return stmt

        # Regular user - strict org isolation
        if not self.org_context.org_id:
            # User has no org - only access null-org resources
            return stmt.where(model.organization_id.is_(None))

        if allow_null_org:
            return stmt.where(
                (model.organization_id == self.org_context.org_id) |
                (model.organization_id.is_(None))
            )

        return stmt.where(model.organization_id == self.org_context.org_id)

    def get_org_filter(self, model: Any) -> Dict[str, Any]:
        """
        Get organization filter dict for simple queries.

        Returns dict suitable for model.filter_by(**filter)
        """
        if not hasattr(model, "organization_id"):
            return {}

        if self.user.is_system_admin and self.org_context.is_override:
            if self.org_context.org_id:
                return {"organization_id": self.org_context.org_id}
            return {}

        return {"organization_id": self.org_context.org_id}

    def validate_insert_data(
        self,
        data: Dict[str, Any],
        require_org: bool = True,
    ) -> Dict[str, Any]:
        """
        Validate and add organization_id to insert data.

        Ensures user can only create resources in their own organization.
        """
        # If data already has org_id, validate it matches context
        if "organization_id" in data and data["organization_id"]:
            if str(data["organization_id"]) != str(self.org_context.org_id):
                if not (self.user.is_system_admin and self.org_context.is_override):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot create resource in different organization",
                    )

        # Add org_id if required and not present
        if require_org and "organization_id" not in data:
            if not self.org_context.org_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Organization context required to create resource",
                )
            data["organization_id"] = self.org_context.org_id

        return data


def build_org_scoped_query(
    org_context: OrgContext,
    user: CurrentUser,
) -> OrgScopedQuery:
    """
    Factory function to create OrgScopedQuery helper.
    """
    return OrgScopedQuery(org_context, user)


# Dependency injection helpers
async def get_org_scoped_query(
    org_context: Annotated[OrgContext, Depends(enforce_org_isolation)],
    user: AuthenticatedUser,
) -> OrgScopedQuery:
    """
    Dependency that provides an OrgScopedQuery helper.
    """
    return OrgScopedQuery(org_context, user)


# Type aliases for dependency injection
EnforcedOrgContext = Annotated[OrgContext, Depends(enforce_org_isolation)]
OptionalOrgContext = Annotated[OrgContext, Depends(get_org_context)]
ScopedQuery = Annotated[OrgScopedQuery, Depends(get_org_scoped_query)]
