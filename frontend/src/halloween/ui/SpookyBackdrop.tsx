import type { CSSProperties } from 'react'
import { scatter } from './motion'
import SpiderSvg from './SpiderSvg'
import './spooky.css'

export type SpookyIntensity = 'tv' | 'phone' | 'subtle'
export type SpookyLayer = 'back' | 'front' | 'all'

type SpookyBackdropProps = {
  /** Quanto cenário: 'tv' (rico), 'phone' (leve) ou 'subtle' (quase nada). */
  intensity?: SpookyIntensity
  /**
   * 'back' fica atrás do conteúdo (céu, lua, neblina, morcegos); 'front' por
   * cima, sem atrapalhar (vinheta, teias nos cantos); 'all' = tudo junto.
   */
  layer?: SpookyLayer
  /** 'fixed' cobre a tela; 'absolute' preenche o pai (que precisa ser position: relative). */
  position?: 'fixed' | 'absolute'
  zIndex?: number
}

type Config = {
  moon: string | null
  cloud: boolean
  fog: number
  bats: number
  webs: ('tl' | 'tr' | 'bl' | 'br')[]
  webSize: string
  webAlpha: number
  vignette: number
  vignetteClear: string
  frontFog: boolean
  spider: boolean
}

const CONFIG: Record<SpookyIntensity, Config> = {
  tv: {
    moon: '17vmin',
    cloud: true,
    fog: 2,
    bats: 5,
    webs: ['tl', 'tr', 'bl', 'br'],
    webSize: 'clamp(120px, 15vmin, 220px)',
    webAlpha: 0.5,
    vignette: 0.6,
    vignetteClear: '55%',
    frontFog: true,
    spider: true,
  },
  phone: {
    moon: '22vmin',
    cloud: false,
    fog: 1,
    bats: 2,
    webs: ['tl', 'tr'],
    webSize: '84px',
    webAlpha: 0.35,
    vignette: 0.32,
    vignetteClear: '65%',
    frontFog: false,
    spider: false,
  },
  subtle: {
    moon: null,
    cloud: false,
    fog: 1,
    bats: 1,
    webs: ['tl'],
    webSize: '72px',
    webAlpha: 0.28,
    vignette: 0.2,
    vignetteClear: '70%',
    frontFog: false,
    spider: false,
  },
}

/** Teia de canto (desenhada para o canto superior esquerdo; os outros espelham). */
const WEB_PATH = (() => {
  const angles = [0, 18, 36, 54, 72, 90].map((deg) => (deg * Math.PI) / 180)
  const point = (radius: number, angle: number) =>
    `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`
  const spokes = angles.map((angle) => `M0 0 L${point(100, angle)}`)
  const rings: string[] = []
  for (const radius of [22, 42, 62, 82]) {
    for (let i = 0; i < angles.length - 1; i += 1) {
      const middle = (angles[i] + angles[i + 1]) / 2
      rings.push(`M${point(radius, angles[i])} Q${point(radius * 0.84, middle)} ${point(radius, angles[i + 1])}`)
    }
  }
  return [...spokes, ...rings].join(' ')
})()

const BAT_PATH =
  'M32 10 C30 6 28 5 26 6 C24 2 18 0 12 2 C14 4 14 7 12 9 C8 8 3 10 0 14 C5 14 9 16 11 20 C14 17 18 17 21 19 C23 16 27 15 30 17 L32 20 L34 17 C37 15 41 16 43 19 C46 17 50 17 53 20 C55 16 59 14 64 14 C61 10 56 8 52 9 C50 7 50 4 52 2 C46 0 40 2 38 6 C36 5 34 6 32 10 Z M29.5 9 L30.5 5 L31.6 8.6 Z M32.4 8.6 L33.5 5 L34.5 9 Z'

function Bat({ index, front = false }: { index: number; front?: boolean }) {
  const rtl = index % 2 === 1
  const style = {
    '--hw-bat-y': `${(front ? 40 : 8) + scatter(index, front ? 11 : 1) * (front ? 30 : 38)}vh`,
    '--hw-bat-size': `${Math.round((front ? 54 : 30) + scatter(index, 2) * (front ? 20 : 24))}px`,
    '--hw-bat-dur': `${(front ? 34 : 18) + scatter(index, 3) * 16}s`,
    '--hw-bat-delay': `${-scatter(index, 4) * 30}s`,
  } as CSSProperties
  return (
    <div className={rtl ? 'hw-bat hw-bat--rtl' : 'hw-bat'} style={style}>
      <svg viewBox="0 0 64 22">
        <path d={BAT_PATH} fill="#0d0812" />
      </svg>
    </div>
  )
}

const CRATERS: CSSProperties[] = [
  { width: '18%', height: '18%', left: '22%', top: '48%' },
  { width: '11%', height: '11%', left: '55%', top: '30%' },
  { width: '8%', height: '8%', left: '62%', top: '62%' },
]

/**
 * Cenário de Halloween: céu, lua, neblina em camadas, morcegos, teias e
 * vinheta. Só CSS/SVG, leve, e nunca recebe clique (pointer-events: none).
 *
 * A camada global já monta um (rico na TV, leve no celular). Num jogo, use
 * dentro de um container para um fundo próprio:
 *
 *   <Box sx={{ position: 'relative' }}>
 *     <SpookyBackdrop intensity="tv" position="absolute" />
 *     ...
 *   </Box>
 */
export default function SpookyBackdrop({
  intensity = 'tv',
  layer = 'all',
  position = 'fixed',
  zIndex,
}: SpookyBackdropProps) {
  const config = CONFIG[intensity]
  const showBack = layer !== 'front'
  const showFront = layer !== 'back'

  return (
    <div className="hw-backdrop" style={{ position, zIndex }} aria-hidden>
      {showBack && (
        <>
          <div className="hw-sky" />
          {config.moon && (
            <div className="hw-moon" style={{ '--hw-moon-size': config.moon } as CSSProperties}>
              {CRATERS.map((crater, index) => (
                <i key={index} style={crater} />
              ))}
            </div>
          )}
          {config.cloud && <div className="hw-cloud" />}
          {Array.from({ length: config.fog }, (_, index) => (
            <div key={index} className={index === 1 ? 'hw-fog hw-fog--2' : 'hw-fog'} />
          ))}
          {Array.from({ length: config.bats }, (_, index) => (
            <Bat key={index} index={index} />
          ))}
        </>
      )}

      {showFront && (
        <>
          {config.vignette > 0 && (
            <div
              className="hw-vignette"
              style={
                { '--hw-vig-a': config.vignette, '--hw-vig-clear': config.vignetteClear } as CSSProperties
              }
            />
          )}
          {config.frontFog && (
            <div
              className="hw-fog"
              style={
                {
                  '--hw-fog-h': '18vh',
                  '--hw-fog-bottom': '-7vh',
                  '--hw-fog-a': 0.07,
                  '--hw-fog-speed': '95s',
                } as CSSProperties
              }
            />
          )}
          {config.webs.map((corner) => (
            <svg
              key={corner}
              className={`hw-web hw-web--${corner}`}
              viewBox="0 0 100 100"
              style={{ '--hw-web-size': config.webSize, '--hw-web-alpha': config.webAlpha } as CSSProperties}
            >
              <path d={WEB_PATH} fill="none" stroke="rgba(235, 235, 245, 0.75)" strokeWidth={0.7} />
            </svg>
          ))}
          {config.spider && (
            <div className="hw-hanging-spider">
              <SpiderSvg size={34} thread={110} wiggle />
            </div>
          )}
          {intensity === 'tv' && <Bat index={7} front />}
        </>
      )}
    </div>
  )
}
