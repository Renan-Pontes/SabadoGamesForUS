import {
  GRACE_MS,
  addScores,
  answerDeadline,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  randomInt,
  ranking,
  readOption,
  shuffle,
  timeUp,
  withActed,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { QUESTIONS, type QuizCategory } from './content'

/**
 * 🧠 Quiz do Terror — perguntas de terror com quatro alternativas.
 *
 *   question (15/20 s + folga) ──► reveal (7 s) ──► question da próxima
 *                                     ├── a cada 3 perguntas ──► scores (8 s) ──► question
 *                                     └── depois da última ──► final (over: pódio)
 *
 * Pontos: acerto = 500 + até 500 pela rapidez. Acertos seguidos dão +100 a
 * partir do segundo (2º seguido +100, 3º +200, 4º em diante +300). Errou ou
 * não respondeu, a sequência zera.
 *
 * O celular manda `{ choice, at }` (`at` = hora do toque no relógio do
 * servidor); o motor limita o `at` entre a abertura da pergunta e o prazo,
 * então relógio torto ou resposta atrasada nunca dão pontos a mais.
 *
 * O gabarito da pergunta da vez mora no `private` (nenhuma tela recebe) e só
 * vira público em `reveal.correct`, na revelação. Como todo motor: `step` é
 * puro e idempotente, devolve o MESMO objeto quando nada muda, trata `skip`
 * como prazo vencido e nunca espera por quem está offline.
 */

export const QUESTION_CHOICES = [8, 10, 15] as const
export const DEFAULT_QUESTIONS = 10
export const SECONDS_CHOICES = [15, 20] as const
export const DEFAULT_SECONDS = 20
export const REVEAL_SECONDS = 7
export const SCORES_SECONDS = 8
/** Placar entre perguntas a cada N perguntas (a última vai direto ao pódio). */
export const SCORES_EVERY = 3
export const OPTION_COUNT = 4

export const BASE_POINTS = 500
export const SPEED_POINTS = 500
export const STREAK_STEP = 100
export const STREAK_MAX = 300

/** Chance de o bot da simulação saber a resposta. */
const BOT_SKILL = 0.6

export type QuizPhase = 'question' | 'reveal' | 'scores' | 'final'

/** A pergunta da vez, como a TV e os celulares veem (sem o gabarito). */
export type QuizQuestion = {
  /** Posição em QUESTIONS. */
  id: number
  category: QuizCategory
  text: string
  /** As quatro alternativas já embaralhadas: a ordem é a das cores ▲ ◆ ● ■. */
  options: string[]
}

/** O que a revelação mostra (público só depois que a pergunta fecha). */
export type QuizReveal = {
  /** Índice da alternativa certa em `question.options`. */
  correct: number
  /** Quem escolheu o quê: `{ id: alternativa }` (só quem respondeu). */
  choices: Record<string, number>
  /** Pontos ganhos nesta pergunta (só quem acertou). */
  points: Record<string, number>
  /** Tempo de resposta em ms (só quem acertou). */
  times: Record<string, number>
  /** Quem acertou mais rápido (vazio se ninguém acertou). */
  fastest: number[]
}

export type QuizState = BaseState & {
  phase: QuizPhase
  round: number
  totalRounds: number
  /** Tempo de resposta escolhido (15 ou 20 s), sem a folga. */
  seconds: number
  /** Perguntas da partida (ids de QUESTIONS), uma por rodada. */
  deck: number[]
  question: QuizQuestion
  /** Quando a pergunta abriu (ms do servidor): o zero da rapidez. */
  startedAt: number
  scores: Record<string, number>
  /** Acertos seguidos até agora. */
  streaks: Record<string, number>
  /** Maior sequência de cada um na partida. */
  bestStreaks: Record<string, number>
  /** Total de acertos. */
  hits: Record<string, number>
  /** Quantas vezes cada um foi o mais rápido a acertar. */
  quickest: Record<string, number>
  /** Placar do último quadro de pontos (para mostrar quem subiu e quanto ganhou). */
  board: Record<string, number>
  acted: number[]
  /** Preenchido na revelação; null enquanto a pergunta está aberta. */
  reveal: QuizReveal | null
  /** O gabarito da pergunta da vez: nenhuma tela recebe o `private`. */
  private?: { gabarito: number }
}

/** O `index.ts` importa o estado com este nome. */
export type State = QuizState

// ---------------------------------------------------------------------------
// Pontuação
// ---------------------------------------------------------------------------

/** Bônus de rapidez: 500 no instante em que a pergunta abre, 0 no fim do tempo (de 10 em 10). */
export function speedPoints(elapsedMs: number, windowMs: number): number {
  if (!(windowMs > 0) || !Number.isFinite(elapsedMs)) return 0
  const left = 1 - Math.min(1, Math.max(0, elapsedMs) / windowMs)
  return Math.round(left * (SPEED_POINTS / 10)) * 10
}

/** Bônus de sequência: +100 por acerto seguido a partir do segundo, no máximo +300. */
export function streakBonus(streak: number): number {
  return Math.min(STREAK_MAX, STREAK_STEP * Math.max(0, Math.floor(streak) - 1))
}

/** Pontos de um acerto. */
export function pointsFor(elapsedMs: number, windowMs: number, streak: number): number {
  return BASE_POINTS + speedPoints(elapsedMs, windowMs) + streakBonus(streak)
}

/** Os pontos de um acerto separados em partes (para o celular explicar). */
export function pointsBreakdown(points: number, streak: number) {
  const bonus = points > 0 ? streakBonus(streak) : 0
  return { base: points > 0 ? BASE_POINTS : 0, speed: Math.max(0, points - BASE_POINTS - bonus), streak: bonus }
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

/**
 * Sorteia as perguntas da partida misturando os temas: a cada volta, uma
 * pergunta de cada tema (em ordem sorteada) — nada de cinco filmes seguidos.
 */
export function buildDeck(rng: () => number, count: number): number[] {
  const piles = new Map<QuizCategory, number[]>()
  QUESTIONS.forEach((question, id) => {
    piles.set(question.category, [...(piles.get(question.category) ?? []), id])
  })
  const shuffled = [...piles.values()].map((ids) => shuffle(ids, rng))
  const deck: number[] = []
  const wanted = Math.max(0, Math.min(count, QUESTIONS.length))
  while (deck.length < wanted) {
    for (const pile of shuffle(shuffled, rng)) {
      const id = pile.shift()
      if (id !== undefined && deck.length < wanted) deck.push(id)
    }
  }
  return deck
}

/** A pergunta com as alternativas embaralhadas e o índice da certa. */
function dealQuestion(id: number, rng: () => number): { question: QuizQuestion; gabarito: number } {
  const item = QUESTIONS[id] ?? QUESTIONS[0]
  const realId = QUESTIONS[id] ? id : 0
  const options = shuffle([item.answer, ...item.wrong], rng)
  return {
    question: { id: realId, category: item.category, text: item.text, options },
    gabarito: options.indexOf(item.answer),
  }
}

/** Índice da alternativa certa da pergunta da vez (-1 se não der para saber). */
export function gabaritoOf(state: QuizState): number {
  const stored = state.private?.gabarito
  if (typeof stored === 'number' && stored >= 0 && stored < state.question.options.length) return stored
  // Estado sem o segredo (não deveria acontecer): procura pelo texto da resposta.
  const item = QUESTIONS[state.question.id]
  return item ? state.question.options.indexOf(item.answer) : -1
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export type QuizAnswer = { choice: number; at: number }

/**
 * A resposta válida do jogador na pergunta da vez, ou null. A alternativa
 * precisa ser um índice inteiro de 0 a 3; o `at` vira um horário entre a
 * abertura da pergunta e o prazo (nem antes de abrir, nem depois de fechar,
 * nem no futuro). Sem `at` válido, vale a hora em que a pergunta fecha.
 */
export function answerOf(ctx: EngineCtx, state: QuizState, playerId: number): QuizAnswer | null {
  if (!state.roster.includes(playerId)) return null
  const input = inputFor(ctx, state.inputKey, playerId)
  const choice = input?.choice
  if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice >= state.question.options.length) {
    return null
  }
  const closesAt = state.deadline ?? state.startedAt + state.seconds * 1000 + GRACE_MS
  const latest = Math.max(state.startedAt, Math.min(closesAt, ctx.now))
  const raw = typeof input?.at === 'number' && Number.isFinite(input.at) ? input.at : latest
  return { choice, at: Math.min(latest, Math.max(state.startedAt, raw)) }
}

/** Quem do roster já mandou uma resposta válida (na ordem do roster). */
export function answeredIds(ctx: EngineCtx, state: QuizState): number[] {
  return state.roster.filter((id) => answerOf(ctx, state, id) !== null)
}

/** Todo mundo online já respondeu? Offline não segura; ninguém online → espera o prazo. */
function allOnlineAnswered(ctx: EngineCtx, state: QuizState): boolean {
  const online = onlineRoster(ctx, state.roster)
  return online.length > 0 && online.every((id) => answerOf(ctx, state, id) !== null)
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

/** Abre a pergunta da rodada `round`. */
function startQuestion(state: QuizState, ctx: EngineCtx, round: number): QuizState {
  const { question, gabarito } = dealQuestion(state.deck[round - 1] ?? 0, ctx.rng)
  return {
    ...state,
    phase: 'question',
    round,
    // Uma chave por pergunta: resposta da pergunta passada não vale nesta.
    inputKey: `q-${round}`,
    deadline: answerDeadline(ctx.now, state.seconds),
    startedAt: ctx.now,
    question,
    acted: [],
    reveal: null,
    private: { gabarito },
  }
}

/** Ids empatados no menor tempo (vazio se ninguém acertou). */
function fastestIds(times: Record<string, number>): number[] {
  const entries = Object.entries(times)
  if (!entries.length) return []
  const best = Math.min(...entries.map(([, ms]) => ms))
  return entries
    .filter(([, ms]) => ms === best)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b)
}

/** Fecha a pergunta: revela a certa, conta quem escolheu o quê e paga quem acertou. */
function revealAnswer(state: QuizState, ctx: EngineCtx): QuizState {
  const correct = gabaritoOf(state)
  const windowMs = state.seconds * 1000
  const choices: Record<string, number> = {}
  const points: Record<string, number> = {}
  const times: Record<string, number> = {}
  const streaks = { ...state.streaks }
  const bestStreaks = { ...state.bestStreaks }
  const hits = { ...state.hits }

  for (const id of state.roster) {
    const key = String(id)
    const answer = answerOf(ctx, state, id)
    if (answer) choices[key] = answer.choice
    if (!answer || answer.choice !== correct) {
      streaks[key] = 0
      continue
    }
    const elapsed = answer.at - state.startedAt
    const streak = (state.streaks[key] ?? 0) + 1
    streaks[key] = streak
    bestStreaks[key] = Math.max(bestStreaks[key] ?? 0, streak)
    hits[key] = (hits[key] ?? 0) + 1
    points[key] = pointsFor(elapsed, windowMs, streak)
    times[key] = elapsed
  }

  const fastest = fastestIds(times)
  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, REVEAL_SECONDS),
    acted: answeredIds(ctx, state),
    reveal: { correct, choices, points, times, fastest },
    scores: addScores(state.scores, points),
    streaks,
    bestStreaks,
    hits,
    quickest: addScores(state.quickest, Object.fromEntries(fastest.map((id) => [id, 1]))),
  }
}

export const engine: HalloweenEngine<QuizState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const wanted = readOption<number>(ctx.options, 'questions', DEFAULT_QUESTIONS, QUESTION_CHOICES)
    const seconds = readOption<number>(ctx.options, 'seconds', DEFAULT_SECONDS, SECONDS_CHOICES)
    const deck = buildDeck(ctx.rng, wanted)
    const zero = () => emptyScores(roster)
    const blank: QuizState = {
      phase: 'question',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      round: 0,
      totalRounds: deck.length,
      seconds,
      deck,
      question: { id: 0, category: QUESTIONS[0].category, text: '', options: [] },
      startedAt: ctx.now,
      scores: zero(),
      streaks: zero(),
      bestStreaks: zero(),
      hits: zero(),
      quickest: zero(),
      board: zero(),
      acted: [],
      reveal: null,
    }
    return startQuestion(blank, ctx, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'question':
        // Fecha no prazo, no "Pular" do host ou quando todo mundo online respondeu.
        if (timeUp(state, ctx) || allOnlineAnswered(ctx, state)) return revealAnswer(state, ctx)
        // Só atualiza os ✓ da TV — e só se alguém novo respondeu.
        return withActed(state, answeredIds(ctx, state))
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null }
        if (state.round % SCORES_EVERY === 0) {
          return { ...state, phase: 'scores', deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
        }
        return startQuestion(state, ctx, state.round + 1)
      case 'scores':
        if (!timeUp(state, ctx)) return state
        // O placar mostrado vira a referência do próximo (quem subiu, quanto ganhou).
        return startQuestion({ ...state, board: state.scores }, ctx, state.round + 1)
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || state.phase !== 'question' || !state.roster.includes(playerId)) return null
    const correct = gabaritoOf(state)
    const knows = correct >= 0 && ctx.rng() < BOT_SKILL
    const choice = knows ? correct : randomInt(ctx.rng, 0, Math.max(1, state.question.options.length) - 1)
    return { choice, at: ctx.now }
  },
}

// ---------------------------------------------------------------------------
// Para as telas (puro: TV e celular calculam igual)
// ---------------------------------------------------------------------------

/** Quantas pessoas escolheram cada alternativa. */
export function countChoices(reveal: QuizReveal, options: number): number[] {
  const counts = Array.from({ length: options }, () => 0)
  for (const choice of Object.values(reveal.choices)) {
    if (Number.isInteger(choice) && choice >= 0 && choice < options) counts[choice] += 1
  }
  return counts
}

export type ScoreRow = RankEntry & {
  /** Pontos ganhos desde o último quadro de pontos. */
  gained: number
  /** Posições que subiu (negativo = caiu) desde o último quadro. */
  moved: number
  streak: number
}

/** Classificação com o que mudou desde o último placar. */
export function scoreRows(state: QuizState): ScoreRow[] {
  const before = new Map(ranking(state.board, state.roster).map((entry) => [entry.id, entry.place]))
  return ranking(state.scores, state.roster).map((entry) => {
    const key = String(entry.id)
    return {
      ...entry,
      gained: entry.score - (state.board[key] ?? 0),
      moved: (before.get(entry.id) ?? entry.place) - entry.place,
      streak: state.streaks[key] ?? 0,
    }
  })
}

export type QuizAwards = {
  ranking: RankEntry[]
  /** "Cérebro do Além": quem fez mais pontos (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** Maior sequência de acertos da partida (só conta a partir de 2). */
  bestStreak: { ids: number[]; streak: number }
  /** Dedo mais rápido: quem mais vezes acertou primeiro. */
  fastest: { ids: number[]; count: number }
}

function leaders(record: Record<string, number>, roster: readonly number[], minimum: number) {
  const best = Math.max(0, ...roster.map((id) => record[String(id)] ?? 0))
  if (best < minimum) return { ids: [] as number[], best }
  return { ids: roster.filter((id) => (record[String(id)] ?? 0) === best), best }
}

/** Os prêmios do fim — calculados do estado, servem para a TV e o celular. */
export function finalAwards(state: QuizState): QuizAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const streak = leaders(state.bestStreaks, state.roster, 2)
  const fastest = leaders(state.quickest, state.roster, 1)
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    bestStreak: { ids: streak.ids, streak: streak.best },
    fastest: { ids: fastest.ids, count: fastest.best },
  }
}
