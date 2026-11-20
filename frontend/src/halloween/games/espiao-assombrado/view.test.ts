import { describe, expect, it } from 'vitest'
import { spokenLineProblems } from '../../../lib/spokenLines'
import { makePlayers } from '../../engine/testkit'
import type { EspiaoState, Phase, RoundResult } from './engine'
import { winnerOf, type Outcome } from './rules'
import {
  LAST_MINUTE_LINE,
  clock,
  finalSpoken,
  holdsScares,
  myOutcome,
  revealCopy,
  revealMeme,
  revealNarration,
  revealSpoken,
  spokenLine,
  trackFor,
} from './view'

const players = makePlayers(6)
const OUTCOMES: Outcome[] = ['caught', 'escaped', 'guess-right', 'guess-wrong', 'innocent', 'tie', 'everyone', 'nobody-convicted', 'nobody-free']

function result(outcome: Outcome, extra: Partial<RoundResult> = {}): RoundResult {
  return {
    outcome,
    winner: winnerOf(outcome),
    kind: outcome === 'everyone' ? 'everyone' : outcome.startsWith('nobody') ? 'nobody' : 'normal',
    place: { name: 'Presépio Vivo', icon: '🐑' },
    spies: [1, 4],
    convicted: 1,
    via: 'accusation',
    sharp: [],
    guess: { by: 4, text: 'presepio', right: true },
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
    expect(revealMeme('innocent')).toBe('snowman')
    expect(revealMeme('guess-wrong')).toBe('penguin')
    expect(revealMeme('everyone')).toBe('peek')
    for (const outcome of ['caught', 'escaped', 'guess-right', 'tie', 'nobody-convicted', 'nobody-free'] as const) {
      expect(revealMeme(outcome), outcome).toBeNull()
    }
  })

  it('narração igual em toda rodada e trilha/piadas por fase', () => {
    expect(revealNarration(2, 1)).toBe('Rodada 2. Olhem a carta no celular, sem mostrar a ninguém.')
    expect(revealNarration(2, 2)).toContain('dois espiões')
    expect(trackFor('talk', false)).toBe('natal')
    expect(trackFor('accuse', false)).toBe('jingle')
    expect(trackFor('reveal', false)).toBe('jingle')
    expect(trackFor('accuse', true)).toBe('wish')
    expect(holdsScares('talk', false)).toBe(false)
    expect(holdsScares('accuse', false)).toBe(true)
    expect(holdsScares('result', false)).toBe(true)
  })
})

describe('falas da TV', () => {
  const state = {
    round: 3,
    spyCount: 1,
    seg: 0,
    starter: 2,
    accusation: { by: 1, target: 3 },
    caught: 4,
    result: null,
  } as unknown as EspiaoState
  const phases: Phase[] = ['reveal', 'talk', 'accuse', 'final_vote', 'last_chance', 'result', 'scores', 'final']

  it('uma fala curta por fase, só onde ajuda a sala', () => {
    expect(spokenLine(state, players, 'talk')).toBe(`${players[1].name} começa perguntando. Valendo!`)
    expect(spokenLine({ ...state, seg: 1 }, players, 'talk')).toContain('Acusação rejeitada')
    expect(spokenLine(state, players, 'accuse')).toBe(`${players[0].name} acusou ${players[2].name}. Votem no celular!`)
    expect(spokenLine(state, players, 'scores')).toBe('')
    expect(spokenLine(state, players, 'final', [1])).toContain(players[0].name)
    expect(spokenLine(state, players, 'final', [1, 2, 3, 4])).not.toContain(players[3].name)
  })

  it('toda fala possível passa nas regras da voz', () => {
    const lines = [
      ...phases.flatMap((phase) => [spokenLine(state, players, phase, [1]), spokenLine({ ...state, seg: 1, spyCount: 2 }, players, phase, [])]),
      ...OUTCOMES.flatMap((outcome) => [revealSpoken(result(outcome), players), revealSpoken(result(outcome, { spies: [4] }), players)]),
      revealSpoken(result('tie', { spies: [1, 2, 3, 4] }), players),
      finalSpoken(players, [1, 2, 3, 4, 5]),
      LAST_MINUTE_LINE,
    ].filter(Boolean)
    expect(lines.length).toBeGreaterThan(20)
    for (const line of lines) expect(spokenLineProblems(line), line).toEqual([])
  })
})
