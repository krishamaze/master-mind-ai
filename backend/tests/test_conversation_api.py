"""Tests for conversation API endpoints."""
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory

from mem0.client.utils import APIError
from api.views import ConversationViewSet


class ConversationAPITests(SimpleTestCase):
    """Validate conversation endpoints without database access."""

    def setUp(self) -> None:
        self.factory = APIRequestFactory()

    def test_search_requires_query(self) -> None:
        request = self.factory.post(
            "/conversations/search/", {"user_id": "user1"}, format="json"
        )
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_requires_user_id(self) -> None:
        request = self.factory.post(
            "/conversations/search/", {"query": "hi"}, format="json"
        )
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.MemoryService")
    def test_search_returns_results(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.search_memories.return_value = [{"content": "hi"}]
        request = self.factory.post(
            "/conversations/search/", {"query": "hi", "user_id": "user1"}, format="json"
        )
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [{"content": "hi"}])
        mock_instance.search_memories.assert_called_once_with(
            "hi", limit=5, user_id="user1", filters=None
        )

    @override_settings(MEM0_API_KEY="key")
    @patch("api.views.MemoryService")
    def test_search_mem0_error_returns_400(self, mock_service) -> None:
        mock_instance = mock_service.return_value
        mock_instance.search_memories.side_effect = APIError("bad request")
        request = self.factory.post(
            "/conversations/search/", {"query": "hi", "user_id": "user1"}, format="json"
        )
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_instance.search_memories.assert_called_once_with(
            "hi", limit=5, user_id="user1", filters=None
        )
