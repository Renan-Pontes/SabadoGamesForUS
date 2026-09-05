"""
Lobisomem de Uma Noite — adaptação de One Night Ultimate Werewolf.

Uma noite só, sem narrador humano: o app conduz. Cada um recebe um papel em
segredo, alguns agem durante a noite (o vidente espia, o ladrão troca, a
encrenqueira embaralha), e de manhã a mesa tem alguns minutos para descobrir
quem é lobisomem — e votar.

Você vence com o time da carta que está na sua mão AO AMANHECER, não da que
recebeu. É isso que torna o ladrão e a encrenqueira tão perigosos.
"""

import secrets

LOBISOMEM_SLUG = "lobisomem"

CENTER_CARDS = 3
NIGHT_STEP_SECONDS = 40
DAY_SECONDS = 5 * 60
VOTE_SECONDS = 60
REVEAL_SECONDS = 20

LOBISOMEM = "lobisomem"
LACAIO = "lacaio"
VIDENTE = "vidente"
LADRAO = "ladrao"
ENCRENQUEIRA = "encrenqueira"
INSONE = "insone"
ALDEAO = "aldeao"

WOLF_TEAM = {LOBISOMEM, LACAIO}

ROLE_LABELS = {
    LOBISOMEM: "Lobisomem",
    LACAIO: "Lacaio",
    VIDENTE: "Vidente",
    LADRAO: "Ladrão",
    ENCRENQUEIRA: "Encrenqueira",
    INSONE: "Insone",
    ALDEAO: "Aldeão",
}

ROLE_HINTS = {
    LOBISOMEM: "Você é lobisomem. Descubra quem é o outro — e não seja pego.",
    LACAIO: "Você conhece os lobisomens e vence com eles. Eles não sabem quem você é.",
    VIDENTE: "À noite, espie a carta de um jogador ou duas do centro.",
    LADRAO: "À noite, troque sua carta pela de alguém — e veja o que virou.",
    ENCRENQUEIRA: "À noite, troque as cartas de dois OUTROS jogadores, sem olhar.",
    INSONE: "No fim da noite, veja se a sua carta ainda é a mesma.",
    ALDEAO: "Você não faz nada à noite. De dia, encontre os lobisomens.",
}

# Ordem da noite: e o que faz vidente ver a carta antes de o ladrao trocar.
NIGHT_ORDER = [LOBISOMEM, LACAIO, VIDENTE, LADRAO, ENCRENQUEIRA, INSONE]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def roles_for(player_count):
    """Baralho por numero de jogadores: sempre jogadores + 3 cartas no centro."""
    if player_count < 3 or player_count > 10:
        return None
    deck = [LOBISOMEM, LOBISOMEM, VIDENTE, LADRAO, ENCRENQUEIRA]
    if player_count >= 5:
        deck.append(INSONE)
    if player_count >= 6:
        deck.append(LACAIO)
    while len(deck) < player_count + CENTER_CARDS:
        deck.append(ALDEAO)
    return deck[: player_count + CENTER_CARDS]


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    deck = roles_for(len(players))
    if deck is None:
        return None
    rng.shuffle(deck)

    order = [p.id for p in players]
    rng.shuffle(order)

    for index, player in enumerate(players):
        role = deck[index]
        player_state = player.state or {}
        player_state.update(
            {
                "role": role,
                "current_role": role,
                "night_done": False,
                "night_info": None,
                "vote": None,
            }
        )
        player.state = player_state
        player.save(update_fields=["state"])

    center = deck[len(players):]

    state = {
        "game": LOBISOMEM_SLUG,
        "phase": "night",
        "order": order,
        "center": center,
        "night_step": 0,
        "night_roles": _night_roles_in_play(players),
        "deadline_ts": now_ts + NIGHT_STEP_SECONDS,
        "votes": {},
        "result": None,
        "log": [],
    }
    _skip_empty_steps(state, players, now_ts)
    return state


def _night_roles_in_play(players):
    """So os papeis que ALGUEM recebeu agem; os do centro dormem."""
    original = {(p.state or {}).get("role") for p in players}
    return [role for role in NIGHT_ORDER if role in original]


def current_night_role(state):
    roles = state.get("night_roles") or []
    step = state.get("night_step", 0)
    return roles[step] if step < len(roles) else None


def _actors(state, players):
    role = current_night_role(state)
    return [p for p in players if (p.state or {}).get("role") == role]


def _skip_empty_steps(state, players, now_ts):
    """Avanca ate um passo em que alguem ainda precisa agir."""
    while state.get("phase") == "night":
        role = current_night_role(state)
        if role is None:
            _start_day(state, now_ts)
            return
        pending = [p for p in _actors(state, players) if not (p.state or {}).get("night_done")]
        if pending:
            return
        state["night_step"] = state.get("night_step", 0) + 1
        state["deadline_ts"] = now_ts + NIGHT_STEP_SECONDS


def _start_day(state, now_ts):
    state["phase"] = "day"
    state["deadline_ts"] = now_ts + DAY_SECONDS


def _by_id(players, player_id):
    return next((p for p in players if p.id == player_id), None)


def _mark_done(player, info):
    player_state = player.state or {}
    player_state["night_done"] = True
    player_state["night_info"] = info
    player.state = player_state
    player.save(update_fields=["state"])


def night_action(state, player, payload, players, now_ts):
    """
    Uma acao por papel. `payload` varia: alvo, dois alvos ou cartas do centro.
    Quem esta no passo errado leva erro — o app so mostra o botao na hora certa.
    """
    if state.get("phase") != "night":
        return "A noite já acabou."
    role = (player.state or {}).get("role")
    if role != current_night_role(state):
        return "Não é a sua vez de agir."
    if (player.state or {}).get("night_done"):
        return "Você já agiu esta noite."

    info = None

    if role == LOBISOMEM:
        wolves = [p.id for p in players if (p.state or {}).get("role") == LOBISOMEM and p.id != player.id]
        if wolves:
            info = {"kind": "wolves", "partners": wolves}
        else:
            # Lobo solitario: pode espiar uma carta do centro.
            index = payload.get("center_index")
            center = state.get("center") or []
            if isinstance(index, int) and 0 <= index < len(center):
                info = {"kind": "lone_wolf", "center_index": index, "role": center[index]}
            else:
                info = {"kind": "lone_wolf", "center_index": None, "role": None}

    elif role == LACAIO:
        wolves = [p.id for p in players if (p.state or {}).get("role") == LOBISOMEM]
        info = {"kind": "minion", "wolves": wolves}

    elif role == VIDENTE:
        target_id = payload.get("target_player_id")
        center_indexes = payload.get("center_indexes") or []
        if target_id:
            target = _by_id(players, target_id)
            if not target or target.id == player.id:
                return "Escolha outro jogador."
            info = {"kind": "seer_player", "target_id": target.id, "role": (target.state or {}).get("current_role")}
        else:
            center = state.get("center") or []
            picked = [i for i in center_indexes if isinstance(i, int) and 0 <= i < len(center)][:2]
            if len(picked) != 2:
                return "Escolha um jogador ou duas cartas do centro."
            info = {"kind": "seer_center", "cards": {str(i): center[i] for i in picked}}

    elif role == LADRAO:
        target_id = payload.get("target_player_id")
        target = _by_id(players, target_id) if target_id else None
        if not target or target.id == player.id:
            return "Escolha outro jogador para roubar."
        mine = (player.state or {}).get("current_role")
        theirs = (target.state or {}).get("current_role")
        player_state = player.state or {}
        player_state["current_role"] = theirs
        player.state = player_state
        target_state = target.state or {}
        target_state["current_role"] = mine
        target.state = target_state
        target.save(update_fields=["state"])
        info = {"kind": "robber", "target_id": target.id, "new_role": theirs}

    elif role == ENCRENQUEIRA:
        first = _by_id(players, payload.get("first_player_id"))
        second = _by_id(players, payload.get("second_player_id"))
        if not first or not second or first.id == second.id or player.id in (first.id, second.id):
            return "Escolha dois OUTROS jogadores."
        a_state, b_state = first.state or {}, second.state or {}
        a_state["current_role"], b_state["current_role"] = b_state.get("current_role"), a_state.get("current_role")
        first.state, second.state = a_state, b_state
        first.save(update_fields=["state"])
        second.save(update_fields=["state"])
        info = {"kind": "troublemaker", "swapped": [first.id, second.id]}

    elif role == INSONE:
        info = {"kind": "insomniac", "role": (player.state or {}).get("current_role")}

    _mark_done(player, info)
    _skip_empty_steps(state, players, now_ts)
    return None


def cast_vote(state, player, target_id):
    """Voto secreto ate todos votarem. `target_id` None = "ninguem"."""
    if state.get("phase") != "vote":
        return "A votação não está aberta."
    if target_id is not None and target_id not in (state.get("order") or []):
        return "Jogador inválido."
    if target_id == player.id:
        return "Você não pode votar em si."
    state.setdefault("votes", {})[str(player.id)] = target_id
    player_state = player.state or {}
    player_state["vote"] = target_id
    player.state = player_state
    player.save(update_fields=["state"])
    return None


def votes_complete(state):
    return len(state.get("votes") or {}) >= len(state.get("order") or [])


def resolve(state, players, now_ts):
    """
    Regra do amanhecer: morre quem tiver mais votos (empate mata todos os
    empatados), mas so se tiver pelo menos dois — um voto so nao mata.
    """
    votes = state.get("votes") or {}
    counts = {}
    for target in votes.values():
        if target is not None:
            counts[target] = counts.get(target, 0) + 1

    dead = []
    if counts:
        top = max(counts.values())
        if top >= 2:
            dead = [pid for pid, n in counts.items() if n == top]

    final = {p.id: (p.state or {}).get("current_role") for p in players}
    wolves_in_play = [pid for pid, role in final.items() if role == LOBISOMEM]
    wolf_died = any(final.get(pid) == LOBISOMEM for pid in dead)

    if wolves_in_play:
        village_wins = wolf_died
    else:
        # Sem lobisomem entre os jogadores: a aldeia so vence se ninguem morrer.
        village_wins = not dead

    winners = []
    for pid, role in final.items():
        on_wolf_team = role in WOLF_TEAM
        if village_wins and not on_wolf_team:
            winners.append(pid)
        if not village_wins and on_wolf_team:
            winners.append(pid)
    # Lacaio sem lobo nenhum em jogo: vence sozinho se a aldeia matou alguem.
    if not wolves_in_play and not village_wins:
        winners = [pid for pid, role in final.items() if role == LACAIO] or winners

    state["phase"] = "ended"
    state["deadline_ts"] = None
    state["result"] = {
        "dead": dead,
        "vote_counts": {str(k): v for k, v in counts.items()},
        "votes": dict(votes),
        "village_wins": village_wins,
        "winners": winners,
        "final_roles": {str(pid): role for pid, role in final.items()},
        "original_roles": {str(p.id): (p.state or {}).get("role") for p in players},
        "center": list(state.get("center") or []),
    }
    return state


def tick(state, players, now_ts, rng=None):
    phase = state.get("phase")
    deadline = state.get("deadline_ts")
    expired = bool(deadline and now_ts > deadline)

    if phase == "night" and expired:
        # Quem dormiu no ponto perde a acao: a noite nao espera ninguem.
        for actor in _actors(state, players):
            if not (actor.state or {}).get("night_done"):
                _mark_done(actor, {"kind": "slept"})
        state["night_step"] = state.get("night_step", 0) + 1
        state["deadline_ts"] = now_ts + NIGHT_STEP_SECONDS
        _skip_empty_steps(state, players, now_ts)
        return state

    if phase == "day" and expired:
        state["phase"] = "vote"
        state["deadline_ts"] = now_ts + VOTE_SECONDS
        return state

    if phase == "vote" and (votes_complete(state) or expired):
        return resolve(state, players, now_ts)

    return state


def open_vote(state, now_ts):
    """O host pode encerrar a discussao antes do tempo."""
    if state.get("phase") != "day":
        return "A discussão não está aberta."
    state["phase"] = "vote"
    state["deadline_ts"] = now_ts + VOTE_SECONDS
    return None


def redact_state(state):
    """Centro e papeis sao segredo ate o amanhecer."""
    safe = dict(state)
    if safe.get("phase") != "ended":
        safe.pop("center", None)
        safe["center_count"] = len(state.get("center") or [])
    if safe.get("phase") == "vote":
        safe["votes_cast"] = len(state.get("votes") or {})
        safe.pop("votes", None)
    safe["current_night_role"] = current_night_role(state)
    safe["role_labels"] = ROLE_LABELS
    return safe
