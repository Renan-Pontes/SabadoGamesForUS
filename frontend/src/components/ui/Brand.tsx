import { Box, Typography } from '@mui/material'

type BrandProps = {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  /** Anima cada letra na entrada (só vale a pena na landing). */
  animated?: boolean
  tagline?: string
  /** Selo "Noite do Terror 🎃". Ligado por padrão: é a edição da noite. */
  badge?: boolean
}

const SIZES = {
  sm: { sabado: '1.6rem', games: '1.05rem', gap: '0.34em', badge: '0.56rem' },
  md: { sabado: '2.2rem', games: '1.4rem', gap: '0.36em', badge: '0.62rem' },
  lg: { sabado: '3.2rem', games: '2rem', gap: '0.38em', badge: '0.78rem' },
  hero: {
    sabado: 'clamp(3.2rem, 13vw, 7.4rem)',
    games: 'clamp(1.7rem, 6vw, 3.4rem)',
    gap: '0.42em',
    badge: 'clamp(0.8rem, 2.6vw, 1.1rem)',
  },
} as const

/**
 * A marca. Estava reescrita à mão em cada tela com pesos e gradientes
 * diferentes; agora é um componente só.
 *
 * Noite do Terror: "SÁBADO" escorre em abóbora e sangue, "GAMES" é
 * branco-fantasma e o selo roxo balança como se tivesse vida própria.
 */
export default function Brand({ size = 'md', animated = false, tagline, badge = true }: BrandProps) {
  const dims = SIZES[size]
  const isHero = size === 'hero'

  // `backwards`: esconde no atraso e solta no fim, sem deixar transform preso.
  const rise = (delay: number) =>
    animated
      ? {
          animation: 'riseFade 620ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
          animationDelay: `${delay}ms`,
        }
      : {}

  return (
    <Box sx={{ textAlign: isHero ? 'center' : 'left', display: 'inline-block' }}>
      <Typography
        component={isHero ? 'h1' : 'div'}
        aria-label="Sábado Games"
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: dims.sabado,
          lineHeight: 0.95,
          letterSpacing: '0.05em',
          backgroundImage:
            'linear-gradient(100deg, var(--pumpkin) 0%, var(--pumpkin-light) 30%, var(--blood) 60%, var(--pumpkin) 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          // A palavra entra inteira: letra animada dentro de texto recortado
          // some no Chrome (cada letra vira uma camada fora do recorte).
          animation: animated
            ? 'riseFade 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards, shimmer 6s linear infinite'
            : 'shimmer 6s linear infinite',
          // drop-shadow (e não text-shadow): com o texto recortado no
          // gradiente, text-shadow pintaria por cima das letras.
          filter: isHero
            ? 'drop-shadow(0 0 28px rgba(255, 123, 28, 0.45)) drop-shadow(0 6px 0 rgba(90, 10, 20, 0.55))'
            : 'drop-shadow(0 0 12px rgba(255, 123, 28, 0.35))',
        }}
      >
        SÁBADO
      </Typography>

      <Typography
        aria-hidden
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: dims.games,
          lineHeight: 1.05,
          letterSpacing: dims.gap,
          color: 'var(--ghost)',
          textShadow: '0 0 18px rgba(176, 107, 255, 0.55)',
          mt: isHero ? 0.5 : 0.25,
          ...rise(480),
        }}
      >
        GAMES
      </Typography>

      {badge && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: isHero ? 'center' : 'flex-start',
            mt: isHero ? 1.75 : 0.6,
            ...rise(640),
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45em',
              px: '0.9em',
              py: '0.32em',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(255, 123, 28, 0.7)',
              background: 'linear-gradient(120deg, rgba(139, 63, 217, 0.85), rgba(74, 20, 140, 0.9))',
              boxShadow: '0 0 18px rgba(139, 63, 217, 0.45), inset 0 0 10px rgba(255, 123, 28, 0.2)',
              color: 'var(--pumpkin-light)',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: dims.badge,
              letterSpacing: '0.2em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              transformOrigin: 'center',
              animation: 'wobble 3.2s ease-in-out infinite',
            }}
          >
            NOITE DO TERROR
            <Box component="span" aria-hidden sx={{ letterSpacing: 0, fontSize: '1.3em', lineHeight: 1 }}>
              🎃
            </Box>
          </Box>
        </Box>
      )}

      {tagline && (
        <Typography
          sx={{
            mt: isHero ? 2 : 0.5,
            color: 'var(--text-secondary)',
            fontSize: isHero ? { xs: '1rem', md: '1.1rem' } : '0.8rem',
            maxWidth: isHero ? 480 : undefined,
            mx: isHero ? 'auto' : undefined,
            ...rise(820),
          }}
        >
          {tagline}
        </Typography>
      )}
    </Box>
  )
}
