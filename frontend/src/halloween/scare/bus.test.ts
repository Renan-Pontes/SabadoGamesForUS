import { afterEach, describe, expect, it } from 'vitest'
import {
  SCARE_KINDS,
  clearScareNames,
  emitScare,
  isScareSuppressed,
  onScare,
  pickScare,
  randomScareName,
  resolveScareKind,
  setScareNames,
  suppressScares,
} from './bus'
import type { ScareRequest } from './bus'

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function listen() {
  const received: ScareRequest[] = []
  cleanups.push(onScare((request) => received.push(request)))
  return received
}

describe('barramento de sustos', () => {
  it('entrega o susto pedido para quem está ouvindo', () => {
    const received = listen()
    const request = emitScare('pipe')
    expect(request?.kind).toBe('pipe')
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(request)
  })

  it('sem ninguém ouvindo, não faz nada (e não quebra)', () => {
    expect(emitScare('doot')).toBeNull()
  })

  it("'random' e nomes desconhecidos viram um susto de verdade", () => {
    const received = listen()
    emitScare('random')
    emitScare('nao-existe')
    emitScare(undefined)
    expect(received).toHaveLength(3)
    for (const request of received) expect(SCARE_KINDS).toContain(request.kind)
  })

  it('o sorteio nunca repete o último susto', () => {
    for (const avoid of SCARE_KINDS) {
      for (let i = 0; i < 50; i += 1) {
        expect(pickScare(Math.random, avoid)).not.toBe(avoid)
      }
    }
    // Com random() no limite, continua dentro da lista.
    expect(SCARE_KINDS).toContain(pickScare(() => 0.999999, null))
    expect(SCARE_KINDS).toContain(pickScare(() => 0, 'doot'))
  })

  it('ids crescem a cada susto', () => {
    const received = listen()
    emitScare('bruh')
    emitScare('bruh')
    expect(received[1].id).toBeGreaterThan(received[0].id)
  })

  it('zoom e olhos pegam um nome dos jogadores quando ninguém informou', () => {
    const received = listen()
    setScareNames('teste', ['Ana', '  ', 'Beto'])
    cleanups.push(() => clearScareNames('teste'))
    emitScare('zoom')
    emitScare('eyes', { name: 'Carla' })
    emitScare('pipe')
    expect(['Ana', 'Beto']).toContain(received[0].name)
    expect(received[1].name).toBe('Carla')
    expect(received[2].name).toBeUndefined()
  })

  it('sem nomes registrados, o zoom fica sem nome (a tela mostra "ALGUÉM AQUI")', () => {
    const received = listen()
    emitScare('zoom')
    expect(received[0].name).toBeUndefined()
    expect(randomScareName()).toBeUndefined()
  })

  it('resolveScareKind mantém os tipos válidos', () => {
    for (const kind of SCARE_KINDS) expect(resolveScareKind(kind)).toBe(kind)
  })
})

describe('supressão com contagem de referências', () => {
  it('só libera quando todos que suspenderam soltarem', () => {
    expect(isScareSuppressed()).toBe(false)
    const releaseA = suppressScares()
    const releaseB = suppressScares()
    expect(isScareSuppressed()).toBe(true)
    releaseA()
    expect(isScareSuppressed()).toBe(true)
    // Soltar duas vezes não estraga a conta.
    releaseA()
    expect(isScareSuppressed()).toBe(true)
    releaseB()
    expect(isScareSuppressed()).toBe(false)
  })
})
