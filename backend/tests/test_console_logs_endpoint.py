"""Tests for the console log ingestion endpoint."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from django.test import TestCase

from api.services.error_analysis import ErrorAnalysisConfigurationError


class ConsoleLogsEndpointTests(TestCase):
    """Verify console log batches can be ingested."""

    @patch("api.views.logs.analyze_console_errors")
    @patch("api.views.logs.logger")
    def test_console_logs_ingested_successfully(self, mock_logger, mock_analyze) -> None:
        mock_analyze.return_value = "{\"target_file\": \"extension/content/app.js\"}"
        payload = {
            "platform": "chatgpt",
            "page_url": "https://chat.openai.com/",
            "first_logged_at": datetime.now(timezone.utc).isoformat(),
            "entries": [
                {
                    "level": "error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "messages": ["Something went wrong"],
                }
            ],
        }

        response = self.client.post(
            "/api/debug-logs/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"status": "accepted", "entries": 1})
        mock_analyze.assert_called_once()
        self.assertEqual(mock_logger.info.call_count, 2)
        mock_logger.log.assert_called_once()

    def test_console_logs_missing_entries_returns_error(self) -> None:
        response = self.client.post(
            "/api/debug-logs/",
            data={"platform": "chatgpt"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("entries", response.json())

    @patch("api.views.logs.analyze_console_errors", side_effect=ErrorAnalysisConfigurationError("missing"))
    @patch("api.views.logs.logger")
    def test_console_error_analysis_skipped_when_unconfigured(
        self, mock_logger, mock_analyze
    ) -> None:
        payload = {
            "platform": "chatgpt",
            "page_url": "https://chat.openai.com/",
            "first_logged_at": datetime.now(timezone.utc).isoformat(),
            "entries": [
                {
                    "level": "error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "messages": ["ReferenceError: foo is not defined"],
                }
            ],
        }

        response = self.client.post(
            "/api/debug-logs/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 202)
        mock_analyze.assert_called_once()
        mock_logger.debug.assert_called_once()
