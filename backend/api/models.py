import secrets
import string
from django.conf import settings
from django.db import models
from django.utils import timezone


class Game(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    min_players = models.PositiveIntegerField(default=1)
    max_players = models.PositiveIntegerField(default=8)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Room(models.Model):
    STATUS_LOBBY = "lobby"
    STATUS_LIVE = "live"
    STATUS_ENDED = "ended"

    STATUS_CHOICES = [
        (STATUS_LOBBY, "Lobby"),
        (STATUS_LIVE, "Live"),
        (STATUS_ENDED, "Ended"),
    ]

    code = models.CharField(max_length=6, unique=True, db_index=True)
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="rooms")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_LOBBY)
    created_at = models.DateTimeField(default=timezone.now)
    last_activity_at = models.DateTimeField(default=timezone.now)
    state = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.code} - {self.game.name}"

    def touch(self) -> None:
        self.last_activity_at = timezone.now()
        self.save(update_fields=["last_activity_at"])

    @classmethod
    def _generate_code(cls, length: int = 4) -> str:
        if length < 2:
            return secrets.choice(string.digits[1:])
        first = secrets.choice(string.digits[1:])
        rest = "".join(secrets.choice(string.digits) for _ in range(length - 1))
        return f"{first}{rest}"

    @classmethod
    def generate_unique_code(cls, length: int = 4) -> str:
        for _ in range(25):
            code = cls._generate_code(length=length)
            if not cls.objects.filter(code=code).exists():
                return code
        raise RuntimeError("Unable to generate unique room code")

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self.generate_unique_code()
        super().save(*args, **kwargs)


class Player(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="players")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="players")
    name = models.CharField(max_length=80, blank=True)
    device_id = models.CharField(max_length=120, blank=True)
    is_host = models.BooleanField(default=False)
    ready = models.BooleanField(default=False)
    joined_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    state = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(fields=["room", "user"], name="unique_player_per_room"),
        ]

    def __str__(self) -> str:
        label = self.name or self.user.username
        return f"{label} ({self.room.code})"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    nickname = models.CharField(max_length=80, unique=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["nickname"]

    def __str__(self) -> str:
        return self.nickname
