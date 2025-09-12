"""Database models for the API application."""
from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models
from pgvector.django import VectorField


class UserProfile(models.Model):
    """Extended user profile information."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True)

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"Profile({self.user.username})"


class Project(models.Model):
    """Project grouping conversations."""

    name = models.CharField(max_length=255)
    owner = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="projects")

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return self.name


class Conversation(models.Model):
    """Stored conversation text and embeddings."""

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="conversations")
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="conversations", null=True, blank=True
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    embedding = VectorField(dimensions=1536, null=True, blank=True, help_text="Vector representation for semantic search")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - simple representation
        return f"Conversation({self.user_id}, {self.created_at:%Y-%m-%d})"
