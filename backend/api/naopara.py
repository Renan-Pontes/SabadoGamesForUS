"""
Não Para — adaptação de Can't Stop.

Onze colunas, de 2 a 12, com alturas diferentes: o 7 é longo porque sai
toda hora, o 2 e o 12 são curtos porque quase nunca saem. Na sua vez, role
quatro dados, junte-os em dois pares e avance nas colunas somadas. Pode
rolar de novo quantas vezes quiser — mas se nenhum par servir, perde tudo
que andou na vez. Pare a tempo e o progresso vira permanente. Feche três
colunas e venceu.

A TV mostra as colunas; o celular decide se você para ou não.
"""

import secrets
from itertools import combinations

NAOPARA_SLUG = "nao-para"

COLUMN_HEIGHTS = {2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3}
MAX_RUNNERS = 3
COLUMNS_TO_WIN = 3
DICE = 4


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def initialize(players, rng=None):
    rng = _rng(rng)
    if len(players) < 2:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)

    for player in players:
        player_state = player.state or {}
        player_state["markers"] = {}
        player.state = player_state
        player.save(update_fields=["state"])

    return {
        "game": NAOPARA_SLUG,
        "phase": "rolling",
        "order": order,
        "turn_index": 0,
        "runners": {},
        "dice": [],
        "options": [],
        "claimed": {},
        "markers": {str(pid): {} for pid in order},
        "winner_id": None,
        "turn_number": 1,
        "last_event": None,
        "log": [],
    }


def current_player_id(state):
    order = state.get("order") or []
    if not order:
        return None
    return order[state.get("turn_index", 0) % len(order)]


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _height(state, player_id, column):
    """Progresso efetivo numa coluna: marcador permanente + corredor da vez."""
    runner = state.get("runners", {}).get(str(column))
    if runner is not None:
        return runner
    return state.get("markers", {}).get(str(player_id), {}).get(str(column), 0)


def _can_advance(state, player_id, column):
    if str(column) in state.get("claimed", {}):
        return False
    runners = state.get("runners", {})
    if str(column) not in runners and len(runners) >= MAX_RUNNERS:
        return False
    return _height(state, player_id, column) < COLUMN_HEIGHTS[column]


def _pairings(dice):
    """As tres formas de juntar quatro dados em dois pares."""
    a, b, c, d = dice
    return [
        ((a + b), (c + d)),
        ((a + c), (b + d)),
        ((a + d), (b + c)),
    ]


def _options_for(state, player_id, dice):
    """
    Cada pareamento vira uma opcao: as colunas que voce pode avancar com ele.
    Duas somas iguais avancam duas casas na mesma coluna. Se so uma das duas
    somas cabe (ha limite de tres corredores), a opcao e so essa.
    """
    options = []
    seen = set()
    for first, second in _pairings(dice):
        playable = []
        # Simula o avanco em ordem, respeitando o limite de corredores.
        runners = dict(state.get("runners", {}))
        for column in (first, second):
            key = str(column)
            temp_state = {**state, "runners": runners}
            if _can_advance(temp_state, player_id, column):
                playable.append(column)
                runners[key] = _height(temp_state, player_id, column) + 1
        if not playable:
            continue
        signature = tuple(sorted(playable))
        if signature in seen:
            continue
        seen.add(signature)
        options.append({"pair": [first, second], "columns": playable})
    return options


def roll(state, player, rng=None):
    rng = _rng(rng)
    if state.get("phase") == "ended":
        return "A partida acabou."
    if state.get("phase") != "rolling":
        return "Escolha um par antes de rolar de novo."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."

    dice = [rng.randint(1, 6) for _ in range(DICE)]
    options = _options_for(state, player.id, dice)
    state["dice"] = dice

    if not options:
        # Estourou: perde tudo que avancou nesta vez.
        lost = dict(state.get("runners") or {})
        state["runners"] = {}
        state["options"] = []
        state["last_event"] = {"type": "bust", "player_id": player.id, "dice": dice, "lost": lost}
        _log(state, {"type": "bust", "player_id": player.id, "dice": dice})
        _next_turn(state)
        return None

    state["options"] = options
    state["phase"] = "choosing"
    state["last_event"] = {"type": "roll", "player_id": player.id, "dice": dice}
    return None


def choose(state, player, option_index):
    if state.get("phase") != "choosing":
        return "Role os dados primeiro."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    options = state.get("options") or []
    if not 0 <= option_index < len(options):
        return "Opção inválida."

    runners = state.setdefault("runners", {})
    for column in options[option_index]["columns"]:
        key = str(column)
        runners[key] = _height(state, player.id, column) + 1

    state["options"] = []
    state["phase"] = "rolling"
    _log(state, {"type": "advance", "player_id": player.id, "columns": options[option_index]["columns"]})
    return None


def stop(state, player, players):
    """Para e consolida os corredores. Coluna no topo fica fechada para todos."""
    if state.get("phase") == "ended":
        return "A partida acabou."
    if state.get("phase") != "rolling":
        return "Decida o par antes de parar."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    runners = state.get("runners") or {}
    if not runners:
        return "Você ainda não avançou nada nesta vez."

    markers = state.setdefault("markers", {}).setdefault(str(player.id), {})
    claimed_now = []
    for key, height in runners.items():
        markers[key] = height
        if height >= COLUMN_HEIGHTS[int(key)]:
            state.setdefault("claimed", {})[key] = player.id
            claimed_now.append(int(key))

    player_state = player.state or {}
    player_state["markers"] = dict(markers)
    player.state = player_state
    player.save(update_fields=["state"])

    state["runners"] = {}
    state["last_event"] = {"type": "stop", "player_id": player.id, "claimed": claimed_now}
    _log(state, {"type": "stop", "player_id": player.id, "claimed": claimed_now})

    owned = [col for col, owner in state.get("claimed", {}).items() if owner == player.id]
    if len(owned) >= COLUMNS_TO_WIN:
        state["phase"] = "ended"
        state["winner_id"] = player.id
        return None

    _next_turn(state)
    return None


def _next_turn(state):
    order = state.get("order") or []
    state["turn_index"] = (state.get("turn_index", 0) + 1) % max(1, len(order))
    state["turn_number"] = state.get("turn_number", 1) + 1
    state["phase"] = "rolling"
    state["dice"] = []
    state["options"] = []


def redact_state(state):
    """Nada e secreto no Nao Para: e tudo na mesa."""
    safe = dict(state)
    safe["column_heights"] = {str(k): v for k, v in COLUMN_HEIGHTS.items()}
    safe["current_player_id"] = current_player_id(state)
    return safe
