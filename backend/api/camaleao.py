"""
Camaleão — adaptação de The Chameleon.

Uma grade de 16 palavras num tema. Todo mundo sabe qual é a palavra secreta —
menos o camaleão, que só vê a grade. Cada um diz UMA palavra relacionada; o
camaleão precisa blefar sem saber do que se trata. Depois a mesa vota.

Se o camaleão for pego, ainda tem uma chance: acertar a palavra secreta.
"""

import secrets
import unicodedata

CAMALEAO_SLUG = "camaleao"

CLUE_SECONDS = 45
VOTE_SECONDS = 120
GUESS_SECONDS = 30
REVEAL_SECONDS = 14

ESCAPE_POINTS = 2
CAUGHT_BUT_GUESSED_POINTS = 1
CATCH_POINTS = 2

TOPICS = [
    ("Frutas", ["Banana", "Maçã", "Uva", "Manga", "Abacaxi", "Morango", "Melancia", "Laranja", "Limão", "Pera", "Kiwi", "Goiaba", "Caju", "Coco", "Cereja", "Maracujá"]),
    ("Animais", ["Cachorro", "Gato", "Elefante", "Leão", "Cobra", "Águia", "Tubarão", "Golfinho", "Macaco", "Cavalo", "Vaca", "Galinha", "Formiga", "Baleia", "Urso", "Lobo"]),
    ("Profissões", ["Médico", "Professor", "Bombeiro", "Advogado", "Cozinheiro", "Piloto", "Policial", "Dentista", "Jornalista", "Engenheiro", "Ator", "Pedreiro", "Motorista", "Padeiro", "Juiz", "Enfermeiro"]),
    ("Esportes", ["Futebol", "Vôlei", "Natação", "Tênis", "Basquete", "Boxe", "Surfe", "Ciclismo", "Corrida", "Xadrez", "Judô", "Ginástica", "Golfe", "Skate", "Handebol", "Esgrima"]),
    ("Comida de festa", ["Coxinha", "Brigadeiro", "Pastel", "Pizza", "Cachorro-quente", "Bolo", "Pipoca", "Empada", "Esfiha", "Salgadinho", "Refrigerante", "Churrasco", "Torta", "Quibe", "Pão de queijo", "Beijinho"]),
    ("Países", ["Brasil", "Argentina", "Japão", "Itália", "Egito", "Canadá", "México", "Alemanha", "Índia", "Austrália", "China", "França", "Portugal", "Rússia", "Chile", "Espanha"]),
    ("Cômodos da casa", ["Cozinha", "Banheiro", "Quarto", "Sala", "Garagem", "Varanda", "Lavanderia", "Escritório", "Sótão", "Porão", "Corredor", "Despensa", "Quintal", "Closet", "Escada", "Hall"]),
    ("Instrumentos", ["Violão", "Piano", "Bateria", "Flauta", "Violino", "Guitarra", "Saxofone", "Pandeiro", "Trompete", "Harpa", "Cavaquinho", "Acordeom", "Baixo", "Tambor", "Gaita", "Triângulo"]),
    ("Transportes", ["Carro", "Ônibus", "Bicicleta", "Avião", "Navio", "Trem", "Metrô", "Moto", "Helicóptero", "Patinete", "Caminhão", "Barco", "Foguete", "Táxi", "Bonde", "Balão"]),
    ("Super-heróis", ["Batman", "Superman", "Mulher-Maravilha", "Homem-Aranha", "Hulk", "Thor", "Homem de Ferro", "Flash", "Aquaman", "Pantera Negra", "Capitão América", "Wolverine", "Viúva Negra", "Deadpool", "Lanterna Verde", "Doutor Estranho"]),
    ("Sobremesas", ["Pudim", "Sorvete", "Brigadeiro", "Mousse", "Bolo", "Torta", "Pavê", "Gelatina", "Brownie", "Cheesecake", "Cocada", "Quindim", "Churros", "Açaí", "Petit gâteau", "Paçoca"]),
    ("Objetos da escola", ["Caderno", "Lápis", "Borracha", "Mochila", "Régua", "Apontador", "Estojo", "Caneta", "Tesoura", "Cola", "Livro", "Lousa", "Giz", "Merenda", "Carteira", "Apagador"]),
    ("Bebidas", ["Café", "Chá", "Suco", "Refrigerante", "Cerveja", "Vinho", "Água", "Leite", "Caipirinha", "Milkshake", "Energético", "Chocolate quente", "Água de coco", "Limonada", "Whisky", "Champanhe"]),
    ("Filmes famosos", ["Titanic", "Matrix", "Frozen", "Avatar", "Vingadores", "Jurassic Park", "Shrek", "Star Wars", "Harry Potter", "O Rei Leão", "Toy Story", "Homem-Aranha", "Batman", "Piratas do Caribe", "Procurando Nemo", "Barbie"]),
    ("Lugares da cidade", ["Padaria", "Farmácia", "Escola", "Hospital", "Shopping", "Praça", "Igreja", "Cinema", "Banco", "Posto", "Mercado", "Academia", "Restaurante", "Biblioteca", "Rodoviária", "Delegacia"]),
    ("Roupas", ["Camiseta", "Calça", "Vestido", "Saia", "Casaco", "Meia", "Tênis", "Chinelo", "Boné", "Cachecol", "Luva", "Jaqueta", "Bermuda", "Gravata", "Pijama", "Biquíni"]),
    ("Cores", ["Vermelho", "Azul", "Verde", "Amarelo", "Roxo", "Rosa", "Laranja", "Preto", "Branco", "Cinza", "Marrom", "Dourado", "Prata", "Bege", "Turquesa", "Vinho"]),
    ("Brinquedos", ["Boneca", "Carrinho", "Pipa", "Bola", "Lego", "Pião", "Quebra-cabeça", "Videogame", "Bicicleta", "Patins", "Ioiô", "Bolinha de gude", "Urso de pelúcia", "Peteca", "Cubo mágico", "Dominó"]),
    ("Festas e datas", ["Natal", "Carnaval", "Páscoa", "Réveillon", "Halloween", "Festa junina", "Aniversário", "Casamento", "Dia das Mães", "Formatura", "Chá de bebê", "Copa do Mundo", "Dia dos Namorados", "Ano Novo Chinês", "Black Friday", "Independência"]),
    ("Coisas do mar", ["Peixe", "Concha", "Areia", "Onda", "Tubarão", "Polvo", "Barco", "Farol", "Sereia", "Coral", "Caranguejo", "Prancha", "Âncora", "Ilha", "Tartaruga", "Algas"]),
    ("Aparelhos de casa", ["Geladeira", "Fogão", "Micro-ondas", "Televisão", "Máquina de lavar", "Ventilador", "Liquidificador", "Ferro de passar", "Aspirador", "Chuveiro", "Ar-condicionado", "Torradeira", "Cafeteira", "Secador", "Rádio", "Batedeira"]),
    ("Sentimentos", ["Alegria", "Tristeza", "Raiva", "Medo", "Saudade", "Ciúme", "Vergonha", "Orgulho", "Tédio", "Ansiedade", "Amor", "Nojo", "Surpresa", "Culpa", "Esperança", "Inveja"]),
    ("Doces de infância", ["Bala", "Chiclete", "Pirulito", "Bis", "Paçoca", "Maria-mole", "Sonho de Valsa", "Suflair", "Chocolate", "Jujuba", "Serenata", "Diamante Negro", "Algodão-doce", "Chup Chup", "Trident", "Halls"]),
    ("Coisas da praia", ["Guarda-sol", "Protetor solar", "Canga", "Biquíni", "Cadeira", "Cooler", "Bola", "Prancha", "Chinelo", "Óculos escuros", "Milho", "Água de coco", "Areia", "Toalha", "Frescobol", "Boia"]),
    ("Personagens de desenho", ["Mickey", "Bob Esponja", "Pikachu", "Homer Simpson", "Scooby-Doo", "Tom e Jerry", "Pernalonga", "Pica-Pau", "Goku", "Naruto", "Mônica", "Cebolinha", "Peppa Pig", "Garfield", "Snoopy", "Popeye"]),
    ("Lugares para viajar", ["Praia", "Montanha", "Fazenda", "Cachoeira", "Cidade grande", "Deserto", "Ilha", "Neve", "Floresta", "Parque de diversões", "Cruzeiro", "Acampamento", "Resort", "Museu", "Vinícola", "Trilha"]),
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _normalize(text):
    lowered = unicodedata.normalize("NFKD", str(text or "").lower())
    stripped = "".join(ch for ch in lowered if not unicodedata.combining(ch))
    return " ".join(stripped.split())


def _new_round(state, players, rng, now_ts):
    order = state["order"]
    used = state.get("used_topics") or []
    available = [i for i in range(len(TOPICS)) if i not in used]
    if not available:
        available = list(range(len(TOPICS)))
        used = []
    topic_index = rng.choice(available)
    used.append(topic_index)

    _, words = TOPICS[topic_index]
    secret_index = rng.randrange(len(words))
    chameleon_id = rng.choice(order)

    # A ordem das dicas roda a cada rodada: quem falou primeiro fala por ultimo.
    start = (state.get("round", 1) - 1) % len(order)
    clue_order = order[start:] + order[:start]

    state.update(
        {
            "phase": "clues",
            "topic_index": topic_index,
            "secret_index": secret_index,
            "chameleon_id": chameleon_id,
            "clue_order": clue_order,
            "clue_turn": 0,
            "clues": {},
            "votes": {},
            "used_topics": used,
            "caught": None,
            "chameleon_guess": None,
            "deadline_ts": now_ts + CLUE_SECONDS,
        }
    )
    for player in players:
        player_state = player.state or {}
        player_state["is_chameleon"] = player.id == chameleon_id
        # So quem NAO e o camaleao recebe a palavra secreta.
        player_state["secret_word"] = None if player.id == chameleon_id else words[secret_index]
        player_state["clue"] = None
        player_state["vote"] = None
        player.state = player_state
        player.save(update_fields=["state"])
    return state


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    if len(players) < 3:
        return None
    order = [p.id for p in players]
    rng.shuffle(order)

    for player in players:
        player_state = player.state or {}
        player_state["score"] = 0
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": CAMALEAO_SLUG,
        "order": order,
        "round": 1,
        "max_rounds": max(4, min(len(order) * 2, 10)),
        "scores": {str(p.id): 0 for p in players},
        "used_topics": [],
        "last": None,
        "winners": [],
    }
    return _new_round(state, players, rng, now_ts)


def topic(state):
    index = state.get("topic_index")
    if index is None:
        return None, []
    return TOPICS[index]


def current_clue_giver(state):
    order = state.get("clue_order") or []
    turn = state.get("clue_turn", 0)
    if turn >= len(order):
        return None
    return order[turn]


def submit_clue(state, player, word, now_ts):
    if state.get("phase") != "clues":
        return "Não é hora de dar dica."
    if current_clue_giver(state) != player.id:
        return "Aguarde a sua vez."
    clean = (word or "").strip()
    if not clean:
        return "Diga uma palavra."
    if len(clean.split()) > 2:
        return "Uma palavra só (duas, no máximo)."
    _, words = topic(state)
    if _normalize(clean) in {_normalize(w) for w in words}:
        return "A dica não pode ser uma palavra da grade."

    state.setdefault("clues", {})[str(player.id)] = clean[:30]
    player_state = player.state or {}
    player_state["clue"] = clean[:30]
    player.state = player_state
    player.save(update_fields=["state"])

    state["clue_turn"] = state.get("clue_turn", 0) + 1
    if current_clue_giver(state) is None:
        state["phase"] = "vote"
        state["deadline_ts"] = now_ts + VOTE_SECONDS
    else:
        state["deadline_ts"] = now_ts + CLUE_SECONDS
    return None


def cast_vote(state, player, target_id):
    if state.get("phase") != "vote":
        return "A votação não está aberta."
    if target_id == player.id:
        return "Você não pode votar em si."
    if target_id not in (state.get("order") or []):
        return "Jogador inválido."
    state.setdefault("votes", {})[str(player.id)] = target_id
    player_state = player.state or {}
    player_state["vote"] = target_id
    player.state = player_state
    player.save(update_fields=["state"])
    return None


def votes_complete(state):
    return len(state.get("votes") or {}) >= len(state.get("order") or [])


def _tally(state):
    counts = {}
    for target in (state.get("votes") or {}).values():
        counts[target] = counts.get(target, 0) + 1
    if not counts:
        return None, counts
    best = max(counts.values())
    leaders = [pid for pid, n in counts.items() if n == best]
    # Empate deixa o camaleao escapar: a mesa nao se decidiu.
    return (leaders[0] if len(leaders) == 1 else None), counts


def resolve_vote(state, players, now_ts):
    accused, counts = _tally(state)
    chameleon = state.get("chameleon_id")
    caught = accused == chameleon
    state["caught"] = caught
    state["vote_counts"] = {str(k): v for k, v in counts.items()}

    if caught:
        # Pego, mas com direito a um chute na palavra.
        state["phase"] = "guess"
        state["deadline_ts"] = now_ts + GUESS_SECONDS
        return None

    return _finish_round(state, players, now_ts, chameleon_won=True, guessed=None)


def chameleon_guess(state, player, word, players, now_ts):
    if state.get("phase") != "guess":
        return "Não é hora do chute."
    if player.id != state.get("chameleon_id"):
        return "Só o camaleão chuta."
    _, words = topic(state)
    secret = words[state.get("secret_index", 0)]
    guessed = _normalize(word) == _normalize(secret)
    state["chameleon_guess"] = (word or "").strip()[:40]
    return _finish_round(state, players, now_ts, chameleon_won=guessed, guessed=guessed)


def _finish_round(state, players, now_ts, chameleon_won, guessed):
    chameleon = state.get("chameleon_id")
    scores = state.get("scores") or {}
    _, words = topic(state)
    secret = words[state.get("secret_index", 0)]

    if chameleon_won and not state.get("caught"):
        scores[str(chameleon)] = scores.get(str(chameleon), 0) + ESCAPE_POINTS
        outcome = "escapou"
    elif chameleon_won and guessed:
        scores[str(chameleon)] = scores.get(str(chameleon), 0) + CAUGHT_BUT_GUESSED_POINTS
        outcome = "pego_mas_acertou"
    else:
        for pid in state.get("order") or []:
            if pid != chameleon:
                scores[str(pid)] = scores.get(str(pid), 0) + CATCH_POINTS
        outcome = "pego"

    state["scores"] = scores
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    state["last"] = {
        "round": state.get("round"),
        "chameleon_id": chameleon,
        "secret_word": secret,
        "outcome": outcome,
        "guess": state.get("chameleon_guess"),
        "clues": dict(state.get("clues") or {}),
        "vote_counts": dict(state.get("vote_counts") or {}),
    }
    for player in players:
        player_state = player.state or {}
        player_state["score"] = scores.get(str(player.id), 0)
        player.state = player_state
        player.save(update_fields=["state"])
    return None


def _finish_game(state):
    scores = state.get("scores") or {}
    state["phase"] = "ended"
    state["deadline_ts"] = None
    if scores:
        best = max(scores.values())
        state["winners"] = [int(pid) for pid, v in scores.items() if v == best]
    return state


def tick(state, players, now_ts, rng=None):
    rng = _rng(rng)
    phase = state.get("phase")
    deadline = state.get("deadline_ts")
    expired = bool(deadline and now_ts > deadline)

    if phase == "clues" and expired:
        # Quem nao falou a tempo fica com a dica em branco e a vez passa.
        giver = current_clue_giver(state)
        if giver is not None:
            state.setdefault("clues", {})[str(giver)] = "—"
            state["clue_turn"] = state.get("clue_turn", 0) + 1
        if current_clue_giver(state) is None:
            state["phase"] = "vote"
            state["deadline_ts"] = now_ts + VOTE_SECONDS
        else:
            state["deadline_ts"] = now_ts + CLUE_SECONDS
        return state

    if phase == "vote" and (votes_complete(state) or expired):
        resolve_vote(state, players, now_ts)
        return state

    if phase == "guess" and expired:
        # Sem chute a tempo: o camaleao foi pego e errou.
        _finish_round(state, players, now_ts, chameleon_won=False, guessed=False)
        return state

    if phase == "reveal" and expired:
        if state.get("round", 1) >= state.get("max_rounds", 1):
            return _finish_game(state)
        state["round"] = state.get("round", 1) + 1
        return _new_round(state, players, rng, now_ts)

    return state


def redact_state(state):
    """A palavra secreta e o camaleao ficam escondidos ate a revelacao."""
    safe = dict(state)
    title, words = topic(state)
    safe["topic"] = {"title": title, "words": words}
    safe.pop("topic_index", None)
    if safe.get("phase") not in {"reveal", "ended"}:
        safe.pop("secret_index", None)
        safe.pop("chameleon_id", None)
    # Os votos individuais so aparecem no fim da rodada.
    if safe.get("phase") == "vote":
        safe["votes_cast"] = len(state.get("votes") or {})
        safe.pop("votes", None)
    return safe
