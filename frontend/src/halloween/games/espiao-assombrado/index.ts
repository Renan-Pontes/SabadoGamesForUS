import { lazy } from 'react'
import { defineHalloweenGame } from '../../engine/define'
import { engine, type State } from './engine'
import { meta } from './meta'
import type { ScareMoment } from '../../engine/types'

/** O pacote do jogo: { meta, engine, Tv, Phone } (telas carregadas sob demanda). */
export { meta, engine }
export const Tv = lazy(() => import('./Tv'))
export const Phone = lazy(() => import('./Phone'))

/** Desfechos em que o espião aparece de verdade (ou a mesa descobre a pior notícia). */
const DRAMATIC = new Set(['caught', 'escaped', 'innocent', 'everyone'])

/**
 * Susto para todos (TV e celulares) quando o espião é revelado — no fim do
 * rufar de tambor, junto com o "ERA ELE!". Na última rodada, sempre.
 */
export function scareMoment(state: State): ScareMoment | null {
  if (state.phase !== 'result' || !state.result) return null
  const last = state.round >= state.totalRounds
  if (!last && !DRAMATIC.has(state.result.outcome)) return null
  return { key: `result-${state.round}`, delayMs: 1900 }
}

export const game = defineHalloweenGame<State>({ meta, engine, Tv, Phone, scareMoment })
