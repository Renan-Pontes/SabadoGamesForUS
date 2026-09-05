"""
Artista Falso — adaptação de A Fake Artist Goes to New York.

Todos recebem a mesma palavra secreta — menos um, que só sabe a categoria.
Cada um desenha UM traço por vez na tela da TV, duas voltas. Os artistas
querem provar que sabem a palavra sem entregá-la; o falso quer parecer que
sabe. No fim, todos votam. Se o falso for o mais votado, ainda pode chutar
a palavra: acertou, vence mesmo assim.

A TV é a tela. O celular é o pincel.
"""

import secrets
import unicodedata

ARTISTA_SLUG = "artista-falso"

ROUNDS = 3
STROKE_SECONDS = 40
VOTE_SECONDS = 60
GUESS_SECONDS = 40
REVEAL_SECONDS = 14
STROKES_PER_PLAYER = 2
MAX_POINTS = 400
FAKE_WIN_POINTS = 2
ARTIST_WIN_POINTS = 1

COLORS = [
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#84cc16",
    "#06b6d4",
    "#e11d48",
    "#8b5cf6",
]

WORDS = {
    "Animais": ["gato", "elefante", "girafa", "tubarão", "borboleta", "pinguim", "coruja", "cobra", "caranguejo", "tartaruga", "polvo", "cavalo"],
    "Comida": ["pizza", "hambúrguer", "sorvete", "brigadeiro", "abacaxi", "sushi", "cachorro-quente", "melancia", "pipoca", "taco", "ovo frito", "coxinha"],
    "Objetos": ["guarda-chuva", "óculos", "violão", "tesoura", "chave", "relógio", "bicicleta", "lâmpada", "escova de dentes", "martelo", "cadeira", "celular"],
    "Lugares": ["praia", "castelo", "hospital", "estádio", "deserto", "floresta", "cozinha", "igreja", "ponte", "ilha", "farol", "cemitério"],
    "Profissões": ["bombeiro", "médico", "astronauta", "cozinheiro", "palhaço", "pirata", "policial", "jardineiro", "dentista", "pintor", "mágico", "pescador"],
    "Esportes": ["futebol", "natação", "boxe", "surfe", "xadrez", "golfe", "esqui", "vôlei", "judô", "ciclismo", "basquete", "tênis"],
    "Transportes": ["helicóptero", "submarino", "foguete", "trem", "skate", "balão", "navio", "trator", "ambulância", "moto", "canoa", "avião"],
    "Natureza": ["vulcão", "arco-íris", "cachoeira", "tornado", "raio", "lua", "cacto", "montanha", "onda", "floco de neve", "caverna", "girassol"],
    "Fantasia": ["dragão", "sereia", "fantasma", "vampiro", "robô", "zumbi", "unicórnio", "bruxa", "alienígena", "gigante", "duende", "múmia"],
    "Corpo": ["nariz", "dente", "coração", "cérebro", "pé", "orelha", "olho", "esqueleto", "mão", "bigode", "língua", "umbigo"],
}


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _normalize(text):
    stripped = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in stripped if not unicodedata.combining(ch)).casefold().strip()


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
    if len(players) < 3:
        return None
    state = {
        "game": ARTISTA_SLUG,
        "phase": "draw",
        "round": 0,
        "rounds": min(ROUNDS, len(players)),
        "colors": {str(p.id): COLORS[index % len(COLORS)] for index, p in enumerate(players)},
        "scores": {str(p.id): 0 for p in players},
        "fake_history": [],
        "used_words": [],
        "category": None,
        "word": None,
        "fake_id": None,
        "order": [],
        "stroke_turn": 0,
        "total_turns": 0,
        "strokes": [],
        "votes": {},
        "tally": {},
        "fake_guess": None,
        "result": None,
        "deadline_ts": None,
        "winner_ids": [],
        "log": [],
    }
    for player in players:
        _save_player(player, points=0)
    _start_round(state, players, now_ts, rng)
    return state


def _start_round(state, players, now_ts, rng):
    state["round"] += 1
    candidates = [p for p in players if p.id not in state["fake_history"]] or list(players)
    fake = rng.choice(candidates)
    state["fake_history"].append(fake.id)

    category = rng.choice(sorted(WORDS))
    unused = [w for w in WORDS[category] if w not in state["used_words"]] or WORDS[category]
    word = rng.choice(unused)
    state["used_words"].append(word)

    order = [p.id for p in players]
    rng.shuffle(order)
    state.update(
        {
            "category": category,
            "word": word,
            "fake_id": fake.id,
            "order": order,
            "stroke_turn": 0,
            "total_turns": len(order) * STROKES_PER_PLAYER,
            "strokes": [],
            "votes": {},
            "tally": {},
            "fake_guess": None,
            "result": None,
            "phase": "draw",
            "deadline_ts": now_ts + STROKE_SECONDS,
        }
    )
    for player in players:
        is_fake = player.id == fake.id
        _save_player(player, word=None if is_fake else word, is_fake=is_fake, vote=None)
    _log(state, {"type": "round", "round": state["round"], "category": category})


def current_drawer_id(state):
    order = state.get("order") or []
    turn = state.get("stroke_turn", 0)
    if not order or turn >= state.get("total_turns", 0):
        return None
    return order[turn % len(order)]


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


def draw(state, player, points, now_ts):
    if state.get("phase") != "draw":
        return "Não é hora de desenhar."
    if current_drawer_id(state) != player.id:
        return "Não é a sua vez de desenhar."
    cleaned = _clean_points(points)
    if cleaned is None or len(cleaned) < 2:
        return "Faça um traço contínuo."
    state.setdefault("strokes", []).append(
        {
            "player_id": player.id,
            "color": state["colors"].get(str(player.id), "#ffffff"),
            "points": cleaned,
            "turn": state["stroke_turn"],
        }
    )
    _advance_turn(state, now_ts)
    return None


def _advance_turn(state, now_ts):
    state["stroke_turn"] = state.get("stroke_turn", 0) + 1
    if state["stroke_turn"] >= state.get("total_turns", 0):
        state["phase"] = "vote"
        state["deadline_ts"] = now_ts + VOTE_SECONDS
    else:
        state["deadline_ts"] = now_ts + STROKE_SECONDS


def vote(state, player, target_id, players, now_ts):
    if state.get("phase") != "vote":
        return "Não é hora de votar."
    if target_id not in {p.id for p in players}:
        return "Jogador inválido."
    if target_id == player.id:
        return "Não dá para votar em si mesmo."
    state.setdefault("votes", {})[str(player.id)] = target_id
    _save_player(player, vote=target_id)
    if all(str(p.id) in state["votes"] for p in players):
        _resolve_votes(state, players, now_ts)
    return None


def _resolve_votes(state, players, now_ts):
    tally = {}
    for target in (state.get("votes") or {}).values():
        tally[str(target)] = tally.get(str(target), 0) + 1
    state["tally"] = tally
    fake = state["fake_id"]
    fake_votes = tally.get(str(fake), 0)
    # So e pego se for o MAIS votado, sem empate: no empate o falso escapa.
    caught = fake_votes > 0 and all(
        count < fake_votes for target, count in tally.items() if target != str(fake)
    )
    if caught:
        state["phase"] = "guess"
        state["deadline_ts"] = now_ts + GUESS_SECONDS
    else:
        _finish_round(state, players, now_ts, "fake_escaped")


def guess(state, player, word, players, now_ts):
    if state.get("phase") != "guess":
        return "Não é hora de chutar."
    if player.id != state.get("fake_id"):
        return "Só o artista falso chuta a palavra."
    word = (word or "").strip()
    if not word:
        return "Diga uma palavra."
    state["fake_guess"] = word
    outcome = "fake_guessed" if _normalize(word) == _normalize(state["word"]) else "artists_won"
    _finish_round(state, players, now_ts, outcome)
    return None


def _finish_round(state, players, now_ts, outcome):
    fake = state["fake_id"]
    for player in players:
        if outcome == "artists_won":
            delta = 0 if player.id == fake else ARTIST_WIN_POINTS
        else:
            delta = FAKE_WIN_POINTS if player.id == fake else 0
        if delta:
            state["scores"][str(player.id)] = state["scores"].get(str(player.id), 0) + delta
            _save_player(player, points=state["scores"][str(player.id)])
    state["result"] = {
        "outcome": outcome,
        "fake_id": fake,
        "word": state["word"],
        "category": state["category"],
        "votes": dict(state.get("votes") or {}),
        "tally": dict(state.get("tally") or {}),
        "guess": state.get("fake_guess"),
    }
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    _log(state, {"type": "result", "round": state["round"], "outcome": outcome})


def _end_or_next(state, players, now_ts, rng):
    if state["round"] >= state["rounds"]:
        state["phase"] = "ended"
        state["deadline_ts"] = None
        scores = state.get("scores") or {}
        best = max(scores.values()) if scores else 0
        state["winner_ids"] = [int(pid) for pid, score in scores.items() if score == best]
        return
    _start_round(state, players, now_ts, rng)


def tick(state, players, now_ts, rng=None):
    deadline = state.get("deadline_ts")
    if deadline is None or now_ts < deadline:
        return state
    phase = state.get("phase")
    if phase == "draw":
        _advance_turn(state, now_ts)  # quem dormiu perdeu o traco
    elif phase == "vote":
        _resolve_votes(state, players, now_ts)
    elif phase == "guess":
        _finish_round(state, players, now_ts, "artists_won")
    elif phase == "reveal":
        _end_or_next(state, players, now_ts, _rng(rng))
    return state


def redact_state(state):
    """A palavra e o falso so aparecem na revelacao; os tracos sao publicos."""
    safe = dict(state)
    phase = safe.get("phase")
    safe["current_drawer_id"] = current_drawer_id(state)
    safe["voted_ids"] = [int(pid) for pid in (state.get("votes") or {})]
    safe["strokes_per_player"] = STROKES_PER_PLAYER
    if phase == "guess":
        safe["accused_id"] = state.get("fake_id")
    if phase not in ("reveal", "ended"):
        for key in ("word", "fake_id", "votes", "tally", "fake_guess"):
            safe.pop(key, None)
    safe.pop("fake_history", None)
    safe.pop("used_words", None)
    return safe
