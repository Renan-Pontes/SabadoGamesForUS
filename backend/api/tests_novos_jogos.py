"""
Regras e sigilo dos seis jogos da segunda leva.

O foco e o mesmo de sempre: o que cada tela pode ver, e as regras que so
existem no servidor.
"""

import random

from django.test import TestCase
from rest_framework.test import APIClient

from . import caveira, infiltrado, palavra_chave, perfil, resistencia, sintonia
from .models import Game, Player, Room
from .tests import make_user


class GameTestBase(TestCase):
    slug = None
    name = None
    min_players = 2
    max_players = 12
    player_count = 4

    def setUp(self):
        if not self.slug:
            return
        self.game = Game.objects.create(
            slug=self.slug,
            name=self.name or self.slug,
            min_players=self.min_players,
            max_players=self.max_players,
        )
        self.room = Room.objects.create(game=self.game, code=f"7{id(self) % 900 + 100:03d}")
        self.users = [make_user(i) for i in range(self.player_count)]
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

    def client_by_id(self, player_id):
        index = next(i for i, p in enumerate(self.players) if p.id == player_id)
        return self.client_for(index)

    def start(self, payload=None):
        response = APIClient().post(
            f"/api/rooms/{self.room.code}/start/", payload or {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.room.refresh_from_db()
        return response

    def post(self, player_id, action, payload=None):
        return self.client_by_id(player_id).post(
            f"/api/rooms/{self.room.code}/{action}/", payload or {}, format="json"
        )

    def refresh(self):
        self.room.refresh_from_db()
        return self.room.state

    def fresh_players(self):
        return list(Player.objects.filter(room=self.room))

    def api_state(self, index=0):
        """Estado como a API entrega — ja passou pela redacao de segredos."""
        return self.client_for(index).get(f"/api/rooms/{self.room.code}/").json()["state"]

    def anon_state(self):
        """Estado como a TV anonima ve."""
        return APIClient().get(f"/api/rooms/{self.room.code}/").json()["state"]


# ---------------------------------------------------------------------------
# Sintonia
# ---------------------------------------------------------------------------


class SintoniaTests(GameTestBase):
    slug = "sintonia"
    name = "Sintonia"
    min_players = 3
    player_count = 4

    def test_target_is_hidden_until_reveal(self):
        self.start()
        view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()
        self.assertNotIn("target", view["state"], "o alvo nao pode vazar durante a rodada")
        self.assertIn("spectrum", view["state"], "mas o espectro e publico")

    def test_only_the_psychic_gives_the_clue(self):
        self.start()
        state = self.room.state
        psychic = state["psychic_id"]
        other = next(p.id for p in self.players if p.id != psychic)

        self.assertEqual(self.post(other, "sintonia_clue", {"clue": "gelo"}).status_code, 400)
        self.assertEqual(self.post(psychic, "sintonia_clue", {"clue": "gelo"}).status_code, 200)
        self.assertEqual(self.refresh()["phase"], "guess")

    def test_guesses_are_secret_then_scored_on_reveal(self):
        self.start()
        psychic = self.room.state["psychic_id"]
        self.post(psychic, "sintonia_clue", {"clue": "gelo"})
        guessers = [p.id for p in self.players if p.id != psychic]

        self.post(guessers[0], "sintonia_guess", {"value": 20})
        # Enquanto a rodada corre, o palpite alheio fica escondido.
        view = self.client_by_id(guessers[1]).get(f"/api/rooms/{self.room.code}/").json()
        other = next(p for p in view["players"] if p["id"] == guessers[0])
        self.assertNotIn("guess", other["state"])
        mine = next(p for p in view["players"] if p["id"] == guessers[1])
        self.assertIn("guess", mine["state"], "cada um ve o proprio palpite")

        for player_id in guessers[1:]:
            self.post(player_id, "sintonia_guess", {"value": 50})

        state = self.refresh()
        self.assertEqual(state["phase"], "reveal")
        self.assertIn("target", state, "no reveal o alvo aparece")
        self.assertEqual(len(state["last"]["results"]), len(guessers))

    def test_psychic_does_not_guess(self):
        self.start()
        psychic = self.room.state["psychic_id"]
        self.post(psychic, "sintonia_clue", {"clue": "gelo"})
        self.assertEqual(self.post(psychic, "sintonia_guess", {"value": 50}).status_code, 400)

    def test_scoring_bands(self):
        self.assertEqual(sintonia.score_for(50, 50), 4)
        self.assertEqual(sintonia.score_for(50, 53), 4)
        self.assertEqual(sintonia.score_for(50, 58), 3)
        self.assertEqual(sintonia.score_for(50, 64), 2)
        self.assertEqual(sintonia.score_for(50, 90), 0)


# ---------------------------------------------------------------------------
# Caveira
# ---------------------------------------------------------------------------


class CaveiraTests(GameTestBase):
    slug = "caveira"
    name = "Caveira"
    min_players = 3
    max_players = 6
    player_count = 4

    def test_hands_are_private(self):
        self.start()
        view = self.client_for(0).get(f"/api/rooms/{self.room.code}/").json()
        me = next(p for p in view["players"] if p["id"] == self.players[0].id)
        self.assertEqual(sorted(me["state"]["hand"]), ["caveira", "rosa", "rosa", "rosa"])
        for other in view["players"]:
            if other["id"] != self.players[0].id:
                self.assertNotIn("hand", other["state"], "a mao alheia e secreta")
                self.assertNotIn("stack", other["state"], "a pilha alheia tambem")
        self.assertIn("stack_sizes", view["state"], "mas a contagem e publica")

    def test_place_then_bid_then_flip_own_first(self):
        self.start()
        for _ in range(len(self.players)):
            state = self.refresh()
            current = caveira.current_player_id(state)
            self.assertEqual(
                self.post(current, "caveira_place", {"card": "rosa"}).status_code, 200
            )

        state = self.refresh()
        self.assertEqual(sum(state["stack_sizes"].values()), 4)

        bidder = caveira.current_player_id(state)
        self.assertEqual(self.post(bidder, "caveira_bid", {"amount": 1}).status_code, 200)
        state = self.refresh()
        self.assertEqual(state["phase"], "bidding")

        # Todos passam: o leilao fecha no unico lance.
        for _ in range(len(self.players)):
            state = self.refresh()
            if state["phase"] != "bidding":
                break
            self.post(caveira.current_player_id(state), "caveira_pass")

        state = self.refresh()
        self.assertEqual(state["phase"], "flipping")
        self.assertEqual(state["flip"]["player_id"], bidder)

        # Nao da para virar a pilha dos outros antes da propria.
        victim = next(p.id for p in self.players if p.id != bidder)
        self.assertEqual(
            self.post(bidder, "caveira_flip", {"target_player_id": victim}).status_code, 400
        )
        self.assertEqual(self.post(bidder, "caveira_flip").status_code, 200)

    def test_flipping_your_own_skull_costs_a_card(self):
        self.start()
        players = self.fresh_players()
        bidder = players[0]

        # Monta a mesa a mao: o apostador escondeu a propria caveira.
        state = self.room.state
        for player in players:
            player_state = player.state
            card = "caveira" if player.id == bidder.id else "rosa"
            player_state["hand"] = [c for c in player_state["hand"] if c != card] or ["rosa"]
            player_state["stack"] = [card]
            player.state = player_state
            player.save(update_fields=["state"])
        caveira.sync_public(state, self.fresh_players())
        state["phase"] = "flipping"
        state["highest_bid"] = 2
        state["highest_bidder_id"] = bidder.id
        state["flip"] = {
            "player_id": bidder.id,
            "target": 2,
            "revealed": [],
            "own_done": False,
        }
        self.room.state = state
        self.room.save(update_fields=["state"])

        before = len(bidder.state["hand"]) + len(bidder.state["stack"])
        self.assertEqual(self.post(bidder.id, "caveira_flip").status_code, 200)

        state = self.refresh()
        bidder.refresh_from_db()
        after = len(bidder.state["hand"]) + len(bidder.state["stack"])
        self.assertEqual(after, before - 1, "achar caveira custa uma carta")
        self.assertEqual(state["log"][-1]["type"], "fail")


# ---------------------------------------------------------------------------
# A Resistencia
# ---------------------------------------------------------------------------


class ResistenciaTests(GameTestBase):
    slug = "resistencia"
    name = "A Resistencia"
    min_players = 5
    max_players = 10
    player_count = 5

    def roles(self):
        return {p.id: p.state["role"] for p in self.fresh_players()}

    def test_two_spies_and_they_know_each_other(self):
        self.start()
        roles = self.roles()
        spies = [pid for pid, role in roles.items() if role == resistencia.ROLE_SPY]
        self.assertEqual(len(spies), 2, "5 jogadores jogam com 2 espioes")

        # Um espiao enxerga o papel do outro.
        view = self.client_by_id(spies[0]).get(f"/api/rooms/{self.room.code}/").json()
        partner = next(p for p in view["players"] if p["id"] == spies[1])
        self.assertEqual(partner["state"]["role"], resistencia.ROLE_SPY)

        # A resistencia nao enxerga ninguem.
        loyal = next(pid for pid, role in roles.items() if role == resistencia.ROLE_RESISTANCE)
        view = self.client_by_id(loyal).get(f"/api/rooms/{self.room.code}/").json()
        for entry in view["players"]:
            if entry["id"] != loyal:
                self.assertNotIn("role", entry["state"], "a resistencia joga as cegas")
        self.assertNotIn("spy_ids", view["state"])

    def test_rejected_proposal_passes_leadership(self):
        self.start()
        state = self.room.state
        leader = resistencia.current_leader_id(state)
        team = state["order"][:2]
        self.assertEqual(
            self.post(leader, "resistencia_propose", {"team": team}).status_code, 200
        )
        for player in self.players:
            self.post(player.id, "resistencia_vote", {"approve": False})

        state = self.refresh()
        self.assertEqual(state["phase"], "proposal")
        self.assertEqual(state["rejections"], 1)
        self.assertNotEqual(resistencia.current_leader_id(state), leader)

    def test_resistance_cannot_sabotage(self):
        self.start()
        state = self.room.state
        roles = self.roles()
        loyal = next(pid for pid, role in roles.items() if role == resistencia.ROLE_RESISTANCE)
        leader = resistencia.current_leader_id(state)

        team = list(dict.fromkeys([loyal, leader]))
        if len(team) < 2:
            team.append(next(p.id for p in self.players if p.id not in team))
        self.post(leader, "resistencia_propose", {"team": team})
        for player in self.players:
            self.post(player.id, "resistencia_vote", {"approve": True})
        self.assertEqual(self.refresh()["phase"], "mission")

        target = loyal if loyal in team else team[0]
        if self.roles()[target] == resistencia.ROLE_RESISTANCE:
            self.assertEqual(
                self.post(target, "resistencia_mission", {"success": False}).status_code,
                400,
                "so espiao sabota",
            )

    def test_mission_reveals_count_but_not_who(self):
        self.start()
        state = self.room.state
        roles = self.roles()
        spy = next(pid for pid, role in roles.items() if role == resistencia.ROLE_SPY)
        leader = resistencia.current_leader_id(state)
        team = list(dict.fromkeys([spy, leader]))[:2]
        if len(team) < 2:
            team = [spy, next(p.id for p in self.players if p.id != spy)]

        self.post(leader, "resistencia_propose", {"team": team})
        for player in self.players:
            self.post(player.id, "resistencia_vote", {"approve": True})

        for member in team:
            success = roles[member] != resistencia.ROLE_SPY
            self.post(member, "resistencia_mission", {"success": success})

        state = self.refresh()
        last = state["last_mission"]
        self.assertEqual(last["fails"], 1)
        self.assertFalse(last["success"])
        self.assertNotIn("saboteurs", last, "nunca se revela quem sabotou")

    def test_five_rejections_hand_the_game_to_the_spies(self):
        self.start()
        for _ in range(resistencia.MAX_REJECTIONS):
            state = self.refresh()
            if state["phase"] == "ended":
                break
            leader = resistencia.current_leader_id(state)
            self.post(leader, "resistencia_propose", {"team": state["order"][:2]})
            for player in self.players:
                self.post(player.id, "resistencia_vote", {"approve": False})

        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner"], "espioes")


# ---------------------------------------------------------------------------
# Palavra-Chave
# ---------------------------------------------------------------------------


class PalavraChaveTests(GameTestBase):
    slug = "palavra-chave"
    name = "Palavra-Chave"
    min_players = 4
    player_count = 4

    def spymaster_of(self, team):
        return self.room.state["spymasters"][team]

    def test_key_reaches_only_the_spymasters(self):
        self.start()
        state = self.api_state()
        self.assertNotIn("key", state, "o gabarito nao vai para a sala")
        self.assertNotIn("words", state)
        self.assertIn("board", state, "a mesa ve as palavras pelo tabuleiro publico")
        self.assertTrue(all(cell["owner"] is None for cell in state["board"]))

        master = self.spymaster_of(palavra_chave.TEAM_BLUE)
        view = self.client_by_id(master).get(f"/api/rooms/{self.room.code}/").json()
        me = next(p for p in view["players"] if p["id"] == master)
        self.assertEqual(len(me["state"]["key"]), 25, "o mestre ve o gabarito")

        agent = next(
            p.id
            for p in self.fresh_players()
            if not p.state.get("is_spymaster")
        )
        view = self.client_by_id(agent).get(f"/api/rooms/{self.room.code}/").json()
        for entry in view["players"]:
            if entry["id"] != agent:
                self.assertIsNone(entry["state"].get("key"), "o agente nao ve gabarito nenhum")

    def test_clue_cannot_be_a_word_on_the_board(self):
        self.start()
        state = self.api_state()
        turn = state["turn_team"]
        master = self.spymaster_of(turn)
        board_word = state["board"][0]["word"]
        response = self.post(master, "palavra_chave_clue", {"word": board_word, "count": 2})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.post(master, "palavra_chave_clue", {"word": "duas palavras", "count": 1}).status_code,
            400,
            "a dica e uma palavra so",
        )

    def test_wrong_guess_ends_the_turn(self):
        self.start()
        state = self.room.state
        turn = state["turn_team"]
        master = self.fresh_players()
        master = next(p for p in master if p.id == self.spymaster_of(turn))
        key = master.state["key"]

        self.post(master.id, "palavra_chave_clue", {"word": "PISTA", "count": 2})
        agent = next(
            p.id
            for p in self.fresh_players()
            if p.state.get("team") == turn and not p.state.get("is_spymaster")
        )
        # Uma palavra neutra encerra o turno na hora.
        neutral = key.index(palavra_chave.NEUTRAL)
        self.assertEqual(
            self.post(agent, "palavra_chave_guess", {"index": neutral}).status_code, 200
        )
        state = self.api_state()
        self.assertNotEqual(state["turn_team"], turn, "errar passa a vez")
        self.assertEqual(state["board"][neutral]["owner"], palavra_chave.NEUTRAL)

    def test_assassin_loses_instantly(self):
        self.start()
        state = self.room.state
        turn = state["turn_team"]
        master = next(p for p in self.fresh_players() if p.id == self.spymaster_of(turn))
        assassin = master.state["key"].index(palavra_chave.ASSASSIN)

        self.post(master.id, "palavra_chave_clue", {"word": "PISTA", "count": 1})
        agent = next(
            p.id
            for p in self.fresh_players()
            if p.state.get("team") == turn and not p.state.get("is_spymaster")
        )
        self.post(agent, "palavra_chave_guess", {"index": assassin})

        state = self.refresh()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["loss_reason"], "assassino")
        self.assertNotEqual(state["winner"], turn, "quem toca no assassino perde")

    def test_spymaster_cannot_guess(self):
        self.start()
        state = self.room.state
        turn = state["turn_team"]
        master = self.spymaster_of(turn)
        self.post(master, "palavra_chave_clue", {"word": "PISTA", "count": 1})
        self.assertEqual(
            self.post(master, "palavra_chave_guess", {"index": 0}).status_code, 400
        )


# ---------------------------------------------------------------------------
# O Infiltrado
# ---------------------------------------------------------------------------


class InfiltradoTests(GameTestBase):
    slug = "o-infiltrado"
    name = "O Infiltrado"
    min_players = 3
    player_count = 4

    def spy_id(self):
        return next(p.id for p in self.fresh_players() if p.state.get("is_spy"))

    def test_location_is_hidden_and_the_spy_knows_nothing(self):
        self.start()
        state = self.api_state()
        self.assertNotIn("location", state, "o local nao vai para a sala")
        self.assertNotIn("spy_id", state)
        self.assertEqual(len(state["locations"]), len(infiltrado.LOCATIONS))

        spy = self.spy_id()
        view = self.client_by_id(spy).get(f"/api/rooms/{self.room.code}/").json()
        me = next(p for p in view["players"] if p["id"] == spy)
        self.assertTrue(me["state"]["is_spy"])
        self.assertIsNone(me["state"]["location"], "o infiltrado nao sabe onde esta")

        for entry in view["players"]:
            if entry["id"] != spy:
                self.assertNotIn("location", entry["state"], "nao da para espiar o papel alheio")
                self.assertNotIn("is_spy", entry["state"])

    def test_everyone_else_shares_the_location_with_distinct_roles(self):
        self.start()
        others = [p for p in self.fresh_players() if not p.state.get("is_spy")]
        locations = {p.state["location"] for p in others}
        self.assertEqual(len(locations), 1, "a mesa toda esta no mesmo lugar")
        self.assertTrue(all(p.state["role"] for p in others))

    def test_unanimous_accusation_of_the_spy_wins(self):
        self.start()
        spy = self.spy_id()
        accuser = next(p.id for p in self.players if p.id != spy)
        self.assertEqual(
            self.post(accuser, "infiltrado_accuse", {"accused_player_id": spy}).status_code, 200
        )
        for player in self.players:
            if player.id not in (spy, accuser):
                self.post(player.id, "infiltrado_vote", {"agree": True})

        state = self.api_state()
        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winner"], "mesa")
        self.assertIn("location", state, "no fim o local e revelado")

    def test_a_single_dissent_keeps_the_game_going(self):
        self.start()
        spy = self.spy_id()
        accuser = next(p.id for p in self.players if p.id != spy)
        self.post(accuser, "infiltrado_accuse", {"accused_player_id": spy})
        voters = [p.id for p in self.players if p.id not in (spy, accuser)]
        self.post(voters[0], "infiltrado_vote", {"agree": False})
        for player_id in voters[1:]:
            self.post(player_id, "infiltrado_vote", {"agree": True})

        state = self.refresh()
        self.assertEqual(state["phase"], "playing", "acusacao so vale por unanimidade")
        self.assertIsNone(state["accusation"])

    def test_spy_guessing_the_location_wins(self):
        self.start()
        spy = self.spy_id()
        real = self._real_location()
        self.assertEqual(
            self.post(spy, "infiltrado_spy_guess", {"location": real}).status_code, 200
        )
        state = self.refresh()
        self.assertEqual(state["winner"], "infiltrado")
        self.assertEqual(state["phase"], "ended")

    def _real_location(self):
        player = next(p for p in self.fresh_players() if not p.state.get("is_spy"))
        return player.state["location"]

    def test_only_the_spy_can_guess_the_location(self):
        self.start()
        spy = self.spy_id()
        other = next(p.id for p in self.players if p.id != spy)
        self.assertEqual(
            self.post(other, "infiltrado_spy_guess", {"location": "Hospital"}).status_code, 400
        )


# ---------------------------------------------------------------------------
# Perfil
# ---------------------------------------------------------------------------


class PerfilTests(GameTestBase):
    slug = "perfil"
    name = "Perfil"
    min_players = 2
    player_count = 4

    def answer(self):
        return perfil.CARDS[Room.objects.get(pk=self.room.pk).state["card_index"]]["resposta"]

    def test_only_revealed_clues_leave_the_server(self):
        self.start()
        state = self.api_state()
        self.assertNotIn("card_index", state, "a carta em jogo nao pode vazar")
        self.assertNotIn("deck", state)
        self.assertNotIn("answer", state, "nem a resposta")
        self.assertEqual(len(state["clues"]), 1, "so a primeira dica esta na mesa")
        self.assertGreater(state["total_clues"], 1)

    def test_answer_matching_ignores_accents_and_articles(self):
        card = {"resposta": "O Senhor dos Anéis", "aliases": ["lord of the rings"]}
        self.assertTrue(perfil.matches(card, "senhor dos aneis"))
        self.assertTrue(perfil.matches(card, "  O SENHOR DOS ANEIS  "))
        self.assertTrue(perfil.matches(card, "Lord of the Rings"))
        self.assertFalse(perfil.matches(card, "senhor dos passaros"))
        self.assertFalse(perfil.matches(card, ""))

    def test_correct_guess_scores_and_ends_the_round(self):
        self.start()
        answer = self.answer()
        state = self.room.state
        expected = perfil.points_for(state)

        response = self.post(self.players[1].id, "perfil_guess", {"guess": answer})
        self.assertEqual(response.status_code, 200, response.content)

        state = self.api_state()
        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["last"]["winner_id"], self.players[1].id)
        self.assertEqual(state["last"]["points"], expected)
        self.assertEqual(state["scores"][str(self.players[1].id)], expected)
        self.assertEqual(state["answer"], answer, "na revelacao a resposta aparece")

    def test_later_guesses_are_worth_less(self):
        self.start()
        first = perfil.points_for(self.room.state)
        self.post(self.players[0].id, "perfil_next")
        self.post(self.players[0].id, "perfil_next")
        second = perfil.points_for(self.refresh())
        self.assertLess(second, first, "cada dica revelada derruba o valor da rodada")

    def test_wrong_guess_locks_the_player_out(self):
        self.start()
        player = self.players[1]
        response = self.post(player.id, "perfil_guess", {"guess": "resposta totalmente errada"})
        self.assertEqual(response.status_code, 400)

        player.refresh_from_db()
        self.assertIsNotNone(player.state["locked_until"])

        # Segunda tentativa imediata e recusada pelo bloqueio.
        again = self.post(player.id, "perfil_guess", {"guess": self.answer()})
        self.assertEqual(again.status_code, 400)
        self.assertIn("Aguarde", again.json()["detail"])

    def test_correct_guess_advances_on_the_board(self):
        self.start()
        answer = self.answer()
        expected = perfil.points_for(self.room.state)

        self.post(self.players[1].id, "perfil_guess", {"guess": answer})
        state = self.refresh()

        key = str(self.players[1].id)
        self.assertEqual(state["positions"][key], expected, "os pontos viram casas andadas")
        self.assertEqual(state["last"]["position"], expected)

        self.players[1].refresh_from_db()
        self.assertEqual(self.players[1].state["position"], expected)

        # Quem nao acertou nao sai do lugar.
        for player in self.players:
            if player.id != self.players[1].id:
                self.assertEqual(state["positions"][str(player.id)], 0)

    def test_bonus_and_trap_spaces_change_the_landing(self):
        state = {
            "positions": {"1": 0},
            "track_length": perfil.TRACK_LENGTH,
            "bonus_spaces": {"7": 2},
            "trap_spaces": {"11": -3},
        }
        landed, effect = perfil._advance(state, 1, 7)
        self.assertEqual(landed, 9, "casa de bonus empurra para frente")
        self.assertEqual(effect, {"kind": "bonus", "spaces": 2})

        state["positions"]["1"] = 0
        landed, effect = perfil._advance(state, 1, 11)
        self.assertEqual(landed, 8, "armadilha puxa para tras")
        self.assertEqual(effect["kind"], "trap")

    def test_board_never_goes_past_the_finish_or_below_zero(self):
        state = {
            "positions": {"1": 0},
            "track_length": 10,
            "bonus_spaces": {},
            "trap_spaces": {"2": -9},
        }
        landed, _ = perfil._advance(state, 1, 99)
        self.assertEqual(landed, 10, "nao passa da linha de chegada")

        state["positions"]["1"] = 0
        landed, _ = perfil._advance(state, 1, 2)
        self.assertEqual(landed, 0, "nem volta para tras da largada")

    def test_reaching_the_finish_ends_the_game(self):
        self.start()
        state = self.room.state
        # Coloca alguem a um passo da linha e deixa acertar.
        state["positions"][str(self.players[2].id)] = perfil.TRACK_LENGTH - 1
        self.room.state = state
        self.room.save(update_fields=["state"])

        self.post(self.players[2].id, "perfil_guess", {"guess": self.answer()})
        state = self.refresh()

        self.assertEqual(state["phase"], "ended")
        self.assertEqual(state["winners"], [self.players[2].id])
        self.assertEqual(state["positions"][str(self.players[2].id)], perfil.TRACK_LENGTH)

    def test_themes_filter_the_deck(self):
        self.start({"themes": ["Ano"], "rounds": 3})
        state = Room.objects.get(pk=self.room.pk).state
        self.assertEqual(state["themes"], ["Ano"])
        card = perfil.CARDS[state["card_index"]]
        self.assertEqual(card["tema"], "Ano")

    def test_every_card_is_well_formed(self):
        for card in perfil.CARDS:
            self.assertIn(card["tema"], perfil.TEMAS)
            self.assertTrue(card["resposta"])
            self.assertGreaterEqual(len(card["dicas"]), 6, card["resposta"])
            self.assertTrue(all(dica.strip() for dica in card["dicas"]), card["resposta"])


# ---------------------------------------------------------------------------
# Geracao pura, sem HTTP
# ---------------------------------------------------------------------------


class EngineSanityTests(TestCase):
    def test_codenames_key_distribution(self):
        rng = random.Random(7)

        class P:
            def __init__(self, index):
                self.id = index
                self.state = {}

            def save(self, **kwargs):
                pass

        players = [P(i) for i in range(1, 5)]
        state = palavra_chave.initialize(players, rng=rng)
        key = state["key"]
        self.assertEqual(len(key), 25)
        self.assertEqual(key.count(palavra_chave.ASSASSIN), 1)
        first = state["first_team"]
        second = "vermelho" if first == "azul" else "azul"
        self.assertEqual(key.count(first), 9, "quem comeca tem uma palavra a mais")
        self.assertEqual(key.count(second), 8)
        self.assertEqual(key.count(palavra_chave.NEUTRAL), 7)

    def test_resistance_team_tables_are_consistent(self):
        for count, sizes in resistencia.TEAM_SIZES.items():
            self.assertEqual(len(sizes), 5, f"{count} jogadores precisam de 5 missoes")
            self.assertTrue(all(1 < size <= count for size in sizes))
            self.assertIn(count, resistencia.SPY_COUNTS)
            self.assertLess(resistencia.SPY_COUNTS[count], count / 2)

    def test_spyfall_locations_have_enough_roles(self):
        for name, roles in infiltrado.LOCATIONS:
            self.assertTrue(name)
            self.assertGreaterEqual(len(roles), 4, f"{name} precisa de papeis para a mesa")
            self.assertEqual(len(set(roles)), len(roles), f"{name} tem papel repetido")

    def test_codenames_wordlist_is_clean(self):
        self.assertGreaterEqual(len(palavra_chave.WORDS), 300)
        self.assertEqual(
            len(set(palavra_chave.WORDS)),
            len(palavra_chave.WORDS),
            "palavra repetida quebraria a grade",
        )
