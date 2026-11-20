import { useId, type CSSProperties, type ReactNode } from 'react'
import { getAvatar, type AvatarId, type AvatarInfo } from './avatars'
import './avatars.css'

/*
 * Os 15 avatares de Natal, em SVG puro (viewBox 64×64, círculo de fundo na
 * cor da pessoa). Formas grandes e poucas: precisam ler a 28 px no celular
 * e a 120 px na TV.
 */

const SKIN = '#ffd9b8'
const INK = '#23203a'
const WHITE = '#ffffff'
const SNOW = '#eef2f8'
const RED = '#e8394a'
const DRED = '#b8202f'
const GREEN = '#1f9d55'
const GOLD = '#f5c242'
const DGOLD = '#c48a12'
const BROWN = '#7a4a26'
const CHEEK = 'rgba(255, 105, 130, 0.45)'

/** Olhos (piscam juntos). `sclera` desenha o branco em volta. */
function Eyes({ y, dx = 5, r = 2.3, sclera }: { y: number; dx?: number; r?: number; sclera?: number }) {
  return (
    <g className="xa-blink">
      {sclera && (
        <>
          <circle cx={32 - dx} cy={y} r={sclera} fill={WHITE} />
          <circle cx={32 + dx} cy={y} r={sclera} fill={WHITE} />
        </>
      )}
      <circle cx={32 - dx} cy={y + (sclera ? 0.4 : 0)} r={r} fill={INK} />
      <circle cx={32 + dx} cy={y + (sclera ? 0.4 : 0)} r={r} fill={INK} />
      <circle cx={32 - dx + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill={WHITE} />
      <circle cx={32 + dx + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill={WHITE} />
    </g>
  )
}

function Cheeks({ y, dx = 8, r = 2.4, fill = CHEEK }: { y: number; dx?: number; r?: number; fill?: string }) {
  return (
    <>
      <circle cx={32 - dx} cy={y} r={r} fill={fill} />
      <circle cx={32 + dx} cy={y} r={r} fill={fill} />
    </>
  )
}

function Smile({ y, w = 4, color = INK }: { y: number; w?: number; color?: string }) {
  return (
    <path
      d={`M${32 - w} ${y} Q32 ${y + w * 0.9} ${32 + w} ${y}`}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      fill="none"
    />
  )
}

const ART: Record<AvatarId, () => ReactNode> = {
  noel: () => (
    <>
      <circle cx={32} cy={36} r={12} fill={SKIN} />
      <path d="M19 37 Q19 57 32 58 Q45 57 45 37 Q40 45 32 45 Q24 45 19 37 Z" fill={WHITE} />
      <path d="M17 28 C19 13 33 6 46 12 L42 17 C45 20 46.5 24 47 28 Z" fill={RED} />
      <rect x={15} y={24} width={34} height={7} rx={3.5} fill={WHITE} />
      <circle cx={47} cy={13} r={4.5} fill={WHITE} />
      <Cheeks y={38.5} dx={8.5} />
      <Eyes y={34.5} />
      <circle cx={32} cy={38.6} r={2.4} fill="#ff9a8a" />
      <path d="M24 43 Q28 39 32 42 Q36 39 40 43 Q36 46 32 44 Q28 46 24 43 Z" fill={SNOW} />
    </>
  ),
  'mamae-noel': () => (
    <>
      <circle cx={19} cy={41} r={6.5} fill={SNOW} />
      <circle cx={45} cy={41} r={6.5} fill={SNOW} />
      <circle cx={32} cy={38} r={12.5} fill={SKIN} />
      <path d="M19.5 35 Q21 24 32 24 Q43 24 44.5 35 Q38 29 32 29 Q26 29 19.5 35 Z" fill={SNOW} />
      <path d="M20 27 Q32 4 44 27 Z" fill={RED} />
      <rect x={18} y={24} width={28} height={6} rx={3} fill={WHITE} />
      <circle cx={32} cy={15} r={3.5} fill={WHITE} />
      <Cheeks y={43} dx={9} />
      <Eyes y={37.5} dx={5} r={1.9} />
      <g fill="none" stroke={DGOLD} strokeWidth={1.6}>
        <circle cx={27} cy={37.5} r={4.3} />
        <circle cx={37} cy={37.5} r={4.3} />
        <path d="M31.3 37.5 H32.7" />
      </g>
      <Smile y={44} w={3.5} />
    </>
  ),
  rena: () => (
    <>
      <g stroke={BROWN} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M25 27 L19 14 M21.6 19.5 L14 17 M20 15.5 L22 9" />
        <path d="M39 27 L45 14 M42.4 19.5 L50 17 M44 15.5 L42 9" />
      </g>
      <ellipse cx={19} cy={31} rx={5.5} ry={3} fill="#a0673d" transform="rotate(-25 19 31)" />
      <ellipse cx={45} cy={31} rx={5.5} ry={3} fill="#a0673d" transform="rotate(25 45 31)" />
      <ellipse cx={32} cy={38} rx={12} ry={13.5} fill="#a0673d" />
      <ellipse cx={32} cy={46} rx={8} ry={6.5} fill="#d9a476" />
      <Eyes y={35} />
      <circle cx={32} cy={43.5} r={4.6} fill={RED} />
      <circle cx={30.4} cy={42} r={1.4} fill="rgba(255,255,255,0.75)" />
      <Smile y={48.6} w={2.6} />
    </>
  ),
  duende: () => (
    <>
      <path d="M21.5 36 L11 30 L22 43 Z" fill={SKIN} />
      <path d="M42.5 36 L53 30 L42 43 Z" fill={SKIN} />
      <circle cx={32} cy={38.5} r={11.5} fill={SKIN} />
      <path d="M19 31 Q24 14 41 7 Q37 18 45 31 Z" fill={RED} />
      <rect x={17} y={28} width={30} height={6} rx={3} fill={GOLD} />
      <circle cx={41} cy={7} r={3.2} fill={GOLD} />
      <Cheeks y={43} dx={7.5} />
      <Eyes y={38.5} dx={4.5} />
      <Smile y={44} w={3.4} />
    </>
  ),
  boneco: () => (
    <>
      <circle cx={32} cy={58} r={15} fill={WHITE} stroke="rgba(30,70,110,0.18)" />
      <circle cx={32} cy={31} r={11.5} fill={WHITE} stroke="rgba(30,70,110,0.18)" />
      <rect x={20} y={40} width={24} height={5} rx={2.5} fill={RED} />
      <rect x={36} y={42} width={5} height={11} rx={2} fill={DRED} />
      <rect x={23} y={8} width={18} height={13} rx={1.5} fill={INK} />
      <rect x={23} y={16} width={18} height={2.6} fill={RED} />
      <rect x={18.5} y={19.5} width={27} height={3.5} rx={1.5} fill={INK} />
      <Eyes y={29.5} dx={4.5} r={2.1} />
      <path d="M32 32 L42.5 34.6 L32 35.8 Z" fill="#ff8a1f" />
      <g fill={INK}>
        <circle cx={27} cy={38} r={1} />
        <circle cx={30.2} cy={39.2} r={1} />
        <circle cx={33.8} cy={39.2} r={1} />
        <circle cx={37} cy={38} r={1} />
      </g>
    </>
  ),
  pinguim: () => (
    <>
      <ellipse cx={32} cy={45} rx={17} ry={20} fill="#26304a" />
      <path d="M32 33 C26 26 17 29 18 39 C19 48 25 53 32 53 C39 53 45 48 46 39 C47 29 38 26 32 33 Z" fill={WHITE} />
      <path d="M18 28 Q19 11 32 11 Q45 11 46 28 Z" fill={RED} />
      <rect x={16} y={24} width={32} height={6} rx={3} fill={WHITE} />
      <circle cx={32} cy={10} r={4} fill={WHITE} />
      <Cheeks y={43.5} dx={9} />
      <Eyes y={38} dx={5.5} />
      <path d="M28 42.5 L36 42.5 L32 47 Z" fill="#ff9f1f" />
    </>
  ),
  urso: () => (
    <>
      <circle cx={20} cy={24} r={6} fill="#f4f7fb" stroke="rgba(20,70,60,0.2)" />
      <circle cx={44} cy={24} r={6} fill="#f4f7fb" stroke="rgba(20,70,60,0.2)" />
      <circle cx={20} cy={24} r={3} fill="#cfd9e6" />
      <circle cx={44} cy={24} r={3} fill="#cfd9e6" />
      <circle cx={32} cy={37} r={15} fill="#f4f7fb" stroke="rgba(20,70,60,0.2)" />
      <path d="M13 55 Q32 61 51 55 L53 64 H11 Z" fill={GREEN} />
      <ellipse cx={32} cy={43} rx={7.5} ry={6} fill={WHITE} stroke="#d5dee9" />
      <Cheeks y={41} dx={10.5} />
      <Eyes y={34} dx={6} />
      <ellipse cx={32} cy={40.6} rx={3.2} ry={2.3} fill={INK} />
      <path d="M32 42.8 V45 M28.6 45 Q32 47.8 35.4 45" stroke={INK} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </>
  ),
  biscoito: () => (
    <>
      <g fill="#b8682e">
        <rect x={21} y={40} width={8} height={18} rx={4} transform="rotate(18 25 42)" />
        <rect x={35} y={40} width={8} height={18} rx={4} transform="rotate(-18 39 42)" />
        <rect x={11} y={27} width={42} height={8} rx={4} />
        <rect x={22} y={25} width={20} height={21} rx={7} />
        <circle cx={32} cy={18} r={9.5} />
      </g>
      <path d="M15.5 28 V34 M48.5 28 V34" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={32} cy={31} r={1.9} fill={RED} />
      <circle cx={32} cy={37.5} r={1.9} fill={GREEN} />
      <Cheeks y={20.5} dx={6} r={1.8} />
      <Eyes y={16.5} dx={3.6} r={1.8} />
      <Smile y={21} w={3.4} color={WHITE} />
    </>
  ),
  anjo: () => (
    <>
      <ellipse cx={17} cy={41} rx={9} ry={13} fill={WHITE} transform="rotate(-28 17 41)" />
      <ellipse cx={47} cy={41} rx={9} ry={13} fill={WHITE} transform="rotate(28 47 41)" />
      <path d="M20 64 Q22 48 32 47 Q42 48 44 64 Z" fill="#fff6d6" />
      <circle cx={32} cy={35} r={11} fill={SKIN} />
      <path d="M20.5 35 Q19.5 22 32 22 Q44.5 22 43.5 35 Q40 27.5 32 28.5 Q24 27.5 20.5 35 Z" fill="#ffd36b" />
      <ellipse cx={32} cy={14} rx={10} ry={3.4} fill="none" stroke={GOLD} strokeWidth={3} />
      <Cheeks y={39.5} dx={7.5} />
      <Eyes y={35.5} dx={4.5} />
      <Smile y={40.5} w={3} />
    </>
  ),
  estrela: () => (
    <>
      <polygon
        points="32,11 38.5,26.1 54.8,27.6 42.5,38.4 46.1,54.4 32,46 17.9,54.4 21.5,38.4 9.2,27.6 25.5,26.1"
        fill="#ffd84a"
        stroke="#ffd84a"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M52 8 L53.2 11.8 L57 13 L53.2 14.2 L52 18 L50.8 14.2 L47 13 L50.8 11.8 Z" fill={WHITE} />
      <path d="M11 44 L11.9 46.6 L14.5 47.5 L11.9 48.4 L11 51 L10.1 48.4 L7.5 47.5 L10.1 46.6 Z" fill={WHITE} />
      <Cheeks y={37.5} dx={7} r={2.2} fill="rgba(255, 120, 90, 0.5)" />
      <Eyes y={33} dx={4.5} />
      <Smile y={38.5} w={3} />
    </>
  ),
  presente: () => (
    <>
      <rect x={15} y={27} width={34} height={27} rx={3} fill={RED} />
      <rect x={12} y={21} width={40} height={9} rx={2.5} fill="#ff6b78" />
      <rect x={29} y={21} width={6} height={33} fill={GOLD} />
      <path d="M32 21 C24 10 15 15 22 21 Z M32 21 C40 10 49 15 42 21 Z" fill={GOLD} />
      <circle cx={32} cy={20.5} r={3} fill={DGOLD} />
      <Eyes y={38.5} dx={9} r={2.3} sclera={4.6} />
      <Smile y={46} w={5} />
    </>
  ),
  panetone: () => (
    <>
      <path d="M14 38 Q14 15 32 15 Q50 15 50 38 Z" fill="#d79a52" />
      <path d="M17 27 Q21 15 32 15 Q43 15 47 27 Q40 22 32 22 Q24 22 17 27 Z" fill="#8a4f22" />
      <circle cx={24} cy={31} r={1.7} fill={RED} />
      <circle cx={40} cy={32} r={1.7} fill={GREEN} />
      <circle cx={33} cy={28} r={1.4} fill="#5a2d12" />
      <circle cx={45} cy={35} r={1.3} fill="#5a2d12" />
      <circle cx={19} cy={35} r={1.3} fill={GOLD} />
      <path d="M15 37 H49 L46 57 H18 Z" fill="#c21f33" />
      <path
        d="M21 37 L22 57 M27 37 L27.5 57 M33 37 V57 M39 37 L38.5 57 M45 37 L44 57"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
      />
      <Eyes y={44} dx={6.5} r={2.1} sclera={4} />
      <Smile y={51} w={3.6} color={WHITE} />
    </>
  ),
  sino: () => (
    <>
      <path d="M32 13 C22 13 20 23 19.5 34 L15 45 H49 L44.5 34 C44 23 42 13 32 13 Z" fill="#ffd451" />
      <path d="M24.5 22 Q22.5 28 23 34" stroke="rgba(255,255,255,0.65)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <rect x={13} y={43} width={38} height={5} rx={2.5} fill={DGOLD} />
      <circle cx={32} cy={51.5} r={4.2} fill={DGOLD} />
      <path d="M32 13 Q24 4 17 9 Q24 13 32 13 Z" fill={GREEN} />
      <path d="M32 13 Q40 4 47 9 Q40 13 32 13 Z" fill={GREEN} />
      <circle cx={29.8} cy={12} r={2.5} fill={RED} />
      <circle cx={34.2} cy={12} r={2.5} fill={RED} />
      <Cheeks y={35} dx={8} />
      <Eyes y={30.5} />
      <Smile y={36.5} w={3.4} />
    </>
  ),
  pisca: () => (
    <>
      <path d="M0 13 Q32 27 64 13" stroke={GREEN} strokeWidth={2.5} fill="none" />
      <ellipse cx={9} cy={22} rx={3.2} ry={4.6} fill="#ffd84a" transform="rotate(-22 9 22)" />
      <ellipse cx={55} cy={22} rx={3.2} ry={4.6} fill="#5aa9ff" transform="rotate(22 55 22)" />
      <rect x={26} y={16} width={12} height={9} rx={2} fill="#2d6b45" />
      <path d="M32 23 C20 23 18 35 22 45 Q26 54 32 57 Q38 54 42 45 C46 35 44 23 32 23 Z" fill="#ff4d5e" />
      <path d="M25 30 Q23 35 24 40" stroke="rgba(255,255,255,0.6)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Cheeks y={42} dx={7.5} r={2.2} fill="rgba(255,255,255,0.35)" />
      <Eyes y={37.5} dx={4.5} r={2.2} />
      <Smile y={43} w={3} />
    </>
  ),
  arvore: () => (
    <>
      <rect x={28} y={47} width={8} height={10} fill={BROWN} />
      <path
        d="M32 10 L45 29 H39 L50 47 H14 L25 29 H19 Z"
        fill={GREEN}
        stroke={GREEN}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M32 3 L34.2 7.6 L39.2 8.1 L35.4 11.5 L36.5 16.4 L32 13.8 L27.5 16.4 L28.6 11.5 L24.8 8.1 L29.8 7.6 Z" fill={GOLD} />
      <circle cx={21} cy={44} r={2.2} fill={GOLD} />
      <circle cx={43} cy={43.5} r={2.2} fill="#5aa9ff" />
      <circle cx={37} cy={24} r={1.7} fill={RED} />
      <circle cx={26} cy={25} r={1.7} fill="#ff8fd0" />
      <Eyes y={34.5} dx={5} r={2.1} sclera={3.6} />
      <Smile y={41} w={3.6} color={WHITE} />
    </>
  ),
}

export type ChristmasAvatarProps = {
  avatar: AvatarInfo | AvatarId
  /** Tamanho (px ou valor CSS, ex.: 'calc(var(--seat-w) * 0.6)'). */
  size?: number | string
  /** Respira e pisca (fica parado com prefers-reduced-motion). */
  animated?: boolean
  /** Fora da rodada: congelado (cinza azulado, sem animação). */
  frozen?: boolean
  /** Troca a cor do fundo (padrão: a cor do avatar). */
  color?: string
  /** Texto para leitor de tela (padrão: o nome do personagem). `''` = decorativo. */
  title?: string
  className?: string
  style?: CSSProperties
}

/**
 * Avatar de Natal desenhado em SVG.
 *
 *   <ChristmasAvatar avatar={avatarFor(player, players)} size={42} animated />
 */
export default function ChristmasAvatar({
  avatar,
  size = 40,
  animated = false,
  frozen = false,
  color,
  title,
  className,
  style,
}: ChristmasAvatarProps) {
  const info = typeof avatar === 'string' ? getAvatar(avatar) : avatar
  const clipId = `xa-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const label = title ?? info.label
  const moving = animated && !frozen
  // Cada personagem num ritmo: 15 na TV não piscam juntos.
  const bobDelay = `${-((info.index * 0.37) % 2.8).toFixed(2)}s`
  const blinkDelay = `${-((info.index * 0.71) % 5.2).toFixed(2)}s`

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-avatar={info.id}
      style={{
        display: 'block',
        flexShrink: 0,
        overflow: 'visible',
        filter: frozen ? 'grayscale(0.85) brightness(1.08)' : undefined,
        ...style,
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={32} cy={32} r={32} />
        </clipPath>
      </defs>
      <circle cx={32} cy={32} r={32} fill={color ?? info.color} />
      <g clipPath={`url(#${clipId})`}>
        {/* Luz de cima: dá volume sem gradiente. */}
        <circle cx={32} cy={-14} r={44} fill="rgba(255,255,255,0.14)" />
        <g
          className={moving ? 'xa-bob' : 'xa-off'}
          style={moving ? ({ '--xa-blink-delay': blinkDelay, animationDelay: bobDelay } as CSSProperties) : undefined}
        >
          {ART[info.id]()}
        </g>
        {frozen && <circle cx={32} cy={32} r={32} fill="rgba(190, 225, 255, 0.35)" />}
      </g>
    </svg>
  )
}
