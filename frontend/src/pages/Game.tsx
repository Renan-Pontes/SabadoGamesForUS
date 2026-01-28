import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'

export default function Game() {
  const { code } = useParams()
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(ellipse at center, rgba(220, 38, 38, 0.2) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: '4rem',
          mb: 2,
        }}
      >
        🎮
      </Typography>
      <Typography variant="h3" sx={{ color: 'var(--accent-red)', mb: 2 }}>
        JOGO EM ANDAMENTO
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>
        Sala: {code?.toUpperCase()}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', mb: 4, maxWidth: 400 }}>
        Aqui será renderizado o minigame selecionado.
        A tela varia de acordo com o dispositivo (TV, Host ou Player).
      </Typography>

      <Box
        sx={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '2px solid var(--border-subtle)',
          p: 4,
          mb: 4,
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          ⏱️ 00:45
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)' }}>
          Tempo restante da rodada
        </Typography>
      </Box>

      <Button
        variant="outlined"
        color="error"
        onClick={() => navigate('/lobby')}
        sx={{ borderWidth: 2 }}
      >
        Voltar ao Lobby
      </Button>
    </Box>
  )
}
