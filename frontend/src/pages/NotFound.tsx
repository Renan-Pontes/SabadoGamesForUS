import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { MIST, pageBackdrop } from '../components/ui'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: pageBackdrop(MIST.blood, MIST.witch),
        p: 4,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box className="animate-pop-in" sx={{ position: 'relative' }}>
        {/* Uma lápide no lugar do zero do 404 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, md: 2 },
            mb: 1,
          }}
        >
          {['4', '🪦', '4'].map((char, index) => (
            <Typography
              key={index}
              component="span"
              sx={{
                fontFamily: 'var(--font-horror)',
                fontSize: index === 1 ? { xs: '4.4rem', md: '7.5rem' } : { xs: '4.2rem', md: '7.5rem' },
                lineHeight: 1,
                color: index === 1 ? 'var(--text-primary)' : 'var(--accent-red)',
                textShadow: index === 1 ? 'none' : '0 0 60px var(--accent-red-glow)',
                animation: index === 1 ? 'float 3.4s ease-in-out infinite' : 'none',
              }}
            >
              {char}
            </Typography>
          ))}
        </Box>

        <Typography
          component="h1"
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '2rem', md: '2.8rem' },
            lineHeight: 1.1,
            letterSpacing: '0.05em',
            color: 'var(--pumpkin)',
            textShadow: '0 0 26px rgba(255, 123, 28, 0.45)',
            mb: 1.5,
          }}
        >
          VOCÊ SE PERDEU NO CEMITÉRIO 🪦
        </Typography>

        <Typography sx={{ color: 'var(--text-secondary)', mb: 4, maxWidth: 440, mx: 'auto' }}>
          Essa cova está vazia. Ou o endereço está errado, ou o fantasma que morava aqui já foi embora.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" color="primary" onClick={() => navigate('/')}>
            🎃 Voltar ao início
          </Button>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/lobby')}>
            Ir ao lobby
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
