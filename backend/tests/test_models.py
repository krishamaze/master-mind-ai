"""Tests for data models."""
import importlib

from django.test import SimpleTestCase, override_settings


class ModelConfigTests(SimpleTestCase):
    """Ensure models use configured settings."""

    @override_settings(MEM0_EMBEDDING_DIM=42)
    def test_conversation_embedding_uses_setting(self) -> None:
        from api import models

        # Reload module so field picks up overridden setting
        importlib.reload(models)
        try:
            field = models.Conversation._meta.get_field("content_embedding")
            self.assertEqual(field.dimensions, 42)
        finally:
            importlib.reload(models)

