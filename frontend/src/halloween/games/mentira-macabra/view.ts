import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import { BLANK } from './content'
import {
  CHOOSE_SECONDS,
  SCORES_SECONDS,
  TRUTH_POINTS,
  WRITE_SECONDS,
  revealEnd,
  truthAt,
  type MmReveal,
  type MmRevealItem,
  type MmSecret,
  type MmState,
} from './engine'

/**
 * Ajudantes das telas (TV e celular). Ficam fora de `Tv.tsx`/`Phone.tsx`
 * porque esses arquivos só exportam o componente (regra do react-refresh).
 */

/** "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function names(players: readonly HPlayer[], ids: readonly number[]): string {
  return listNames(ids.map((id) => nameOf(players, id)))
}

/** Vibra o celular (quando dá: desktop e iPhone ignoram). */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
  } catch {
    // Sem vibração: tudo bem.
  }
}

/** O fato para a voz da TV ler: a lacuna vira reticências (suspense!). */
export function speechFor(text: string): string {
  return text.replace(BLANK, '…').replace(/[“”"]/g, '')
}

/**
 * Na hora da verdade, a TV toca o rufar e o cartão só vira na pancada (o
 * rufar dura 1,7 s). Até lá, nem a lacuna da TV nem os celulares entregam.
 */
export const TRUTH_FLIP_MS = 1700

/** Quando a verdade aparece de fato (ms do servidor): TV e celulares usam o mesmo. */
export function truthShownAt(reveal: MmReveal): number {
  return truthAt(reveal) + TRUTH_FLIP_MS
}

/** Duração inteira da fase (a vela cheia na TV). */
export function phaseTotalMs(state: MmState): number {
  switch (state.phase) {
    case 'write':
      return WRITE_SECONDS * 1000
    case 'choose':
      return CHOOSE_SECONDS * 1000
    case 'reveal':
      return state.reveal ? revealEnd(state.reveal) - state.reveal.at : 20_000
    default:
      return SCORES_SECONDS * 1000
  }
}

/** Pontos de quem achou a verdade nesta revelação. */
export function truthPoints(reveal: MmReveal): number {
  return TRUTH_POINTS * (reveal.double ? 2 : 1)
}

/** Como foi a rodada de um jogador: onde ele caiu, a mentira dele e quanto ganhou. */
export type MyOutcome = { picked: MmRevealItem | null; mine: MmRevealItem | null; gain: number }

export function myOutcome(reveal: MmReveal, id: number): MyOutcome {
  const all = [...reveal.steps, ...reveal.missed]
  return {
    picked: all.find((item) => item.pickers.includes(id)) ?? null,
    mine: all.find((item) => item.authors.includes(id)) ?? null,
    gain: reveal.gains[String(id)] ?? 0,
  }
}

/** Mentira que enganou muita gente: merece o zoom suspeito 🤨 na TV. */
export function isBigLie(item: MmRevealItem, rosterSize: number): boolean {
  return item.kind === 'lie' && item.pickers.length >= Math.min(3, Math.max(2, rosterSize - 1))
}

/** O segredo do celular (o framework entrega como `mine`). */
export function secretOf(mine: unknown): MmSecret | null {
  if (!mine || typeof mine !== 'object') return null
  const { lie, own } = mine as Partial<MmSecret>
  return typeof lie === 'string' && typeof own === 'number' ? { lie, own } : null
}

/** Letra das opções na TV: quanto mais opções, menor (nunca abaixo de 28 px). */
export function optionFont(count: number): string {
  if (count <= 6) return 'clamp(2rem, 2.8vw, 3.2rem)'
  if (count <= 10) return 'clamp(1.85rem, 2.2vw, 2.6rem)'
  return 'clamp(1.75rem, 1.8vw, 2.2rem)'
}

/** Colunas da grade de opções na TV. */
export function optionColumns(count: number): number {
  if (count <= 4) return 2
  if (count <= 9) return 3
  return 4
}

/** "1 pessoa" / "3 pessoas". */
export function people(count: number): string {
  return `${count} ${count === 1 ? 'pessoa' : 'pessoas'}`
}
