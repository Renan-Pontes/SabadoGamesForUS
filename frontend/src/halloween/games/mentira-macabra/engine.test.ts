import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { BLANK, FACTS, factById } from './content'
import {
  CHOOSE_SECONDS,
  MIN_LIES,
  REVEAL_FAST_STEP_MS,
  REVEAL_INTRO_MS,
  REVEAL_STEP_MS,
  REVEAL_TRUTH_MS,
  SCORES_SECONDS,
  WRITE_SECONDS,
  engine,
  finalAwards,
  revealEnd,
  revealMoment,
  truthAt,
  truthOptionId,
  type MmState,
} from './engine'
import { meta } from './meta'
import { MAX_LIE_CHARS, cleanLie, fillBlank, isTruth, lieKey, similarLies, splitBlank } from './text'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 5, options: Record<string, unknown> = { rounds: 6 }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** Troca o fato da rodada por um conhecido (pela resposta), para os testes saberem a verdade. */
function withFact(state: MmState, answer: string): MmState {
  const id = FACTS.findIndex((fact) => fact.answer === answer)
  if (id < 0) throw new Error(`fato com resposta "${answer}" não existe`)
  return { ...state, fact: { id, text: FACTS[id].text } }
}

/** ctx com as respostas `{ jogador: campos }` da fase atual. */
function answersCtx(
  state: MmState,
  answers: Record<number, Record<string, unknown>>,
  extra: Partial<EngineCtx> = {},
): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(answers)) inputs[Number(id)] = { ...fields, k: state.inputKey }
  return makeCtx({ players: makePlayers(Math.max(...state.roster)), now: NOW + 1000, inputs, ...extra })
}

function liesCtx(state: MmState, lies: Record<number, unknown>, extra: Partial<EngineCtx> = {}) {
  return answersCtx(state, Object.fromEntries(Object.entries(lies).map(([id, lie]) => [id, { lie }])), extra)
}

function picksCtx(state: MmState, picks: Record<number, unknown>, extra: Partial<EngineCtx> = {}) {
  return answersCtx(state, Object.fromEntries(Object.entries(picks).map(([id, pick]) => [id, { pick }])), extra)
}

/** Fecha a escrita no prazo com estas mentiras. */
function writeAll(state: MmState, lies: Record<number, unknown>): MmState {
  const next = engine.step(state, liesCtx(state, lies, { now: state.deadline! }))
  expect(next.phase).toBe('choose')
  return next
}

/** Fecha a escolha no prazo com estas escolhas. */
function chooseAll(state: MmState, picks: Record<number, unknown>): MmState {
  const next = engine.step(state, picksCtx(state, picks, { now: state.deadline! }))
  expect(next.phase).toBe('reveal')
  return next
}

function factByAnswer(answer: string) {
  const id = FACTS.findIndex((fact) => fact.answer === answer)
  if (id < 0) throw new Error(`fato com resposta "${answer}" não existe`)
  return factById(id)
}

function optionOf(state: MmState, text: string): number {
  const option = state.options.find((entry) => entry.text === text)
  if (!option) throw new Error(`opção "${text}" não está na tela: ${state.options.map((o) => o.text).join(', ')}`)
  return option.id
}

function truthOf(state: MmState): number {
  const id = truthOptionId(state.options, factById(state.fact.id))
  if (id === null) throw new Error('a verdade sumiu das opções')
  return id
}

describe('início', () => {
  it('abre a escrita da rodada 1 com prazo e folga', () => {
    const { state } = start(5)
    expect(state.phase).toBe('write')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(6)
    expect(state.inputKey).toBe('lie-1')
    expect(state.deadline).toBe(NOW + WRITE_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(state.options).toEqual([])
    expect(state.private).toEqual({})
    expect(state.reveal).toBeNull()
    expect(state.fact.text).toBe(FACTS[state.fact.id].text)
    expect(state.fact.text).toContain(BLANK)
    expect(state.over).toBe(false)
  })

  it('o estado só leva o texto do fato da vez (nada da resposta)', () => {
    const { state } = start(5)
    const fact = factById(state.fact.id)
    expect(Object.keys(state.fact).sort()).toEqual(['id', 'text'])
    expect(JSON.stringify(state)).not.toContain(JSON.stringify(fact.house))
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    expect(engine.init(ctx).roster).toEqual([1, 3, 5])
  })

  it('rodadas: 4/6/8, padrão 6, e fatos sem repetir', () => {
    expect(start(4, {}).state.totalRounds).toBe(6)
    expect(start(4, { rounds: 8 }).state.totalRounds).toBe(8)
    expect(start(4, { rounds: 4 }).state.totalRounds).toBe(4)
    expect(start(4, { rounds: 7 }).state.totalRounds).toBe(6)
    expect(start(4, { rounds: '8' }).state.totalRounds).toBe(6)
    expect(start(4, optionDefaults(meta.options)).state.totalRounds).toBe(6)
    const { state } = start(4, { rounds: 8 })
    expect(new Set(state.deck).size).toBe(8)
  })
})

describe('escrita', () => {
  it('atualiza os ✓ só com mentira válida e devolve o mesmo estado quando nada muda', () => {
    const state = withFact(start(5).state, 'Bruce')
    const ctx = liesCtx(state, { 1: 'Godofredo', 3: 'Bruce' })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('write')
    expect(next.acted).toEqual([1])
    expect(engine.step(next, ctx)).toBe(next)
    expect(engine.step(state, liesCtx(state, {}))).toBe(state)
  })

  it('mentira igual à verdade não vale: com acento, maiúscula, artigo, pontuação ou letra trocada', () => {
    const state = withFact(start(9).state, 'Bruce')
    const ctx = liesCtx(state, {
      1: 'Bruce',
      2: 'bruce',
      3: '  BRUCE!!  ',
      4: 'o Bruce',
      5: 'Bruse',
      6: 'tubarão Bruce',
      7: 'Bruno',
      8: 'Steve',
      9: 'Bruce 2',
    })
    expect(engine.step(state, ctx).acted).toEqual([7, 8])
  })

  it('números só valem igualzinhos', () => {
    const it27 = withFact(start(8).state, '27')
    const ctx = liesCtx(it27, {
      1: '27',
      2: 'vinte e sete',
      3: '27 anos',
      4: '26',
      5: 'vinte e seis',
      6: '270',
      7: '27 anoss', // a verdade com errinho de propósito não passa
      8: '2.7',
    })
    expect(engine.step(it27, ctx).acted).toEqual([4, 5, 6])

    const houdini = withFact(start(4).state, 'Halloween')
    const dates = liesCtx(houdini, { 1: '31 de outubro', 2: '31/10', 3: '30 de outubro', 4: 'Dia das Bruxas' })
    expect(engine.step(houdini, dates).acted).toEqual([3])
  })

  it('ignora vazio, lixo, não-texto, espectador e resposta de outra rodada', () => {
    const state = withFact(start(5).state, 'Bruce')
    const ctx = makeCtx({
      players: makePlayers(7),
      now: NOW + 1000,
      inputs: {
        1: { k: state.inputKey, lie: '   ' },
        2: { k: state.inputKey, lie: '?!...' },
        3: { k: state.inputKey, lie: '🎃🎃' }, // sem letra nenhuma
        4: { k: state.inputKey, lie: 42 },
        5: { k: 'lie-0', lie: 'Godofredo' }, // rodada passada
        6: { k: state.inputKey, lie: 'Godofredo' }, // espectador
        7: { k: state.inputKey, lie: 'o' }, // só artigo
      },
    })
    const next = engine.step(state, ctx)
    expect(next.acted).toEqual([])
    expect(next).toBe(state)
  })

  it('texto gigante é cortado no limite', () => {
    const state = withFact(start(3).state, 'Bruce')
    const giant = 'Godofredo '.repeat(30)
    const choose = writeAll(state, { 1: giant })
    const option = choose.options.find((entry) => entry.text.startsWith('Godofredo'))!
    expect(option.text.length).toBeLessThanOrEqual(MAX_LIE_CHARS)
    expect(choose.private['1'].lie).toBe(option.text)
  })

  it('todo mundo online mentiu: vai para a escolha na hora; offline não segura', () => {
    const { state } = start(4, { rounds: 6 }, { players: makePlayers(4) })
    const ctx = liesCtx(state, { 1: 'Godofredo', 2: 'Tubarildo', 3: 'Dentuço' }, { players: makePlayers(4, { offline: [4] }) })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('choose')
    expect(next.inputKey).toBe('pick-1')
    expect(next.deadline).toBe(NOW + 1000 + CHOOSE_SECONDS * 1000 + GRACE_MS)
    expect(next.acted).toEqual([])
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(4)
    const ctx = liesCtx(state, { 1: 'Godofredo', 2: 'Tubarildo' })
    expect(engine.step(state, { ...ctx, now: state.deadline! - 1 }).phase).toBe('write')
    expect(engine.step(state, { ...ctx, now: state.deadline! }).phase).toBe('choose')
  })

  it('a última mentira enviada vale (dá para trocar)', () => {
    const state = withFact(start(3).state, 'Bruce')
    const first = engine.step(state, liesCtx(state, { 1: 'Godofredo' }))
    const choose = writeAll(first, { 1: 'Tubarildo' })
    expect(choose.options.map((option) => option.text)).toContain('Tubarildo')
    expect(choose.options.map((option) => option.text)).not.toContain('Godofredo')
  })
})

describe('opções da escolha', () => {
  it('mentiras únicas + a verdade, embaralhadas, sem autor no estado público', () => {
    const state = withFact(start(5).state, 'Bruce')
    const choose = writeAll(state, { 1: 'Godofredo', 2: 'Tubarildo', 3: 'Dentuço', 4: 'Barbatana', 5: 'Mordidão' })
    expect(choose.options).toHaveLength(6)
    expect(choose.options.map((option) => option.id)).toEqual([0, 1, 2, 3, 4, 5])
    for (const option of choose.options) expect(Object.keys(option).sort()).toEqual(['id', 'text'])
    expect(choose.options.filter((option) => option.text === 'Bruce')).toHaveLength(1)
    // Cada autor sabe só a própria opção; a verdade não fica marcada em lugar nenhum.
    expect(choose.private['2']).toEqual({ lie: 'Tubarildo', own: optionOf(choose, 'Tubarildo') })
    const { private: secrets, ...publicPart } = choose
    expect(Object.keys(secrets)).toHaveLength(5)
    expect(JSON.stringify(publicPart)).not.toMatch(/authors|truth|own/)
  })

  it('mentiras iguais (maiúscula, acento, artigo, pontuação) viram uma opção só', () => {
    const state = withFact(start(5).state, 'Bruce')
    const choose = writeAll(state, { 1: 'O Tubarildo', 2: 'tubarildo.', 3: 'TUBARÍLDO', 4: 'Dentuço' })
    const shared = optionOf(choose, 'O Tubarildo')
    expect(choose.options.filter((option) => lieKey(option.text) === lieKey('tubarildo'))).toHaveLength(1)
    expect(choose.private['1'].own).toBe(shared)
    expect(choose.private['2']).toEqual({ lie: 'tubarildo', own: shared })
    expect(choose.private['3'].own).toBe(shared)
    expect(choose.private['5']).toBeUndefined()
  })

  it('pouca gente: a casa completa as mentiras, sem repetir a que alguém já escreveu', () => {
    const state = withFact(start(3).state, 'Bruce')
    const fact = factById(state.fact.id)
    const choose = writeAll(state, { 1: 'Godofredo', 2: 'Steve', 3: 'steve' })
    const texts = choose.options.map((option) => option.text)
    // 2 mentiras da mesa (Steve juntou com a da casa) + 2 da casa + a verdade.
    expect(texts).toHaveLength(MIN_LIES + 1)
    expect(texts.filter((text) => lieKey(text) === 'steve')).toHaveLength(1)
    expect(texts.filter((text) => fact.house.includes(text) && text !== 'Steve')).toHaveLength(2)
  })

  it('mentira da casa quase igual à de alguém da mesa fica de fora', () => {
    const state = withFact(start(3).state, 'Bruce')
    const choose = writeAll(state, { 1: 'Stive', 2: 'Godofredo' })
    expect(choose.options.map((option) => option.text).sort()).toEqual(['Bob', 'Bruce', 'Dentinho', 'Godofredo', 'Stive'])
  })

  it('ninguém escreveu: a verdade e as três mentiras da casa', () => {
    const state = withFact(start(3).state, 'Bruce')
    const choose = writeAll(state, {})
    expect(choose.options.map((option) => option.text).sort()).toEqual(['Bob', 'Bruce', 'Dentinho', 'Steve'])
    expect(choose.private).toEqual({})
  })

  it('15 pessoas com mentiras diferentes: 16 opções, nenhuma da casa', () => {
    const state = withFact(start(15).state, 'Bruce')
    const lies = Object.fromEntries(state.roster.map((id) => [id, `Mentira número ${id}`]))
    const choose = writeAll(state, lies)
    expect(choose.options).toHaveLength(16)
    expect(choose.options.map((option) => option.text)).not.toContain('Steve')
  })
})

describe('escolha', () => {
  function scenario() {
    const state = withFact(start(5).state, 'Bruce')
    return writeAll(state, { 1: 'Godofredo', 2: 'Tubarildo', 3: 'godofredo', 4: 'Dentuço' })
  }

  it('✓ só com escolha válida: a própria mentira, opção inexistente e lixo não valem', () => {
    const choose = scenario()
    const ctx = makeCtx({
      players: makePlayers(6),
      now: NOW + 2000,
      inputs: {
        1: { k: choose.inputKey, pick: optionOf(choose, 'Godofredo') }, // a própria (dividida)
        2: { k: choose.inputKey, pick: optionOf(choose, 'Tubarildo') }, // a própria
        3: { k: choose.inputKey, pick: 99 }, // não existe
        4: { k: choose.inputKey, pick: String(truthOf(choose)) }, // lixo
        5: { k: choose.inputKey, pick: truthOf(choose) }, // vale
        6: { k: choose.inputKey, pick: truthOf(choose) }, // espectador
      },
    })
    const next = engine.step(choose, ctx)
    expect(next.phase).toBe('choose')
    expect(next.acted).toEqual([5])
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('a última escolha vale (dá para trocar)', () => {
    const choose = scenario()
    const first = engine.step(choose, picksCtx(choose, { 5: optionOf(choose, 'Dentuço') }))
    const revealed = chooseAll(first, { 5: truthOf(choose) })
    expect(revealed.reveal!.steps.at(-1)!.pickers).toEqual([5])
  })

  it('todo mundo online escolheu: revela na hora', () => {
    const choose = scenario()
    const picks = { 1: truthOf(choose), 2: truthOf(choose), 3: truthOf(choose), 4: truthOf(choose) }
    const next = engine.step(choose, picksCtx(choose, picks, { players: makePlayers(5, { offline: [5] }) }))
    expect(next.phase).toBe('reveal')
  })
})

describe('pontuação', () => {
  it('verdade +2, cada um que caiu +1, mentira dividida divide o crédito, casa não pontua', () => {
    const choose = withFactScenario()
    const godofredo = optionOf(choose, 'Godofredo')
    const tubarildo = optionOf(choose, 'Tubarildo')
    const revealed = chooseAll(choose, {
      1: tubarildo,
      2: truthOf(choose),
      3: tubarildo,
      4: godofredo,
      5: godofredo,
    })
    // 2 achou a verdade (+2) e enganou 1 e 3 (+2); Godofredo (1 e 3) enganou 2 → +1 para cada.
    expect(revealed.scores).toEqual({ 1: 1, 2: 4, 3: 1, 4: 0, 5: 0 })
    expect(revealed.reveal!.gains).toEqual({ 1: 1, 2: 4, 3: 1 })
    expect(revealed.fooled).toEqual({ 1: 2, 2: 2, 3: 2, 4: 0, 5: 0 })
    expect(revealed.found).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 })
    expect(revealed.fell).toEqual({ 1: 1, 2: 0, 3: 1, 4: 1, 5: 1 })
    const shared = revealed.reveal!.steps.find((item) => item.id === godofredo)!
    expect(shared).toMatchObject({ kind: 'lie', authors: [1, 3], pickers: [4, 5], gain: 1 })
  })

  it('crédito dividido arredonda para cima (3 enganados entre 2 autores = 2 cada)', () => {
    const state = withFact(start(6).state, 'Bruce')
    const choose = writeAll(state, { 1: 'Godofredo', 2: 'godofredo', 3: 'Tubarildo' })
    const revealed = chooseAll(choose, {
      3: optionOf(choose, 'Godofredo'),
      4: optionOf(choose, 'Godofredo'),
      5: optionOf(choose, 'Godofredo'),
    })
    expect(revealed.scores['1']).toBe(2)
    expect(revealed.scores['2']).toBe(2)
  })

  it('cair na mentira da casa não dá ponto para ninguém', () => {
    const state = withFact(start(3).state, 'Bruce')
    const choose = writeAll(state, {})
    const revealed = chooseAll(choose, { 1: optionOf(choose, 'Steve'), 2: optionOf(choose, 'Steve'), 3: truthOf(choose) })
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 2 })
    const house = revealed.reveal!.steps.find((item) => item.text === 'Steve')!
    expect(house).toMatchObject({ kind: 'house', authors: [], pickers: [1, 2], gain: 0 })
    expect(revealed.fell).toEqual({ 1: 1, 2: 1, 3: 0 })
  })

  it('a última rodada vale o dobro', () => {
    const state = withFact({ ...start(4).state, round: 6 }, 'Bruce')
    const choose = writeAll(state, { 1: 'Godofredo', 2: 'godofredo', 3: 'Tubarildo' })
    const revealed = chooseAll(choose, {
      3: optionOf(choose, 'Godofredo'),
      4: truthOf(choose),
      1: optionOf(choose, 'Tubarildo'),
    })
    expect(revealed.reveal!.double).toBe(true)
    // 4 achou a verdade: +4. Tubarildo (3) enganou 1: +2. Godofredo (1 e 2) enganou 1: 2 dividido = +1 cada.
    expect(revealed.scores).toEqual({ 1: 1, 2: 1, 3: 2, 4: 4 })
  })

  it('ninguém escolheu: a revelação só mostra a verdade e ninguém pontua', () => {
    const state = withFact(start(3).state, 'Bruce')
    const choose = writeAll(state, { 1: 'Godofredo' })
    const revealed = chooseAll(choose, {})
    expect(revealed.reveal!.steps).toHaveLength(1)
    expect(revealed.reveal!.steps[0]).toMatchObject({ kind: 'truth', text: 'Bruce', pickers: [] })
    expect(revealed.reveal!.missed.length).toBe(choose.options.length - 1)
    expect(revealed.scores).toEqual({ 1: 0, 2: 0, 3: 0 })
  })
})

/** 5 jogadores, fato do "Bruce": 1 e 3 escrevem a mesma mentira, 5 não escreve. */
function withFactScenario() {
  const state = withFact(start(5).state, 'Bruce')
  return writeAll(state, { 1: 'Godofredo', 2: 'Tubarildo', 3: 'godofredo', 4: 'Dentuço' })
}

describe('revelação', () => {
  it('mentira por mentira (da que menos enganou à que mais) e a verdade por último', () => {
    const choose = withFactScenario()
    const revealed = chooseAll(choose, {
      1: optionOf(choose, 'Dentuço'),
      2: optionOf(choose, 'Godofredo'),
      3: optionOf(choose, 'Dentuço'),
      4: truthOf(choose),
    })
    const reveal = revealed.reveal!
    expect(reveal.steps.map((item) => item.text)).toEqual(['Godofredo', 'Dentuço', 'Bruce'])
    expect(reveal.steps.map((item) => item.kind)).toEqual(['lie', 'lie', 'truth'])
    expect(reveal.missed.map((item) => item.text)).toContain('Tubarildo')
    expect(reveal.at).toBe(choose.deadline)
    expect(revealed.acted).toEqual([1, 2, 3, 4])
  })

  it('o prazo é proporcional ao número de mentiras mostradas', () => {
    const choose = withFactScenario()
    const one = chooseAll(choose, { 5: optionOf(choose, 'Dentuço') }).reveal!
    const three = chooseAll(choose, {
      2: optionOf(choose, 'Godofredo'),
      4: optionOf(choose, 'Tubarildo'),
      5: optionOf(choose, 'Dentuço'),
    }).reveal!
    expect(revealEnd(one) - one.at).toBe(REVEAL_INTRO_MS + REVEAL_STEP_MS + REVEAL_TRUTH_MS)
    expect(revealEnd(three) - three.at).toBe(REVEAL_INTRO_MS + 3 * REVEAL_STEP_MS + REVEAL_TRUTH_MS)
  })

  it('com muitas mentiras, cada uma passa mais rápido', () => {
    const state = withFact(start(15).state, 'Bruce')
    const lies = Object.fromEntries(state.roster.map((id) => [id, `Mentira ${id}`]))
    const choose = writeAll(state, lies)
    // Cada um cai na mentira do vizinho: 15 mentiras enganaram alguém.
    const picks = Object.fromEntries(state.roster.map((id) => [id, optionOf(choose, `Mentira ${(id % 15) + 1}`)]))
    const revealed = chooseAll(choose, picks)
    expect(revealed.reveal!.steps).toHaveLength(16)
    expect(revealed.reveal!.stepMs).toBe(REVEAL_FAST_STEP_MS)
    expect(revealed.deadline).toBe(revealEnd(revealed.reveal!))
  })

  it('o relógio da revelação: abertura, cada mentira e a verdade', () => {
    const choose = withFactScenario()
    const revealed = chooseAll(choose, { 2: optionOf(choose, 'Godofredo'), 4: optionOf(choose, 'Tubarildo') })
    const reveal = revealed.reveal!
    expect(revealMoment(reveal, reveal.at).index).toBe(-1)
    expect(revealMoment(reveal, reveal.at + REVEAL_INTRO_MS).index).toBe(0)
    expect(revealMoment(reveal, reveal.at + REVEAL_INTRO_MS + reveal.stepMs + 10)).toMatchObject({ index: 1, since: 10 })
    expect(revealMoment(reveal, truthAt(reveal)).item!.kind).toBe('truth')
    expect(revealMoment(reveal, revealEnd(reveal) + 60_000).item!.kind).toBe('truth')
  })

  it('revelação → placar → próxima rodada, nos prazos', () => {
    const choose = withFactScenario()
    const revealed = chooseAll(choose, { 5: truthOf(choose) })
    const players = makePlayers(5)
    expect(engine.step(revealed, makeCtx({ players, now: revealed.deadline! - 1 }))).toBe(revealed)
    const scores = engine.step(revealed, makeCtx({ players, now: revealed.deadline! }))
    expect(scores.phase).toBe('scores')
    expect(scores.deadline).toBe(revealed.deadline! + SCORES_SECONDS * 1000)
    expect(scores.reveal).toBe(revealed.reveal)

    const round2 = engine.step(scores, makeCtx({ players, now: scores.deadline! }))
    expect(round2.phase).toBe('write')
    expect(round2.round).toBe(2)
    expect(round2.inputKey).toBe('lie-2')
    expect(round2.options).toEqual([])
    expect(round2.private).toEqual({})
    expect(round2.reveal).toBeNull()
    expect(round2.fact.id).toBe(round2.deck[1])
    expect(round2.scores).toEqual(revealed.scores)
  })

  it('skip pula qualquer fase; comando desconhecido não faz nada', () => {
    const { state } = start(3)
    const skip = (s: MmState, id: number) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id, type: 'skip' } }))
    const choose = skip(state, 1)
    expect(choose.phase).toBe('choose')
    const revealed = skip(choose, 2)
    expect(revealed.phase).toBe('reveal')
    const scores = skip(revealed, 3)
    expect(scores.phase).toBe('scores')
    const round2 = skip(scores, 4)
    expect(round2.round).toBe(2)
    expect(round2.phase).toBe('write')
    expect(engine.step(round2, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 5, type: 'xyz' } }))).toBe(round2)
  })

  it('a última revelação termina a partida com os prêmios', () => {
    let { state } = start(3, { rounds: 4 })
    for (let round = 1; round <= 4; round += 1) {
      state = withFact(state, 'Bruce')
      // 1 sempre engana o 2; o 3 sempre acha a verdade.
      const choose = writeAll(state, { 1: 'Godofredo', 2: 'Tubarildo' })
      state = chooseAll(choose, { 2: optionOf(choose, 'Godofredo'), 3: truthOf(choose) })
      state = engine.step(state, makeCtx({ players: makePlayers(3), now: state.deadline! }))
      if (round < 4) {
        expect(state.phase).toBe('scores')
        state = engine.step(state, makeCtx({ players: makePlayers(3), now: state.deadline! }))
      }
    }
    expect(state.phase).toBe('final')
    expect(state.over).toBe(true)
    expect(state.deadline).toBeNull()
    expect(engine.step(state, makeCtx({ players: makePlayers(3), now: NOW * 9 }))).toBe(state)

    // Rodadas 1–3: +1 por enganar e +2 pela verdade; a 4ª vale o dobro.
    expect(state.scores).toEqual({ 1: 5, 2: 0, 3: 10 })
    const awards = finalAwards(state)
    expect(awards.ranking.map((entry) => entry.id)).toEqual([3, 1, 2])
    expect(awards.liars).toEqual([1])
    expect(awards.maxFooled).toBe(4)
    expect(awards.sniffers).toEqual([3])
    expect(awards.suckers).toEqual([2])
  })

  it('prêmios vazios quando ninguém fez nada', () => {
    const { state } = start(3)
    const awards = finalAwards({ ...state, over: true })
    expect(awards.liars).toEqual([])
    expect(awards.sniffers).toEqual([])
    expect(awards.suckers).toEqual([])
  })
})

describe('texto', () => {
  it('cleanLie limpa espaço, controle, pontuação final e corta sem partir emoji', () => {
    expect(cleanLie('  Pedro.  ')).toBe('Pedro')
    expect(cleanLie('a\nb\tc')).toBe('a b c')
    expect(cleanLie('Sério?!…')).toBe('Sério')
    expect(cleanLie(42)).toBe('')
    expect(cleanLie(null)).toBe('')
    const emojis = '🎃'.repeat(MAX_LIE_CHARS + 5)
    expect(Array.from(cleanLie(emojis))).toHaveLength(MAX_LIE_CHARS)
    expect(cleanLie(emojis)).toBe('🎃'.repeat(MAX_LIE_CHARS))
  })

  it('lieKey ignora acento, maiúscula, artigo e pontuação, e junta números', () => {
    expect(lieKey('O Tubarão!')).toBe(lieKey('tubarao'))
    expect(lieKey('1.897')).toBe('1897')
    expect(lieKey('🎃')).toBe('')
  })

  it('isTruth: tolerante com palavras, exato com números', () => {
    const pennywise = factById(FACTS.findIndex((fact) => fact.answer === '27'))
    expect(isTruth('vinte e sete', pennywise)).toBe(true)
    expect(isTruth('vinte e seis', pennywise)).toBe(false)
    expect(isTruth('26', pennywise)).toBe(false)
    const saci = factById(FACTS.findIndex((fact) => fact.answer === 'gorro'))
    expect(isTruth('Gorro', saci)).toBe(true)
    expect(isTruth('carapuça', saci)).toBe(true)
    expect(isTruth('gorrro', saci)).toBe(true)
    expect(isTruth('cachimbo', saci)).toBe(false)
    expect(isTruth('', saci)).toBe(false)
  })

  it('cleanLie tira as aspas de fora ("Steve" = Steve)', () => {
    expect(cleanLie('"Steve"')).toBe('Steve')
    expect(cleanLie('“Bruce Lee.”')).toBe('Bruce Lee')
    expect(cleanLie(cleanLie(' «Pudim» ! '))).toBe('Pudim')
  })

  it('isTruth: número grudado ou com letra trocada continua sendo a verdade', () => {
    const chamado = factByAnswer('sete dias')
    for (const lie of ['7dias', 'setedias', '7 diass', '7 Dias!']) expect(isTruth(lie, chamado), lie).toBe(true)
    for (const lie of ['17 dias', '7 noites', 'seis dias', '7 meses', 'treze dias']) expect(isTruth(lie, chamado), lie).toBe(false)
    const notas = factByAnswer('duas')
    expect(isTruth('2notas', notas)).toBe(true)
    expect(isTruth('3 notas', notas)).toBe(false)
    const houdini = factByAnswer('Halloween')
    expect(isTruth('31 de outubto', houdini)).toBe(true)
    expect(isTruth('30 de outubro', houdini)).toBe(false)
  })

  it('isTruth: mentiras naturais não são recusadas como se fossem a verdade', () => {
    const cases: [string, string[]][] = [
      ['aqui', ['chegando', 'dentro', 'com fome']],
      ['terra', ['cemitério', 'igreja']],
      ['chuveiro', ['tomar banho', 'banheira']],
      ['destruir', ['recolher', 'proibir']],
      ['pele humana', ['pele de porco', 'couro de vaca', 'borracha']],
      ['Todos os Santos', ['Santo Antônio', 'Todos os Mortos']],
      ['jogo de tabuleiro', ['jogo de cartas', 'jogo da velha']],
    ]
    for (const [answer, lies] of cases) {
      for (const lie of lies) expect(isTruth(lie, factByAnswer(answer)), `${answer} ~ ${lie}`).toBe(false)
    }
    // …e a verdade digitada do jeito do zap ainda é a verdade.
    expect(isTruth('aki', factByAnswer('aqui'))).toBe(true)
    expect(isTruth('Jogo', factByAnswer('jogo de tabuleiro'))).toBe(true)
  })

  it('similarLies: iguais ou quase, nos dois sentidos', () => {
    expect(similarLies('Steve', 'Stive')).toBe(true)
    expect(similarLies('13', '13 anos')).toBe(true)
    expect(similarLies('13 anos', '13')).toBe(true)
    expect(similarLies('13', '33')).toBe(false)
    expect(similarLies('Bob', 'Godofredo')).toBe(false)
  })

  it('lacuna: separa e preenche', () => {
    expect(splitBlank('Eu vejo ___ hoje.')).toEqual(['Eu vejo ', ' hoje.'])
    expect(fillBlank('Eu vejo ___ hoje.', 'gente morta')).toBe('Eu vejo gente morta hoje.')
    expect(splitBlank('sem lacuna')).toEqual(['sem lacuna', ''])
  })
})

describe('bot', () => {
  it('escreve um texto na escrita e nunca escolhe a própria mentira', () => {
    const { state } = start(5)
    const rng = seededRng(3)
    const ctx = makeCtx({ players: makePlayers(5), rng })
    expect(typeof engine.bot(state, 2, ctx)?.lie).toBe('string')
    const choose = writeAll(withFact(state, 'Bruce'), { 1: 'Godofredo', 2: 'Tubarildo', 3: 'godofredo' })
    for (let i = 0; i < 60; i += 1) {
      for (const id of [1, 2, 3]) {
        const reply = engine.bot(choose, id, ctx)
        expect(choose.options.map((option) => option.id)).toContain(reply?.pick)
        expect(reply?.pick).not.toBe(choose.private[String(id)].own)
      }
    }
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'reveal' }, 2, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { rounds: 6 } })
        expect(result.state.over).toBe(true)
        expect(result.state.phase).toBe('final')
        expect(result.state.round).toBe(6)
        const phases = new Set(result.history.map((state) => state.phase))
        expect([...phases].sort()).toEqual(['choose', 'final', 'reveal', 'scores', 'write'])
        // Segredo nunca aparece em campo público antes da revelação.
        for (const state of result.history) {
          if (state.phase !== 'choose') continue
          expect(state.reveal).toBeNull()
          for (const option of state.options) expect(Object.keys(option).sort()).toEqual(['id', 'text'])
        }
        // Pontos sempre batem com o que as revelações pagaram.
        const total = Object.values(result.state.scores).reduce((sum, value) => sum + value, 0)
        expect(total).toBeGreaterThan(0)
      })
    }
  }

  it('8 rodadas', () => {
    const result = runSimulation(engine, { players: 6, seed: 9, options: { rounds: 8 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(8)
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem responder', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5, options: { rounds: 4 } })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { rounds: 8 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(8)
  })

  it('15 jogadores, gente offline e host pulando', () => {
    const result = runSimulation(engine, {
      players: 15,
      offlineIds: [4, 11],
      skipProbability: 0.15,
      actProbability: 0.6,
      seed: 13,
      options: { rounds: 4 },
    })
    expect(result.state.over).toBe(true)
  })

  it('ninguém nunca responde: termina pelos prazos, sem pontos', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { rounds: 4 } })
    expect(result.state.over).toBe(true)
    expect(Object.values(result.state.scores).every((score) => score === 0)).toBe(true)
  })
})

describe('conteúdo', () => {
  it('40+ fatos, todos diferentes, com uma lacuna e texto que cabe na TV', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(FACTS.map((fact) => fact.text)).size).toBe(FACTS.length)
    expect(new Set(FACTS.map((fact) => lieKey(fact.text))).size).toBe(FACTS.length)
    for (const fact of FACTS) {
      expect(fact.text.split(BLANK), fact.text).toHaveLength(2)
      expect(fact.text.length, fact.text).toBeLessThanOrEqual(120)
    }
  })

  it('a verdade é curta e as variações aceitas são reconhecidas como verdade', () => {
    for (const fact of FACTS) {
      const words = fact.answer.split(/\s+/).filter(Boolean)
      expect(words.length, fact.answer).toBeGreaterThanOrEqual(1)
      expect(words.length, fact.answer).toBeLessThanOrEqual(3)
      expect(fact.answer.length, fact.answer).toBeLessThanOrEqual(MAX_LIE_CHARS)
      expect(cleanLie(fact.answer), fact.answer).toBe(fact.answer)
      expect(isTruth(fact.answer, fact), fact.answer).toBe(true)
      for (const variant of fact.accept) expect(isTruth(variant, fact), `${fact.answer} ~ ${variant}`).toBe(true)
      expect(fillBlank(fact.text, fact.answer)).not.toContain(BLANK)
    }
  })

  it('três mentiras da casa por fato: falsas, diferentes entre si e curtas', () => {
    for (const fact of FACTS) {
      expect(fact.house, fact.answer).toHaveLength(3)
      expect(new Set(fact.house.map(lieKey)).size, fact.answer).toBe(3)
      for (const lie of fact.house) {
        expect(isTruth(lie, fact), `"${lie}" parece a verdade de "${fact.answer}"`).toBe(false)
        expect(lieKey(lie), lie).not.toBe('')
        expect(cleanLie(lie), lie).toBe(lie)
      }
    }
  })
})
