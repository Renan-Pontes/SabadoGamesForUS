import { describe, expect, it } from 'vitest'
import { makePlayers } from '../../engine/testkit'
import type { RoundResult } from './engine'
import { winnerOf, type Outcome } from './rules'
import { clock, holdsScares, myOutcome, revealCopy, revealMeme, revealNarration, trackFor } from './view'

const players = makePlayers(6)
const OUTCOMES: Outcome[] = ['caught', 'escaped', 'guess-right', 'guess-wrong', 'innocent', 'tie', 'everyone', 'nobody-convicted', 'nobody-free']

function result(outcome: Outcome, extra: Partial<RoundResult> = {}): RoundResult {
  return {
    outcome,
    winner: winnerOf(outcome),
    kind: outcome === 'everyone' ? 'everyone' : outcome.startsWith('nobody') ? 'nobody' : 'normal',
    place: { name: 'Cemitério', icon: '🪦' },
    spies: [1, 4],
    convicted: 1,
    via: 'accusation',
    sharp: [],
    guess: { by: 4, text: 'cemiterio', right: true },
    finalTally: [],
    roles: {},
    gains: {},
    ...extra,
  }
}

describe('textos das telas', () => {
  it('relógio m:ss', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(59_001)).toBe('1:00')
    expect(clock(61_000)).toBe('1:01')
    expect(clock(7 * 60_000)).toBe('7:00')
    expect(clock(null)).toBe('–:––')
  })

  it('todo desfecho tem manchete, legenda e som', () => {
    for (const outcome of OUTCOMES) {
      const copy = revealCopy(result(outcome), players)
      expect(copy.title.length, outcome).toBeGreaterThan(5)
      expect(copy.subtitle.length, outcome).toBeGreaterThan(5)
      expect(copy.headline.length, outcome).toBeGreaterThan(3)
    }
    expect(revealCopy(result('tie'), players).title).toContain('VLAD')
    // Plural com dois espiões.
    expect(revealCopy(result('tie'), players).subtitle).toContain('saíram ilesos')
    expect(revealCopy(result('tie', { spies: [4] }), players).subtitle).toContain('saiu ileso')
    expect(revealCopy(result('everyone'), players).title).toBe('TODO MUNDO ERA ESPIÃO!')
  })

  it('desfecho do ponto de vista de cada um', () => {
    // Pegaram o 1 (que errou o chute na última chance); o 4 era o outro espião.
    const caught = result('caught', { guess: { by: 1, text: 'hospital', right: false } })
    expect(myOutcome(caught, 2)).toMatchObject({ good: true })
    expect(myOutcome(caught, 1).title).toBe('Você foi pego…')
    expect(myOutcome(caught, 4).title).toBe('A mesa venceu os espiões…')
    expect(myOutcome(result('guess-wrong', { convicted: null }), 4).title).toBe('Você errou o chute…')
    expect(myOutcome(result('innocent'), 1)).toMatchObject({ good: true })
    expect(myOutcome(result('innocent'), 3)).toMatchObject({ good: false })
    expect(myOutcome(result('everyone'), 3)).toMatchObject({ good: null })
    expect(myOutcome(result('nobody-convicted', { spies: [] }), 1).title).toBe('Inocente injustiçado!')
  })

  it('meme da revelação: inocente condenado, chute errado e todo mundo espião', () => {
    expect(revealMeme('innocent')).toBe('bruh')
    expect(revealMeme('guess-wrong')).toBe('pipe')
    expect(revealMeme('everyone')).toBe('doot')
    for (const outcome of ['caught', 'escaped', 'guess-right', 'tie', 'nobody-convicted', 'nobody-free'] as const) {
      expect(revealMeme(outcome), outcome).toBeNull()
    }
  })

  it('narração igual em toda rodada e trilha/sustos por fase', () => {
    expect(revealNarration(2, 1)).toContain('Um de vocês é o espião')
    expect(revealNarration(2, 2)).toContain('Dois de vocês são espiões')
    expect(trackFor('talk', false)).toBe('tension')
    expect(trackFor('accuse', false)).toBe('chase')
    expect(trackFor('accuse', true)).toBe('victory')
    expect(holdsScares('talk', false)).toBe(false)
    expect(holdsScares('accuse', false)).toBe(true)
    expect(holdsScares('result', false)).toBe(true)
  })
})
