"""
FastAPI application entry point.
Auth0 Enterprise Platform - Backend API.
"""
import time
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.database import engine
from app.routers import (
    health_router,
    users_router,
    teams_router,
    audit_router,
    compliance_router,
)
from app.utils.logging import get_logger, configure_logging
from app.utils.errors import AppException, ErrorResponse

# Configure logging
configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(
        "application_starting",
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
    )

    yield

    # Shutdown
    logger.info("application_shutting_down")
    await engine.dispose()


# Create FastAPI application
app = FastAPI(
    title="Auth0 Enterprise Platform API",
    description="Enterprise-grade authentication and authorization platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


# Request ID middleware
class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add request ID to each request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        import uuid
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response


# Request timing middleware
class TimingMiddleware(BaseHTTPMiddleware):
    """Log request timing."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000

        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            request_id=getattr(request.state, "request_id", None),
        )

        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        return response


# Add middlewares
app.add_middleware(RequestIDMiddleware)
app.add_middleware(TimingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


# Exception handlers
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions."""
    from datetime import datetime

    error_response = ErrorResponse(
        error=exc.__class__.__name__,
        code=exc.code.value if exc.code else "UNKNOWN",
        message=exc.message,
        details=exc.details,
        request_id=getattr(request.state, "request_id", None),
        timestamp=datetime.utcnow().isoformat(),
        path=str(request.url.path),
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle request validation errors."""
    from datetime import datetime
    from app.utils.errors import FieldError

    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        details.append(FieldError(
            field=field,
            message=error["msg"],
            code=error["type"],
        ))

    error_response = ErrorResponse(
        error="ValidationError",
        code="VAL_2001",
        message="Request validation failed",
        details=details,
        request_id=getattr(request.state, "request_id", None),
        timestamp=datetime.utcnow().isoformat(),
        path=str(request.url.path),
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response.model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    from datetime import datetime

    logger.exception(
        "unhandled_exception",
        error=str(exc),
        path=request.url.path,
        request_id=getattr(request.state, "request_id", None),
    )

    error_response = ErrorResponse(
        error="InternalServerError",
        code="SRV_9001",
        message="An unexpected error occurred" if not settings.DEBUG else str(exc),
        request_id=getattr(request.state, "request_id", None),
        timestamp=datetime.utcnow().isoformat(),
        path=str(request.url.path),
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response.model_dump(),
    )


# Include routers
app.include_router(health_router)
app.include_router(users_router)
app.include_router(teams_router)
app.include_router(audit_router)
app.include_router(compliance_router)


# Root endpoint
@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "Auth0 Enterprise Platform API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs" if settings.DEBUG else None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
