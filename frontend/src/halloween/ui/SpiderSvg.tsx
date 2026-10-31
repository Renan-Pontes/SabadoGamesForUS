import './spooky.css'

type SpiderSvgProps = {
  /** Largura em px (a altura acompanha). */
  size?: number
  /** Comprimento do fio acima da aranha, em px (0 = sem fio). */
  thread?: number
  /** Patinhas mexendo. */
  wiggle?: boolean
  className?: string
}

const LEGS = [
  'M20 22 Q10 14 4 18',
  'M20 24 Q8 22 2 28',
  'M20 26 Q9 30 4 38',
  'M20 28 Q12 36 9 44',
]

/**
 * Aranha preta de olhos vermelhos, opcionalmente pendurada num fio.
 *
 *   <SpiderSvg size={48} thread={120} wiggle />
 */
export default function SpiderSvg({ size = 40, thread = 0, wiggle = false, className }: SpiderSvgProps) {
  const height = (size * 52) / 40 + thread
  return (
    <svg
      className={className}
      width={size}
      height={height}
      viewBox={`0 ${-thread * (40 / size)} 40 ${52 + thread * (40 / size)}`}
      aria-hidden
    >
      {thread > 0 && (
        <line
          x1="20"
          y1={-thread * (40 / size)}
          x2="20"
          y2="16"
          stroke="rgba(230, 230, 240, 0.55)"
          strokeWidth={0.8}
        />
      )}
      <g className={wiggle ? 'hw-shake' : undefined} style={{ transformOrigin: '20px 26px' }}>
        <g stroke="#0d0812" strokeWidth={2} fill="none" strokeLinecap="round">
          {LEGS.map((d) => (
            <path key={d} d={d} />
          ))}
          <g transform="translate(40 0) scale(-1 1)">
            {LEGS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </g>
        <ellipse cx="20" cy="32" rx="9" ry="11" fill="#140c1c" stroke="rgba(255,122,24,0.35)" strokeWidth={0.8} />
        <circle cx="20" cy="20" r="6" fill="#1b1124" />
        <circle cx="17.6" cy="19" r="1.6" fill="#ef4444" />
        <circle cx="22.4" cy="19" r="1.6" fill="#ef4444" />
      </g>
    </svg>
  )
}
