"""Admin configuration for API models."""

from django.contrib import admin

from .models import Assignment, Conversation, UserProfile

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    # FIXED: Changed from "user" to "user_id"
    list_display = ("user_id",)
    search_fields = ("user_id",)

@admin.register(Assignment) 
class AssignmentAdmin(admin.ModelAdmin):
    # FIXED: Changed from "owner" to "owner_id"
    list_display = ("name", "owner_id", "app_id", "created_at")
    search_fields = ("name", "app_id", "owner_id")
    list_filter = ("created_at",)

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    # FIXED: Changed from "user" to "user_id"
    list_display = ("user_id", "assignment", "created_at")
    search_fields = ("content", "user_id")
    list_filter = ("created_at",)
