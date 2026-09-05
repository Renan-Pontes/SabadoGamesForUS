"""
Desenha e Adivinha — o clássico de desenhar e chutar.

Um jogador escolhe uma palavra entre três e desenha no celular; o desenho
aparece ao vivo na TV. Os outros digitam palpites. Quem acerta primeiro
ganha mais; quem desenha ganha um pouco por cada acerto. A cada terço do
tempo a TV revela uma letra.

A TV é a tela. Um celular é o pincel, os outros são o megafone.
"""

import secrets
import unicodedata

from .artista import WORDS as DRAWABLE

DESENHA_SLUG = "desenha-e-adivinha"

CHOOSE_SECONDS = 15
DRAW_SECONDS = 75
REVEAL_SECONDS = 7
TURNS_PER_PLAYER = 2
MAX_STROKES = 400
MAX_POINTS = 300
OPTIONS = 3
DRAWER_POINTS_PER_GUESS = 25
GUESS_BASE = 50
GUESS_SPEED_BONUS = 50
HINT_STEPS = 2

EXTRA_WORDS = [
    "bolo de aniversário", "chuva", "escada", "espelho", "fogueira", "gravata", "iglu", "ketchup",
    "maçã", "microfone", "mochila", "pijama", "pipa", "presente", "queijo", "rede de dormir",
    "sapato", "semáforo", "sofá", "sorriso", "telefone", "tênis", "travesseiro", "trombone",
    "vassoura", "xícara", "zebra", "âncora", "banheira", "carrossel", "chaveiro", "coroa",
    "diamante", "escorregador", "foto", "geladeira", "jacaré", "lagarta", "macarrão", "ninho",
]

WORDS = sorted({word for group in DRAWABLE.values() for word in group} | set(EXTRA_WORDS))


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _normalize(text):
    stripped = unicodedata.normalize("NFKD", text or "")
    return " ".join("".join(ch for ch in stripped if not unicodedata.combining(ch)).casefold().split())


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _save_player(player, **fields):
    player_state = player.state or {}
    player_state.update(fields)
    player.state = player_state
    player.save(update_fields=["state"])


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    if len(players) < 2:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)
    state = {
        "game": DESENHA_SLUG,
        "phase": "choose",
        "order": order,
        "turn": 0,
        "total_turns": len(order) * TURNS_PER_PLAYER,
        "drawer_id": None,
        "options": [],
        "word": None,
        "revealed": [],
        "strokes": [],
        "guesses": [],
        "solved": {},
        "scores": {str(p.id): 0 for p in players},
        "used_words": [],
        "deadline_ts": None,
        "draw_started_ts": None,
        "last_result": None,
        "winner_ids": [],
        "log": [],
    }
    for player in players:
        _save_player(player, points=0, word=None, options=[])
    _start_turn(state, players, now_ts, rng)
    return state


def _start_turn(state, players, now_ts, rng):
    order = state["order"]
    drawer_id = order[state["turn"] % len(order)]
    unused = [w for w in WORDS if w not in state["used_words"]] or list(WORDS)
    options = rng.sample(unused, min(OPTIONS, len(unused)))
    state.update(
        {
            "phase": "choose",
            "drawer_id": drawer_id,
            "options": options,
            "word": None,
            "revealed": [],
            "strokes": [],
            "guesses": [],
            "solved": {},
            "deadline_ts": now_ts + CHOOSE_SECONDS,
            "draw_started_ts": None,
        }
    )
    for player in players:
        _save_player(player, word=None, options=options if player.id == drawer_id else [])
    _log(state, {"type": "turn", "turn": state["turn"], "drawer_id": drawer_id})


def _begin_drawing(state, players, now_ts, word):
    state["word"] = word
    state["used_words"].append(word)
    state["options"] = []
    state["phase"] = "draw"
    state["draw_started_ts"] = now_ts
    state["deadline_ts"] = now_ts + DRAW_SECONDS
    for player in players:
        _save_player(player, word=word if player.id == state["drawer_id"] else None, options=[])


def choose(state, player, index, players, now_ts):
    if state.get("phase") != "choose":
        return "A palavra já foi escolhida."
    if player.id != state.get("drawer_id"):
        return "Só quem desenha escolhe a palavra."
    options = state.get("options") or []
    if not 0 <= index < len(options):
        return "Opção inválida."
    _begin_drawing(state, players, now_ts, options[index])
    return None


def _clean_points(points):
    if not isinstance(points, list):
        return None
    cleaned = []
    for point in points[:MAX_POINTS]:
        try:
            x, y = float(point[0]), float(point[1])
        except (TypeError, ValueError, IndexError):
            return None
        cleaned.append([round(min(1.0, max(0.0, x)), 3), round(min(1.0, max(0.0, y)), 3)])
    return cleaned


def stroke(state, player, stroke_id, points, color, width):
    if state.get("phase") != "draw":
        return "Não é hora de desenhar."
    if player.id != state.get("drawer_id"):
        return "Só quem desenha mexe na tela."
    cleaned = _clean_points(points)
    if cleaned is None or not cleaned:
        return "Traço inválido."
    strokes = state.setdefault("strokes", [])
    if any(s.get("id") == stroke_id for s in strokes):
        return None  # reenvio: ja esta na tela
    if len(strokes) >= MAX_STROKES:
        return "A tela está cheia. Apague algo."
    strokes.append({"id": stroke_id, "points": cleaned, "color": color, "width": width})
    return None


def clear(state, player):
    if state.get("phase") != "draw":
        return "Não é hora de desenhar."
    if player.id != state.get("drawer_id"):
        return "Só quem desenha apaga a tela."
    state["strokes"] = []
    return None


def guess(state, player, text, players, now_ts):
    if state.get("phase") != "draw":
        return "Não é hora de chutar."
    if player.id == state.get("drawer_id"):
        return "Quem desenha não chuta."
    if str(player.id) in (state.get("solved") or {}):
        return "Você já acertou. Deixe os outros sofrerem."
    text = (text or "").strip()
    if not text:
        return "Diga alguma coisa."

    guesses = state.setdefault("guesses", [])
    if _normalize(text) == _normalize(state.get("word")):
        remaining = max(0, (state.get("deadline_ts") or now_ts) - now_ts)
        points = GUESS_BASE + int(GUESS_SPEED_BONUS * remaining / DRAW_SECONDS)
        state.setdefault("solved", {})[str(player.id)] = points
        state["scores"][str(player.id)] = state["scores"].get(str(player.id), 0) + points
        drawer = str(state["drawer_id"])
        state["scores"][drawer] = state["scores"].get(drawer, 0) + DRAWER_POINTS_PER_GUESS
        guesses.append({"player_id": player.id, "text": None, "correct": True})
        for candidate in players:
            if str(candidate.id) in (str(player.id), drawer):
                _save_player(candidate, points=state["scores"][str(candidate.id)])
        guessers = [p.id for p in players if p.id != state["drawer_id"]]
        if all(str(pid) in state["solved"] for pid in guessers):
            _end_turn(state, now_ts, "all")
    else:
        guesses.append({"player_id": player.id, "text": text[:40], "correct": False})
    state["guesses"] = guesses[-30:]
    return None


def _end_turn(state, now_ts, reason):
    state["last_result"] = {
        "word": state.get("word"),
        "drawer_id": state.get("drawer_id"),
        "solved": dict(state.get("solved") or {}),
        "reason": reason,
    }
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    _log(state, {"type": "reveal", "word": state.get("word"), "reason": reason})


def _reveal_hint(state, rng):
    word = state.get("word") or ""
    hidden = [i for i, ch in enumerate(word) if ch.isalpha() and i not in state.get("revealed", [])]
    if len(hidden) <= 1:
        return  # deixa pelo menos uma letra escondida
    state.setdefault("revealed", []).append(rng.choice(hidden))


def mask(state):
    word = state.get("word") or ""
    revealed = set(state.get("revealed") or [])
    return ["_" if ch.isalpha() and i not in revealed else ch for i, ch in enumerate(word)]


def tick(state, players, now_ts, rng=None):
    rng = _rng(rng)
    phase = state.get("phase")
    deadline = state.get("deadline_ts")

    if phase == "draw":
        started = state.get("draw_started_ts") or now_ts
        elapsed = now_ts - started
        due = int(elapsed * (HINT_STEPS + 1) / DRAW_SECONDS)  # 0, 1, 2 dicas conforme o tempo
        while len(state.get("revealed") or []) < min(HINT_STEPS, due):
            before = len(state.get("revealed") or [])
            _reveal_hint(state, rng)
            if len(state.get("revealed") or []) == before:
                break

    if deadline is None or now_ts < deadline:
        return state

    if phase == "choose":
        options = state.get("options") or []
        if options:
            _begin_drawing(state, players, now_ts, options[0])
    elif phase == "draw":
        _end_turn(state, now_ts, "timeout")
    elif phase == "reveal":
        state["turn"] = state.get("turn", 0) + 1
        if state["turn"] >= state.get("total_turns", 0):
            state["phase"] = "ended"
            state["deadline_ts"] = None
            scores = state.get("scores") or {}
            best = max(scores.values()) if scores else 0
            state["winner_ids"] = [int(pid) for pid, score in scores.items() if score == best]
        else:
            _start_turn(state, players, now_ts, rng)
    return state


def redact_state(state):
    """A palavra e as opcoes ficam so com quem desenha ate a revelacao."""
    safe = dict(state)
    phase = safe.get("phase")
    safe["mask"] = mask(state) if phase in ("draw", "reveal") else []
    safe["draw_seconds"] = DRAW_SECONDS
    safe.pop("used_words", None)
    safe.pop("options", None)
    if phase not in ("reveal", "ended"):
        safe.pop("word", None)
    return safe
