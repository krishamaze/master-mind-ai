"""Database models for the API application."""
from __future__ import annotations

from django.contrib.auth.models import User
from django.core.validators import RegexValidator
from django.db import models
from django.conf import settings
from pgvector.django import VectorField


class UserProfile(models.Model):
    """Extended user profile information."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True)

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"Profile({self.user.username})"


class Assignment(models.Model):
    """Assignment grouping conversations."""

    name = models.CharField(max_length=255)
    owner = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="assignments")
    app_id = models.CharField(
        max_length=8,
        unique=True,
        validators=[RegexValidator(r"^[A-Za-z0-9]{8}$", "Must be 8 alphanumeric characters")],
    )
    description = models.TextField(
        default="NA",
        blank=True,
        help_text="Auto-generated description from LLM analysis of memories",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return self.name


class Conversation(models.Model):
    """Stored conversation text and embeddings."""

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="conversations")
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="conversations",
        null=True,
        blank=True,
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    content_embedding = VectorField(
        dimensions=settings.MEM0_EMBEDDING_DIM,
        null=True,
        blank=True,
        help_text="Vector representation for semantic search",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"Conversation({self.user_id}, {self.created_at:%Y-%m-%d})"
