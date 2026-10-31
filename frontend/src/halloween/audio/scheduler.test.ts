import { describe, expect, it } from 'vitest'
import { LoopScheduler } from './scheduler'
import type { StepEvent } from './scheduler'

function collect(options: Partial<ConstructorParameters<typeof LoopScheduler>[0]> = {}) {
  const events: StepEvent[] = []
  const scheduler = new LoopScheduler({
    startTime: 1,
    stepDur: 0.25,
    loopSteps: 8,
    lookahead: 0.2,
    onStep: (event) => events.push(event),
    ...options,
  })
  return { scheduler, events }
}

/** Relógio andando em passinhos de 25 ms, como o timer do motor. */
function run(scheduler: LoopScheduler, from: number, to: number) {
  for (let now = from; now <= to + 1e-9; now += 0.025) scheduler.tick(now)
}

describe('LoopScheduler', () => {
  it('agenda só o que cai na janela e nunca repete um passo', () => {
    const { scheduler, events } = collect()
    scheduler.tick(0.5)
    expect(events).toHaveLength(0)
    scheduler.tick(0.9)
    expect(events.map((e) => e.step)).toEqual([0])
    // Mesmo "agora" de novo: nada novo.
    scheduler.tick(0.9)
    scheduler.tick(0.9)
    expect(events).toHaveLength(1)
    scheduler.tick(1.1)
    scheduler.tick(1.35)
    expect(events.map((e) => e.step)).toEqual([0, 1, 2])
    // Cada passo foi agendado antes da hora dele.
    for (const event of events) expect(event.time).toBeGreaterThan(0.9 - 1e-9)
  })

  it('não acumula drift: o horário é sempre início + n × passo', () => {
    const { scheduler, events } = collect({ stepDur: 0.1, loopSteps: 7 })
    let now = 0
    // Timer bagunçado, como o de um navegador ocupado.
    for (let i = 0; i < 20000; i += 1) {
      now += 0.01 + ((i * 7919) % 13) / 1000
      scheduler.tick(now)
    }
    expect(events.length).toBeGreaterThan(1000)
    events.forEach((event, index) => {
      expect(event.step).toBe(index)
      expect(event.time).toBeCloseTo(1 + index * 0.1, 9)
    })
    // Nenhum passo agendado para longe demais do relógio.
    expect(events[events.length - 1].time).toBeLessThan(now + 0.2 + 1e-9)
  })

  it('aba congelada: pula os passos perdidos em vez de tocar todos de uma vez', () => {
    const { scheduler, events } = collect()
    run(scheduler, 0, 1)
    const before = events.length
    scheduler.tick(30)
    const burst = events.slice(before)
    expect(burst.length).toBeLessThanOrEqual(2)
    for (const event of burst) expect(event.time).toBeGreaterThanOrEqual(30 - 0.08 - 1e-9)
    // E segue no compasso certo depois do salto, sem buracos.
    run(scheduler, 30.025, 33)
    const steps = events.slice(before).map((e) => e.step)
    expect(steps.length).toBeGreaterThan(10)
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBe(steps[i - 1] + 1)
  })

  it('dá a volta no laço e respeita a introdução', () => {
    const { scheduler, events } = collect({ introSteps: 3, loopSteps: 4, startTime: 0 })
    run(scheduler, 0, 3)
    const positions = events.map((e) => [e.loopStep, e.cycle])
    expect(positions.slice(0, 12)).toEqual([
      [0, -1], [1, -1], [2, -1],
      [3, 0], [4, 0], [5, 0], [6, 0],
      [3, 1], [4, 1], [5, 1], [6, 1],
      [3, 2],
    ])
  })

  it('stopFrom e stop encerram o agendamento', () => {
    const { scheduler, events } = collect({ startTime: 0 })
    scheduler.stopFrom(1)
    run(scheduler, 0, 5)
    expect(events.map((e) => e.step)).toEqual([0, 1, 2, 3])
    expect(events.every((e) => e.time < 1)).toBe(true)
    expect(scheduler.isStopped).toBe(true)
    const count = events.length
    scheduler.tick(10)
    expect(events).toHaveLength(count)
  })

  it('recusa configuração impossível', () => {
    expect(() => collect({ stepDur: 0 })).toThrow()
    expect(() => collect({ loopSteps: 0 })).toThrow()
  })
})
