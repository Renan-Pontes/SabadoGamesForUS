import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { BLANK, BOT_ENDS, BOT_STARTS, PROMPTS } from './content'
import {
  MAX_ANSWER_CHARS,
  SCORES_SECONDS,
  VOTE_SECONDS,
  WRITE_SECONDS,
  answerKey,
  answerLength,
  cleanAnswer,
  collectVotes,
  engine,
  finalAwards,
  revealSeconds,
  type RdaState,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n) e as opções dadas. */
function start(n = 5, options: Record<string, unknown> = { rounds: 5 }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx com as respostas `{ jogador: valor }` da fase atual (campo `field`). */
function inputsCtx(
  state: RdaState,
  field: 'text' | 'card',
  values: Record<number, unknown>,
  extra: Partial<EngineCtx> = {},
): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, value] of Object.entries(values)) inputs[Number(id)] = { k: state.inputKey, [field]: value }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, inputs, ...extra })
}

const answersCtx = (state: RdaState, answers: Record<number, unknown>, extra: Partial<EngineCtx> = {}) =>
  inputsCtx(state, 'text', answers, extra)
const votesCtx = (state: RdaState, votes: Record<number, unknown>, extra: Partial<EngineCtx> = {}) =>
  inputsCtx(state, 'card', votes, extra)

/** Começa com `n` jogadores e fecha a escrita com estas respostas. */
function written(n: number, answers: Record<number, unknown>, options: Record<string, unknown> = { rounds: 5 }) {
  const { state } = start(n, options)
  return engine.step(state, answersCtx(state, answers, { now: state.deadline! }))
}

/** A carta de quem escreveu (pelo segredo do motor). */
function cardOf(state: RdaState, id: number): number {
  const card = state.private[String(id)]?.card
  if (card === undefined) throw new Error(`o jogador ${id} não tem carta`)
  return card
}

/** O estado como as telas recebem: sem `private`. */
function publicPart(state: RdaState) {
  const { private: _secret, ...rest } = state
  void _secret
  return rest
}

describe('início', () => {
  it('abre a escrita da rodada 1 com prazo e folga', () => {
    const { state } = start(5)
    expect(state.phase).toBe('write')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(5)
    expect(state.inputKey).toBe('write-1')
    expect(state.deadline).toBe(NOW + WRITE_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(state.prompt.text).toBe(PROMPTS[state.prompt.id].text)
    expect(state.cards).toEqual([])
    expect(state.private).toEqual({})
    expect(state.reveal).toBeNull()
    expect(state.over).toBe(false)
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('rodadas: 3/5/7, padrão 5, e frases sem repetir', () => {
    expect(start(4, {}).state.totalRounds).toBe(5)
    expect(start(4, { rounds: 7 }).state.totalRounds).toBe(7)
    expect(start(4, { rounds: 3 }).state.totalRounds).toBe(3)
    expect(start(4, { rounds: 6 }).state.totalRounds).toBe(5)
    expect(start(4, { rounds: '7' }).state.totalRounds).toBe(5)
    expect(start(4, optionDefaults(meta.options)).state.totalRounds).toBe(5)
    const { state } = start(4, { rounds: 7 })
    expect(new Set(state.deck).size).toBe(7)
  })
})

describe('respostas: limpeza', () => {
  it('tira espaço sobrando, quebra de linha e caractere invisível', () => {
    expect(cleanAnswer('  um   zumbi\n de\tpijama  ')).toBe('um zumbi de pijama')
    expect(cleanAnswer('pu​dim‮')).toBe('pudim')
    expect(cleanAnswer('🎃 abóbora')).toBe('🎃 abóbora')
  })

  it('vazio, só espaço, invisível ou não-texto não é resposta', () => {
    expect(cleanAnswer('')).toBe('')
    expect(cleanAnswer('   \n\t ')).toBe('')
    expect(cleanAnswer('​‍﻿')).toBe('')
    expect(cleanAnswer(42)).toBe('')
    expect(cleanAnswer(null)).toBe('')
    expect(cleanAnswer({ text: 'oi' })).toBe('')
    expect(cleanAnswer(['oi'])).toBe('')
  })

  it('texto gigante é cortado em 60 letras (emoji conta 1)', () => {
    const giant = cleanAnswer('a'.repeat(100_000))
    expect(giant).toBe('a'.repeat(MAX_ANSWER_CHARS))
    const emojis = cleanAnswer('👻'.repeat(80))
    expect(answerLength(emojis)).toBe(MAX_ANSWER_CHARS)
    expect(emojis).toBe('👻'.repeat(MAX_ANSWER_CHARS))
    // 60 certinho passa inteiro.
    expect(cleanAnswer('b'.repeat(60))).toHaveLength(60)
  })

  it('respostas iguais têm a mesma chave (sem acento, maiúscula e pontuação)', () => {
    expect(answerKey('Pudim!')).toBe(answerKey('pudim'))
    expect(answerKey('PÚDIM')).toBe(answerKey('pudim'))
    expect(answerKey('o  tio do pavê...')).toBe(answerKey('O tio do pave'))
    expect(answerKey('pudim')).not.toBe(answerKey('pudins'))
    // Só emoji: compara o emoji.
    expect(answerKey('🎃')).toBe(answerKey(' 🎃 '))
    expect(answerKey('🎃')).not.toBe(answerKey('👻'))
  })
})

describe('escrita', () => {
  it('atualiza os ✓ sem revelar nada e devolve o mesmo estado quando nada muda', () => {
    const { state } = start(5)
    const ctx = answersCtx(state, { 1: 'um zumbi', 3: 'pudim' })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('write')
    expect(next.acted).toEqual([1, 3])
    expect(JSON.stringify(next)).not.toContain('zumbi')
    expect(next.cards).toEqual([])
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('todo mundo online respondeu: abre a votação na hora, com cartas anônimas', () => {
    const { state } = start(4)
    const answers = { 1: 'um zumbi', 2: 'pudim', 3: 'o tio do pavê', 4: 'três morcegos' }
    const vote = engine.step(state, answersCtx(state, answers))
    expect(vote.phase).toBe('vote')
    expect(vote.inputKey).toBe('vote-1')
    expect(vote.deadline).toBe(NOW + 1000 + VOTE_SECONDS * 1000 + GRACE_MS)
    expect(vote.acted).toEqual([])
    expect(vote.cards.map((card) => card.id)).toEqual([0, 1, 2, 3])
    expect(vote.cards.map((card) => card.text).sort()).toEqual(Object.values(answers).sort())
    // Cada autor sabe qual é a dele — e só isso.
    for (const [id, text] of Object.entries(answers)) {
      const secret = vote.private[id]
      expect(secret).toEqual({ card: secret.card })
      expect(vote.cards[secret.card].text).toBe(text)
    }
    // A parte pública não diz quem escreveu o quê.
    for (const card of publicPart(vote).cards) expect(Object.keys(card).sort()).toEqual(['id', 'text'])
    expect(publicPart(vote).reveal).toBeNull()
  })

  it('embaralha pela sorte da partida — refazer a passagem dá as mesmas cartas', () => {
    const answers = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' }
    const orderFor = (seed: number) => {
      const state = engine.init(makeCtx({ players: makePlayers(5), now: NOW, rng: seededRng(seed), options: { rounds: 5 } }))
      // O juiz refez a passagem (gravação perdida no Wi-Fi): o ctx.rng muda, as cartas não.
      const first = engine.step(state, answersCtx(state, answers, { rng: seededRng(1) }))
      const retry = engine.step(state, answersCtx(state, answers, { rng: seededRng(999) }))
      expect(retry.cards).toEqual(first.cards)
      expect(retry.private).toEqual(first.private)
      return first.cards.map((card) => card.text).join('')
    }
    // Partidas diferentes, ordens diferentes.
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(orderFor)).size).toBeGreaterThan(1)
  })

  it('fase desconhecida (estado de outra versão) não trava: o "Pular" encerra', () => {
    const { state } = start(3)
    const odd = { ...state, phase: 'intro' } as unknown as RdaState
    const ctx = makeCtx({ players: makePlayers(3), now: NOW + 10 })
    expect(engine.step(odd, ctx)).toBe(odd)
    const ended = engine.step(odd, { ...ctx, command: { id: 1, type: 'skip' } })
    expect(ended.over).toBe(true)
  })

  it('vazio, só espaço, não-texto, de outra rodada e de espectador não contam', () => {
    const { state } = start(4)
    const ctx = makeCtx({
      players: makePlayers(6),
      now: NOW + 1000,
      inputs: {
        1: { k: state.inputKey, text: '' },
        2: { k: state.inputKey, text: '   ' },
        3: { k: state.inputKey, text: 42 },
        4: { k: 'write-0', text: 'resposta velha' },
        5: { k: state.inputKey, text: 'sou espectador' }, // entrou depois
      },
    })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('write')
    expect(next.acted).toEqual([])
    const closed = engine.step(next, { ...ctx, now: state.deadline! })
    expect(closed.phase).toBe('reveal')
    expect(closed.reveal?.kind).toBe('empty')
  })

  it('resposta gigante entra cortada em 60 letras', () => {
    const vote = written(3, { 1: 'x'.repeat(5000), 2: 'curta' })
    expect(vote.phase).toBe('vote')
    expect(vote.cards.map((card) => card.text.length).sort((a, b) => a - b)).toEqual([5, MAX_ANSWER_CHARS])
  })

  it('offline não segura a escrita', () => {
    const { state } = start(4)
    const ctx = answersCtx(state, { 1: 'a', 2: 'b', 3: 'c' }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(state, ctx).phase).toBe('vote')
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(4)
    const ctx = answersCtx(state, { 1: 'a', 2: 'b' })
    expect(engine.step(state, { ...ctx, now: state.deadline! - 1 }).phase).toBe('write')
    expect(engine.step(state, { ...ctx, now: state.deadline! }).phase).toBe('vote')
  })

  it('a resposta mais recente vale (dá para editar)', () => {
    const { state } = start(3)
    const first = engine.step(state, answersCtx(state, { 1: 'primeira ideia' }))
    const vote = engine.step(first, answersCtx(state, { 1: 'ideia melhor', 2: 'b', 3: 'c' }))
    expect(vote.cards.map((card) => card.text)).toContain('ideia melhor')
    expect(vote.cards.map((card) => card.text)).not.toContain('primeira ideia')
  })

  it('respostas iguais viram uma carta só, com os autores juntos', () => {
    const vote = written(5, { 1: 'Pudim!', 2: 'pudim', 3: 'Cerveja', 4: 'PÚDIM', 5: 'um zumbi' })
    expect(vote.phase).toBe('vote')
    expect(vote.cards).toHaveLength(3)
    expect(cardOf(vote, 1)).toBe(cardOf(vote, 2))
    expect(cardOf(vote, 1)).toBe(cardOf(vote, 4))
    // Vale o texto de quem vem primeiro na mesa.
    expect(vote.cards[cardOf(vote, 1)].text).toBe('Pudim!')
  })
})

describe('sem votação (pula com graça)', () => {
  it('ninguém respondeu: o além responde por vocês, sem pontos', () => {
    const { state } = start(3)
    const next = engine.step(state, makeCtx({ players: makePlayers(3), now: state.deadline! }))
    expect(next.phase).toBe('reveal')
    expect(next.reveal?.kind).toBe('empty')
    expect(next.reveal?.results).toEqual([])
    expect(next.reveal?.alem).toBe(PROMPTS[state.prompt.id].alem)
    expect(next.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
    expect(next.deadline).toBe(state.deadline! + 10_000)
    expect(next.best).toEqual([])
  })

  it('só uma resposta: vitória por W.O. com o bônus, sem votação', () => {
    const next = written(4, { 2: 'só eu respondi' })
    expect(next.phase).toBe('reveal')
    expect(next.reveal?.kind).toBe('solo')
    expect(next.reveal?.results).toEqual([
      { card: 0, text: 'só eu respondi', authors: [2], voters: [], points: 2, top: true },
    ])
    expect(next.reveal?.gained).toEqual({ 2: 2 })
    expect(next.scores).toEqual({ 1: 0, 2: 2, 3: 0, 4: 0 })
    expect(next.acted).toEqual([2])
    // W.O. não concorre a "resposta da noite" (ninguém votou nela).
    expect(next.best).toEqual([])
  })

  it('duas respostas iguais e mais nada: uma carta só, W.O. para os dois', () => {
    const next = written(3, { 1: 'Pudim', 3: 'pudim!!' })
    expect(next.reveal?.kind).toBe('solo')
    expect(next.reveal?.results[0].authors).toEqual([1, 3])
    expect(next.scores).toEqual({ 1: 2, 2: 0, 3: 2 })
  })

  it('a revelação sem votação passa para o placar e segue o jogo', () => {
    const solo = written(3, { 1: 'oi' })
    expect(solo.deadline).toBe(NOW + WRITE_SECONDS * 1000 + GRACE_MS + 9000)
    const scores = engine.step(solo, makeCtx({ players: makePlayers(3), now: solo.deadline! }))
    expect(scores.phase).toBe('scores')
    const round2 = engine.step(scores, makeCtx({ players: makePlayers(3), now: scores.deadline! }))
    expect(round2.phase).toBe('write')
    expect(round2.round).toBe(2)
  })
})

describe('votação', () => {
  const five = { 1: 'a1', 2: 'a2', 3: 'a3', 4: 'a4', 5: 'a5' }

  it('atualiza os ✓ e devolve o mesmo estado quando nada muda', () => {
    const vote = written(5, five)
    const ctx = votesCtx(vote, { 1: cardOf(vote, 2), 3: cardOf(vote, 1) })
    const next = engine.step(vote, ctx)
    expect(next.phase).toBe('vote')
    expect(next.acted).toEqual([1, 3])
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('+1 por voto e +2 para a mais votada', () => {
    const vote = written(5, five)
    const c = (id: number) => cardOf(vote, id)
    const next = engine.step(vote, votesCtx(vote, { 2: c(1), 3: c(1), 4: c(1), 1: c(2), 5: c(3) }))
    expect(next.phase).toBe('reveal')
    expect(next.reveal?.kind).toBe('vote')
    const results = next.reveal!.results
    expect(results).toHaveLength(5)
    expect(results[0]).toEqual({ card: c(1), text: 'a1', authors: [1], voters: [2, 3, 4], points: 5, top: true })
    expect(results.filter((result) => result.top)).toHaveLength(1)
    expect(results.find((result) => result.card === c(2))?.points).toBe(1)
    expect(results.find((result) => result.card === c(4))).toMatchObject({ voters: [], points: 0, top: false })
    expect(next.scores).toEqual({ 1: 5, 2: 1, 3: 1, 4: 0, 5: 0 })
    expect(next.reveal?.gained).toEqual({ 1: 5, 2: 1, 3: 1 })
    expect(next.reveal?.votes).toEqual({ 1: c(2), 2: c(1), 3: c(1), 4: c(1), 5: c(3) })
    expect(next.best).toEqual([{ round: 1, text: 'a1', authors: [1], votes: 3 }])
    expect(next.acted).toEqual([1, 2, 3, 4, 5])
    // Resultados da mais votada para a menos.
    const counts = results.map((result) => result.voters.length)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
  })

  it('empate na mais votada: o bônus divide (+1 para cada)', () => {
    const vote = written(5, five)
    const c = (id: number) => cardOf(vote, id)
    const next = engine.step(vote, votesCtx(vote, { 2: c(1), 3: c(1), 1: c(2), 4: c(2), 5: c(3) }))
    const tops = next.reveal!.results.filter((result) => result.top)
    expect(tops.map((result) => result.authors[0]).sort()).toEqual([1, 2])
    expect(next.scores).toEqual({ 1: 3, 2: 3, 3: 1, 4: 0, 5: 0 })
  })

  it('empate de muitas: todas as empatadas ganham +1', () => {
    const vote = written(4, { 1: 'a', 2: 'b', 3: 'c', 4: 'd' })
    const c = (id: number) => cardOf(vote, id)
    // Cada um vota no próximo: 4 cartas com 1 voto cada.
    const next = engine.step(vote, votesCtx(vote, { 1: c(2), 2: c(3), 3: c(4), 4: c(1) }))
    expect(next.reveal!.results.every((result) => result.top && result.points === 2)).toBe(true)
    expect(next.scores).toEqual({ 1: 2, 2: 2, 3: 2, 4: 2 })
  })

  it('não dá para votar na própria resposta', () => {
    const vote = written(3, { 1: 'a', 2: 'b', 3: 'c' })
    const ctx = votesCtx(vote, { 1: cardOf(vote, 1), 2: cardOf(vote, 1) })
    expect(collectVotes(vote, ctx)).toEqual({ 2: cardOf(vote, 1) })
    const waiting = engine.step(vote, ctx)
    expect(waiting.acted).toEqual([2]) // voto na própria não ganha ✓
    const revealed = engine.step(waiting, { ...ctx, now: vote.deadline! })
    expect(revealed.scores).toEqual({ 1: 1 + 2, 2: 0, 3: 0 })
  })

  it('quem escreveu igual também não vota na carta conjunta', () => {
    const vote = written(4, { 1: 'Pudim', 2: 'pudim!', 3: 'Bolo', 4: 'Sorvete' })
    const pudim = cardOf(vote, 1)
    const ctx = votesCtx(vote, { 1: pudim, 2: pudim, 3: pudim, 4: pudim })
    expect(collectVotes(vote, ctx)).toEqual({ 3: pudim, 4: pudim })
  })

  it('respostas iguais: cada autor leva os pontos da carta', () => {
    const vote = written(4, { 1: 'Pudim', 2: 'pudim!', 3: 'Bolo', 4: 'Sorvete' })
    const c = (id: number) => cardOf(vote, id)
    const next = engine.step(vote, votesCtx(vote, { 3: c(1), 4: c(1), 1: c(3), 2: c(4) }))
    expect(next.reveal!.results[0]).toMatchObject({ authors: [1, 2], voters: [3, 4], points: 4, top: true })
    expect(next.scores).toEqual({ 1: 4, 2: 4, 3: 1, 4: 1 })
  })

  it('ignora carta que não existe, lixo, voto de outra rodada e de espectador', () => {
    const vote = written(3, { 1: 'a', 2: 'b', 3: 'c' })
    const ctx = makeCtx({
      players: makePlayers(5),
      now: NOW + 1000,
      inputs: {
        1: { k: vote.inputKey, card: 99 }, // carta fora da mesa
        2: { k: 'vote-0', card: cardOf(vote, 1) }, // outra rodada
        3: { k: vote.inputKey, card: String(cardOf(vote, 1)) }, // lixo
        4: { k: vote.inputKey, card: cardOf(vote, 1) }, // espectador
      },
    })
    expect(collectVotes(vote, ctx)).toEqual({})
    const waiting = engine.step(vote, ctx)
    expect(waiting).toBe(vote)
    const revealed = engine.step(waiting, { ...ctx, now: vote.deadline! })
    expect(revealed.reveal?.votes).toEqual({})
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
  })

  it('quem não escreveu também vota', () => {
    const vote = written(3, { 1: 'a', 2: 'b' })
    const next = engine.step(vote, votesCtx(vote, { 3: cardOf(vote, 1) }))
    expect(next.acted).toEqual([3])
  })

  it('ninguém votou: revela os autores, sem pontos', () => {
    const vote = written(3, { 1: 'a', 2: 'b', 3: 'c' })
    const next = engine.step(vote, makeCtx({ players: makePlayers(3), now: vote.deadline! }))
    expect(next.phase).toBe('reveal')
    expect(next.reveal?.results).toHaveLength(3)
    expect(next.reveal?.results.every((result) => !result.top && result.points === 0)).toBe(true)
    expect(next.reveal?.results.flatMap((result) => result.authors).sort()).toEqual([1, 2, 3])
    expect(next.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
    expect(next.best).toEqual([])
  })

  it('offline não segura a votação; o prazo segura quem está online', () => {
    const vote = written(4, { 1: 'a', 2: 'b', 3: 'c', 4: 'd' })
    const c = (id: number) => cardOf(vote, id)
    const someone = votesCtx(vote, { 1: c(2), 2: c(1), 3: c(1) })
    expect(engine.step(vote, someone).phase).toBe('vote')
    expect(engine.step(vote, { ...someone, now: vote.deadline! - 1 }).phase).toBe('vote')
    expect(engine.step(vote, { ...someone, now: vote.deadline! }).phase).toBe('reveal')
    const offline = votesCtx(vote, { 1: c(2), 2: c(1), 3: c(1) }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(vote, offline).phase).toBe('reveal')
  })

  it('o voto mais recente vale (dá para trocar)', () => {
    const vote = written(3, { 1: 'a', 2: 'b', 3: 'c' })
    const c = (id: number) => cardOf(vote, id)
    const first = engine.step(vote, votesCtx(vote, { 1: c(2) }))
    const next = engine.step(first, votesCtx(vote, { 1: c(3), 2: c(3), 3: c(1) }))
    expect(next.reveal?.votes).toEqual({ 1: c(3), 2: c(3), 3: c(1) })
    expect(next.scores).toEqual({ 1: 1, 2: 0, 3: 2 + 2 })
  })
})

describe('depois da votação', () => {
  it('revelação → placar → próxima rodada, nos prazos, sem segredo velho', () => {
    const vote = written(3, { 1: 'a', 2: 'b', 3: 'c' })
    const revealed = engine.step(vote, votesCtx(vote, { 1: cardOf(vote, 2), 2: cardOf(vote, 1), 3: cardOf(vote, 1) }))
    const t1 = revealed.deadline!
    expect(t1).toBe(NOW + 1000 + revealSeconds(revealed.reveal!) * 1000)
    expect(engine.step(revealed, makeCtx({ players: makePlayers(3), now: t1 - 1 }))).toBe(revealed)

    const scores = engine.step(revealed, makeCtx({ players: makePlayers(3), now: t1 }))
    expect(scores.phase).toBe('scores')
    expect(scores.deadline).toBe(t1 + SCORES_SECONDS * 1000)
    expect(scores.reveal).toEqual(revealed.reveal) // o placar mostra o "+N" da rodada

    const round2 = engine.step(scores, makeCtx({ players: makePlayers(3), now: scores.deadline! }))
    expect(round2.phase).toBe('write')
    expect(round2.round).toBe(2)
    expect(round2.inputKey).toBe('write-2')
    expect(round2.acted).toEqual([])
    expect(round2.cards).toEqual([])
    expect(round2.private).toEqual({})
    expect(round2.reveal).toBeNull()
    expect(round2.prompt.id).not.toBe(vote.prompt.id)
    expect(round2.scores).toEqual(revealed.scores)
  })

  it('skip pula qualquer fase; comando desconhecido não faz nada', () => {
    const { state } = start(3)
    const skip = (s: RdaState, id: number, inputs: EngineCtx['inputs'] = {}) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, inputs, command: { id, type: 'skip' } }))
    const vote = skip(state, 1, { 1: { k: 'write-1', text: 'a' }, 2: { k: 'write-1', text: 'b' } })
    expect(vote.phase).toBe('vote')
    const revealed = skip(vote, 2)
    expect(revealed.phase).toBe('reveal')
    const scores = skip(revealed, 3)
    expect(scores.phase).toBe('scores')
    const round2 = skip(scores, 4)
    expect(round2.phase).toBe('write')
    expect(round2.round).toBe(2)
    const empty = skip(round2, 5)
    expect(empty.reveal?.kind).toBe('empty')
    expect(engine.step(round2, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 6, type: 'xyz' } }))).toBe(round2)
  })

  it('a última revelação termina a partida com os prêmios', () => {
    let { state } = start(3, { rounds: 3 })
    const at = (now: number, s: RdaState, values: Record<number, unknown> = {}, field: 'text' | 'card' = 'text') =>
      inputsCtx(s, field, values, { now })
    for (let round = 1; round <= 3; round += 1) {
      state = engine.step(state, at(NOW, state, { 1: `piada ${round}`, 2: `outra ${round}`, 3: `mais ${round}` }))
      expect(state.phase).toBe('vote')
      // O 1 sempre ganha (2 e 3 votam nele); o 1 vota no 2.
      const c = (id: number) => cardOf(state, id)
      state = engine.step(state, at(NOW, state, { 1: c(2), 2: c(1), 3: c(1) }, 'card'))
      expect(state.phase).toBe('reveal')
      state = engine.step(state, at(state.deadline!, state))
      if (round < 3) {
        expect(state.phase).toBe('scores')
        state = engine.step(state, at(state.deadline!, state))
      }
    }
    expect(state.phase).toBe('final')
    expect(state.over).toBe(true)
    expect(state.deadline).toBeNull()
    expect(engine.step(state, makeCtx({ players: makePlayers(3), now: NOW * 2 }))).toBe(state)

    const awards = finalAwards(state)
    expect(awards.champions).toEqual([1])
    expect(awards.topScore).toBe(3 * 4)
    expect(awards.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
    expect(state.best).toHaveLength(3)
    expect(awards.bestAnswer).toEqual({ round: 1, text: 'piada 1', authors: [1], votes: 2 })
  })

  it('prêmios vazios quando ninguém pontuou', () => {
    const { state } = start(3)
    const awards = finalAwards({ ...state, over: true })
    expect(awards.champions).toEqual([])
    expect(awards.bestAnswer).toBeNull()
    expect(awards.ranking).toHaveLength(3)
  })

  it('"Encerrar" do host no meio da votação: o fim desenha com o que tem', () => {
    const vote = written(3, { 1: 'a', 2: 'b' })
    const ended = { ...vote, over: true, deadline: null }
    expect(engine.step(ended, makeCtx({ players: makePlayers(3), now: NOW * 2 }))).toBe(ended)
    expect(finalAwards(ended).champions).toEqual([])
  })
})

describe('bot', () => {
  it('escreve resposta válida e nunca vota na própria', () => {
    const { state, ctx } = start(5)
    for (let i = 0; i < 20; i += 1) {
      const reply = engine.bot(state, 2, ctx)
      expect(cleanAnswer(reply?.text)).toBe(reply?.text)
    }
    const vote = written(5, { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' })
    for (let i = 0; i < 40; i += 1) {
      const reply = engine.bot(vote, 3, ctx)
      expect(vote.cards.map((card) => card.id)).toContain(reply?.card)
      expect(reply?.card).not.toBe(cardOf(vote, 3))
    }
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'reveal' }, 2, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { rounds: 5 } })
        expect(result.state.over).toBe(true)
        expect(result.state.round).toBe(5)
        const phases = new Set(result.history.map((state) => state.phase))
        expect([...phases]).toEqual(expect.arrayContaining(['write', 'vote', 'reveal', 'scores', 'final']))
        // Todo mundo responde e vota: cada rodada distribui pelo menos 1 ponto por eleitor.
        const total = Object.values(result.state.scores).reduce((sum, value) => sum + value, 0)
        expect(total).toBeGreaterThanOrEqual(5 * players)
      })
    }
  }

  it('7 rodadas com 15 jogadores', () => {
    const result = runSimulation(engine, { players: 15, seed: 9, options: { rounds: 7 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(7)
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com o host offline a partida inteira (ninguém depende dele)', () => {
    for (const players of [3, 8, 15]) {
      const result = runSimulation(engine, { players, offlineIds: [1], seed: players, options: { rounds: 3 } })
      expect(result.state.over).toBe(true)
      expect(result.state.roster).not.toContain(1)
    }
    // Host no roster que some no meio: os outros seguem sem esperar por ele.
    const { state } = start(4)
    const away = makePlayers(4, { offline: [1] })
    const vote = engine.step(state, answersCtx(state, { 2: 'b', 3: 'c', 4: 'd' }, { players: away }))
    expect(vote.phase).toBe('vote')
    const c = (id: number) => cardOf(vote, id)
    const revealed = engine.step(vote, votesCtx(vote, { 2: c(3), 3: c(4), 4: c(2) }, { players: away }))
    expect(revealed.phase).toBe('reveal')
  })

  it('com gente demorando ou sem responder', () => {
    for (const seed of [5, 6, 7]) {
      const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed, options: { rounds: 5 } })
      expect(result.state.over).toBe(true)
    }
  })

  it('com o host pulando fases', () => {
    for (const players of [3, 8, 15]) {
      const result = runSimulation(engine, { players, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { rounds: 7 } })
      expect(result.state.over).toBe(true)
      expect(result.state.round).toBe(7)
    }
  })

  it('ninguém nunca responde: termina pelos prazos, o além responde sempre', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { rounds: 3 } })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
    const kinds = result.history.filter((state) => state.phase === 'reveal').map((state) => state.reveal?.kind)
    expect(kinds).toEqual(['empty', 'empty', 'empty'])
  })

  it('o segredo de autoria nunca aparece na parte pública antes da revelação', () => {
    const result = runSimulation(engine, { players: 8, seed: 11, options: { rounds: 3 } })
    for (const state of result.history) {
      if (state.phase !== 'vote') continue
      for (const card of publicPart(state).cards) expect(Object.keys(card).sort()).toEqual(['id', 'text'])
      expect(publicPart(state).reveal).toBeNull()
    }
  })
})

describe('conteúdo', () => {
  it('50+ frases, todas diferentes, cada uma com uma lacuna só', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(50)
    expect(new Set(PROMPTS.map((prompt) => prompt.text)).size).toBe(PROMPTS.length)
    for (const prompt of PROMPTS) {
      expect(prompt.text.split(BLANK)).toHaveLength(2)
      expect(prompt.text.length).toBeLessThanOrEqual(80)
      // A resposta do além cabe no mesmo limite das respostas da mesa.
      expect(cleanAnswer(prompt.alem)).toBe(prompt.alem)
      expect(prompt.alem.length).toBeGreaterThan(2)
    }
  })

  it('as respostas dos bots cabem no limite', () => {
    for (const startText of BOT_STARTS) {
      for (const end of BOT_ENDS) expect(answerLength(`${startText} ${end}`)).toBeLessThanOrEqual(MAX_ANSWER_CHARS)
    }
  })

  it('revelação de 9 a 15 segundos', () => {
    expect(revealSeconds({ kind: 'empty', results: [] })).toBe(10)
    expect(revealSeconds({ kind: 'solo', results: [] })).toBe(9)
    const cards = (n: number) => Array.from({ length: n }, (_, card) => ({ card, text: 'x', authors: [], voters: [], points: 0, top: false }))
    expect(revealSeconds({ kind: 'vote', results: cards(2) })).toBe(9)
    expect(revealSeconds({ kind: 'vote', results: cards(15) })).toBe(15)
  })
})
