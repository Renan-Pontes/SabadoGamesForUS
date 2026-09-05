"""
Palpite Certo — adaptação de Wits & Wagers.

Uma pergunta com resposta numérica aparece na TV. Ninguém precisa saber a
resposta: cada um chuta um número no celular. Os palpites vão para a TV em
ordem crescente, cada um com uma cota — quanto mais longe do meio, mais
paga. Aí todo mundo aposta duas fichas no palpite que acha certo (ou em
"todos passaram"). Vence a aposta o maior palpite que NÃO ultrapassa a
resposta. Quem deu esse palpite ainda leva um bônus.

A TV é a mesa de apostas. O celular é o bolso.
"""

import secrets

PALPITE_SLUG = "palpite-certo"

ROUNDS = 7
ANSWER_SECONDS = 45
BET_SECONDS = 45
REVEAL_SECONDS = 14
CHIPS_PER_ROUND = 2
AUTHOR_BONUS = 2

# (pergunta, resposta, unidade)
QUESTIONS = [
    ("Quantos metros tem o Cristo Redentor, contando o pedestal?", 38, "metros"),
    ("Em que ano Brasília foi inaugurada?", 1960, "ano"),
    ("Quantos ossos tem o corpo de um adulto?", 206, "ossos"),
    ("Quantos metros de comprimento tem a Ponte Rio–Niterói?", 13290, "metros"),
    ("Qual é a altura do Monte Everest, em metros?", 8849, "metros"),
    ("Em que ano o Brasil ganhou a primeira Copa do Mundo?", 1958, "ano"),
    ("Quantos dentes tem um adulto com todos os sisos?", 32, "dentes"),
    ("Qual é a distância média da Terra à Lua, em quilômetros?", 384400, "km"),
    ("Qual é a velocidade da luz, em quilômetros por segundo?", 299792, "km/s"),
    ("Quantos graus Fahrenheit tem a água fervendo ao nível do mar?", 212, "°F"),
    ("Quantos milhões de habitantes o Brasil tinha no Censo de 2022?", 203, "milhões"),
    ("Quantos municípios tem o Brasil?", 5570, "municípios"),
    ("Em que ano o primeiro iPhone foi lançado?", 2007, "ano"),
    ("Em que ano o homem pisou na Lua pela primeira vez?", 1969, "ano"),
    ("Quantas teclas tem um piano?", 88, "teclas"),
    ("Quantas casas tem um tabuleiro de xadrez?", 64, "casas"),
    ("Quantos países existem na América do Sul?", 12, "países"),
    ("Qual é a altura da Torre Eiffel, com as antenas, em metros?", 330, "metros"),
    ("Quantos elementos tem a tabela periódica?", 118, "elementos"),
    ("Em que ano foi proclamada a República no Brasil?", 1889, "ano"),
    ("Em que ano a escravidão foi abolida no Brasil?", 1888, "ano"),
    ("Em que ano foi a Independência do Brasil?", 1822, "ano"),
    ("Quantos minutos dura o filme Titanic?", 195, "minutos"),
    ("Quantos episódios tem a série Friends?", 236, "episódios"),
    ("Em que ano Toy Story chegou aos cinemas?", 1995, "ano"),
    ("Em que ano Os Simpsons estrearam na TV?", 1989, "ano"),
    ("Qual é a altura do Burj Khalifa, em metros?", 828, "metros"),
    ("Quantos quilômetros tem a Grande Muralha da China, contando todos os trechos?", 21196, "km"),
    ("Quantos gramas tem uma libra?", 454, "gramas"),
    ("Em que ano aconteceu a primeira Copa do Mundo?", 1930, "ano"),
    ("Quantas medalhas de ouro o Brasil ganhou nas Olimpíadas de Tóquio?", 7, "medalhas"),
    ("Em que ano a Netflix chegou ao Brasil?", 2011, "ano"),
    ("Quantas horas tem uma semana?", 168, "horas"),
    ("Em que ano a cidade de São Paulo foi fundada?", 1554, "ano"),
    ("Em que ano a cidade do Rio de Janeiro foi fundada?", 1565, "ano"),
    ("Em que ano Pelé nasceu?", 1940, "ano"),
    ("Quantos gols Pelé fez na Copa de 1958?", 6, "gols"),
    ("Quantos quilômetros tem uma maratona (arredondando)?", 42, "km"),
    ("Em que ano o Rio de Janeiro sediou as Olimpíadas?", 2016, "ano"),
    ("Quantos segundos tem um dia?", 86400, "segundos"),
    ("Quantos dias terrestres dura um ano em Marte?", 687, "dias"),
    ("Qual é o diâmetro da Terra, em quilômetros?", 12742, "km"),
    ("Em que ano Ayrton Senna nasceu?", 1960, "ano"),
    ("Quantos títulos mundiais de Fórmula 1 tem Lewis Hamilton?", 7, "títulos"),
    ("Quantos fusos horários tem o Brasil?", 4, "fusos"),
    ("Em que ano foi promulgada a Constituição brasileira atual?", 1988, "ano"),
    ("Em que ano o Plano Real entrou em vigor?", 1994, "ano"),
    ("Quantas faces tem um icosaedro?", 20, "faces"),
    ("Quantas cartas tem um baralho sem os coringas?", 52, "cartas"),
    ("Quantos anos durou a Guerra dos Cem Anos?", 116, "anos"),
    ("Em que ano o Facebook foi criado?", 2004, "ano"),
    ("Em que ano o WhatsApp foi lançado?", 2009, "ano"),
    ("Em que ano o Instagram foi lançado?", 2010, "ano"),
    ("Em que ano o YouTube foi criado?", 2005, "ano"),
    ("Em que ano o Google foi fundado?", 1998, "ano"),
    ("Quantos habitantes tem o Vaticano, aproximadamente?", 800, "habitantes"),
    ("Quantos corações tem um polvo?", 3, "corações"),
    ("Quantos dias dura a gestação de uma elefanta, aproximadamente?", 660, "dias"),
    ("Em que ano Elvis Presley morreu?", 1977, "ano"),
    ("Quantos Oscars o filme Titanic ganhou?", 11, "Oscars"),
    ("Quantos livros tem a série Harry Potter?", 7, "livros"),
    ("Quantos Pokémon existem na primeira geração?", 151, "Pokémon"),
    ("Quantas cordas tem um violino?", 4, "cordas"),
    ("Quantos estados tem os Estados Unidos?", 50, "estados"),
    ("Quantos metros tem uma piscina olímpica?", 50, "metros"),
    ("Em que ano o Brasil foi descoberto pelos portugueses?", 1500, "ano"),
    ("Quantas cores tem o arco-íris, na convenção clássica?", 7, "cores"),
    ("Quantos jogadores um time de vôlei tem em quadra?", 6, "jogadores"),
    ("Quantas Copas do Mundo o Brasil já venceu?", 5, "Copas"),
    ("Quantos quilômetros por hora um Boeing 747 voa em cruzeiro, aproximadamente?", 900, "km/h"),
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
    if len(players) < 2:
        return None
    try:
        rounds = int(rounds)
    except (TypeError, ValueError):
        rounds = ROUNDS
    rounds = max(1, min(rounds, len(QUESTIONS)))
    picks = rng.sample(range(len(QUESTIONS)), rounds)

    for player in players:
        _save_player(player, points=0, answer=None, bets=[])

    state = {
        "game": PALPITE_SLUG,
        "phase": "answer",
        "round": 1,
        "rounds": rounds,
        "question_ids": picks,
        "question": None,
        "unit": None,
        "answer_value": None,
        "deadline_ts": None,
        "answers": {},
        "slots": [],
        "bets": {},
        "correct_index": None,
        "scores": {str(p.id): 0 for p in players},
        "last_result": None,
        "winner_ids": [],
        "log": [],
    }
    _load_question(state, now_ts)
    return state


def _load_question(state, now_ts):
    text, answer, unit = QUESTIONS[state["question_ids"][state["round"] - 1]]
    state["question"] = text
    state["unit"] = unit
    state["answer_value"] = answer
    state["phase"] = "answer"
    state["deadline_ts"] = now_ts + ANSWER_SECONDS
    state["answers"] = {}
    state["slots"] = []
    state["bets"] = {}
    state["correct_index"] = None


def _clean_value(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or abs(number) > 1e15:
        return None
    return int(number) if number.is_integer() else round(number, 2)


def submit_answer(state, player, value, players, now_ts):
    if state.get("phase") != "answer":
        return "A hora dos palpites já passou."
    number = _clean_value(value)
    if number is None:
        return "Palpite inválido."
    state.setdefault("answers", {})[str(player.id)] = number
    _save_player(player, answer=number)
    _log(state, {"type": "answer", "player_id": player.id})
    if all(str(p.id) in state["answers"] for p in players):
        _open_betting(state, players, now_ts)
    return None


def _odds_for(count):
    """Do meio para as pontas: 2:1 no centro, +1 a cada passo de distancia."""
    center = (count - 1) / 2
    return [2 + int(abs(index - center) + 0.5) for index in range(count)]


def _open_betting(state, players, now_ts):
    groups = {}
    for pid, value in (state.get("answers") or {}).items():
        groups.setdefault(value, []).append(int(pid))
    values = sorted(groups)
    odds = _odds_for(len(values))
    lower_odds = (max(odds) if odds else 2) + 1
    slots = [{"key": "lower", "value": None, "odds": lower_odds, "authors": []}]
    for value, payout in zip(values, odds):
        slots.append({"key": str(value), "value": value, "odds": payout, "authors": groups[value]})
    state["slots"] = slots
    state["bets"] = {}
    for player in players:
        _save_player(player, bets=[])
    state["phase"] = "bet"
    state["deadline_ts"] = now_ts + BET_SECONDS


def place_bets(state, player, slots, players, now_ts):
    if state.get("phase") != "bet":
        return "Não é hora de apostar."
    if not isinstance(slots, list) or not 1 <= len(slots) <= CHIPS_PER_ROUND:
        return f"Aposte até {CHIPS_PER_ROUND} fichas."
    total = len(state.get("slots") or [])
    if any(not isinstance(slot, int) or not 0 <= slot < total for slot in slots):
        return "Aposta inválida."
    state.setdefault("bets", {})[str(player.id)] = list(slots)
    _save_player(player, bets=list(slots))
    if all(str(p.id) in state["bets"] for p in players):
        _resolve(state, players, now_ts)
    return None


def _resolve(state, players, now_ts):
    actual = state["answer_value"]
    slots = state.get("slots") or []
    correct = 0
    for index, slot in enumerate(slots):
        if slot["value"] is not None and slot["value"] <= actual:
            correct = index  # ordenado crescente: o ultimo que nao passa vence
    state["correct_index"] = correct

    payouts = {}
    for player in players:
        delta = 0
        for chip in (state.get("bets") or {}).get(str(player.id), []):
            if chip == correct:
                delta += slots[correct]["odds"]
        if player.id in slots[correct]["authors"]:
            delta += AUTHOR_BONUS
        payouts[str(player.id)] = delta
        if delta:
            state["scores"][str(player.id)] = state["scores"].get(str(player.id), 0) + delta
            _save_player(player, points=state["scores"][str(player.id)])

    state["last_result"] = {
        "round": state["round"],
        "question": state["question"],
        "unit": state["unit"],
        "answer_value": actual,
        "correct_index": correct,
        "payouts": payouts,
        "slots": slots,
        "bets": dict(state.get("bets") or {}),
    }
    _log(state, {"type": "reveal", "round": state["round"], "answer": actual})
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS


def _next_round(state, players, now_ts):
    if state["round"] >= state["rounds"]:
        state["phase"] = "ended"
        state["deadline_ts"] = None
        scores = state.get("scores") or {}
        best = max(scores.values()) if scores else 0
        state["winner_ids"] = [int(pid) for pid, score in scores.items() if score == best]
        return
    state["round"] += 1
    for player in players:
        _save_player(player, answer=None, bets=[])
    _load_question(state, now_ts)


def tick(state, players, now_ts):
    deadline = state.get("deadline_ts")
    if deadline is None or now_ts < deadline:
        return state
    phase = state.get("phase")
    if phase == "answer":
        _open_betting(state, players, now_ts)
    elif phase == "bet":
        _resolve(state, players, now_ts)
    elif phase == "reveal":
        _next_round(state, players, now_ts)
    return state


def redact_state(state):
    """A resposta e as apostas so aparecem na revelacao."""
    safe = dict(state)
    phase = safe.get("phase")
    safe.pop("question_ids", None)
    if phase not in ("reveal", "ended"):
        safe.pop("answer_value", None)
    if phase == "answer":
        safe["answered_ids"] = [int(pid) for pid in (state.get("answers") or {})]
        safe.pop("answers", None)
    if phase == "bet":
        safe["bet_ids"] = [int(pid) for pid in (state.get("bets") or {})]
        safe.pop("bets", None)
    safe["chips_per_round"] = CHIPS_PER_ROUND
    safe["author_bonus"] = AUTHOR_BONUS
    return safe
