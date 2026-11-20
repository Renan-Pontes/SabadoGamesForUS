import { CATEGORY_LABEL, CHAOS_BY_ID, COOP_NAME, PART_BY_ID, TEAM_LOOK, type Category, type PartDef, type TeamId, type TeamLook } from './content'
import { MAX_QUEUE, orderAt, winningTeam, type FpState, type Order, type TapResult, type Team } from './engine'

/**
 * Ajudantes das telas (TV e celular). Puros, menos a fila de toques do
 * celular, que mora na memória da página.
 */

export const FLASH_MS = 2200

const UNKNOWN_PART: PartDef = { id: '?', cat: 'caixa', name: 'Peça', color: '#888888' }

export function partOf(id: string | null | undefined): PartDef {
  return (id && PART_BY_ID[id]) || UNKNOWN_PART
}

export function categoryOf(id: string): Category {
  return partOf(id).cat
}

export function categoryLabel(cat: Category): string {
  return CATEGORY_LABEL[cat]
}

/** Cara do time (no cooperativo, o time único tem nome próprio). */
export function teamLook(state: Pick<FpState, 'coop'>, id: TeamId): TeamLook {
  const look = TEAM_LOOK[id] ?? TEAM_LOOK.r
  return state.coop ? { ...look, name: COOP_NAME, icon: '🎄' } : look
}

/** "2:05" */
export function clockText(ms: number | null | undefined): string {
  const total = Math.max(0, Math.ceil((ms ?? 0) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type StepStatus = 'done' | 'next' | 'held' | 'todo'

/** Situação de cada etapa do pedido na bancada. */
export function stepStatuses(team: Pick<Team, 'order' | 'placed' | 'held'>): StepStatus[] {
  const order = team.order
  if (!order) return []
  return order.parts.map((part, index) => {
    if (index < team.placed) return 'done'
    if (team.held.some((held) => held.p === part)) return 'held'
    return index === team.placed ? 'next' : 'todo'
  })
}

/** As peças já no presente (para desenhar). */
export function placedParts(team: Pick<Team, 'order' | 'placed'>): string[] {
  return team.order ? team.order.parts.slice(0, team.placed) : []
}

/** A caixa do pedido (para o contorno do presente antes de ela chegar). */
export function boxOf(parts: readonly string[]): string | null {
  return parts.find((part) => categoryOf(part) === 'caixa') ?? null
}

/** Os próximos pedidos da fila do time (a TV mostra uma prévia). */
export function upcoming(state: Pick<FpState, 'seed' | 'active' | 'chaos'>, team: Pick<Team, 'order'>, count = 2): Order[] {
  if (!team.order) return []
  return Array.from({ length: count }, (_, step) => orderAt(state.seed, team.order!.n + 1 + step, state.active, state.chaos))
}

/** Fração do tempo do pedido que ainda resta (0..1). */
export function orderFraction(team: Pick<Team, 'startedAt' | 'expiresAt'>, now: number): number {
  const total = team.expiresAt - team.startedAt
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, (team.expiresAt - now) / total))
}

export function flashActive(team: Pick<Team, 'flash'>, now: number): boolean {
  return team.flash !== null && now - team.flash.at >= -500 && now - team.flash.at < FLASH_MS
}

export const RESULT_TEXT: Record<TapResult, string> = {
  ok: '✓ entrou no presente!',
  wait: '⏳ esperando a etapa anterior',
  mess: '💥 BAGUNÇA!',
  dup: '👌 já estava lá',
  late: '🛷 o presente já tinha ido',
  drop: '💥 caiu e virou bagunça',
}

export const RESULT_ICON: Record<TapResult, string> = {
  ok: '✓',
  wait: '⏳',
  mess: '💥',
  dup: '👌',
  late: '🛷',
  drop: '💥',
}

/** Frase curta da narração de cada momento (no máximo uma por fase). */
export function narrationFor(state: FpState): string {
  if (state.over) {
    if (state.coop || !state.teams?.length) return `A fábrica entregou ${state.teams?.[0]?.sleigh ?? 0} presentes!`
    const win = winningTeam(state)
    const look = win ? TEAM_LOOK[win] : null
    return look ? `Vitória ${look.of} ${look.name}!` : 'Empate na fábrica!'
  }
  if (state.phase === 'brief') {
    if (state.round <= 1) return 'Fábrica aberta! Confiram suas peças.'
    return state.chaos ? CHAOS_BY_ID[state.chaos].say : `Rodada ${state.round}!`
  }
  return ''
}

export function starsText(stars: number): string {
  return '⭐'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars))
}

export function pointsText(points: number): string {
  return `${points > 0 ? '+' : ''}${points}`
}

/** Vibra o celular (sem erro onde não existe). */
export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Alguns navegadores lançam sem gesto do usuário.
  }
}

// ---------------------------------------------------------------------------
// Fila de toques do celular
// ---------------------------------------------------------------------------

export type TapRecord = { n: number; p: string; at: number }

type TapStore = { last: number; taps: TapRecord[] }

const stores = new Map<string, TapStore>()

/** Uma fila por pessoa, por rodada (a semente muda a cada rodada e a cada partida). */
export function tapStoreKey(code: string, me: number, round: number, seed: number): string {
  return `${code}:${me}:${round}:${seed}`
}

/**
 * Registra um toque e devolve a fila a enviar: os toques que o juiz ainda não
 * viu (`n > seen`) mais este, com número novo. O envio substitui o anterior,
 * então mandar a fila inteira garante que nenhum toque se perca e o juiz
 * processa cada número uma vez só.
 */
export function queueTap(key: string, seen: number, part: string, at: number): TapRecord[] {
  const store = stores.get(key) ?? { last: 0, taps: [] }
  const n = Math.max(store.last, seen) + 1
  const taps = [...store.taps.filter((tap) => tap.n > seen), { n, p: part, at }].slice(-MAX_QUEUE)
  stores.set(key, { last: n, taps: [...store.taps, { n, p: part, at }].slice(-MAX_QUEUE) })
  return taps
}

/** Meus últimos toques desta rodada (mais novo primeiro). */
export function recentTaps(key: string, count = 3): TapRecord[] {
  return [...(stores.get(key)?.taps ?? [])].slice(-count).reverse()
}

/** Só para os testes. */
export function resetTapStores() {
  stores.clear()
}
