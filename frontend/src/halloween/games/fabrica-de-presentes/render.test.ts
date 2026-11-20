import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { seededRng } from '../../engine/helpers'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { PART_BY_ID } from './content'
import { engine, type FpState } from './engine'
import Phone from './Phone'
import Tv from './Tv'

/**
 * Cada toque processado é um momento novo (a chave muda), então a partida
 * simulada desenha a TV e todos os celulares muitas vezes: rodadas curtas e
 * bots mais lentos com muita gente.
 */
const SLOW = 120_000

const noop = () => {}

/** O texto como aparece no HTML (o React escapa aspas). */
const html = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function draw(state: FpState, players: HPlayer[], viewer: number | null, at: number) {
  const { private: secrets, ...rest } = state
  const me = viewer === null ? null : (players.find((player) => player.id === viewer) ?? null)
  const props: HalloweenViewProps<FpState> = {
    code: 'TEST',
    view: me ? 'player' : 'tv',
    state: rest as FpState,
    players,
    me,
    isHost: me?.isHost ?? false,
    myInput: null,
    mine: me ? (secrets?.[String(me.id)] ?? null) : null,
    now: () => at,
    send: noop,
    sendSlot: noop,
    command: noop,
    slots: {},
    options: {},
  }
  return renderToString(createElement(me ? Phone : Tv, props))
}

describe('telas da Fábrica de Presentes em todas as fases', () => {
  it.each([
    [2, 1],
    [4, 0.6],
    [8, 0.35],
    [15, 0.2],
  ])(
    'desenha TV e celulares com %i jogadores',
    (players, actProbability) => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players, seed: players, actProbability, stepMs: 2000, options: { rounds: 2, minutes: 2, chaos: true } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['brief', 'play', 'tally', 'final']))
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )

  it(
    'desenha com gente offline e o host pulando',
    () => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players: 9, seed: 2, offlineIds: [2, 5], skipProbability: 0.05, actProbability: 0.4, stepMs: 2000, options: { rounds: 2, minutes: 2 } })
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )
})

describe('cenas', () => {
  const players = makePlayers(6)
  const start = engine.init(makeCtx({ players, now: 1_000_000, rng: seededRng(6) }))

  it('brief: a TV mostra os times e as regras; o celular mostra o time e as peças', () => {
    const tv = draw(start, players, null, start.deadline! - 3000)
    expect(tv).toContain('A fábrica abriu')
    expect(tv).toContain('Gorros Vermelhos')
    expect(tv).toContain('Meias Verdes')
    expect(tv).not.toContain('Suas peças')
    const phone = draw(start, players, 1, start.deadline! - 3000)
    expect(phone).toContain('Suas peças nesta rodada')
    for (const part of start.private['1'].parts) expect(phone).toContain(html(PART_BY_ID[part].name))
  })

  it('montagem: a TV mostra pedido, esteira e trenó; o celular só os botões das peças', () => {
    const play = engine.step(start, makeCtx({ players, now: start.deadline!, rng: seededRng(2) }))
    const tv = draw(play, players, null, play.deadline! - 60_000)
    expect(tv).toContain(html(play.teams[0].order!.to))
    expect(tv).toContain('PRÓXIMOS')
    const phone = draw(play, players, 1, play.deadline! - 60_000)
    expect(phone).toContain('quem tem?!')
    expect(phone).toContain('<button')
    expect(phone).not.toContain(html(play.teams[0].order!.to))
  })

  it('fim: o "Encerrar" no meio da rodada mostra o fim', () => {
    const play = engine.step(start, makeCtx({ players, now: start.deadline!, rng: seededRng(2) }))
    const ended: FpState = { ...play, over: true, teams: [{ ...play.teams[0], score: 30 }, play.teams[1]] }
    const tv = draw(ended, players, null, 2_000_000)
    expect(tv).toContain('Gorros Vermelhos venceram')
    expect(tv).not.toContain('PRÓXIMOS')
    const red = ended.teams[0].members[0]
    const green = ended.teams[1].members[0]
    expect(draw(ended, players, red, 2_000_000)).toContain('Seu time venceu')
    expect(draw(ended, players, green, 2_000_000)).toContain('Foi por pouco')
  })

  it('cooperativo: um time só e estrelas no fim', () => {
    const few = makePlayers(3)
    const coop = engine.init(makeCtx({ players: few, now: 1_000_000, rng: seededRng(3) }))
    expect(draw(coop, few, null, coop.deadline! - 2000)).toContain('Turma da Fábrica')
    const ended: FpState = { ...coop, over: true }
    expect(draw(ended, few, null, 2_000_000)).toContain('presentes entregues')
    expect(draw(ended, few, 2, 2_000_000)).toContain('presentes entregues')
  })

  it('estado de outro jogo encerrado: as telas do fim desenham', () => {
    const foreign = engine.step({ phase: 'intro', inputKey: 'x', deadline: 5, roster: [1, 2, 3], over: false } as unknown as FpState, makeCtx({ now: 10 }))
    const few = makePlayers(3)
    expect(() => draw(foreign, few, null, 10)).not.toThrow()
    expect(() => draw(foreign, few, 2, 10)).not.toThrow()
  })
})
