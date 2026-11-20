import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '@mui/material'
import { CREEPY_FONT, XMAS_COLORS, scatter, useReducedMotion, withAlpha } from '../../ui'
import './espiao.css'

/**
 * Enfeites do "Espião de Natal", desenhados aqui mesmo (SVG leve, sem
 * sorteio no render): gorro de Papai Noel, bola de árvore, presente com
 * laço, o espião de gorro, brilhinhos, título dourado e a chuva de presentes.
 */

/** Gorro de Papai Noel (fica bem em cima de emoji ou de nome). */
export function SantaHat({ size = 64, style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 80" width={size} style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      <path d="M10 62 C 26 30, 52 4, 84 14 L 76 32 C 64 26, 52 38, 56 62 Z" fill={XMAS_COLORS.red} />
      <path d="M30 40 C 40 26, 56 14, 72 16" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="86" cy="18" r="10" fill="#ffffff" />
      <rect x="4" y="56" width="64" height="18" rx="9" fill="#ffffff" />
      <rect x="10" y="60" width="52" height="4" rx="2" fill="#e5edf7" />
    </svg>
  )
}

/** Bola de árvore com gancho, faixa dourada e reflexo. */
export function Ornament({ color = XMAS_COLORS.red, size = 60, swing = false, delay = 0 }: { color?: string; size?: number | string; swing?: boolean; delay?: number }) {
  return (
    <svg
      viewBox="0 0 60 84"
      width={size}
      className={swing ? 'ep-swing' : undefined}
      style={{ display: 'block', overflow: 'visible', animationDelay: `${delay}s` }}
      aria-hidden
    >
      <path d="M30 0 L30 12" stroke={XMAS_COLORS.gold} strokeWidth="2" />
      <rect x="23" y="11" width="14" height="8" rx="2" fill={XMAS_COLORS.gold} />
      <circle cx="30" cy="48" r="27" fill={color} />
      <path d="M4 44 Q30 56 56 44 L56 52 Q30 64 4 52 Z" fill={XMAS_COLORS.gold} opacity="0.85" />
      <path d="M8 46 L14 50 M20 49 L26 53 M34 53 L40 49 M46 50 L52 46" stroke="#fffbe8" strokeWidth="1.6" opacity="0.7" />
      <ellipse cx="20" cy="36" rx="6" ry="9" fill="#ffffff" opacity="0.45" transform="rotate(25 20 36)" />
      <circle cx="40" cy="64" r="2" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}

/** Presente com laço. `shake` sacode a caixa e faz a tampa pular (rufar). */
export function GiftBox({
  color = XMAS_COLORS.red,
  ribbon = XMAS_COLORS.gold,
  size = 120,
  shake = false,
  bounce = false,
  delay = 0,
}: {
  color?: string
  ribbon?: string
  size?: number | string
  shake?: boolean
  bounce?: boolean
  delay?: number
}) {
  const motion = shake ? 'ep-gift-shake' : bounce ? 'ep-bounce' : undefined
  return (
    <svg viewBox="0 0 100 100" width={size} className={motion} style={{ display: 'block', overflow: 'visible', animationDelay: `${delay}s` }} aria-hidden>
      {/* Caixa */}
      <rect x="14" y="44" width="72" height="52" rx="5" fill={color} />
      {[22, 38, 62, 78].map((x, index) => (
        <circle key={x} cx={x} cy={index % 2 ? 58 : 82} r="3.2" fill="#ffffff" opacity="0.35" />
      ))}
      <rect x="44" y="44" width="12" height="52" fill={ribbon} />
      <rect x="14" y="44" width="72" height="8" fill="#000000" opacity="0.14" />
      {/* Tampa + laço (pulam juntos) */}
      <g className={shake ? 'ep-lid-hop' : undefined}>
        <rect x="8" y="30" width="84" height="18" rx="4" fill={color} />
        <rect x="8" y="30" width="84" height="18" rx="4" fill="#ffffff" opacity="0.12" />
        <rect x="44" y="30" width="12" height="18" fill={ribbon} />
        <ellipse cx="36" cy="20" rx="15" ry="8" fill={ribbon} transform="rotate(-24 36 20)" />
        <ellipse cx="64" cy="20" rx="15" ry="8" fill={ribbon} transform="rotate(24 64 20)" />
        <ellipse cx="36" cy="20" rx="7" ry="3.5" fill="#000000" opacity="0.18" transform="rotate(-24 36 20)" />
        <ellipse cx="64" cy="20" rx="7" ry="3.5" fill="#000000" opacity="0.18" transform="rotate(24 64 20)" />
        <circle cx="50" cy="26" r="6" fill={ribbon} />
      </g>
    </svg>
  )
}

/** O espião da casa: 🕵️ de gorro de Papai Noel, balançando. */
export function SpyMascot({ size = '10rem', wiggle = true }: { size?: string; wiggle?: boolean }) {
  return (
    <Box
      aria-hidden
      className={wiggle ? 'ep-wiggle' : undefined}
      sx={{ position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1, filter: `drop-shadow(0 0 36px ${withAlpha(XMAS_COLORS.gold, 0.45)})` }}
    >
      🕵️
      <Box sx={{ position: 'absolute', left: '22%', top: '-34%', width: '66%', transform: 'rotate(-14deg)' }}>
        <SantaHat size="100%" />
      </Box>
    </Box>
  )
}

const SPARKLE_SPOTS = [
  { left: '6%', top: '12%', size: '2.4rem', delay: 0 },
  { left: '90%', top: '8%', size: '3rem', delay: -0.7 },
  { left: '3%', top: '62%', size: '1.8rem', delay: -1.3 },
  { left: '94%', top: '58%', size: '2.2rem', delay: -0.4 },
  { left: '18%', top: '88%', size: '1.6rem', delay: -1 },
  { left: '78%', top: '90%', size: '2rem', delay: -1.6 },
] as const

/** Brilhinhos dourados piscando em volta (o pai precisa ser position: relative). */
export function Sparkles({ color = XMAS_COLORS.gold }: { color?: string }) {
  return (
    <>
      {SPARKLE_SPOTS.map((spot, index) => (
        <Box
          key={index}
          aria-hidden
          className="ep-sparkle"
          sx={{
            position: 'absolute',
            left: spot.left,
            top: spot.top,
            fontSize: spot.size,
            lineHeight: 1,
            color,
            textShadow: `0 0 14px ${withAlpha(color, 0.85)}`,
            animationDelay: `${spot.delay}s`,
            pointerEvents: 'none',
          }}
        >
          ✦
        </Box>
      ))}
    </>
  )
}

/** Título de cartão de Natal: letra festiva, dourado com brilho passando. */
export function FestiveTitle({ children, size, align = 'center', gold = true, color }: { children: ReactNode; size: string; align?: 'left' | 'center'; gold?: boolean; color?: string }) {
  return (
    <Box
      component="h2"
      sx={{
        m: 0,
        fontFamily: CREEPY_FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: '0.02em',
        textAlign: align,
        color: color ?? XMAS_COLORS.gold,
        filter: `drop-shadow(0 4px 0 rgba(0, 0, 0, 0.55)) drop-shadow(0 0 22px ${withAlpha(color ?? XMAS_COLORS.gold, 0.45)})`,
      }}
    >
      <span className={gold && !color ? 'ep-gold' : undefined}>{children}</span>
    </Box>
  )
}

const RAIN = ['🎁', '❄️', '⭐', '🍬', '🎄', '🔔', '🦌', '🎅', '✨', '🍪']

/** Chuva de presentes, flocos e estrelas na vitória. Tela cheia, sem clique. */
export function XmasRain({ active = true, count = 36 }: { active?: boolean; count?: number }) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1150, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: Math.max(1, Math.min(90, count)) }, (_, index) => {
        const style = {
          left: `${scatter(index, 41) * 100}%`,
          fontSize: `${22 + scatter(index, 42) * 30}px`,
          '--ep-dur': `${4 + scatter(index, 43) * 4}s`,
          '--ep-delay': `${-scatter(index, 44) * 8}s`,
          '--ep-drift': `${(scatter(index, 45) - 0.5) * 180}px`,
          '--ep-spin': `${(scatter(index, 46) - 0.5) * 540}deg`,
        } as CSSProperties
        return (
          <span key={index} className="ep-fall" style={style}>
            {RAIN[index % RAIN.length]}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
