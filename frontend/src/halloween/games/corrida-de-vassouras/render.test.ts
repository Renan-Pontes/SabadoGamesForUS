import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HInput, HalloweenViewProps } from '../../engine/types'
import { applyStage, engine, raceBeats, type CvRace, type State } from './engine'
import Phone from './Phone'
import Tv from './Tv'

describe('telas da Corrida de Vassouras em todas as fases', () => {
  it.each([2, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players })
    expect(result.phases).toEqual(expect.arrayContaining(['bet', 'race', 'payout', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })

  it('com gente offline e o host pulando', () => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players: 9, seed: 4, offlineIds: [3, 7], skipProbability: 0.2, actProbability: 0.5 })
    expect(result.phases).toEqual(expect.arrayContaining(['bet', 'final']))
  })
})

const players = makePlayers(4)
const NOW = 1_000_000

function view(state: State, extra: Partial<HalloweenViewProps<State>> = {}): HalloweenViewProps<State> {
  return {
    code: 'TEST',
    view: 'player',
    state,
    players,
    me: players[1],
    isHost: false,
    myInput: null,
    mine: null,
    now: () => NOW,
    send: () => undefined,
    sendSlot: () => undefined,
    command: () => undefined,
    slots: {},
    options: {},
    ...extra,
  }
}

const tvHtml = (state: State, at: number) => renderToString(createElement(Tv, view(state, { view: 'tv', me: null, now: () => at })))
const phoneHtml = (state: State, myInput: HInput | null = null) => renderToString(createElement(Phone, view(state, { myInput })))

describe('celular: o passo a passo das apostas', () => {
  const state = engine.init(makeCtx({ players, now: NOW }))
  const k = state.inputKey

  it('1ª etapa: campeã → na frente → maldição → feito', () => {
    expect(phoneHtml(state)).toContain('Quem vence a CORRIDA?')
    expect(phoneHtml(state, { k, winner: 2 })).toContain('NA FRENTE')
    const curse = phoneHtml(state, { k, winner: 2, stage: 0 })
    expect(curse).toContain('Jogue uma maldição')
    expect(curse).toContain('Sem maldição')
    expect(curse).toContain('é a sua aposta')
    const done = phoneHtml(state, { k, winner: 2, stage: 0, curse: null, done: true })
    expect(done).toContain('Apostas feitas!')
    expect(done).toContain('Esperando os outros (1/4)')
  })

  it('das etapas seguintes em diante: só na frente → maldição', () => {
    const later: State = { ...state, round: 2, inputKey: 'bet-2', positions: [3, 5, 2, 4, 1] }
    const html = phoneHtml(later)
    expect(html).toContain('PASSO 1 DE 2')
    expect(html).toContain('casa 5')
    expect(phoneHtml(later, { k: 'bet-2', stage: 1 })).toContain('Jogue uma maldição')
  })

  it('lixo na resposta não quebra a tela', () => {
    expect(phoneHtml(state, { k, winner: 'Cuca', stage: 99, curse: {}, done: 'sim' })).toContain('Quem vence a CORRIDA?')
  })
})

describe('TV: cada momento da corrida', () => {
  /** Uma etapa com maldição (cai a bruxa 1) e uma que termina na chegada. */
  function racing(finishing: boolean): State {
    const base = engine.init(makeCtx({ players, now: NOW }))
    const board = finishing
      ? { positions: [15, 9, 8, 7, 6], arrivals: [1, 2, 3, 4, 5], tick: 5 }
      : { positions: [4, 6, 2, 3, 1], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const plan = { order: [1, 2, 0, 3, 4], rolls: [2, 1, 3, 2, 1] }
    const outcome = applyStage(board, plan, [0, 3, 1, 0, 0], 4)
    const race: CvRace = { ...outcome.race, at: NOW, ms: 0 }
    race.ms = raceBeats(race).reduce((end, beat) => Math.max(end, beat.at + beat.ms), 0)
    return {
      ...base,
      phase: 'race',
      round: 4,
      positions: race.end,
      arrivals: outcome.arrivals,
      tick: outcome.tick,
      bets: { 1: { stage: 1, curse: 2 }, 2: { stage: 0, curse: 1 } },
      winnerBets: { 1: 0 },
      race,
      deadline: NOW + race.ms + 600,
    }
  }

  it('desenha todos os momentos, do dado girando à chegada', () => {
    for (const finishing of [false, true]) {
      const state = racing(finishing)
      const beats = raceBeats(state.race!)
      expect(beats.map((beat) => beat.kind)).toContain(finishing ? 'finish' : 'fall')
      for (const beat of beats) {
        for (const offset of [0, 400, 900, beat.ms - 1]) {
          const html = tvHtml(state, NOW + beat.at + offset)
          expect(html).toContain('CORRIDA')
        }
      }
      // Depois do fim da animação (TV atrasada) e antes de começar (relógio adiantado).
      expect(tvHtml(state, NOW + state.race!.ms + 5000)).toContain('Cuca')
      expect(tvHtml(state, NOW - 5000)).toContain('valendo')
    }
  })

  it('o narrador conta a queda e a chegada', () => {
    const fall = racing(false)
    const fallBeat = raceBeats(fall.race!).find((beat) => beat.kind === 'fall')!
    expect(tvHtml(fall, NOW + fallBeat.at + 2500)).toContain('Matinta levou 3 maldições e CAIU DA VASSOURA!')
    const finish = racing(true)
    const finishBeat = raceBeats(finish.race!).find((beat) => beat.kind === 'finish')!
    expect(tvHtml(finish, NOW + finishBeat.at + 100)).toContain('CRUZOU A CHEGADA')
  })
})

describe('fim', () => {
  it('host encerrou no meio: sem campeã, com a líder do momento', () => {
    const state = engine.init(makeCtx({ players, now: NOW }))
    const ended: State = { ...state, over: true, positions: [2, 7, 4, 4, 1] }
    expect(tvHtml(ended, NOW)).toContain('Corrida encerrada')
    expect(phoneHtml(ended)).toContain('estava na frente')
  })

  it('meia-noite: a líder vence e a TV conta', () => {
    const state = engine.init(makeCtx({ players, now: NOW }))
    const board = { positions: [9, 10, 4, 4, 4], arrivals: [1, 2, 3, 4, 5], tick: 5 }
    const outcome = applyStage(board, { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }, [0, 0, 0, 0, 0], 12)
    const race: CvRace = { ...outcome.race, at: NOW, ms: 1000 }
    const ended: State = { ...state, over: true, phase: 'final', round: 12, race, winner: race.finished, positions: race.end }
    expect(tvHtml(ended, NOW)).toContain('meia-noite')
    expect(phoneHtml(ended)).toContain('venceu!')
  })
})
