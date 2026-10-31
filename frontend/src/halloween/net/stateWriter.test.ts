import { describe, expect, it } from 'vitest'
import { createStateWriter, getStateWriter, mergeMyState } from './stateWriter'
import type { Transport } from './sync'

type Call = { path: string; body: Record<string, unknown>; resolve: () => void; reject: (error: unknown) => void }

/** Transporte falso: cada POST fica pendurado até o teste resolver. */
function fakeTransport() {
  const calls: Call[] = []
  const transport: Transport = <T,>(path: string, init?: RequestInit) =>
    new Promise<T>((resolve, reject) => {
      calls.push({
        path,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
        resolve: () => resolve({ player_id: 1, state: {} } as T),
        reject,
      })
    })
  return { calls, transport }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('mergeMyState', () => {
  it('mescla slots e mantém o resto', () => {
    const base = { m: 'a', hw: { k: 'v1', vote: 2 }, hws: { draw: { k: 'd1', lines: [1] } } }
    const next = mergeMyState(base, { m: 'a', hws: { notes: { k: 'n1', text: 'oi' } } })
    expect(next.hw).toEqual({ k: 'v1', vote: 2 })
    expect(next.hws).toEqual({ draw: { k: 'd1', lines: [1] }, notes: { k: 'n1', text: 'oi' } })
    expect(base.hws).toEqual({ draw: { k: 'd1', lines: [1] } }) // não mexe no original
  })

  it('partida nova zera respostas e comando velhos', () => {
    const base = { m: 'a', hw: { k: 'v1', vote: 2 }, hws: { draw: { k: 'd1' } }, cmd: { id: 3, type: 'end' } }
    const next = mergeMyState(base, { m: 'b', hw: { k: 'v1', vote: 5 } })
    expect(next).toEqual({ m: 'b', hw: { k: 'v1', vote: 5 } })
    // Mudar de partida com um comando no mesmo patch mantém o comando novo.
    expect(mergeMyState(base, { m: 'b', cmd: { id: 4, type: 'skip' } }).cmd).toEqual({ id: 4, type: 'skip' })
  })

  it('sem m no patch, a partida não muda', () => {
    const base = { m: 'a', hw: { k: 'v1' } }
    expect(mergeMyState(base, { cmd: { id: 1, type: 'skip' } })).toEqual({ m: 'a', hw: { k: 'v1' }, cmd: { id: 1, type: 'skip' } })
  })
})

describe('createStateWriter', () => {
  it('grava o estado inteiro, um envio por vez, sem perder escritas rápidas', async () => {
    const { calls, transport } = fakeTransport()
    const writer = createStateWriter('1234', { transport, retryMs: 1 })
    const first = writer.write({ m: 'a', hws: { draw: { k: 'd1', lines: [1] } } })
    await flush()
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/rooms/1234/state/')

    // Três toques enquanto o primeiro envio está no ar...
    const second = writer.write({ m: 'a', hw: { k: 'v1', vote: 2 } })
    writer.write({ m: 'a', hw: { k: 'v1', vote: 3 } })
    writer.write({ m: 'a', cmd: { id: 1, type: 'skip' } })
    expect(writer.pending()).toBe(true)
    await flush()
    expect(calls).toHaveLength(1) // ...ninguém atropela o envio em andamento

    calls[0].resolve()
    await first
    await flush()
    // ...e o próximo POST leva tudo junto, sem apagar o desenho.
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toEqual({
      state: { m: 'a', hws: { draw: { k: 'd1', lines: [1] } }, hw: { k: 'v1', vote: 3 }, cmd: { id: 1, type: 'skip' } },
    })
    calls[1].resolve()
    await second
    await flush()
    expect(writer.pending()).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('tenta de novo quando a rede falha, com a cópia mais nova', async () => {
    const { calls, transport } = fakeTransport()
    const writer = createStateWriter('1234', { transport, retryMs: 1 })
    const done = writer.write({ hw: { k: 'v1', vote: 1 } })
    await flush()
    writer.write({ hw: { k: 'v1', vote: 2 } })
    calls[0].reject(new Error('rede caiu'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toEqual({ state: { hw: { k: 'v1', vote: 2 } } })
    calls[1].resolve()
    await expect(done).resolves.toBeUndefined()
  })

  it('desiste depois de muitas falhas, até a próxima escrita', async () => {
    const { calls, transport } = fakeTransport()
    const writer = createStateWriter('1234', { transport, retryMs: 1, maxFailures: 2 })
    const originalError = console.error
    console.error = () => undefined
    try {
      const done = writer.write({ hw: { k: 'v1' } })
      await flush()
      calls[0].reject(new Error('x'))
      await new Promise((resolve) => setTimeout(resolve, 10))
      calls[1].reject(new Error('x'))
      await expect(done).rejects.toThrow('x')
      expect(writer.pending()).toBe(false)
    } finally {
      console.error = originalError
    }
    writer.write({ hw: { k: 'v2' } })
    await flush()
    expect(calls).toHaveLength(3)
    expect(calls[2].body).toEqual({ state: { hw: { k: 'v2' } } })
  })

  it('recusa de verdade (401, 403...) não fica insistindo', async () => {
    const { calls, transport } = fakeTransport()
    const writer = createStateWriter('1234', { transport, retryMs: 1 })
    const originalError = console.error
    console.error = () => undefined
    try {
      const done = writer.write({ hw: { k: 'v1' } })
      await flush()
      calls[0].reject(Object.assign(new Error('sem login'), { status: 401 }))
      await expect(done).rejects.toThrow('sem login')
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(calls).toHaveLength(1)
    } finally {
      console.error = originalError
    }
  })

  it('resync adota o servidor só quando não há nada pendente', async () => {
    const { calls, transport } = fakeTransport()
    const writer = createStateWriter('1234', { transport, retryMs: 1 })
    let changes = 0
    const unsubscribe = writer.subscribe(() => {
      changes += 1
    })
    expect(writer.resync({ hw: { k: 'x', vote: 9 } })).toBe(true)
    expect(writer.current()).toEqual({ hw: { k: 'x', vote: 9 } })
    expect(changes).toBe(1)

    writer.write({ cmd: { id: 1, type: 'skip' } })
    expect(writer.resync({})).toBe(false) // envio pendente: o local é mais novo
    expect(writer.current().cmd).toEqual({ id: 1, type: 'skip' })
    expect(writer.hasWritten()).toBe(true)
    await flush()
    calls[0].resolve()
    await flush()
    expect(writer.resync({})).toBe(true) // backend zerou (start): adota
    expect(writer.current()).toEqual({})
    unsubscribe()
  })

  it('getStateWriter devolve um writer por sala', () => {
    expect(getStateWriter('abc')).toBe(getStateWriter('ABC'))
    expect(getStateWriter('abc')).not.toBe(getStateWriter('xyz'))
  })
})
