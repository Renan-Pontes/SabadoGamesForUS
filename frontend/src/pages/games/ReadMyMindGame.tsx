import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { TvView, PlayerView, HostView } from '../../games/ReadMyMind'
import type { GameMode, GameState } from '../../games/ReadMyMind'
import { getRoom, playReadMyMindCard, restartRoom, startRoom, tickReadMyMind, tvPing } from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Room } from '../../lib/types'

type ViewMode = 'tv' | 'host' | 'player'

type PlayedEntry = {
  player_id?: number
  card?: number
  ts?: number
}

const EMPTY_STATE: GameState = {
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

function mapRoomToGameState(room: Room | null): GameState {
  if (!room) return EMPTY_STATE
  const mode: GameMode = room.state?.mode === 'versus' ? 'versus' : 'coop'
  let phase: GameState['phase'] =
    room.status === 'ended' ? 'gameOver' : room.status === 'live' ? 'playing' : 'waiting'
  if (room.state?.phase === 'round_break') {
    phase = 'roundBreak'
  }
  const round = typeof room.state?.round === 'number' ? room.state.round : 1
  const playedRaw = Array.isArray(room.state?.played) ? (room.state?.played as PlayedEntry[]) : []
  const playedCards = playedRaw
    .filter((entry) => typeof entry.card === 'number' && typeof entry.player_id === 'number')
    .map((entry) => ({
      value: entry.card as number,
      playerId: String(entry.player_id),
      playedAt: typeof entry.ts === 'number' ? entry.ts * 1000 : undefined,
    }))

  const players = (room.players ?? []).map((player) => ({
    id: player.id.toString(),
    name: player.name,
    cards: Array.isArray(player.state?.hand) ? (player.state?.hand as number[]) : [],
    isEliminated: Boolean(player.state?.eliminated),
    isHost: player.is_host,
    connected: player.online ?? true,
  }))

  const lives = mode === 'coop' ? (typeof room.state?.lives === 'number' ? room.state.lives : 3) : 3

  let winner: string | null = null
  let gameOverReason: string | null = null
  if (room.status === 'ended') {
    const remaining = players.filter((p) => !p.isEliminated)
    if (mode === 'coop') {
      winner = lives > 0 ? 'team' : null
      gameOverReason = lives > 0 ? 'Equipe completou o desafio.' : 'Vidas esgotadas.'
    } else if (remaining.length === 1) {
      winner = remaining[0].id
      gameOverReason = `${remaining[0].name} venceu!`
    }
  }

  return {
    mode,
    phase,
    round,
    maxRounds: 10,
    nextRoundTs: room.state?.next_round_ts ? room.state.next_round_ts * 1000 : undefined,
    playedCards,
    players,
    lives,
    maxLives: 3,
    lastCutPlayer: room.state?.last_cut_player_id ? String(room.state.last_cut_player_id) : null,
    lastCutterPlayer: room.state?.last_cutter_player_id ? String(room.state.last_cutter_player_id) : null,
    winner,
    gameOverReason,
  }
}

export default function ReadMyMindGame() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [hostScreen, setHostScreen] = useState<'control' | 'play'>('control')

  const deviceId = useMemo(() => {
    const key = 'sabado_tv_device'
    const stored = window.localStorage.getItem(key)
    if (stored) return stored
    const generated = `tv-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(key, generated)
    return generated
  }, [])

  const playerId = useMemo(() => {
    if (!room?.players || !user?.id) return ''
    const match = room.players.find((player) => player.user?.id === user.id)
    return match ? match.id.toString() : ''
  }, [room?.players, user?.id])

  const isHost = useMemo(() => {
    if (!room?.players || !user?.id) return false
    return room.players.some((player) => player.user?.id === user.id && player.is_host)
  }, [room?.players, user?.id])

  const gameState = useMemo(() => mapRoomToGameState(room), [room])

  useEffect(() => {
    if (!authLoading && !isAuthenticated && viewMode !== 'tv') {
      navigate('/')
    }
  }, [isAuthenticated, authLoading, viewMode, navigate])

  useEffect(() => {
    if (!code || viewMode === 'tv') return
    const view = viewMode === 'host' ? 'host' : 'player'
    saveLastRoom(code, view)
  }, [code, viewMode])

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true
    async function loadRoom() {
      try {
        if (viewMode === 'tv') {
          await tvPing(roomCode, { device_id: deviceId })
        }
        if (viewMode === 'tv' || viewMode === 'host') {
          await tickReadMyMind(roomCode)
        }
        const data = await getRoom(roomCode)
        if (!active) return
        setRoom(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      } finally {
        if (active) {
          setLoadingRoom(false)
        }
      }
    }
    loadRoom()
    const interval = window.setInterval(loadRoom, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, viewMode, deviceId])

  async function handleStartGame(mode: GameMode) {
    if (!code) return
    setError('')
    try {
      const data = await startRoom(code, { mode })
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar jogo.')
    }
  }

  async function handlePlayCard(cardValue: number) {
    if (!code || !playerId) return
    setError('')
    try {
      const data = await playReadMyMindCard(code, cardValue)
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao jogar carta.')
    }
  }

  function handleEndGame() {
    navigate('/lobby')
  }

  async function handleRestartGame() {
    if (!code) return
    setError('')
    try {
      const data = await restartRoom(code)
      setRoom(data)
      setHostScreen('control')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reiniciar jogo.')
    }
  }

  async function handleNextRound() {
    if (!code) return
    setError('')
    try {
      const data = await tickReadMyMind(code)
      setRoom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao avancar rodada.')
    }
  }

  function handleChangeGame() {
    if (!code) return
    navigate(`/host/${code}`)
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

  function handleSwitchView(nextView: ViewMode) {
    if (!code) return
    navigate(`/game/${code}/read-my-mind?view=${nextView}`)
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

  if (error) {
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
        <Typography sx={{ color: 'var(--accent-red)' }}>{error}</Typography>
      </Box>
    )
  }

  const roomCode = code?.toUpperCase() || ''

  switch (viewMode) {
    case 'tv':
      return <TvView roomCode={roomCode} gameState={gameState} />

    case 'host':
      if (hostScreen === 'control') {
        return (
          <Box sx={{ position: 'relative' }}>
          <HostView
            roomCode={roomCode}
            gameState={gameState}
            onStartGame={handleStartGame}
            onNextRound={handleNextRound}
            onEndGame={handleEndGame}
            onRestartGame={handleRestartGame}
            onChangeGame={handleChangeGame}
          />
            <Box
              sx={{
                position: 'fixed',
                right: 24,
                bottom: 24,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setHostScreen('play')}
              >
                Jogar como host
              </Button>
              <Button variant="outlined" color="inherit" onClick={handleBackToLobby}>
                Voltar ao lobby
              </Button>
            </Box>
          </Box>
        )
      }
      return (
        <Box sx={{ position: 'relative' }}>
          <PlayerView
            roomCode={roomCode}
            playerId={playerId}
            gameState={gameState}
            onPlayCard={handlePlayCard}
          />
          <Box
            sx={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Button variant="outlined" color="secondary" onClick={() => setHostScreen('control')}>
              Voltar ao painel do host
            </Button>
            <Button variant="outlined" color="inherit" onClick={handleBackToLobby}>
              Voltar ao lobby
            </Button>
          </Box>
        </Box>
      )

    case 'player':
    default:
      return (
        <Box sx={{ position: 'relative' }}>
          <PlayerView
            roomCode={roomCode}
            playerId={playerId}
            gameState={gameState}
            onPlayCard={handlePlayCard}
          />
          <Box
            sx={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {isHost && (
              <Button variant="outlined" color="secondary" onClick={() => handleSwitchView('host')}>
                Painel do host
              </Button>
            )}
            <Button variant="outlined" color="inherit" onClick={handleBackToLobby}>
              Voltar ao lobby
            </Button>
          </Box>
        </Box>
      )
  }
}
