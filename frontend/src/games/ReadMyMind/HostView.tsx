import { useState } from 'react'
import { Box, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import {
  PlayArrow as PlayIcon,
  SkipNext as NextIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Favorite as HeartIcon,
} from '@mui/icons-material'
import type { GameState, GameMode } from './types'

interface HostViewProps {
  roomCode: string
  gameState: GameState
  onStartGame: (mode: GameMode) => void
  onNextRound: () => void
  onEndGame: () => void
  onRestartGame: () => void
  onChangeGame?: () => void
}

export default function HostView({
  roomCode,
  gameState,
  onStartGame,
  onNextRound,
  onEndGame,
  onRestartGame,
  onChangeGame,
}: HostViewProps) {
  const [modeDialogOpen, setModeDialogOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)

  const isCoop = gameState.mode === 'coop'
  const activePlayers = gameState.players.filter(p => !p.isEliminated && p.connected)
  const totalCardsInHands = activePlayers.reduce((sum, p) => sum + p.cards.length, 0)

  function handleStartClick() {
    setModeDialogOpen(true)
  }

  function handleSelectMode(mode: GameMode) {
    setModeDialogOpen(false)
    onStartGame(mode)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top, rgba(220, 38, 38, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 3,
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            READ MY MIND
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Controles do Host • Sala {roomCode}
          </Typography>
        </Box>

        {/* Status do Jogo */}
        <Box
          sx={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--border-subtle)',
            p: 3,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
              Status do Jogo
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {gameState.phase !== 'waiting' && (
                <>
                  <Chip
                    label={isCoop ? 'CO-OP' : 'VERSUS'}
                    size="small"
                    sx={{
                      bgcolor: isCoop ? 'var(--status-ready)' : 'var(--neon-purple)',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  />
                  <Chip
                    label={`R${gameState.round}`}
                    size="small"
                    sx={{ bgcolor: 'var(--accent-gold)', color: '#000', fontWeight: 700 }}
                  />
                </>
              )}
            </Box>
          </Box>

          {/* Info de status */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: 'var(--text-muted)' }}>Fase:</Typography>
              <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {gameState.phase === 'waiting' && 'Aguardando início'}
                {gameState.phase === 'dealing' && 'Distribuindo cartas'}
                {gameState.phase === 'playing' && 'Em jogo'}
                {gameState.phase === 'roundEnd' && 'Rodada concluída'}
                {gameState.phase === 'gameOver' && 'Fim de jogo'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: 'var(--text-muted)' }}>Jogadores ativos:</Typography>
              <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {activePlayers.length} / {gameState.players.length}
              </Typography>
            </Box>

            {gameState.phase !== 'waiting' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: 'var(--text-muted)' }}>Cartas jogadas:</Typography>
                  <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {gameState.playedCards.length}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: 'var(--text-muted)' }}>Cartas restantes:</Typography>
                  <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {totalCardsInHands}
                  </Typography>
                </Box>

                {isCoop && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ color: 'var(--text-muted)' }}>Vidas:</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {Array.from({ length: gameState.maxLives }).map((_, i) => (
                        <HeartIcon
                          key={i}
                          sx={{
                            color: i < gameState.lives ? 'var(--accent-red)' : 'var(--text-muted)',
                            fontSize: '1.2rem',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* Lista de Jogadores */}
        <Box
          sx={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--border-subtle)',
            p: 3,
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: 'var(--text-primary)', mb: 2 }}>
            Jogadores
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {gameState.players.map((player) => (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  opacity: player.isEliminated ? 0.5 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: player.isHost ? 'var(--accent-red)' : 'var(--accent-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {player.name}
                      {player.isHost && (
                        <Chip
                          label="HOST"
                          size="small"
                          sx={{
                            ml: 1,
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: 'var(--accent-red)',
                            color: '#fff',
                          }}
                        />
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {player.isEliminated ? 'Eliminado' : `${player.cards.length} cartas`}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: !player.connected
                      ? 'var(--status-offline)'
                      : player.isEliminated
                        ? 'var(--accent-red)'
                        : player.cards.length === 0
                          ? 'var(--status-ready)'
                          : 'var(--status-waiting)',
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Controles */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Aguardando início */}
          {gameState.phase === 'waiting' && (
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PlayIcon />}
              onClick={handleStartClick}
              disabled={gameState.players.length < 2}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, var(--accent-red) 0%, #b91c1c 100%)',
              }}
            >
              {gameState.players.length < 2 ? 'Aguardando jogadores...' : 'INICIAR JOGO'}
            </Button>
          )}

          {/* Rodada concluída */}
          {gameState.phase === 'roundEnd' && (
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<NextIcon />}
              onClick={onNextRound}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, var(--status-ready) 0%, #16a34a 100%)',
              }}
            >
              PRÓXIMA RODADA ({gameState.round + 1})
            </Button>
          )}

          {/* Game Over */}
          {gameState.phase === 'gameOver' && (
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<RestartIcon />}
              onClick={onRestartGame}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, var(--accent-gold) 0%, #a16207 100%)',
              }}
            >
              JOGAR NOVAMENTE
            </Button>
          )}

          {/* Em jogo */}
          {gameState.phase === 'playing' && (
            <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              🎮 Jogo em andamento... Aguarde os jogadores.
            </Typography>
          )}

          {gameState.phase === 'roundBreak' && (
            <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              ⏳ Iniciando rodada {gameState.round + 1}...
              {gameState.nextRoundTs ? (
                <span> ({Math.max(0, Math.ceil((gameState.nextRoundTs - Date.now()) / 1000))}s)</span>
              ) : null}
            </Typography>
          )}

          {/* Encerrar */}
          {gameState.phase !== 'waiting' && gameState.phase !== 'gameOver' && (
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<StopIcon />}
              onClick={() => setConfirmEndOpen(true)}
              sx={{ borderWidth: 2 }}
            >
              Encerrar Jogo
            </Button>
          )}

          {/* Ações extras */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={onRestartGame}
            >
              Reiniciar jogo
            </Button>
            {onChangeGame && (
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                onClick={onChangeGame}
              >
                Mudar jogo
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Dialog de seleção de modo */}
      <Dialog
        open={modeDialogOpen}
        onClose={() => setModeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--accent-gold)',
          },
        }}
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: 'var(--accent-gold)' }}>
            SELECIONE O MODO
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSelectMode('coop')}
              sx={{
                py: 3,
                borderWidth: 2,
                borderColor: 'var(--status-ready)',
                color: 'var(--status-ready)',
                flexDirection: 'column',
                '&:hover': {
                  borderWidth: 2,
                  bgcolor: 'rgba(34, 197, 94, 0.1)',
                },
              }}
            >
              <Typography variant="h5">🤝 CO-OP</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mt: 1 }}>
                Trabalhem juntos! 3 vidas compartilhadas.
              </Typography>
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSelectMode('versus')}
              sx={{
                py: 3,
                borderWidth: 2,
                borderColor: 'var(--neon-purple)',
                color: 'var(--neon-purple)',
                flexDirection: 'column',
                '&:hover': {
                  borderWidth: 2,
                  bgcolor: 'rgba(168, 85, 247, 0.1)',
                },
              }}
            >
              <Typography variant="h5">⚔️ VERSUS</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mt: 1 }}>
                Último sobrevivente vence!
              </Typography>
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação */}
      <Dialog
        open={confirmEndOpen}
        onClose={() => setConfirmEndOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--accent-red)',
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ color: 'var(--accent-red)' }}>
            Encerrar Jogo?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'var(--text-secondary)' }}>
            Tem certeza que deseja encerrar o jogo atual?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEndOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmEndOpen(false)
              onEndGame()
            }}
          >
            Encerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
