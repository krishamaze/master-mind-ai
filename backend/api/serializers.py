"""Serializers for API models."""
from __future__ import annotations

from rest_framework import serializers

from .models import Conversation, Project, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profiles."""

    class Meta:
        model = UserProfile
        fields = ["id", "user", "bio"]


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for projects."""

    class Meta:
        model = Project
        fields = ["id", "name", "owner"]


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations."""

    class Meta:
        model = Conversation
        fields = [
            "id",
            "user",
            "project",
            "content",
            "created_at",
            "content_embedding",
        ]
        read_only_fields = ["created_at"]
