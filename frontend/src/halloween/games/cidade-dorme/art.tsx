import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { Snowman } from '../../../components/ui/LoadingScreen'
import { CREEPY_FONT, FESTIVE_ROUND_FONT, withAlpha } from '../../ui'
import type { Role } from './engine'

/**
 * Desenhos do "Vila Dorme": a vila nevada da TV (de noite as luzinhas se
 * apagam uma a uma; de manhã o sol nasce sobre a neve), o boneco de neve de
 * quem saiu do jogo, o trenó do Polo Norte e a etiqueta de presente do papel
 * no celular. Só componentes (regra do react-refresh).
 */

// ---------------------------------------------------------------------------
// A vila (fundo dos quadros da TV)
// ---------------------------------------------------------------------------

type House = { x: number; w: number; h: number; roof: string; wall: string }

/** Casinhas da vila, da esquerda para a direita (viewBox 1600 × 420). */
const HOUSES: readonly House[] = [
  { x: 40, w: 170, h: 120, roof: '#c21f33', wall: '#7a4a2a' },
  { x: 250, w: 140, h: 150, roof: '#1f7a43', wall: '#8a5a34' },
  { x: 430, w: 190, h: 110, roof: '#2a4f9a', wall: '#6e4226' },
  { x: 980, w: 180, h: 130, roof: '#c21f33', wall: '#83532f' },
  { x: 1200, w: 150, h: 160, roof: '#7b3fa0', wall: '#6e4226' },
  { x: 1390, w: 180, h: 115, roof: '#1f7a43', wall: '#8a5a34' },
]

const GROUND = 330

/** Flocos que caem (posição e ritmo fixos: nada de Math.random no render). */
const FLAKES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 8 + ((i * 7) % 4) * 4,
  duration: 7 + ((i * 5) % 6),
  delay: -((i * 13) % 11),
  sway: 10 + ((i * 3) % 4) * 6,
}))

const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 71 + 23) % 1600,
  y: 14 + ((i * 41) % 150),
  r: 1.6 + (i % 3),
  delay: (i % 7) * 0.35,
}))

/**
 * Cenário da vila para pôr ATRÁS do conteúdo (o pai precisa ser
 * `position: relative; overflow: hidden`).
 *
 *   <VillageScene mode="night" />    luzinhas apagando, lua, estrelas, neve
 *   <VillageScene mode="morning" />  sol nascendo, janelas acesas, fumaça
 */
export function VillageScene({ mode }: { mode: 'night' | 'morning' | 'day' }) {
  const night = mode === 'night'
  const morning = mode === 'morning'
  let windowIndex = 0
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        background: night
          ? 'linear-gradient(180deg, #050b24 0%, #0c1840 55%, #1a2a5c 100%)'
          : morning
            ? 'linear-gradient(180deg, #13244f 0%, #3b3f7a 38%, #b4597a 72%, #ffb36b 100%)'
            : 'linear-gradient(180deg, #0f2a5c 0%, #1f4f8f 60%, #4f86c6 100%)',
        '@keyframes cdLightsOff': {
          '0%': { fill: '#ffd36b', filter: 'drop-shadow(0 0 10px #ffb84d)' },
          '40%': { fill: '#fff3c2', filter: 'drop-shadow(0 0 16px #ffd36b)' },
          '100%': { fill: '#16224a', filter: 'none' },
        },
        '@keyframes cdBlink': {
          '0%, 88%, 100%': { transform: 'scaleY(1)' },
          '92%': { transform: 'scaleY(0.1)' },
        },
        '@keyframes cdTwinkle': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.25 },
        },
        '@keyframes cdSunrise': {
          from: { transform: 'translateY(170px)' },
          to: { transform: 'translateY(0)' },
        },
        '@keyframes cdSpin': { to: { transform: 'rotate(360deg)' } },
        '@keyframes cdSmoke': {
          '0%': { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
          '20%': { opacity: 0.7 },
          '100%': { transform: 'translate(30px, -110px) scale(1.8)', opacity: 0 },
        },
        '@keyframes cdFall': {
          from: { transform: 'translateY(-10%)' },
          to: { transform: 'translateY(110%)' },
        },
        '@keyframes cdSway': {
          from: { transform: 'translateX(calc(var(--cd-sway) * -1))' },
          to: { transform: 'translateX(var(--cd-sway))' },
        },
        '& .cd-win': {
          transformBox: 'fill-box',
          animation: night ? 'cdLightsOff 600ms ease-out both' : 'none',
        },
        '& .cd-star': { transformBox: 'fill-box', transformOrigin: 'center', animation: 'cdTwinkle 2.2s ease-in-out infinite' },
        '& .cd-bulb': { animation: 'cdTwinkle 1.2s ease-in-out infinite' },
        '& .cd-eyes': { transformBox: 'fill-box', transformOrigin: 'center', animation: 'cdBlink 3.6s ease-in-out infinite' },
        '& .cd-sun': { animation: 'cdSunrise 3.2s cubic-bezier(0.22, 1, 0.36, 1) both' },
        '& .cd-rays': { transformBox: 'fill-box', transformOrigin: 'center', animation: 'cdSpin 24s linear infinite' },
        '& .cd-smoke': { transformBox: 'fill-box', transformOrigin: 'center', animation: 'cdSmoke 3.4s ease-out infinite' },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 1600 420"
        preserveAspectRatio="xMidYMax slice"
        sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '62%', display: 'block' }}
      >
        <defs>
          <radialGradient id="cd-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbe8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fffbe8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cd-sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff1b8" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#ffb36b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff8a5c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {night &&
          STARS.map((star, i) => (
            <circle key={i} className="cd-star" cx={star.x} cy={star.y} r={star.r} fill="#fffbe8" style={{ animationDelay: `${star.delay}s` }} />
          ))}
        {night && (
          <g>
            <circle cx="1440" cy="70" r="110" fill="url(#cd-moon-glow)" />
            <circle cx="1440" cy="70" r="44" fill="#fffbe8" />
            <circle cx="1460" cy="58" r="40" fill="#0c1840" />
          </g>
        )}
        {morning && (
          <g className="cd-sun">
            <circle cx="800" cy="300" r="320" fill="url(#cd-sun-glow)" />
            <g className="cd-rays">
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x="796" y="140" width="8" height="70" rx="4" fill="#ffe08a" opacity="0.7" transform={`rotate(${i * 30} 800 300)`} />
              ))}
            </g>
            <circle cx="800" cy="300" r="80" fill="#ffd36b" />
            <circle cx="800" cy="300" r="64" fill="#ffe9a8" />
          </g>
        )}

        {/* Morros nevados */}
        <path d="M0 300 Q200 240 420 290 T840 280 T1260 270 T1600 290 V420 H0 Z" fill={night ? '#5d71a0' : '#eef5ff'} opacity="0.55" />

        {/* Casinhas */}
        {HOUSES.map((house, h) => {
          const top = GROUND - house.h
          const winW = house.w * 0.2
          const winH = house.h * 0.22
          const winY = top + house.h * 0.25
          const windows = [house.x + house.w * 0.16, house.x + house.w * 0.64]
          return (
            <g key={h}>
              {/* Chaminé e fumaça */}
              <rect x={house.x + house.w * 0.68} y={top - 62} width={22} height={50} fill="#5a2f1c" />
              <rect x={house.x + house.w * 0.68 - 4} y={top - 68} width={30} height={10} rx={4} fill="#ffffff" />
              {!night &&
                [0, 1.1, 2.2].map((delay) => (
                  <circle
                    key={delay}
                    className="cd-smoke"
                    cx={house.x + house.w * 0.68 + 11}
                    cy={top - 74}
                    r={12}
                    fill="#e8eef8"
                    style={{ animationDelay: `${delay + h * 0.4}s` }}
                  />
                ))}
              <rect x={house.x} y={top} width={house.w} height={house.h} fill={house.wall} />
              <path
                d={`M${house.x - 18} ${top + 4} L${house.x + house.w / 2} ${top - 70} L${house.x + house.w + 18} ${top + 4} Z`}
                fill={house.roof}
              />
              {/* Neve no telhado */}
              <path
                d={`M${house.x - 22} ${top + 6} L${house.x + house.w / 2} ${top - 74} L${house.x + house.w + 22} ${top + 6} L${house.x + house.w + 10} ${top + 14} Q${house.x + house.w * 0.75} ${top - 20} ${house.x + house.w / 2} ${top - 52} Q${house.x + house.w * 0.25} ${top - 20} ${house.x - 10} ${top + 14} Z`}
                fill={night ? '#dfe8f8' : '#ffffff'}
              />
              {windows.map((wx) => {
                const index = windowIndex++
                const peek = night && index === 7
                return (
                  <g key={wx}>
                    <rect
                      className="cd-win"
                      x={wx}
                      y={winY}
                      width={winW}
                      height={winH}
                      rx={4}
                      fill="#ffd36b"
                      style={peek || !night ? { animation: 'none', filter: 'drop-shadow(0 0 10px #ffb84d)' } : { animationDelay: `${1.2 + ((index * 7) % 12) * 0.7}s` }}
                    />
                    <path d={`M${wx + winW / 2} ${winY} V${winY + winH} M${wx} ${winY + winH / 2} H${wx + winW}`} stroke={house.wall} strokeWidth={3} />
                    {/* Alguém continua acordado… 👀 */}
                    {peek && (
                      <g className="cd-eyes">
                        <rect x={wx} y={winY} width={winW} height={winH} rx={4} fill="#16224a" />
                        <circle cx={wx + winW * 0.35} cy={winY + winH * 0.5} r={4} fill="#ffffff" />
                        <circle cx={wx + winW * 0.65} cy={winY + winH * 0.5} r={4} fill="#ffffff" />
                      </g>
                    )}
                  </g>
                )
              })}
              <rect x={house.x + house.w * 0.4} y={GROUND - house.h * 0.42} width={house.w * 0.2} height={house.h * 0.42} rx={6} fill="#3a1f12" />
              <circle cx={house.x + house.w * 0.5} cy={GROUND - house.h * 0.3} r={9} fill="#1f9d55" stroke="#c21f33" strokeWidth={3} />
            </g>
          )
        })}

        {/* Pinheirão da praça com pisca-pisca */}
        <g>
          <rect x="785" y="296" width="30" height="34" fill="#5a2f1c" />
          <path d="M800 70 L900 200 H860 L940 300 H660 L740 200 H700 Z" fill="#1f7a43" />
          <path d="M800 70 L870 160 Q800 150 730 160 Z" fill="#ffffff" opacity="0.5" />
          <path d="M800 52 l8 18 h19 l-15 12 6 19 -18 -11 -18 11 6 -19 -15 -12 h19 z" fill="#f5c242" />
          {[
            [770, 150, '#ff4d6d'],
            [830, 170, '#7fd8ff'],
            [745, 225, '#f5c242'],
            [800, 215, '#ff4d6d'],
            [860, 235, '#4fd67e'],
            [710, 285, '#7fd8ff'],
            [780, 270, '#f5c242'],
            [850, 280, '#ff4d6d'],
            [905, 288, '#f5c242'],
          ].map(([x, y, color], i) => (
            <circle
              key={i}
              className="cd-bulb"
              cx={x}
              cy={y}
              r={9}
              fill={String(color)}
              style={{ animationDelay: `${(i % 4) * 0.3}s`, opacity: night ? 0.95 : 1 }}
            />
          ))}
        </g>

        {/* Chão de neve */}
        <path d="M0 330 Q400 310 800 330 T1600 325 V420 H0 Z" fill={night ? '#8ea2cc' : '#f4f8ff'} />
        <path d="M0 360 Q400 345 800 362 T1600 356 V420 H0 Z" fill={night ? '#7487b3' : '#dce8fa'} />
      </Box>

      {/* Neve caindo */}
      {FLAKES.map((flake, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${flake.left}%`,
            width: flake.size,
            animation: `cdFall ${flake.duration}s linear infinite`,
            animationDelay: `${flake.delay}s`,
          }}
        >
          <Box
            style={{ ['--cd-sway' as string]: `${flake.sway}px` }}
            sx={{
              width: flake.size,
              height: flake.size,
              borderRadius: '50%',
              background: '#ffffff',
              opacity: 0.85,
              boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
              animation: 'cdSway 2.6s ease-in-out infinite alternate',
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Boneco de neve (quem saiu do jogo à noite)
// ---------------------------------------------------------------------------

/**
 * O boneco de neve novo da vila, com a plaquinha de madeira embaixo.
 *
 *   <SnowmanPlaque name="Pedro" epitaph="Lambeu o poste gelado." footer="🏡 Morador" />
 */
export function SnowmanPlaque({ name, epitaph, footer }: { name: string; epitaph: string; footer?: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'cdBoing 1100ms cubic-bezier(0.2, 1.6, 0.4, 1) both',
        '@keyframes cdBoing': {
          '0%': { transform: 'translateY(-120%) scale(0.4)', opacity: 0 },
          '55%': { transform: 'translateY(0) scale(1.08, 0.9)', opacity: 1 },
          '75%': { transform: 'scale(0.96, 1.05)' },
          '100%': { transform: 'none' },
        },
      }}
    >
      <Snowman size={190} glow="#7fd8ff" />
      <Box
        sx={{
          mt: -1,
          px: 3.5,
          py: 2,
          maxWidth: 480,
          textAlign: 'center',
          borderRadius: '10px',
          background: 'repeating-linear-gradient(0deg, #8a5a34 0 14px, #7a4a2a 14px 28px)',
          border: '4px solid #5a2f1c',
          boxShadow: '0 14px 30px rgba(0, 0, 0, 0.45), inset 0 0 0 2px rgba(255, 220, 160, 0.25)',
          color: '#fff6dc',
          position: 'relative',
          // Neve em cima da plaquinha
          '&::before': {
            content: '""',
            position: 'absolute',
            left: -6,
            right: -6,
            top: -10,
            height: 16,
            borderRadius: '10px 10px 14px 14px',
            background: '#ffffff',
          },
        }}
      >
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.6rem, 3.6vw, 3.8rem)', lineHeight: 1.05 }}>{name}</Typography>
        <Typography sx={{ fontStyle: 'italic', fontSize: 'clamp(1.7rem, 2.1vw, 2.2rem)', lineHeight: 1.15, mt: 0.5, color: '#ffe9c2' }}>
          {epitaph}
        </Typography>
        {footer && <Box sx={{ mt: 1, fontWeight: 800, fontSize: 'clamp(1.7rem, 2vw, 2.1rem)' }}>{footer}</Box>}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Trenó para o Polo Norte (quem a vila despachou na votação)
// ---------------------------------------------------------------------------

/**
 * Cartão de embarque do trenó: o nome vai embora voando pro Polo Norte.
 *
 *   <SleighTicket name="Pedro">🧝 ERA DUENDE!</SleighTicket>
 */
export function SleighTicket({ name, children, caught }: { name: string; children?: ReactNode; caught: boolean }) {
  const color = caught ? '#4fd67e' : '#ff4d6d'
  return (
    <Box
      sx={{
        position: 'relative',
        width: 'min(520px, 100%)',
        textAlign: 'center',
        p: 3,
        pt: 9,
        borderRadius: '22px',
        background: 'linear-gradient(170deg, #fffaf0, #f3e6c8)',
        color: '#1b2e4d',
        border: `5px dashed ${color}`,
        boxShadow: `0 0 50px ${withAlpha(color, 0.45)}, 0 18px 40px rgba(0, 0, 0, 0.45)`,
        overflow: 'visible',
        '@keyframes cdSleighAway': {
          '0%': { transform: 'translate(-30%, 10px) rotate(-6deg)' },
          '50%': { transform: 'translate(0, 0) rotate(-3deg)' },
          '100%': { transform: 'translate(30%, -10px) rotate(-6deg)' },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: -46,
          left: 0,
          right: 0,
          fontSize: 'clamp(5rem, 7vw, 7rem)',
          lineHeight: 1,
          animation: 'cdSleighAway 2.4s ease-in-out infinite alternate',
        }}
      >
        🛷💨
      </Box>
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(1.6rem, 2vw, 2rem)', letterSpacing: '0.12em', color: '#c21f33' }}>
        🎫 PASSAGEM SÓ DE IDA · POLO NORTE
      </Typography>
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3.2rem, 4.6vw, 4.8rem)', lineHeight: 1.05, mt: 1 }}>{name}</Typography>
      {children && <Box sx={{ mt: 1.5, fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', fontWeight: 900 }}>{children}</Box>}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Etiqueta de presente (o papel no celular)
// ---------------------------------------------------------------------------

/** Tinta escura de cada papel, para ler bem no papel creme da etiqueta. */
const INK: Record<Role, string> = {
  killer: '#c21f33',
  detective: '#1565a8',
  angel: '#9a6a00',
  citizen: '#1f7a43',
}

/**
 * O papel secreto como etiqueta de presente: furinho, barbante, costura e
 * "Para: Fulano · De: Papai Noel".
 *
 *   <GiftTag role="killer" to="Ana" icon="🧝" title="Você é DUENDE TRAVESSO">missão…</GiftTag>
 */
export function GiftTag({
  role,
  to,
  icon,
  title,
  color,
  compact = false,
  children,
}: {
  role: Role
  to: string
  icon: string
  title: ReactNode
  color: string
  compact?: boolean
  children?: ReactNode
}) {
  const ink = INK[role]
  return (
    <Box sx={{ position: 'relative', pt: compact ? 2 : 3.5 }}>
      {/* Barbante */}
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 120 40"
        sx={{ position: 'absolute', top: 0, left: '50%', width: 120, height: compact ? 24 : 40, transform: 'translateX(-50%)', zIndex: 1 }}
      >
        <path d="M10 2 Q60 30 60 38 Q60 30 110 2" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
      </Box>
      <Box
        className="animate-pop-in"
        sx={{
          position: 'relative',
          p: compact ? 2 : 3,
          pt: compact ? 3 : 4,
          textAlign: 'center',
          color: '#1b2e4d',
          borderRadius: '18px',
          // Cantos de cima "cortados", como etiqueta de verdade.
          clipPath: 'polygon(12% 0, 88% 0, 100% 9%, 100% 100%, 0 100%, 0 9%)',
          background: 'linear-gradient(170deg, #fffaf0, #f3e6c8)',
          boxShadow: `inset 0 0 0 6px ${color}`,
          animation: 'cdTagSwing 3.2s ease-in-out infinite',
          transformOrigin: 'top center',
          '@keyframes cdTagSwing': {
            '0%, 100%': { transform: 'rotate(-1.5deg)' },
            '50%': { transform: 'rotate(1.5deg)' },
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 12,
            borderRadius: '12px',
            border: `2px dashed ${withAlpha(ink, 0.45)}`,
            pointerEvents: 'none',
          },
        }}
      >
        {/* Furinho do barbante */}
        <Box
          aria-hidden
          sx={{ position: 'absolute', top: 10, left: '50%', width: 16, height: 16, ml: '-8px', borderRadius: '50%', background: '#0b1630', boxShadow: `0 0 0 4px ${color}` }}
        />
        <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: compact ? '1.05rem' : '1.2rem', color: ink, mt: compact ? 0.5 : 1 }}>
          Para: {to} · De: Papai Noel 🎅
        </Typography>
        <Typography sx={{ fontSize: compact ? '2.8rem' : '4.5rem', lineHeight: 1, mt: 1 }}>{icon}</Typography>
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: compact ? '1.7rem' : '2.3rem', color: ink, lineHeight: 1.05, mt: 1 }}>
          {title}
        </Typography>
        {children && <Box sx={{ mt: 1, fontSize: '1.05rem', color: '#3a4a66', position: 'relative', zIndex: 1 }}>{children}</Box>}
      </Box>
    </Box>
  )
}

/**
 * O presente fechado (toque para abrir o papel): papel vermelho, laço verde.
 * Só o visual — o botão é de quem usa.
 */
export function WrappedGift() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width: 150,
        height: 130,
        mx: 'auto',
        animation: 'cdWiggle 1.8s ease-in-out infinite',
        '@keyframes cdWiggle': {
          '0%, 70%, 100%': { transform: 'rotate(0)' },
          '76%': { transform: 'rotate(-7deg) scale(1.04)' },
          '82%': { transform: 'rotate(6deg) scale(1.04)' },
          '88%': { transform: 'rotate(-4deg)' },
          '94%': { transform: 'rotate(2deg)' },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 150 130"
        sx={{ width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0 8px 18px rgba(255, 61, 90, 0.45))' }}
      >
        <rect x="15" y="50" width="120" height="76" rx="8" fill="#e8394a" />
        <rect x="8" y="34" width="134" height="24" rx="6" fill="#ff5a66" />
        <rect x="66" y="34" width="18" height="92" fill="#1f9d55" />
        <path d="M75 34 C50 4 22 18 44 34 Z M75 34 C100 4 128 18 106 34 Z" fill="#4fd67e" stroke="#1f9d55" strokeWidth="3" />
        <circle cx="75" cy="34" r="8" fill="#1f9d55" />
        {[30, 50, 100, 120].map((x) => (
          <circle key={x} cx={x} cy={x % 40 === 0 ? 80 : 104} r="5" fill="#fff6dc" opacity="0.8" />
        ))}
      </Box>
    </Box>
  )
}
