"""Tests for conversation API endpoints."""
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory

from api.views import ConversationViewSet


class ConversationAPITests(SimpleTestCase):
    """Validate conversation endpoints without database access."""

    def setUp(self) -> None:
        self.factory = APIRequestFactory()

    def test_search_requires_query(self) -> None:
        request = self.factory.post("/conversations/search/", {}, format="json")
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.MemoryService.search_memories", return_value=[{"content": "hi"}])
    def test_search_returns_results(self, mock_search) -> None:
        request = self.factory.post(
            "/conversations/search/", {"query": "hi", "user_id": "user1"}, format="json"
        )
        view = ConversationViewSet.as_view({"post": "search"})
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [{"content": "hi"}])
        mock_search.assert_called_once_with(
            "hi", limit=5, filters={"user_id": "user1"}
        )
