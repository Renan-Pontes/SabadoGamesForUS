import { describe, expect, it } from 'vitest'
import type { SyncPlayer } from '../net/sync'
import {
  collectInputs,
  isFresh,
  pendingCommand,
  readRoomState,
  stableStringify,
  toHPlayers,
} from './roomState'

function player(id: number, extra: Partial<SyncPlayer> = {}): SyncPlayer {
  return {
    id,
    name: `P${id}`,
    is_host: false,
    ready: true,
    online: true,
    joined_at: `2026-10-31T20:00:0${id}Z`,
    state: {},
    ...extra,
  }
}

describe('readRoomState', () => {
  it('lixo vira configuração vazia', () => {
    expect(readRoomState(null)).toMatchObject({ g: null, setup: null, _cmd: 0, _auth: null, _m: null, _err: null })
    expect(readRoomState({ g: { phase: 1 }, _cmd: 'x', _auth: { d: 3 } })).toMatchObject({ g: null, _cmd: 0, _auth: null })
  })

  it('lê um estado de verdade e preserva campos extras', () => {
    const g = { phase: 'vote', inputKey: 'k', deadline: null, roster: [1], over: false }
    const state = readRoomState({ g, setup: { rounds: 6 }, _cmd: 4, _auth: { d: 'tv-1', u: 9 }, _m: 'm1', extra: true })
    expect(state.g).toEqual(g)
    expect(state.setup).toEqual({ rounds: 6 })
    expect(state._cmd).toBe(4)
    expect(state._auth).toEqual({ d: 'tv-1', u: 9 })
    expect(state._m).toBe('m1')
    expect((state as Record<string, unknown>).extra).toBe(true)
  })
})

describe('toHPlayers', () => {
  it('ordena pela entrada e converte os campos', () => {
    const players = toHPlayers([
      player(3, { joined_at: '2026-10-31T20:00:09Z', is_host: true }),
      player(1, { online: false }),
      player(2, { name: '' }),
    ])
    expect(players.map((p) => p.id)).toEqual([1, 2, 3])
    expect(players[0]).toEqual({ id: 1, name: 'P1', isHost: false, online: false })
    expect(players[1].name).toBe('Jogador 2')
    expect(players[2].isHost).toBe(true)
  })
})

describe('respostas e comandos', () => {
  const roomState = readRoomState({ _m: 'atual', _cmd: 2 })

  it('isFresh: sem marca vale; marca de outra partida não', () => {
    expect(isFresh({}, roomState)).toBe(true)
    expect(isFresh({ m: 'atual' }, roomState)).toBe(true)
    expect(isFresh({ m: 'velha' }, roomState)).toBe(false)
    expect(isFresh(null, roomState)).toBe(true)
  })

  it('collectInputs junta hw e slots, ignorando partida velha e lixo', () => {
    const { inputs, slots } = collectInputs(
      [
        player(1, { state: { m: 'atual', hw: { k: 'v1', vote: 2 }, hws: { draw: { k: 'd', lines: [] }, bad: 3 } } }),
        player(2, { state: { m: 'velha', hw: { k: 'v1', vote: 1 }, hws: { draw: { k: 'd' } } } }),
        player(3, { state: { hw: { vote: 1 } } }),
        player(4, { state: null }),
        player(5, { state: { hw: { k: 'v1', vote: 1 } } }),
      ],
      roomState,
    )
    expect(inputs).toEqual({ 1: { k: 'v1', vote: 2 }, 5: { k: 'v1', vote: 1 } })
    expect(slots).toEqual({ draw: { 1: { k: 'd', lines: [] } } })
  })

  it('pendingCommand só aceita comando novo do host', () => {
    const cmd = { id: 3, type: 'skip' }
    expect(pendingCommand([player(1, { is_host: true, state: { cmd } })], roomState)).toEqual(cmd)
    expect(pendingCommand([player(1, { is_host: false, state: { cmd } })], roomState)).toBeNull()
    expect(pendingCommand([player(1, { is_host: true, state: { cmd: { id: 2, type: 'skip' } } })], roomState)).toBeNull()
    expect(pendingCommand([player(1, { is_host: true, state: { cmd: { id: 9 } } })], roomState)).toBeNull()
  })
})

describe('stableStringify', () => {
  it('ignora a ordem das chaves (o banco pode embaralhar)', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(
      stableStringify({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }),
    )
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(stableStringify([1, 'x', true, null])).toBe('[1,"x",true,null]')
  })
})
