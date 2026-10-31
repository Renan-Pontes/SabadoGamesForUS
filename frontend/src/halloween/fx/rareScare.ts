/**
 * O susto raro, do jeito dos mods da "Foxy 1 em 10.000": a cada segundo a TV
 * rola um dado de 5000 lados e, se cair 1, chama o Penetra. Sem aviso, sem
 * intervalo mínimo e sem memória — pode vir duas vezes seguidas ou passar a
 * festa inteira sem aparecer. A graça é essa.
 *
 * Em números (1 em 5000 por segundo):
 *   - espera média: 5000 s ≈ 83 min (mediana ≈ 58 min);
 *   - chance de aparecer em 1 h ≈ 51%, em 3 h ≈ 88%, em 4 h ≈ 94%.
 *
 * O segundo só conta quando `canRoll()` deixa (sustos ligados, TV visível,
 * nenhum susto na tela, nenhuma revelação). Independe dos sustos de 4–9 min.
 * O relógio é injetável para o teste não esperar horas.
 */

export const RARE_SCARE_ODDS = 5000
export const RARE_SCARE_TICK_MS = 1000

export type RareScareOptions = {
  canRoll: () => boolean
  fire: () => void
  /** "1 em N" por rolagem. */
  odds?: number
  tickMs?: number
  random?: () => number
  setTicker?: (fn: () => void, ms: number) => unknown
  clearTicker?: (handle: unknown) => void
}

/** Liga a rolagem de segundo em segundo. Devolve a função que desliga. */
export function startRareScare(options: RareScareOptions): () => void {
  const {
    canRoll,
    fire,
    odds = RARE_SCARE_ODDS,
    tickMs = RARE_SCARE_TICK_MS,
    random = Math.random,
    setTicker = (fn, ms) => window.setInterval(fn, ms),
    clearTicker = (handle) => window.clearInterval(handle as number),
  } = options

  const handle = setTicker(() => {
    if (canRoll() && random() < 1 / odds) fire()
  }, tickMs)
  return () => clearTicker(handle)
}
