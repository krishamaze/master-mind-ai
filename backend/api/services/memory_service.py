"""Mem0 service integration with Supabase vector store."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from django.conf import settings
from mem0.client.main import MemoryClient

logger = logging.getLogger(__name__)


class MemoryService:
    """Wrapper around Mem0 client configured to use Supabase."""

    def __init__(self) -> None:
        self.client: Optional[MemoryClient]
        self.vector_store: Optional[Dict[str, Any]]

        api_key = getattr(settings, "MEM0_API_KEY", "")
        db_url = getattr(settings, "SUPABASE_DB_URL", "")

        if not api_key or not db_url:
            logger.warning("Mem0 service disabled: missing configuration")
            self.client = None
            self.vector_store = None
            return

        self.client = MemoryClient(api_key=api_key, host=settings.MEM0_API_BASE_URL)
        self.vector_store = {
            "provider": settings.MEM0_PROVIDER,
            "config": {
                "connection_string": db_url,
                "embedding_model_dims": settings.MEM0_EMBEDDING_DIM,
                "index_method": settings.MEM0_INDEX_METHOD,
            },
        }

    def add_memory(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Store a memory using Mem0."""
        if not self.client:
            return {}
        return self.client.add(
            [{"role": "user", "content": text}],
            metadata=metadata or {},
            vector_store=self.vector_store,
        )

    def search_memories(
        self, query: str, *, limit: int = 5, filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve memories similar to the query."""
        if not self.client:
            return []
        return self.client.search(
            query,
            top_k=limit,
            filters=filters,
            vector_store=self.vector_store,
        )
