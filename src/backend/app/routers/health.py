"""
Health check endpoints.
"""
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings, Settings
from app.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health_check() -> Dict[str, Any]:
    """
    Basic health check endpoint.
    Returns 200 if the service is running.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "auth0-backend",
    }


@router.get("/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Dict[str, Any]:
    """
    Readiness check including database connectivity.
    """
    checks = {
        "database": False,
        "config": False,
    }

    # Check database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        logger.error("database_health_check_failed", error=str(e))

    # Check config
    try:
        checks["config"] = bool(
            settings.AUTH0_DOMAIN and
            settings.AUTH0_AUDIENCE and
            settings.DATABASE_URL
        )
    except Exception as e:
        logger.error("config_health_check_failed", error=str(e))

    all_healthy = all(checks.values())

    if not all_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "checks": checks,
            },
        )

    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }


@router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """
    Liveness check for Kubernetes.
    Returns 200 if the process is alive.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    }
