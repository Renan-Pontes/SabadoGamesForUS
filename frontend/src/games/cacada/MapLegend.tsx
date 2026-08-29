import { Box, Typography } from '@mui/material'
import type { Terrain } from './types'
import {
  ANIMAL_COLORS,
  ANIMAL_LABELS,
  STRUCTURE_COLOR_LABELS,
  STRUCTURE_COLORS,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
} from './types'

const TERRAINS: Terrain[] = ['deserto', 'floresta', 'pantano', 'montanha', 'agua']

/** Legenda do mapa. Sem ela, roxo-é-pântano é adivinhação. */
export default function MapLegend({ compact = false }: { compact?: boolean }) {
  const chip = compact ? 14 : 18
  const font = compact ? '0.68rem' : '0.78rem'

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 1.25 : 2, alignItems: 'center' }}>
      {TERRAINS.map((terrain) => (
        <Box key={terrain} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box
            sx={{
              width: chip,
              height: chip,
              borderRadius: '3px',
              background: TERRAIN_COLORS[terrain],
              border: '1px solid rgba(0,0,0,0.4)',
            }}
          />
          <Typography sx={{ fontSize: font, color: 'var(--text-secondary)' }}>
            {TERRAIN_LABELS[terrain]}
          </Typography>
        </Box>
      ))}

      <Box sx={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

      {(['urso', 'puma'] as const).map((animal) => (
        <Box key={animal} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box
            sx={{
              width: chip,
              height: chip,
              borderRadius: '50%',
              border: `3px ${animal === 'puma' ? 'dashed' : 'solid'} ${ANIMAL_COLORS[animal]}`,
            }}
          />
          <Typography sx={{ fontSize: font, color: 'var(--text-secondary)' }}>
            {ANIMAL_LABELS[animal]}
          </Typography>
        </Box>
      ))}

      <Box sx={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

      {(['verde', 'branca', 'azul'] as const).map((color) => (
        <Box key={color} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <Box
            component="svg"
            viewBox="0 0 20 20"
            sx={{ width: chip + 4, height: chip + 4 }}
            aria-hidden
          >
            <path
              d="M 4 16 L 4 8 Q 7 3 10 8 L 10 16 Z"
              fill={STRUCTURE_COLORS[color]}
              stroke="#0a0a0f"
              strokeWidth={1.4}
            />
            <path
              d="M 11 16 L 11 10 L 15 6 L 19 10 L 19 16 Z"
              fill={STRUCTURE_COLORS[color]}
              stroke="#0a0a0f"
              strokeWidth={1.4}
            />
          </Box>
          <Typography sx={{ fontSize: font, color: 'var(--text-secondary)' }}>
            {STRUCTURE_COLOR_LABELS[color]}
          </Typography>
        </Box>
      ))}

      <Box sx={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box
          sx={{ width: chip - 4, height: chip - 4, borderRadius: '50%', background: '#f8fafc' }}
        />
        <Typography sx={{ fontSize: font, color: 'var(--text-secondary)' }}>
          pode estar
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
        <Box
          sx={{
            width: chip - 4,
            height: chip - 4,
            borderRadius: '2px',
            background: '#0a0a0f',
            border: '2px solid #f8fafc',
          }}
        />
        <Typography sx={{ fontSize: font, color: 'var(--text-secondary)' }}>
          não pode
        </Typography>
      </Box>
    </Box>
  )
}
