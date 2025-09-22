"""API URL routing."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AssignmentViewSet,
    ConversationViewSet,
    UserProfileViewSet,
    health_check,
)
from .views.enhancement import enhance_prompt

router = DefaultRouter()
router.register(r"users", UserProfileViewSet, basename="userprofile")
router.register(r"assignments", AssignmentViewSet, basename="assignment")
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("prompts/enhance/", enhance_prompt, name="enhance_prompt"),
] + router.urls
