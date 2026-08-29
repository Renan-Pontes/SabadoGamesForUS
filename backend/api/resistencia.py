"""
A Resistência — adaptação de The Resistance.

Espiões infiltrados sabem quem são; a resistência não sabe nada. Cinco missões,
e a cada uma um líder propõe uma equipe que a mesa aprova ou rejeita em voto
aberto. Na missão, só quem foi enviado joga uma carta secreta — e uma sabotagem
basta para derrubar quase todas.
"""

import secrets

RESISTENCIA_SLUG = "resistencia"

MAX_REJECTIONS = 5
MISSIONS_TO_WIN = 3

# Tamanho da equipe por missão, conforme o número de jogadores.
TEAM_SIZES = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
}

SPY_COUNTS = {5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4}

# A quarta missão com 7+ jogadores exige duas sabotagens: é o respiro que
# impede os espiões de ganharem só com um infiltrado bem posicionado.
DOUBLE_FAIL_MISSION = 4
DOUBLE_FAIL_MIN_PLAYERS = 7

ROLE_SPY = "espiao"
ROLE_RESISTANCE = "resistencia"


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def supports(player_count):
    return player_count in TEAM_SIZES


def team_size_for(player_count, mission):
    return TEAM_SIZES[player_count][mission - 1]


def fails_needed(player_count, mission):
    if mission == DOUBLE_FAIL_MISSION and player_count >= DOUBLE_FAIL_MIN_PLAYERS:
        return 2
    return 1


def initialize(players, rng=None):
    rng = _rng(rng)
    count = len(players)
    if not supports(count):
        return None

    order = [player.id for player in players]
    rng.shuffle(order)
    spies = set(rng.sample(order, SPY_COUNTS[count]))

    for player in players:
        player_state = player.state or {}
        player_state["role"] = ROLE_SPY if player.id in spies else ROLE_RESISTANCE
        player_state["mission_card"] = None
        player_state["vote"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    return {
        "game": RESISTENCIA_SLUG,
        "phase": "proposal",
        "order": order,
        "leader_index": 0,
        "mission": 1,
        "team_sizes": TEAM_SIZES[count],
        "proposed_team": [],
        "rejections": 0,
        "results": [],
        "votes": {},
        "last_vote": None,
        "last_mission": None,
        "winner": None,
        "spy_ids": sorted(spies),
        "log": [],
    }


def current_leader_id(state):
    order = state.get("order") or []
    if not order:
        return None
    return order[state.get("leader_index", 0) % len(order)]


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def propose_team(state, player_id, team_ids):
    if state.get("phase") != "proposal":
        return "Não é hora de propor equipe."
    if current_leader_id(state) != player_id:
        return "Só o líder propõe a equipe."

    order = state.get("order") or []
    needed = team_size_for(len(order), state.get("mission", 1))
    unique = list(dict.fromkeys(team_ids))
    if len(unique) != needed:
        return f"A missão {state.get('mission')} leva {needed} pessoas."
    if any(pid not in order for pid in unique):
        return "Jogador inválido na equipe."

    state["proposed_team"] = unique
    state["phase"] = "vote"
    state["votes"] = {}
    _log(state, {"type": "proposal", "leader_id": player_id, "team": unique})
    return None


def cast_vote(state, player_id, approve):
    if state.get("phase") != "vote":
        return "Não há votação aberta."
    if player_id not in (state.get("order") or []):
        return "Você não está nesta partida."
    state.setdefault("votes", {})[str(player_id)] = bool(approve)
    return None


def votes_complete(state):
    order = state.get("order") or []
    votes = state.get("votes") or {}
    return len(votes) >= len(order)


def resolve_vote(state):
    """Conta os votos. Voto é aberto: quem aprovou o quê fica registrado."""
    order = state.get("order") or []
    votes = state.get("votes") or {}
    approvals = sum(1 for value in votes.values() if value)
    approved = approvals * 2 > len(order)

    state["last_vote"] = {
        "team": list(state.get("proposed_team") or []),
        "leader_id": current_leader_id(state),
        "votes": dict(votes),
        "approved": approved,
        "mission": state.get("mission"),
    }
    _log(
        state,
        {
            "type": "vote",
            "approved": approved,
            "approvals": approvals,
            "total": len(order),
            "team": list(state.get("proposed_team") or []),
        },
    )

    if approved:
        state["phase"] = "mission"
        state["rejections"] = 0
        state["votes"] = {}
        return None

    state["rejections"] = state.get("rejections", 0) + 1
    state["votes"] = {}
    state["proposed_team"] = []

    if state["rejections"] >= MAX_REJECTIONS:
        # Cinco recusas seguidas: a mesa se paralisou e os espiões levam.
        state["phase"] = "ended"
        state["winner"] = "espioes"
        _log(state, {"type": "sabotage_by_deadlock"})
        return None

    state["leader_index"] = (state.get("leader_index", 0) + 1) % len(order)
    state["phase"] = "proposal"
    return None


def play_mission_card(state, player, success):
    if state.get("phase") != "mission":
        return "Nenhuma missão em andamento."
    if player.id not in (state.get("proposed_team") or []):
        return "Você não foi enviado nesta missão."

    role = (player.state or {}).get("role")
    if role != ROLE_SPY and not success:
        return "A resistência não pode sabotar."

    player_state = player.state or {}
    player_state["mission_card"] = bool(success)
    player.state = player_state
    player.save(update_fields=["state"])
    return None


def mission_complete(state, players):
    team = state.get("proposed_team") or []
    sent = [p for p in players if p.id in team]
    return len(sent) == len(team) and all(
        (p.state or {}).get("mission_card") is not None for p in sent
    )


def resolve_mission(state, players):
    """
    Só o número de sabotagens é revelado — nunca quem sabotou. É essa
    assimetria que faz a mesa discutir.
    """
    order = state.get("order") or []
    team = state.get("proposed_team") or []
    mission = state.get("mission", 1)
    sent = [p for p in players if p.id in team]

    fails = sum(1 for p in sent if (p.state or {}).get("mission_card") is False)
    needed = fails_needed(len(order), mission)
    success = fails < needed

    results = list(state.get("results") or [])
    results.append(success)
    state["results"] = results
    state["last_mission"] = {
        "mission": mission,
        "team": list(team),
        "fails": fails,
        "needed": needed,
        "success": success,
    }
    _log(state, {"type": "mission", "mission": mission, "fails": fails, "success": success})

    for player in sent:
        player_state = player.state or {}
        player_state["mission_card"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    wins = sum(1 for value in results if value)
    losses = sum(1 for value in results if not value)

    if wins >= MISSIONS_TO_WIN:
        state["phase"] = "ended"
        state["winner"] = "resistencia"
    elif losses >= MISSIONS_TO_WIN:
        state["phase"] = "ended"
        state["winner"] = "espioes"
    else:
        state["mission"] = mission + 1
        state["phase"] = "proposal"
        state["proposed_team"] = []
        state["leader_index"] = (state.get("leader_index", 0) + 1) % len(order)

    return None


def redact_state(state):
    """Quem é espião só se revela no fim."""
    safe = dict(state)
    if safe.get("phase") != "ended":
        safe.pop("spy_ids", None)
    return safe
