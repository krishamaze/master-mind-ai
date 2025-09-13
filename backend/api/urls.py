"""API URL routing."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationViewSet,
    ProjectViewSet,
    UserProfileViewSet,
    health_check,
)

router = DefaultRouter()
router.register(r"users", UserProfileViewSet, basename="userprofile")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [path("health/", health_check, name="health_check")] + router.urls
