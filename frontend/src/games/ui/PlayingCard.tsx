import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { rankLabel, SUITS } from './cards'
import type { SuitKey } from './cards'

const SIZES = {
  xs: { w: 34, h: 48, rank: '0.7rem', pip: '1.1rem', radius: 5 },
  sm: { w: 54, h: 76, rank: '0.85rem', pip: '1.8rem', radius: 7 },
  md: { w: 86, h: 122, rank: '1.15rem', pip: '2.9rem', radius: 10 },
  lg: { w: 124, h: 176, rank: '1.6rem', pip: '4.2rem', radius: 14 },
  xl: { w: 168, h: 238, rank: '2.1rem', pip: '5.8rem', radius: 18 },
} as const

export type CardSize = keyof typeof SIZES

type PlayingCardProps = {
  rank?: number
  suit?: SuitKey
  faceDown?: boolean
  size?: CardSize
  /** Rotação em graus, para leques e pilhas. */
  tilt?: number
  /** Atraso da animação de distribuição, em ms. */
  dealDelay?: number
  /** Contorno dourado de destaque. */
  highlight?: boolean
  /** Esmaece a carta (cartas já jogadas). */
  dimmed?: boolean
  /** Conteúdo alternativo no centro (ex.: um número de 1 a 100). */
  faceValue?: string | number
  sx?: SxProps<Theme>
}

/**
 * Carta de baralho com frente e verso reais. Anima a entrada como se
 * estivesse sendo distribuída da mesa.
 */
export default function PlayingCard({
  rank,
  suit,
  faceDown = false,
  size = 'md',
  tilt = 0,
  dealDelay = 0,
  highlight = false,
  dimmed = false,
  faceValue,
  sx,
}: PlayingCardProps) {
  const dims = SIZES[size]
  const meta = suit ? SUITS[suit] : null
  const ink = meta?.red ? '#c81e2a' : '#111827'

  const shared: SxProps<Theme> = {
    width: dims.w,
    height: dims.h,
    borderRadius: `${dims.radius}px`,
    flexShrink: 0,
    position: 'relative',
    animation: 'dealIn 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
    animationDelay: `${dealDelay}ms`,
    transform: `rotate(${tilt}deg)`,
    opacity: dimmed ? 0.55 : 1,
    transition: 'transform 220ms ease, box-shadow 220ms ease, opacity 220ms ease',
  }

  if (faceDown) {
    return (
      <Box
        aria-label="Carta virada para baixo"
        sx={{
          ...shared,
          background:
            'repeating-linear-gradient(45deg, #7f1d1d 0 6px, #991b1b 6px 12px)',
          border: '2px solid rgba(245, 245, 245, 0.85)',
          boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
          display: 'grid',
          placeItems: 'center',
          ...sx,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 5,
            borderRadius: `${Math.max(2, dims.radius - 3)}px`,
            border: '1px solid rgba(255,255,255,0.35)',
          }}
        />
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: dims.pip,
            color: 'rgba(255,255,255,0.25)',
            lineHeight: 1,
          }}
        >
          ★
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      aria-label={meta && rank ? `${rankLabel(rank)} de ${meta.label}` : undefined}
      sx={{
        ...shared,
        background: 'linear-gradient(150deg, #ffffff 0%, #eceff4 100%)',
        border: highlight ? '2px solid var(--accent-gold)' : '2px solid rgba(15, 23, 42, 0.18)',
        boxShadow: highlight
          ? '0 14px 36px rgba(0,0,0,0.5), 0 0 34px var(--accent-gold-glow)'
          : '0 10px 26px rgba(0,0,0,0.42)',
        display: 'grid',
        placeItems: 'center',
        ...sx,
      }}
    >
      {rank !== undefined && meta && (
        <>
          <Box sx={{ position: 'absolute', top: 5, left: 7, textAlign: 'center', lineHeight: 1 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: dims.rank,
                color: ink,
                lineHeight: 1,
              }}
            >
              {rankLabel(rank)}
            </Typography>
            <Typography sx={{ fontSize: `calc(${dims.rank} * 0.8)`, color: ink, lineHeight: 1 }}>
              {meta.symbol}
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 5,
              right: 7,
              textAlign: 'center',
              lineHeight: 1,
              transform: 'rotate(180deg)',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: dims.rank,
                color: ink,
                lineHeight: 1,
              }}
            >
              {rankLabel(rank)}
            </Typography>
            <Typography sx={{ fontSize: `calc(${dims.rank} * 0.8)`, color: ink, lineHeight: 1 }}>
              {meta.symbol}
            </Typography>
          </Box>
        </>
      )}

      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: faceValue !== undefined ? `calc(${dims.pip} * 0.78)` : dims.pip,
          color: faceValue !== undefined ? (Number(faceValue) > 50 ? '#c81e2a' : '#1e3a8a') : ink,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {faceValue !== undefined ? faceValue : meta?.symbol}
      </Typography>
    </Box>
  )
}
