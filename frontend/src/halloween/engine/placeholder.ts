import { allOnlineActed, deadlineIn, onlineRoster, refreshActed, timeUp } from './helpers'
import type { BaseState, HalloweenEngine } from './types'

/**
 * Motor provisório dos jogos que ainda não foram escritos (Etapa 2): uma
 * fase só, "toque para provar que está vivo", que termina sozinha. Serve
 * para a plataforma inteira funcionar de ponta a ponta antes dos jogos.
 */
export type PlaceholderState = BaseState & { phase: 'intro' | 'done'; acted: number[] }

export const PLACEHOLDER_SECONDS = 20

export function placeholderEngine(): HalloweenEngine<PlaceholderState> {
  return {
    init(ctx) {
      return {
        phase: 'intro',
        inputKey: 'intro',
        deadline: deadlineIn(ctx.now, PLACEHOLDER_SECONDS),
        roster: onlineRoster(ctx),
        over: false,
        acted: [],
      }
    },
    step(state, ctx) {
      if (state.over) return state
      if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster)) {
        return { ...refreshActed(state, ctx), phase: 'done', over: true, deadline: null }
      }
      return refreshActed(state, ctx)
    },
    bot(state) {
      return state.phase === 'intro' ? { alive: true } : null
    },
  }
}
