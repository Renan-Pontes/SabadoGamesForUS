import { lazy } from 'react'
import { defineHalloweenGame } from '../../engine/define'
import { engine, type State } from './engine'
import { meta } from './meta'
import type { ScareMoment } from '../../engine/types'

/** O pacote do jogo: { meta, engine, Tv, Phone } (telas carregadas sob demanda). */
export { meta, engine }
export const Tv = lazy(() => import('./Tv'))
export const Phone = lazy(() => import('./Phone'))

/**
 * Susto para todos (TV e celulares) quando a cidade acorda com um morto: a
 * sala inteira pula, e só depois a TV mostra quem foi.
 */
export function scareMoment(state: State): ScareMoment | null {
  if (state.phase !== 'morning' || state.news?.killed == null) return null
  return { key: `morning-${state.round}`, delayMs: 700 }
}

export const game = defineHalloweenGame<State>({ meta, engine, Tv, Phone, scareMoment })
