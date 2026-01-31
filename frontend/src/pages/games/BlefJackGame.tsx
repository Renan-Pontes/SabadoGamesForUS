import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, Chip, CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { getRoom, guessBlefJack } from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Player, Room } from '../../lib/types'

type ViewMode = 'tv' | 'host' | 'player'

function getPlayerLabel(player: Player) {
  return player.name || player.user?.profile?.nickname || player.user?.username || 'Player'
}

const BLEF_SUITS = [
  { key: 'hearts', symbol: '♥', color: '#ef4444' },
  { key: 'diamonds', symbol: '♦', color: '#f97316' },
  { key: 'clubs', symbol: '♣', color: '#0f172a' },
  { key: 'spades', symbol: '♠', color: '#0f172a' },
]

function formatBlefCard(card: number, rankCount: number, useFullDeck: boolean) {
  if (!useFullDeck) {
    const suit = BLEF_SUITS[card % BLEF_SUITS.length]
    return { rank: card, suit }
  }
  const rank = (card % rankCount) + 1
  const suitIndex = Math.floor(card / rankCount) % BLEF_SUITS.length
  const suit = BLEF_SUITS[suitIndex]
  return { rank, suit }
}

export default function BlefJackGame() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [guessWinner, setGuessWinner] = useState('')
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
  }, [code])

  const state = useMemo(() => (room?.state ?? {}) as Record<string, unknown>, [room])
  const round = typeof state.round === 'number' ? state.round : 1
  const phase = typeof state.phase === 'string' ? state.phase : 'guess'
  const winners = Array.isArray(state.winners) ? (state.winners as number[]) : []
  const deckSize = typeof state.deck_size === 'number' ? state.deck_size : null
  const rankCount = typeof state.rank_count === 'number' ? state.rank_count : 13
  const useFullDeck = deckSize === 56 && rankCount === 14
  const guessOpen = phase === 'guess' || phase === 'declare'

  const players = room?.players ?? []

  const me = useMemo(() => {
    if (!room?.players || !user?.id) return null
    return room.players.find((player) => player.user?.id === user.id) ?? null
  }, [room?.players, user?.id])

  const meState = (me?.state ?? {}) as Record<string, unknown>
  const mePoints = typeof meState.points === 'number' ? meState.points : 0
  const meCards = Array.isArray(meState.cards) ? (meState.cards as number[]) : []
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

  async function handleGuess() {
    if (!code || !guessWinner) return
    const value = Number(guessWinner)
    if (Number.isNaN(value)) return
    setSubmitting(true)
    setError('')
    try {
      const data = await guessBlefJack(code, value)
      setRoom(data)
      setGuessWinner('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to guess.')
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
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ color: 'var(--status-ready)' }}>
            BLEF JACK
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
              {winners.length
                ? `Vencedores: ${winners.map((id) => players.find((p) => p.id === id)?.name || id).join(', ')}`
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
              <Chip label={`Round ${round}`} sx={{ bgcolor: 'var(--status-ready)', color: '#000' }} />
              <Chip label={`Phase ${phase.toUpperCase()}`} sx={{ bgcolor: 'var(--bg-surface)' }} />
              {deckSize && <Chip label={`Deck ${deckSize}`} sx={{ bgcolor: 'var(--bg-surface)' }} />}
            </Box>
            {winners.length > 0 && (
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
                const points = typeof playerState.points === 'number' ? playerState.points : null
                const eliminated = Boolean(playerState.eliminated)
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
                        {eliminated ? 'Eliminado' : 'Jogando'}
                      </Typography>
                    </Box>
                    {points !== null && (
                      <Chip
                        label={`Pts ${points}`}
                        size="small"
                        sx={{
                          bgcolor: eliminated ? 'var(--accent-red)' : 'var(--bg-elevated)',
                          color: eliminated ? '#fff' : 'var(--text-primary)',
                        }}
                      />
                    )}
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
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Your hand</Typography>
              <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>Points: {mePoints}</Typography>
              {meEliminated ? (
                <Typography sx={{ color: 'var(--accent-red)' }}>You are eliminated.</Typography>
              ) : (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {meCards.length ? (
                    meCards.map((card, index) => {
                      const meta = formatBlefCard(card, rankCount, useFullDeck)
                      return (
                        <Box
                          key={`${card}-${index}`}
                          sx={{
                            width: { xs: 80, md: 96 },
                            height: { xs: 120, md: 140 },
                            borderRadius: 2.5,
                            background: '#f8fafc',
                            border: '2px solid rgba(15, 23, 42, 0.2)',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 10,
                              fontWeight: 700,
                              color: meta.suit.color,
                            }}
                          >
                            {meta.rank}
                          </Typography>
                          <Typography sx={{ fontSize: 36, color: meta.suit.color }}>{meta.suit.symbol}</Typography>
                          <Typography
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 10,
                              fontWeight: 700,
                              color: meta.suit.color,
                              transform: 'rotate(180deg)',
                            }}
                          >
                            {meta.rank}
                          </Typography>
                        </Box>
                      )
                    })
                  ) : (
                    <Typography sx={{ color: 'var(--text-muted)' }}>Hidden</Typography>
                  )}
                </Box>
              )}
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Guess winner</Typography>
              <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
                Choose who you think has the strongest hand.
              </Typography>
              <TextField
                select
                value={guessWinner}
                onChange={(event) => setGuessWinner(event.target.value)}
                sx={{ minWidth: 220, mb: 2 }}
                disabled={!guessOpen || room?.status !== 'live'}
              >
                {players
                  .filter((player) => !((player.state as Record<string, unknown>)?.eliminated))
                  .map((player) => (
                    <MenuItem key={player.id} value={player.id.toString()}>
                      {getPlayerLabel(player)}
                    </MenuItem>
                  ))}
              </TextField>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGuess}
                disabled={!guessWinner || submitting || !guessOpen || room?.status !== 'live'}
              >
                Submit guess
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
