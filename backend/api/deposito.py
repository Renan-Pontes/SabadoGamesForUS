"""
O backend como depósito de JSON.

Nos jogos de Halloween a TV é o juiz: roda as regras no navegador e guarda o
resultado aqui (HALLOWEEN.md, "Backend (F1) — contrato HTTP"). A conta do
PythonAnywhere é gratuita — um worker, SQLite — e a noite tem ~15 celulares e
uma TV fazendo poll. Este módulo cuida do que deixa esse poll barato:

- a versão da sala, que sobe a cada mudança: quem já tem a versão atual
  recebe "nada mudou" com uma ou duas consultas;
- a presença (online, TV conectada) sem gravar no banco a cada poll;
- a resposta do sync montada em dict puro, sem serializers.

Regra de ouro da versão: os dados mudam ANTES de a versão subir (ou no mesmo
UPDATE). Quem lê a versão N já enxerga tudo o que a N trouxe — nenhum aparelho
fica achando que está em dia com um estado velho. O contrário (versão velha
com dado novo) é inofensivo: custa só um sync completo a mais.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .halloween import HALLOWEEN_SLUGS, is_halloween
from .models import Player, Room

# Presença: online = poll nos últimos 30 s; TV conectada = nos últimos 20 s.
ONLINE_WINDOW = timedelta(seconds=30)
TV_WINDOW = timedelta(seconds=20)
# Gravações de presença espaçadas, com folga para ninguém "piscar" offline:
# no pior caso a última gravação tem 15 s + o intervalo do poll.
SEEN_WRITE_EVERY = timedelta(seconds=15)
TV_WRITE_EVERY = timedelta(seconds=10)

ROOM_STATUSES = frozenset({Room.STATUS_LOBBY, Room.STATUS_LIVE, Room.STATUS_ENDED})
FX_KEYS = ("scare", "music", "name")
FX_MAX_LENGTH = 80

# Motivos de recusa do sync_room.
NOT_FOUND = "not_found"
WRONG_GAME = "wrong_game"


def now_ms(now=None) -> int:
    """Relógio do servidor em milissegundos: a régua de todo prazo dos jogos."""
    return int((now or timezone.now()).timestamp() * 1000)


def bump_version(room, **fields) -> None:
    """
    Sobe a versão da sala direto no banco (version = version + 1), sem ler
    antes: dois pedidos ao mesmo tempo nunca perdem um incremento. Campos
    extras vão no mesmo UPDATE, e last_activity_at vai sempre. Aceita a sala
    ou só o id.

    Chame DEPOIS de gravar os dados que mudaram (ou passe-os aqui).

    Na instância em memória a versão vira um piso (+1): pode ficar atrás da
    real se outro pedido também subiu, nunca à frente.
    """
    pk = getattr(room, "pk", room)
    fields.setdefault("last_activity_at", timezone.now())
    Room.objects.filter(pk=pk).update(version=F("version") + 1, **fields)
    if isinstance(room, Room):
        for name, value in fields.items():
            setattr(room, name, value)
        # Só se a versão já estava carregada: ler um campo adiado agora traria
        # o valor pós-UPDATE, e o +1 passaria do real.
        if isinstance(room.__dict__.get("version"), int):
            room.version += 1


def is_online(last_seen, now) -> bool:
    return bool(last_seen) and now - last_seen <= ONLINE_WINDOW


def is_tv_connected(tv_last_seen, now) -> bool:
    return bool(tv_last_seen) and now - tv_last_seen <= TV_WINDOW


def mark_player_seen(player_id, room_id, last_seen, now) -> tuple[bool, bool]:
    """
    Renova a presença do jogador gravando no máximo a cada 15 s — o poll chega
    a cada 1–3 s, e gravar sempre seria a maior parte das escritas da noite.

    Quem estava offline e voltou sobe a versão, para as outras telas o verem
    online de novo. Devolve (gravou, subiu_a_versão).
    """
    if last_seen and now - last_seen <= SEEN_WRITE_EVERY:
        return False, False
    Player.objects.filter(pk=player_id).update(last_seen_at=now)
    if is_online(last_seen, now):
        return True, False
    bump_version(room_id)
    return True, True


def mark_tv_seen(room_id, tv_last_seen, now, device_id="", current_device="") -> tuple[bool, bool]:
    """
    Marca a TV como conectada gravando no máximo a cada 10 s (tv_connected
    vale por 20 s). Troca de aparelho grava na hora. Uma TV que volta depois
    de cair sobe a versão. Devolve (gravou, subiu_a_versão).
    """
    new_device = bool(device_id) and device_id != current_device
    if tv_last_seen and now - tv_last_seen <= TV_WRITE_EVERY and not new_device:
        return False, False
    fields = {"tv_last_seen_at": now}
    if new_device:
        fields["tv_device_id"] = device_id
    if is_tv_connected(tv_last_seen, now):
        Room.objects.filter(pk=room_id).update(**fields)
        return True, False
    bump_version(room_id, **fields)
    return True, True


def _iso(value):
    """Datas no mesmo formato do resto da API (o do DRF): ISO 8601 com Z."""
    if value is None:
        return None
    text = value.isoformat()
    return text[:-6] + "Z" if text.endswith("+00:00") else text


def _public_room_state(slug, status, state):
    if is_halloween(slug):
        # A TV é o juiz e o estado é dela: vai inteiro (HALLOWEEN.md aceita
        # que quem abrir o DevTools espie).
        return state if isinstance(state, dict) else {}
    # Jogo antigo: o mesmo corte do GET antigo. Import tardio porque
    # serializers importa este módulo.
    from .serializers import redact_room_state

    return redact_room_state(slug, status, state)


def sync_payload(code, *, viewer=None, known_version=None, mine=False, tv=False, now=None):
    """
    Resposta de GET /rooms/{code}/sync/, ou None se a sala não existe.

    viewer: filtro que acha, entre os jogadores da sala, quem chamou
    ({"user_id": ...} ou {"user__auth_token__key": ...}); None para a TV.
    known_version: a versão que o aparelho já tem (?v=).
    mine: o state dos outros jogadores vem null (economiza banda do celular).
    tv: marca a TV como conectada.

    Consultas: 1 (TV, nada mudou), 2 (celular, nada mudou); +2 quando mudou.
    """
    now = now or timezone.now()
    head = Room.objects.filter(code=code).values("id", "version", "tv_last_seen_at").first()
    if head is None:
        return None
    room_id = head["id"]
    bumped = False

    me = None
    if viewer:
        found = (
            Player.objects.filter(room_id=room_id, **viewer)
            .values_list("id", "last_seen_at")
            .first()
        )
        if found:
            me = found[0]
            bumped = mark_player_seen(me, room_id, found[1], now)[1] or bumped
    if tv:
        bumped = mark_tv_seen(room_id, head["tv_last_seen_at"], now)[1] or bumped

    # Se esta chamada mexeu na versão, o "nada mudou" já não vale.
    if not bumped and known_version is not None and known_version == head["version"]:
        return {"same": True, "v": head["version"], "t": now_ms(now)}

    # A versão é lida junto com o estado da sala e ANTES dos jogadores: assim
    # o v devolvido nunca é mais novo que os dados que vão junto.
    room = (
        Room.objects.filter(pk=room_id)
        .values(
            "code",
            "status",
            "version",
            "state",
            "fx",
            "tv_last_seen_at",
            "game__slug",
            "game__name",
            "game__min_players",
            "game__max_players",
        )
        .first()
    )
    if room is None:
        return None
    slug = room["game__slug"]
    # Jogo antigo tem segredo no estado de cada jogador e regras de quem vê o
    # quê que só o GET antigo conhece: aqui o state deles vem sempre null.
    show_states = is_halloween(slug)

    players = []
    rows = (
        Player.objects.filter(room_id=room_id)
        .order_by("joined_at", "id")
        .values("id", "name", "is_host", "ready", "joined_at", "last_seen_at", "state")
    )
    for row in rows:
        visible = show_states and (not mine or row["id"] == me)
        players.append(
            {
                "id": row["id"],
                "name": row["name"],
                "is_host": row["is_host"],
                "ready": row["ready"],
                "online": is_online(row["last_seen_at"], now),
                "joined_at": _iso(row["joined_at"]),
                "state": row["state"] if visible else None,
            }
        )

    return {
        "same": False,
        "v": room["version"],
        "t": now_ms(now),
        "me": me,
        "room": {
            "code": room["code"],
            "status": room["status"],
            "game": {
                "slug": slug,
                "name": room["game__name"],
                "min_players": room["game__min_players"],
                "max_players": room["game__max_players"],
            },
            "state": _public_room_state(slug, room["status"], room["state"]),
            "fx": room["fx"] if isinstance(room["fx"], dict) else {},
            "tv_connected": is_tv_connected(room["tv_last_seen_at"], now),
        },
        "players": players,
    }


def write_room_state(code, state, *, status=None, slug=None, now=None):
    """
    O juiz grava o estado inteiro da sala (e, se quiser, o status) e sobe a
    versão, tudo num UPDATE só.

    Só vale para sala em jogo de Halloween — e, se o juiz disser qual jogo
    está julgando (slug), só se ainda for esse: um juiz atrasado de um jogo
    que o host já trocou não pode atropelar o jogo novo.

    Devolve (versão nova, None) ou (None, NOT_FOUND | WRONG_GAME).
    """
    fields = {"state": state, "last_activity_at": now or timezone.now()}
    if status:
        fields["status"] = status
    rooms = Room.objects.filter(code=code, game__slug__in=HALLOWEEN_SLUGS)
    if slug:
        rooms = rooms.filter(game__slug=slug)
    with transaction.atomic():
        # O UPDATE vem antes da leitura de propósito: ele pega a trava de
        # escrita (no SQLite, esperando a vez em vez de dar "database is
        # locked"), e a leitura enxerga a versão exata desta gravação.
        if rooms.update(version=F("version") + 1, **fields):
            return Room.objects.filter(code=code).values_list("version", flat=True).first(), None
    if Room.objects.filter(code=code).exists():
        return None, WRONG_GAME
    return None, NOT_FOUND


def push_fx(code, payload, now=None):
    """
    Guarda um pedido de efeito para a TV: {id: anterior + 1, at: ms, ...},
    com scare, music e name quando vierem como texto. A TV executa os ids que
    ainda não viu. Devolve (fx, versão nova) ou None se a sala não existe.
    """
    now = now or timezone.now()
    entry = {}
    for key in FX_KEYS:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            entry[key] = value.strip()[:FX_MAX_LENGTH]
    with transaction.atomic():
        # Trava primeiro (UPDATE), lê depois: dois pedidos ao mesmo tempo não
        # saem com o mesmo id.
        if not Room.objects.filter(code=code).update(version=F("version") + 1, last_activity_at=now):
            return None
        row = Room.objects.filter(code=code).values("id", "fx", "version").first()
        previous = row["fx"] if isinstance(row["fx"], dict) else {}
        try:
            last_id = int(previous.get("id") or 0)
        except (TypeError, ValueError):
            last_id = 0
        fx = {"id": last_id + 1, "at": now_ms(now), **entry}
        Room.objects.filter(pk=row["id"]).update(fx=fx)
    return fx, row["version"]


def read_fx(code):
    """O último pedido de efeito da sala ({} se nunca houve), ou None se a sala não existe."""
    row = Room.objects.filter(code=code).values("fx").first()
    if row is None:
        return None
    return row["fx"] if isinstance(row["fx"], dict) else {}
