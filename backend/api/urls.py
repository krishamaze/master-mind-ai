"""API URL routing."""
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet, ProjectViewSet, UserProfileViewSet

router = DefaultRouter()
router.register(r"users", UserProfileViewSet, basename="userprofile")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = router.urls
