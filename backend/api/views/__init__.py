"""Viewsets for the API application."""
from __future__ import annotations

import logging

from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Conversation, Project, UserProfile
from ..serializers import ConversationSerializer, ProjectSerializer, UserProfileSerializer
from ..services.memory_service import MemoryService
from mem0.client.utils import APIError

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET"])
def health_check(_request) -> JsonResponse:
    """Health check endpoint for monitoring and Chrome extension."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse(
            {"status": "ok", "service": "master-mind-ai", "database": "connected"}
        )
    except DatabaseError:
        return JsonResponse(
            {"status": "error", "error": "connection failed"}, status=500
        )


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
            MemoryService().add_memory(
                conversation.content, metadata, user_id=str(conversation.user_id)
            )
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Failed to store memory: %s", exc)

    @action(detail=False, methods=["post"], url_path="search")
    def search(self, request) -> Response:  # type: ignore[override]
        query = request.data.get("query")
        user_id = request.data.get("user_id")
        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not user_id:
            return Response({"detail": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        limit = int(request.data.get("limit", 5))

        try:
            results = MemoryService().search_memories(
                query, limit=limit, user_id=user_id, filters=None
            )
            return Response(results)
        except APIError as exc:  # pragma: no cover - external dependency
            logger.error("Memory search failed: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Memory search failed: %s", exc)
            return Response({"detail": "search failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
