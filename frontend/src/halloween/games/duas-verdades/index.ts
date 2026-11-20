import { lazy } from 'react'
import { defineHalloweenGame } from '../../engine/define'
import { engine, type State } from './engine'
import { meta } from './meta'

/** O pacote do jogo: { meta, engine, Tv, Phone } (telas carregadas sob demanda). */
export { meta, engine }
export const Tv = lazy(() => import('./Tv'))
export const Phone = lazy(() => import('./Phone'))

export const game = defineHalloweenGame<State>({ meta, engine, Tv, Phone })
