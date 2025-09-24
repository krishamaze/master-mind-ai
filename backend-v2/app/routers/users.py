"""User-related API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from app.models import AppIdsResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["users"])


@router.get("/users/{user_id}/app-ids", response_model=AppIdsResponse)
async def get_user_app_ids(
    user_id: str = Path(..., min_length=1, max_length=255)
) -> AppIdsResponse:
    """Return all app IDs associated with the user."""

    service = AsyncMemoryService()
    try:
        app_ids = await service.get_user_app_ids(user_id)
        return AppIdsResponse(app_ids=app_ids)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500, detail="Failed to retrieve app_ids"
        ) from exc
