"""Basic tests for API models and views."""
from django.urls import reverse
from rest_framework.test import APITestCase


class PlaceholderTestCase(APITestCase):
    """Basic tests to ensure the test suite runs."""

    def test_placeholder(self) -> None:
        """Simple test that always passes."""
        self.assertTrue(True)


class ConversationMemoryTests(APITestCase):
    """Tests for conversation memory endpoints."""

    def test_search_requires_query(self) -> None:
        url = reverse("conversation-search")
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, 400)
