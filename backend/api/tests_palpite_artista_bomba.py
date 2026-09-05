"""Palpite Certo, Artista Falso e Bomba-Relogio: a TV como mesa, tela e bomba."""

import random

from django.test import TestCase
from rest_framework.test import APIClient

from . import artista, bomba, palpite
from .models import Game, Player, Room
from .tests import make_user


class Base(TestCase):
    slug = None
    player_count = 4

    def setUp(self):
        self.game = Game.objects.create(slug=self.slug, name=self.slug, min_players=2, max_players=12)
        self.room = Room.objects.create(game=self.game, code=f"7{id(self) % 900 + 100:03d}")
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

    def fresh(self):
        return list(Player.objects.filter(room=self.room).order_by("id"))


class PalpiteTests(Base):
    slug = "palpite-certo"

    def test_question_is_public_and_answer_is_hidden(self):
        state = self.start()
        self.assertEqual(state["phase"], "answer")
        self.assertTrue(state["question"])
        view = self.view(self.players[0].id)
        self.assertEqual(view["state"]["question"], state["question"])
        self.assertNotIn("answer_value", view["state"], "a resposta so sai na revelacao")
        self.assertNotIn("question_ids", view["state"])

    def test_answers_open_betting_with_sorted_slots_and_odds(self):
        self.start()
        values = [10, 40, 40, 25]
        for player, value in zip(self.players, values):
            response = self.post(player.id, "palpite_answer", {"value": value})
            self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "bet", "todo mundo chutou: abre a mesa")
        slots = state["slots"]
        self.assertIsNone(slots[0]["value"], "a primeira casa e 'todos passaram'")
        self.assertEqual([s["value"] for s in slots[1:]], [10, 25, 40])
        self.assertEqual([s["odds"] for s in slots[1:]], [3, 2, 3], "o meio paga menos")
        self.assertEqual(slots[0]["odds"], 4)
        self.assertEqual(sorted(slots[3]["authors"]), sorted([self.players[1].id, self.players[2].id]))
        late = self.post(self.players[0].id, "palpite_answer", {"value": 99})
        self.assertEqual(late.status_code, 400)

    def test_bets_pay_the_closest_without_going_over(self):
        state = self.start()
        state["answer_value"] = 30
        self.save_state(state)
        values = [10, 40, 40, 25]
        for player, value in zip(self.players, values):
            self.post(player.id, "palpite_answer", {"value": value})
        state = self.refresh()
        # Casas: 0 todos passaram, 1 = 10, 2 = 25, 3 = 40. Resposta 30 -> casa 2.
        bets = {0: [2, 2], 1: [3], 2: [1, 2], 3: [0, 0]}
        for index, player in enumerate(self.players):
            response = self.post(player.id, "palpite_bet", {"slots": bets[index]})
            self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["correct_index"], 2)
        payouts = state["last_result"]["payouts"]
        odds = state["slots"][2]["odds"]
        self.assertEqual(payouts[str(self.players[0].id)], 2 * odds)
        self.assertEqual(payouts[str(self.players[1].id)], 0)
        self.assertEqual(payouts[str(self.players[2].id)], odds)
        self.assertEqual(payouts[str(self.players[3].id)], palpite.AUTHOR_BONUS, "autor do palpite certo leva bonus")
        view = self.view(self.players[0].id)
        self.assertEqual(view["state"]["answer_value"], 30, "na revelacao a resposta aparece")

    def test_all_answers_over_pay_the_lower_slot_and_timeouts_advance(self):
        state = self.start()
        state["answer_value"] = 5
        self.save_state(state)
        for player in self.players:
            self.post(player.id, "palpite_answer", {"value": 100})
        state = self.refresh()
        self.post(self.players[0].id, "palpite_bet", {"slots": [0]})
        state = self.refresh()
        self.assertEqual(state["phase"], "bet", "falta gente apostar")
        state["deadline_ts"] = 0
        self.save_state(state)
        state = palpite.tick(self.refresh(), self.fresh(), 10)
        self.assertEqual(state["phase"], "reveal", "o relogio fecha a mesa")
        self.assertEqual(state["correct_index"], 0)
        self.assertEqual(state["last_result"]["payouts"][str(self.players[0].id)], state["slots"][0]["odds"])
        state["deadline_ts"] = 0
        state = palpite.tick(state, self.fresh(), 10)
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "answer")

    def test_game_ends_after_the_last_round(self):
        state = self.start()
        state["round"] = state["rounds"]
        state["phase"] = "reveal"
        state["deadline_ts"] = 0
        state["scores"][str(self.players[2].id)] = 9
        self.save_state(state)
        response = APIClient().post(f"/api/rooms/{self.room.code}/palpite_tick/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner_ids"], [self.players[2].id])
        self.assertEqual(self.room.status, Room.STATUS_ENDED)


class ArtistaTests(Base):
    slug = "artista-falso"

    def test_everyone_but_the_fake_sees_the_word(self):
        state = self.start()
        fake = state["fake_id"]
        for player in self.players:
            me = self.me_in(player.id)
            if player.id == fake:
                self.assertIsNone(me["state"]["word"])
                self.assertTrue(me["state"]["is_fake"])
            else:
                self.assertEqual(me["state"]["word"], state["word"])
            view = self.view(player.id)
            self.assertNotIn("word", view["state"])
            self.assertNotIn("fake_id", view["state"])
            self.assertEqual(view["state"]["category"], state["category"])
            for other in view["players"]:
                if other["id"] != player.id:
                    self.assertNotIn("word", other["state"])
                    self.assertNotIn("is_fake", other["state"])

    def test_strokes_follow_the_order_and_then_everyone_votes(self):
        state = self.start()
        order = state["order"]
        wrong = self.post(order[1], "artista_stroke", {"points": [[0, 0], [1, 1]]})
        self.assertEqual(wrong.status_code, 400, "so quem esta na vez desenha")
        for turn in range(state["total_turns"]):
            pid = order[turn % len(order)]
            response = self.post(pid, "artista_stroke", {"points": [[0.1, 0.2], [0.5, 0.5], [0.9, 0.8]]})
            self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "vote")
        self.assertEqual(len(state["strokes"]), len(order) * artista.STROKES_PER_PLAYER)
        view = self.view(order[0])
        self.assertEqual(len(view["state"]["strokes"]), len(state["strokes"]), "os tracos sao publicos")

    def _skip_to_vote(self):
        state = self.refresh()
        state["stroke_turn"] = state["total_turns"]
        state["phase"] = "vote"
        state["deadline_ts"] = 10**12
        self.save_state(state)
        return state

    def test_caught_fake_can_still_win_by_guessing(self):
        state = self.start()
        fake = state["fake_id"]
        self._skip_to_vote()
        others = [p.id for p in self.players if p.id != fake]
        self.assertEqual(self.post(fake, "artista_vote", {"target_player_id": fake}).status_code, 400)
        for pid in others:
            self.assertEqual(self.post(pid, "artista_vote", {"target_player_id": fake}).status_code, 200)
        self.assertEqual(self.post(fake, "artista_vote", {"target_player_id": others[0]}).status_code, 200)
        state = self.refresh()
        self.assertEqual(state["phase"], "guess", "o mais votado ganha o direito de chutar")
        view = self.view(others[0])
        self.assertEqual(view["state"]["accused_id"], fake)
        self.assertNotIn("word", view["state"])

        wrong_person = self.post(others[0], "artista_guess", {"word": state["word"]})
        self.assertEqual(wrong_person.status_code, 400)
        response = self.post(fake, "artista_guess", {"word": state["word"].upper()})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["result"]["outcome"], "fake_guessed")
        self.assertEqual(state["scores"][str(fake)], artista.FAKE_WIN_POINTS)
        self.assertEqual(self.view(others[0])["state"]["word"], state["word"], "na revelacao a palavra aparece")

    def test_tie_lets_the_fake_escape_and_wrong_guess_gives_artists_the_round(self):
        state = self.start()
        fake = state["fake_id"]
        others = [p.id for p in self.players if p.id != fake]
        self._skip_to_vote()
        # Dois votos no falso, dois no outro: empate, o falso escapa.
        self.post(others[0], "artista_vote", {"target_player_id": fake})
        self.post(others[1], "artista_vote", {"target_player_id": fake})
        self.post(others[2], "artista_vote", {"target_player_id": others[0]})
        self.post(fake, "artista_vote", {"target_player_id": others[0]})
        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["result"]["outcome"], "fake_escaped")
        self.assertEqual(state["scores"][str(fake)], artista.FAKE_WIN_POINTS)

        # Proxima rodada: outro falso, e um chute errado da a rodada aos artistas.
        state["deadline_ts"] = 0
        state = artista.tick(state, self.fresh(), 10, rng=random.Random(3))
        self.assertEqual(state["round"], 2)
        self.assertNotEqual(state["fake_id"], fake, "o falso nao repete")
        new_fake = state["fake_id"]
        state["stroke_turn"] = state["total_turns"]
        state["phase"] = "guess"
        state["deadline_ts"] = 10**12
        self.save_state(state)
        response = self.post(new_fake, "artista_guess", {"word": "palavra errada"})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["result"]["outcome"], "artists_won")
        for pid in [p.id for p in self.players if p.id != new_fake]:
            self.assertGreaterEqual(state["scores"][str(pid)], artista.ARTIST_WIN_POINTS)

    def test_sleeping_drawer_loses_the_stroke(self):
        state = self.start()
        state["deadline_ts"] = 0
        state = artista.tick(state, self.fresh(), 10)
        self.assertEqual(state["stroke_turn"], 1)
        self.assertEqual(state["strokes"], [])
        self.assertEqual(state["phase"], "draw")


class BombaTests(Base):
    slug = "bomba-relogio"

    def test_fuse_is_secret_and_only_the_holder_passes(self):
        state = self.start()
        self.assertEqual(state["phase"], "ticking")
        holder = state["holder_id"]
        view = self.view(holder)
        self.assertNotIn("explode_ts", view["state"], "ninguem sabe quando estoura")
        self.assertEqual(view["state"]["category"], state["category"])
        other = next(pid for pid in state["order"] if pid != holder)
        self.assertEqual(self.post(other, "bomba_pass").status_code, 400)
        response = self.post(holder, "bomba_pass")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        expected = state["order"][(state["order"].index(holder) + 1) % len(state["order"])]
        self.assertEqual(state["holder_id"], expected, "a bomba vai para o proximo da roda")
        self.assertEqual(state["pass_count"], 1)

    def test_explosion_costs_a_life_and_the_next_round_starts_with_the_victim(self):
        state = self.start()
        holder = state["holder_id"]
        state["explode_ts"] = 0
        self.save_state(state)
        response = APIClient().post(f"/api/rooms/{self.room.code}/bomba_tick/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "boom")
        self.assertEqual(state["last_boom"]["player_id"], holder)
        self.assertEqual(state["lives"][str(holder)], bomba.LIVES - 1)
        self.assertEqual(self.me_in(holder)["state"]["lives"], bomba.LIVES - 1)

        state["deadline_ts"] = 0
        state = bomba.tick(state, self.fresh(), 10, rng=random.Random(1))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "ticking")
        self.assertEqual(state["holder_id"], holder, "quem estourou comeca a proxima")
        self.assertGreater(state["explode_ts"], 10 + bomba.MIN_FUSE - 1)

    def test_passing_after_the_explosion_blows_up_in_your_hand(self):
        state = self.start()
        holder = state["holder_id"]
        state["explode_ts"] = 0
        self.save_state(state)
        response = self.post(holder, "bomba_pass")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "boom")
        self.assertEqual(state["last_boom"]["player_id"], holder)

    def test_last_player_standing_wins(self):
        state = self.start()
        survivor = state["order"][0]
        for pid in state["order"][1:]:
            state["lives"][str(pid)] = 0
        state["phase"] = "boom"
        state["deadline_ts"] = 0
        state["last_boom"] = {"player_id": state["order"][1]}
        self.save_state(state)
        response = APIClient().post(f"/api/rooms/{self.room.code}/bomba_tick/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner_ids"], [survivor])
        self.assertEqual(self.room.status, Room.STATUS_ENDED)
        self.assertEqual(self.view(survivor)["state"]["alive_ids"], [survivor])
