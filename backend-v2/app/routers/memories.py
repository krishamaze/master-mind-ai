"""Memory search endpoints."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException

from app.models import MemoryMetadata, MemoryResult, MemorySearchRequest, MemorySearchResponse
from app.services.memory import AsyncMemoryService


router = APIRouter(tags=["memories"])


@router.post("/memories/search", response_model=MemorySearchResponse)
async def search_memories(request: MemorySearchRequest) -> MemorySearchResponse:
    """Search Mem0 for memories that match the provided query."""

    service = AsyncMemoryService()
    try:
        raw_results = await service.search_memories(
            query=request.query,
            user_id=request.user_id,
            limit=request.limit,
            app_id=request.app_id,
            run_id=request.run_id,
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Memory search failed") from exc

    results: List[MemoryResult] = []
    for memory in raw_results or []:
        if not isinstance(memory, dict):
            continue
        metadata_obj: Optional[MemoryMetadata] = None
        metadata = memory.get("metadata")
        if isinstance(metadata, dict):
            metadata_obj = MemoryMetadata(**metadata)
        results.append(
            MemoryResult(
                id=memory.get("id"),
                content=memory.get("content") or memory.get("memory"),
                score=memory.get("score"),
                metadata=metadata_obj,
            )
        )

    return MemorySearchResponse(results=results)
