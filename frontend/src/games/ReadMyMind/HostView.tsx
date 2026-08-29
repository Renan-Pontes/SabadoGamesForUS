import { Box, Typography, Button } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import type { GameMode, GameState } from './types'
import { getAccent } from '../theme'
import { GameCard, GameShell, PlayingCard, StatPill } from '../ui'

interface HostViewProps {
  roomCode: string
  gameState: GameState
  onStartGame: (mode: GameMode) => void
  onNextRound: () => void
  onEndGame: () => void
  onRestartGame: () => void
  onChangeGame?: () => void
  /** Alterna para a tela de jogo do host. */
  onPlayAsHost?: () => void
  onBack?: () => void
}

const ACCENT = getAccent('read-my-mind')

const MODES: { key: GameMode; label: string; hint: string; color: string }[] = [
  {
    key: 'coop',
    label: 'CO-OP',
    hint: 'Time contra o baralho. 3 vidas, 10 rodadas.',
    color: 'var(--status-ready)',
  },
  {
    key: 'versus',
    label: 'VERSUS',
    hint: 'Quem cortar é eliminado. Último de pé vence.',
    color: 'var(--neon-purple)',
  },
]

export default function HostView({
  roomCode,
  gameState,
  onStartGame,
  onNextRound,
  onEndGame,
  onRestartGame,
  onChangeGame,
  onPlayAsHost,
  onBack,
}: HostViewProps) {
  const isCoop = gameState.mode === 'coop'
  const notStarted = gameState.phase === 'waiting'
  const isOver = gameState.phase === 'gameOver'
  const activePlayers = gameState.players.filter((p) => !p.isEliminated && p.connected)
  const played = gameState.playedCards
  const lastCard = played[played.length - 1]

  return (
    <GameShell
      title="READ MY MIND"
      tagline="Painel do host: acompanhe a mesa e controle o ritmo da partida."
      accent={ACCENT}
      roomCode={roomCode}
      viewMode="host"
      onBack={onBack}
      headerExtra={
        !notStarted ? (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill
              label="Modo"
              value={isCoop ? 'CO-OP' : 'VERSUS'}
              accent={isCoop ? 'var(--status-ready)' : 'var(--neon-purple)'}
              filled
            />
            <StatPill label="Rodada" value={`${gameState.round}/${gameState.maxRounds}`} accent={ACCENT.main} />
            <StatPill label="Em jogo" value={activePlayers.length} accent={ACCENT.main} />
            {isCoop && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  px: 1.75,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.035)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    letterSpacing: '0.18em',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  VIDAS
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  {Array.from({ length: gameState.maxLives }).map((_, index) =>
                    index < gameState.lives ? (
                      <FavoriteIcon key={index} sx={{ color: 'var(--accent-red)', fontSize: '1.2rem' }} />
                    ) : (
                      <FavoriteBorderIcon
                        key={index}
                        sx={{ color: 'var(--text-muted)', fontSize: '1.2rem', opacity: 0.4 }}
                      />
                    ),
                  )}
                </Box>
              </Box>
            )}
          </Box>
        ) : undefined
      }
    >
      {/* Antes de começar: escolher o modo */}
      {notStarted && (
        <GameCard title="ESCOLHA O MODO" accent={ACCENT.main} highlight>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {MODES.map((mode) => (
              <Box
                key={mode.key}
                onClick={() => onStartGame(mode.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onStartGame(mode.key)
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  p: 3,
                  textAlign: 'center',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${mode.color}`,
                  background: `linear-gradient(150deg, ${mode.color}1f, transparent)`,
                  transition: 'transform 220ms ease, box-shadow 220ms ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 0 30px ${mode.color}55` },
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2rem',
                    letterSpacing: '0.1em',
                    color: mode.color,
                  }}
                >
                  {mode.label}
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mt: 0.5 }}>
                  {mode.hint}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  sx={{
                    mt: 2,
                    bgcolor: mode.color,
                    backgroundImage: 'none',
                    color: '#0a0a0f',
                    '&:hover': { bgcolor: mode.color, backgroundImage: 'none', filter: 'brightness(1.1)' },
                  }}
                >
                  Começar
                </Button>
              </Box>
            ))}
          </Box>
        </GameCard>
      )}

      {/* Durante a partida */}
      {!notStarted && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <GameCard
            title="A MESA"
            hint={played.length ? `${played.length} carta(s)` : 'vazia'}
            accent={ACCENT.main}
            highlight
          >
            {lastCard ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, alignItems: 'center' }}>
                {played.slice(0, -1).map((card, index) => (
                  <PlayingCard
                    key={`${card.value}-${index}`}
                    faceValue={card.value}
                    size="sm"
                    dimmed
                    dealDelay={index * 40}
                  />
                ))}
                <PlayingCard key={`last-${lastCard.value}`} faceValue={lastCard.value} size="md" highlight />
              </Box>
            ) : (
              <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', py: 4 }}>
                Nenhuma carta na mesa ainda.
              </Typography>
            )}
          </GameCard>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <GameCard title="JOGADORES" accent={ACCENT.main} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {gameState.players.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.035)',
                      opacity: player.isEliminated ? 0.45 : 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {player.name}
                        {player.isHost && (
                          <Box
                            component="span"
                            sx={{
                              ml: 0.75,
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              letterSpacing: '0.14em',
                              color: 'var(--text-muted)',
                            }}
                          >
                            HOST
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {player.isEliminated
                          ? 'Eliminado'
                          : !player.connected
                            ? 'Offline'
                            : player.cards.length === 0
                              ? 'Mão vazia'
                              : `${player.cards.length} carta(s)`}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: player.isEliminated
                          ? 'var(--accent-red)'
                          : !player.connected
                            ? 'var(--status-offline)'
                            : 'var(--status-ready)',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </GameCard>

            <GameCard title="CONTROLES" accent="var(--accent-gold)" index={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {!isOver && (
                  <Button
                    fullWidth
                    variant="outlined"
                    color="secondary"
                    startIcon={<SkipNextRoundedIcon />}
                    onClick={onNextRound}
                  >
                    Forçar próxima rodada
                  </Button>
                )}

                {onPlayAsHost && (
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<SwapHorizRoundedIcon />}
                    onClick={onPlayAsHost}
                  >
                    Jogar como host
                  </Button>
                )}

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ReplayRoundedIcon />}
                  onClick={onRestartGame}
                >
                  Reiniciar partida
                </Button>

                {onChangeGame && (
                  <Button fullWidth variant="outlined" color="inherit" onClick={onChangeGame}>
                    Trocar de jogo
                  </Button>
                )}

                <Button
                  fullWidth
                  variant="text"
                  color="error"
                  startIcon={<StopRoundedIcon />}
                  onClick={onEndGame}
                >
                  Encerrar
                </Button>
              </Box>
            </GameCard>
          </Box>
        </Box>
      )}

      {/* Resultado, sem cobrir os controles do host */}
      {isOver && (
        <GameCard accent={gameState.winner ? 'var(--accent-gold)' : 'var(--accent-red)'} highlight sx={{ mt: 2 }} index={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '3rem', lineHeight: 1, mb: 1 }}>
              {gameState.winner ? '👑' : '💀'}
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.4rem',
                letterSpacing: '0.06em',
                color: gameState.winner ? 'var(--accent-gold)' : 'var(--accent-red)',
              }}
            >
              {gameState.winner ? 'VITÓRIA' : 'GAME OVER'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
              {gameState.gameOverReason}
            </Typography>
          </Box>
        </GameCard>
      )}
    </GameShell>
  )
}
