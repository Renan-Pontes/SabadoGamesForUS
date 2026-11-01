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
 * A abóbora explode NA MÃO de quem segura: o celular dele assusta (e vibra).
 * Quando alguém vira fantasma (última vida), a TV e todo mundo assustam junto.
 */
export function scareMoment(state: State): ScareMoment | null {
  const victim = state.phase === 'boom' ? state.boom?.victim : null
  if (victim == null) return null
  const ghost = Boolean(state.boom?.eliminated)
  return { key: `boom-${state.round}`, phones: ghost ? undefined : [victim], tv: ghost, delayMs: 150 }
}

export const game = defineHalloweenGame<State>({ meta, engine, Tv, Phone, scareMoment })
