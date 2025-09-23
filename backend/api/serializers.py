"""Serializers for API models."""

from __future__ import annotations
from typing import Any
from rest_framework import serializers
from .models import Assignment, Conversation, UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profiles."""
    
    class Meta:
        model = UserProfile
        fields = ["id", "user_id", "bio"]

class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for assignments."""
    
    # CHANGED: Remove Django User lookup, use simple string fields
    owner_id = serializers.CharField(required=False)
    user_id = serializers.CharField(write_only=True, required=False)
    app_id = serializers.RegexField(
        regex=r"^[A-Za-z0-9]{8}$",
        max_length=8,
        min_length=8,
        help_text="Unique 8 character alphanumeric identifier",
    )
    name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "name", 
            "owner_id",
            "user_id",
            "app_id",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["description", "created_at", "updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """Ensure assignment names always match their app_id."""
        attrs = super().validate(attrs)
        app_id = attrs.get("app_id") or getattr(self.instance, "app_id", None)
        if not app_id:
            raise serializers.ValidationError({"app_id": "This field is required."})

        provided_name = attrs.get("name")
        if provided_name and provided_name != app_id:
            raise serializers.ValidationError({"name": "Must match app_id."})

        attrs["name"] = app_id
        return attrs

    def create(self, validated_data: dict[str, Any]) -> Assignment:
        """Create an assignment with string user_id."""
        # CHANGED: Simply use user_id as string, no Django User lookup
        user_id = validated_data.pop("user_id", None)
        owner_id = validated_data.get("owner_id")
        
        if not owner_id and user_id:
            validated_data["owner_id"] = user_id
        elif not owner_id:
            raise serializers.ValidationError({"owner_id": "This field is required."})

        validated_data["name"] = validated_data["app_id"]
        return Assignment.objects.create(**validated_data)

class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations."""

    class Meta:
        model = Conversation
        fields = [
            "id",
            "user_id",  # CHANGED: Use string user_id
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
