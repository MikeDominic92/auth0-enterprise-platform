"""
FastAPI routers for API endpoints.
"""
from app.routers.health import router as health_router
from app.routers.users import router as users_router
from app.routers.teams import router as teams_router
from app.routers.audit import router as audit_router
from app.routers.compliance import router as compliance_router

__all__ = [
    "health_router",
    "users_router",
    "teams_router",
    "audit_router",
    "compliance_router",
]
