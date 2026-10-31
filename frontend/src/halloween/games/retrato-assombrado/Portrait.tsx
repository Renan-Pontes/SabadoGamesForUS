import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { PALETTE, VIEW_H, VIEW_W, polylinePoints, type Stroke } from './drawing'
import type { PortraitTone } from './view'

type PortraitProps = {
  strokes: readonly Stroke[]
  name: string
  /** Como o retrato aparece: normal, impostor (faixa vermelha), acusado (holofote) ou apagado. */
  tone?: PortraitTone
  /** Selo no canto (votos, ✓…). */
  badge?: ReactNode
  /** Faixa atravessada ("🤫 IMPOSTOR"). */
  ribbon?: ReactNode
  /** Entrada escalonada (ms). */
  delayMs?: number
  /** Quando o tom e a faixa aparecem (ms) — o suspense da revelação. */
  revealDelayMs?: number
  /** Espessura do traço no espaço 1000×625 (mais grosso na TV, que fica longe). */
  strokeWidth?: number
  /** Texto no lugar do desenho vazio. */
  empty?: string
}

const FRAME = 'linear-gradient(135deg, #5a3d12 0%, #f1d38a 24%, #8a6a2f 48%, #e9c46a 74%, #4a3210 100%)'
const TONE_GLOW: Record<PortraitTone, string> = {
  plain: '0 10px 28px rgba(0, 0, 0, 0.55)',
  dim: '0 6px 18px rgba(0, 0, 0, 0.5)',
  accused: '0 0 0 4px #ffc94a, 0 0 46px rgba(255, 201, 74, 0.75)',
  impostor: '0 0 0 4px #e0213a, 0 0 54px rgba(224, 33, 58, 0.85)',
}

/**
 * Um retrato da galeria assombrada: o desenho de alguém numa moldura
 * dourada, com a plaquinha do nome embaixo (letras de TV, ≥ 28 px).
 *
 *   <Portrait strokes={drawing} name="Ana" tone="impostor" ribbon="🤫 IMPOSTOR" />
 */
export default function Portrait({
  strokes,
  name,
  tone = 'plain',
  badge,
  ribbon,
  delayMs = 0,
  revealDelayMs = 0,
  strokeWidth = 15,
  empty = '💤',
}: PortraitProps) {
  const lit = tone === 'accused' || tone === 'impostor'
  return (
    <Box
      className="stagger-in"
      style={{ animationDelay: `${delayMs}ms` }}
      sx={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          borderRadius: '8px',
          border: 'clamp(5px, 0.5vw, 10px) solid transparent',
          background: `linear-gradient(#f3ead4, #efe2c4) padding-box, ${FRAME} border-box`,
          boxShadow: TONE_GLOW.plain,
          opacity: tone === 'dim' ? 0.42 : 1,
          filter: tone === 'dim' ? 'grayscale(0.85)' : 'none',
          transition: 'opacity 500ms ease, filter 500ms ease',
          ...(lit && {
            animation: `raLit 650ms ease ${revealDelayMs}ms both`,
            '@keyframes raLit': {
              from: { boxShadow: TONE_GLOW.plain, transform: 'scale(1)' },
              to: { boxShadow: TONE_GLOW[tone], transform: 'scale(1.03)' },
            },
          }),
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
          aria-label={`Desenho de ${name}`}
        >
          {strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={polylinePoints(stroke.p)}
              fill="none"
              stroke={PALETTE[stroke.c] ?? PALETTE[0]}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {strokes.length === 0 && (
            <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle" dominantBaseline="central" fontSize={180} opacity={0.35}>
              {empty}
            </text>
          )}
        </svg>

        {ribbon && (
          <Box
            sx={{
              position: 'absolute',
              left: '-4%',
              right: '-4%',
              top: '50%',
              py: 0.5,
              textAlign: 'center',
              fontWeight: 900,
              letterSpacing: '0.08em',
              fontSize: 'clamp(1.75rem, 2vw, 2.6rem)',
              lineHeight: 1.1,
              color: '#fff',
              background: tone === 'impostor' ? 'rgba(190, 18, 40, 0.92)' : 'rgba(20, 83, 45, 0.9)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              animation: `raRibbon 600ms cubic-bezier(0.22, 1, 0.36, 1) ${revealDelayMs}ms both`,
              '@keyframes raRibbon': {
                from: { opacity: 0, transform: 'translateY(-50%) rotate(-8deg) scaleX(0.2)' },
                to: { opacity: 1, transform: 'translateY(-50%) rotate(-8deg) scaleX(1)' },
              },
            }}
          >
            {ribbon}
          </Box>
        )}

        {badge && (
          <Box
            sx={{
              position: 'absolute',
              top: -14,
              right: -14,
              minWidth: 'clamp(48px, 3.6vw, 66px)',
              height: 'clamp(48px, 3.6vw, 66px)',
              px: 1,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              fontSize: 'clamp(1.75rem, 2vw, 2.4rem)',
              color: '#0b0614',
              background: '#ffc94a',
              border: '3px solid #0b0614',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            {badge}
          </Box>
        )}
      </Box>

      {/* Plaquinha de museu, encostada na moldura */}
      <Box
        sx={{
          mt: '-12px',
          zIndex: 1,
          maxWidth: '94%',
          px: 1.5,
          py: 0.25,
          borderRadius: '6px',
          border: '2px solid #b08d4a',
          background: 'linear-gradient(180deg, #2b1d0c, #140d05)',
          color: '#f1d38a',
          fontWeight: 800,
          fontSize: 'clamp(1.75rem, 1.8vw, 2.3rem)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        }}
      >
        {name}
      </Box>
    </Box>
  )
}
