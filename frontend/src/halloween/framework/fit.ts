/** Menor escala da TV: abaixo disso, melhor cortar a sobra do que virar formiga. */
export const MIN_TV_SCALE = 0.5

/**
 * Quanto encolher a tela do jogo na TV para caber na altura disponível:
 * 1 se já cabe (1 px de folga para arredondamento), senão
 * `available / natural`, nunca abaixo de `min`.
 */
export function fitScale(available: number, natural: number, min = MIN_TV_SCALE): number {
  if (!(available > 0) || !(natural > available + 1)) return 1
  return Math.max(min, available / natural)
}
