from django.contrib.auth import get_user_model
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import Game, Player, Profile, Room

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["nickname"]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "profile"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    nickname = serializers.CharField(max_length=80)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already in use.")
        return value

    def validate_nickname(self, value):
        nickname = value.strip()
        if not nickname:
            raise serializers.ValidationError("Nickname is required.")
        if Profile.objects.filter(nickname__iexact=nickname).exists():
            raise serializers.ValidationError("Nickname already in use.")
        return nickname

    def create(self, validated_data):
        email = validated_data["email"].strip().lower()
        nickname = validated_data["nickname"].strip()
        user = User.objects.create_user(username=email, email=email, password=validated_data["password"])
        Profile.objects.create(user=user, nickname=nickname)
        token, _ = Token.objects.get_or_create(user=user)
        return {"user": user, "token": token}


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email").strip().lower()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.check_password(attrs.get("password")):
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs

    def create(self, validated_data):
        user = validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return {"user": user, "token": token}


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["id", "slug", "name", "description", "min_players", "max_players", "is_active"]


class PlayerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    online = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            "id",
            "name",
            "user",
            "device_id",
            "is_host",
            "ready",
            "online",
            "joined_at",
            "last_seen_at",
            "state",
        ]
        read_only_fields = ["id", "joined_at", "last_seen_at"]

    def get_online(self, instance):
        if not instance.last_seen_at:
            return False
        return timezone.now() - instance.last_seen_at <= timedelta(seconds=30)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        state = data.get("state") or {}
        if isinstance(state, dict):
            if instance.room.game.slug == "confinamento-solitario":
                # Never expose guesses, and hide own suit.
                state.pop("guess", None)
                if not request or not request.user.is_authenticated:
                    state.pop("suit", None)
                elif instance.user_id == request.user.id:
                    state.pop("suit", None)
            if instance.room.game.slug == "concurso-de-beleza":
                state.pop("guess", None)
            if instance.room.game.slug == "leilao-de-cem-votos":
                state.pop("bid", None)
                state.pop("submitted", None)
                if not request or not request.user.is_authenticated or instance.user_id != request.user.id:
                    state.pop("points", None)
            if instance.room.game.slug == "blef-jack":
                if not request or not request.user.is_authenticated or instance.user_id != request.user.id:
                    state.pop("points", None)
                    state.pop("cards", None)
                    state.pop("guess_winner_id", None)
            data["state"] = state
        return data


class RoomSerializer(serializers.ModelSerializer):
    game = GameSerializer(read_only=True)
    tv_connected = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            "id",
            "code",
            "game",
            "status",
            "created_at",
            "last_activity_at",
            "tv_last_seen_at",
            "tv_connected",
            "state",
        ]
        read_only_fields = [
            "id",
            "code",
            "created_at",
            "last_activity_at",
            "tv_last_seen_at",
            "tv_connected",
            "state",
        ]

    def get_tv_connected(self, instance):
        if not instance.tv_last_seen_at:
            return False
        return timezone.now() - instance.tv_last_seen_at <= timedelta(seconds=20)


class RoomDetailSerializer(RoomSerializer):
    players = PlayerSerializer(many=True, read_only=True)

    class Meta(RoomSerializer.Meta):
        fields = RoomSerializer.Meta.fields + ["players"]


class RoomCreateSerializer(serializers.Serializer):
    game_id = serializers.IntegerField(required=False)
    game_slug = serializers.SlugField(required=False)
    host_name = serializers.CharField(max_length=80, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("game_id") and not attrs.get("game_slug"):
            raise serializers.ValidationError("Provide game_id or game_slug.")
        game_id = attrs.get("game_id")
        game_slug = attrs.get("game_slug")
        try:
            if game_id:
                game = Game.objects.get(id=game_id)
            else:
                game = Game.objects.get(slug=game_slug)
        except Game.DoesNotExist as exc:
            raise serializers.ValidationError("Game not found.") from exc

        attrs["game"] = game
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        game = validated_data["game"]
        room = Room.objects.create(game=game)
        if request.user.is_authenticated:
            host_name = validated_data.get("host_name", "").strip()
            profile = getattr(request.user, "profile", None)
            profile_name = profile.nickname if profile else ""
            display_name = host_name or profile_name or request.user.username
            Player.objects.create(
                room=room,
                user=request.user,
                name=display_name,
                is_host=True,
            )
        return room


class JoinRoomSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def create(self, validated_data):
        room = self.context["room"]
        request = self.context["request"]
        if not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        profile = getattr(request.user, "profile", None)
        profile_name = profile.nickname if profile else ""
        display_name = profile_name or request.user.username
        player, created = Player.objects.get_or_create(
            room=room,
            user=request.user,
            defaults={
                "name": display_name,
                "device_id": validated_data.get("device_id", ""),
            },
        )
        if not created and player.name != display_name:
            player.name = display_name
            player.last_seen_at = timezone.now()
            player.save(update_fields=["name", "last_seen_at"])
        else:
            player.last_seen_at = timezone.now()
            player.save(update_fields=["last_seen_at"])
        room.last_activity_at = timezone.now()
        room.save(update_fields=["last_activity_at"])
        return player


class HeartbeatSerializer(serializers.Serializer):
    player_id = serializers.IntegerField()

    def create(self, validated_data):
        room = self.context["room"]
        request = self.context["request"]
        if not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        player = Player.objects.get(id=validated_data["player_id"], room=room, user=request.user)
        now = timezone.now()
        player.last_seen_at = now
        player.save(update_fields=["last_seen_at"])
        room.last_activity_at = now
        room.save(update_fields=["last_activity_at"])
        return player


class ChangeGameSerializer(serializers.Serializer):
    game_id = serializers.IntegerField(required=False)
    game_slug = serializers.SlugField(required=False)

    def validate(self, attrs):
        if not attrs.get("game_id") and not attrs.get("game_slug"):
            raise serializers.ValidationError("Provide game_id or game_slug.")
        game_id = attrs.get("game_id")
        game_slug = attrs.get("game_slug")
        try:
            if game_id:
                game = Game.objects.get(id=game_id)
            else:
                game = Game.objects.get(slug=game_slug)
        except Game.DoesNotExist as exc:
            raise serializers.ValidationError("Game not found.") from exc
        attrs["game"] = game
        return attrs


class ReadySerializer(serializers.Serializer):
    ready = serializers.BooleanField()

    def create(self, validated_data):
        room = self.context["room"]
        request = self.context["request"]
        player = Player.objects.get(room=room, user=request.user)
        player.ready = validated_data["ready"]
        player.last_seen_at = timezone.now()
        player.save(update_fields=["ready", "last_seen_at"])
        room.touch()
        return player


class PlayerStateSerializer(serializers.Serializer):
    state = serializers.JSONField()

    def create(self, validated_data):
        room = self.context["room"]
        request = self.context["request"]
        player = Player.objects.get(room=room, user=request.user)
        player.state = validated_data["state"]
        player.last_seen_at = timezone.now()
        player.save(update_fields=["state", "last_seen_at"])
        room.touch()
        return player


class ProfileUpdateSerializer(serializers.Serializer):
    nickname = serializers.CharField(max_length=80)

    def validate_nickname(self, value):
        nickname = value.strip()
        request = self.context.get("request")
        qs = Profile.objects.filter(nickname__iexact=nickname)
        if request and request.user.is_authenticated:
            qs = qs.exclude(user=request.user)
        if qs.exists():
            raise serializers.ValidationError("Nickname already in use.")
        return nickname

    def create(self, validated_data):
        request = self.context["request"]
        nickname = validated_data["nickname"]
        profile = getattr(request.user, "profile", None)
        if profile:
            profile.nickname = nickname
            profile.save(update_fields=["nickname"])
        else:
            profile = Profile.objects.create(user=request.user, nickname=nickname)
        Player.objects.filter(user=request.user).update(name=nickname)
        return profile


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError("New passwords do not match.")
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if not request.user.check_password(attrs["current_password"]):
            raise serializers.ValidationError("Invalid current password.")
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        request.user.set_password(validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return request.user


class ReadMyMindModeSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["coop", "versus"])


class ReadMyMindPlaySerializer(serializers.Serializer):
    card = serializers.IntegerField(min_value=1, max_value=100)


class ConfinamentoGuessSerializer(serializers.Serializer):
    guess = serializers.ChoiceField(choices=["hearts", "diamonds", "clubs", "spades"])


class BelezaGuessSerializer(serializers.Serializer):
    value = serializers.IntegerField(min_value=0, max_value=100)


class FutureSugorokuMoveSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["move", "stay", "back"])
    direction = serializers.ChoiceField(choices=["N", "S", "E", "W"], required=False)


class FutureSugorokuUnlockSerializer(serializers.Serializer):
    ready = serializers.BooleanField(default=True)


class FutureSugorokuPenaltyChoiceSerializer(serializers.Serializer):
    target_player_id = serializers.IntegerField()


class LeilaoBidSerializer(serializers.Serializer):
    bid = serializers.IntegerField(min_value=0)


class BlefJackBetSerializer(serializers.Serializer):
    bet = serializers.IntegerField(min_value=0)


class BlefJackDeclareSerializer(serializers.Serializer):
    declared_value = serializers.IntegerField(min_value=0, max_value=21)


class BlefJackGuessSerializer(serializers.Serializer):
    winner_player_id = serializers.IntegerField()
