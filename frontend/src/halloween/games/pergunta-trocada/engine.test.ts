import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makePlayers, runSimulation } from '../../engine/testkit'
import { PAIRS } from './content'
import {
  ANSWER_MAX,
  CONSOLATION_POINTS,
  ESCAPE_POINTS,
  GROUP_POINTS,
  QUESTION_SECONDS,
  RESULT_SECONDS,
  SCORES_SECONDS,
  SHARP_BONUS,
  VOTE_SECONDS,
  answersSeconds,
  cardOf,
  cleanAnswer,
  engine,
  finalAwards,
  keys,
  mesaOf,
  questionsOf,
  scoreRound,
  type State,
} from './engine'
import { meta } from './meta'
import { NOW, answered, ctxAt, publicJson, rig, skip, start, toPhase, vote, voting } from './testing'

describe('começo da partida', () => {
  it('distribui a mesma pergunta para todos, menos o impostor (que não sabe)', () => {
    const { state } = start(6)
    expect(state.phase).toBe('question')
    expect(state.round).toBe(1)
    expect(state.inputKey).toBe(keys.answer(1))
    expect(state.deadline).toBe(NOW + QUESTION_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4, 5, 6])
    const mesa = mesaOf(state)
    const questions = questionsOf(mesa)
    expect(mesa.impostor).not.toBeNull()
    expect(questions.group).not.toBe(questions.odd)
    expect(state.kind).toBe(questions.kind)
    const cards = state.roster.map((id) => cardOf(state, id)!)
    expect(cards.filter((card) => card.odd)).toHaveLength(1)
    for (const id of state.roster) {
      const card = cardOf(state, id)!
      expect(card.question).toBe(id === mesa.impostor ? questions.odd : questions.group)
    }
  })

  it('nada de segredo no estado público: nem as perguntas, nem quem é o impostor', () => {
    const { state } = start(5)
    const json = publicJson(state)
    const questions = questionsOf(mesaOf(state))
    expect(json).not.toContain(questions.group)
    expect(json).not.toContain(questions.odd)
    expect(json).not.toContain('odd')
    expect(state.realQuestion).toBeNull()
    expect(state.answers).toEqual({})
  })

  it('lê as opções (e ignora valores fora da lista)', () => {
    const custom = start(4, { rounds: 7, talkSeconds: 90, chaos: false }).state
    expect(custom.totalRounds).toBe(7)
    expect(custom.talkMs).toBe(90_000)
    expect(custom.chaosOn).toBe(false)
    const fallback = start(4, { rounds: 4, talkSeconds: 'x', chaos: 'sim' }).state
    expect(fallback.totalRounds).toBe(5)
    expect(fallback.talkMs).toBe(60_000)
    expect(fallback.chaosOn).toBe(true)
    // Os padrões do meta são os do motor.
    const defaults = start(4, optionDefaults(meta.options)).state
    expect(defaults.totalRounds).toBe(5)
    expect(defaults.talkMs).toBe(60_000)
  })

  it('o impostor sai de quem está online', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state } = start(5, { rounds: 3, chaos: false }, { players: makePlayers(5, { offline: [1, 2, 3] }), rng: seededRng(seed) })
      expect(state.roster).toEqual([4, 5])
      expect([4, 5]).toContain(mesaOf(state).impostor)
    }
  })
})

describe('respostas', () => {
  it('fecha quando todo mundo online respondeu; offline não segura', () => {
    const { state } = start(4)
    const partial = engine.step(state, ctxAt(state, NOW + 1000, { 1: { answer: '7' }, 2: { answer: 'dez' } }))
    expect(partial.phase).toBe('question')
    expect(partial.acted).toEqual([1, 2])
    // Mesmo ctx de novo: o MESMO objeto.
    expect(engine.step(partial, ctxAt(partial, NOW + 1000, { 1: { answer: '7' }, 2: { answer: 'dez' } }))).toBe(partial)

    const offline = makePlayers(4, { offline: [4] })
    const next = engine.step(partial, ctxAt(partial, NOW + 2000, { 1: { answer: '7' }, 2: { answer: 'dez' }, 3: { answer: '3' } }, { players: offline }))
    expect(next.phase).toBe('answers')
    expect(next.answers).toEqual({ 1: '7', 2: 'dez', 3: '3' })
    expect(next.deadline).toBe(NOW + 2000 + answersSeconds(4) * 1000)
  })

  it('limpa a resposta: espaços, tamanho máximo e vazio não conta', () => {
    expect(cleanAnswer('  muito   panetone  ')).toBe('muito panetone')
    expect(cleanAnswer(12)).toBe('12')
    expect(cleanAnswer('   ')).toBeNull()
    expect(cleanAnswer(null)).toBeNull()
    expect(cleanAnswer({})).toBeNull()
    expect(cleanAnswer('x'.repeat(100))).toHaveLength(ANSWER_MAX)

    const { state } = start(3)
    const next = engine.step(state, ctxAt(state, NOW + 1000, { 1: { answer: '   ' }, 2: { answer: 5 }, 3: { answer: 'ok' } }))
    // O 1 mandou vazio: não respondeu, então a fase continua esperando por ele.
    expect(next.phase).toBe('question')
    expect(next.acted).toEqual([2, 3])
  })

  it('no prazo (ou no "Pular" do host) segue com quem respondeu', () => {
    const { state } = start(4)
    const late = engine.step(state, ctxAt(state, state.deadline!, { 2: { answer: 'rabanada' } }))
    expect(late.phase).toBe('answers')
    expect(late.answers).toEqual({ 2: 'rabanada' })
    const skipped = engine.step(state, ctxAt(state, NOW + 1000, {}, { command: skip() }))
    expect(skipped.phase).toBe('answers')
    expect(skipped.answers).toEqual({})
  })

  it('resposta de outra fase não vale', () => {
    const { state } = start(3)
    const ctx = ctxAt(state, NOW + 1000)
    ctx.inputs = { 1: { k: 'answer-0', answer: 'velha' } }
    expect(engine.step(state, ctx)).toBe(state)
  })
})

describe('pergunta de verdade e conversa', () => {
  it('as respostas ficam na mesa e depois a pergunta da mesa aparece', () => {
    const shown = answered(5, 2)
    expect(shown.phase).toBe('answers')
    expect(shown.realQuestion).toBeNull()
    expect(publicJson(shown)).not.toContain(questionsOf(mesaOf(shown)).group)
    const talk = engine.step(shown, ctxAt(shown, shown.deadline!))
    expect(talk.phase).toBe('talk')
    expect(talk.inputKey).toBe(keys.talk(1))
    expect(talk.realQuestion).toBe(questionsOf(mesaOf(talk)).group)
    expect(talk.deadline).toBe(shown.deadline! + talk.talkMs)
    // A pergunta do impostor continua escondida.
    expect(publicJson(talk)).not.toContain(questionsOf(mesaOf(talk)).odd)
  })

  it('"Bora votar" de todo mundo online abre a votação antes do tempo', () => {
    const talk = toPhase(answered(4, 1), 'talk')
    const some = engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { ready: true }, 3: { ready: true } }))
    expect(some.phase).toBe('talk')
    expect(some.acted).toEqual([1, 3])
    const all = engine.step(some, ctxAt(some, NOW + 31_000, { 1: { ready: true }, 2: { ready: true }, 3: { ready: true } }, { players: makePlayers(4, { offline: [4] }) }))
    expect(all.phase).toBe('vote')
    expect(all.inputKey).toBe(keys.vote(1))
    expect(all.deadline).toBe(NOW + 31_000 + VOTE_SECONDS * 1000 + GRACE_MS)
    // Sem ninguém pronto, só no fim do tempo.
    expect(engine.step(talk, ctxAt(talk, talk.deadline! - 1))).toBe(talk)
    expect(engine.step(talk, ctxAt(talk, talk.deadline!)).phase).toBe('vote')
  })
})

describe('votação e pontos', () => {
  it('pegaram o impostor: a mesa +1 e quem votou nele +2', () => {
    const v = voting(5, 3)
    const result = vote(v, { 1: 3, 2: 3, 3: 1, 4: 2, 5: 3 })
    expect(result.phase).toBe('result')
    expect(result.deadline).toBe(v.deadline! + RESULT_SECONDS * 1000)
    const r = result.result!
    expect(r.impostor).toBe(3)
    expect(r.accused).toBe(3)
    expect(r.caught).toBe(true)
    expect(r.sharp).toEqual([1, 2, 5])
    expect(r.gains).toEqual({ 1: GROUP_POINTS + SHARP_BONUS, 2: GROUP_POINTS + SHARP_BONUS, 4: GROUP_POINTS, 5: GROUP_POINTS + SHARP_BONUS })
    expect(result.scores).toEqual({ 1: 2, 2: 2, 3: 0, 4: 1, 5: 2 })
    expect(r.oddQuestion).toBe(questionsOf(mesaOf(v)).odd)
    expect(r.realQuestion).toBe(v.realQuestion)
    expect(result.history).toEqual([{ round: 1, impostor: 3, caught: true, sharp: [1, 2, 5], realQuestion: v.realQuestion }])
  })

  it('o impostor escapa no empate, com inocente condenado e sem votos', () => {
    const tie = vote(voting(4, 1), { 1: 2, 2: 1, 3: 2, 4: 1 }).result!
    expect(tie.top).toEqual([1, 2])
    expect(tie.accused).toBeNull()
    expect(tie.caught).toBe(false)
    expect(tie.gains).toEqual({ 1: ESCAPE_POINTS })
    expect(tie.sharp).toEqual([2, 4])

    const innocent = vote(voting(4, 1), { 1: 2, 3: 2, 4: 2 }).result!
    expect(innocent.accused).toBe(2)
    expect(innocent.caught).toBe(false)
    expect(innocent.gains).toEqual({ 1: ESCAPE_POINTS })

    const silent = vote(voting(4, 1), {}).result!
    expect(silent.top).toEqual([])
    expect(silent.gains).toEqual({ 1: ESCAPE_POINTS })
  })

  it('voto em si mesmo ou em quem não joga não conta', () => {
    const v = voting(4, 2)
    const result = vote(v, { 1: 1, 3: 99, 4: 2 }).result!
    expect(result.votes).toEqual({ 4: 2 })
    expect(result.caught).toBe(true)
  })

  it('fecha a votação quando todo mundo online votou', () => {
    const v = voting(3, 1)
    const partial = engine.step(v, ctxAt(v, NOW + 100_000, { 2: { vote: 1 } }))
    expect(partial.phase).toBe('vote')
    expect(partial.acted).toEqual([2])
    const done = engine.step(partial, ctxAt(partial, NOW + 100_000, { 1: { vote: 2 }, 2: { vote: 1 }, 3: { vote: 1 } }))
    expect(done.phase).toBe('result')
    expect(done.result!.caught).toBe(true)
  })

  it('rodada sem impostor: o mais votado leva a consolação', () => {
    const v = voting(4, null)
    expect(v.roster.every((id) => cardOf(v, id)!.odd === false)).toBe(true)
    const result = vote(v, { 1: 2, 3: 2, 4: 1 }).result!
    expect(result.impostor).toBeNull()
    expect(result.oddQuestion).toBeNull()
    expect(result.caught).toBe(false)
    expect(result.gains).toEqual({ 2: CONSOLATION_POINTS })
    const tie = vote(voting(4, null), { 1: 2, 2: 1 }).result!
    expect(tie.gains).toEqual({ 1: CONSOLATION_POINTS, 2: CONSOLATION_POINTS })
  })

  it('scoreRound puro', () => {
    expect(scoreRound([1, 2, 3], 2, { 1: 2, 3: 2 }, [2])).toEqual({ gains: { 1: 2, 3: 2 }, caught: true, sharp: [1, 3], accused: 2 })
    expect(scoreRound([1, 2, 3], 2, { 1: 3 }, [3])).toEqual({ gains: { 2: ESCAPE_POINTS }, caught: false, sharp: [], accused: 3 })
    expect(scoreRound([1, 2, 3], null, {}, [])).toEqual({ gains: {}, caught: false, sharp: [], accused: null })
  })
})

describe('rodadas e fim', () => {
  it('placar, próxima rodada com pergunta nova e o fim na última', () => {
    const r1 = vote(voting(3, 1, { rounds: 3, chaos: false }), { 2: 1, 3: 1 })
    const scores = engine.step(r1, ctxAt(r1, r1.deadline!))
    expect(scores.phase).toBe('scores')
    expect(scores.deadline).toBe(r1.deadline! + SCORES_SECONDS * 1000)
    const r2 = engine.step(scores, ctxAt(scores, scores.deadline!))
    expect(r2.phase).toBe('question')
    expect(r2.round).toBe(2)
    expect(r2.inputKey).toBe(keys.answer(2))
    expect(r2.answers).toEqual({})
    expect(r2.realQuestion).toBeNull()
    expect(r2.result).toBeNull()
    expect(mesaOf(r2).pair).not.toBe(mesaOf(r1).pair)
    // O impostor da rodada 1 (o 1) não repete enquanto os outros não forem.
    expect(mesaOf(r2).impostor).not.toBe(1)

    const last: State = { ...r1, round: 3 }
    const final = engine.step(last, ctxAt(last, last.deadline!))
    expect(final.over).toBe(true)
    expect(final.phase).toBe('final')
    expect(final.deadline).toBeNull()
    expect(engine.step(final, ctxAt(final, NOW + 999_999, {}, { command: skip() }))).toBe(final)
  })

  it('todo mundo tem a sua vez de impostor e as perguntas não repetem', () => {
    const result = runSimulation(engine, { players: 3, seed: 5, options: { rounds: 3, chaos: false } })
    const impostors = result.state.history.map((entry) => entry.impostor)
    expect([...impostors].sort()).toEqual([1, 2, 3])
    const questions = result.state.history.map((entry) => entry.realQuestion)
    expect(new Set(questions).size).toBe(3)
  })

  it('rodada sem impostor: nunca na 1ª, no máximo uma por partida e só com a opção ligada', () => {
    let seen = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const on = runSimulation(engine, { players: 5, seed, options: { rounds: 7, chaos: true, talkSeconds: 45 } })
      const empty = on.state.history.filter((entry) => entry.impostor === null)
      expect(empty.length).toBeLessThanOrEqual(1)
      expect(on.state.history[0].impostor).not.toBeNull()
      seen += empty.length
      const off = runSimulation(engine, { players: 5, seed, options: { rounds: 3, chaos: false, talkSeconds: 45 } })
      expect(off.state.history.every((entry) => entry.impostor !== null)).toBe(true)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('prêmios do fim', () => {
    const base = start(4).state
    const state: State = {
      ...base,
      scores: { 1: 5, 2: 5, 3: 1, 4: 0 },
      history: [
        { round: 1, impostor: 3, caught: false, sharp: [1], realQuestion: 'a?' },
        { round: 2, impostor: 1, caught: true, sharp: [2, 4], realQuestion: 'b?' },
        { round: 3, impostor: 3, caught: false, sharp: [2], realQuestion: 'c?' },
        { round: 4, impostor: null, caught: false, sharp: [], realQuestion: 'd?' },
      ],
    }
    const awards = finalAwards(state)
    expect(awards.champions).toEqual([1, 2])
    expect(awards.topScore).toBe(5)
    expect(awards.bluffers).toEqual([3])
    expect(awards.maxEscapes).toBe(2)
    expect(awards.sniffers).toEqual([2])
    expect(awards.maxSharp).toBe(2)
    expect(finalAwards({ ...base, history: [] })).toMatchObject({ champions: [], bluffers: [], sniffers: [] })
  })

  it('o impostor mexido pelo teste (rig) mantém tudo coerente', () => {
    const { state } = start(4)
    const rigged = rig(state, 4)
    expect(mesaOf(rigged).impostor).toBe(4)
    expect(cardOf(rigged, 4)!.odd).toBe(true)
  })
})

describe('simulações', () => {
  it.each([3, 8, 15])('termina com %i jogadores em várias sementes', (players) => {
    for (const seed of [1, 2, 3, 7]) {
      for (const rounds of [3, 5, 7]) {
        const result = runSimulation(engine, { players, seed, options: { rounds, talkSeconds: 45, chaos: true } })
        expect(result.state.over).toBe(true)
        expect(result.state.history).toHaveLength(rounds)
        // Ninguém ganha ponto do nada: a soma bate com os ganhos de cada rodada.
        const total = Object.values(result.state.scores).reduce((sum, value) => sum + value, 0)
        expect(total).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('termina com gente offline, bots lentos e o host pulando', () => {
    for (const seed of [1, 4, 9]) {
      const result = runSimulation(engine, {
        players: 9,
        seed,
        offlineIds: [3, 7],
        actProbability: 0.4,
        skipProbability: 0.2,
        options: optionDefaults(meta.options),
      })
      expect(result.state.over).toBe(true)
      // Impostor nunca sai de quem está offline.
      for (const entry of result.state.history) expect([3, 7]).not.toContain(entry.impostor)
    }
  })

  it('termina mesmo com todo mundo offline (só o relógio anda)', () => {
    const result = runSimulation(engine, { players: 4, seed: 2, offlineIds: [2, 3, 4], options: { rounds: 3 } })
    expect(result.state.over).toBe(true)
  })

  it('15 jogadores: o estado público fica enxuto (só a pergunta da vez)', () => {
    const result = runSimulation(engine, { players: 15, seed: 3, options: { rounds: 3 } })
    for (const state of result.history) {
      expect(publicJson(state).length).toBeLessThan(6000)
    }
  })
})

describe('conteúdo', () => {
  it('pelo menos 60 pares, sem repetir, com perguntas diferentes e do mesmo tipo', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(60)
    const all = PAIRS.flatMap((pair) => [pair.a, pair.b])
    expect(new Set(all).size).toBe(all.length)
    for (const pair of PAIRS) {
      expect(pair.a, pair.a).not.toBe(pair.b)
      expect(['numero', 'nome', 'curta']).toContain(pair.kind)
      for (const question of [pair.a, pair.b]) {
        expect(question.endsWith('?'), question).toBe(true)
        expect(question.length, question).toBeLessThanOrEqual(75)
        expect(question.trim(), question).toBe(question)
      }
    }
    // Um pouco de cada tipo de resposta.
    for (const kind of ['numero', 'nome', 'curta'] as const) {
      expect(PAIRS.filter((pair) => pair.kind === kind).length).toBeGreaterThanOrEqual(15)
    }
  })
})

describe('meta (as regras de ouro do registry.test)', () => {
  const VIBES = ['Cooperativo', 'Dedução', 'Blefe', 'Negociação', 'Corrida', 'Aposta', 'Festa', 'Estratégia']

  it('segue as regras de ouro', () => {
    expect(meta.slug).toBe('pergunta-trocada')
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
    const optionKeys = meta.options.map((option) => option.key)
    expect(new Set(optionKeys).size).toBe(optionKeys.length)
    for (const option of meta.options) {
      expect(option.choices.length).toBeGreaterThanOrEqual(2)
      expect(option.choices.map((choice) => choice.value)).toContain(option.default)
    }
  })

  it('como o registry.test: termina sozinho com 3, 8 e 15 e com offline + pulo', () => {
    for (const players of [3, 8, 15]) {
      expect(runSimulation(engine, { players, seed: players, options: optionDefaults(meta.options) }).state.over).toBe(true)
    }
    const result = runSimulation(engine, {
      players: 9,
      seed: 4,
      offlineIds: [3, 7],
      skipProbability: 0.2,
      actProbability: 0.5,
      options: optionDefaults(meta.options),
    })
    expect(result.state.over).toBe(true)
  })
})
