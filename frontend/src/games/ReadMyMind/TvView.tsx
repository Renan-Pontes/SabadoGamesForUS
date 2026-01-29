import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import {
  Favorite as HeartIcon,
  FavoriteBorder as HeartEmptyIcon,
} from '@mui/icons-material'
import anime from 'animejs'
import type { GameState, Player } from './types'

interface TvViewProps {
  roomCode: string
  gameState: GameState
}

export default function TvView({ roomCode, gameState }: TvViewProps) {
  const cardsRef = useRef<HTMLDivElement>(null)
  const lastCardRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(Date.now())

  // Animação quando nova carta é jogada
  useEffect(() => {
    if (lastCardRef.current && gameState.playedCards.length > 0) {
      anime({
        targets: lastCardRef.current,
        scale: [0, 1.1, 1],
        rotate: ['-10deg', '5deg', '0deg'],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutElastic(1, .5)',
      })
    }
  }, [gameState.playedCards.length])

  // Animação de erro (quando alguém é cortado)
  useEffect(() => {
    if (gameState.lastCutPlayer) {
      anime({
        targets: '.tv-container',
        backgroundColor: ['#0a0a0f', '#3f0000', '#0a0a0f'],
        duration: 800,
        easing: 'easeInOutQuad',
      })
    }
  }, [gameState.lastCutPlayer])

  useEffect(() => {
    if (gameState.phase !== 'roundBreak') return
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 250)
    return () => window.clearInterval(interval)
  }, [gameState.phase])

  const activePlayers = gameState.players.filter(p => !p.isEliminated && p.connected)
  const isCoop = gameState.mode === 'coop'

  // Encontrar quem jogou a última carta
  const lastCard = gameState.playedCards[gameState.playedCards.length - 1]
  const lastPlayer = lastCard 
    ? gameState.players.find(p => p.id === lastCard.playerId)
    : null

  return (
    <Box
      className="tv-container"
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top, ${isCoop ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)'} 0%, transparent 50%),
          radial-gradient(ellipse at bottom, rgba(220, 38, 38, 0.05) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header - Código discreto */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box sx={{ opacity: 0.5 }}>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            SALA
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              letterSpacing: '0.1em',
            }}
          >
            {roomCode}
          </Typography>
        </Box>

        {/* Modo e Rodada */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={isCoop ? 'CO-OP' : 'VERSUS'}
            size="small"
            sx={{
              bgcolor: isCoop ? 'var(--status-ready)' : 'var(--neon-purple)',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          />
          <Chip
            label={`RODADA ${gameState.round}`}
            size="small"
            sx={{
              bgcolor: 'var(--accent-gold)',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          />
        </Box>
      </Box>

      {/* Título do Jogo */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '2rem', md: '3rem' },
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.1em',
          }}
        >
          READ MY MIND
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isCoop 
            ? 'Joguem as cartas em ordem crescente. Sem falar!' 
            : 'Último sobrevivente vence. Quem cortar é eliminado!'}
        </Typography>
      </Box>

      {/* Vidas (Co-op) ou Status (Versus) */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 4 }}>
        {isCoop ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: 'var(--text-muted)', mr: 1 }}>VIDAS:</Typography>
            {Array.from({ length: gameState.maxLives }).map((_, i) => (
              i < gameState.lives ? (
                <HeartIcon 
                  key={i} 
                  sx={{ 
                    color: 'var(--accent-red)', 
                    fontSize: '2rem',
                    filter: 'drop-shadow(0 0 8px var(--accent-red-glow))',
                  }} 
                />
              ) : (
                <HeartEmptyIcon 
                  key={i} 
                  sx={{ color: 'var(--text-muted)', fontSize: '2rem' }} 
                />
              )
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: 'var(--text-muted)' }}>
              {activePlayers.length} jogadores restantes
            </Typography>
          </Box>
        )}
      </Box>

      {/* Área das Cartas Jogadas */}
      <Box
        ref={cardsRef}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
        }}
      >
        {gameState.phase === 'waiting' && (
          <Typography variant="h4" sx={{ color: 'var(--text-muted)' }}>
            Aguardando início...
          </Typography>
        )}

        {gameState.phase === 'dealing' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: 'var(--accent-gold)', mb: 2 }}>
              Distribuindo cartas...
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Cada jogador receberá {gameState.round} carta{gameState.round > 1 ? 's' : ''}
            </Typography>
          </Box>
        )}

        {(gameState.phase === 'playing' || gameState.phase === 'roundEnd') && (
          <Box sx={{ width: '100%', maxWidth: 800 }}>
            {/* Última carta jogada - destaque */}
            {lastCard && (
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mb: 1 }}>
                  {lastPlayer?.name} jogou
                </Typography>
                <Box
                  ref={lastCardRef}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 120,
                    height: 160,
                    background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 60px ${isCoop ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                    border: '3px solid var(--accent-gold)',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '3rem',
                      fontWeight: 700,
                      color: lastCard.value > 50 ? '#dc2626' : '#1e3a8a',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {lastCard.value}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Cartas anteriores */}
            {gameState.playedCards.length > 1 && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mb: 2 }}>
                  Cartas na mesa
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  {gameState.playedCards.slice(0, -1).map((card, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 50,
                        height: 70,
                        background: 'linear-gradient(135deg, #f5f5f5 0%, #d0d0d0 100%)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        opacity: 0.7,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          color: card.value > 50 ? '#dc2626' : '#1e3a8a',
                        }}
                      >
                        {card.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Mensagem de sem cartas ainda */}
            {gameState.playedCards.length === 0 && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ color: 'var(--text-muted)', mb: 2 }}>
                  Aguardando primeira carta...
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                  Quem tem a carta mais baixa? 🤔
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {gameState.phase === 'roundBreak' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h2"
              sx={{
                color: 'var(--accent-gold)',
                mb: 2,
                letterSpacing: '0.1em',
              }}
            >
              INICIANDO RODADA {gameState.round + 1}
            </Typography>
            {gameState.nextRoundTs && (
              <Typography sx={{ color: 'var(--text-primary)', fontSize: '1.5rem', mb: 1 }}>
                {Math.max(0, Math.ceil((gameState.nextRoundTs - now) / 1000))}s
              </Typography>
            )}
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Preparem-se para as novas cartas...
            </Typography>
          </Box>
        )}

        {/* Alerta de corte */}
        {gameState.lastCutPlayer && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(220, 38, 38, 0.95)',
              borderRadius: 'var(--radius-xl)',
              p: 4,
              textAlign: 'center',
              zIndex: 10,
              animation: 'shake 0.5s ease',
            }}
          >
            <Typography variant="h3" sx={{ color: '#fff', mb: 1 }}>
              ⚠️ CORTE!
            </Typography>
            <Typography sx={{ color: '#fff' }}>
              {gameState.players.find(p => p.id === gameState.lastCutPlayer)?.name} foi cortado!
            </Typography>
          </Box>
        )}

        {/* Fim da rodada */}
        {gameState.phase === 'roundEnd' && !gameState.lastCutPlayer && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(34, 197, 94, 0.95)',
              borderRadius: 'var(--radius-xl)',
              p: 4,
              textAlign: 'center',
              zIndex: 10,
            }}
          >
            <Typography variant="h3" sx={{ color: '#fff', mb: 1 }}>
              ✅ RODADA COMPLETA!
            </Typography>
            <Typography sx={{ color: '#fff' }}>
              Preparando rodada {gameState.round + 1}...
            </Typography>
          </Box>
        )}

        {/* Game Over */}
        {gameState.phase === 'gameOver' && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: gameState.winner ? 'rgba(212, 165, 32, 0.95)' : 'rgba(220, 38, 38, 0.95)',
              borderRadius: 'var(--radius-xl)',
              p: 6,
              textAlign: 'center',
              zIndex: 10,
            }}
          >
            <Typography variant="h2" sx={{ color: '#fff', mb: 2 }}>
              {gameState.winner ? '🏆 VITÓRIA!' : '💀 GAME OVER'}
            </Typography>
            <Typography variant="h5" sx={{ color: '#fff' }}>
              {gameState.gameOverReason}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Rodapé - Lista de Jogadores */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mt: 4,
          pt: 3,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {gameState.players.map((player) => (
          <PlayerIndicator 
            key={player.id} 
            player={player} 
            isLastPlayer={lastCard?.playerId === player.id}
            wasCut={gameState.lastCutPlayer === player.id}
            didCut={gameState.lastCutterPlayer === player.id}
          />
        ))}
      </Box>

      {/* CSS para animação de shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(-50%, -50%) rotate(-2deg); }
          75% { transform: translate(-50%, -50%) rotate(2deg); }
        }
      `}</style>
    </Box>
  )
}

// Componente de indicador de jogador
function PlayerIndicator({ 
  player, 
  isLastPlayer,
  wasCut,
  didCut,
}: { 
  player: Player
  isLastPlayer: boolean
  wasCut: boolean
  didCut: boolean
}) {
  const cardCount = player.cards.length

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        opacity: player.isEliminated ? 0.3 : 1,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: player.isEliminated 
            ? 'var(--text-muted)' 
            : player.isHost 
              ? 'var(--accent-red)' 
              : 'var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#fff',
          border: isLastPlayer ? '3px solid var(--neon-cyan)' : 'none',
          boxShadow: isLastPlayer ? '0 0 20px var(--neon-cyan)' : 'none',
          position: 'relative',
        }}
      >
        {player.name.charAt(0).toUpperCase()}
        
        {/* Indicador de status */}
        {(wasCut || didCut) && (
          <Box
            sx={{
              position: 'absolute',
              top: -5,
              right: -5,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--accent-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
            }}
          >
            {wasCut ? '💀' : '⚔️'}
          </Box>
        )}
      </Box>

      {/* Nome */}
      <Typography
        sx={{
          fontSize: '0.75rem',
          color: player.isEliminated ? 'var(--text-muted)' : 'var(--text-primary)',
          fontWeight: 600,
        }}
      >
        {player.name}
      </Typography>

      {/* Cartas restantes */}
      {!player.isEliminated && (
        <Box sx={{ display: 'flex', gap: 0.3 }}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: 16,
                background: 'linear-gradient(135deg, #fff 0%, #ccc 100%)',
                borderRadius: 2,
                border: '1px solid var(--border-subtle)',
              }}
            />
          ))}
          {cardCount === 0 && (
            <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              ✓
            </Typography>
          )}
        </Box>
      )}

      {player.isEliminated && (
        <Typography sx={{ fontSize: '0.65rem', color: 'var(--accent-red)' }}>
          ELIMINADO
        </Typography>
      )}
    </Box>
  )
}
