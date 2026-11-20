import { Box } from '@mui/material'

type FuseRopeProps = {
  /** Quanto do pavio sobra (0..1). */
  fraction: number
  /** Queimando agora: a ponta solta faísca de estrelinha. */
  burning?: boolean
  width?: number | string
  /** Grossura da corda em px. */
  height?: number
  /** Cor da listra do pavio que sobra (a outra listra é creme, de bengala doce). */
  color?: string
}

/**
 * Pavio de bengala doce: a parte que sobra é listrada (vermelho e creme), a
 * que queimou vira gelo apagado. Queimando, a ponta solta faíscas de
 * estrelinha de Ano-Novo.
 *
 *   <FuseRope fraction={0.6} burning width={160} />
 */
export default function FuseRope({ fraction, burning = false, width = 140, height = 12, color = '#ff4057' }: FuseRopeProps) {
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
        background: 'repeating-linear-gradient(135deg, rgba(150, 175, 210, 0.35) 0 6px, rgba(90, 110, 140, 0.35) 6px 10px)',
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
          background: `repeating-linear-gradient(135deg, ${color} 0 6px, #fff6dc 6px 10px)`,
          boxShadow: burning ? '0 0 14px rgba(255, 217, 117, 0.9)' : 'none',
          transition: burning ? 'none' : 'width 400ms ease',
        }}
      />
      {burning && pct > 0 && (
        <Box
          sx={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            width: height * 2.6,
            height: height * 2.6,
            transform: 'translate(-50%, -50%)',
            // Estrelinha de 4 pontas girando e piscando.
            background:
              'radial-gradient(circle, #ffffff 0%, #fff3b0 22%, rgba(255, 209, 102, 0.75) 42%, transparent 66%)',
            clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)',
            animation: 'abbSpark 0.24s steps(2) infinite',
            '@keyframes abbSpark': {
              from: { transform: 'translate(-50%, -50%) scale(0.85) rotate(0deg)' },
              to: { transform: 'translate(-50%, -50%) scale(1.3) rotate(45deg)' },
            },
          }}
        />
      )}
    </Box>
  )
}
