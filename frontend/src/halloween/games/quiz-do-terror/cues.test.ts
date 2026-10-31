import { describe, expect, it } from 'vitest'
import { makeCtx, makePlayers } from '../../engine/testkit'
import { EYES_ROUND, lanternOf, quizMusic, randomScaresAllowed, revealCue, sceneOf } from './cues'
import { SCORES_EVERY, engine, type QuizReveal, type QuizState } from './engine'

const players = makePlayers(4)

function start(n = 4): QuizState {
  return engine.init(makeCtx({ players: makePlayers(n), now: 1_000_000, options: { questions: 8 } }))
}

function reveal(choices: Record<number, number>, points: Record<number, number>): QuizReveal {
  return { correct: 0, choices, points, times: {}, fastest: [] }
}

describe('o que a TV toca em cada momento', () => {
  it('depois do rufar: acertos, todos acertaram, ninguém acertou, ninguém respondeu', () => {
    expect(revealCue(null)).toBe('ninguem-respondeu')
    expect(revealCue(reveal({}, {}))).toBe('ninguem-respondeu')
    expect(revealCue(reveal({ 1: 1, 2: 2 }, {}))).toBe('ninguem-acertou')
    expect(revealCue(reveal({ 1: 0, 2: 0 }, { 1: 900, 2: 800 }))).toBe('todos-acertaram')
    // Uma pessoa sozinha acertando não é "a sala inteira".
    expect(revealCue(reveal({ 1: 0 }, { 1: 900 }))).toBe('acertos')
    expect(revealCue(reveal({ 1: 0, 2: 3 }, { 1: 900 }))).toBe('acertos')
  })

  it('trilha de perseguição na última pergunta E na revelação dela (sem voltar à do quiz no meio)', () => {
    const first = start()
    expect(quizMusic(first)).toBeNull()
    const last: QuizState = { ...first, round: first.totalRounds }
    expect(quizMusic(last)).toBe('chase')
    expect(quizMusic({ ...last, phase: 'reveal' })).toBe('chase')
    expect(quizMusic({ ...last, over: true })).toBeNull()
    expect(quizMusic({ ...first, round: SCORES_EVERY, phase: 'scores' })).toBeNull()
  })

  it('os olhos no escuro chamam quem está em último, uma vez, no primeiro placar', () => {
    expect(EYES_ROUND).toBe(SCORES_EVERY)
    const state = start()
    expect(lanternOf({ ...state, scores: { 1: 3000, 2: 900, 3: 1200, 4: 2000 } })).toBe(2)
    // Todo mundo empatado (ninguém pontuou, ou todos iguais): ninguém é chamado.
    expect(lanternOf({ ...state, scores: { 1: 0, 2: 0, 3: 0, 4: 0 } })).toBeNull()
    expect(lanternOf({ ...state, scores: { 1: 800, 2: 800, 3: 800, 4: 800 } })).toBeNull()
    // Jogando sozinho não tem lanterna.
    expect(lanternOf({ ...start(1), scores: { 1: 900 } })).toBeNull()
  })

  it('susto aleatório só nos placares sem os olhos (pergunta, revelação e pódio são sagrados)', () => {
    const state = start()
    expect(randomScaresAllowed(state)).toBe(false)
    expect(randomScaresAllowed({ ...state, phase: 'reveal' })).toBe(false)
    // O primeiro placar já tem o susto dos olhos: um aleatório ali enfileiraria
    // os dois e invadiria a próxima pergunta.
    expect(randomScaresAllowed({ ...state, phase: 'scores', round: EYES_ROUND })).toBe(false)
    expect(randomScaresAllowed({ ...state, phase: 'scores', round: EYES_ROUND * 2 })).toBe(true)
    expect(randomScaresAllowed({ ...state, phase: 'scores', round: EYES_ROUND * 2, over: true })).toBe(false)
  })

  it('a cena de cada momento sai do estado e dos nomes, sem depender de quando a tela desenha', () => {
    const state = start()
    const scores = { 1: 3000, 2: 900, 3: 3000, 4: 2000 }
    const board: QuizState = { ...state, phase: 'scores', round: EYES_ROUND, scores }
    const scene = sceneOf(board, players)
    expect(scene.leaderText).toBe('Vlad e Gasparzinho lideram!')
    expect(scene.eyesOn).toBe('Mortícia')
    // Só no primeiro placar.
    expect(sceneOf({ ...board, round: EYES_ROUND * 2 }, players).eyesOn).toBe('')

    const final = sceneOf({ ...state, over: true, scores }, players)
    expect(final.phase).toBe('final')
    expect(final.championText).toBe('Vlad e Gasparzinho')
    expect(final.zoomOn).toBe('Vlad')

    const nobody = sceneOf({ ...state, over: true }, players)
    expect(nobody.championText).toBe('')
    expect(nobody.zoomOn).toBe('')
  })
})
