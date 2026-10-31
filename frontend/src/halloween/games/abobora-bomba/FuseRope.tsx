import { Box } from '@mui/material'

type FuseRopeProps = {
  /** Quanto do pavio sobra (0..1). */
  fraction: number
  /** Queimando agora: a ponta solta faísca. */
  burning?: boolean
  width?: number | string
  /** Grossura da corda em px. */
  height?: number
  /** Cor da corda que sobra. */
  color?: string
}

/**
 * Pavio em forma de corda trançada: a parte que sobra é laranja, a que
 * queimou vira cinza. Queimando, a ponta solta faíscas.
 *
 *   <FuseRope fraction={0.6} burning width={160} />
 */
export default function FuseRope({ fraction, burning = false, width = 140, height = 12, color = '#ff7b1c' }: FuseRopeProps) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width,
        height,
        flexShrink: 0,
        borderRadius: `${height}px`,
        background: 'repeating-linear-gradient(135deg, rgba(120, 110, 130, 0.45) 0 6px, rgba(70, 64, 80, 0.45) 6px 9px)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          borderRadius: `${height}px`,
          background: `repeating-linear-gradient(135deg, ${color} 0 6px, #c2410c 6px 9px)`,
          boxShadow: burning ? '0 0 14px rgba(255, 170, 60, 0.85)' : 'none',
          transition: burning ? 'none' : 'width 400ms ease',
        }}
      />
      {burning && pct > 0 && (
        <Box
          sx={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            width: height * 2.4,
            height: height * 2.4,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle, #fff7c2 0%, #fde047 30%, rgba(249, 115, 22, 0.65) 55%, transparent 72%)',
            animation: 'abbSpark 0.24s steps(2) infinite',
            '@keyframes abbSpark': {
              from: { transform: 'translate(-50%, -50%) scale(0.8) rotate(0deg)' },
              to: { transform: 'translate(-50%, -50%) scale(1.25) rotate(45deg)' },
            },
          }}
        />
      )}
    </Box>
  )
}
