import type { GameState, Player } from './types'

/** Estados de mentirinha para os testes das telas (sem servidor). */

export function makePlayers(hands: number[][]): Player[] {
  const names = ['Ana', 'Beto', 'Caio', 'Duda', 'Edu', 'Fê', 'Gabi', 'Hugo', 'Iara', 'João', 'Kika', 'Léo', 'Mari', 'Nina', 'Otto']
  return hands.map((cards, index) => ({
    id: String(index + 1),
    name: names[index % names.length],
    cards,
    isEliminated: false,
    isHost: index === 0,
    connected: true,
  }))
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    mode: 'coop',
    phase: 'playing',
    round: 1,
    maxRounds: 10,
    playedCards: [],
    players: makePlayers([[12], [40], [77], [91]]),
    lives: 3,
    maxLives: 3,
    lastCutPlayer: null,
    lastCutterPlayer: null,
    winner: null,
    gameOverReason: null,
    ...overrides,
  }
}

const played = (pairs: [number, string][]) => pairs.map(([value, playerId], index) => ({ value, playerId, playedAt: index * 1000 }))

/** Um retrato de cada momento da partida. */
export function scenarios(): [string, GameState][] {
  const many = makePlayers(
    Array.from({ length: 15 }, (_, i) => Array.from({ length: 6 }, (_, j) => 1 + ((i * 6 + j) * 7) % 100)),
  )
  return [
    ['aguardando', makeState({ phase: 'waiting', players: makePlayers([[], [], []]) })],
    ['mesa vazia', makeState({ round: 2, players: makePlayers([[8, 61], [23, 70], [44, 99]]) })],
    [
      'jogando',
      makeState({
        round: 3,
        players: makePlayers([[61, 80], [70], [44, 99], []]),
        playedCards: played([[5, '1'], [12, '2'], [30, '3']]),
        deadlineTs: 15_000,
      }),
    ],
    [
      'erro no co-op',
      makeState({
        round: 3,
        lives: 2,
        players: makePlayers([[30, 81], [40, 66], [22, 95], []]),
        playedCards: played([[5, '1'], [40, '2']]),
        lastCutterPlayer: '2',
        lastCutPlayer: '3',
      }),
    ],
    ['nível completo', makeState({ phase: 'roundBreak', round: 4, nextRoundTs: 9_000, players: makePlayers([[], [], []]) })],
    ['último nível completo', makeState({ phase: 'roundBreak', round: 10, players: makePlayers([[], [], []]) })],
    [
      'vitória co-op',
      makeState({ phase: 'gameOver', round: 10, winner: 'team', gameOverReason: 'A equipe completou o desafio.' }),
    ],
    ['derrota co-op', makeState({ phase: 'gameOver', round: 6, lives: 0, gameOverReason: 'As vidas acabaram.' })],
    [
      'versus com erro',
      makeState({
        mode: 'versus',
        round: 2,
        players: makePlayers([[], [15, 88], [33], [50, 51]]).map((p, i) => (i === 0 ? { ...p, isEliminated: true } : p)),
        playedCards: played([[60, '1']]),
        lastCutterPlayer: '1',
        lastCutPlayer: '2',
      }),
    ],
    [
      'versus vencedor',
      makeState({
        mode: 'versus',
        phase: 'gameOver',
        players: makePlayers([[], [], []]).map((p, i) => (i === 1 ? p : { ...p, isEliminated: true })),
        winner: '2',
        gameOverReason: 'Beto foi o último de pé.',
      }),
    ],
    ['15 jogadores no nível 6', makeState({ round: 6, players: many, playedCards: played([[1, '1'], [2, '5']]) })],
  ]
}
