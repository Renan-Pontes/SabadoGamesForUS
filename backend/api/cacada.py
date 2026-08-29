"""
A Caçada — jogo de dedução sobre um mapa de hexágonos.

Cada jogador recebe uma pista verdadeira sobre onde a criatura se esconde.
O esconderijo é o único hexágono do mapa que satisfaz TODAS as pistas ao
mesmo tempo — ninguém consegue achá-lo sozinho.

Este módulo é auto-contido: geração de mapa, geração de pistas com solução
garantidamente única, e as ações de turno. As views só validam permissão e
chamam as funções daqui.
"""

import secrets

CACADA_SLUG = "a-cacada"

TERRAINS = ["deserto", "floresta", "pantano", "montanha", "agua"]
ANIMALS = ["urso", "puma"]
STRUCTURE_KINDS = ["pedra", "cabana"]
STRUCTURE_COLORS = ["verde", "branca", "azul"]

# Nomes com acento ficam só no texto da pista; as chaves internas são cruas.
TERRAIN_LABELS = {
    "deserto": "deserto",
    "floresta": "floresta",
    "pantano": "pântano",
    "montanha": "montanha",
    "agua": "água",
}
ANIMAL_LABELS = {"urso": "urso", "puma": "puma"}
STRUCTURE_KIND_LABELS = {"pedra": "pedra erguida", "cabana": "cabana abandonada"}
STRUCTURE_KIND_PLURAL = {"pedra": "uma pedra erguida", "cabana": "uma cabana abandonada"}
STRUCTURE_COLOR_LABELS = {"verde": "verde", "branca": "branca", "azul": "azul"}

# O mapa cresce com a mesa: mais jogadores significam mais pistas, e mais
# pistas precisam de mais espaço para que a interseção ainda feche em um hex.
MAP_SIZES = {3: (9, 6), 4: (10, 7), 5: (11, 8), 6: (12, 9)}
DEFAULT_MAP_SIZE = (10, 7)

ANIMAL_TERRITORY_MIN = 4
ANIMAL_TERRITORY_MAX = 6
STRUCTURE_MIN_GAP = 2

MAX_MAP_ATTEMPTS = 40
MAX_PUZZLE_ATTEMPTS = 400
LOG_LIMIT = 40


# ---------------------------------------------------------------------------
# Geometria hexagonal (offset "odd-r": linhas ímpares deslocadas para a direita)
# ---------------------------------------------------------------------------

CUBE_DIRECTIONS = [(1, -1, 0), (1, 0, -1), (0, 1, -1), (-1, 1, 0), (-1, 0, 1), (0, -1, 1)]


def hex_key(col, row):
    return f"{col},{row}"


def parse_key(key):
    col, row = key.split(",")
    return int(col), int(row)


def offset_to_cube(col, row):
    x = col - (row - (row & 1)) // 2
    z = row
    return x, -x - z, z


def cube_to_offset(x, _y, z):
    return x + (z - (z & 1)) // 2, z


def hex_distance(key_a, key_b):
    ax, ay, az = offset_to_cube(*parse_key(key_a))
    bx, by, bz = offset_to_cube(*parse_key(key_b))
    return max(abs(ax - bx), abs(ay - by), abs(az - bz))


def neighbors(key, cols, rows):
    x, y, z = offset_to_cube(*parse_key(key))
    result = []
    for dx, dy, dz in CUBE_DIRECTIONS:
        col, row = cube_to_offset(x + dx, y + dy, z + dz)
        if 0 <= col < cols and 0 <= row < rows:
            result.append(hex_key(col, row))
    return result


def all_keys(cols, rows):
    return [hex_key(col, row) for row in range(rows) for col in range(cols)]


# ---------------------------------------------------------------------------
# Geração do mapa
# ---------------------------------------------------------------------------


def _grow_terrain(keys, cols, rows, rng):
    """
    Cresce os terrenos a partir de sementes, em BFS de fronteira aleatória.

    O resultado são manchas contíguas em vez de ruído — sem isso, pistas do
    tipo "a até 1 espaço de floresta" cobririam o mapa inteiro e não
    informariam nada.
    """
    terrain = {}
    frontier = []

    for name in TERRAINS:
        for _ in range(2):
            seed = rng.choice(keys)
            if seed in terrain:
                continue
            terrain[seed] = name
            frontier.append((seed, name))

    while frontier:
        index = rng.randrange(len(frontier))
        key, name = frontier.pop(index)
        for neighbor in neighbors(key, cols, rows):
            if neighbor in terrain:
                continue
            terrain[neighbor] = name
            frontier.append((neighbor, name))

    # Sementes coincidentes podem deixar buracos; preenche pelo vizinho.
    for key in keys:
        if key not in terrain:
            options = [terrain[n] for n in neighbors(key, cols, rows) if n in terrain]
            terrain[key] = rng.choice(options) if options else rng.choice(TERRAINS)

    return terrain


def _grow_territory(keys, cols, rows, taken, size, rng):
    """Mancha contígua para um território animal, evitando hexes já usados."""
    available = [key for key in keys if key not in taken]
    if not available:
        return set()

    start = rng.choice(available)
    blob = {start}
    frontier = [start]

    while len(blob) < size and frontier:
        index = rng.randrange(len(frontier))
        current = frontier[index]
        options = [
            n for n in neighbors(current, cols, rows) if n not in blob and n not in taken
        ]
        if not options:
            frontier.pop(index)
            continue
        chosen = rng.choice(options)
        blob.add(chosen)
        frontier.append(chosen)

    return blob


def _place_structures(keys, taken_by_structure, rng):
    """Uma estrutura de cada combinação tipo × cor, espalhadas pelo mapa."""
    placements = {}
    for kind in STRUCTURE_KINDS:
        for color in STRUCTURE_COLORS:
            candidates = [
                key
                for key in keys
                if key not in placements
                and all(hex_distance(key, other) >= STRUCTURE_MIN_GAP for other in placements)
            ]
            if not candidates:
                # Mapa apertado: aceita qualquer hex livre em vez de falhar.
                candidates = [key for key in keys if key not in placements]
            if not candidates:
                return None
            placements[rng.choice(candidates)] = {"kind": kind, "color": color}
    return placements


def build_map(player_count, rng):
    cols, rows = MAP_SIZES.get(player_count, DEFAULT_MAP_SIZE)
    keys = all_keys(cols, rows)

    terrain = _grow_terrain(keys, cols, rows, rng)

    territories = {}
    taken = set()
    for animal in ANIMALS:
        size = rng.randint(ANIMAL_TERRITORY_MIN, ANIMAL_TERRITORY_MAX)
        blob = _grow_territory(keys, cols, rows, taken, size, rng)
        for key in blob:
            territories[key] = animal
        taken |= blob

    structures = _place_structures(keys, taken, rng)
    if structures is None:
        return None

    hexes = {}
    for key in keys:
        hexes[key] = {
            "terrain": terrain[key],
            "animal": territories.get(key),
            "structure": structures.get(key),
        }

    return {"cols": cols, "rows": rows, "hexes": hexes}


# ---------------------------------------------------------------------------
# Pistas
# ---------------------------------------------------------------------------


def _within(board, keys, predicate, distance):
    """Hexes a até `distance` de qualquer hex que satisfaça `predicate`."""
    sources = [key for key in keys if predicate(board["hexes"][key])]
    if not sources:
        return set()
    if distance == 0:
        return set(sources)
    return {key for key in keys if any(hex_distance(key, src) <= distance for src in sources)}


def clue_text(clue):
    """Frase da pista, do jeito que o jogador lê no celular."""
    kind = clue["kind"]
    negated = clue.get("negated", False)
    prefix = "A criatura NÃO está" if negated else "A criatura está"

    if kind == "terrain_pair":
        a = TERRAIN_LABELS[clue["a"]]
        b = TERRAIN_LABELS[clue["b"]]
        return f"{prefix} em {a} ou {b}."
    if kind == "within_terrain":
        terrain = TERRAIN_LABELS[clue["terrain"]]
        return f"{prefix} a até {clue['range']} espaço de {terrain}."
    if kind == "within_any_animal":
        return f"{prefix} a até {clue['range']} espaço de um território animal."
    if kind == "within_animal":
        animal = ANIMAL_LABELS[clue["animal"]]
        return f"{prefix} a até {clue['range']} espaços do território do {animal}."
    if kind == "within_structure_kind":
        label = STRUCTURE_KIND_PLURAL[clue["structure_kind"]]
        return f"{prefix} a até {clue['range']} espaços de {label}."
    if kind == "within_structure_color":
        color = STRUCTURE_COLOR_LABELS[clue["color"]]
        return f"{prefix} a até {clue['range']} espaços de uma estrutura {color}."
    return f"{prefix} em algum lugar."


def build_clue_pool(board, allow_negative):
    """
    Todas as pistas possíveis para este mapa, já com o conjunto de hexes que
    cada uma permite. Pistas que não separam nada (cobrem tudo ou nada) são
    descartadas: elas não ensinariam nada a ninguém.
    """
    keys = list(board["hexes"].keys())
    total = len(keys)
    pool = []

    def add(clue, allowed):
        if 0 < len(allowed) < total:
            pool.append({"clue": clue, "hexes": frozenset(allowed)})

    # "está em A ou B"
    for i, first in enumerate(TERRAINS):
        for second in TERRAINS[i + 1 :]:
            allowed = {
                key for key in keys if board["hexes"][key]["terrain"] in (first, second)
            }
            add({"kind": "terrain_pair", "a": first, "b": second}, allowed)

    # "a até 1 espaço de <terreno>" — o próprio terreno conta como distância 0
    for terrain in TERRAINS:
        allowed = _within(board, keys, lambda h, t=terrain: h["terrain"] == t, 1)
        add({"kind": "within_terrain", "terrain": terrain, "range": 1}, allowed)

    # "a até 1 espaço de um território animal"
    allowed = _within(board, keys, lambda h: h["animal"] is not None, 1)
    add({"kind": "within_any_animal", "range": 1}, allowed)

    # "a até 2 espaços do território do <animal>"
    for animal in ANIMALS:
        allowed = _within(board, keys, lambda h, a=animal: h["animal"] == a, 2)
        add({"kind": "within_animal", "animal": animal, "range": 2}, allowed)

    # "a até 2 espaços de <tipo de estrutura>"
    for kind in STRUCTURE_KINDS:
        allowed = _within(
            board,
            keys,
            lambda h, k=kind: h["structure"] is not None and h["structure"]["kind"] == k,
            2,
        )
        add({"kind": "within_structure_kind", "structure_kind": kind, "range": 2}, allowed)

    # "a até 3 espaços de uma estrutura <cor>"
    for color in STRUCTURE_COLORS:
        allowed = _within(
            board,
            keys,
            lambda h, c=color: h["structure"] is not None and h["structure"]["color"] == c,
            3,
        )
        add({"kind": "within_structure_color", "color": color, "range": 3}, allowed)

    if allow_negative:
        every = set(keys)
        for entry in list(pool):
            negated = dict(entry["clue"])
            negated["negated"] = True
            add(negated, every - entry["hexes"])

    for entry in pool:
        entry["clue"]["text"] = clue_text(entry["clue"])

    return pool


def _every_clue_matters(chosen, solution):
    """
    Nenhuma pista pode ser dispensável: se dá para achar a criatura sem a
    pista de alguém, aquele jogador não tem o que fazer na mesa.
    """
    for index in range(len(chosen)):
        others = [entry for position, entry in enumerate(chosen) if position != index]
        intersection = set(others[0]["hexes"]) if others else set()
        for entry in others[1:]:
            intersection &= entry["hexes"]
        if len(intersection) <= 1:
            return False
    return True


def pick_puzzle(board, player_count, allow_negative, rng):
    """
    Sorteia o esconderijo e escolhe `player_count` pistas cuja interseção é
    exatamente esse hexágono.

    A estratégia é montar n−1 pistas que apertem o cerco e então procurar
    uma última pista que feche a interseção em um único hex. Buscar a pista
    de fechamento de propósito converge muito mais rápido do que sortear n
    pistas e torcer.
    """
    pool = build_clue_pool(board, allow_negative)
    if len(pool) < player_count:
        return None

    keys = list(board["hexes"].keys())

    for _ in range(MAX_PUZZLE_ATTEMPTS):
        solution = rng.choice(keys)
        candidates = [entry for entry in pool if solution in entry["hexes"]]
        if len(candidates) < player_count:
            continue

        rng.shuffle(candidates)
        chosen = []
        intersection = set(keys)
        for entry in candidates:
            if len(chosen) == player_count - 1:
                break
            reduced = intersection & entry["hexes"]
            if len(reduced) < len(intersection):
                chosen.append(entry)
                intersection = reduced

        if len(chosen) != player_count - 1:
            continue
        if len(intersection) == 1:
            # As n−1 primeiras já resolvem: a última pista sobraria.
            continue

        closers = [
            entry
            for entry in candidates
            if entry not in chosen and (intersection & entry["hexes"]) == {solution}
        ]
        if not closers:
            continue

        chosen.append(rng.choice(closers))
        if _every_clue_matters(chosen, solution):
            return solution, [entry["clue"] for entry in chosen]

    return None


# ---------------------------------------------------------------------------
# Ciclo de vida da partida
# ---------------------------------------------------------------------------


def clue_allows(board, clue, key):
    """A pista permite este hexágono? É a resposta mecânica de sim/não."""
    hexes = board["hexes"]
    cell = hexes[key]
    kind = clue["kind"]

    if kind == "terrain_pair":
        result = cell["terrain"] in (clue["a"], clue["b"])
    elif kind == "within_terrain":
        result = any(
            hex_distance(key, other) <= clue["range"]
            for other, data in hexes.items()
            if data["terrain"] == clue["terrain"]
        )
    elif kind == "within_any_animal":
        result = any(
            hex_distance(key, other) <= clue["range"]
            for other, data in hexes.items()
            if data["animal"] is not None
        )
    elif kind == "within_animal":
        result = any(
            hex_distance(key, other) <= clue["range"]
            for other, data in hexes.items()
            if data["animal"] == clue["animal"]
        )
    elif kind == "within_structure_kind":
        result = any(
            hex_distance(key, other) <= clue["range"]
            for other, data in hexes.items()
            if data["structure"] and data["structure"]["kind"] == clue["structure_kind"]
        )
    elif kind == "within_structure_color":
        result = any(
            hex_distance(key, other) <= clue["range"]
            for other, data in hexes.items()
            if data["structure"] and data["structure"]["color"] == clue["color"]
        )
    else:
        result = True

    return (not result) if clue.get("negated") else result


def initialize(players, advanced, rng=None):
    """
    Monta uma partida nova. Devolve (state, {player_id: clue}) ou None se não
    foi possível gerar um tabuleiro com solução única.
    """
    rng = rng or secrets.SystemRandom()
    player_count = len(players)
    if player_count < 3:
        return None

    for _ in range(MAX_MAP_ATTEMPTS):
        board = build_map(player_count, rng)
        if board is None:
            continue
        puzzle = pick_puzzle(board, player_count, advanced, rng)
        if puzzle is None:
            continue

        solution, clues = puzzle
        order = [player.id for player in players]
        rng.shuffle(order)
        assignments = {player_id: clue for player_id, clue in zip(order, clues)}

        state = {
            "game": CACADA_SLUG,
            "phase": "setup",
            "advanced": advanced,
            "map": board,
            "solution": solution,
            "order": order,
            "turn_index": 0,
            "markers": {},
            "pending_penalty_player_id": None,
            "winner_id": None,
            "log": [],
            "round": 1,
        }
        return state, assignments

    return None


def _append_log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-LOG_LIMIT:]


def marker_at(state, key, player_id):
    return (state.get("markers") or {}).get(key, {}).get(str(player_id))


def _place_marker(state, key, player_id, kind):
    markers = state.setdefault("markers", {})
    markers.setdefault(key, {})[str(player_id)] = kind


def current_player_id(state):
    order = state.get("order") or []
    if not order:
        return None
    return order[state.get("turn_index", 0) % len(order)]


def _advance_turn(state):
    order = state.get("order") or []
    if not order:
        return
    state["turn_index"] = (state.get("turn_index", 0) + 1) % len(order)
    state["round"] = state.get("round", 1) + 1


def place_setup_cube(state, player_id, clue, key):
    """Cubo de abertura: cada jogador entrega um hex que sua pista elimina."""
    if state.get("phase") != "setup":
        return "A abertura já terminou."
    if current_player_id(state) != player_id:
        return "Não é a sua vez."
    if key not in state["map"]["hexes"]:
        return "Hexágono inválido."
    if clue_allows(state["map"], clue, key):
        return "Sua pista permite esse hexágono — escolha um que ela elimine."

    _place_marker(state, key, player_id, "cube")
    _append_log(state, {"type": "setup", "player_id": player_id, "hex": key})

    order = state.get("order") or []
    next_index = state.get("turn_index", 0) + 1
    if next_index >= len(order):
        state["phase"] = "playing"
        state["turn_index"] = 0
        state["round"] = 1
    else:
        state["turn_index"] = next_index
    return None


def ask(state, asker_id, target_id, target_clue, key):
    """Pergunta a um jogador específico se a criatura pode estar num hex."""
    if state.get("phase") != "playing":
        return "A partida não está em andamento."
    if state.get("pending_penalty_player_id") is not None:
        return "Resolva a penalidade antes de agir."
    if current_player_id(state) != asker_id:
        return "Não é a sua vez."
    if target_id == asker_id:
        return "Pergunte a outro jogador."
    if key not in state["map"]["hexes"]:
        return "Hexágono inválido."
    if marker_at(state, key, target_id) is not None:
        return "Esse jogador já respondeu sobre esse hexágono."

    allowed = clue_allows(state["map"], target_clue, key)
    answer = "disc" if allowed else "cube"
    _place_marker(state, key, target_id, answer)
    _append_log(
        state,
        {
            "type": "ask",
            "asker_id": asker_id,
            "target_id": target_id,
            "hex": key,
            "answer": answer,
        },
    )

    if allowed:
        _advance_turn(state)
    else:
        # Levou um "não": agora precisa entregar informação própria.
        state["pending_penalty_player_id"] = asker_id
    return None


def search(state, searcher_id, clues, key):
    """
    Busca: o buscador coloca o próprio disco e os demais respondem em sentido
    horário, parando no primeiro "não". Todos dizendo sim, a criatura é achada.
    """
    if state.get("phase") != "playing":
        return "A partida não está em andamento."
    if state.get("pending_penalty_player_id") is not None:
        return "Resolva a penalidade antes de agir."
    if current_player_id(state) != searcher_id:
        return "Não é a sua vez."
    if key not in state["map"]["hexes"]:
        return "Hexágono inválido."

    board = state["map"]
    if not clue_allows(board, clues[searcher_id], key):
        return "Sua própria pista elimina esse hexágono."

    order = state.get("order") or []
    start = order.index(searcher_id)
    answers = []

    _place_marker(state, key, searcher_id, "disc")
    answers.append({"player_id": searcher_id, "answer": "disc"})

    blocked_by = None
    for step in range(1, len(order)):
        other_id = order[(start + step) % len(order)]
        allowed = clue_allows(board, clues[other_id], key)
        answer = "disc" if allowed else "cube"
        _place_marker(state, key, other_id, answer)
        answers.append({"player_id": other_id, "answer": answer})
        if not allowed:
            blocked_by = other_id
            break

    success = blocked_by is None
    _append_log(
        state,
        {
            "type": "search",
            "searcher_id": searcher_id,
            "hex": key,
            "answers": answers,
            "success": success,
        },
    )

    if success:
        state["phase"] = "ended"
        state["winner_id"] = searcher_id
    else:
        state["pending_penalty_player_id"] = searcher_id
    return None


def place_penalty_cube(state, player_id, clue, key):
    """O preço de levar um "não": revelar um hex que a sua pista elimina."""
    if state.get("pending_penalty_player_id") != player_id:
        return "Você não tem penalidade pendente."
    if key not in state["map"]["hexes"]:
        return "Hexágono inválido."
    if marker_at(state, key, player_id) is not None:
        return "Você já marcou esse hexágono."
    if clue_allows(state["map"], clue, key):
        return "Sua pista permite esse hexágono — escolha um que ela elimine."

    _place_marker(state, key, player_id, "cube")
    _append_log(state, {"type": "penalty", "player_id": player_id, "hex": key})
    state["pending_penalty_player_id"] = None
    _advance_turn(state)
    return None
