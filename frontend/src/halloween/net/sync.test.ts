import { describe, expect, it } from 'vitest'
import { fetchSync, postPlayerState, pushRoomState, type Transport } from './sync'

function recorder() {
  const calls: { path: string; init?: RequestInit }[] = []
  const transport: Transport = async <T,>(path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return { same: true, v: 1, t: 2 } as T
  }
  return { calls, transport }
}

describe('cliente do contrato HTTP', () => {
  it('fetchSync monta a consulta com v, mine e tv', async () => {
    const { calls, transport } = recorder()
    await fetchSync('1234', { v: 7, mine: true }, transport)
    await fetchSync('1234', { tv: true }, transport)
    await fetchSync('1234', { v: 0, mine: false, tv: false }, transport)
    await fetchSync('1234', {}, transport)
    expect(calls.map((call) => call.path)).toEqual([
      '/rooms/1234/sync/?v=7&mine=1',
      '/rooms/1234/sync/?tv=1',
      '/rooms/1234/sync/?v=0',
      '/rooms/1234/sync/',
    ])
    expect(calls[0].init?.cache).toBe('no-store')
  })

  it('pushRoomState manda o estado, e status/slug só quando vierem', async () => {
    const { calls, transport } = recorder()
    await pushRoomState('1234', { g: null }, undefined, { transport })
    await pushRoomState('1234', { g: 1 }, 'ended', { transport, slug: 'quem-morre-primeiro' })
    expect(calls[0].path).toBe('/rooms/1234/sync_room/')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ state: { g: null } })
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ state: { g: 1 }, status: 'ended', slug: 'quem-morre-primeiro' })
  })

  it('postPlayerState substitui o player.state inteiro', async () => {
    const { calls, transport } = recorder()
    await postPlayerState('1234', { hw: { k: 'a' } }, transport)
    expect(calls[0].path).toBe('/rooms/1234/state/')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ state: { hw: { k: 'a' } } })
  })
})
