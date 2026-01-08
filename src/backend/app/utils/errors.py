"""
Custom exception classes and error handling utilities.
Provides consistent error responses across the API.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Application-specific error codes."""

    # Authentication/Authorization (1xxx)
    UNAUTHORIZED = "AUTH_1001"
    FORBIDDEN = "AUTH_1002"
    TOKEN_EXPIRED = "AUTH_1003"
    INVALID_TOKEN = "AUTH_1004"
    INSUFFICIENT_SCOPE = "AUTH_1005"
    INVALID_ALGORITHM = "AUTH_1006"

    # Validation (2xxx)
    VALIDATION_ERROR = "VAL_2001"
    INVALID_INPUT = "VAL_2002"
    MISSING_FIELD = "VAL_2003"
    INVALID_FORMAT = "VAL_2004"

    # Resource (3xxx)
    NOT_FOUND = "RES_3001"
    ALREADY_EXISTS = "RES_3002"
    CONFLICT = "RES_3003"
    GONE = "RES_3004"

    # Business Logic (4xxx)
    OPERATION_NOT_ALLOWED = "BIZ_4001"
    LIMIT_EXCEEDED = "BIZ_4002"
    DEPENDENCY_ERROR = "BIZ_4003"
    CROSS_ORG_ACCESS = "BIZ_4004"

    # External Service (5xxx)
    AUTH0_ERROR = "EXT_5001"
    DATABASE_ERROR = "EXT_5002"
    SERVICE_UNAVAILABLE = "EXT_5003"
    REDIS_ERROR = "EXT_5004"

    # Server (9xxx)
    INTERNAL_ERROR = "SRV_9001"
    NOT_IMPLEMENTED = "SRV_9002"


class FieldError(BaseModel):
    """Individual field validation error."""
    field: str
    message: str
    code: str
    value: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    error: str
    code: str
    message: str
    details: Optional[List[FieldError]] = None
    request_id: Optional[str] = None
    timestamp: str
    path: str


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        details: Optional[List[FieldError]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        self.headers = headers
        super().__init__(message)


class AuthenticationError(AppException):
    """Raised when authentication fails."""

    def __init__(
        self,
        message: str = "Authentication required",
        code: ErrorCode = ErrorCode.UNAUTHORIZED,
    ):
        super().__init__(message=message, code=code, status_code=401)


class AuthorizationError(AppException):
    """Raised when user lacks permission."""

    def __init__(
        self,
        message: str = "Insufficient permissions",
        code: ErrorCode = ErrorCode.FORBIDDEN,
        required_permissions: Optional[List[str]] = None,
    ):
        details = None
        if required_permissions:
            details = [
                FieldError(
                    field="permissions",
                    message=f"Required: {', '.join(required_permissions)}",
                    code="missing_permission"
                )
            ]
        super().__init__(message=message, code=code, status_code=403, details=details)


class NotFoundError(AppException):
    """Raised when a resource is not found."""

    def __init__(
        self,
        resource: str,
        resource_id: str = None,
    ):
        message = f"{resource} not found"
        if resource_id:
            message = f"{resource} with ID '{resource_id}' not found"
        super().__init__(
            message=message,
            code=ErrorCode.NOT_FOUND,
            status_code=404
        )


class ConflictError(AppException):
    """Raised when there is a resource conflict."""

    def __init__(
        self,
        message: str = "Resource conflict",
        code: ErrorCode = ErrorCode.CONFLICT,
    ):
        super().__init__(message=message, code=code, status_code=409)


class ValidationError(AppException):
    """Raised when request validation fails."""

    def __init__(
        self,
        message: str = "Validation error",
        details: Optional[List[FieldError]] = None,
    ):
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=422,
            details=details
        )


class ExternalServiceError(AppException):
    """Raised when an external service call fails."""

    def __init__(
        self,
        service: str,
        message: str = None,
        code: ErrorCode = ErrorCode.SERVICE_UNAVAILABLE,
    ):
        msg = f"External service error: {service}"
        if message:
            msg = f"{msg} - {message}"
        super().__init__(message=msg, code=code, status_code=502)


class Auth0Error(ExternalServiceError):
    """Raised when Auth0 API call fails."""

    def __init__(
        self,
        message: str,
        status_code: int = None,
        error_code: str = None,
    ):
        self.auth0_status_code = status_code
        self.auth0_error_code = error_code
        super().__init__(
            service="Auth0",
            message=message,
            code=ErrorCode.AUTH0_ERROR
        )


class CrossOrgAccessError(AppException):
    """Raised when cross-organization access is attempted."""

    def __init__(
        self,
        message: str = "Cross-organization access denied",
    ):
        super().__init__(
            message=message,
            code=ErrorCode.CROSS_ORG_ACCESS,
            status_code=403
        )


def create_error_response(
    request: Request,
    exc: AppException,
    request_id: str = None,
) -> JSONResponse:
    """
    Create a standardized error response.

    Args:
        request: FastAPI request object
        exc: Application exception
        request_id: Optional request ID for tracing

    Returns:
        JSONResponse with error details
    """
    error_response = ErrorResponse(
        error=exc.__class__.__name__,
        code=exc.code.value,
        message=exc.message,
        details=exc.details,
        request_id=request_id or request.headers.get("x-request-id"),
        timestamp=datetime.utcnow().isoformat() + "Z",
        path=str(request.url.path),
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(exclude_none=True),
        headers=exc.headers,
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """FastAPI exception handler for AppException."""
    return create_error_response(request, exc)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """FastAPI exception handler for HTTPException."""
    # Map HTTPException to AppException
    app_exc = AppException(
        message=str(exc.detail),
        code=ErrorCode.INTERNAL_ERROR,
        status_code=exc.status_code,
    )
    return create_error_response(request, app_exc)


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """FastAPI exception handler for unhandled exceptions."""
    app_exc = AppException(
        message="An unexpected error occurred",
        code=ErrorCode.INTERNAL_ERROR,
        status_code=500,
    )
    return create_error_response(request, app_exc)
