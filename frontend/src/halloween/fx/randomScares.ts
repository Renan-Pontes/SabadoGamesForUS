/**
 * Agendador dos sustos aleatórios da TV.
 *
 * Um susto a cada 4–9 minutos, nunca nos 2 primeiros (a sala ainda está
 * chegando). Na hora H ele pergunta se pode:
 *   - 'fire'  → assusta e sorteia o próximo;
 *   - 'skip'  → sustos desligados: espera um intervalo inteiro (religar não
 *               pode virar susto instantâneo);
 *   - 'wait'  → ocupado (revelação, aba escondida, outro susto na tela):
 *               tenta de novo em 15–30 s.
 *
 * Os relógios são injetáveis para o teste não esperar 9 minutos.
 */

export type RandomScareDecision = 'fire' | 'skip' | 'wait'

export type RandomScareOptions = {
  check: () => RandomScareDecision
  fire: () => void
  minDelayMs?: number
  maxDelayMs?: number
  warmupMs?: number
  retryMinMs?: number
  retryMaxMs?: number
  random?: () => number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export const RANDOM_SCARE_DEFAULTS = {
  minDelayMs: 4 * 60_000,
  maxDelayMs: 9 * 60_000,
  warmupMs: 2 * 60_000,
  retryMinMs: 15_000,
  retryMaxMs: 30_000,
}

/** Liga o agendador. Devolve a função que desliga. */
export function startRandomScares(options: RandomScareOptions): () => void {
  const {
    check,
    fire,
    minDelayMs = RANDOM_SCARE_DEFAULTS.minDelayMs,
    maxDelayMs = RANDOM_SCARE_DEFAULTS.maxDelayMs,
    warmupMs = RANDOM_SCARE_DEFAULTS.warmupMs,
    retryMinMs = RANDOM_SCARE_DEFAULTS.retryMinMs,
    retryMaxMs = RANDOM_SCARE_DEFAULTS.retryMaxMs,
    random = Math.random,
    now = () => Date.now(),
    setTimer = (fn, ms) => window.setTimeout(fn, ms),
    clearTimer = (handle) => window.clearTimeout(handle as number),
  } = options

  const startedAt = now()
  let handle: unknown = null
  let stopped = false

  const between = (min: number, max: number) => min + random() * Math.max(0, max - min)

  const schedule = (ms: number) => {
    handle = setTimer(run, Math.max(0, ms))
  }

  function run() {
    handle = null
    if (stopped) return
    const elapsed = now() - startedAt
    if (elapsed < warmupMs) {
      schedule(warmupMs - elapsed)
      return
    }
    const decision = check()
    if (decision === 'skip') {
      schedule(between(minDelayMs, maxDelayMs))
      return
    }
    if (decision === 'wait') {
      schedule(between(retryMinMs, retryMaxMs))
      return
    }
    try {
      fire()
    } finally {
      if (!stopped) schedule(between(minDelayMs, maxDelayMs))
    }
  }

  schedule(Math.max(warmupMs, between(minDelayMs, maxDelayMs)))

  return () => {
    stopped = true
    if (handle !== null) clearTimer(handle)
    handle = null
  }
}
