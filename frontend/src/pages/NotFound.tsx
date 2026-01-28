import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-void)',
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: '6rem', md: '10rem' },
          fontFamily: 'var(--font-display)',
          color: 'var(--accent-red)',
          lineHeight: 1,
          textShadow: '0 0 60px var(--accent-red-glow)',
        }}
      >
        404
      </Typography>
      <Typography variant="h4" sx={{ mb: 2 }}>
        JOGO NÃO ENCONTRADO
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mb: 4, maxWidth: 400 }}>
        Parece que você foi eliminado... ou essa página não existe.
      </Typography>
      <Button variant="contained" color="primary" onClick={() => navigate('/')}>
        Voltar ao Início
      </Button>
    </Box>
  )
}
