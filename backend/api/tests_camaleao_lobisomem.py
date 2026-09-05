"""Camaleao e Lobisomem de Uma Noite: sigilo e regras de mesa."""

from django.test import TestCase
from rest_framework.test import APIClient

from . import camaleao, lobisomem
from .models import Game, Player, Room
from .tests import make_user


class Base(TestCase):
    slug = None
    player_count = 4

    def setUp(self):
        self.game = Game.objects.create(slug=self.slug, name=self.slug, min_players=3, max_players=10)
        self.room = Room.objects.create(game=self.game, code=f"5{id(self) % 900 + 100:03d}")
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

    def start(self):
        response = APIClient().post(f"/api/rooms/{self.room.code}/start/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        return self.room.state

    def refresh(self):
        self.room.refresh_from_db()
        return self.room.state

    def fresh(self):
        return {p.id: p for p in Player.objects.filter(room=self.room)}


class CamaleaoTests(Base):
    slug = "camaleao"

    def test_everyone_but_the_chameleon_sees_the_secret_word(self):
        state = self.start()
        chameleon = state["chameleon_id"]
        secret = camaleao.TOPICS[state["topic_index"]][1][state["secret_index"]]

        for player in self.players:
            view = self.view(player.id)
            me = next(p for p in view["players"] if p["id"] == player.id)
            if player.id == chameleon:
                self.assertIsNone(me["state"]["secret_word"], "o camaleao nao ve a palavra")
                self.assertTrue(me["state"]["is_chameleon"])
            else:
                self.assertEqual(me["state"]["secret_word"], secret)
            for other in view["players"]:
                if other["id"] != player.id:
                    self.assertNotIn("secret_word", other["state"])
                    self.assertNotIn("is_chameleon", other["state"])
            self.assertNotIn("chameleon_id", view["state"], "a identidade so sai na revelacao")
            self.assertNotIn("secret_index", view["state"])
            self.assertEqual(len(view["state"]["topic"]["words"]), 16, "a grade e publica")

    def test_clues_follow_the_order_and_cannot_be_grid_words(self):
        state = self.start()
        order = state["clue_order"]
        grid_word = camaleao.TOPICS[state["topic_index"]][1][0]

        wrong_turn = self.post(order[1], "camaleao_clue", {"word": "algo"})
        self.assertEqual(wrong_turn.status_code, 400, "so quem esta na vez fala")

        cheat = self.post(order[0], "camaleao_clue", {"word": grid_word})
        self.assertEqual(cheat.status_code, 400, "a dica nao pode ser palavra da grade")

        for pid in order:
            response = self.post(pid, "camaleao_clue", {"word": f"dica{pid}"})
            self.assertEqual(response.status_code, 200, response.content)

        state = self.refresh()
        self.assertEqual(state["phase"], "vote", "todos falaram: abre a votacao")
        self.assertEqual(len(state["clues"]), len(order))

    def give_all_clues(self):
        for pid in self.refresh()["clue_order"]:
            self.post(pid, "camaleao_clue", {"word": f"dica{pid}"})

    def test_catching_the_chameleon_gives_it_a_guess(self):
        state = self.start()
        chameleon = state["chameleon_id"]
        self.give_all_clues()

        for player in self.players:
            target = chameleon if player.id != chameleon else next(
                p.id for p in self.players if p.id != chameleon
            )
            self.assertEqual(self.post(player.id, "camaleao_vote", {"target_player_id": target}).status_code, 200)

        state = self.refresh()
        self.assertTrue(state["caught"])
        self.assertEqual(state["phase"], "guess", "pego, mas com direito a um chute")

        wrong_person = next(p.id for p in self.players if p.id != chameleon)
        self.assertEqual(self.post(wrong_person, "camaleao_guess", {"word": "x"}).status_code, 400)

        secret = camaleao.TOPICS[state["topic_index"]][1][state["secret_index"]]
        self.assertEqual(self.post(chameleon, "camaleao_guess", {"word": secret.lower()}).status_code, 200)

        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["last"]["outcome"], "pego_mas_acertou")
        self.assertEqual(state["scores"][str(chameleon)], camaleao.CAUGHT_BUT_GUESSED_POINTS)

    def test_split_vote_lets_the_chameleon_escape(self):
        state = self.start()
        chameleon = state["chameleon_id"]
        others = [p.id for p in self.players if p.id != chameleon]
        self.give_all_clues()

        # Cada um vota em alguem diferente: ninguem tem maioria.
        targets = others + [chameleon]
        for index, player in enumerate(self.players):
            target = targets[index % len(targets)]
            if target == player.id:
                target = targets[(index + 1) % len(targets)]
            self.post(player.id, "camaleao_vote", {"target_player_id": target})

        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        self.assertFalse(state["caught"])
        self.assertEqual(state["last"]["outcome"], "escapou")
        self.assertEqual(state["scores"][str(chameleon)], camaleao.ESCAPE_POINTS)

    def test_topics_are_well_formed(self):
        for title, words in camaleao.TOPICS:
            self.assertTrue(title)
            self.assertEqual(len(words), 16, title)
            self.assertEqual(len({w.lower() for w in words}), 16, f"palavra repetida em {title}")


class LobisomemTests(Base):
    slug = "lobisomem"
    player_count = 5

    def roles(self):
        return {pid: p.state["role"] for pid, p in self.fresh().items()}

    def by_role(self, role):
        return [pid for pid, r in self.roles().items() if r == role]

    def test_roles_are_secret_and_center_is_hidden(self):
        state = self.start()
        self.assertEqual(len(state["center"]), 3)
        for player in self.players:
            view = self.view(player.id)
            me = next(p for p in view["players"] if p["id"] == player.id)
            self.assertIn(me["state"]["role"], lobisomem.ROLE_LABELS)
            for other in view["players"]:
                if other["id"] != player.id:
                    self.assertNotIn("role", other["state"])
                    self.assertNotIn("current_role", other["state"])
            self.assertNotIn("center", view["state"], "o centro e segredo ate o amanhecer")
            self.assertEqual(view["state"]["center_count"], 3)

    def run_night(self):
        """Faz cada papel agir de forma simples ate amanhecer."""
        for _ in range(12):
            state = self.refresh()
            if state["phase"] != "night":
                return state
            role = lobisomem.current_night_role(state)
            for pid in self.by_role(role):
                players = self.fresh()
                if players[pid].state.get("night_done"):
                    continue
                payload = {}
                others = [p for p in players if p != pid]
                if role == lobisomem.VIDENTE:
                    payload = {"target_player_id": others[0]}
                elif role == lobisomem.LADRAO:
                    payload = {"target_player_id": others[0]}
                elif role == lobisomem.ENCRENQUEIRA:
                    payload = {"first_player_id": others[0], "second_player_id": others[1]}
                elif role == lobisomem.LOBISOMEM and len(self.by_role(role)) == 1:
                    payload = {"center_index": 0}
                response = self.post(pid, "lobisomem_night", payload)
                self.assertEqual(response.status_code, 200, (role, response.content))
        return self.refresh()

    def test_night_runs_in_order_and_reaches_the_day(self):
        state = self.start()
        first_role = lobisomem.current_night_role(state)
        self.assertEqual(first_role, state["night_roles"][0])

        # Agir fora da vez e recusado.
        later = [pid for pid, r in self.roles().items() if r != first_role and r != lobisomem.ALDEAO]
        if later:
            self.assertEqual(self.post(later[0], "lobisomem_night", {}).status_code, 400)

        state = self.run_night()
        self.assertEqual(state["phase"], "day", "a noite termina e amanhece")

    def test_wolves_know_each_other_and_seer_sees_a_card(self):
        self.start()
        wolves = self.by_role(lobisomem.LOBISOMEM)
        self.assertEqual(len(wolves) + sum(1 for c in self.refresh()["center"] if c == lobisomem.LOBISOMEM), 2)
        self.run_night()
        players = self.fresh()
        for pid in wolves:
            info = players[pid].state["night_info"]
            if len(wolves) == 2:
                self.assertEqual(info["kind"], "wolves")
                self.assertEqual(info["partners"], [w for w in wolves if w != pid])
            else:
                self.assertEqual(info["kind"], "lone_wolf")
        for pid in self.by_role(lobisomem.VIDENTE):
            info = players[pid].state["night_info"]
            self.assertIn(info["kind"], {"seer_player", "seer_center"})
            self.assertIsNotNone(info.get("role") or info.get("cards"))

    def force_role(self, player, role):
        """Garante um papel em jogo sem depender do sorteio."""
        player.refresh_from_db()
        state = player.state
        state["role"] = role
        state["current_role"] = role
        player.state = state
        player.save(update_fields=["state"])
        self.room.refresh_from_db()
        room_state = self.room.state
        room_state["night_roles"] = lobisomem._night_roles_in_play(list(self.fresh().values()))
        self.room.state = room_state
        self.room.save(update_fields=["state"])

    def test_robber_takes_the_card_and_learns_it(self):
        self.start()
        if not self.by_role(lobisomem.LADRAO):
            # O ladrao caiu no centro: coloco-o na mao de um aldeao.
            villager = self.by_role(lobisomem.ALDEAO)[0]
            self.force_role(self.fresh()[villager], lobisomem.LADRAO)
        robbers = self.by_role(lobisomem.LADRAO)
        self.assertTrue(robbers)
        self.run_night()
        players = self.fresh()
        robber = players[robbers[0]]
        info = robber.state["night_info"]
        self.assertEqual(info["kind"], "robber")
        self.assertEqual(robber.state["current_role"], info["new_role"], "o ladrao ve o que virou")
        victim = players[info["target_id"]]
        self.assertEqual(victim.state["current_role"], lobisomem.LADRAO, "a vitima virou ladrao sem saber")

    def test_vote_kills_a_wolf_and_village_wins(self):
        self.start()
        self.run_night()
        state = self.refresh()
        self.post(self.players[0].id, "lobisomem_open_vote")
        self.assertEqual(self.refresh()["phase"], "vote")

        finals = {pid: p.state["current_role"] for pid, p in self.fresh().items()}
        wolves = [pid for pid, r in finals.items() if r == lobisomem.LOBISOMEM]
        if not wolves:
            self.skipTest("sem lobisomem entre os jogadores nesta distribuicao")
        target = wolves[0]
        for player in self.players:
            vote = target if player.id != target else None
            self.assertEqual(self.post(player.id, "lobisomem_vote", {"target_player_id": vote}).status_code, 200)

        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertIn(target, state["result"]["dead"])
        self.assertTrue(state["result"]["village_wins"])
        self.assertIn("center", state, "no fim o centro e revelado")

    def test_single_votes_kill_no_one(self):
        self.start()
        self.run_night()
        self.post(self.players[0].id, "lobisomem_open_vote")
        # Todo mundo vota em "ninguem".
        for player in self.players:
            self.post(player.id, "lobisomem_vote", {"target_player_id": None})
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["result"]["dead"], [])

    def test_only_host_can_open_the_vote_early(self):
        self.start()
        self.run_night()
        self.assertEqual(self.post(self.players[1].id, "lobisomem_open_vote").status_code, 400)
        self.assertEqual(self.post(self.players[0].id, "lobisomem_open_vote").status_code, 200)

    def test_deck_sizes(self):
        for count in range(3, 11):
            deck = lobisomem.roles_for(count)
            self.assertEqual(len(deck), count + 3)
            self.assertEqual(deck.count(lobisomem.LOBISOMEM), 2)
        self.assertIsNone(lobisomem.roles_for(2))
        self.assertIsNone(lobisomem.roles_for(11))
