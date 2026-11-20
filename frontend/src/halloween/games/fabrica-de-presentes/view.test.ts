import { beforeEach, describe, expect, it } from 'vitest'
import { seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers } from '../../engine/testkit'
import { MAX_QUEUE, engine, type FpState } from './engine'
import { clockText, narrationFor, queueTap, recentTaps, resetTapStores, stepStatuses } from './view'

describe('fila de toques do celular', () => {
  beforeEach(() => resetTapStores())

  it('numera em sequência e só reenvia o que o juiz ainda não viu', () => {
    expect(queueTap('k', 0, 'a', 1).map((tap) => tap.n)).toEqual([1])
    expect(queueTap('k', 0, 'b', 2).map((tap) => tap.n)).toEqual([1, 2])
    expect(queueTap('k', 2, 'c', 3).map((tap) => tap.n)).toEqual([3])
    // O juiz viu mais do que eu lembrava (recarreguei a página): continua depois dele.
    expect(queueTap('outra', 7, 'a', 4).map((tap) => tap.n)).toEqual([8])
    expect(recentTaps('k', 2).map((tap) => tap.p)).toEqual(['c', 'b'])
  })

  it('fila limitada (o juiz lê no máximo MAX_QUEUE)', () => {
    let queue = queueTap('k', 0, 'a', 0)
    for (let i = 1; i < MAX_QUEUE + 5; i += 1) queue = queueTap('k', 0, 'a', i)
    expect(queue).toHaveLength(MAX_QUEUE)
    expect(queue.at(-1)?.n).toBe(MAX_QUEUE + 5)
  })
})

describe('textos', () => {
  const players = makePlayers(6)
  const state = engine.init(makeCtx({ players, now: 1_000_000, rng: seededRng(1) }))

  it('narração curta: abertura, imprevisto e vencedor com o artigo certo', () => {
    expect(narrationFor(state)).toContain('Fábrica aberta')
    expect(narrationFor({ ...state, round: 2, chaos: 'sem-laco' })).toBe('Acabou a fita! Nada de laço.')
    expect(narrationFor({ ...state, phase: 'play' })).toBe('')
    const over = (r: number, g: number): FpState => ({ ...state, over: true, teams: [{ ...state.teams[0], score: r }, { ...state.teams[1], score: g }] })
    expect(narrationFor(over(10, 5))).toBe('Vitória dos Gorros Vermelhos!')
    expect(narrationFor(over(5, 10))).toBe('Vitória das Meias Verdes!')
    expect(narrationFor(over(5, 5))).toBe('Empate na fábrica!')
  })

  it('relógio e etapas', () => {
    expect(clockText(125_000)).toBe('2:05')
    expect(clockText(0)).toBe('0:00')
    const team = { order: { n: 0, to: '', emoji: '', parts: ['a', 'b', 'c', 'd'], vip: false }, placed: 1, held: [{ p: 'd', by: 1, until: 0 }] }
    expect(stepStatuses(team)).toEqual(['done', 'next', 'todo', 'held'])
  })
})
