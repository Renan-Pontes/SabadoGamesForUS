"""
Corrida de Camelos — adaptação de Camel Up.

Cinco camelos numa pista de 16 casas. Ninguém controla nenhum: a cada vez
alguém rola um dado da pirâmide e um camelo aleatório anda 1 a 3 casas —
e quando para em cima de outro, os dois viram uma pilha que anda junta.
Você ganha apostando: em quem lidera a etapa, em quem vence a corrida, ou
colocando uma armadilha na pista.

A TV é a pista. Os celulares são os bolsos de cada apostador.
"""

import secrets

CAMELOS_SLUG = "corrida-de-camelos"

CAMELS = ["azul", "verde", "laranja", "amarelo", "branco"]
CAMEL_LABELS = {
    "azul": "Azul",
    "verde": "Verde",
    "laranja": "Laranja",
    "amarelo": "Amarelo",
    "branco": "Branco",
}

TRACK_LENGTH = 16
STARTING_COINS = 3
LEG_BET_VALUES = [5, 3, 2]
FINAL_BET_PAYOUT = [8, 5, 3, 2, 1]
WRONG_FINAL_BET = -1
ROLL_COIN = 1


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _ranking(state):
    """Camelos do primeiro ao ultimo: casa mais a frente, e no topo da pilha."""
    ordered = []
    for space in sorted(state["stacks"].keys(), key=int, reverse=True):
        stack = state["stacks"][space]
        ordered.extend(reversed(stack))  # topo primeiro
    return ordered


def _place(state, camel, space, on_top=True):
    """Coloca o camelo numa casa, no topo ou por baixo da pilha que ja esta la."""
    stacks = state["stacks"]
    key = str(space)
    stacks.setdefault(key, [])
    if on_top:
        stacks[key].append(camel)
    else:
        stacks[key].insert(0, camel)
    state["positions"][camel] = space


def _remove_stack_from(state, camel):
    """Tira o camelo e todos os que estao em cima dele; devolve a fatia."""
    space = state["positions"][camel]
    key = str(space)
    stack = state["stacks"].get(key, [])
    index = stack.index(camel)
    moving = stack[index:]
    state["stacks"][key] = stack[:index]
    if not state["stacks"][key]:
        del state["stacks"][key]
    return moving


def initialize(players, rng=None):
    rng = _rng(rng)
    if len(players) < 2:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)

    state = {
        "game": CAMELOS_SLUG,
        "phase": "leg",
        "order": order,
        "turn_index": 0,
        "leg": 1,
        "positions": {},
        "stacks": {},
        "dice_left": list(CAMELS),
        "leg_bets": {camel: list(LEG_BET_VALUES) for camel in CAMELS},
        "tiles": {},
        "coins": {str(pid): STARTING_COINS for pid in order},
        "final_winner_bets": [],
        "final_loser_bets": [],
        "winner_ids": [],
        "last_roll": None,
        "log": [],
    }

    # Largada: cada camelo rola o proprio dado e entra na pista; quem cai na
    # mesma casa empilha na ordem em que chegou.
    for camel in rng.sample(CAMELS, len(CAMELS)):
        _place(state, camel, rng.randint(1, 3), on_top=True)

    for player in players:
        player_state = player.state or {}
        player_state.update(
            {
                "coins": STARTING_COINS,
                "leg_bets": [],
                "tile_placed": False,
                "final_bets": {},
            }
        )
        player.state = player_state
        player.save(update_fields=["state"])

    return state


def current_player_id(state):
    order = state.get("order") or []
    if not order:
        return None
    return order[state.get("turn_index", 0) % len(order)]


def _advance_turn(state):
    order = state.get("order") or []
    state["turn_index"] = (state.get("turn_index", 0) + 1) % max(1, len(order))


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _check_turn(state, player):
    if state.get("phase") != "leg":
        return "A corrida acabou."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    return None


def _give_coins(state, player, amount):
    player_state = player.state or {}
    player_state["coins"] = max(0, player_state.get("coins", 0) + amount)
    player.state = player_state
    player.save(update_fields=["state"])
    state["coins"][str(player.id)] = player_state["coins"]


def roll(state, player, players, rng=None):
    """Rola um dado da piramide: ganha 1 moeda e um camelo aleatorio anda."""
    rng = _rng(rng)
    error = _check_turn(state, player)
    if error:
        return error

    dice_left = state.get("dice_left") or []
    if not dice_left:
        return "Todos os dados desta etapa já foram rolados."

    camel = rng.choice(dice_left)
    dice_left.remove(camel)
    steps = rng.randint(1, 3)
    state["dice_left"] = dice_left

    moving = _remove_stack_from(state, camel)
    target = state["positions"][camel] + steps
    tile = state.get("tiles", {}).get(str(target))
    tile_owner = None
    on_top = True
    if tile:
        tile_owner = tile["owner_id"]
        if tile["kind"] == "oasis":
            target += 1
        else:
            target -= 1
            on_top = False  # miragem: a pilha entra POR BAIXO de quem ja esta la
    target = max(1, target)

    if on_top:
        for mover in moving:
            _place(state, mover, target, on_top=True)
    else:
        # Por baixo, preservando a ordem interna da pilha que se moveu.
        for mover in reversed(moving):
            _place(state, mover, target, on_top=False)

    _give_coins(state, player, ROLL_COIN)
    if tile_owner is not None:
        owner = next((p for p in players if p.id == tile_owner), None)
        if owner:
            _give_coins(state, owner, 1)

    state["last_roll"] = {"camel": camel, "steps": steps, "tile": tile["kind"] if tile else None}
    _log(state, {"type": "roll", "player_id": player.id, "camel": camel, "steps": steps, "landed": target})

    if target > TRACK_LENGTH:
        return _finish_race(state, players)
    if not state["dice_left"]:
        _end_leg(state, players)
        return None
    _advance_turn(state)
    return None


def bet_leg(state, player, camel):
    """Aposta na etapa: leva a ficha mais valiosa que sobrou daquele camelo."""
    error = _check_turn(state, player)
    if error:
        return error
    if camel not in CAMELS:
        return "Camelo inválido."
    remaining = state["leg_bets"].get(camel) or []
    if not remaining:
        return "Não sobrou ficha desse camelo nesta etapa."
    value = remaining.pop(0)
    state["leg_bets"][camel] = remaining

    player_state = player.state or {}
    bets = list(player_state.get("leg_bets") or [])
    bets.append({"camel": camel, "value": value})
    player_state["leg_bets"] = bets
    player.state = player_state
    player.save(update_fields=["state"])

    _log(state, {"type": "leg_bet", "player_id": player.id, "camel": camel, "value": value})
    _advance_turn(state)
    return None


def place_tile(state, player, space, kind):
    """Oasis (+1) ou miragem (-1 e vai para baixo). Uma por jogador por etapa."""
    error = _check_turn(state, player)
    if error:
        return error
    if kind not in {"oasis", "miragem"}:
        return "Tipo de armadilha inválido."
    if (player.state or {}).get("tile_placed"):
        return "Você já colocou sua armadilha nesta etapa."
    if not 2 <= space <= TRACK_LENGTH:
        return "Casa inválida."
    if str(space) in state.get("stacks", {}):
        return "Tem camelo nessa casa."
    tiles = state.get("tiles", {})
    if str(space) in tiles or str(space - 1) in tiles or str(space + 1) in tiles:
        return "Não pode encostar em outra armadilha."

    tiles[str(space)] = {"kind": kind, "owner_id": player.id}
    state["tiles"] = tiles
    player_state = player.state or {}
    player_state["tile_placed"] = True
    player.state = player_state
    player.save(update_fields=["state"])

    _log(state, {"type": "tile", "player_id": player.id, "space": space, "kind": kind})
    _advance_turn(state)
    return None


def bet_final(state, player, camel, kind):
    """Aposta secreta no vencedor ou no ultimo da corrida. Uma carta por camelo."""
    error = _check_turn(state, player)
    if error:
        return error
    if camel not in CAMELS or kind not in {"winner", "loser"}:
        return "Aposta inválida."
    player_state = player.state or {}
    final_bets = player_state.get("final_bets") or {}
    if camel in final_bets:
        return "Você já usou a carta desse camelo."
    final_bets[camel] = kind
    player_state["final_bets"] = final_bets
    player.state = player_state
    player.save(update_fields=["state"])

    key = "final_winner_bets" if kind == "winner" else "final_loser_bets"
    state.setdefault(key, []).append({"player_id": player.id, "camel": camel})
    _log(state, {"type": "final_bet", "player_id": player.id, "kind": kind})
    _advance_turn(state)
    return None


def _end_leg(state, players):
    """Paga as apostas da etapa e reseta dados, fichas e armadilhas."""
    ranking = _ranking(state)
    first, second = ranking[0], ranking[1]
    payouts = []
    for player in players:
        player_state = player.state or {}
        delta = 0
        for bet in player_state.get("leg_bets") or []:
            if bet["camel"] == first:
                delta += bet["value"]
            elif bet["camel"] == second:
                delta += 1
            else:
                delta -= 1
        if delta:
            _give_coins(state, player, delta)
        payouts.append({"player_id": player.id, "delta": delta})
        player_state = player.state or {}
        player_state["leg_bets"] = []
        player_state["tile_placed"] = False
        player.state = player_state
        player.save(update_fields=["state"])

    state["last_leg"] = {"leg": state.get("leg"), "first": first, "second": second, "payouts": payouts}
    state["leg"] = state.get("leg", 1) + 1
    state["dice_left"] = list(CAMELS)
    state["leg_bets"] = {camel: list(LEG_BET_VALUES) for camel in CAMELS}
    state["tiles"] = {}
    _log(state, {"type": "leg_end", "first": first, "second": second})
    _advance_turn(state)


def _finish_race(state, players):
    """Alguem cruzou a linha: paga a etapa e as apostas finais."""
    _end_leg(state, players)
    ranking = _ranking(state)
    winner_camel, loser_camel = ranking[0], ranking[-1]

    for key, camel in (("final_winner_bets", winner_camel), ("final_loser_bets", loser_camel)):
        paid = 0
        for bet in state.get(key) or []:
            player = next((p for p in players if p.id == bet["player_id"]), None)
            if not player:
                continue
            if bet["camel"] == camel:
                amount = FINAL_BET_PAYOUT[paid] if paid < len(FINAL_BET_PAYOUT) else 1
                paid += 1
            else:
                amount = WRONG_FINAL_BET
            _give_coins(state, player, amount)

    coins = state["coins"]
    best = max(coins.values()) if coins else 0
    state["winner_ids"] = [int(pid) for pid, c in coins.items() if c == best]
    state["phase"] = "ended"
    state["result"] = {"winner_camel": winner_camel, "loser_camel": loser_camel, "ranking": ranking}
    _log(state, {"type": "finish", "winner_camel": winner_camel})
    return None


def redact_state(state):
    """As apostas finais sao secretas ate a linha de chegada."""
    safe = dict(state)
    safe["ranking"] = _ranking(state)
    safe["camel_labels"] = CAMEL_LABELS
    safe["track_length"] = TRACK_LENGTH
    if safe.get("phase") != "ended":
        safe["final_bets_count"] = len(state.get("final_winner_bets") or []) + len(
            state.get("final_loser_bets") or []
        )
        safe.pop("final_winner_bets", None)
        safe.pop("final_loser_bets", None)
    return safe
