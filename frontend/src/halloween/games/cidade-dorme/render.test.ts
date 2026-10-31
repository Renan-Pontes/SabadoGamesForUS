import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { HalloweenViewProps } from '../../engine/types'
import { engine, freshSecret, type Role, type State } from './engine'
import Phone from './Phone'
import { REVEAL_SLOT, revealedRoles } from './screens'
import Tv from './Tv'

/** A primeira noite de uma mesa de 8 com papéis fixos: 1 e 2 assassinos, 3 detetive, 4 anjo. */
function nightOfEight(): State {
  const players = makePlayers(8)
  const roles: Record<number, Role> = { 1: 'killer', 2: 'killer', 3: 'detective', 4: 'angel' }
  const begin = engine.init(makeCtx({ players, now: 1_000_000 }))
  const dealt: State = {
    ...begin,
    private: Object.fromEntries(begin.roster.map((id) => [String(id), freshSecret(roles[id] ?? 'citizen', [1, 2])])),
  }
  // O assassino 2 já escolheu: o parceiro 1 vê ao vivo.
  const night = engine.step(dealt, makeCtx({ players, now: 1_000_000, command: { id: 1, type: 'skip' } }))
  return engine.step(night, makeCtx({ players, now: 1_001_000, inputs: { 2: { k: night.inputKey, target: 6 } } }))
}

function phoneHtml(state: State, id: number): string {
  const players = makePlayers(8)
  const { private: secrets, ...publicState } = state
  const props: HalloweenViewProps<State> = {
    code: 'TESTE',
    view: id === 1 ? 'host' : 'player',
    state: publicState as State,
    players,
    me: players[id - 1],
    isHost: id === 1,
    myInput: null,
    mine: secrets[String(id)] ?? null,
    now: () => 1_002_000,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    slots: {},
    options: {},
  }
  return renderToString(createElement(Phone, props))
}

describe('host apertou "Encerrar" no meio', () => {
  it('cada celular conta o próprio papel (só depois do fim) e a TV revela os assassinos', () => {
    const night = nightOfEight()
    // Antes do fim nenhum papel vale, mesmo que alguém grave o slot na mão.
    const early = { [REVEAL_SLOT]: { 1: { k: night.inputKey, role: 'killer' } } }
    expect(revealedRoles(night, early)).toEqual({})
    const ended: State = { ...night, over: true, deadline: null }
    const slots = {
      [REVEAL_SLOT]: {
        1: { k: night.inputKey, role: 'killer' },
        2: { k: night.inputKey, role: 'killer' },
        3: { k: night.inputKey, role: 'detective' },
        5: { k: night.inputKey, role: 'rei' }, // lixo não vale
        99: { k: night.inputKey, role: 'killer' }, // fora da partida não vale
      },
    }
    expect(revealedRoles(ended, slots)).toEqual({ 1: 'killer', 2: 'killer', 3: 'detective' })
    const players = makePlayers(8)
    const { private: secrets, ...publicState } = ended
    void secrets
    const tv = renderToString(
      createElement(Tv, {
        code: 'TESTE',
        view: 'tv',
        state: publicState as State,
        players,
        me: null,
        isHost: false,
        myInput: null,
        mine: null,
        now: () => 1_002_000,
        send: () => {},
        sendSlot: () => {},
        command: () => {},
        slots,
        options: {},
      }),
    )
    expect(tv).toContain('Os assassinos eram')
    expect(tv).toContain('Vlad')
    expect(tv).toContain('Mortícia')
  })
})

describe('a noite é igual para todo papel', () => {
  it('todo mundo tem a mesma caixinha no topo; só o assassino vê o parceiro ao vivo', () => {
    const night = nightOfEight()
    expect(night.phase).toBe('night')
    const html = Object.fromEntries([1, 3, 4, 5].map((id) => [id, phoneHtml(night, id)]))
    for (const id of [1, 3, 4, 5]) {
      expect(html[id]).toContain('Escolha alguém')
      expect(html[id]).toMatch(/🤫|🤝/)
    }
    // Assassino 1 vê "Mortícia (2) → Wandinha (6)"; ninguém mais vê parceiro nenhum.
    expect(html[1]).toContain('🤝')
    expect(html[1]).toContain('<b>Wandinha</b>')
    for (const id of [3, 4, 5]) {
      expect(html[id]).not.toContain('🤝')
      expect(html[id]).not.toContain('<b>Wandinha</b>')
    }
  })
})

const ALL_PHASES = ['roles', 'night', 'morning', 'day', 'vote', 'verdict', 'end']
/**
 * Com 15 jogadores são ~1000 desenhos (TV + 15 celulares, antes e depois de
 * responder, em cada momento): ~2 s sozinho, mais com a máquina ocupada
 * rodando os testes dos outros jogos ao mesmo tempo.
 */
const RENDER_TIMEOUT_MS = 30_000

describe('telas do Cidade Dorme em todas as fases', () => {
  it.each([5, 8, 15])(
    'desenha TV e celulares com %i jogadores',
    (players) => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players })
      expect(result.phases).toEqual(expect.arrayContaining(ALL_PHASES))
      expect(result.renders).toBeGreaterThan(0)
    },
    RENDER_TIMEOUT_MS,
  )

  it(
    'com papel escondido, gente sem responder e o host pulando',
    () => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players: 9, seed: 4, actProbability: 0.4, skipProbability: 0.15, options: { revealRole: false, dayMinutes: 2 } },
      )
      expect(result.phases).toEqual(expect.arrayContaining(['roles', 'night', 'morning', 'end']))
    },
    RENDER_TIMEOUT_MS,
  )
})
