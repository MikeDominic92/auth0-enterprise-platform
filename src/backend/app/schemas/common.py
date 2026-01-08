"""
Common Pydantic schemas used across the API.
"""
from datetime import datetime
from typing import Optional, List, Any, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total_items: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool
    has_previous: bool


class PaginationLinks(BaseModel):
    """Pagination links."""
    self: str
    next: Optional[str] = None
    previous: Optional[str] = None
    first: Optional[str] = None
    last: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response format."""
    data: List[T]
    meta: PaginationMeta
    links: PaginationLinks


class FieldError(BaseModel):
    """Field validation error."""
    field: str
    message: str
    code: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    error: str
    code: str
    message: str
    details: Optional[List[FieldError]] = None
    request_id: Optional[str] = None
    timestamp: str
    path: str


class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = True
    message: str


def create_pagination_meta(
    page: int,
    page_size: int,
    total: int,
) -> PaginationMeta:
    """Create pagination metadata."""
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )


def create_pagination_links(
    base_url: str,
    page: int,
    page_size: int,
    total_pages: int,
) -> PaginationLinks:
    """Create pagination links."""
    def make_url(p: int) -> str:
        return f"{base_url}?page={p}&page_size={page_size}"

    links = PaginationLinks(
        self=make_url(page),
        first=make_url(1) if total_pages > 0 else None,
        last=make_url(total_pages) if total_pages > 0 else None,
    )

    if page < total_pages:
        links.next = make_url(page + 1)
    if page > 1:
        links.previous = make_url(page - 1)

    return links
