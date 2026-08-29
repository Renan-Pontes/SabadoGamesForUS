"""
Perfil — adaptação do clássico da Grow.

Uma carta secreta e dicas reveladas uma a uma. Quem acerta primeiro leva a
rodada, e vale mais quanto menos dicas tiverem saído. Errar custa alguns
segundos de silêncio — o suficiente para outra pessoa te passar.
"""

import secrets
import unicodedata

from .perfil_cards import CARDS, TEMAS

PERFIL_SLUG = "perfil"

CLUE_SECONDS = 20
REVEAL_SECONDS = 12
WRONG_GUESS_LOCK = 8

# O tabuleiro e o jogo: os pontos de cada acerto viram casas andadas, e quem
# cruzar a linha primeiro vence. Sem ele, Perfil vira so um quiz com placar.
TRACK_LENGTH = 30

# Casas especiais, para a corrida nao ser uma reta sem graca.
BONUS_SPACES = {7: 2, 16: 3, 24: 2}
TRAP_SPACES = {11: -3, 21: -4}

# Trava de seguranca: se ninguem acertar nunca, a partida precisa acabar.
MAX_ROUNDS_CAP = 25

# Palavras que não mudam a resposta e só atrapalham a comparação.
STOP_WORDS = {"o", "a", "os", "as", "um", "uma", "de", "da", "do", "das", "dos", "e"}


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def normalize(text):
    """
    Compara respostas com tolerância: sem acento, sem caixa, sem artigo e sem
    pontuação. "o senhor dos aneis" bate com "O Senhor dos Anéis".
    """
    if not text:
        return ""
    lowered = unicodedata.normalize("NFKD", str(text).lower())
    stripped = "".join(char for char in lowered if not unicodedata.combining(char))
    cleaned = "".join(char if char.isalnum() or char.isspace() else " " for char in stripped)
    words = [word for word in cleaned.split() if word and word not in STOP_WORDS]
    return " ".join(words)


def matches(card, guess):
    candidates = [card["resposta"]] + list(card.get("aliases") or [])
    target = normalize(guess)
    if not target:
        return False
    return any(normalize(candidate) == target for candidate in candidates)


def available_themes():
    return list(TEMAS)


def _deck_for(themes):
    chosen = set(themes or TEMAS)
    deck = [index for index, card in enumerate(CARDS) if card["tema"] in chosen]
    return deck or list(range(len(CARDS)))


def _start_round(state, players, rng, now_ts):
    deck = state.get("deck") or []
    if not deck:
        deck = _deck_for(state.get("themes"))
        rng.shuffle(deck)
    card_index = deck.pop()
    state["deck"] = deck
    state["card_index"] = card_index
    state["revealed_count"] = 1
    state["phase"] = "reading"
    state["deadline_ts"] = now_ts + CLUE_SECONDS
    state["locks"] = {}
    state["round_winner_id"] = None

    for player in players:
        player_state = player.state or {}
        player_state["locked_until"] = None
        player.state = player_state
        player.save(update_fields=["state"])
    return state


def initialize(players, themes, max_rounds, now_ts, rng=None):
    rng = _rng(rng)
    deck = _deck_for(themes)
    rng.shuffle(deck)

    for player in players:
        player_state = player.state or {}
        player_state["score"] = 0
        player_state["position"] = 0
        player_state["locked_until"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": PERFIL_SLUG,
        "themes": list(themes or TEMAS),
        "round": 1,
        "max_rounds": max(1, min(max_rounds or MAX_ROUNDS_CAP, len(deck), MAX_ROUNDS_CAP)),
        "deck": deck,
        "scores": {str(player.id): 0 for player in players},
        "positions": {str(player.id): 0 for player in players},
        "track_length": TRACK_LENGTH,
        "bonus_spaces": BONUS_SPACES,
        "trap_spaces": TRAP_SPACES,
        "last": None,
        "winners": [],
    }
    return _start_round(state, players, rng, now_ts)


def current_card(state):
    index = state.get("card_index")
    if index is None:
        return None
    return CARDS[index]


def visible_clues(state):
    """Só as dicas já reveladas saem do servidor — o resto é o jogo."""
    card = current_card(state)
    if not card:
        return []
    return card["dicas"][: state.get("revealed_count", 0)]


def total_clues(state):
    card = current_card(state)
    return len(card["dicas"]) if card else 0


def points_for(state):
    """Quanto vale acertar agora: cada dica revelada derruba um ponto."""
    return max(1, total_clues(state) - state.get("revealed_count", 1) + 1)


def reveal_next(state, now_ts):
    if state.get("phase") != "reading":
        return "A rodada não está em leitura."
    if state.get("revealed_count", 0) >= total_clues(state):
        return "Todas as dicas já saíram."
    state["revealed_count"] = state.get("revealed_count", 0) + 1
    state["deadline_ts"] = now_ts + CLUE_SECONDS
    return None


def _advance(state, player_id, spaces):
    """
    Anda no tabuleiro e resolve a casa onde parou.

    Devolve (posicao_final, efeito) — o efeito e o texto que a TV mostra
    quando a pessoa cai num bonus ou numa armadilha.
    """
    positions = state.get("positions") or {}
    key = str(player_id)
    track = state.get("track_length", TRACK_LENGTH)

    landed = min(track, max(0, positions.get(key, 0) + spaces))
    effect = None

    bonus = (state.get("bonus_spaces") or {}).get(str(landed))
    trap = (state.get("trap_spaces") or {}).get(str(landed))
    if bonus:
        landed = min(track, landed + bonus)
        effect = {"kind": "bonus", "spaces": bonus}
    elif trap:
        landed = max(0, landed + trap)
        effect = {"kind": "trap", "spaces": trap}

    positions[key] = landed
    state["positions"] = positions
    return landed, effect


def _finish_round(state, players, winner_id, guess, now_ts):
    card = current_card(state)
    points = points_for(state) if winner_id else 0
    scores = state.get("scores") or {}
    position = None
    effect = None
    if winner_id:
        key = str(winner_id)
        scores[key] = scores.get(key, 0) + points
        position, effect = _advance(state, winner_id, points)
    state["scores"] = scores

    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    state["round_winner_id"] = winner_id
    state["last"] = {
        "round": state.get("round"),
        "tema": card["tema"] if card else None,
        "resposta": card["resposta"] if card else None,
        "clues_used": state.get("revealed_count"),
        "total_clues": total_clues(state),
        "winner_id": winner_id,
        "points": points,
        "guess": guess,
        "position": position,
        "effect": effect,
    }

    positions = state.get("positions") or {}
    for player in players:
        player_state = player.state or {}
        player_state["score"] = scores.get(str(player.id), 0)
        player_state["position"] = positions.get(str(player.id), 0)
        player.state = player_state
        player.save(update_fields=["state"])

    # Cruzou a linha: acabou a corrida.
    if position is not None and position >= state.get("track_length", TRACK_LENGTH):
        state["winners"] = [winner_id]
        state["phase"] = "ended"
        state["deadline_ts"] = None
    return None


def submit_guess(state, player, guess, players, now_ts):
    """
    Um palpite errado tranca a pessoa por alguns segundos: sem isso, o jogo
    viraria uma metralhadora de chutes até acertar.
    """
    if state.get("phase") != "reading":
        return "Não é hora de palpitar."

    locked_until = (player.state or {}).get("locked_until")
    if locked_until and now_ts < locked_until:
        return f"Aguarde {int(locked_until - now_ts) + 1}s antes de tentar de novo."

    card = current_card(state)
    if not card:
        return "Nenhuma carta em jogo."

    if matches(card, guess):
        return _finish_round(state, players, player.id, guess, now_ts)

    player_state = player.state or {}
    player_state["locked_until"] = now_ts + WRONG_GUESS_LOCK
    player.state = player_state
    player.save(update_fields=["state"])

    locks = state.get("locks") or {}
    locks[str(player.id)] = now_ts + WRONG_GUESS_LOCK
    state["locks"] = locks
    return "Não é essa. Você fica alguns segundos fora."


def _finish_game(state):
    """Fim por esgotar as rodadas: vence quem estiver mais longe na pista."""
    positions = state.get("positions") or {}
    state["phase"] = "ended"
    state["deadline_ts"] = None
    if positions:
        best = max(positions.values())
        state["winners"] = [int(pid) for pid, value in positions.items() if value == best]
    else:
        state["winners"] = []
    return state


def tick(state, players, now_ts, rng=None):
    rng = _rng(rng)
    phase = state.get("phase")
    deadline = state.get("deadline_ts")

    if phase == "reading":
        if deadline and now_ts > deadline:
            if state.get("revealed_count", 0) >= total_clues(state):
                # Acabaram as dicas e ninguém acertou: ninguém pontua.
                _finish_round(state, players, None, None, now_ts)
            else:
                reveal_next(state, now_ts)
        return state

    if phase == "reveal":
        if deadline and now_ts > deadline:
            if state.get("winners"):
                state["phase"] = "ended"
                state["deadline_ts"] = None
                return state
            if state.get("round", 1) >= state.get("max_rounds", 1):
                return _finish_game(state)
            state["round"] = state.get("round", 1) + 1
            return _start_round(state, players, rng, now_ts)
        return state

    return state


def redact_state(state):
    """Só as dicas já lidas saem; a resposta espera a revelação."""
    safe = dict(state)
    safe.pop("deck", None)
    safe.pop("card_index", None)
    card = current_card(state)
    safe["clues"] = visible_clues(state)
    safe["total_clues"] = total_clues(state)
    safe["points_now"] = points_for(state)
    safe["tema"] = card["tema"] if card else None
    safe["track_length"] = state.get("track_length", TRACK_LENGTH)
    if safe.get("phase") in {"reveal", "ended"} and card:
        safe["answer"] = card["resposta"]
    return safe
