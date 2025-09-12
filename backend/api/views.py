"""Viewsets for the API application."""
from __future__ import annotations

from rest_framework import viewsets

from .models import Conversation, Project, UserProfile
from .serializers import ConversationSerializer, ProjectSerializer, UserProfileSerializer


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
