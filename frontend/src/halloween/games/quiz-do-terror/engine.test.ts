import { describe, expect, it } from 'vitest'
import { GRACE_MS, normalizeText, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { CATEGORIES, QUESTIONS, type QuizCategory } from './content'
import {
  REVEAL_SECONDS,
  SCORES_EVERY,
  SCORES_SECONDS,
  buildDeck,
  countChoices,
  engine,
  finalAwards,
  gabaritoOf,
  pointsBreakdown,
  pointsFor,
  scoreRows,
  speedPoints,
  streakBonus,
  type QuizState,
} from './engine'
import { meta } from './meta'

const NOW = 1_000_000
const WINDOW = 20_000

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 4, options: Record<string, unknown> = { questions: 8, seconds: 20 }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** Resposta de um jogador: alternativa e quando tocou (`after` ms depois da abertura, ou `at` cru). */
type Reply = { choice: unknown; after?: number; at?: unknown }

/** Respostas da pergunta da vez. Número sozinho = essa alternativa, tocada na hora em que abriu. */
function replies(state: QuizState, answers: Record<number, Reply | number>): Record<number, HInput> {
  const inputs: Record<number, HInput> = {}
  for (const [id, reply] of Object.entries(answers)) {
    const r: Reply = typeof reply === 'number' ? { choice: reply, after: 0 } : reply
    const at = 'at' in r ? r.at : state.startedAt + (r.after ?? 0)
    inputs[Number(id)] = { k: state.inputKey, choice: r.choice, at }
  }
  return inputs
}

function ctxAt(state: QuizState, now: number, answers: Record<number, Reply | number> = {}, extra: Partial<EngineCtx> = {}) {
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now, inputs: replies(state, answers), ...extra })
}

const right = (state: QuizState) => gabaritoOf(state)
const wrong = (state: QuizState) => (gabaritoOf(state) + 1) % 4

/** Fecha a pergunta no prazo com estas respostas e avança até a próxima pergunta (passando pelo placar). */
function closeAndNext(state: QuizState, answers: Record<number, Reply | number>) {
  const revealed = engine.step(state, ctxAt(state, state.deadline!, answers))
  expect(revealed.phase).toBe('reveal')
  let next = engine.step(revealed, ctxAt(revealed, revealed.deadline!))
  if (next.phase === 'scores') next = engine.step(next, ctxAt(next, next.deadline!))
  return { revealed, next }
}

describe('início', () => {
  it('abre a pergunta 1 com prazo, folga e as alternativas embaralhadas', () => {
    const { state } = start(4)
    expect(state.phase).toBe('question')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(8)
    expect(state.seconds).toBe(20)
    expect(state.inputKey).toBe('q-1')
    expect(state.startedAt).toBe(NOW)
    expect(state.deadline).toBe(NOW + WINDOW + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(state.streaks).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(state.acted).toEqual([])
    expect(state.reveal).toBeNull()
    expect(state.over).toBe(false)

    const item = QUESTIONS[state.question.id]
    expect(state.question.text).toBe(item.text)
    expect(state.question.category).toBe(item.category)
    expect([...state.question.options].sort()).toEqual([item.answer, ...item.wrong].sort())
    expect(state.question.options[gabaritoOf(state)]).toBe(item.answer)
    expect(state.private?.gabarito).toBe(gabaritoOf(state))
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    const state = engine.init(ctx)
    expect(state.roster).toEqual([1, 3, 5])
    expect(Object.keys(state.scores)).toEqual(['1', '3', '5'])
  })

  it('opções: perguntas 8/10/15 (padrão 10) e tempo 15/20 s (padrão 20)', () => {
    expect(start(3, {}).state.totalRounds).toBe(10)
    expect(start(3, {}).state.seconds).toBe(20)
    const fast = start(3, { questions: 15, seconds: 15 }).state
    expect(fast.totalRounds).toBe(15)
    expect(fast.seconds).toBe(15)
    expect(fast.deadline).toBe(NOW + 15_000 + GRACE_MS)
    // Valor fora da lista ou de outro tipo volta ao padrão.
    expect(start(3, { questions: 12, seconds: 30 }).state.totalRounds).toBe(10)
    expect(start(3, { questions: 12, seconds: 30 }).state.seconds).toBe(20)
    expect(start(3, { questions: '8', seconds: '15' }).state.totalRounds).toBe(10)
    const defaults = start(3, optionDefaults(meta.options)).state
    expect([defaults.totalRounds, defaults.seconds]).toEqual([10, 20])
  })

  it('baralho sem repetir e com os temas misturados', () => {
    const categories = Object.keys(CATEGORIES) as QuizCategory[]
    for (let seed = 1; seed <= 25; seed += 1) {
      const deck = buildDeck(seededRng(seed), 15)
      expect(deck).toHaveLength(15)
      expect(new Set(deck).size).toBe(15)
      // As quatro primeiras são uma de cada tema; nenhum tema domina a partida.
      expect(new Set(deck.slice(0, 4).map((id) => QUESTIONS[id].category)).size).toBe(4)
      for (const category of categories) {
        expect(deck.filter((id) => QUESTIONS[id].category === category).length).toBeLessThanOrEqual(4)
      }
    }
    const all = buildDeck(seededRng(9), 9999)
    expect(all).toHaveLength(QUESTIONS.length)
    expect(new Set(all).size).toBe(QUESTIONS.length)
    expect(buildDeck(seededRng(9), 0)).toEqual([])
  })

  it('o gabarito fica só no private: a parte pública não entrega a resposta', () => {
    const { state } = start(4)
    const { private: secret, ...visible } = state
    expect(secret).toEqual({ gabarito: expect.any(Number) })
    expect(visible.reveal).toBeNull()
    expect(JSON.stringify(visible)).not.toContain('gabarito')
    expect(JSON.stringify(visible)).not.toContain('correct')
  })
})

describe('pergunta aberta', () => {
  it('marca ✓ de quem respondeu e devolve o mesmo estado quando nada muda', () => {
    const { state } = start(4)
    const ctx = ctxAt(state, NOW + 2000, { 1: right(state), 3: wrong(state) })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('question')
    expect(next.acted).toEqual([1, 3])
    expect(next.reveal).toBeNull()
    expect(engine.step(next, ctx)).toBe(next)
    // Sem resposta nova, nem o ✓ muda.
    expect(engine.step(state, ctxAt(state, NOW + 2000))).toBe(state)
  })

  it('todo mundo online respondeu: revela na hora, com a certa e quem escolheu o quê', () => {
    const { state } = start(4)
    const r = right(state)
    const w = wrong(state)
    const next = engine.step(state, ctxAt(state, NOW + 3000, { 1: r, 2: w, 3: r, 4: w }))
    expect(next.phase).toBe('reveal')
    expect(next.deadline).toBe(NOW + 3000 + REVEAL_SECONDS * 1000)
    expect(next.acted).toEqual([1, 2, 3, 4])
    expect(next.reveal?.correct).toBe(r)
    expect(next.reveal?.choices).toEqual({ 1: r, 2: w, 3: r, 4: w })
    expect(Object.keys(next.reveal?.points ?? {})).toEqual(['1', '3'])
    expect(countChoices(next.reveal!, 4)[r]).toBe(2)
    expect(countChoices(next.reveal!, 4)[w]).toBe(2)
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(4)
    const answers = { 1: right(state), 2: wrong(state) }
    expect(engine.step(state, ctxAt(state, state.deadline! - 1, answers)).phase).toBe('question')
    expect(engine.step(state, ctxAt(state, state.deadline!, answers)).phase).toBe('reveal')
  })

  it('offline não segura a pergunta', () => {
    const { state } = start(4)
    const ctx = ctxAt(state, NOW + 1000, { 1: 0, 2: 1, 3: 2 }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(state, ctx).phase).toBe('reveal')
  })

  it('ninguém online: espera o prazo em vez de revelar na hora', () => {
    const { state } = start(3)
    const offline = { players: makePlayers(3, { offline: [1, 2, 3] }) }
    expect(engine.step(state, ctxAt(state, NOW + 1000, {}, offline))).toBe(state)
    expect(engine.step(state, ctxAt(state, state.deadline!, {}, offline)).phase).toBe('reveal')
  })

  it('vale a última resposta que chegou (dá para trocar até fechar)', () => {
    const { state } = start(3)
    const first = engine.step(state, ctxAt(state, NOW + 1000, { 1: wrong(state) }))
    const next = engine.step(first, ctxAt(state, NOW + 2000, { 1: right(state), 2: 0, 3: 1 }))
    expect(next.phase).toBe('reveal')
    expect(next.reveal?.choices[1]).toBe(right(state))
    expect(next.reveal?.points[1]).toBeGreaterThan(0)
  })

  it('ignora alternativa inválida, resposta de outra pergunta e de quem não está na partida', () => {
    const { state } = start(4)
    const inputs: Record<number, HInput> = {
      1: { k: state.inputKey, choice: 4, at: NOW }, // não existe
      2: { k: state.inputKey, choice: -1, at: NOW },
      3: { k: state.inputKey, choice: '2', at: NOW }, // texto
      4: { k: state.inputKey, choice: 1.5, at: NOW }, // quebrado
      5: { k: state.inputKey, choice: right(state), at: NOW }, // espectador (entrou depois)
      6: { k: 'q-0', choice: right(state), at: NOW }, // outra pergunta
    }
    const ctx = makeCtx({ players: makePlayers(6), now: NOW + 1000, inputs })
    const waiting = engine.step(state, ctx)
    expect(waiting).toBe(state)
    const revealed = engine.step(waiting, { ...ctx, now: state.deadline! })
    expect(revealed.reveal?.choices).toEqual({})
    expect(revealed.reveal?.points).toEqual({})
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(revealed.acted).toEqual([])
  })

  it('null, objeto ou alternativa ausente também não contam', () => {
    const { state } = start(3)
    const inputs: Record<number, HInput> = {
      1: { k: state.inputKey, choice: null },
      2: { k: state.inputKey, choice: { index: 1 } },
      3: { k: state.inputKey, at: NOW },
    }
    const next = engine.step(state, makeCtx({ players: makePlayers(3), now: NOW + 1000, inputs }))
    expect(next).toBe(state)
  })
})

describe('pontuação', () => {
  it('rapidez de 500 a 0 (de 10 em 10), sequência até +300', () => {
    expect(speedPoints(0, WINDOW)).toBe(500)
    expect(speedPoints(5000, WINDOW)).toBe(380)
    expect(speedPoints(10_000, WINDOW)).toBe(250)
    expect(speedPoints(WINDOW, WINDOW)).toBe(0)
    expect(speedPoints(WINDOW + 1500, WINDOW)).toBe(0)
    expect(speedPoints(-500, WINDOW)).toBe(500)
    expect(speedPoints(Number.NaN, WINDOW)).toBe(0)
    expect(speedPoints(100, 0)).toBe(0)
    expect([0, 1, 2, 3, 4, 5, 9].map(streakBonus)).toEqual([0, 0, 100, 200, 300, 300, 300])
    expect(pointsFor(0, WINDOW, 1)).toBe(1000)
    expect(pointsFor(WINDOW, WINDOW, 4)).toBe(800)
    expect(pointsBreakdown(1100, 2)).toEqual({ base: 500, speed: 500, streak: 100 })
    expect(pointsBreakdown(880, 1)).toEqual({ base: 500, speed: 380, streak: 0 })
    expect(pointsBreakdown(0, 0)).toEqual({ base: 0, speed: 0, streak: 0 })
  })

  it('acerto = 500 + até 500 pela rapidez, com o horário limitado à pergunta', () => {
    const { state } = start(8)
    const r = right(state)
    const revealed = engine.step(
      state,
      ctxAt(state, state.deadline!, {
        1: { choice: r, after: 0 }, // na hora: 1000
        2: { choice: r, after: 10_000 }, // na metade: 750
        3: { choice: r, after: WINDOW }, // no zero do relógio: 500
        4: { choice: r, after: WINDOW + 1000 }, // na folga: ainda vale 500
        5: { choice: r, at: NOW - 60_000 }, // antes de abrir (relógio torto): conta como na hora
        6: { choice: r, at: state.deadline! + 60_000 }, // depois do prazo: conta como no fim
        7: { choice: r, at: 'agora' }, // sem horário: vale a hora em que fechou
        8: { choice: wrong(state), after: 0 }, // errou: nada
      }),
    )
    expect(revealed.reveal?.points).toEqual({ 1: 1000, 2: 750, 3: 500, 4: 500, 5: 1000, 6: 500, 7: 500 })
    expect(revealed.scores).toEqual({ 1: 1000, 2: 750, 3: 500, 4: 500, 5: 1000, 6: 500, 7: 500, 8: 0 })
    expect(revealed.reveal?.times[1]).toBe(0)
    expect(revealed.reveal?.times[2]).toBe(10_000)
    expect(revealed.reveal?.times[6]).toBe(WINDOW + GRACE_MS)
    expect(revealed.reveal?.fastest).toEqual([1, 5])
    expect(revealed.quickest).toMatchObject({ 1: 1, 5: 1, 2: 0 })
    expect(revealed.hits).toMatchObject({ 1: 1, 7: 1, 8: 0 })
    expect(revealed.streaks).toMatchObject({ 1: 1, 7: 1, 8: 0 })
  })

  it('pergunta que fecha antes do prazo: ninguém marca horário depois do fechamento', () => {
    const { state } = start(3)
    const r = right(state)
    // Todos responderam; o juiz fecha 4 s depois de abrir.
    const revealed = engine.step(
      state,
      ctxAt(state, NOW + 4000, {
        1: { choice: r, after: 2000 },
        2: { choice: r, at: 'sem horário' }, // vale a hora do fechamento (4 s)
        3: { choice: r, after: 15_000 }, // "no futuro": limitado aos 4 s
      }),
    )
    expect(revealed.reveal?.points).toEqual({ 1: 950, 2: 900, 3: 900 })
    expect(revealed.reveal?.times).toEqual({ 1: 2000, 2: 4000, 3: 4000 })
  })

  it('sequência: +100 por acerto seguido a partir do segundo, no máximo +300; errar ou faltar zera', () => {
    let { state } = start(3, { questions: 8, seconds: 20 })
    const gained: Record<number, number[]> = { 1: [], 2: [], 3: [] }
    // 1 acerta sempre na hora; 2 acerta, erra, acerta, acerta, falta, acerta; 3 nunca responde.
    const plan2 = ['r', 'w', 'r', 'r', '-', 'r']
    for (let round = 0; round < 6; round += 1) {
      const answers: Record<number, number> = { 1: right(state) }
      if (plan2[round] === 'r') answers[2] = right(state)
      if (plan2[round] === 'w') answers[2] = wrong(state)
      const { revealed, next } = closeAndNext(state, answers)
      for (const id of [1, 2, 3]) gained[id].push(revealed.reveal?.points[id] ?? 0)
      state = next
    }
    expect(gained[1]).toEqual([1000, 1100, 1200, 1300, 1300, 1300])
    expect(gained[2]).toEqual([1000, 0, 1000, 1100, 0, 1000])
    expect(gained[3]).toEqual([0, 0, 0, 0, 0, 0])
    expect(state.scores).toEqual({ 1: 7200, 2: 4100, 3: 0 })
    expect(state.streaks).toEqual({ 1: 6, 2: 1, 3: 0 })
    expect(state.bestStreaks).toEqual({ 1: 6, 2: 2, 3: 0 })
    expect(state.hits).toEqual({ 1: 6, 2: 4, 3: 0 })
  })

  it('ninguém respondeu: revela sem pontos, sem mais rápido e zera as sequências', () => {
    let { state } = start(3)
    state = closeAndNext(state, { 1: right(state) }).next
    expect(state.streaks[1]).toBe(1)
    const revealed = engine.step(state, ctxAt(state, state.deadline!))
    expect(revealed.reveal).toEqual({ correct: right(state), choices: {}, points: {}, times: {}, fastest: [] })
    expect(revealed.streaks).toEqual({ 1: 0, 2: 0, 3: 0 })
    expect(revealed.scores).toEqual({ 1: 1000, 2: 0, 3: 0 })
  })

  it('ninguém acertou: todos com escolha, ninguém com ponto', () => {
    const { state } = start(3)
    const misses = [0, 1, 2, 3].filter((index) => index !== right(state))
    const revealed = engine.step(state, ctxAt(state, NOW + 1000, { 1: misses[0], 2: misses[1], 3: misses[2] }))
    expect(revealed.phase).toBe('reveal')
    expect(Object.keys(revealed.reveal!.choices)).toHaveLength(3)
    expect(revealed.reveal?.points).toEqual({})
    expect(revealed.reveal?.fastest).toEqual([])
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
  })

  it('empate no mais rápido: os dois ganham o "dedo rápido"', () => {
    const { state } = start(3)
    const r = right(state)
    const revealed = engine.step(state, ctxAt(state, NOW + 5000, { 1: { choice: r, after: 1200 }, 2: { choice: r, after: 1200 }, 3: { choice: r, after: 3000 } }))
    expect(revealed.reveal?.fastest).toEqual([1, 2])
    expect(revealed.quickest).toEqual({ 1: 1, 2: 1, 3: 0 })
  })
})

describe('depois da pergunta', () => {
  it('revelação → próxima pergunta, com placar a cada 3 perguntas e pódio no fim', () => {
    let { state } = start(3, { questions: 8, seconds: 15 })
    const phases: string[] = []
    const seen = new Set<number>([state.question.id])
    for (let guard = 0; guard < 100 && !state.over; guard += 1) {
      const before = state
      state = engine.step(state, ctxAt(state, state.deadline!, state.phase === 'question' ? { 1: right(state) } : {}))
      phases.push(state.phase)
      if (state.phase === 'question') {
        expect(state.round).toBe(before.round + 1)
        expect(state.inputKey).toBe(`q-${state.round}`)
        expect(state.deadline).toBe(before.deadline! + 15_000 + GRACE_MS)
        expect(state.acted).toEqual([])
        expect(state.reveal).toBeNull()
        expect(seen.has(state.question.id)).toBe(false)
        seen.add(state.question.id)
      }
      if (state.phase === 'reveal') expect(state.deadline).toBe(before.deadline! + REVEAL_SECONDS * 1000)
      if (state.phase === 'scores') {
        expect(state.round % SCORES_EVERY).toBe(0)
        expect(state.deadline).toBe(before.deadline! + SCORES_SECONDS * 1000)
      }
    }
    expect(phases.filter((phase) => phase === 'scores')).toHaveLength(2) // depois da 3ª e da 6ª
    expect(phases.filter((phase) => phase === 'reveal')).toHaveLength(8)
    expect(phases.at(-1)).toBe('final')
    expect(state.over).toBe(true)
    expect(state.deadline).toBeNull()
    expect(state.round).toBe(8)
    expect(engine.step(state, ctxAt(state, NOW * 2))).toBe(state)
  })

  it('o placar mostrado vira a referência do próximo', () => {
    let { state } = start(3, { questions: 8, seconds: 20 })
    for (let round = 1; round <= 3; round += 1) state = closeAndNext(state, { 1: right(state) }).next
    expect(state.round).toBe(4)
    expect(state.board).toEqual({ 1: 3300, 2: 0, 3: 0 })
    expect(state.scores).toEqual(state.board)
  })

  it('skip pula qualquer fase; comando desconhecido não faz nada', () => {
    const { state } = start(3, { questions: 8, seconds: 20 })
    const skip = (s: QuizState, id: number) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id, type: 'skip' } }))
    let current = state
    const phases: string[] = []
    for (let id = 1; id <= 40 && !current.over; id += 1) {
      current = skip(current, id)
      phases.push(current.phase)
    }
    expect(current.over).toBe(true)
    expect(current.round).toBe(8)
    expect(phases).toEqual(expect.arrayContaining(['reveal', 'scores', 'question', 'final']))
    const fresh = start(3).state
    expect(engine.step(fresh, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 9, type: 'xyz' } }))).toBe(fresh)
  })

  it('encerrado pelo host no meio (over = true): o motor não mexe mais', () => {
    const { state } = start(3)
    const ended = { ...state, over: true }
    expect(engine.step(ended, ctxAt(state, state.deadline! + 1, { 1: right(state), 2: 0, 3: 1 }))).toBe(ended)
    expect(engine.bot(ended, 1, makeCtx())).toBeNull()
  })

  it('scoreRows: quanto cada um ganhou desde o último placar e quem subiu', () => {
    const { state } = start(3)
    const rows = scoreRows({
      ...state,
      board: { 1: 0, 2: 1000, 3: 500 },
      scores: { 1: 2000, 2: 1500, 3: 500 },
      streaks: { 1: 3, 2: 0, 3: 0 },
    })
    expect(rows).toEqual([
      { id: 1, score: 2000, place: 1, gained: 2000, moved: 2, streak: 3 },
      { id: 2, score: 1500, place: 2, gained: 500, moved: -1, streak: 0 },
      { id: 3, score: 500, place: 3, gained: 0, moved: -1, streak: 0 },
    ])
  })

  it('prêmios do fim: campeões empatados, maior sequência e dedo mais rápido', () => {
    const { state } = start(4)
    const awards = finalAwards({
      ...state,
      over: true,
      scores: { 1: 3000, 2: 3000, 3: 1200, 4: 0 },
      bestStreaks: { 1: 2, 2: 3, 3: 3, 4: 0 },
      quickest: { 1: 2, 2: 0, 3: 1, 4: 0 },
    })
    expect(awards.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [1, 1],
      [2, 1],
      [3, 3],
      [4, 4],
    ])
    expect(awards.champions).toEqual([1, 2])
    expect(awards.topScore).toBe(3000)
    expect(awards.bestStreak).toEqual({ ids: [2, 3], streak: 3 })
    expect(awards.fastest).toEqual({ ids: [1], count: 2 })
  })

  it('prêmios vazios quando ninguém pontuou', () => {
    const { state } = start(3)
    const awards = finalAwards({ ...state, over: true, bestStreaks: { 1: 1, 2: 0, 3: 0 } })
    expect(awards.champions).toEqual([])
    expect(awards.bestStreak.ids).toEqual([]) // sequência de 1 não é sequência
    expect(awards.fastest.ids).toEqual([])
  })

  it('countChoices ignora lixo', () => {
    expect(countChoices({ correct: 0, choices: { 1: 0, 2: 3, 3: 3, 4: 9, 5: -1 }, points: {}, times: {}, fastest: [] }, 4)).toEqual([1, 0, 0, 2])
  })
})

describe('bot', () => {
  it('só responde na pergunta, com alternativa válida e o horário de agora', () => {
    const { state, ctx } = start(5)
    let hits = 0
    for (let i = 0; i < 60; i += 1) {
      const reply = engine.bot(state, 2, { ...ctx, rng: seededRng(i + 1) })
      expect(reply).not.toBeNull()
      expect([0, 1, 2, 3]).toContain(reply?.choice)
      expect(reply?.at).toBe(ctx.now)
      if (reply?.choice === right(state)) hits += 1
    }
    expect(hits).toBeGreaterThan(20)
    expect(hits).toBeLessThan(60)
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'reveal' }, 2, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'scores' }, 2, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [1, 3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogador(es), semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { questions: 10, seconds: 20 } })
        const state = result.state
        expect(state.over).toBe(true)
        expect(state.phase).toBe('final')
        expect(state.round).toBe(10)
        expect(result.history.filter((moment) => moment.phase === 'scores')).toHaveLength(3)
        const scores = Object.values(state.scores)
        expect(scores).toHaveLength(players)
        for (const score of scores) {
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(10 * 1300)
          expect(score % 10).toBe(0)
        }
        expect(scores.reduce((sum, score) => sum + score, 0)).toBeGreaterThan(0)
      })
    }
  }

  it('15 perguntas de 15 s com 15 pessoas', () => {
    const result = runSimulation(engine, { players: 15, seed: 11, options: { questions: 15, seconds: 15 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(15)
    expect(new Set(result.state.deck).size).toBe(15)
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem responder', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5, options: { questions: 8 } })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { questions: 15 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(15)
  })

  it('o host pula tudo, sem ninguém responder', () => {
    const result = runSimulation(engine, { players: 4, skipProbability: 1, actProbability: 0, seed: 3 })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
  })

  it('ninguém nunca responde: termina pelos prazos, sem pontos', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { questions: 8 } })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
  })

  it('aguenta lixo, gente caindo e voltando, relógio pulando (troca de juiz) e comandos aleatórios', () => {
    const junkChoices: unknown[] = [0, 1, 2, 3, 4, -1, 1.5, '2', null, undefined, Number.NaN, {}, [1], true]
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = seededRng(seed)
      const pickOne = <T,>(items: readonly T[]) => items[Math.floor(rng() * items.length)]
      let players = makePlayers(1 + Math.floor(rng() * 15))
      let now = NOW
      let state = engine.init(makeCtx({ players, now, rng, options: { questions: pickOne([8, 10, 15]), seconds: pickOne([15, 20]) } }))
      let commandId = 0
      for (let step = 0; step < 3000 && !state.over; step += 1) {
        players = players.map((player) => ({ ...player, online: rng() < 0.85 }))
        const inputs: Record<number, HInput> = {}
        for (const player of [...players, { id: 99 }]) {
          if (rng() < 0.4) continue
          const at = pickOne<unknown>([now, now - 99_999, now + 99_999, 'agora', Number.NaN, Number.POSITIVE_INFINITY, undefined])
          inputs[player.id] = { k: rng() < 0.9 ? state.inputKey : 'q-0', choice: pickOne(junkChoices), at }
        }
        const command = rng() < 0.04 ? { id: (commandId += 1), type: pickOne(['skip', 'xyz', 'end-ish']) } : null
        // O relógio às vezes volta um pouco: o juiz novo pode ter o relógio atrás.
        now += Math.floor(rng() * 3000) - 400
        const ctx = makeCtx({ players, now, inputs, rng, command })
        const next = engine.step(state, ctx)
        expect(engine.step(next, { ...ctx, command: null }), `semente ${seed}, passo ${step}`).toBe(next)
        expect(JSON.parse(JSON.stringify(next)), `semente ${seed}: estado que não vira JSON`).toEqual(next)
        expect(next.roster).toEqual(state.roster)
        expect(next.round).toBeGreaterThanOrEqual(state.round)
        expect(next.round).toBeLessThanOrEqual(next.totalRounds)
        if (!next.over) expect(typeof next.deadline).toBe('number')
        if (next.phase === 'question') expect(next.reveal).toBeNull()
        state = JSON.parse(JSON.stringify(next)) as QuizState
      }
      expect(state.over, `semente ${seed} não terminou`).toBe(true)
      for (const score of Object.values(state.scores)) {
        expect(score % 10).toBe(0)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(state.totalRounds * 1300)
      }
    }
  })
})

describe('conteúdo', () => {
  it('60+ perguntas, todas diferentes, no formato certo', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(QUESTIONS.map((question) => normalizeText(question.text))).size).toBe(QUESTIONS.length)
    for (const question of QUESTIONS) {
      expect(Object.keys(CATEGORIES)).toContain(question.category)
      expect(question.text.length, question.text).toBeGreaterThan(10)
      expect(question.text.length, question.text).toBeLessThanOrEqual(90)
      const options = [question.answer, ...question.wrong]
      expect(new Set(options.map((option) => option.trim().toLowerCase())).size, question.text).toBe(4)
      for (const option of options) {
        expect(option.trim(), question.text).toBe(option)
        expect(option.length, `${question.text} → ${option}`).toBeGreaterThan(0)
        expect(option.length, `${question.text} → ${option}`).toBeLessThanOrEqual(26)
      }
    }
  })

  it('lenda com versões que brigam fica de fora (o lobisomem é o 7º ou o 8º filho?)', () => {
    // "Sétimo filho" e "oitavo filho depois de sete filhas" circulam as duas:
    // quem sabe a outra versão erraria sabendo. Na dúvida, fora.
    expect(QUESTIONS.filter((question) => /qual filho/i.test(question.text)).map((question) => question.text)).toEqual([])
  })

  it('pergunta sobre ator pede o ator, não o personagem', () => {
    // As alternativas são atores: a pergunta precisa dizer isso.
    const shining = QUESTIONS.find((question) => question.text.includes("Here's Johnny"))
    expect(shining?.answer).toBe('Jack Nicholson')
    expect(shining?.text).toMatch(/ator/i)
  })

  it('cada tema tem pelo menos 12 perguntas', () => {
    for (const category of Object.keys(CATEGORIES)) {
      expect(QUESTIONS.filter((question) => question.category === category).length, category).toBeGreaterThanOrEqual(12)
    }
  })

  it('o texto de uma pergunta não entrega a resposta de outra', () => {
    // Respostas que aparecem no texto de outras perguntas sem entregar nada:
    // monstros famosos que todo mundo já conhece de nome, e a sexta-feira 13.
    const harmless = new Set(['vampiro', 'morcego', 'fantasma', 'curupira', 'sexta feira'])
    for (const giver of QUESTIONS) {
      const words = ` ${normalizeText(giver.text)} `
      for (const taker of QUESTIONS) {
        if (taker === giver) continue
        const answer = normalizeText(taker.answer)
        if (answer.replace(/ /g, '').length < 5 || harmless.has(answer)) continue
        expect(words.includes(` ${answer} `), `“${giver.text}” entrega “${taker.answer}” (${taker.text})`).toBe(false)
      }
    }
  })
})
