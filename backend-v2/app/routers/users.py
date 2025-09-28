"""User-related API endpoints."""

from __future__ import annotations
import logging

from fastapi import APIRouter, HTTPException, Path

from app.models import AppIdsResponse
from app.services.memory import AsyncMemoryService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["users"])

@router.get("/users/{user_id}/app-ids", response_model=AppIdsResponse)
async def get_user_app_ids(
    user_id: str = Path(..., min_length=1, max_length=255)
) -> AppIdsResponse:
    """Return all app IDs associated with the user."""
    logger.info(f"🔍 BACKEND: Received request for user_id: {user_id}")
    
    service = AsyncMemoryService()
    
    try:
        app_ids = await service.get_user_app_ids(user_id)
        logger.info(f"🔍 BACKEND: Service returned app_ids: {app_ids}")
        
        response = AppIdsResponse(app_ids=app_ids)
        logger.info(f"🔍 BACKEND: Sending response: {response.dict()}")
        
        return response
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(f"❌ BACKEND: Exception occurred: {exc}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve app_ids"
        ) from exc
