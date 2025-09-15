"""Tests for MemoryService integration with Mem0."""
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from mem0.client.utils import APIError

from api.services.memory_service import MemoryService


class MemoryServiceTests(TestCase):
    """Validate MemoryService behavior."""

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_add_memory_calls_mem0_add(self) -> None:
        """add_memory should call Mem0 client's add method."""
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            mock_client_cls.assert_called_once_with(api_key="key")
            service.add_memory("hello", {"foo": "bar"}, user_id="user1")
            mock_client.add.assert_called_once()
            _, kwargs = mock_client.add.call_args
            self.assertEqual(kwargs.get("user_id"), "user1")

    @override_settings(
        MEM0_API_KEY="key",
        SUPABASE_DB_URL="postgres://example",
        MEM0_API_BASE_URL="https://mem0.example",
        MEM0_USE_PROXY_CLIENT=False,
    )
    def test_add_memory_legacy_client(self) -> None:
        """add_memory should call legacy client when feature flag disabled."""
        with patch("api.services.memory_service.MemoryClient") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            service.add_memory("hello", user_id="user1")
            mock_client.add.assert_called_once()

    @override_settings(MEM0_API_KEY="")
    def test_missing_api_key_raises(self) -> None:
        """Initialization should fail without required API key."""
        with self.assertRaises(ValueError):
            MemoryService()

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT="yes",
    )
    def test_invalid_feature_flag_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            MemoryService()

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_includes_memories(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = Exception("boom")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with patch.object(
                MemoryService, "search_memories", return_value=[{"content": "data"}]
            ) as mock_search:
                result = service.enhance_prompt("hello", user_id="user1")
                self.assertIn("data", result)
                self.assertTrue(result.endswith("hello"))
                mock_search.assert_called_once_with(
                    "hello", limit=5, user_id="user1", filters=None
                )
                mock_client.chat.completions.create.assert_called_once()

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_respects_limit(self) -> None:
        """Custom limit should be forwarded to chat completions."""
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = {
                "choices": [{"message": {"content": "enhanced"}}]
            }
            mock_client_cls.return_value = mock_client
            service = MemoryService()

            result = service.enhance_prompt("hello", limit=2, user_id="user1")

            self.assertEqual(result, "enhanced")
            mock_client.chat.completions.create.assert_called_once()
            _, kwargs = mock_client.chat.completions.create.call_args
            self.assertEqual(kwargs.get("limit"), 2)
            self.assertEqual(kwargs.get("model"), "gpt-4o-mini")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_CHAT_MODEL="custom-model",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_uses_configured_model(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = {
                "choices": [{"message": {"content": "enhanced"}}]
            }
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            service.enhance_prompt("hi", user_id="user1")
            _, kwargs = mock_client.chat.completions.create.call_args
            self.assertEqual(kwargs.get("model"), "custom-model")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_model_override(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = {
                "choices": [{"message": {"content": "enhanced"}}]
            }
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            service.enhance_prompt("hi", user_id="user1", model="alt-model")
            _, kwargs = mock_client.chat.completions.create.call_args
            self.assertEqual(kwargs.get("model"), "alt-model")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_search_memories_extracts_user_id(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            service.search_memories("hi", filters={"user_id": "u1"})
            mock_client.search.assert_called_once()
            _, kwargs = mock_client.search.call_args
            self.assertEqual(kwargs.get("user_id"), "u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_add_memory_handles_api_error(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.add.side_effect = APIError("bad")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.add_memory("hi", user_id="u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_search_memories_handles_api_error(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.search.side_effect = APIError("bad")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.search_memories("hi", user_id="u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_value_error_raises_api_error(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = ValueError("bad")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.enhance_prompt("hi", user_id="u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_api_error_propagates(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.side_effect = APIError("bad")
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.enhance_prompt("hi", user_id="u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_prepend_memories_handles_failure(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with patch.object(
                MemoryService, "search_memories", side_effect=Exception("bad")
            ):
                result = service._prepend_memories("hi", user_id="u1")
                self.assertEqual(result, "hi")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_deprecation_warning_emitted_once(self) -> None:
        from api.services.memory_service import _warn_user_id_required

        _warn_user_id_required.cache_clear()
        with patch("api.services.memory_service.Mem0") as mock_client_cls, patch(
            "api.services.memory_service.warnings.warn"
        ) as mock_warn:
            mock_client_cls.return_value = MagicMock()
            service = MemoryService()
            service.add_memory("hi")
            service.search_memories("hi")
            self.assertEqual(mock_warn.call_count, 1)

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
    )
    def test_enhance_prompt_rejects_unknown_params(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.chat.completions.create.return_value = {
                "choices": [{"message": {"content": "enhanced"}}]
            }
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.enhance_prompt("hi", user_id="u1", foo=1)

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=True,
        MEM0_CHAT_TEMPERATURE="bad",
    )
    def test_enhance_prompt_invalid_temperature_raises(self) -> None:
        with patch("api.services.memory_service.Mem0") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            service = MemoryService()
            with self.assertRaises(APIError):
                service.enhance_prompt("hi", user_id="u1")

    @override_settings(
        MEM0_API_KEY="key",
        MEM0_USE_PROXY_CLIENT=False,
        SUPABASE_DB_URL="",
    )
    def test_missing_db_url_raises(self) -> None:
        with self.assertRaises(ValueError):
            MemoryService()
