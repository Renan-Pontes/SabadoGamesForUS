import { lazy } from 'react'
import { defineHalloweenGame } from '../../engine/define'
import { engine, type State } from './engine'
import { meta } from './meta'
import type { ScareMoment } from '../../engine/types'
import { revealSchedule } from './timeline'

/** O pacote do jogo: { meta, engine, Tv, Phone } (telas carregadas sob demanda). */
export { meta, engine }
export const Tv = lazy(() => import('./Tv'))
export const Phone = lazy(() => import('./Phone'))

/**
 * Quem o monstro pegou leva o susto no próprio celular, na hora em que a
 * porta dele abre (a TV já tem os sustos dela nesse momento).
 */
export function scareMoment(state: State): ScareMoment | null {
  const reveal = state.phase === 'reveal' ? state.reveal : null
  if (!reveal || reveal.victims.length === 0) return null
  const { monsterAt } = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
  // −600 ms: o celular vê a revelação ~1 s depois da TV.
  return { key: `reveal-${state.round}`, phones: reveal.victims, tv: false, delayMs: Math.max(0, monsterAt - 600) }
}

export const game = defineHalloweenGame<State>({ meta, engine, Tv, Phone, scareMoment })
