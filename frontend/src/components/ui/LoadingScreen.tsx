import { Box, Typography } from '@mui/material'
import { MIST, pageBackdrop, withAlpha } from './surfaces'

type LoadingScreenProps = {
  /** O que está sendo carregado, em caixa alta e curto. */
  label?: string
  accent?: string
}

/**
 * Tela de carregamento única do app.
 *
 * Em vez de um spinner genérico, um boneco de neve pulando — leva o mesmo
 * tempo e já entra no clima do Natal.
 */
export default function LoadingScreen({
  label = 'CARREGANDO',
  accent = 'var(--accent-gold)',
}: LoadingScreenProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: pageBackdrop(MIST.witch),
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ position: 'relative', width: 130, height: 170, mx: 'auto', mb: 2 }}>
          <Snowman glow={accent} />
          {/* Sombra no chão: encolhe quando o boneco pula */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              width: 80,
              height: 10,
              ml: '-40px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.45)',
              filter: 'blur(3px)',
              animation: 'pulse 2.4s ease-in-out infinite',
            }}
          />
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

/**
 * Boneco de neve: cartola, cachecol vermelho que balança, nariz de cenoura,
 * bochechas rosadas e olhos que piscam. Pula de leve.
 */
export function Snowman({ glow = 'var(--accent-gold)', size = 120 }: { glow?: string; size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 150"
      aria-hidden
      sx={{
        width: size,
        height: (size * 150) / 120,
        display: 'block',
        mx: 'auto',
        overflow: 'visible',
        animation: 'hop 2.4s ease-in-out infinite',
        transformOrigin: 'bottom center',
        filter: `drop-shadow(0 0 16px ${withAlpha(glow, 0.45)})`,
        '& .snow-eye': {
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: 'blink 4.2s ease-in-out infinite',
        },
        '& .snow-scarf-tail': {
          transformBox: 'fill-box',
          transformOrigin: 'top center',
          animation: 'ornamentSwing 1.6s ease-in-out infinite',
        },
      }}
    >
      <defs>
        <radialGradient id="snowman-body" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cfe0f5" />
        </radialGradient>
      </defs>
      {/* Corpo */}
      <circle cx="60" cy="112" r="34" fill="url(#snowman-body)" />
      <circle cx="60" cy="62" r="25" fill="url(#snowman-body)" />
      {/* Botões */}
      <circle cx="60" cy="100" r="3.2" fill="#1b2e4d" />
      <circle cx="60" cy="113" r="3.2" fill="#1b2e4d" />
      <circle cx="60" cy="126" r="3.2" fill="#1b2e4d" />
      {/* Cachecol */}
      <path d="M36 78 Q60 90 84 78 L84 86 Q60 98 36 86 Z" fill="#e8394a" />
      <path d="M40 80 L44 88 M50 84 L53 92 M66 85 L68 93 M77 82 L79 89" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
      <path className="snow-scarf-tail" d="M72 86 L80 86 L84 108 L74 108 Z" fill="#c21f33" />
      {/* Olhos, bochechas e nariz */}
      <ellipse className="snow-eye" cx="51" cy="57" rx="3.4" ry="4.2" fill="#1b2e4d" />
      <ellipse className="snow-eye" cx="69" cy="57" rx="3.4" ry="4.2" fill="#1b2e4d" />
      <ellipse cx="45" cy="67" rx="4.5" ry="2.6" fill="#ff9ec4" opacity="0.7" />
      <ellipse cx="75" cy="67" rx="4.5" ry="2.6" fill="#ff9ec4" opacity="0.7" />
      <path d="M59 63 L80 67 L59 68 Z" fill="#ff8a1c" />
      <path d="M52 73 Q60 78 68 73" stroke="#1b2e4d" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Cartola com fita verde */}
      <rect x="40" y="36" width="40" height="5" rx="2" fill="#13233f" />
      <rect x="46" y="14" width="28" height="24" rx="3" fill="#13233f" />
      <rect x="46" y="30" width="28" height="5" fill="#1f9d55" />
      <circle cx="70" cy="32.5" r="3" fill="#e8394a" />
    </Box>
  )
}
