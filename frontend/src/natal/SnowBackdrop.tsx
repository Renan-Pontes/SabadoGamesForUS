import type { CSSProperties } from 'react'
import { scatter } from '../halloween/ui/motion'
import './natal.css'

export type SnowIntensity = 'tv' | 'phone' | 'subtle'
export type SnowLayer = 'back' | 'front' | 'all'

type SnowBackdropProps = {
  /** Quanto cenário: 'tv' (cheio), 'phone' (leve) ou 'subtle' (quase nada). */
  intensity?: SnowIntensity
  /**
   * 'back' fica atrás do conteúdo (céu, aurora, estrelas, neve, morros, trenó,
   * varal de pisca-pisca); 'front' por cima, sem atrapalhar (vinheta e alguns
   * flocos grandes); 'all' = tudo junto.
   */
  layer?: SnowLayer
  /** 'fixed' cobre a tela; 'absolute' preenche o pai (que precisa ser position: relative). */
  position?: 'fixed' | 'absolute'
  zIndex?: number
}

type Config = {
  aurora: number
  stars: number
  guide: boolean
  flakes: number
  crystals: number
  hills: string | null
  sleigh: boolean
  bulbs: number
  swags: number
  vignette: number
  frontFlakes: number
}

const CONFIG: Record<SnowIntensity, Config> = {
  // Morros baixos: as telas de jogo usam a TV inteira e o texto de baixo ficava em cima dos pinheiros.
  tv: { aurora: 2, stars: 42, guide: true, flakes: 70, crystals: 10, hills: '15vh', sleigh: true, bulbs: 30, swags: 5, vignette: 0.45, frontFlakes: 6 },
  phone: { aurora: 1, stars: 18, guide: true, flakes: 28, crystals: 4, hills: '12vh', sleigh: false, bulbs: 12, swags: 2, vignette: 0.3, frontFlakes: 0 },
  subtle: { aurora: 0, stars: 10, guide: false, flakes: 14, crystals: 2, hills: null, sleigh: false, bulbs: 0, swags: 1, vignette: 0.2, frontFlakes: 0 },
}

const BULB_COLORS = ['#ff4d5e', '#f5c242', '#4fd67e', '#5ab4ff', '#ff8fd0']

/** Pinheiro: três "saias" e a estrela no topo. Desenhado em volta de (0,0) na base. */
function Pine({ x, y, scale, index }: { x: number; y: number; scale: number; index: number }) {
  const bulbs = [
    [-14, -22], [10, -30], [-6, -44], [12, -52], [-10, -62], [4, -74],
  ]
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="-6" width="8" height="10" fill="#4a2c1a" />
      <path d="M-30 -4 L0 -40 L30 -4 Z" fill="#14603a" />
      <path d="M-24 -30 L0 -64 L24 -30 Z" fill="#187a47" />
      <path d="M-17 -56 L0 -88 L17 -56 Z" fill="#1f9d55" />
      {/* Neve nas pontas */}
      <path d="M-30 -4 Q-20 -10 -12 -6 Q-2 -12 8 -6 Q18 -11 30 -4 Z" fill="#eef6ff" opacity="0.9" />
      {bulbs.map(([bx, by], bulbIndex) => (
        <circle
          key={bulbIndex}
          className="xm-bulb-tree"
          cx={bx}
          cy={by}
          r="2.6"
          fill={BULB_COLORS[(index + bulbIndex) % BULB_COLORS.length]}
          style={{ animationDelay: `${-scatter(index * 7 + bulbIndex, 9) * 1.6}s` }}
        />
      ))}
      <path
        d="M0 -98 L2.6 -92 L9 -92 L4 -88 L6 -82 L0 -86 L-6 -82 L-4 -88 L-9 -92 L-2.6 -92 Z"
        fill="#f5c242"
        className="xm-bulb-tree"
      />
    </g>
  )
}

function Hills() {
  const pines = [
    { x: 70, y: 150, scale: 0.9 },
    { x: 160, y: 162, scale: 0.65 },
    { x: 300, y: 140, scale: 1.05 },
    { x: 360, y: 150, scale: 0.7 },
    { x: 640, y: 150, scale: 0.8 },
    { x: 760, y: 138, scale: 1.1 },
    { x: 840, y: 158, scale: 0.7 },
    { x: 940, y: 148, scale: 0.95 },
  ]
  return (
    <svg className="xm-hills" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="xm-hill-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bcd4f0" />
          <stop offset="100%" stopColor="#7f9fc6" />
        </linearGradient>
        <linearGradient id="xm-hill-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d6e6f7" />
        </linearGradient>
      </defs>
      <path d="M0 140 Q150 90 300 125 T620 118 T1000 110 V200 H0 Z" fill="url(#xm-hill-back)" opacity="0.55" />
      {pines.slice(0, 4).map((pine, index) => (
        <Pine key={index} {...pine} index={index} />
      ))}
      <path d="M0 170 Q200 130 420 160 T820 150 T1000 158 V200 H0 Z" fill="url(#xm-hill-front)" opacity="0.92" />
      {pines.slice(4).map((pine, index) => (
        <Pine key={index + 4} {...pine} index={index + 4} />
      ))}
      {/* Casinha com janela acesa e fumaça */}
      <g transform="translate(520 168)">
        <rect x="-26" y="-30" width="52" height="30" fill="#7a3a2a" />
        <path d="M-32 -28 L0 -54 L32 -28 Z" fill="#9e1424" />
        <path d="M-32 -28 L0 -54 L32 -28 L26 -28 L0 -48 L-26 -28 Z" fill="#ffffff" opacity="0.9" />
        <rect x="-14" y="-22" width="12" height="11" fill="#ffd975" className="xm-bulb-tree" />
        <rect x="6" y="-18" width="10" height="18" fill="#3b1d12" />
        <rect x="14" y="-54" width="7" height="14" fill="#5a2a1a" />
      </g>
    </svg>
  )
}

function Sleigh() {
  return (
    <svg className="xm-sleigh" viewBox="0 0 260 70" aria-hidden>
      {/* Rastro de pó mágico */}
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <circle
          key={index}
          className="xm-sleigh-dust"
          cx={232 + index * 5}
          cy={48 + (index % 2) * 6}
          r={2.4 - index * 0.3}
          fill="#ffd975"
          style={{ animationDelay: `${index * 0.1}s` }}
        />
      ))}
      <g fill="#fff6dc">
        {/* Trenó */}
        <path d="M150 30 L205 30 Q214 30 214 40 L214 50 L158 50 Q150 50 150 42 Z" />
        <path d="M146 56 L222 56 Q230 56 230 48" stroke="#fff6dc" strokeWidth="3" fill="none" />
        <circle cx="186" cy="24" r="7" />
        {/* Gorro e saco */}
        <path d="M181 18 L188 6 L194 18 Z" fill="#ff4d5e" />
        <circle cx="203" cy="26" r="9" />
        {/* Rédeas */}
        <path d="M150 36 L108 32 L58 30" stroke="#fff6dc" strokeWidth="1.2" fill="none" />
        {/* Renas */}
        {[100, 50].map((x, index) => (
          <g key={x} transform={`translate(${x} ${22 + index * 2})`}>
            <path d="M0 10 Q10 4 24 8 L28 4 L30 0 L32 6 L30 12 L26 16 L22 22 L24 30 L20 30 L18 22 L8 20 L6 30 L2 30 L4 20 Q-4 18 0 10 Z" />
            <path d="M28 2 L26 -6 M28 2 L33 -5 M26 -6 L22 -8 M33 -5 L36 -8" stroke="#fff6dc" strokeWidth="1.6" fill="none" />
          </g>
        ))}
        {/* Nariz vermelho da rena da frente */}
        <circle cx="83" cy="25" r="2.4" fill="#ff4d5e" className="xm-sleigh-dust" />
      </g>
    </svg>
  )
}

/** Varal de pisca-pisca: fio em curvas e lâmpadas acendendo em onda. */
function Garland({ bulbs, swags }: { bulbs: number; swags: number }) {
  const sag = 26
  const points = Array.from({ length: bulbs }, (_, index) => {
    const x = ((index + 0.5) / bulbs) * 100
    const within = ((x / 100) * swags) % 1
    return { x, y: 6 + Math.sin(Math.PI * within) * sag }
  })
  const wire = Array.from({ length: swags }, (_, index) => {
    const x0 = (index / swags) * 1000
    const x1 = ((index + 1) / swags) * 1000
    return `M${x0} 6 Q${(x0 + x1) / 2} ${6 + sag * 2} ${x1} 6`
  }).join(' ')
  return (
    <div className="xm-garland" aria-hidden>
      <svg viewBox="0 0 1000 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d={wire} stroke="#1b3a2a" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((point, index) => {
        const color = BULB_COLORS[index % BULB_COLORS.length]
        return (
          <svg
            key={index}
            viewBox="0 0 12 20"
            style={{
              position: 'absolute',
              left: `calc(${point.x}% - 6px)`,
              top: point.y,
              width: 12,
              height: 20,
              overflow: 'visible',
              color,
            }}
          >
            <rect x="3.5" y="0" width="5" height="5" rx="1" fill="#2b3b33" />
            <ellipse
              className="xm-bulb"
              cx="6"
              cy="12"
              rx="5"
              ry="7"
              fill={color}
              style={
                {
                  '--xm-bulb-delay': `${(index % 5) * 0.36}s`,
                  '--xm-bulb-dur': `${1.6 + (index % 3) * 0.3}s`,
                } as CSSProperties
              }
            />
            <ellipse cx="4.4" cy="9.5" rx="1.4" ry="2.4" fill="#ffffff" opacity="0.6" />
          </svg>
        )
      })}
    </div>
  )
}

function Flake({ index, crystal, front = false }: { index: number; crystal: boolean; front?: boolean }) {
  const depth = scatter(index, 3)
  const size = front ? 26 + depth * 18 : crystal ? 14 + depth * 14 : 3 + depth * 6
  const style = {
    '--xm-x': `${scatter(index, 1) * 100}%`,
    '--xm-size': `${size}px`,
    // Os maiores (mais perto) caem mais rápido; os pequenos ficam no fundo.
    '--xm-dur': `${(front ? 9 : 16) - depth * (front ? 3 : 8) + scatter(index, 5) * 3}s`,
    '--xm-delay': `${-scatter(index, 4) * 20}s`,
    '--xm-sway': `${10 + scatter(index, 6) * 30}px`,
    '--xm-sway-dur': `${3 + scatter(index, 7) * 3}s`,
    '--xm-spin': `${6 + scatter(index, 8) * 8}s`,
    '--xm-alpha': front ? 0.55 : 0.45 + depth * 0.5,
  } as CSSProperties
  return (
    <div className={crystal || front ? 'xm-flake xm-flake--crystal' : 'xm-flake'} style={style}>
      <i>{crystal || front ? <span>❄</span> : null}</i>
    </div>
  )
}

/**
 * Cenário de Natal: céu com aurora, estrelas piscando, a estrela-guia, neve
 * caindo, morros nevados com pinheiros enfeitados, uma casinha, o trenó do
 * Papai Noel que cruza o céu de tempos em tempos e o varal de pisca-pisca no
 * topo. Só CSS/SVG, leve, e nunca recebe clique.
 *
 * A camada global já monta um (cheio na TV, leve no celular). Num jogo, use
 * dentro de um container para um fundo próprio:
 *
 *   <Box sx={{ position: 'relative' }}>
 *     <SnowBackdrop intensity="tv" position="absolute" />
 *     ...
 *   </Box>
 */
export default function SnowBackdrop({
  intensity = 'tv',
  layer = 'all',
  position = 'fixed',
  zIndex,
}: SnowBackdropProps) {
  const config = CONFIG[intensity]
  const showBack = layer !== 'front'
  const showFront = layer !== 'back'

  return (
    <div className="xm-backdrop" style={{ position, zIndex }} aria-hidden>
      {showBack && (
        <>
          <div className="xm-sky" />
          {Array.from({ length: config.aurora }, (_, index) => (
            <div key={index} className={index === 1 ? 'xm-aurora xm-aurora--2' : 'xm-aurora'} />
          ))}
          {Array.from({ length: config.stars }, (_, index) => (
            <span
              key={index}
              className="xm-star"
              style={
                {
                  left: `${scatter(index, 21) * 100}%`,
                  top: `${scatter(index, 22) * 55}%`,
                  '--xm-star-size': `${1.5 + scatter(index, 23) * 2.5}px`,
                  '--xm-star-dur': `${2 + scatter(index, 24) * 3}s`,
                  '--xm-star-delay': `${-scatter(index, 25) * 4}s`,
                } as CSSProperties
              }
            />
          ))}
          {config.guide && (
            <svg className="xm-guide" viewBox="-50 -50 100 100">
              <path
                d="M0 -48 L9 -9 L48 0 L9 9 L0 48 L-9 9 L-48 0 L-9 -9 Z"
                fill="#ffd975"
              />
              <path d="M0 -24 L5 -5 L24 0 L5 5 L0 24 L-5 5 L-24 0 L-5 -5 Z" fill="#fffbe8" transform="rotate(45)" />
              <circle r="6" fill="#ffffff" />
            </svg>
          )}
          {config.sleigh && <Sleigh />}
          {Array.from({ length: config.flakes }, (_, index) => (
            <Flake key={index} index={index} crystal={index < config.crystals} />
          ))}
          {/* O varal fica atrás do conteúdo: por cima, cobria a marca no topo da TV. */}
          {config.bulbs > 0 && <Garland bulbs={config.bulbs} swags={config.swags} />}
          {config.hills && (
            <div style={{ '--xm-hills-h': config.hills } as CSSProperties}>
              <Hills />
            </div>
          )}
        </>
      )}

      {showFront && (
        <>
          {config.vignette > 0 && (
            <div className="xm-vignette" style={{ '--xm-vig-a': config.vignette } as CSSProperties} />
          )}
          {Array.from({ length: config.frontFlakes }, (_, index) => (
            <Flake key={index} index={index + 100} crystal front />
          ))}
        </>
      )}
    </div>
  )
}
