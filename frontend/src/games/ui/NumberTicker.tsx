import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { prefersReducedMotion } from '../utils'

type NumberTickerProps = {
  value: number
  /** Duração da contagem em ms. */
  duration?: number
  /** Pinta de verde/vermelho por um instante quando o número muda. */
  flash?: boolean
}

/**
 * Número que conta até o valor novo em vez de trocar de uma vez.
 *
 * Num placar de festa isso importa: dá tempo da mesa ver que alguém pontuou,
 * em vez do número simplesmente ser outro na próxima atualização.
 */
export default function NumberTicker({ value, duration = 650, flash = true }: NumberTickerProps) {
  const [shown, setShown] = useState(value)
  const [delta, setDelta] = useState(0)
  const fromRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return

    setDelta(value - from)
    fromRef.current = value

    if (prefersReducedMotion()) {
      setShown(value)
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutCubic: começa rápido e assenta no valor final.
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(step)
      }
    }
    frameRef.current = window.requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  // O brilho da mudança some sozinho.
  useEffect(() => {
    if (!delta) return
    const timer = window.setTimeout(() => setDelta(0), duration + 500)
    return () => window.clearTimeout(timer)
  }, [delta, duration])

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 400ms ease, transform 400ms ease',
        ...(flash &&
          delta !== 0 && {
            color: delta > 0 ? 'var(--status-ready)' : 'var(--accent-red)',
            transform: 'scale(1.14)',
          }),
      }}
    >
      {shown}
    </Box>
  )
}
