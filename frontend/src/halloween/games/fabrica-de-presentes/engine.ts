import { deadlineIn, onlineRoster, readOption, seededRng, shuffle, timeUp } from '../../engine/helpers'
import type { BaseState, EngineCtx, HPlayer, HalloweenEngine } from '../../engine/types'
import {
  CATEGORIES,
  CHAOS,
  PART_BY_ID,
  PART_IDS,
  RECIPIENTS,
  type ChaosId,
  type TeamId,
} from './content'

/**
 * 🎁 Fábrica de Presentes — dois times de elfos montando presentes na esteira.
 *
 *   brief (10–15 s: times, peças novas, imprevisto) ──► play (2–4 min) ──► tally (9 s) ──► brief…
 *                                                                              └── última rodada ──► final (over)
 *
 * Cada time tem UM presente na bancada (o pedido da vez) e as peças estão
 * espalhadas pelos celulares do time: cada tipo de peça está na mão de UMA
 * pessoa só. Tocar numa peça põe ela no presente do time:
 * - é a próxima etapa → entra (e puxa as que estavam esperando);
 * - é de uma etapa mais adiante do MESMO pedido → espera 5 s em cima da
 *   bancada (rede lenta não pune); se a etapa anterior não chegar a tempo, cai
 *   e vira bagunça;
 * - já está no presente → ignorada (toque repetido não pune);
 * - acabou de ir para o trenó / acabou de expirar → ignorada (toque atrasado);
 * - não faz parte do pedido → BAGUNÇA: o presente vai pro lixo, −5 pontos, o
 *   pedido recomeça do zero (o relógio dele continua).
 *
 * Latência: o celular manda a FILA dos seus toques ainda não vistos, cada um
 * com um número de sequência (`{ taps: [{ n, p, at }] }`). O juiz guarda o
 * último número processado de cada um (`seen`) e só processa `n > seen` —
 * cada toque conta exatamente uma vez, mesmo que o mesmo envio seja lido em
 * vários polls ou que três toques cheguem juntos. A chave da fase muda a cada
 * toque processado (`play-<rodada>-<eventos>`), e o juiz aceita qualquer chave
 * `play-<rodada>-*`: toque mandado com a chave de um instante atrás vale.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const BRIEF_FIRST_SECONDS = 15
export const BRIEF_SECONDS = 10
export const TALLY_SECONDS = 9
/** Peça adiantada espera este tempo pela etapa anterior. */
export const HOLD_MS = 5000
/** O pedido só sai da bancada este tempo depois do relógio dele zerar (toque na rede ainda vale). */
export const LATE_MS = 1500
/** Depois que um presente sai (trenó ou expirou), toque atrasado com peça dele é ignorado. */
export const LATE_TAP_WINDOW_MS = 4000
export const MESS_PENALTY = 5
/** Pontos por etapa do presente. */
export const POINTS_PER_STEP = 10
/** Bônus de quem entrega com mais da metade do tempo sobrando. */
export const FAST_BONUS = 10
/** Tempo de cada pedido: base + por etapa (segundos), antes do multiplicador do time. */
export const ORDER_BASE_SECONDS = 8
export const ORDER_STEP_SECONDS = 6
/** Quantos toques de uma vez o juiz lê de cada celular. */
export const MAX_QUEUE = 12
export const LOG_SIZE = 8
export const ROUND_CHOICES = [2, 3, 4] as const
export const MINUTE_CHOICES = [2, 3, 4] as const
export const DEFAULT_ROUNDS = 3
export const DEFAULT_MINUTES = 3
/** Até 3 pessoas: um time só, todos contra o relógio. */
export const COOP_MAX = 3

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Phase = 'brief' | 'play' | 'tally' | 'final'

export type Order = {
  /** Posição na fila de pedidos da rodada (a mesma para os dois times). */
  n: number
  to: string
  emoji: string
  /** Peças na ordem de montagem. */
  parts: string[]
  vip: boolean
}

/** Peça adiantada esperando a etapa anterior. */
export type Held = { p: string; by: number; until: number }

/**
 * ok = entrou · wait = esperando a etapa anterior · mess = bagunça ·
 * dup = já estava no presente · late = o presente já tinha saído · drop = caiu (esperou demais)
 */
export type TapResult = 'ok' | 'wait' | 'mess' | 'dup' | 'late' | 'drop'

export type LogEntry = { by: number; p: string; r: TapResult; n: number; at: number }

export type Flash = { kind: 'done' | 'mess' | 'lost'; at: number; points: number; emoji: string; parts: string[]; by: number | null }

export type RoundLine = { done: number; mess: number; lost: number; points: number }

export type Team = {
  id: TeamId
  members: number[]
  /** Tempo extra do time menor (1 = normal). */
  timeMul: number
  score: number
  order: Order | null
  /** Quantas etapas do pedido já estão no presente. */
  placed: number
  held: Held[]
  startedAt: number
  expiresAt: number
  line: RoundLine
  /** Presentes entregues na partida inteira. */
  sleigh: number
  lastGone: { parts: string[]; at: number } | null
  flash: Flash | null
  log: LogEntry[]
}

export type Hand = { team: TeamId; parts: string[] }

/** [peças colocadas, bagunças, laços colocados, presentes fechados] */
export type PlayerStats = [number, number, number, number]

export type HistoryLine = { round: number; chaos: ChaosId | null; lines: RoundLine[] }

export type FpState = BaseState & {
  phase: Phase
  round: number
  totalRounds: number
  roundMs: number
  chaosOn: boolean
  chaos: ChaosId | null
  chaosUsed: ChaosId[]
  coop: boolean
  teams: Team[]
  /** Peças em jogo nesta rodada (todas estão na mão de alguém de cada time). */
  active: string[]
  /** Semente dos pedidos da rodada (`orderAt`). */
  seed: number
  roundEnd: number | null
  /** Troca de turno: quando as peças trocam de mão (null = não vai trocar). */
  swapAt: number | null
  /** Quantas vezes as mãos foram distribuídas (o celular avisa "peças novas"). */
  deals: number
  /** Último toque processado de cada um nesta rodada. */
  seen: Record<string, number>
  /** Toques processados nesta rodada (vai na chave). */
  events: number
  stats: Record<string, PlayerStats>
  history: HistoryLine[]
  private: Record<string, Hand>
}

/** O nome que o `index.ts` importa. */
export type State = FpState

// ---------------------------------------------------------------------------
// Regras pequenas (motor, TV e celular)
// ---------------------------------------------------------------------------

/** Divide a mesa em dois times equilibrados (ou um só, com até 3 pessoas). */
export function splitTeams(roster: readonly number[], rng: () => number): number[][] {
  if (roster.length <= COOP_MAX) return [[...roster]]
  const mixed = shuffle(roster, rng)
  const byTable = (a: number, b: number) => roster.indexOf(a) - roster.indexOf(b)
  const red = mixed.filter((_, index) => index % 2 === 0).sort(byTable)
  const green = mixed.filter((_, index) => index % 2 === 1).sort(byTable)
  return [red, green]
}

/** Tempo extra do time com menos gente online: +10% por pessoa a menos (até +30%). */
export function timeMultipliers(sizes: readonly number[]): number[] {
  if (sizes.length < 2) return sizes.map(() => 1)
  const biggest = Math.max(...sizes)
  return sizes.map((size) => Math.round(Math.min(1.3, 1 + 0.1 * (biggest - size)) * 100) / 100)
}

/** Peças da rodada: todas, ou 3 de cada tipo quando os times são de 1–2 pessoas. */
export function pickActive(rng: () => number, biggestTeam: number): string[] {
  if (biggestTeam >= 3) return [...PART_IDS]
  const chosen = new Set(CATEGORIES.flatMap((cat) => shuffle(PART_IDS.filter((id) => PART_BY_ID[id].cat === cat), rng).slice(0, 3)))
  return PART_IDS.filter((id) => chosen.has(id))
}

/**
 * O pedido número `index` da rodada — puro: a mesma semente dá a mesma fila
 * para os dois times (justo) e para a TV mostrar os próximos.
 */
export function orderAt(seed: number, index: number, active: readonly string[], chaos: ChaosId | null): Order {
  const rng = seededRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0)
  const who = RECIPIENTS[Math.floor(rng() * RECIPIENTS.length)]
  const parts: string[] = []
  for (const cat of CATEGORIES) {
    const pool = active.filter((id) => PART_BY_ID[id]?.cat === cat)
    const coin = rng()
    const roll = rng()
    if (!pool.length) continue
    if (cat === 'laco' && chaos === 'sem-laco') continue
    const liked = who.likes.find((id) => pool.includes(id))
    if (cat === 'laco' || cat === 'etiqueta') {
      if (who.skip?.includes(cat)) continue
      if (!liked && coin < 0.35) continue
    }
    parts.push(liked ?? pool[Math.floor(roll * pool.length)])
  }
  return {
    n: index,
    to: who.to,
    emoji: who.emoji,
    parts: chaos === 'invertida' ? parts.reverse() : parts,
    vip: chaos === 'vip' && index % 3 === 1,
  }
}

/** Segundos que um pedido dá ao time. */
export function orderSeconds(order: Order, timeMul: number, chaos: ChaosId | null): number {
  const base = ORDER_BASE_SECONDS + ORDER_STEP_SECONDS * order.parts.length
  return Math.round(base * timeMul * (chaos === 'pressa' ? 0.7 : 1))
}

/** Pontos de um presente entregue. */
export function giftPoints(order: Order, fast: boolean, chaos: ChaosId | null): number {
  const base = POINTS_PER_STEP * order.parts.length + (fast ? FAST_BONUS : 0)
  const vip = order.vip ? 2 : 1
  const rush = chaos === 'pressa' ? 1.5 : 1
  return Math.round(base * vip * rush)
}

export function teamOf(state: Pick<FpState, 'teams'>, id: number): Team | null {
  return state.teams?.find((team) => team.members.includes(id)) ?? null
}

export function handOf(state: Pick<FpState, 'private'>, id: number): string[] {
  return state.private?.[String(id)]?.parts ?? []
}

/** Quem tem esta peça no time (para os testes e para o bot). */
export function holderOf(state: FpState, team: Team, part: string): number | null {
  return team.members.find((id) => handOf(state, id).includes(part)) ?? null
}

/** A peça que o presente do time precisa agora (null sem pedido). */
export function nextPart(team: Team): string | null {
  return team.order?.parts[team.placed] ?? null
}

function onlineSet(players: readonly HPlayer[]): Set<number> {
  return new Set(players.filter((player) => player.online).map((player) => player.id))
}

/** Ordem do catálogo (as peças aparecem agrupadas por tipo no celular). */
function byCatalog(a: string, b: string) {
  return PART_IDS.indexOf(a) - PART_IDS.indexOf(b)
}

/**
 * Distribui as peças: cada tipo vai para UMA pessoa (online) de cada time,
 * espalhando os tipos (rodízio sobre a lista agrupada por categoria).
 */
export function dealHands(
  teams: readonly Pick<Team, 'id' | 'members'>[],
  active: readonly string[],
  rng: () => number,
  online: Set<number>,
): Record<string, Hand> {
  const hands: Record<string, Hand> = {}
  for (const team of teams) {
    for (const id of team.members) hands[String(id)] = { team: team.id, parts: [] }
    const live = team.members.filter((id) => online.has(id))
    const takers = shuffle(live.length ? live : team.members, rng)
    if (!takers.length) continue
    const deck = CATEGORIES.flatMap((cat) => shuffle(active.filter((id) => PART_BY_ID[id]?.cat === cat), rng))
    const offset = Math.floor(rng() * takers.length)
    deck.forEach((part, index) => hands[String(takers[(index + offset) % takers.length])].parts.push(part))
    for (const id of team.members) hands[String(id)].parts.sort(byCatalog)
  }
  return hands
}

/**
 * Quem saiu (offline) passa as peças para quem está online no time (para o
 * mais "leve"); quem voltou de mãos vazias recebe peças de quem tem mais.
 * Devolve null quando nada precisa mudar.
 */
export function rebalanceHands(hands: Record<string, Hand>, team: Pick<Team, 'members'>, online: Set<number>): Record<string, Hand> | null {
  const live = team.members.filter((id) => online.has(id))
  if (!live.length) return null
  const parts: Record<string, string[]> = Object.fromEntries(team.members.map((id) => [String(id), [...(hands[String(id)]?.parts ?? [])]]))
  const lightest = () => live.reduce((best, id) => (parts[String(id)].length < parts[String(best)].length ? id : best), live[0])
  const heaviest = () => live.reduce((best, id) => (parts[String(id)].length > parts[String(best)].length ? id : best), live[0])
  let changed = false
  for (const id of team.members) {
    if (online.has(id) || !parts[String(id)].length) continue
    for (const part of parts[String(id)]) parts[String(lightest())].push(part)
    parts[String(id)] = []
    changed = true
  }
  for (;;) {
    const empty = live.find((id) => parts[String(id)].length === 0)
    const rich = heaviest()
    if (empty === undefined || parts[String(rich)].length < 2) break
    parts[String(empty)].push(parts[String(rich)].pop()!)
    changed = true
  }
  if (!changed) return null
  const next = { ...hands }
  for (const id of team.members) {
    const key = String(id)
    next[key] = { team: hands[key]?.team ?? 'r', parts: [...parts[key]].sort(byCatalog) }
  }
  return next
}

// ---------------------------------------------------------------------------
// Toques
// ---------------------------------------------------------------------------

export type Tap = { id: number; n: number; p: string; at: number }

/** O prefixo das chaves que valem nesta rodada. */
export function playPrefix(round: number): string {
  return `play-${round}-`
}

/** Toques ainda não processados, de todo mundo, na ordem em que foram tocados. */
export function newTaps(state: FpState, ctx: EngineCtx): Tap[] {
  if (state.phase !== 'play') return []
  const prefix = playPrefix(state.round)
  const out: Tap[] = []
  for (const id of state.roster) {
    const input = ctx.inputs[id]
    if (!input || typeof input.k !== 'string' || !input.k.startsWith(prefix)) continue
    const list = Array.isArray(input.taps) ? (input.taps as unknown[]).slice(-MAX_QUEUE) : []
    const seen = state.seen[String(id)] ?? 0
    const mine: Tap[] = []
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const { n, p, at } = raw as { n?: unknown; p?: unknown; at?: unknown }
      if (typeof n !== 'number' || !Number.isInteger(n) || n <= seen) continue
      if (typeof p !== 'string' || !PART_BY_ID[p]) continue
      if (mine.some((tap) => tap.n === n)) continue
      const touched = typeof at === 'number' && Number.isFinite(at) ? Math.min(ctx.now, Math.round(at)) : ctx.now
      mine.push({ id, n, p, at: touched })
    }
    mine.sort((a, b) => a.n - b.n)
    // O horário de um toque nunca é antes do anterior da mesma pessoa.
    for (let i = 1; i < mine.length; i += 1) mine[i].at = Math.max(mine[i].at, mine[i - 1].at)
    out.push(...mine)
  }
  return out.sort((a, b) => a.at - b.at || a.id - b.id || a.n - b.n)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function statsOf(state: FpState, id: number): PlayerStats {
  const key = String(id)
  if (!state.stats[key]) state.stats[key] = [0, 0, 0, 0]
  return state.stats[key]
}

function pushLog(team: Team, entry: LogEntry) {
  team.log = [...team.log, entry].slice(-LOG_SIZE)
}

/** Põe o próximo pedido da fila na bancada do time (mutável: só no rascunho). */
function benchNext(state: FpState, team: Team, now: number, index: number) {
  const order = orderAt(state.seed, index, state.active, state.chaos)
  team.order = order
  team.placed = 0
  team.held = []
  team.startedAt = now
  team.expiresAt = now + orderSeconds(order, team.timeMul, state.chaos) * 1000
}

function place(state: FpState, team: Team, part: string, by: number) {
  team.placed += 1
  const stats = statsOf(state, by)
  stats[0] += 1
  if (PART_BY_ID[part]?.cat === 'laco') stats[2] += 1
}

/** Peças que estavam esperando entram quando chega a vez delas. */
function pullHeld(state: FpState, team: Team) {
  for (;;) {
    const want = nextPart(team)
    const index = team.held.findIndex((held) => held.p === want)
    if (want === null || index < 0) return
    const [held] = team.held.splice(index, 1)
    place(state, team, held.p, held.by)
  }
}

function deliverIfDone(state: FpState, team: Team, now: number, by: number) {
  const order = team.order
  if (!order || team.placed < order.parts.length) return
  const total = team.expiresAt - team.startedAt
  const fast = now - team.startedAt <= total / 2
  const points = giftPoints(order, fast, state.chaos)
  team.score += points
  team.line = { ...team.line, done: team.line.done + 1, points: team.line.points + points }
  team.sleigh += 1
  statsOf(state, by)[3] += 1
  team.lastGone = { parts: [...order.parts], at: now }
  team.flash = { kind: 'done', at: now, points, emoji: order.emoji, parts: [...order.parts], by }
  benchNext(state, team, now, order.n + 1)
}

/** Bagunça: o presente (e o que esperava) vai pro lixo; o pedido recomeça. */
function mess(state: FpState, team: Team, now: number, by: number, part: string) {
  const order = team.order
  const parts = order ? [...order.parts.slice(0, team.placed), ...team.held.map((held) => held.p), part] : [part]
  team.placed = 0
  team.held = []
  team.score -= MESS_PENALTY
  team.line = { ...team.line, mess: team.line.mess + 1, points: team.line.points - MESS_PENALTY }
  statsOf(state, by)[1] += 1
  team.flash = { kind: 'mess', at: now, points: -MESS_PENALTY, emoji: order?.emoji ?? '🎁', parts, by }
}

/** Um toque na peça `tap.p` (rascunho). */
function applyTap(state: FpState, tap: Tap, now: number) {
  const key = String(tap.id)
  state.seen[key] = Math.max(state.seen[key] ?? 0, tap.n)
  state.events += 1
  const team = teamOf(state, tap.id)
  // Peça que já não é minha (troca de turno, redistribuição): ignora.
  if (!team || !team.order || !handOf(state, tap.id).includes(tap.p)) return
  const order = team.order
  const log = (r: TapResult) => pushLog(team, { by: tap.id, p: tap.p, r, n: tap.n, at: now })
  const index = order.parts.indexOf(tap.p)
  if (index >= 0 && (index < team.placed || team.held.some((held) => held.p === tap.p))) return log('dup')
  if (index >= 0 && index === team.placed) {
    place(state, team, tap.p, tap.id)
    pullHeld(state, team)
    log('ok')
    deliverIfDone(state, team, now, tap.id)
    return
  }
  if (index > team.placed) {
    team.held.push({ p: tap.p, by: tap.id, until: now + HOLD_MS })
    return log('wait')
  }
  const gone = team.lastGone
  if (gone && now - gone.at < LATE_TAP_WINDOW_MS && gone.parts.includes(tap.p)) return log('late')
  mess(state, team, now, tap.id, tap.p)
  log('mess')
}

/** Há algo de relógio vencido no time (peça esperando demais, pedido expirado)? */
function teamClockDue(team: Team, now: number): boolean {
  if (!team.order) return false
  return team.held.some((held) => now >= held.until) || now >= team.expiresAt + LATE_MS
}

function runTeamClock(state: FpState, team: Team, now: number) {
  const dropped = team.held.find((held) => now >= held.until)
  if (dropped) {
    // A etapa anterior não chegou: a peça caiu e virou bagunça.
    pushLog(team, { by: dropped.by, p: dropped.p, r: 'drop', n: 0, at: now })
    mess(state, team, now, dropped.by, dropped.p)
  }
  const order = team.order
  if (order && now >= team.expiresAt + LATE_MS) {
    team.line = { ...team.line, lost: team.line.lost + 1 }
    team.lastGone = { parts: [...order.parts], at: now }
    team.flash = { kind: 'lost', at: now, points: 0, emoji: order.emoji, parts: [], by: null }
    benchNext(state, team, now, order.n + 1)
  }
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

const EMPTY_LINE: RoundLine = { done: 0, mess: 0, lost: 0, points: 0 }

function chaosFor(state: FpState, round: number, rng: () => number): ChaosId | null {
  if (!state.chaosOn || round < 2) return null
  const left = CHAOS.map((chaos) => chaos.id).filter((id) => !state.chaosUsed.includes(id))
  if (!left.length) return null
  return left[Math.floor(rng() * left.length)]
}

/** Abre a rodada: imprevisto, peças da rodada e mãos novas. */
function startBrief(state: FpState, ctx: EngineCtx, round: number): FpState {
  const online = onlineSet(ctx.players)
  const chaos = chaosFor(state, round, ctx.rng)
  const sizes = state.teams.map((team) => team.members.filter((id) => online.has(id)).length || team.members.length)
  const muls = timeMultipliers(sizes)
  const active = pickActive(ctx.rng, Math.max(...sizes))
  const seed = Math.floor(ctx.rng() * 2 ** 31)
  const teams: Team[] = state.teams.map((team, index) => ({
    ...team,
    timeMul: muls[index] ?? 1,
    order: null,
    placed: 0,
    held: [],
    startedAt: ctx.now,
    expiresAt: ctx.now,
    line: { ...EMPTY_LINE },
    lastGone: null,
    flash: null,
    log: [],
  }))
  return {
    ...state,
    phase: 'brief',
    round,
    inputKey: `brief-${round}`,
    deadline: deadlineIn(ctx.now, round <= 1 ? BRIEF_FIRST_SECONDS : BRIEF_SECONDS),
    chaos,
    chaosUsed: chaos ? [...state.chaosUsed, chaos] : state.chaosUsed,
    teams,
    active,
    seed,
    roundEnd: null,
    swapAt: null,
    deals: state.deals + 1,
    seen: {},
    events: 0,
    private: dealHands(teams, active, ctx.rng, online),
  }
}

function startPlay(state: FpState, ctx: EngineCtx): FpState {
  const draft = clone(state)
  draft.phase = 'play'
  draft.roundEnd = ctx.now + state.roundMs
  draft.deadline = draft.roundEnd
  draft.swapAt = state.chaos === 'troca' ? ctx.now + Math.round(state.roundMs / 2) : null
  draft.events = 0
  draft.seen = {}
  draft.inputKey = `${playPrefix(state.round)}0`
  for (const team of draft.teams) benchNext(draft, team, ctx.now, 0)
  return draft
}

function endRound(state: FpState, ctx: EngineCtx): FpState {
  return {
    ...state,
    phase: 'tally',
    inputKey: `tally-${state.round}`,
    deadline: deadlineIn(ctx.now, TALLY_SECONDS),
    roundEnd: null,
    swapAt: null,
    teams: state.teams.map((team) => ({ ...team, held: [] })),
    history: [...state.history, { round: state.round, chaos: state.chaos, lines: state.teams.map((team) => ({ ...team.line })) }],
  }
}

function afterTally(state: FpState, ctx: EngineCtx): FpState {
  if (state.round >= state.totalRounds) {
    return { ...state, phase: 'final', over: true, deadline: null, inputKey: 'final' }
  }
  return startBrief(state, ctx, state.round + 1)
}

/** Mãos que precisam mudar agora (gente saiu ou voltou), ou null. */
function rebalanced(state: FpState, online: Set<number>): Record<string, Hand> | null {
  let hands: Record<string, Hand> | null = null
  for (const team of state.teams) {
    const next = rebalanceHands(hands ?? state.private, team, online)
    if (next) hands = next
  }
  return hands
}

function stepPlay(state: FpState, ctx: EngineCtx): FpState {
  if (timeUp(state, ctx) || (state.roundEnd !== null && ctx.now >= state.roundEnd)) return endRound(state, ctx)
  const online = onlineSet(ctx.players)
  const taps = newTaps(state, ctx)
  const hands = rebalanced(state, online)
  const swap = state.swapAt !== null && ctx.now >= state.swapAt
  const clocks = state.teams.some((team) => teamClockDue(team, ctx.now))
  if (!taps.length && !hands && !swap && !clocks) return state

  const draft = clone(state)
  if (hands) draft.private = clone(hands)
  if (swap) {
    // Troca de turno: as peças trocam de mão (só uma vez por rodada).
    draft.swapAt = null
    draft.deals += 1
    draft.private = dealHands(draft.teams, draft.active, ctx.rng, online)
  }
  for (const tap of taps) applyTap(draft, tap, ctx.now)
  for (const team of draft.teams) runTeamClock(draft, team, ctx.now)
  draft.inputKey = `${playPrefix(draft.round)}${draft.events}`
  return draft
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

/** Chance de o bot errar de peça (só para a simulação passar pela bagunça). */
const BOT_MISTAKE = 0.04
/** Chance de o bot adiantar uma peça que ainda não é a vez. */
const BOT_EAGER = 0.25

export const engine: HalloweenEngine<FpState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const minutes = readOption<number>(ctx.options, 'minutes', DEFAULT_MINUTES, MINUTE_CHOICES)
    const chaosOn = readOption<boolean>(ctx.options, 'chaos', true)
    const groups = splitTeams(roster, ctx.rng)
    const ids: TeamId[] = ['r', 'g']
    const teams: Team[] = groups.map((members, index) => ({
      id: ids[index],
      members,
      timeMul: 1,
      score: 0,
      order: null,
      placed: 0,
      held: [],
      startedAt: ctx.now,
      expiresAt: ctx.now,
      line: { ...EMPTY_LINE },
      sleigh: 0,
      lastGone: null,
      flash: null,
      log: [],
    }))
    const blank: FpState = {
      phase: 'brief',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      round: 0,
      totalRounds,
      roundMs: minutes * 60_000,
      chaosOn,
      chaos: null,
      chaosUsed: [],
      coop: groups.length === 1,
      teams,
      active: [],
      seed: 0,
      roundEnd: null,
      swapAt: null,
      deals: 0,
      seen: {},
      events: 0,
      stats: Object.fromEntries(roster.map((id) => [String(id), [0, 0, 0, 0] as PlayerStats])),
      history: [],
      private: {},
    }
    return startBrief(blank, ctx, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'brief':
        return timeUp(state, ctx) ? startPlay(state, ctx) : state
      case 'play':
        return stepPlay(state, ctx)
      case 'tally':
        return timeUp(state, ctx) ? afterTally(state, ctx) : state
      default:
        // Estado de outro jogo (partida velha): encerra em vez de travar.
        return { ...state, over: true, deadline: null }
    }
  },

  bot(state, playerId, ctx) {
    if (state.phase !== 'play') return null
    const team = teamOf(state, playerId)
    const hand = handOf(state, playerId)
    if (!team || !team.order || !hand.length) return null
    const n = (state.seen[String(playerId)] ?? 0) + 1
    const tap = (p: string) => ({ taps: [{ n, p, at: ctx.now }] })
    if (ctx.rng() < BOT_MISTAKE) return tap(hand[Math.floor(ctx.rng() * hand.length)])
    const want = nextPart(team)
    if (want && hand.includes(want)) return tap(want)
    const later = team.order.parts.slice(team.placed + 1).find((part) => hand.includes(part) && !team.held.some((held) => held.p === part))
    if (later && ctx.rng() < BOT_EAGER) return tap(later)
    return null
  },
}

// ---------------------------------------------------------------------------
// Placar e prêmios (calculados do estado: servem para a TV e o celular)
// ---------------------------------------------------------------------------

/** Time vencedor (null = empate ou modo cooperativo). */
export function winningTeam(state: Pick<FpState, 'teams' | 'coop'>): TeamId | null {
  if (state.coop || !state.teams || state.teams.length < 2) return null
  const [a, b] = state.teams
  if (a.score === b.score) return null
  return a.score > b.score ? a.id : b.id
}

/** Estrelas do modo cooperativo: presentes por minuto jogado. */
export function coopStars(state: Pick<FpState, 'teams' | 'roundMs' | 'history'>): number {
  const minutes = ((state.roundMs || 60_000) / 60_000) * Math.max(1, state.history?.length ?? 0)
  const gifts = state.teams?.[0]?.sleigh ?? 0
  const rate = gifts / minutes
  if (rate >= 3) return 3
  if (rate >= 2) return 2
  if (rate >= 1) return 1
  return 0
}

export type Award = { key: 'relampago' | 'bagunca' | 'laco' | 'fecha'; icon: string; title: string; ids: number[]; count: number; unit: string }

function topBy(state: FpState, index: number): { ids: number[]; count: number } {
  const count = Math.max(0, ...state.roster.map((id) => state.stats?.[String(id)]?.[index] ?? 0))
  if (count <= 0) return { ids: [], count: 0 }
  return { ids: state.roster.filter((id) => (state.stats?.[String(id)]?.[index] ?? 0) === count), count }
}

/** Os prêmios do fim (só os que alguém ganhou). */
export function awards(state: FpState): Award[] {
  const list: Award[] = [
    { key: 'relampago', icon: '⚡', title: 'Embrulhador relâmpago', ...topBy(state, 0), unit: 'peças' },
    { key: 'laco', icon: '🎀', title: 'Laço de ouro', ...topBy(state, 2), unit: 'laços' },
    { key: 'fecha', icon: '📦', title: 'Fecha-pacote', ...topBy(state, 3), unit: 'presentes fechados' },
    { key: 'bagunca', icon: '🌀', title: 'Mestre da bagunça', ...topBy(state, 1), unit: 'bagunças' },
  ]
  return list.filter((award) => award.ids.length > 0)
}
