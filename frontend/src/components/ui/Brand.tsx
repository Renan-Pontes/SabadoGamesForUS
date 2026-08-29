import { Box, Typography } from '@mui/material'

type BrandProps = {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  /** Anima cada letra na entrada (só vale a pena na landing). */
  animated?: boolean
  tagline?: string
}

const SIZES = {
  sm: { sabado: '1.5rem', games: '1.5rem', gap: '0.28em' },
  md: { sabado: '2.2rem', games: '2.2rem', gap: '0.3em' },
  lg: { sabado: '3.2rem', games: '3.2rem', gap: '0.32em' },
  hero: { sabado: 'clamp(3rem, 12vw, 7rem)', games: 'clamp(1.6rem, 5.5vw, 3.2rem)', gap: '0.42em' },
} as const

/**
 * A marca. Estava reescrita à mão em cada tela com pesos e gradientes
 * diferentes; agora é um componente só.
 */
export default function Brand({ size = 'md', animated = false, tagline }: BrandProps) {
  const dims = SIZES[size]
  const isHero = size === 'hero'

  const letters = 'SABADO'.split('')

  return (
    <Box sx={{ textAlign: isHero ? 'center' : 'left' }}>
      <Typography
        component={isHero ? 'h1' : 'div'}
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: dims.sabado,
          lineHeight: 0.95,
          letterSpacing: '0.06em',
          backgroundImage:
            'linear-gradient(100deg, var(--accent-red) 0%, var(--accent-gold) 45%, var(--accent-red-light) 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'shimmer 5s linear infinite',
          filter: isHero ? 'drop-shadow(0 0 40px var(--accent-red-glow))' : 'none',
        }}
      >
        {animated
          ? letters.map((char, index) => (
              <Box
                key={index}
                component="span"
                sx={{
                  display: 'inline-block',
                  opacity: 0,
                  animation: 'riseFade 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  animationDelay: `${index * 70}ms`,
                }}
              >
                {char}
              </Box>
            ))
          : 'SABADO'}
      </Typography>

      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: dims.games,
          lineHeight: 1,
          letterSpacing: dims.gap,
          color: 'var(--text-primary)',
          opacity: 0.9,
          ...(animated && {
            opacity: 0,
            animation: 'riseFade 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
            animationDelay: '520ms',
          }),
        }}
      >
        GAMES
      </Typography>

      {tagline && (
        <Typography
          sx={{
            mt: isHero ? 2 : 0.5,
            color: 'var(--text-muted)',
            fontSize: isHero ? '1.05rem' : '0.8rem',
            maxWidth: isHero ? 460 : undefined,
            mx: isHero ? 'auto' : undefined,
            ...(animated && {
              opacity: 0,
              animation: 'riseFade 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
              animationDelay: '760ms',
            }),
          }}
        >
          {tagline}
        </Typography>
      )}
    </Box>
  )
}
