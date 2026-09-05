"""Corrida de Camelos e Nao Para: a TV e o tabuleiro, o celular e o bolso."""

from django.test import TestCase
from rest_framework.test import APIClient

from . import camelos, naopara
from .models import Game, Player, Room
from .tests import make_user


class Base(TestCase):
    slug = None
    player_count = 3

    def setUp(self):
        self.game = Game.objects.create(slug=self.slug, name=self.slug, min_players=2, max_players=8)
        self.room = Room.objects.create(game=self.game, code=f"6{id(self) % 900 + 100:03d}")
        self.users = [make_user(i) for i in range(self.player_count)]
        self.players = [
            Player.objects.create(
                room=self.room, user=user, name=f"J{i}", is_host=(i == 0), ready=True
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

    def me_in(self, player_id):
        return next(p for p in self.view(player_id)["players"] if p["id"] == player_id)

    def start(self):
        response = APIClient().post(f"/api/rooms/{self.room.code}/start/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        return self.room.state

    def refresh(self):
        self.room.refresh_from_db()
        return self.room.state

    def save_state(self, state):
        self.room.state = state
        self.room.save(update_fields=["state"])

    @staticmethod
    def current(state):
        return state["order"][state["turn_index"] % len(state["order"])]

    def other(self, state):
        return next(pid for pid in state["order"] if pid != self.current(state))


class CamelosTests(Base):
    slug = "corrida-de-camelos"

    def test_start_puts_five_camels_on_the_first_three_spaces(self):
        state = self.start()
        self.assertEqual(state["phase"], "leg")
        self.assertEqual(set(state["positions"]), set(camelos.CAMELS))
        for camel, space in state["positions"].items():
            self.assertTrue(1 <= space <= 3, f"{camel} largou em {space}")
            self.assertIn(camel, state["stacks"][str(space)])
        self.assertEqual(sum(len(stack) for stack in state["stacks"].values()), 5)

        view = self.view(self.players[0].id)
        self.assertEqual(len(view["state"]["ranking"]), 5)
        self.assertNotIn("final_winner_bets", view["state"], "apostas finais sao secretas")
        self.assertNotIn("final_loser_bets", view["state"])
        for player in view["players"]:
            self.assertEqual(player["state"]["coins"], camelos.STARTING_COINS)

    def test_only_the_current_player_rolls_and_earns_a_coin(self):
        state = self.start()
        actor, other = self.current(state), self.other(state)

        wrong = self.post(other, "camelos_roll")
        self.assertEqual(wrong.status_code, 400, "so quem esta na vez rola")

        response = self.post(actor, "camelos_roll")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(len(state["dice_left"]), 4)
        self.assertEqual(state["coins"][str(actor)], camelos.STARTING_COINS + 1)
        self.assertIn(state["last_roll"]["camel"], camelos.CAMELS)
        self.assertIn(state["last_roll"]["steps"], (1, 2, 3))
        self.assertNotEqual(self.current(state), actor, "a vez passa")
        for camel, space in state["positions"].items():
            self.assertIn(camel, state["stacks"][str(space)], "posicao e pilha coerentes")
        self.assertEqual(self.me_in(actor)["state"]["coins"], camelos.STARTING_COINS + 1)

    def test_leg_bet_takes_the_best_ticket_and_pays_when_the_leg_ends(self):
        state = self.start()
        bettor = self.current(state)

        response = self.post(bettor, "camelos_bet_leg", {"camel": "azul"})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["leg_bets"]["azul"], [3, 2], "a ficha de 5 saiu")
        self.assertEqual(self.me_in(bettor)["state"]["leg_bets"], [{"camel": "azul", "value": 5}])

        rolls = 0
        while state["leg"] == 1 and state["phase"] == "leg":
            response = self.post(self.current(state), "camelos_roll")
            self.assertEqual(response.status_code, 200, response.content)
            rolls += 1
            state = self.refresh()
        self.assertEqual(rolls, 5, "a etapa acaba quando os cinco dados sairam")
        if state["phase"] == "ended":
            return  # alguem cruzou a linha ja na primeira etapa: raro, mas valido

        payout = next(p for p in state["last_leg"]["payouts"] if p["player_id"] == bettor)
        first, second = state["last_leg"]["first"], state["last_leg"]["second"]
        expected = 5 if first == "azul" else 1 if second == "azul" else -1
        self.assertEqual(payout["delta"], expected)
        self.assertEqual(state["leg"], 2)
        self.assertEqual(state["leg_bets"]["azul"], [5, 3, 2], "as fichas voltam")
        self.assertEqual(len(state["dice_left"]), 5)
        self.assertEqual(self.me_in(bettor)["state"]["leg_bets"], [])

    def test_tiles_respect_the_track_rules(self):
        state = self.start()
        actor = self.current(state)
        occupied = int(next(iter(state["stacks"])))

        response = self.post(actor, "camelos_tile", {"space": occupied, "kind": "oasis"})
        self.assertEqual(response.status_code, 400, "nao pode em cima de camelo")

        response = self.post(actor, "camelos_tile", {"space": 10, "kind": "oasis"})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["tiles"]["10"], {"kind": "oasis", "owner_id": actor})

        second = self.current(state)
        self.assertNotEqual(second, actor)
        response = self.post(second, "camelos_tile", {"space": 11, "kind": "miragem"})
        self.assertEqual(response.status_code, 400, "nao pode encostar em outra armadilha")
        response = self.post(second, "camelos_tile", {"space": 13, "kind": "miragem"})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()

        third = self.current(state)
        response = self.post(third, "camelos_roll")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(self.current(state), actor)
        response = self.post(actor, "camelos_tile", {"space": 15, "kind": "oasis"})
        self.assertEqual(response.status_code, 400, "uma armadilha por jogador por etapa")

    def test_final_bets_stay_secret_until_the_finish_line(self):
        state = self.start()
        actor, other = self.current(state), self.other(state)

        response = self.post(actor, "camelos_bet_final", {"camel": "verde", "kind": "winner"})
        self.assertEqual(response.status_code, 200, response.content)

        mine = self.me_in(actor)
        theirs = self.view(other)
        me_seen_by_them = next(p for p in theirs["players"] if p["id"] == actor)
        self.assertEqual(mine["state"]["final_bets"], {"verde": "winner"})
        self.assertNotIn("final_bets", me_seen_by_them["state"])
        self.assertEqual(theirs["state"]["final_bets_count"], 1)
        self.assertNotIn("final_winner_bets", theirs["state"])

        state = self.refresh()
        state["turn_index"] = state["order"].index(actor)
        self.save_state(state)
        response = self.post(actor, "camelos_bet_final", {"camel": "verde", "kind": "loser"})
        self.assertEqual(response.status_code, 400, "uma carta por camelo")

    def test_crossing_the_finish_line_ends_the_race_and_pays_final_bets(self):
        state = self.start()
        actor = self.current(state)
        response = self.post(actor, "camelos_bet_final", {"camel": "azul", "kind": "winner"})
        self.assertEqual(response.status_code, 200, response.content)

        # Todos na ultima casa: qualquer dado cruza a linha.
        state = self.refresh()
        state["stacks"] = {str(camelos.TRACK_LENGTH): list(camelos.CAMELS)}
        state["positions"] = {camel: camelos.TRACK_LENGTH for camel in camelos.CAMELS}
        self.save_state(state)

        roller = self.current(state)
        response = self.post(roller, "camelos_roll")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(self.room.status, Room.STATUS_ENDED)

        result = state["result"]
        self.assertEqual(result["ranking"][0], result["winner_camel"])
        self.assertEqual(result["ranking"][-1], result["loser_camel"])
        self.assertTrue(state["winner_ids"])

        expected = camelos.STARTING_COINS
        expected += 1 if roller == actor else 0
        expected += camelos.FINAL_BET_PAYOUT[0] if result["winner_camel"] == "azul" else camelos.WRONG_FINAL_BET
        self.assertEqual(state["coins"][str(actor)], expected)

        view = self.view(self.other(state))
        self.assertIn("final_winner_bets", view["state"], "no fim as apostas ficam publicas")


class NaoParaTests(Base):
    slug = "nao-para"

    def test_start_and_turn_order(self):
        state = self.start()
        self.assertEqual(state["phase"], "rolling")
        self.assertEqual(sorted(state["order"]), sorted(p.id for p in self.players))

        view = self.view(self.players[0].id)
        self.assertEqual(view["state"]["current_player_id"], self.current(state))
        self.assertEqual(view["state"]["column_heights"]["7"], 13)

        wrong = self.post(self.other(state), "naopara_roll")
        self.assertEqual(wrong.status_code, 400, "so quem esta na vez rola")

    def test_cannot_stop_without_progress(self):
        state = self.start()
        response = self.post(self.current(state), "naopara_stop")
        self.assertEqual(response.status_code, 400)

    def test_roll_choose_and_stop_consolidate_progress(self):
        state = self.start()
        actor = self.current(state)

        response = self.post(actor, "naopara_roll")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "choosing", "na primeira rolada sempre ha opcao")
        self.assertEqual(len(state["dice"]), 4)
        self.assertTrue(state["options"])

        early_stop = self.post(actor, "naopara_stop")
        self.assertEqual(early_stop.status_code, 400, "decide o par antes de parar")

        chosen = state["options"][0]
        response = self.post(actor, "naopara_choose", {"option_index": 0})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "rolling")
        for column in chosen["columns"]:
            self.assertGreaterEqual(state["runners"][str(column)], 1)

        response = self.post(actor, "naopara_stop")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["runners"], {})
        for column in chosen["columns"]:
            self.assertGreaterEqual(state["markers"][str(actor)][str(column)], 1)
        self.assertNotEqual(self.current(state), actor, "a vez passa")
        self.assertEqual(self.me_in(actor)["state"]["markers"], state["markers"][str(actor)])

    def test_bust_wipes_the_runners_and_passes_the_turn(self):
        state = self.start()
        actor_id = self.current(state)
        actor = Player.objects.get(id=actor_id)
        state["runners"] = {"2": 1, "3": 1, "4": 1}

        class Sixes:
            def randint(self, low, high):
                return 6

        self.assertIsNone(naopara.roll(state, actor, rng=Sixes()))
        self.assertEqual(state["runners"], {}, "tres corredores presos, 12 nao serve")
        self.assertEqual(state["last_event"]["type"], "bust")
        self.assertEqual(state["last_event"]["lost"], {"2": 1, "3": 1, "4": 1})
        self.assertEqual(state["phase"], "rolling")
        self.assertNotEqual(self.current(state), actor_id)

    def test_claimed_columns_are_off_limits(self):
        state = self.start()
        actor_id = self.current(state)
        state["claimed"] = {"7": self.other(state)}
        options = naopara._options_for(state, actor_id, [3, 4, 3, 4])
        self.assertEqual(options, [{"pair": [6, 8], "columns": [6, 8]}])

    def test_three_claimed_columns_win_the_game(self):
        state = self.start()
        actor = self.current(state)
        state["runners"] = {"2": 3, "3": 5, "12": 3}
        self.save_state(state)

        response = self.post(actor, "naopara_stop")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner_id"], actor)
        self.assertEqual(set(state["claimed"]), {"2", "3", "12"})
        self.assertEqual(self.room.status, Room.STATUS_ENDED)
