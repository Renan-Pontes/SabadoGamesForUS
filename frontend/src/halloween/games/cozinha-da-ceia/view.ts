import type { HPlayer } from '../../engine/types'
import { DISHES, EVENT_INFO, HEAT_STATIONS, STATIONS, type Station } from './content'
import {
  EARLY_TAKE_MS,
  championTeam,
  heatUsed,
  isHeat,
  orderReady,
  seatOf,
  stepOf,
  tapsNeeded,
  type Act,
  type ActKind,
  type CozinhaState,
  type Item,
  type Kitchen,
  type Order,
} from './engine'

/**
 * Contas pequenas e falas das telas da Cozinha da Ceia (TV e celular). Ficam
 * fora de `Tv.tsx`/`Phone.tsx` porque esses arquivos só exportam o componente.
 */

/** A TV mostra o "+52" de uma entrega por este tempo. */
export const POP_SHOW_MS = 2600
/** Últimos segundos da rodada: o tique-taque da TV. */
export const FINAL_COUNTDOWN_MS = 10_000
/** Fila do celular: no máximo estes toques esperando o juiz. */
export const MAX_PENDING = 16

export type HeatStatus = 'cooking' | 'almost' | 'ready' | 'smoking' | 'burning' | 'burnt'

/** Como está um item no fogo agora (a TV e o celular desenham a partir disso). */
export function heatStatus(item: Pick<Item, 'ph' | 'end'>, now: number, burnMs: number): HeatStatus {
  if (item.ph === 'burnt') return 'burnt'
  if (now < item.end - EARLY_TAKE_MS) return 'cooking'
  if (now < item.end) return 'almost'
  if (now < item.end + burnMs / 2) return 'ready'
  if (now < item.end + burnMs) return 'smoking'
  return 'burning'
}

/** 0..1 do cozimento. */
export function cookFraction(item: Pick<Item, 't0' | 'end'>, now: number): number {
  const span = Math.max(1, item.end - item.t0)
  return Math.max(0, Math.min(1, (now - item.t0) / span))
}

/** 0..1 de quanto falta para queimar (1 = acabou de ficar pronto). */
export function burnFraction(item: Pick<Item, 'end'>, now: number, burnMs: number): number {
  return Math.max(0, Math.min(1, 1 - (now - item.end) / Math.max(1, burnMs)))
}

/** 0..1 da paciência do pedido que sobra. */
export function patienceFraction(order: Pick<Order, 'born' | 'exp'>, now: number): number {
  const span = Math.max(1, order.exp - order.born)
  return Math.max(0, Math.min(1, (order.exp - now) / span))
}

/** Verde, amarelo ou vermelho para uma barra de paciência. */
export function patienceColor(fraction: number): string {
  if (fraction > 0.5) return '#4fd67e'
  if (fraction > 0.25) return '#f5c242'
  return '#ff4d5e'
}

/** "Cortar o pão". */
export function stepLabel(item: Pick<Item, 'd' | 'c' | 's'>): string {
  const step = stepOf(item)
  return step ? `${step.verb} ${step.what}` : 'Pronto'
}

export function dishOf(d: number) {
  return DISHES[d] ?? DISHES[0]
}

/** "2:35" */
export function clockText(ms: number | null): string {
  const total = Math.max(0, Math.ceil((ms ?? 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** "1 queimado", "3 queimados". */
export function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/** Onde está cada componente de um pedido (para os chips do ticket). */
export function orderParts(kitchen: Pick<Kitchen, 'items'>, orderId: number): { st: Station; done: boolean; burnt: boolean }[] {
  return kitchen.items
    .filter((item) => item.o === orderId)
    .sort((a, b) => a.c - b.c)
    .map((item) => ({ st: item.st, done: item.ph === 'done', burnt: item.ph === 'burnt' }))
}

/** Quantas coisas pedem a mão de alguém nesta estação agora. */
export function stationAttention(kitchen: Kitchen, st: Station, now: number, burnMs: number): { count: number; urgent: boolean } {
  if (st === 'balcao') {
    const ready = kitchen.orders.filter((order) => orderReady(kitchen, order.id)).length
    return { count: ready, urgent: ready > 0 }
  }
  const here = kitchen.items.filter((item) => item.st === st && item.ph !== 'done')
  if (!isHeat(st)) return { count: here.length, urgent: false }
  const urgent = here.some((item) => {
    if (item.ph === 'burnt') return true
    if (item.ph !== 'cook' || item.pick) return false
    const status = heatStatus(item, now, burnMs)
    return status === 'ready' || status === 'smoking' || status === 'burning'
  })
  return { count: here.length, urgent }
}

/**
 * Estações que o celular mostra: as minhas, mais as de colegas que sumiram
 * (ninguém online nelas). Sem estação nenhuma (entrou de reforço), todas.
 */
export function phoneStations(state: CozinhaState, me: number, players: readonly HPlayer[], team: number): { st: Station; cover: boolean }[] {
  const mine = seatOf(state, me)
  if (!mine.length) return STATIONS.map((st) => ({ st, cover: true }))
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const mates = state.teams[team]?.players ?? []
  const orphan = STATIONS.filter((st) => {
    if (mine.includes(st)) return false
    const holders = mates.filter((id) => seatOf(state, id).includes(st))
    return holders.length > 0 && holders.every((id) => !online.has(id))
  })
  return [...mine.map((st) => ({ st, cover: false })), ...orphan.map((st) => ({ st, cover: true }))]
}

/** Quem do time está numa estação (nomes curtinhos para a TV). */
export function holdersOf(state: CozinhaState, team: number, st: Station): number[] {
  return (state.teams[team]?.players ?? []).filter((id) => seatOf(state, id).includes(st))
}

export function firstName(players: readonly HPlayer[], id: number): string {
  const name = players.find((player) => player.id === id)?.name ?? '?'
  return name.split(/\s+/)[0] || name
}

// ---------------------------------------------------------------------------
// A fila de toques do celular
// ---------------------------------------------------------------------------

export type PendingAct = Act & { r: number }

/** Os toques que o juiz ainda não viu (desta rodada). */
export function livePending(pending: readonly PendingAct[], seen: number, round: number): PendingAct[] {
  return pending.filter((act) => act.n > seen && act.r === round)
}

/** Monta o próximo toque e a fila que vai para o servidor. */
export function enqueue(
  pending: readonly PendingAct[],
  seen: number,
  lastN: number,
  round: number,
  a: ActKind,
  i: number,
  at: number,
): { act: PendingAct; queue: PendingAct[] } {
  const n = Math.max(seen, lastN) + 1
  const act: PendingAct = { n, a, i, at, r: round }
  const queue = [...livePending(pending, seen, round), act].slice(-MAX_PENDING)
  return { act, queue }
}

export function pendingCount(pending: readonly PendingAct[], a: ActKind, i: number): number {
  return pending.filter((act) => act.a === a && act.i === i).length
}

/** Toques que este item mostra no celular (os do juiz + os meus a caminho). */
export function shownTaps(item: Pick<Item, 'taps' | 'st' | 'id'>, pending: readonly PendingAct[]): number {
  return Math.min(tapsNeeded(item.st), item.taps + pendingCount(pending, 'tap', item.id))
}

/** Lugares livres no fogão/forno, contando o que eu já mandei para lá. */
export function freeSlots(state: CozinhaState, team: number, st: Station, pending: readonly PendingAct[]): number {
  if (!isHeat(st)) return 0
  const kitchen = state.kitchens[team]
  if (!kitchen) return 0
  const cap = state.capacity[team]?.[st] ?? 2
  const sending = pending.filter((act) => act.a === 'cook' && kitchen.items.some((item) => item.id === act.i && item.ph === 'queue' && item.st === st)).length
  return Math.max(0, cap - heatUsed(kitchen, st) - sending)
}

export const HEAT: readonly Station[] = HEAT_STATIONS

// ---------------------------------------------------------------------------
// Falas (no máximo duas por rodada, curtinhas e animadas)
// ---------------------------------------------------------------------------

export function prepLine(state: Pick<CozinhaState, 'round' | 'event'>): string {
  if (state.event) return EVENT_INFO[state.event].title
  return state.round <= 1 ? 'Aventais a postos! A ceia vai começar!' : `Rodada ${state.round}! Aventais a postos!`
}

export function tallyLine(state: CozinhaState): string {
  const last = state.history[state.history.length - 1]
  if (!last) return ''
  if (state.solo) {
    return last.stars >= 3 ? 'Três estrelas! Que ceia!' : last.stars >= 1 ? 'A ceia saiu! Bom trabalho!' : 'Ih, a ceia atrasou! Bora de novo!'
  }
  if (last.winner === null) return 'Empate na cozinha!'
  return `Rodada dos ${state.teams[last.winner]?.name ?? 'duendes'}!`
}

export function finalLine(state: CozinhaState): string {
  if (state.solo) return 'A ceia está servida! Feliz Natal!'
  const champ = championTeam(state)
  if (champ === null) return 'Empate! A ceia é de todo mundo!'
  return `Os ${state.teams[champ].name} venceram a ceia!`
}

/** Estrelas em texto: ⭐⭐☆ */
export function starsText(stars: number): string {
  return '⭐'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, 3 - stars))
}
