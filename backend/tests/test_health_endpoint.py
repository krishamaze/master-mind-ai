"""Tests for health check endpoint."""
from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase


class HealthEndpointTests(TestCase):
    """Validate health check responses."""

    def test_health_check_success(self) -> None:
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "service": "master-mind-ai", "database": "connected"},
        )

    @patch("api.views.connection.cursor", side_effect=DatabaseError("fail"))
    def test_health_check_database_error(self, _mock_cursor) -> None:
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(), {"status": "error", "error": "connection failed"}
        )

