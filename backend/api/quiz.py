"""
Quiz da Mesa — perguntas de múltipla escolha com bônus de velocidade.

A TV mostra a pergunta e quatro opções. Cada um toca a resposta no celular.
Acertou, ganha 100 pontos mais um bônus proporcional ao tempo que sobrou.
Na revelação a TV mostra quantos foram em cada opção.

A TV é o painel. O celular é o botão.
"""

import secrets

QUIZ_SLUG = "quiz-da-mesa"

ROUNDS = 10
QUESTION_SECONDS = 20
REVEAL_SECONDS = 8
BASE_POINTS = 100
SPEED_BONUS = 100

# (pergunta, opcoes, indice da correta). As opcoes sao embaralhadas na partida.
QUESTIONS = [
    ("Qual é a capital da Austrália?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2),
    ("Qual é o maior planeta do Sistema Solar?", ["Saturno", "Júpiter", "Netuno", "Urano"], 1),
    ("Quantos lados tem um hexágono?", ["5", "6", "7", "8"], 1),
    ("Quem escreveu Dom Casmurro?", ["José de Alencar", "Machado de Assis", "Graciliano Ramos", "Jorge Amado"], 1),
    ("Qual elemento tem o símbolo O?", ["Ouro", "Ósmio", "Oxigênio", "Oganessônio"], 2),
    ("Em que ano o Brasil sediou a Copa do Mundo pela segunda vez?", ["2010", "2014", "2018", "2006"], 1),
    ("Qual é o maior oceano do planeta?", ["Atlântico", "Índico", "Pacífico", "Ártico"], 2),
    ("Qual é a moeda do Japão?", ["Yuan", "Won", "Iene", "Baht"], 2),
    ("Quantos jogadores um time de futebol tem em campo?", ["10", "11", "12", "9"], 1),
    ("Quem pintou a Mona Lisa?", ["Michelangelo", "Rafael", "Leonardo da Vinci", "Donatello"], 2),
    ("Qual é o menor país do mundo?", ["Mônaco", "Vaticano", "San Marino", "Malta"], 1),
    ("Qual órgão bombeia o sangue?", ["Pulmão", "Fígado", "Coração", "Rim"], 2),
    ("Quem foi o primeiro presidente do Brasil?", ["Getúlio Vargas", "Deodoro da Fonseca", "Floriano Peixoto", "Prudente de Morais"], 1),
    ("Qual planeta é conhecido como planeta vermelho?", ["Vênus", "Marte", "Mercúrio", "Júpiter"], 1),
    ("Qual língua tem mais falantes nativos no mundo?", ["Inglês", "Espanhol", "Mandarim", "Hindi"], 2),
    ("Qual é a capital do Canadá?", ["Toronto", "Vancouver", "Ottawa", "Montreal"], 2),
    ("Qual é o animal terrestre mais rápido?", ["Leão", "Guepardo", "Antílope", "Cavalo"], 1),
    ("H2O é a fórmula de qual substância?", ["Sal", "Água", "Oxigênio", "Hidrogênio"], 1),
    ("Quem escreveu O Pequeno Príncipe?", ["Saint-Exupéry", "Victor Hugo", "Júlio Verne", "Albert Camus"], 0),
    ("Qual é o maior país da América do Sul?", ["Argentina", "Brasil", "Colômbia", "Peru"], 1),
    ("Em que ano o homem pisou na Lua?", ["1965", "1969", "1972", "1959"], 1),
    ("Quantos minutos tem uma hora e meia?", ["80", "90", "100", "120"], 1),
    ("Qual metal é líquido em temperatura ambiente?", ["Ferro", "Mercúrio", "Alumínio", "Prata"], 1),
    ("Qual é o maior deserto quente do mundo?", ["Gobi", "Atacama", "Saara", "Kalahari"], 2),
    ("Qual rio corta a cidade de Londres?", ["Sena", "Tâmisa", "Reno", "Danúbio"], 1),
    ("Qual instrumento tem 88 teclas?", ["Órgão", "Piano", "Acordeão", "Harpa"], 1),
    ("Quem escreveu Romeu e Julieta?", ["Shakespeare", "Dickens", "Byron", "Oscar Wilde"], 0),
    ("Qual é o osso mais longo do corpo humano?", ["Tíbia", "Fêmur", "Úmero", "Fíbula"], 1),
    ("Qual é a capital da Argentina?", ["Buenos Aires", "Córdoba", "Rosário", "Mendoza"], 0),
    ("Quantos anos tem um século?", ["10", "50", "100", "1000"], 2),
    ("Qual gás as plantas absorvem na fotossíntese?", ["Oxigênio", "Nitrogênio", "Gás carbônico", "Hélio"], 2),
    ("Manaus é capital de qual estado?", ["Pará", "Amazonas", "Acre", "Roraima"], 1),
    ("Quem pintou o Abaporu?", ["Tarsila do Amaral", "Anita Malfatti", "Candido Portinari", "Di Cavalcanti"], 0),
    ("Marta é craque de qual esporte?", ["Vôlei", "Futebol", "Tênis", "Judô"], 1),
    ("Qual é o maior mamífero do mundo?", ["Elefante", "Baleia-azul", "Girafa", "Hipopótamo"], 1),
    ("Qual é o símbolo químico do ouro?", ["Ag", "Au", "Or", "Go"], 1),
    ("Qual é a capital da Itália?", ["Milão", "Roma", "Veneza", "Nápoles"], 1),
    ("Quantas cordas tem um violão?", ["4", "5", "6", "7"], 2),
    ("Quem é o deus grego do mar?", ["Zeus", "Poseidon", "Hades", "Apolo"], 1),
    ("Qual vitamina o corpo produz com a luz do sol?", ["A", "B12", "C", "D"], 3),
    ("Em que cidade fica a Torre Eiffel?", ["Lyon", "Paris", "Marselha", "Nice"], 1),
    ("Em que ano os portugueses chegaram ao Brasil?", ["1492", "1500", "1522", "1450"], 1),
    ("Quantos dias tem fevereiro num ano bissexto?", ["28", "29", "30", "31"], 1),
    ("Qual é o maior estado brasileiro em área?", ["Pará", "Amazonas", "Mato Grosso", "Minas Gerais"], 1),
    ("Quem canta Thriller?", ["Prince", "Michael Jackson", "Elvis Presley", "Stevie Wonder"], 1),
    ("Em que continente fica o Egito?", ["Ásia", "África", "Europa", "Oceania"], 1),
    ("Quantos zeros tem um milhão?", ["5", "6", "7", "9"], 1),
    ("Qual destes animais é um marsupial?", ["Lobo", "Canguru", "Girafa", "Tigre"], 1),
    ("Quem escreveu Harry Potter?", ["J.R.R. Tolkien", "J.K. Rowling", "C.S. Lewis", "Rick Riordan"], 1),
    ("Qual planeta é o mais próximo do Sol?", ["Vênus", "Terra", "Mercúrio", "Marte"], 2),
    ("Qual é a capital da Bahia?", ["Recife", "Salvador", "Fortaleza", "Maceió"], 1),
    ("Qual seleção tem mais títulos de Copa do Mundo?", ["Alemanha", "Brasil", "Itália", "Argentina"], 1),
    ("O que um termômetro mede?", ["Pressão", "Temperatura", "Umidade", "Velocidade"], 1),
    ("Cartola é um nome do...", ["Rock", "Samba", "Sertanejo", "Funk"], 1),
    ("Quantos meses do ano têm 31 dias?", ["5", "6", "7", "8"], 2),
    ("Qual é a raiz quadrada de 81?", ["7", "8", "9", "11"], 2),
    ("A pizza nasceu em qual país?", ["França", "Itália", "Grécia", "Espanha"], 1),
    ("Qual destes é um réptil?", ["Sapo", "Jacaré", "Golfinho", "Pinguim"], 1),
    ("Em que cidade fica a Casa Branca?", ["Nova York", "Washington", "Los Angeles", "Chicago"], 1),
    ("Quem descobriu a penicilina?", ["Louis Pasteur", "Alexander Fleming", "Charles Darwin", "Isaac Newton"], 1),
    ("Quem fundou a Microsoft?", ["Steve Jobs", "Bill Gates", "Elon Musk", "Mark Zuckerberg"], 1),
    ("Curitiba é capital de qual estado?", ["Santa Catarina", "Paraná", "Rio Grande do Sul", "São Paulo"], 1),
    ("Quantas patas tem uma aranha?", ["6", "8", "10", "12"], 1),
    ("Qual é o ponto mais alto do Brasil?", ["Pico da Bandeira", "Pico da Neblina", "Pedra da Mina", "Monte Roraima"], 1),
    ("Garota de Ipanema é de...", ["Chico Buarque", "Tom Jobim e Vinicius", "Caetano Veloso", "Gilberto Gil"], 1),
    ("Qual é o maior número primo menor que 10?", ["5", "7", "9", "8"], 1),
    ("Machu Picchu fica em qual país?", ["Chile", "Peru", "Bolívia", "Equador"], 1),
    ("Quantos bits tem um byte?", ["4", "8", "16", "32"], 1),
    ("Qual é a capital de Pernambuco?", ["Recife", "Olinda", "Caruaru", "Petrolina"], 0),
    ("Quantos planetas tem o Sistema Solar?", ["7", "8", "9", "10"], 1),
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _log(state, entry):
    log = state.get("log") or []
    log.append(entry)
    state["log"] = log[-30:]


def _save_player(player, **fields):
    player_state = player.state or {}
    player_state.update(fields)
    player.state = player_state
    player.save(update_fields=["state"])


def initialize(players, now_ts, rng=None, rounds=ROUNDS):
    rng = _rng(rng)
    if len(players) < 1:
        return None
    try:
        rounds = int(rounds)
    except (TypeError, ValueError):
        rounds = ROUNDS
    rounds = max(1, min(rounds, len(QUESTIONS)))
    deck = []
    for index in rng.sample(range(len(QUESTIONS)), rounds):
        text, options, correct = QUESTIONS[index]
        shuffled = list(range(len(options)))
        rng.shuffle(shuffled)
        deck.append(
            {
                "text": text,
                "options": [options[i] for i in shuffled],
                "correct": shuffled.index(correct),
            }
        )
    state = {
        "game": QUIZ_SLUG,
        "phase": "question",
        "round": 1,
        "rounds": rounds,
        "deck": deck,
        "question": {"text": deck[0]["text"], "options": deck[0]["options"]},
        "question_started_ts": now_ts,
        "choices": {},
        "scores": {str(p.id): 0 for p in players},
        "streaks": {str(p.id): 0 for p in players},
        "deadline_ts": now_ts + QUESTION_SECONDS,
        "last_result": None,
        "winner_ids": [],
        "log": [],
    }
    for player in players:
        _save_player(player, points=0, choice=None)
    return state


def _current(state):
    return state["deck"][state["round"] - 1]


def submit_answer(state, player, index, players, now_ts):
    if state.get("phase") != "question":
        return "A pergunta já fechou."
    if str(player.id) in (state.get("choices") or {}):
        return "Você já respondeu. Sem trocar."
    if not 0 <= index < len(_current(state)["options"]):
        return "Opção inválida."
    elapsed = max(0.0, now_ts - (state.get("question_started_ts") or now_ts))
    state.setdefault("choices", {})[str(player.id)] = {"index": index, "elapsed": round(elapsed, 2)}
    _save_player(player, choice=index)
    if all(str(p.id) in state["choices"] for p in players):
        _resolve(state, players, now_ts)
    return None


def _resolve(state, players, now_ts):
    current = _current(state)
    correct = current["correct"]
    choices = state.get("choices") or {}
    distribution = [0] * len(current["options"])
    points = {}
    for player in players:
        choice = choices.get(str(player.id))
        delta = 0
        if choice is not None:
            distribution[choice["index"]] += 1
            if choice["index"] == correct:
                remaining = max(0.0, QUESTION_SECONDS - choice["elapsed"])
                delta = BASE_POINTS + int(SPEED_BONUS * remaining / QUESTION_SECONDS)
                state["streaks"][str(player.id)] = state["streaks"].get(str(player.id), 0) + 1
            else:
                state["streaks"][str(player.id)] = 0
        else:
            state["streaks"][str(player.id)] = 0
        points[str(player.id)] = delta
        if delta:
            state["scores"][str(player.id)] = state["scores"].get(str(player.id), 0) + delta
            _save_player(player, points=state["scores"][str(player.id)])

    state["last_result"] = {
        "round": state["round"],
        "text": current["text"],
        "options": current["options"],
        "correct": correct,
        "distribution": distribution,
        "points": points,
        "choices": {pid: c["index"] for pid, c in choices.items()},
    }
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    _log(state, {"type": "reveal", "round": state["round"]})


def _next_round(state, players, now_ts):
    if state["round"] >= state["rounds"]:
        state["phase"] = "ended"
        state["deadline_ts"] = None
        scores = state.get("scores") or {}
        best = max(scores.values()) if scores else 0
        state["winner_ids"] = [int(pid) for pid, score in scores.items() if score == best]
        return
    state["round"] += 1
    current = _current(state)
    state["question"] = {"text": current["text"], "options": current["options"]}
    state["question_started_ts"] = now_ts
    state["choices"] = {}
    state["phase"] = "question"
    state["deadline_ts"] = now_ts + QUESTION_SECONDS
    for player in players:
        _save_player(player, choice=None)


def tick(state, players, now_ts):
    deadline = state.get("deadline_ts")
    if deadline is None or now_ts < deadline:
        return state
    phase = state.get("phase")
    if phase == "question":
        _resolve(state, players, now_ts)
    elif phase == "reveal":
        _next_round(state, players, now_ts)
    return state


def redact_state(state):
    """O baralho inteiro e a resposta certa ficam escondidos ate a revelacao."""
    safe = dict(state)
    safe.pop("deck", None)
    safe["question_seconds"] = QUESTION_SECONDS
    if safe.get("phase") == "question":
        safe["answered_ids"] = [int(pid) for pid in (state.get("choices") or {})]
        safe.pop("choices", None)
    return safe
