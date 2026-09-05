"""
Muralhas — adaptação de Quoridor.

Um tabuleiro 9×9. Cada um começa numa borda e precisa chegar à borda
oposta. Na sua vez, ou anda uma casa com o peão, ou coloca uma muralha de
duas casas para atrapalhar os outros. Muralhas não podem se cruzar e nunca
podem fechar completamente o caminho de alguém — sempre tem que sobrar
uma rota, por mais longa que seja.

A TV é o tabuleiro. O celular escolhe a casa ou a muralha.
"""

import secrets
from collections import deque

MURALHAS_SLUG = "muralhas"

SIZE = 9
WALLS_BY_PLAYERS = {2: 10, 3: 7, 4: 5}
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]

# (posicao inicial, (eixo, valor da meta)) — sul, norte, oeste, leste.
SEATS = [
    ((SIZE - 1, SIZE // 2), ("row", 0)),
    ((0, SIZE // 2), ("row", SIZE - 1)),
    ((SIZE // 2, 0), ("col", SIZE - 1)),
    ((SIZE // 2, SIZE - 1), ("col", 0)),
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def initialize(players, rng=None):
    rng = _rng(rng)
    count = len(players)
    if count < 2 or count > 4:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)

    state = {
        "game": MURALHAS_SLUG,
        "phase": "playing",
        "order": order,
        "turn_index": 0,
        "pawns": {},
        "goals": {},
        "seats": {},
        "walls_left": {},
        "walls": [],
        "legal_moves": [],
        "legal_walls": [],
        "winner_id": None,
        "last_move": None,
        "move_count": 0,
        "log": [],
    }
    for seat, pid in enumerate(order):
        (row, col), (axis, value) = SEATS[seat]
        state["pawns"][str(pid)] = [row, col]
        state["goals"][str(pid)] = {"axis": axis, "value": value}
        state["seats"][str(pid)] = seat
        state["walls_left"][str(pid)] = WALLS_BY_PLAYERS[count]

    for player in players:
        player_state = player.state or {}
        player_state["seat"] = state["seats"][str(player.id)]
        player.state = player_state
        player.save(update_fields=["state"])

    _refresh_legal(state)
    return state


def current_player_id(state):
    order = state.get("order") or []
    if not order:
        return None
    return order[state.get("turn_index", 0) % len(order)]


def _wall_set(state):
    return {(w["r"], w["c"], w["o"]) for w in state.get("walls") or []}


def _inside(row, col):
    return 0 <= row < SIZE and 0 <= col < SIZE


def _blocked(walls, row, col, d_row, d_col):
    """Ha muralha entre (row, col) e a casa vizinha naquela direcao?"""
    if d_row == -1:
        return (row - 1, col, "h") in walls or (row - 1, col - 1, "h") in walls
    if d_row == 1:
        return (row, col, "h") in walls or (row, col - 1, "h") in walls
    if d_col == -1:
        return (row, col - 1, "v") in walls or (row - 1, col - 1, "v") in walls
    if d_col == 1:
        return (row, col, "v") in walls or (row - 1, col, "v") in walls
    return True


def legal_moves(state, player_id):
    walls = _wall_set(state)
    pawns = state.get("pawns") or {}
    row, col = pawns[str(player_id)]
    occupied = {tuple(pos) for pid, pos in pawns.items() if pid != str(player_id)}
    moves = set()
    for d_row, d_col in DIRS:
        n_row, n_col = row + d_row, col + d_col
        if not _inside(n_row, n_col) or _blocked(walls, row, col, d_row, d_col):
            continue
        if (n_row, n_col) not in occupied:
            moves.add((n_row, n_col))
            continue
        # Peao na frente: pula reto se der; senao, para as diagonais.
        j_row, j_col = n_row + d_row, n_col + d_col
        if _inside(j_row, j_col) and not _blocked(walls, n_row, n_col, d_row, d_col) and (j_row, j_col) not in occupied:
            moves.add((j_row, j_col))
            continue
        for p_row, p_col in ((d_col, d_row), (-d_col, -d_row)):
            x_row, x_col = n_row + p_row, n_col + p_col
            if _inside(x_row, x_col) and not _blocked(walls, n_row, n_col, p_row, p_col) and (x_row, x_col) not in occupied:
                moves.add((x_row, x_col))
    return [list(move) for move in sorted(moves)]


def _reaches_goal(walls, start, goal):
    """BFS ignorando peoes: a regra so exige que exista um caminho."""
    axis, value = goal["axis"], goal["value"]
    seen = {tuple(start)}
    queue = deque([tuple(start)])
    while queue:
        row, col = queue.popleft()
        if (row if axis == "row" else col) == value:
            return True
        for d_row, d_col in DIRS:
            n_row, n_col = row + d_row, col + d_col
            if not _inside(n_row, n_col) or (n_row, n_col) in seen:
                continue
            if _blocked(walls, row, col, d_row, d_col):
                continue
            seen.add((n_row, n_col))
            queue.append((n_row, n_col))
    return False


def _wall_conflicts(walls, row, col, orientation):
    if not (0 <= row < SIZE - 1 and 0 <= col < SIZE - 1):
        return True
    if (row, col, "h") in walls or (row, col, "v") in walls:
        return True  # mesma intersecao: cruzaria ou sobreporia
    if orientation == "h":
        return (row, col - 1, "h") in walls or (row, col + 1, "h") in walls
    return (row - 1, col, "v") in walls or (row + 1, col, "v") in walls


def wall_is_legal(state, player_id, row, col, orientation):
    if orientation not in ("h", "v"):
        return False
    if (state.get("walls_left") or {}).get(str(player_id), 0) <= 0:
        return False
    walls = _wall_set(state)
    if _wall_conflicts(walls, row, col, orientation):
        return False
    walls.add((row, col, orientation))
    for pid, pos in (state.get("pawns") or {}).items():
        if not _reaches_goal(walls, pos, state["goals"][pid]):
            return False
    return True


def legal_walls(state, player_id):
    if (state.get("walls_left") or {}).get(str(player_id), 0) <= 0:
        return []
    return [
        [row, col, orientation]
        for row in range(SIZE - 1)
        for col in range(SIZE - 1)
        for orientation in ("h", "v")
        if wall_is_legal(state, player_id, row, col, orientation)
    ]


def _refresh_legal(state):
    """Calculado uma vez por jogada, nao a cada poll: 128 muralhas x BFS."""
    pid = current_player_id(state)
    if pid is None or state.get("phase") != "playing":
        state["legal_moves"] = []
        state["legal_walls"] = []
        return
    state["legal_moves"] = legal_moves(state, pid)
    state["legal_walls"] = legal_walls(state, pid)


def _next_turn(state):
    order = state.get("order") or []
    state["turn_index"] = (state.get("turn_index", 0) + 1) % max(1, len(order))
    _refresh_legal(state)


def _check_turn(state, player):
    if state.get("phase") != "playing":
        return "A partida acabou."
    if current_player_id(state) != player.id:
        return "Não é a sua vez."
    return None


def move(state, player, row, col):
    error = _check_turn(state, player)
    if error:
        return error
    if [row, col] not in (state.get("legal_moves") or []):
        return "Movimento inválido."
    state["pawns"][str(player.id)] = [row, col]
    state["last_move"] = {"type": "move", "player_id": player.id, "to": [row, col]}
    state["move_count"] = state.get("move_count", 0) + 1
    _log(state, {"type": "move", "player_id": player.id, "to": [row, col]})

    goal = state["goals"][str(player.id)]
    if (row if goal["axis"] == "row" else col) == goal["value"]:
        state["phase"] = "ended"
        state["winner_id"] = player.id
        state["legal_moves"] = []
        state["legal_walls"] = []
        return None
    _next_turn(state)
    return None


def place_wall(state, player, row, col, orientation):
    error = _check_turn(state, player)
    if error:
        return error
    if [row, col, orientation] not in (state.get("legal_walls") or []):
        return "Muralha inválida: não pode cruzar outra nem fechar o caminho de alguém."
    state.setdefault("walls", []).append({"r": row, "c": col, "o": orientation, "owner_id": player.id})
    state["walls_left"][str(player.id)] -= 1
    state["last_move"] = {"type": "wall", "player_id": player.id, "wall": [row, col, orientation]}
    state["move_count"] = state.get("move_count", 0) + 1
    _log(state, {"type": "wall", "player_id": player.id, "wall": [row, col, orientation]})
    _next_turn(state)
    return None


def redact_state(state):
    """Nada e secreto: tudo esta no tabuleiro."""
    safe = dict(state)
    safe["current_player_id"] = current_player_id(state)
    safe["size"] = SIZE
    return safe
