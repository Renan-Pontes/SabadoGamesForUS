"""
Regressoes relatadas na mesa.

Cada teste aqui e um bug que alguem viu jogando. Se voltar, quebra aqui antes
de quebrar na festa.
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import caveira
from .models import Game, Player, Room
from .tests import make_user
from .views import SUGOROKU_CENTER, SUGOROKU_CORNERS


class MesaTestBase(TestCase):
    slug = None
    player_count = 4

    def setUp(self):
        self.game = Game.objects.create(
            slug=self.slug, name=self.slug, min_players=2, max_players=12
        )
        self.room = Room.objects.create(game=self.game, code=f"6{id(self) % 900 + 100:03d}")
        self.users = [make_user(i) for i in range(self.player_count)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Jogador{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]

    def client_by_id(self, player_id):
        index = next(i for i, p in enumerate(self.players) if p.id == player_id)
        client = APIClient()
        client.force_authenticate(self.users[index])
        return client

    def post(self, player_id, action, payload=None):
        return self.client_by_id(player_id).post(
            f"/api/rooms/{self.room.code}/{action}/", payload or {}, format="json"
        )

    def view(self, player_id):
        return self.client_by_id(player_id).get(f"/api/rooms/{self.room.code}/").json()

    def start(self, payload=None):
        response = APIClient().post(
            f"/api/rooms/{self.room.code}/start/", payload or {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        return self.room.state

    def refresh(self):
        self.room.refresh_from_db()
        return self.room.state


class LeilaoLanceNoUltimoSegundoTests(MesaTestBase):
    slug = "leilao-de-cem-votos"
    player_count = 3

    def test_late_bid_does_not_close_the_round_with_itself_as_winner(self):
        """
        Bug: dar um lance faltando dois segundos fechava a rodada na hora, com o
        proprio lance vencendo — ninguem mais tinha chance de cobrir.
        """
        self.start()
        state = self.refresh()
        # Simula o relogio quase no fim: o prazo vence em 1 segundo.
        state["deadline_ts"] = timezone.now().timestamp() + 1
        self.room.state = state
        self.room.save(update_fields=["state"])

        bidder = self.players[0].id
        response = self.post(bidder, "leilao_bid", {"bid": 5})
        self.assertEqual(response.status_code, 200, response.content)

        state = self.refresh()
        self.assertEqual(state["round"], 1, "a rodada nao pode ter virado")
        self.assertEqual(state["highest_bid"], 5, "o lance continua em disputa")
        self.assertIsNone(state["last_winner_id"], "ninguem levou o pote ainda")
        self.assertGreater(
            state["deadline_ts"],
            timezone.now().timestamp() + 10,
            "o lance renovou o relogio para os outros cobrirem",
        )

    def test_a_bid_after_the_deadline_still_resets_the_clock(self):
        self.start()
        state = self.refresh()
        state["deadline_ts"] = timezone.now().timestamp() - 0.5
        self.room.state = state
        self.room.save(update_fields=["state"])

        response = self.post(self.players[1].id, "leilao_bid", {"bid": 3})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["highest_bidder_id"], self.players[1].id)


class SintoniaVidenteVeOAlvoTests(MesaTestBase):
    slug = "sintonia"
    player_count = 4

    def test_psychic_sees_the_target_and_nobody_else_does(self):
        """Bug: o alvo era escondido de todo mundo — inclusive do vidente."""
        state = self.start()
        psychic = state["psychic_id"]

        view = self.view(psychic)
        me = next(p for p in view["players"] if p["id"] == psychic)
        self.assertIsInstance(me["state"]["psychic_target"], int, "o vidente precisa ver o alvo")
        self.assertNotIn("target", view["state"], "o estado da sala continua sem o alvo")

        other = next(p.id for p in self.players if p.id != psychic)
        view = self.view(other)
        for entry in view["players"]:
            if entry["id"] == other:
                # O proprio campo aparece, mas vazio: nao e vidente.
                self.assertIsNone(entry["state"].get("psychic_target"))
            else:
                self.assertNotIn(
                    "psychic_target", entry["state"], "o alvo do vidente nao vaza para os outros"
                )
        self.assertNotIn("target", view["state"])

    def test_target_rotates_with_the_psychic(self):
        state = self.start()
        first = state["psychic_id"]
        view = self.view(first)
        mine = next(p for p in view["players"] if p["id"] == first)
        self.assertEqual(mine["state"]["psychic_target"], self.refresh()["target"])


class CaveiraRegrasDaMesaTests(MesaTestBase):
    slug = "caveira"
    player_count = 3

    def place_all_once(self):
        for _ in range(len(self.players)):
            state = self.refresh()
            current = caveira.current_player_id(state)
            response = self.post(current, "caveira_place", {"card": "rosa"})
            self.assertEqual(response.status_code, 200, response.content)

    def test_hand_sizes_are_known_from_the_first_frame(self):
        """Bug: a TV mostrava '0 CARTAS' para todo mundo ate a primeira jogada."""
        state = self.start()
        for player in self.players:
            self.assertEqual(state["hand_sizes"][str(player.id)], 4)

    def test_bidding_only_opens_after_everyone_placed_a_card(self):
        """Regra do Skull: a primeira volta e so de empilhar."""
        self.start()
        state = self.refresh()
        first = caveira.current_player_id(state)
        # Na primeira vez nao da para apostar de jeito nenhum.
        self.assertEqual(self.post(first, "caveira_bid", {"amount": 1}).status_code, 400)

        self.place_all_once()
        state = self.refresh()
        self.assertTrue(caveira.everyone_placed(state), "todos com uma carta na mesa")
        # Completada a volta, quem esta na vez pode abrir o leilao.
        opener = caveira.current_player_id(state)
        self.assertEqual(self.post(opener, "caveira_bid", {"amount": 1}).status_code, 200)
        self.assertEqual(self.refresh()["phase"], "bidding")

    def test_leader_is_skipped_and_flipping_starts_when_others_pass(self):
        """
        Bug: a vez voltava para o dono do maior lance, que nao tem como cobrir
        a si mesmo, e a tela pedia para ele 'cobrir ou passar'.
        """
        self.start()
        self.place_all_once()
        state = self.refresh()
        opener = caveira.current_player_id(state)
        self.assertEqual(self.post(opener, "caveira_bid", {"amount": 1}).status_code, 200)

        state = self.refresh()
        self.assertEqual(state["phase"], "bidding")
        self.assertNotEqual(
            caveira.current_player_id(state), opener, "a vez passa para quem pode cobrir"
        )

        # Os outros dois passam; a vez nunca deve cair no lider.
        for _ in range(2):
            state = self.refresh()
            current = caveira.current_player_id(state)
            self.assertNotEqual(current, opener)
            self.assertEqual(self.post(current, "caveira_pass").status_code, 200)

        state = self.refresh()
        self.assertEqual(state["phase"], "flipping", "sem ninguem para cobrir, comeca a virar")
        self.assertEqual(state["flip"]["player_id"], opener)


class SugorokuSaidaEscondidaTests(MesaTestBase):
    slug = "future-sugoroku"
    player_count = 3

    def test_everyone_starts_in_the_center(self):
        state = self.start()
        self.assertEqual(state["start"], list(SUGOROKU_CENTER))
        for player in Player.objects.filter(room=self.room):
            self.assertEqual(player.state["position"], list(SUGOROKU_CENTER))

    def test_exit_is_a_corner_and_hidden_until_the_end(self):
        state = self.start()
        self.assertIn(tuple(state["exit"]), SUGOROKU_CORNERS, "a saida e uma quina")
        self.assertEqual(len(state["corners"]), 4)
        self.assertEqual(state["dead_ends"], [])

        view = self.view(self.players[0].id)
        self.assertNotIn("exit", view["state"], "ninguem sabe qual quina e")
        self.assertIn("corners", view["state"], "mas todo mundo sabe quais sao as candidatas")

        # A TV anonima tambem nao ve.
        tv = APIClient().get(f"/api/rooms/{self.room.code}/").json()
        self.assertNotIn("exit", tv["state"])

    def test_no_penalty_on_the_center_or_the_corners(self):
        state = self.start()
        forbidden = {f"{c[0]},{c[1]}" for c in SUGOROKU_CORNERS}
        forbidden.add(f"{SUGOROKU_CENTER[0]},{SUGOROKU_CENTER[1]}")
        for key in state["penalties"]:
            self.assertNotIn(key, forbidden, "armadilha na largada ou numa quina seria injusto")
