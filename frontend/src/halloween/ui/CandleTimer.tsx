import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { SPOOKY_COLORS } from './fonts'
import './spooky.css'

type CandleTimerProps = {
  /** Fim do prazo em ms do relógio do servidor. null = sem prazo (vela inteira, sem número). */
  deadline: number | null
  /** Duração total do prazo em ms (a vela cheia). */
  total: number
  /** Relógio do servidor em ms — o `now()` que o jogo recebe nas props. */
  now: () => number
  /** Altura do desenho em px (o número vem embaixo). */
  size?: number
  label?: ReactNode
  showSeconds?: boolean
  /** Fração do tempo a partir da qual a vela entra em pânico (padrão: último quarto). */
  urgentAt?: number
  /** Cor da cera. */
  wax?: string
}

/** ~10 quadros por segundo: suave para a cera, barato para a TV. */
const TICK_MS = 100
const MAX_HEIGHT = 170
const BASE_Y = 236

/**
 * Cronômetro em forma de vela: a cera derrete até o prazo; no último quarto
 * a chama fica vermelha e nervosa; no fim, apaga e solta fumaça.
 *
 *   <CandleTimer deadline={state.deadline} total={30_000} now={now} size={260} label="para votar" />
 */
export default function CandleTimer({
  deadline,
  total,
  now,
  size = 220,
  label,
  showSeconds = true,
  urgentAt = 0.25,
  wax = SPOOKY_COLORS.bone,
}: CandleTimerProps) {
  const [, setFrame] = useState(0)
  const nowRef = useRef(now)
  const rawId = useId()
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => {
    nowRef.current = now
  }, [now])

  useEffect(() => {
    if (deadline === null) return
    let frame = 0
    let last = 0
    const loop = (timestamp: number) => {
      if (timestamp - last >= TICK_MS) {
        last = timestamp
        setFrame((value) => (value + 1) % 1_000_000)
      }
      // Vela apagada há um tempo: para de redesenhar.
      if (deadline - nowRef.current() > -1500) frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [deadline])

  const remaining = deadline === null ? total : Math.max(0, deadline - now())
  const fraction = total > 0 ? Math.min(1, remaining / total) : 0
  const out = deadline !== null && remaining <= 0
  const urgent = deadline !== null && !out && fraction <= urgentAt
  const seconds = Math.ceil(remaining / 1000)

  const height = Math.max(8, MAX_HEIGHT * fraction)
  const top = BASE_Y - height
  const dripA = Math.min(34, height * 0.45)
  const dripB = Math.min(20, height * 0.3)
  const flameScale = urgent ? 1.25 : 1
  const flameColors = urgent ? ['#fff1f2', '#f87171', '#dc2626'] : ['#fffbeb', '#fbbf24', '#f97316']

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <svg width={(size * 120) / 260} height={size} viewBox="0 0 120 260" aria-hidden>
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0%" stopColor={urgent ? '#f87171' : '#fde68a'} stopOpacity={0.75} />
            <stop offset="100%" stopColor={urgent ? '#dc2626' : '#f59e0b'} stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={flameColors[0]} />
            <stop offset="45%" stopColor={flameColors[1]} />
            <stop offset="100%" stopColor={flameColors[2]} />
          </linearGradient>
          <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={wax} stopOpacity={0.75} />
            <stop offset="45%" stopColor={wax} />
            <stop offset="100%" stopColor={wax} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b5a3a" />
            <stop offset="100%" stopColor="#2a2016" />
          </linearGradient>
        </defs>

        {/* Prato */}
        <ellipse cx="60" cy="244" rx="52" ry="11" fill={`url(#${id}-plate)`} />
        <ellipse cx="60" cy="238" rx="32" ry="7" fill="#3a2e1f" />

        {/* Cera */}
        <rect x="38" y={top} width="44" height={height} rx="3" fill={`url(#${id}-wax)`} />
        <path
          d={`M41 ${top} v ${dripA} a3 3 0 0 0 6 0 v ${-dripA} Z M70 ${top} v ${dripB} a2.5 2.5 0 0 0 5 0 v ${-dripB} Z`}
          fill={wax}
          opacity={0.92}
        />
        <ellipse cx="60" cy={top} rx="22" ry="5" fill={wax} />
        <ellipse cx="60" cy={top} rx="16" ry="3" fill="rgba(0,0,0,0.12)" />

        {/* Pavio */}
        <line x1="60" y1={top - 1} x2="60" y2={top - 11} stroke="#1f1a17" strokeWidth={2.2} strokeLinecap="round" />

        {!out && (
          <g transform={`translate(60 ${top - 10}) scale(${flameScale})`}>
            <circle className="hw-glow" cx="0" cy="-16" r="30" fill={`url(#${id}-glow)`} />
            <g className={urgent ? 'hw-flame hw-flame--urgent' : 'hw-flame'}>
              <path d="M0 0 C -8 -8 -9 -19 0 -36 C 9 -19 8 -8 0 0 Z" fill={`url(#${id}-flame)`} />
              <path d="M0 -2 C -3.5 -6 -4 -12 0 -20 C 4 -12 3.5 -6 0 -2 Z" fill="#fffbeb" opacity={0.9} />
            </g>
          </g>
        )}
        {out && (
          <g transform={`translate(60 ${top - 12})`}>
            <path
              className="hw-smoke"
              d="M0 0 C -6 -8 6 -14 0 -22 C -6 -30 6 -36 0 -44"
              stroke="rgba(200, 200, 210, 0.6)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      {showSeconds && deadline !== null && (
        <Typography
          className={urgent ? 'hw-pulse' : undefined}
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: Math.max(22, size * 0.2),
            lineHeight: 1,
            color: urgent || out ? SPOOKY_COLORS.blood : SPOOKY_COLORS.candle,
            textShadow: urgent ? '0 0 18px rgba(220,38,38,0.6)' : '0 0 14px rgba(251,191,36,0.35)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {out ? '0' : seconds}
        </Typography>
      )}
      {label && (
        <Typography
          sx={{
            fontSize: Math.max(12, size * 0.065),
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  )
}
