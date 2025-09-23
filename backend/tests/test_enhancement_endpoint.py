"""Tests for prompt enhancement endpoint."""
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory
import json

from mem0.client.utils import APIError
from api.views.enhancement import enhance_prompt
from api.services.memory_service import MemoryService as RealMemoryService


class EnhancementEndpointTests(SimpleTestCase):
    """Validate enhancement API behavior."""

    def setUp(self) -> None:
        self.factory = APIRequestFactory()

    def test_requires_prompt(self) -> None:
        request = self.factory.post(
            "/prompts/enhance/", {"user_id": "user1"}, format="json"
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_user_id(self) -> None:
        request = self.factory.post(
            "/prompts/enhance/", {"prompt": "hi"}, format="json"
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_json_returns_400(self) -> None:
        request = self.factory.post(
            "/prompts/enhance/",
            data="{",
            content_type="application/json",
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            json.loads(response.content), {"detail": "invalid JSON"}
        )

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.enhancement.MemoryService")
    def test_returns_enhanced_prompt(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.openai_light_cleanup.return_value = "cleaned"
        mock_instance.search_memories.return_value = [
            {"content": "context"},
            {"memory": "context"},
        ]
        mock_instance.enhance_prompt.return_value = "improved"
        mock_service.extract_memory_text.side_effect = RealMemoryService.extract_memory_text
        request = self.factory.post(
            "/prompts/enhance/",
            {
                "prompt": "hello",
                "user_id": "user1",
                "app_id": "app.alpha",
                "run_id": "run-42",
            },
            format="json",
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            json.loads(response.content), {"enhanced_prompt": "improved"}
        )
        mock_instance.openai_light_cleanup.assert_called_once_with("hello")
        mock_instance.search_memories.assert_called_once_with(
            "cleaned",
            user_id="user1",
            filters={"app_id": "app.alpha", "run_id": "run-42"},
        )
        mock_instance.enhance_prompt.assert_called_once()
        args, kwargs = mock_instance.enhance_prompt.call_args
        self.assertIn("context\n\ncleaned", args[0])
        self.assertEqual(kwargs, {"user_id": "user1"})

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.enhancement.MemoryService")
    def test_mem0_error_returns_400(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.openai_light_cleanup.return_value = "cleaned"
        mock_instance.search_memories.side_effect = APIError("bad request")
        mock_service.extract_memory_text.side_effect = RealMemoryService.extract_memory_text
        request = self.factory.post(
            "/prompts/enhance/", {"prompt": "hello", "user_id": "user1"}, format="json"
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_instance.openai_light_cleanup.assert_called_once_with("hello")
        mock_instance.search_memories.assert_called_once_with(
            "cleaned",
            user_id="user1",
            filters=None,
        )

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.enhancement.MemoryService")
    def test_returns_cleaned_prompt_when_no_memories(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.openai_light_cleanup.return_value = "cleaned"
        mock_instance.search_memories.return_value = []
        mock_service.extract_memory_text.side_effect = RealMemoryService.extract_memory_text
        request = self.factory.post(
            "/prompts/enhance/",
            {"prompt": "hello", "user_id": "user1"},
            format="json",
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            json.loads(response.content), {"enhanced_prompt": "cleaned"}
        )
        mock_instance.enhance_prompt.assert_not_called()
