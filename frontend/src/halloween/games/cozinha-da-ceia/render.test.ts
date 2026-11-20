import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { seededRng } from '../../engine/helpers'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HInput, HPlayer, HalloweenViewProps } from '../../engine/types'
import { DISHES } from './content'
import { engine, type CozinhaState, type Item, type Order } from './engine'
import Phone from './Phone'
import Tv from './Tv'

const SLOW = 90_000

function draw(state: CozinhaState, players: HPlayer[], viewer: HPlayer | null, at: number, myInput: Record<string, unknown> | null = null) {
  const props: HalloweenViewProps<CozinhaState> = {
    code: 'TEST',
    view: viewer ? 'player' : 'tv',
    state,
    players,
    me: viewer,
    isHost: viewer?.isHost ?? false,
    myInput: myInput ? ({ ...myInput, k: state.inputKey } as HInput) : null,
    mine: null,
    now: () => at,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    slots: {},
    options: {},
  }
  return renderToString(createElement(viewer ? Phone : Tv, props))
}

describe('telas da Cozinha da Ceia em todas as fases', () => {
  // Cada toque processado muda a chave (um "momento" novo): com o relógio
  // andando 2–3 s por passo a partida tem menos momentos e o teste fica leve.
  it.each([
    [2, 1, 3],
    [4, 2, 3],
    [8, 3, 1],
    [15, 4, 1],
  ])(
    'desenha TV e cada celular com %i jogadores',
    (players, seed, rounds) => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players, seed, options: { minutes: 2, rounds, chaos: true }, actProbability: 0.6, stepMs: players > 4 ? 3000 : 2000 },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['prep', 'cook', 'tally', 'final']))
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )

  it(
    'com gente offline e o host pulando',
    () => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players: 9, seed: 2, offlineIds: [2, 5], skipProbability: 0.03, actProbability: 0.5, options: { minutes: 2, rounds: 1 } })
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )
})

describe('cenas roteirizadas', () => {
  const players = makePlayers(4)
  const ctx = (now: number) => makeCtx({ players, now, rng: seededRng(3) })
  const init = engine.init(ctx(1_000_000))
  const cook = engine.step(init, ctx(init.deadline!))
  const peru = DISHES.findIndex((dish) => dish.id === 'peru')
  const lentilha = DISHES.findIndex((dish) => dish.id === 'lentilha')
  const t = cook.cookStart + 30_000

  /** Uma cozinha montada à mão: peru temperando, lentilha queimando, farofa pronta no fogo. */
  function scene(): CozinhaState {
    const orders: Order[] = [
      { id: 900, d: peru, born: cook.cookStart, exp: t + 40_000, pts: 40, vip: false, taps: 0 },
      { id: 910, d: lentilha, born: cook.cookStart, exp: t + 5000, pts: 25, vip: true, taps: 1 },
    ]
    const base = { c: 0, s: 0, taps: 0, t0: 0, end: 0, by: null, pick: false }
    const items: Item[] = [
      { ...base, id: 901, o: 900, d: peru, st: 'tigela', ph: 'prep', taps: 1 },
      { ...base, id: 911, o: 910, d: lentilha, st: 'fogao', ph: 'burnt', t0: t - 30_000, end: t - 20_000, by: 1 },
    ]
    return { ...cook, kitchens: cook.kitchens.map((kitchen, index) => (index === 0 ? { ...kitchen, orders, items } : kitchen)) }
  }

  it('TV: tickets, estações, fumaça de queimado e o placar', () => {
    const state = scene()
    const tv = draw(state, players, null, t)
    expect(tv).toContain('Peru assado')
    expect(tv).toContain('QUEIMOU')
    expect(tv).toContain('Tábua')
    expect(tv).toContain('Duendes Vermelhos')
    expect(tv).toContain('Duendes Verdes')
    expect(tv).toContain('DA VÓ')
  })

  it('celular de cada estação mostra as ações certas', () => {
    const state = scene()
    const team0 = state.teams[0].players
    const html = team0.map((id) => draw(state, players, players[id - 1], t)).join('\n')
    // Alguém do time vê a tigela, alguém vê o fogão (com o queimado para jogar fora).
    const seats = team0.flatMap((id) => state.seat[String(id)])
    expect(seats).toEqual(expect.arrayContaining(['tabua', 'tigela', 'fogao', 'forno', 'balcao']))
    expect(html).toContain('pts')
    for (const id of team0) {
      const seat = state.seat[String(id)]
      const phone = draw(state, players, players[id - 1], t)
      // A primeira aba é a que aparece aberta.
      if (seat[0] === 'tigela') expect(phone).toContain('Temperar o peru')
      if (seat[0] === 'fogao') expect(phone).toContain('Jogar fora')
    }
  })

  it('pré-rodada e fim desenham, e o "Encerrar" no meio mostra o fim', () => {
    expect(draw(init, players, null, init.deadline! - 3000)).toContain('Rodada 1 de 3')
    expect(draw(init, players, players[0], init.deadline! - 3000)).toContain('pronto')
    expect(draw(init, players, players[0], init.deadline! - 3000, { ready: true })).toContain('Esperando o time')
    const ended: CozinhaState = { ...scene(), over: true }
    expect(draw(ended, players, null, t)).toContain('Empate na cozinha')
    const won: CozinhaState = { ...ended, teams: ended.teams.map((team, index) => ({ ...team, wins: index === 0 ? 2 : 0 })) }
    expect(draw(won, players, null, t)).toContain('venceram')
    expect(draw(won, players, null, t)).not.toContain('Pedido novo')
    const champ = won.teams[0].players[0]
    expect(draw(won, players, players[champ - 1], t)).toContain('Seu time venceu a ceia')
    expect(draw(won, players, players[1], t)).toContain('Fim da ceia')
  })

  it('estado velho de outro jogo: o motor encerra e as telas do fim desenham', () => {
    const foreign = { phase: 'intro', inputKey: 'intro', deadline: 5, roster: [1, 2, 3], over: false, acted: [] }
    const ended = engine.step(foreign as unknown as CozinhaState, ctx(10))
    expect(ended.over).toBe(true)
    expect(() => draw(ended, players, null, 10)).not.toThrow()
    expect(() => draw(ended, players, players[1], 10)).not.toThrow()
  })
})
