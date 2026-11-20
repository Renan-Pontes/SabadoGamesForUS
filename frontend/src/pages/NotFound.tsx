import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { HangingOrnaments, MIST, Snowman, pageBackdrop } from '../components/ui'

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
      <HangingOrnaments />
      <Box className="animate-pop-in" sx={{ position: 'relative' }}>
        {/* Um boneco de neve no lugar do zero do 404 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, md: 2 },
            mb: 2.5,
          }}
        >
          <Digit />
          <Box sx={{ lineHeight: 0 }}>
            <Snowman size={96} glow="var(--ice)" />
          </Box>
          <Digit />
        </Box>

        <Typography
          component="h1"
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '2rem', md: '2.8rem' },
            lineHeight: 1.1,
            letterSpacing: '0.05em',
            color: 'var(--pumpkin)',
            textShadow: '0 0 26px rgba(255, 90, 102, 0.45)',
            mb: 1.5,
          }}
        >
          VOCÊ SE PERDEU NA NEVE ❄️
        </Typography>

        <Typography sx={{ color: 'var(--text-secondary)', mb: 4, maxWidth: 440, mx: 'auto' }}>
          Esse presente veio vazio. Ou o endereço está errado, ou o Papai Noel entregou na casa do vizinho.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" color="primary" onClick={() => navigate('/')}>
            🛷 Voltar ao início
          </Button>
          <Button variant="outlined" color="secondary" onClick={() => navigate('/lobby')}>
            Ir ao lobby
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

function Digit() {
  return (
    <Typography
      component="span"
      sx={{
        fontFamily: 'var(--font-festive)',
        fontWeight: 700,
        fontSize: { xs: '4.6rem', md: '8rem' },
        lineHeight: 1,
        color: 'var(--accent-red)',
        textShadow: '0 0 60px var(--accent-red-glow), 0 4px 0 rgba(0,0,0,0.4)',
      }}
    >
      4
    </Typography>
  )
}
