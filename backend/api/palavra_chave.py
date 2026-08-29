"""
Palavra-Chave — adaptação de Codenames.

Vinte e cinco palavras na mesa. Cada time tem um espião-mestre que enxerga o
gabarito e só pode falar uma palavra e um número. O time adivinha. Encostar no
assassino perde a partida na hora.
"""

import secrets

PALAVRA_CHAVE_SLUG = "palavra-chave"

GRID = 25
TEAM_BLUE = "azul"
TEAM_RED = "vermelho"
NEUTRAL = "neutro"
ASSASSIN = "assassino"

# O time que começa tem uma palavra a mais — e por isso joga primeiro.
FIRST_TEAM_WORDS = 9
SECOND_TEAM_WORDS = 8
ASSASSIN_WORDS = 1

WORDS = [
    "ÂNCORA", "ANEL", "ANJO", "ANTENA", "APOLO", "ARANHA", "ARCO", "AREIA",
    "ARMADURA", "ASA", "AZEITE", "BALA", "BALÃO", "BANCO", "BANDA", "BARCO",
    "BATERIA", "BICO", "BOLA", "BOLSA", "BOMBA", "BOTA", "BRAÇO", "BRASA",
    "BRUXA", "BÚSSOLA", "CABEÇA", "CABO", "CACHORRO", "CADEIA", "CAFÉ", "CAIXA",
    "CAMPO", "CANAL", "CANETA", "CANTO", "CAPA", "CARTA", "CASTELO", "CAVALO",
    "CENTRO", "CÉU", "CHAVE", "CHUVA", "CINEMA", "CIRCO", "COBRA", "COLA",
    "COMETA", "CONCHA", "COROA", "CORDA", "CORPO", "CORTE", "COSTA", "CRISTAL",
    "CRUZ", "CURVA", "DADO", "DEDO", "DENTE", "DESERTO", "DIAMANTE", "DISCO",
    "DOUTOR", "DRAGÃO", "ELEFANTE", "ESCADA", "ESCOLA", "ESCUDO", "ESPELHO",
    "ESPINHO", "ESTÁTUA", "ESTRELA", "FÁBRICA", "FACA", "FADA", "FANTASMA",
    "FARDA", "FAROL", "FEIRA", "FERRO", "FESTA", "FIGURA", "FILME", "FIO",
    "FLECHA", "FLOR", "FOGO", "FOGUETE", "FOLHA", "FONTE", "FORÇA", "FORMA",
    "FORNO", "FÓSSIL", "FRUTA", "GALO", "GARFO", "GARRAFA", "GATO", "GELO",
    "GIGANTE", "GLOBO", "GOLA", "GOTA", "GRAMA", "GRUTA", "GUERRA", "GUITARRA",
    "HOSPITAL", "IGREJA", "ILHA", "IMÃ", "ÍNDIO", "JANELA", "JARDIM", "JOELHO",
    "JOGO", "JORNAL", "LABIRINTO", "LÁGRIMA", "LAGO", "LÂMPADA", "LANÇA",
    "LARANJA", "LEÃO", "LEITE", "LENÇOL", "LETRA", "LIMA", "LÍNGUA", "LIVRO",
    "LOBO", "LUA", "LUVA", "MÁQUINA", "MAR", "MARTELO", "MÁSCARA", "MASSA",
    "MATA", "MEDALHA", "MEL", "MERCÚRIO", "MESA", "METRÔ", "MINA", "MISSA",
    "MOEDA", "MOLA", "MONSTRO", "MONTANHA", "MORCEGO", "MOTOR", "MUNDO",
    "MURO", "MÚSICA", "NAVE", "NEVE", "NINHO", "NOITE", "NORTE", "NOTA",
    "NUVEM", "OCEANO", "OLHO", "ONDA", "ORELHA", "OSSO", "OURO", "OVELHA",
    "OVO", "PADRE", "PALCO", "PALMA", "PANELA", "PANO", "PAPEL", "PARADA",
    "PAREDE", "PARQUE", "PASSARINHO", "PASSO", "PATA", "PATO", "PEDRA",
    "PEIXE", "PENA", "PIANO", "PILHA", "PINCEL", "PIRATA", "PISTA", "PLANETA",
    "PLANTA", "PLUMA", "POLVO", "PONTE", "PONTO", "PORTA", "PORTO", "PRAIA",
    "PRATA", "PRATO", "PRÉDIO", "PRESSA", "PRINCESA", "PRISÃO", "PULO",
    "QUADRO", "QUEIJO", "RABO", "RADIO", "RAINHA", "RAIO", "RAIZ", "RATO",
    "REDE", "REGRA", "REI", "RELÓGIO", "REMO", "RIO", "ROBÔ", "ROCHA", "RODA",
    "ROSA", "ROSTO", "ROUPA", "SAL", "SALA", "SANGUE", "SANTO", "SAPATO",
    "SAPO", "SEDA", "SELO", "SERRA", "SINAL", "SINO", "SOL", "SOLDADO",
    "SOMBRA", "SONHO", "SOPA", "SORTE", "SUCO", "TAMBOR", "TANQUE", "TAPETE",
    "TEATRO", "TECLA", "TEIA", "TELHADO", "TEMPO", "TERRA", "TESOURO", "TETO",
    "TIGRE", "TINTA", "TORRE", "TOURO", "TRAÇO", "TRAVESSA", "TREM", "TRENÓ",
    "TRIBO", "TRIGO", "TROMBETA", "TRONCO", "TÚNEL", "URSO", "VACA", "VAGA",
    "VALA", "VAPOR", "VARA", "VASO", "VEIA", "VELA", "VENTO", "VERÃO", "VERSO",
    "VIDA", "VIDRO", "VILA", "VINHO", "VIOLINO", "VULCÃO", "ZEBRA", "ZONA",
    "ABELHA", "ACORDE", "ÁGUIA", "AGULHA", "ALARME", "ALVO", "AMIGO", "AMOR",
    "ARANHOL", "ARTE", "ASSALTO", "ATLAS", "AVIÃO", "BAILE", "BAMBU", "BANHO",
    "BARBA", "BARRA", "BASE", "BERÇO", "BILHETE", "BOCA", "BOI", "BONECA",
    "BOTÃO", "BRINCO", "CACTO", "CAMELO", "CAMISA", "CANOA", "CARNE", "CARRO",
    "CARTÃO", "CASACO", "CASCA", "CHÁ", "CHAPÉU", "CHIFRE", "CHOQUE", "CIDADE",
    "CLUBE", "COBRE", "COELHO", "COLHER", "COLINA", "COLUNA", "CONTA", "COURO",
    "CRAVO", "CREME", "DANÇA", "DÍVIDA", "DOMINÓ", "ESCOVA", "ESQUADRO",
    "ESQUINA", "FALCÃO", "FANTASIA", "FÉRIAS", "FERRAMENTA", "FILA", "FÍGADO",
    "FOCA", "FOME", "FORTALEZA", "FÓSFORO", "FUMAÇA", "FUNDO", "GAIOLA",
    "GALHO", "GARÇOM", "GAVETA", "GERAÇÃO", "GIRAFA", "GOLPE", "GRADE",
    "GRAVATA", "GRILO", "GRUPO", "HERÓI", "HORA", "IDEIA", "IMPÉRIO", "JAULA",
    "JUIZ", "LAÇO", "LADRÃO", "LAMA", "LANTERNA", "LENHA", "LEQUE", "LIMÃO",
    "LINHA", "LOJA", "LOUCO", "LUZ", "MACACO", "MADEIRA", "MALA", "MANCHA",
    "MANTO", "MAPA", "MARCA", "MARFIM", "MASSAGEM", "MEDO", "MEIA", "MEMÓRIA",
    "MERGULHO", "MILHO", "MOINHO", "MOLDURA", "MORRO", "MOSCA", "MUDANÇA",
    "NÓ", "NOME", "NÚMERO", "ONÇA", "ÓRGÃO", "PACOTE", "PALHAÇO", "PALAVRA",
    "PARAFUSO", "PARTIDA", "PÁSSARO", "PASTOR", "PENHASCO", "PÉROLA", "PESO",
    "PICADA", "PIMENTA", "PINGUIM", "PIPA", "PLACA", "POÇO", "POEIRA",
    "POLÍCIA", "PORÃO", "POSTE", "PRAÇA", "PRAZO", "PRÊMIO", "PROVA", "PULSO",
    "QUARTO", "QUEDA", "RAMO", "RANCHO", "REFLEXO", "REINO", "RESGATE",
    "RETRATO", "RISCO", "ROLO", "SACO", "SAFRA", "SEGREDO", "SEMENTE", "SILÊNCIO",
    "SOMBRINHA", "SORRISO", "SUL", "TALHER", "TAMPA", "TARDE", "TELA",
    "TESOURA", "TIJOLO", "TIRO", "TOALHA", "TOCA", "TRAPO", "TROCO", "TROPA",
    "TUBO", "TURMA", "VALE", "VASSOURA", "VELHO", "VENENO", "VESTIDO", "VIAGEM",
    "VIZINHO", "VOZ",
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def initialize(players, rng=None):
    """
    Divide a mesa em dois times, sorteia um espião-mestre para cada e monta
    a grade. Precisa de pelo menos 4 pessoas: dois times de dois.
    """
    rng = _rng(rng)
    if len(players) < 4:
        return None

    shuffled = list(players)
    rng.shuffle(shuffled)
    half = len(shuffled) // 2
    blue = shuffled[:half]
    red = shuffled[half:]

    blue_master = rng.choice(blue)
    red_master = rng.choice(red)

    words = rng.sample(WORDS, GRID)
    first = rng.choice([TEAM_BLUE, TEAM_RED])
    second = TEAM_RED if first == TEAM_BLUE else TEAM_BLUE

    key = (
        [first] * FIRST_TEAM_WORDS
        + [second] * SECOND_TEAM_WORDS
        + [ASSASSIN] * ASSASSIN_WORDS
    )
    key += [NEUTRAL] * (GRID - len(key))
    rng.shuffle(key)

    for player in players:
        player_state = player.state or {}
        player_state["team"] = TEAM_BLUE if player in blue else TEAM_RED
        is_master = player.id in (blue_master.id, red_master.id)
        player_state["is_spymaster"] = is_master
        # O gabarito viaja no estado do próprio espião-mestre: assim ele
        # nunca precisa estar no estado da sala, que é público.
        player_state["key"] = list(key) if is_master else None
        player_state["words"] = list(words) if is_master else None
        player.state = player_state
        player.save(update_fields=["state"])

    return {
        "game": PALAVRA_CHAVE_SLUG,
        "phase": "clue",
        "words": words,
        "key": key,
        "revealed": [False] * GRID,
        "turn_team": first,
        "first_team": first,
        "clue": None,
        "guesses_left": 0,
        "winner": None,
        "loss_reason": None,
        "spymasters": {TEAM_BLUE: blue_master.id, TEAM_RED: red_master.id},
        "log": [],
    }


def remaining(state, team):
    return sum(
        1
        for index, owner in enumerate(state["key"])
        if owner == team and not state["revealed"][index]
    )


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _end(state, winner, reason):
    state["phase"] = "ended"
    state["winner"] = winner
    state["loss_reason"] = reason
    state["clue"] = None
    state["guesses_left"] = 0


def _switch_turn(state):
    state["turn_team"] = TEAM_RED if state["turn_team"] == TEAM_BLUE else TEAM_BLUE
    state["phase"] = "clue"
    state["clue"] = None
    state["guesses_left"] = 0


def give_clue(state, player, word, count):
    if state.get("phase") != "clue":
        return "O time já está adivinhando."
    player_state = player.state or {}
    if not player_state.get("is_spymaster"):
        return "Só o espião-mestre dá a dica."
    if player_state.get("team") != state.get("turn_team"):
        return "Não é a vez do seu time."

    clue = (word or "").strip()
    if not clue:
        return "Escreva uma dica."
    if " " in clue:
        return "A dica é uma palavra só."
    if clue.upper() in [w.upper() for w in state["words"]]:
        return "A dica não pode ser uma palavra da mesa."
    if not 0 <= count <= 9:
        return "O número vai de 0 a 9."

    state["clue"] = {"word": clue[:24].upper(), "count": count, "team": state["turn_team"]}
    # O palpite extra é o que permite recuperar uma dica antiga.
    state["guesses_left"] = count + 1 if count > 0 else GRID
    state["phase"] = "guess"
    _log(state, {"type": "clue", "team": state["turn_team"], "word": clue.upper(), "count": count})
    return None


def guess_word(state, player, index):
    if state.get("phase") != "guess":
        return "Aguarde a dica do seu espião-mestre."
    player_state = player.state or {}
    if player_state.get("is_spymaster"):
        return "O espião-mestre não adivinha."
    if player_state.get("team") != state.get("turn_team"):
        return "Não é a vez do seu time."
    if not 0 <= index < GRID:
        return "Palavra inválida."
    if state["revealed"][index]:
        return "Essa palavra já foi revelada."

    state["revealed"][index] = True
    owner = state["key"][index]
    team = state["turn_team"]
    other = TEAM_RED if team == TEAM_BLUE else TEAM_BLUE
    _log(
        state,
        {
            "type": "guess",
            "team": team,
            "player_id": player.id,
            "word": state["words"][index],
            "owner": owner,
        },
    )

    if owner == ASSASSIN:
        _end(state, other, "assassino")
        return None

    if remaining(state, team) == 0:
        _end(state, team, "palavras")
        return None
    if remaining(state, other) == 0:
        _end(state, other, "palavras")
        return None

    if owner != team:
        # Errou: o turno passa na hora, mesmo que ainda houvesse palpites.
        _switch_turn(state)
        return None

    state["guesses_left"] = state.get("guesses_left", 1) - 1
    if state["guesses_left"] <= 0:
        _switch_turn(state)
    return None


def end_turn(state, player):
    """Parar por conta própria é jogada: evita entregar palavra ao adversário."""
    if state.get("phase") != "guess":
        return "Não há palpites em andamento."
    player_state = player.state or {}
    if player_state.get("team") != state.get("turn_team"):
        return "Não é a vez do seu time."
    if player_state.get("is_spymaster"):
        return "O espião-mestre não encerra o turno."
    _log(state, {"type": "pass", "team": state["turn_team"]})
    _switch_turn(state)
    return None


def public_board(state):
    """Grade como a mesa vê: a cor só aparece depois que a palavra é virada."""
    return [
        {
            "word": word,
            "revealed": state["revealed"][index],
            "owner": state["key"][index] if state["revealed"][index] else None,
        }
        for index, word in enumerate(state["words"])
    ]


def redact_state(state):
    """
    O gabarito nunca vai para a sala — os espiões-mestres recebem uma cópia
    no próprio estado de jogador. A mesa só vê a cor do que já foi virado.
    """
    safe = dict(state)
    safe.pop("key", None)
    safe.pop("words", None)
    safe["board"] = public_board(state)
    safe["remaining"] = {
        TEAM_BLUE: remaining(state, TEAM_BLUE),
        TEAM_RED: remaining(state, TEAM_RED),
    }
    return safe
