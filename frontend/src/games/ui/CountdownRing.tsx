import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { formatSeconds, useSmoothCountdown } from '../utils'

type CountdownRingProps = {
  /** Timestamp (em segundos) do fim da contagem. */
  deadlineTs?: number | null
  /** Duração total da fase, usada para preencher o anel. */
  totalSeconds: number
  accent?: string
  size?: number
  /** Rótulo abaixo do relógio. */
  label?: string
  /** Trava o anel em 00:00 (ex.: todos já jogaram). */
  frozen?: boolean
}

const URGENT_AT = 0.25

/**
 * Relógio circular da rodada. O anel esvazia em tempo real (rAF) e vira
 * vermelho pulsante no último quarto — dá pra sentir a pressão de longe.
 */
export default function CountdownRing({
  deadlineTs,
  totalSeconds,
  accent = 'var(--accent-gold)',
  size = 190,
  label = 'Tempo restante',
  frozen = false,
}: CountdownRingProps) {
  const remaining = useSmoothCountdown(frozen ? null : deadlineTs)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const seconds = frozen ? 0 : remaining
  const ratio = seconds === null ? 1 : Math.min(1, Math.max(0, seconds / Math.max(1, totalSeconds)))
  const urgent = seconds !== null && !frozen && ratio <= URGENT_AT && seconds > 0

  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ringColor = urgent ? 'var(--accent-red)' : accent

  // Pequeno "salto" a cada segundo cheio quando o tempo aperta.
  const lastWholeSecond = useRef<number | null>(null)
  useEffect(() => {
    if (!urgent || seconds === null) return
    const whole = Math.ceil(seconds)
    if (lastWholeSecond.current === whole) return
    lastWholeSecond.current = whole
    const node = wrapperRef.current
    if (!node) return
    node.classList.remove('animate-pop-in')
    // Reinicia a animação forçando reflow.
    void node.offsetWidth
    node.classList.add('animate-pop-in')
  }, [urgent, seconds])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box
        ref={wrapperRef}
        sx={{
          position: 'relative',
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Box
          component="svg"
          viewBox={`0 0 ${size} ${size}`}
          sx={{
            position: 'absolute',
            inset: 0,
            transform: 'rotate(-90deg)',
            filter: `drop-shadow(0 0 12px ${urgent ? 'rgba(220,38,38,0.55)' : 'rgba(0,0,0,0.5)'})`,
          }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            style={{ transition: 'stroke 300ms ease' }}
          />
        </Box>

        <Box sx={{ textAlign: 'center', zIndex: 1 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: size * 0.26,
              lineHeight: 1,
              color: urgent ? 'var(--accent-red)' : 'var(--text-primary)',
              textShadow: urgent ? '0 0 24px rgba(220,38,38,0.6)' : 'none',
              transition: 'color 300ms ease',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {seconds === null ? '--:--' : formatSeconds(Math.ceil(seconds))}
          </Typography>
        </Box>
      </Box>

      <Typography
        sx={{
          fontSize: '0.68rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 700,
        }}
      >
        {frozen ? 'Todos jogaram' : label}
      </Typography>
    </Box>
  )
}
