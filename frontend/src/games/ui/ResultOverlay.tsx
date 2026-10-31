import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import anime from 'animejs'
import { prefersReducedMotion } from '../utils'
import Confetti from './Confetti'

export type ResultTone = 'win' | 'lose' | 'neutral' | 'danger'

// Noite do Terror: vitória é abóbora acesa, derrota é sangue, perigo é
// chama de vela e o neutro é roxo de bruxa.
const TONES: Record<ResultTone, { color: string; glow: string; sigil: string }> = {
  win: { color: '#ffa24a', glow: 'rgba(255, 123, 28, 0.5)', sigil: '🏆' },
  lose: { color: '#ff4d63', glow: 'rgba(224, 33, 58, 0.5)', sigil: '💀' },
  danger: { color: '#ffc94a', glow: 'rgba(255, 201, 74, 0.45)', sigil: '🔥' },
  neutral: { color: '#c99bff', glow: 'rgba(139, 63, 217, 0.5)', sigil: '🔮' },
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
        background: 'rgba(8, 4, 14, 0.8)',
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
            'radial-gradient(ellipse 110% 60% at 50% -10%, rgba(139, 63, 217, 0.22), transparent 60%), linear-gradient(165deg, rgba(31, 18, 54, 0.97), rgba(10, 6, 18, 0.98))',
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
            fontSize: { xs: '2.3rem', md: '3.4rem' },
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            overflowWrap: 'break-word',
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
