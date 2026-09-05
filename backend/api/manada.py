"""
Manada — adaptação de Herd Mentality.

Uma pergunta boba na TV: "qual o melhor sabor de pizza?". Todo mundo
responde no celular. Quem respondeu igual à MAIORIA ganha um ponto. Quem
foi o único a responder diferente de todo mundo ganha a vaca rosa — e com
a vaca na mão ninguém vence, até que outro fique sozinho e ela mude de dono.

A TV agrupa as respostas. O celular é o seu voto de rebanho.
"""

import secrets
import unicodedata

MANADA_SLUG = "manada"

ROUNDS = 8
ANSWER_SECONDS = 40
REVEAL_SECONDS = 12
ARTICLES = {"o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da"}

QUESTIONS = [
    "Qual é o melhor sabor de pizza?",
    "Qual animal daria o melhor pet?",
    "Qual é o melhor filme da Disney?",
    "Um número entre 1 e 10.",
    "Qual é a pior tarefa doméstica?",
    "Qual superpoder você escolheria?",
    "Qual é o melhor dia da semana?",
    "Qual é a melhor fruta?",
    "Qual é a comida mais brasileira?",
    "O que não pode faltar num churrasco?",
    "Qual é a cor mais bonita?",
    "Qual é a melhor estação do ano?",
    "Uma palavra que rima com amor.",
    "Qual é o pior cheiro do mundo?",
    "Quem é a pessoa mais engraçada da mesa?",
    "Quem da mesa chega mais atrasado?",
    "Uma coisa para levar para uma ilha deserta.",
    "Qual é o melhor esporte para assistir?",
    "Qual é o melhor doce de festa?",
    "Qual é o instrumento musical mais legal?",
    "Qual é a melhor série de todos os tempos?",
    "Uma marca de carro.",
    "Um animal com listras.",
    "Um país que você quer visitar.",
    "Um nome de menino bonito.",
    "Um nome de menina bonito.",
    "Qual é o melhor lanche de madrugada?",
    "Qual era a pior matéria da escola?",
    "O melhor personagem de desenho animado.",
    "O que fazer num domingo de chuva?",
    "Uma coisa vermelha.",
    "Um sabor de sorvete.",
    "Uma profissão que parece legal.",
    "Um filme para chorar.",
    "Uma coisa que todo mundo odeia.",
    "O melhor lugar para passar férias.",
    "O que vem primeiro na tigela: cereal ou leite?",
    "Cachorro ou gato?",
    "Praia ou montanha?",
    "Café ou chá?",
    "Verão ou inverno?",
    "Um número da sorte.",
    "Uma letra do alfabeto.",
    "Um mês do ano.",
    "Um herói de quadrinhos.",
    "Um vilão famoso.",
    "Um videogame clássico.",
    "Uma rede social.",
    "Um aplicativo que você usa todo dia.",
    "Uma coisa que tem no banheiro.",
    "Um bicho nojento.",
    "Qual é o melhor pão?",
    "Uma bebida de festa.",
    "Qual é o melhor tempero?",
    "Uma coisa gelada.",
    "Uma coisa que faz barulho.",
    "Uma parte do corpo.",
    "Uma coisa que sempre se perde.",
    "Quem da mesa cozinha melhor?",
    "Quem da mesa dorme mais?",
    "Qual é a melhor pizza doce?",
    "Uma coisa que tem no céu.",
    "Um esporte com bola.",
    "Um lugar para um primeiro encontro.",
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def normalize(text):
    stripped = unicodedata.normalize("NFKD", text or "")
    plain = "".join(ch for ch in stripped if not unicodedata.combining(ch)).casefold()
    words = [w.strip(".,!?;:'\"()") for w in plain.split()]
    words = [w for w in words if w]
    while words and words[0] in ARTICLES:
        words = words[1:]
    return " ".join(words)


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
    state = {
        "game": MANADA_SLUG,
        "phase": "answer",
        "round": 1,
        "rounds": rounds,
        "question_ids": picks,
        "question": QUESTIONS[picks[0]],
        "answers": {},
        "scores": {str(p.id): 0 for p in players},
        "cow_id": None,
        "deadline_ts": now_ts + ANSWER_SECONDS,
        "last_result": None,
        "winner_ids": [],
        "log": [],
    }
    for player in players:
        _save_player(player, points=0, answer=None)
    return state


def submit_answer(state, player, text, players, now_ts):
    if state.get("phase") != "answer":
        return "O rebanho já decidiu."
    text = (text or "").strip()
    if not text:
        return "Responda alguma coisa."
    if len(text) > 40:
        return "Resposta longa demais."
    state.setdefault("answers", {})[str(player.id)] = text
    _save_player(player, answer=text)
    if all(str(p.id) in state["answers"] for p in players):
        _resolve(state, players, now_ts)
    return None


def _resolve(state, players, now_ts):
    answers = state.get("answers") or {}
    groups = {}
    for pid, text in answers.items():
        key = normalize(text)
        group = groups.setdefault(key, {"text": text, "player_ids": []})
        group["player_ids"].append(int(pid))

    ordered = sorted(groups.values(), key=lambda g: (-len(g["player_ids"]), g["text"].casefold()))
    biggest = len(ordered[0]["player_ids"]) if ordered else 0
    leaders = [g for g in ordered if len(g["player_ids"]) == biggest]
    majority = leaders[0] if len(leaders) == 1 and biggest >= 2 else None

    points = {}
    for group in ordered:
        group["majority"] = group is majority
        for pid in group["player_ids"]:
            points[str(pid)] = 1 if group is majority else 0

    singles = [g for g in ordered if len(g["player_ids"]) == 1]
    cow_before = state.get("cow_id")
    if len(singles) == 1 and len(answers) >= 3:
        state["cow_id"] = singles[0]["player_ids"][0]

    for player in players:
        delta = points.get(str(player.id), 0)
        if delta:
            state["scores"][str(player.id)] = state["scores"].get(str(player.id), 0) + delta
            _save_player(player, points=state["scores"][str(player.id)])

    state["last_result"] = {
        "round": state["round"],
        "question": state["question"],
        "groups": ordered,
        "majority": majority["text"] if majority else None,
        "points": points,
        "cow_id": state.get("cow_id"),
        "cow_moved": state.get("cow_id") != cow_before,
    }
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    _log(state, {"type": "reveal", "round": state["round"], "majority": state["last_result"]["majority"]})


def _next_round(state, players, now_ts):
    if state["round"] >= state["rounds"]:
        state["phase"] = "ended"
        state["deadline_ts"] = None
        scores = state.get("scores") or {}
        cow = state.get("cow_id")
        eligible = {pid: score for pid, score in scores.items() if int(pid) != cow} or scores
        best = max(eligible.values()) if eligible else 0
        state["winner_ids"] = [int(pid) for pid, score in eligible.items() if score == best]
        return
    state["round"] += 1
    state["question"] = QUESTIONS[state["question_ids"][state["round"] - 1]]
    state["answers"] = {}
    state["phase"] = "answer"
    state["deadline_ts"] = now_ts + ANSWER_SECONDS
    for player in players:
        _save_player(player, answer=None)


def tick(state, players, now_ts):
    deadline = state.get("deadline_ts")
    if deadline is None or now_ts < deadline:
        return state
    phase = state.get("phase")
    if phase == "answer":
        _resolve(state, players, now_ts)
    elif phase == "reveal":
        _next_round(state, players, now_ts)
    return state


def redact_state(state):
    """As respostas so aparecem quando o rebanho inteiro decidiu."""
    safe = dict(state)
    safe.pop("question_ids", None)
    if safe.get("phase") == "answer":
        safe["answered_ids"] = [int(pid) for pid in (state.get("answers") or {})]
        safe.pop("answers", None)
    return safe
