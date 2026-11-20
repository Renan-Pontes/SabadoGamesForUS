import { describe, expect, it } from 'vitest'
import { HALLOWEEN_GAMES } from '../../catalog'
import { optionDefaults } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import {
  FOOLED_ALL_REVEAL_SECONDS,
  MAX_FACT_CHARS,
  MIN_TALK_SECONDS,
  REVEAL_SECONDS,
  WRITE_SECONDS,
  cardOrder,
  cleanFact,
  engine,
  entryProblem,
  factKey,
  finalAwards,
  readEntry,
  type DvState,
} from './engine'
import { meta } from './meta'

const T0 = 1_000_000

function ctx(n: number, partial: Partial<EngineCtx> = {}, offline: number[] = []): EngineCtx {
  return makeCtx({ players: makePlayers(n, { offline }), now: T0, ...partial })
}

function start(n: number, options: Record<string, unknown> = {}, offline: number[] = []): DvState {
  return engine.init(ctx(n, { options }, offline))
}

const FACTS = (id: number) => [`Fato um do ${id}`, `Fato dois do ${id}`, `Fato três do ${id}`]

/** Cartinhas válidas de cada id (mentira = a 3ª, salvo indicação). */
function entries(state: DvState, ids: number[], lie = 2): Record<number, HInput> {
  return Object.fromEntries(ids.map((id) => [id, { k: state.inputKey, facts: FACTS(id), lie }]))
}

/** Fecha a escrita com todos do roster mandando cartinhas. */
function toFirstTurn(n: number, options: Record<string, unknown> = {}): DvState {
  const write = start(n, options)
  const next = engine.step(write, ctx(n, { inputs: entries(write, write.roster) }))
  expect(next.phase).toBe('vote')
  return next
}

/** A carta da mentira da vez (pelo segredo do autor). */
function lieCardOf(state: DvState): number {
  const secret = state.private[String(state.author)]
  return cardOrder(state.seed, state.round).indexOf(secret.lie)
}

function votes(state: DvState, byId: Record<number, number>): Record<number, HInput> {
  return Object.fromEntries(Object.entries(byId).map(([id, card]) => [Number(id), { k: state.inputKey, card }]))
}

describe('frases', () => {
  it('limpa espaço, quebra de linha e invisíveis; corta em 80 letras', () => {
    expect(cleanFact('  Já   comi\npanetone  ')).toBe('Já comi panetone')
    expect(cleanFact('​ ')).toBe('')
    expect(cleanFact(42)).toBe('')
    expect(Array.from(cleanFact('🎄'.repeat(200))).length).toBe(MAX_FACT_CHARS)
  })

  it('frases iguais (sem acento/pontuação) contam como iguais', () => {
    expect(factKey('Já comi PANETONE!')).toBe(factKey('ja comi panetone'))
  })

  it('valida as cartinhas: três frases, diferentes, com a mentira marcada', () => {
    expect(entryProblem(['a', 'b', 'c'], 1)).toBeNull()
    expect(entryProblem(['a', '', 'c'], 1)).toBe('missing')
    expect(entryProblem(['a', 'b'], 1)).toBe('missing')
    expect(entryProblem(['Pudim', 'pudim!', 'c'], 1)).toBe('duplicate')
    expect(entryProblem(['a', 'b', 'c'], null)).toBe('no-lie')
    expect(entryProblem(['a', 'b', 'c'], 3)).toBe('no-lie')
    expect(entryProblem(['a', 'b', 'c'], 1.5)).toBe('no-lie')
    expect(readEntry({ k: 'write', facts: [' a ', 'b', 'c'], lie: 0 })).toEqual({ facts: ['a', 'b', 'c'], lie: 0 })
    expect(readEntry({ k: 'write', facts: 'abc', lie: 0 })).toBeNull()
    expect(readEntry(undefined)).toBeNull()
  })
})

describe('escrita', () => {
  it('começa na escrita com o roster online e as opções (inválidas voltam ao padrão)', () => {
    const state = start(5, { turns: 6, talkSeconds: 30 }, [4])
    expect(state.phase).toBe('write')
    expect(state.roster).toEqual([1, 2, 3, 5])
    expect(state.deadline).toBe(T0 + WRITE_SECONDS * 1000 + 2000)
    expect(state.turnLimit).toBe(6)
    expect(state.talkMs).toBe(30_000)
    const odd = start(5, { turns: 7, talkSeconds: '45' })
    expect(odd.turnLimit).toBe(0)
    expect(odd.talkMs).toBe(45_000)
  })

  it('marca ✓ só de quem mandou cartinhas válidas e espera os outros', () => {
    const write = start(4)
    const inputs: Record<number, HInput> = {
      ...entries(write, [1]),
      2: { k: write.inputKey, facts: ['a', 'a', 'b'], lie: 0 }, // repetida
      3: { k: write.inputKey, facts: ['a', 'b', 'c'] }, // sem mentira
      4: { k: 'velha', facts: FACTS(4), lie: 1 }, // de outra fase
    }
    const next = engine.step(write, ctx(4, { inputs }))
    expect(next.phase).toBe('write')
    expect(next.acted).toEqual([1])
    // Idempotente: o mesmo ctx devolve o mesmo objeto.
    expect(engine.step(next, ctx(4, { inputs }))).toBe(next)
  })

  it('fecha quando todo mundo online mandou: offline não segura', () => {
    const write = start(4)
    const players = makePlayers(4, { offline: [3] })
    const next = engine.step(write, makeCtx({ players, now: T0, inputs: entries(write, [1, 2, 4]) }))
    expect(next.phase).toBe('vote')
    expect([...next.queue].sort()).toEqual([1, 2, 4])
    expect(next.skipped).toEqual([3])
    expect(next.totalRounds).toBe(3)
    expect(Object.keys(next.private).sort()).toEqual(['1', '2', '4'])
  })

  it('no prazo (ou no "Pular"), segue com quem escreveu', () => {
    const write = start(4)
    const late = engine.step(write, ctx(4, { inputs: entries(write, [2]), now: write.deadline! }))
    expect(late.phase).toBe('vote')
    expect(late.queue).toEqual([2])
    expect(late.skipped).toEqual([1, 3, 4])
    const skipped = engine.step(write, ctx(4, { inputs: entries(write, [1, 3]), command: { id: 1, type: 'skip' } }))
    expect(skipped.phase).toBe('vote')
    expect([...skipped.queue].sort()).toEqual([1, 3])
  })

  it('ninguém escreveu: vai direto para o fim', () => {
    const write = start(3)
    const done = engine.step(write, ctx(3, { now: write.deadline! }))
    expect(done.over).toBe(true)
    expect(done.phase).toBe('final')
    expect(done.queue).toEqual([])
    expect(done.deadline).toBeNull()
  })

  it('com limite de vezes, sorteia quem aparece; o resto fica no banco (e só vota)', () => {
    const turn = toFirstTurn(8, { turns: 6 })
    expect(turn.queue).toHaveLength(6)
    expect(turn.benched).toHaveLength(2)
    expect(new Set([...turn.queue, ...turn.benched]).size).toBe(8)
    expect(Object.keys(turn.private)).toHaveLength(6)
    expect(turn.totalRounds).toBe(6)
    // Limite maior que a mesa: todo mundo aparece.
    const all = toFirstTurn(5, { turns: 10 })
    expect(all.queue).toHaveLength(5)
    expect(all.benched).toEqual([])
  })
})

describe('a vez de cada um', () => {
  it('mostra as 3 frases do autor embaralhadas; a mentira não fica em campo público', () => {
    const turn = toFirstTurn(4)
    const author = turn.author!
    expect(turn.queue[0]).toBe(author)
    expect(turn.inputKey).toBe('vote-1')
    expect(turn.cards.map((card) => card.id)).toEqual([0, 1, 2])
    expect([...turn.cards.map((card) => card.text)].sort()).toEqual([...FACTS(author)].sort())
    expect(turn.cards[lieCardOf(turn)].text).toBe(FACTS(author)[2])
    const publicState: Partial<DvState> = { ...turn }
    delete publicState.private
    expect(JSON.stringify(publicState)).not.toContain('"lie"')
    // A ordem é fixa pela sorte da partida: refazer a passagem dá as mesmas letras.
    expect(cardOrder(turn.seed, 1)).toEqual(cardOrder(turn.seed, 1))
  })

  it('o autor não vota; voto em carta que não existe não conta', () => {
    const turn = toFirstTurn(3)
    const author = turn.author!
    const others = turn.roster.filter((id) => id !== author)
    const inputs = { ...votes(turn, { [author]: 0, [others[0]]: 7 }) }
    const next = engine.step(turn, ctx(3, { inputs, now: T0 + 1000 }))
    expect(next.phase).toBe('vote')
    expect(next.acted).toEqual([])
  })

  it('todo mundo votou: espera o tempo mínimo de papo e revela', () => {
    const turn = toFirstTurn(4)
    const others = turn.roster.filter((id) => id !== turn.author)
    const inputs = votes(turn, Object.fromEntries(others.map((id) => [id, 0])))
    const early = engine.step(turn, ctx(4, { inputs, now: T0 + 5000 }))
    expect(early.phase).toBe('vote')
    expect(early.acted).toEqual(others)
    const later = engine.step(early, ctx(4, { inputs, now: T0 + MIN_TALK_SECONDS * 1000 }))
    expect(later.phase).toBe('reveal')
  })

  it('offline não segura a votação; o prazo revela', () => {
    const turn = toFirstTurn(4)
    const others = turn.roster.filter((id) => id !== turn.author)
    const players = makePlayers(4, { offline: [others[0]] })
    const inputs = votes(turn, { [others[1]]: 1, [others[2]]: 2 })
    const next = engine.step(turn, makeCtx({ players, inputs, now: T0 + MIN_TALK_SECONDS * 1000 }))
    expect(next.phase).toBe('reveal')
    const timeout = engine.step(turn, ctx(4, { now: turn.deadline! }))
    expect(timeout.phase).toBe('reveal')
    expect(timeout.reveal?.outcome).toBe('no-votes')
    expect(timeout.reveal?.gained).toEqual({})
  })
})

describe('pontos e revelação', () => {
  /** Fecha a votação da 1ª vez com `right` acertando e `wrong` errando. */
  function reveal(n: number, rightCount: number, wrongCount: number) {
    const turn = toFirstTurn(n)
    const lie = lieCardOf(turn)
    const truth = (lie + 1) % 3
    const others = turn.roster.filter((id) => id !== turn.author)
    const right = others.slice(0, rightCount)
    const wrong = others.slice(rightCount, rightCount + wrongCount)
    const byId: Record<number, number> = {}
    for (const id of right) byId[id] = lie
    for (const id of wrong) byId[id] = truth
    const next = engine.step(turn, ctx(n, { inputs: votes(turn, byId), now: turn.deadline! }))
    expect(next.phase).toBe('reveal')
    return { turn, next, right, wrong, author: turn.author! }
  }

  it('+1 para quem acertou; o autor ganha +1 por pessoa enganada', () => {
    const { turn, next, right, wrong, author } = reveal(6, 2, 3)
    expect(next.reveal!.outcome).toBe('mixed')
    expect(next.deadline).toBe(turn.deadline! + REVEAL_SECONDS * 1000)
    expect(next.reveal!.right).toEqual(right)
    expect(next.reveal!.fooled).toEqual(wrong)
    for (const id of right) expect(next.scores[String(id)]).toBe(1)
    for (const id of wrong) expect(next.scores[String(id)]).toBe(0)
    expect(next.scores[String(author)]).toBe(3)
    expect(next.fooledTotal[String(author)]).toBe(3)
    expect(next.rightTotal[String(right[0])]).toBe(1)
    expect(next.history).toEqual([{ turn: 1, author, lie: FACTS(author)[2], fooled: 3, voters: 5 }])
  })

  it('ninguém acertou: "enganou todo mundo" (revelação mais longa)', () => {
    const { turn, next, author } = reveal(5, 0, 4)
    expect(next.reveal!.outcome).toBe('fooled-all')
    expect(next.scores[String(author)]).toBe(4)
    expect(next.deadline).toBe(turn.deadline! + FOOLED_ALL_REVEAL_SECONDS * 1000)
  })

  it('todo mundo acertou: o autor fica no zero', () => {
    const { turn, next, author } = reveal(5, 4, 0)
    expect(next.reveal!.outcome).toBe('all-right')
    expect(next.scores[String(author)]).toBe(0)
    expect(next.deadline).toBe(turn.deadline! + REVEAL_SECONDS * 1000)
  })

  it('depois da revelação vem a próxima vez; depois da última, o fim', () => {
    const { next } = reveal(3, 1, 1)
    const second = engine.step(next, ctx(3, { now: next.deadline! }))
    expect(second.phase).toBe('vote')
    expect(second.round).toBe(2)
    expect(second.author).toBe(second.queue[1])
    expect(second.inputKey).toBe('vote-2')
    expect(second.reveal).toBeNull()
    // Pula até o fim.
    let state = second
    for (let guard = 0; guard < 10 && !state.over; guard += 1) {
      state = engine.step(state, ctx(3, { now: state.deadline ?? T0, command: { id: guard + 10, type: 'skip' } }))
    }
    expect(state.over).toBe(true)
    expect(state.phase).toBe('final')
    expect(state.history).toHaveLength(3)
  })

  it('comando desconhecido não muda nada', () => {
    const turn = toFirstTurn(4)
    expect(engine.step(turn, ctx(4, { command: { id: 3, type: 'dance' } }))).toBe(turn)
  })

  it('prêmios do fim: campeão, mentiroso de ouro, detetive e a mentira da noite', () => {
    const { next, right, author } = reveal(6, 2, 3)
    const awards = finalAwards(next)
    expect(awards.champions).toEqual([author])
    expect(awards.topScore).toBe(3)
    expect(awards.liars).toEqual([author])
    expect(awards.maxFooled).toBe(3)
    expect(awards.detectives).toEqual(right)
    expect(awards.bestLie?.author).toBe(author)
    const empty = finalAwards(start(3))
    expect(empty.champions).toEqual([])
    expect(empty.liars).toEqual([])
    expect(empty.bestLie).toBeNull()
  })
})

describe('bots', () => {
  it('escrevem cartinhas válidas e votam em carta que existe (menos o autor)', () => {
    const write = start(4)
    const entry = engine.bot(write, 2, ctx(4))
    expect(readEntry(entry)).not.toBeNull()
    const turn = toFirstTurn(4)
    expect(engine.bot(turn, turn.author!, ctx(4))).toBeNull()
    const other = turn.roster.find((id) => id !== turn.author)!
    const vote = engine.bot(turn, other, ctx(4)) as { card: number }
    expect([0, 1, 2]).toContain(vote.card)
    expect(engine.bot(turn, 99, ctx(4))).toBeNull()
  })
})

describe('simulações', () => {
  it.each([3, 8, 15])('partida inteira com %i jogadores, várias sementes', (players) => {
    for (const seed of [1, 2, 3]) {
      const result = runSimulation(engine, { players, seed, options: optionDefaults(meta.options) })
      expect(result.state.over).toBe(true)
      expect(result.state.queue).toHaveLength(players)
      expect(result.state.history).toHaveLength(players)
    }
  })

  it('com limite de 6 e de 10 vezes', () => {
    for (const turns of [6, 10]) {
      const result = runSimulation(engine, { players: 15, seed: turns, options: { turns, talkSeconds: 30 } })
      expect(result.state.over).toBe(true)
      expect(result.state.history).toHaveLength(turns)
    }
  })

  it('com gente offline, bots preguiçosos e o host pulando', () => {
    for (const seed of [4, 5, 6, 7]) {
      const result = runSimulation(engine, {
        players: 9,
        seed,
        offlineIds: [3, 7],
        skipProbability: 0.2,
        actProbability: 0.4,
        options: optionDefaults(meta.options),
      })
      expect(result.state.over).toBe(true)
      expect(result.state.queue).not.toContain(3)
    }
  })

  it('ninguém age: termina sozinha no prazo', () => {
    const result = runSimulation(engine, { players: 5, seed: 9, actProbability: 0, stepMs: 5000 })
    expect(result.state.over).toBe(true)
    expect(result.state.queue).toEqual([])
  })
})

describe('meta (as mesmas regras do registry.test)', () => {
  const VIBES = ['Cooperativo', 'Dedução', 'Blefe', 'Negociação', 'Corrida', 'Aposta', 'Festa', 'Estratégia']

  it('segue as regras de ouro', () => {
    expect(meta.slug).toBe('duas-verdades')
    expect(meta.name.length).toBeGreaterThan(2)
    expect(meta.icon.length).toBeGreaterThan(0)
    expect(meta.tagline.length).toBeGreaterThan(5)
    expect(meta.pitch.length).toBeGreaterThan(10)
    expect(VIBES).toContain(meta.vibe)
    expect(meta.howTo.length).toBeGreaterThanOrEqual(3)
    expect(meta.howTo.length).toBeLessThanOrEqual(5)
    for (const step of meta.howTo) {
      const words = step.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word))
      expect(words.length, `passo longo demais: "${step}"`).toBeLessThanOrEqual(15)
    }
    expect(meta.minPlayers).toBe(3)
    expect(meta.maxPlayers).toBe(15)
    for (const key of ['main', 'light', 'glow', 'contrast', 'sigil'] as const) {
      expect(meta.accent[key].length).toBeGreaterThan(0)
    }
  })

  it('opções válidas: chaves únicas e o padrão entre as escolhas', () => {
    const keys = meta.options.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const option of meta.options) {
      expect(option.choices.length).toBeGreaterThanOrEqual(2)
      expect(option.choices.map((choice) => choice.value)).toContain(option.default)
    }
  })

  it('cor e ícone diferentes dos outros jogos', () => {
    const others = HALLOWEEN_GAMES.filter((other) => other.slug !== meta.slug)
    expect(others.map((other) => other.accent.main.toLowerCase())).not.toContain(meta.accent.main.toLowerCase())
    expect(others.map((other) => other.slug)).not.toContain(meta.slug)
  })
})
