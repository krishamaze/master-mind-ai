"""Health check endpoint."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from app.models import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return basic service health without external dependencies."""

    return HealthResponse(
        status="healthy",
        service="master-mind-fastapi",
        timestamp=datetime.utcnow(),
    )
