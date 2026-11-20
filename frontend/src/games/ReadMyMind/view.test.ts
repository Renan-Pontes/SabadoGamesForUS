import { describe, expect, it } from 'vitest'
import { spokenLineProblems } from '../../lib/spokenLines'
import { makePlayers, makeState } from './fixtures'
import {
  TIMEOUT_LINE,
  TIMEOUT_VERSUS_LINE,
  cardsLeft,
  doorsOpen,
  eventsBetween,
  finalLine,
  levelDoneLine,
  mistakeIndexes,
  mistakeLine,
  mistakeOf,
  mistakeSpoken,
  newLevelLine,
  snapOf,
  sortedHand,
  speechFor,
  speechForEvents,
} from './view'

const card = (value: number, playerId = '1') => ({ value, playerId })

describe('Mente Natalina: leitura do estado', () => {
  it('mão em ordem crescente, sem mexer na original', () => {
    const hand = [70, 3, 41]
    expect(sortedHand(hand)).toEqual([3, 41, 70])
    expect(hand).toEqual([70, 3, 41])
  })

  it('conta só as cartas de quem segue no jogo', () => {
    const players = makePlayers([[1, 2], [3], [4, 5, 6]])
    players[2].isEliminated = true
    expect(cardsLeft(makeState({ players }))).toBe(3)
  })

  it('marca na pilha as cartas jogadas cedo demais', () => {
    expect([...mistakeIndexes([card(5), card(40), card(22), card(40), card(60)])]).toEqual([1])
    expect(mistakeIndexes([card(1), card(2), card(3)]).size).toBe(0)
  })

  it('revela as cartas menores escondidas no erro, da menor para a maior', () => {
    const state = makeState({
      players: makePlayers([[30, 81], [66], [22, 95]]),
      playedCards: [card(5), card(40, '2')],
      lastCutterPlayer: '2',
      lastCutPlayer: '3',
    })
    const m = mistakeOf(state)
    expect(m).not.toBeNull()
    expect(m?.card).toBe(40)
    expect(m?.cutterName).toBe('Beto')
    expect(m?.hidden.map((h) => [h.name, h.value])).toEqual([
      ['Caio', 22],
      ['Ana', 30],
    ])
    expect(mistakeLine(m!)).toMatch(/22|Caio/)
    expect(mistakeOf(makeState({ playedCards: [card(5)] }))).toBeNull()
  })

  it('frase própria quando a menor estava na mão de quem errou', () => {
    const state = makeState({
      players: makePlayers([[10], [50]]),
      playedCards: [card(60, '1')],
      lastCutterPlayer: '1',
    })
    expect(mistakeLine(mistakeOf(state)!)).toContain('própria mão')
  })

  it('portinhas do Advento: níveis vencidos', () => {
    expect(doorsOpen(makeState({ phase: 'waiting' }))).toBe(0)
    expect(doorsOpen(makeState({ round: 4 }))).toBe(3)
    expect(doorsOpen(makeState({ phase: 'roundBreak', round: 4 }))).toBe(4)
    expect(doorsOpen(makeState({ phase: 'gameOver', round: 10, winner: 'team' }))).toBe(10)
  })
})

describe('Mente Natalina: momentos da mesa (sons da TV)', () => {
  const base = makeState({ round: 2, players: makePlayers([[10, 50], [30, 70]]) })

  it('carta nova na mesa', () => {
    const after = { ...base, playedCards: [card(10)] }
    expect(eventsBetween(snapOf(base), snapOf(after))).toEqual(['card'])
  })

  it('erro tira enfeite: só o "cut" (sem timeout duplicado)', () => {
    const after = { ...base, lives: 2, playedCards: [card(50, '1')], lastCutterPlayer: '1', lastCutPlayer: '2' }
    expect(eventsBetween(snapOf(base), snapOf(after))).toEqual(['cut'])
  })

  it('erro que acaba o jogo', () => {
    const after = { ...base, phase: 'gameOver' as const, lives: 0, playedCards: [card(50, '1')], lastCutterPlayer: '1' }
    expect(eventsBetween(snapOf(base), snapOf(after))).toEqual(['cut', 'lose'])
  })

  it('demora tira enfeite', () => {
    expect(eventsBetween(snapOf(base), snapOf({ ...base, lives: 2 }))).toEqual(['timeout'])
  })

  it('nível vencido, nível novo, vitória e recomeço', () => {
    const done = { ...base, phase: 'roundBreak' as const, playedCards: [] }
    expect(eventsBetween(snapOf(base), snapOf(done))).toEqual(['levelDone'])
    const next = { ...base, round: 3 }
    expect(eventsBetween(snapOf(done), snapOf(next))).toEqual(['newLevel'])
    const won = { ...base, phase: 'gameOver' as const, winner: 'team' }
    expect(eventsBetween(snapOf(done), snapOf(won))).toEqual(['win'])
    const restart = makeState({ round: 1 })
    expect(eventsBetween(snapOf(won), snapOf(restart))).toEqual(['start'])
    expect(eventsBetween(snapOf(makeState({ phase: 'waiting' })), snapOf(restart))).toEqual(['start'])
  })

  it('nada muda, nada toca', () => {
    expect(eventsBetween(snapOf(base), snapOf({ ...base }))).toEqual([])
  })
})

describe('Mente Natalina: falas da TV', () => {
  const base = makeState({ round: 2, players: makePlayers([[10, 50], [30, 70]]) })
  const snap = (state: ReturnType<typeof makeState>) => ({ ...snapOf(state), maxRounds: 10 })

  it('a carta jogada não é lida em voz alta', () => {
    const after = snap({ ...base, playedCards: [card(10)] })
    expect(speechFor('card', after)).toBeNull()
    expect(speechForEvents(['card'], after)).toBeNull()
  })

  it('erro fala curto e sem número; o que acaba o jogo fala só o fim', () => {
    const cut = snap({ ...base, lives: 2, playedCards: [card(50, '1')], lastCutterPlayer: '1', lastCutPlayer: '2' })
    expect(speechFor('cut', cut)?.text).toBe('Ops! Ana tinha uma carta menor na própria mão.')
    const other = makeState({ players: makePlayers([[60], [20]]), playedCards: [card(50, '1')], lastCutterPlayer: '1' })
    expect(mistakeSpoken(mistakeOf(other)!)).toBe('Ops! Beto ainda tinha uma carta menor.')
    const lost = snap({ ...base, phase: 'gameOver', lives: 0, playedCards: [card(50, '1')], lastCutterPlayer: '1' })
    expect(speechForEvents(['cut', 'lose'], lost)?.text).toBe('Acabaram os enfeites. Fim de jogo!')
  })

  it('toda fala possível passa nas regras da voz', () => {
    const lines = [
      ...[1, 2, 9, 10].flatMap((round) => [newLevelLine(round), levelDoneLine(round, 10)]),
      finalLine({ winner: null, winnerName: '', mode: 'coop' }),
      finalLine({ winner: null, winnerName: '', mode: 'versus' }),
      finalLine({ winner: 'team', winnerName: '', mode: 'coop' }),
      finalLine({ winner: '2', winnerName: 'Beto', mode: 'versus' }),
      TIMEOUT_LINE,
      TIMEOUT_VERSUS_LINE,
      mistakeSpoken({ key: 'k', cutterId: '1', cutterName: 'Ana', card: 9, hidden: [], victimId: null, victimName: null, coop: true }),
    ]
    for (const line of lines) expect(spokenLineProblems(line), line).toEqual([])
  })
})
