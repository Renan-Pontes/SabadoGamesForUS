import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { getRoom, moveSugoroku, rollSugoroku, tickSugoroku, unlockSugoroku } from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Player, Room } from '../../lib/types'
import { formatSeconds, useCountdown } from '../../games/utils'

type ViewMode = 'tv' | 'host' | 'player'

function getPlayerLabel(player: Player) {
  return player.name || player.user?.profile?.nickname || player.user?.username || 'Player'
}

function coordKey(coord: number[]) {
  const x = coord[0] ?? 0
  const y = coord[1] ?? 0
  return `${x},${y}`
}

export default function SugorokuGame() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated && viewMode !== 'tv') {
      navigate('/')
    }
  }, [authLoading, isAuthenticated, viewMode, navigate])

  useEffect(() => {
    if (!code || viewMode === 'tv') return
    const view = viewMode === 'host' ? 'host' : 'player'
    saveLastRoom(code, view)
  }, [code, viewMode])

  useEffect(() => {
    if (!code) return
    let active = true

    async function poll() {
      try {
        if (viewMode !== 'player') {
          await tickSugoroku(code)
        }
        const data = await getRoom(code)
        if (!active) return
        setRoom(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load room.')
      } finally {
        if (active) {
          setLoadingRoom(false)
        }
      }
    }

    poll()
    const interval = window.setInterval(poll, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, viewMode])

  const state = useMemo(() => (room?.state ?? {}) as Record<string, unknown>, [room])
  const turn = typeof state.turn === 'number' ? state.turn : 1
  const maxTurns = typeof state.max_turns === 'number' ? state.max_turns : 15
  const exitCoord = Array.isArray(state.exit) ? (state.exit as number[]) : [0, 0]
  const deadline = typeof state.deadline_ts === 'number' ? state.deadline_ts : null
  const dice = (state.dice ?? {}) as Record<string, Record<string, number>>

  const countdown = useCountdown(deadline)

  const players = room?.players ?? []

  const me = useMemo(() => {
    if (!room?.players || !user?.id) return null
    return room.players.find((player) => player.user?.id === user.id) ?? null
  }, [room?.players, user?.id])

  const meState = (me?.state ?? {}) as Record<string, unknown>
  const mePos = Array.isArray(meState.position) ? (meState.position as number[]) : [0, 0]
  const meLocked = Boolean(meState.locked)
  const meCanBack = Boolean(meState.can_back)
  const meEliminated = Boolean(meState.eliminated)
  const meCleared = Boolean(meState.cleared)
  const isHost = Boolean(me?.is_host)
  const canToggleView = viewMode !== 'tv' && isHost

  function handleToggleView() {
    if (!code) return
    const nextView = viewMode === 'host' ? 'player' : 'host'
    navigate(`/game/${code}?view=${nextView}`)
  }

  function handleBackToLobby() {
    if (!code) return
    setStayInLobby(code, true)
    if (isHost) {
      navigate(`/host/${code}`)
      return
    }
    navigate(`/play/${code}`)
  }

  const meDice = dice[coordKey(mePos)] ?? {}
  const availableDirections = Object.keys(meDice)

  async function handleMove(action: 'move' | 'stay' | 'back', direction?: 'N' | 'S' | 'E' | 'W') {
    if (!code) return
    setSubmitting(true)
    setError('')
    try {
      await moveSugoroku(code, { action, direction })
      const data = await getRoom(code)
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit move.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlock() {
    if (!code) return
    setSubmitting(true)
    setError('')
    try {
      await unlockSugoroku(code)
      const data = await getRoom(code)
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock room.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoll() {
    if (!code) return
    setSubmitting(true)
    setError('')
    try {
      const data = await rollSugoroku(code)
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll dice.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loadingRoom) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-void)',
        }}
      >
        <CircularProgress sx={{ color: 'var(--accent-gold)' }} />
      </Box>
    )
  }

  if (error && !room) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-void)',
          p: 3,
        }}
      >
        <Typography sx={{ color: 'var(--accent-red)' }}>{error}</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top, rgba(34, 197, 94, 0.12) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: 'var(--status-ready)' }}>
            FUTURE SUGOROKU
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)' }}>
            Room {code?.toUpperCase()} {viewMode !== 'player' ? `• ${viewMode.toUpperCase()}` : ''}
          </Typography>
        </Box>

        {viewMode !== 'tv' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" color="inherit" onClick={handleBackToLobby}>
              Voltar ao lobby
            </Button>
            {canToggleView && (
              <Button variant="outlined" color="secondary" onClick={handleToggleView}>
                {viewMode === 'host' ? 'Ver como jogador' : 'Voltar ao host'}
              </Button>
            )}
          </Box>
        )}

        {viewMode !== 'tv' && meEliminated && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-red)',
              background: 'rgba(220, 38, 38, 0.2)',
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ color: '#fff' }}>
              Você foi eliminado!
            </Typography>
          </Box>
        )}

        {room?.status === 'ended' && viewMode !== 'tv' && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-gold)',
              background: 'rgba(212, 165, 32, 0.2)',
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ color: '#fff' }}>
              {state.winners && Array.isArray(state.winners) && state.winners.length
                ? `Vencedores: ${state.winners
                    .map((id) => players.find((p) => p.id === id)?.name || id)
                    .join(', ')}`
                : 'Partida encerrada'}
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              background: 'rgba(220, 38, 38, 0.15)',
            }}
          >
            <Typography sx={{ color: 'var(--accent-red)' }}>{error}</Typography>
          </Box>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Box
            sx={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-subtle)',
              p: 3,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Status</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label={`Turn ${turn}/${maxTurns}`} sx={{ bgcolor: 'var(--status-ready)', color: '#000' }} />
              <Chip label={`Exit ${exitCoord[0]},${exitCoord[1]}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
              <Chip label={`Timer ${formatSeconds(countdown)}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
            </Box>
            {countdown !== null && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ color: 'var(--status-ready)' }}>
                  {formatSeconds(countdown)}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)' }}>Tempo restante</Typography>
              </Box>
            )}
            {viewMode === 'host' && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={handleRoll} disabled={submitting || room?.status !== 'live'}>
                  Roll dice
                </Button>
              </Box>
            )}
          </Box>

          <Box
            sx={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-subtle)',
              p: 3,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Players</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {players.map((player) => {
                const playerState = (player.state ?? {}) as Record<string, unknown>
                const pos = Array.isArray(playerState.position) ? (playerState.position as number[]) : [0, 0]
                const points = typeof playerState.points === 'number' ? playerState.points : 0
                const eliminated = Boolean(playerState.eliminated)
                const cleared = Boolean(playerState.cleared)
                return (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      opacity: eliminated ? 0.6 : 1,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{getPlayerLabel(player)}</Typography>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {eliminated ? 'Eliminated' : cleared ? 'Cleared' : `Pos ${pos[0]},${pos[1]}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={`Pts ${points}`}
                      size="small"
                      sx={{
                        bgcolor: eliminated ? 'var(--accent-red)' : 'var(--bg-elevated)',
                        color: eliminated ? '#fff' : 'var(--text-primary)',
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>

        {viewMode === 'player' && (
          <Box
            sx={{
              mt: 3,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-subtle)',
              p: 3,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Your move</Typography>
            <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
              Position: {mePos[0]},{mePos[1]} {meLocked ? '• Locked' : ''}
            </Typography>
            {meEliminated || meCleared ? (
              <Typography sx={{ color: 'var(--accent-red)' }}>
                {meEliminated ? 'You are eliminated.' : 'You cleared the board!'}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {availableDirections.map((direction) => (
                  <Button
                    key={direction}
                    variant="outlined"
                    onClick={() => handleMove('move', direction as 'N' | 'S' | 'E' | 'W')}
                    disabled={submitting || room?.status !== 'live' || meLocked}
                  >
                    Move {direction} ({meDice[direction]})
                  </Button>
                ))}
                <Button
                  variant="outlined"
                  onClick={() => handleMove('stay')}
                  disabled={submitting || room?.status !== 'live'}
                >
                  Stay
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleMove('back')}
                  disabled={submitting || room?.status !== 'live' || !meCanBack}
                >
                  Back
                </Button>
                {meLocked && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleUnlock}
                    disabled={submitting || room?.status !== 'live'}
                  >
                    Unlock
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
