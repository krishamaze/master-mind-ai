"""Tests for prompt enhancement endpoint."""
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory
import json

from api.views.enhancement import enhance_prompt


class EnhancementEndpointTests(SimpleTestCase):
    """Validate enhancement API behavior."""

    def setUp(self) -> None:
        self.factory = APIRequestFactory()

    def test_requires_prompt(self) -> None:
        request = self.factory.post("/prompts/enhance/", {}, format="json")
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.enhancement.MemoryService.enhance_prompt", return_value="improved")
    def test_returns_enhanced_prompt(self, mock_enhance) -> None:
        request = self.factory.post(
            "/prompts/enhance/", {"prompt": "hello"}, format="json"
        )
        response = enhance_prompt(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            json.loads(response.content), {"enhanced_prompt": "improved"}
        )
        mock_enhance.assert_called_once_with("hello", user_id=None)
