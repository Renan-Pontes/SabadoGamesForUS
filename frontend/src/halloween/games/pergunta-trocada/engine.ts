import {
  addScores,
  answerDeadline,
  chaosRoll,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  pick,
  ranking,
  readOption,
  shuffle,
  tally,
  timeUp,
  topIds,
  withActed,
  type RankEntry,
  type TallyEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { BOT_ANSWERS, PAIRS, type AnswerKind } from './content'

/**
 * 🤨 Pergunta Trocada — dedução social, o mais simples possível.
 *
 * Todo mundo recebe a mesma pergunta no celular, menos o impostor, que recebe
 * uma parecida (e NÃO sabe que é o impostor). Todos respondem; a TV mostra as
 * respostas ao lado dos nomes, depois a pergunta de verdade; a mesa conversa
 * e vota em quem respondeu outra coisa.
 *
 *   question (40 s) ─► answers (8–15 s) ─► talk (45/60/90 s) ─► vote (30 s)
 *     ─► result (16 s) ─► scores (7 s) ─► question da próxima rodada
 *                         └── na última rodada ──► final (over)
 *
 * Rodada sem impostor (opção, no máximo uma por partida, a partir da 2ª):
 * todo mundo recebe a mesma pergunta e ninguém sabe até a revelação.
 *
 * O par de perguntas, quem é o impostor e a pergunta de cada um moram só no
 * `private` (o de cada um na sua carta; o da mesa em `private._mesa`). As
 * respostas viram públicas na fase `answers`; a pergunta da mesa, na `talk`;
 * o impostor e a pergunta dele, no `result`. Como todo motor: `step` é puro e
 * idempotente, devolve o MESMO objeto quando nada muda, trata `skip` como
 * prazo vencido e nunca espera por quem está offline.
 */

export const QUESTION_SECONDS = 40
export const VOTE_SECONDS = 30
export const RESULT_SECONDS = 16
export const SCORES_SECONDS = 7

export const ROUND_CHOICES = [3, 5, 7] as const
export const DEFAULT_ROUNDS = 5
export const TALK_CHOICES = [45, 60, 90] as const
export const DEFAULT_TALK_SECONDS = 60
/** Chance de a rodada (a partir da 2ª) ser sem impostor — no máximo uma por partida. */
export const CHAOS_CHANCE = 0.2

/** Pegaram o impostor: cada um da mesa ganha isto... */
export const GROUP_POINTS = 1
/** ...e quem votou nele ganha mais isto. */
export const SHARP_BONUS = 1
/** O impostor escapou (empate, ninguém votou ou o mais votado era inocente). */
export const ESCAPE_POINTS = 3
/** Rodada sem impostor: o mais votado leva de consolação. */
export const CONSOLATION_POINTS = 2

/** Tamanho máximo de uma resposta (o resto é cortado). */
export const ANSWER_MAX = 40
/** Chave do segredo da mesa em `private`. */
export const MESA_KEY = '_mesa'

export type Phase = 'question' | 'answers' | 'talk' | 'vote' | 'result' | 'scores' | 'final'

/** A carta de cada um: a pergunta que ele recebeu. `odd` = recebeu a trocada. */
export type PtCard = { question: string; odd: boolean }

/** O segredo da rodada: o baralho de pares, o par da vez e o impostor. */
export type PtMesa = {
  deck: number[]
  pair: number
  /** true = a mesa recebe a pergunta `b` do par e o impostor a `a`. */
  flip: boolean
  /** null = rodada sem impostor. */
  impostor: number | null
}

/** O que a TV revela no fim da rodada. */
export type PtResult = {
  /** null = rodada sem impostor. */
  impostor: number | null
  /** A pergunta que o impostor recebeu (null na rodada sem impostor). */
  oddQuestion: string | null
  realQuestion: string
  /** Quem votou em quem (só votos válidos). */
  votes: Record<string, number>
  tally: TallyEntry[]
  /** Os mais votados (empatados juntos; vazio se ninguém votou). */
  top: number[]
  /** O mais votado SEM empate (null = empate ou ninguém votou). */
  accused: number | null
  /** Rodada normal e o mais votado era o impostor. */
  caught: boolean
  /** Quem da mesa votou no impostor. */
  sharp: number[]
  /** Pontos ganhos nesta rodada (só quem ganhou). */
  gains: Record<string, number>
}

export type HistoryEntry = {
  round: number
  impostor: number | null
  caught: boolean
  sharp: number[]
  realQuestion: string
}

export type State = BaseState & {
  phase: Phase
  round: number
  totalRounds: number
  /** Duração da conversa (opção), em ms. */
  talkMs: number
  /** Rodada sem impostor ligada (é a opção, não o tipo da rodada). */
  chaosOn: boolean
  /** Tipo de resposta da rodada (o mesmo para a mesa e o impostor: pode ser público). */
  kind: AnswerKind
  /** Respostas, públicas a partir de `answers` (quem não respondeu fica de fora). */
  answers: Record<string, string>
  /** A pergunta da mesa, pública a partir de `talk`. */
  realQuestion: string | null
  acted: number[]
  scores: Record<string, number>
  result: PtResult | null
  history: HistoryEntry[]
  private: Record<string, PtCard | PtMesa>
}

/** Chaves das respostas de cada etapa (mudam a cada rodada). */
export const keys = {
  answer: (round: number) => `answer-${round}`,
  answers: (round: number) => `answers-${round}`,
  talk: (round: number) => `talk-${round}`,
  vote: (round: number) => `vote-${round}`,
  result: (round: number) => `result-${round}`,
  scores: (round: number) => `scores-${round}`,
}

/** Fases em que os celulares respondem (o prazo tem a folga de 2 s). */
export const ANSWER_PHASES: readonly Phase[] = ['question', 'vote']

// ---------------------------------------------------------------------------
// Leituras e regras puras
// ---------------------------------------------------------------------------

/** Quanto tempo a TV mostra as respostas antes da pergunta de verdade (cresce com a mesa). */
export function answersSeconds(players: number): number {
  return Math.min(15, 7 + Math.ceil(Math.max(0, players) / 2))
}

/** Duração cheia de cada fase em ms (sem a folga), para os relógios das telas. */
export function phaseTotalMs(state: Pick<State, 'phase' | 'talkMs' | 'roster'>): number {
  switch (state.phase) {
    case 'question':
      return QUESTION_SECONDS * 1000
    case 'answers':
      return answersSeconds(state.roster.length) * 1000
    case 'talk':
      return state.talkMs
    case 'vote':
      return VOTE_SECONDS * 1000
    case 'result':
      return RESULT_SECONDS * 1000
    case 'scores':
      return SCORES_SECONDS * 1000
    default:
      return 0
  }
}

/** A carta de alguém (ou null se o segredo não é uma carta). */
export function asCard(value: unknown): PtCard | null {
  if (!value || typeof value !== 'object') return null
  const card = value as Partial<PtCard>
  return typeof card.question === 'string' && typeof card.odd === 'boolean' ? { question: card.question, odd: card.odd } : null
}

const EMPTY_MESA: PtMesa = { deck: [], pair: 0, flip: false, impostor: null }

export function mesaOf(state: State): PtMesa {
  const mesa = state.private?.[MESA_KEY]
  return mesa && 'deck' in mesa ? mesa : EMPTY_MESA
}

export function cardOf(state: State, id: number): PtCard | null {
  return asCard(state.private?.[String(id)])
}

/** As duas perguntas da rodada: a da mesa e a do impostor. */
export function questionsOf(mesa: PtMesa): { group: string; odd: string; kind: AnswerKind } {
  const pair = PAIRS[mesa.pair] ?? PAIRS[0]
  return mesa.flip ? { group: pair.b, odd: pair.a, kind: pair.kind } : { group: pair.a, odd: pair.b, kind: pair.kind }
}

/** Resposta limpa: espaços juntos, sem sobra, no máximo ANSWER_MAX letras (null = vazia). */
export function cleanAnswer(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const text = String(raw).replace(/\s+/g, ' ').trim().slice(0, ANSWER_MAX).trim()
  return text || null
}

/** A resposta válida de cada um nesta fase de perguntas. */
export function collectAnswers(state: State, ctx: EngineCtx): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const id of state.roster) {
    const text = cleanAnswer(inputFor(ctx, state.inputKey, id)?.answer)
    if (text) answers[String(id)] = text
  }
  return answers
}

/** O voto válido de cada um: alvo na partida e nunca em si mesmo. */
export function collectVotes(state: State, ctx: EngineCtx): Record<string, number> {
  const votes: Record<string, number> = {}
  for (const voter of state.roster) {
    const target = inputFor(ctx, state.inputKey, voter)?.vote
    if (typeof target === 'number' && target !== voter && state.roster.includes(target)) votes[String(voter)] = target
  }
  return votes
}

/** Quem apertou "Bora votar" na conversa. */
export function readyIds(state: State, ctx: EngineCtx): number[] {
  return state.roster.filter((id) => inputFor(ctx, state.inputKey, id)?.ready === true)
}

/** Todos os online do roster estão nesta lista? (offline não segura a fase) */
function allOnlineIn(ctx: EngineCtx, roster: readonly number[], ids: readonly number[]) {
  const online = onlineRoster(ctx, roster)
  return online.length > 0 && online.every((id) => ids.includes(id))
}

/**
 * Pontos da rodada.
 * - Sem impostor: o mais votado (todos, no empate) leva a consolação.
 * - Pegaram o impostor: todo mundo da mesa +1, e quem votou nele +1 extra.
 * - O impostor escapou: ele leva +3.
 */
export function scoreRound(
  roster: readonly number[],
  impostor: number | null,
  votes: Record<string, number>,
  top: readonly number[],
): { gains: Record<string, number>; caught: boolean; sharp: number[]; accused: number | null } {
  const gains: Record<string, number> = {}
  const give = (id: number, points: number) => {
    gains[String(id)] = (gains[String(id)] ?? 0) + points
  }
  const accused = top.length === 1 ? top[0] : null
  if (impostor === null) {
    for (const id of top) give(id, CONSOLATION_POINTS)
    return { gains, caught: false, sharp: [], accused }
  }
  const sharp = roster.filter((id) => id !== impostor && votes[String(id)] === impostor)
  const caught = accused === impostor
  if (caught) {
    for (const id of roster) if (id !== impostor) give(id, GROUP_POINTS)
    for (const id of sharp) give(id, SHARP_BONUS)
  } else {
    give(impostor, ESCAPE_POINTS)
  }
  return { gains, caught, sharp, accused }
}

/** Quantas vezes cada um já foi impostor (só rodadas terminadas — públicas). */
function impostorCounts(history: readonly HistoryEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of history) {
    if (entry.impostor !== null) counts[String(entry.impostor)] = (counts[String(entry.impostor)] ?? 0) + 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// Transições
// ---------------------------------------------------------------------------

/** Começa a rodada: par de perguntas, impostor (ou ninguém) e a carta de cada um. */
function startRound(state: State, ctx: EngineCtx, round: number, deck: number[]): State {
  const pair = deck[round - 1] ?? (round - 1) % PAIRS.length
  const flip = ctx.rng() < 0.5
  const chaosUsed = state.history.some((entry) => entry.impostor === null)
  const chaos =
    state.roster.length >= 3 &&
    chaosRoll<'nobody'>(ctx.rng, round, state.chaosOn, chaosUsed ? ['nobody'] : [], { chance: CHAOS_CHANCE, kinds: ['nobody'] }) === 'nobody'

  // Impostor sai de quem está online agora e foi impostor menos vezes (todo mundo tem a sua vez).
  const online = onlineRoster(ctx, state.roster)
  const pool = online.length ? online : state.roster
  const counts = impostorCounts(state.history)
  const fewest = Math.min(...pool.map((id) => counts[String(id)] ?? 0))
  const candidates = pool.filter((id) => (counts[String(id)] ?? 0) === fewest)
  const impostor = chaos || !candidates.length ? null : pick(candidates, ctx.rng)

  const mesa: PtMesa = { deck, pair, flip, impostor }
  const questions = questionsOf(mesa)
  const secrets: Record<string, PtCard | PtMesa> = {}
  for (const id of state.roster) {
    const odd = id === impostor
    secrets[String(id)] = { question: odd ? questions.odd : questions.group, odd }
  }
  secrets[MESA_KEY] = mesa

  return {
    ...state,
    phase: 'question',
    round,
    inputKey: keys.answer(round),
    deadline: answerDeadline(ctx.now, QUESTION_SECONDS),
    kind: questions.kind,
    answers: {},
    realQuestion: null,
    acted: [],
    result: null,
    private: secrets,
  }
}

function stepQuestion(state: State, ctx: EngineCtx): State {
  const answers = collectAnswers(state, ctx)
  const acted = state.roster.filter((id) => String(id) in answers)
  if (!timeUp(state, ctx) && !allOnlineIn(ctx, state.roster, acted)) return withActed(state, acted)
  return {
    ...state,
    phase: 'answers',
    inputKey: keys.answers(state.round),
    deadline: deadlineIn(ctx.now, answersSeconds(state.roster.length)),
    answers,
    acted: [],
  }
}

function startTalk(state: State, ctx: EngineCtx): State {
  return {
    ...state,
    phase: 'talk',
    inputKey: keys.talk(state.round),
    deadline: ctx.now + state.talkMs,
    realQuestion: questionsOf(mesaOf(state)).group,
    acted: [],
  }
}

function stepTalk(state: State, ctx: EngineCtx): State {
  const ready = readyIds(state, ctx)
  if (!timeUp(state, ctx) && !allOnlineIn(ctx, state.roster, ready)) return withActed(state, ready)
  return {
    ...state,
    phase: 'vote',
    inputKey: keys.vote(state.round),
    deadline: answerDeadline(ctx.now, VOTE_SECONDS),
    acted: [],
  }
}

function stepVote(state: State, ctx: EngineCtx): State {
  const votes = collectVotes(state, ctx)
  const acted = state.roster.filter((id) => String(id) in votes)
  if (!timeUp(state, ctx) && !allOnlineIn(ctx, state.roster, acted)) return withActed(state, acted)
  return finishRound({ ...state, acted }, ctx, votes)
}

/** Fecha a votação: conta, revela o impostor e a pergunta dele, distribui os pontos. */
function finishRound(state: State, ctx: EngineCtx, votes: Record<string, number>): State {
  const mesa = mesaOf(state)
  const questions = questionsOf(mesa)
  const impostor = mesa.impostor !== null && state.roster.includes(mesa.impostor) ? mesa.impostor : null
  const entries = tally(votes)
  const top = topIds(entries)
  const { gains, caught, sharp, accused } = scoreRound(state.roster, impostor, votes, top)
  const realQuestion = state.realQuestion ?? questions.group
  return {
    ...state,
    phase: 'result',
    inputKey: keys.result(state.round),
    deadline: deadlineIn(ctx.now, RESULT_SECONDS),
    realQuestion,
    result: {
      impostor,
      oddQuestion: impostor === null ? null : questions.odd,
      realQuestion,
      votes,
      tally: entries,
      top,
      accused,
      caught,
      sharp,
      gains,
    },
    scores: addScores(state.scores, gains),
    history: [...state.history, { round: state.round, impostor, caught, sharp, realQuestion }],
  }
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<State> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const talkSeconds = readOption<number>(ctx.options, 'talkSeconds', DEFAULT_TALK_SECONDS, TALK_CHOICES)
    // Uma pergunta por rodada, sem repetir na partida.
    const deck = shuffle(
      PAIRS.map((_, id) => id),
      ctx.rng,
    ).slice(0, totalRounds)
    const blank: State = {
      phase: 'question',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      round: 0,
      totalRounds,
      talkMs: talkSeconds * 1000,
      chaosOn: readOption<boolean>(ctx.options, 'chaos', true),
      kind: 'curta',
      answers: {},
      realQuestion: null,
      acted: [],
      scores: emptyScores(roster),
      result: null,
      history: [],
      private: {},
    }
    return startRound(blank, ctx, 1, deck)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'question':
        return stepQuestion(state, ctx)
      case 'answers':
        return timeUp(state, ctx) ? startTalk(state, ctx) : state
      case 'talk':
        return stepTalk(state, ctx)
      case 'vote':
        return stepVote(state, ctx)
      case 'result':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null, acted: [] }
        return { ...state, phase: 'scores', inputKey: keys.scores(state.round), deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx, state.round + 1, mesaOf(state).deck) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || !state.roster.includes(playerId)) return null
    switch (state.phase) {
      case 'question':
        // De vez em quando alguém não responde a tempo (a TV mostra 🤐).
        return ctx.rng() < 0.1 ? null : { answer: pick(BOT_ANSWERS[state.kind], ctx.rng) }
      case 'talk': {
        // Ao longo da conversa, cada um aperta "Bora votar" com ~70% de chance.
        const seconds = Math.max(1, state.talkMs / 1000)
        return ctx.rng() < 0.7 / seconds ? { ready: true } : null
      }
      case 'vote': {
        const others = state.roster.filter((id) => id !== playerId)
        if (!others.length) return null
        const impostor = mesaOf(state).impostor
        if (impostor !== null && impostor !== playerId && ctx.rng() < 0.45) return { vote: impostor }
        return { vote: pick(others, ctx.rng) }
      }
      default:
        return null
    }
  },
}

// ---------------------------------------------------------------------------
// Prêmios do fim (TV e celular)
// ---------------------------------------------------------------------------

export type PtAwards = {
  ranking: RankEntry[]
  /** Quem fez mais pontos (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** 🥸 Cara de pau: quem mais escapou como impostor. */
  bluffers: number[]
  maxEscapes: number
  /** 🦌 Nariz de Rudolph: quem mais votou certo no impostor. */
  sniffers: number[]
  maxSharp: number
}

function leaders(roster: readonly number[], counts: Record<string, number>) {
  const best = Math.max(0, ...roster.map((id) => counts[String(id)] ?? 0))
  return { ids: best > 0 ? roster.filter((id) => (counts[String(id)] ?? 0) === best) : [], best }
}

export function finalAwards(state: State): PtAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const escapes: Record<string, number> = {}
  const sharp: Record<string, number> = {}
  for (const entry of state.history) {
    if (entry.impostor !== null && !entry.caught) escapes[String(entry.impostor)] = (escapes[String(entry.impostor)] ?? 0) + 1
    for (const id of entry.sharp) sharp[String(id)] = (sharp[String(id)] ?? 0) + 1
  }
  const bluff = leaders(state.roster, escapes)
  const sniff = leaders(state.roster, sharp)
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    bluffers: bluff.ids,
    maxEscapes: bluff.best,
    sniffers: sniff.ids,
    maxSharp: sniff.best,
  }
}
