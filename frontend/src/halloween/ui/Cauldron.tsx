import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Box } from '@mui/material'
import { SPOOKY_COLORS } from './fonts'
import './spooky.css'

type CauldronProps = {
  /** Largura em px. */
  size?: number
  /** Cor da poção. */
  potion?: string
  bubbling?: boolean
  /** Foguinho embaixo. */
  fire?: boolean
  /** Conteúdo na barriga do caldeirão (ex.: "🍬 12"). */
  children?: ReactNode
}

const BUBBLES = [
  { cx: 42, r: 4, dur: 2.1, delay: 0 },
  { cx: 60, r: 5.5, dur: 2.6, delay: 0.7 },
  { cx: 76, r: 3.5, dur: 1.9, delay: 1.3 },
  { cx: 52, r: 3, dur: 2.3, delay: 1.8 },
  { cx: 68, r: 4, dur: 2.8, delay: 0.3 },
]

/**
 * Caldeirão de bruxa borbulhando — placar de doces, pote de apostas.
 *
 *   <Cauldron size={180} potion="#84cc16">🍬 12</Cauldron>
 */
export default function Cauldron({
  size = 160,
  potion = SPOOKY_COLORS.toxic,
  bubbling = true,
  fire = true,
  children,
}: CauldronProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const height = (size * 110) / 120
  return (
    <Box sx={{ position: 'relative', width: size, height, flexShrink: 0 }}>
      <svg width={size} height={height} viewBox="0 0 120 110" aria-hidden>
        <defs>
          <radialGradient id={`${id}-pot`} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#4b4458" />
            <stop offset="60%" stopColor="#1d1824" />
            <stop offset="100%" stopColor="#0a080d" />
          </radialGradient>
          <radialGradient id={`${id}-potion`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="35%" stopColor={potion} />
            <stop offset="100%" stopColor={potion} stopOpacity={0.8} />
          </radialGradient>
        </defs>

        {fire && (
          <g>
            {[44, 60, 76].map((x, index) => (
              <path
                key={x}
                className="hw-flame"
                style={{ animationDelay: `${index * -0.17}s` } as CSSProperties}
                d={`M${x} 108 C ${x - 7} 100 ${x - 5} 92 ${x} 84 C ${x + 5} 92 ${x + 7} 100 ${x} 108 Z`}
                fill={index === 1 ? '#fbbf24' : '#f97316'}
                opacity={0.9}
              />
            ))}
          </g>
        )}

        {/* Pés */}
        <path d="M30 92 L24 104 L32 104 Z M90 92 L96 104 L88 104 Z" fill="#0a080d" />

        {/* Corpo */}
        <path d="M14 40 C 10 70 26 98 60 98 C 94 98 110 70 106 40 Z" fill={`url(#${id}-pot)`} />

        {/* Poção e borda */}
        <ellipse cx="60" cy="40" rx="46" ry="10" fill={`url(#${id}-potion)`} />
        <ellipse cx="60" cy="40" rx="50" ry="11" fill="none" stroke="#2c2636" strokeWidth={5} />
        <ellipse cx="60" cy="38" rx="50" ry="11" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

        {bubbling &&
          BUBBLES.map((bubble) => (
            <circle
              key={bubble.cx}
              className="hw-bubble"
              cx={bubble.cx}
              cy={38}
              r={bubble.r}
              fill={potion}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={0.8}
              style={
                { '--hw-bubble-dur': `${bubble.dur}s`, '--hw-bubble-delay': `${bubble.delay}s` } as CSSProperties
              }
            />
          ))}
      </svg>

      {children !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '52%',
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.17,
            lineHeight: 1,
            color: '#f5f0e1',
            textShadow: '0 2px 6px rgba(0,0,0,0.8)',
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  )
}
