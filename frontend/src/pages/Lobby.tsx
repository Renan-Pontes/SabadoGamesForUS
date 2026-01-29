import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, IconButton, Avatar } from '@mui/material'
import {
  Add as AddIcon,
  Login as JoinIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import { createRoom, listGames } from '../lib/api'
import type { Game } from '../lib/types'

export default function Lobby() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const [joinCode, setJoinCode] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    let active = true
    async function fetchGames() {
      try {
        const data = await listGames()
        if (!active) return
        setGames(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar jogos.')
      } finally {
        if (!active) return
        setGamesLoading(false)
      }
    }
    fetchGames()
    return () => {
      active = false
    }
  }, [])

  async function handleCreateRoom() {
    if (!games.length) {
      setError('Nenhum jogo disponível para criar sala.')
      return
    }
    setError('')
    try {
      const room = await createRoom({ game_id: games[0].id, host_name: user?.nickname })
      navigate(`/host/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sala.')
    }
  }

  function handleJoinRoom() {
    if (joinCode.trim()) {
      navigate(`/play/${joinCode.toUpperCase()}`)
    }
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Carregando...</Typography>
      </Box>
    )
  }

  const avatarColor = user?.nickname
    ? `hsl(${user.nickname.charCodeAt(0) * 10}, 70%, 50%)`
    : 'var(--accent-gold)'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
        background: `
          radial-gradient(ellipse at top, rgba(220, 38, 38, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
      }}
    >
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 4,
            pb: 3,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Box>
            <Typography
              variant="h3"
              sx={{
                background: 'linear-gradient(90deg, var(--accent-red), var(--accent-gold))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SABADO GAMES
            </Typography>
          </Box>

          {/* Perfil e Logout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              onClick={() => navigate('/profile')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'var(--accent-gold)',
                  background: 'var(--bg-surface)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.9rem',
                  bgcolor: avatarColor,
                }}
              >
                {user?.nickname?.charAt(0).toUpperCase() || 'J'}
              </Avatar>
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.2 }}>
                  {user?.nickname || 'Jogador'}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1 }}>
                  Ver perfil
                </Typography>
              </Box>
            </Button>
            <IconButton
              onClick={handleLogout}
              sx={{
                color: 'var(--text-muted)',
                '&:hover': { color: 'var(--accent-red)' },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Opções */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
          }}
        >
          {/* Criar Sala */}
          <Box
            sx={{
              flex: 1,
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(220, 38, 38, 0.1) 100%)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--accent-red)',
              p: 4,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, var(--accent-red), var(--accent-gold), var(--accent-red))',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <AddIcon sx={{ fontSize: 32, color: 'var(--accent-red)' }} />
              <Typography variant="h4" sx={{ color: 'var(--accent-red)' }}>
                Criar Sala
              </Typography>
            </Box>
            <Typography sx={{ mb: 4, color: 'var(--text-secondary)' }}>
              Seja o host! Crie uma sala, escolha os jogos e convide seus amigos.
            </Typography>
            {error && (
              <Typography sx={{ color: 'var(--accent-red)', mb: 2, fontSize: '0.9rem' }}>{error}</Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              onClick={handleCreateRoom}
              disabled={gamesLoading}
              sx={{ py: 2 }}
            >
              {gamesLoading ? 'CARREGANDO...' : 'CRIAR NOVA SALA'}
            </Button>
          </Box>

          {/* Entrar em Sala */}
          <Box
            sx={{
              flex: 1,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--border-subtle)',
              p: 4,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <JoinIcon sx={{ fontSize: 32, color: 'var(--accent-gold)' }} />
              <Typography variant="h4" sx={{ color: 'var(--accent-gold)' }}>
                Entrar
              </Typography>
            </Box>
            <Typography sx={{ mb: 3, color: 'var(--text-secondary)' }}>
              Já tem um código? Entre em uma sala existente.
            </Typography>
            <TextField
              fullWidth
              placeholder="Código da sala"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              size="large"
              onClick={handleJoinRoom}
              disabled={!joinCode.trim()}
              sx={{ py: 2 }}
            >
              ENTRAR NA SALA
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
