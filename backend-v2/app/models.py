"""Pydantic models for the FastAPI service."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class UserRequest(BaseModel):
    """Request payload for user-related endpoints."""

    user_id: str = Field(..., min_length=1, max_length=255)


class AppIdsResponse(BaseModel):
    """Response wrapper returning app identifiers for a user."""

    app_ids: List[str]


class AssignmentCreateRequest(BaseModel):
    """Payload for creating an assignment namespace."""

    app_id: str = Field(
        min_length=8,
        pattern=r"^[A-Za-z0-9]{8,}$",
        description="App ID for Mem0 (8+ alphanumeric characters)",
    )
    user_id: str = Field(description="User ID for Mem0")


class AssignmentResponse(BaseModel):
    """Assignment metadata returned after creation."""

    id: str
    app_id: str
    user_id: str
    status: str
    created_at: datetime
    mem0_namespace: str


class EnhanceRequest(BaseModel):
    """Payload for prompt enhancement."""

    prompt: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1, max_length=255)
    app_id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9]{8}$")
    run_id: Optional[str] = None


class EnhanceResponse(BaseModel):
    """Enhanced prompt response."""

    enhanced_prompt: str
    memories_used: int
    processing_time: float


class HealthResponse(BaseModel):
    """Service health report."""

    status: str
    service: str
    timestamp: datetime


class MemoryMetadata(BaseModel):
    """Metadata attached to a memory result."""

    app_id: Optional[str] = None
    assignment_id: Optional[str] = None
    run_id: Optional[str] = None
    source: Optional[str] = None


class MemoryResult(BaseModel):
    """Single memory entry returned from search."""

    id: Optional[str] = None
    content: Optional[str] = None
    score: Optional[float] = None
    metadata: Optional[MemoryMetadata] = None


class MemorySearchRequest(BaseModel):
    """Payload for searching memories."""

    query: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1, max_length=255)
    app_id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9]{8}$")
    run_id: Optional[str] = None
    limit: int = Field(5, ge=1, le=20)


class MemorySearchResponse(BaseModel):
    """Response payload for memory search."""

    results: List[MemoryResult]


__all__ = [
    "AppIdsResponse",
    "AssignmentCreateRequest",
    "AssignmentResponse",
    "EnhanceRequest",
    "EnhanceResponse",
    "HealthResponse",
    "MemoryMetadata",
    "MemoryResult",
    "MemorySearchRequest",
    "MemorySearchResponse",
    "UserRequest",
]
