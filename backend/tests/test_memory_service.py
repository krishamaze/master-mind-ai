"""Tests for MemoryService integration with Mem0."""
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from api.services.memory_service import MemoryService


class MemoryServiceTests(TestCase):
    """Validate MemoryService behavior."""

    @override_settings(
        MEM0_API_KEY="key",
        SUPABASE_DB_URL="postgres://",
        SUPABASE_URL="https://supabase.example",
        SUPABASE_KEY="anon-key",
        MEM0_API_BASE_URL="https://mem0.example",
        MEM0_PROVIDER="supabase",
        MEM0_EMBEDDING_DIM=1536,
        MEM0_INDEX_METHOD="hnsw",
    )
    def test_add_memory_uses_client(self) -> None:
        """add_memory should delegate to client with vector_store."""
        with patch("api.services.memory_service.MemoryClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            service.add_memory("hello", {"foo": "bar"})
            mock_client.add.assert_called_once()

    @override_settings(
        MEM0_API_KEY="",
        SUPABASE_DB_URL="",
        SUPABASE_URL="",
        SUPABASE_KEY="",
    )
    def test_service_disabled_without_config(self) -> None:
        """Service should safely no-op when configuration missing."""
        service = MemoryService()
        self.assertEqual(service.add_memory("test"), {})
        self.assertEqual(service.search_memories("test"), [])

    @override_settings(
        MEM0_API_KEY="key",
        SUPABASE_DB_URL="postgres://",
        SUPABASE_URL="https://supabase.example",
        SUPABASE_KEY="anon-key",
        MEM0_API_BASE_URL="https://mem0.example",
        MEM0_PROVIDER="supabase",
        MEM0_EMBEDDING_DIM=1536,
        MEM0_INDEX_METHOD="hnsw",
    )
    def test_enhance_prompt_includes_memories(self) -> None:
        with patch("api.services.memory_service.MemoryClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = Exception("boom")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with patch.object(
                MemoryService, "search_memories", return_value=[{"content": "data"}]
            ) as mock_search:
                result = service.enhance_prompt("hello")
                self.assertIn("data", result)
                self.assertTrue(result.endswith("hello"))
                mock_search.assert_called_once_with("hello", limit=5)
                mock_client.chat.completions.create.assert_called_once()
