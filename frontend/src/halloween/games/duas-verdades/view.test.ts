import { describe, expect, it } from 'vitest'
import { PROMPTS } from './content'
import { MAX_FACT_CHARS, revealSeconds, type DvOutcome } from './engine'
import {
  PROMPTS_PER_PAGE,
  applyPrompt,
  cardFont,
  cardLetter,
  draftKey,
  holdsScares,
  limitFact,
  myLieCard,
  outcomeCopy,
  problemText,
  promptPage,
  rankColumns,
  revealNarration,
  revealStartedAt,
  turnNarration,
} from './view'

const OUTCOMES: DvOutcome[] = ['fooled-all', 'all-right', 'mixed', 'no-votes']

describe('textos e contas das telas', () => {
  it('letras das cartas', () => {
    expect([0, 1, 2].map(cardLetter)).toEqual(['A', 'B', 'C'])
  })

  it('toda revelação tem manchete, legenda e som; as engraçadas aparecem', () => {
    for (const outcome of OUTCOMES) {
      const copy = outcomeCopy({ outcome, right: [1], fooled: [2, 3] }, 'Ana', 2)
      expect(copy.title.length, outcome).toBeGreaterThan(5)
      expect(copy.subtitle.length, outcome).toBeGreaterThan(5)
      expect(copy.sound).toBeTruthy()
    }
    expect(outcomeCopy({ outcome: 'fooled-all', right: [], fooled: [2] }, 'Ana', 1).title).toBe('ENGANOU TODO MUNDO!')
    expect(outcomeCopy({ outcome: 'all-right', right: [2], fooled: [] }, 'Ana', 1).title).toContain('só que não')
    expect(outcomeCopy({ outcome: 'mixed', right: [1], fooled: [2] }, 'Ana', 1).title).toBe('1 caiu na conversa!')
    expect(outcomeCopy({ outcome: 'mixed', right: [1], fooled: [2, 3] }, 'Ana', 1).title).toBe('2 caíram na conversa!')
    // Variações mudam com a vez, sempre com o nome do autor.
    const subs = new Set([1, 2, 3, 4].map((turn) => outcomeCopy({ outcome: 'fooled-all', right: [], fooled: [2] }, 'Ana', turn).subtitle))
    expect(subs.size).toBeGreaterThan(1)
    for (const sub of subs) expect(sub).toContain('Ana')
  })

  it('narração da vez lê as três frases; a da revelação diz a mentira', () => {
    const cards = [
      { id: 0, text: 'Comi panetone' },
      { id: 1, text: 'Vi neve' },
      { id: 2, text: 'Sou duende' },
    ]
    const line = turnNarration('Bia', cards, 1)
    expect(line).toContain('Bia')
    for (const card of cards) expect(line).toContain(card.text)
    expect(line).toContain('mentira')
    expect(revealNarration({ outcome: 'mixed', right: [1], fooled: [2] }, 'Bia', 'Vi neve', 1)).toContain('Vi neve')
  })

  it('avisos das cartinhas', () => {
    expect(problemText('missing')).toContain('três')
    expect(problemText('duplicate')).toContain('iguais')
    expect(problemText('no-lie')).toContain('mentira')
    expect(problemText(null)).toContain('pronto')
  })

  it('ideias em páginas que dão a volta; Natal primeiro', () => {
    expect(promptPage(0)).toHaveLength(PROMPTS_PER_PAGE)
    expect(promptPage(0)[0]).toBe(PROMPTS[0])
    const pages = Math.ceil(PROMPTS.length / PROMPTS_PER_PAGE)
    expect(promptPage(pages)).toEqual(promptPage(0))
    expect(promptPage(-1)).toEqual(promptPage(pages - 1))
    expect(PROMPTS.some((prompt) => prompt.includes('amigo secreto'))).toBe(true)
    expect(PROMPTS.some((prompt) => prompt.includes('Réveillon'))).toBe(true)
  })

  it('a ideia começa a frase sem apagar o que já tinha e respeita o limite', () => {
    expect(applyPrompt('', 'Na ceia eu sempre')).toBe('Na ceia eu sempre ')
    expect(applyPrompt('Na ceia eu sempre ', 'Tenho medo de')).toBe('Tenho medo de ')
    expect(applyPrompt('Oi', 'Na ceia eu sempre')).toBe('Oi Na ceia eu sempre ')
    expect(Array.from(applyPrompt('x'.repeat(79), 'Tenho medo de')).length).toBe(MAX_FACT_CHARS)
    expect(Array.from(limitFact('🎅'.repeat(100))).length).toBe(MAX_FACT_CHARS)
  })

  it('o celular do autor acha a própria mentira na mesa', () => {
    const cards = [
      { id: 0, text: 'b' },
      { id: 1, text: 'c' },
      { id: 2, text: 'a' },
    ]
    expect(myLieCard({ facts: ['a', 'b', 'c'], lie: 0 }, cards)).toBe(2)
    expect(myLieCard(null, cards)).toBeNull()
    expect(myLieCard({ facts: ['x', 'y', 'z'], lie: 1 }, cards)).toBeNull()
  })

  it('começo da revelação bate com o prazo do motor', () => {
    for (const outcome of OUTCOMES) {
      expect(revealStartedAt(100_000, { outcome })).toBe(100_000 - revealSeconds(outcome) * 1000)
    }
  })

  it('efeitos aleatórios seguram na votação e na revelação', () => {
    expect(holdsScares('vote', false)).toBe(true)
    expect(holdsScares('reveal', false)).toBe(true)
    expect(holdsScares('write', false)).toBe(false)
    expect(holdsScares('reveal', true)).toBe(false)
  })

  it('placar e letras cabem na TV', () => {
    expect(rankColumns(3)).toBe(1)
    expect(rankColumns(15)).toBe(2)
    const short = cardFont([{ id: 0, text: 'curta' }])
    const long = cardFont([{ id: 0, text: 'x'.repeat(80) }])
    expect(short).not.toBe(long)
  })

  it('rascunho por partida', () => {
    expect(draftKey('ABCD', 3, 7)).not.toBe(draftKey('ABCD', 3, 8))
  })
})
