import { useId } from 'react'
import { Box } from '@mui/material'
import type { GiftMood } from './view'

type GiftBoxProps = {
  /** Largura em px (a altura é 1,25×). */
  size?: number
  /** Quanto do pavio sobra (0..1); null = pavio inteiro, ainda apagado. */
  fuse?: number | null
  /** Pavio aceso (faísca na ponta). Padrão: aceso quando `fuse` vem com número. */
  lit?: boolean
  /** Cara do presente. */
  mood?: GiftMood
  /** 0 parado, 1 tremidinha, 2 tremendo, 3 sacudindo (segundos finais). */
  shake?: 0 | 1 | 2 | 3
  /** Cor do papel de presente. */
  paper?: string
}

/** Ponto da curva do pavio (Bézier quadrática) em `t` (0 = no laço, 1 = na ponta). */
function fusePoint(t: number): [number, number] {
  const p0 = [60, 30]
  const p1 = [70, -6]
  const p2 = [100, 4]
  const a = (1 - t) * (1 - t)
  const b = 2 * (1 - t) * t
  const c = t * t
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]
}

const FUSE_PATH = 'M60 30 Q70 -6 100 4'

/** Listras vermelhas só no pedaço que sobra do pavio (traços de 0,05 até `left`). */
function stripes(left: number): string {
  const parts: number[] = []
  for (let at = 0; at < left; at += 0.1) parts.push(Math.min(0.05, left - at), 0.05)
  return [...parts, 0, 2].map((n) => n.toFixed(3)).join(' ')
}

const SHAKE_ANIMATION = [
  'none',
  'abbGiftWiggle 1.1s ease-in-out infinite',
  'abbGiftShake 0.3s linear infinite',
  'abbGiftPanic 0.13s linear infinite',
] as const

/**
 * O presente-bomba: caixa embrulhada com bolinhas, fita dourada, laço em
 * cima e um pavio de bengala doce saindo do laço. Tem carinha (feliz,
 * nervoso, em pânico) e treme cada vez mais conforme o pavio acaba.
 *
 *   <GiftBox size={120} fuse={0.4} mood="nervous" shake={2} />
 */
export default function GiftBox({ size = 120, fuse = null, lit, mood = 'happy', shake = 0, paper = '#e8394a' }: GiftBoxProps) {
  const uid = useId().replace(/:/g, '')
  const dots = `abb-dots-${uid}`
  const shine = `abb-shine-${uid}`
  const left = fuse === null ? 1 : Math.max(0, Math.min(1, fuse))
  const sparking = (lit ?? fuse !== null) && left > 0
  const [sx, sy] = fusePoint(left)
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size * 1.25,
        transformOrigin: '50% 90%',
        animation: SHAKE_ANIMATION[shake],
        '@keyframes abbGiftWiggle': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-3deg)' },
          '75%': { transform: 'rotate(3deg)' },
        },
        '@keyframes abbGiftShake': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-3px, 1px) rotate(-6deg)' },
          '50%': { transform: 'translate(2px, -2px) rotate(4deg)' },
          '75%': { transform: 'translate(3px, 1px) rotate(6deg)' },
        },
        '@keyframes abbGiftPanic': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg) scale(1.04)' },
          '25%': { transform: 'translate(-5px, 2px) rotate(-10deg) scale(0.98)' },
          '50%': { transform: 'translate(4px, -4px) rotate(7deg) scale(1.08)' },
          '75%': { transform: 'translate(5px, 2px) rotate(10deg) scale(1)' },
        },
      }}
    >
      <svg viewBox="0 -12 120 162" width={size} height={size * 1.25} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <pattern id={dots} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="2.6" fill="#fff6dc" opacity="0.75" />
            <circle cx="12" cy="12" r="2.6" fill="#fff6dc" opacity="0.75" />
          </pattern>
          <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Pavio: o pedaço queimado fica cinza; o que sobra é listrado de bengala doce. */}
        <path d={FUSE_PATH} fill="none" stroke="rgba(120, 140, 170, 0.6)" strokeWidth="5" strokeLinecap="round" />
        {left > 0 && (
          <>
            <path d={FUSE_PATH} pathLength={1} fill="none" stroke="#fff6dc" strokeWidth="5.5" strokeLinecap="round" strokeDasharray={`${left} 2`} />
            <path d={FUSE_PATH} pathLength={1} fill="none" stroke="#ff4057" strokeWidth="5.5" strokeDasharray={stripes(left)} />
          </>
        )}
        {sparking && (
          <>
            <g transform={`translate(${sx} ${sy})`}>
              <circle r="9" fill="#ffd166" opacity="0.45">
                <animate attributeName="r" values="7;11;7" dur="0.3s" repeatCount="indefinite" />
              </circle>
              <path d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill="#fffbe8">
                <animateTransform attributeName="transform" type="rotate" values="0;45;0" dur="0.24s" repeatCount="indefinite" />
              </path>
            </g>
          </>
        )}

        {/* Sombra no chão */}
        <ellipse cx="60" cy="144" rx="46" ry="5" fill="rgba(0, 0, 0, 0.3)" />

        {/* Caixa */}
        <rect x="14" y="58" width="92" height="84" rx="8" fill={paper} />
        <rect x="14" y="58" width="92" height="84" rx="8" fill={`url(#${dots})`} />
        <rect x="14" y="58" width="92" height="84" rx="8" fill={`url(#${shine})`} />
        <rect x="52" y="58" width="16" height="84" fill="#f5c242" />
        <rect x="56" y="58" width="3" height="84" fill="#fff3b0" opacity="0.7" />

        {/* Tampa */}
        <rect x="8" y="44" width="104" height="20" rx="6" fill={paper} />
        <rect x="8" y="44" width="104" height="20" rx="6" fill="rgba(0, 0, 0, 0.16)" />
        <rect x="8" y="44" width="104" height="6" rx="3" fill="rgba(255, 255, 255, 0.22)" />
        <rect x="52" y="44" width="16" height="20" fill="#e0a92e" />

        {/* Laço */}
        <path d="M58 42 Q50 60 44 64 L48 56 L40 58 Q52 52 56 40 Z" fill="#e0a92e" />
        <path d="M62 42 Q70 60 76 64 L72 56 L80 58 Q68 52 64 40 Z" fill="#e0a92e" />
        <ellipse cx="44" cy="32" rx="17" ry="10" transform="rotate(-24 44 32)" fill="#f5c242" />
        <ellipse cx="46" cy="33" rx="9" ry="4.5" transform="rotate(-24 46 33)" fill="#c58f17" />
        <ellipse cx="76" cy="32" rx="17" ry="10" transform="rotate(24 76 32)" fill="#f5c242" />
        <ellipse cx="74" cy="33" rx="9" ry="4.5" transform="rotate(24 74 33)" fill="#c58f17" />
        <circle cx="60" cy="38" r="8" fill="#ffd166" />
        <circle cx="57.5" cy="35.5" r="2.4" fill="#fff6dc" opacity="0.8" />

        <Face mood={mood} />
      </svg>
    </Box>
  )
}

function Face({ mood }: { mood: GiftMood }) {
  const ink = '#2a0509'
  const cheeks = (
    <>
      <ellipse cx="28" cy="104" rx="7" ry="4.5" fill="#ff9aa8" opacity="0.75" />
      <ellipse cx="92" cy="104" rx="7" ry="4.5" fill="#ff9aa8" opacity="0.75" />
    </>
  )
  if (mood === 'happy') {
    return (
      <g>
        <circle cx="34" cy="90" r="6" fill={ink} />
        <circle cx="86" cy="90" r="6" fill={ink} />
        <circle cx="36" cy="88" r="2" fill="#ffffff" />
        <circle cx="88" cy="88" r="2" fill="#ffffff" />
        {cheeks}
        <path d="M42 108 Q60 126 78 108" fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />
      </g>
    )
  }
  if (mood === 'nervous') {
    return (
      <g>
        <circle cx="34" cy="90" r="9" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
        <circle cx="86" cy="90" r="9" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
        <circle cx="38" cy="90" r="4" fill={ink} />
        <circle cx="90" cy="90" r="4" fill={ink} />
        <path d="M24 77 L40 80" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <path d="M96 77 L80 80" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <path d="M40 116 Q45 110 50 116 T60 116 T70 116 T80 116" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M104 70 Q100 78 104 82 Q108 78 104 70 Z" fill="#9fdcff" />
      </g>
    )
  }
  if (mood === 'panic') {
    return (
      <g>
        <circle cx="34" cy="88" r="12" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
        <circle cx="86" cy="88" r="12" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
        <circle cx="34" cy="88" r="3" fill={ink} />
        <circle cx="86" cy="88" r="3" fill={ink} />
        <path d="M20 72 L42 70" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <path d="M100 72 L78 70" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="60" cy="118" rx="14" ry="13" fill={ink} />
        <ellipse cx="60" cy="124" rx="8" ry="5" fill="#ff6b81" />
        <path d="M106 66 Q101 76 106 81 Q111 76 106 66 Z" fill="#9fdcff" />
        <path d="M14 70 Q10 78 14 82 Q18 78 14 70 Z" fill="#9fdcff" />
      </g>
    )
  }
  // surprised
  return (
    <g>
      <circle cx="34" cy="90" r="9" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
      <circle cx="86" cy="90" r="9" fill="#ffffff" stroke={ink} strokeWidth="2.5" />
      <circle cx="34" cy="90" r="4" fill={ink} />
      <circle cx="86" cy="90" r="4" fill={ink} />
      {cheeks}
      <ellipse cx="60" cy="114" rx="7" ry="8" fill={ink} />
    </g>
  )
}
