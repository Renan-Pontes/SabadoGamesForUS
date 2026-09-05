import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Box } from '@mui/material'

export const BOARD_W = 1000
export const BOARD_H = 625

export type BoardStroke = { points: number[][]; color: string; width?: number }

type DrawingBoardProps = {
  strokes: BoardStroke[]
  /** Traço em andamento, ainda não enviado. */
  draft?: number[][]
  draftColor?: string
  draftWidth?: number
  interactive?: boolean
  accent?: string
  maxPoints?: number
  onDraftChange?: (points: number[][]) => void
  /** Chamado quando o dedo levanta: bom para enviar traço a traço. */
  onStrokeEnd?: (points: number[][]) => void
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function toPath(points: number[][]) {
  return points.map(([x, y]) => `${(x * BOARD_W).toFixed(1)},${(y * BOARD_H).toFixed(1)}`).join(' ')
}

/**
 * Prancheta compartilhada: os traços chegam do servidor em coordenadas
 * normalizadas (0..1), então o mesmo desenho cabe na TV e no celular.
 */
export default function DrawingBoard({
  strokes,
  draft = [],
  draftColor = '#111',
  draftWidth = 7,
  interactive = false,
  accent = '#fff',
  maxPoints = 300,
  onDraftChange,
  onStrokeEnd,
}: DrawingBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)
  const pointsRef = useRef<number[][]>([])

  const normalize = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)]
  }

  const handleDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return
    event.preventDefault()
    svgRef.current?.setPointerCapture(event.pointerId)
    drawing.current = true
    const point = normalize(event)
    pointsRef.current = point ? [point] : []
    onDraftChange?.(pointsRef.current)
  }

  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const point = normalize(event)
    if (!point) return
    const last = pointsRef.current[pointsRef.current.length - 1]
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.004) return
    if (pointsRef.current.length >= maxPoints) return
    pointsRef.current = [...pointsRef.current, point]
    onDraftChange?.(pointsRef.current)
  }

  const handleUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    drawing.current = false
    try {
      svgRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // o navegador pode ja ter soltado o ponteiro
    }
    const points = pointsRef.current
    // Um toque sem arrastar vira um ponto: duplica para virar traço visível.
    const finished = points.length === 1 ? [points[0], points[0]] : points
    onDraftChange?.(finished)
    onStrokeEnd?.(finished)
  }

  return (
    <Box
      sx={{
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${interactive ? accent : 'rgba(255,255,255,0.1)'}`,
        background: '#fbf7ee',
        overflow: 'hidden',
        aspectRatio: '16 / 10',
        touchAction: 'none',
        boxShadow: interactive ? `0 0 30px ${accent}66` : '0 14px 34px rgba(0,0,0,0.4)',
        transition: 'border-color 260ms ease',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {strokes.map((stroke, index) => (
          <polyline
            key={index}
            points={toPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width ?? 7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {draft.length > 0 && (
          <polyline
            points={toPath(draft.length === 1 ? [draft[0], draft[0]] : draft)}
            fill="none"
            stroke={draftColor}
            strokeWidth={draftWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </Box>
  )
}
