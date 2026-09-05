"""
Só Uma — adaptação de Just One.

Cooperativo. Um jogador por rodada fecha os olhos (na prática: não vê a
palavra). Os outros escrevem UMA palavra de dica cada. Dicas iguais se
cancelam — então a dica óbvia é a mais arriscada. Com o que sobrar, quem
adivinha tenta acertar. Acertou, um ponto para a mesa. Errou, a mesa perde
esta e a próxima carta. Passar não custa nada.

A TV mostra as dicas que sobreviveram. O celular escreve a dica.
"""

import secrets
import unicodedata

SOUMA_SLUG = "so-uma"

ROUNDS = 10
CLUE_SECONDS = 60
GUESS_SECONDS = 60
REVEAL_SECONDS = 10

WORDS = [
    "praia", "chocolate", "bicicleta", "lua", "futebol", "cinema", "pizza", "gato", "escola", "chuva",
    "dentista", "carnaval", "computador", "avião", "casamento", "dinossauro", "banana", "óculos", "música",
    "sorvete", "elefante", "montanha", "natal", "piscina", "relógio", "vampiro", "cachorro", "café",
    "guitarra", "floresta", "hospital", "tesoura", "castelo", "aniversário", "foguete", "bruxa", "jardim",
    "robô", "chuveiro", "batata", "palhaço", "deserto", "ilha", "biblioteca", "vulcão", "fantasma", "sereia",
    "pirata", "zumbi", "pipoca", "samba", "novela", "churrasco", "feijoada", "açaí", "capoeira", "tapioca",
    "brigadeiro", "chinelo", "guaraná", "coxinha", "pastel", "cerveja", "Amazônia", "Pelé", "circo", "trem",
    "abelha", "cobra", "tubarão", "pinguim", "coruja", "borboleta", "girafa", "macaco", "leão", "tartaruga",
    "chave", "espelho", "cama", "janela", "escada", "ponte", "farol", "semáforo", "ônibus", "metrô",
    "supermercado", "padaria", "farmácia", "academia", "igreja", "estádio", "shopping", "aeroporto",
    "médico", "professor", "bombeiro", "astronauta", "cozinheiro", "policial", "pintor", "mágico",
    "inverno", "verão", "domingo", "meia-noite", "férias", "sábado", "manhã", "madrugada",
    "sonho", "medo", "saudade", "risada", "abraço", "beijo", "segredo", "mentira", "sorte", "azar",
    "ouro", "diamante", "dinheiro", "cofre", "banco", "loteria", "cartão", "moeda",
    "vinho", "queijo", "sushi", "lasanha", "hambúrguer", "salada", "bolo", "sopa", "ovo", "arroz",
    "violão", "bateria", "piano", "microfone", "rádio", "televisão", "celular", "internet", "senha",
    "xadrez", "dominó", "baralho", "dado", "quebra-cabeça", "videogame", "boneca", "pipa", "bola",
    "neve", "arco-íris", "tempestade", "vento", "sol", "estrela", "planeta", "oceano", "rio", "cachoeira",
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def _normalize(text):
    stripped = unicodedata.normalize("NFKD", text or "")
    return " ".join("".join(ch for ch in stripped if not unicodedata.combining(ch)).casefold().split())


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
    if len(players) < 3:
        return None
    try:
        rounds = int(rounds)
    except (TypeError, ValueError):
        rounds = ROUNDS
    rounds = max(3, min(rounds, 13))
    order = [p.id for p in players]
    rng.shuffle(order)
    state = {
        "game": SOUMA_SLUG,
        "phase": "clues",
        "round": 0,
        "rounds": rounds,
        "order": order,
        "guesser_id": None,
        "word": None,
        "clues": {},
        "judged": [],
        "score": 0,
        "lost": 0,
        "history": [],
        "used_words": [],
        "result": None,
        "deadline_ts": None,
        "log": [],
    }
    _start_round(state, players, now_ts, rng)
    return state


def _start_round(state, players, now_ts, rng):
    state["round"] += 1
    order = state["order"]
    guesser_id = order[(state["round"] - 1) % len(order)]
    unused = [w for w in WORDS if w not in state["used_words"]] or list(WORDS)
    word = rng.choice(unused)
    state["used_words"].append(word)
    state.update(
        {
            "phase": "clues",
            "guesser_id": guesser_id,
            "word": word,
            "clues": {},
            "judged": [],
            "result": None,
            "deadline_ts": now_ts + CLUE_SECONDS,
        }
    )
    for player in players:
        _save_player(player, word=None if player.id == guesser_id else word, clue=None)
    _log(state, {"type": "round", "round": state["round"], "guesser_id": guesser_id})


def submit_clue(state, player, text, players, now_ts):
    if state.get("phase") != "clues":
        return "As dicas já foram dadas."
    if player.id == state.get("guesser_id"):
        return "Quem adivinha não dá dica."
    text = (text or "").strip()
    if not text:
        return "Escreva uma palavra."
    if " " in text:
        return "Uma palavra só."
    if len(text) > 30:
        return "Dica longa demais."
    state.setdefault("clues", {})[str(player.id)] = text
    _save_player(player, clue=text)
    helpers = [p.id for p in players if p.id != state.get("guesser_id")]
    if all(str(pid) in state["clues"] for pid in helpers):
        _open_guess(state, now_ts)
    return None


def _clue_is_valid(clue, word):
    clue_n, word_n = _normalize(clue), _normalize(word)
    if not clue_n:
        return False
    if clue_n == word_n:
        return False
    # Variante da palavra (plural, diminutivo, pedaco): nao vale.
    if word_n in clue_n:
        return False
    if len(clue_n) >= 3 and clue_n in word_n:
        return False
    return True


def _open_guess(state, now_ts):
    clues = state.get("clues") or {}
    counts = {}
    for text in clues.values():
        key = _normalize(text)
        counts[key] = counts.get(key, 0) + 1
    judged = []
    for pid, text in clues.items():
        duplicate = counts[_normalize(text)] > 1
        valid = not duplicate and _clue_is_valid(text, state.get("word"))
        judged.append(
            {
                "player_id": int(pid),
                "text": text,
                "valid": valid,
                "reason": "repetida" if duplicate else None if valid else "parecida com a palavra",
            }
        )
    state["judged"] = judged
    state["phase"] = "guess"
    state["deadline_ts"] = now_ts + GUESS_SECONDS


def submit_guess(state, player, text, passed, players, now_ts):
    if state.get("phase") != "guess":
        return "Não é hora de adivinhar."
    if player.id != state.get("guesser_id"):
        return "Só quem adivinha responde."
    if passed:
        _finish_round(state, now_ts, "pass", None)
        return None
    text = (text or "").strip()
    if not text:
        return "Diga uma palavra ou passe."
    outcome = "correct" if _normalize(text) == _normalize(state.get("word")) else "wrong"
    _finish_round(state, now_ts, outcome, text)
    return None


def _finish_round(state, now_ts, outcome, guess_text):
    if outcome == "correct":
        state["score"] = state.get("score", 0) + 1
    elif outcome == "wrong":
        # Errar custa esta carta e a proxima.
        state["lost"] = state.get("lost", 0) + 1
        if state["round"] < state["rounds"]:
            state["rounds"] -= 1
    state["result"] = {"outcome": outcome, "word": state.get("word"), "guess": guess_text, "judged": state.get("judged")}
    state.setdefault("history", []).append({"word": state.get("word"), "outcome": outcome, "guess": guess_text})
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    _log(state, {"type": "result", "round": state["round"], "outcome": outcome})


def rating(score, rounds):
    ratio = score / rounds if rounds else 0
    if ratio >= 1:
        return "Perfeito! A mesa se entende sem falar."
    if ratio >= 0.85:
        return "Incrível. Quase telepatia."
    if ratio >= 0.7:
        return "Muito bom. Alguém ainda dá dica óbvia demais."
    if ratio >= 0.5:
        return "Bom. Dá para melhorar as dicas."
    if ratio >= 0.3:
        return "Hmm. Vocês se conhecem mesmo?"
    return "Tentem de novo. Sem cancelar tudo dessa vez."


def tick(state, players, now_ts, rng=None):
    deadline = state.get("deadline_ts")
    if deadline is None or now_ts < deadline:
        return state
    phase = state.get("phase")
    if phase == "clues":
        _open_guess(state, now_ts)
    elif phase == "guess":
        _finish_round(state, now_ts, "pass", None)
    elif phase == "reveal":
        if state["round"] >= state["rounds"]:
            state["phase"] = "ended"
            state["deadline_ts"] = None
            state["rating"] = rating(state.get("score", 0), state.get("rounds", ROUNDS))
        else:
            _start_round(state, players, now_ts, _rng(rng))
    return state


def redact_state(state):
    """A palavra some ate a revelacao; as dicas so aparecem depois de julgadas."""
    safe = dict(state)
    phase = safe.get("phase")
    safe.pop("used_words", None)
    safe["clue_ids"] = [int(pid) for pid in (state.get("clues") or {})]
    safe.pop("clues", None)
    if phase == "guess":
        safe["shown_clues"] = [c for c in (state.get("judged") or []) if c["valid"]]
        safe["cancelled_count"] = sum(1 for c in (state.get("judged") or []) if not c["valid"])
        safe.pop("judged", None)
    elif phase == "clues":
        safe.pop("judged", None)
    if phase not in ("reveal", "ended"):
        safe.pop("word", None)
    return safe
