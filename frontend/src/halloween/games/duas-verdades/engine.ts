import {
  addScores,
  answerDeadline,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  ranking,
  readOption,
  sample,
  seededRng,
  shuffle,
  timeUp,
  withActed,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HInput, HalloweenEngine } from '../../engine/types'
import { BOT_FACTS } from './content'

/**
 * 🤞 Duas Verdades, Uma Mentira — o clássico de roda de lareira.
 *
 *   write (3 min) ──► vote (vez 1) ──► reveal ──► vote (vez 2) ──► … ──► final (over)
 *      └── ninguém escreveu ──► final direto
 *
 * Na escrita, cada um manda 3 frases sobre si e marca qual é a mentira. Depois,
 * uma pessoa por vez vira a estrela: a TV mostra as 3 frases dela embaralhadas
 * (A, B, C), a mesa conversa e todo mundo (menos ela) vota na mentira.
 *
 * Pontos: +1 para quem acertou a mentira; o autor ganha +1 por pessoa
 * enganada. Quem não escreveu (ou não foi sorteado, com o limite de vezes)
 * só vota.
 *
 * Segredo: as frases e a mentira de cada um ficam no `private` do autor; as
 * cartas da vez são públicas, mas qual delas é a mentira só aparece na
 * revelação. A ordem das cartas sai da sorte fixa da partida (`seed`) + a vez:
 * refazer a passagem dá as mesmas letras.
 */

export const WRITE_SECONDS = 180
/** Mesmo com todo mundo já votado, a mesa conversa pelo menos isto (o narrador lê as frases). */
export const MIN_TALK_SECONDS = 22
export const REVEAL_SECONDS = 12
/** "Enganou todo mundo!" tem o zoom suspeito: um tiquinho a mais de tela. */
export const FOOLED_ALL_REVEAL_SECONDS = 14
export const MAX_FACT_CHARS = 80
export const FACT_COUNT = 3
/** 0 = todo mundo que escreveu aparece. */
export const TURN_CHOICES = [0, 6, 10] as const
export const DEFAULT_TURNS = 0
export const TALK_CHOICES = [30, 45, 60] as const
export const DEFAULT_TALK = 45
export const RIGHT_POINTS = 1
export const FOOL_POINTS = 1

export type DvPhase = 'write' | 'vote' | 'reveal' | 'final'

/** Uma frase na mesa. `id` é a posição (A, B, C). */
export type DvCard = { id: number; text: string }

/** O segredo do autor: as 3 frases como escreveu e qual é a mentira (0, 1 ou 2). */
export type DvSecret = { facts: string[]; lie: number }

/**
 * Como a vez terminou: `fooled-all` (ninguém acertou), `all-right` (todo
 * mundo que votou acertou), `mixed` ou `no-votes` (ninguém votou).
 */
export type DvOutcome = 'fooled-all' | 'all-right' | 'mixed' | 'no-votes'

export type DvReveal = {
  author: number
  /** A carta da mentira (posição na mesa). */
  lieCard: number
  /** Quem votou em qual carta. */
  votes: Record<string, number>
  right: number[]
  fooled: number[]
  /** Pontos ganhos nesta vez (só quem ganhou algo). */
  gained: Record<string, number>
  outcome: DvOutcome
}

/** Uma vez já jogada — para a "mentira da noite" no fim. */
export type DvHistory = { turn: number; author: number; lie: string; fooled: number; voters: number }

export type DvState = BaseState & {
  phase: DvPhase
  /** A vez atual (0 na escrita). */
  round: number
  /** Quantas vezes a partida tem (0 até a escrita fechar). */
  totalRounds: number
  /** Limite de vezes escolhido (0 = todos). */
  turnLimit: number
  talkMs: number
  seed: number
  /** Quem aparece, na ordem das vezes. */
  queue: number[]
  /** Não escreveu a tempo: só vota. */
  skipped: number[]
  /** Escreveu, mas ficou de fora do sorteio (limite de vezes). */
  benched: number[]
  /** A estrela da vez (null na escrita e no fim sem vezes). */
  author: number | null
  /** As 3 frases da vez, já embaralhadas. Vazio na escrita. */
  cards: DvCard[]
  /** Quando a vez começou (ms do servidor), para o tempo mínimo de papo. */
  turnStart: number | null
  scores: Record<string, number>
  acted: number[]
  reveal: DvReveal | null
  /** Quantas pessoas cada um enganou na partida. */
  fooledTotal: Record<string, number>
  /** Quantas mentiras cada um acertou na partida. */
  rightTotal: Record<string, number>
  history: DvHistory[]
  private: Record<string, DvSecret>
}

export type State = DvState

// ---------------------------------------------------------------------------
// Frases
// ---------------------------------------------------------------------------

/** Caracteres que não aparecem na tela (espaço de largura zero, controle de direção...). */
function isInvisible(code: number): boolean {
  return (
    code === 0x200b ||
    code === 0x200c ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) ||
    code === 0xfeff
  )
}

/**
 * A frase como vai para a TV: uma linha, sem caractere invisível, sem espaço
 * sobrando e com no máximo 80 letras (emoji conta 1). Vazia vira ''.
 */
export function cleanFact(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  for (const char of raw.slice(0, MAX_FACT_CHARS * 4)) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127) out += ' '
    else if (!isInvisible(code)) out += char
  }
  const flat = out.replace(/\s+/g, ' ').trim()
  if (!flat.replace(/‍/g, '').trim()) return ''
  const chars = Array.from(flat)
  return chars.length > MAX_FACT_CHARS ? chars.slice(0, MAX_FACT_CHARS).join('').trim() : flat
}

/** Quantas letras a frase tem, do jeito que o motor conta (emoji conta 1). */
export function factLength(text: string): number {
  return Array.from(text).length
}

/** Chave para achar frases iguais: sem acento, maiúscula nem pontuação. */
export function factKey(text: string): string {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = plain.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return words || plain.replace(/\s+/g, ' ').trim()
}

/** O que falta para as cartinhas valerem (null = está tudo certo). */
export type EntryProblem = 'missing' | 'duplicate' | 'no-lie'

/** Confere as 3 frases (já limpas) e a mentira marcada. A mesma regra no celular e no motor. */
export function entryProblem(facts: readonly string[], lie: unknown): EntryProblem | null {
  if (facts.length !== FACT_COUNT || facts.some((fact) => !fact)) return 'missing'
  if (new Set(facts.map(factKey)).size !== FACT_COUNT) return 'duplicate'
  if (typeof lie !== 'number' || !Number.isInteger(lie) || lie < 0 || lie >= FACT_COUNT) return 'no-lie'
  return null
}

/** As cartinhas de uma resposta, se valerem (frases limpas, diferentes, mentira marcada). */
export function readEntry(input: HInput | Record<string, unknown> | null | undefined): DvSecret | null {
  const raw = input?.facts
  if (!Array.isArray(raw) || raw.length !== FACT_COUNT) return null
  const facts = raw.map(cleanFact)
  const lie = input?.lie
  if (entryProblem(facts, lie) !== null) return null
  return { facts, lie: lie as number }
}

/** Quem já mandou cartinhas válidas, na ordem do roster. */
export function collectEntries(state: DvState, ctx: EngineCtx): { id: number; entry: DvSecret }[] {
  const entries: { id: number; entry: DvSecret }[] = []
  for (const id of state.roster) {
    const entry = readEntry(inputFor(ctx, state.inputKey, id))
    if (entry) entries.push({ id, entry })
  }
  return entries
}

/** Ordem das cartas da vez: posição na mesa → índice da frase como o autor escreveu. */
export function cardOrder(seed: number, turn: number): number[] {
  return shuffle([0, 1, 2], seededRng(seed * 31 + turn))
}

/** Quem vota na vez: todo o roster, menos a estrela. */
export function votersOf(state: Pick<DvState, 'roster' | 'author'>): number[] {
  return state.roster.filter((id) => id !== state.author)
}

/** O voto válido de cada um: carta que existe, de quem não é o autor. */
export function collectVotes(state: DvState, ctx: EngineCtx): Record<string, number> {
  const valid = new Set(state.cards.map((card) => card.id))
  const votes: Record<string, number> = {}
  for (const voter of votersOf(state)) {
    const card = inputFor(ctx, state.inputKey, voter)?.card
    if (typeof card === 'number' && valid.has(card)) votes[String(voter)] = card
  }
  return votes
}

/** Todo mundo online da lista já fez a sua parte? (Offline não segura; lista vazia não fecha.) */
function everyoneOnlineDone(ctx: EngineCtx, ids: readonly number[], done: readonly number[]): boolean {
  const online = onlineRoster(ctx, ids)
  return online.length > 0 && online.every((id) => done.includes(id))
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

/** Abre a vez `turn` (1-based) da fila. */
function startTurn(state: DvState, now: number, turn: number): DvState {
  const author = state.queue[turn - 1]
  const secret = state.private[String(author)]
  const order = cardOrder(state.seed, turn)
  return {
    ...state,
    phase: 'vote',
    round: turn,
    inputKey: `vote-${turn}`,
    deadline: answerDeadline(now, state.talkMs / 1000),
    author,
    cards: order.map((original, position) => ({ id: position, text: secret?.facts[original] ?? '' })),
    turnStart: now,
    acted: [],
    reveal: null,
  }
}

function finish(state: DvState): DvState {
  return { ...state, phase: 'final', over: true, deadline: null, acted: [] }
}

/** Fecha a escrita: sorteia a ordem (e quem entra, com limite) e abre a primeira vez. */
function closeWriting(state: DvState, ctx: EngineCtx): DvState {
  const entries = collectEntries(state, ctx)
  const writers = entries.map((item) => item.id)
  const order = shuffle(writers, seededRng(state.seed))
  const limit = state.turnLimit > 0 ? state.turnLimit : order.length
  const queue = order.slice(0, limit)
  const benched = state.roster.filter((id) => order.slice(limit).includes(id))
  const secrets: Record<string, DvSecret> = {}
  for (const { id, entry } of entries) {
    if (queue.includes(id)) secrets[String(id)] = entry
  }
  const next: DvState = {
    ...state,
    queue,
    benched,
    skipped: state.roster.filter((id) => !writers.includes(id)),
    totalRounds: queue.length,
    private: secrets,
  }
  if (!queue.length) return finish(next)
  return startTurn(next, ctx.now, 1)
}

/** Fecha a votação: acha a mentira, paga quem acertou e o autor por quem caiu. */
function closeVoting(state: DvState, ctx: EngineCtx): DvState {
  const author = state.author ?? -1
  const secret = state.private[String(author)]
  const lieCard = secret ? cardOrder(state.seed, state.round).indexOf(secret.lie) : 0
  const votes = collectVotes(state, ctx)
  const voters = votersOf(state).filter((id) => String(id) in votes)
  const right = voters.filter((id) => votes[String(id)] === lieCard)
  const fooled = voters.filter((id) => votes[String(id)] !== lieCard)

  const gained: Record<string, number> = {}
  for (const id of right) gained[String(id)] = RIGHT_POINTS
  if (fooled.length) gained[String(author)] = fooled.length * FOOL_POINTS

  const outcome: DvOutcome = !voters.length ? 'no-votes' : !right.length ? 'fooled-all' : !fooled.length ? 'all-right' : 'mixed'
  const rightTotal = addScores(state.rightTotal, Object.fromEntries(right.map((id) => [String(id), 1])))
  const fooledTotal = addScores(state.fooledTotal, fooled.length ? { [String(author)]: fooled.length } : {})
  const lie = state.cards[lieCard]?.text ?? ''

  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, outcome === 'fooled-all' ? FOOLED_ALL_REVEAL_SECONDS : REVEAL_SECONDS),
    acted: voters,
    reveal: { author, lieCard, votes, right, fooled, gained, outcome },
    scores: addScores(state.scores, gained),
    rightTotal,
    fooledTotal,
    history: [...state.history, { turn: state.round, author, lie, fooled: fooled.length, voters: voters.length }],
  }
}

/** Quanto a revelação dura (para as telas segurarem o suspense na mesma conta). */
export function revealSeconds(outcome: DvOutcome): number {
  return outcome === 'fooled-all' ? FOOLED_ALL_REVEAL_SECONDS : REVEAL_SECONDS
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<DvState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const turnLimit = readOption<number>(ctx.options, 'turns', DEFAULT_TURNS, TURN_CHOICES)
    const talk = readOption<number>(ctx.options, 'talkSeconds', DEFAULT_TALK, TALK_CHOICES)
    return {
      phase: 'write',
      inputKey: 'write',
      deadline: answerDeadline(ctx.now, WRITE_SECONDS),
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds: 0,
      turnLimit,
      talkMs: talk * 1000,
      seed: Math.floor(ctx.rng() * 2 ** 31),
      queue: [],
      skipped: [],
      benched: [],
      author: null,
      cards: [],
      turnStart: null,
      scores: emptyScores(roster),
      reveal: null,
      fooledTotal: {},
      rightTotal: {},
      history: [],
      private: {},
    }
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'write': {
        const writers = collectEntries(state, ctx).map((item) => item.id)
        if (timeUp(state, ctx) || everyoneOnlineDone(ctx, state.roster, writers)) return closeWriting(state, ctx)
        return withActed(state, writers)
      }
      case 'vote': {
        const votes = collectVotes(state, ctx)
        const voted = votersOf(state).filter((id) => String(id) in votes)
        const talkedEnough = ctx.now >= (state.turnStart ?? 0) + MIN_TALK_SECONDS * 1000
        if (timeUp(state, ctx) || (talkedEnough && everyoneOnlineDone(ctx, votersOf(state), voted))) {
          return closeVoting(state, ctx)
        }
        return withActed(state, voted)
      }
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        return state.round >= state.queue.length ? finish(state) : startTurn(state, ctx.now, state.round + 1)
      default:
        // Fase desconhecida (estado de outra versão): o prazo ou o "Pular" encerra.
        return timeUp(state, ctx) ? finish(state) : state
    }
  },

  bot(state, playerId, ctx) {
    if (!state.roster.includes(playerId)) return null
    if (state.phase === 'write') {
      return { facts: sample(BOT_FACTS, FACT_COUNT, ctx.rng), lie: Math.floor(ctx.rng() * FACT_COUNT) }
    }
    if (state.phase === 'vote') {
      if (playerId === state.author || !state.cards.length) return null
      return { card: state.cards[Math.floor(ctx.rng() * state.cards.length)].id }
    }
    return null
  },
}

// ---------------------------------------------------------------------------
// Fim da partida
// ---------------------------------------------------------------------------

export type DvAwards = {
  ranking: RankEntry[]
  /** Quem mais pontuou (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** "Mentiroso de ouro": quem enganou mais gente na partida. */
  liars: number[]
  maxFooled: number
  /** "Detetive do Polo Norte": quem mais acertou mentiras. */
  detectives: number[]
  maxRight: number
  /** "Mentira da noite": a que enganou mais gente (a primeira, no empate). */
  bestLie: DvHistory | null
}

function leaders(totals: Record<string, number>, roster: readonly number[]): { ids: number[]; max: number } {
  const max = Math.max(0, ...roster.map((id) => totals[String(id)] ?? 0))
  return { ids: max > 0 ? roster.filter((id) => (totals[String(id)] ?? 0) === max) : [], max }
}

/** Os prêmios do fim — calculados do estado, servem para a TV e o celular. */
export function finalAwards(state: DvState): DvAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const liars = leaders(state.fooledTotal ?? {}, state.roster)
  const detectives = leaders(state.rightTotal ?? {}, state.roster)
  let bestLie: DvHistory | null = null
  for (const entry of state.history ?? []) {
    if (entry.fooled > 0 && (!bestLie || entry.fooled > bestLie.fooled)) bestLie = entry
  }
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    liars: liars.ids,
    maxFooled: liars.max,
    detectives: detectives.ids,
    maxRight: detectives.max,
    bestLie,
  }
}
