"""Muralhas, Desenha e Adivinha, So Uma, Manada e Quiz da Mesa."""

import random

from django.test import TestCase
from rest_framework.test import APIClient

from . import desenha, manada, muralhas, quiz, souma
from .models import Game, Player, Room
from .tests import make_user


class Base(TestCase):
    slug = None
    player_count = 4

    def setUp(self):
        self.game = Game.objects.create(slug=self.slug, name=self.slug, min_players=2, max_players=12)
        self.room = Room.objects.create(game=self.game, code=f"8{id(self) % 900 + 100:03d}")
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

    def tick(self, action):
        response = APIClient().post(f"/api/rooms/{self.room.code}/{action}/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        return self.refresh()


class MuralhasTests(Base):
    slug = "muralhas"
    player_count = 2

    def test_start_positions_and_first_moves(self):
        state = self.start()
        first, second = state["order"]
        self.assertEqual(state["pawns"][str(first)], [8, 4])
        self.assertEqual(state["pawns"][str(second)], [0, 4])
        self.assertEqual(state["walls_left"][str(first)], 10)
        self.assertEqual(sorted(state["legal_moves"]), [[7, 4], [8, 3], [8, 5]])
        self.assertEqual(len(state["legal_walls"]), 128, "tabuleiro vazio: toda muralha e legal")

        wrong = self.post(second, "muralhas_move", {"row": 1, "col": 4})
        self.assertEqual(wrong.status_code, 400, "so quem esta na vez anda")
        too_far = self.post(first, "muralhas_move", {"row": 6, "col": 4})
        self.assertEqual(too_far.status_code, 400)
        response = self.post(first, "muralhas_move", {"row": 7, "col": 4})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["pawns"][str(first)], [7, 4])
        self.assertEqual(muralhas.current_player_id(state), second)

    def test_jumping_over_a_pawn_and_diagonals_when_blocked(self):
        state = self.start()
        first, second = state["order"]
        state["pawns"][str(first)] = [4, 4]
        state["pawns"][str(second)] = [3, 4]
        muralhas._refresh_legal(state)
        self.assertIn([2, 4], state["legal_moves"], "pula por cima do peao")
        self.assertNotIn([3, 4], state["legal_moves"])

        state["walls"] = [{"r": 2, "c": 4, "o": "h", "owner_id": second}]
        muralhas._refresh_legal(state)
        self.assertNotIn([2, 4], state["legal_moves"], "muralha atras do peao: sem pulo reto")
        self.assertIn([3, 3], state["legal_moves"])
        self.assertIn([3, 5], state["legal_moves"])

    def test_walls_cannot_cross_overlap_or_seal_a_path(self):
        state = self.start()
        first, second = state["order"]
        response = self.post(first, "muralhas_wall", {"row": 4, "col": 4, "orientation": "h"})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["walls_left"][str(first)], 9)
        self.assertEqual(muralhas.current_player_id(state), second)

        crossing = self.post(second, "muralhas_wall", {"row": 4, "col": 4, "orientation": "v"})
        self.assertEqual(crossing.status_code, 400, "nao cruza")
        overlapping = self.post(second, "muralhas_wall", {"row": 4, "col": 5, "orientation": "h"})
        self.assertEqual(overlapping.status_code, 400, "nao sobrepoe")

        # Cerca o peao do sul em (8,4): teto sobre as colunas 3-4 e parede a esquerda.
        # A parede a direita fecharia a caixa: ilegal, mesmo sem cruzar nada.
        state = self.refresh()
        state["walls"] = [
            {"r": 7, "c": 3, "o": "h", "owner_id": first},
            {"r": 7, "c": 2, "o": "v", "owner_id": first},
        ]
        muralhas._refresh_legal(state)
        self.assertFalse(muralhas.wall_is_legal(state, second, 7, 4, "v"), "fecharia o caminho")
        self.assertTrue(muralhas.wall_is_legal(state, second, 3, 3, "v"))
        self.assertNotIn([7, 4, "v"], state["legal_walls"])

    def test_reaching_the_far_side_wins(self):
        state = self.start()
        first, second = state["order"]
        # Coluna 2: a (0,4) esta ocupada pelo peao do norte.
        state["pawns"][str(first)] = [1, 2]
        muralhas._refresh_legal(state)
        self.save_state(state)
        response = self.post(first, "muralhas_move", {"row": 0, "col": 2})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner_id"], first)
        self.assertEqual(self.room.status, Room.STATUS_ENDED)
        self.assertEqual(self.post(second, "muralhas_move", {"row": 1, "col": 4}).status_code, 400)


class DesenhaTests(Base):
    slug = "desenha-e-adivinha"

    def test_drawer_sees_options_and_word_others_see_the_mask(self):
        state = self.start()
        drawer = state["drawer_id"]
        other = next(p.id for p in self.players if p.id != drawer)
        self.assertEqual(state["phase"], "choose")
        self.assertEqual(len(self.me_in(drawer)["state"]["options"]), 3)
        self.assertEqual(self.me_in(other)["state"]["options"], [])
        self.assertNotIn("options", self.view(other)["state"])

        forbidden = self.post(other, "desenha_choose", {"index": 0})
        self.assertEqual(forbidden.status_code, 400)
        response = self.post(drawer, "desenha_choose", {"index": 1})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "draw")
        word = state["word"]
        self.assertEqual(self.me_in(drawer)["state"]["word"], word)
        self.assertIsNone(self.me_in(other)["state"]["word"])
        view = self.view(other)
        self.assertNotIn("word", view["state"])
        self.assertEqual(len(view["state"]["mask"]), len(word))
        self.assertTrue(all(ch == "_" or not ch.isalpha() for ch in view["state"]["mask"]))

    def test_strokes_guesses_and_scoring(self):
        state = self.start()
        drawer = state["drawer_id"]
        others = [p.id for p in self.players if p.id != drawer]
        self.post(drawer, "desenha_choose", {"index": 0})
        state = self.refresh()
        word = state["word"]

        stroke = {"id": "s1", "points": [[0.1, 0.1], [0.5, 0.5]], "color": "#000", "width": 6}
        self.assertEqual(self.post(others[0], "desenha_stroke", stroke).status_code, 400, "so o desenhista")
        self.assertEqual(self.post(drawer, "desenha_stroke", stroke).status_code, 200)
        self.assertEqual(self.post(drawer, "desenha_stroke", stroke).status_code, 200, "reenvio e idempotente")
        self.assertEqual(len(self.refresh()["strokes"]), 1)
        self.assertEqual(len(self.view(others[0])["state"]["strokes"]), 1, "a TV ve o traco")

        self.assertEqual(self.post(drawer, "desenha_guess", {"text": word}).status_code, 400, "desenhista nao chuta")
        wrong = self.post(others[0], "desenha_guess", {"text": "coisa errada"})
        self.assertEqual(wrong.status_code, 200, wrong.content)
        state = self.refresh()
        self.assertEqual(state["guesses"][-1], {"player_id": others[0], "text": "coisa errada", "correct": False})

        right = self.post(others[0], "desenha_guess", {"text": word.upper()})
        self.assertEqual(right.status_code, 200, right.content)
        state = self.refresh()
        self.assertIn(str(others[0]), state["solved"])
        self.assertGreaterEqual(state["scores"][str(others[0])], desenha.GUESS_BASE)
        self.assertEqual(state["scores"][str(drawer)], desenha.DRAWER_POINTS_PER_GUESS)
        self.assertIsNone(state["guesses"][-1]["text"], "o acerto nao vaza a palavra no chat")
        self.assertEqual(self.post(others[0], "desenha_guess", {"text": word}).status_code, 400, "ja acertou")

        for pid in others[1:]:
            self.assertEqual(self.post(pid, "desenha_guess", {"text": word}).status_code, 200)
        state = self.refresh()
        self.assertEqual(state["phase"], "reveal", "todos acertaram: encerra a vez")
        self.assertEqual(state["last_result"]["word"], word)

    def test_hints_appear_over_time_and_timeout_ends_the_turn(self):
        state = self.start()
        self.post(state["drawer_id"], "desenha_choose", {"index": 0})
        state = self.refresh()
        state["word"] = "girassol"  # longa o bastante para duas dicas
        started = state["draw_started_ts"]
        state = desenha.tick(state, self.fresh(), started + desenha.DRAW_SECONDS * 0.4, rng=random.Random(1))
        self.assertEqual(len(state["revealed"]), 1, "uma letra no primeiro terco")
        state = desenha.tick(state, self.fresh(), started + desenha.DRAW_SECONDS * 0.7, rng=random.Random(1))
        self.assertEqual(len(state["revealed"]), 2)
        self.assertEqual(state["phase"], "draw")
        state = desenha.tick(state, self.fresh(), started + desenha.DRAW_SECONDS + 1, rng=random.Random(1))
        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["last_result"]["reason"], "timeout")


class SoUmaTests(Base):
    slug = "so-uma"

    def test_guesser_does_not_see_the_word(self):
        state = self.start()
        guesser = state["guesser_id"]
        for player in self.players:
            me = self.me_in(player.id)
            if player.id == guesser:
                self.assertIsNone(me["state"]["word"])
            else:
                self.assertEqual(me["state"]["word"], state["word"])
            self.assertNotIn("word", self.view(player.id)["state"])
        self.assertEqual(self.post(guesser, "souma_clue", {"word": "dica"}).status_code, 400)

    def test_duplicate_and_word_like_clues_are_cancelled(self):
        state = self.start()
        guesser = state["guesser_id"]
        helpers = [p.id for p in self.players if p.id != guesser]
        word = state["word"]
        two_words = self.post(helpers[0], "souma_clue", {"word": "duas palavras"})
        self.assertEqual(two_words.status_code, 400)
        self.post(helpers[0], "souma_clue", {"word": "Mar"})
        self.post(helpers[1], "souma_clue", {"word": "mar"})
        self.post(helpers[2], "souma_clue", {"word": word + "s"})
        state = self.refresh()
        self.assertEqual(state["phase"], "guess", "todas as dicas entregues")
        judged = {c["player_id"]: c for c in state["judged"]}
        self.assertFalse(judged[helpers[0]]["valid"], "repetida")
        self.assertFalse(judged[helpers[1]]["valid"], "repetida")
        self.assertFalse(judged[helpers[2]]["valid"], "variante da palavra")
        view = self.view(guesser)
        self.assertEqual(view["state"]["shown_clues"], [])
        self.assertEqual(view["state"]["cancelled_count"], 3)
        self.assertNotIn("judged", view["state"])

    def test_correct_wrong_and_pass_outcomes(self):
        state = self.start()
        guesser = state["guesser_id"]
        helpers = [p.id for p in self.players if p.id != guesser]
        for index, pid in enumerate(helpers):
            self.post(pid, "souma_clue", {"word": f"dica{index}"})
        state = self.refresh()
        self.assertEqual(len(self.view(guesser)["state"]["shown_clues"]), 3)
        self.assertEqual(self.post(helpers[0], "souma_guess", {"word": state["word"]}).status_code, 400)
        response = self.post(guesser, "souma_guess", {"word": state["word"].upper()})
        self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["result"]["outcome"], "correct")
        self.assertEqual(state["score"], 1)
        rounds_before = state["rounds"]

        state["deadline_ts"] = 0
        state = souma.tick(state, self.fresh(), 10, rng=random.Random(2))
        self.assertEqual(state["round"], 2)
        self.assertNotEqual(state["guesser_id"], guesser, "o adivinhador roda")
        state["phase"] = "guess"
        state["deadline_ts"] = 10**12
        self.save_state(state)
        wrong = self.post(state["guesser_id"], "souma_guess", {"word": "errado"})
        self.assertEqual(wrong.status_code, 200, wrong.content)
        state = self.refresh()
        self.assertEqual(state["result"]["outcome"], "wrong")
        self.assertEqual(state["rounds"], rounds_before - 1, "errar custa a proxima carta")
        state["deadline_ts"] = 0
        state = souma.tick(state, self.fresh(), 10, rng=random.Random(2))
        state["phase"] = "guess"
        self.save_state(state)
        passed = self.post(state["guesser_id"], "souma_guess", {"passed": True})
        self.assertEqual(passed.status_code, 200, passed.content)
        self.assertEqual(self.refresh()["result"]["outcome"], "pass")


class ManadaTests(Base):
    slug = "manada"

    def test_majority_scores_and_the_lonely_one_gets_the_cow(self):
        state = self.start()
        answers = ["Calabresa!", "calabresa", "A calabresa", "Mussarela"]
        for player, text in zip(self.players, answers):
            response = self.post(player.id, "manada_answer", {"text": text})
            self.assertEqual(response.status_code, 200, response.content)
        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        result = state["last_result"]
        self.assertEqual(manada.normalize("Pizza de Calabresa"), "pizza de calabresa")
        self.assertEqual(manada.normalize("A calabresa"), "calabresa")
        groups = {g["text"]: g for g in result["groups"]}
        majority = next(g for g in result["groups"] if g["majority"])
        self.assertEqual(len(majority["player_ids"]), 3, "maiuscula, pontuacao e artigo nao separam")
        self.assertEqual(state["cow_id"], self.players[3].id, "o unico sozinho leva a vaca")
        self.assertEqual(state["scores"][str(self.players[1].id)], 1)
        self.assertEqual(state["scores"][str(self.players[3].id)], 0)
        self.assertIn("Mussarela", groups)
        self.assertTrue(result["cow_moved"])

    def test_tie_between_groups_gives_no_points_and_cow_holder_cannot_win(self):
        state = self.start()
        for player, text in zip(self.players, ["gato", "gato", "cão", "cão"]):
            self.post(player.id, "manada_answer", {"text": text})
        state = self.refresh()
        self.assertIsNone(state["last_result"]["majority"])
        self.assertEqual(sum(state["scores"].values()), 0)
        self.assertIsNone(state["cow_id"], "ninguem ficou sozinho")

        state["round"] = state["rounds"]
        state["cow_id"] = self.players[0].id
        state["scores"] = {str(p.id): 5 if p.id == self.players[0].id else 3 for p in self.players}
        state["deadline_ts"] = 0
        self.save_state(state)
        state = self.tick("manada_tick")
        self.assertEqual(state["phase"], "ended")
        self.assertNotIn(self.players[0].id, state["winner_ids"], "com a vaca nao se vence")
        self.assertEqual(len(state["winner_ids"]), 3)

    def test_answers_are_hidden_until_the_reveal(self):
        self.start()
        self.post(self.players[0].id, "manada_answer", {"text": "praia"})
        view = self.view(self.players[1].id)
        self.assertNotIn("answers", view["state"])
        self.assertEqual(view["state"]["answered_ids"], [self.players[0].id])
        me = next(p for p in view["players"] if p["id"] == self.players[0].id)
        self.assertNotIn("answer", me["state"])


class QuizTests(Base):
    slug = "quiz-da-mesa"

    def test_correct_answer_is_hidden_and_fast_answers_score_more(self):
        state = self.start()
        view = self.view(self.players[0].id)
        self.assertNotIn("deck", view["state"])
        self.assertEqual(len(view["state"]["question"]["options"]), 4)
        self.assertNotIn("correct", view["state"]["question"])

        correct = state["deck"][0]["correct"]
        wrong_index = (correct + 1) % 4
        state["choices"] = {}
        self.save_state(state)
        fast = self.post(self.players[0].id, "quiz_answer", {"index": correct})
        self.assertEqual(fast.status_code, 200, fast.content)
        self.assertEqual(self.post(self.players[0].id, "quiz_answer", {"index": wrong_index}).status_code, 400, "sem trocar")
        state = self.refresh()
        state["choices"][str(self.players[0].id)]["elapsed"] = 2
        self.save_state(state)
        self.post(self.players[1].id, "quiz_answer", {"index": correct})
        state = self.refresh()
        state["choices"][str(self.players[1].id)]["elapsed"] = 18
        self.save_state(state)
        self.post(self.players[2].id, "quiz_answer", {"index": wrong_index})
        state = self.refresh()
        self.assertEqual(state["phase"], "question", "falta um responder")
        state["deadline_ts"] = 0
        self.save_state(state)
        state = self.tick("quiz_tick")
        self.assertEqual(state["phase"], "reveal", "o relogio fecha a pergunta")
        result = state["last_result"]
        self.assertEqual(result["correct"], correct)
        self.assertGreater(result["points"][str(self.players[0].id)], result["points"][str(self.players[1].id)])
        self.assertGreaterEqual(result["points"][str(self.players[1].id)], quiz.BASE_POINTS)
        self.assertEqual(result["points"][str(self.players[2].id)], 0)
        self.assertEqual(result["points"][str(self.players[3].id)], 0)
        self.assertEqual(sum(result["distribution"]), 3)

    def test_game_ends_after_the_last_question(self):
        state = self.start()
        state["round"] = state["rounds"]
        state["phase"] = "reveal"
        state["deadline_ts"] = 0
        state["scores"][str(self.players[1].id)] = 999
        self.save_state(state)
        state = self.tick("quiz_tick")
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner_ids"], [self.players[1].id])
        self.assertEqual(self.room.status, Room.STATUS_ENDED)
