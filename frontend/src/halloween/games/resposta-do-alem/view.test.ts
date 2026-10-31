import { describe, expect, it } from 'vitest'
import { makePlayers } from '../../engine/testkit'
import { PROMPTS } from './content'
import { MAX_ANSWER_CHARS, answerLength } from './engine'
import {
  cardGrid,
  cardLetter,
  filledAfter,
  limitAnswer,
  namesOf,
  promptParts,
  rankColumns,
  revealLines,
  soloTitle,
  speakablePrompt,
  votesLabel,
} from './view'

describe('auxiliares das telas', () => {
  it('letras das cartas: A até O para 15 respostas', () => {
    expect(Array.from({ length: 15 }, (_, id) => cardLetter(id)).join('')).toBe('ABCDEFGHIJKLMNO')
  })

  it('a frase se divide em volta da lacuna', () => {
    expect(promptParts('O Saci perdeu o gorro e agora ___.')).toEqual({ before: 'O Saci perdeu o gorro e agora ', after: '.' })
    expect(promptParts('Sem lacuna')).toEqual({ before: 'Sem lacuna', after: null })
    for (const prompt of PROMPTS) expect(promptParts(prompt.text).after).not.toBeNull()
  })

  it('a voz lê a lacuna como pausa, sem sobrar sublinhado', () => {
    expect(speakablePrompt('O Saci perdeu o gorro e agora ___.')).toBe('O Saci perdeu o gorro e agora …')
    expect(speakablePrompt('A senha do Wi-Fi é ___, claro.')).toBe('A senha do Wi-Fi é … claro.')
    for (const prompt of PROMPTS) expect(speakablePrompt(prompt.text)).not.toContain('_')
  })

  it('o campo de texto corta no limite do motor (emoji conta 1)', () => {
    expect(limitAnswer('curta')).toBe('curta')
    expect(answerLength(limitAnswer('🎃'.repeat(90)))).toBe(MAX_ANSWER_CHARS)
    expect(limitAnswer('a'.repeat(61))).toHaveLength(MAX_ANSWER_CHARS)
  })

  it('grade da TV: no máximo 5 colunas e letra de pelo menos 28 px (1,75rem)', () => {
    for (let count = 0; count <= 15; count += 1) {
      const grid = cardGrid(count)
      expect(grid.columns).toBeLessThanOrEqual(5)
      expect(Math.ceil(count / grid.columns)).toBeLessThanOrEqual(3)
      const min = Number(/clamp\(([\d.]+)rem/.exec(grid.font)?.[1])
      expect(min).toBeGreaterThanOrEqual(1.75)
    }
  })

  it('a frase preenchida não fica com ponto dobrado ("…conta de luz..")', () => {
    expect(filledAfter('.', 'Esquece de pagar a conta de luz.')).toBe('')
    expect(filledAfter('.', 'Será?')).toBe('')
    expect(filledAfter('.', 'Socorro!!! ')).toBe('')
    expect(filledAfter('.', 'Tô de chinelo…')).toBe('')
    expect(filledAfter('.', 'pudim')).toBe('.')
    expect(filledAfter('.', 'pudim 🍮')).toBe('.')
    expect(filledAfter(', claro.', 'pudim!')).toBe(', claro.')
    expect(filledAfter(null, 'pudim.')).toBeNull()
  })

  it('W.O.: uma alma só, ou várias que escreveram igual', () => {
    expect(soloTitle(1)).toBe('Só uma alma respondeu: vitória por W.O.!')
    expect(soloTitle(3)).toBe('3 almas escreveram igual: vitória por W.O.!')
  })

  it('placar da TV cabe na tela com 15: até 8 linhas entre as rodadas, até 5 no fim (que tem os prêmios)', () => {
    for (let count = 1; count <= 15; count += 1) {
      const between = rankColumns(count, 'scores')
      const final = rankColumns(count, 'final')
      expect(Math.ceil(count / between)).toBeLessThanOrEqual(8)
      expect(Math.ceil(count / final)).toBeLessThanOrEqual(5)
      expect(Math.max(between, final)).toBeLessThanOrEqual(3)
    }
    expect(rankColumns(8, 'scores')).toBe(1)
    expect(rankColumns(9, 'scores')).toBe(2)
    expect(rankColumns(5, 'final')).toBe(1)
    expect(rankColumns(15, 'final')).toBe(3)
  })

  it('revelação com muitas respostas: as perdedoras ficam em 2 linhas para a grade caber', () => {
    expect(revealLines(2)).toBeNull()
    expect(revealLines(8)).toBeNull()
    expect(revealLines(9)).toBe(2)
    expect(revealLines(14)).toBe(2)
  })

  it('nomes e plurais em português', () => {
    const players = makePlayers(3)
    expect(namesOf(players, [1, 2, 3])).toBe('Vlad, Mortícia e Gasparzinho')
    expect(namesOf(players, [])).toBe('Alguém')
    expect(votesLabel(1)).toBe('1 voto')
    expect(votesLabel(3)).toBe('3 votos')
  })
})
