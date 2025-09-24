"""Health check endpoint."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models import HealthResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health, including Mem0 connectivity."""

    service = AsyncMemoryService()
    try:
        mem0_connected = True
        try:
            await service.get_user_app_ids("health_check")
        except Exception:
            mem0_connected = False

        return HealthResponse(
            status="ok",
            service="master-mind-fastapi",
            mem0_connected=mem0_connected,
            timestamp=datetime.utcnow(),
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Health check failed") from exc
