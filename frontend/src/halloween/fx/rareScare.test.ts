import { describe, expect, it } from 'vitest'
import { RARE_SCARE_ODDS, RARE_SCARE_TICK_MS, startRareScare } from './rareScare'

/** Ticker de mentira: `tick(n)` roda n segundos na hora. */
function fakeTicker() {
  let fn: (() => void) | null = null
  let interval = 0
  return {
    setTicker: (callback: () => void, ms: number) => {
      fn = callback
      interval = ms
      return 1
    },
    clearTicker: () => {
      fn = null
    },
    interval: () => interval,
    running: () => fn !== null,
    tick(times = 1) {
      for (let i = 0; i < times && fn; i += 1) fn()
    },
  }
}

/** Sorteio com semente (mulberry32): o teste estatístico dá sempre o mesmo resultado. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('susto raro (1 em 5000 por segundo)', () => {
  it('rola uma vez por segundo e só dispara quando o dado cai abaixo de 1/5000', () => {
    const ticker = fakeTicker()
    const rolls = [0.5, 1 / RARE_SCARE_ODDS, 0.9999, 1 / RARE_SCARE_ODDS - 1e-9, 0]
    let fired = 0
    startRareScare({
      canRoll: () => true,
      fire: () => (fired += 1),
      random: () => rolls.shift() ?? 0.5,
      ...ticker,
    })
    expect(ticker.interval()).toBe(RARE_SCARE_TICK_MS)
    ticker.tick(3)
    expect(fired).toBe(0)
    ticker.tick(2)
    expect(fired).toBe(2)
  })

  it('não rola quando não pode (sustos desligados, aba escondida, revelação)', () => {
    const ticker = fakeTicker()
    let allowed = false
    let rolled = 0
    let fired = 0
    startRareScare({
      canRoll: () => allowed,
      fire: () => (fired += 1),
      random: () => {
        rolled += 1
        return 0
      },
      ...ticker,
    })
    ticker.tick(10_000)
    expect(rolled).toBe(0)
    expect(fired).toBe(0)
    allowed = true
    ticker.tick(1)
    expect(fired).toBe(1)
  })

  it('stop() desliga o ticker', () => {
    const ticker = fakeTicker()
    let fired = 0
    const stop = startRareScare({ canRoll: () => true, fire: () => (fired += 1), random: () => 0, ...ticker })
    stop()
    expect(ticker.running()).toBe(false)
    ticker.tick(100)
    expect(fired).toBe(0)
  })

  it('em média, um susto a cada ~5000 segundos', () => {
    const ticker = fakeTicker()
    let fired = 0
    startRareScare({ canRoll: () => true, fire: () => (fired += 1), random: seeded(31_10_2026), ...ticker })
    const seconds = 2_000_000
    ticker.tick(seconds)
    // Esperado 400 (desvio ≈ 20): a faixa é larga, mas pega um erro de fórmula na hora.
    expect(fired).toBeGreaterThan(320)
    expect(fired).toBeLessThan(480)
  })
})
