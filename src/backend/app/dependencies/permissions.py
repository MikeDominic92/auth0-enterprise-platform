"""
RBAC and ABAC permission system for FastAPI.
Implements role-based and attribute-based access control.
"""
from typing import Callable, Any, Optional, List, Dict
from functools import wraps

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import CurrentUser, get_current_user, AuthenticatedUser
from app.database import get_db
from app.utils.errors import AuthorizationError, ErrorCode
from app.utils.logging import get_logger

logger = get_logger(__name__)


# Permission constants
class Permissions:
    """Standard permission constants."""
    # User permissions
    READ_USERS = "read:users"
    WRITE_USERS = "write:users"
    DELETE_USERS = "delete:users"
    MANAGE_USER_ROLES = "manage:user_roles"
    MANAGE_USER_MFA = "manage:user_mfa"

    # Team permissions
    READ_TEAMS = "read:teams"
    WRITE_TEAMS = "write:teams"
    DELETE_TEAMS = "delete:teams"
    MANAGE_TEAM_MEMBERS = "manage:team_members"

    # Organization permissions
    READ_ORGANIZATIONS = "read:organizations"
    WRITE_ORGANIZATIONS = "write:organizations"
    DELETE_ORGANIZATIONS = "delete:organizations"
    MANAGE_ORG_SETTINGS = "manage:org_settings"

    # Audit permissions
    READ_AUDIT_LOGS = "read:audit_logs"
    EXPORT_AUDIT_LOGS = "export:audit_logs"

    # Compliance permissions
    READ_COMPLIANCE = "read:compliance"
    GENERATE_REPORTS = "generate:reports"
    EXPORT_REPORTS = "export:reports"

    # Admin permissions
    ADMIN_ACCESS = "admin:access"
    SYSTEM_ADMIN = "system:admin"


def require_permissions(*required_permissions: str):
    """
    Dependency factory that requires specific permissions.

    Usage:
        @router.get("/users")
        async def list_users(user: CurrentUser = Depends(require_permissions("read:users"))):
            ...
    """
    async def permission_checker(
        request: Request,
        user: AuthenticatedUser,
        db: AsyncSession = Depends(get_db),
    ) -> CurrentUser:
        # Super admin bypasses all permission checks
        if user.is_system_admin:
            logger.info(
                "permission_bypass_super_admin",
                user_id=user.sub,
                permissions=required_permissions,
            )
            # TODO: Log to database audit trail
            return user

        # Check each required permission
        missing = []
        for perm in required_permissions:
            if not user.has_permission(perm):
                missing.append(perm)

        if missing:
            logger.warning(
                "permission_denied",
                user_id=user.sub,
                required=required_permissions,
                missing=missing,
                path=request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {', '.join(missing)}",
            )

        logger.info(
            "permission_granted",
            user_id=user.sub,
            permissions=required_permissions,
        )

        return user

    return permission_checker


def require_any_permission(*permissions: str):
    """
    Dependency factory that requires at least one of the specified permissions.
    """
    async def permission_checker(
        request: Request,
        user: AuthenticatedUser,
    ) -> CurrentUser:
        if user.is_system_admin:
            return user

        if not user.has_any_permission(*permissions):
            logger.warning(
                "permission_denied",
                user_id=user.sub,
                required_any=permissions,
                path=request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(permissions)}",
            )

        return user

    return permission_checker


def require_role(*required_roles: str):
    """
    Dependency factory that requires specific roles.
    """
    async def role_checker(user: AuthenticatedUser) -> CurrentUser:
        if user.is_system_admin:
            return user

        missing = [r for r in required_roles if not user.has_role(r)]

        if missing:
            logger.warning(
                "role_denied",
                user_id=user.sub,
                required=required_roles,
                missing=missing,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required roles: {', '.join(missing)}",
            )

        return user

    return role_checker


# ABAC Policy Types
ABACCondition = Callable[[CurrentUser, Any, Dict[str, Any]], bool]


class ABACPolicies:
    """
    Attribute-Based Access Control policies.
    Each policy is a function that takes (user, resource, context) and returns bool.
    """

    @staticmethod
    def same_organization(user: CurrentUser, resource: Any, context: Dict[str, Any]) -> bool:
        """Check if user belongs to the same organization as the resource."""
        resource_org_id = getattr(resource, "organization_id", None)
        if resource_org_id is None:
            resource_org_id = context.get("organization_id")

        if resource_org_id is None:
            return True  # No org restriction

        return str(user.org_id) == str(resource_org_id)

    @staticmethod
    def owned_by(user: CurrentUser, resource: Any, context: Dict[str, Any]) -> bool:
        """Check if user owns the resource."""
        # Check various owner field names
        owner_id = (
            getattr(resource, "user_id", None) or
            getattr(resource, "owner_id", None) or
            getattr(resource, "created_by", None) or
            context.get("owner_id")
        )

        if owner_id is None:
            return False

        return str(user.sub) == str(owner_id)

    @staticmethod
    def has_attribute(attr_name: str, attr_value: Any) -> ABACCondition:
        """Factory for attribute matching policies."""
        def check(user: CurrentUser, resource: Any, context: Dict[str, Any]) -> bool:
            # Check user metadata
            user_value = user.app_metadata.get(attr_name) or user.user_metadata.get(attr_name)
            return user_value == attr_value
        return check

    @staticmethod
    def all(*conditions: ABACCondition) -> ABACCondition:
        """Combine conditions with AND logic."""
        def check(user: CurrentUser, resource: Any, context: Dict[str, Any]) -> bool:
            return all(c(user, resource, context) for c in conditions)
        return check

    @staticmethod
    def any(*conditions: ABACCondition) -> ABACCondition:
        """Combine conditions with OR logic."""
        def check(user: CurrentUser, resource: Any, context: Dict[str, Any]) -> bool:
            return any(c(user, resource, context) for c in conditions)
        return check


def check_abac(
    user: CurrentUser,
    resource: Any,
    *policies: ABACCondition,
    context: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Check if user passes all ABAC policies for a resource.
    """
    ctx = context or {}

    for policy in policies:
        if not policy(user, resource, ctx):
            return False

    return True


def require_abac(*policies: ABACCondition):
    """
    Dependency factory for ABAC checks.
    Must be combined with a resource provider.

    Usage:
        async def get_team_with_abac(
            team_id: UUID,
            user: CurrentUser = Depends(require_abac(ABACPolicies.same_organization)),
            db: AsyncSession = Depends(get_db),
        ):
            team = await get_team_by_id(db, team_id)
            # ABAC check happens here based on the team
            return team
    """
    def abac_factory(
        resource_getter: Callable[..., Any],
    ):
        """
        Wrap a resource getter with ABAC checks.
        """
        @wraps(resource_getter)
        async def wrapper(
            *args,
            user: AuthenticatedUser,
            **kwargs,
        ):
            # Get the resource
            resource = await resource_getter(*args, **kwargs)

            if resource is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Resource not found",
                )

            # Super admin bypasses ABAC
            if user.is_system_admin:
                return resource

            # Check all policies
            context = {"request_args": args, "request_kwargs": kwargs}
            if not check_abac(user, resource, *policies, context=context):
                logger.warning(
                    "abac_denied",
                    user_id=user.sub,
                    resource_type=type(resource).__name__,
                    resource_id=getattr(resource, "id", None),
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied by policy",
                )

            return resource

        return wrapper

    return abac_factory


class PermissionChecker:
    """
    Class-based permission checker for more complex scenarios.
    Supports combining RBAC and ABAC.
    """

    def __init__(
        self,
        permissions: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        abac_policies: Optional[List[ABACCondition]] = None,
        require_all_permissions: bool = True,
        require_all_roles: bool = True,
    ):
        self.permissions = permissions or []
        self.roles = roles or []
        self.abac_policies = abac_policies or []
        self.require_all_permissions = require_all_permissions
        self.require_all_roles = require_all_roles

    def check_rbac(self, user: CurrentUser) -> bool:
        """Check RBAC permissions and roles."""
        # Super admin passes all checks
        if user.is_system_admin:
            return True

        # Check permissions
        if self.permissions:
            if self.require_all_permissions:
                if not user.has_all_permissions(*self.permissions):
                    return False
            else:
                if not user.has_any_permission(*self.permissions):
                    return False

        # Check roles
        if self.roles:
            has_roles = [user.has_role(r) for r in self.roles]
            if self.require_all_roles:
                if not all(has_roles):
                    return False
            else:
                if not any(has_roles):
                    return False

        return True

    def check_abac(
        self,
        user: CurrentUser,
        resource: Any,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Check ABAC policies."""
        if user.is_system_admin:
            return True

        return check_abac(user, resource, *self.abac_policies, context=context)

    def check(
        self,
        user: CurrentUser,
        resource: Optional[Any] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Check both RBAC and ABAC."""
        if not self.check_rbac(user):
            return False

        if resource is not None and self.abac_policies:
            if not self.check_abac(user, resource, context):
                return False

        return True

    def __call__(
        self,
        user: CurrentUser,
        resource: Optional[Any] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Allow using instance as callable."""
        return self.check(user, resource, context)


# Convenience permission aliases
require_permission = require_permissions  # Alias for single permission

# Pre-configured checkers for common operations
require_admin = require_permissions(Permissions.ADMIN_ACCESS)
require_system_admin = require_permissions(Permissions.SYSTEM_ADMIN)
