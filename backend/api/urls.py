"""API URL routing."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AssignmentViewSet,
    ConversationViewSet,
    UserProfileViewSet,
    health_check,
    list_user_app_ids,
)
from .views.enhancement import enhance_prompt

router = DefaultRouter()
router.register(r"users", UserProfileViewSet, basename="userprofile")
router.register(r"assignments", AssignmentViewSet, basename="assignment")
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path(
        "users/<str:user_id>/app-ids/",
        list_user_app_ids,
        name="user_app_ids",
    ),
    path("prompts/enhance/", enhance_prompt, name="enhance_prompt"),
] + router.urls
