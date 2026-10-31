import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { BET_TIPS, FALL_LINES, FEW_CURSE_LINES, LEAD_LINES, ROLL_LINES, WEAK_CURSE_LINES, WITCHES, fillLine, witchOf } from './content'
import {
  BET_SECONDS,
  FINAL_PAYOUT_SECONDS,
  FIRST_BET_SECONDS,
  MAX_STAGES,
  PAYOUT_SECONDS,
  RACE_TIMING,
  TRACK_LENGTH,
  applyStage,
  engine,
  finalAwards,
  mostCursed,
  planStage,
  raceBeats,
  raceDuration,
  readBet,
  standings,
  type State,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 4, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx com as respostas `{ jogador: campos }` da etapa atual. */
function betsCtx(state: State, answers: Record<number, Record<string, unknown>>, extra: Partial<EngineCtx> = {}): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(answers)) inputs[Number(id)] = { ...fields, k: state.inputKey }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, inputs, ...extra })
}

/** Aposta completa (com `done`), como o celular manda no último passo. */
const bet = (stage: number, curse: number | null = null, winner?: number) =>
  winner === undefined ? { stage, curse, done: true } : { stage, curse, winner, done: true }

/** rng que devolve sempre o mesmo valor: 0 = todo dado tira 1. */
const constant = (value: number) => () => value

/** Leva a partida até a próxima fase de apostas (ou ao fim), pelos prazos. */
function advanceToNextBet(state: State, players = 4): State {
  let current = state
  for (let guard = 0; guard < 5 && !current.over; guard += 1) {
    current = engine.step(current, makeCtx({ players: makePlayers(players), now: current.deadline ?? NOW }))
    if (current.phase === 'bet') return current
  }
  return current
}

describe('início', () => {
  it('abre as apostas da 1ª etapa com 30 s e folga, bruxas na largada', () => {
    const { state } = start(4)
    expect(state.phase).toBe('bet')
    expect(state.round).toBe(1)
    expect(state.inputKey).toBe('bet-1')
    expect(state.deadline).toBe(NOW + FIRST_BET_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4])
    expect(state.positions).toEqual([0, 0, 0, 0, 0])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(state.maxStages).toBe(MAX_STAGES)
    expect(state.race).toBeNull()
    expect(state.winner).toBeNull()
    expect(state.over).toBe(false)
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('sem opções no meta (o padrão funciona)', () => {
    expect(meta.options).toEqual([])
    expect(start(3, { options: optionDefaults(meta.options) }).state.phase).toBe('bet')
  })

  it('o estado não guarda o conteúdo (só ids das bruxas)', () => {
    const { state } = start(15)
    expect(JSON.stringify(state).length).toBeLessThan(1200)
  })
})

describe('apostas', () => {
  it('✓ só para quem terminou (done); aposta pela metade não conta como feita', () => {
    const { state } = start(4)
    const ctx = betsCtx(state, { 1: bet(0, 1, 2), 2: { winner: 3 }, 3: { winner: 1, stage: 2 } })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('bet')
    expect(next.acted).toEqual([1])
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('todo mundo terminou: fecha na hora e sorteia a etapa', () => {
    const { state } = start(3)
    const next = engine.step(state, betsCtx(state, { 1: bet(0, 1, 2), 2: bet(1, 0, 2), 3: bet(2, null, 4) }))
    expect(next.phase).toBe('race')
    expect(next.acted).toEqual([1, 2, 3])
    expect(next.bets).toEqual({ 1: { stage: 0, curse: 1 }, 2: { stage: 1, curse: 0 }, 3: { stage: 2, curse: null } })
    expect(next.winnerBets).toEqual({ 1: 2, 2: 2, 3: 4 })
    expect(next.race?.steps).toHaveLength(5)
    expect(next.race?.at).toBe(NOW + 1000)
    expect(next.deadline).toBe(NOW + 1000 + next.race!.ms + RACE_TIMING.tail)
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(3)
    const ctx = betsCtx(state, { 1: bet(0), 2: bet(1) })
    expect(engine.step(state, { ...ctx, now: state.deadline! - 1 }).phase).toBe('bet')
    expect(engine.step(state, { ...ctx, now: state.deadline! }).phase).toBe('race')
  })

  it('offline não segura as apostas', () => {
    const { state } = start(4)
    const ctx = betsCtx(state, { 1: bet(0), 2: bet(1), 3: bet(2) }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(state, ctx).phase).toBe('race')
  })

  it('ninguém online: decide o prazo', () => {
    const { state } = start(3)
    const players = makePlayers(3, { offline: [1, 2, 3] })
    expect(engine.step(state, makeCtx({ players, now: NOW + 1000 }))).toBe(state)
    expect(engine.step(state, makeCtx({ players, now: state.deadline! })).phase).toBe('race')
  })

  it('no prazo, vale o que cada um escolheu, mesmo sem terminar', () => {
    const { state } = start(3)
    const ctx = betsCtx(state, { 1: { winner: 3, stage: 4 }, 2: { winner: 0 } }, { now: state.deadline! })
    const next = engine.step(state, ctx)
    expect(next.bets).toEqual({ 1: { stage: 4, curse: null } })
    expect(next.winnerBets).toEqual({ 1: 3, 2: 0 })
    expect(next.acted).toEqual([])
  })

  it('ignora bruxa inexistente, lixo, outra etapa e espectador', () => {
    const { state } = start(3)
    const ctx = makeCtx({
      players: makePlayers(5),
      now: state.deadline!,
      inputs: {
        1: { k: state.inputKey, stage: 7, curse: -1, winner: 5, done: true }, // fora da pista
        2: { k: state.inputKey, stage: '2', curse: 1.5, winner: null, done: 'sim' }, // lixo
        3: { k: 'bet-0', stage: 1, curse: 1, winner: 1, done: true }, // outra etapa
        4: { k: state.inputKey, stage: 1, curse: 1, winner: 1, done: true }, // espectador
      },
    })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('race')
    expect(next.bets).toEqual({})
    expect(next.winnerBets).toEqual({})
    expect(next.acted).toEqual([1])
    expect(next.race?.curses).toEqual([0, 0, 0, 0, 0])
  })

  it('aposta na campeã só vale na 1ª etapa', () => {
    const { state } = start(3)
    let current = engine.step(state, betsCtx(state, { 1: bet(0, null, 2), 2: bet(0, null, 3), 3: bet(0) }))
    current = advanceToNextBet(current, 3)
    expect(current.round).toBe(2)
    expect(current.inputKey).toBe('bet-2')
    const next = engine.step(current, betsCtx(current, { 1: bet(1, null, 4), 2: bet(1), 3: bet(1, null, 0) }))
    expect(next.winnerBets).toEqual({ 1: 2, 2: 3 })
  })

  it('a resposta mais recente vale (dá para mudar)', () => {
    const { state } = start(3)
    const first = engine.step(state, betsCtx(state, { 1: bet(0, 1, 1) }))
    const next = engine.step(first, betsCtx(state, { 1: bet(3, 4, 2), 2: bet(3), 3: bet(3) }))
    expect(next.bets['1']).toEqual({ stage: 3, curse: 4 })
    expect(next.winnerBets['1']).toBe(2)
  })

  it('readBet aceita só bruxas de 0 a 4 e done === true', () => {
    expect(readBet(null)).toEqual({ winner: null, stage: null, curse: null, done: false })
    expect(readBet({ k: 'x', winner: 4, stage: 0, curse: 2, done: true })).toEqual({ winner: 4, stage: 0, curse: 2, done: true })
    expect(readBet({ k: 'x', winner: 5, stage: -1, curse: NaN, done: 1 })).toEqual({ winner: null, stage: null, curse: null, done: false })
    expect(readBet({ k: 'x', stage: 'Cuca'.repeat(500) })).toEqual({ winner: null, stage: null, curse: null, done: false })
  })
})

describe('pista e empate de casa', () => {
  it('mais longe primeiro; na mesma casa, quem chegou por último fica na frente', () => {
    expect(standings([3, 5, 5, 1, 0], [10, 7, 9, 3, 1])).toEqual([2, 1, 0, 3, 4])
    expect(standings([4, 4, 4, 4, 4], [1, 5, 3, 2, 4])).toEqual([1, 4, 2, 3, 0])
  })

  it('quem cai da vassoura vai para trás de quem já está na casa', () => {
    // Bruxa 0 em 7 (chegou antes), bruxa 1 em 9 com 2 maldições: cai para 7.
    const board = { positions: [6, 8, 0, 0, 0], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const plan = { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }
    const { race, arrivals } = applyStage(board, plan, [0, 2, 0, 0, 0], 2)
    expect(race.end).toEqual([7, 7, 1, 1, 1])
    expect(race.fell).toBe(1)
    expect(race.fallTo).toBe(7)
    expect(arrivals[1]).toBeLessThan(0)
    expect(race.order.slice(0, 2)).toEqual([0, 1])
    // Entre as três na casa 1, a última a chegar (4) lidera.
    expect(race.order.slice(2)).toEqual([4, 3, 2])
  })

  it('cada bruxa anda o dado (1 a 3), na ordem sorteada', () => {
    const board = { positions: [0, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const { race, tick } = applyStage(board, { order: [3, 1, 4, 0, 2], rolls: [3, 1, 2, 2, 3] }, [0, 0, 0, 0, 0], 1)
    expect(race.steps).toEqual([
      { witch: 3, roll: 3, from: 0, to: 3 },
      { witch: 1, roll: 1, from: 0, to: 1 },
      { witch: 4, roll: 2, from: 0, to: 2 },
      { witch: 0, roll: 2, from: 0, to: 2 },
      { witch: 2, roll: 3, from: 0, to: 3 },
    ])
    expect(race.end).toEqual([2, 1, 3, 3, 2])
    // 2 e 3 na casa 3: a 2 chegou por último. 0 e 4 na casa 2: a 0 chegou por último.
    expect(race.order).toEqual([2, 3, 0, 4, 1])
    expect(race.finished).toBeNull()
    expect(tick).toBe(10)
  })

  it('dado fora de 1..3 vira o limite mais próximo', () => {
    const board = { positions: [0, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const { race } = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [9, 0, -3, 2.4, 3] }, [0, 0, 0, 0, 0], 1)
    expect(race.steps.map((step) => step.roll)).toEqual([3, 1, 1, 2, 3])
  })

  it('o sorteio usa só o rng: dado entre 1 e 3 e as cinco bruxas uma vez', () => {
    const rng = seededRng(9)
    for (let i = 0; i < 200; i += 1) {
      const plan = planStage(rng)
      expect([...plan.order].sort()).toEqual([0, 1, 2, 3, 4])
      for (const roll of plan.rolls) expect([1, 2, 3]).toContain(roll)
    }
  })
})

describe('maldição', () => {
  it('a mais amaldiçoada, com 2+ e sem empate, cai', () => {
    expect(mostCursed([0, 0, 0, 0, 0])).toBeNull()
    expect(mostCursed([1, 0, 0, 0, 0])).toBeNull()
    expect(mostCursed([2, 0, 0, 0, 0])).toBe(0)
    expect(mostCursed([2, 2, 0, 0, 0])).toBeNull()
    expect(mostCursed([1, 3, 2, 0, 3])).toBeNull()
    expect(mostCursed([1, 3, 2, 0, 1])).toBe(1)
  })

  it('volta 2 casas no fim da etapa, sem passar da largada', () => {
    const board = { positions: [1, 9, 4, 4, 4], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const plan = { order: [0, 1, 2, 3, 4], rolls: [1, 3, 1, 1, 1] }
    const fromStart = applyStage(board, plan, [3, 0, 0, 0, 0], 2)
    expect(fromStart.race.end[0]).toBe(0) // 1 + 1 = 2, cai 2: largada
    const leader = applyStage(board, plan, [0, 4, 1, 0, 0], 2)
    expect(leader.race.end[1]).toBe(10) // 9 + 3 = 12, cai 2
    expect(leader.race.fell).toBe(1)
    expect(leader.race.order[0]).toBe(1)
  })

  it('empate de maldições: ninguém cai', () => {
    const board = { positions: [0, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const { race } = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [2, 2, 2, 2, 2] }, [2, 2, 1, 0, 0], 1)
    expect(race.fell).toBeNull()
    expect(race.end).toEqual([2, 2, 2, 2, 2])
  })

  it('motor conta as maldições de quem apostou e derruba a bruxa', () => {
    const { state } = start(4)
    const next = engine.step(state, betsCtx(state, { 1: bet(0, 2, 0), 2: bet(0, 2, 0), 3: bet(1, 2, 1), 4: bet(1, 3, 1) }))
    expect(next.race?.curses).toEqual([0, 0, 3, 1, 0])
    expect(next.race?.fell).toBe(2)
    const fallFrom = next.race!.steps.find((step) => step.witch === 2)!.to
    expect(next.race?.fallTo).toBe(Math.max(0, fallFrom - 2))
    expect(next.positions[2]).toBe(next.race?.fallTo)
  })
})

describe('chegada', () => {
  it('a primeira a cruzar a casa 16 vence na hora; as outras não voam mais', () => {
    const board = { positions: [14, 15, 15, 2, 2], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const { race } = applyStage(board, { order: [3, 0, 1, 2, 4], rolls: [1, 3, 3, 3, 3] }, [0, 5, 0, 0, 0], 4)
    expect(race.steps.map((step) => step.witch)).toEqual([3, 0])
    expect(race.end).toEqual([TRACK_LENGTH, 15, 15, 3, 2])
    expect(race.finished).toBe(0)
    expect(race.midnight).toBe(false)
    // Corrida acabou antes da maldição: ninguém cai.
    expect(race.fell).toBeNull()
    expect(race.order[0]).toBe(0)
  })

  it('na etapa 12 bate a meia-noite: vence quem está na frente', () => {
    const board = { positions: [10, 11, 3, 3, 3], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const plan = { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }
    expect(applyStage(board, plan, [0, 0, 0, 0, 0], MAX_STAGES - 1).race.finished).toBeNull()
    const { race } = applyStage(board, plan, [0, 0, 0, 0, 0], MAX_STAGES)
    expect(race.midnight).toBe(true)
    expect(race.finished).toBe(1)
  })
})

describe('pagamento', () => {
  /** Partida de 4 com a 1ª etapa já fechada e sorteada com rng 0 (ordem [1,2,3,4,0], tudo 1). */
  function raced(answers: Record<number, Record<string, unknown>>) {
    const { state } = start(4)
    return engine.step(state, betsCtx(state, answers, { rng: constant(0) }))
  }

  it('líder da etapa paga 3, segunda paga 1, o resto nada', () => {
    const race = raced({ 1: bet(0), 2: bet(4), 3: bet(1), 4: bet(2) })
    // Tudo 1 na ordem [1,2,3,4,0]: todas na casa 1; a última a chegar (0) lidera, depois a 4.
    expect(race.race?.order).toEqual([0, 4, 3, 2, 1])
    const paid = engine.step(race, makeCtx({ players: makePlayers(4), now: race.deadline! }))
    expect(paid.phase).toBe('payout')
    expect(paid.deadline).toBe(race.deadline! + PAYOUT_SECONDS * 1000)
    expect(paid.payout).toMatchObject({ leader: 0, second: 4, onLeader: [1], onSecond: [2], champions: [] })
    expect(paid.payout?.gains).toEqual({ 1: 3, 2: 1 })
    expect(paid.scores).toEqual({ 1: 3, 2: 1, 3: 0, 4: 0 })
    expect(paid.history).toEqual([{ round: 1, leader: 0, second: 4, fell: null }])
    expect(paid.winner).toBeNull()
  })

  it('maldição certeira conta para o prêmio do fim (sem doce)', () => {
    const race = raced({ 1: bet(0, 3), 2: bet(0, 3), 3: bet(0, 1), 4: bet(0) })
    expect(race.race?.fell).toBe(3)
    const paid = engine.step(race, makeCtx({ players: makePlayers(4), now: race.deadline! }))
    expect(paid.payout?.cursers).toEqual([1, 2])
    expect(paid.curseHits).toEqual({ 1: 1, 2: 1, 3: 0, 4: 0 })
  })

  it('quem cruza a chegada: pagamento final com +5 para quem apostou na campeã, depois o fim', () => {
    const { state } = start(3)
    // Pista quase no fim: a bruxa 2 está na casa 15.
    const ready: State = { ...state, positions: [3, 4, 15, 5, 6], arrivals: [1, 2, 3, 4, 5], tick: 5, winnerBets: { 1: 2, 2: 0 } }
    const ctx = betsCtx(ready, { 1: bet(2), 2: bet(0), 3: bet(1) }, { rng: constant(0.99) })
    const race = engine.step({ ...ready, round: 3, inputKey: 'bet-3' }, { ...ctx, inputs: rekey(ctx.inputs, 'bet-3') })
    expect(race.race?.finished).toBe(2)
    const paid = engine.step(race, makeCtx({ players: makePlayers(3), now: race.deadline! }))
    expect(paid.winner).toBe(2)
    expect(paid.deadline).toBe(race.deadline! + FINAL_PAYOUT_SECONDS * 1000)
    expect(paid.payout?.leader).toBe(2)
    expect(paid.payout?.champions).toEqual([1])
    expect(paid.scores['1']).toBe(3 + 5)
    const end = engine.step(paid, makeCtx({ players: makePlayers(3), now: paid.deadline! }))
    expect(end.phase).toBe('final')
    expect(end.over).toBe(true)
    expect(end.deadline).toBeNull()
    expect(engine.step(end, makeCtx({ players: makePlayers(3), now: NOW * 3 }))).toBe(end)

    const awards = finalAwards(end)
    expect(awards.winner).toBe(2)
    expect(awards.leader).toBe(2)
    expect(awards.champions).toEqual([1])
    expect(awards.kings).toEqual([1])
    expect(awards.topCandy).toBe(8)
  })

  it('placar → próxima etapa com chave nova, sem as apostas da anterior', () => {
    const race = raced({ 1: bet(0), 2: bet(1), 3: bet(2), 4: bet(3) })
    const paid = engine.step(race, makeCtx({ players: makePlayers(4), now: race.deadline! }))
    expect(engine.step(paid, makeCtx({ players: makePlayers(4), now: paid.deadline! - 1 }))).toBe(paid)
    const next = engine.step(paid, makeCtx({ players: makePlayers(4), now: paid.deadline! }))
    expect(next.phase).toBe('bet')
    expect(next.round).toBe(2)
    expect(next.inputKey).toBe('bet-2')
    expect(next.deadline).toBe(paid.deadline! + BET_SECONDS * 1000 + GRACE_MS)
    expect(next.bets).toEqual({})
    expect(next.race).toBeNull()
    expect(next.payout).toBeNull()
    expect(next.acted).toEqual([])
    expect(next.positions).toEqual(race.race?.end)
  })
})

describe('host', () => {
  it('skip pula qualquer fase; comando desconhecido não faz nada', () => {
    const { state } = start(3)
    const skip = (s: State, id: number) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id, type: 'skip' } }))
    const race = skip(state, 1)
    expect(race.phase).toBe('race')
    const paid = skip(race, 2)
    expect(paid.phase).toBe('payout')
    const next = skip(paid, 3)
    expect(next.phase).toBe('bet')
    expect(next.round).toBe(2)
    expect(engine.step(next, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 4, type: 'xyz' } }))).toBe(next)
  })

  it('"Encerrar" no meio (over sem chegada): prêmios com a líder do momento', () => {
    const { state } = start(3)
    const awards = finalAwards({ ...state, over: true, positions: [2, 9, 4, 4, 1] })
    expect(awards.winner).toBeNull()
    expect(awards.leader).toBe(1)
    expect(awards.champions).toEqual([])
    expect(awards.kings).toEqual([])
    expect(awards.curseMasters).toEqual([])
  })
})

describe('linha do tempo da TV', () => {
  it('intro, um passo por voo, maldição e líder; prazo cobre a animação', () => {
    const board = { positions: [0, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const { race } = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [1, 2, 3, 1, 2] }, [3, 0, 0, 0, 0], 1)
    const beats = raceBeats(race)
    expect(beats.map((beat) => beat.kind)).toEqual(['intro', 'step', 'step', 'step', 'step', 'step', 'fall', 'lead'])
    expect(raceDuration(race)).toBe(
      RACE_TIMING.intro + 5 * RACE_TIMING.step + RACE_TIMING.fall + RACE_TIMING.lead,
    )
    const weak = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }, [1, 1, 0, 0, 0], 1).race
    expect(raceBeats(weak).map((beat) => beat.kind).slice(-2)).toEqual(['weak', 'lead'])
    const calm = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }, [0, 0, 0, 0, 0], 1).race
    expect(raceBeats(calm).map((beat) => beat.kind).slice(-2)).toEqual(['step', 'lead'])
  })

  it('chegada e meia-noite têm o próprio momento', () => {
    const near = { positions: [15, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const crossed = applyStage(near, { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }, [9, 0, 0, 0, 0], 3).race
    expect(raceBeats(crossed).map((beat) => beat.kind)).toEqual(['intro', 'step', 'finish'])
    const late = { positions: [5, 5, 5, 5, 5], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const midnight = applyStage(late, { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }, [0, 0, 0, 0, 0], MAX_STAGES).race
    expect(raceBeats(midnight).map((beat) => beat.kind).slice(-1)).toEqual(['midnight'])
  })

  it('a corrida mais longa possível cabe em ~20 s', () => {
    const longest = RACE_TIMING.intro + 5 * RACE_TIMING.step + RACE_TIMING.fall + RACE_TIMING.midnight + RACE_TIMING.tail
    expect(longest).toBeLessThanOrEqual(20_000)
  })
})

describe('bot', () => {
  it('só aposta na fase de apostas, sempre em bruxas válidas; campeã só na 1ª etapa', () => {
    const { state, ctx } = start(5)
    for (let i = 0; i < 40; i += 1) {
      const reply = readBet(engine.bot(state, 2, ctx))
      expect(reply.done).toBe(true)
      expect(reply.stage).not.toBeNull()
      expect(reply.winner).not.toBeNull()
    }
    const later = engine.bot({ ...state, round: 2, inputKey: 'bet-2' }, 2, ctx)
    expect(later).not.toHaveProperty('winner')
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'race' }, 2, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [2, 3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed })
        const { state } = result
        expect(state.over).toBe(true)
        expect(state.phase).toBe('final')
        expect(state.winner).not.toBeNull()
        expect(state.round).toBeLessThanOrEqual(MAX_STAGES)
        expect(state.history).toHaveLength(state.round)
        // A campeã terminou na chegada (ou na frente, se bateu a meia-noite).
        expect(standings(state.positions, state.arrivals)[0]).toBe(state.winner)
        // Doces só sobem; o placar tem todo mundo do roster.
        expect(Object.keys(state.scores).map(Number).sort((a, b) => a - b)).toEqual(state.roster)
        for (const value of Object.values(state.scores)) expect(value).toBeGreaterThanOrEqual(0)
      })
    }
  }

  it('nunca passa de 12 etapas, nem com a mesa amaldiçoando a líder toda vez', () => {
    let longest = 0
    let midnights = 0
    let falls = 0
    for (let seed = 1; seed <= 300; seed += 1) {
      const { state } = runSimulation(engine, { players: 15, seed })
      longest = Math.max(longest, state.round)
      if (state.race?.midnight) midnights += 1
      falls += state.history.filter((entry) => entry.fell !== null).length
    }
    expect(longest).toBeLessThanOrEqual(MAX_STAGES)
    // A meia-noite é a rede de segurança, não o jeito normal de acabar.
    expect(midnights).toBeLessThan(15)
    expect(falls).toBeGreaterThan(300)
  })

  it('com dado sempre 1, a meia-noite encerra na etapa 12', () => {
    let { state } = start(3, { rng: constant(0) })
    for (let guard = 0; guard < 100 && !state.over; guard += 1) {
      state = engine.step(state, makeCtx({ players: makePlayers(3), now: state.deadline ?? NOW, rng: constant(0) }))
    }
    expect(state.over).toBe(true)
    expect(state.round).toBe(MAX_STAGES)
    expect(state.race?.midnight).toBe(true)
    expect(state.winner).toBe(state.race?.order[0])
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem apostar', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5 })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    for (const seed of [8, 9, 10]) {
      const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed })
      expect(result.state.over).toBe(true)
      expect(result.state.round).toBeLessThanOrEqual(MAX_STAGES)
    }
  })

  it('ninguém nunca aposta: termina pelos prazos, sem doce para ninguém', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0 })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
    expect(result.state.history.every((entry) => entry.fell === null)).toBe(true)
  })

  it('o mínimo de jogadores (2) com um deles offline', () => {
    const result = runSimulation(engine, { players: 3, offlineIds: [3], seed: 11 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 2])
  })
})

describe('conteúdo', () => {
  it('cinco bruxas com nome, bicho e cor próprios', () => {
    expect(WITCHES).toHaveLength(5)
    expect(WITCHES.map((witch) => witch.id)).toEqual([0, 1, 2, 3, 4])
    expect(WITCHES.map((witch) => witch.name)).toContain('Cuca')
    for (const key of ['name', 'emoji', 'color'] as const) {
      expect(new Set(WITCHES.map((witch) => witch[key])).size).toBe(5)
    }
    for (const witch of WITCHES) {
      expect(witch.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(witch.light).toMatch(/^#[0-9a-f]{6}$/i)
      expect(witch.name.length).toBeLessThanOrEqual(10)
      expect(witch.title.length).toBeLessThanOrEqual(30)
    }
    expect(witchOf(99)).toBe(WITCHES[0])
    expect(witchOf(3)).toBe(WITCHES[3])
  })

  it('falas do narrador com a bruxa no lugar certo', () => {
    for (const lines of [ROLL_LINES[1], ROLL_LINES[2], ROLL_LINES[3], FALL_LINES, LEAD_LINES]) {
      expect(lines.length).toBeGreaterThanOrEqual(4)
      for (const line of lines) {
        expect(line).toContain('{b}')
        expect(line.length).toBeLessThanOrEqual(60)
      }
    }
    for (const line of [...WEAK_CURSE_LINES, ...FEW_CURSE_LINES, ...BET_TIPS]) expect(line).not.toContain('{b}')
    for (const line of [...WEAK_CURSE_LINES, ...FEW_CURSE_LINES]) expect(line.length).toBeLessThanOrEqual(60)
    for (const line of FALL_LINES) expect(line).toContain('{n}')
    expect(fillLine('{b} tirou {n}!', 'Cuca', 3)).toBe('Cuca tirou 3!')
  })
})

/** Troca a chave das respostas (para montar uma etapa no meio da partida). */
function rekey(inputs: EngineCtx['inputs'], key: string): EngineCtx['inputs'] {
  return Object.fromEntries(
    Object.entries(inputs).map(([id, input]) => [id, input ? { ...input, k: key } : input]),
  ) as EngineCtx['inputs']
}
