"""
O Infiltrado — adaptação de Spyfall.

Todo mundo recebe o mesmo local e um papel diferente dentro dele. Menos um: o
infiltrado só sabe que não sabe. A mesa conversa fazendo perguntas que provem
conhecimento do lugar sem entregá-lo, e o infiltrado tenta descobrir onde está
antes de ser desmascarado.

A lista de locais é pública de propósito — é dela que o infiltrado chuta.
"""

import secrets

INFILTRADO_SLUG = "o-infiltrado"

ROUND_SECONDS = 8 * 60

LOCATIONS = [
    ("Avião em voo", ["Piloto", "Comissário", "Passageiro de primeira classe", "Clandestino", "Criança agitada", "Mecânico"]),
    ("Hospital", ["Cirurgião", "Paciente", "Enfermeiro", "Recepcionista", "Visitante", "Estagiário"]),
    ("Escola", ["Diretor", "Professor", "Aluno repetente", "Inspetor", "Merendeira", "Zelador"]),
    ("Cassino", ["Crupiê", "Segurança", "Apostador viciado", "Gerente", "Garçonete", "Trapaceiro"]),
    ("Navio pirata", ["Capitão", "Imediato", "Grumete", "Cozinheiro", "Prisioneiro", "Vigia"]),
    ("Estação espacial", ["Comandante", "Engenheiro", "Cientista", "Turista bilionário", "Médico", "Robô de bordo"]),
    ("Praia", ["Salva-vidas", "Vendedor de picolé", "Turista queimado", "Surfista", "Fotógrafo", "Criança com balde"]),
    ("Banco", ["Gerente", "Caixa", "Cliente nervoso", "Segurança", "Assaltante", "Auditor"]),
    ("Circo", ["Palhaço", "Trapezista", "Domador", "Bilheteiro", "Mágico", "Espectador"]),
    ("Restaurante caro", ["Chef", "Garçom", "Crítico gastronômico", "Casal em primeiro encontro", "Sommelier", "Lavador de pratos"]),
    ("Delegacia", ["Delegado", "Escrivão", "Detido", "Advogado", "Testemunha", "Perito"]),
    ("Estádio de futebol", ["Juiz", "Goleiro", "Torcedor fanático", "Técnico", "Vendedor de cerveja", "Repórter"]),
    ("Supermercado", ["Operador de caixa", "Repositor", "Cliente com lista", "Segurança", "Gerente", "Promotor de queijo"]),
    ("Metrô lotado", ["Maquinista", "Passageiro atrasado", "Batedor de carteira", "Músico ambulante", "Fiscal", "Turista perdido"]),
    ("Hotel de luxo", ["Recepcionista", "Camareira", "Hóspede", "Manobrista", "Gerente noturno", "Detetive particular"]),
    ("Set de filmagem", ["Diretor", "Ator principal", "Dublê", "Figurante", "Maquiador", "Produtor"]),
    ("Museu", ["Curador", "Guarda", "Visitante", "Restaurador", "Ladrão de arte", "Guia"]),
    ("Submarino", ["Comandante", "Sonarista", "Cozinheiro", "Mergulhador", "Engenheiro", "Recruta"]),
    ("Festa de casamento", ["Noiva", "Padrinho", "DJ", "Fotógrafo", "Tia bêbada", "Garçom"]),
    ("Acampamento na floresta", ["Monitor", "Escoteiro", "Cozinheiro", "Guarda-florestal", "Biólogo", "Perdido"]),
    ("Base militar", ["General", "Sentinela", "Recruta", "Espião", "Médico", "Cozinheiro"]),
    ("Estação de esqui", ["Instrutor", "Turista com perna quebrada", "Operador do teleférico", "Barista", "Resgatista", "Snowboarder"]),
    ("Trem noturno", ["Maquinista", "Condutor", "Passageiro insone", "Vendedor de café", "Fugitivo", "Inspetor"]),
    ("Zoológico", ["Veterinário", "Tratador", "Visitante", "Bilheteiro", "Biólogo", "Criança chorando"]),
    ("Teatro", ["Ator", "Ponto", "Iluminador", "Espectador", "Diretor", "Bilheteira"]),
    ("Prisão", ["Diretor", "Carcereiro", "Detento antigo", "Novato", "Advogado", "Cozinheiro"]),
    ("Sítio arqueológico", ["Arqueólogo", "Estudante", "Guia local", "Financiador", "Fotógrafo", "Saqueador"]),
    ("Consultório de dentista", ["Dentista", "Paciente apavorado", "Recepcionista", "Auxiliar", "Representante", "Criança"]),
    ("Balada", ["DJ", "Segurança", "Barman", "Frequentador", "Dono", "Fiscal da prefeitura"]),
    ("Fazenda", ["Fazendeiro", "Vaqueiro", "Veterinário", "Peão", "Visitante da cidade", "Cozinheira"]),
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def location_names():
    return [name for name, _ in LOCATIONS]


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    if len(players) < 3:
        return None

    name, roles = rng.choice(LOCATIONS)
    order = [player.id for player in players]
    rng.shuffle(order)
    spy_id = rng.choice(order)

    available = list(roles)
    rng.shuffle(available)
    for index, player in enumerate(players):
        player_state = player.state or {}
        if player.id == spy_id:
            player_state["is_spy"] = True
            player_state["location"] = None
            player_state["role"] = None
        else:
            player_state["is_spy"] = False
            player_state["location"] = name
            player_state["role"] = available[index % len(available)]
        player.state = player_state
        player.save(update_fields=["state"])

    return {
        "game": INFILTRADO_SLUG,
        "phase": "playing",
        "order": order,
        "location": name,
        "spy_id": spy_id,
        "locations": location_names(),
        "deadline_ts": now_ts + ROUND_SECONDS,
        "accusation": None,
        "winner": None,
        "reason": None,
        "log": [],
    }


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _end(state, winner, reason):
    state["phase"] = "ended"
    state["winner"] = winner
    state["reason"] = reason
    state["accusation"] = None
    state["deadline_ts"] = None


def accuse(state, accuser_id, accused_id):
    """Abre uma votação. Uma acusação errada entrega o jogo ao infiltrado."""
    if state.get("phase") != "playing":
        return "Não é hora de acusar."
    if state.get("accusation"):
        return "Já existe uma acusação em votação."
    order = state.get("order") or []
    if accused_id not in order or accuser_id not in order:
        return "Jogador inválido."
    if accused_id == accuser_id:
        return "Você não pode se acusar."

    state["accusation"] = {
        "accuser_id": accuser_id,
        "accused_id": accused_id,
        # O acusador já entra votando a favor da própria acusação.
        "votes": {str(accuser_id): True},
    }
    state["phase"] = "voting"
    _log(state, {"type": "accuse", "accuser_id": accuser_id, "accused_id": accused_id})
    return None


def vote_accusation(state, player_id, agree):
    if state.get("phase") != "voting":
        return "Não há acusação em votação."
    accusation = state.get("accusation") or {}
    if player_id == accusation.get("accused_id"):
        return "O acusado não vota."
    if player_id not in (state.get("order") or []):
        return "Você não está nesta partida."
    accusation.setdefault("votes", {})[str(player_id)] = bool(agree)
    state["accusation"] = accusation
    return None


def accusation_complete(state):
    accusation = state.get("accusation") or {}
    voters = [pid for pid in (state.get("order") or []) if pid != accusation.get("accused_id")]
    return len(accusation.get("votes") or {}) >= len(voters)


def resolve_accusation(state):
    """
    A acusação só vale por unanimidade — do contrário a mesa condenaria
    qualquer um no primeiro palpite.
    """
    accusation = state.get("accusation") or {}
    votes = accusation.get("votes") or {}
    unanimous = bool(votes) and all(votes.values())
    accused_id = accusation.get("accused_id")

    if not unanimous:
        state["phase"] = "playing"
        state["accusation"] = None
        _log(state, {"type": "accusation_failed", "accused_id": accused_id})
        return None

    if accused_id == state.get("spy_id"):
        _end(state, "mesa", "infiltrado_desmascarado")
    else:
        _end(state, "infiltrado", "acusacao_errada")
    _log(state, {"type": "accusation_resolved", "accused_id": accused_id})
    return None


def spy_guess(state, player_id, location):
    """O infiltrado pode encerrar a qualquer momento apostando no local."""
    if state.get("phase") not in {"playing", "voting"}:
        return "A partida não está em andamento."
    if player_id != state.get("spy_id"):
        return "Só o infiltrado pode chutar o local."
    if location not in (state.get("locations") or []):
        return "Local inválido."

    correct = location == state.get("location")
    _log(state, {"type": "spy_guess", "guess": location, "correct": correct})
    _end(state, "infiltrado" if correct else "mesa", "chute_do_infiltrado")
    return None


def tick(state, now_ts):
    """Tempo esgotado sem desmascarar: o infiltrado sobreviveu e vence."""
    if state.get("phase") != "playing":
        return state
    deadline = state.get("deadline_ts")
    if deadline and now_ts > deadline:
        _end(state, "infiltrado", "tempo_esgotado")
    return state


def redact_state(state):
    """O local e a identidade do infiltrado são o segredo da partida."""
    safe = dict(state)
    if safe.get("phase") != "ended":
        safe.pop("location", None)
        safe.pop("spy_id", None)
    return safe
