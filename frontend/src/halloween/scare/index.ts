/**
 * PLACEHOLDER — os sustos de meme de verdade são escritos na Etapa 1 do plano
 * (HALLOWEEN.md). Os nomes e assinaturas abaixo são o contrato.
 */

export type ScareKind =
  | 'random'
  | 'doot'
  | 'zoom'
  | 'scream'
  | 'pumpkin'
  | 'pipe'
  | 'skeletons'
  | 'spider'
  | 'static'
  | 'bruh'
  | 'eyes'

/** Mostra um susto em tela cheia NESTE aparelho (normalmente a TV). */
export function triggerScare(kind: ScareKind = 'random', options?: { name?: string }): void {
  void kind
  void options
}

/**
 * Enquanto `active` for true, os sustos aleatórios ficam suspensos — use em
 * revelações e votações para o meme não atropelar o momento importante.
 */
export function useSuppressScares(active: boolean): void {
  void active
}
