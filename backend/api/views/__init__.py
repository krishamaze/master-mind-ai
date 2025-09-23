"""Viewsets for the API application."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Assignment, Conversation, UserProfile
from ..serializers import AssignmentSerializer, ConversationSerializer, UserProfileSerializer
from ..services.assignment_summary import summarize_memories
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

@require_http_methods(["GET"])
def list_user_app_ids(_request, user_id: str) -> JsonResponse:
    """Return the set of app IDs known for a given user namespace."""
    try:
        service = MemoryService()
    except ValueError as exc:  # pragma: no cover - configuration error
        logger.info("Mem0 unavailable, returning empty app id list: %s", exc)
        return JsonResponse({"app_ids": []})

    try:
        # FIXED: Use your MemoryService methods correctly
        memories = service.list_user_memories(user_id)
    except APIError as exc:  # pragma: no cover - external dependency
        logger.error("Failed to load app ids for %s: %s", user_id, exc)
        return JsonResponse({"detail": str(exc)}, status=400)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.error("Unexpected error loading app ids for %s: %s", user_id, exc)
        return JsonResponse({"detail": "unable to load app ids"}, status=500)

    # Extract unique app_ids from memories
    seen = set()
    app_ids = []
    for memory in memories:
        app_id = MemoryService.extract_app_id(memory)
        if app_id and app_id not in seen:
            seen.add(app_id)
            app_ids.append(app_id)

    return JsonResponse({"app_ids": app_ids})

class UserProfileViewSet(viewsets.ModelViewSet):
    """API endpoint for user profiles."""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer

class AssignmentViewSet(viewsets.ModelViewSet):
    """API endpoint for assignments."""
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer

    def perform_create(self, serializer: AssignmentSerializer) -> None:
        """Create assignment and initialize Mem0 namespace."""
        # Get user_id from request data 
        user_id = self.request.data.get('user_id')
        
        # FIXED: Save assignment with owner_id as string (not Django User object)
        assignment = serializer.save(owner_id=user_id)
        self._initialise_mem0_namespace(assignment)

    def _initialise_mem0_namespace(self, assignment: Assignment) -> None:
        """Initialize Mem0 namespace for new assignment."""
        try:
            service = MemoryService()
        except ValueError as exc:  # pragma: no cover - configuration error
            logger.info(
                "Skipping Mem0 namespace initialisation for %s: %s",
                assignment.app_id,
                exc,
            )
            return

        try:
            # FIXED: Use your MemoryService.add_memory method correctly
            service.add_memory(
                text=f"[init] assignment {assignment.app_id}",
                metadata={
                    "assignment_id": str(assignment.id),
                    "app_id": assignment.app_id,
                    "source": "assignment_init",
                },
                user_id=assignment.owner_id,  # Use owner_id string directly
            )
            logger.info(f"✅ Initialized Mem0 namespace: user_id={assignment.owner_id}, app_id={assignment.app_id}")
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error(
                "Failed to initialise Mem0 namespace for %s: %s",
                assignment.app_id,
                exc,
            )

class ConversationViewSet(viewsets.ModelViewSet):
    """API endpoint for conversations."""
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def perform_create(self, serializer: ConversationSerializer) -> None:
        """Create conversation and store in Mem0."""
        conversation = serializer.save()
        metadata = {
            "conversation_id": str(conversation.id), 
            "user_id": conversation.user_id
        }
        
        try:
            MemoryService().add_memory(
                conversation.content, 
                metadata, 
                user_id=conversation.user_id
            )
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("Failed to store memory: %s", exc)

    @action(detail=False, methods=["post"], url_path="search")
    def search(self, request) -> Response:  # type: ignore[override]
        """Search memories for a user."""
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
