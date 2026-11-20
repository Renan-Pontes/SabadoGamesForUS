import { useId, type CSSProperties } from 'react'
import { PART_BY_ID, type BoxShape, type PartDef } from './content'
import './fp.css'

/**
 * Desenhos da fábrica (SVG, sem imagem): o presente sendo montado peça por
 * peça, o ícone de cada peça (botões do celular e o pedido na TV), o trenó e
 * o lixo da bagunça.
 */

const CARDBOARD = '#c98b4f'
const CARDBOARD_DARK = '#7a4a1f'

type Geom = { x: number; y: number; w: number; h: number; round: boolean }

const GEOMS: Record<BoxShape, Geom> = {
  quadrada: { x: 28, y: 50, w: 64, h: 62, round: false },
  redonda: { x: 26, y: 56, w: 68, h: 54, round: true },
  gigante: { x: 12, y: 36, w: 96, h: 78, round: false },
  comprida: { x: 6, y: 72, w: 108, h: 42, round: false },
}

function safeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '')
}

function starPoints(cx: number, cy: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

function PaperPattern({ id, part }: { id: string; part: PartDef }) {
  const base = part.color
  const second = part.color2 ?? '#ffffff'
  switch (part.pattern) {
    case 'xadrez':
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill={base} />
          <rect width="8" height="16" fill={second} opacity="0.55" />
          <rect width="16" height="8" fill={second} opacity="0.55" />
          <rect x="11" width="1.4" height="16" fill="#fff6dc" opacity="0.5" />
          <rect y="11" width="16" height="1.4" fill="#fff6dc" opacity="0.5" />
        </pattern>
      )
    case 'listrado':
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill={base} />
          <rect width="6" height="14" fill={second} />
        </pattern>
      )
    case 'bolinhas':
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill={base} />
          <circle cx="4" cy="4" r="2.6" fill={second} />
          <circle cx="11" cy="11" r="2.6" fill={second} />
        </pattern>
      )
    case 'estrelas':
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill={base} />
          <polygon points={starPoints(6, 6, 4.2)} fill={second} />
          <polygon points={starPoints(16.5, 16, 3.2)} fill={second} opacity="0.85" />
        </pattern>
      )
    default:
      return (
        <pattern id={id} width="26" height="20" patternUnits="userSpaceOnUse">
          <rect width="26" height="20" fill={base} />
          <rect x="2" y="2" width="10" height="5" fill={second} opacity="0.55" />
          <rect x="14" y="3" width="10" height="1.2" fill={second} opacity="0.5" />
          <rect x="14" y="6" width="10" height="1.2" fill={second} opacity="0.5" />
          <rect x="2" y="10" width="22" height="1.2" fill={second} opacity="0.45" />
          <rect x="2" y="13" width="22" height="1.2" fill={second} opacity="0.45" />
          <rect x="2" y="16" width="16" height="1.2" fill={second} opacity="0.45" />
        </pattern>
      )
  }
}

function Bow({ cx, cy, color, scale = 1 }: { cx: number; cy: number; color: string; scale?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <path d="M-3,4 L-10,20 L-5,18 L-2,22 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M3,4 L10,20 L5,18 L2,22 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <ellipse cx="-12" cy="-2" rx="13" ry="8.5" transform="rotate(-24 -12 -2)" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
      <ellipse cx="12" cy="-2" rx="13" ry="8.5" transform="rotate(24 12 -2)" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
      <ellipse cx="-12" cy="-2" rx="6" ry="3.4" transform="rotate(-24 -12 -2)" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="12" cy="-2" rx="6" ry="3.4" transform="rotate(24 12 -2)" fill="rgba(0,0,0,0.18)" />
      <circle r="5.5" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
      <circle cx="-1.6" cy="-1.8" r="1.6" fill="rgba(255,255,255,0.55)" />
    </g>
  )
}

function Tag({ x, y, part, angle = 12 }: { x: number; y: number; part: PartDef; angle?: number }) {
  const words = (part.text ?? '').split(' ')
  const first = words.slice(0, 2).join(' ')
  const second = words.slice(2).join(' ')
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d="M0,0 L36,0 L36,22 L0,22 L-7,11 Z" fill={part.color} stroke="#b08a4a" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="-2" cy="11" r="1.8" fill="#b08a4a" />
      <text x="17" y={second ? 9.5 : 14} textAnchor="middle" fontSize="7" fontWeight="700" fill="#5a1620" fontFamily="Fredoka, sans-serif">
        {first}
      </text>
      {second && (
        <text x="17" y="18" textAnchor="middle" fontSize="6" fontWeight="700" fill="#5a1620" fontFamily="Fredoka, sans-serif">
          {second.length > 11 ? `${second.slice(0, 10)}…` : second}
        </text>
      )}
    </g>
  )
}

/**
 * O presente na bancada: o contorno da caixa do pedido (tracejado até a
 * caixa chegar) e, por cima, o que já entrou — papel, laço, etiqueta.
 */
export function GiftArt({
  parts,
  box,
  size = 160,
  style,
  className,
}: {
  /** Peças já colocadas (qualquer ordem). */
  parts: readonly string[]
  /** A caixa do pedido (para o contorno antes de ela chegar). */
  box?: string | null
  size?: number | string
  style?: CSSProperties
  className?: string
}) {
  const uid = safeId(useId())
  const placed = parts.map((id) => PART_BY_ID[id]).filter(Boolean)
  const boxPart = placed.find((part) => part.cat === 'caixa')
  const paper = placed.find((part) => part.cat === 'papel')
  const bow = placed.find((part) => part.cat === 'laco')
  const tag = placed.find((part) => part.cat === 'etiqueta')
  const shape = boxPart?.shape ?? (box ? PART_BY_ID[box]?.shape : undefined) ?? 'quadrada'
  const g = GEOMS[shape]
  const cx = g.x + g.w / 2
  const fill = paper ? `url(#p${uid})` : boxPart ? CARDBOARD : 'rgba(255,255,255,0.05)'
  const stroke = boxPart ? CARDBOARD_DARK : 'rgba(255,255,255,0.55)'
  const dash = boxPart ? undefined : '6 5'
  const lidY = g.round ? g.y : g.y - 6
  const body = g.round
    ? `M${g.x},${g.y} L${g.x},${g.y + g.h} A${g.w / 2},9 0 0 0 ${g.x + g.w},${g.y + g.h} L${g.x + g.w},${g.y} Z`
    : null
  return (
    <svg
      viewBox="0 0 120 130"
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      <defs>
        {paper && <PaperPattern id={`p${uid}`} part={paper} />}
        <linearGradient id={`s${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {/* sombra no chão */}
      <ellipse cx={cx} cy={g.y + g.h + 8} rx={g.w / 2 + 4} ry="5" fill="rgba(0,0,0,0.28)" />
      {body ? (
        <>
          <path d={body} fill={fill} stroke={stroke} strokeWidth="2.4" strokeDasharray={dash} />
          {boxPart && <path d={body} fill={`url(#s${uid})`} />}
          <ellipse cx={cx} cy={g.y} rx={g.w / 2 + 3} ry="9" fill={fill} stroke={stroke} strokeWidth="2.4" strokeDasharray={dash} />
        </>
      ) : (
        <>
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="4" fill={fill} stroke={stroke} strokeWidth="2.4" strokeDasharray={dash} />
          {boxPart && <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="4" fill={`url(#s${uid})`} />}
          <rect x={g.x - 4} y={lidY} width={g.w + 8} height="12" rx="3" fill={fill} stroke={stroke} strokeWidth="2.4" strokeDasharray={dash} />
          {boxPart && <rect x={g.x - 4} y={lidY} width={g.w + 8} height="12" rx="3" fill="rgba(0,0,0,0.12)" />}
        </>
      )}
      {!boxPart && (
        <text x={cx} y={g.y + g.h / 2 + 8} textAnchor="middle" fontSize="22" fill="rgba(255,255,255,0.55)" fontFamily="Fredoka, sans-serif" fontWeight="700">
          ?
        </text>
      )}
      {bow && (
        <>
          <rect x={cx - 5} y={lidY} width="10" height={g.y + g.h - lidY + (g.round ? 8 : 0)} fill={bow.color} opacity="0.95" />
          {!g.round && <rect x={g.x} y={g.y + g.h * 0.5 - 5} width={g.w} height="10" fill={bow.color} opacity="0.95" />}
          <Bow cx={cx} cy={lidY - 6} color={bow.color} />
        </>
      )}
      {tag && <Tag x={g.x + g.w - 18} y={g.y + 6} part={tag} />}
    </svg>
  )
}

/** Ícone de uma peça (botão do celular, linha do pedido na TV). */
export function PartIcon({ part, size = 48 }: { part: string; size?: number | string }) {
  const uid = safeId(useId())
  const def = PART_BY_ID[part]
  if (!def) return null
  if (def.cat === 'caixa') return <GiftArt parts={[part]} size={size} />
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {def.cat === 'papel' && (
        <>
          <defs>
            <PaperPattern id={`p${uid}`} part={def} />
          </defs>
          <path d="M6,8 L42,6 L40,38 Q30,44 22,38 Q14,34 8,40 Z" fill={`url(#p${uid})`} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8,40 Q14,34 22,38 Q18,42 12,44 Z" fill="rgba(255,255,255,0.35)" />
        </>
      )}
      {def.cat === 'laco' && <Bow cx={24} cy={22} color={def.color} scale={1.25} />}
      {def.cat === 'etiqueta' && <Tag x={10} y={12} part={def} angle={-8} />}
    </svg>
  )
}

/** O trenó do Papai Noel com os presentes entregues empilhados. */
export function Sleigh({ count, size = 120, colors }: { count: number; size?: number | string; colors?: readonly string[] }) {
  const palette = colors?.length ? colors : ['#e8394a', '#2fbf6a', '#f5c242', '#4aa8ff', '#ff8c95']
  const shown = Math.min(count, 7)
  const slots = [
    [36, 34], [56, 34], [76, 34], [46, 20], [66, 20], [56, 6], [86, 40],
  ]
  return (
    <svg viewBox="0 0 120 80" width={size} height={typeof size === 'number' ? size * (80 / 120) : undefined} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {slots.slice(0, shown).map(([x, y], index) => (
        <g key={index}>
          <rect x={x - 9} y={y} width="18" height="15" rx="2" fill={palette[index % palette.length]} stroke="rgba(0,0,0,0.3)" />
          <rect x={x - 1.5} y={y} width="3" height="15" fill="#fff6dc" opacity="0.85" />
          <circle cx={x} cy={y - 1} r="2.4" fill="#fff6dc" />
        </g>
      ))}
      <path d="M14,46 Q14,64 34,64 L96,64 Q108,64 110,52 L104,48 L22,48 Q18,48 18,40 Z" fill="#c21f33" stroke="#7d0f1c" strokeWidth="2" />
      <path d="M26,52 L98,52" stroke="#f5c242" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8,72 Q20,76 60,74 L104,74 Q116,74 116,62" fill="none" stroke="#f5c242" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M34,64 L30,74 M88,64 L92,74" stroke="#f5c242" strokeWidth="2.6" />
    </svg>
  )
}

/** O lixo da bagunça (bolinhas de papel amassado aparecem conforme cresce). */
export function TrashBin({ count, size = 70 }: { count: number; size?: number | string }) {
  const balls = Math.min(count, 5)
  const spots = [[22, 14], [36, 10], [30, 4], [16, 6], [42, 4]]
  const colors = ['#e8394a', '#2fbf6a', '#f5c242', '#4aa8ff', '#fff6dc']
  return (
    <svg viewBox="0 0 60 70" width={size} height={size} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      {spots.slice(0, balls).map(([x, y], index) => (
        <circle key={index} cx={x} cy={y + 6} r="6" fill={colors[index]} stroke="rgba(0,0,0,0.35)" strokeDasharray="3 2" />
      ))}
      <rect x="8" y="16" width="44" height="6" rx="2" fill="#8aa0bf" />
      <path d="M11,22 L49,22 L45,66 L15,66 Z" fill="#5f7392" stroke="#3d4d66" strokeWidth="1.6" />
      <path d="M22,28 L23,60 M30,28 L30,60 M38,28 L37,60" stroke="#3d4d66" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
