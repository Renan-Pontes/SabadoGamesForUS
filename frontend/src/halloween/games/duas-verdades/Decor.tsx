import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '@mui/material'
import { CREEPY_FONT, XMAS_COLORS, scatter, useReducedMotion, withAlpha } from '../../ui'
import './duas.css'

/**
 * Enfeites do "Duas Verdades, Uma Mentira", desenhados aqui (SVG leve, sem
 * sorteio no render): a lareira acesa, a meia pendurada de cada jogador, o
 * gorro do contador de histórias, o carimbo "MENTIRA!", brilhinhos, título
 * dourado e a chuva de presentes do fim.
 */

/** Lareira de tijolinho com fogo dançando e brasa brilhando. */
export function Fireplace({ width = 420 }: { width?: number | string }) {
  return (
    <svg viewBox="0 0 400 250" width={width} style={{ display: 'block', overflow: 'visible', maxWidth: '100%' }} aria-hidden>
      <defs>
        <radialGradient id="dv-ember" cx="50%" cy="85%" r="60%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#ff6a2b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff6a2b" stopOpacity="0" />
        </radialGradient>
        <pattern id="dv-bricks" width="40" height="20" patternUnits="userSpaceOnUse">
          <rect width="40" height="20" fill="#8a3324" />
          <path d="M0 0.5 H40 M0 10.5 H40 M20 0 V10 M0 10 V20 M40 10 V20" stroke="#5e1f15" strokeWidth="2" />
        </pattern>
      </defs>
      {/* Parede de tijolo e a boca da lareira */}
      <rect x="20" y="30" width="360" height="220" rx="6" fill="url(#dv-bricks)" />
      <path d="M90 250 V140 Q90 92 200 92 Q310 92 310 140 V250 Z" fill="#1a0c08" />
      <rect className="dv-glow" x="90" y="92" width="220" height="158" fill="url(#dv-ember)" />
      {/* Toras */}
      <rect x="128" y="222" width="150" height="18" rx="9" fill="#5a3418" transform="rotate(-6 203 231)" />
      <rect x="122" y="224" width="150" height="18" rx="9" fill="#6e4220" transform="rotate(7 197 233)" />
      {/* Fogo */}
      <path className="dv-flame" d="M200 224 C 150 210, 160 160, 186 130 C 184 160, 204 166, 204 150 C 214 170, 250 182, 200 224 Z" fill="#ff7a1a" />
      <path className="dv-flame" style={{ animationDelay: '-0.35s' }} d="M168 226 C 140 210, 150 186, 162 168 C 168 190, 182 192, 180 178 C 196 196, 196 216, 168 226 Z" fill="#ffb02e" />
      <path className="dv-flame" style={{ animationDelay: '-0.6s' }} d="M234 226 C 262 212, 254 188, 242 172 C 238 192, 226 194, 226 182 C 210 198, 212 218, 234 226 Z" fill="#ffb02e" />
      <path className="dv-flame" style={{ animationDelay: '-0.2s' }} d="M202 226 C 182 216, 186 196, 198 182 C 200 198, 212 200, 210 190 C 222 204, 222 220, 202 226 Z" fill="#ffe38a" />
      {/* Cornija de madeira com festão */}
      <rect x="0" y="12" width="400" height="26" rx="6" fill="#6b3a1e" />
      <rect x="0" y="12" width="400" height="6" rx="3" fill="#8f5530" />
      <path d="M8 40 Q 58 66 108 40 Q 158 66 208 40 Q 258 66 308 40 Q 358 66 396 40" stroke={XMAS_COLORS.green} strokeWidth="10" fill="none" strokeLinecap="round" />
      {[58, 158, 258, 358].map((x, index) => (
        <circle key={x} cx={x} cy="56" r="7" fill={[XMAS_COLORS.red, XMAS_COLORS.gold, XMAS_COLORS.ice, XMAS_COLORS.red][index]} />
      ))}
    </svg>
  )
}

/** Meia de Natal pendurada. `filled` = já mandou as cartinhas (sai um presente de dentro). */
export function Stocking({ color, filled, size = 76, delay = 0 }: { color: string; filled: boolean; size?: number | string; delay?: number }) {
  return (
    <Box sx={{ position: 'relative', width: size, flexShrink: 0 }}>
      {filled && (
        <Box className="dv-pop" sx={{ position: 'absolute', left: '22%', top: '-34%', fontSize: `calc(${typeof size === 'number' ? `${size}px` : size} * 0.5)`, lineHeight: 1, zIndex: 0 }} aria-hidden>
          🎁
        </Box>
      )}
      <svg viewBox="0 0 60 92" width="100%" className="dv-swing" style={{ display: 'block', overflow: 'visible', position: 'relative', animationDelay: `${delay}s` }} aria-hidden>
        <path d="M14 18 H46 V54 Q46 62 54 68 Q60 74 56 82 Q50 92 36 88 L14 80 Q4 76 6 64 Q8 56 14 50 Z" fill={color} />
        <path d="M14 30 H46 M14 42 H46" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" />
        <rect x="10" y="6" width="40" height="16" rx="5" fill="#ffffff" />
        <path d="M26 6 Q30 0 34 6" stroke={XMAS_COLORS.gold} strokeWidth="2" fill="none" />
      </svg>
    </Box>
  )
}

/** Gorro de Papai Noel (fica bem em cima de nome ou emoji). */
export function SantaHat({ size = 64, style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 80" width={size} style={{ display: 'block', overflow: 'visible', ...style }} aria-hidden>
      <path d="M10 62 C 26 30, 52 4, 84 14 L 76 32 C 64 26, 52 38, 56 62 Z" fill={XMAS_COLORS.red} />
      <path d="M30 40 C 40 26, 56 14, 72 16" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="86" cy="18" r="10" fill="#ffffff" />
      <rect x="4" y="56" width="64" height="18" rx="9" fill="#ffffff" />
    </svg>
  )
}

/** Carimbo vermelho "MENTIRA!" (o pai precisa ser position: relative). */
export function LieStamp({ size = 'clamp(2.6rem, 4.4vw, 4.6rem)', label = 'MENTIRA!' }: { size?: string; label?: string }) {
  return (
    <Box
      className="dv-stamp"
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%) rotate(-12deg)',
        px: '0.45em',
        py: '0.05em',
        border: `0.12em solid ${XMAS_COLORS.red}`,
        borderRadius: '0.2em',
        color: XMAS_COLORS.red,
        background: withAlpha('#fff6f0', 0.86),
        fontFamily: "'Fredoka', 'Rajdhani', sans-serif",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '0.08em',
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        boxShadow: `0 0 0 0.06em ${withAlpha(XMAS_COLORS.red, 0.35)}, 0 10px 30px rgba(0, 0, 0, 0.45)`,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {label} 🤥
    </Box>
  )
}

const SPARKLE_SPOTS = [
  { left: '4%', top: '10%', size: '2.4rem', delay: 0 },
  { left: '93%', top: '6%', size: '3rem', delay: -0.7 },
  { left: '2%', top: '62%', size: '1.8rem', delay: -1.3 },
  { left: '95%', top: '56%', size: '2.2rem', delay: -0.4 },
  { left: '16%', top: '90%', size: '1.6rem', delay: -1 },
  { left: '80%', top: '92%', size: '2rem', delay: -1.6 },
] as const

/** Brilhinhos piscando em volta (o pai precisa ser position: relative). */
export function Sparkles({ color = XMAS_COLORS.gold }: { color?: string }) {
  return (
    <>
      {SPARKLE_SPOTS.map((spot, index) => (
        <Box
          key={index}
          aria-hidden
          className="dv-sparkle"
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

/** Título de cartão de Natal: letra festiva, laranja-lareira com brilho passando. */
export function FestiveTitle({ children, size, align = 'center', color }: { children: ReactNode; size: string; align?: 'left' | 'center'; color?: string }) {
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
        filter: `drop-shadow(0 4px 0 rgba(0, 0, 0, 0.55)) drop-shadow(0 0 22px ${withAlpha(color ?? '#ff8a3d', 0.45)})`,
      }}
    >
      <span className={color ? undefined : 'dv-gold'}>{children}</span>
    </Box>
  )
}

const RAIN = ['🎁', '❄️', '⭐', '🍬', '🎄', '🔔', '🧦', '🎅', '✨', '🤥']

/** Chuva de presentes e flocos na vitória. Tela cheia, sem clique. */
export function XmasRain({ active = true, count = 36 }: { active?: boolean; count?: number }) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1150, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: Math.max(1, Math.min(90, count)) }, (_, index) => {
        const style = {
          left: `${scatter(index, 51) * 100}%`,
          fontSize: `${22 + scatter(index, 52) * 30}px`,
          '--dv-dur': `${4 + scatter(index, 53) * 4}s`,
          '--dv-delay': `${-scatter(index, 54) * 8}s`,
          '--dv-drift': `${(scatter(index, 55) - 0.5) * 180}px`,
          '--dv-spin': `${(scatter(index, 56) - 0.5) * 540}deg`,
        } as CSSProperties
        return (
          <span key={index} className="dv-fall" style={style}>
            {RAIN[index % RAIN.length]}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
