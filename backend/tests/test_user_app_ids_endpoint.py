"""Tests for user app id listing endpoint."""
from unittest.mock import patch
import json

from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory

from api.views import list_user_app_ids
from api.services.memory_service import MemoryService as RealMemoryService
from mem0.client.utils import APIError


class UserAppIdEndpointTests(SimpleTestCase):
    """Validate retrieval of app identifiers from Mem0."""

    def setUp(self) -> None:
        self.factory = APIRequestFactory()

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.MemoryService")
    def test_returns_unique_app_ids(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.list_user_memories.return_value = [
            {"app_id": "alpha"},
            {"metadata": {"app_id": "beta"}},
            {"metadata": {"app_id": "alpha"}},
            "invalid",
        ]
        mock_service.extract_app_id.side_effect = RealMemoryService.extract_app_id

        request = self.factory.get("/api/v1/users/user-123/app-ids/")
        response = list_user_app_ids(request, user_id="user-123")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content), {"app_ids": ["alpha", "beta"]})
        mock_instance.list_user_memories.assert_called_once_with("user-123")

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.MemoryService")
    def test_returns_error_when_mem0_fails(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.list_user_memories.side_effect = APIError("boom")
        mock_service.extract_app_id.side_effect = RealMemoryService.extract_app_id

        request = self.factory.get("/api/v1/users/user-123/app-ids/")
        response = list_user_app_ids(request, user_id="user-123")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_instance.list_user_memories.assert_called_once_with("user-123")

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.MemoryService")
    def test_handles_missing_mem0_configuration(self, mock_service) -> None:
        mock_service.side_effect = ValueError("missing config")

        request = self.factory.get("/api/v1/users/user-123/app-ids/")
        response = list_user_app_ids(request, user_id="user-123")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content), {"app_ids": []})
