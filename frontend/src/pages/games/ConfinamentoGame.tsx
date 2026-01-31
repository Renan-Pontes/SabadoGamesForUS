import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { getRoom, submitConfinamentoGuess, tickConfinamento } from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Player, Room } from '../../lib/types'
import { formatSeconds, useCountdown } from '../../games/utils'

type ViewMode = 'tv' | 'host' | 'player'

const SUITS = [
  { key: 'hearts', label: 'Hearts', symbol: '♥', color: 'var(--accent-red)' },
  { key: 'diamonds', label: 'Diamonds', symbol: '♦', color: 'var(--accent-red)' },
  { key: 'clubs', label: 'Clubs', symbol: '♣', color: 'var(--text-primary)' },
  { key: 'spades', label: 'Spades', symbol: '♠', color: 'var(--text-primary)' },
] as const

function getPlayerLabel(player: Player) {
  return player.name || player.user?.profile?.nickname || player.user?.username || 'Player'
}

export default function ConfinamentoGame() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastGuess, setLastGuess] = useState<string | null>(null)

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
          await tickConfinamento(code)
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
  const round = typeof state.round === 'number' ? state.round : 1
  const deadline = typeof state.deadline_ts === 'number' ? state.deadline_ts : null
  const winners = Array.isArray(state.winners) ? (state.winners as number[]) : []
  const lastEliminated = Array.isArray(state.last_round_eliminated_ids)
    ? (state.last_round_eliminated_ids as number[])
    : []
  const lastSurvivors = Array.isArray(state.last_round_survivor_ids)
    ? (state.last_round_survivor_ids as number[])
    : []
  const lastRoundTs = typeof state.last_round_ts === 'number' ? state.last_round_ts : null

  const countdown = useCountdown(deadline)

  const me = useMemo(() => {
    if (!room?.players || !user?.id) return null
    return room.players.find((player) => player.user?.id === user.id) ?? null
  }, [room?.players, user?.id])

  const meState = (me?.state ?? {}) as Record<string, unknown>
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

  const players = room?.players ?? []
  const activePlayers = players.filter((player) => !(player.state as Record<string, unknown>)?.eliminated)
  const allGuessed = activePlayers.length > 0 && activePlayers.every((player) => player.has_guessed)

  useEffect(() => {
    setLastGuess(null)
  }, [round, room?.status])

  async function handleGuess(guess: typeof SUITS[number]['key']) {
    if (!code || !room || !me) return
    setSubmitting(true)
    setError('')
    try {
      const data = await submitConfinamentoGuess(code, guess)
      setRoom(data)
      setLastGuess(guess)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit guess.')
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
          radial-gradient(ellipse at top, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: 'var(--neon-purple)' }}>
            CONFINAMENTO SOLITARIO
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

        {room?.status === 'ended' && viewMode !== 'tv' && winners.length > 0 && (
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
              Vencedores: {winners.map((id) => players.find((p) => p.id === id)?.name || id).join(', ')}
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
              <Chip label={`Round ${round}`} sx={{ bgcolor: 'var(--accent-gold)', color: '#000' }} />
              <Chip label={`Timer ${formatSeconds(countdown)}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
              {room?.status === 'ended' && (
                <Chip label="ENDED" sx={{ bgcolor: 'var(--accent-red)', color: '#fff' }} />
              )}
            </Box>
            {countdown !== null && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ color: 'var(--accent-gold)' }}>
                  {allGuessed ? '00:00' : formatSeconds(countdown)}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)' }}>
                  {allGuessed ? 'Todos votaram' : 'Tempo restante'}
                </Typography>
              </Box>
            )}
            {viewMode !== 'tv' && me?.is_valete && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--neon-purple)',
                  background: 'rgba(168, 85, 247, 0.15)',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ color: 'var(--neon-purple)', fontWeight: 600 }}>
                  Você é o Valete.
                </Typography>
              </Box>
            )}
            {room?.status === 'ended' && winners.length > 0 && (
              <Typography sx={{ mt: 2, color: 'var(--status-ready)' }}>
                Winners: {winners.map((id) => players.find((p) => p.id === id)?.name || id).join(', ')}
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
                const suit = typeof playerState.suit === 'string' ? playerState.suit : null
                const eliminated = Boolean(playerState.eliminated)
                const hasGuessed = Boolean(player.has_guessed)
                const isSelf = Boolean(user?.id && player.user?.id === user.id)
                const visibleSuit = viewMode === 'tv' ? null : isSelf ? null : suit
                const guessKey = viewMode === 'tv' ? (player.public_guess ?? null) : null
                const suitMeta = visibleSuit ? SUITS.find((item) => item.key === visibleSuit) : null
                const guessMeta = guessKey ? SUITS.find((item) => item.key === guessKey) : null
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
                        {eliminated ? 'Eliminated' : hasGuessed ? 'Votou' : 'Aguardando voto'}
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        viewMode === 'tv'
                          ? guessMeta
                            ? `${guessMeta.symbol} ${guessMeta.label.toUpperCase()}`
                            : '???'
                          : suitMeta
                            ? `${suitMeta.symbol} ${suitMeta.label.toUpperCase()}`
                            : '???'
                      }
                      size="small"
                      sx={{
                        bgcolor: viewMode === 'tv'
                          ? guessMeta
                            ? 'var(--bg-elevated)'
                            : 'var(--bg-void)'
                          : suitMeta
                            ? 'var(--bg-elevated)'
                            : 'var(--bg-void)',
                        color: viewMode === 'tv'
                          ? guessMeta
                            ? guessMeta.color
                            : 'var(--text-muted)'
                          : suitMeta
                            ? suitMeta.color
                            : 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>

        {lastRoundTs && (lastEliminated.length || lastSurvivors.length) && (
          <Box
            sx={{
              mt: 2,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-subtle)',
              p: 2.5,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Resultado da rodada</Typography>
            {lastEliminated.length > 0 && (
              <Typography sx={{ color: 'var(--accent-red)', mb: 0.5 }}>
                Eliminados: {lastEliminated.map((id) => players.find((p) => p.id === id)?.name || id).join(', ')}
              </Typography>
            )}
            {lastSurvivors.length > 0 && (
              <Typography sx={{ color: 'var(--status-ready)' }}>
                Sobreviventes: {lastSurvivors.map((id) => players.find((p) => p.id === id)?.name || id).join(', ')}
              </Typography>
            )}
          </Box>
        )}

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
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Make your guess</Typography>
            <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
              Pick the suit you believe you have. One mistake and you are out.
            </Typography>
            {me && (me.state as Record<string, unknown>)?.eliminated ? (
              <Typography sx={{ color: 'var(--accent-red)' }}>You are eliminated.</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {SUITS.map((suit) => (
                  <Button
                    key={suit.key}
                    variant="outlined"
                    onClick={() => handleGuess(suit.key)}
                    disabled={submitting || room?.status !== 'live'}
                    sx={{
                      borderColor: suit.color,
                      color: suit.color,
                      '&:hover': { borderColor: suit.color, background: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    {suit.label.toUpperCase()}
                  </Button>
                ))}
              </Box>
            )}
            {lastGuess && (
              <Typography sx={{ mt: 2, color: 'var(--status-ready)' }}>
                Guess submitted: {lastGuess.toUpperCase()}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
