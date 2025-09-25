"""Async memory service wrapping the Mem0 client."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from mem0.client.main import MemoryClient

from app.core.config import settings


logger = logging.getLogger(__name__)


class AsyncMemoryService:
    """Async helpers for interacting with Mem0."""

    def __init__(self) -> None:
        self.client = MemoryClient(api_key=settings.MEM0_API_KEY)

    async def get_user_app_ids(self, user_id: str) -> List[str]:
        """Return distinct app identifiers found in the user's memories."""

        try:
            memories = await asyncio.to_thread(
                self.client.get_all, user_id=user_id
            )
        except Exception as exc:  # pragma: no cover - network failures
            logger.error("Failed to list memories for %s: %s", user_id, exc)
            return []

        active_apps = set()
        for memory in memories or []:
            if not isinstance(memory, dict):
                continue
            metadata = memory.get("metadata") or {}
            app_id = metadata.get("app_id") if isinstance(metadata, dict) else None
            if isinstance(app_id, str) and app_id.strip():
                active_apps.add(app_id.strip())

        return sorted(active_apps)

    async def create_assignment(self, user_id: str, app_id: str) -> Dict[str, Any]:
        """Create an assignment without pre-initialising a Mem0 namespace."""

        assignment_id = str(uuid.uuid4())
        created_at = datetime.utcnow()

        try:
            await self.add_memory(
                user_id=user_id,
                app_id=app_id,
                messages=[
                    {"role": "user", "content": f"Starting work on {app_id}"}
                ],
            )
        except Exception as exc:  # pragma: no cover - network failures
            logger.error(
                "Failed to seed assignment memory for user=%s app=%s: %s",
                user_id,
                app_id,
                exc,
            )

        return {
            "id": assignment_id,
            "app_id": app_id,
            "user_id": user_id,
            "status": "created",
            "created_at": created_at,
            "mem0_namespace": f"{user_id}:{app_id}",
        }

    async def add_memory(
        self, user_id: str, app_id: str, messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Store real memory content; Mem0 namespaces are created lazily."""

        return await asyncio.to_thread(
            self.client.add,
            messages,
            user_id=user_id,
            app_id=app_id,
        )

    async def two_stage_enhance(
        self,
        *,
        prompt: str,
        user_id: str,
        app_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """Enhance a prompt using light cleanup plus contextual memories."""

        start_time = time.time()
        cleaned_prompt = self._light_cleanup(prompt)

        filters: Dict[str, Any] = {}
        if app_id:
            filters["app_id"] = app_id
        if run_id:
            filters["run_id"] = run_id

        try:
            memories = await asyncio.to_thread(
                self.client.search,
                cleaned_prompt,
                user_id=user_id,
                limit=limit,
                filters=filters or None,
            )
        except Exception as exc:  # pragma: no cover - network failures
            logger.error("Memory search failed for user=%s: %s", user_id, exc)
            raise

        context = self._build_context(memories)
        enhanced = await self._enhance_with_context(
            prompt=cleaned_prompt,
            context=context,
            user_id=user_id,
        )

        return {
            "enhanced_prompt": enhanced,
            "memories_used": len(memories or []),
            "processing_time": round(time.time() - start_time, 3),
        }

    async def search_memories(
        self,
        *,
        query: str,
        user_id: str,
        limit: int = 5,
        app_id: Optional[str] = None,
        run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search for memories matching the provided query."""

        filters: Dict[str, Any] = {}
        if app_id:
            filters["app_id"] = app_id
        if run_id:
            filters["run_id"] = run_id

        try:
            return await asyncio.to_thread(
                self.client.search,
                query,
                user_id=user_id,
                limit=limit,
                filters=filters or None,
            )
        except Exception as exc:  # pragma: no cover - network failures
            logger.error("Memory search failed for user=%s: %s", user_id, exc)
            raise

    @staticmethod
    def _light_cleanup(prompt: str) -> str:
        return " ".join(prompt.strip().split())

    @staticmethod
    def _build_context(memories: Optional[List[Dict[str, Any]]]) -> str:
        if not memories:
            return ""
        segments: List[str] = []
        for memory in memories:
            if not isinstance(memory, dict):
                continue
            content = memory.get("content") or memory.get("memory")
            if isinstance(content, str) and content.strip():
                segments.append(content.strip())
        return "\n".join(segments)

    async def _enhance_with_context(
        self, *, prompt: str, context: str, user_id: str
    ) -> str:
        """Call the chat completion API with the prompt and context."""

        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that enhances prompts with relevant context.",
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nPrompt: {prompt}\n\nEnhanced prompt:",
            },
        ]

        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                messages=messages,
                user_id=user_id,
                model="gpt-4o-mini",
            )
        except Exception as exc:  # pragma: no cover - network failures
            logger.error("Enhancement request failed for user=%s: %s", user_id, exc)
            return prompt

        content = (
            response.choices[0].message.content
            if response and getattr(response, "choices", None)
            else None
        )
        if isinstance(content, str) and content.strip():
            return content
        return prompt


__all__ = ["AsyncMemoryService"]
