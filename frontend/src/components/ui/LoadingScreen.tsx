import { Box, Typography } from '@mui/material'
import { MIST, pageBackdrop, withAlpha } from './surfaces'

type LoadingScreenProps = {
  /** O que está sendo carregado, em caixa alta e curto. */
  label?: string
  accent?: string
}

/**
 * Tela de carregamento única do app. Antes eram quatro variações de
 * `<Typography>Carregando...</Typography>` soltas.
 *
 * Em vez de um spinner genérico, um fantasminha flutuando — leva o mesmo
 * tempo e mantém o clima da Noite do Terror.
 */
export default function LoadingScreen({
  label = 'CARREGANDO',
  accent = 'var(--neon-purple)',
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
        <Box sx={{ position: 'relative', width: 120, height: 150, mx: 'auto', mb: 2 }}>
          <Ghost glow={accent} />
          {/* Sombra no chão: encolhe quando o fantasma sobe */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              width: 70,
              height: 10,
              ml: '-35px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.55)',
              filter: 'blur(3px)',
              animation: 'pulse 3.2s ease-in-out infinite',
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

/** O fantasminha: corpo de lençol com barra ondulada, olhos que piscam e um "ó" de susto. */
export function Ghost({ glow = 'var(--neon-purple)', size = 120 }: { glow?: string; size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 140"
      aria-hidden
      sx={{
        width: size,
        height: (size * 140) / 120,
        display: 'block',
        mx: 'auto',
        animation: 'ghostFloat 3.2s ease-in-out infinite',
        filter: `drop-shadow(0 0 18px ${withAlpha(glow, 0.55)})`,
        '& .ghost-eye': {
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: 'blink 4.2s ease-in-out infinite',
        },
      }}
    >
      <defs>
        <linearGradient id="ghost-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d9ccf5" />
        </linearGradient>
      </defs>
      <path
        d="M60 8 C28 8 12 32 12 62 L12 124 Q22 112 32 124 Q42 136 52 124 Q60 114 68 124 Q78 136 88 124 Q98 112 108 124 L108 62 C108 32 92 8 60 8 Z"
        fill="url(#ghost-body)"
      />
      <ellipse className="ghost-eye" cx="44" cy="58" rx="7" ry="10" fill="#1a0d2e" />
      <ellipse className="ghost-eye" cx="76" cy="58" rx="7" ry="10" fill="#1a0d2e" />
      <ellipse cx="60" cy="86" rx="7" ry="9" fill="#1a0d2e" />
      <ellipse cx="34" cy="74" rx="6" ry="3.5" fill="#ff9ec4" opacity="0.55" />
      <ellipse cx="86" cy="74" rx="6" ry="3.5" fill="#ff9ec4" opacity="0.55" />
    </Box>
  )
}
