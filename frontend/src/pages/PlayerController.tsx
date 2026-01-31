import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { useAuth } from '../context/useAuth'
import { getRoom, joinRoom, sendHeartbeat, setReady } from '../lib/api'
import { clearStayInLobby, getStayInLobby, saveLastRoom } from '../lib/roomHistory'
import type { Player, Room } from '../lib/types'

export default function PlayerController() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (code) {
      saveLastRoom(code, 'player')
    }
  }, [code])

  useEffect(() => {
    if (!code || !isAuthenticated) return
    const roomCode = code
    let active = true
    async function join() {
      try {
        const result = await joinRoom(roomCode, {})
        if (!active) return
        setPlayer(result.player)
        setIsReady(result.player.ready)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao entrar na sala.')
      }
    }
    join()
    return () => {
      active = false
    }
  }, [code, isAuthenticated])

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true
    async function pollRoom() {
      try {
        const data = await getRoom(roomCode)
        if (!active) return
        setRoom(data)
        if (data.status === 'live') {
          if (!getStayInLobby(roomCode)) {
            if (data.game?.slug === 'read-my-mind') {
              navigate(`/game/${roomCode}/read-my-mind?view=player`)
            } else {
              navigate(`/game/${roomCode}?view=player`)
            }
          }
        } else {
          if (getStayInLobby(roomCode)) {
            clearStayInLobby(roomCode)
          }
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao atualizar sala.')
      }
    }
    pollRoom()
    const interval = window.setInterval(pollRoom, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, navigate])

  useEffect(() => {
    if (!code || !player) return
    const roomCode = code
    const playerId = player.id
    const interval = window.setInterval(() => {
      sendHeartbeat(roomCode, playerId).catch(() => {
        // Ignore heartbeat errors
      })
    }, 10000)
    return () => {
      window.clearInterval(interval)
    }
  }, [code, player])

  async function handleReadyToggle() {
    if (!code) return
    try {
      const nextReady = !isReady
      const result = await setReady(code, nextReady)
      setIsReady(result.ready)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar ready.')
    }
  }

  function handleLeaveRoom() {
    navigate('/lobby')
  }

  function handleBackToGame() {
    if (!code || !room) return
    clearStayInLobby(code)
    if (room.game?.slug === 'read-my-mind') {
      navigate(`/game/${code}/read-my-mind?view=player`)
    } else {
      navigate(`/game/${code}?view=player`)
    }
  }

  if (isLoading) {
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
        <Typography>Carregando...</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: `
          radial-gradient(ellipse at bottom, rgba(212, 165, 32, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 3,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ color: 'var(--accent-gold)' }}>
            {user?.nickname || 'Jogador'}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Sala: {code?.toUpperCase()}
          </Typography>
          {room?.game && (
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Jogo: {room.game.name}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 'var(--radius-full)',
            background: isReady ? 'var(--status-ready)' : 'var(--status-waiting)',
            color: 'var(--bg-void)',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {isReady ? 'Pronto!' : 'Aguardando'}
        </Box>
      </Box>

      {/* Área principal */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '2px solid var(--border-subtle)',
          p: 4,
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          📱 Controle do Jogador
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', mb: 4 }}>
          {room?.status === 'live'
            ? 'Partida em andamento...'
            : 'Aguardando o host iniciar o jogo...'}
        </Typography>
        {error && (
          <Typography sx={{ color: 'var(--accent-red)', mb: 2, fontSize: '0.9rem' }}>
            {error}
          </Typography>
        )}
        <Button
          variant="contained"
          color={isReady ? 'success' : 'warning'}
          size="large"
          onClick={handleReadyToggle}
          disabled={!player}
          sx={{
            mb: 2,
            py: 2,
            px: 6,
            fontSize: '1.2rem',
          }}
        >
          {isReady ? 'PRONTO ✓' : 'MARCAR READY'}
        </Button>
        {room?.status === 'live' && (
          <Button
            variant="outlined"
            color="secondary"
            size="large"
            onClick={handleBackToGame}
            sx={{ mb: 2, py: 1.5, px: 6 }}
          >
            Voltar ao jogo
          </Button>
        )}
        <Button variant="text" color="error" size="small" onClick={handleLeaveRoom}>
          Sair da sala
        </Button>
      </Box>
    </Box>
  )
}

