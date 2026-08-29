"""A Cacada: sigilo das pistas e do esconderijo, e o fluxo de turno."""

from django.test import TestCase
from rest_framework.test import APIClient

from . import cacada
from .models import Game, Player, Room
from .tests import make_user


class CacadaTests(TestCase):
    def setUp(self):
        self.game = Game.objects.create(
            slug="a-cacada", name="A Cacada", min_players=3, max_players=6
        )
        self.room = Room.objects.create(game=self.game, code="9001")
        self.users = [make_user(i) for i in range(4)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"Jogador{i}", is_host=(i == 0), ready=True
            )
            for i, user in enumerate(self.users)
        ]

    # -- helpers ---------------------------------------------------------

    def client_for(self, index):
        client = APIClient()
        client.force_authenticate(self.users[index])
        return client

    def client_by_id(self, player_id):
        index = next(i for i, p in enumerate(self.players) if p.id == player_id)
        return self.client_for(index)

    def start(self, advanced=False):
        response = APIClient().post(
            f"/api/rooms/{self.room.code}/start/", {"advanced": advanced}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()

    def clues(self):
        return {p.id: p.state["clue"] for p in Player.objects.filter(room=self.room)}

    def run_setup_phase(self):
        board = self.room.state["map"]
        clues = self.clues()
        for _ in range(len(self.players)):
            self.room.refresh_from_db()
            player_id = cacada.current_player_id(self.room.state)
            eliminated = [
                key
                for key in board["hexes"]
                if not cacada.clue_allows(board, clues[player_id], key)
            ]
            response = self.client_by_id(player_id).post(
                f"/api/rooms/{self.room.code}/cacada_setup/",
                {"hex": eliminated[0]},
                format="json",
            )
            self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()

    # -- geracao ---------------------------------------------------------

    def test_puzzle_has_exactly_one_solution(self):
        self.start()
        state = self.room.state
        board = state["map"]
        clues = self.clues()
        self.assertEqual(len(clues), 4, "cada jogador recebe uma pista")

        matching = [
            key
            for key in board["hexes"]
            if all(cacada.clue_allows(board, clue, key) for clue in clues.values())
        ]
        self.assertEqual(matching, [state["solution"]], "o esconderijo deve ser unico")

    def test_every_clue_is_necessary(self):
        self.start()
        board = self.room.state["map"]
        clues = list(self.clues().values())
        for index in range(len(clues)):
            others = [clue for position, clue in enumerate(clues) if position != index]
            matching = [
                key
                for key in board["hexes"]
                if all(cacada.clue_allows(board, clue, key) for clue in others)
            ]
            self.assertGreater(
                len(matching), 1, "sem a pista de um jogador o mapa nao pode ficar resolvido"
            )

    def test_three_players_is_the_minimum(self):
        room = Room.objects.create(game=self.game, code="9500")
        for index in range(2):
            Player.objects.create(room=room, user=self.users[index], name=f"J{index}", ready=True)
        response = APIClient().post(f"/api/rooms/{room.code}/start/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    # -- sigilo ----------------------------------------------------------

    def test_secrets_never_leak(self):
        self.start()
        view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()

        self.assertNotIn("solution", view["state"], "o esconderijo nao pode sair do servidor")

        me = next(p for p in view["players"] if p["id"] == self.players[0].id)
        self.assertIn("clue", me["state"], "cada um enxerga a propria pista")
        for other in view["players"]:
            if other["id"] != self.players[0].id:
                self.assertNotIn("clue", other["state"], "a pista alheia nao pode vazar")

        # A TV e anonima: nao ve pista nenhuma.
        tv = APIClient().get(f"/api/rooms/{self.room.code}/").json()
        self.assertNotIn("solution", tv["state"])
        for entry in tv["players"]:
            self.assertNotIn("clue", entry["state"])

        # Mapa e marcadores sao publicos: e o tabuleiro na mesa.
        self.assertIn("map", tv["state"])
        self.assertIn("markers", tv["state"])

    # -- fluxo de turno --------------------------------------------------

    def test_setup_requires_a_hex_your_clue_eliminates(self):
        self.start()
        board = self.room.state["map"]
        clues = self.clues()
        player_id = cacada.current_player_id(self.room.state)
        allowed = next(
            key for key in board["hexes"] if cacada.clue_allows(board, clues[player_id], key)
        )
        response = self.client_by_id(player_id).post(
            f"/api/rooms/{self.room.code}/cacada_setup/", {"hex": allowed}, format="json"
        )
        self.assertEqual(response.status_code, 400, "nao marca 'nao' onde a pista permite")

        self.run_setup_phase()
        self.assertEqual(self.room.state["phase"], "playing")
        # Dois jogadores podem marcar o mesmo hexagono, entao conta-se por
        # marcador e nao por hexagono.
        placed = sum(len(owners) for owners in self.room.state["markers"].values())
        self.assertEqual(placed, 4, "um cubo de abertura por jogador")

    def test_acting_out_of_turn_is_rejected(self):
        self.start()
        self.run_setup_phase()
        current = cacada.current_player_id(self.room.state)
        other = next(p.id for p in self.players if p.id != current)
        board = self.room.state["map"]
        response = self.client_by_id(other).post(
            f"/api/rooms/{self.room.code}/cacada_ask/",
            {"target_player_id": current, "hex": next(iter(board["hexes"]))},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_a_no_forces_the_asker_to_reveal(self):
        self.start()
        self.run_setup_phase()
        board = self.room.state["map"]
        clues = self.clues()

        asker = cacada.current_player_id(self.room.state)
        target = next(p.id for p in self.players if p.id != asker)
        # Um hex que a pista do alvo elimina: a resposta sera "nao".
        denied = next(
            key
            for key in board["hexes"]
            if not cacada.clue_allows(board, clues[target], key)
            and cacada.marker_at(self.room.state, key, target) is None
        )
        response = self.client_by_id(asker).post(
            f"/api/rooms/{self.room.code}/cacada_ask/",
            {"target_player_id": target, "hex": denied},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        state = self.room.state
        self.assertEqual(state["markers"][denied][str(target)], "cube")
        self.assertEqual(
            state["pending_penalty_player_id"], asker, "quem leva o nao paga com informacao"
        )

        # Enquanto a penalidade nao e paga, o jogo trava.
        blocked = self.client_by_id(asker).post(
            f"/api/rooms/{self.room.code}/cacada_search/", {"hex": denied}, format="json"
        )
        self.assertEqual(blocked.status_code, 400)

        penalty_hex = next(
            key
            for key in board["hexes"]
            if not cacada.clue_allows(board, clues[asker], key)
            and cacada.marker_at(state, key, asker) is None
        )
        response = self.client_by_id(asker).post(
            f"/api/rooms/{self.room.code}/cacada_penalty/", {"hex": penalty_hex}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        self.assertIsNone(self.room.state["pending_penalty_player_id"])
        self.assertNotEqual(
            cacada.current_player_id(self.room.state), asker, "o turno passa adiante"
        )

    def test_a_yes_passes_the_turn_without_penalty(self):
        self.start()
        self.run_setup_phase()
        board = self.room.state["map"]
        clues = self.clues()

        asker = cacada.current_player_id(self.room.state)
        target = next(p.id for p in self.players if p.id != asker)
        allowed = next(
            key
            for key in board["hexes"]
            if cacada.clue_allows(board, clues[target], key)
            and cacada.marker_at(self.room.state, key, target) is None
        )
        response = self.client_by_id(asker).post(
            f"/api/rooms/{self.room.code}/cacada_ask/",
            {"target_player_id": target, "hex": allowed},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        self.assertEqual(self.room.state["markers"][allowed][str(target)], "disc")
        self.assertIsNone(self.room.state["pending_penalty_player_id"])
        self.assertNotEqual(cacada.current_player_id(self.room.state), asker)

    def test_cannot_search_a_hex_your_own_clue_rules_out(self):
        self.start()
        self.run_setup_phase()
        board = self.room.state["map"]
        clues = self.clues()
        searcher = cacada.current_player_id(self.room.state)
        denied = next(
            key for key in board["hexes"] if not cacada.clue_allows(board, clues[searcher], key)
        )
        response = self.client_by_id(searcher).post(
            f"/api/rooms/{self.room.code}/cacada_search/", {"hex": denied}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_searching_the_hideout_wins_and_reveals_it(self):
        self.start()
        self.run_setup_phase()
        solution = self.room.state["solution"]
        # O esconderijo satisfaz todas as pistas: todos responderao sim.
        searcher = cacada.current_player_id(self.room.state)
        response = self.client_by_id(searcher).post(
            f"/api/rooms/{self.room.code}/cacada_search/", {"hex": solution}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        self.assertEqual(self.room.state["phase"], "ended")
        self.assertEqual(self.room.state["winner_id"], searcher)
        self.assertEqual(self.room.status, "ended")

        # Terminada a cacada, o esconderijo finalmente aparece.
        view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()
        self.assertEqual(view["state"]["solution"], solution)

    def test_failed_search_stops_at_the_first_no(self):
        self.start()
        self.run_setup_phase()
        board = self.room.state["map"]
        clues = self.clues()
        searcher = cacada.current_player_id(self.room.state)
        order = self.room.state["order"]

        # Hex que o proprio buscador aceita mas alguem mais recusa.
        target_hex = next(
            key
            for key in board["hexes"]
            if cacada.clue_allows(board, clues[searcher], key)
            and any(not cacada.clue_allows(board, clues[pid], key) for pid in order)
        )
        response = self.client_by_id(searcher).post(
            f"/api/rooms/{self.room.code}/cacada_search/", {"hex": target_hex}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)

        self.room.refresh_from_db()
        state = self.room.state
        self.assertNotEqual(state["phase"], "ended")
        self.assertEqual(state["pending_penalty_player_id"], searcher)

        entry = state["log"][-1]
        self.assertEqual(entry["type"], "search")
        self.assertFalse(entry["success"])
        answers = entry["answers"]
        self.assertEqual(answers[-1]["answer"], "cube", "a busca para no primeiro nao")
        self.assertTrue(
            all(a["answer"] == "disc" for a in answers[:-1]),
            "ninguem depois do 'nao' responde",
        )
        self.assertLess(len(answers), len(order) + 1)

    def test_advanced_mode_can_deal_negative_clues(self):
        seen_negative = False
        for index in range(12):
            room = Room.objects.create(game=self.game, code=f"91{index:02d}")
            for i, user in enumerate(self.users):
                Player.objects.create(room=room, user=user, name=f"J{i}", ready=True)
            APIClient().post(f"/api/rooms/{room.code}/start/", {"advanced": True}, format="json")
            if any(
                (p.state.get("clue") or {}).get("negated")
                for p in Player.objects.filter(room=room)
            ):
                seen_negative = True
                break
        self.assertTrue(seen_negative, "modo avancado deve poder sortear pistas negativas")
