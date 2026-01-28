import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, IconButton, Avatar } from '@mui/material'
import {
  Add as AddIcon,
  Login as JoinIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

export default function Lobby() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  function handleCreateRoom() {
    // TODO: Criar sala via API e redirecionar
    // Por enquanto, gera código fake
    const fakeCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/host/${fakeCode}`)
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

  // Gerar cor do avatar baseado no nickname
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
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              onClick={handleCreateRoom}
              sx={{ py: 2 }}
            >
              CRIAR NOVA SALA
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
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'var(--accent-gold)',
                boxShadow: '0 0 30px var(--accent-gold-glow)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <JoinIcon sx={{ fontSize: 32, color: 'var(--accent-gold)' }} />
              <Typography variant="h4" sx={{ color: 'var(--accent-gold)' }}>
                Entrar em Sala
              </Typography>
            </Box>
            <Typography sx={{ mb: 3, color: 'var(--text-secondary)' }}>
              Tem um código? Entre em uma sala existente para jogar.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                placeholder="CÓDIGO"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                inputProps={{
                  maxLength: 6,
                  style: { textAlign: 'center', fontSize: '1.2rem' },
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleJoinRoom}
                disabled={!joinCode.trim()}
                sx={{ minWidth: 100 }}
              >
                ENTRAR
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Info */}
        <Box
          sx={{
            mt: 4,
            p: 3,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Typography variant="h6" sx={{ mb: 1, color: 'var(--text-primary)' }}>
            💡 Como funciona
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            O <strong>host</strong> cria a sala e controla o jogo pelo computador ou tablet.
            Os <strong>jogadores</strong> entram pelo celular usando o código da sala.
            A <strong>TV</strong> exibe o placar e o estado do jogo para todos verem.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
