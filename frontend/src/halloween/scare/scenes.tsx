import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import PumpkinSvg from '../ui/PumpkinSvg'
import SpiderSvg from '../ui/SpiderSvg'
import type { ConcreteScare } from './bus'
import { scareCaption } from './config'
import './scare.css'

type SceneProps = { kind: ConcreteScare; name?: string; reduced: boolean; duration: number }

/** Rosto de fantasma de olhos ocos e boca de grito (original, em SVG). */
function GhostFace({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 240" aria-hidden>
      <defs>
        <radialGradient id="hws-face" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </radialGradient>
        <radialGradient id="hws-socket" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#450a0a" />
          <stop offset="45%" stopColor="#000" />
          <stop offset="100%" stopColor="#111" />
        </radialGradient>
      </defs>
      <path
        d="M100 10 C 160 10 190 60 188 120 C 186 170 178 205 165 230 C 150 215 140 235 125 222 C 112 238 88 238 75 222 C 60 235 50 215 35 230 C 22 205 14 170 12 120 C 10 60 40 10 100 10 Z"
        fill="url(#hws-face)"
        stroke="#475569"
        strokeWidth={2}
      />
      <path d="M40 72 Q68 58 92 76" stroke="#64748b" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M108 76 Q132 58 160 72" stroke="#64748b" strokeWidth={6} fill="none" strokeLinecap="round" />
      <ellipse cx="68" cy="100" rx="22" ry="30" fill="url(#hws-socket)" />
      <ellipse cx="132" cy="100" rx="22" ry="30" fill="url(#hws-socket)" />
      <ellipse cx="100" cy="172" rx="20" ry="40" fill="#050505" />
    </svg>
  )
}

/** Cano de metal (o do meme), com tampas e reflexo. */
function MetalPipe() {
  return (
    <svg viewBox="0 0 400 60" aria-hidden>
      <defs>
        <linearGradient id="hws-pipe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="35%" stopColor="#e5e7eb" />
          <stop offset="60%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>
      </defs>
      <rect x="14" y="12" width="372" height="36" rx="6" fill="url(#hws-pipe)" />
      <rect x="0" y="6" width="28" height="48" rx="4" fill="#6b7280" stroke="#374151" strokeWidth={2} />
      <rect x="372" y="6" width="28" height="48" rx="4" fill="#6b7280" stroke="#374151" strokeWidth={2} />
      <rect x="40" y="18" width="320" height="4" rx="2" fill="rgba(255,255,255,0.55)" />
      <circle cx="140" cy="38" r="5" fill="rgba(146, 64, 14, 0.45)" />
      <circle cx="262" cy="30" r="3.5" fill="rgba(146, 64, 14, 0.4)" />
    </svg>
  )
}

/** Esqueleto dançarino: braços e pernas balançam por CSS. */
function Skeleton() {
  const bone = { stroke: '#f5f0e1', strokeWidth: 6, strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="0 0 100 200" aria-hidden>
      <g {...bone}>
        <path d="M50 50 L50 122" />
        <path d="M36 70 Q50 64 64 70 M34 82 Q50 76 66 82 M36 94 Q50 88 64 94 M39 106 Q50 101 61 106" strokeWidth={4} />
        <path d="M36 124 Q50 116 64 124" />
        <g className="hws-limb hws-limb--l">
          <path d="M48 60 L26 92 L20 124" />
        </g>
        <g className="hws-limb hws-limb--r">
          <path d="M52 60 L74 92 L80 124" />
        </g>
        <g className="hws-limb hws-limb--leg">
          <path d="M44 124 L38 162 L32 194" />
        </g>
        <g className="hws-limb hws-limb--leg hws-limb--r">
          <path d="M56 124 L62 162 L68 194" />
        </g>
      </g>
      <circle cx="50" cy="28" r="19" fill="#f5f0e1" />
      <rect x="40" y="40" width="20" height="10" rx="3" fill="#f5f0e1" />
      <ellipse cx="43" cy="27" rx="5" ry="6" fill="#0b0614" />
      <ellipse cx="57" cy="27" rx="5" ry="6" fill="#0b0614" />
      <path d="M50 33 L47 38 L53 38 Z" fill="#0b0614" />
      <path d="M43 44 L43 48 M48 44 L48 48 M53 44 L53 48 M58 44 L58 48" stroke="#0b0614" strokeWidth={1.5} />
    </svg>
  )
}

/** TV fora do ar: ruído cinza (nunca preto/branco puro) em baixa resolução. */
function StaticCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const image = context.createImageData(canvas.width, canvas.height)
    let frame = 0
    let last = 0
    const draw = (timestamp: number) => {
      if (timestamp - last > 40) {
        last = timestamp
        const data = image.data
        for (let i = 0; i < data.length; i += 4) {
          const value = 40 + Math.random() * 150
          data[i] = value
          data[i + 1] = value
          data[i + 2] = value
          data[i + 3] = 255
        }
        context.putImageData(image, 0, 0)
      }
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={ref} width={160} height={90} className="hws-static" />
}

function Calm({ kind, name }: { kind: ConcreteScare; name?: string }) {
  const { icon, text } = scareCaption(kind, name)
  return (
    <div className="hws-calm">
      <div className="hws-calm-card">
        <div className="hws-calm-icon">{icon}</div>
        <div className="hws-calm-text">{text}</div>
      </div>
    </div>
  )
}

function delay(ms: number) {
  return { '--hws-delay': `${ms}ms` } as CSSProperties
}

function Scene({ kind, name }: { kind: ConcreteScare; name?: string }) {
  switch (kind) {
    case 'doot':
      return (
        <>
          <div className="hws-dim" style={{ background: 'rgba(10, 5, 20, 0.45)' }} />
          <div className="hws-doot-skel">
            💀<span className="hws-doot-horn">🎺</span>
          </div>
          <div className="hws-doot-bubble" style={{ left: '44vw', bottom: '44vh', ...delay(450) }}>
            doot
          </div>
          <div className="hws-doot-bubble" style={{ left: '58vw', bottom: '54vh', ...delay(770) }}>
            doot
          </div>
          <div className="hws-caption hws-delay-in" style={delay(1000)}>
            obrigado sr. esqueleto 🎺
          </div>
        </>
      )
    case 'zoom':
      return (
        <>
          <div className="hws-dim" style={{ background: 'rgba(0, 0, 0, 0.8)' }} />
          <div className="hws-center">
            <div className="hws-zoom-target">
              <div className="hws-zoom-face">🤨</div>
              <div className="hws-zoom-name">{name ?? 'ALGUÉM AQUI'}</div>
            </div>
          </div>
          <div className="hws-camera">📸</div>
          <div className="hws-flash" />
        </>
      )
    case 'scream':
      return (
        <>
          <div className="hws-dim" style={{ background: 'rgba(4, 2, 8, 0.93)' }} />
          <div className="hws-redflash" />
          <div className="hws-shaker">
            <GhostFace className="hws-ghostface" />
          </div>
        </>
      )
    case 'pumpkin':
      return (
        <>
          <div
            className="hws-dim"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(120, 45, 0, 0.55), rgba(6, 2, 10, 0.92) 70%)',
            }}
          />
          <div className="hws-center">
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <div className="hws-pumpkin">
                <PumpkinSvg size={400} face="scary" />
              </div>
              <div className="hws-laugh">MUÁ-RÁ-RÁ!</div>
            </div>
          </div>
        </>
      )
    case 'pipe':
      return (
        <>
          <div
            className="hws-shaker"
            style={{ '--hws-shake-delay': '380ms', '--hws-shakes': 3 } as CSSProperties}
          >
            <div className="hws-pipe">
              <MetalPipe />
            </div>
          </div>
          <div className="hws-caption hws-caption--top hws-delay-in" style={delay(420)}>
            *barulho de cano caindo*
          </div>
        </>
      )
    case 'skeletons':
      return (
        <>
          <div
            className="hws-dim"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(60, 10, 90, 0.55), rgba(5, 2, 10, 0.88) 75%)',
            }}
          />
          <div className="hws-skel-title">É MÊS ASSUSTADOR</div>
          <div className="hws-skel hws-skel--left">
            <Skeleton />
          </div>
          <div className="hws-skel hws-skel--right">
            <Skeleton />
          </div>
        </>
      )
    case 'spider':
      return (
        <>
          <div className="hws-dim" style={{ background: 'rgba(0, 0, 0, 0.25)' }} />
          <div className="hws-spider-drop" style={{ '--hws-x': '50%' } as CSSProperties}>
            <div className="hws-spider-thread" />
            <div className="hws-spider-body">
              <SpiderSvg size={200} wiggle />
            </div>
          </div>
        </>
      )
    case 'static':
      return (
        <>
          <StaticCanvas />
          <div className="hws-scanlines" />
          <div className="hws-roll" />
          <div className="hws-center hws-faint">
            <GhostFace className="hws-ghostface" />
          </div>
          <div className="hws-center">
            <div className="hws-signal">SINAL PERDIDO...</div>
          </div>
          <div className="hws-center">
            <div className="hws-here">ELE ESTÁ AQUI</div>
          </div>
        </>
      )
    case 'bruh':
      return (
        <>
          <div className="hws-dim" style={{ background: 'rgba(0, 0, 0, 0.6)' }} />
          <div className="hws-center">
            <div>
              <div className="hws-skulls">
                {[0, 150, 300].map((ms) => (
                  <span key={ms} className="hws-skull" style={delay(ms)}>
                    💀
                  </span>
                ))}
              </div>
              <div className="hws-bruh">bruh</div>
            </div>
          </div>
        </>
      )
    case 'eyes':
      return (
        <>
          <div className="hws-dark" />
          <div className="hws-eyes">
            <span className="hws-eye-tilt--l">
              <span className="hws-eye" style={{ display: 'block' }} />
            </span>
            <span className="hws-eye-tilt--r">
              <span className="hws-eye" style={{ display: 'block' }} />
            </span>
          </div>
          <div className="hws-whisper">{name ? `...${name}...` : '...eu tô te vendo...'}</div>
        </>
      )
  }
}

/** Um susto inteiro (ou a versão calma, para quem pediu menos movimento). */
export default function ScareScene({ kind, name, reduced, duration }: SceneProps) {
  return (
    <div className="hws-out" style={{ '--hws-dur': `${duration}ms` } as CSSProperties}>
      {reduced ? <Calm kind={kind} name={name} /> : <Scene kind={kind} name={name} />}
    </div>
  )
}
