"""Assignment endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.models import AssignmentCreateRequest, AssignmentResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["assignments"])


@router.post("/assignments", response_model=AssignmentResponse)
async def create_assignment(request: AssignmentCreateRequest) -> AssignmentResponse:
    """Create a lightweight assignment record without touching Mem0."""

    service = AsyncMemoryService()
    assignment = await service.create_assignment(
        user_id=request.user_id,
        app_id=request.appid,
    )
    return AssignmentResponse(**assignment)
