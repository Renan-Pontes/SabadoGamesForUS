import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { scatter } from '../ui/motion'
import type { XmasEffect } from './bus'
import {
  ELF_SHOUT_MS,
  GIFT_OPEN_MS,
  HOHOHO_SIGN_MS,
  LIGHTS_BLACKOUT_MS,
  LIGHTS_BLINK_MS,
  REINDEER_DROP_MS,
  SECRET_SANTA_GIFT_MS,
  SECRET_SANTA_REVEAL_MS,
  secretSantaGift,
} from './config'
import './xmas.css'

/**
 * Efeitos de Natal da TV (prefixo hwx-): comédia de festa, nada de susto.
 * Toda a arte é original, em SVG. Só a versão animada mora aqui; a calma
 * (reduzir movimento) é o cartão de legenda de scenes.tsx.
 */

function vars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties
}

function delay(ms: number): CSSProperties {
  return vars({ '--hws-delay': `${ms}ms` })
}

// ---------------------------------------------------------------------------
// Arte
// ---------------------------------------------------------------------------

/** Gorro de Papai Noel (o do zoom suspeito e o dos duendes curiosos). */
export function SantaHat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden>
      <path d="M10 70 Q28 10 78 8 Q112 10 116 50 L102 54 Q96 32 78 30 Q90 48 94 70 Z" fill="#d42a3a" />
      <path d="M40 30 Q60 18 78 30" stroke="rgba(0,0,0,0.18)" strokeWidth={4} fill="none" />
      <rect x="4" y="60" width="98" height="24" rx="12" fill="#f4f8ff" />
      <circle cx="110" cy="56" r="11" fill="#f4f8ff" />
    </svg>
  )
}

/** Papai Noel gargalhando: barriga e cabeça são grupos separados (balançam por CSS). */
function Santa() {
  return (
    <svg className="hwx-santa-svg" viewBox="0 0 320 380" aria-hidden>
      <g className="hwx-santa-belly">
        <ellipse cx="160" cy="320" rx="138" ry="104" fill="#d42a3a" />
        <rect x="148" y="222" width="24" height="160" fill="#f4f8ff" />
        <path d="M24 300 Q160 330 296 300 L298 330 Q160 360 22 330 Z" fill="#1b1b1b" />
        <rect x="136" y="300" width="48" height="40" rx="5" fill="none" stroke="#f5c242" strokeWidth={8} />
        <circle cx="160" cy="250" r="6" fill="#1b1b1b" />
        <circle cx="160" cy="276" r="6" fill="#1b1b1b" />
        <ellipse cx="62" cy="292" rx="30" ry="26" fill="#f4f8ff" />
        <ellipse cx="258" cy="292" rx="30" ry="26" fill="#f4f8ff" />
      </g>
      <g className="hwx-santa-head">
        <circle cx="98" cy="146" r="14" fill="#f2b88e" />
        <circle cx="222" cy="146" r="14" fill="#f2b88e" />
        <circle cx="160" cy="142" r="62" fill="#f7c9a3" />
        <path
          d="M90 140 Q84 214 118 244 Q140 266 160 270 Q180 266 202 244 Q236 214 230 140 Q212 180 160 184 Q108 180 90 140 Z"
          fill="#f4f8ff"
          stroke="#d7dde8"
          strokeWidth={3}
        />
        <path d="M132 186 Q160 236 188 186 Z" fill="#7a1020" />
        <path d="M144 204 Q160 224 176 204 Q160 212 144 204 Z" fill="#ff6b78" />
        <path
          d="M160 170 Q140 152 112 168 Q124 190 160 180 Q196 190 208 168 Q180 152 160 170 Z"
          fill="#ffffff"
          stroke="#d7dde8"
          strokeWidth={2}
        />
        <ellipse cx="160" cy="158" rx="14" ry="12" fill="#ef8a8a" />
        <circle cx="122" cy="152" r="13" fill="rgba(240, 90, 100, 0.45)" />
        <circle cx="198" cy="152" r="13" fill="rgba(240, 90, 100, 0.45)" />
        <g stroke="#3b2a20" strokeWidth={5} fill="none" strokeLinecap="round">
          <path d="M128 134 Q138 122 148 134" />
          <path d="M172 134 Q182 122 192 134" />
        </g>
        <g stroke="#ffffff" strokeWidth={9} fill="none" strokeLinecap="round">
          <path d="M124 118 Q138 108 152 116" />
          <path d="M168 116 Q182 108 196 118" />
        </g>
        <path d="M96 100 Q108 26 180 22 Q252 26 272 92 L250 100 Q240 62 204 58 Q226 82 226 100 Z" fill="#d42a3a" />
        <rect x="86" y="82" width="148" height="30" rx="15" fill="#f4f8ff" />
        <circle cx="264" cy="100" r="18" fill="#f4f8ff" />
      </g>
    </svg>
  )
}

/** Presente com laço. A tampa é um grupo próprio (.hwx-gift-lid): o presentão do meio abre. */
function Gift({ color, ribbon, className }: { color: string; ribbon: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <rect x="8" y="36" width="84" height="60" rx="4" fill={color} />
      <rect x="8" y="36" width="84" height="60" rx="4" fill="rgba(0,0,0,0.12)" />
      <rect x="44" y="36" width="12" height="60" fill={ribbon} />
      <g className="hwx-gift-lid">
        <rect x="4" y="24" width="92" height="18" rx="3" fill={color} />
        <rect x="44" y="24" width="12" height="18" fill={ribbon} />
        <ellipse cx="37" cy="17" rx="14" ry="8" transform="rotate(-20 37 17)" fill={ribbon} />
        <ellipse cx="63" cy="17" rx="14" ry="8" transform="rotate(20 63 17)" fill={ribbon} />
        <circle cx="50" cy="21" r="6" fill={ribbon} />
      </g>
    </svg>
  )
}

/** Rena sem freio (olhos tortos, língua para fora) puxando o trenó. Corre para a direita. */
function ReindeerSleigh() {
  return (
    <svg className="hwx-reindeer-svg" viewBox="0 0 620 250" aria-hidden>
      {/* Trenó */}
      <g className="hwx-sleigh">
        <rect x="70" y="34" width="40" height="40" rx="3" fill="#1f9d55" />
        <rect x="86" y="34" width="8" height="40" fill="#f5c242" />
        <rect x="118" y="22" width="48" height="52" rx="3" fill="#5aa9ff" />
        <rect x="138" y="22" width="8" height="52" fill="#e8394a" />
        <rect x="170" y="46" width="32" height="28" rx="3" fill="#f5c242" />
        <rect x="182" y="46" width="8" height="28" fill="#1f9d55" />
        <path d="M20 120 Q20 70 60 70 L200 70 Q232 70 232 110 L232 150 Q232 172 200 172 L52 172 Q20 172 20 120 Z" fill="#c21f33" />
        <path d="M40 96 L214 96" stroke="#f5c242" strokeWidth={6} strokeLinecap="round" />
        <g stroke="#f5c242" strokeWidth={7} fill="none" strokeLinecap="round">
          <path d="M60 172 L60 204 M196 172 L196 204" />
          <path d="M6 204 L222 204 Q256 204 256 176" />
        </g>
      </g>
      {/* Arreio */}
      <path d="M232 118 Q300 150 372 140" stroke="#6b3f1d" strokeWidth={5} fill="none" />
      {/* Rena */}
      <g className="hwx-deer">
        <g className="hwx-leg hwx-leg--back" stroke="#5a3415" strokeWidth={12} strokeLinecap="round">
          <path d="M372 160 L352 218" />
        </g>
        <g className="hwx-leg hwx-leg--front" stroke="#5a3415" strokeWidth={12} strokeLinecap="round">
          <path d="M478 160 L498 218" />
        </g>
        <path d="M352 132 Q330 118 338 104" stroke="#8b5a2b" strokeWidth={10} strokeLinecap="round" fill="none" />
        <ellipse cx="428" cy="142" rx="84" ry="40" fill="#8b5a2b" />
        <ellipse cx="432" cy="158" rx="58" ry="18" fill="#c08a5a" />
        <g className="hwx-leg hwx-leg--back hwx-leg--alt" stroke="#6f4420" strokeWidth={12} strokeLinecap="round">
          <path d="M392 166 L380 222" />
        </g>
        <g className="hwx-leg hwx-leg--front hwx-leg--alt" stroke="#6f4420" strokeWidth={12} strokeLinecap="round">
          <path d="M462 166 L476 222" />
        </g>
        <path d="M486 124 Q508 96 520 74 L540 84 Q524 110 506 140 Z" fill="#8b5a2b" />
        <circle cx="500" cy="122" r="9" fill="#f5c242" stroke="#c48a12" strokeWidth={2} />
        <g stroke="#6b3f1d" strokeWidth={7} strokeLinecap="round" fill="none">
          <path d="M524 44 L512 8 M516 22 L498 14 M512 8 L522 -4" />
          <path d="M548 42 L566 8 M560 20 L578 16 M566 8 L560 -6" />
        </g>
        <path d="M512 50 Q500 38 492 46 Q500 56 514 58 Z" fill="#6f4420" />
        <ellipse cx="540" cy="62" rx="36" ry="26" fill="#8b5a2b" />
        <ellipse cx="574" cy="74" rx="22" ry="16" fill="#c08a5a" />
        <circle cx="592" cy="70" r="8" fill="#1b1b1b" />
        <path className="hwx-tongue" d="M570 86 Q568 104 556 112 Q552 100 560 88 Z" fill="#ff6b78" />
        <circle cx="532" cy="52" r="11" fill="#fff" />
        <circle cx="537" cy="56" r="4.5" fill="#1b1b1b" />
        <circle cx="552" cy="48" r="8" fill="#fff" />
        <circle cx="550" cy="44" r="3.5" fill="#1b1b1b" />
      </g>
    </svg>
  )
}

/** Duende cantor: a boca (grupo próprio) abre e fecha no ritmo da música. */
function Elf({ hat }: { hat: string }) {
  return (
    <svg viewBox="0 0 120 210" aria-hidden>
      <path d="M28 72 Q56 -8 104 18 Q84 32 92 72 Z" fill={hat} />
      <circle cx="104" cy="18" r="7" fill="#f5c242" />
      <path d="M30 94 L6 74 L32 106 Z" fill="#f2b88e" />
      <path d="M90 94 L114 74 L88 106 Z" fill="#f2b88e" />
      <circle cx="60" cy="98" r="32" fill="#f7c9a3" />
      <rect x="24" y="62" width="72" height="16" rx="8" fill="#e8394a" />
      <circle cx="49" cy="94" r="4.5" fill="#2a1a12" />
      <circle cx="71" cy="94" r="4.5" fill="#2a1a12" />
      <circle cx="42" cy="106" r="6" fill="rgba(240, 90, 100, 0.4)" />
      <circle cx="78" cy="106" r="6" fill="rgba(240, 90, 100, 0.4)" />
      <ellipse className="hwx-elf-mouth" cx="60" cy="116" rx="9" ry="8" fill="#7a1020" />
      <path d="M30 132 L90 132 L104 190 L16 190 Z" fill={hat} />
      <path d="M30 132 L40 146 L50 132 L60 146 L70 132 L80 146 L90 132 Z" fill="#e8394a" />
      <rect x="22" y="164" width="76" height="9" fill="#1b1b1b" />
      <rect x="53" y="162" width="14" height="13" rx="2" fill="none" stroke="#f5c242" strokeWidth={3} />
      <rect x="36" y="190" width="14" height="18" fill="#f4f8ff" />
      <rect x="70" y="190" width="14" height="18" fill="#e8394a" />
    </svg>
  )
}

/** A meia listrada que sai do presentão (o anticlímax da chuva de presentes). */
function Sock() {
  return (
    <svg viewBox="0 0 80 110" aria-hidden>
      <path d="M22 4 L58 4 L58 64 Q58 78 72 84 Q80 96 66 104 L24 104 Q8 104 10 86 L22 64 Z" fill="#e8394a" />
      <rect x="22" y="4" width="36" height="16" fill="#f4f8ff" />
      <rect x="22" y="34" width="36" height="9" fill="#f4f8ff" />
      <rect x="22" y="54" width="36" height="9" fill="#f4f8ff" />
      <path d="M10 92 Q24 86 36 104 L24 104 Q10 104 10 92 Z" fill="#f4f8ff" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Tremedeira da sala inteira (o app por baixo da camada), pequena e curta
// ---------------------------------------------------------------------------

/**
 * Faz o app por baixo tremer (frio da nevasca, rena passando). Tremor rápido
 * tem de ser pequeno (≤ 1,2vmin, sem giro — mesma regra de scary.test.ts).
 */
export const SHIVER_FRAMES = [
  'translate(0, 0)',
  'translate(-0.5vmin, 0.3vmin)',
  'translate(0.45vmin, -0.35vmin)',
  'translate(-0.3vmin, -0.25vmin)',
  'translate(0, 0)',
] as const
const SHIVER_CYCLE_MS = 120

function useAppShiver(startMs: number, durationMs: number) {
  useEffect(() => {
    const root = typeof document === 'undefined' ? null : document.getElementById('root')
    if (!root || typeof root.animate !== 'function') return
    const animation = root.animate(
      SHIVER_FRAMES.map((transform) => ({ transform })),
      { duration: SHIVER_CYCLE_MS, iterations: Math.max(1, Math.round(durationMs / SHIVER_CYCLE_MS)), delay: startMs },
    )
    return () => animation.cancel()
  }, [startMs, durationMs])
}

// ---------------------------------------------------------------------------
// Cenas
// ---------------------------------------------------------------------------

function HoHoHo({ name }: { name?: string }) {
  return (
    <>
      <div
        className="hws-dim"
        style={{ background: 'radial-gradient(ellipse at 40% 80%, rgba(150, 20, 35, 0.55), rgba(6, 10, 22, 0.88) 70%)' }}
      />
      {['HO', 'HO', 'HO!'].map((word, index) => (
        <div
          key={index}
          className="hwx-ho"
          style={{ ...delay(350 + index * 330), ...vars({ '--hwx-x': `${8 + index * 13}vw`, '--hwx-y': `${10 + (index % 2) * 9}vh` }) }}
        >
          {word}
        </div>
      ))}
      <div className="hwx-santa">
        <Santa />
      </div>
      <div className="hwx-sign" style={delay(HOHOHO_SIGN_MS)}>
        {name ? (
          <>
            <div className="hwx-sign-title">LISTA DOS MALCRIADOS</div>
            <div className="hwx-sign-name">{name}</div>
            <div className="hwx-sign-stamp">✔ CONFIRMADO</div>
          </>
        ) : (
          <div className="hwx-sign-name">FELIZ NATAL!</div>
        )}
      </div>
    </>
  )
}

const FLAKES = Array.from({ length: 70 }, (_, i) => ({
  left: Math.round(scatter(i, 1) * 130),
  top: Math.round(scatter(i, 2) * 100) - 10,
  size: 0.6 + scatter(i, 3) * 1.6,
  ms: 700 + Math.round(scatter(i, 4) * 700),
  wait: -Math.round(scatter(i, 5) * 1400),
}))

function Blizzard() {
  useAppShiver(500, 2300)
  return (
    <>
      <div className="hwx-whiteout" />
      <div className="hwx-flakes">
        {FLAKES.map((flake, index) => (
          <span
            key={index}
            className="hwx-flake"
            style={vars({
              left: `${flake.left}vw`,
              top: `${flake.top}vh`,
              '--hwx-size': `${flake.size.toFixed(2)}vmin`,
              animationDuration: `${flake.ms}ms`,
              animationDelay: `${flake.wait}ms`,
            })}
          />
        ))}
      </div>
      <div className="hwx-frost" />
      <div className="hws-center">
        <div className="hwx-brr-box">
          <div className="hwx-brr-face">🥶</div>
          <div className="hwx-brr">BRRRRR!</div>
        </div>
      </div>
      <div className="hws-caption hws-delay-in hwx-caption" style={delay(700)}>
        ❄️ NEVASCA NA SALA! ❄️
      </div>
    </>
  )
}

const GIFT_COLORS: [string, string][] = [
  ['#e8394a', '#f5c242'],
  ['#1f9d55', '#e8394a'],
  ['#5aa9ff', '#f4f8ff'],
  ['#f5c242', '#c21f33'],
  ['#a855f7', '#f5c242'],
  ['#f4f8ff', '#1f9d55'],
]

const RAIN = Array.from({ length: 18 }, (_, i) => ({
  // Faixa do meio (40–60%) fica para o presentão.
  left: (() => {
    const x = scatter(i, 11) * 84
    return x > 34 && x < 54 ? x + 20 : x
  })(),
  bottom: 2 + Math.round(scatter(i, 12) * 16),
  size: 9 + scatter(i, 13) * 8,
  wait: Math.round(i * 75 + scatter(i, 14) * 120),
  tilt: Math.round(scatter(i, 15) * 50 - 25),
  colors: GIFT_COLORS[i % GIFT_COLORS.length],
}))

function GiftRain() {
  return (
    <>
      <div className="hws-dim" style={{ background: 'rgba(6, 16, 31, 0.55)' }} />
      <div className="hwx-title hwx-title--gold">🎁 CHUVA DE PRESENTES! 🎁</div>
      {RAIN.map((gift, index) => (
        <div
          key={index}
          className="hwx-rain-gift"
          style={vars({
            left: `${gift.left}vw`,
            bottom: `${gift.bottom}vh`,
            width: `${gift.size.toFixed(1)}vmin`,
            '--hws-delay': `${gift.wait}ms`,
            '--hwx-tilt': `${gift.tilt}deg`,
          })}
        >
          <Gift color={gift.colors[0]} ribbon={gift.colors[1]} />
        </div>
      ))}
      <div className="hwx-big-gift" style={vars({ '--hwx-open': `${GIFT_OPEN_MS}ms` })}>
        <div className="hwx-sock-spring">
          <svg className="hwx-spring" viewBox="0 0 40 100" aria-hidden>
            <path
              d="M20 100 L4 92 L36 82 L4 72 L36 62 L4 52 L36 42 L4 32 L36 22 L20 14"
              stroke="#cbd5e1"
              strokeWidth={4}
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
          <div className="hwx-sock">
            <Sock />
          </div>
        </div>
        <Gift color="#c21f33" ribbon="#f5c242" className="hwx-big-gift-svg" />
      </div>
      <div className="hws-caption hws-delay-in hwx-caption" style={delay(GIFT_OPEN_MS + 350)}>
        ...MEIA?! DE NOVO?! 🧦
      </div>
    </>
  )
}

function Reindeer() {
  useAppShiver(450, 900)
  return (
    <>
      <div className="hws-dim" style={{ background: 'rgba(6, 16, 31, 0.35)' }} />
      <div className="hwx-title hwx-title--red">🦌 SAI DA FRENTE! 🦌</div>
      <div className="hwx-speedlines" />
      <div className="hwx-run">
        <div className="hwx-gallop">
          <ReindeerSleigh />
        </div>
      </div>
      <div className="hwx-drop" style={delay(REINDEER_DROP_MS)}>
        <Gift color="#1f9d55" ribbon="#e8394a" />
      </div>
      <div className="hws-caption hws-delay-in hwx-caption" style={delay(REINDEER_DROP_MS + 400)}>
        a rena tá sem freio... e esqueceu um presente 🎁
      </div>
    </>
  )
}

const BULB_COLORS = ['#ff3b4f', '#ffd54a', '#3ee07c', '#4aa8ff', '#ff7ae0']

function Garland({ side }: { side: 'top' | 'bottom' }) {
  return (
    <div className={`hwx-garland hwx-garland--${side}`}>
      <svg className="hwx-wire" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 8 Q 50 34 100 8 T 200 8 T 300 8 T 400 8 T 500 8 T 600 8 T 700 8 T 800 8 T 900 8 T 1000 8" stroke="#14532d" strokeWidth={4} fill="none" />
      </svg>
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={`hwx-bulb ${index % 2 ? 'hwx-bulb--b' : ''}`}
          style={vars({ left: `${5 + index * 10}%`, '--hwx-bulb': BULB_COLORS[index % BULB_COLORS.length] })}
        />
      ))}
    </div>
  )
}

function LightsParty() {
  const blink = vars({ '--hwx-blink': `${LIGHTS_BLINK_MS}ms`, '--hwx-blackout': `${LIGHTS_BLACKOUT_MS}ms` })
  return (
    <div className="hwx-lights" style={blink}>
      <div className="hws-dim" style={{ background: 'rgba(4, 8, 18, 0.62)' }} />
      <div className="hwx-beams" />
      <Garland side="top" />
      <Garland side="bottom" />
      <div className="hws-center">
        <div className="hwx-party-title">
          {'PISCA-PISCA'.split('').map((letter, index) => (
            <span key={index} style={vars({ '--hwx-i': index })}>
              {letter}
            </span>
          ))}
          <div className="hwx-party-sub">ENLOUQUECEU!</div>
        </div>
      </div>
      <div className="hwx-blackout" />
      <div className="hwx-zap">💥</div>
      <div className="hwx-smoke">💨</div>
      <div className="hws-caption hws-delay-in hwx-caption" style={delay(LIGHTS_BLACKOUT_MS + 250)}>
        ...queimou o fusível 💡
      </div>
    </div>
  )
}

function SecretSanta({ name }: { name?: string }) {
  const timing = vars({ '--hwx-reveal': `${SECRET_SANTA_REVEAL_MS}ms`, '--hwx-gift': `${SECRET_SANTA_GIFT_MS}ms` })
  return (
    <div className="hwx-secret" style={timing}>
      <div className="hwx-spot" />
      <div className="hwx-title hwx-title--gold hwx-secret-title">🥁 O AMIGO SECRETO É...</div>
      <div className="hws-center">
        <div className="hwx-secret-card">
          <div className="hwx-confetti" aria-hidden>
            🎉
          </div>
          <div className="hwx-secret-name">{name ?? 'VOCÊ!'}</div>
          <div className="hwx-confetti hwx-confetti--r" aria-hidden>
            🎊
          </div>
        </div>
      </div>
      <div className="hws-caption hwx-caption hwx-secret-gift">
        ganhou: {name ? secretSantaGift(name) : 'um abraço bem apertado 🤗'}
      </div>
    </div>
  )
}

const ELVES = [
  { hat: '#1f9d55', size: 23 },
  { hat: '#e8394a', size: 27 },
  { hat: '#1f9d55', size: 18 },
  { hat: '#e8394a', size: 27 },
  { hat: '#1f9d55', size: 23 },
]

function ElfChoir() {
  return (
    <>
      <div
        className="hws-dim"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(31, 157, 85, 0.45), rgba(6, 16, 31, 0.9) 70%)' }}
      />
      <div className="hwx-title hwx-title--green">🎶 CORAL DOS DUENDES 🎶</div>
      <div className="hwx-lyrics">Jingle bells, jingle bells, jingle all the way ♪</div>
      <div className="hwx-choir">
        {ELVES.map((elf, index) => (
          <div
            key={index}
            className={`hwx-elf ${index === 2 ? 'hwx-elf--shout' : ''}`}
            style={vars({
              width: `${elf.size}vmin`,
              '--hws-delay': `${index * 120}ms`,
              '--hwx-sway': `${index % 2 ? -1 : 1}`,
              '--hwx-shout': `${ELF_SHOUT_MS}ms`,
            })}
          >
            <Elf hat={elf.hat} />
          </div>
        ))}
      </div>
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className="hwx-note"
          style={vars({ left: `${12 + index * 10.5}vw`, '--hws-delay': `${300 + index * 330}ms` })}
        >
          {index % 2 ? '♫' : '♪'}
        </span>
      ))}
      <div className="hwx-bubble" style={delay(ELF_SHOUT_MS)}>
        FELIZ NATAL!
      </div>
    </>
  )
}

/** Um efeito de Natal inteiro (versão animada). */
export default function XmasScene({ kind, name }: { kind: XmasEffect; name?: string }) {
  switch (kind) {
    case 'hohoho':
      return <HoHoHo name={name} />
    case 'blizzard':
      return <Blizzard />
    case 'giftRain':
      return <GiftRain />
    case 'reindeer':
      return <Reindeer />
    case 'lightsParty':
      return <LightsParty />
    case 'secretSanta':
      return <SecretSanta name={name} />
    case 'elfChoir':
      return <ElfChoir />
  }
}
