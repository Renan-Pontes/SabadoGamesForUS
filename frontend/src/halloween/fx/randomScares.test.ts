import { describe, expect, it } from 'vitest'
import { RANDOM_SCARE_DEFAULTS, startRandomScares } from './randomScares'
import type { RandomScareDecision } from './randomScares'

/** Relógio e timers de mentira: dá para "pular" horas em milissegundos. */
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

const MIN = 60_000

function setup(decide: () => RandomScareDecision, random = Math.random) {
  const clock = fakeClock()
  const fired: number[] = []
  const stop = startRandomScares({
    check: decide,
    fire: () => fired.push(clock.now()),
    random,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })
  return { clock, fired, stop }
}

describe('sustos aleatórios', () => {
  it('nada nos primeiros minutos; depois um susto a cada 4–9 min', () => {
    const { clock, fired } = setup(() => 'fire')
    clock.advance(2 * MIN)
    expect(fired).toHaveLength(0)
    clock.advance(4 * 60 * MIN)
    expect(fired.length).toBeGreaterThanOrEqual(Math.floor((4 * 60) / 9))
    expect(fired.length).toBeLessThanOrEqual(Math.ceil((4 * 60) / 4) + 1)
    expect(fired[0]).toBeGreaterThanOrEqual(RANDOM_SCARE_DEFAULTS.minDelayMs)
    expect(fired[0]).toBeLessThanOrEqual(RANDOM_SCARE_DEFAULTS.maxDelayMs)
    for (let i = 1; i < fired.length; i += 1) {
      const gap = fired[i] - fired[i - 1]
      expect(gap).toBeGreaterThanOrEqual(4 * MIN)
      expect(gap).toBeLessThanOrEqual(9 * MIN)
    }
  })

  it('nunca dispara antes de 2 minutos, mesmo com intervalo curto', () => {
    const clock = fakeClock()
    const fired: number[] = []
    startRandomScares({
      check: () => 'fire',
      fire: () => fired.push(clock.now()),
      minDelayMs: 1000,
      maxDelayMs: 2000,
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    })
    clock.advance(10 * MIN)
    expect(fired.length).toBeGreaterThan(0)
    expect(fired[0]).toBeGreaterThanOrEqual(2 * MIN)
  })

  it('desligado: não assusta; religado: espera um intervalo inteiro', () => {
    let enabled = false
    const { clock, fired } = setup(() => (enabled ? 'fire' : 'skip'), () => 0.5)
    clock.advance(60 * MIN)
    expect(fired).toHaveLength(0)
    enabled = true
    const turnedOnAt = clock.now()
    clock.advance(30 * MIN)
    expect(fired.length).toBeGreaterThan(0)
    // O próximo susto vem de um agendamento "inteiro" (6,5 min com random 0,5), não na hora.
    expect(fired[0] - turnedOnAt).toBeGreaterThan(0)
    expect(fired[0] - turnedOnAt).toBeLessThanOrEqual(9 * MIN)
  })

  it('ocupado (revelação/aba escondida): tenta de novo em 15–30 s e dispara logo depois', () => {
    let busyUntil = 0
    const { clock, fired } = setup(() => (clock.now() < busyUntil ? 'wait' : 'fire'), () => 0)
    // Primeiro horário: 4 min (random 0). Fica ocupado até 5 min.
    busyUntil = 5 * MIN
    clock.advance(4 * MIN + 1)
    expect(fired).toHaveLength(0)
    clock.advance(MIN)
    expect(fired).toHaveLength(1)
    expect(fired[0]).toBeGreaterThanOrEqual(5 * MIN)
    expect(fired[0]).toBeLessThanOrEqual(5 * MIN + 30_000)
  })

  it('stop() cancela tudo', () => {
    const { clock, fired, stop } = setup(() => 'fire')
    stop()
    clock.advance(60 * MIN)
    expect(fired).toHaveLength(0)
    expect(clock.pending()).toBe(0)
  })

  it('um susto que quebra não derruba o agendador', () => {
    const clock = fakeClock()
    let calls = 0
    startRandomScares({
      check: () => 'fire',
      fire: () => {
        calls += 1
        if (calls === 1) throw new Error('quebrou')
      },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    })
    expect(() => clock.advance(10 * MIN)).toThrow('quebrou')
    clock.advance(60 * MIN)
    expect(calls).toBeGreaterThan(1)
  })
})
