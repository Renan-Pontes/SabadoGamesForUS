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
  // Nomes do Halloween, cores de Natal (os jogos já passam esses tons).
  blood: { color: '#ff4d5e', deep: '#4a0a14' }, // vermelho-Noel
  pumpkin: { color: '#f5c242', deep: '#3d2a05' }, // dourado de estrela
  ghost: { color: '#f4f8ff', deep: '#0c1a2f' }, // neve
  toxic: { color: '#4fd67e', deep: '#06301a' }, // pinheiro
  witch: { color: '#7fd8ff', deep: '#08254a' }, // gelo
}

/** Estrelinhas em volta do título (posições fixas: nada de sorteio no render). */
const SPARKLES = [
  { left: '14%', top: '20%', size: '2.4rem', delay: '0s' },
  { left: '82%', top: '16%', size: '3rem', delay: '-0.8s' },
  { left: '8%', top: '70%', size: '2rem', delay: '-1.6s' },
  { left: '88%', top: '66%', size: '2.6rem', delay: '-0.4s' },
  { left: '30%', top: '86%', size: '1.6rem', delay: '-1.2s' },
  { left: '66%', top: '84%', size: '2rem', delay: '-2s' },
] as const

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
 * Sobreposição de revelação na TV: cortina escura, raios girando,
 * estrelinhas piscando e o título surgindo. Enquanto aberta, segura os sustos
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
        background: `radial-gradient(ellipse at center, ${withAlpha(deep, 0.82)} 0%, rgba(3, 8, 18, 0.94) 70%)`,
      }}
    >
      <div className="hw-rays" aria-hidden />
      {SPARKLES.map((sparkle, index) => (
        <Box
          key={index}
          aria-hidden
          className="animate-twinkle"
          sx={{
            position: 'absolute',
            left: sparkle.left,
            top: sparkle.top,
            fontSize: sparkle.size,
            lineHeight: 1,
            color,
            textShadow: `0 0 14px ${withAlpha(color, 0.8)}`,
            animationDelay: sparkle.delay,
          }}
        >
          ✦
        </Box>
      ))}
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
