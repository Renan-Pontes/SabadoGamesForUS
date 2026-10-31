import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HInput, HalloweenViewProps } from '../../engine/types'
import { engine, roundSetup, type State } from './engine'
import Phone from './Phone'
import { revealSchedule } from './timeline'
import Tv from './Tv'

describe('telas do Portas do Além em todas as fases', () => {
  it.each([2, 3, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players })
    expect(result.phases).toEqual(expect.arrayContaining(['choose', 'reveal', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })

  it('15 jogadores com gente offline e o host pulando', () => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players: 15, seed: 4, offlineIds: [2, 9], skipProbability: 0.2 })
    expect(result.phases).toEqual(expect.arrayContaining(['choose', 'reveal', 'final']))
  })

  it('passa pelo placar entre rodadas', () => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players: 8, seed: 3 })
    expect(result.phases).toContain('status')
  })
})

/** Desenha TV e todos os celulares de um estado (o `private` sai, como no framework). */
function renderAll(full: State, at: number, inputs: Record<number, HInput> = {}) {
  const players = makePlayers(Math.max(...full.roster))
  const { private: secrets, ...state } = full
  const base = {
    code: 'TEST',
    state: state as State,
    players,
    now: () => at,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    options: {},
    slots: {},
  }
  const html = [renderToString(createElement(Tv, { ...base, view: 'tv', me: null, isHost: false, myInput: null, mine: null }))]
  for (const player of players) {
    const props: HalloweenViewProps<State> = {
      ...base,
      view: player.isHost ? 'host' : 'player',
      me: player,
      isHost: player.isHost,
      myInput: inputs[player.id] ?? null,
      mine: (secrets?.[String(player.id)] ?? null) as HalloweenViewProps<State>['mine'],
    }
    html.push(renderToString(createElement(Phone, props)))
  }
  return html
}

/** Rodada 2 com fantasmas, pronta para a revelação. */
function roundWithGhosts(n: number, ghosts: number[]): State {
  const state = engine.init(makeCtx({ players: makePlayers(n), now: 1_000_000 }))
  const alive = state.roster.filter((id) => !ghosts.includes(id))
  const setup = roundSetup(alive.length, 2)
  return {
    ...state,
    round: 2,
    inputKey: 'door-2',
    alive,
    diedIn: Object.fromEntries(ghosts.map((id) => [String(id), 1])),
    doors: setup.doors,
    monsters: setup.monsters,
    extraMonsters: setup.extra,
  }
}

describe('revelação em cada instante', () => {
  it('antes das portas, no monstro e no resultado; TV e celulares desenham', () => {
    const state = roundWithGhosts(6, [5, 6])
    const inputs: Record<number, HInput> = {
      1: { k: 'door-2', door: 1 },
      2: { k: 'door-2', door: 2 },
      3: { k: 'door-2', door: 2 },
      4: { k: 'door-2', door: 3 },
      5: { k: 'door-2', door: 2 },
      6: { k: 'door-2', door: 2 },
    }
    // Falta o 4 escolher; os fantasmas veem no celular o placar secreto.
    const waiting = { ...inputs }
    delete waiting[4]
    const choosing = engine.step(state, makeCtx({ players: makePlayers(6), now: 1_001_000, inputs: waiting }))
    expect(choosing.phase).toBe('choose')
    expect(renderAll(choosing, 1_001_000, waiting).join('')).toContain('👻 2')

    const revealed = engine.step(choosing, makeCtx({ players: makePlayers(6), now: choosing.deadline!, inputs }))
    expect(revealed.phase).toBe('reveal')
    const reveal = revealed.reveal!
    expect(reveal.victims).toEqual([2, 3])
    const schedule = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
    for (const offset of [0, schedule.openAt[0] + 10, schedule.monsterAt + 10, schedule.resultAt + 10, schedule.total - 10]) {
      const html = renderAll(revealed, reveal.startedAt + offset).join('')
      expect(html.length).toBeGreaterThan(100)
      if (offset > schedule.resultAt) expect(html).toContain('virou fantasma')
      if (offset === 0) expect(html).toContain('Olhe a TV')
    }
  })

  it('porta lotada na TV: 3 nomes e "+N", e sem a fileira de votos de fantasma na 1ª rodada', () => {
    // 10 pessoas, rodada 1 (sem fantasmas): 6 atrás da porta 1.
    const start = engine.init(makeCtx({ players: makePlayers(10), now: 1_000_000 }))
    const inputs: Record<number, HInput> = {}
    for (let id = 1; id <= 10; id += 1) inputs[id] = { k: start.inputKey, door: id <= 6 ? 1 : id - 5 }
    const revealed = engine.step(start, makeCtx({ players: makePlayers(10), now: 1_001_000, inputs }))
    const reveal = revealed.reveal!
    expect(reveal.picks).toMatchObject({ 1: 1, 6: 1, 7: 2 })
    const schedule = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
    // Todas as portas abertas, resultado ainda não (a legenda não lista ninguém).
    const [tv] = renderAll(revealed, reveal.startedAt + schedule.resultAt - 50)
    const crowd = ['Vlad', 'Mortícia', 'Gasparzinho', 'Cuca', 'Saci', 'Wandinha']
    expect(crowd.filter((name) => tv.includes(name))).toHaveLength(3)
    expect(tv).toMatch(/\+(<!-- -->)?3</)
    // Ninguém votou (não há fantasmas): nada de "👻 0" embaixo das portas.
    expect(tv).not.toMatch(/👻 (<!-- -->)?0/)
  })

  it('salvação e fim por teto desenham', () => {
    const state = roundWithGhosts(5, [5])
    const inputs: Record<number, HInput> = {
      1: { k: 'door-2', door: 1 },
      2: { k: 'door-2', door: 1 },
      3: { k: 'door-2', door: 1 },
      4: { k: 'door-2', door: 1 },
      5: { k: 'door-2', door: 1 },
    }
    const revealed = engine.step(state, makeCtx({ players: makePlayers(5), now: 1_001_000, inputs }))
    expect(revealed.reveal?.saved).toBe(true)
    const schedule = revealSchedule(revealed.reveal!.order.length, 1, false)
    const html = renderAll(revealed, revealed.reveal!.startedAt + schedule.resultAt + 10).join('')
    expect(html).toContain('tropeçou')

    const capped: State = { ...revealed, phase: 'final', over: true, deadline: null, round: revealed.totalRounds }
    expect(renderAll(capped, 2_000_000).join('')).toContain('Empate dos últimos')
  })
})
