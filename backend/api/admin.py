from django.contrib import admin

from .models import Game, Player, Profile, Room


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "min_players", "max_players", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("code", "game", "status", "created_at", "last_activity_at")
    list_filter = ("status", "game")
    search_fields = ("code",)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "room", "is_host", "ready", "joined_at", "last_seen_at")
    list_filter = ("is_host",)
    search_fields = ("name", "user__username", "room__code")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("nickname", "user", "created_at")
    search_fields = ("nickname", "user__username", "user__email")
