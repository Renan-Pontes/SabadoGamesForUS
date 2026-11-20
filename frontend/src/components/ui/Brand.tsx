import { Box, Typography } from '@mui/material'

type BrandProps = {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  /** Anima cada letra na entrada (só vale a pena na landing). */
  animated?: boolean
  tagline?: string
  /** Selo "Noite Feliz 🎄". Ligado por padrão: é a edição de Natal. */
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
 * Natal: "SÁBADO" em letra de cartão de Natal, vermelho sólido (as listras
 * de bengala correndo ficavam psicodélicas), com cada letra balançando numa
 * "ola"; "GAMES" branco-neve com brilho dourado, um gorrinho de Papai Noel no
 * canto e o selo verde que pula.
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
          position: 'relative',
          fontFamily: 'var(--font-festive)',
          fontWeight: 700,
          fontSize: dims.sabado,
          lineHeight: 0.95,
          letterSpacing: '0.02em',
          // Cor parada; quem se mexe são as letras.
          color: '#ff4d5e',
          textShadow: isHero
            ? '0 5px 0 #9e1424, 0 0 26px rgba(255, 90, 102, 0.5)'
            : '0 2px 0 #9e1424, 0 0 10px rgba(255, 90, 102, 0.4)',
          ...(animated && { animation: 'riseFade 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards' }),
          // Cada letra balança um pouco depois da anterior: uma "ola" que corre a palavra.
          '& .brand-letter': {
            display: 'inline-block',
            transformOrigin: '50% 80%',
            animation: 'letterWave 2.8s ease-in-out infinite',
          },
        }}
      >
        {[...'SÁBADO'].map((letter, index) => (
          <span key={index} aria-hidden className="brand-letter" style={{ animationDelay: `${index * 0.14}s` }}>
            {letter}
          </span>
        ))}
      </Typography>
      {/* Gorro de Papai Noel pendurado no "S" */}
      <Box
        aria-hidden
        component="span"
        sx={{
          position: 'relative',
          display: 'block',
          height: 0,
          '&::before': {
            content: '"🎅"',
            position: 'absolute',
            left: isHero ? '-0.35em' : '-0.3em',
            top: isHero ? '-1.95em' : '-1.7em',
            fontSize: isHero ? 'clamp(1.6rem, 6vw, 3.4rem)' : `calc(${dims.sabado} * 0.55)`,
            transform: 'rotate(-18deg)',
            animation: 'ornamentSwing 2.6s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
          },
        }}
      />

      <Typography
        aria-hidden
        sx={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: dims.games,
          lineHeight: 1.05,
          letterSpacing: dims.gap,
          color: 'var(--snow)',
          textShadow: '0 0 18px rgba(245, 194, 66, 0.55), 0 3px 0 rgba(12, 26, 51, 0.8)',
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
              border: '1px solid rgba(245, 194, 66, 0.8)',
              background: 'linear-gradient(120deg, #2bb466, #1f9d55 50%, #12693a)',
              boxShadow: '0 0 20px rgba(79, 214, 126, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.2)',
              color: '#fff6dc',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: dims.badge,
              letterSpacing: '0.2em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              transformOrigin: 'center',
              animation: 'hop 2.8s ease-in-out infinite',
            }}
          >
            <Box component="span" aria-hidden sx={{ letterSpacing: 0, fontSize: '1.2em', lineHeight: 1 }}>
              ✨
            </Box>
            NOITE FELIZ
            <Box component="span" aria-hidden sx={{ letterSpacing: 0, fontSize: '1.3em', lineHeight: 1 }}>
              🎄
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
