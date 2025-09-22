"""Mem0 service integration."""

from __future__ import annotations

import logging
import warnings
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Union

from django.conf import settings
from mem0.client.utils import APIError
from mem0.proxy.main import Mem0
from mem0.client.main import MemoryClient


@lru_cache(maxsize=1)
def _warn_user_id_required() -> None:
    warnings.warn(
        "user_id will be required in future versions",
        DeprecationWarning,
        stacklevel=3,
    )


logger = logging.getLogger(__name__)


class MemoryService:
    """Wrapper around the Mem0 client."""

    def __init__(self) -> None:
        api_key = getattr(settings, "MEM0_API_KEY", "")
        db_url = getattr(settings, "SUPABASE_DB_URL", "")

        use_proxy = getattr(settings, "MEM0_USE_PROXY_CLIENT", True)
        if not isinstance(use_proxy, bool):  # pragma: no cover - defensive
            raise ValueError(
                f"MEM0_USE_PROXY_CLIENT must be a boolean, got: {type(use_proxy)}"
            )
        self.use_proxy = use_proxy

        if self.use_proxy:
            if not api_key:
                raise ValueError("MEM0_API_KEY required for proxy client")
            self.client: Optional[Union[Mem0, MemoryClient]] = Mem0(api_key=api_key)
            self.vector_store = None
        else:
            if not api_key or not db_url:
                raise ValueError(
                    "MEM0_API_KEY and SUPABASE_DB_URL required for legacy client"
                )
            self.client = MemoryClient(
                api_key=api_key, host=settings.MEM0_API_BASE_URL
            )
            self.vector_store: Optional[Dict[str, Any]] = {
                "provider": settings.MEM0_PROVIDER,
                "config": {
                    "connection_string": db_url,
                    "embedding_model_dims": settings.MEM0_EMBEDDING_DIM,
                    "index_method": settings.MEM0_INDEX_METHOD,
                },
            }
    def add_memory(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Store a memory using Mem0."""
        if not self.client:
            return {}
        if not user_id:
            _warn_user_id_required()
            return {}

        try:
            if self.use_proxy:
                return self.client.add(
                    messages=[{"role": "user", "content": text}],
                    metadata=metadata or {},
                    user_id=user_id,
                )
            return self.client.add(
                [{"role": "user", "content": text}],
                metadata=metadata or {},
                user_id=user_id,
                vector_store=self.vector_store,
            )
        except ValueError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 add value error: %s", exc)
            raise APIError(str(exc)) from exc
        except APIError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 add API error: %s", exc)
            raise

    def search_memories(
        self,
        query: str,
        *,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve memories similar to the query."""
        if filters and not user_id and "user_id" in filters:
            warnings.warn(
                "Passing user_id via filters is deprecated; use the user_id parameter",
                DeprecationWarning,
                stacklevel=2,
            )
            user_id = str(filters.get("user_id"))
            filters = {k: v for k, v in (filters or {}).items() if k != "user_id"}

        if not self.client:
            return []
        if not user_id:
            _warn_user_id_required()
            return []

        try:
            if self.use_proxy:
                return self.client.search(
                    query,
                    limit=limit,
                    user_id=user_id,
                    filters=filters,
                    version="v2",
                )
            return self.client.search(
                query,
                limit=limit,
                user_id=user_id,
                filters=filters,
                version="v2",
                vector_store=self.vector_store,
            )
        except ValueError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 search value error: %s", exc)
            raise APIError(str(exc)) from exc
        except APIError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 search API error: %s", exc)
            raise

    def _prepend_memories(self, prompt: str, *, limit: int = 5, user_id: Optional[str] = None) -> str:
        """Fallback enhancement by prepending retrieved memories."""
        if not user_id:
            return prompt

        try:
            memories = self.search_memories(
                prompt, limit=limit, user_id=user_id, filters=None
            )
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Memory prepend failed: %s", exc)
            return prompt

        context: List[str] = []
        for memory in memories:
            text = memory.get("content") or memory.get("memory") or ""
            if text:
                context.append(text)

        if not context:
            return prompt

        return "\n".join(context) + "\n\n" + prompt

    def openai_light_cleanup(self, prompt: str) -> str:
        """Perform a lightweight cleanup similar to OpenAI preprocessing."""

        if not isinstance(prompt, str):  # pragma: no cover - defensive
            raise TypeError("prompt must be a string")

        return " ".join(prompt.strip().split())

    def multi_level_memory_search(
        self,
        prompt: str,
        *,
        user_id: str,
        app_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5,
    ) -> str:
        """Aggregate memories across personal and documentation contexts."""

        if not user_id:
            raise ValueError("user_id is required for multi-level memory search")

        context_layers = [
            {"user_id": user_id, "app_id": app_id, "run_id": run_id},
            {"user_id": "docs", "app_id": "react19", "run_id": "v19.0.0"},
        ]

        aggregated: List[str] = []
        seen: Set[str] = set()

        for layer in context_layers:
            filters = {
                key: value
                for key, value in layer.items()
                if key != "user_id" and value
            }

            memories = self.search_memories(
                prompt,
                limit=limit,
                user_id=layer["user_id"],
                filters=filters or None,
            )

            for memory in memories:
                text = (memory.get("content") or memory.get("memory") or "").strip()
                if text and text not in seen:
                    aggregated.append(text)
                    seen.add(text)

        if aggregated:
            prompt = "\n".join(aggregated) + "\n\n" + prompt

        return self.enhance_prompt(prompt, user_id=user_id, limit=limit)

    def enhance_prompt(
        self,
        prompt: str,
        *,
        limit: int = 5,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        """Enhance a prompt using Mem0 chat completions.

        If chat completion fails, falls back to simple memory prepending.
        """
        if not self.client:
            return prompt
        if not user_id:
            _warn_user_id_required()
            return prompt

        try:
            model = model or getattr(settings, "MEM0_CHAT_MODEL", "gpt-4o-mini")
            temperature = getattr(settings, "MEM0_CHAT_TEMPERATURE", 0.0)
            try:
                temperature = float(temperature)
            except (TypeError, ValueError) as exc:
                raise ValueError("MEM0_CHAT_TEMPERATURE must be a float") from exc

            params: Dict[str, Any] = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
                "limit": limit,
                "user_id": user_id,
                "temperature": temperature,
            }
            if kwargs:
                allowed = {
                    "temperature",
                    "max_tokens",
                    "top_p",
                    "n",
                    "stop",
                    "presence_penalty",
                    "frequency_penalty",
                }
                unknown = set(kwargs) - allowed
                if unknown:
                    raise ValueError(
                        f"Unsupported parameters: {', '.join(sorted(unknown))}"
                    )
                params.update({k: kwargs[k] for k in kwargs if k in allowed})

            if self.use_proxy:
                response = self.client.chat.completions.create(**params)
            else:
                params["include_memories"] = True
                response = self.client.chat.completions.create(**params)

            enhanced = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )

            return enhanced or prompt
        except ValueError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 chat value error: %s", exc)
            raise APIError(str(exc)) from exc
        except APIError as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 chat API error: %s", exc)
            raise
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Mem0 chat completion failed: %s", exc)
            return self._prepend_memories(prompt, limit=limit, user_id=user_id)
