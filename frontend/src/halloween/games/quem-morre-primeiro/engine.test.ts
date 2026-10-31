import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { QUESTIONS } from './content'
import {
  REVEAL_SECONDS,
  SCORES_SECONDS,
  VOTE_SECONDS,
  engine,
  finalAwards,
  type QmpState,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n) e as opções dadas. */
function start(n = 5, options: Record<string, unknown> = { rounds: 6 }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx com os votos `{ eleitor: alvo }` da rodada atual. */
function votesCtx(state: QmpState, votes: Record<number, number>, extra: Partial<EngineCtx> = {}): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [voter, target] of Object.entries(votes)) inputs[Number(voter)] = { k: state.inputKey, vote: target }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, inputs, ...extra })
}

describe('início', () => {
  it('abre a votação da rodada 1 com prazo e folga', () => {
    const { state } = start(5)
    expect(state.phase).toBe('vote')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(6)
    expect(state.inputKey).toBe('vote-1')
    expect(state.deadline).toBe(NOW + VOTE_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(state.question.text).toBe(QUESTIONS[state.question.id].text)
    expect(state.over).toBe(false)
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('rodadas: 6/8/10, padrão 8, e perguntas sem repetir', () => {
    expect(start(4, {}).state.totalRounds).toBe(8)
    expect(start(4, { rounds: 10 }).state.totalRounds).toBe(10)
    expect(start(4, { rounds: 7 }).state.totalRounds).toBe(8)
    expect(start(4, optionDefaults(meta.options)).state.totalRounds).toBe(8)
    const { state } = start(4, { rounds: 10 })
    expect(new Set(state.deck).size).toBe(10)
  })
})

describe('votação', () => {
  it('atualiza os ✓ sem revelar e devolve o mesmo estado quando nada muda', () => {
    const { state } = start(5)
    const ctx = votesCtx(state, { 1: 2, 3: 2 })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('vote')
    expect(next.acted).toEqual([1, 3])
    expect(next.reveal).toBeNull()
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('todo mundo votou: revela na hora, enterra o mais votado e paga quem acertou', () => {
    const { state } = start(5)
    const next = engine.step(state, votesCtx(state, { 1: 2, 2: 3, 3: 2, 4: 2, 5: 5 }))
    expect(next.phase).toBe('reveal')
    expect(next.deadline).toBe(NOW + 1000 + REVEAL_SECONDS * 1000)
    expect(next.reveal?.dead).toEqual([2])
    expect(next.reveal?.tally[0]).toEqual({ id: 2, count: 3, voters: [1, 3, 4] })
    expect(next.reveal?.seers).toEqual([1, 3, 4])
    expect(next.scores).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1, 5: 0 })
    expect(next.deaths).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 })
    expect(next.history).toEqual([{ question: state.question.id, dead: [2] }])
  })

  it('empate: todos os empatados morrem e qualquer um deles vale ponto', () => {
    const { state } = start(4)
    const next = engine.step(state, votesCtx(state, { 1: 2, 2: 1, 3: 2, 4: 1 }))
    expect(next.reveal?.dead).toEqual([1, 2])
    expect(next.scores).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 })
    expect(next.deaths).toEqual({ 1: 1, 2: 1, 3: 0, 4: 0 })
  })

  it('vale votar em si mesmo', () => {
    const { state } = start(3)
    const next = engine.step(state, votesCtx(state, { 1: 1, 2: 1, 3: 1 }))
    expect(next.reveal?.dead).toEqual([1])
    expect(next.scores).toEqual({ 1: 1, 2: 1, 3: 1 })
  })

  it('ignora voto em quem não está na partida, de outra rodada e de espectador', () => {
    const { state } = start(3)
    const ctx = makeCtx({
      players: makePlayers(5),
      now: NOW + 1000,
      inputs: {
        1: { k: state.inputKey, vote: 99 }, // alvo fora da sala
        2: { k: 'vote-0', vote: 3 }, // outra rodada
        3: { k: state.inputKey, vote: '2' }, // lixo
        4: { k: state.inputKey, vote: 3 }, // espectador (entrou depois)
      },
    })
    const waiting = engine.step(state, ctx)
    expect(waiting.phase).toBe('vote')
    expect(waiting.acted).toEqual([1, 3])
    const revealed = engine.step(waiting, { ...ctx, now: state.deadline! })
    expect(revealed.reveal?.votes).toEqual({})
    expect(revealed.reveal?.dead).toEqual([])
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
  })

  it('ninguém votou: revela sem lápide e sem pontos', () => {
    const { state } = start(3)
    const next = engine.step(state, makeCtx({ players: makePlayers(3), now: state.deadline! }))
    expect(next.phase).toBe('reveal')
    expect(next.reveal).toEqual({ tally: [], dead: [], votes: {}, seers: [] })
    expect(next.deaths).toEqual({ 1: 0, 2: 0, 3: 0 })
  })

  it('offline não segura a votação', () => {
    const { state } = start(4)
    const ctx = votesCtx(state, { 1: 2, 2: 1, 3: 2 }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(state, ctx).phase).toBe('reveal')
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(4)
    const ctx = votesCtx(state, { 1: 2, 2: 1 })
    expect(engine.step(state, { ...ctx, now: state.deadline! - 1 }).phase).toBe('vote')
    expect(engine.step(state, { ...ctx, now: state.deadline! }).phase).toBe('reveal')
  })

  it('o voto mais recente vale (dá para trocar)', () => {
    const { state } = start(3)
    const first = engine.step(state, votesCtx(state, { 1: 2 }))
    const next = engine.step(first, votesCtx(state, { 1: 3, 2: 3, 3: 1 }))
    expect(next.reveal?.votes).toEqual({ 1: 3, 2: 3, 3: 1 })
    expect(next.reveal?.dead).toEqual([3])
  })
})

describe('depois da votação', () => {
  it('revelação → placar → próxima rodada, nos prazos', () => {
    const { state } = start(3)
    const revealed = engine.step(state, votesCtx(state, { 1: 2, 2: 2, 3: 2 }))
    const t1 = revealed.deadline!
    expect(engine.step(revealed, makeCtx({ players: makePlayers(3), now: t1 - 1 }))).toBe(revealed)

    const scores = engine.step(revealed, makeCtx({ players: makePlayers(3), now: t1 }))
    expect(scores.phase).toBe('scores')
    expect(scores.deadline).toBe(t1 + SCORES_SECONDS * 1000)

    const round2 = engine.step(scores, makeCtx({ players: makePlayers(3), now: scores.deadline! }))
    expect(round2.phase).toBe('vote')
    expect(round2.round).toBe(2)
    expect(round2.inputKey).toBe('vote-2')
    expect(round2.acted).toEqual([])
    expect(round2.reveal).toBeNull()
    expect(round2.question.id).not.toBe(state.question.id)
  })

  it('skip pula qualquer fase', () => {
    const { state } = start(3)
    const skip = (s: QmpState, id: number) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id, type: 'skip' } }))
    const revealed = skip(state, 1)
    expect(revealed.phase).toBe('reveal')
    const scores = skip(revealed, 2)
    expect(scores.phase).toBe('scores')
    const round2 = skip(scores, 3)
    expect(round2.round).toBe(2)
    // Comando que não é skip não faz nada.
    expect(engine.step(round2, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 4, type: 'xyz' } }))).toBe(round2)
  })

  it('a última revelação termina a partida com os prêmios', () => {
    let { state } = start(3, { rounds: 6 })
    const ctxAt = (now: number, votes: Record<number, number> = {}) => votesCtx(state, votes, { now })
    for (let round = 1; round <= 6; round += 1) {
      // O 1 sempre morre; o 3 sempre acerta; o 2 sempre erra.
      state = engine.step(state, ctxAt(NOW, { 1: 1, 2: 3, 3: 1 }))
      expect(state.phase).toBe('reveal')
      state = engine.step(state, ctxAt(state.deadline!))
      if (round < 6) {
        expect(state.phase).toBe('scores')
        state = engine.step(state, ctxAt(state.deadline!))
      }
    }
    expect(state.phase).toBe('final')
    expect(state.over).toBe(true)
    expect(state.deadline).toBeNull()
    expect(engine.step(state, ctxAt(NOW * 2))).toBe(state)

    const awards = finalAwards(state)
    expect(awards.seers).toEqual([1, 3])
    expect(awards.topScore).toBe(6)
    expect(awards.mostDead).toEqual([1])
    expect(awards.maxDeaths).toBe(6)
    expect(awards.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [1, 1],
      [3, 1],
      [2, 3],
    ])
  })

  it('prêmios vazios quando ninguém pontuou nem morreu', () => {
    const { state } = start(3)
    const awards = finalAwards({ ...state, over: true })
    expect(awards.seers).toEqual([])
    expect(awards.mostDead).toEqual([])
  })
})

describe('bot', () => {
  it('só vota na votação e só em quem está na partida', () => {
    const { state, ctx } = start(5)
    for (let i = 0; i < 30; i += 1) {
      const reply = engine.bot(state, 2, ctx)
      expect(state.roster).toContain(reply?.vote)
    }
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'reveal' }, 2, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { rounds: 8 } })
        expect(result.state.over).toBe(true)
        expect(result.state.round).toBe(8)
        expect(result.state.history).toHaveLength(8)
        const deaths = Object.values(result.state.deaths).reduce((sum, value) => sum + value, 0)
        expect(deaths).toBeGreaterThanOrEqual(8) // toda rodada alguém morre (todos votam)
      })
    }
  }

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem votar', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5, options: { rounds: 6 } })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { rounds: 10 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(10)
  })

  it('ninguém nunca vota: termina pelos prazos', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { rounds: 6 } })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
  })
})

describe('conteúdo', () => {
  it('40+ perguntas, todas diferentes, no formato certo', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(QUESTIONS.map((question) => question.text)).size).toBe(QUESTIONS.length)
    for (const question of QUESTIONS) {
      expect(question.text.startsWith('Quem ')).toBe(true)
      expect(question.text.endsWith('?')).toBe(true)
      expect(question.text.length).toBeLessThanOrEqual(80)
      expect(question.epitaph.length).toBeGreaterThan(2)
      expect(question.epitaph.length).toBeLessThanOrEqual(40)
    }
  })
})
