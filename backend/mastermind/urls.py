"""URL configuration for the Master Mind AI project."""
from django.contrib import admin
from django.urls import include, path

from api.views import health_check

urlpatterns = [
    path("", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]
