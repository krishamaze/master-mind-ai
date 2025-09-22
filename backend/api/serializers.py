"""Serializers for API models."""
from __future__ import annotations

from typing import Any

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Assignment, Conversation, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profiles."""

    class Meta:
        model = UserProfile
        fields = ["id", "user", "bio"]


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for assignments."""

    app_id = serializers.RegexField(
        regex=r"^[A-Za-z0-9]{8}$",
        max_length=8,
        min_length=8,
        help_text="Unique 8 character alphanumeric identifier",
    )

    class Meta:
        model = Assignment
        fields = [
            "id",
            "name",
            "owner",
            "app_id",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["description", "created_at", "updated_at"]

    def create(self, validated_data: dict[str, Any]) -> Assignment:
        """Create an assignment, resolving ``user_id`` values to ``User`` instances."""

        owner = validated_data.get("owner")
        if owner is None:
            user_identifier = self.initial_data.get("user_id")
            if user_identifier is None:
                raise serializers.ValidationError({"owner": "This field is required."})
            validated_data["owner"] = self._resolve_user(user_identifier)
        return Assignment.objects.create(**validated_data)

    @staticmethod
    def _resolve_user(user_identifier: Any) -> User:
        lookup_errors = (User.DoesNotExist, ValueError, TypeError)
        try:
            return User.objects.get(pk=user_identifier)
        except lookup_errors:
            pass

        try:
            return User.objects.get(username=user_identifier)
        except User.DoesNotExist:
            pass

        profile_lookup_errors = (UserProfile.DoesNotExist, ValueError, TypeError)
        try:
            profile = UserProfile.objects.get(pk=user_identifier)
        except profile_lookup_errors:
            pass
        else:
            return profile.user

        try:
            profile = UserProfile.objects.get(user__username=user_identifier)
        except UserProfile.DoesNotExist as exc:
            raise serializers.ValidationError({"owner": "User not found."}) from exc
        return profile.user


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations."""

    class Meta:
        model = Conversation
        fields = [
            "id",
            "user",
            "assignment",
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
