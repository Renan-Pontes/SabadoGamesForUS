import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import NumberTicker from './NumberTicker'

type StatPillProps = {
  label: ReactNode
  value: ReactNode
  accent?: string
  /** Preenche o pill com o acento (para o dado mais importante da tela). */
  filled?: boolean
  /** `lg` para telas de TV. */
  size?: 'sm' | 'md' | 'lg'
  sx?: SxProps<Theme>
}

const SIZES = {
  sm: { label: '0.6rem', value: '0.95rem', px: 1.25, py: 0.6 },
  md: { label: '0.65rem', value: '1.35rem', px: 1.75, py: 0.9 },
  lg: { label: '0.85rem', value: '2.6rem', px: 3, py: 1.5 },
} as const

/**
 * Indicador rótulo-sobre-valor. Substitui os `Chip` de texto corrido
 * ("Round 3", "Pot 100") por algo legível de longe na TV.
 */
export default function StatPill({
  label,
  value,
  accent = 'var(--accent-gold)',
  filled = false,
  size = 'md',
  sx,
}: StatPillProps) {
  const dims = SIZES[size]

  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.15,
        px: dims.px,
        py: dims.py,
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${filled ? accent : 'rgba(255,255,255,0.10)'}`,
        background: filled
          ? `linear-gradient(140deg, ${accent}2e, ${accent}12)`
          : 'rgba(255, 255, 255, 0.035)',
        boxShadow: filled ? `0 0 24px ${accent}26` : 'none',
        minWidth: size === 'lg' ? 140 : 76,
        ...sx,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-body)',
          fontSize: dims.label,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          lineHeight: 1.4,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: dims.value,
          lineHeight: 1.05,
          letterSpacing: '0.04em',
          color: filled ? accent : 'var(--text-primary)',
          textShadow: filled ? `0 0 18px ${accent}66` : 'none',
        }}
      >
        {/* Numero puro conta ate o novo valor; texto troca direto. */}
        {typeof value === 'number' ? <NumberTicker value={value} /> : value}
      </Typography>
    </Box>
  )
}
