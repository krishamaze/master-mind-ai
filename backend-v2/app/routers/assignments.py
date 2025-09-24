"""Assignment endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models import AssignmentCreateRequest, AssignmentResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["assignments"])


@router.post("/assignments", response_model=AssignmentResponse)
async def create_assignment(request: AssignmentCreateRequest) -> AssignmentResponse:
    """Create an assignment namespace and return its metadata."""

    service = AsyncMemoryService()
    assignment_id = str(uuid.uuid4())

    success = await service.create_assignment_namespace(
        user_id=request.user_id,
        app_id=request.appid,
        assignment_id=assignment_id,
    )
    if not success:
        raise HTTPException(
            status_code=500, detail="Failed to initialize Mem0 namespace"
        )

    return AssignmentResponse(
        id=assignment_id,
        appid=request.appid,
        owner_id=request.user_id,
        created_at=datetime.utcnow(),
    )
