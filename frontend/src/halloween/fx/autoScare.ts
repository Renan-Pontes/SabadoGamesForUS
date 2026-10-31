import type { RandomScareDecision } from './randomScares'

/**
 * Quando os sustos automáticos da TV (o de 4–9 min e o raro) podem sair.
 * Puro, para dar para testar; TvFxLayer passa o estado do app.
 */
export type AutoScareState = {
  /** Sustos aleatórios ligados no controle da TV. */
  enabled: boolean
  /** Aba escondida. */
  hidden: boolean
  /** Revelação/votação segurando os sustos (useSuppressScares). */
  suppressed: boolean
  /** Já tem susto na tela. */
  showing: boolean
  /** A TV está falando (narração do jogo): o susto espera a frase acabar. */
  narrating: boolean
}

/** O de 4–9 min: 'skip' se desligado, 'wait' se ocupado (tenta de novo em 15–30 s). */
export function randomScareDecision(state: AutoScareState): RandomScareDecision {
  if (!state.enabled) return 'skip'
  if (state.hidden || state.suppressed || state.showing || state.narrating) return 'wait'
  return 'fire'
}

/** O raro (1 em 5000 por segundo): só rola quando nada está acontecendo. */
export function canRollRareScare(state: AutoScareState): boolean {
  return randomScareDecision(state) === 'fire'
}

/** A voz do navegador está falando agora (narração dos jogos usa speechSynthesis). */
export function isNarrating(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking)
  } catch {
    return false
  }
}
