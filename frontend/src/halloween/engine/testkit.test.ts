import { describe, expect, it } from 'vitest'
import { allOnlineActed, answerDeadline, deadlineIn, inputFor, onlineRoster, refreshActed, timeUp } from './helpers'
import { makeCtx, makePlayers, runSimulation } from './testkit'
import type { BaseState, HalloweenEngine } from './types'

/** Um motorzinho correto: N rodadas de "responda", cada uma com prazo. */
type MiniState = BaseState & { round: number; totalRounds: number; acted: number[]; answers: number; skips: number }

function miniEngine(rounds = 3): HalloweenEngine<MiniState> {
  const open = (state: MiniState, now: number, round: number): MiniState => ({
    ...state,
    phase: 'answer',
    round,
    inputKey: `r${round}`,
    deadline: answerDeadline(now, 10),
    acted: [],
  })
  return {
    init(ctx) {
      const blank: MiniState = {
        phase: 'answer',
        inputKey: '',
        deadline: null,
        roster: onlineRoster(ctx),
        over: false,
        round: 0,
        totalRounds: rounds,
        acted: [],
        answers: 0,
        skips: 0,
      }
      return open(blank, ctx.now, 1)
    },
    step(state, ctx) {
      if (state.over) return state
      if (state.phase === 'answer') {
        const skipped = ctx.command?.type === 'skip'
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster)) {
          const answers = state.roster.filter((id) => inputFor(ctx, state.inputKey, id)).length
          return {
            ...state,
            phase: 'pause',
            deadline: deadlineIn(ctx.now, 3),
            answers: state.answers + answers,
            skips: state.skips + (skipped ? 1 : 0),
          }
        }
        return refreshActed(state, ctx)
      }
      if (!timeUp(state, ctx)) return state
      if (state.round >= state.totalRounds) return { ...state, over: true, deadline: null }
      return open(state, ctx.now, state.round + 1)
    },
    bot(state) {
      return state.phase === 'answer' ? { pick: 1 } : null
    },
  }
}

describe('makePlayers e makeCtx', () => {
  it('cria jogadores com ids 1..n e o primeiro como host', () => {
    const players = makePlayers(3, { offline: [2] })
    expect(players.map((player) => player.id)).toEqual([1, 2, 3])
    expect(players[0].isHost).toBe(true)
    expect(players.filter((player) => player.isHost)).toHaveLength(1)
    expect(players[1].online).toBe(false)
    expect(new Set(makePlayers(15).map((player) => player.name)).size).toBe(15)
  })

  it('makeCtx tem padrões e aceita sobrescrever', () => {
    const ctx = makeCtx({ now: 5, options: { rounds: 3 } })
    expect(ctx.now).toBe(5)
    expect(ctx.options).toEqual({ rounds: 3 })
    expect(ctx.players).toHaveLength(4)
    expect(ctx.command).toBeNull()
    const value = ctx.rng()
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })
})

describe('runSimulation', () => {
  it('joga uma partida inteira até over', () => {
    const result = runSimulation(miniEngine(3), { players: 5, seed: 3 })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(3)
    expect(result.state.answers).toBe(15) // 5 bots × 3 rodadas, cada um uma vez
    expect(result.history[0].phase).toBe('answer')
    expect(result.steps).toBeGreaterThan(0)
  })

  it('offline nunca responde e não trava a fase', () => {
    const result = runSimulation(miniEngine(2), { players: 4, offlineIds: [2, 3] })
    expect(result.state.over).toBe(true)
    expect(result.state.answers).toBe(4) // só 1 e 4, duas rodadas
  })

  it('sem ninguém respondendo, o prazo leva a partida até o fim', () => {
    const result = runSimulation(miniEngine(2), { players: 3, actProbability: 0 })
    expect(result.state.over).toBe(true)
    expect(result.state.answers).toBe(0)
  })

  it('entrega o skip do host ao motor', () => {
    const result = runSimulation(miniEngine(4), { players: 3, actProbability: 0, skipProbability: 0.5, seed: 9 })
    expect(result.state.over).toBe(true)
    expect(result.state.skips).toBeGreaterThan(0)
  })

  it('bot com _slot grava no slot', () => {
    const engine: HalloweenEngine<MiniState> = {
      ...miniEngine(1),
      step(state, ctx) {
        if (state.over) return state
        const drew = state.roster.every((id) => ctx.slots.draw?.[id]?.k === state.inputKey)
        return drew ? { ...state, over: true, deadline: null } : state
      },
      bot: () => ({ _slot: 'draw', lines: [[0, 0, 1, 1]] }),
    }
    const result = runSimulation(engine, { players: 3, maxSteps: 5 })
    expect(result.state.over).toBe(true)
  })

  it('reclama de step que não é idempotente', () => {
    const engine: HalloweenEngine<MiniState> = {
      ...miniEngine(),
      step: (state) => ({ ...state, answers: state.answers + 1 }),
    }
    expect(() => runSimulation(engine)).toThrow(/não é idempotente/)
  })

  it('reclama de objeto novo quando nada mudou', () => {
    const engine: HalloweenEngine<MiniState> = { ...miniEngine(), step: (state) => ({ ...state }) }
    expect(() => runSimulation(engine)).toThrow(/MESMO estado/)
  })

  it('reclama de exceção, com o passo e a fase', () => {
    const engine: HalloweenEngine<MiniState> = {
      ...miniEngine(),
      step: () => {
        throw new Error('bum')
      },
    }
    expect(() => runSimulation(engine)).toThrow(/step lançou exceção: bum \(passo 1, fase "answer"\)/)
  })

  it('reclama de partida que não termina', () => {
    const engine: HalloweenEngine<MiniState> = { ...miniEngine(), step: (state) => state }
    expect(() => runSimulation(engine, { maxSteps: 50 })).toThrow(/não chegou em over em 50 passos/)
  })

  it('reclama de roster que muda e de valor que não vira JSON', () => {
    const rosterChanges: HalloweenEngine<MiniState> = {
      ...miniEngine(),
      step: (state) => (state.roster.length > 1 ? { ...state, roster: state.roster.slice(1) } : state),
    }
    expect(() => runSimulation(rosterChanges)).toThrow(/roster mudou/)

    const nan: HalloweenEngine<MiniState> = {
      ...miniEngine(),
      step: (state) => (Number.isNaN(state.answers) ? state : { ...state, answers: Number.NaN }),
    }
    expect(() => runSimulation(nan)).toThrow(/state.answers é NaN/)

    const undefinedDeadline: HalloweenEngine<MiniState> = {
      ...miniEngine(),
      init: (ctx) => ({ ...miniEngine().init(ctx), deadline: undefined as unknown as null }),
    }
    expect(() => runSimulation(undefinedDeadline)).toThrow(/deadline precisa ser número ou null/)
  })
})
