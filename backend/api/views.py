from datetime import timedelta
import secrets

from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Game, Player, Room
from .serializers import (
    ChangeGameSerializer,
    GameSerializer,
    LoginSerializer,
    RegisterSerializer,
    HeartbeatSerializer,
    JoinRoomSerializer,
    PlayerSerializer,
    PlayerStateSerializer,
    ProfileUpdateSerializer,
    ReadMyMindModeSerializer,
    ReadMyMindPlaySerializer,
    ConfinamentoGuessSerializer,
    BelezaGuessSerializer,
    FutureSugorokuMoveSerializer,
    FutureSugorokuUnlockSerializer,
    FutureSugorokuPenaltyChoiceSerializer,
    LeilaoBidSerializer,
    ReadySerializer,
    RoomCreateSerializer,
    RoomDetailSerializer,
    RoomSerializer,
    UserSerializer,
)

READ_MY_MIND_SLUG = "read-my-mind"
READ_MY_MIND_MIN = 1
READ_MY_MIND_MAX = 100
READ_MY_MIND_ROUND_TARGET = 10
READ_MY_MIND_LIVES = 3
READ_MY_MIND_TURN_SECONDS = 60

CONFINAMENTO_SLUG = "confinamento-solitario"
CONFINAMENTO_TURN_SECONDS = 120
CONFINAMENTO_SUITS = ["hearts", "diamonds", "clubs", "spades"]

BELEZA_SLUG = "concurso-de-beleza"
BELEZA_THRESHOLD = -10
BELEZA_MULTIPLIER = 0.8
BELEZA_GUESS_SECONDS = 120
BELEZA_SHOWDOWN_SECONDS = 30

SUGOROKU_SLUG = "future-sugoroku"
SUGOROKU_SIZE = 5
SUGOROKU_TURNS = 15
SUGOROKU_START_POINTS = 15
SUGOROKU_UNLOCK_REQUIRED = 2
SUGOROKU_TURN_SECONDS = 60

LEILAO_SLUG = "leilao-de-cem-votos"
LEILAO_ROUNDS = 10
LEILAO_BASE_POT = 100
LEILAO_BID_SECONDS = 15


def _room_state(room: Room) -> dict:
    return room.state or {}


def _set_room_state(room: Room, state: dict) -> None:
    room.state = state
    room.last_activity_at = timezone.now()
    room.save(update_fields=["state", "last_activity_at"])


def _active_players(room: Room):
    players = list(room.players.all())
    return [player for player in players if not player.state.get("eliminated")]


def _deal_cards(players, round_number: int) -> None:
    if not players:
        return
    total_cards = round_number * len(players)
    deck = secrets.SystemRandom().sample(range(READ_MY_MIND_MIN, READ_MY_MIND_MAX + 1), total_cards)
    index = 0
    for player in players:
        hand = deck[index : index + round_number]
        index += round_number
        state = player.state or {}
        state["hand"] = hand
        state["eliminated"] = False
        player.state = state
        player.save(update_fields=["state"])


def _initialize_read_my_mind(room: Room, mode: str) -> None:
    players = list(room.players.all())
    now = timezone.now()
    state = {
        "game": READ_MY_MIND_SLUG,
        "mode": mode,
        "round": 1,
        "lives": READ_MY_MIND_LIVES if mode == "coop" else None,
        "played": [],
        "deadline_ts": (now + timedelta(seconds=READ_MY_MIND_TURN_SECONDS)).timestamp(),
        "last_play_ts": None,
    }
    for player in players:
        player_state = player.state or {}
        player_state["eliminated"] = False
        player.state = player_state
        player.save(update_fields=["state"])
    _deal_cards(players, 1)
    _set_room_state(room, state)


def _initialize_confinamento(room: Room) -> None:
    players = list(room.players.all())
    if not players:
        return
    rng = secrets.SystemRandom()
    for player in players:
        player_state = player.state or {}
        player_state["eliminated"] = False
        player_state["guess"] = None
        player_state["suit"] = rng.choice(CONFINAMENTO_SUITS)
        player.state = player_state
        player.save(update_fields=["state"])

    valete = rng.choice(players)
    now = timezone.now()
    state = {
        "game": CONFINAMENTO_SLUG,
        "round": 1,
        "deadline_ts": (now + timedelta(seconds=CONFINAMENTO_TURN_SECONDS)).timestamp(),
        "valete_player_id": valete.id,
        "winners": [],
    }
    _set_room_state(room, state)


def _resolve_confinamento(room: Room, force: bool = False) -> dict:
    state = _room_state(room)
    if room.status != Room.STATUS_LIVE:
        return state

    active_players = _active_players(room)
    if not active_players:
        return state

    if not force:
        if any(player.state.get("guess") is None for player in active_players):
            return state

    for player in active_players:
        player_state = player.state or {}
        guess = player_state.get("guess")
        if guess is None or guess != player_state.get("suit"):
            player_state["eliminated"] = True
        player_state["guess"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    active_players = _active_players(room)
    valete_id = state.get("valete_player_id")
    valete_eliminated = not any(player.id == valete_id for player in active_players)

    if valete_eliminated:
        state["winners"] = [player.id for player in active_players if player.id != valete_id]
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])
    else:
        if len(active_players) == 1 and active_players[0].id == valete_id:
            state["winners"] = [valete_id]
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
        else:
            state["round"] = (state.get("round") or 1) + 1

    if room.status == Room.STATUS_LIVE:
        rng = secrets.SystemRandom()
        for player in _active_players(room):
            player_state = player.state or {}
            player_state["suit"] = rng.choice(CONFINAMENTO_SUITS)
            player_state["guess"] = None
            player.state = player_state
            player.save(update_fields=["state"])

    state["deadline_ts"] = (timezone.now() + timedelta(seconds=CONFINAMENTO_TURN_SECONDS)).timestamp()
    return state


def _apply_confinamento_timeout(room: Room) -> dict:
    state = _room_state(room)
    deadline_ts = state.get("deadline_ts")
    if not deadline_ts:
        return state
    if timezone.now().timestamp() <= deadline_ts:
        return state
    return _resolve_confinamento(room, force=True)


def _apply_beleza_timeout(room: Room) -> dict:
    return _tick_beleza(room)


def _tick_beleza(room: Room) -> dict:
    state = _room_state(room)
    phase = state.get("phase", "guess")
    now_ts = timezone.now().timestamp()

    if phase == "guess":
        active_players = _active_players(room)
        all_guessed = bool(active_players) and all(player.state.get("guess") is not None for player in active_players)
        deadline_ts = state.get("deadline_ts")
        if all_guessed or (deadline_ts and now_ts > deadline_ts):
            state = _resolve_beleza(room, force=True)
            if room.status == Room.STATUS_LIVE:
                state["phase"] = "showdown"
                state["deadline_ts"] = now_ts + BELEZA_SHOWDOWN_SECONDS
        return state

    if phase == "showdown":
        deadline_ts = state.get("deadline_ts")
        if deadline_ts and now_ts > deadline_ts and room.status == Room.STATUS_LIVE:
            state["phase"] = "guess"
            state["round"] = (state.get("round") or 1) + 1
            state["deadline_ts"] = now_ts + BELEZA_GUESS_SECONDS
        return state

    return state


def _active_sugoroku_players(room: Room):
    players = list(room.players.all())
    return [player for player in players if not player.state.get("eliminated") and not player.state.get("cleared")]


def _active_generic_players(room: Room):
    players = list(room.players.all())
    return [player for player in players if not player.state.get("eliminated")]


def _coord_key(coord):
    return f"{coord[0]},{coord[1]}"


def _parse_coord(value):
    if isinstance(value, str) and "," in value:
        x_str, y_str = value.split(",")
        return int(x_str), int(y_str)
    return 0, 0


def _neighbors(coord):
    x, y = coord
    return {
        "N": (x, y - 1),
        "S": (x, y + 1),
        "W": (x - 1, y),
        "E": (x + 1, y),
    }


def _in_bounds(coord):
    x, y = coord
    return 0 <= x < SUGOROKU_SIZE and 0 <= y < SUGOROKU_SIZE


def _initialize_sugoroku(room: Room) -> None:
    rng = secrets.SystemRandom()
    exit_coord = (rng.randrange(SUGOROKU_SIZE), rng.randrange(SUGOROKU_SIZE))
    if exit_coord == (0, 0):
        exit_coord = (SUGOROKU_SIZE - 1, SUGOROKU_SIZE - 1)

    penalties = {}
    for _ in range(5):
        coord = (rng.randrange(SUGOROKU_SIZE), rng.randrange(SUGOROKU_SIZE))
        if coord == (0, 0):
            continue
        penalties[_coord_key(coord)] = rng.choice([1, 2, 3])

    for player in room.players.all():
        player_state = player.state or {}
        player_state.update(
            {
                "position": [0, 0],
                "prev_position": None,
                "points": SUGOROKU_START_POINTS,
                "locked": False,
                "choice": None,
                "eliminated": False,
                "cleared": False,
            }
        )
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": SUGOROKU_SLUG,
        "turn": 1,
        "max_turns": SUGOROKU_TURNS,
        "exit": list(exit_coord),
        "penalties": penalties,
        "pending_penalties": {},
        "dice": {},
        "locked_rooms": {},
        "phase": "choice",
        "winners": [],
        "losers": [],
        "deadline_ts": None,
    }
    _set_room_state(room, state)


def _roll_sugoroku(room: Room) -> dict:
    state = _room_state(room)
    rng = secrets.SystemRandom()
    dice = {}
    players = _active_sugoroku_players(room)
    rooms_with_players = {}
    for player in players:
        pos = player.state.get("position") or [0, 0]
        key = _coord_key(tuple(pos))
        rooms_with_players.setdefault(key, []).append(player)

    for key in rooms_with_players.keys():
        coord = _parse_coord(key)
        exits = {dir_key: target for dir_key, target in _neighbors(coord).items() if _in_bounds(target)}
        dice[key] = {dir_key: rng.randint(1, 6) for dir_key in exits.keys()}

    state["dice"] = dice
    state["phase"] = "choice"
    state["deadline_ts"] = timezone.now().timestamp() + SUGOROKU_TURN_SECONDS
    return state


def _resolve_sugoroku(room: Room) -> dict:
    state = _room_state(room)
    dice = state.get("dice") or {}
    if not dice:
        state = _roll_sugoroku(room)
        dice = state.get("dice") or {}
    locked_rooms = state.get("locked_rooms") or {}
    penalty_entries = {}

    players = _active_sugoroku_players(room)
    rooms_with_players = {}
    for player in players:
        pos = player.state.get("position") or [0, 0]
        key = _coord_key(tuple(pos))
        rooms_with_players.setdefault(key, []).append(player)

    for key, occupants in rooms_with_players.items():
        room_dice = dice.get(key, {})
        locked_info = locked_rooms.get(key, {"unlockers": []})
        unlocked = len(locked_info.get("unlockers", [])) >= SUGOROKU_UNLOCK_REQUIRED

        moves_by_dir = {}
        stay_players = []
        back_players = []
        for player in occupants:
            player_state = player.state or {}
            if player_state.get("locked") and not unlocked:
                stay_players.append(player)
                continue
            choice = player_state.get("choice") or {}
            if choice.get("action") == "stay":
                stay_players.append(player)
            elif choice.get("action") == "back":
                back_players.append(player)
            else:
                direction = choice.get("direction")
                if direction in room_dice:
                    moves_by_dir.setdefault(direction, []).append(player)
                else:
                    stay_players.append(player)

        # Resolve moves with capacity
        for direction, movers in moves_by_dir.items():
            capacity = room_dice.get(direction, 0)
            allowed = sorted(movers, key=lambda p: p.id)[:capacity]
            locked = [p for p in movers if p not in allowed]
            for player in allowed:
                player_state = player.state or {}
                coord = _parse_coord(key)
                target = _neighbors(coord)[direction]
                player_state["prev_position"] = coord
                player_state["position"] = list(target)
                player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
                player_state["locked"] = False
                player_state["can_back"] = False
                player_state["choice"] = None
                player.state = player_state
                player.save(update_fields=["state"])
                target_key = _coord_key(target)
                if target_key in state.get("penalties", {}):
                    penalty_entries.setdefault(target_key, []).append(player.id)
            if locked:
                locked_rooms.setdefault(key, {"unlockers": []})
                for player in locked:
                    player_state = player.state or {}
                    player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
                    player_state["locked"] = True
                    player_state["choice"] = None
                    player.state = player_state
                    player.save(update_fields=["state"])

        # Stay players (by choice or locked)
        for player in stay_players:
            player_state = player.state or {}
            if player_state.get("locked"):
                player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
            else:
                player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
                player_state["can_back"] = True
            player_state["choice"] = None
            player.state = player_state
            player.save(update_fields=["state"])

        for player in back_players:
            player_state = player.state or {}
            if player_state.get("can_back"):
                prev = player_state.get("prev_position")
                if prev:
                    player_state["position"] = list(prev)
                    player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
                player_state["can_back"] = False
            else:
                player_state["points"] = player_state.get("points", SUGOROKU_START_POINTS) - 1
                player_state["can_back"] = True
            player_state["choice"] = None
            player.state = player_state
            player.save(update_fields=["state"])

        locked_rooms[key] = {"unlockers": []}

    # Apply penalties, check exit, elimination
    penalties = state.get("penalties", {})
    pending = state.get("pending_penalties") or {}
    winners = state.get("winners", [])
    losers = state.get("losers", [])
    exit_coord = state.get("exit")

    for player in room.players.all():
        player_state = player.state or {}
        if player_state.get("eliminated") or player_state.get("cleared"):
            continue
        pos = player_state.get("position") or [0, 0]
        key = _coord_key(tuple(pos))
        if key in penalties:
            amount = penalties[key]
            pending_info = pending.get(key, {"amount": amount, "player_ids": [], "opener_id": None})
            pending_info["amount"] = amount
            if player.id not in pending_info["player_ids"]:
                pending_info["player_ids"].append(player.id)
            if pending_info.get("opener_id") is None and key in penalty_entries:
                pending_info["opener_id"] = penalty_entries[key][0]
            pending[key] = pending_info
        if exit_coord and list(exit_coord) == pos:
            player_state["cleared"] = True
            winners.append(player.id)
        points = player_state.get("points", SUGOROKU_START_POINTS)
        if points <= 0:
            player_state["eliminated"] = True
            losers.append(player.id)
        player.state = player_state
        player.save(update_fields=["state"])

    state["winners"] = list(dict.fromkeys(winners))
    state["losers"] = list(dict.fromkeys(losers))
    # Auto-apply penalties if only one player is in that room.
    for key, info in list(pending.items()):
        player_ids = info.get("player_ids", [])
        if len(player_ids) == 1:
            try:
                target = room.players.get(id=player_ids[0])
                target_state = target.state or {}
                target_state["points"] = target_state.get("points", SUGOROKU_START_POINTS) - info.get("amount", 0)
                target.state = target_state
                target.save(update_fields=["state"])
                pending.pop(key, None)
            except Player.DoesNotExist:
                continue

    state["locked_rooms"] = locked_rooms
    state["pending_penalties"] = pending
    state["dice"] = {}
    state["phase"] = "choice"
    state["deadline_ts"] = None

    state["turn"] = state.get("turn", 1) + 1
    if state["turn"] > state.get("max_turns", SUGOROKU_TURNS):
        for player in _active_sugoroku_players(room):
            player_state = player.state or {}
            player_state["eliminated"] = True
            player.state = player_state
            player.save(update_fields=["state"])
            if player.id not in state["losers"]:
                state["losers"].append(player.id)
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])

    if not _active_sugoroku_players(room):
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])

    return state


def _tick_sugoroku(room: Room) -> dict:
    state = _room_state(room)
    deadline_ts = state.get("deadline_ts")
    now_ts = timezone.now().timestamp()
    active_players = _active_sugoroku_players(room)
    all_ready = True
    for player in active_players:
        player_state = player.state or {}
        if player_state.get("locked"):
            continue
        if not player_state.get("choice"):
            all_ready = False
            break
    if deadline_ts and now_ts < deadline_ts and not all_ready:
        return state
    return _resolve_sugoroku(room)


def _initialize_leilao(room: Room) -> None:
    rng = secrets.SystemRandom()
    for player in room.players.all():
        player_state = player.state or {}
        player_state["eliminated"] = False
        player_state["points"] = rng.randint(100, 200)
        player_state["bid"] = 0
        player_state["submitted"] = False
        player_state["won"] = 0
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": LEILAO_SLUG,
        "round": 1,
        "max_rounds": LEILAO_ROUNDS,
        "carry": 0,
        "pot": LEILAO_BASE_POT,
        "last_winner_id": None,
        "last_bid": None,
        "phase": "bidding",
        "winners": [],
        "losers": [],
        "deadline_ts": (timezone.now().timestamp() + LEILAO_BID_SECONDS),
        "sudden_death": False,
        "tie_players": [],
        "round_bid_total": 0,
    }
    _set_room_state(room, state)


def _resolve_leilao(room: Room, force: bool = False) -> dict:
    state = _room_state(room)
    if room.status != Room.STATUS_LIVE:
        return state

    active_players = _active_generic_players(room)
    if not active_players:
        return state

    if not force:
        if any(not player.state.get("submitted") for player in active_players):
            return state

    bids = {player.id: (player.state.get("bid") or 0) for player in active_players}
    total_bid = sum(bids.values())
    effective_pot = state.get("pot", LEILAO_BASE_POT)
    state["round_bid_total"] = state.get("round_bid_total", 0) + total_bid

    highest = None
    winner_id = None
    for player_id, bid in bids.items():
        if highest is None or bid > highest:
            highest = bid
            winner_id = player_id

    top_players = [player_id for player_id, bid in bids.items() if bid == highest]
    if len(top_players) > 1 and not state.get("sudden_death"):
        # Keep going; ties are only resolved after round 10.
        winner_id = top_players[0]

    losers = state.get("losers", [])
    for player in active_players:
        player_state = player.state or {}
        if player.id == winner_id:
            player_state["points"] = player_state.get("points", 0) + effective_pot
            player_state["won"] = player_state.get("won", 0) + effective_pot
        if player_state.get("points", 0) <= 0:
            player_state["eliminated"] = True
            losers.append(player.id)
        player_state["bid"] = 0
        player_state["submitted"] = False
        player.state = player_state
        player.save(update_fields=["state"])
    state["losers"] = list(dict.fromkeys(losers))

    new_carry = max(0, state.get("round_bid_total", 0) - LEILAO_BASE_POT)
    state["carry"] = new_carry
    state["pot"] = LEILAO_BASE_POT + new_carry
    state["last_winner_id"] = winner_id
    state["last_bid"] = highest
    state["round_bid_total"] = 0
    if winner_id is not None:
        winners = state.get("winners", [])
        winners.append(winner_id)
        state["winners"] = list(dict.fromkeys(winners))

    current_round = state.get("round", 1)
    if state.get("sudden_death"):
        remaining = _active_generic_players(room)
        if len(remaining) <= 1:
            state["winners"] = [player.id for player in remaining]
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
            return state
        ranked = sorted(remaining, key=lambda p: p.state.get("points", 0), reverse=True)
        if ranked[0].state.get("points", 0) != ranked[1].state.get("points", 0):
            loser = ranked[1]
            loser_state = loser.state or {}
            loser_state["eliminated"] = True
            loser.state = loser_state
            loser.save(update_fields=["state"])
            state["losers"] = list(dict.fromkeys(state.get("losers", []) + [loser.id]))
            state["winners"] = [ranked[0].id]
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
            return state
        state["tie_players"] = [ranked[0].id, ranked[1].id]
        state["deadline_ts"] = timezone.now().timestamp() + LEILAO_BID_SECONDS
        return state

    if current_round >= state.get("max_rounds", LEILAO_ROUNDS):
        remaining = _active_generic_players(room)
        if len(remaining) <= 1:
            state["winners"] = [player.id for player in remaining]
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
            return state

        # Keep only the top 2 by points for sudden death.
        ranked = sorted(remaining, key=lambda p: p.state.get("points", 0), reverse=True)
        top_two = ranked[:2]
        top_ids = [player.id for player in top_two]
        for player in ranked[2:]:
            player_state = player.state or {}
            player_state["eliminated"] = True
            player.state = player_state
            player.save(update_fields=["state"])
        state["losers"] = list(dict.fromkeys([player.id for player in ranked[2:]] + state.get("losers", [])))
        state["round"] = state.get("max_rounds", LEILAO_ROUNDS)

        if top_two[0].state.get("points", 0) != top_two[1].state.get("points", 0):
            loser = top_two[1]
            loser_state = loser.state or {}
            loser_state["eliminated"] = True
            loser.state = loser_state
            loser.save(update_fields=["state"])
            state["losers"] = list(dict.fromkeys(state.get("losers", []) + [loser.id]))
            state["winners"] = [top_two[0].id]
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
            return state

        state["sudden_death"] = True
        state["tie_players"] = top_ids
        for player in top_two:
            player_state = player.state or {}
            player_state["bid"] = 0
            player_state["submitted"] = False
            player.state = player_state
            player.save(update_fields=["state"])
        state["deadline_ts"] = timezone.now().timestamp() + LEILAO_BID_SECONDS
        return state
    else:
        state["round"] = current_round + 1
        state["deadline_ts"] = timezone.now().timestamp() + LEILAO_BID_SECONDS

    if not _active_generic_players(room):
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])

    return state


def _tick_leilao(room: Room) -> dict:
    state = _room_state(room)
    deadline_ts = state.get("deadline_ts")
    now_ts = timezone.now().timestamp()
    if deadline_ts and now_ts > deadline_ts:
        return _resolve_leilao(room, force=True)
    return _resolve_leilao(room, force=False)


def _initialize_beleza(room: Room) -> None:
    players = list(room.players.all())
    for player in players:
        player_state = player.state or {}
        player_state["eliminated"] = False
        player_state["score"] = 0
        player_state["guess"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": BELEZA_SLUG,
        "round": 1,
        "eliminations": 0,
        "no_loss_streak": 0,
        "multiplier": BELEZA_MULTIPLIER,
        "last_target": None,
        "last_winner_id": None,
        "last_winner_ids": [],
        "phase": "guess",
        "deadline_ts": (timezone.now() + timedelta(seconds=BELEZA_GUESS_SECONDS)).timestamp(),
    }
    _set_room_state(room, state)


def _resolve_beleza(room: Room, force: bool = False) -> dict:
    state = _room_state(room)
    if room.status != Room.STATUS_LIVE:
        return state

    active_players = _active_players(room)
    if not active_players:
        return state

    if not force:
        if any(player.state.get("guess") is None for player in active_players):
            return state

    guesses = {player.id: player.state.get("guess") for player in active_players}
    values = [value for value in guesses.values() if value is not None]
    if not values:
        return state

    mean = sum(values) / len(values)
    target = mean * BELEZA_MULTIPLIER
    state["last_target"] = target

    duplicate_rule = state.get("eliminations", 0) >= 1
    exact_rule = state.get("eliminations", 0) >= 2
    zero_hundred_rule = state.get("eliminations", 0) >= 3

    invalid_numbers = set()
    if duplicate_rule:
        counts = {}
        for value in values:
            counts[value] = counts.get(value, 0) + 1
        invalid_numbers = {value for value, count in counts.items() if count > 1}

    candidates = []
    for player in active_players:
        value = guesses[player.id]
        if value is None:
            continue
        if duplicate_rule and value in invalid_numbers:
            continue
        candidates.append((player, value))

    winners = []
    zero_present = False
    if zero_hundred_rule:
        zero_present = any(value == 0 for _, value in candidates)
        if zero_present:
            hundred_players = [player for player, value in candidates if value == 100]
            if hundred_players:
                winners = hundred_players

    if not winners:
        closest_distance = None
        for player, value in candidates:
            distance = abs(value - target)
            if closest_distance is None or distance < closest_distance:
                closest_distance = distance
        if closest_distance is not None:
            winners = [player for player, value in candidates if abs(value - target) == closest_distance]

    state["last_winner_ids"] = [player.id for player in winners]
    state["last_winner_id"] = winners[0].id if winners else None

    exact_hit = any(guesses[player.id] == target for player in winners)
    penalty = 2 if exact_rule and winners and exact_hit else 1
    penalty = -abs(penalty)
    any_loss = len(winners) < len(active_players)
    for player in active_players:
        player_state = player.state or {}
        if player in winners:
            player_state["guess"] = None
            player.state = player_state
            player.save(update_fields=["state"])
            continue
        if zero_hundred_rule and zero_present and guesses[player.id] == 0:
            player_state["score"] = player_state.get("score", 0) + penalty
            if player_state["score"] <= BELEZA_THRESHOLD:
                player_state["eliminated"] = True
                state["eliminations"] = state.get("eliminations", 0) + 1
            player_state["guess"] = None
            player.state = player_state
            player.save(update_fields=["state"])
            continue
        player_state["score"] = player_state.get("score", 0) + penalty
        if player_state["score"] <= BELEZA_THRESHOLD:
            player_state["eliminated"] = True
            state["eliminations"] = state.get("eliminations", 0) + 1
        player_state["guess"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    active_players = _active_players(room)
    if any_loss:
        state["no_loss_streak"] = 0
    else:
        state["no_loss_streak"] = state.get("no_loss_streak", 0) + 1

    if state.get("no_loss_streak", 0) >= 5 and room.status == Room.STATUS_LIVE:
        state["winners"] = [player.id for player in active_players]
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])
        return state

    if len(active_players) <= 1:
        state["winners"] = [player.id for player in active_players]
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])

    return state


def _apply_timeout(room: Room) -> dict:
    state = _room_state(room)
    mode = state.get("mode")
    now = timezone.now()
    deadline_ts = state.get("deadline_ts")
    if not deadline_ts or now.timestamp() <= deadline_ts:
        return state

    players = _active_players(room)
    if not players:
        return state

    if mode == "coop":
        lives = state.get("lives", READ_MY_MIND_LIVES) - 1
        state["lives"] = max(lives, 0)
        if lives <= 0:
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
    else:
        eliminated = secrets.choice(players)
        eliminated_state = eliminated.state or {}
        eliminated_state["eliminated"] = True
        eliminated_state["hand"] = []
        eliminated.state = eliminated_state
        eliminated.save(update_fields=["state"])

        players = _active_players(room)
        if len(players) <= 1:
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])

    state["deadline_ts"] = (now + timedelta(seconds=READ_MY_MIND_TURN_SECONDS)).timestamp()
    return state


def _apply_play(room: Room, player, card: int) -> dict:
    state = _room_state(room)
    mode = state.get("mode")
    if mode not in {"coop", "versus"}:
        raise ValueError("Mode not set.")

    player_state = player.state or {}
    if player_state.get("eliminated"):
        raise ValueError("Player eliminated.")

    hand = player_state.get("hand", [])
    if card not in hand:
        raise ValueError("Card not in hand.")

    players = _active_players(room)
    remaining_cards = []
    for entry in players:
        remaining_cards.extend(entry.state.get("hand", []))
    if not remaining_cards:
        raise ValueError("No cards available.")

    min_card = min(remaining_cards)
    is_cut = card != min_card

    hand.remove(card)

    state.setdefault("played", []).append({"player_id": player.id, "card": card, "ts": timezone.now().timestamp()})

    if is_cut:
        if mode == "coop":
            # Wrong card returns to the player's hand in co-op.
            hand.append(card)
            lives = state.get("lives", READ_MY_MIND_LIVES) - 1
            state["lives"] = max(lives, 0)
            if lives <= 0:
                room.status = Room.STATUS_ENDED
                room.save(update_fields=["status"])
        else:
            players_active = _active_players(room)
            victim = None
            for candidate in players_active:
                if min_card in candidate.state.get("hand", []):
                    victim = candidate
                    break
            players_left = len(players_active)
            to_eliminate = [player]
            if players_left > 2 and victim:
                to_eliminate.append(victim)
            for eliminated in to_eliminate:
                eliminated_state = eliminated.state or {}
                eliminated_state["eliminated"] = True
                eliminated_state["hand"] = []
                eliminated.state = eliminated_state
                eliminated.save(update_fields=["state"])

            if len(_active_players(room)) <= 1:
                room.status = Room.STATUS_ENDED
                room.save(update_fields=["status"])

    player_state["hand"] = hand
    player.state = player_state
    player.save(update_fields=["state"])
    players_remaining_cards = []
    for entry in _active_players(room):
        players_remaining_cards.extend(entry.state.get("hand", []))

    if not players_remaining_cards and room.status == Room.STATUS_LIVE:
        round_number = state.get("round", 1) + 1
        if round_number > READ_MY_MIND_ROUND_TARGET:
            room.status = Room.STATUS_ENDED
            room.save(update_fields=["status"])
        else:
            state["round"] = round_number
            _deal_cards(_active_players(room), round_number)

    state["deadline_ts"] = (timezone.now() + timedelta(seconds=READ_MY_MIND_TURN_SECONDS)).timestamp()
    state["last_play_ts"] = timezone.now().timestamp()
    return state


class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.filter(is_active=True)
    serializer_class = GameSerializer
    http_method_names = ["get", "post", "head", "options"]


class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=["post"])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(
            {"token": result["token"].key, "user": UserSerializer(result["user"]).data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response({"token": result["token"].key, "user": UserSerializer(result["user"]).data})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        return Response({"user": UserSerializer(request.user).data})

    @action(detail=False, methods=["put"], permission_classes=[permissions.IsAuthenticated])
    def profile(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response({"profile": {"nickname": profile.nickname}})


class RoomViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Room.objects.select_related("game").prefetch_related("players")
    serializer_class = RoomSerializer
    lookup_field = "code"

    def get_permissions(self):
        open_actions = {
            "create",
            "start",
            "end",
            "change_game",
            "read_my_mind_mode",
            "read_my_mind_tick",
            "confinamento_tick",
            "beleza_tick",
            "sugoroku_roll",
            "sugoroku_tick",
            "leilao_tick",
            "tv_ping",
        }
        if self.action in open_actions:
            return [permissions.AllowAny()]
        if self.action in {
            "join",
            "heartbeat",
            "ready",
            "state",
            "read_my_mind_play",
            "confinamento_guess",
            "beleza_guess",
            "sugoroku_move",
            "sugoroku_unlock",
            "sugoroku_penalty_choice",
            "leilao_bid",
        }:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == "create":
            return RoomCreateSerializer
        if self.action == "retrieve":
            return RoomDetailSerializer
        if self.action == "join":
            return JoinRoomSerializer
        if self.action == "heartbeat":
            return HeartbeatSerializer
        if self.action == "change_game":
            return ChangeGameSerializer
        if self.action == "ready":
            return ReadySerializer
        if self.action == "state":
            return PlayerStateSerializer
        if self.action == "read_my_mind_mode":
            return ReadMyMindModeSerializer
        if self.action == "read_my_mind_play":
            return ReadMyMindPlaySerializer
        if self.action == "confinamento_guess":
            return ConfinamentoGuessSerializer
        if self.action == "beleza_guess":
            return BelezaGuessSerializer
        if self.action == "sugoroku_move":
            return FutureSugorokuMoveSerializer
        if self.action == "sugoroku_unlock":
            return FutureSugorokuUnlockSerializer
        if self.action == "sugoroku_penalty_choice":
            return FutureSugorokuPenaltyChoiceSerializer
        if self.action == "leilao_bid":
            return LeilaoBidSerializer
        return RoomSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        detail = RoomDetailSerializer(room, context=self.get_serializer_context())
        return Response(detail.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        room = self.get_object()
        if request.user.is_authenticated:
            try:
                player = room.players.get(user=request.user)
            except Player.DoesNotExist:
                player = None
            if player:
                player.last_seen_at = timezone.now()
                player.save(update_fields=["last_seen_at"])
        serializer = RoomDetailSerializer(room, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def join(self, request, code=None):
        room = self.get_object()
        serializer = self.get_serializer(data=request.data, context={"room": room, "request": request})
        serializer.is_valid(raise_exception=True)
        player = serializer.save()
        return Response({"player": {
            "id": player.id,
            "name": player.name,
            "user_id": player.user_id,
            "device_id": player.device_id,
            "is_host": player.is_host,
            "ready": player.ready,
            "state": player.state,
            "joined_at": player.joined_at,
            "last_seen_at": player.last_seen_at,
        }})

    @action(detail=True, methods=["post"])
    def heartbeat(self, request, code=None):
        room = self.get_object()
        serializer = self.get_serializer(data=request.data, context={"room": room, "request": request})
        serializer.is_valid(raise_exception=True)
        player = serializer.save()
        return Response({"ok": True, "player_id": player.id})

    @action(detail=True, methods=["post"])
    def start(self, request, code=None):
        room = self.get_object()
        if room.players.exists() and room.players.filter(ready=False).exists():
            return Response(
                {"detail": "All players must be ready before starting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if room.game.slug == READ_MY_MIND_SLUG:
            state = _room_state(room)
            mode = request.data.get("mode") or state.get("mode")
            if mode not in {"coop", "versus"}:
                return Response(
                    {"detail": "Mode required for Read My Mind."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            _initialize_read_my_mind(room, mode)
        if room.game.slug == CONFINAMENTO_SLUG:
            _initialize_confinamento(room)
        if room.game.slug == BELEZA_SLUG:
            _initialize_beleza(room)
        if room.game.slug == SUGOROKU_SLUG:
            _initialize_sugoroku(room)
        if room.game.slug == LEILAO_SLUG:
            _initialize_leilao(room)
        room.status = Room.STATUS_LIVE
        room.save(update_fields=["status"])
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def end(self, request, code=None):
        room = self.get_object()
        room.status = Room.STATUS_ENDED
        room.save(update_fields=["status"])
        return Response({"status": room.status})

    @action(detail=True, methods=["post"])
    def change_game(self, request, code=None):
        room = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        game = serializer.validated_data["game"]
        room.game = game
        room.status = Room.STATUS_LOBBY
        room.state = {}
        room.save(update_fields=["game", "status", "state"])
        room.players.update(ready=False, state={})
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def ready(self, request, code=None):
        room = self.get_object()
        serializer = self.get_serializer(data=request.data, context={"room": room, "request": request})
        serializer.is_valid(raise_exception=True)
        player = serializer.save()
        return Response({"player_id": player.id, "ready": player.ready})

    @action(detail=True, methods=["post"])
    def state(self, request, code=None):
        room = self.get_object()
        serializer = self.get_serializer(data=request.data, context={"room": room, "request": request})
        serializer.is_valid(raise_exception=True)
        player = serializer.save()
        return Response({"player_id": player.id, "state": player.state})

    @action(detail=True, methods=["get"])
    def players(self, request, code=None):
        room = self.get_object()
        players = room.players.all()
        data = PlayerSerializer(players, many=True, context=self.get_serializer_context()).data
        return Response({"players": data})

    @action(detail=True, methods=["post"])
    def tv_ping(self, request, code=None):
        room = self.get_object()
        device_id = (request.data.get("device_id") or "").strip()
        now = timezone.now()
        room.tv_last_seen_at = now
        update_fields = ["tv_last_seen_at"]
        if device_id:
            room.tv_device_id = device_id
            update_fields.append("tv_device_id")
        room.save(update_fields=update_fields)
        return Response({"ok": True, "tv_connected": True, "tv_last_seen_at": room.tv_last_seen_at})

    @action(detail=True, methods=["post"])
    def read_my_mind_mode(self, request, code=None):
        room = self.get_object()
        if room.game.slug != READ_MY_MIND_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = _room_state(room)
        state["game"] = READ_MY_MIND_SLUG
        state["mode"] = serializer.validated_data["mode"]
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def read_my_mind_play(self, request, code=None):
        room = self.get_object()
        if room.game.slug != READ_MY_MIND_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        state = _apply_timeout(room)
        room.state = state
        if room.status == Room.STATUS_ENDED:
            _set_room_state(room, state)
            return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)
        try:
            state = _apply_play(room, player, serializer.validated_data["card"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def read_my_mind_tick(self, request, code=None):
        room = self.get_object()
        if room.game.slug != READ_MY_MIND_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _apply_timeout(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def confinamento_guess(self, request, code=None):
        room = self.get_object()
        if room.game.slug != CONFINAMENTO_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = _apply_confinamento_timeout(room)
        room.state = state
        if room.status == Room.STATUS_ENDED:
            _set_room_state(room, state)
            return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        player_state = player.state or {}
        if player_state.get("eliminated"):
            return Response({"detail": "Player eliminated."}, status=status.HTTP_400_BAD_REQUEST)
        player_state["guess"] = serializer.validated_data["guess"]
        player.state = player_state
        player.save(update_fields=["state"])
        state = _resolve_confinamento(room, force=False)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def confinamento_tick(self, request, code=None):
        room = self.get_object()
        if room.game.slug != CONFINAMENTO_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _apply_confinamento_timeout(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def beleza_guess(self, request, code=None):
        room = self.get_object()
        if room.game.slug != BELEZA_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = _apply_beleza_timeout(room)
        room.state = state
        if room.status == Room.STATUS_ENDED:
            _set_room_state(room, state)
            return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        player_state = player.state or {}
        if player_state.get("eliminated"):
            return Response({"detail": "Player eliminated."}, status=status.HTTP_400_BAD_REQUEST)
        if state.get("phase") == "showdown":
            return Response({"detail": "Showdown in progress."}, status=status.HTTP_400_BAD_REQUEST)
        player_state["guess"] = serializer.validated_data["value"]
        player.state = player_state
        player.save(update_fields=["state"])
        state = _tick_beleza(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def beleza_tick(self, request, code=None):
        room = self.get_object()
        if room.game.slug != BELEZA_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _tick_beleza(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def sugoroku_roll(self, request, code=None):
        room = self.get_object()
        if room.game.slug != SUGOROKU_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _roll_sugoroku(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def sugoroku_move(self, request, code=None):
        room = self.get_object()
        if room.game.slug != SUGOROKU_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        player_state = player.state or {}
        if player_state.get("eliminated") or player_state.get("cleared"):
            return Response({"detail": "Player inactive."}, status=status.HTTP_400_BAD_REQUEST)
        action = serializer.validated_data["action"]
        direction = serializer.validated_data.get("direction")
        player_state["choice"] = {"action": action, "direction": direction}
        player.state = player_state
        player.save(update_fields=["state"])
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def sugoroku_unlock(self, request, code=None):
        room = self.get_object()
        if room.game.slug != SUGOROKU_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        player_state = player.state or {}
        pos = player_state.get("position") or [0, 0]
        key = _coord_key(tuple(pos))
        state = _room_state(room)
        locked_rooms = state.get("locked_rooms") or {}
        locked_info = locked_rooms.get(key, {"unlockers": []})
        unlockers = set(locked_info.get("unlockers", []))
        unlockers.add(player.id)
        locked_info["unlockers"] = list(unlockers)
        locked_rooms[key] = locked_info
        state["locked_rooms"] = locked_rooms
        _set_room_state(room, state)
        return Response({"ok": True, "unlockers": locked_info["unlockers"]})

    @action(detail=True, methods=["post"])
    def sugoroku_tick(self, request, code=None):
        room = self.get_object()
        if room.game.slug != SUGOROKU_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _room_state(room)
        if not state.get("dice"):
            state = _roll_sugoroku(room)
            _set_room_state(room, state)
        state = _tick_sugoroku(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def sugoroku_penalty_choice(self, request, code=None):
        room = self.get_object()
        if room.game.slug != SUGOROKU_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_id = serializer.validated_data["target_player_id"]
        try:
            target = room.players.get(id=target_id)
        except Player.DoesNotExist:
            return Response({"detail": "Target not in room."}, status=status.HTTP_400_BAD_REQUEST)
        state = _room_state(room)
        penalties = state.get("pending_penalties") or {}
        try:
            chooser = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        for key, info in list(penalties.items()):
            opener_id = info.get("opener_id")
            if opener_id and opener_id != chooser.id:
                continue
            if target_id in info.get("player_ids", []):
                amount = info.get("amount", 0)
                target_state = target.state or {}
                target_state["points"] = target_state.get("points", SUGOROKU_START_POINTS) - amount
                target.state = target_state
                target.save(update_fields=["state"])
                penalties.pop(key, None)
                break
        state["pending_penalties"] = penalties
        _set_room_state(room, state)
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def leilao_bid(self, request, code=None):
        room = self.get_object()
        if room.game.slug != LEILAO_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            player = room.players.get(user=request.user)
        except Player.DoesNotExist:
            return Response({"detail": "Player not in room."}, status=status.HTTP_400_BAD_REQUEST)
        player_state = player.state or {}
        if player_state.get("eliminated"):
            return Response({"detail": "Player eliminated."}, status=status.HTTP_400_BAD_REQUEST)
        state = _room_state(room)
        if state.get("sudden_death") and player.id not in (state.get("tie_players") or []):
            return Response({"detail": "Only tied players can bid."}, status=status.HTTP_400_BAD_REQUEST)
        new_bid = serializer.validated_data["bid"]
        current_bid = player_state.get("bid", 0)
        if new_bid < current_bid:
            return Response({"detail": "Bid can only increase."}, status=status.HTTP_400_BAD_REQUEST)
        active_players = _active_generic_players(room)
        if state.get("sudden_death"):
            active_players = [p for p in active_players if p.id in (state.get("tie_players") or [])]
        highest = max((p.state.get("bid") or 0) for p in active_players) if active_players else 0
        if new_bid != current_bid and new_bid <= highest:
            return Response({"detail": "Bid must be higher than current highest."}, status=status.HTTP_400_BAD_REQUEST)
        points = player_state.get("points", 0)
        diff = new_bid - current_bid
        if diff > 0 and points < diff:
            return Response({"detail": "Not enough points."}, status=status.HTTP_400_BAD_REQUEST)
        player_state["points"] = points - diff
        player_state["bid"] = new_bid
        player_state["submitted"] = True
        if diff > 0:
            state["deadline_ts"] = timezone.now().timestamp() + LEILAO_BID_SECONDS
        player.state = player_state
        player.save(update_fields=["state"])
        state = _tick_leilao(room)
        _set_room_state(room, state)
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def leilao_tick(self, request, code=None):
        room = self.get_object()
        if room.game.slug != LEILAO_SLUG:
            return Response({"detail": "Invalid game."}, status=status.HTTP_400_BAD_REQUEST)
        state = _tick_leilao(room)
        _set_room_state(room, state)
        return Response(RoomDetailSerializer(room, context=self.get_serializer_context()).data)
