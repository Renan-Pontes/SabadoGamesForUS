import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { XMAS_COLORS } from '../../ui'
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

/** Moldura de bengala doce: listras vermelhas e creme, com filete dourado por dentro. */
const CANDY_CANE = `repeating-linear-gradient(45deg, ${XMAS_COLORS.red} 0 14px, #fff6dc 14px 28px)`
const PAPER = 'linear-gradient(180deg, #fffdf6, #fbf1dc)'
const TONE_GLOW: Record<PortraitTone, string> = {
  plain: '0 10px 28px rgba(0, 0, 0, 0.5)',
  dim: '0 6px 18px rgba(0, 0, 0, 0.45)',
  accused: `0 0 0 5px ${XMAS_COLORS.gold}, 0 0 50px rgba(245, 194, 66, 0.8)`,
  impostor: `0 0 0 5px ${XMAS_COLORS.red}, 0 0 60px rgba(232, 57, 74, 0.9)`,
}

/**
 * Um quadro da exposição de Natal: o desenho de alguém num cartão com
 * moldura de bengala doce, neve no topo, laço vermelho, um raminho de
 * azevinho e a fita com o nome embaixo (letras de TV, ≥ 28 px). Os quadros
 * balançam de leve, como enfeite pendurado; o impostor revelado dá um
 * "boing" de desenho animado.
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
  // Cada quadro balança no seu ritmo (sai do atraso de entrada: estável entre renders).
  const swing = 3.4 + ((delayMs / 70) % 5) * 0.35
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
          transformOrigin: '50% -12%',
          animation: `raSwing ${swing}s ease-in-out ${-delayMs / 400}s infinite alternate`,
          '@keyframes raSwing': {
            from: { transform: 'rotate(-1.3deg)' },
            to: { transform: 'rotate(1.3deg)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            borderRadius: '10px',
            border: 'clamp(6px, 0.6vw, 12px) solid transparent',
            background: `${PAPER} padding-box, ${CANDY_CANE} border-box`,
            boxShadow: TONE_GLOW.plain,
            opacity: tone === 'dim' ? 0.42 : 1,
            filter: tone === 'dim' ? 'grayscale(0.85)' : 'none',
            transition: 'opacity 500ms ease, filter 500ms ease',
            ...(lit && {
              animation:
                tone === 'impostor'
                  ? `raBoing 900ms cubic-bezier(0.3, 1.6, 0.5, 1) ${revealDelayMs}ms both`
                  : `raLit 650ms ease ${revealDelayMs}ms both`,
              '@keyframes raLit': {
                from: { boxShadow: TONE_GLOW.plain, transform: 'scale(1)' },
                to: { boxShadow: TONE_GLOW.accused, transform: 'scale(1.03)' },
              },
              // Estica e achata como mola: o "boing" do impostor desmascarado.
              '@keyframes raBoing': {
                '0%': { boxShadow: TONE_GLOW.plain, transform: 'scale(1)' },
                '25%': { transform: 'scale(1.16, 0.84)' },
                '45%': { transform: 'scale(0.9, 1.12)' },
                '65%': { transform: 'scale(1.08, 0.95)' },
                '82%': { transform: 'scale(0.98, 1.04)' },
                '100%': { boxShadow: TONE_GLOW.impostor, transform: 'scale(1.03)' },
              },
            }),
          }}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              aspectRatio: `${VIEW_W} / ${VIEW_H}`,
              borderRadius: 4,
            }}
            aria-label={`Desenho de ${name}`}
          >
            <rect x={6} y={6} width={VIEW_W - 12} height={VIEW_H - 12} rx={8} fill="none" stroke={XMAS_COLORS.gold} strokeWidth={8} opacity={0.75} />
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

          <SnowCap />
          <Holly />
          <Bow />

          {ribbon && (
            <Box
              sx={{
                position: 'absolute',
                left: '-5%',
                right: '-5%',
                top: '50%',
                py: 0.5,
                textAlign: 'center',
                fontWeight: 900,
                letterSpacing: '0.08em',
                fontSize: 'clamp(1.75rem, 2vw, 2.6rem)',
                lineHeight: 1.1,
                color: '#fff',
                background:
                  tone === 'impostor'
                    ? `linear-gradient(180deg, ${XMAS_COLORS.red}, #b3172a)`
                    : `linear-gradient(180deg, ${XMAS_COLORS.green}, #13703b)`,
                borderTop: `3px solid ${XMAS_COLORS.gold}`,
                borderBottom: `3px solid ${XMAS_COLORS.gold}`,
                boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                zIndex: 2,
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
                top: -16,
                right: -14,
                zIndex: 3,
                minWidth: 'clamp(48px, 3.6vw, 66px)',
                height: 'clamp(48px, 3.6vw, 66px)',
                px: 1,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: 'clamp(1.75rem, 2vw, 2.4rem)',
                color: '#fff',
                textShadow: '0 2px 0 rgba(0,0,0,0.35)',
                // Bola de Natal: vermelha com brilho e "tampinha" dourada.
                background: `radial-gradient(circle at 32% 28%, #ff9aa5 0, ${XMAS_COLORS.red} 38%, #9e1424 100%)`,
                border: `3px solid ${XMAS_COLORS.gold}`,
                boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -10,
                  left: '50%',
                  width: 16,
                  height: 10,
                  ml: '-8px',
                  borderRadius: '3px 3px 0 0',
                  background: XMAS_COLORS.gold,
                },
              }}
            >
              {badge}
            </Box>
          )}
        </Box>
      </Box>

      {/* Fita vermelha com o nome, de pontas cortadas, encostada no quadro */}
      <Box
        sx={{
          mt: '-14px',
          zIndex: 1,
          maxWidth: '96%',
          px: 3,
          py: 0.35,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%)',
          background: `linear-gradient(180deg, ${XMAS_COLORS.red}, #a8152a)`,
          color: '#fff',
          fontWeight: 800,
          fontSize: 'clamp(1.75rem, 1.8vw, 2.3rem)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: '0 2px 0 rgba(0,0,0,0.3)',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.55))',
        }}
      >
        {name}
      </Box>
    </Box>
  )
}

/** Neve acumulada em cima da moldura, escorrendo um pouquinho. */
function SnowCap() {
  return (
    <svg
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: 'absolute', left: '-3%', width: '106%', top: 'calc(-1 * clamp(10px, 1vw, 18px))', height: 'clamp(16px, 1.6vw, 28px)', zIndex: 1, pointerEvents: 'none' }}
    >
      <path
        d="M0 8 Q6 0 16 3 Q26 -1 36 3 Q48 0 58 4 Q70 -1 82 3 Q94 0 104 4 Q116 -1 128 3 Q140 0 150 4 Q162 -1 174 3 Q186 0 200 6 L200 9 Q192 9 190 13 Q187 16 184 11 Q160 9 140 10 Q136 15 132 10 Q100 9 78 10 Q74 16 70 10 Q40 9 22 10 Q18 14 14 10 Q6 9 0 11 Z"
        fill="#ffffff"
      />
      <path d="M0 9 Q50 6 100 8 T200 8" stroke="#cfe3f7" strokeWidth="1.2" fill="none" opacity="0.8" />
    </svg>
  )
}

/** Raminho de azevinho no canto de cima, à esquerda. */
function Holly() {
  return (
    <svg
      viewBox="0 0 60 40"
      aria-hidden
      style={{ position: 'absolute', left: 'calc(-1 * clamp(10px, 1vw, 18px))', top: 'calc(-1 * clamp(12px, 1.2vw, 22px))', width: 'clamp(40px, 3.6vw, 68px)', zIndex: 2, pointerEvents: 'none' }}
    >
      <path d="M30 22 C22 10 10 12 2 6 C6 14 2 18 8 22 C4 26 10 30 14 28 C18 32 26 28 30 22 Z" fill="#1f9d55" stroke="#0e5a2f" strokeWidth="1.5" />
      <path d="M30 22 C38 10 50 12 58 6 C54 14 58 18 52 22 C56 26 50 30 46 28 C42 32 34 28 30 22 Z" fill="#26b864" stroke="#0e5a2f" strokeWidth="1.5" />
      <circle cx="26" cy="26" r="5" fill={XMAS_COLORS.red} />
      <circle cx="34" cy="26" r="5" fill="#d42a3c" />
      <circle cx="30" cy="20" r="5" fill="#ff4d5e" />
      <circle cx="28.5" cy="18.5" r="1.5" fill="#fff" opacity="0.7" />
    </svg>
  )
}

/** Laço vermelho no meio do topo, como presente embrulhado. */
function Bow() {
  return (
    <svg
      viewBox="0 0 80 44"
      aria-hidden
      style={{ position: 'absolute', left: '50%', top: 'calc(-1 * clamp(16px, 1.5vw, 26px))', width: 'clamp(50px, 4.4vw, 84px)', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none' }}
    >
      <path d="M36 22 L22 42 L28 42 L32 36 L36 42 Z" fill="#b3172a" />
      <path d="M44 22 L58 42 L52 42 L48 36 L44 42 Z" fill="#b3172a" />
      <path d="M38 20 C26 2 4 4 6 18 C8 30 28 28 38 22 Z" fill={XMAS_COLORS.red} stroke="#8f1020" strokeWidth="2" />
      <path d="M42 20 C54 2 76 4 74 18 C72 30 52 28 42 22 Z" fill={XMAS_COLORS.red} stroke="#8f1020" strokeWidth="2" />
      <path d="M14 14 C18 10 26 12 30 16" stroke="#ff9aa5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="34" y="14" width="12" height="13" rx="4" fill="#d42a3c" stroke="#8f1020" strokeWidth="2" />
    </svg>
  )
}
