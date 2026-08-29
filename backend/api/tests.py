"""Testes das regras dos minigames que dependem do que cada tela pode ver."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Game, Player, Profile, Room

User = get_user_model()


def make_user(index):
    user = User.objects.create_user(
        username=f"p{index}@x.com", email=f"p{index}@x.com", password="secret123"
    )
    Profile.objects.create(user=user, nickname=f"Jogador{index}")
    return user


class BlefJackFlowTests(TestCase):
    def setUp(self):
        self.game = Game.objects.create(slug="blef-jack", name="Blef Jack", min_players=2, max_players=12)
        self.room = Room.objects.create(game=self.game, code="1234")
        self.users = [make_user(i) for i in range(3)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Jogador{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]

    def client_for(self, index):
        client = APIClient()
        client.force_authenticate(self.users[index])
        return client

    def test_declare_then_guess_reveals_round(self):
        start = APIClient().post(f"/api/rooms/{self.room.code}/start/", {}, format="json")
        self.assertEqual(start.status_code, 200, start.content)

        self.room.refresh_from_db()
        self.assertEqual(self.room.state["phase"], "declare", "a rodada deve comecar no blefe")

        # Apostar antes de todos declararem deve ser recusado.
        early = self.client_for(0).post(
            f"/api/rooms/{self.room.code}/blef_jack_guess/",
            {"winner_player_id": self.players[1].id},
            format="json",
        )
        self.assertEqual(early.status_code, 400, "nao deveria aceitar aposta na fase de blefe")

        for index in range(3):
            response = self.client_for(index).post(
                f"/api/rooms/{self.room.code}/blef_jack_declare/",
                {"declared_value": 15 + index},
                format="json",
            )
            self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        self.assertEqual(self.room.state["phase"], "guess", "apos todos declararem, abre a aposta")

        # A declaracao dos outros e publica; as cartas nao.
        view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()
        others = [p for p in view["players"] if p["id"] != self.players[0].id]
        self.assertTrue(all(p["state"].get("declared_value") is not None for p in others))
        self.assertTrue(all("cards" not in p["state"] for p in others))

        for index in range(3):
            response = self.client_for(index).post(
                f"/api/rooms/{self.room.code}/blef_jack_guess/",
                {"winner_player_id": self.players[0].id},
                format="json",
            )
            self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        state = self.room.state
        self.assertEqual(state["round"], 2, "a rodada deve avancar")
        self.assertEqual(state["phase"], "declare", "a rodada nova volta ao blefe")
        self.assertEqual(state["last_round"], 1)
        self.assertTrue(state["last_winner_ids"], "os vencedores da rodada devem sobreviver ao reset")
        self.assertEqual(len(state["last_reveal"]), 3, "a revelacao cobre todos os jogadores")
        for entry in state["last_reveal"].values():
            self.assertIsNotNone(entry["declared"])
            self.assertEqual(len(entry["cards"]), 2)

        # A declaracao nao pode vazar para a rodada seguinte.
        for player in Player.objects.filter(room=self.room):
            self.assertIsNone(player.state.get("declared_value"))


class LeilaoBidTests(TestCase):
    def setUp(self):
        self.game = Game.objects.create(
            slug="leilao-de-cem-votos", name="Leilao", min_players=2, max_players=12
        )
        self.room = Room.objects.create(game=self.game, code="5678")
        self.users = [make_user(i) for i in range(2)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Jogador{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]
        APIClient().post(f"/api/rooms/{self.room.code}/start/", {}, format="json")

    def client_for(self, index):
        client = APIClient()
        client.force_authenticate(self.users[index])
        return client

    def test_highest_bid_is_public_and_own_bid_is_visible(self):
        response = self.client_for(0).post(
            f"/api/rooms/{self.room.code}/leilao_bid/", {"bid": 7}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)

        view = self.client_for(1).get(f"/api/rooms/{self.room.code}/").json()
        self.assertEqual(view["state"]["highest_bid"], 7, "o lance a bater e publico")
        self.assertEqual(view["state"]["highest_bidder_id"], self.players[0].id)

        # O oponente nao ve o lance nem os pontos individuais do outro.
        opponent = next(p for p in view["players"] if p["id"] == self.players[0].id)
        self.assertNotIn("bid", opponent["state"])
        self.assertNotIn("points", opponent["state"])

        # Mas cada um ve o proprio lance.
        own_view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()
        me = next(p for p in own_view["players"] if p["id"] == self.players[0].id)
        self.assertEqual(me["state"]["bid"], 7)
        self.assertTrue(me["state"]["submitted"])

    def test_bid_must_beat_the_public_highest(self):
        self.client_for(0).post(f"/api/rooms/{self.room.code}/leilao_bid/", {"bid": 10}, format="json")
        low = self.client_for(1).post(
            f"/api/rooms/{self.room.code}/leilao_bid/", {"bid": 10}, format="json"
        )
        self.assertEqual(low.status_code, 400, "empatar o topo nao vale")

        high = self.client_for(1).post(
            f"/api/rooms/{self.room.code}/leilao_bid/", {"bid": 11}, format="json"
        )
        self.assertEqual(high.status_code, 200, high.content)


class BelezaRevealTests(TestCase):
    def setUp(self):
        self.game = Game.objects.create(
            slug="concurso-de-beleza", name="Beleza", min_players=2, max_players=12
        )
        self.room = Room.objects.create(game=self.game, code="4321")
        self.users = [make_user(i) for i in range(3)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Jogador{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]
        APIClient().post(f"/api/rooms/{self.room.code}/start/", {}, format="json")

    def client_for(self, index):
        client = APIClient()
        client.force_authenticate(self.users[index])
        return client

    def test_guesses_are_revealed_only_after_resolution(self):
        self.client_for(0).post(f"/api/rooms/{self.room.code}/beleza_guess/", {"value": 10}, format="json")

        mid = self.client_for(1).get(f"/api/rooms/{self.room.code}/").json()
        self.assertFalse(mid["state"]["last_guesses"], "nada e revelado antes de todos jogarem")
        first = next(p for p in mid["players"] if p["id"] == self.players[0].id)
        self.assertNotIn("guess", first["state"], "o palpite individual nunca vaza")
        self.assertTrue(first["has_guessed"], "mas da pra saber que a pessoa ja jogou")

        self.client_for(1).post(f"/api/rooms/{self.room.code}/beleza_guess/", {"value": 20}, format="json")
        self.client_for(2).post(f"/api/rooms/{self.room.code}/beleza_guess/", {"value": 60}, format="json")

        self.room.refresh_from_db()
        state = self.room.state
        self.assertEqual(state["phase"], "showdown")
        self.assertEqual(len(state["last_guesses"]), 3)
        self.assertAlmostEqual(state["last_mean"], 30.0)
        self.assertAlmostEqual(state["last_target"], 24.0)
        self.assertEqual(state["last_winner_ids"], [self.players[1].id], "20 e o mais perto de 24")
