"""URL configuration for the Master Mind AI project."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]
