import { useMemo } from 'react'
import { Box } from '@mui/material'
import { playerColor } from '../utils'
import { parseKey } from './rules'
import type { CacadaMap, Markers, StructureColor, StructureKind } from './types'
import { ANIMAL_COLORS, STRUCTURE_COLORS, TERRAIN_COLORS } from './types'

const R = 34 // raio do hexágono no espaço do SVG; a escala real vem do CSS
const SQRT3 = Math.sqrt(3)
const HEX_W = SQRT3 * R
const ROW_H = 1.5 * R
const PAD = 8

type HexMapProps = {
  map: CacadaMap
  markers: Markers
  /** Ordem dos jogadores: define o slot fixo de cada marcador no hexágono. */
  order: number[]
  selectedHex?: string | null
  onSelectHex?: (key: string) => void
  /** Hexágonos que a sua pista permite — contorno tracejado. */
  allowed?: Set<string>
  /** Revelado só no fim da caçada. */
  solution?: string | null
  /** Largura mínima em px: garante hexágonos clicáveis no celular. */
  minWidth?: number
}

function hexPoints(cx: number, cy: number, radius: number) {
  const points: string[] = []
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 90) * Math.PI) / 180
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

function centerOf(key: string) {
  const [col, row] = parseKey(key)
  return {
    cx: PAD + HEX_W * (col + 0.5 * (row & 1)) + HEX_W / 2,
    cy: PAD + ROW_H * row + R,
  }
}

/** Pedra erguida: um monólito. Cabana: telhado sobre a parede. */
function Structure({
  cx,
  cy,
  kind,
  color,
}: {
  cx: number
  cy: number
  kind: StructureKind
  color: StructureColor
}) {
  const fill = STRUCTURE_COLORS[color]
  const stroke = '#0a0a0f'

  if (kind === 'pedra') {
    return (
      <path
        d={`M ${cx - 5} ${cy + 9} L ${cx - 5} ${cy - 5} Q ${cx} ${cy - 12} ${cx + 5} ${cy - 5} L ${cx + 5} ${cy + 9} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    )
  }
  return (
    <path
      d={`M ${cx - 8} ${cy + 9} L ${cx - 8} ${cy - 1} L ${cx} ${cy - 10} L ${cx + 8} ${cy - 1} L ${cx + 8} ${cy + 9} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  )
}

export default function HexMap({
  map,
  markers,
  order,
  selectedHex,
  onSelectHex,
  allowed,
  solution,
  minWidth,
}: HexMapProps) {
  const width = PAD * 2 + HEX_W * (map.cols + 0.5)
  const height = PAD * 2 + ROW_H * (map.rows - 1) + 2 * R

  const keys = useMemo(() => Object.keys(map.hexes), [map.hexes])

  // Cada jogador ocupa sempre o mesmo canto do hexágono: depois de duas
  // rodadas dá para ler o tabuleiro sem conferir a legenda.
  const slotFor = useMemo(() => {
    const slots = new Map<number, { dx: number; dy: number }>()
    order.forEach((playerId, index) => {
      const angle = ((60 * index - 90) * Math.PI) / 180
      slots.set(playerId, {
        dx: R * 0.54 * Math.cos(angle),
        dy: R * 0.54 * Math.sin(angle),
      })
    })
    return slots
  }, [order])

  return (
    <Box
      sx={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        // Barra de rolagem discreta: em telas pequenas o mapa desliza em vez
        // de encolher os hexágonos até virarem impossíveis de acertar o dedo.
        '&::-webkit-scrollbar': { height: 6 },
      }}
    >
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Mapa da caçada"
        sx={{
          display: 'block',
          width: '100%',
          minWidth: minWidth ? `${minWidth}px` : undefined,
          height: 'auto',
        }}
      >
        <defs>
          <filter id="cacada-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {keys.map((key) => {
          const cell = map.hexes[key]
          const { cx, cy } = centerOf(key)
          const isSelected = selectedHex === key
          const isSolution = solution === key
          const isAllowed = allowed?.has(key) ?? false
          const owners = markers[key] ?? {}

          return (
            <g
              key={key}
              onClick={onSelectHex ? () => onSelectHex(key) : undefined}
              style={{ cursor: onSelectHex ? 'pointer' : 'default' }}
            >
              <polygon
                points={hexPoints(cx, cy, R - 1)}
                fill={TERRAIN_COLORS[cell.terrain]}
                stroke="rgba(10, 10, 15, 0.55)"
                strokeWidth={1.5}
              />

              {/* Território animal: anel interno na cor do bicho */}
              {cell.animal && (
                <polygon
                  points={hexPoints(cx, cy, R - 5)}
                  fill="none"
                  stroke={ANIMAL_COLORS[cell.animal]}
                  strokeWidth={3}
                  strokeDasharray={cell.animal === 'puma' ? '6 4' : undefined}
                  opacity={0.9}
                />
              )}

              {/* A sua pista permite este hexágono */}
              {isAllowed && (
                <polygon
                  points={hexPoints(cx, cy, R - 9)}
                  fill="rgba(255,255,255,0.16)"
                  stroke="none"
                />
              )}

              {cell.structure && (
                <Structure
                  cx={cx}
                  cy={cy}
                  kind={cell.structure.kind}
                  color={cell.structure.color}
                />
              )}

              {/* Marcadores: círculo = sim, quadrado = não */}
              {Object.entries(owners).map(([playerIdText, kind]) => {
                const playerId = Number(playerIdText)
                const slot = slotFor.get(playerId)
                if (!slot) return null
                const color = playerColor(playerId)
                const mx = cx + slot.dx
                const my = cy + slot.dy
                const size = R * 0.26

                return kind === 'disc' ? (
                  <circle
                    key={playerIdText}
                    cx={mx}
                    cy={my}
                    r={size}
                    fill={color}
                    stroke="#0a0a0f"
                    strokeWidth={1.5}
                  />
                ) : (
                  <rect
                    key={playerIdText}
                    x={mx - size}
                    y={my - size}
                    width={size * 2}
                    height={size * 2}
                    rx={1.5}
                    fill="#0a0a0f"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                )
              })}

              {isSelected && (
                <polygon
                  points={hexPoints(cx, cy, R - 2)}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={3.5}
                  filter="url(#cacada-glow)"
                />
              )}

              {isSolution && (
                <>
                  <polygon
                    points={hexPoints(cx, cy, R - 2)}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={4}
                    filter="url(#cacada-glow)"
                  />
                  <text
                    x={cx}
                    y={cy + 6}
                    textAnchor="middle"
                    fontSize={R * 0.8}
                    style={{ pointerEvents: 'none' }}
                  >
                    🐾
                  </text>
                </>
              )}
            </g>
          )
        })}
      </Box>
    </Box>
  )
}
