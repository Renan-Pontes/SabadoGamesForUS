import { afterEach, describe, expect, it } from 'vitest'
import {
  FESTIVE_EFFECTS,
  FESTIVE_RANDOM,
  RARE_SCARE,
  SCARES_WITH_NAME,
  SCARE_KINDS,
  XMAS_EFFECTS,
  clearScareNames,
  emitScare,
  isConcreteScare,
  isFestiveEffect,
  isScareSuppressed,
  isXmasEffect,
  onScare,
  pickFestiveEffect,
  pickScare,
  randomScareName,
  resolveScareKind,
  setScareNames,
  suppressScares,
} from './bus'
import type { ConcreteScare, ScareRequest } from './bus'

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
    expect(resolveScareKind(RARE_SCARE)).toBe(RARE_SCARE)
  })

  it('o Penetra nunca sai no sorteio, mas chega quando chamado pelo nome', () => {
    expect(SCARE_KINDS).not.toContain(RARE_SCARE)
    for (let i = 0; i < 1000; i += 1) {
      const roll = i / 1000
      expect(pickScare(() => roll, null)).not.toBe(RARE_SCARE)
      expect(resolveScareKind('random', () => roll)).not.toBe(RARE_SCARE)
    }
    const received = listen()
    emitScare(RARE_SCARE)
    expect(received[0].kind).toBe(RARE_SCARE)
    // Depois dele o sorteio volta a usar a lista inteira.
    expect(SCARE_KINDS).toContain(pickScare(() => 0.999999))
  })
})

describe('efeitos de Natal', () => {
  it('são tipos válidos que chegam como pedidos', () => {
    const received = listen()
    for (const kind of XMAS_EFFECTS) {
      expect(isConcreteScare(kind)).toBe(true)
      expect(isXmasEffect(kind)).toBe(true)
      expect(resolveScareKind(kind)).toBe(kind)
      emitScare(kind)
    }
    expect(received.map((request) => request.kind)).toEqual([...XMAS_EFFECTS])
  })

  it("'festive' sorteia só entre os de Natal e o zoom, sem repetir o último", () => {
    expect(FESTIVE_EFFECTS).toContain('zoom')
    const seen = new Set<string>()
    let previous: ConcreteScare | null = null
    for (let i = 0; i < 3000; i += 1) {
      const kind = pickFestiveEffect(Math.random, previous)
      expect(isFestiveEffect(kind)).toBe(true)
      expect(kind).not.toBe(previous)
      seen.add(kind)
      previous = kind
      expect(isFestiveEffect(resolveScareKind(FESTIVE_RANDOM))).toBe(true)
    }
    expect([...seen].sort()).toEqual([...FESTIVE_EFFECTS].sort())
    // Com random() no limite, continua dentro da lista.
    expect(FESTIVE_EFFECTS).toContain(pickFestiveEffect(() => 0.999999, null))
  })

  it("o sorteio de Halloween ('random') nunca solta um efeito de Natal (os jogos Old não mudam)", () => {
    for (let i = 0; i < 1000; i += 1) {
      const roll = i / 1000
      expect(isXmasEffect(pickScare(() => roll, null))).toBe(false)
      expect(isXmasEffect(resolveScareKind('random', () => roll))).toBe(false)
    }
    for (const kind of XMAS_EFFECTS) expect(SCARE_KINDS as readonly string[]).not.toContain(kind)
  })

  it('Papai Noel e o amigo secreto pegam um nome da mesa quando ninguém informou', () => {
    const received = listen()
    setScareNames('teste-natal', ['Ana'])
    cleanups.push(() => clearScareNames('teste-natal'))
    emitScare('hohoho')
    emitScare('secretSanta')
    emitScare('blizzard')
    expect(received.map((request) => request.name)).toEqual(['Ana', 'Ana', undefined])
    expect(SCARES_WITH_NAME).toEqual(expect.arrayContaining(['zoom', 'hohoho', 'secretSanta']))
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
