"""
Bomba-Relógio — adaptação de Pass the Bomb / Tick Tock Boom.

A TV mostra uma categoria ("marcas de carro", "coisas que são vermelhas").
Quem está com a bomba fala uma palavra da categoria e passa para o próximo.
A bomba explode num momento aleatório que ninguém conhece: quem estiver
segurando perde uma vida. Três vidas. Último de pé vence.

A TV é a bomba. O celular é a mão.
"""

import secrets

BOMBA_SLUG = "bomba-relogio"

LIVES = 3
MAX_ROUNDS = 12
MIN_FUSE = 25
MAX_FUSE = 70
BOOM_SECONDS = 8

CATEGORIES = [
    "Marcas de carro",
    "Frutas",
    "Coisas que são vermelhas",
    "Capitais de países",
    "Personagens da Disney",
    "Times de futebol brasileiros",
    "Coisas que tem na cozinha",
    "Animais com quatro patas",
    "Nomes de meninas com M",
    "Filmes de terror",
    "Cantores brasileiros",
    "Coisas que se compra na padaria",
    "Super-heróis",
    "Instrumentos musicais",
    "Palavras que terminam em ÃO",
    "Coisas que voam",
    "Profissões perigosas",
    "Sabores de sorvete",
    "Programas de TV brasileiros",
    "Coisas que tem na praia",
    "Estados do Brasil",
    "Marcas de tênis",
    "Coisas que são frias",
    "Personagens de videogame",
    "Desculpas para chegar atrasado",
    "Coisas para fazer num domingo",
    "Nomes de cachorro",
    "Coisas que tem no banheiro",
    "Países da Europa",
    "Aplicativos de celular",
    "Coisas que são doces",
    "Bandas de rock",
    "Esportes olímpicos",
    "Coisas que tem num casamento",
    "Motivos para terminar um namoro",
    "Coisas para levar numa viagem",
    "Séries de streaming",
    "Comidas de festa junina",
    "Coisas que fazem barulho",
    "Coisas que tem numa escola",
    "Verbos terminados em AR",
    "Coisas que são caras",
    "Personagens de novela",
    "Marcas de cerveja",
    "Coisas que ficam na geladeira",
    "Nomes de meninos com R",
    "Coisas amarelas",
    "Desenhos animados",
    "Coisas que tem numa festa de aniversário",
    "Lugares para um primeiro encontro",
    "Coisas que dão medo",
    "Palavras em inglês que todo mundo usa",
    "Coisas que se faz no chuveiro",
    "Comidas típicas do Brasil",
    "Coisas que tem no carro",
    "Vilões de filme",
    "Jogos de tabuleiro",
    "Frases que os pais falam",
    "Coisas que se perde com facilidade",
    "Ingredientes de pizza",
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    if len(players) < 2:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)
    for player in players:
        player_state = player.state or {}
        player_state["lives"] = LIVES
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": BOMBA_SLUG,
        "phase": "ticking",
        "round": 0,
        "order": order,
        "lives": {str(pid): LIVES for pid in order},
        "holder_id": None,
        "category": None,
        "used_categories": [],
        "started_ts": None,
        "explode_ts": None,
        "deadline_ts": None,
        "pass_count": 0,
        "last_boom": None,
        "winner_ids": [],
        "log": [],
    }
    _start_round(state, now_ts, rng, order[0])
    return state


def alive_ids(state):
    lives = state.get("lives") or {}
    return [pid for pid in state.get("order") or [] if lives.get(str(pid), 0) > 0]


def _start_round(state, now_ts, rng, start_with):
    state["round"] = state.get("round", 0) + 1
    options = [c for c in CATEGORIES if c not in state.get("used_categories", [])] or CATEGORIES
    category = rng.choice(options)
    state.setdefault("used_categories", []).append(category)
    fuse = rng.uniform(MIN_FUSE, MAX_FUSE)
    state.update(
        {
            "phase": "ticking",
            "category": category,
            "holder_id": start_with,
            "started_ts": now_ts,
            "explode_ts": now_ts + fuse,
            # Prazo publico de seguranca: ate la a bomba com certeza ja estourou.
            "deadline_ts": now_ts + MAX_FUSE + 1,
            "pass_count": 0,
        }
    )
    _log(state, {"type": "round", "round": state["round"], "category": category})


def _next_alive_after(state, player_id):
    order = state.get("order") or []
    alive = set(alive_ids(state))
    if player_id not in order:
        return next(iter(alive), player_id)
    start = order.index(player_id)
    for step in range(1, len(order) + 1):
        candidate = order[(start + step) % len(order)]
        if candidate in alive:
            return candidate
    return player_id


def pass_bomb(state, player, now_ts):
    if state.get("phase") != "ticking":
        return "A bomba não está na mesa."
    if state.get("holder_id") != player.id:
        return "A bomba não está com você."
    if now_ts >= state.get("explode_ts", 0):
        # Apertou depois de estourar: a bomba explode na mao mesmo.
        _explode(state, now_ts)
        return None
    state["holder_id"] = _next_alive_after(state, player.id)
    state["pass_count"] = state.get("pass_count", 0) + 1
    _log(state, {"type": "pass", "from": player.id, "to": state["holder_id"]})
    return None


def _explode(state, now_ts):
    holder = state.get("holder_id")
    lives = state.setdefault("lives", {})
    lives[str(holder)] = max(0, lives.get(str(holder), 0) - 1)
    state["last_boom"] = {
        "player_id": holder,
        "round": state.get("round"),
        "category": state.get("category"),
        "passes": state.get("pass_count", 0),
        "eliminated": lives[str(holder)] == 0,
        "lives_left": lives[str(holder)],
    }
    state["phase"] = "boom"
    state["deadline_ts"] = now_ts + BOOM_SECONDS
    _log(state, {"type": "boom", "player_id": holder})


def _sync_lives(state, players):
    lives = state.get("lives") or {}
    for player in players:
        player_state = player.state or {}
        if player_state.get("lives") != lives.get(str(player.id)):
            player_state["lives"] = lives.get(str(player.id), 0)
            player.state = player_state
            player.save(update_fields=["state"])


def tick(state, players, now_ts, rng=None):
    rng = _rng(rng)
    phase = state.get("phase")
    if phase == "ticking" and now_ts >= state.get("explode_ts", 0):
        _explode(state, now_ts)
        _sync_lives(state, players)
    elif phase == "boom" and now_ts >= (state.get("deadline_ts") or 0):
        alive = alive_ids(state)
        if len(alive) <= 1 or state.get("round", 0) >= MAX_ROUNDS:
            state["phase"] = "ended"
            state["deadline_ts"] = None
            if len(alive) == 1:
                state["winner_ids"] = alive
            else:
                lives = state.get("lives") or {}
                best = max(lives.values()) if lives else 0
                state["winner_ids"] = [int(pid) for pid, n in lives.items() if n == best and n > 0]
        else:
            boomed = (state.get("last_boom") or {}).get("player_id")
            start_with = boomed if boomed in alive else _next_alive_after(state, boomed)
            _start_round(state, now_ts, rng, start_with)
    return state


def redact_state(state):
    """Ninguem sabe quando a bomba explode — nem a TV."""
    safe = dict(state)
    safe.pop("explode_ts", None)
    safe.pop("used_categories", None)
    safe["alive_ids"] = alive_ids(state)
    safe["min_fuse"] = MIN_FUSE
    safe["max_fuse"] = MAX_FUSE
    safe["max_lives"] = LIVES
    return safe
