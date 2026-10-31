/**
 * Tudo que um motor de jogo precisa, num import só:
 * `import { inputFor, timeUp, type EngineCtx } from '../../engine'`.
 * O kit de testes fica de fora (importe `../../engine/testkit` nos testes).
 */
export type * from './types'
export * from './helpers'
export { defineHalloweenGame } from './define'
