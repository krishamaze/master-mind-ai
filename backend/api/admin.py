"""Admin configuration for API models."""
from django.contrib import admin

from .models import Conversation, Project, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("user", "project", "created_at")
    search_fields = ("content",)
