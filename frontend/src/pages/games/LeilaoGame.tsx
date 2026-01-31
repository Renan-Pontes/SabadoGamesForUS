import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, Chip, CircularProgress, TextField, Typography } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { bidLeilao, getRoom, tickLeilao } from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Player, Room } from '../../lib/types'
import { formatSeconds, useCountdown } from '../../games/utils'

type ViewMode = 'tv' | 'host' | 'player'

function getPlayerLabel(player: Player) {
  return player.name || player.user?.profile?.nickname || player.user?.username || 'Player'
}

export default function LeilaoGame() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [bidValue, setBidValue] = useState('')
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
    const roomCode = code
    let active = true

    async function poll() {
      try {
        if (viewMode !== 'player') {
          await tickLeilao(roomCode)
        }
        const data = await getRoom(roomCode)
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
  const round = typeof state.round === 'number' ? state.round : 1
  const maxRounds = typeof state.max_rounds === 'number' ? state.max_rounds : 10
  const pot = typeof state.pot === 'number' ? state.pot : 0
  const carry = typeof state.carry === 'number' ? state.carry : 0
  const deadline = typeof state.deadline_ts === 'number' ? state.deadline_ts : null
  const lastWinnerId = typeof state.last_winner_id === 'number' ? state.last_winner_id : null
  const lastBid = typeof state.last_bid === 'number' ? state.last_bid : null
  const suddenDeath = Boolean(state.sudden_death)
  const tiePlayers = Array.isArray(state.tie_players) ? (state.tie_players as number[]) : []

  const countdown = useCountdown(deadline)

  const players = useMemo(() => room?.players ?? [], [room?.players])

  const me = useMemo(() => {
    if (!room?.players || !user?.id) return null
    return room.players.find((player) => player.user?.id === user.id) ?? null
  }, [room?.players, user?.id])

  const meState = (me?.state ?? {}) as Record<string, unknown>
  const mePoints = typeof meState.points === 'number' ? meState.points : 0
  const meBid = typeof meState.bid === 'number' ? meState.bid : 0
  const meSubmitted = Boolean(meState.submitted)
  const meEliminated = Boolean(meState.eliminated)
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

  const highestBid = useMemo(() => {
    return players.reduce((max, player) => {
      const playerState = (player.state ?? {}) as Record<string, unknown>
      const bid = typeof playerState.bid === 'number' ? playerState.bid : 0
      return Math.max(max, bid)
    }, 0)
  }, [players])

  async function handleBid() {
    if (!code || !bidValue) return
    const value = Number(bidValue)
    if (Number.isNaN(value)) return
    setSubmitting(true)
    setError('')
    try {
      await bidLeilao(code, value)
      const data = await getRoom(code)
      setRoom(data)
      setBidValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bid.')
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

  const lastWinner = players.find((player) => player.id === lastWinnerId)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: 'var(--accent-red)' }}>
            LEILAO DE CEM VOTOS
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)' }}>
            Room {code?.toUpperCase()} {viewMode !== 'player' ? `• ${viewMode.toUpperCase()}` : ''}
          </Typography>
        </Box>

        {viewMode === 'tv' && (
          <Box
            sx={{
              mb: 3,
              p: 3,
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--accent-red)',
              background: 'rgba(220, 38, 38, 0.12)',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
              textAlign: 'center',
            }}
          >
            <Box>
              <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>Último lance</Typography>
              <Typography variant="h2" sx={{ color: 'var(--accent-red)' }}>
                {lastBid ?? '--'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>Total acumulado</Typography>
              <Typography variant="h2" sx={{ color: 'var(--accent-gold)' }}>
                {pot}
              </Typography>
            </Box>
          </Box>
        )}

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
            <Typography sx={{ fontWeight: 600, mb: 2 }}>Round Info</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label={`Round ${round}/${maxRounds}`} sx={{ bgcolor: 'var(--accent-red)', color: '#fff' }} />
              <Chip label={`Pot ${pot}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
              <Chip label={`Carry ${carry}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
              <Chip label={`Timer ${formatSeconds(countdown)}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
            </Box>
            {countdown !== null && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ color: 'var(--accent-red)' }}>
                  {formatSeconds(countdown)}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)' }}>Tempo restante</Typography>
              </Box>
            )}
            <Typography sx={{ mt: 2, color: 'var(--text-secondary)' }}>
              Highest bid: {highestBid}
            </Typography>
            {lastWinner && (
              <Typography sx={{ mt: 1, color: 'var(--status-ready)' }}>
                Last winner: {getPlayerLabel(lastWinner)} {lastBid !== null ? `(bid ${lastBid})` : ''}
              </Typography>
            )}
            {suddenDeath && (
              <Typography sx={{ mt: 1, color: 'var(--accent-gold)' }}>
                Sudden death! Tie players: {tiePlayers.join(', ')}
              </Typography>
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
                const points = typeof playerState.points === 'number' ? playerState.points : 0
                const eliminated = Boolean(playerState.eliminated)
                const isSelf = Boolean(user?.id && player.user?.id === user.id)
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
                        {eliminated ? 'Eliminated' : isSelf && meSubmitted ? 'Lance enviado' : 'Aguardando'}
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
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Place your bid</Typography>
            <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
              Your points: {mePoints}. Current bid: {meBid}.
            </Typography>
            {meEliminated ? (
              <Typography sx={{ color: 'var(--accent-red)' }}>You are eliminated.</Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  type="number"
                  value={bidValue}
                  onChange={(event) => setBidValue(event.target.value)}
                  placeholder="Bid"
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleBid}
                  disabled={!bidValue || submitting || room?.status !== 'live'}
                >
                  {meSubmitted ? 'Update bid' : 'Bid'}
                </Button>
                {meSubmitted && (
                  <Typography sx={{ color: 'var(--status-ready)' }}>Bid submitted!</Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
