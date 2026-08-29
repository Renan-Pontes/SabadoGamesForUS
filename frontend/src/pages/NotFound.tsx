import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { pageBackdrop } from '../components/ui/surfaces'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: pageBackdrop('rgba(220, 38, 38, 0.18)'),
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box className="animate-pop-in">
        {/* Um naipe cortado no lugar do 404 seco */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, md: 2 },
            mb: 1,
          }}
        >
          {['4', '♠', '4'].map((char, index) => (
            <Typography
              key={index}
              component="span"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '5rem', md: '9rem' },
                lineHeight: 1,
                color: index === 1 ? 'var(--text-primary)' : 'var(--accent-red)',
                textShadow:
                  index === 1 ? 'none' : '0 0 60px var(--accent-red-glow)',
                animation: index === 1 ? 'float 3.4s ease-in-out infinite' : 'none',
              }}
            >
              {char}
            </Typography>
          ))}
        </Box>

        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '1.6rem', md: '2.2rem' },
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
            mb: 1.5,
          }}
        >
          ESSA MESA NÃO EXISTE
        </Typography>

        <Typography sx={{ color: 'var(--text-muted)', mb: 4, maxWidth: 420, mx: 'auto' }}>
          Ou você foi eliminado, ou o endereço está errado. Nos dois casos, a saída é a mesma.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" color="primary" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/lobby')}>
            Ir ao lobby
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
