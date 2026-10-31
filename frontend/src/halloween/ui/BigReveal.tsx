import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '@mui/material'
import { playSfx } from '../audio'
import type { SfxName } from '../audio'
import { useSuppressScares } from '../scare'
import { withAlpha } from './color'
import { CREEPY_FONT } from './fonts'
import './spooky.css'

export type RevealTone = 'blood' | 'pumpkin' | 'ghost' | 'toxic' | 'witch'

const TONES: Record<RevealTone, { color: string; deep: string }> = {
  blood: { color: '#ef4444', deep: '#450a0a' },
  pumpkin: { color: '#ff7a18', deep: '#431407' },
  ghost: { color: '#e0f2fe', deep: '#0c1a2a' },
  toxic: { color: '#a3e635', deep: '#1a2e05' },
  witch: { color: '#c084fc', deep: '#2e1065' },
}

type BigRevealProps = {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  /** Emoji/ícone grande acima do título. */
  icon?: ReactNode
  tone?: RevealTone
  /** Som ao abrir (padrão 'reveal'; null = mudo). */
  sound?: SfxName | null
  children?: ReactNode
  zIndex?: number
}

/**
 * Sobreposição dramática para revelações na TV: cortina escura, raios de
 * luz girando e o título surgindo. Enquanto aberta, segura os sustos
 * aleatórios (o meme não atropela o momento). Nunca bloqueia cliques.
 *
 *   <BigReveal open={phase === 'reveal'} icon="🔪" title="ERA A JULIA!" subtitle="a assassina" tone="blood" />
 */
export default function BigReveal({
  open,
  title,
  subtitle,
  icon,
  tone = 'pumpkin',
  sound = 'reveal',
  children,
  zIndex = 1200,
}: BigRevealProps) {
  useSuppressScares(open)

  useEffect(() => {
    if (open && sound) playSfx(sound)
  }, [open, sound])

  if (!open || typeof document === 'undefined') return null
  const { color, deep } = TONES[tone]

  return createPortal(
    <Box
      className="hw-fade-in"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'grid',
        placeItems: 'center',
        p: 3,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: `radial-gradient(ellipse at center, ${withAlpha(deep, 0.82)} 0%, rgba(4, 2, 8, 0.94) 70%)`,
      }}
    >
      <div className="hw-rays" aria-hidden />
      <Box className="hw-reveal-card" sx={{ position: 'relative', textAlign: 'center', maxWidth: 1100 }}>
        {icon && (
          <Box
            sx={{
              fontSize: { xs: '4rem', md: '7rem' },
              lineHeight: 1,
              mb: 2,
              filter: `drop-shadow(0 0 26px ${withAlpha(color, 0.6)})`,
            }}
          >
            {icon}
          </Box>
        )}
        <Box
          sx={{
            fontFamily: CREEPY_FONT,
            fontSize: { xs: '3rem', md: '6rem' },
            lineHeight: 1.02,
            letterSpacing: '0.04em',
            color,
            textShadow: `0 0 18px ${withAlpha(color, 0.6)}, 0 0 60px ${withAlpha(color, 0.35)}, 0 6px 0 rgba(0,0,0,0.6)`,
          }}
        >
          {title}
        </Box>
        {subtitle && (
          <Box
            sx={{
              mt: 2,
              fontSize: { xs: '1.3rem', md: '2.2rem' },
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            {subtitle}
          </Box>
        )}
        {children && <Box sx={{ mt: 3 }}>{children}</Box>}
      </Box>
    </Box>,
    document.body,
  )
}
