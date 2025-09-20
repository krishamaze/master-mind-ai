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


class ConsoleLogEntrySerializer(serializers.Serializer):
    """Serializer for individual console log entries from the extension."""

    level = serializers.CharField()
    timestamp = serializers.DateTimeField()
    messages = serializers.ListField(
        child=serializers.CharField(), allow_empty=True
    )


class ConsoleLogBatchSerializer(serializers.Serializer):
    """Serializer for console log batches forwarded by the extension."""

    platform = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    page_url = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    first_logged_at = serializers.DateTimeField(allow_null=True, required=False)
    entries = ConsoleLogEntrySerializer(many=True, allow_empty=False)
