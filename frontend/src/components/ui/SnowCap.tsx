import { Box } from '@mui/material'

type SnowCapProps = {
  /** Altura da camada de neve, em px. */
  height?: number
  opacity?: number
}

/**
 * Neve acumulada na borda de cima de um card: uma faixa branca ondulada com
 * gotinhas pingando. Só decoração (não recebe clique). O pai precisa de
 * `position: relative` e `overflow: hidden`.
 *
 * Substitui a teia de canto da Noite do Terror.
 */
export default function SnowCap({ height = 14, opacity = 0.92 }: SnowCapProps) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 1.8,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        opacity,
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25))',
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 200 24"
        preserveAspectRatio="none"
        sx={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="snowcap-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dbe9fb" />
          </linearGradient>
        </defs>
        {/* Monte de neve com pingos (um mais comprido aqui e ali) */}
        <path
          d="M0 0 H200 V9 C194 9 192 12 188 12 C184 12 183 9 176 9 C170 9 169 17 165 17 C161 17 162 10 154 10 C146 10 146 13 138 13 C130 13 131 9 122 9 C114 9 115 14 108 14 C101 14 102 21 98 21 C94 21 95 11 88 11 C80 11 80 13 72 13 C64 13 65 9 56 9 C49 9 49 15 44 15 C39 15 40 10 32 10 C24 10 25 13 17 13 C10 13 9 9 0 9 Z"
          fill="url(#snowcap-fill)"
        />
      </Box>
    </Box>
  )
}
