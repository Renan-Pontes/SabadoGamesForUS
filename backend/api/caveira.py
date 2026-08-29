"""
Caveira — adaptação de Skull.

Cada jogador tem 3 rosas e 1 caveira. Empilha cartas viradas para baixo, e em
algum momento alguém aposta quantas consegue virar sem achar uma caveira. Quem
vence o leilão precisa cumprir — começando pela própria pilha, que é a única
que ele conhece.

Duas apostas cumpridas e você vence. Cada fracasso custa uma carta.
"""

import secrets

CAVEIRA_SLUG = "caveira"

ROSE = "rosa"
SKULL = "caveira"
STARTING_HAND = [ROSE, ROSE, ROSE, SKULL]
WINS_NEEDED = 2


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _active(state):
    return [pid for pid in state["order"] if pid not in state.get("eliminated", [])]


def current_player_id(state):
    active = _active(state)
    if not active:
        return None
    return active[state.get("turn_index", 0) % len(active)]


def _advance_turn(state, step=1):
    active = _active(state)
    if not active:
        return
    state["turn_index"] = (state.get("turn_index", 0) + step) % len(active)


def initialize(players, rng=None):
    rng = _rng(rng)
    order = [player.id for player in players]
    rng.shuffle(order)

    for player in players:
        player_state = player.state or {}
        player_state["hand"] = list(STARTING_HAND)
        player_state["stack"] = []
        player_state["wins"] = 0
        player_state["eliminated"] = False
        player.state = player_state
        player.save(update_fields=["state"])

    return {
        "game": CAVEIRA_SLUG,
        "phase": "placing",
        "order": order,
        "turn_index": 0,
        "round": 1,
        "eliminated": [],
        # Só a contagem das pilhas é pública; o conteúdo é o segredo do jogo.
        "stack_sizes": {str(pid): 0 for pid in order},
        "bids": {},
        "passed": [],
        "highest_bid": 0,
        "highest_bidder_id": None,
        "flip": None,
        "wins": {str(pid): 0 for pid in order},
        "winner_id": None,
        "log": [],
    }


def sync_public(state, players):
    """Espelha no estado da sala o que pode ser visto de fora das mãos."""
    state["stack_sizes"] = {
        str(p.id): len((p.state or {}).get("stack") or []) for p in players
    }
    state["hand_sizes"] = {
        str(p.id): len((p.state or {}).get("hand") or []) + len((p.state or {}).get("stack") or [])
        for p in players
    }
    state["wins"] = {str(p.id): (p.state or {}).get("wins", 0) for p in players}


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def place_card(state, player, card):
    """Empilha uma carta virada para baixo. Ninguém vê o que é."""
    if state.get("phase") != "placing":
        return "As apostas já começaram."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    if card not in (ROSE, SKULL):
        return "Carta inválida."

    player_state = player.state or {}
    hand = list(player_state.get("hand") or [])
    if card not in hand:
        return "Você não tem essa carta na mão."

    hand.remove(card)
    stack = list(player_state.get("stack") or [])
    stack.append(card)
    player_state["hand"] = hand
    player_state["stack"] = stack
    player.state = player_state
    player.save(update_fields=["state"])

    _log(state, {"type": "place", "player_id": player.id})
    _advance_turn(state)
    return None


def total_on_table(state):
    return sum(state.get("stack_sizes", {}).values())


def open_bidding(state, player, amount):
    """Primeiro lance: encerra a fase de empilhar e abre o leilão."""
    if state.get("phase") != "placing":
        return "O leilão já está aberto."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    if not (player.state or {}).get("stack"):
        return "Você precisa ter pelo menos uma carta na mesa para apostar."
    if amount < 1 or amount > total_on_table(state):
        return "Aposte entre 1 e o total de cartas na mesa."

    state["phase"] = "bidding"
    state["bids"] = {str(player.id): amount}
    state["passed"] = []
    state["highest_bid"] = amount
    state["highest_bidder_id"] = player.id
    _log(state, {"type": "bid", "player_id": player.id, "amount": amount})
    _advance_turn(state)
    return _skip_to_next_bidder(state)


def raise_bid(state, player, amount):
    if state.get("phase") != "bidding":
        return "Não há leilão aberto."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    if player.id in state.get("passed", []):
        return "Você já passou nesta rodada."
    if amount <= state.get("highest_bid", 0):
        return "O lance precisa ser maior que o atual."
    if amount > total_on_table(state):
        return "Não há tantas cartas na mesa."

    state.setdefault("bids", {})[str(player.id)] = amount
    state["highest_bid"] = amount
    state["highest_bidder_id"] = player.id
    _log(state, {"type": "bid", "player_id": player.id, "amount": amount})

    if amount == total_on_table(state):
        # Apostou tudo: não há como alguém cobrir, começa a virar.
        return _start_flipping(state)

    _advance_turn(state)
    return _skip_to_next_bidder(state)


def pass_bid(state, player):
    if state.get("phase") != "bidding":
        return "Não há leilão aberto."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."

    passed = list(state.get("passed") or [])
    if player.id not in passed:
        passed.append(player.id)
    state["passed"] = passed
    _log(state, {"type": "pass", "player_id": player.id})

    remaining = [pid for pid in _active(state) if pid not in passed]
    if len(remaining) <= 1:
        return _start_flipping(state)

    _advance_turn(state)
    return _skip_to_next_bidder(state)


def _skip_to_next_bidder(state):
    """Pula quem já passou até achar alguém que ainda pode cobrir."""
    passed = state.get("passed") or []
    active = _active(state)
    for _ in range(len(active)):
        if current_player_id(state) not in passed:
            return None
        _advance_turn(state)
    return _start_flipping(state)


def _start_flipping(state):
    state["phase"] = "flipping"
    state["flip"] = {
        "player_id": state.get("highest_bidder_id"),
        "target": state.get("highest_bid", 0),
        "revealed": [],
        "own_done": False,
    }
    return None


def flip_own(state, player, players):
    """
    A obrigação de começar pela própria pilha é o coração do jogo: você
    entrega o que escondeu antes de tocar no dos outros.
    """
    flip = state.get("flip") or {}
    if state.get("phase") != "flipping":
        return "Não é hora de virar cartas."
    if flip.get("player_id") != player.id:
        return "A aposta não é sua."
    if flip.get("own_done"):
        return "Sua pilha já foi virada."

    stack = list((player.state or {}).get("stack") or [])
    for card in reversed(stack):
        flip["revealed"].append({"player_id": player.id, "card": card})
        if card == SKULL:
            flip["own_done"] = True
            state["flip"] = flip
            return _fail_bid(state, player, players, skull_owner_id=player.id)

    flip["own_done"] = True
    state["flip"] = flip
    if len(flip["revealed"]) >= flip.get("target", 0):
        return _succeed_bid(state, player, players)
    return None


def flip_other(state, player, target_player, players):
    flip = state.get("flip") or {}
    if state.get("phase") != "flipping":
        return "Não é hora de virar cartas."
    if flip.get("player_id") != player.id:
        return "A aposta não é sua."
    if not flip.get("own_done"):
        return "Vire a sua própria pilha primeiro."
    if target_player.id == player.id:
        return "Sua pilha já foi virada."

    target_state = target_player.state or {}
    stack = list(target_state.get("stack") or [])
    already = sum(
        1 for entry in flip["revealed"] if entry["player_id"] == target_player.id
    )
    if already >= len(stack):
        return "Essa pilha já foi virada por completo."

    card = stack[len(stack) - 1 - already]
    flip["revealed"].append({"player_id": target_player.id, "card": card})
    state["flip"] = flip

    if card == SKULL:
        return _fail_bid(state, player, players, skull_owner_id=target_player.id)
    if len(flip["revealed"]) >= flip.get("target", 0):
        return _succeed_bid(state, player, players)
    return None


def _collect_stacks(players):
    """Fim de rodada: todo mundo recolhe a própria pilha de volta para a mão."""
    for player in players:
        player_state = player.state or {}
        hand = list(player_state.get("hand") or [])
        hand.extend(player_state.get("stack") or [])
        player_state["hand"] = hand
        player_state["stack"] = []
        player.state = player_state
        player.save(update_fields=["state"])


def _succeed_bid(state, player, players):
    player_state = player.state or {}
    wins = player_state.get("wins", 0) + 1
    player_state["wins"] = wins
    player.state = player_state
    player.save(update_fields=["state"])

    _log(state, {"type": "success", "player_id": player.id, "wins": wins})
    _collect_stacks(players)
    sync_public(state, players)

    if wins >= WINS_NEEDED:
        state["phase"] = "ended"
        state["winner_id"] = player.id
        state["flip"] = state.get("flip")
        return None

    return _next_round(state, players, start_player_id=player.id)


def _fail_bid(state, player, players, skull_owner_id, rng=None):
    """
    Achou caveira: perde uma carta ao acaso. Perder a caveira é quase pior —
    você fica sem a única arma que tinha.
    """
    rng = _rng(rng)
    player_state = player.state or {}
    pool = list(player_state.get("hand") or []) + list(player_state.get("stack") or [])
    lost = None
    if pool:
        lost = rng.choice(pool)
        pool.remove(lost)

    _log(
        state,
        {
            "type": "fail",
            "player_id": player.id,
            "skull_owner_id": skull_owner_id,
            "lost": lost,
        },
    )

    # A pilha volta para a mão já sem a carta perdida.
    player_state["hand"] = pool
    player_state["stack"] = []
    player.state = player_state
    player.save(update_fields=["state"])

    _collect_stacks([p for p in players if p.id != player.id])

    if not pool:
        player_state["eliminated"] = True
        player.state = player_state
        player.save(update_fields=["state"])
        eliminated = list(state.get("eliminated") or [])
        if player.id not in eliminated:
            eliminated.append(player.id)
        state["eliminated"] = eliminated

    sync_public(state, players)

    remaining = _active(state)
    if len(remaining) <= 1:
        state["phase"] = "ended"
        state["winner_id"] = remaining[0] if remaining else None
        return None

    # Quem falhou começa a próxima rodada, a menos que tenha saído.
    starter = player.id if player.id in remaining else remaining[0]
    return _next_round(state, players, start_player_id=starter)


def _next_round(state, players, start_player_id):
    state["round"] = state.get("round", 1) + 1
    state["phase"] = "placing"
    state["bids"] = {}
    state["passed"] = []
    state["highest_bid"] = 0
    state["highest_bidder_id"] = None
    state["flip"] = None

    active = _active(state)
    state["turn_index"] = active.index(start_player_id) if start_player_id in active else 0
    sync_public(state, players)
    return None


def redact_state(state):
    """Nada no estado da sala é secreto: as cartas vivem na mão de cada um."""
    return dict(state)
