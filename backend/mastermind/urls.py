"""URL configuration for the Master Mind AI project."""
import logging

from django.contrib import admin
from django.db import connections, DatabaseError
from django.http import JsonResponse
from django.urls import include, path

logger = logging.getLogger(__name__)


def health(_request):
    """Health endpoint with database connectivity check."""
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok"})
    except DatabaseError:
        logger.exception("Database connectivity check failed")
        return JsonResponse({"status": "error"}, status=500)

urlpatterns = [
    path("", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]
