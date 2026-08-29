import { useMemo } from 'react'
import { Box } from '@mui/material'
import { prefersReducedMotion } from '../utils'

const PIECES = 46
const COLORS = ['#fbbf24', '#dc2626', '#22d3ee', '#a855f7', '#4ade80', '#f472b6']
const SHAPES = ['♠', '♥', '♦', '♣', '★', '●']

/**
 * Dispersão determinística a partir do índice.
 *
 * Parece aleatório, mas é sempre igual — então a chuva não "pula" de lugar a
 * cada atualização de poll, e o componente continua puro.
 */
function scatter(index: number, salt: number) {
  const hashed = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return hashed - Math.floor(hashed)
}

/** Chuva de naipes na vitória. */
export default function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        id: index,
        left: scatter(index, 1) * 100,
        delay: scatter(index, 2) * 2.5,
        duration: 2.6 + scatter(index, 3) * 2.4,
        size: 12 + scatter(index, 4) * 20,
        drift: (scatter(index, 5) - 0.5) * 140,
        spin: (scatter(index, 6) - 0.5) * 720,
        color: COLORS[index % COLORS.length],
        shape: SHAPES[index % SHAPES.length],
      })),
    [],
  )

  if (prefersReducedMotion()) return null

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 60,
      }}
    >
      {pieces.map((piece) => (
        <Box
          key={piece.id}
          component="span"
          style={
            {
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as React.CSSProperties
          }
          sx={{
            position: 'absolute',
            top: -40,
            left: `${piece.left}%`,
            fontSize: piece.size,
            lineHeight: 1,
            color: piece.color,
            opacity: 0,
            animation: `confettiFall ${piece.duration}s linear ${piece.delay}s infinite`,
            textShadow: `0 0 10px ${piece.color}66`,
          }}
        >
          {piece.shape}
        </Box>
      ))}
    </Box>
  )
}
