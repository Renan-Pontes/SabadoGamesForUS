import { startRandomScares } from './randomScares'
import type { RandomScareDecision, RandomScareOptions } from './randomScares'

/**
 * Visitas de Natal automáticas da TV: uma a cada 60–150 s (no lobby e nos
 * jogos), nunca nos primeiros 30 s. Na hora H, pergunta se pode:
 *   - 'fire' → solta a visita e sorteia a próxima;
 *   - 'skip' → visitas desligadas: espera um intervalo inteiro;
 *   - 'wait' → ocupado (revelação/votação segurando, narração, outra visita
 *              ou efeito na tela, aba escondida): tenta de novo em 8–20 s.
 *
 * Usa o mesmo agendador dos sustos (randomScares.ts), com outros tempos.
 */

export const AMBIENT_CAMEO_TIMING = {
  minDelayMs: 60_000,
  maxDelayMs: 150_000,
  warmupMs: 30_000,
  retryMinMs: 8_000,
  retryMaxMs: 20_000,
}

export type AmbientCameoState = {
  /** A temporada tem visitas automáticas (AMBIENT_CAMEOS) e a TV deixou ligado ("Visitas de Natal"). */
  enabled: boolean
  /** Aba escondida. */
  hidden: boolean
  /** O jogo está segurando os efeitos (useSuppressScares: revelação, votação...). */
  suppressed: boolean
  /** Já tem efeito de tela cheia na tela. */
  scareShowing: boolean
  /** Já tem visita na tela. */
  cameoShowing: boolean
  /** A TV está narrando: a visita espera a frase acabar. */
  narrating: boolean
}

export function ambientCameoDecision(state: AmbientCameoState): RandomScareDecision {
  if (!state.enabled) return 'skip'
  if (state.hidden || state.suppressed || state.scareShowing || state.cameoShowing || state.narrating) return 'wait'
  return 'fire'
}

/** Liga as visitas automáticas. Devolve a função que desliga. */
export function startAmbientCameos(options: RandomScareOptions): () => void {
  return startRandomScares({ ...AMBIENT_CAMEO_TIMING, ...options })
}
