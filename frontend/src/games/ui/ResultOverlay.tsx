import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import anime from 'animejs'
import { prefersReducedMotion } from '../utils'
import Confetti from './Confetti'

export type ResultTone = 'win' | 'lose' | 'neutral' | 'danger'

const TONES: Record<ResultTone, { color: string; glow: string; sigil: string }> = {
  win: { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)', sigil: '👑' },
  lose: { color: '#dc2626', glow: 'rgba(220, 38, 38, 0.45)', sigil: '💀' },
  danger: { color: '#f97316', glow: 'rgba(249, 115, 22, 0.45)', sigil: '⚠️' },
  neutral: { color: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)', sigil: '◆' },
}

type ResultOverlayProps = {
  open: boolean
  tone?: ResultTone
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  /** Emoji/símbolo grande. Passe `null` para esconder. */
  sigil?: string | null
}

/**
 * Cortina de resultado (eliminação, fim de rodada, vitória). Entra com
 * escala elástica e um brilho que varre a caixa.
 */
export default function ResultOverlay({
  open,
  tone = 'neutral',
  title,
  subtitle,
  children,
  sigil,
}: ResultOverlayProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const meta = TONES[tone]

  useEffect(() => {
    if (!open || !boxRef.current || prefersReducedMotion()) return
    anime({
      targets: boxRef.current,
      scale: [0.7, 1.04, 1],
      opacity: [0, 1],
      duration: 620,
      easing: 'easeOutElastic(1, 0.65)',
    })
  }, [open, title])

  if (!open) return null

  return (
    <>
      {tone === 'win' && <Confetti />}
      <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        p: 3,
        background: 'rgba(5, 5, 9, 0.78)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 260ms ease both',
      }}
    >
      <Box
        ref={boxRef}
        className="sheen"
        sx={{
          maxWidth: 620,
          width: '100%',
          textAlign: 'center',
          borderRadius: 'var(--radius-xl)',
          border: `2px solid ${meta.color}`,
          background:
            'linear-gradient(165deg, rgba(26, 26, 36, 0.97), rgba(10, 10, 15, 0.98))',
          boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 70px ${meta.glow}`,
          p: { xs: 3.5, md: 5 },
        }}
      >
        {sigil !== null && (
          <Typography
            sx={{
              fontSize: { xs: '3.2rem', md: '4.2rem' },
              lineHeight: 1,
              mb: 1.5,
              filter: `drop-shadow(0 0 22px ${meta.glow})`,
            }}
          >
            {sigil ?? meta.sigil}
          </Typography>
        )}

        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '2.2rem', md: '3.2rem' },
            lineHeight: 1.05,
            letterSpacing: '0.06em',
            color: meta.color,
            textShadow: `0 0 34px ${meta.glow}`,
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            sx={{
              mt: 1.5,
              fontSize: { xs: '1rem', md: '1.2rem' },
              color: 'var(--text-secondary)',
            }}
          >
            {subtitle}
          </Typography>
        )}

        {children && <Box sx={{ mt: 3 }}>{children}</Box>}
      </Box>
      </Box>
    </>
  )
}
