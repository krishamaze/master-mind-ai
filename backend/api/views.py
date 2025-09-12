"""Viewsets for the API application."""
from __future__ import annotations

import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Conversation, Project, UserProfile
from .serializers import ConversationSerializer, ProjectSerializer, UserProfileSerializer
from .services.memory_service import MemoryService

logger = logging.getLogger(__name__)


class UserProfileViewSet(viewsets.ModelViewSet):
    """API endpoint for user profiles."""

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    """API endpoint for projects."""

    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class ConversationViewSet(viewsets.ModelViewSet):
    """API endpoint for conversations."""

    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def perform_create(self, serializer: ConversationSerializer) -> None:
        conversation = serializer.save()
        metadata = {"conversation_id": str(conversation.id), "user_id": conversation.user_id}
        try:
            MemoryService().add_memory(conversation.content, metadata)
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Failed to store memory: %s", exc)

    @action(detail=False, methods=["post"], url_path="search")
    def search(self, request) -> Response:  # type: ignore[override]
        query = request.data.get("query")
        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)
        limit = int(request.data.get("limit", 5))
        try:
            results = MemoryService().search_memories(query, limit=limit)
            return Response(results)
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Memory search failed: %s", exc)
            return Response({"detail": "search failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
