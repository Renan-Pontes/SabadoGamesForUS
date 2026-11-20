import {
  allOnlineActed,
  deadlineIn,
  emptyScores,
  inputFor,
  readOption,
  refreshActed,
  shuffle,
  timeUp,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import {
  DISHES,
  EVENTS,
  EXTRA_ORDER,
  HEAT_STATIONS,
  PAVE_INDEX,
  PREP_TAPS,
  SOLO_LOOK,
  STATIONS,
  STATION_ORDER,
  TEAM_LOOKS,
  type CozinhaEvent,
  type Station,
} from './content'

/**
 * 🎄 Cozinha da Ceia — dois times de duendes, duas cozinhas na TV, a ceia
 * inteira para sair no tempo.
 *
 *   prep (pré-rodada: times, estações, imprevisto) ──► cook (2–4 min) ──► tally ──► prep da próxima
 *                                                                          └── melhor de N decidido ──► final (over)
 *
 * Cada time tem a sua cozinha: pedidos chegando (com paciência contada), e
 * cinco estações — Tábua, Tigela, Fogão, Forno e Balcão. Cada pessoa cuida de
 * uma ou mais estações pelo celular; a TV mostra a cozinha inteira, e o time
 * precisa CONVERSAR ("tira a farofa!", "cadê o frango?").
 *
 * Latência (a TV é o juiz, e o toque leva ~0,5–2,5 s para chegar):
 * - nada se move em tempo real: só toques discretos com janelas largas
 *   (fogo de 9–15 s, 10 s até queimar);
 * - os toques vão numa FILA numerada no celular: a resposta é
 *   `{ acts: [{ n, a, i, at }, ...] }` com os toques ainda não vistos pelo
 *   juiz. O motor guarda `seen[id]` (o maior `n` já processado) e processa
 *   cada toque exatamente uma vez, mesmo que o mesmo pacote chegue várias
 *   vezes ou que três toques cheguem juntos;
 * - a chave muda a cada toque processado (`ck-<rodada>-<rev>`), mas o motor
 *   aceita qualquer resposta da rodada (`ck-<rodada>-*`): o celular com a
 *   chave velha não perde nada;
 * - "tirar do fogo" vale pelo horário do toque (`at`): tirou antes de
 *   queimar, salvou — mesmo chegando atrasado. A queima só fica oficial
 *   2,5 s (`LATE_MS`) depois, e tocar "tirar" nos 3 s finais do cozimento já
 *   deixa o prato saindo sozinho quando ficar pronto.
 *
 * Pontos: prato entregue = pontos do prato + gorjeta (até 50% pela pressa);
 * pedido que esgota = −10. Vence a rodada o time com mais pontos; vence a
 * partida quem ganhar mais rodadas (melhor de N). Com 2–3 pessoas, um time
 * só contra o relógio (estrelas).
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const PREP_SECONDS_FIRST = 20
export const PREP_SECONDS = 13
export const TALLY_SECONDS = 12
/** Tempo no fogo até ficar pronto. */
export const COOK_MS: Record<'fogao' | 'forno', number> = { fogao: 9000, forno: 15000 }
/** Depois de pronto, quanto tempo até queimar. */
export const BURN_MS = 10_000
/** No "forno turbinado": tudo cozinha em 60% do tempo e queima em 6 s. */
export const TURBO_COOK = 0.6
export const TURBO_BURN_MS = 6000
/** Folga para um toque que ainda esteja na rede (queima e pedido esgotado). */
export const LATE_MS = 2500
/** "Tirar" vale a partir de 3 s antes de ficar pronto (sai sozinho na hora). */
export const EARLY_TAKE_MS = 3000
/** Toque com `at` mais velho que isto é tratado como deste instante menos isto. */
export const MAX_AT_SKEW_MS = 6000
export const MISS_PENALTY = 10
/** Gorjeta máxima, em fração dos pontos do prato. */
export const TIP_RATE = 0.5
export const SPAWN_GAP_MS = 10_000
export const LOTADA_GAP_MS = 6000
/** Depois de uma entrega, o próximo pedido espera um pouquinho. */
export const AFTER_ORDER_GAP_MS = 2500
/** A cada 45 s de rodada cabe mais um pedido aberto. */
export const RAMP_MS = 45_000
/** Paciência: base + custo de cada passo (preparo, fogo e montagem). */
export const PATIENCE_BASE_MS = 40_000
export const PATIENCE_PREP_MS = 7000
export const PATIENCE_HEAT_EXTRA_MS = 8000
export const PATIENCE_SERVE_MS = 8000
export const VIP_PATIENCE = 0.8
/** Toques por jogador processados num passo do juiz (o resto fica para o próximo). */
export const MAX_ACTS_PER_STEP = 24
/** Até 3 pessoas: um time só, contra o relógio. */
export const SOLO_MAX_PLAYERS = 3

export const MINUTE_CHOICES = [2, 3, 4] as const
export const ROUND_CHOICES = [1, 3, 5] as const

export type CookPhase = 'prep' | 'cook' | 'tally' | 'final'
export type ItemPhase = 'prep' | 'queue' | 'cook' | 'burnt' | 'done'
export type ActKind = 'tap' | 'cook' | 'take' | 'trash' | 'serve'

/** Um componente de um pedido andando pelas estações. */
export type Item = {
  id: number
  /** Pedido dono. */
  o: number
  /** Prato (índice em DISHES). */
  d: number
  /** Componente do prato. */
  c: number
  /** Passo atual do componente. */
  s: number
  /** Estação onde ele está agora. */
  st: Station
  ph: ItemPhase
  /** Toques de preparo neste passo. */
  taps: number
  /** No fogo: quando entrou e quando fica pronto. */
  t0: number
  end: number
  /** Quem pôs no fogo (para o prêmio de quem queimou). */
  by: number | null
  /** Tiraram um pouco antes: sai sozinho quando ficar pronto. */
  pick: boolean
}

export type Order = {
  id: number
  d: number
  born: number
  /** Paciência acaba aqui (a TV mostra até aqui; o juiz espera mais LATE_MS). */
  exp: number
  pts: number
  vip: boolean
  /** Toques de montagem no balcão. */
  taps: number
}

export type KitchenPop = { n: number; kind: 'serve' | 'miss' | 'burn'; d: number; pts: number; tip: number; at: number }

export type Kitchen = {
  orders: Order[]
  items: Item[]
  score: number
  delivered: number
  missed: number
  burnt: number
  tips: number
  /** Pedidos já tirados do baralho da rodada. */
  spawned: number
  nextAt: number
  /** O último acontecimento (a TV anima quando o `n` muda). */
  pop: KitchenPop | null
}

export type Team = {
  name: string
  short: string
  emoji: string
  color: string
  light: string
  players: number[]
  wins: number
  total: number
  /** Multiplicador da paciência dos pedidos (time menor ganha um pouco mais). */
  slack: number
}

export type PlayerStats = {
  /** Toques de preparo (tábua e tigela). */
  prep: number
  /** Pôs no fogo / tirou do fogo. */
  heat: number
  /** Pratos montados e entregues. */
  serve: number
  burnt: number
  /** Passos concluídos por prato (id do prato → quantos). */
  dish: Record<string, number>
}

export type RoundResult = {
  round: number
  scores: number[]
  delivered: number[]
  missed: number[]
  burnt: number[]
  /** Time que venceu a rodada (null: empate ou time único). */
  winner: number | null
  /** Time único: estrelas da rodada (0–3). */
  stars: number
  event: CozinhaEvent | null
}

export type CozinhaState = BaseState & {
  phase: CookPhase
  round: number
  totalRounds: number
  roundMs: number
  chaos: boolean
  /** Um time só (2–3 pessoas), contra o relógio. */
  solo: boolean
  acted: number[]
  teams: Team[]
  /** id → índice do time. */
  teamOf: Record<string, number>
  /** id → estações desta rodada. */
  seat: Record<string, Station[]>
  kitchens: Kitchen[]
  /** Pratos da rodada, na ordem (o mesmo baralho para os dois times). */
  deck: number[]
  event: CozinhaEvent | null
  usedEvents: CozinhaEvent[]
  cookMs: { fogao: number; forno: number }
  burnMs: number
  /** Bocas do fogão / lugares do forno de cada time nesta rodada. */
  capacity: { fogao: number; forno: number }[]
  /** id → maior número de toque já processado (a fila do celular). */
  seen: Record<string, number>
  /** Quantas vezes a rodada processou toques (vai na chave). */
  rev: number
  cookStart: number
  nextId: number
  stats: Record<string, PlayerStats>
  /** Entregas por prato na partida inteira (id do prato → quantas). */
  served: Record<string, number>
  history: RoundResult[]
}

/** O nome que o `index.ts` (pronto) importa. */
export type State = CozinhaState

export type Act = { n: number; a: ActKind; i: number; at: number }

const ACT_KINDS: readonly ActKind[] = ['tap', 'cook', 'take', 'trash', 'serve']

// ---------------------------------------------------------------------------
// Regras pequenas (motor, TV e celular)
// ---------------------------------------------------------------------------

export function isHeat(st: Station): st is 'fogao' | 'forno' {
  return (HEAT_STATIONS as readonly string[]).includes(st)
}

export function stepOf(item: Pick<Item, 'd' | 'c' | 's'>) {
  return DISHES[item.d]?.comps[item.c]?.[item.s] ?? null
}

/** Toques que faltam para terminar o preparo deste item. */
export function tapsNeeded(st: Station): number {
  return PREP_TAPS[st] || 1
}

export function teamOf(state: Pick<CozinhaState, 'teamOf'>, id: number): number | null {
  const team = state.teamOf?.[String(id)]
  return typeof team === 'number' ? team : null
}

export function seatOf(state: Pick<CozinhaState, 'seat'>, id: number): Station[] {
  return state.seat?.[String(id)] ?? []
}

/** O pedido já tem todos os componentes prontos (espera no balcão)? */
export function orderReady(kitchen: Pick<Kitchen, 'items'>, orderId: number): boolean {
  const mine = kitchen.items.filter((item) => item.o === orderId)
  return mine.length > 0 && mine.every((item) => item.ph === 'done')
}

/** Lugares ocupados (cozinhando ou queimado) numa estação de fogo. */
export function heatUsed(kitchen: Pick<Kitchen, 'items'>, st: Station): number {
  return kitchen.items.filter((item) => item.st === st && (item.ph === 'cook' || item.ph === 'burnt')).length
}

/** Divide a mesa: até 3 pessoas, um time só; senão dois times alternados (sorteados). */
export function splitTeams(roster: readonly number[], rng: () => number): number[][] {
  if (roster.length <= SOLO_MAX_PLAYERS) return [[...roster]]
  const mixed = shuffle(roster, rng)
  const teams: number[][] = [[], []]
  mixed.forEach((id, index) => teams[index % 2].push(id))
  // Na ordem da mesa, para a TV ficar estável.
  return teams.map((team) => roster.filter((id) => team.includes(id)))
}

/**
 * Estações de cada pessoa do time nesta rodada. Gira a cada rodada (todo
 * mundo experimenta o fogão). Com menos de 5 pessoas, alguém cuida de duas
 * ou mais; com mais de 5, quem sobra reforça tábua, fogão, forno...
 */
export function seatTeam(players: readonly number[], round: number): Record<string, Station[]> {
  const seat: Record<string, Station[]> = {}
  const n = players.length
  if (!n) return seat
  const shift = (((round - 1) % n) + n) % n
  const order = players.map((_, index) => players[(index + shift) % n])
  for (const id of order) seat[String(id)] = []
  STATION_ORDER.forEach((st, index) => seat[String(order[index % n])].push(st))
  for (let index = STATION_ORDER.length; index < n; index += 1) {
    seat[String(order[index])].push(EXTRA_ORDER[(index - STATION_ORDER.length) % EXTRA_ORDER.length])
  }
  // Na ordem fixa das estações (o celular mostra as abas sempre iguais).
  for (const id of order) seat[String(id)].sort((a, b) => STATIONS.indexOf(a) - STATIONS.indexOf(b))
  return seat
}

/** Quantas pessoas do time estão numa estação. */
export function seatedAt(seat: Record<string, Station[]>, players: readonly number[], st: Station): number {
  return players.filter((id) => (seat[String(id)] ?? []).includes(st)).length
}

/** Paciência de um prato (ms), antes do multiplicador do time. */
export function patienceOf(dishIndex: number, cookMs: CozinhaState['cookMs']): number {
  const dish = DISHES[dishIndex]
  if (!dish) return PATIENCE_BASE_MS
  let total = PATIENCE_BASE_MS + PATIENCE_SERVE_MS
  for (const comp of dish.comps) {
    for (const step of comp) {
      total += isHeat(step.st) ? cookMs[step.st] + PATIENCE_HEAT_EXTRA_MS : PATIENCE_PREP_MS
    }
  }
  return total
}

/** Quantos pedidos abertos cabem agora (cresce com a rodada). */
export function maxOpenOrders(state: Pick<CozinhaState, 'teams' | 'event'>, elapsedMs: number): number {
  const smallest = Math.min(...state.teams.map((team) => team.players.length))
  const cap = smallest <= 2 ? 3 : smallest <= 4 ? 4 : 5
  const lotada = state.event === 'lotada' ? 1 : 0
  return Math.min(cap, 2 + Math.floor(Math.max(0, elapsedMs) / RAMP_MS)) + lotada
}

/** Gorjeta de uma entrega em `at`: até 50% dos pontos, pela paciência que sobrou. */
export function tipFor(order: Pick<Order, 'born' | 'exp' | 'pts'>, at: number, double: boolean): number {
  const span = Math.max(1, order.exp - order.born)
  const left = Math.max(0, Math.min(1, (order.exp - at) / span))
  return Math.round(order.pts * TIP_RATE * left) * (double ? 2 : 1)
}

/** Estrelas do time único numa rodada (por minuto de rodada). */
export function starsFor(score: number, roundMs: number): number {
  const minutes = roundMs / 60_000
  if (score >= 70 * minutes) return 3
  if (score >= 45 * minutes) return 2
  if (score >= 20 * minutes) return 1
  return 0
}

/** Melhor de N: algum time já tem a maioria das rodadas? */
export function matchDecided(state: Pick<CozinhaState, 'round' | 'totalRounds' | 'teams' | 'solo'>): boolean {
  if (state.round >= state.totalRounds) return true
  if (state.solo) return false
  const need = Math.floor(state.totalRounds / 2) + 1
  return state.teams.some((team) => team.wins >= need)
}

/** O time campeão (null: empate ou time único). */
export function championTeam(state: Pick<CozinhaState, 'teams' | 'solo'>): number | null {
  const teams = state.teams ?? []
  if (state.solo || teams.length < 2) return null
  const [a, b] = teams
  if (a.wins !== b.wins) return a.wins > b.wins ? 0 : 1
  if (a.total !== b.total) return a.total > b.total ? 0 : 1
  return null
}

// ---------------------------------------------------------------------------
// Começo de rodada
// ---------------------------------------------------------------------------

function emptyStats(): PlayerStats {
  return { prep: 0, heat: 0, serve: 0, burnt: 0, dish: {} }
}

function emptyKitchen(): Kitchen {
  return { orders: [], items: [], score: 0, delivered: 0, missed: 0, burnt: 0, tips: 0, spawned: 0, nextAt: 0, pop: null }
}

/** 36 pratos para a rodada: o cardápio inteiro embaralhado, várias vezes. */
function buildDeck(rng: () => number, event: CozinhaEvent | null): number[] {
  const ids = DISHES.map((_, index) => index)
  const deck: number[] = []
  while (deck.length < 36) deck.push(...shuffle(ids, rng))
  if (event === 'vo' && PAVE_INDEX >= 0) deck[0] = PAVE_INDEX
  return deck.slice(0, 36)
}

function pickEvent(state: CozinhaState, round: number, rng: () => number): CozinhaEvent | null {
  if (!state.chaos || round < 2) return null
  const left = EVENTS.filter((event) => !state.usedEvents.includes(event))
  const pool = left.length ? left : [...EVENTS]
  return pool[Math.floor(rng() * pool.length)] ?? null
}

function startPrep(state: CozinhaState, ctx: EngineCtx, round: number): CozinhaState {
  const event = pickEvent(state, round, ctx.rng)
  const online = new Set(ctx.players.filter((player) => player.online).map((player) => player.id))
  const seat: Record<string, Station[]> = {}
  for (const team of state.teams) {
    // Estação para quem está aqui; quem sumiu entra de reforço quando voltar.
    const here = team.players.filter((id) => online.has(id))
    Object.assign(seat, seatTeam(here.length ? here : team.players, round))
  }
  const turbo = event === 'turbo'
  const cookMs = {
    fogao: Math.round(COOK_MS.fogao * (turbo ? TURBO_COOK : 1)),
    forno: Math.round(COOK_MS.forno * (turbo ? TURBO_COOK : 1)),
  }
  const capacity = state.teams.map((team) => ({
    fogao: event === 'gas' ? 1 : 2 + Math.max(0, seatedAt(seat, team.players, 'fogao') - 1),
    forno: 2 + Math.max(0, seatedAt(seat, team.players, 'forno') - 1),
  }))
  return {
    ...state,
    phase: 'prep',
    round,
    inputKey: `prep-${round}`,
    deadline: deadlineIn(ctx.now, round <= 1 ? PREP_SECONDS_FIRST : PREP_SECONDS),
    acted: [],
    seat,
    event,
    usedEvents: event ? [...state.usedEvents, event] : state.usedEvents,
    cookMs,
    burnMs: turbo ? TURBO_BURN_MS : BURN_MS,
    capacity,
    kitchens: state.teams.map(() => emptyKitchen()),
    deck: buildDeck(ctx.rng, event),
    rev: 0,
  }
}

function startCook(state: CozinhaState, ctx: EngineCtx): CozinhaState {
  const now = ctx.now
  let next: CozinhaState = {
    ...state,
    phase: 'cook',
    cookStart: now,
    deadline: now + state.roundMs,
    inputKey: `ck-${state.round}-0`,
    rev: 0,
    acted: [],
    kitchens: state.teams.map(() => ({ ...emptyKitchen(), nextAt: now + 5000 })),
  }
  // Um pedido já na largada, para ninguém ficar parado.
  next = JSON.parse(JSON.stringify(next)) as CozinhaState
  next.kitchens.forEach((kitchen, team) => spawnOrder(next, team, kitchen, now))
  return next
}

// ---------------------------------------------------------------------------
// A cozinha (tudo num rascunho mutável: `draft`)
// ---------------------------------------------------------------------------

function spawnOrder(draft: CozinhaState, team: number, kitchen: Kitchen, now: number) {
  const d = draft.deck[kitchen.spawned % Math.max(1, draft.deck.length)] ?? 0
  const vip = draft.event === 'vo' && kitchen.spawned === 0 && d === PAVE_INDEX
  const dish = DISHES[d]
  const slack = draft.teams[team]?.slack ?? 1
  const patience = Math.round(patienceOf(d, draft.cookMs) * slack * (vip ? VIP_PATIENCE : 1))
  const id = draft.nextId++
  kitchen.orders.push({ id, d, born: now, exp: now + patience, pts: dish.points * (vip ? 2 : 1), vip, taps: 0 })
  dish.comps.forEach((comp, c) => {
    const first = comp[0]
    kitchen.items.push({
      id: draft.nextId++,
      o: id,
      d,
      c,
      s: 0,
      st: first.st,
      ph: isHeat(first.st) ? 'queue' : 'prep',
      taps: 0,
      t0: 0,
      end: 0,
      by: null,
      pick: false,
    })
  })
  kitchen.spawned += 1
}

function statsFor(draft: CozinhaState, id: number): PlayerStats {
  const key = String(id)
  if (!draft.stats[key]) draft.stats[key] = emptyStats()
  return draft.stats[key]
}

function credit(draft: CozinhaState, id: number | null, d: number) {
  if (id === null) return
  const dishId = DISHES[d]?.id
  if (!dishId) return
  const stats = statsFor(draft, id)
  stats.dish[dishId] = (stats.dish[dishId] ?? 0) + 1
}

function pop(kitchen: Kitchen, kind: KitchenPop['kind'], d: number, pts: number, tip: number, at: number) {
  kitchen.pop = { n: (kitchen.pop?.n ?? 0) + 1, kind, d, pts, tip, at }
}

/** O item terminou o passo: vai para a próxima estação (ou fica pronto no balcão). */
function advance(item: Item) {
  const dish = DISHES[item.d]
  const comp = dish?.comps[item.c] ?? []
  item.s += 1
  item.taps = 0
  item.t0 = 0
  item.end = 0
  item.by = null
  item.pick = false
  const step = comp[item.s]
  if (!step) {
    item.ph = 'done'
    item.st = 'balcao'
    return
  }
  item.st = step.st
  item.ph = isHeat(step.st) ? 'queue' : 'prep'
}

function burn(draft: CozinhaState, kitchen: Kitchen, item: Item, now: number) {
  item.ph = 'burnt'
  item.pick = false
  kitchen.burnt += 1
  if (item.by !== null) statsFor(draft, item.by).burnt += 1
  pop(kitchen, 'burn', item.d, 0, 0, now)
}

function removeOrder(kitchen: Kitchen, orderId: number) {
  kitchen.orders = kitchen.orders.filter((order) => order.id !== orderId)
  kitchen.items = kitchen.items.filter((item) => item.o !== orderId)
}

/** Lê a fila de toques de cada pessoa: só os números ainda não vistos. */
export function pendingActs(state: CozinhaState, ctx: EngineCtx, id: number): Act[] {
  const input = ctx.inputs[id]
  if (!input || typeof input.k !== 'string' || !input.k.startsWith(`ck-${state.round}-`)) return []
  if (!Array.isArray(input.acts)) return []
  const seen = state.seen[String(id)] ?? 0
  const acts: Act[] = []
  for (const raw of input.acts as unknown[]) {
    if (!raw || typeof raw !== 'object') continue
    const act = raw as Record<string, unknown>
    const n = act.n
    const a = act.a
    const i = act.i
    if (typeof n !== 'number' || !Number.isInteger(n) || n <= seen) continue
    if (typeof a !== 'string' || !(ACT_KINDS as readonly string[]).includes(a)) continue
    if (typeof i !== 'number' || !Number.isFinite(i)) continue
    const at = typeof act.at === 'number' && Number.isFinite(act.at) ? act.at : ctx.now
    acts.push({ n, a: a as ActKind, i, at })
  }
  acts.sort((x, y) => x.n - y.n)
  // Números repetidos (pacote estranho): vale o primeiro.
  return acts.filter((act, index) => index === 0 || act.n !== acts[index - 1].n).slice(0, MAX_ACTS_PER_STEP)
}

function applyAct(draft: CozinhaState, team: number, id: number, act: Act, now: number) {
  const kitchen = draft.kitchens[team]
  if (!kitchen) return
  const at = Math.min(now, Math.max(now - MAX_AT_SKEW_MS, act.at))
  if (act.a === 'serve') {
    const order = kitchen.orders.find((entry) => entry.id === act.i)
    if (!order || !orderReady(kitchen, order.id)) return
    order.taps += 1
    if (order.taps < tapsNeeded('balcao')) return
    const tip = tipFor(order, at, draft.event === 'gorjeta')
    kitchen.score += order.pts + tip
    kitchen.tips += tip
    kitchen.delivered += 1
    kitchen.nextAt = Math.max(kitchen.nextAt, now + AFTER_ORDER_GAP_MS)
    const stats = statsFor(draft, id)
    stats.serve += 1
    credit(draft, id, order.d)
    const dishId = DISHES[order.d]?.id
    if (dishId) draft.served[dishId] = (draft.served[dishId] ?? 0) + 1
    pop(kitchen, 'serve', order.d, order.pts + tip, tip, now)
    removeOrder(kitchen, order.id)
    return
  }
  const item = kitchen.items.find((entry) => entry.id === act.i)
  if (!item) return
  if (act.a === 'tap') {
    if (item.ph !== 'prep') return
    item.taps += 1
    statsFor(draft, id).prep += 1
    if (item.taps >= tapsNeeded(item.st)) {
      credit(draft, id, item.d)
      advance(item)
    }
    return
  }
  if (act.a === 'cook') {
    if (item.ph !== 'queue' || !isHeat(item.st)) return
    const cap = draft.capacity[team]?.[item.st] ?? 2
    if (heatUsed(kitchen, item.st) >= cap) return
    item.ph = 'cook'
    item.t0 = now
    item.end = now + draft.cookMs[item.st]
    item.by = id
    item.pick = false
    statsFor(draft, id).heat += 1
    return
  }
  if (act.a === 'take') {
    if (item.ph !== 'cook') return
    const touched = Math.max(item.t0, at)
    if (touched >= item.end + draft.burnMs) {
      // Tocou depois de queimar: queimou mesmo.
      burn(draft, kitchen, item, now)
      return
    }
    if (touched >= item.end || now >= item.end) {
      statsFor(draft, id).heat += 1
      credit(draft, id, item.d)
      advance(item)
      return
    }
    if (touched >= item.end - EARLY_TAKE_MS && !item.pick) {
      // Quase pronto: sai sozinho na hora certa.
      item.pick = true
      item.by = id
      statsFor(draft, id).heat += 1
      credit(draft, id, item.d)
    }
    return
  }
  if (act.a === 'trash') {
    if (item.ph !== 'burnt') return
    // Joga fora e o componente recomeça do primeiro passo.
    const first = DISHES[item.d]?.comps[item.c]?.[0]
    if (!first) return
    item.s = 0
    item.st = first.st
    item.ph = isHeat(first.st) ? 'queue' : 'prep'
    item.taps = 0
    item.t0 = 0
    item.end = 0
    item.by = null
    item.pick = false
  }
}

/** Processa os toques novos de todo mundo. Devolve se algum toque foi consumido. */
function processActs(draft: CozinhaState, ctx: EngineCtx): boolean {
  type Queued = { id: number; team: number; act: Act; at: number }
  const queue: Queued[] = []
  for (const id of draft.roster) {
    const team = teamOf(draft, id)
    if (team === null) continue
    const acts = pendingActs(draft, ctx, id)
    if (!acts.length) continue
    // O horário de cada toque nunca anda para trás dentro da fila da pessoa.
    let last = -Infinity
    for (const act of acts) {
      const at = Math.max(last, Math.min(ctx.now, Math.max(ctx.now - MAX_AT_SKEW_MS, act.at)))
      last = at
      queue.push({ id, team, act: { ...act, at }, at })
    }
    draft.seen[String(id)] = acts[acts.length - 1].n
  }
  if (!queue.length) return false
  // Todo mundo na ordem dos toques (empate: ordem da mesa, depois a fila).
  queue.sort((x, y) => x.at - y.at || draft.roster.indexOf(x.id) - draft.roster.indexOf(y.id) || x.act.n - y.act.n)
  for (const entry of queue) applyAct(draft, entry.team, entry.id, entry.act, ctx.now)
  return true
}

/** O relógio da cozinha: pratos saindo do fogo, queimando, pedidos esgotando e chegando. */
function tickKitchens(draft: CozinhaState, now: number) {
  draft.kitchens.forEach((kitchen, team) => {
    for (const item of kitchen.items) {
      if (item.ph !== 'cook') continue
      if (item.pick && now >= item.end) {
        advance(item)
      } else if (now >= item.end + draft.burnMs + LATE_MS) {
        burn(draft, kitchen, item, now)
      }
    }
    for (const order of [...kitchen.orders]) {
      if (now < order.exp + LATE_MS) continue
      kitchen.score -= MISS_PENALTY
      kitchen.missed += 1
      kitchen.nextAt = Math.max(kitchen.nextAt, now + AFTER_ORDER_GAP_MS)
      pop(kitchen, 'miss', order.d, -MISS_PENALTY, 0, now)
      removeOrder(kitchen, order.id)
    }
    const open = maxOpenOrders(draft, now - draft.cookStart)
    if (kitchen.orders.length < open && now >= kitchen.nextAt) {
      spawnOrder(draft, team, kitchen, now)
      kitchen.nextAt = now + (draft.event === 'lotada' ? LOTADA_GAP_MS : SPAWN_GAP_MS)
    }
  })
}

function stepCook(state: CozinhaState, ctx: EngineCtx): CozinhaState {
  if (timeUp(state, ctx)) return endCook(state, ctx)
  const before = JSON.stringify(state)
  const draft = JSON.parse(before) as CozinhaState
  const consumed = processActs(draft, ctx)
  tickKitchens(draft, ctx.now)
  if (consumed) {
    draft.rev += 1
    draft.inputKey = `ck-${draft.round}-${draft.rev}`
  }
  return JSON.stringify(draft) === before ? state : draft
}

function endCook(state: CozinhaState, ctx: EngineCtx): CozinhaState {
  const scores = state.kitchens.map((kitchen) => kitchen.score)
  let winner: number | null = null
  if (!state.solo && scores.length === 2 && scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1
  const stars = state.solo ? starsFor(scores[0] ?? 0, state.roundMs) : 0
  const teams = state.teams.map((team, index) => ({
    ...team,
    wins: team.wins + (winner === index ? 1 : 0),
    total: team.total + (scores[index] ?? 0),
  }))
  const result: RoundResult = {
    round: state.round,
    scores,
    delivered: state.kitchens.map((kitchen) => kitchen.delivered),
    missed: state.kitchens.map((kitchen) => kitchen.missed),
    burnt: state.kitchens.map((kitchen) => kitchen.burnt),
    winner,
    stars,
    event: state.event,
  }
  return {
    ...state,
    phase: 'tally',
    inputKey: `tally-${state.round}`,
    deadline: deadlineIn(ctx.now, TALLY_SECONDS),
    teams,
    // A cozinha esvazia (o estado vai para todos os celulares: quanto menor, melhor).
    kitchens: state.kitchens.map((kitchen) => ({ ...kitchen, orders: [], items: [], pop: null })),
    history: [...state.history, result],
    acted: [],
  }
}

function afterTally(state: CozinhaState, ctx: EngineCtx): CozinhaState {
  if (matchDecided(state)) {
    return { ...state, phase: 'final', over: true, deadline: null, inputKey: 'final', acted: [] }
  }
  return startPrep(state, ctx, state.round + 1)
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

/** Chance de um bot "se distrair" num passo (queima e esgota de vez em quando). */
const BOT_DISTRACTION = 0.2

/** O que um jogador faria agora (o bot dos testes; a prévia também usa). */
export function botAct(state: CozinhaState, id: number, now: number): { a: ActKind; i: number; taps: number } | null {
  const team = teamOf(state, id)
  if (team === null) return null
  const kitchen = state.kitchens[team]
  if (!kitchen) return null
  const mine = seatOf(state, id)
  const stations: readonly Station[] = mine.length ? mine : STATIONS
  const at = (st: Station) => stations.includes(st)
  const burnt = kitchen.items.find((item) => item.ph === 'burnt' && at(item.st))
  if (burnt) return { a: 'trash', i: burnt.id, taps: 1 }
  const ready = kitchen.items.find((item) => item.ph === 'cook' && !item.pick && at(item.st) && now >= item.end - 1000)
  if (ready) return { a: 'take', i: ready.id, taps: 1 }
  if (at('balcao')) {
    const order = kitchen.orders.find((entry) => orderReady(kitchen, entry.id))
    if (order) return { a: 'serve', i: order.id, taps: Math.max(1, tapsNeeded('balcao') - order.taps) }
  }
  for (const st of HEAT_STATIONS) {
    if (!at(st)) continue
    const cap = state.capacity[team]?.[st as 'fogao' | 'forno'] ?? 2
    const waiting = kitchen.items.find((item) => item.ph === 'queue' && item.st === st)
    if (waiting && heatUsed(kitchen, st) < cap) return { a: 'cook', i: waiting.id, taps: 1 }
  }
  const prep = kitchen.items.find((item) => item.ph === 'prep' && at(item.st))
  if (prep) return { a: 'tap', i: prep.id, taps: Math.max(1, tapsNeeded(prep.st) - prep.taps) }
  return null
}

export const engine: HalloweenEngine<CozinhaState> = {
  init(ctx) {
    const roster = onlineIds(ctx)
    const minutes = readOption<number>(ctx.options, 'minutes', 3, MINUTE_CHOICES)
    const rounds = readOption<number>(ctx.options, 'rounds', 3, ROUND_CHOICES)
    const chaos = readOption<boolean>(ctx.options, 'chaos', true)
    const groups = splitTeams(roster, ctx.rng)
    const solo = groups.length === 1
    const biggest = Math.max(1, ...groups.map((group) => group.length))
    const teams: Team[] = groups.map((players, index) => {
      const look = solo ? SOLO_LOOK : TEAM_LOOKS[index]
      return {
        ...look,
        players,
        wins: 0,
        total: 0,
        // Time menor: pedidos com um pouco mais de paciência.
        slack: Math.round((1 + 0.5 * ((biggest - players.length) / biggest)) * 100) / 100,
      }
    })
    const teamMap: Record<string, number> = {}
    teams.forEach((team, index) => team.players.forEach((id) => (teamMap[String(id)] = index)))
    const blank: CozinhaState = {
      phase: 'prep',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds: rounds,
      roundMs: minutes * 60_000,
      chaos,
      solo,
      teams,
      teamOf: teamMap,
      seat: {},
      kitchens: [],
      deck: [],
      event: null,
      usedEvents: [],
      cookMs: { ...COOK_MS },
      burnMs: BURN_MS,
      capacity: [],
      seen: emptyScores(roster),
      rev: 0,
      cookStart: ctx.now,
      nextId: 1,
      stats: Object.fromEntries(roster.map((id) => [String(id), emptyStats()])),
      served: {},
      history: [],
    }
    return startPrep(blank, ctx, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'prep': {
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster)) return startCook(state, ctx)
        return refreshActed(state, ctx)
      }
      case 'cook':
        return stepCook(state, ctx)
      case 'tally':
        return timeUp(state, ctx) ? afterTally(state, ctx) : state
      default:
        // Estado que não é deste jogo (partida velha): encerra em vez de travar.
        return { ...state, over: true, deadline: null }
    }
  },

  bot(state, playerId, ctx) {
    if (state.phase === 'prep') return inputFor(ctx, state.inputKey, playerId) ? null : { ready: true }
    if (state.phase !== 'cook') return null
    if (ctx.rng() < BOT_DISTRACTION) return null
    const choice = botAct(state, playerId, ctx.now)
    if (!choice) return null
    const seen = state.seen[String(playerId)] ?? 0
    // Toques rápidos de verdade: vários números de uma vez na fila.
    const acts = Array.from({ length: choice.taps }, (_, index) => ({ n: seen + 1 + index, a: choice.a, i: choice.i, at: ctx.now }))
    return { acts }
  },
}

function onlineIds(ctx: EngineCtx): number[] {
  return ctx.players.filter((player) => player.online).map((player) => player.id)
}

// ---------------------------------------------------------------------------
// Prêmios do fim (calculados do estado: servem para a TV e o celular)
// ---------------------------------------------------------------------------

export type Award = { key: string; emoji: string; title: string; text: string; ids: number[]; value: number }

function topBy(state: CozinhaState, value: (stats: PlayerStats) => number): { ids: number[]; value: number } {
  let best = 0
  const roster = state.roster ?? []
  for (const id of roster) best = Math.max(best, value(state.stats?.[String(id)] ?? emptyStats()))
  if (best <= 0) return { ids: [], value: 0 }
  return { ids: roster.filter((id) => value(state.stats?.[String(id)] ?? emptyStats()) === best), value: best }
}

/** O prato mais entregue da partida (índice em DISHES), ou null. */
export function favoriteDish(state: Pick<CozinhaState, 'served'>): number | null {
  let best: number | null = null
  let count = 0
  DISHES.forEach((dish, index) => {
    const n = state.served?.[dish.id] ?? 0
    if (n > count) {
      count = n
      best = index
    }
  })
  return best
}

export function awards(state: CozinhaState): Award[] {
  const list: Award[] = []
  const chef = topBy(state, (s) => s.prep + s.heat * 2 + s.serve * 3)
  if (chef.ids.length) list.push({ key: 'chef', emoji: '👨‍🍳', title: 'Chef do Polo Norte', text: 'quem mais trabalhou na cozinha', ...chef })
  const fav = favoriteDish(state)
  if (fav !== null) {
    const dish = DISHES[fav]
    const royal = topBy(state, (s) => s.dish[dish.id] ?? 0)
    if (royal.ids.length) list.push({ key: 'royal', emoji: '👑', title: dish.crown, text: `${dish.emoji} o prato mais pedido da noite`, ...royal })
  }
  const sleigh = topBy(state, (s) => s.serve)
  if (sleigh.ids.length) list.push({ key: 'sleigh', emoji: '🛷', title: 'Trenó Expresso', text: 'mais pratos montados e entregues', ...sleigh })
  const fingers = topBy(state, (s) => s.prep)
  if (fingers.ids.length) list.push({ key: 'fingers', emoji: '👆', title: 'Dedo Nervoso', text: 'mais toques de corte e tempero', ...fingers })
  const burnt = topBy(state, (s) => s.burnt)
  if (burnt.ids.length) list.push({ key: 'burnt', emoji: '🔥', title: 'Queimou o Peru', text: 'mais comida esturricada (com carinho)', ...burnt })
  return list
}

/** Classificação simples de cada pessoa na partida (para o celular no fim). */
export function workOf(state: CozinhaState, id: number): number {
  const s = state.stats?.[String(id)]
  return s ? s.prep + s.heat * 2 + s.serve * 3 : 0
}
