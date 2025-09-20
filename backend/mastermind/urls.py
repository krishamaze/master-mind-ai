"""URL configuration for the Master Mind AI project."""
from django.contrib import admin
from django.urls import include, path

from api.views import health_check
from api.views.logs import ingest_console_logs

urlpatterns = [
    path("", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("api/debug-logs/", ingest_console_logs, name="api-debug-logs"),
    path("api/v1/", include("api.urls")),
]
