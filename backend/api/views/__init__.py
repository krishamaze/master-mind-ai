"""Viewsets for the API application."""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

from django.contrib.auth import get_user_model
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

User = get_user_model()
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


class AssignmentViewSet(viewsets.ModelViewSet):
    """API endpoint for assignments."""

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset()
        self._resolved_owner: Optional[User] = None
        self._user_lookup_failed = False

        user_id = self.request.query_params.get("user_id") if self.request else None
        if user_id:
            try:
                owner = self._resolve_owner(user_id)
            except UserProfile.DoesNotExist:
                self._user_lookup_failed = True
                return queryset.none()
            else:
                self._resolved_owner = owner
                queryset = queryset.filter(owner=owner)
        return queryset

    def list(self, request, *args, **kwargs):  # type: ignore[override]
        user_id = request.query_params.get("user_id")
        if getattr(self, "_user_lookup_failed", False):
            return Response(
                {"detail": "user_id not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        owner = getattr(self, "_resolved_owner", None)
        if user_id and owner:
            memories = self._fetch_user_memories(user_id)
            self._sync_assignments(owner, memories)
        return super().list(request, *args, **kwargs)

    def _resolve_owner(self, user_id: str) -> User:
        """Resolve a user identifier to a ``User`` instance."""

        user_lookup_errors = (User.DoesNotExist, ValueError, TypeError)
        try:
            return User.objects.get(pk=user_id)
        except user_lookup_errors:
            pass

        try:
            return User.objects.get(username=user_id)
        except User.DoesNotExist:
            pass

        profile_lookup_errors = (UserProfile.DoesNotExist, ValueError, TypeError)
        try:
            profile = UserProfile.objects.get(pk=user_id)
        except profile_lookup_errors:
            pass
        else:
            return profile.user

        profile = UserProfile.objects.get(user__username=user_id)
        return profile.user

    def _fetch_user_memories(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            service = MemoryService()
        except ValueError as exc:  # pragma: no cover - configuration error
            logger.error("Unable to initialise MemoryService: %s", exc)
            return []

        client = getattr(service, "client", None)
        if not client:
            logger.info("MemoryService client unavailable; skipping Mem0 sync")
            return []

        fetch_methods = (
            "get_all",
            "get_all_memories",
            "list",
        )
        memories: Optional[Iterable[Dict[str, Any]]] = None
        for method_name in fetch_methods:
            if hasattr(client, method_name):
                fetcher = getattr(client, method_name)
                try:
                    memories = fetcher(user_id=user_id)
                except Exception as exc:  # pragma: no cover - external dependency
                    logger.error("Mem0 %s failed: %s", method_name, exc)
                    memories = []
                break
        else:
            logger.warning("Mem0 client does not support bulk memory retrieval")
            memories = []

        normalised: List[Dict[str, Any]] = []
        for memory in memories or []:
            if isinstance(memory, dict):
                normalised.append(memory)
        return normalised

    def _sync_assignments(self, owner: User, memories: Iterable[Dict[str, Any]]) -> None:
        groups: Dict[str, List[str]] = {}
        for memory in memories:
            app_id = memory.get("app_id")
            if not isinstance(app_id, str):
                continue
            text = self._extract_memory_text(memory)
            groups.setdefault(app_id, []).append(text)

        for app_id, snippets in groups.items():
            assignment, created = Assignment.objects.get_or_create(
                app_id=app_id,
                defaults={"owner": owner, "name": app_id},
            )
            if not created and assignment.owner_id != owner.id:
                assignment.owner = owner
                assignment.save(update_fields=["owner", "updated_at"])

            summary = summarize_memories(snippets[:5])
            if summary and assignment.description != summary:
                assignment.description = summary
                assignment.save(update_fields=["description", "updated_at"])

    @staticmethod
    def _extract_memory_text(memory: Dict[str, Any]) -> str:
        content_fields = ("content", "memory", "text")
        for field in content_fields:
            value = memory.get(field)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""


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

