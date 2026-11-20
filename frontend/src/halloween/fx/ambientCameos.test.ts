import { describe, expect, it } from 'vitest'
import { AMBIENT_CAMEOS } from '../../season'
import { AMBIENT_CAMEO_TIMING, ambientCameoDecision, startAmbientCameos } from './ambientCameos'
import type { AmbientCameoState } from './ambientCameos'

/** Relógio e timers de mentira: dá para "pular" minutos em milissegundos. */
function fakeClock() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: (handle: unknown) => {
      timers.delete(handle as number)
    },
    pending: () => timers.size,
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        let due: [number, { at: number; fn: () => void }] | null = null
        for (const entry of timers) {
          if (entry[1].at <= end && (!due || entry[1].at < due[1].at)) due = entry
        }
        if (!due) break
        timers.delete(due[0])
        now = due[1].at
        due[1].fn()
      }
      now = end
    },
  }
}

const IDLE: AmbientCameoState = {
  enabled: true,
  hidden: false,
  suppressed: false,
  scareShowing: false,
  cameoShowing: false,
  narrating: false,
}

function setup(state: () => AmbientCameoState, random = Math.random) {
  const clock = fakeClock()
  const fired: number[] = []
  const stop = startAmbientCameos({
    check: () => ambientCameoDecision(state()),
    fire: () => fired.push(clock.now()),
    random,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })
  return { clock, fired, stop }
}

describe('visitas de Natal automáticas: quando podem sair', () => {
  it('ligadas na temporada de Natal', () => {
    expect(AMBIENT_CAMEOS).toBe(true)
  })

  it('desligadas no controle da TV: pula o intervalo inteiro', () => {
    expect(ambientCameoDecision({ ...IDLE, enabled: false })).toBe('skip')
    // Desligada vence até o "ocupado".
    expect(ambientCameoDecision({ ...IDLE, enabled: false, suppressed: true })).toBe('skip')
  })

  it.each(['hidden', 'suppressed', 'scareShowing', 'cameoShowing', 'narrating'] as const)(
    '%s: espera (tenta de novo em segundos)',
    (key) => {
      expect(ambientCameoDecision({ ...IDLE, [key]: true })).toBe('wait')
    },
  )

  it('sala calma: sai', () => {
    expect(ambientCameoDecision(IDLE)).toBe('fire')
  })
})

describe('visitas de Natal automáticas: o relógio', () => {
  it('tempos: uma a cada 60–150 s, com 30 s de folga no começo', () => {
    expect(AMBIENT_CAMEO_TIMING.minDelayMs).toBe(60_000)
    expect(AMBIENT_CAMEO_TIMING.maxDelayMs).toBe(150_000)
    expect(AMBIENT_CAMEO_TIMING.warmupMs).toBeLessThan(AMBIENT_CAMEO_TIMING.minDelayMs)
  })

  it('na sala calma, sai entre 60 e 150 s e depois de novo no mesmo ritmo', () => {
    const { clock, fired, stop } = setup(() => IDLE, () => 0.5)
    clock.advance(59_999)
    expect(fired).toEqual([])
    clock.advance(20 * 60_000)
    expect(fired.length).toBeGreaterThan(5)
    const gaps = fired.map((at, index) => at - (index ? fired[index - 1] : 0))
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(60_000)
      expect(gap).toBeLessThanOrEqual(150_000)
    }
    stop()
    expect(clock.pending()).toBe(0)
  })

  it('revelação/narração segurando: espera e sai logo depois que libera', () => {
    let busy = true
    const { clock, fired, stop } = setup(() => ({ ...IDLE, suppressed: busy }), () => 0)
    clock.advance(10 * 60_000)
    expect(fired).toEqual([])
    busy = false
    const releasedAt = clock.now()
    clock.advance(AMBIENT_CAMEO_TIMING.retryMaxMs)
    expect(fired).toHaveLength(1)
    expect(fired[0] - releasedAt).toBeLessThanOrEqual(AMBIENT_CAMEO_TIMING.retryMaxMs)
    stop()
  })

  it('desligadas no controle: nunca sai; religar não vira visita instantânea', () => {
    let enabled = false
    const { clock, fired, stop } = setup(() => ({ ...IDLE, enabled }), () => 0)
    clock.advance(30 * 60_000)
    expect(fired).toEqual([])
    enabled = true
    clock.advance(AMBIENT_CAMEO_TIMING.retryMaxMs)
    expect(fired).toEqual([])
    clock.advance(AMBIENT_CAMEO_TIMING.maxDelayMs)
    expect(fired.length).toBeGreaterThanOrEqual(1)
    stop()
  })
})
