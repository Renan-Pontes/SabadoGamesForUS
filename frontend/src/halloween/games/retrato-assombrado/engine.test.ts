import { describe, expect, it } from 'vitest'
import { GRACE_MS, fuzzyMatch, normalizeText, optionDefaults } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { CATEGORIES, answersFor, categoryLabel } from './content'
import {
  CATCH_POINTS,
  CONSOLATION_POINTS,
  DRAW1_SECONDS,
  DRAW2_SECONDS,
  ESCAPE_POINTS,
  GALLERY_SECONDS,
  GUESS_POINTS,
  GUESS_SECONDS,
  MAX_GUESS_LENGTH,
  PEEK_SECONDS,
  RESULT_SECONDS,
  REVEAL_SECONDS,
  SCORES_SECONDS,
  SHOW_SECONDS,
  VOTE_SECONDS,
  engine,
  finalAwards,
  impostorsOf,
  keys,
  wordOf,
  type RaPhase,
  type RaSecret,
  type State,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n). Sem rodada maluca, a não ser que o teste peça. */
function start(n = 5, options: Record<string, unknown> = { rounds: 4, chaos: false }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** Aleatório de mentira que repete os valores dados, em ciclo. */
function seq(...values: number[]) {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

function ctxAt(state: State, extra: Partial<EngineCtx> = {}): EngineCtx {
  return makeCtx({ players: makePlayers(Math.max(1, ...state.roster)), now: state.deadline ?? NOW, ...extra })
}

/** Avança só pelos prazos (ninguém age) até a fase pedida. */
function toPhase(state: State, phase: RaPhase, extra: Partial<EngineCtx> = {}): State {
  let current = state
  for (let i = 0; i < 30 && current.phase !== phase; i += 1) current = engine.step(current, ctxAt(current, extra))
  expect(current.phase).toBe(phase)
  return current
}

/** ctx com os votos `{ eleitor: alvo }` da fase atual. */
function votesCtx(state: State, votes: Record<number, unknown>, extra: Partial<EngineCtx> = {}): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [voter, target] of Object.entries(votes)) inputs[Number(voter)] = { k: state.inputKey, vote: target }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, inputs, ...extra })
}

/** ctx com os desenhos de quem já apertou "Pronto" nesta etapa. */
function doneCtx(state: State, done: number[], extra: Partial<EngineCtx> = {}): EngineCtx {
  const draw: Record<number, HInput> = {}
  for (const id of done) draw[id] = { k: state.inputKey, s: [{ c: 0, p: [0.1, 0.1, 0.5, 0.5] }], done: true }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, slots: { draw }, ...extra })
}

/** Troca os segredos da rodada: estes são os impostores, o resto sabe a palavra. */
function withImpostors(state: State, impostors: number[], word = 'Abóbora'): State {
  const secrets: Record<string, RaSecret> = {}
  for (const id of state.roster) {
    secrets[String(id)] = impostors.includes(id) ? { role: 'impostor', word: null } : { role: 'artist', word }
  }
  return { ...state, categoryId: 5, category: categoryLabel(5), private: secrets }
}

/** Rodada pronta para votar, com estes impostores (categoria "Doces e festa", palavra Abóbora). */
function votingWith(n: number, impostors: number[]) {
  const { state } = start(n)
  return toPhase(withImpostors(state, impostors), 'vote')
}

function publicPart(state: State) {
  const copy: Partial<State> = { ...state }
  delete copy.private
  return copy
}

describe('início', () => {
  it('abre a rodada 1 mostrando o segredo, com prazo', () => {
    const { state } = start(5)
    expect(state.phase).toBe('show')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(4)
    expect(state.inputKey).toBe('show-1')
    expect(state.deadline).toBe(NOW + SHOW_SECONDS * 1000)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(state.category).toBe(categoryLabel(state.categoryId))
    expect(state.over).toBe(false)
  })

  it('um impostor até 8 jogadores, dois a partir de 9 — e ele não recebe a palavra', () => {
    for (const n of [3, 5, 8]) {
      const { state } = start(n)
      expect(state.impostorCount).toBe(1)
      expect(impostorsOf(state)).toHaveLength(1)
    }
    for (const n of [9, 12, 15]) {
      const { state } = start(n)
      expect(state.impostorCount).toBe(2)
      expect(impostorsOf(state)).toHaveLength(2)
    }
    const { state } = start(10)
    const word = wordOf(state)
    expect(word).not.toBeNull()
    expect(CATEGORIES[state.categoryId].words.map((entry) => entry.text)).toContain(word)
    for (const id of state.roster) {
      const secret = state.private[String(id)]
      if (secret.role === 'impostor') expect(secret.word).toBeNull()
      else expect(secret.word).toBe(word)
    }
  })

  it('segredo só no private: o estado público não tem a palavra nem os impostores', () => {
    const { state } = start(6)
    const text = JSON.stringify(publicPart(state))
    expect(text).not.toContain(JSON.stringify(wordOf(state)))
    expect(text).not.toContain('"role"')
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW, options: { chaos: false } })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('opções: rodadas 3/4/5 (padrão 4) e rodadas malucas sim/não (padrão sim)', () => {
    expect(start(4, {}).state.totalRounds).toBe(4)
    expect(start(4, { rounds: 5 }).state.totalRounds).toBe(5)
    expect(start(4, { rounds: 7 }).state.totalRounds).toBe(4)
    expect(start(4, { rounds: '5' }).state.totalRounds).toBe(4)
    expect(start(4, {}).state.chaosOn).toBe(true)
    expect(start(4, { chaos: false }).state.chaosOn).toBe(false)
    expect(start(4, { chaos: 'não' }).state.chaosOn).toBe(true)
    const defaults = start(4, optionDefaults(meta.options)).state
    expect(defaults.totalRounds).toBe(4)
    expect(defaults.chaosOn).toBe(true)
  })

  it('a categoria não se repete na partida', () => {
    const result = runSimulation(engine, { players: 4, seed: 9, options: { rounds: 5, chaos: false } })
    const used = result.state.history.map((round) => round.categoryId)
    expect(new Set(used).size).toBe(5)
  })
})

describe('desenho', () => {
  it('show → draw1 com folga, depois espiadinha, draw2 e galeria nos prazos', () => {
    const { state } = start(4)
    expect(engine.step(state, ctxAt(state, { now: state.deadline! - 1 }))).toBe(state)
    const draw1 = engine.step(state, ctxAt(state))
    expect(draw1.phase).toBe('draw1')
    expect(draw1.inputKey).toBe('draw1-1')
    expect(draw1.deadline).toBe(state.deadline! + DRAW1_SECONDS * 1000 + GRACE_MS)

    const peek = engine.step(draw1, ctxAt(draw1))
    expect(peek.phase).toBe('peek')
    expect(peek.inputKey).toBe('draw1-1') // traço atrasado ainda conta como da 1ª etapa
    expect(peek.deadline).toBe(draw1.deadline! + PEEK_SECONDS * 1000)

    const draw2 = engine.step(peek, ctxAt(peek))
    expect(draw2.phase).toBe('draw2')
    expect(draw2.inputKey).toBe('draw2-1')
    expect(draw2.acted).toEqual([])
    expect(draw2.deadline).toBe(peek.deadline! + DRAW2_SECONDS * 1000 + GRACE_MS)

    const gallery = engine.step(draw2, ctxAt(draw2))
    expect(gallery.phase).toBe('gallery')
    expect(gallery.deadline).toBe(draw2.deadline! + GALLERY_SECONDS * 1000)

    const vote = engine.step(gallery, ctxAt(gallery))
    expect(vote.phase).toBe('vote')
    expect(vote.inputKey).toBe('vote-1')
    expect(vote.deadline).toBe(gallery.deadline! + VOTE_SECONDS * 1000 + GRACE_MS)
  })

  it('✓ de quem apertou "Pronto"; todo mundo pronto fecha a etapa mais cedo', () => {
    const draw1 = toPhase(start(3).state, 'draw1')
    const partial = engine.step(draw1, doneCtx(draw1, [1, 3]))
    expect(partial.phase).toBe('draw1')
    expect(partial.acted).toEqual([1, 3])
    expect(engine.step(partial, doneCtx(draw1, [1, 3]))).toBe(partial)
    const peek = engine.step(partial, doneCtx(draw1, [1, 2, 3]))
    expect(peek.phase).toBe('peek')
    expect(peek.acted).toEqual([1, 2, 3])
  })

  it('desenho sem "Pronto" não fecha a etapa nem ganha ✓', () => {
    const draw1 = toPhase(start(3).state, 'draw1')
    const slots = { draw: { 1: { k: draw1.inputKey, s: [] }, 2: { k: draw1.inputKey, s: [], done: 'sim' } } }
    const next = engine.step(draw1, makeCtx({ players: makePlayers(3), now: NOW + 1000, slots }))
    expect(next).toBe(draw1)
  })

  it('"Pronto" da 1ª etapa não vale na 2ª, nem o de outra rodada', () => {
    const draw2 = toPhase(start(3).state, 'draw2')
    const slots = {
      draw: {
        1: { k: 'draw1-1', s: [], done: true },
        2: { k: 'draw2-0', s: [], done: true },
        3: { k: 'draw2-1', s: [], done: true },
      },
    }
    const next = engine.step(draw2, makeCtx({ players: makePlayers(3), now: NOW + 1000, slots }))
    expect(next.phase).toBe('draw2')
    expect(next.acted).toEqual([3])
  })

  it('offline não segura o desenho', () => {
    const draw1 = toPhase(start(4).state, 'draw1')
    const next = engine.step(draw1, doneCtx(draw1, [1, 2, 3], { players: makePlayers(4, { offline: [4] }) }))
    expect(next.phase).toBe('peek')
  })

  it('ninguém online: espera o prazo', () => {
    const draw1 = toPhase(start(3).state, 'draw1')
    const ctx = makeCtx({ players: makePlayers(3, { offline: [1, 2, 3] }), now: NOW + 1000 })
    expect(engine.step(draw1, ctx)).toBe(draw1)
  })
})

describe('votação', () => {
  it('✓ de quem votou e o mesmo estado quando nada muda', () => {
    const vote = votingWith(5, [2])
    const ctx = votesCtx(vote, { 1: 2, 3: 2 })
    const next = engine.step(vote, ctx)
    expect(next.phase).toBe('vote')
    expect(next.acted).toEqual([1, 3])
    expect(next.reveal).toBeNull()
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('ignora voto em si mesmo, fora do roster, de espectador, de outra rodada e lixo', () => {
    const vote = votingWith(3, [2])
    const ctx = makeCtx({
      players: makePlayers(5),
      now: NOW + 1000,
      inputs: {
        1: { k: vote.inputKey, vote: 1 }, // em si mesmo
        2: { k: vote.inputKey, vote: 99 }, // fora da sala
        3: { k: 'vote-0', vote: 2 }, // outra rodada
        4: { k: vote.inputKey, vote: 2 }, // espectador (entrou depois)
        5: { k: vote.inputKey, vote: '2' }, // lixo
      },
    })
    const waiting = engine.step(vote, ctx)
    expect(waiting).toBe(vote)
    const revealed = engine.step(waiting, { ...ctx, now: vote.deadline! })
    expect(revealed.phase).toBe('reveal')
    expect(revealed.reveal?.votes).toEqual({})
    expect(revealed.reveal?.accused).toBeNull()
  })

  it('todo mundo votou: revela na hora', () => {
    const vote = votingWith(4, [3])
    const next = engine.step(vote, votesCtx(vote, { 1: 3, 2: 3, 3: 1, 4: 3 }))
    expect(next.phase).toBe('reveal')
    expect(next.deadline).toBe(NOW + 1000 + REVEAL_SECONDS * 1000)
    expect(next.reveal).toMatchObject({ accused: 3, top: [3], impostors: [3], chaos: null, caught: true })
    expect(next.reveal?.tally[0]).toEqual({ id: 3, count: 3, voters: [1, 2, 4] })
  })

  it('offline não segura a votação; espera o prazo (com a folga) quando falta alguém online', () => {
    const vote = votingWith(4, [3])
    const offline = votesCtx(vote, { 1: 3, 2: 3, 3: 1 }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(vote, offline).phase).toBe('reveal')
    const missing = votesCtx(vote, { 1: 3, 2: 3 })
    expect(engine.step(vote, { ...missing, now: vote.deadline! - 1 }).phase).toBe('vote')
    expect(engine.step(vote, { ...missing, now: vote.deadline! }).phase).toBe('reveal')
  })

  it('o voto mais recente vale', () => {
    const vote = votingWith(3, [1])
    const first = engine.step(vote, votesCtx(vote, { 2: 3 }))
    const next = engine.step(first, votesCtx(vote, { 1: 2, 2: 1, 3: 1 }))
    expect(next.reveal?.votes).toEqual({ 1: 2, 2: 1, 3: 1 })
    expect(next.reveal?.accused).toBe(1)
  })
})

describe('pontos', () => {
  it('impostor escapou (acusaram um inocente): +2 para ele e nada para a mesa', () => {
    const vote = votingWith(4, [4])
    const reveal = engine.step(vote, votesCtx(vote, { 1: 2, 2: 3, 3: 2, 4: 2 }))
    expect(reveal.reveal).toMatchObject({ accused: 2, caught: false, chaos: null })
    const result = engine.step(reveal, ctxAt(reveal))
    expect(result.phase).toBe('result')
    expect(result.deadline).toBe(reveal.deadline! + RESULT_SECONDS * 1000)
    expect(result.outcome).toMatchObject({ word: 'Abóbora', guess: null, guessRight: false, escaped: [4], hits: [] })
    expect(result.outcome?.gains).toEqual({ 4: ESCAPE_POINTS })
    expect(result.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: ESCAPE_POINTS })
  })

  it('empate no topo: ninguém é acusado e o impostor escapa (quem votou certo não pontua)', () => {
    const vote = votingWith(4, [1])
    const reveal = engine.step(vote, votesCtx(vote, { 1: 2, 2: 1, 3: 1, 4: 2 }))
    expect(reveal.reveal).toMatchObject({ accused: null, top: [1, 2], caught: false })
    const result = engine.step(reveal, ctxAt(reveal))
    expect(result.outcome?.gains).toEqual({ 1: ESCAPE_POINTS })
    expect(result.outcome?.hits).toEqual([2, 3]) // votaram certo (conta para o prêmio), mas sem ponto
  })

  it('ninguém votou: o impostor escapa', () => {
    const vote = votingWith(3, [2])
    const result = toPhase(vote, 'result')
    expect(result.reveal?.accused).toBeNull()
    expect(result.scores).toEqual({ 1: 0, 2: ESCAPE_POINTS, 3: 0 })
  })

  it('pegaram o impostor: chute → +1 para quem votou nele; chute errado não dá nada ao impostor', () => {
    const vote = votingWith(4, [3])
    const reveal = engine.step(vote, votesCtx(vote, { 1: 3, 2: 3, 3: 1, 4: 2 }))
    const guess = engine.step(reveal, ctxAt(reveal))
    expect(guess.phase).toBe('guess')
    expect(guess.inputKey).toBe('guess-1')
    expect(guess.deadline).toBe(reveal.deadline! + GUESS_SECONDS * 1000 + GRACE_MS)
    // A palavra ainda não é pública na hora do chute.
    expect(JSON.stringify(publicPart(guess))).not.toContain('Abóbora')

    const ctx = makeCtx({ players: makePlayers(4), now: NOW + 5000, inputs: { 3: { k: guess.inputKey, guess: 'fantasma' } } })
    const result = engine.step(guess, ctx)
    expect(result.phase).toBe('result')
    expect(result.outcome).toMatchObject({ word: 'Abóbora', guess: 'fantasma', guessRight: false, hits: [1, 2], escaped: [] })
    expect(result.scores).toEqual({ 1: CATCH_POINTS, 2: CATCH_POINTS, 3: 0, 4: 0 })
    expect(engine.step(result, ctx)).toBe(result)
  })

  it('impostor pego que acerta a palavra (sem acento, com erro de digitação) leva +2', () => {
    for (const typed of ['abobora', 'ABÓBRA', 'a abóbora', 'moranga']) {
      const vote = votingWith(4, [3])
      const reveal = engine.step(vote, votesCtx(vote, { 1: 3, 2: 3, 3: 1, 4: 3 }))
      const guess = engine.step(reveal, ctxAt(reveal))
      const ctx = makeCtx({ players: makePlayers(4), now: NOW + 5000, inputs: { 3: { k: guess.inputKey, guess: typed } } })
      const result = engine.step(guess, ctx)
      expect(result.outcome?.guessRight, typed).toBe(true)
      expect(result.scores).toEqual({ 1: CATCH_POINTS, 2: CATCH_POINTS, 3: GUESS_POINTS, 4: CATCH_POINTS })
    }
  })

  it('chute: só o acusado chuta; vazio não conta; gigante é cortado; prazo ou "Pular" fecham sem chute', () => {
    const vote = votingWith(4, [3])
    const reveal = engine.step(vote, votesCtx(vote, { 1: 3, 2: 3, 3: 1, 4: 3 }))
    const guess = engine.step(reveal, ctxAt(reveal))
    const others = makeCtx({
      players: makePlayers(4),
      now: NOW + 5000,
      inputs: {
        1: { k: guess.inputKey, guess: 'abóbora' }, // não é o acusado
        3: { k: guess.inputKey, guess: '   ' }, // vazio
      },
    })
    expect(engine.step(guess, others)).toBe(guess)

    const giant = 'abóbora '.repeat(500)
    const long = engine.step(guess, makeCtx({ players: makePlayers(4), now: NOW + 5000, inputs: { 3: { k: guess.inputKey, guess: giant } } }))
    expect(long.outcome?.guess?.length).toBeLessThanOrEqual(MAX_GUESS_LENGTH)
    expect(long.outcome?.guessRight).toBe(true)

    const late = engine.step(guess, ctxAt(guess))
    expect(late.phase).toBe('result')
    expect(late.outcome).toMatchObject({ guess: null, guessRight: false })
    expect(late.scores).toEqual({ 1: CATCH_POINTS, 2: CATCH_POINTS, 3: 0, 4: CATCH_POINTS })

    const skipped = engine.step(guess, makeCtx({ players: makePlayers(4), now: NOW + 10, command: { id: 1, type: 'skip' } }))
    expect(skipped.phase).toBe('result')
  })

  it('impostor pego que está offline: pula o chute', () => {
    const vote = votingWith(4, [3])
    const reveal = engine.step(vote, votesCtx(vote, { 1: 3, 2: 3, 3: 1, 4: 3 }))
    const players = makePlayers(4, { offline: [3] })
    const result = engine.step(reveal, makeCtx({ players, now: reveal.deadline! }))
    expect(result.phase).toBe('result')
    expect(result.scores[3]).toBe(0)
    // E se sumir no meio do chute, também não segura.
    const guess = engine.step(reveal, ctxAt(reveal))
    expect(engine.step(guess, makeCtx({ players, now: NOW + 5000 })).phase).toBe('result')
  })

  it('dois impostores: um pego, o outro escapa; quem votou em qualquer um deles pontua', () => {
    const vote = votingWith(9, [2, 7])
    expect(vote.impostorCount).toBe(2)
    const votes = { 1: 2, 2: 5, 3: 2, 4: 2, 5: 7, 6: 2, 7: 2, 8: 1, 9: 3 }
    const reveal = engine.step(vote, votesCtx(vote, votes))
    expect(reveal.reveal).toMatchObject({ accused: 2, impostors: [2, 7], caught: true })
    const result = toPhase(reveal, 'result')
    // 7 é impostor: votou no 2 mas não ganha ponto de mesa; escapou: +2.
    expect(result.outcome).toMatchObject({ hits: [1, 3, 4, 5, 6], escaped: [7] })
    expect(result.outcome?.gains).toEqual({ 1: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: ESCAPE_POINTS })
  })
})

describe('rodadas malucas', () => {
  /** Leva a partida ao placar da rodada 1 (sem ninguém agir). */
  function scoresOfRound1(n = 5, options: Record<string, unknown> = { rounds: 4, chaos: true }) {
    return toPhase(start(n, options).state, 'scores')
  }

  it('nunca na 1ª rodada', () => {
    const { state } = start(5, { rounds: 4, chaos: true }, { rng: seq(0.01) })
    expect(impostorsOf(state)).toHaveLength(1)
  })

  it('"todo mundo é impostor": todos só com a categoria, revela 🤡 e não dá pontos', () => {
    const scores = scoresOfRound1()
    const round2 = engine.step(scores, ctxAt(scores, { rng: seq(0.1) }))
    expect(round2.round).toBe(2)
    expect(impostorsOf(round2)).toEqual(round2.roster)
    expect(wordOf(round2)).toBeNull()
    expect(round2.chaosUsed).toEqual([]) // ainda segredo

    const vote = toPhase(round2, 'vote')
    const reveal = engine.step(vote, votesCtx(vote, { 1: 2, 2: 1, 3: 2, 4: 2, 5: 2 }))
    expect(reveal.reveal).toMatchObject({ chaos: 'everyone', accused: 2, caught: false })
    expect(reveal.chaosUsed).toEqual(['everyone'])
    const result = engine.step(reveal, ctxAt(reveal))
    expect(result.phase).toBe('result') // sem chute
    expect(result.outcome).toMatchObject({ word: null, gains: {}, hits: [], escaped: [] })
    expect(result.scores).toEqual(scores.scores)
  })

  it('"ninguém é impostor": todos com a palavra; o mais votado leva +2 (empate: todos os empatados)', () => {
    const scores = scoresOfRound1()
    const round2 = engine.step(scores, ctxAt(scores, { rng: seq(0.1, 0.7, 0.3) }))
    expect(impostorsOf(round2)).toEqual([])
    expect(round2.roster.every((id) => round2.private[String(id)].word === wordOf(round2))).toBe(true)

    const vote = toPhase(round2, 'vote')
    const reveal = engine.step(vote, votesCtx(vote, { 1: 2, 2: 1, 3: 2, 4: 1, 5: 3 }))
    expect(reveal.reveal).toMatchObject({ chaos: 'nobody', top: [1, 2], accused: null, caught: false })
    const result = engine.step(reveal, ctxAt(reveal))
    expect(result.outcome?.gains).toEqual({ 1: CONSOLATION_POINTS, 2: CONSOLATION_POINTS })
    expect(result.outcome?.word).toBe(wordOf(round2))
  })

  it('"ninguém é impostor" sem votos: ninguém ganha nada', () => {
    const vote = votingWith(4, [])
    const result = toPhase(vote, 'result')
    expect(result.reveal?.chaos).toBe('nobody')
    expect(result.outcome?.gains).toEqual({})
  })

  it('no máximo uma de cada por partida', () => {
    const scores = scoresOfRound1()
    const used = { ...scores, chaosUsed: ['everyone' as const, 'nobody' as const] }
    const next = engine.step(used, ctxAt(used, { rng: seq(0.01) }))
    expect(impostorsOf(next)).toHaveLength(1)
    const onlyNobodyLeft = { ...scores, chaosUsed: ['everyone' as const] }
    const nobody = engine.step(onlyNobodyLeft, ctxAt(onlyNobodyLeft, { rng: seq(0.01) }))
    expect(impostorsOf(nobody)).toEqual([])
  })

  it('opção desligada: nunca', () => {
    const scores = scoresOfRound1(5, { rounds: 4, chaos: false })
    const next = engine.step(scores, ctxAt(scores, { rng: seq(0.01) }))
    expect(impostorsOf(next)).toHaveLength(1)
  })

  it('impossível de perceber antes da revelação: o estado público tem o mesmo formato', () => {
    const scores = scoresOfRound1()
    const normal = engine.step(scores, ctxAt(scores, { rng: seq(0.9, 0.3, 0.6) }))
    const everyone = engine.step(scores, ctxAt(scores, { rng: seq(0.1) }))
    const nobody = engine.step(scores, ctxAt(scores, { rng: seq(0.1, 0.7, 0.3) }))
    expect(impostorsOf(normal)).toHaveLength(1)
    for (const phase of ['show', 'draw1', 'peek', 'draw2', 'gallery', 'vote'] as RaPhase[]) {
      const shapes = [normal, everyone, nobody].map((state) => {
        const visible = publicPart(toPhase(state, phase))
        expect(JSON.stringify(visible)).not.toMatch(/everyone|nobody/)
        expect(visible.chaosUsed).toEqual([])
        expect(visible.impostorCount).toBe(1)
        expect(visible.reveal).toBeNull()
        return Object.keys(visible).sort().join(',')
      })
      expect(new Set(shapes).size).toBe(1)
    }
    // O segredo de um impostor "normal" e o de um da rodada maluca são iguais.
    const normalImpostor = impostorsOf(normal)[0]
    expect(everyone.private['1']).toEqual(normal.private[String(normalImpostor)])
  })
})

describe('fluxo', () => {
  it('resultado → placar → próxima rodada; a última vai direto para o fim', () => {
    let state = start(3, { rounds: 3, chaos: false }).state
    for (let round = 1; round <= 3; round += 1) {
      expect(state.round).toBe(round)
      state = toPhase(state, 'result')
      state = engine.step(state, ctxAt(state))
      if (round < 3) {
        expect(state.phase).toBe('scores')
        const next = engine.step(state, ctxAt(state))
        expect(next.phase).toBe('show')
        expect(next.inputKey).toBe(keys.show(round + 1))
        expect(next.reveal).toBeNull()
        expect(next.outcome).toBeNull()
        state = next
      }
    }
    expect(state.phase).toBe('final')
    expect(state.over).toBe(true)
    expect(state.deadline).toBeNull()
    expect(state.history).toHaveLength(3)
    expect(engine.step(state, ctxAt(state, { now: NOW * 9 }))).toBe(state)
  })

  it('placar dura SCORES_SECONDS', () => {
    const result = toPhase(start(3).state, 'result')
    const scores = engine.step(result, ctxAt(result))
    expect(scores.deadline).toBe(result.deadline! + SCORES_SECONDS * 1000)
  })

  it('"Pular" do host pula qualquer fase; comando desconhecido não faz nada', () => {
    let state = start(4).state
    const order: RaPhase[] = []
    for (let id = 1; id <= 12 && !state.over; id += 1) {
      state = engine.step(state, makeCtx({ players: makePlayers(4), now: NOW + 10, command: { id, type: 'skip' } }))
      order.push(state.phase)
    }
    expect(order.slice(0, 9)).toEqual(['draw1', 'peek', 'draw2', 'gallery', 'vote', 'reveal', 'result', 'scores', 'show'])
    expect(engine.step(state, makeCtx({ players: makePlayers(4), now: NOW + 10, command: { id: 99, type: 'xyz' } }))).toBe(state)
  })

  it('"Encerrar" (over) congela tudo', () => {
    const { state } = start(3)
    const ended = { ...state, over: true }
    expect(engine.step(ended, ctxAt(ended, { now: NOW * 5 }))).toBe(ended)
  })
})

describe('bot', () => {
  it('desenha no slot, vota em outro do roster e só o acusado chuta', () => {
    const { state, ctx } = start(5)
    expect(engine.bot(state, 1, ctx)).toBeNull() // show
    const draw1 = toPhase(state, 'draw1')
    const reply = engine.bot(draw1, 2, ctx)
    expect(reply).toMatchObject({ _slot: 'draw', done: true })
    expect(Array.isArray(reply?.s)).toBe(true)

    const vote = toPhase(state, 'vote')
    for (let i = 0; i < 30; i += 1) {
      const answer = engine.bot(vote, 2, ctx)
      expect(vote.roster).toContain(answer?.vote)
      expect(answer?.vote).not.toBe(2)
    }
    expect(engine.bot(vote, 99, ctx)).toBeNull()
  })

  it('na 2ª etapa continua o desenho da 1ª', () => {
    const draw2 = toPhase(start(3).state, 'draw2')
    const first = [{ c: 1, p: [0.1, 0.1, 0.2, 0.2] }]
    const ctx = makeCtx({ players: makePlayers(3), slots: { draw: { 1: { k: 'draw1-1', s: first, done: true } } } })
    const reply = engine.bot(draw2, 1, ctx)
    expect((reply?.s as unknown[])[0]).toEqual(first[0])
    expect(reply?.n1).toBe(1)
  })
})

describe('fim', () => {
  it('prêmios: campeão, mestre do disfarce e olho de lince', () => {
    const { state } = start(4)
    const ended: State = {
      ...state,
      over: true,
      phase: 'final',
      scores: { 1: 4, 2: 1, 3: 4, 4: 0 },
      history: [
        { round: 1, categoryId: 0, word: 'Vampiro', impostors: [1], chaos: null, accused: 2, caught: false, guessRight: false, hits: [3], escaped: [1] },
        { round: 2, categoryId: 1, word: 'Saci', impostors: [1], chaos: null, accused: 3, caught: false, guessRight: false, hits: [3, 4], escaped: [1] },
        { round: 3, categoryId: 2, word: null, impostors: [1, 2, 3, 4], chaos: 'everyone', accused: null, caught: false, guessRight: false, hits: [], escaped: [] },
      ],
    }
    const awards = finalAwards(ended)
    expect(awards.champions).toEqual([1, 3])
    expect(awards.topScore).toBe(4)
    expect(awards.disguise).toEqual([1])
    expect(awards.maxEscapes).toBe(2)
    expect(awards.eagle).toEqual([3])
    expect(awards.maxHits).toBe(2)
    expect(awards.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [1, 1],
      [3, 1],
      [2, 3],
      [4, 4],
    ])
  })

  it('prêmios vazios quando ninguém pontuou', () => {
    const awards = finalAwards({ ...start(3).state, over: true })
    expect(awards.champions).toEqual([])
    expect(awards.disguise).toEqual([])
    expect(awards.eagle).toEqual([])
  })
})

// Dezenas de partidas inteiras: com a suíte toda rodando em paralelo, 5 s podem não bastar.
describe('simulações', { timeout: 60_000 }, () => {
  for (const players of [3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { rounds: 4, chaos: true } })
        expect(result.state.over).toBe(true)
        expect(result.state.round).toBe(4)
        expect(result.state.history).toHaveLength(4)
        const phases = new Set(result.history.map((state) => state.phase))
        for (const phase of ['show', 'draw1', 'peek', 'draw2', 'gallery', 'vote', 'reveal', 'result', 'scores', 'final']) {
          expect(phases).toContain(phase)
        }
      })
    }
  }

  it('várias sementes: rodadas malucas aparecem, e só depois da 1ª rodada', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = runSimulation(engine, { players: 6, seed, options: { rounds: 5, chaos: true } })
      for (const round of result.state.history) {
        if (round.chaos) {
          expect(round.round).toBeGreaterThan(1)
          kinds.add(round.chaos)
        }
      }
      const chaosRounds = result.state.history.filter((round) => round.chaos)
      expect(new Set(chaosRounds.map((round) => round.chaos)).size).toBe(chaosRounds.length)
    }
    expect([...kinds].sort()).toEqual(['everyone', 'nobody'])
  })

  it('o chute aparece quando a mesa pega o impostor', () => {
    let guesses = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const result = runSimulation(engine, { players: 5, seed, options: { rounds: 5, chaos: false } })
      guesses += result.history.filter((state) => state.phase === 'guess').length
    }
    expect(guesses).toBeGreaterThan(0)
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
    expect(result.state.impostorCount).toBe(1) // 7 na partida
  })

  it('com gente demorando ou sem agir', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5, options: { rounds: 3 } })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { rounds: 5 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(5)
  })

  it('15 jogadores com offline, pulos e pouca ação', () => {
    const result = runSimulation(engine, {
      players: 15,
      offlineIds: [4, 11],
      skipProbability: 0.15,
      actProbability: 0.2,
      seed: 21,
      options: { rounds: 5, chaos: true },
    })
    expect(result.state.over).toBe(true)
  })

  it('ninguém nunca age: termina pelos prazos', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { rounds: 3, chaos: false } })
    expect(result.state.over).toBe(true)
    // Ninguém votou: todo impostor escapou.
    expect(result.state.history.every((round) => round.escaped.length === 1)).toBe(true)
  })
})

describe('conteúdo', () => {
  it('8+ categorias com 12+ palavras desenháveis, sem repetir', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(8)
    expect(new Set(CATEGORIES.map((category) => category.name)).size).toBe(CATEGORIES.length)
    for (const category of CATEGORIES) {
      expect(category.words.length, category.name).toBeGreaterThanOrEqual(12)
      const normalized = category.words.map((word) => normalizeText(word.text))
      expect(new Set(normalized).size, category.name).toBe(normalized.length)
      for (const word of category.words) {
        expect(word.text.length).toBeGreaterThan(1)
        expect(word.text.length).toBeLessThanOrEqual(20)
      }
    }
  })

  it('nenhuma palavra é confundida com outra da mesma categoria no chute', () => {
    CATEGORIES.forEach((category, categoryId) => {
      for (const word of category.words) {
        const mine = answersFor(categoryId, word.text)
        expect(fuzzyMatch(word.text, mine), word.text).toBe(true)
        for (const other of category.words) {
          if (other === word) continue
          for (const typed of mine) {
            expect(fuzzyMatch(typed, answersFor(categoryId, other.text)), `"${typed}" bate com "${other.text}"`).toBe(false)
          }
        }
      }
    })
  })
})
