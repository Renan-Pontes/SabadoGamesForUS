import { useSyncExternalStore } from 'react'
import type { Monster } from './content'
import type { PortasReveal, State } from './engine'
import { revealSchedule, type RevealSchedule } from './timeline'

/**
 * Peças das telas que não são componentes (o react-refresh pede que
 * `Tv.tsx` e `Phone.tsx` exportem só o componente): relógio da revelação,
 * o que tem atrás de cada porta, cores e vibração.
 */

/** Madeira de cada porta — a porta 3 tem a mesma cor na TV e no celular. */
export const DOOR_WOOD = ['#6b4226', '#3f4d63', '#6a2a3c', '#2f5440', '#53406e'] as const

export const SAFE_GLOW = '#fbbf24'
export const MONSTER_GLOW = '#dc2626'
export const GHOST_TINT = '#7dd3fc'

export function woodFor(door: number): string {
  return DOOR_WOOD[(door - 1) % DOOR_WOOD.length] ?? DOOR_WOOD[0]
}

export type RevealClock = {
  schedule: RevealSchedule
  /** ms desde o começo da revelação. */
  elapsed: number
  /** Portas já abertas na TV. */
  opened: Set<number>
  /** Alguma porta de monstro já abriu. */
  monsterOut: boolean
  /** A TV já disse quem morreu (os celulares só contam depois disso). */
  resultShown: boolean
}

/** Onde a revelação está agora — igual na TV e nos celulares (relógio do servidor). */
export function revealClock(reveal: PortasReveal, now: number): RevealClock {
  const schedule = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
  const elapsed = now - reveal.startedAt
  const opened = new Set(reveal.order.filter((_, index) => elapsed >= (schedule.openAt[index] ?? Infinity)))
  return {
    schedule,
    elapsed,
    opened,
    monsterOut: elapsed >= schedule.monsterAt,
    resultShown: elapsed >= schedule.resultAt,
  }
}

export type DoorView = {
  door: number
  monster: Monster | null
  /** Vivos atrás da porta. */
  players: number[]
  /** Fantasmas que votaram nela. */
  ghosts: number[]
}

/** O que tinha atrás de cada porta (1..n), para desenhar a revelação. */
export function doorViews(reveal: PortasReveal, doors: number): DoorView[] {
  return Array.from({ length: doors }, (_, index) => {
    const door = index + 1
    const at = reveal.monsterDoors.indexOf(door)
    return {
      door,
      monster: at >= 0 ? (reveal.beasts[at] ?? { emoji: '👹', name: 'o monstro' }) : null,
      players: Object.entries(reveal.picks)
        .filter(([, picked]) => picked === door)
        .map(([id]) => Number(id)),
      ghosts: Object.entries(reveal.ghostVotes)
        .filter(([, voted]) => voted === door)
        .map(([id]) => Number(id)),
    }
  })
}

export type Role = 'alive' | 'ghost' | 'out'

/** Vivo, fantasma, ou fora da partida. */
export function roleOf(state: Pick<State, 'roster' | 'alive'>, id: number | null | undefined): Role {
  if (id === null || id === undefined || !state.roster.includes(id)) return 'out'
  return state.alive.includes(id) ? 'alive' : 'ghost'
}

/** O segredo dos fantasmas, conferido (o `mine` chega como JSON cru). */
export function ghostVotesOf(mine: unknown, doors: number): number[] {
  const votes = (mine as { votes?: unknown } | null)?.votes
  if (!Array.isArray(votes)) return new Array<number>(doors).fill(0)
  return Array.from({ length: doors }, (_, index) => (typeof votes[index] === 'number' ? votes[index] : 0))
}

/** Vibra o celular, se der (desktop e iPhone não vibram — tudo bem). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Sem vibração: segue o jogo.
  }
}

/** "1 monstro" / "2 monstros". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// ---------------------------------------------------------------------------
// Tamanho da tela (TV): as portas crescem com a tela, sem estourar a altura.
// ---------------------------------------------------------------------------

function subscribeResize(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

function viewportSnapshot() {
  return typeof window === 'undefined' ? '1280x720' : `${window.innerWidth}x${window.innerHeight}`
}

/** Largura e altura da janela (no teste de servidor, 1280×720). */
export function useViewport(): { width: number; height: number } {
  const raw = useSyncExternalStore(subscribeResize, viewportSnapshot, () => '1280x720')
  const [width, height] = raw.split('x').map(Number)
  return { width: width || 1280, height: height || 720 }
}

/**
 * Quanto da altura da TV a porta pode ocupar. Na revelação mais cheia (1ª
 * rodada com 15 pessoas) ainda precisam caber, embaixo dela, 4 linhas de
 * nomes e a legenda de 2 linhas com quem morreu — numa TV de 1536×864 também.
 */
const DOOR_HEIGHT_SHARE = 0.27

/** Largura de cada porta na TV: cabe na largura e ocupa no máximo 27% da altura. */
export function tvDoorWidth(doors: number, viewport: { width: number; height: number }): number {
  const byWidth = (viewport.width - 120) / Math.max(1, doors) - 36
  const byHeight = (viewport.height * DOOR_HEIGHT_SHARE) / 1.6
  return Math.round(Math.max(90, Math.min(270, byWidth, byHeight)))
}

/** Linhas de nomes embaixo de cada porta da TV (o resto vira "+N"). */
export const NAME_LINES = 4

/**
 * Quem aparece embaixo de uma porta: todo mundo, se couber em 4 linhas; senão
 * 3 nomes e "+N" (a legenda da TV já lista todos os mortos da rodada).
 */
export function visibleNames(people: readonly number[]): { shown: number[]; more: number } {
  if (people.length <= NAME_LINES) return { shown: [...people], more: 0 }
  const shown = people.slice(0, NAME_LINES - 1)
  return { shown, more: people.length - shown.length }
}

/** Colunas do ranking final na TV: até 6 numa coluna, até 10 em duas, depois três (15 = 3×5). */
export function rankingColumns(entries: number): number {
  if (entries <= 6) return 1
  if (entries <= 10) return 2
  return 3
}
