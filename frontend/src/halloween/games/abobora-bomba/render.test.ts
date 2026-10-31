import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HalloweenViewProps } from '../../engine/types'
import { engine, type AbbState } from './engine'
import Phone from './Phone'
import Tv from './Tv'

/**
 * Cada posse da abóbora é um momento novo (a chave muda a cada passe), então
 * uma partida simulada tem muitos momentos para desenhar — TV e todos os
 * celulares em cada um. Os bots aqui passam devagar (actProbability baixa)
 * e com 1 vida, para as rodadas explodirem logo; o limite de tempo é
 * folgado porque a máquina pode estar ocupada com outros testes.
 */
const SLOW = 60_000

describe('telas da Abóbora-Bomba em todas as fases', () => {
  it.each([
    [2, 0.35],
    [8, 0.3],
    [15, 0.15],
  ])(
    'desenha TV e celulares com %i jogadores',
    (players, actProbability) => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players, seed: players, actProbability, options: { lives: 1, fuse: 10 } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['theme', 'play', 'boom', 'final']))
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )

  it(
    'modo digitar, com o host pulando',
    () => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players: 5, seed: 4, actProbability: 0.5, skipProbability: 0.08, options: { mode: 'digitar', lives: 1, fuse: 10 } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['theme', 'play', 'boom', 'final']))
    },
    SLOW,
  )

  it('abóbora com quem está offline: a TV pede para a mesa chamar a pessoa', () => {
    const players = makePlayers(4)
    const ctx = makeCtx({ players, now: 10_000 })
    const theme = engine.init(ctx)
    const live = engine.step({ ...theme, holder: 2 }, { ...ctx, now: theme.deadline! })
    expect(live.phase).toBe('play')
    const gone = makePlayers(4, { offline: [2] })
    const props = (list: typeof players) =>
      ({
        code: 'TEST',
        view: 'tv',
        state: live,
        players: list,
        me: null,
        isHost: false,
        now: () => live.arrivedAt + 500,
        send: () => {},
        sendSlot: () => {},
        command: () => {},
        options: {},
        myInput: null,
        mine: null,
        slots: {},
      }) as HalloweenViewProps<AbbState>
    expect(renderToString(createElement(Tv, props(gone)))).toContain('chamem')
    expect(renderToString(createElement(Tv, props(players)))).not.toContain('chamem')
  })

  it('partida velha de outro formato: o motor encerra e as telas do fim desenham', () => {
    const players = makePlayers(3)
    const foreign = { phase: 'intro', inputKey: 'intro', deadline: 5, roster: [1, 2, 3], over: false, acted: [] }
    const ended = engine.step(foreign as unknown as AbbState, makeCtx({ players, now: 10 }))
    expect(ended.over).toBe(true)
    const base = {
      code: 'TEST',
      state: ended,
      players,
      now: () => 10,
      send: () => {},
      sendSlot: () => {},
      command: () => {},
      options: {},
      myInput: null,
      mine: null,
      slots: {},
    }
    const tv = { ...base, view: 'tv', me: null, isHost: false } as HalloweenViewProps<AbbState>
    const phone = { ...base, view: 'player', me: players[1], isHost: false } as HalloweenViewProps<AbbState>
    expect(renderToString(createElement(Tv, tv))).toContain('Ninguém sobrou')
    expect(renderToString(createElement(Phone, phone))).toContain('Fim de jogo')
  })
})
