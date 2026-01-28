from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuthViewSet, GameViewSet, RoomViewSet

router = DefaultRouter()
router.register("auth", AuthViewSet, basename="auth")
router.register("games", GameViewSet, basename="game")
router.register("rooms", RoomViewSet, basename="room")

urlpatterns = [
    path("", include(router.urls)),
]
