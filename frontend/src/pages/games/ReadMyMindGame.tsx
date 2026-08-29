import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { TvView, PlayerView, HostView } from '../../games/ReadMyMind'
import type { GameMode, GameState } from '../../games/ReadMyMind'
import {
  getRoom,
  playReadMyMindCard,
  restartRoom,
  startRoom,
  tickReadMyMind,
  tvPing,
} from '../../lib/api'
import { saveLastRoom, setStayInLobby } from '../../lib/roomHistory'
import type { Room } from '../../lib/types'
import { LoadingScreen } from '../../components/ui'

type ViewMode = 'tv' | 'host' | 'player'

type PlayedEntry = { player_id?: number; card?: number; ts?: number }

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

/** Traduz o JSON cru da sala para o formato que as três telas consomem. */
function mapRoomToGameState(room: Room | null): GameState {
  if (!room) return EMPTY_STATE

  const mode: GameMode = room.state?.mode === 'versus' ? 'versus' : 'coop'
  let phase: GameState['phase'] =
    room.status === 'ended' ? 'gameOver' : room.status === 'live' ? 'playing' : 'waiting'
  if (room.state?.phase === 'round_break') phase = 'roundBreak'

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
    name: player.name || player.user?.profile?.nickname || 'Jogador',
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
      gameOverReason = lives > 0 ? 'A equipe completou o desafio.' : 'As vidas acabaram.'
    } else if (remaining.length === 1) {
      winner = remaining[0].id
      gameOverReason = `${remaining[0].name} foi o último de pé.`
    } else {
      gameOverReason = 'Partida encerrada.'
    }
  }

  return {
    mode,
    phase,
    round,
    maxRounds: 10,
    nextRoundTs:
      typeof room.state?.next_round_ts === 'number' ? room.state.next_round_ts * 1000 : undefined,
    playedCards,
    players,
    lives,
    maxLives: 3,
    lastCutPlayer: room.state?.last_cut_player_id ? String(room.state.last_cut_player_id) : null,
    lastCutterPlayer: room.state?.last_cutter_player_id
      ? String(room.state.last_cutter_player_id)
      : null,
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
  /** O host alterna entre o painel de controle e a própria mão. */
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
    if (!authLoading && !isAuthenticated && viewMode !== 'tv') navigate('/')
  }, [isAuthenticated, authLoading, viewMode, navigate])

  useEffect(() => {
    if (!code || viewMode === 'tv') return
    saveLastRoom(code, viewMode === 'host' ? 'host' : 'player')
  }, [code, viewMode])

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true

    async function loadRoom() {
      if (document.hidden) return
      try {
        if (viewMode === 'tv') await tvPing(roomCode, { device_id: deviceId })
        if (viewMode === 'tv' || viewMode === 'host') await tickReadMyMind(roomCode)
        const data = await getRoom(roomCode)
        if (!active) return
        setRoom(data)
        setError('')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a sala.')
      } finally {
        if (active) setLoadingRoom(false)
      }
    }

    loadRoom()
    const interval = window.setInterval(loadRoom, 2500)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, viewMode, deviceId])

  async function handleStartGame(mode: GameMode) {
    if (!code) return
    setError('')
    try {
      setRoom(await startRoom(code, { mode }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar o jogo.')
    }
  }

  async function handlePlayCard(cardValue: number) {
    if (!code || !playerId) return
    setError('')
    try {
      setRoom(await playReadMyMindCard(code, cardValue))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível jogar a carta.')
    }
  }

  async function handleRestartGame() {
    if (!code) return
    setError('')
    try {
      setRoom(await restartRoom(code))
      setHostScreen('control')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reiniciar.')
    }
  }

  async function handleNextRound() {
    if (!code) return
    setError('')
    try {
      setRoom(await tickReadMyMind(code))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível avançar a rodada.')
    }
  }

  function handleBackToLobby() {
    if (!code) return
    setStayInLobby(code, true)
    navigate(isHost ? `/host/${code}` : `/play/${code}`)
  }

  if (authLoading || loadingRoom) return <LoadingScreen label="ENTRANDO NA MESA" accent="#22d3ee" />

  const roomCode = code?.toUpperCase() ?? ''

  if (viewMode === 'tv') {
    return <TvView roomCode={roomCode} gameState={gameState} />
  }

  if (viewMode === 'host' && hostScreen === 'control') {
    return (
      <HostView
        roomCode={roomCode}
        gameState={gameState}
        onStartGame={handleStartGame}
        onNextRound={handleNextRound}
        onEndGame={() => navigate('/lobby')}
        onRestartGame={handleRestartGame}
        onChangeGame={code ? () => navigate(`/host/${code}`) : undefined}
        onPlayAsHost={() => setHostScreen('play')}
        onBack={handleBackToLobby}
      />
    )
  }

  return (
    <PlayerView
      roomCode={roomCode}
      playerId={playerId}
      gameState={gameState}
      onPlayCard={handlePlayCard}
      viewMode={viewMode === 'host' ? 'host' : 'player'}
      onBack={handleBackToLobby}
      onToggleView={
        viewMode === 'host'
          ? () => setHostScreen('control')
          : isHost && code
            ? () => navigate(`/game/${code}/read-my-mind?view=host`)
            : undefined
      }
      error={error}
    />
  )
}
