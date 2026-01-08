"""
JWT authentication dependency for FastAPI.
Validates Auth0 tokens with RS256 algorithm enforcement.
"""
import time
from typing import Optional, Dict, Any, Annotated
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk, JWTError
from jose.exceptions import ExpiredSignatureError, JWTClaimsError
from pydantic import BaseModel

from app.config import get_settings, Settings
from app.utils.errors import AuthenticationError, ErrorCode
from app.utils.logging import get_logger

logger = get_logger(__name__)

# Security scheme
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Validated user from JWT token."""
    sub: str  # Auth0 user ID
    email: Optional[str] = None
    email_verified: bool = False
    name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    org_id: Optional[str] = None
    permissions: list[str] = []
    roles: list[str] = []
    app_metadata: Dict[str, Any] = {}
    user_metadata: Dict[str, Any] = {}
    raw_token: str = ""

    @property
    def auth0_id(self) -> str:
        """Alias for sub (Auth0 user ID)."""
        return self.sub

    @property
    def is_system_admin(self) -> bool:
        """Check if user has system admin role."""
        return "system_admin" in self.roles or "super_admin" in self.roles

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        return permission in self.permissions

    def has_any_permission(self, *permissions: str) -> bool:
        """Check if user has any of the specified permissions."""
        return any(p in self.permissions for p in permissions)

    def has_all_permissions(self, *permissions: str) -> bool:
        """Check if user has all specified permissions."""
        return all(p in self.permissions for p in permissions)

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role."""
        return role in self.roles


class JWKSClient:
    """
    JWKS client for fetching and caching Auth0 public keys.
    Implements caching with automatic refresh.
    """

    def __init__(self, jwks_url: str, cache_ttl: int = 3600):
        self.jwks_url = jwks_url
        self.cache_ttl = cache_ttl
        self._keys: Dict[str, Any] = {}
        self._last_fetch: float = 0

    async def get_signing_key(self, kid: str) -> Optional[Dict[str, Any]]:
        """Get signing key by key ID, fetching if needed."""
        # Check if cache is valid
        if time.time() - self._last_fetch > self.cache_ttl or kid not in self._keys:
            await self._fetch_keys()

        return self._keys.get(kid)

    async def _fetch_keys(self) -> None:
        """Fetch JWKS from Auth0."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.jwks_url)
                response.raise_for_status()
                jwks_data = response.json()

                # Index keys by kid
                self._keys = {}
                for key in jwks_data.get("keys", []):
                    if key.get("kid"):
                        self._keys[key["kid"]] = key

                self._last_fetch = time.time()
                logger.info("jwks_fetched", key_count=len(self._keys))

        except httpx.HTTPError as e:
            logger.error("jwks_fetch_failed", error=str(e))
            # Keep existing keys if fetch fails
            if not self._keys:
                raise AuthenticationError(
                    message="Unable to fetch authentication keys",
                    code=ErrorCode.AUTH_TOKEN_INVALID,
                )


# Global JWKS client instance (lazy initialization)
_jwks_client: Optional[JWKSClient] = None


def get_jwks_client(settings: Settings) -> JWKSClient:
    """Get or create JWKS client singleton."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
        _jwks_client = JWKSClient(jwks_url)
    return _jwks_client


def validate_algorithm(token: str) -> str:
    """
    Validate that the token uses RS256 algorithm.
    Prevents algorithm confusion attacks.
    """
    try:
        # Decode header without verification
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")

        if alg != "RS256":
            logger.warning("invalid_algorithm", algorithm=alg)
            raise AuthenticationError(
                message="Invalid token algorithm",
                code=ErrorCode.AUTH_TOKEN_INVALID,
            )

        return header.get("kid", "")

    except JWTError as e:
        logger.warning("token_header_invalid", error=str(e))
        raise AuthenticationError(
            message="Invalid token format",
            code=ErrorCode.AUTH_TOKEN_INVALID,
        )


async def validate_token(
    token: str,
    settings: Settings,
) -> Dict[str, Any]:
    """
    Validate JWT token against Auth0 JWKS.

    Enforces:
    - RS256 algorithm only
    - Valid signature
    - Correct issuer and audience
    - Token not expired (with clock tolerance)
    """
    # Validate algorithm and get key ID
    kid = validate_algorithm(token)

    # Get signing key
    jwks_client = get_jwks_client(settings)
    signing_key = await jwks_client.get_signing_key(kid)

    if not signing_key:
        logger.warning("signing_key_not_found", kid=kid)
        raise AuthenticationError(
            message="Unable to verify token signature",
            code=ErrorCode.AUTH_TOKEN_INVALID,
        )

    try:
        # Convert JWK to PEM format for jose
        public_key = jwk.construct(signing_key)

        # Decode and validate token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.AUTH0_AUDIENCE,
            issuer=settings.AUTH0_ISSUER,
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "leeway": settings.CLOCK_TOLERANCE_SECONDS,
            },
        )

        return payload

    except ExpiredSignatureError:
        logger.info("token_expired")
        raise AuthenticationError(
            message="Token has expired",
            code=ErrorCode.AUTH_TOKEN_EXPIRED,
        )
    except JWTClaimsError as e:
        logger.warning("token_claims_invalid", error=str(e))
        raise AuthenticationError(
            message="Invalid token claims",
            code=ErrorCode.AUTH_TOKEN_INVALID,
        )
    except JWTError as e:
        logger.warning("token_validation_failed", error=str(e))
        raise AuthenticationError(
            message="Token validation failed",
            code=ErrorCode.AUTH_TOKEN_INVALID,
        )


def extract_user_from_token(
    payload: Dict[str, Any],
    token: str,
    settings: Settings,
) -> CurrentUser:
    """Extract CurrentUser from validated token payload."""
    namespace = settings.AUTH0_CLAIMS_NAMESPACE

    # Extract standard claims
    sub = payload.get("sub", "")
    email = payload.get("email") or payload.get(f"{namespace}/email")
    email_verified = payload.get("email_verified", False) or payload.get(f"{namespace}/email_verified", False)
    name = payload.get("name") or payload.get(f"{namespace}/name")
    nickname = payload.get("nickname") or payload.get(f"{namespace}/nickname")
    picture = payload.get("picture") or payload.get(f"{namespace}/picture")

    # Extract org context
    org_id = payload.get("org_id") or payload.get(f"{namespace}/org_id")

    # Extract permissions and roles from namespaced claims
    permissions = payload.get("permissions", []) or payload.get(f"{namespace}/permissions", [])
    roles = payload.get(f"{namespace}/roles", [])

    # Extract metadata
    app_metadata = payload.get(f"{namespace}/app_metadata", {})
    user_metadata = payload.get(f"{namespace}/user_metadata", {})

    return CurrentUser(
        sub=sub,
        email=email,
        email_verified=email_verified,
        name=name,
        nickname=nickname,
        picture=picture,
        org_id=org_id,
        permissions=permissions if isinstance(permissions, list) else [],
        roles=roles if isinstance(roles, list) else [],
        app_metadata=app_metadata if isinstance(app_metadata, dict) else {},
        user_metadata=user_metadata if isinstance(user_metadata, dict) else {},
        raw_token=token,
    )


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    """
    FastAPI dependency to get the current authenticated user.
    Raises 401 if no valid token is provided.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Validate token
        payload = await validate_token(token, settings)

        # Extract user
        user = extract_user_from_token(payload, token, settings)

        # Store user in request state for access in other dependencies
        request.state.current_user = user

        logger.info(
            "user_authenticated",
            user_id=user.sub,
            org_id=user.org_id,
        )

        return user

    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Optional[CurrentUser]:
    """
    FastAPI dependency to get the current user if authenticated.
    Returns None if no token is provided (does not raise).
    """
    if not credentials:
        return None

    try:
        return await get_current_user(request, credentials, settings)
    except HTTPException:
        return None


def require_verified_email(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    """
    Dependency that requires the user's email to be verified.
    """
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required",
        )
    return user


# Type alias for dependency injection
AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
OptionalUser = Annotated[Optional[CurrentUser], Depends(get_current_user_optional)]
VerifiedUser = Annotated[CurrentUser, Depends(require_verified_email)]
