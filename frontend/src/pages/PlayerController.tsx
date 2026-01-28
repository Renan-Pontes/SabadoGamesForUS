import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function PlayerController() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()
  const [isReady, setIsReady] = useState(false)

  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  function handleReadyToggle() {
    setIsReady(!isReady)
  }

  function handleLeaveRoom() {
    navigate('/lobby')
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
          Aguardando o host iniciar o jogo...
        </Typography>
        <Button
          variant="contained"
          color={isReady ? 'success' : 'warning'}
          size="large"
          onClick={handleReadyToggle}
          sx={{
            mb: 2,
            py: 2,
            px: 6,
            fontSize: '1.2rem',
          }}
        >
          {isReady ? 'PRONTO ✓' : 'MARCAR READY'}
        </Button>
        <Button
          variant="text"
          color="error"
          size="small"
          onClick={handleLeaveRoom}
        >
          Sair da sala
        </Button>
      </Box>
    </Box>
  )
}
