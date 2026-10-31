import { useId } from 'react'
import './spooky.css'

export type PumpkinFace = 'happy' | 'scary' | 'surprised' | 'dead'

type PumpkinSvgProps = {
  /** Largura em px. */
  size?: number
  face?: PumpkinFace
  /** Vela acesa dentro (rosto brilhando). */
  lit?: boolean
  /**
   * Pavio de bomba: 1 = inteiro, 0 = acabou (BUM). null/undefined = sem pavio,
   * só o cabinho.
   */
  fuse?: number | null
  /** Tremendo (a bomba vai estourar!). */
  shake?: boolean
  className?: string
}

/** Ponto e meia-curva do pavio (Bézier quadrática cortada em t, por de Casteljau). */
const P0 = { x: 52, y: 16 }
const P1 = { x: 66, y: 0 }
const P2 = { x: 80, y: -12 }

function fusePath(t: number) {
  const q1 = { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t }
  const r1 = { x: P1.x + (P2.x - P1.x) * t, y: P1.y + (P2.y - P1.y) * t }
  const end = { x: q1.x + (r1.x - q1.x) * t, y: q1.y + (r1.y - q1.y) * t }
  return { d: `M${P0.x} ${P0.y} Q${q1.x.toFixed(2)} ${q1.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`, end }
}

function Face({ face, fill }: { face: PumpkinFace; fill: string }) {
  switch (face) {
    case 'happy':
      return (
        <g fill={fill}>
          <path d="M30 50 L38 38 L46 50 Z" />
          <path d="M54 50 L62 38 L70 50 Z" />
          <path d="M26 62 Q50 88 74 62 L68 64 L64 70 L58 66 L50 72 L42 66 L36 70 L32 64 Z" />
        </g>
      )
    case 'scary':
      return (
        <g fill={fill}>
          <path d="M28 44 L46 50 L34 54 Z" />
          <path d="M72 44 L54 50 L66 54 Z" />
          <path d="M24 62 L32 70 L38 63 L44 72 L50 64 L56 72 L62 63 L68 70 L76 62 L70 80 L62 74 L56 82 L50 76 L44 82 L38 74 L30 80 Z" />
        </g>
      )
    case 'surprised':
      return (
        <g fill={fill}>
          <ellipse cx="38" cy="46" rx="6" ry="8" />
          <ellipse cx="62" cy="46" rx="6" ry="8" />
          <ellipse cx="50" cy="70" rx="8" ry="10" />
        </g>
      )
    case 'dead':
      return (
        <g stroke={fill} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d="M32 40 L44 52 M44 40 L32 52" />
          <path d="M56 40 L68 52 M68 40 L56 52" />
          <path d="M34 70 L66 70" />
        </g>
      )
  }
}

/**
 * Abóbora de Halloween com rosto e, se quiser, pavio de bomba animável.
 *
 *   <PumpkinSvg size={160} face="scary" />
 *   <PumpkinSvg size={220} fuse={remaining / total} shake={remaining < 5000} />
 */
export default function PumpkinSvg({
  size = 120,
  face = 'happy',
  lit = true,
  fuse,
  shake = false,
  className,
}: PumpkinSvgProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const hasFuse = typeof fuse === 'number'
  const burning = hasFuse && fuse > 0
  const fuseShape = burning ? fusePath(Math.min(1, Math.max(0.02, fuse))) : null
  const faceFill = lit ? `url(#${id}-light)` : '#2a1205'

  return (
    <svg
      className={[shake ? 'hw-shake' : '', className ?? ''].join(' ').trim() || undefined}
      width={size}
      height={(size * 124) / 100}
      viewBox="0 -24 100 124"
      // O brilho da vela passa da borda: sem isso ele sai cortado reto embaixo.
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffb054" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
        <radialGradient id={`${id}-light`} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#fff7c2" />
          <stop offset="60%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
        </radialGradient>
      </defs>

      {lit && <circle className="hw-glow" cx="50" cy="60" r="50" fill={`url(#${id}-halo)`} />}

      {/* Gomos, de trás para a frente */}
      <g stroke="#7c2d12" strokeWidth={1.2}>
        <ellipse cx="22" cy="62" rx="18" ry="28" fill={`url(#${id}-skin)`} />
        <ellipse cx="78" cy="62" rx="18" ry="28" fill={`url(#${id}-skin)`} />
        <ellipse cx="35" cy="61" rx="21" ry="31" fill={`url(#${id}-skin)`} />
        <ellipse cx="65" cy="61" rx="21" ry="31" fill={`url(#${id}-skin)`} />
        <ellipse cx="50" cy="60" rx="20" ry="32" fill={`url(#${id}-skin)`} />
      </g>

      {/* Cabinho */}
      <path d="M46 31 C46 24 48 19 52 15 C55 18 55 24 54 31 Z" fill="#4d7c0f" stroke="#365314" strokeWidth={1} />

      {fuseShape && (
        <>
          <path d={fuseShape.d} stroke="#3f2a1d" strokeWidth={3} fill="none" strokeLinecap="round" />
          <g transform={`translate(${fuseShape.end.x} ${fuseShape.end.y})`}>
            <g className="hw-spark">
              <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#fde047" />
              <circle r="2.4" fill="#fff7ed" />
            </g>
          </g>
        </>
      )}

      <Face face={face} fill={faceFill} />
    </svg>
  )
}
