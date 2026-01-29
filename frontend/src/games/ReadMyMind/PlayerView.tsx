import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, Chip } from '@mui/material'
import {
  Favorite as HeartIcon,
} from '@mui/icons-material'
import anime from 'animejs'
import type { GameState } from './types'

interface PlayerViewProps {
  roomCode: string
  playerId: string
  gameState: GameState
  onPlayCard: (cardValue: number) => void
}

export default function PlayerView({ 
  roomCode, 
  playerId, 
  gameState, 
  onPlayCard 
}: PlayerViewProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const cardsRef = useRef<HTMLDivElement>(null)

  const player = gameState.players.find(p => p.id === playerId)
  const myCards = player?.cards || []
  const isEliminated = player?.isEliminated || false
  const isCoop = gameState.mode === 'coop'

  // Animação das cartas na mão
  useEffect(() => {
    if (cardsRef.current && myCards.length > 0) {
      anime({
        targets: cardsRef.current.querySelectorAll('.hand-card'),
        translateY: [100, 0],
        opacity: [0, 1],
        rotate: (_el: HTMLElement, i: number) => {
          const total = myCards.length
          const spread = Math.min(total * 5, 20)
          return (i - (total - 1) / 2) * spread / total
        },
        delay: anime.stagger(100),
        easing: 'easeOutElastic(1, .6)',
        duration: 800,
      })
    }
  }, [myCards.length, gameState.round])

  // Animação quando carta é jogada
  function handlePlayCard() {
    if (selectedCard === null || isPlaying) return

    setIsPlaying(true)

    // Animar a carta saindo
    const cardEl = cardsRef.current?.querySelector(`[data-value="${selectedCard}"]`)
    if (cardEl) {
      anime({
        targets: cardEl,
        translateY: -200,
        opacity: 0,
        scale: 0.5,
        duration: 400,
        easing: 'easeInBack',
        complete: () => {
          onPlayCard(selectedCard)
          setSelectedCard(null)
          setIsPlaying(false)
        },
      })
    } else {
      onPlayCard(selectedCard)
      setSelectedCard(null)
      setIsPlaying(false)
    }
  }

  // Última carta jogada
  const lastCard = gameState.playedCards[gameState.playedCards.length - 1]
  const lastPlayer = lastCard 
    ? gameState.players.find(p => p.id === lastCard.playerId)
    : null

  // Verificar se fui cortado ou cortei alguém
  const wasCut = gameState.lastCutPlayer === playerId
  const didCut = gameState.lastCutterPlayer === playerId

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at bottom, ${isCoop ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)'} 0%, transparent 50%),
          var(--bg-void)
        `,
        display: 'flex',
        flexDirection: 'column',
        p: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            {roomCode}
          </Typography>
          <Typography variant="h6" sx={{ color: 'var(--accent-gold)' }}>
            {player?.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`R${gameState.round}`}
            size="small"
            sx={{ bgcolor: 'var(--accent-gold)', color: '#000', fontWeight: 700 }}
          />
          {isCoop && (
            <Box sx={{ display: 'flex' }}>
              {Array.from({ length: gameState.lives }).map((_, i) => (
                <HeartIcon key={i} sx={{ color: 'var(--accent-red)', fontSize: '1.2rem' }} />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Status central */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Fase de espera */}
        {gameState.phase === 'waiting' && (
          <Typography sx={{ color: 'var(--text-muted)' }}>
            Aguardando início do jogo...
          </Typography>
        )}

        {/* Distribuindo cartas */}
        {gameState.phase === 'dealing' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: 'var(--accent-gold)', mb: 1 }}>
              🃏 Recebendo cartas...
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Você receberá {gameState.round} carta{gameState.round > 1 ? 's' : ''}
            </Typography>
          </Box>
        )}

        {/* Pausa entre rodadas */}
        {gameState.phase === 'roundBreak' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: 'var(--accent-gold)', mb: 1 }}>
              Preparando rodada {gameState.round + 1}...
            </Typography>
            {gameState.nextRoundTs && (
              <Typography sx={{ color: 'var(--text-primary)', mb: 1 }}>
                {Math.max(0, Math.ceil((gameState.nextRoundTs - Date.now()) / 1000))}s
              </Typography>
            )}
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Novas cartas chegando em instantes.
            </Typography>
          </Box>
        )}

        {/* Eliminado */}
        {isEliminated && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: 'var(--accent-red)', mb: 2 }}>
              💀 ELIMINADO
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Você foi eliminado do jogo. Assista a TV!
            </Typography>
          </Box>
        )}

        {/* Alerta de corte */}
        {(wasCut || didCut) && gameState.phase === 'playing' && (
          <Box
            sx={{
              background: 'rgba(220, 38, 38, 0.9)',
              borderRadius: 'var(--radius-lg)',
              p: 3,
              mb: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ color: '#fff' }}>
              {wasCut ? '😱 Você foi cortado!' : '⚔️ Você cortou alguém!'}
            </Typography>
            {!isCoop && (
              <Typography sx={{ color: '#fff', opacity: 0.8, mt: 1 }}>
                {gameState.players.filter(p => !p.isEliminated).length === 2 
                  ? (wasCut ? 'Você GANHOU!' : 'Você foi eliminado!')
                  : 'Você foi eliminado!'}
              </Typography>
            )}
          </Box>
        )}

        {/* Jogando - mostrar última carta */}
        {gameState.phase === 'playing' && !isEliminated && lastCard && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Última carta ({lastPlayer?.name})
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 80,
                background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: lastCard.value > 50 ? '#dc2626' : '#1e3a8a',
                }}
              >
                {lastCard.value}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Fim de rodada */}
        {gameState.phase === 'roundEnd' && !isEliminated && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: 'var(--status-ready)', mb: 2 }}>
              ✅ Rodada completa!
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Aguardando próxima rodada...
            </Typography>
          </Box>
        )}

        {/* Game Over */}
        {gameState.phase === 'gameOver' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="h3" 
              sx={{ 
                color: gameState.winner === playerId || gameState.winner === 'team' 
                  ? 'var(--accent-gold)' 
                  : 'var(--accent-red)',
                mb: 2,
              }}
            >
              {gameState.winner === playerId || gameState.winner === 'team' 
                ? '🏆 VITÓRIA!' 
                : '💀 GAME OVER'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)' }}>
              {gameState.gameOverReason}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Cartas na mão */}
        {gameState.phase === 'playing' && !isEliminated && myCards.length > 0 && (
        <Box
          ref={cardsRef}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mb: 2,
          }}
        >
          {myCards.map((card) => (
            <Box
              key={card}
              data-value={card}
              className="hand-card"
              onClick={() => setSelectedCard(selectedCard === card ? null : card)}
              sx={{
                width: 70,
                height: 100,
                background: selectedCard === card
                  ? 'linear-gradient(135deg, var(--accent-gold) 0%, #fbbf24 100%)'
                  : 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: selectedCard === card ? 'translateY(-10px) scale(1.05)' : 'none',
                boxShadow: selectedCard === card
                  ? '0 10px 30px var(--accent-gold-glow)'
                  : 'var(--shadow-md)',
                border: selectedCard === card
                  ? '3px solid var(--accent-gold)'
                  : '2px solid var(--border-subtle)',
                opacity: 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: card > 50 ? '#dc2626' : '#1e3a8a',
                }}
              >
                {card}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Botão de jogar */}
      {gameState.phase === 'playing' && !isEliminated && (
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handlePlayCard}
          disabled={selectedCard === null || isPlaying}
          sx={{
            py: 2,
            fontSize: '1.2rem',
            background: selectedCard !== null
              ? 'linear-gradient(135deg, var(--accent-red) 0%, #b91c1c 100%)'
              : undefined,
            '&:disabled': {
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
            },
          }}
        >
          {selectedCard !== null
            ? `JOGAR ${selectedCard}`
            : 'Selecione uma carta'}
        </Button>
      )}

      {/* Dica */}
      {gameState.phase === 'playing' && !isEliminated && myCards.length > 0 && (
        <Typography 
          sx={{ 
            textAlign: 'center', 
            color: 'var(--text-muted)', 
            fontSize: '0.8rem',
            mt: 2,
          }}
        >
          💡 Jogue quando achar que sua carta é a menor!
        </Typography>
      )}

      {/* Sem cartas */}
      {gameState.phase === 'playing' && !isEliminated && myCards.length === 0 && player && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h5" sx={{ color: 'var(--status-ready)' }}>
            ✅ Você jogou todas suas cartas!
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', mt: 1 }}>
            Aguardando outros jogadores...
          </Typography>
        </Box>
      )}

      {/* Jogador não encontrado */}
      {gameState.phase === 'playing' && !player && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'var(--text-muted)' }}>
            Conectando ao jogo...
          </Typography>
        </Box>
      )}
    </Box>
  )
}
