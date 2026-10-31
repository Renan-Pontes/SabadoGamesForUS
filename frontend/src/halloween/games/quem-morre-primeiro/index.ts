import { lazy } from 'react'
import { defineHalloweenGame } from '../../engine/define'
import { engine, type QmpState } from './engine'
import { meta } from './meta'

/**
 * O pacote do jogo: { meta, engine, Tv, Phone }. As telas são carregadas sob
 * demanda (React.lazy) — o motor fica no pacote principal porque a TV-juiz
 * precisa dele assim que a partida começa.
 */
export { meta, engine }
export const Tv = lazy(() => import('./Tv'))
export const Phone = lazy(() => import('./Phone'))

export const game = defineHalloweenGame<QmpState>({ meta, engine, Tv, Phone })
