"""Prompt enhancement endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import EnhanceRequest, EnhanceResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["enhancement"])


@router.post("/prompts/enhance", response_model=EnhanceResponse)
async def enhance_prompt(request: EnhanceRequest) -> EnhanceResponse:
    """Perform two-stage enhancement for the provided prompt."""

    service = AsyncMemoryService()
    try:
        result = await service.two_stage_enhance(
            prompt=request.prompt,
            user_id=request.user_id,
            app_id=request.app_id,
            run_id=request.run_id,
        )
        return EnhanceResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Enhancement failed") from exc
