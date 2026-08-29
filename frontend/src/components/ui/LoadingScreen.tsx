import { Box, Typography } from '@mui/material'

type LoadingScreenProps = {
  /** O que está sendo carregado, em caixa alta e curto. */
  label?: string
  accent?: string
}

/**
 * Tela de carregamento única do app. Antes eram quatro variações de
 * `<Typography>Carregando...</Typography>` soltas.
 *
 * Em vez de um spinner genérico, um naipe girando — leva o mesmo tempo e
 * mantém o tema.
 */
export default function LoadingScreen({
  label = 'CARREGANDO',
  accent = 'var(--accent-gold)',
}: LoadingScreenProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-void)',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            justifyContent: 'center',
            mb: 2.5,
            fontSize: '2rem',
            lineHeight: 1,
          }}
        >
          {['♠', '♥', '♦', '♣'].map((suit, index) => (
            <Box
              key={suit}
              component="span"
              sx={{
                color: index === 1 || index === 2 ? 'var(--accent-red)' : 'var(--text-secondary)',
                animation: 'float 1.4s ease-in-out infinite',
                animationDelay: `${index * 140}ms`,
                filter: `drop-shadow(0 0 12px ${accent}55)`,
              }}
            >
              {suit}
            </Box>
          ))}
        </Box>
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            letterSpacing: '0.28em',
            color: 'var(--text-muted)',
            animation: 'pulse 1.8s ease-in-out infinite',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  )
}
