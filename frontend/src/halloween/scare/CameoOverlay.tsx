import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../ui/motion'
import { playCameoSound } from './cameoSound'
import { CAMEO_INFO, cameoBubble, onCameo, setCameoShowing } from './cameos'
import type { Cameo, CameoRequest } from './cameos'
import './cameos.css'

/**
 * Palco das visitas de Natal (prefixo hwc-): uma visita por vez, pequena,
 * num canto ou no fundo do cenário — nunca tela cheia, nunca no meio do texto
 * do jogo. Só transform/opacity (as TVs são fracas), arte original em SVG.
 * Com "reduzir movimento", vira um cartãozinho parado no canto.
 *
 * Montado uma única vez pela camada global (HalloweenLayer).
 */

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties
}

// ---------------------------------------------------------------------------
// Arte
// ---------------------------------------------------------------------------

/** Biscoito de gengibre: o braço direito (.hwc-cookie-arm) acena, um olho pisca. */
function Cookie() {
  const dough = '#c47a3e'
  return (
    <svg className="hwc-svg" viewBox="0 0 120 150" aria-hidden>
      <ellipse cx="38" cy="132" rx="14" ry="20" fill={dough} />
      <ellipse cx="82" cy="132" rx="14" ry="20" fill={dough} />
      <ellipse cx="26" cy="84" rx="20" ry="11" transform="rotate(-24 26 84)" fill={dough} />
      <g className="hwc-cookie-arm">
        <ellipse cx="96" cy="78" rx="20" ry="11" transform="rotate(-30 96 78)" fill={dough} />
        <path d="M106 62 q4 4 0 8 q-4 4 0 8" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="60" cy="98" rx="32" ry="36" fill={dough} />
      <circle cx="60" cy="40" r="28" fill={dough} />
      <path d="M14 78 q4 4 0 8 q-4 4 0 8" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M28 142 q5 -4 10 0 q5 4 10 0 M72 142 q5 -4 10 0 q5 4 10 0" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx="49" cy="36" r="4" fill="#3b1d12" />
      <g className="hwc-cookie-wink">
        <circle cx="71" cy="36" r="4" fill="#3b1d12" />
      </g>
      <circle cx="42" cy="48" r="5" fill="rgba(240, 100, 110, 0.45)" />
      <circle cx="78" cy="48" r="5" fill="rgba(240, 100, 110, 0.45)" />
      <path d="M48 50 Q60 62 72 50" stroke="#fff" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <circle cx="60" cy="82" r="5" fill="#e23b4e" />
      <circle cx="60" cy="100" r="5" fill="#2fa35e" />
      <circle cx="60" cy="118" r="5" fill="#e23b4e" />
    </svg>
  )
}

/** Papai Noel lá no alto, no trenó, erguendo um presente; uma rena puxa. Voa para a direita. */
function SantaSleigh() {
  return (
    <svg className="hwc-svg" viewBox="0 0 240 110" aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => (
        <circle key={index} className="hwc-dust" cx={8 + index * 12} cy={86 - (index % 2) * 6} r={3 - index * 0.4} fill="#ffd975" style={vars({ '--hwc-i': index })} />
      ))}
      {/* Rédea */}
      <path d="M128 78 Q160 66 186 62" stroke="#7a4a2a" strokeWidth={2} fill="none" />
      {/* Rena */}
      <g>
        <ellipse cx="196" cy="66" rx="20" ry="10" fill="#9a5b34" />
        <path d="M182 72 l-4 18 M190 74 l-2 18 M204 74 l2 18 M210 72 l5 16" stroke="#6b3d22" strokeWidth={4} strokeLinecap="round" />
        <path d="M210 60 q8 -10 14 -14" stroke="#9a5b34" strokeWidth={8} strokeLinecap="round" fill="none" />
        <circle cx="226" cy="44" r="8" fill="#9a5b34" />
        <circle cx="234" cy="46" r="3.5" fill="#ff4d5e" />
        <circle cx="226" cy="41" r="1.6" fill="#1b1b1b" />
        <path d="M222 36 l-4 -10 m4 10 l2 -12 M218 26 l-5 -2 M224 24 l4 -4" stroke="#6b3d22" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </g>
      {/* Papai Noel */}
      <g>
        <circle cx="96" cy="58" r="17" fill="#d42a3a" />
        <circle cx="96" cy="34" r="11" fill="#f7c9a3" />
        <path d="M86 36 Q88 52 96 54 Q104 52 106 36 Q100 42 96 42 Q92 42 86 36 Z" fill="#f4f8ff" />
        <path d="M85 30 Q88 14 104 16 L110 24 L106 26 Q100 22 107 30 Z" fill="#d42a3a" />
        <rect x="83" y="27" width="25" height="6" rx="3" fill="#f4f8ff" />
        <circle cx="110" cy="25" r="3.5" fill="#f4f8ff" />
        <circle cx="92" cy="34" r="1.4" fill="#3b2a20" />
        <circle cx="100" cy="34" r="1.4" fill="#3b2a20" />
        {/* Braço erguendo o presente */}
        <path d="M106 52 Q118 40 116 26" stroke="#d42a3a" strokeWidth={7} strokeLinecap="round" fill="none" />
        <g className="hwc-santa-gift">
          <rect x="106" y="6" width="22" height="18" rx="2" fill="#2fa35e" />
          <rect x="115" y="6" width="4" height="18" fill="#f5c242" />
          <ellipse cx="112" cy="4" rx="5" ry="3" fill="#f5c242" transform="rotate(-20 112 4)" />
          <ellipse cx="122" cy="4" rx="5" ry="3" fill="#f5c242" transform="rotate(20 122 4)" />
        </g>
      </g>
      {/* Trenó */}
      <path d="M62 56 L130 56 Q138 56 136 66 L132 80 L70 80 Q60 80 60 70 Z" fill="#b3202e" />
      <path d="M62 60 L134 60" stroke="#f5c242" strokeWidth={3} />
      <path d="M56 92 L136 92 Q148 92 148 82" stroke="#f5c242" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M78 80 L74 92 M118 80 L122 92" stroke="#f5c242" strokeWidth={3} />
      {/* Saco */}
      <ellipse cx="70" cy="48" rx="13" ry="12" fill="#8a5a3a" />
    </svg>
  )
}

/** Boneco de neve: o braço (.hwc-snow-arm) acena e o chapéu (.hwc-snow-hat) pula da cabeça. */
function Snowman() {
  const snow = '#f4f8ff'
  return (
    <svg className="hwc-svg" viewBox="0 0 120 170" aria-hidden>
      <path d="M30 96 L6 78 M14 84 L8 72" stroke="#6b3d22" strokeWidth={4} strokeLinecap="round" fill="none" />
      <g className="hwc-snow-arm">
        <path d="M90 96 L114 74 M106 81 L114 86" stroke="#6b3d22" strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>
      <circle cx="60" cy="140" r="32" fill={snow} stroke="#cfdcec" strokeWidth={2} />
      <circle cx="60" cy="96" r="25" fill={snow} stroke="#cfdcec" strokeWidth={2} />
      <circle cx="60" cy="58" r="20" fill={snow} stroke="#cfdcec" strokeWidth={2} />
      <path d="M42 72 Q60 80 78 72 L80 80 Q60 88 40 80 Z" fill="#d42a3a" />
      <path d="M68 78 l4 20 l8 -2 l-4 -18 Z" fill="#b3202e" />
      <circle cx="53" cy="54" r="2.6" fill="#1b1b1b" />
      <circle cx="67" cy="54" r="2.6" fill="#1b1b1b" />
      <path d="M60 59 L76 62 L60 64 Z" fill="#f08a24" />
      <path d="M52 66 Q60 71 68 66" stroke="#1b1b1b" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" fill="none" />
      <circle cx="47" cy="61" r="3.5" fill="rgba(240, 100, 110, 0.35)" />
      <circle cx="73" cy="61" r="3.5" fill="rgba(240, 100, 110, 0.35)" />
      <circle cx="60" cy="96" r="2.6" fill="#1b1b1b" />
      <circle cx="60" cy="108" r="2.6" fill="#1b1b1b" />
      <g className="hwc-snow-hat">
        <rect x="40" y="34" width="40" height="6" rx="3" fill="#1d2433" />
        <rect x="46" y="14" width="28" height="22" rx="2" fill="#1d2433" />
        <rect x="46" y="30" width="28" height="5" fill="#d42a3a" />
        <circle cx="70" cy="30" r="3" fill="#2fa35e" />
      </g>
    </svg>
  )
}

/** Pinguim deitado de barriga, escorregando para a direita. */
function Penguin() {
  return (
    <svg className="hwc-svg" viewBox="0 0 170 80" aria-hidden>
      {[0, 1, 2].map((index) => (
        <circle key={index} className="hwc-puff" cx={10 + index * 9} cy={66 - index * 3} r={5 - index} fill="#eef6ff" style={vars({ '--hwc-i': index })} />
      ))}
      <path d="M24 52 L12 44 L14 56 Z M26 58 L12 62 L22 66 Z" fill="#f08a24" />
      <ellipse cx="82" cy="50" rx="60" ry="22" fill="#1d2433" />
      <ellipse cx="86" cy="60" rx="48" ry="12" fill="#f4f8ff" />
      <path d="M70 40 Q56 30 40 36 Q56 44 70 46 Z" fill="#11161f" />
      <circle cx="140" cy="38" r="20" fill="#1d2433" />
      <ellipse cx="146" cy="42" rx="12" ry="12" fill="#f4f8ff" />
      <circle cx="148" cy="38" r="2.6" fill="#1b1b1b" />
      <circle cx="149" cy="37" r="0.9" fill="#fff" />
      <path d="M156 42 L168 45 L156 48 Z" fill="#f08a24" />
      <circle cx="144" cy="47" r="3" fill="rgba(240, 100, 110, 0.45)" />
      <path d="M120 26 Q132 16 146 20 Q140 12 128 14 Q118 18 120 26 Z" fill="#d42a3a" />
      <circle cx="118" cy="24" r="4" fill="#f4f8ff" />
    </svg>
  )
}

/** Estrela de 5 pontas dourada (a da estrela cadente). */
function Star() {
  return (
    <svg className="hwc-svg" viewBox="-50 -50 100 100" aria-hidden>
      <path d="M0 -46 L13 -14 L46 -12 L20 10 L29 44 L0 25 L-29 44 L-20 10 L-46 -12 L-13 -14 Z" fill="#ffd975" />
      <path d="M0 -26 L7 -8 L26 -7 L11 6 L16 25 L0 14 L-16 25 L-11 6 L-26 -7 L-7 -8 Z" fill="#fff6d6" />
    </svg>
  )
}

/** Presente de paraquedas: o paraquedas (.hwc-canopy) murcha quando pousa. */
function ParachuteGift() {
  return (
    <svg className="hwc-svg" viewBox="0 0 100 150" aria-hidden>
      <g className="hwc-canopy">
        <path d="M6 46 Q6 4 50 4 Q94 4 94 46 Q83 38 72 46 Q61 38 50 46 Q39 38 28 46 Q17 38 6 46 Z" fill="#d42a3a" />
        <path d="M28 46 Q30 10 50 4 Q38 20 39 42 Z M72 46 Q70 10 50 4 Q62 20 61 42 Z" fill="#f4f8ff" />
        <path d="M8 46 L36 104 M50 46 L50 104 M92 46 L64 104" stroke="#e8eef8" strokeWidth={1.4} />
      </g>
      <rect x="28" y="104" width="44" height="40" rx="3" fill="#2fa35e" />
      <rect x="28" y="104" width="44" height="40" rx="3" fill="rgba(0,0,0,0.1)" />
      <rect x="46" y="104" width="8" height="40" fill="#f5c242" />
      <rect x="28" y="118" width="44" height="7" fill="#f5c242" />
      <ellipse cx="42" cy="100" rx="9" ry="5" transform="rotate(-20 42 100)" fill="#f5c242" />
      <ellipse cx="58" cy="100" rx="9" ry="5" transform="rotate(20 58 100)" fill="#f5c242" />
    </svg>
  )
}

/** Renazinha de olhar para a esquerda (pula pelos morros da direita para a esquerda). */
function LittleReindeer() {
  return (
    <svg className="hwc-svg" viewBox="0 0 140 120" aria-hidden>
      <path d="M50 84 l-6 26 M62 86 l-2 26 M96 86 l2 26 M108 82 l8 24" stroke="#6b3d22" strokeWidth={7} strokeLinecap="round" />
      <ellipse cx="80" cy="72" rx="38" ry="20" fill="#9a5b34" />
      <ellipse cx="80" cy="80" rx="26" ry="9" fill="#d8a77a" />
      <ellipse cx="120" cy="62" rx="7" ry="5" fill="#f4f8ff" />
      <path d="M52 62 Q42 46 40 34" stroke="#9a5b34" strokeWidth={16} strokeLinecap="round" fill="none" />
      <path d="M46 70 Q54 74 62 70" stroke="#d42a3a" strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx="54" cy="74" r="3.5" fill="#f5c242" />
      <circle cx="36" cy="30" r="15" fill="#9a5b34" />
      <ellipse cx="22" cy="36" rx="9" ry="7" fill="#b5764c" />
      <circle cx="14" cy="36" r="5.5" fill="#ff4d5e" />
      <circle cx="32" cy="26" r="2.6" fill="#1b1b1b" />
      <circle cx="33" cy="25" r="0.9" fill="#fff" />
      <ellipse cx="50" cy="22" rx="8" ry="4" transform="rotate(-30 50 22)" fill="#7a4428" />
      <path d="M38 16 L34 2 M36 8 L28 4 M44 16 L52 2 M48 8 L56 6" stroke="#6b3d22" strokeWidth={3} strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Duende da chaminé: braços pra cima (vai jogar confete). */
function ChimneyElf() {
  return (
    <svg className="hwc-svg" viewBox="0 0 80 100" aria-hidden>
      <g className="hwc-elf-arms">
        <path d="M22 70 L8 44 M58 70 L72 44" stroke="#2fa35e" strokeWidth={9} strokeLinecap="round" />
        <circle cx="8" cy="42" r="5" fill="#f7c9a3" />
        <circle cx="72" cy="42" r="5" fill="#f7c9a3" />
      </g>
      <rect x="18" y="64" width="44" height="40" rx="10" fill="#2fa35e" />
      <path d="M18 66 L26 74 L34 66 L42 74 L50 66 L58 74 L62 66 L62 64 L18 64 Z" fill="#d42a3a" />
      <path d="M20 46 L10 38 L22 40 Z M60 46 L70 38 L58 40 Z" fill="#f2b88e" />
      <circle cx="40" cy="48" r="18" fill="#f7c9a3" />
      <circle cx="34" cy="46" r="2.4" fill="#1b1b1b" />
      <circle cx="46" cy="46" r="2.4" fill="#1b1b1b" />
      <circle cx="30" cy="53" r="3.5" fill="rgba(240, 100, 110, 0.45)" />
      <circle cx="50" cy="53" r="3.5" fill="rgba(240, 100, 110, 0.45)" />
      <path d="M33 55 Q40 62 47 55" stroke="#7a1020" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M22 36 Q30 6 58 2 Q50 16 58 36 Z" fill="#2fa35e" />
      <rect x="20" y="32" width="40" height="7" rx="3.5" fill="#f4f8ff" />
      <circle cx="59" cy="3" r="4.5" fill="#f5c242" />
    </svg>
  )
}

/** Duende desconfiado espiando da borda: uma sobrancelha lá em cima, a outra franzida. */
function PeekingElf() {
  return (
    <svg className="hwc-svg" viewBox="0 0 120 140" aria-hidden>
      <path d="M8 112 Q60 96 112 112 L112 140 L8 140 Z" fill="#2fa35e" />
      <path d="M8 112 L20 124 L32 112 L44 124 L56 112 L68 124 L80 112 L92 124 L104 112 L112 112 L112 108 Q60 92 8 108 Z" fill="#d42a3a" />
      <path d="M22 66 L2 54 L20 78 Z M98 66 L118 54 L100 78 Z" fill="#f2b88e" />
      <circle cx="60" cy="70" r="38" fill="#f7c9a3" />
      <circle cx="40" cy="82" r="6" fill="rgba(240, 100, 110, 0.4)" />
      <circle cx="80" cy="82" r="6" fill="rgba(240, 100, 110, 0.4)" />
      {/* Olho apertado (desconfiado) e olho arregalado */}
      <path d="M38 68 Q46 64 54 68" stroke="#1b1b1b" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <circle cx="76" cy="66" r="5" fill="#1b1b1b" />
      <circle cx="77.6" cy="64.4" r="1.6" fill="#fff" />
      <path d="M36 58 L56 60" stroke="#6b3d22" strokeWidth={4} strokeLinecap="round" />
      <g className="hwc-brow">
        <path d="M66 50 Q76 38 88 48" stroke="#6b3d22" strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>
      <path d="M50 90 Q58 94 70 88" stroke="#7a1020" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M22 44 Q36 0 88 4 Q70 22 98 44 Z" fill="#2fa35e" />
      <rect x="18" y="38" width="84" height="10" rx="5" fill="#f4f8ff" />
      <circle cx="90" cy="6" r="6" fill="#f4f8ff" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Cenas
// ---------------------------------------------------------------------------

const CONFETTI = [
  { dx: '-9vmin', dy: '-12vmin', color: '#ff4d5e' },
  { dx: '-5vmin', dy: '-16vmin', color: '#f5c242' },
  { dx: '-1vmin', dy: '-18vmin', color: '#4fd67e' },
  { dx: '3vmin', dy: '-17vmin', color: '#5ab4ff' },
  { dx: '7vmin', dy: '-14vmin', color: '#ff8fd0' },
  { dx: '10vmin', dy: '-10vmin', color: '#f5c242' },
  { dx: '-12vmin', dy: '-7vmin', color: '#4fd67e' },
  { dx: '12vmin', dy: '-6vmin', color: '#ff4d5e' },
]

const SPARKLES = [
  { dx: '-5vmin', dy: '-4vmin' },
  { dx: '5vmin', dy: '-5vmin' },
  { dx: '0vmin', dy: '-8vmin' },
]

function animatedScene(kind: Cameo, name?: string): ReactNode {
  switch (kind) {
    case 'cookie':
      return (
        <div className="hwc-cookie">
          <Cookie />
        </div>
      )
    case 'santaSleigh':
      return (
        <div className="hwc-santa">
          <div className="hwc-bob">
            <SantaSleigh />
          </div>
        </div>
      )
    case 'snowman':
      return (
        <div className="hwc-snowman">
          <Snowman />
        </div>
      )
    case 'penguin':
      return (
        <div className="hwc-penguin">
          <div className="hwc-wobble">
            <Penguin />
          </div>
        </div>
      )
    case 'shootingStar':
      return (
        <div className="hwc-sky-path">
          <div className="hwc-shooting">
            <div className="hwc-star-trail" />
            <div className="hwc-star">
              <Star />
            </div>
          </div>
        </div>
      )
    case 'parachuteGift':
      return (
        <div className="hwc-chute">
          <div className="hwc-sway">
            <ParachuteGift />
          </div>
          {SPARKLES.map((sparkle, index) => (
            <span key={index} className="hwc-sparkle" style={vars({ '--dx': sparkle.dx, '--dy': sparkle.dy })}>
              ✦
            </span>
          ))}
        </div>
      )
    case 'reindeerHop':
      return (
        <div className="hwc-deer">
          <div className="hwc-hop">
            <LittleReindeer />
          </div>
        </div>
      )
    case 'chimneyElf':
      return (
        <>
          <div className="hwc-chimney">
            <div className="hwc-elf">
              <ChimneyElf />
            </div>
          </div>
          <div className="hwc-confetti-origin">
            {CONFETTI.map((piece, index) => (
              <i
                key={index}
                className="hwc-confetti"
                style={vars({ '--dx': piece.dx, '--dy': piece.dy, background: piece.color, '--hwc-i': index })}
              />
            ))}
          </div>
        </>
      )
    case 'peek':
      return (
        <>
          <div className="hwc-peek">
            <PeekingElf />
          </div>
          <div className="hwc-bubble">{cameoBubble(kind, name)}</div>
        </>
      )
  }
}

/** Altura da faixa dos morros do cenário (SnowBackdrop: 'tv' 15vh, 'phone' 12vh) — o duende sai da casinha dela. */
const HILLS_HEIGHT = { tv: '15vh', phone: '12vh' } as const

type SceneProps = { kind: Cameo; name?: string; reduced: boolean; duration: number; tv?: boolean }

/**
 * Uma visita. Animada: a arte no seu canto (ou no fundo). Calma (reduzir
 * movimento): um cartãozinho parado no canto, com o ícone e uma frase.
 */
export function CameoScene({ kind, name, reduced, duration, tv = true }: SceneProps) {
  const info = CAMEO_INFO[kind]
  if (reduced) {
    return (
      <div className="hwc-root hwc-root--front" style={vars({ '--hwc-dur': `${duration}ms` })}>
        <div className="hwc-calm">
          <span className="hwc-calm-icon">{info.icon}</span>
          <span>{cameoBubble(kind, name) ?? info.caption}</span>
        </div>
      </div>
    )
  }
  return (
    <div
      className={`hwc-root hwc-root--${info.layer}`}
      style={vars({ '--hwc-dur': `${duration}ms`, '--hwc-hills-h': HILLS_HEIGHT[tv ? 'tv' : 'phone'] })}
    >
      {animatedScene(kind, name)}
    </div>
  )
}

/**
 * Escuta o barramento das visitas e mostra uma por vez. Se outra chega no
 * meio, espera a vez (só a mais recente) e entra logo depois.
 */
export default function CameoOverlay({ tv = true }: { tv?: boolean }) {
  const [cameo, setCameo] = useState<CameoRequest | null>(null)
  const pending = useRef<CameoRequest | null>(null)
  const busy = useRef(false)
  const reduced = useReducedMotion()

  useEffect(
    () =>
      onCameo((request) => {
        if (busy.current) {
          pending.current = request
          return
        }
        busy.current = true
        setCameoShowing(true)
        setCameo(request)
      }),
    [],
  )

  useEffect(() => {
    if (!cameo) return
    playCameoSound(cameo.kind)
    const timer = window.setTimeout(() => {
      const next = pending.current
      pending.current = null
      if (next) {
        setCameo(next)
        return
      }
      busy.current = false
      setCameoShowing(false)
      setCameo(null)
    }, CAMEO_INFO[cameo.kind].durationMs)
    return () => window.clearTimeout(timer)
  }, [cameo])

  useEffect(
    () => () => {
      busy.current = false
      setCameoShowing(false)
    },
    [],
  )

  if (!cameo || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden>
      <CameoScene key={cameo.id} kind={cameo.kind} name={cameo.name} reduced={reduced} duration={CAMEO_INFO[cameo.kind].durationMs} tv={tv} />
    </div>,
    document.body,
  )
}
