import type { CSSProperties } from 'react'
import {
  ANIMATRONIC_FLASHES,
  ANIMATRONIC_RUSH_MS,
  APAGAO_EYES_MS,
  APAGAO_HIT_MS,
  APAGAO_OFF_MS,
  FACE_HIT_MS,
  RASTEJANTE_LUNGE_MS,
} from './scaryTiming'
import './scary.css'

/**
 * Os sustos de verdade: o animatrônico, o rosto, o apagão e a rastejante. Tudo original, desenhado
 * aqui em SVG e animado por CSS (scary.css) — nada de imagem baixada.
 *
 * Segurança (pode ter gente fotossensível na sala): no máximo 2 clarões por
 * susto, com pelo menos 400 ms entre um e outro, e nada piscando cobrindo a
 * tela — nem tremor de tela rápido, que também pisca (veja scary.css). Com
 * "reduzir movimento" ligado, a cena nem chega aqui: entra a versão calma.
 */

/** Formas grandes do animatrônico (o corpo e a silhueta escura usam as mesmas). */
const DOME =
  'M200 34 C 300 34 336 112 332 196 C 330 236 318 262 300 274 L 100 274 C 82 262 70 236 68 196 C 64 112 100 34 200 34 Z'
const MAW = 'M116 258 L284 258 L278 372 Q 200 414 122 372 Z'
const MANDIBLE = 'M104 290 L296 290 L290 352 Q 270 420 200 428 Q 130 420 110 352 Z'

/** Fios soltos: [caminho, cor, ponta desencapada]. */
const WIRES: [string, string, string][] = [
  ['M102 270 C 80 318 98 350 76 402', '#7f1d1d', 'M76 402 l-5 9 M76 402 l3 10 M76 402 l7 7'],
  ['M298 270 C 322 316 304 352 328 410', '#854d0e', 'M328 410 l-6 8 M328 410 l2 10 M328 410 l8 6'],
]

const JAW_WIRES: [string, string, string][] = [
  ['M176 424 C 170 452 188 474 174 506', '#7f1d1d', 'M174 506 l-5 8 M174 506 l4 9'],
  ['M200 428 C 198 462 204 484 196 516', '#1e3a8a', 'M196 516 l-6 6 M196 516 l3 9'],
  ['M222 422 C 232 456 210 476 224 510', '#854d0e', 'M224 510 l-4 9 M224 510 l6 6'],
]

/** Dentes de metal: [x, comprimento]; 0 = dente que caiu. */
const UPPER_TEETH: [number, number][] = [
  [122, 30], [138, 34], [154, 26], [170, 0], [186, 34], [202, 31], [218, 22], [234, 34], [250, 29], [266, 32],
]
const LOWER_TEETH: [number, number][] = [
  [128, 26], [144, 30], [160, 30], [176, 18], [192, 30], [208, 0], [224, 28], [240, 30], [256, 24],
]

function Wire({ path, color, frayed }: { path: string; color: string; frayed: string }) {
  return (
    <g className="hws-anim-wire">
      <path d={path} stroke="#0b0907" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d={path} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={frayed} stroke="#c2410c" strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  )
}

/**
 * Olho de câmera: lente escura com um LED pequeno e quente no meio (nada de
 * globo branco de desenho animado). A lente da direita está rachada.
 */
function Eye({ cx, cy, cracked = false }: { cx: number; cy: number; cracked?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={34} fill="url(#hws-anim-glow)" />
      <circle cx={cx} cy={cy} r={13} fill="#0a0303" stroke="#2a0d08" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={5} fill="#ff3d1f" />
      <circle cx={cx - 1.2} cy={cy - 1.2} r={2.2} fill="#fff4e6" />
      {cracked && (
        <path
          d={`M${cx + 9} ${cy - 37} L${cx + 3} ${cy - 17} L${cx + 12} ${cy - 9} L${cx + 6} ${cy + 6} M${cx + 3} ${cy - 17} L${cx - 10} ${cy - 24} M${cx + 12} ${cy - 9} L${cx + 30} ${cy - 4}`}
          stroke="rgba(214, 211, 209, 0.65)"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      )}
    </g>
  )
}

/**
 * Endoesqueleto enferrujado: crânio de metal com rebites e amassados,
 * órbitas de lente com um LED vermelho aceso (uma lente rachada), dentes de
 * placa (alguns faltando), mandíbula presa em pistões e fios soltos. Original.
 */
function Animatronic() {
  const tooth = { fill: '#a39a8c', stroke: '#2d2823', strokeWidth: 2 }
  return (
    <svg viewBox="0 0 400 520" aria-hidden>
      <defs>
        <radialGradient id="hws-anim-dome" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#5f564c" />
          <stop offset="55%" stopColor="#332d27" />
          <stop offset="100%" stopColor="#141210" />
        </radialGradient>
        <linearGradient id="hws-anim-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4e463e" />
          <stop offset="60%" stopColor="#2c2722" />
          <stop offset="100%" stopColor="#171411" />
        </linearGradient>
        <radialGradient id="hws-anim-maw" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="75%" stopColor="#120302" />
          <stop offset="100%" stopColor="#3a0a05" />
        </radialGradient>
        <radialGradient id="hws-anim-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 170, 120, 0.95)" />
          <stop offset="22%" stopColor="rgba(239, 68, 38, 0.55)" />
          <stop offset="100%" stopColor="rgba(185, 28, 28, 0)" />
        </radialGradient>
      </defs>

      {/* Pescoço: vértebras de metal e cabos. */}
      <g>
        <path d="M168 380 C 160 430 150 470 142 520" stroke="#1c1916" strokeWidth={14} fill="none" />
        <path d="M232 380 C 242 430 250 470 262 520" stroke="#2a1510" strokeWidth={12} fill="none" />
        <rect x={188} y={380} width={24} height={140} fill="#2a2622" />
        {[400, 430, 460, 490].map((y) => (
          <rect key={y} x={180} y={y} width={40} height={10} rx={3} fill="#3a332d" stroke="#0d0b09" strokeWidth={2} />
        ))}
      </g>

      {/* Bocarra (atrás da mandíbula): aparece quando ela despenca. */}
      <path d={MAW} fill="url(#hws-anim-maw)" />
      <circle cx={200} cy={330} r={26} fill="none" stroke="#1d1512" strokeWidth={6} strokeDasharray="7 6" />

      {/* Mandíbula: desce e bate (CSS). */}
      <g className="hws-anim-jaw">
        <rect x={96} y={196} width={12} height={112} fill="#8c8379" stroke="#2d2823" strokeWidth={2} />
        <rect x={292} y={196} width={12} height={112} fill="#8c8379" stroke="#2d2823" strokeWidth={2} />
        <path
          d={MANDIBLE}
          fill="url(#hws-anim-metal)"
          stroke="#0d0b09"
          strokeWidth={3}
        />
        <ellipse cx={142} cy={380} rx={22} ry={11} fill="#6b3a1f" opacity={0.55} />
        <ellipse cx={256} cy={362} rx={15} ry={9} fill="#6b3a1f" opacity={0.5} />
        {LOWER_TEETH.map(([x, length]) =>
          length ? <rect key={x} x={x} y={292 - length} width={12} height={length + 2} rx={2} {...tooth} /> : null,
        )}
        {[
          [120, 302],
          [280, 302],
          [152, 408],
          [248, 408],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#7a7068" />
        ))}
        <circle cx={102} cy={300} r={9} fill="#5a5048" stroke="#0d0b09" strokeWidth={2} />
        <circle cx={298} cy={300} r={9} fill="#5a5048" stroke="#0d0b09" strokeWidth={2} />
        {JAW_WIRES.map(([path, color, frayed]) => (
          <Wire key={path} path={path} color={color} frayed={frayed} />
        ))}
      </g>

      {/* Crânio. */}
      <rect x={88} y={192} width={26} height={80} rx={4} fill="url(#hws-anim-metal)" stroke="#0d0b09" strokeWidth={2} />
      <rect x={286} y={192} width={26} height={80} rx={4} fill="url(#hws-anim-metal)" stroke="#0d0b09" strokeWidth={2} />
      <path
        d={DOME}
        fill="url(#hws-anim-dome)"
        stroke="#0d0b09"
        strokeWidth={3}
      />
      <ellipse cx={128} cy={84} rx={30} ry={15} fill="#7a3e1d" opacity={0.45} transform="rotate(-22 128 84)" />
      <ellipse cx={284} cy={140} rx={17} ry={26} fill="#7a3e1d" opacity={0.4} />
      <ellipse cx={108} cy={222} rx={13} ry={20} fill="#7a3e1d" opacity={0.4} />
      <path d="M252 70 Q 272 82 262 106 Q 248 92 252 70 Z" fill="#100d0b" opacity={0.75} />
      <path d="M200 36 L200 150" stroke="#100d0b" strokeWidth={3} />
      {[60, 90, 120].flatMap((y) => [190, 210].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3.2} fill="#8a7f74" />))}
      <polygon points="86,210 140,250 128,272 92,262" fill="#3a332d" stroke="#0d0b09" strokeWidth={2} />
      <polygon points="314,210 260,250 272,272 308,262" fill="#3a332d" stroke="#0d0b09" strokeWidth={2} />
      <circle cx={104} cy={246} r={3} fill="#8a7f74" />
      <circle cx={296} cy={246} r={3} fill="#8a7f74" />
      <circle cx={146} cy={178} r={40} fill="#050403" stroke="#6b6158" strokeWidth={8} />
      <circle cx={146} cy={178} r={30} fill="none" stroke="#1f1b17" strokeWidth={4} />
      <circle cx={254} cy={178} r={40} fill="#050403" stroke="#6b6158" strokeWidth={8} />
      <circle cx={254} cy={178} r={30} fill="none" stroke="#1f1b17" strokeWidth={4} />
      <path d="M118 150 L140 172 L132 190 M150 140 L156 168" stroke="#4b4540" strokeWidth={1.6} fill="none" />
      <path d="M140 216 C 138 236 144 250 140 268" stroke="#6b2f17" strokeWidth={3} opacity={0.6} fill="none" />
      <path d="M262 218 C 266 236 260 252 264 270" stroke="#6b2f17" strokeWidth={3} opacity={0.6} fill="none" />
      <rect x={186} y={212} width={8} height={30} rx={3} fill="#050403" />
      <rect x={206} y={212} width={8} height={30} rx={3} fill="#050403" />
      <rect x={104} y={248} width={192} height={14} rx={4} fill="#2b2621" stroke="#0d0b09" strokeWidth={2} />
      {UPPER_TEETH.map(([x, length]) =>
        length ? <rect key={x} x={x} y={258} width={12} height={length} rx={2} {...tooth} /> : null,
      )}
      {WIRES.map(([path, color, frayed]) => (
        <Wire key={path} path={path} color={color} frayed={frayed} />
      ))}

      {/* Silhueta escura por cima do corpo até o bote: contra a luz, só o vulto. Os olhos ficam por cima. */}
      <g className="hws-anim-shade" fill="#000" stroke="#000" strokeWidth={4}>
        <path d="M168 380 C 160 430 150 470 142 520" strokeWidth={16} fill="none" />
        <path d="M232 380 C 242 430 250 470 262 520" strokeWidth={14} fill="none" />
        <rect x={180} y={380} width={40} height={140} />
        <path d={MAW} />
        <g transform="translate(0 8)">
          <rect x={96} y={196} width={12} height={112} />
          <rect x={292} y={196} width={12} height={112} />
          <path d={MANDIBLE} />
          {JAW_WIRES.map(([wire]) => (
            <path key={wire} d={wire} strokeWidth={9} fill="none" />
          ))}
        </g>
        <rect x={88} y={192} width={26} height={80} rx={4} />
        <rect x={286} y={192} width={26} height={80} rx={4} />
        <path d={DOME} />
        {WIRES.map(([wire]) => (
          <path key={wire} d={wire} strokeWidth={9} fill="none" />
        ))}
      </g>
      <g className="hws-anim-eyes">
        <Eye cx={146} cy={178} />
        <Eye cx={254} cy={178} cracked />
      </g>
    </svg>
  )
}

/**
 * Rosto humano pálido e distorcido: maçãs fundas, órbitas pretas tortas com
 * olheiras, buraco do nariz, boca rasgada de orelha a orelha com dentes
 * tortos e cabelo molhado em mechas. Original.
 */
export function PaleFace() {
  const hair = { stroke: '#07080a', strokeLinecap: 'round' as const, fill: 'none' }
  const upperTeeth = [
    [100, 252, 12, -10],
    [114, 251, 16, -4],
    [128, 254, 11, 6],
    [146, 252, 18, -2],
    [164, 254, 13, 8],
    [180, 251, 17, -6],
    [196, 252, 12, 4],
  ]
  const lowerTeeth = [
    [118, 318, 14, 8],
    [138, 330, 16, -4],
    [160, 330, 15, 5],
    [178, 316, 13, -8],
  ]
  return (
    <svg viewBox="0 0 300 400" aria-hidden>
      <defs>
        <radialGradient id="hws-face-skin" cx="48%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#e4e7df" />
          <stop offset="40%" stopColor="#c3c8bc" />
          <stop offset="78%" stopColor="#848c80" />
          <stop offset="100%" stopColor="#3f463d" />
        </radialGradient>
        <radialGradient id="hws-face-void" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="62%" stopColor="#000" />
          <stop offset="85%" stopColor="#2a2430" />
          <stop offset="100%" stopColor="rgba(60, 44, 66, 0)" />
        </radialGradient>
        <radialGradient id="hws-face-maw" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="60%" stopColor="#0d0101" />
          <stop offset="100%" stopColor="#4a0b0b" />
        </radialGradient>
      </defs>
      <g {...hair} strokeWidth={9}>
        <path d="M150 14 C 96 12 58 60 50 140 C 44 210 40 300 26 392" />
        <path d="M150 14 C 206 12 244 60 252 140 C 258 214 262 300 276 392" />
      </g>
      <path
        d="M150 26 C 222 24 256 96 250 172 C 246 226 230 268 204 316 C 186 348 168 372 150 374 C 130 372 112 346 96 316 C 70 268 54 226 50 172 C 44 96 78 28 150 26 Z"
        fill="url(#hws-face-skin)"
        stroke="#2f352d"
        strokeWidth={1.5}
      />
      <path d="M58 196 C 74 236 92 250 112 254 C 96 232 82 214 58 196 Z" fill="rgba(40, 46, 38, 0.45)" />
      <path d="M244 192 C 230 234 212 250 190 254 C 206 230 220 212 244 192 Z" fill="rgba(40, 46, 38, 0.45)" />
      <g stroke="#5c6357" strokeWidth={1.3} fill="none" opacity={0.85}>
        <path d="M150 30 L146 52 L154 70 L147 94" />
        <path d="M224 84 L210 98 L216 114 L206 126" />
        <path d="M74 110 L88 124 L84 142" />
        <path d="M118 64 Q 150 56 184 66" />
      </g>
      <path d="M62 160 C 72 172 68 188 78 200" stroke="rgba(80, 100, 130, 0.45)" strokeWidth={2} fill="none" />
      <ellipse cx={104} cy={150} rx={42} ry={50} fill="rgba(58, 40, 64, 0.38)" transform="rotate(-14 104 150)" />
      <ellipse cx={200} cy={146} rx={46} ry={56} fill="rgba(58, 40, 64, 0.38)" transform="rotate(16 200 146)" />
      <g className="hws-face-socket">
        <path
          d="M76 140 C 82 110 122 104 134 130 C 142 150 132 184 108 190 C 86 194 70 170 76 140 Z"
          fill="url(#hws-face-void)"
        />
      </g>
      <g className="hws-face-socket">
        <path
          d="M166 132 C 172 98 222 92 232 124 C 240 152 226 196 196 200 C 170 202 160 166 166 132 Z"
          fill="url(#hws-face-void)"
        />
      </g>
      <path d="M100 188 C 98 214 104 232 98 262" stroke="#0a0a0c" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M204 198 C 208 222 202 240 208 270" stroke="#0a0a0c" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M150 168 L142 214 L150 222 L158 214 Z" fill="rgba(60, 66, 58, 0.35)" />
      <path d="M140 214 L136 230 L148 226 Z M160 214 L164 230 L152 226 Z" fill="#0d0d0f" />
      <g className="hws-face-mouth">
        <path
          d="M64 236 L80 244 L76 250 L96 254 L118 250 L134 256 L150 252 L166 256 L184 250 L206 254 L226 248 L222 242 L240 232 C 232 262 214 300 190 322 C 174 336 162 344 150 344 C 136 344 122 334 108 320 C 86 298 70 266 64 236 Z"
          fill="url(#hws-face-maw)"
          stroke="#2a0606"
          strokeWidth={2}
        />
        {upperTeeth.map(([x, y, h, r]) => (
          <path
            key={`u${x}`}
            d={`M${x} ${y} L${x + 7} ${y} L${x + 3} ${y + h} Z`}
            fill="#d9d3b8"
            transform={`rotate(${r} ${x + 3} ${y})`}
          />
        ))}
        {lowerTeeth.map(([x, y, h, r]) => (
          <path
            key={`l${x}`}
            d={`M${x} ${y} L${x + 7} ${y} L${x + 3} ${y - h} Z`}
            fill="#c9c2a4"
            transform={`rotate(${r} ${x + 3} ${y})`}
          />
        ))}
      </g>
      <g {...hair} strokeWidth={5}>
        <path d="M140 18 C 120 70 104 110 98 168" />
        <path d="M162 18 C 184 66 200 104 214 150" />
        <path d="M126 22 C 96 80 84 150 80 230" />
        <path d="M178 22 C 210 86 222 160 226 236" />
      </g>
    </svg>
  )
}

/** Chiado de fita VHS: grão, linhas, faixa de tracking e o letreiro da câmera. */
function Vhs({ late = false }: { late?: boolean }) {
  return (
    <>
      <div className={late ? 'hws-vhs-grain hws-vhs-grain--late' : 'hws-vhs-grain'} />
      <div className="hws-vhs-lines" />
      <div className="hws-vhs-roll" />
      {!late && (
        <>
          <div className="hws-vhs-osd">▶ PLAY</div>
          <div className="hws-vhs-osd hws-vhs-osd--date">31 OUT 2026 · 03:33</div>
        </>
      )}
    </>
  )
}

/**
 * 🤖 A tela escurece de repente; a lâmpada falha duas vezes e mostra, cada
 * vez mais perto, o vulto; os olhos acendem no escuro; e ele avança até
 * ocupar a tela inteira, tremendo, com a mandíbula batendo.
 */
export function AnimatronicScene() {
  return (
    <div className="hws-scary" style={{ '--hws-rush': `${ANIMATRONIC_RUSH_MS}ms` } as CSSProperties}>
      <div className="hws-anim-dark" />
      {ANIMATRONIC_FLASHES.map(({ at, ms }) => (
        <div
          key={at}
          className="hws-anim-light"
          style={{ '--hws-delay': `${at}ms`, '--hws-len': `${ms}ms` } as CSSProperties}
        />
      ))}
      <div className="hws-anim-stage">
        <div className="hws-anim-tear">
          <div className="hws-anim-bot">
            <div className="hws-anim-far">
              <div className="hws-anim-rush">
                <Animatronic />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Vhs />
    </div>
  )
}

/** 👁️ Meio segundo de tela preta e silêncio... e o rosto explode na tela. */
export function FaceScene() {
  return (
    <div className="hws-scary" style={{ '--hws-hit': `${FACE_HIT_MS}ms` } as CSSProperties}>
      <div className="hws-face-black" />
      <div className="hws-face-stage">
        <div className="hws-face-burst">
          <div className="hws-face-jitter">
            <PaleFace />
          </div>
        </div>
      </div>
      <Vhs late />
    </div>
  )
}

/**
 * A rastejante, vista de frente vindo pelo chão: cabelo preto molhado
 * caindo por cima da cara, cabeça torta, olhos pretos enormes, boca aberta
 * demais e braços compridos e finos dobrados como pernas de aranha. Original.
 * O ponto de escala (o meio da cara) fica em 50% 47% do desenho.
 */
function Crawler() {
  const limb = { stroke: '#2a2d29', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  const hair = { stroke: '#050506', strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="0 0 400 320" aria-hidden>
      <defs>
        <radialGradient id="hws-crawl-skin" cx="46%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#c9cfc2" />
          <stop offset="55%" stopColor="#8d968a" />
          <stop offset="100%" stopColor="#3b4239" />
        </radialGradient>
        <radialGradient id="hws-crawl-void" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="70%" stopColor="#000" />
          <stop offset="100%" stopColor="rgba(20, 16, 22, 0)" />
        </radialGradient>
      </defs>
      {/* Sombra no chão e o corpo (as costas curvadas atrás da cabeça). */}
      <ellipse cx={200} cy={292} rx={170} ry={22} fill="rgba(0, 0, 0, 0.55)" />
      <ellipse cx={200} cy={118} rx={92} ry={58} fill="#141614" />
      <path d="M140 150 Q 200 120 260 150 L 250 210 Q 200 226 150 210 Z" fill="#1b1d1a" />
      {/* Braços: ombro → cotovelo lá em cima → mão espalmada no chão. */}
      <g {...limb} strokeWidth={13}>
        <path d="M150 170 L 70 92 L 34 282" />
        <path d="M250 170 L 334 86 L 368 280" />
      </g>
      <g {...limb} strokeWidth={4} stroke="#4a5047">
        <path d="M34 282 l -26 10 M34 282 l -16 22 M34 282 l 2 26 M34 282 l 18 20" />
        <path d="M368 280 l 26 12 M368 280 l 16 22 M368 280 l -2 26 M368 280 l -18 20" />
      </g>
      <circle cx={70} cy={92} r={9} fill="#2a2d29" />
      <circle cx={334} cy={86} r={9} fill="#2a2d29" />
      {/* Cabeça torta. */}
      <g transform="rotate(-14 200 150)">
        <path
          d="M200 74 C 246 74 266 112 262 158 C 258 200 236 236 200 240 C 164 236 142 200 138 158 C 134 112 154 74 200 74 Z"
          fill="url(#hws-crawl-skin)"
        />
        <ellipse cx={176} cy={146} rx={19} ry={25} fill="url(#hws-crawl-void)" />
        <ellipse cx={226} cy={142} rx={21} ry={28} fill="url(#hws-crawl-void)" />
        <circle cx={226} cy={146} r={2.6} fill="#e9e6da" opacity={0.75} />
        <g className="hws-crawl-mouth">
          <ellipse cx={203} cy={204} rx={17} ry={30} fill="#050101" stroke="#2b0707" strokeWidth={2} />
        </g>
        <path d="M168 172 C 166 190 172 204 166 226" stroke="#0a0a0c" strokeWidth={3} fill="none" />
        {/* Cabelo molhado caindo por cima do rosto. */}
        <g {...hair} strokeWidth={7}>
          <path d="M200 70 C 170 86 150 140 146 250" />
          <path d="M200 70 C 230 86 252 140 256 250" />
          <path d="M196 72 C 186 110 190 150 182 268" />
          <path d="M206 72 C 220 112 214 150 222 262" />
        </g>
        <g {...hair} strokeWidth={4}>
          <path d="M190 74 C 160 120 166 190 156 282" />
          <path d="M212 74 C 244 120 238 190 248 284" />
          <path d="M200 74 C 200 130 196 200 200 300" />
          <path d="M180 78 C 150 130 140 200 134 270" />
          <path d="M222 78 C 252 130 262 200 268 270" />
        </g>
      </g>
    </svg>
  )
}

/** Letreiro de câmera de segurança (o REC pisca devagar, 1 vez por segundo). */
function CamOsd({ label }: { label: string }) {
  return (
    <>
      <div className="hws-vhs-osd">{label}</div>
      <div className="hws-vhs-osd hws-cam-rec">● REC</div>
      <div className="hws-vhs-osd hws-vhs-osd--date">31 OUT 2026 · 03:33</div>
    </>
  )
}

/**
 * 🌑 A TV "desliga" como TV de tubo (a imagem vira uma linha e um ponto).
 * Escuro total e silêncio. Alguém respira colado no ouvido. Um coração.
 * Dois pontinhos vermelhos abrem lá longe e chegam mais perto... e, quando
 * todo mundo já está achando que é só isso, o rosto explode na tela.
 */
export function ApagaoScene() {
  return (
    <div
      className="hws-scary"
      style={
        {
          '--hws-off': `${APAGAO_OFF_MS}ms`,
          '--hws-eyes': `${APAGAO_EYES_MS}ms`,
          '--hws-hit': `${APAGAO_HIT_MS}ms`,
        } as CSSProperties
      }
    >
      <div className="hws-apagao-black" />
      <div className="hws-apagao-crt" />
      <div className="hws-apagao-dot" />
      <div className="hws-apagao-eyes">
        <span />
        <span />
      </div>
      <div className="hws-apagao-text">não se mexa</div>
      <div className="hws-face-stage">
        <div className="hws-face-burst">
          <div className="hws-face-jitter">
            <PaleFace />
          </div>
        </div>
      </div>
      <div className="hws-apagao-blood" />
      <Vhs late />
    </div>
  )
}

/**
 * 🕸️ Câmera do corredor, de madrugada. Lá no fundo, uma coisa de quatro.
 * A imagem engasga e ela já está mais perto — cada vez mais rápido — até
 * saltar da tela com a boca escancarada.
 */
export function RastejanteScene() {
  return (
    <div className="hws-scary" style={{ '--hws-lunge': `${RASTEJANTE_LUNGE_MS}ms` } as CSSProperties}>
      <div className="hws-crawl-room">
        <i className="hws-crawl-floor" />
        <i className="hws-crawl-wall hws-crawl-wall--l" />
        <i className="hws-crawl-wall hws-crawl-wall--r" />
        <i className="hws-crawl-far" />
      </div>
      <div className="hws-crawl-stage">
        <div className="hws-crawl-bot">
          <div className="hws-crawl-steps">
            <div className="hws-crawl-rush">
              <Crawler />
            </div>
          </div>
        </div>
      </div>
      <div className="hws-crawl-tint" />
      <div className="hws-vhs-grain" style={{ '--hws-rush': `${RASTEJANTE_LUNGE_MS}ms` } as CSSProperties} />
      <div className="hws-vhs-lines" />
      <div className="hws-vhs-roll" />
      <CamOsd label="CAM 03 · CORREDOR" />
    </div>
  )
}
