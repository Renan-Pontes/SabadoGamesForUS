"""
Sintonia — adaptação de Wavelength.

Um espectro entre dois extremos ("Frio ↔ Quente"), um alvo escondido, e um
vidente que precisa descrever esse alvo com uma pista só. O resto da mesa
discute em voz alta e cada um aponta onde acha que está.

Adaptação para festa: em vez de um ponteiro único, cada pessoa manda o próprio
palpite. Todo mundo joga toda rodada, dá para ver quem leu melhor o vidente, e
o vidente pontua pela média da mesa — então ele também tem pele em jogo.
"""

import secrets

SINTONIA_SLUG = "sintonia"

CLUE_SECONDS = 90
GUESS_SECONDS = 90
REVEAL_SECONDS = 15

# O alvo nunca encosta nas bordas: um alvo em 99 tornaria "o extremo" a
# resposta óbvia e mataria a rodada.
TARGET_MIN = 8
TARGET_MAX = 92

# Distância do alvo → pontos. É o que transforma um chute perto em recompensa.
SCORE_BANDS = [(3, 4), (8, 3), (15, 2)]
MAX_BAND = SCORE_BANDS[-1][0]

SPECTRUMS = [
    ("Frio", "Quente"),
    ("Barato", "Caro"),
    ("Ruim", "Bom"),
    ("Comum", "Raro"),
    ("Silencioso", "Barulhento"),
    ("Feio", "Bonito"),
    ("Inútil", "Essencial"),
    ("Pequeno", "Gigante"),
    ("Seguro", "Perigoso"),
    ("Chato", "Divertido"),
    ("Antigo", "Moderno"),
    ("Simples", "Complicado"),
    ("Fraco", "Forte"),
    ("Lento", "Rápido"),
    ("Doce", "Salgado"),
    ("Saudável", "Doentio"),
    ("Formal", "Informal"),
    ("Fácil de falar", "Difícil de falar"),
    ("Trabalho", "Lazer"),
    ("Sujo", "Limpo"),
    ("Superestimado", "Subestimado"),
    ("Efêmero", "Eterno"),
    ("Culpa", "Orgulho"),
    ("Herói", "Vilão"),
    ("Sorte", "Habilidade"),
    ("Criança", "Adulto"),
    ("Cheiro ruim", "Cheiro bom"),
    ("Solitário", "Coletivo"),
    ("Impopular", "Popular"),
    ("Cotidiano", "Extraordinário"),
    ("Educado", "Grosseiro"),
    ("Frágil", "Resistente"),
    ("Descartável", "Insubstituível"),
    ("Bagunçado", "Organizado"),
    ("Racional", "Emocional"),
    ("Passageiro", "Vício"),
    ("Mole", "Duro"),
    ("Escuro", "Claro"),
    ("Assustador", "Reconfortante"),
    ("Trabalhoso", "Preguiçoso"),
    ("Local", "Global"),
    ("Íntimo", "Público"),
    ("Ridículo", "Respeitável"),
    ("Necessário", "Supérfluo"),
    ("Silêncio constrangedor", "Silêncio confortável"),
    ("Esquecível", "Marcante"),
    ("Genérico", "Autoral"),
    ("Pobre", "Rico"),
    ("Sério", "Bobo"),
    ("Cansativo", "Energizante"),
    ("Nojento", "Delicioso"),
    ("Injusto", "Justo"),
    ("Analógico", "Digital"),
    ("Improvisado", "Planejado"),
    ("Suave", "Áspero"),
    ("Legal fazer", "Legal assistir"),
    ("Casual", "Competitivo"),
    ("Comportado", "Rebelde"),
    ("Ignorado", "Superexposto"),
    ("Perda de tempo", "Investimento"),
    ("Egoísta", "Generoso"),
    ("Previsível", "Surpreendente"),
    ("Silencioso demais", "Alto demais"),
    ("Coisa de véspera", "Coisa de anos"),
    ("Vergonha alheia", "Admiração"),
    ("Um talento", "Um dom"),
    ("Guilty pleasure", "Orgulho declarado"),
    ("Precisa de coragem", "Precisa de paciência"),
    ("Melhor sozinho", "Melhor acompanhado"),
    ("Superficial", "Profundo"),
]


def _rng(rng=None):
    return rng or secrets.SystemRandom()


def score_for(target, guess):
    """Pontos de um palpite. Fora da faixa mais larga, zero."""
    distance = abs(guess - target)
    for limit, points in SCORE_BANDS:
        if distance <= limit:
            return points
    return 0


def _new_round(state, players, rng, now_ts):
    """Sorteia espectro e alvo, e passa o bastão do vidente."""
    order = state["order"]
    psychic_id = order[(state["round"] - 1) % len(order)]

    used = state.get("used_spectrums") or []
    available = [index for index in range(len(SPECTRUMS)) if index not in used]
    if not available:
        available = list(range(len(SPECTRUMS)))
        used = []
    chosen = rng.choice(available)
    used.append(chosen)

    left, right = SPECTRUMS[chosen]
    state.update(
        {
            "phase": "clue",
            "psychic_id": psychic_id,
            "spectrum": {"left": left, "right": right},
            "target": rng.randint(TARGET_MIN, TARGET_MAX),
            "clue": None,
            "used_spectrums": used,
            "deadline_ts": now_ts + CLUE_SECONDS,
        }
    )
    for player in players:
        player_state = player.state or {}
        player_state["guess"] = None
        player.state = player_state
        player.save(update_fields=["state"])
    return state


def initialize(players, now_ts, rng=None):
    rng = _rng(rng)
    order = [player.id for player in players]
    rng.shuffle(order)

    # Grupos pequenos dão duas voltas para a partida não acabar em três rodadas.
    laps = 2 if len(order) <= 4 else 1

    for player in players:
        player_state = player.state or {}
        player_state["score"] = 0
        player_state["guess"] = None
        player.state = player_state
        player.save(update_fields=["state"])

    state = {
        "game": SINTONIA_SLUG,
        "order": order,
        "round": 1,
        "max_rounds": len(order) * laps,
        "scores": {str(player.id): 0 for player in players},
        "used_spectrums": [],
        "last": None,
        "winners": [],
    }
    return _new_round(state, players, rng, now_ts)


def submit_clue(state, player_id, text, now_ts):
    if state.get("phase") != "clue":
        return "A pista desta rodada já foi dada."
    if state.get("psychic_id") != player_id:
        return "Só o vidente da rodada dá a pista."
    clue = (text or "").strip()
    if not clue:
        return "Escreva uma pista."
    state["clue"] = clue[:80]
    state["phase"] = "guess"
    state["deadline_ts"] = now_ts + GUESS_SECONDS
    return None


def submit_guess(state, player_id, value):
    if state.get("phase") != "guess":
        return "Não é hora de palpitar."
    if state.get("psychic_id") == player_id:
        return "O vidente não palpita nesta rodada."
    if not 0 <= value <= 100:
        return "O palpite fica entre 0 e 100."
    return None


def _all_guessed(state, players):
    guessers = [p for p in players if p.id != state.get("psychic_id")]
    return bool(guessers) and all((p.state or {}).get("guess") is not None for p in guessers)


def resolve_round(state, players, now_ts):
    """Fecha a rodada: pontua cada palpite e o vidente pela média da mesa."""
    psychic_id = state.get("psychic_id")
    target = state.get("target", 50)
    scores = state.get("scores") or {}

    results = []
    earned = []
    for player in players:
        if player.id == psychic_id:
            continue
        guess = (player.state or {}).get("guess")
        points = score_for(target, guess) if guess is not None else 0
        earned.append(points)
        results.append({"player_id": player.id, "guess": guess, "points": points})
        key = str(player.id)
        scores[key] = scores.get(key, 0) + points

    # O vidente leva a média da mesa: pista boa vale tanto quanto palpite bom.
    psychic_points = round(sum(earned) / len(earned)) if earned else 0
    psychic_key = str(psychic_id)
    scores[psychic_key] = scores.get(psychic_key, 0) + psychic_points

    state["scores"] = scores
    state["phase"] = "reveal"
    state["deadline_ts"] = now_ts + REVEAL_SECONDS
    state["last"] = {
        "round": state.get("round"),
        "target": target,
        "clue": state.get("clue"),
        "spectrum": state.get("spectrum"),
        "psychic_id": psychic_id,
        "psychic_points": psychic_points,
        "results": results,
    }
    for player in players:
        player_state = player.state or {}
        player_state["score"] = scores.get(str(player.id), 0)
        player.state = player_state
        player.save(update_fields=["state"])
    return state


def _finish(state):
    scores = state.get("scores") or {}
    if not scores:
        state["winners"] = []
        return state
    best = max(scores.values())
    state["winners"] = [int(pid) for pid, value in scores.items() if value == best]
    state["phase"] = "ended"
    state["deadline_ts"] = None
    return state


def tick(state, players, now_ts, rng=None):
    """Avança o relógio: prazos vencidos e transições automáticas de fase."""
    rng = _rng(rng)
    phase = state.get("phase")
    deadline = state.get("deadline_ts")

    if phase == "clue":
        # Vidente calado até o fim do tempo: a rodada é anulada e segue o jogo.
        if deadline and now_ts > deadline:
            state["clue"] = "(sem pista)"
            state["phase"] = "guess"
            state["deadline_ts"] = now_ts + GUESS_SECONDS
        return state

    if phase == "guess":
        if _all_guessed(state, players) or (deadline and now_ts > deadline):
            return resolve_round(state, players, now_ts)
        return state

    if phase == "reveal":
        if deadline and now_ts > deadline:
            if state.get("round", 1) >= state.get("max_rounds", 1):
                return _finish(state)
            state["round"] = state.get("round", 1) + 1
            return _new_round(state, players, rng, now_ts)
        return state

    return state


def redact_state(state):
    """O alvo é o jogo inteiro: só aparece quando a rodada é revelada."""
    safe = dict(state)
    if safe.get("phase") not in {"reveal", "ended"}:
        safe.pop("target", None)
    return safe
