"""
O backend como depósito dos jogos de Halloween (HALLOWEEN.md, "Backend (F1) —
contrato HTTP"): sync, sync_room, fx, convidado, versão da sala, presença com
throttle e o start sem motor.

Os usuários daqui não têm senha (create_user com password=None): sem o hash
de senha a suíte fica rápida. Os celulares usam token de verdade no header,
como no navegador.
"""

import io
import re
from datetime import timedelta
from pathlib import Path
from unittest import skipUnless

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from . import deposito
from .halloween import HALLOWEEN_SLUGS, is_halloween
from .models import Game, Player, Profile, Room
from .serializers import redact_room_state
from .views import _tick_new_games

User = get_user_model()

FRONTEND_SLUGS = Path(settings.BASE_DIR).parent / "frontend" / "src" / "halloween" / "slugs.ts"


def make_user(tag):
    user = User.objects.create_user(username=f"{tag}@x.com", email=f"{tag}@x.com", password=None)
    Profile.objects.create(user=user, nickname=f"Fantasma {tag}")
    return user


def ms_now():
    return int(timezone.now().timestamp() * 1000)


class DepositoTestBase(TestCase):
    slug = "espiao-assombrado"
    player_count = 3

    def setUp(self):
        self.game = Game.objects.create(slug=self.slug, name=self.slug, min_players=1, max_players=15)
        self.room = Room.objects.create(game=self.game, code="3131")
        self.users = [make_user(f"p{i}") for i in range(self.player_count)]
        self.tokens = [Token.objects.create(user=user) for user in self.users]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Fantasma p{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]

    # --- clientes -----------------------------------------------------------

    def phone(self, index):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.tokens[index].key}")
        return client

    def url(self, action, code=None):
        return f"/api/rooms/{code or self.room.code}/{action}/"

    def sync(self, client=None, **params):
        response = (client or APIClient()).get(self.url("sync"), params)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def post(self, client, action, payload=None):
        return client.post(self.url(action), payload or {}, format="json")

    # --- banco --------------------------------------------------------------

    def version(self):
        return Room.objects.values_list("version", flat=True).get(pk=self.room.pk)

    def set_seen(self, index, seconds_ago):
        moment = timezone.now() - timedelta(seconds=seconds_ago)
        Player.objects.filter(pk=self.players[index].pk).update(last_seen_at=moment)
        return moment

    def seen(self, index):
        return Player.objects.values_list("last_seen_at", flat=True).get(pk=self.players[index].pk)

    def set_tv_seen(self, seconds_ago):
        moment = None if seconds_ago is None else timezone.now() - timedelta(seconds=seconds_ago)
        Room.objects.filter(pk=self.room.pk).update(tv_last_seen_at=moment)
        return moment

    def tv_seen(self):
        return Room.objects.values_list("tv_last_seen_at", flat=True).get(pk=self.room.pk)

    def set_states(self, *states):
        for player, state in zip(self.players, states):
            Player.objects.filter(pk=player.pk).update(state=state)


class SyncTests(DepositoTestBase):
    def test_full_payload_follows_the_contract(self):
        Room.objects.filter(pk=self.room.pk).update(state={"g": {"phase": "talk"}}, status="live")
        data = self.sync()

        self.assertEqual(set(data), {"same", "v", "t", "me", "room", "players"})
        self.assertFalse(data["same"])
        self.assertEqual(data["v"], self.version())
        self.assertIsInstance(data["t"], int)
        self.assertLess(abs(data["t"] - ms_now()), 5000, "t é o relógio do servidor em ms")
        self.assertIsNone(data["me"], "a TV não é jogador")

        room = data["room"]
        self.assertEqual(set(room), {"code", "status", "game", "state", "fx", "tv_connected"})
        self.assertEqual(room["code"], self.room.code)
        self.assertEqual(room["status"], "live")
        self.assertEqual(
            room["game"],
            {"slug": self.slug, "name": self.slug, "min_players": 1, "max_players": 15},
        )
        self.assertEqual(room["state"], {"g": {"phase": "talk"}})
        self.assertEqual(room["fx"], {})
        self.assertFalse(room["tv_connected"])

        self.assertEqual([p["id"] for p in data["players"]], [p.id for p in self.players], "ordem de entrada")
        first = data["players"][0]
        self.assertEqual(set(first), {"id", "name", "is_host", "ready", "online", "joined_at", "state"})
        self.assertTrue(first["is_host"])
        self.assertTrue(first["ready"])
        self.assertTrue(first["online"])
        self.assertTrue(first["joined_at"].endswith("Z"))
        self.assertEqual(first["state"], {})

    def test_same_version_answers_with_almost_nothing(self):
        current = self.version()
        data = self.sync(v=current)
        self.assertEqual(set(data), {"same", "v", "t"})
        self.assertTrue(data["same"])
        self.assertEqual(data["v"], current)
        self.assertLess(abs(data["t"] - ms_now()), 5000)

        # Versão velha, futura (banco resetado) ou lixo: resposta completa.
        for stale in (current - 1, current + 5, "abc", -1, ""):
            self.assertFalse(self.sync(v=stale)["same"], stale)

    def test_same_path_costs_one_query_for_the_tv_and_two_for_a_phone(self):
        current = self.version()
        with self.assertNumQueries(1):
            self.sync(v=current)
        # TV marcada há pouco: o throttle não grava nada.
        self.set_tv_seen(2)
        with self.assertNumQueries(1):
            self.sync(v=current, tv=1)
        # Celular visto há pouco: acha o jogador pelo token num JOIN, sem gravar.
        with self.assertNumQueries(2):
            self.sync(self.phone(0), v=current, mine=1)

    def test_full_path_query_count_does_not_grow_with_players(self):
        for extra in range(2):
            with self.assertNumQueries(3):
                self.sync()
            with self.assertNumQueries(4):
                self.sync(self.phone(1), mine=1)
            # Mais gente na sala: o número de consultas é o mesmo.
            for index in range(5):
                user = make_user(f"extra{extra}-{index}")
                Player.objects.create(room=self.room, user=user, name=user.email)

    def test_mine_hides_other_players_state_but_not_your_own(self):
        self.set_states({"hw": {"k": "r1", "vote": 7}}, {"segredo": "lua"}, {})
        mine = self.sync(self.phone(0), mine=1)
        states = {p["id"]: p["state"] for p in mine["players"]}
        self.assertEqual(states[self.players[0].id], {"hw": {"k": "r1", "vote": 7}}, "o seu vem cheio")
        self.assertIsNone(states[self.players[1].id], "o dos outros vem null")
        self.assertIsNone(states[self.players[2].id])

        # Sem mine (a TV-juiz) vem tudo.
        everything = self.sync(self.phone(0))
        states = {p["id"]: p["state"] for p in everything["players"]}
        self.assertEqual(states[self.players[1].id], {"segredo": "lua"})

        # mine sem ser jogador: ninguém vem.
        tv = self.sync(mine=1)
        self.assertTrue(all(p["state"] is None for p in tv["players"]))

    def test_me_is_the_player_owning_the_token(self):
        self.assertEqual(self.sync(self.phone(1))["me"], self.players[1].id)
        self.assertIsNone(self.sync()["me"])

        outsider = make_user("fora")
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=outsider).key}")
        self.assertIsNone(self.sync(client)["me"], "quem não está na sala não é ninguém")

        # Token velho (banco migrado) não derruba ninguém com 401.
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION="Token 0000000000000000000000000000000000000000")
        self.assertIsNone(self.sync(stale)["me"])

        forced = APIClient()
        forced.force_authenticate(self.users[2])
        self.assertEqual(self.sync(forced)["me"], self.players[2].id)

    def test_online_is_last_seen_within_30_seconds(self):
        self.set_seen(1, 29)
        self.set_seen(2, 31)
        online = {p["id"]: p["online"] for p in self.sync()["players"]}
        self.assertTrue(online[self.players[0].id])
        self.assertTrue(online[self.players[1].id])
        self.assertFalse(online[self.players[2].id])

    def test_token_renews_last_seen_at_most_every_15_seconds(self):
        recent = self.set_seen(0, 5)
        self.sync(self.phone(0))
        self.assertEqual(self.seen(0), recent, "visto há 5 s: não grava")

        old = self.set_seen(0, 20)
        self.sync(self.phone(0))
        self.assertGreater(self.seen(0), old, "visto há 20 s: grava")

    def test_player_coming_back_online_bumps_the_version(self):
        self.set_seen(1, 40)
        before = self.version()
        data = self.sync(self.phone(1), v=before)
        self.assertEqual(self.version(), before + 1, "as outras telas precisam vê-lo online")
        self.assertFalse(data["same"], "a chamada que mexeu na versão responde completo")
        me = next(p for p in data["players"] if p["id"] == self.players[1].id)
        self.assertTrue(me["online"])

    def test_tv_flag_marks_the_tv_with_throttle(self):
        data = self.sync(tv=1)
        self.assertTrue(data["room"]["tv_connected"])
        self.assertIsNotNone(self.tv_seen())

        recent = self.set_tv_seen(5)
        self.sync(tv=1)
        self.assertEqual(self.tv_seen(), recent, "marcada há 5 s: não grava")

        old = self.set_tv_seen(11)
        data = self.sync(tv=1)
        self.assertGreater(self.tv_seen(), old, "marcada há 11 s: grava")
        self.assertTrue(data["room"]["tv_connected"])

        # Sem tv=1 ninguém marca a TV.
        old = self.set_tv_seen(60)
        self.assertFalse(self.sync()["room"]["tv_connected"])
        self.assertEqual(self.tv_seen(), old)

    def test_tv_reconnecting_bumps_the_version(self):
        self.set_tv_seen(None)
        before = self.version()
        self.sync(tv=1)
        self.assertEqual(self.version(), before + 1)
        # Já conectada: o poll seguinte não mexe na versão.
        self.set_tv_seen(12)
        self.sync(tv=1)
        self.assertEqual(self.version(), before + 1)

    def test_unknown_room_is_404(self):
        response = APIClient().get(self.url("sync", code="9999"))
        self.assertEqual(response.status_code, 404)

    def test_responses_are_not_cached(self):
        response = APIClient().get(self.url("sync"))
        self.assertEqual(response["Cache-Control"], "no-store")


class SyncOldGameTests(DepositoTestBase):
    """Sala de jogo antigo: o sync não pode vazar o que o GET antigo esconde."""

    slug = "a-cacada"

    def test_room_state_is_redacted_and_player_states_are_null(self):
        Room.objects.filter(pk=self.room.pk).update(state={"phase": "search", "solution": "3,4"})
        self.set_states({"clue": "perto da água"}, {"clue": "longe da floresta"}, {})
        data = self.sync(self.phone(0))
        self.assertNotIn("solution", data["room"]["state"])
        self.assertEqual(data["room"]["state"]["phase"], "search")
        self.assertTrue(all(p["state"] is None for p in data["players"]), "nem o próprio")


class SyncRoomTests(DepositoTestBase):
    def test_replaces_the_state_and_returns_the_exact_new_version(self):
        Room.objects.filter(pk=self.room.pk).update(state={"velho": True})
        before = self.version()
        response = self.post(APIClient(), "sync_room", {"state": {"g": {"phase": "reveal"}}})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(set(body), {"v", "t"})
        self.assertEqual(body["v"], before + 1)
        self.assertEqual(body["v"], self.version())
        self.assertLess(abs(body["t"] - ms_now()), 5000)

        self.room.refresh_from_db()
        self.assertEqual(self.room.state, {"g": {"phase": "reveal"}}, "substitui, não mescla")
        self.assertEqual(self.room.status, "lobby", "sem status, o status fica")

    def test_status_is_optional_and_validated(self):
        for value in ("live", "ended", "lobby"):
            response = self.post(APIClient(), "sync_room", {"state": {}, "status": value})
            self.assertEqual(response.status_code, 200, response.content)
            self.room.refresh_from_db()
            self.assertEqual(self.room.status, value)

        before = self.version()
        for value in ("pausado", 3, ["live"], {"x": 1}):
            response = self.post(APIClient(), "sync_room", {"state": {}, "status": value})
            self.assertEqual(response.status_code, 400, value)
        self.assertEqual(self.version(), before, "pedido recusado não sobe a versão")

    def test_state_must_be_an_object(self):
        before = self.version()
        for payload in ({}, {"state": [1, 2]}, {"state": "oi"}, {"state": None}):
            response = self.post(APIClient(), "sync_room", payload)
            self.assertEqual(response.status_code, 400, payload)
        self.assertEqual(self.version(), before)

    def test_only_halloween_rooms_and_the_judged_game(self):
        ok = self.post(APIClient(), "sync_room", {"state": {"a": 1}, "slug": self.slug})
        self.assertEqual(ok.status_code, 200, ok.content)

        # Juiz atrasado de outro jogo: não atropela.
        late = self.post(APIClient(), "sync_room", {"state": {"b": 2}, "slug": "cidade-dorme"})
        self.assertEqual(late.status_code, 409)
        self.room.refresh_from_db()
        self.assertEqual(self.room.state, {"a": 1})

        old_game = Game.objects.create(slug="caveira", name="Caveira")
        Room.objects.filter(pk=self.room.pk).update(game=old_game)
        response = self.post(APIClient(), "sync_room", {"state": {"c": 3}})
        self.assertEqual(response.status_code, 409, "jogo antigo tem motor próprio")

        missing = APIClient().post(self.url("sync_room", code="9999"), {"state": {}}, format="json")
        self.assertEqual(missing.status_code, 404)

    def test_the_next_sync_brings_the_judges_state(self):
        known = self.sync()["v"]
        written = self.post(APIClient(), "sync_room", {"state": {"g": {"round": 2}}}).json()["v"]
        data = self.sync(self.phone(1), v=known, mine=1)
        self.assertFalse(data["same"])
        self.assertEqual(data["v"], written)
        self.assertEqual(data["room"]["state"], {"g": {"round": 2}})
        self.assertTrue(self.sync(v=written)["same"])

    def test_a_stale_token_on_the_tv_does_not_block_the_judge(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Token 0000000000000000000000000000000000000000")
        self.assertEqual(self.post(client, "sync_room", {"state": {"ok": 1}}).status_code, 200)


class PlayerStateTests(DepositoTestBase):
    def test_player_state_bumps_the_version_and_reaches_the_judge(self):
        known = self.sync()["v"]
        response = self.post(self.phone(2), "state", {"state": {"hw": {"k": "r1", "vote": 3}}})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.version(), known + 1)

        data = self.sync(v=known)
        self.assertFalse(data["same"])
        mine = next(p for p in data["players"] if p["id"] == self.players[2].id)
        self.assertEqual(mine["state"], {"hw": {"k": "r1", "vote": 3}})


class FxTests(DepositoTestBase):
    def test_post_increments_the_id_and_keeps_only_known_keys(self):
        before = self.version()
        response = self.post(APIClient(), "fx", {"scare": "doot", "name": "Ana", "hack": "x"})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(set(body), {"fx", "v", "t"})
        fx = body["fx"]
        self.assertEqual(fx["id"], 1)
        self.assertEqual(fx["scare"], "doot")
        self.assertEqual(fx["name"], "Ana")
        self.assertNotIn("hack", fx)
        self.assertLess(abs(fx["at"] - ms_now()), 5000)
        self.assertEqual(body["v"], before + 1)
        self.assertEqual(self.version(), before + 1)

        # O pedido seguinte substitui: só o que veio nele.
        second = self.post(self.phone(0), "fx", {"music": "off"}).json()["fx"]
        self.assertEqual(second["id"], 2)
        self.assertEqual(second["music"], "off")
        self.assertNotIn("scare", second)

        self.room.refresh_from_db()
        self.assertEqual(self.room.fx, second)

    def test_values_are_short_text(self):
        fx = self.post(APIClient(), "fx", {"scare": 5, "music": None, "name": "N" * 200}).json()["fx"]
        self.assertNotIn("scare", fx)
        self.assertNotIn("music", fx)
        self.assertEqual(len(fx["name"]), deposito.FX_MAX_LENGTH)

    def test_get_returns_the_last_fx_and_the_clock(self):
        empty = APIClient().get(self.url("fx")).json()
        self.assertEqual(empty["fx"], {})
        self.assertLess(abs(empty["t"] - ms_now()), 5000)

        sent = self.post(APIClient(), "fx", {"scare": "random"}).json()["fx"]
        with self.assertNumQueries(1):
            response = APIClient().get(self.url("fx"))
        self.assertEqual(response.json()["fx"], sent)

    def test_fx_shows_up_in_sync_and_in_the_old_get(self):
        sent = self.post(APIClient(), "fx", {"scare": "spider"}).json()["fx"]
        self.assertEqual(self.sync()["room"]["fx"], sent)
        old = APIClient().get(f"/api/rooms/{self.room.code}/").json()
        self.assertEqual(old["fx"], sent)
        self.assertEqual(old["version"], self.version())

    def test_unknown_room_is_404(self):
        self.assertEqual(APIClient().get(self.url("fx", code="9999")).status_code, 404)
        missing = APIClient().post(self.url("fx", code="9999"), {"scare": "x"}, format="json")
        self.assertEqual(missing.status_code, 404)


# Cadastro e login usam senha de verdade: hash rápido para a suíte não arrastar.
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class GuestTests(TestCase):
    def guest(self, nickname, client=None):
        return (client or APIClient()).post("/api/auth/guest/", {"nickname": nickname}, format="json")

    def test_creates_an_account_without_email_or_password(self):
        response = self.guest("  Vampira  ")
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(set(body), {"token", "user"})
        self.assertEqual(set(body["user"]), {"id", "username", "email", "profile"})
        self.assertEqual(body["user"]["profile"], {"nickname": "Vampira"})
        self.assertTrue(body["user"]["email"].endswith("@convidado.sabadogames"))

        user = User.objects.get(pk=body["user"]["id"])
        self.assertFalse(user.has_usable_password())
        self.assertEqual(Token.objects.get(user=user).key, body["token"])

    def test_repeated_nickname_gets_a_number(self):
        names = [self.guest(nick).json()["user"]["profile"]["nickname"] for nick in ("Ana", "Ana", "Ana", "ana")]
        self.assertEqual(names, ["Ana", "Ana 2", "Ana 3", "ana 4"])

        # Apelido de conta cadastrada também conta.
        Profile.objects.filter(user=make_user("lobo")).update(nickname="Lobisomem")
        self.assertEqual(self.guest("Lobisomem").json()["user"]["profile"]["nickname"], "Lobisomem 2")

    def test_blank_nickname_is_rejected(self):
        for payload in ({"nickname": ""}, {"nickname": "   "}, {"nickname": None}, {}):
            response = APIClient().post("/api/auth/guest/", payload, format="json")
            self.assertEqual(response.status_code, 400, payload)
            self.assertIn("apelido", response.content.decode().lower())
        self.assertFalse(User.objects.exists(), "pedido recusado não cria conta")

    def test_long_nickname_is_cut_to_fit(self):
        first = self.guest("A" * 100).json()["user"]["profile"]["nickname"]
        self.assertEqual(first, "A" * 80)
        second = self.guest("A" * 100).json()["user"]["profile"]["nickname"]
        self.assertEqual(second, "A" * 78 + " 2")
        self.assertEqual(self.guest("Conde   Drácula").json()["user"]["profile"]["nickname"], "Conde Drácula")

    def test_the_token_logs_in(self):
        token = self.guest("Múmia").json()["token"]
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        me = client.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200, me.content)
        self.assertEqual(me.json()["user"]["profile"]["nickname"], "Múmia")

        game = Game.objects.create(slug="quiz-do-terror", name="Quiz do Terror")
        room = Room.objects.create(game=game, code="4242")
        joined = client.post(f"/api/rooms/{room.code}/join/", {}, format="json")
        self.assertEqual(joined.status_code, 200, joined.content)
        self.assertEqual(joined.json()["player"]["name"], "Múmia")

    def test_a_stale_token_does_not_block_entering(self):
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION="Token 0000000000000000000000000000000000000000")
        self.assertEqual(self.guest("Bruxa", stale).status_code, 201)
        register = stale.post(
            "/api/auth/register/",
            {"email": "zumbi@x.com", "password": "segredo123", "nickname": "Zumbi"},
            format="json",
        )
        self.assertEqual(register.status_code, 201, register.content)
        login = stale.post("/api/auth/login/", {"email": "zumbi@x.com", "password": "segredo123"}, format="json")
        self.assertEqual(login.status_code, 200, login.content)


class HalloweenStartTests(DepositoTestBase):
    def test_start_clears_every_state_and_goes_live(self):
        Room.objects.filter(pk=self.room.pk).update(state={"g": {"phase": "scores"}, "_cmd": 4})
        self.set_states({"hw": {"k": "x"}}, {"cmd": {"id": 2, "type": "next"}}, {"hws": {"draw": []}})
        before = self.version()

        response = APIClient().post(self.url("start"), {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "live")
        self.assertEqual(response.json()["state"], {})

        self.room.refresh_from_db()
        self.assertEqual(self.room.status, "live")
        self.assertEqual(self.room.state, {})
        self.assertGreater(self.room.version, before)
        for player in Player.objects.filter(room=self.room):
            self.assertEqual(player.state, {})

    def test_start_response_does_not_query_per_player(self):
        counts = []
        for extra in range(2):
            with CaptureQueriesContext(connection) as queries:
                response = APIClient().post(self.url("start"), {}, format="json")
            self.assertEqual(response.status_code, 200, response.content)
            counts.append(len(queries))
            for index in range(5):
                user = make_user(f"extra{extra}-{index}")
                Player.objects.create(room=self.room, user=user, name=user.email, ready=True)
        self.assertEqual(counts[0], counts[1], "a resposta não pode custar consultas por jogador")

    def test_start_does_not_wait_for_ready(self):
        # Halloween: quem joga sai de quem está online no "Começar" do jogo;
        # um celular dormindo sem "pronto" não trava a festa.
        Player.objects.filter(pk=self.players[1].pk).update(ready=False, state={"hw": 1})
        response = APIClient().post(self.url("start"), {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, "live")
        self.assertEqual(Player.objects.get(pk=self.players[1].pk).state, {})

    def test_old_games_still_wait_for_everyone_ready(self):
        old = Game.objects.create(slug="quiz-da-mesa", name="Quiz da Mesa", min_players=1, max_players=15)
        Room.objects.filter(pk=self.room.pk).update(game=old)
        Player.objects.filter(pk=self.players[1].pk).update(ready=False)
        response = APIClient().post(self.url("start"), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, "lobby")

    def test_old_endpoints_leave_halloween_games_alone(self):
        state = {"g": {"phase": "talk", "private": {"1": "segredo"}}}
        Room.objects.filter(pk=self.room.pk).update(state=state, status="live")
        self.set_states({"hw": {"k": "a"}}, {}, {})

        # O GET antigo funciona e entrega o estado como o juiz gravou.
        old = self.phone(1).get(f"/api/rooms/{self.room.code}/")
        self.assertEqual(old.status_code, 200, old.content)
        self.assertEqual(old.json()["state"], state)
        self.assertEqual(old.json()["players"][0]["state"], {"hw": {"k": "a"}})

        # Nenhum tick antigo mexe na sala.
        self.room.refresh_from_db()
        self.assertEqual(_tick_new_games(self.room), state)
        self.assertEqual(self.post(APIClient(), "quiz_tick").status_code, 400)
        self.room.refresh_from_db()
        self.assertEqual(self.room.state, state)
        self.assertEqual(redact_room_state(self.slug, "live", state), state)


class ThrottleTests(DepositoTestBase):
    def test_old_get_writes_last_seen_at_most_every_15_seconds(self):
        recent = self.set_seen(0, 5)
        response = self.phone(0).get(f"/api/rooms/{self.room.code}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.seen(0), recent)

        old = self.set_seen(0, 20)
        self.phone(0).get(f"/api/rooms/{self.room.code}/")
        self.assertGreater(self.seen(0), old)

        # Voltando depois de sumir: grava e a própria resposta já o mostra online.
        self.set_seen(0, 45)
        data = self.phone(0).get(f"/api/rooms/{self.room.code}/").json()
        me = next(p for p in data["players"] if p["id"] == self.players[0].id)
        self.assertTrue(me["online"])

    def test_old_get_does_not_query_per_player(self):
        client = self.phone(0)
        for extra in range(2):
            # Token, sala + jogo, jogadores + usuários + perfis (presença recente: nada a gravar).
            with self.assertNumQueries(3):
                response = client.get(f"/api/rooms/{self.room.code}/")
            self.assertEqual(response.json()["players"][0]["user"]["profile"]["nickname"], "Fantasma p0")
            for index in range(5):
                user = make_user(f"extra{extra}-{index}")
                Player.objects.create(room=self.room, user=user, name=user.email)

    def test_heartbeat_writes_at_most_every_15_seconds(self):
        payload = {"player_id": self.players[1].id}
        recent = self.set_seen(1, 5)
        self.assertEqual(self.post(self.phone(1), "heartbeat", payload).status_code, 200)
        self.assertEqual(self.seen(1), recent)

        old = self.set_seen(1, 16)
        self.assertEqual(self.post(self.phone(1), "heartbeat", payload).status_code, 200)
        self.assertGreater(self.seen(1), old)

        online = {p["id"]: p["online"] for p in APIClient().get(f"/api/rooms/{self.room.code}/").json()["players"]}
        self.assertTrue(online[self.players[1].id])

    def test_tv_ping_writes_at_most_every_10_seconds(self):
        recent = self.set_tv_seen(5)
        response = self.post(APIClient(), "tv_ping", {"device_id": "tv-1"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["tv_connected"])
        # Aparelho novo grava na hora, mesmo dentro dos 10 s.
        self.assertGreater(self.tv_seen(), recent)

        recent = self.set_tv_seen(5)
        self.post(APIClient(), "tv_ping", {"device_id": "tv-1"})
        self.assertEqual(self.tv_seen(), recent, "mesma TV, 5 s: não grava")
        self.assertTrue(APIClient().get(f"/api/rooms/{self.room.code}/").json()["tv_connected"])

        old = self.set_tv_seen(11)
        self.post(APIClient(), "tv_ping", {})
        self.assertGreater(self.tv_seen(), old)
        self.room.refresh_from_db()
        self.assertEqual(self.room.tv_device_id, "tv-1")


class VersionBumpTests(DepositoTestBase):
    """A versão sobe exatamente uma vez em cada ação que as telas precisam ver."""

    def assertBumps(self, do):
        before = self.version()
        response = do()
        self.assertLess(response.status_code, 300, response.content)
        self.assertEqual(self.version(), before + 1)

    def test_every_listed_action_bumps_once(self):
        Game.objects.create(slug="cidade-dorme", name="Cidade Dorme", min_players=5, max_players=15)
        newcomer = make_user("novo")
        newcomer_client = APIClient()
        newcomer_client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=newcomer).key}")
        host = self.phone(0)

        self.assertBumps(lambda: self.post(newcomer_client, "join"))
        self.assertBumps(lambda: self.post(newcomer_client, "ready", {"ready": True}))
        self.assertBumps(lambda: self.post(APIClient(), "start"))
        self.assertBumps(lambda: self.post(self.phone(1), "state", {"state": {"hw": {"k": "a"}}}))
        self.assertBumps(lambda: self.post(APIClient(), "sync_room", {"state": {"g": 1}}))
        self.assertBumps(lambda: self.post(host, "fx", {"scare": "doot"}))
        self.assertBumps(lambda: self.post(host, "tutorial", {"active": True, "step": 1}))
        self.assertBumps(lambda: self.post(APIClient(), "end"))
        self.assertBumps(lambda: self.post(host, "restart"))
        self.assertBumps(lambda: self.post(APIClient(), "change_game", {"game_slug": "cidade-dorme"}))

        self.room.refresh_from_db()
        self.assertEqual(self.room.game.slug, "cidade-dorme")
        self.assertEqual(self.sync(v=self.version())["same"], True)

    def test_change_game_answers_with_the_fresh_players(self):
        Game.objects.create(slug="cidade-dorme", name="Cidade Dorme")
        self.set_states({"hw": 1}, {"hw": 2}, {"hw": 3})
        Player.objects.filter(room=self.room).update(ready=False)
        data = self.post(APIClient(), "change_game", {"game_slug": "cidade-dorme"}).json()
        self.assertTrue(all(p["ready"] for p in data["players"]))
        self.assertTrue(all(p["state"] == {} for p in data["players"]))
        self.assertEqual(data["version"], self.version())

    def test_bump_is_an_atomic_increment(self):
        before = self.version()
        deposito.bump_version(self.room.pk)
        deposito.bump_version(self.room)
        self.assertEqual(self.version(), before + 2)
        self.assertLessEqual(self.room.version, self.version(), "em memória é piso, nunca à frente")

        deferred = Room.objects.defer("version").get(pk=self.room.pk)
        deposito.bump_version(deferred)
        self.assertEqual(deferred.version, self.version(), "campo adiado: lê do banco, sem +1 a mais")


class CatalogTests(TestCase):
    EXPECTED = {
        "espiao-assombrado": ("Espião Assombrado", 3, 15),
        "cidade-dorme": ("Cidade Dorme", 5, 15),
        "retrato-assombrado": ("Retrato Assombrado", 3, 15),
        "mentira-macabra": ("Mentira Macabra", 3, 15),
        "resposta-do-alem": ("Resposta do Além", 3, 15),
        "quem-morre-primeiro": ("Quem Morre Primeiro?", 3, 15),
        "abobora-bomba": ("Abóbora-Bomba", 2, 15),
        "portas-do-alem": ("Portas do Além", 2, 15),
        "quiz-do-terror": ("Quiz do Terror", 1, 15),
        "corrida-de-vassouras": ("Corrida de Vassouras", 2, 15),
    }

    def test_seed_creates_the_ten_halloween_games(self):
        call_command("seed_games", stdout=io.StringIO())
        self.assertEqual(Game.objects.count(), 35, "10 de Halloween + os 25 de sempre")
        for slug, (name, low, high) in self.EXPECTED.items():
            game = Game.objects.get(slug=slug)
            self.assertEqual((game.name, game.min_players, game.max_players), (name, low, high))
            self.assertTrue(game.is_active)
            self.assertTrue(game.description)
            self.assertTrue(all(ord(char) < 0x2000 for char in game.name), f"{name}: sem emoji")
        # Rodar de novo não duplica nada.
        call_command("seed_games", stdout=io.StringIO())
        self.assertEqual(Game.objects.count(), 35)

    def test_slug_list_matches_the_table(self):
        self.assertEqual(list(HALLOWEEN_SLUGS), list(self.EXPECTED))
        self.assertTrue(all(is_halloween(slug) for slug in HALLOWEEN_SLUGS))
        for other in ("a-cacada", "quiz-da-mesa", "", None):
            self.assertFalse(is_halloween(other))

    @skipUnless(FRONTEND_SLUGS.exists(), "frontend fora do checkout")
    def test_backend_and_frontend_share_the_same_list(self):
        source = FRONTEND_SLUGS.read_text(encoding="utf-8")
        block = source.split("HALLOWEEN_SLUGS = [", 1)[1].split("]", 1)[0]
        self.assertEqual(tuple(re.findall(r"'([a-z-]+)'", block)), HALLOWEEN_SLUGS)
