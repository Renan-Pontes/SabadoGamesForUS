import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'

export default function TvDisplay() {
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
          radial-gradient(ellipse at center, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 4,
      }}
    >
      {/* Código da sala */}
      <Box
        sx={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '3px solid var(--neon-cyan)',
          p: 6,
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(34, 211, 238, 0.3)',
        }}
      >
        <Typography
          sx={{
            color: 'var(--text-muted)',
            fontSize: '1.2rem',
            mb: 2,
            letterSpacing: '0.2em',
          }}
        >
          CÓDIGO DA SALA
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: { xs: '4rem', md: '6rem' },
            fontWeight: 700,
            color: 'var(--neon-cyan)',
            letterSpacing: '0.3em',
            textShadow: '0 0 30px rgba(34, 211, 238, 0.5)',
          }}
        >
          {code?.toUpperCase()}
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 3 }}>
          Aguardando jogadores entrarem...
        </Typography>
      </Box>

      {/* Placeholder */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          📺 Tela da TV
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', mb: 4 }}>
          Aqui aparecerá o estado do jogo, placar e timer.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/')}>
          Voltar ao Início
        </Button>
      </Box>
    </Box>
  )
}
