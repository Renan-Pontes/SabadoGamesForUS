import type { CSSProperties } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

/**
 * Enfeites de Natal das telas fora de jogo (só SVG + CSS, nada de canvas:
 * as TVs são fraquinhas). As animações são as do index.css (popIn,
 * ornamentSwing, hop, twinkle).
 */

/** Entrada de enfeite na árvore: quica ao aparecer. */
const POP_IN: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
  animation: 'popIn 650ms cubic-bezier(0.2, 1.4, 0.4, 1) both',
}

/**
 * Ganchos da árvore: 15 lugares (a mesa vai até 15), de cima para baixo,
 * espalhados pelas três saias do pinheiro.
 */
const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [60, 44], [48, 52], [72, 52],
  [40, 70], [60, 66], [80, 70], [52, 82], [70, 84], [32, 86], [88, 86],
  [24, 112], [44, 104], [62, 110], [80, 104], [96, 112],
]

type ChristmasTreeProps = {
  /** Uma cor por pessoa na mesa: cada uma vira uma bola pendurada. */
  ornaments: readonly string[]
  /** Estrela acesa de verdade (ex.: todo mundo pronto). */
  lit?: boolean
  /** Altura do desenho (valor CSS). */
  height?: string
  sx?: SxProps<Theme>
}

/**
 * Pinheiro que ganha uma bola a cada pessoa que entra na sala. Os ganchos
 * vazios aparecem bem de leve — dá para ver que ainda cabe gente.
 *
 *   <ChristmasTree ornaments={players.map((p) => playerColor(p.id))} lit={everyoneReady} />
 */
export function ChristmasTree({ ornaments, lit = false, height = '140px', sx }: ChristmasTreeProps) {
  const filled = ornaments.slice(0, SLOTS.length)
  return (
    <Box
      component="svg"
      viewBox="0 0 120 146"
      aria-label={`Árvore com ${filled.length} ${filled.length === 1 ? 'enfeite' : 'enfeites'}`}
      role="img"
      sx={[{ height, width: 'auto', display: 'block', overflow: 'visible' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {/* Tronco e vaso */}
      <rect x="53" y="124" width="14" height="10" fill="#6b3f22" />
      <path d="M44 132 H76 L72 146 H48 Z" fill="#c21f33" />
      <rect x="44" y="132" width="32" height="3" fill="#f5c242" />

      {/* Três saias do pinheiro, com neve nas pontas */}
      <path d="M60 62 L112 126 H8 Z" fill="#14603a" />
      <path d="M60 34 L98 92 H22 Z" fill="#187a47" />
      <path d="M60 12 L85 56 H35 Z" fill="#1f9d55" />
      <path d="M8 126 Q20 120 30 124 Q42 118 54 124 Q66 118 78 124 Q90 118 100 123 Q106 121 112 126 Z" fill="#eef6ff" opacity="0.9" />
      <path d="M22 92 Q32 86 42 90 Q52 84 62 90 Q74 84 84 89 Q92 86 98 92 Z" fill="#eef6ff" opacity="0.85" />
      <path d="M35 56 Q44 51 52 55 Q60 50 68 55 Q77 51 85 56 Z" fill="#eef6ff" opacity="0.8" />

      {/* Festão dourado */}
      <path d="M40 48 Q60 60 80 46" stroke="#f5c242" strokeWidth="1.6" fill="none" opacity="0.85" />
      <path d="M30 80 Q60 98 90 78" stroke="#f5c242" strokeWidth="1.6" fill="none" opacity="0.85" />
      <path d="M18 108 Q60 128 102 106" stroke="#f5c242" strokeWidth="1.6" fill="none" opacity="0.85" />

      {/* Ganchos vazios */}
      {SLOTS.slice(filled.length).map(([x, y]) => (
        <circle key={`hook-${x}-${y}`} cx={x} cy={y} r="1.8" fill="rgba(255,255,255,0.28)" />
      ))}

      {/* Uma bola por pessoa (a key pela posição: quem entra depois quica sozinho) */}
      {filled.map((color, index) => {
        const [x, y] = SLOTS[index]
        return (
          <g key={`ornament-${index}`} style={POP_IN}>
            <rect x={x - 1.6} y={y - 7.4} width="3.2" height="2.4" rx="0.6" fill="#f5c242" />
            <circle cx={x} cy={y} r="5.4" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
            <circle cx={x - 1.8} cy={y - 1.8} r="1.5" fill="rgba(255,255,255,0.7)" />
          </g>
        )
      })}

      {/* Estrela no topo */}
      <path
        className="animate-twinkle"
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          filter: lit ? 'drop-shadow(0 0 6px #ffd975) drop-shadow(0 0 14px #f5c242)' : 'drop-shadow(0 0 3px #f5c242)',
        }}
        d="M60 0 L63.5 8 L72 8.6 L65.5 14 L67.6 22.4 L60 17.8 L52.4 22.4 L54.5 14 L48 8.6 L56.5 8 Z"
        fill={lit ? '#ffe28a' : '#f5c242'}
      />
    </Box>
  )
}

type OrnamentShape = 'ball' | 'star' | 'bell'

/** Bola, estrela ou sino pendurado, desenhado em volta de (20, 20). */
function OrnamentSvg({ shape, color, size }: { shape: OrnamentShape; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {shape === 'ball' && (
        <>
          <rect x="16" y="2" width="8" height="6" rx="1.5" fill="#f5c242" />
          <circle cx="20" cy="22" r="15" fill={color} />
          <path d="M6 20 Q20 26 34 20" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" fill="none" />
          <circle cx="14" cy="16" r="3.6" fill="rgba(255,255,255,0.6)" />
        </>
      )}
      {shape === 'star' && (
        <path
          d="M20 3 L25 14 L37 15 L28 23 L31 35 L20 29 L9 35 L12 23 L3 15 L15 14 Z"
          fill={color}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />
      )}
      {shape === 'bell' && (
        <>
          <path d="M20 4 C 11 4 10 14 9 24 L6 30 H34 L31 24 C 30 14 29 4 20 4 Z" fill={color} />
          <circle cx="20" cy="33" r="4" fill="#c48a12" />
          <path d="M14 6 Q20 2 26 6" stroke="#4fd67e" strokeWidth="3" fill="none" />
        </>
      )}
    </svg>
  )
}

type Hanging = {
  left: string
  string: number
  shape: OrnamentShape
  color: string
  size: number
  /** Escondido no celular (para não cobrir a marca). */
  wide?: boolean
}

const HANGING: Hanging[] = [
  { left: '3%', string: 34, shape: 'ball', color: '#e8394a', size: 34 },
  { left: '11%', string: 78, shape: 'star', color: '#f5c242', size: 30, wide: true },
  { left: '19%', string: 22, shape: 'bell', color: '#f5c242', size: 30, wide: true },
  { left: '79%', string: 60, shape: 'ball', color: '#4fd67e', size: 32, wide: true },
  { left: '88%', string: 26, shape: 'star', color: '#ffd975', size: 28, wide: true },
  { left: '95%', string: 52, shape: 'ball', color: '#5ab4ff', size: 30 },
]

/**
 * Enfeites pendurados no topo da tela, balançando. O pai precisa ser
 * `position: relative`; não recebe clique.
 */
export function HangingOrnaments({ zIndex = 0 }: { zIndex?: number }) {
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: '0 0 auto 0', height: 0, pointerEvents: 'none', zIndex }}>
      {HANGING.map((item, index) => (
        <Box
          key={index}
          sx={{
            position: 'absolute',
            top: 0,
            left: item.left,
            display: item.wide ? { xs: 'none', md: 'flex' } : 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transformOrigin: 'top center',
            animation: `ornamentSwing ${2.6 + (index % 3) * 0.5}s ease-in-out infinite`,
            animationDelay: `${-index * 0.45}s`,
            filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))',
          }}
        >
          <Box sx={{ width: '2px', height: item.string, background: 'rgba(244, 248, 255, 0.45)' }} />
          <OrnamentSvg shape={item.shape} color={item.color} size={Math.round(item.size * 1.4)} />
        </Box>
      ))}
    </Box>
  )
}

/** Presente com fita e laço. */
export function GiftSvg({ box, ribbon, size = 44 }: { box: string; ribbon: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <rect x="4" y="16" width="36" height="26" rx="3" fill={box} />
      <rect x="2" y="11" width="40" height="8" rx="2" fill={box} stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      <rect x="19" y="11" width="6" height="31" fill={ribbon} />
      <path d="M22 11 C 14 2 6 6 12 11 Z M22 11 C 30 2 38 6 32 11 Z" fill={ribbon} />
      <circle cx="22" cy="11" r="2.6" fill={ribbon} />
    </svg>
  )
}

const GIFTS = [
  { box: '#e8394a', ribbon: '#f5c242', size: 40 },
  { box: '#1f9d55', ribbon: '#f4f8ff', size: 52 },
  { box: '#2f7fd9', ribbon: '#ff5a66', size: 36 },
  { box: '#f5c242', ribbon: '#c21f33', size: 46 },
  { box: '#ff8fd0', ribbon: '#1f9d55', size: 34 },
]

/** Pilha de presentes pulando, um de cada vez. */
export function GiftPile({ scale = 1, sx }: { scale?: number; sx?: SxProps<Theme> }) {
  return (
    <Box
      aria-hidden
      sx={[
        { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: `${10 * scale}px`, pointerEvents: 'none' },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {GIFTS.map((gift, index) => (
        <Box
          key={index}
          sx={{
            animation: 'hop 2.4s ease-in-out infinite',
            animationDelay: `${index * 0.32}s`,
            transformOrigin: 'bottom center',
          }}
        >
          <GiftSvg box={gift.box} ribbon={gift.ribbon} size={gift.size * scale} />
        </Box>
      ))}
    </Box>
  )
}
