import { describe, expect, it } from 'vitest'
import { createServerClock } from './clock'

describe('relógio do servidor', () => {
  it('a primeira amostra acerta a diferença na hora', () => {
    let local = 10_000
    const clock = createServerClock(() => local)
    expect(clock.ready()).toBe(false)
    // Pedido saiu em 10_000, voltou em 10_200; o servidor carimbou 50_100.
    clock.sample(50_100, 10_000, 10_200)
    expect(clock.ready()).toBe(true)
    local = 10_200
    expect(clock.now()).toBe(50_200)
  })

  it('suaviza amostras próximas (não pula para trás e para a frente)', () => {
    const local = 0
    const clock = createServerClock(() => local)
    clock.sample(1_000, 0, 0) // diferença 1000
    clock.sample(1_400, 0, 0) // amostra 400 ms adiante
    const offset = clock.offset()
    expect(offset).toBeGreaterThan(1_000)
    expect(offset).toBeLessThan(1_400)
  })

  it('viagem lenta quase não mexe', () => {
    const clock = createServerClock(() => 0)
    clock.sample(1_000, 0, 0)
    clock.sample(3_000, 0, 2_000) // rtt 2 s: estimativa 2000 - 2000 + 1000... pesa pouco
    expect(Math.abs(clock.offset() - 1_000)).toBeLessThan(200)
  })

  it('diferença enorme é relógio que mudou: pula direto', () => {
    const clock = createServerClock(() => 0)
    clock.sample(1_000, 0, 0)
    clock.sample(60_000, 0, 0)
    expect(clock.offset()).toBe(60_000)
  })

  it('ignora lixo', () => {
    const clock = createServerClock(() => 0)
    clock.sample(Number.NaN, 0, 0)
    expect(clock.ready()).toBe(false)
  })
})
