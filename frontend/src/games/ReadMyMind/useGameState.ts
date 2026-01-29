import { useState, useCallback } from 'react'
import type { GameState, GameMode, Player, Card } from './types'

// Gerar cartas aleatórias únicas
function generateUniqueCards(count: number, exclude: number[] = []): number[] {
  const available = Array.from({ length: 100 }, (_, i) => i + 1)
    .filter(n => !exclude.includes(n))
  
  const cards: number[] = []
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length)
    cards.push(available[idx])
    available.splice(idx, 1)
  }
  return cards.sort((a, b) => a - b)
}

// Estado inicial
const createInitialState = (mode: GameMode, players: Player[]): GameState => ({
  mode,
  phase: 'waiting',
  round: 1,
  maxRounds: mode === 'coop' ? 10 : 8,
  playedCards: [],
  players,
  lives: 3,
  maxLives: 3,
  lastCutPlayer: null,
  lastCutterPlayer: null,
  winner: null,
  gameOverReason: null,
})

export function useReadMyMindGame(initialMode: GameMode = 'coop') {
  const [state, setState] = useState<GameState>(() => 
    createInitialState(initialMode, [])
  )

  // Iniciar jogo com jogadores
  const startGame = useCallback((mode: GameMode, playerNames: { id: string; name: string; isHost: boolean }[]) => {
    const players: Player[] = playerNames.map(p => ({
      ...p,
      cards: [],
      isEliminated: false,
      connected: true,
    }))

    setState({
      ...createInitialState(mode, players),
      phase: 'dealing',
    })

    // Simular delay de distribuição
    setTimeout(() => {
      setState(prev => {
        const usedCards: number[] = []
        const updatedPlayers = prev.players.map(p => {
          const cards = generateUniqueCards(prev.round, usedCards)
          usedCards.push(...cards)
          return { ...p, cards }
        })

        return {
          ...prev,
          players: updatedPlayers,
          phase: 'playing',
        }
      })
    }, 1500)
  }, [])

  // Jogar uma carta
  const playCard = useCallback((playerId: string, cardValue: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev

      const player = prev.players.find(p => p.id === playerId)
      if (!player || !player.cards.includes(cardValue)) return prev

      // Verificar se há cartas menores nas mãos de outros jogadores
      const otherPlayersCards = prev.players
        .filter(p => p.id !== playerId && !p.isEliminated)
        .flatMap(p => p.cards)
      
      const lowerCards = otherPlayersCards.filter(c => c < cardValue)
      const hasCut = lowerCards.length > 0

      // Encontrar quem foi cortado (tem a menor carta)
      let cutPlayerId: string | null = null
      if (hasCut) {
        const lowestCard = Math.min(...lowerCards)
        const cutPlayer = prev.players.find(p => 
          p.id !== playerId && !p.isEliminated && p.cards.includes(lowestCard)
        )
        cutPlayerId = cutPlayer?.id || null
      }

      // Nova carta jogada
      const newCard: Card = {
        value: cardValue,
        playerId,
        playedAt: Date.now(),
      }

      // Atualizar mão do jogador
      let updatedPlayers = prev.players.map(p => {
        if (p.id === playerId) {
          return { ...p, cards: p.cards.filter(c => c !== cardValue) }
        }
        return p
      })

      let newLives = prev.lives
      let newPhase: GameState['phase'] = prev.phase
      let winner: string | null = null
      let gameOverReason: string | null = null

      if (hasCut) {
        if (prev.mode === 'coop') {
          // Co-op: perde vida
          newLives = prev.lives - lowerCards.length

          // Descartar cartas menores de quem foi cortado
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id !== playerId && !p.isEliminated) {
              return { 
                ...p, 
                cards: p.cards.filter(c => c >= cardValue) 
              }
            }
            return p
          })

          if (newLives <= 0) {
            newPhase = 'gameOver'
            gameOverReason = 'Vocês perderam todas as vidas!'
          }
        } else {
          // Versus: eliminar quem cortou e quem foi cortado
          const activePlayers = updatedPlayers.filter(p => !p.isEliminated)
          
          if (activePlayers.length === 2) {
            // Exceção: 2 jogadores - cortado ganha
            updatedPlayers = updatedPlayers.map(p => ({
              ...p,
              isEliminated: p.id === playerId, // Quem cortou perde
            }))
            winner = cutPlayerId
            newPhase = 'gameOver'
            gameOverReason = `${player.name} cortou e foi eliminado!`
          } else {
            // Normal: ambos são eliminados
            updatedPlayers = updatedPlayers.map(p => ({
              ...p,
              isEliminated: p.isEliminated || p.id === playerId || p.id === cutPlayerId,
              cards: (p.id === playerId || p.id === cutPlayerId) ? [] : p.cards,
            }))

            // Verificar se sobrou só 1
            const remaining = updatedPlayers.filter(p => !p.isEliminated)
            if (remaining.length === 1) {
              winner = remaining[0].id
              newPhase = 'gameOver'
              gameOverReason = `${remaining[0].name} é o último sobrevivente!`
            }
          }
        }
      }

      // Verificar se rodada terminou (todas as cartas jogadas)
      const totalCardsRemaining = updatedPlayers
        .filter(p => !p.isEliminated)
        .reduce((sum, p) => sum + p.cards.length, 0)

      if (totalCardsRemaining === 0 && newPhase === 'playing') {
        newPhase = 'roundEnd'
      }

      return {
        ...prev,
        players: updatedPlayers,
        playedCards: [...prev.playedCards, newCard],
        lives: newLives,
        phase: newPhase,
        lastCutPlayer: hasCut ? cutPlayerId : null,
        lastCutterPlayer: hasCut ? playerId : null,
        winner,
        gameOverReason,
      }
    })
  }, [])

  // Próxima rodada
  const nextRound = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'roundEnd') return prev

      const newRound = prev.round + 1

      // Verificar se ganhou o jogo (co-op)
      if (prev.mode === 'coop' && newRound > prev.maxRounds) {
        return {
          ...prev,
          phase: 'gameOver',
          winner: 'team',
          gameOverReason: `Parabéns! Vocês completaram ${prev.maxRounds} rodadas!`,
        }
      }

      // Distribuir novas cartas
      const usedCards: number[] = []
      const updatedPlayers = prev.players.map(p => {
        if (p.isEliminated) return p
        const cards = generateUniqueCards(newRound, usedCards)
        usedCards.push(...cards)
        return { ...p, cards }
      })

      return {
        ...prev,
        round: newRound,
        playedCards: [],
        players: updatedPlayers,
        phase: 'playing',
        lastCutPlayer: null,
        lastCutterPlayer: null,
      }
    })
  }, [])

  // Resetar jogo
  const resetGame = useCallback(() => {
    setState(prev => createInitialState(prev.mode, []))
  }, [])

  return {
    state,
    startGame,
    playCard,
    nextRound,
    resetGame,
  }
}
