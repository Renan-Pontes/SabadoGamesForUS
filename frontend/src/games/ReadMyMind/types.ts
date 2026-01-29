// Tipos do jogo Read My Mind

export type GameMode = 'coop' | 'versus'

export type GamePhase = 
  | 'waiting'      // Aguardando início
  | 'dealing'      // Distribuindo cartas
  | 'playing'      // Jogando
  | 'roundBreak'   // Pausa entre rodadas
  | 'roundEnd'     // Fim da rodada (sucesso ou falha)
  | 'gameOver'     // Fim do jogo

export interface Card {
  value: number
  playerId: string | null  // null = ainda não jogada
  playedAt?: number        // timestamp de quando foi jogada
}

export interface Player {
  id: string
  name: string
  cards: number[]          // Cartas na mão
  isEliminated: boolean    // Apenas para modo versus
  isHost: boolean
  connected: boolean
}

export interface GameState {
  mode: GameMode
  phase: GamePhase
  round: number
  maxRounds: number
  nextRoundTs?: number

  // Cartas
  playedCards: Card[]      // Cartas já jogadas na mesa
  
  // Jogadores
  players: Player[]
  
  // Co-op
  lives: number
  maxLives: number
  
  // Versus
  lastCutPlayer: string | null    // Quem foi cortado
  lastCutterPlayer: string | null // Quem cortou
  
  // Resultado
  winner: string | null           // ID do vencedor (versus) ou 'team' (coop)
  gameOverReason: string | null
}

export interface PlayCardAction {
  type: 'PLAY_CARD'
  playerId: string
  cardValue: number
}

export interface GameAction {
  type: string
  payload?: unknown
}

// Estado inicial do jogo
export const initialGameState: GameState = {
  mode: 'coop',
  phase: 'waiting',
  round: 1,
  maxRounds: 10,
  playedCards: [],
  players: [],
  lives: 3,
  maxLives: 3,
  lastCutPlayer: null,
  lastCutterPlayer: null,
  winner: null,
  gameOverReason: null,
}

// Helpers
export function getActivePlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.isEliminated && p.connected)
}

export function getPlayerById(state: GameState, id: string): Player | undefined {
  return state.players.find(p => p.id === id)
}

export function getAllCardsInHands(state: GameState): number[] {
  return state.players
    .filter(p => !p.isEliminated)
    .flatMap(p => p.cards)
    .sort((a, b) => a - b)
}

export function getLowestCardInHands(state: GameState): number | null {
  const cards = getAllCardsInHands(state)
  return cards.length > 0 ? cards[0] : null
}
