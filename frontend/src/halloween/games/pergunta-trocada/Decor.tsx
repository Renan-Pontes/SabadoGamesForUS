import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography } from '@mui/material'
import { CREEPY_FONT, FESTIVE_ROUND_FONT, XMAS_COLORS, scatter, useReducedMotion, withAlpha } from '../../ui'
import './pt.css'

/**
 * Peças da "Pergunta Trocada", desenhadas aqui mesmo (CSS/SVG leve, sem
 * sorteio no render): a toalha de mesa, a plaquinha de lugar com a resposta,
 * o cartão de Natal da pergunta, enfeites, presente, brilhinhos, título
 * dourado e a chuva de presentes do fim.
 */

/** Papel de cartão e a tinta escura que vai nele. */
export const PAPER = '#fff8ea'
export const INK = '#2b1608'
const HOLLY_RED = '#b0182c'

/** A mesa da festa: toalha xadrez de Natal com barrado de renda. Tudo da rodada fica em cima dela. */
export function Tablecloth({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box className="pt-cloth" sx={{ p: { xs: 2.5, md: 3.5 }, mb: '22px', ...sx }}>
      <Holly corner="tl" />
      <Holly corner="tr" />
      {children}
    </Box>
  )
}

/** Raminho de azevinho no canto da toalha. */
function Holly({ corner }: { corner: 'tl' | 'tr' }) {
  const right = corner === 'tr'
  return (
    <svg
      viewBox="0 0 80 60"
      width={84}
      aria-hidden
      style={{ position: 'absolute', top: -26, [right ? 'right' : 'left']: -18, transform: right ? 'scaleX(-1)' : undefined, overflow: 'visible', zIndex: 2 }}
    >
      <path d="M8 34 C 18 14, 34 10, 44 26 C 34 22, 26 30, 30 40 C 22 34, 14 38, 8 34 Z" fill={XMAS_COLORS.green} stroke="#0c5a2e" strokeWidth="2" />
      <path d="M72 34 C 62 14, 46 10, 36 26 C 46 22, 54 30, 50 40 C 58 34, 66 38, 72 34 Z" fill="#23b062" stroke="#0c5a2e" strokeWidth="2" />
      <circle cx="34" cy="36" r="7" fill={XMAS_COLORS.red} />
      <circle cx="46" cy="36" r="7" fill="#d42a3c" />
      <circle cx="40" cy="45" r="7" fill={XMAS_COLORS.red} />
      <circle cx="32" cy="33" r="2" fill="#ffffff" opacity="0.6" />
      <circle cx="44" cy="33" r="2" fill="#ffffff" opacity="0.6" />
    </svg>
  )
}

/**
 * Plaquinha de lugar da mesa: nome em cima (faixa colorida) e a resposta
 * grande embaixo. Vira ao aparecer (`flip` + `index` escalonam a entrada).
 */
export function PlaceCard({
  name,
  answer,
  index = 0,
  flip = true,
  acted = false,
  offline = false,
  highlight = false,
  impostor = false,
  votes,
  footer,
  compact = false,
  pending,
}: {
  name: string
  /** null = não respondeu. */
  answer: string | null
  /** Texto no lugar da resposta enquanto ela ainda é segredo ("✍️ escrevendo…"). */
  pending?: string
  index?: number
  flip?: boolean
  acted?: boolean
  offline?: boolean
  /** O mais votado (pulsa dourado). */
  highlight?: boolean
  /** Era o impostor (faixa vermelha e carimbo). */
  impostor?: boolean
  /** Votos recebidos (mostra o selo). */
  votes?: number
  footer?: ReactNode
  /** Mesa cheia: letras um pouco menores. */
  compact?: boolean
}) {
  const band = impostor ? XMAS_COLORS.red : index % 2 ? XMAS_COLORS.green : '#1c6fb8'
  // A virada fica na caixa de fora; a plaquinha torta (e o pulso dourado) na de dentro.
  return (
    <Box className={flip ? 'pt-flip' : undefined} style={{ '--pt-i': index } as CSSProperties} sx={{ minWidth: 0 }}>
      <Box
        className={highlight ? 'pt-spot' : undefined}
        sx={{
          position: 'relative',
          borderRadius: '16px',
          background: `linear-gradient(175deg, #fffdf6 0%, ${PAPER} 65%, #f3e3c3 100%)`,
          color: INK,
          boxShadow: '0 8px 0 rgba(60, 10, 10, 0.45), 0 12px 24px rgba(0, 0, 0, 0.35)',
          transform: `rotate(${index % 3 === 0 ? -1.2 : index % 3 === 1 ? 0.9 : -0.4}deg)`,
          opacity: offline ? 0.6 : 1,
          overflow: 'visible',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: compact ? 0.5 : 0.75,
            borderRadius: '16px 16px 0 0',
            background: band,
            color: '#ffffff',
          }}
        >
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: compact ? 'clamp(1.3rem, 1.7vw, 1.8rem)' : 'clamp(1.5rem, 2vw, 2.1rem)', lineHeight: 1.15 }}>
            {impostor ? '🥸 ' : ''}
            {name}
            {offline ? ' 💤' : ''}
          </Typography>
          {acted && (
            <Typography aria-label="pronto" sx={{ fontWeight: 900, fontSize: 'clamp(1.3rem, 1.7vw, 1.8rem)', lineHeight: 1 }}>
              ✓
            </Typography>
          )}
        </Box>
        <Box sx={{ px: 2, py: compact ? 1 : 1.5, minHeight: compact ? 64 : 84, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          {pending !== undefined ? (
            <Typography sx={{ fontSize: compact ? 'clamp(1.3rem, 1.7vw, 1.8rem)' : 'clamp(1.5rem, 2vw, 2.1rem)', color: acted ? '#17703c' : '#9a7a5a', fontWeight: 800 }}>{pending}</Typography>
          ) : answer === null ? (
            <Typography sx={{ fontSize: compact ? 'clamp(1.3rem, 1.7vw, 1.8rem)' : 'clamp(1.5rem, 2vw, 2.1rem)', color: '#9a7a5a', fontWeight: 700 }}>🤐 não respondeu</Typography>
          ) : (
            <Typography
              sx={{
                fontFamily: FESTIVE_ROUND_FONT,
                fontWeight: 700,
                fontSize: compact ? 'clamp(1.7rem, 2.3vw, 2.5rem)' : 'clamp(2rem, 2.9vw, 3.1rem)',
                lineHeight: 1.08,
                color: impostor ? HOLLY_RED : INK,
                wordBreak: 'break-word',
              }}
            >
              {answer}
            </Typography>
          )}
          {footer}
        </Box>
        {typeof votes === 'number' && votes > 0 && (
          <Box
            className="pt-boing"
            sx={{
              position: 'absolute',
              top: -18,
              right: -14,
              minWidth: 52,
              height: 52,
              px: 1,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: XMAS_COLORS.gold,
              color: '#2a1a00',
              border: '3px solid #ffffff',
              fontFamily: FESTIVE_ROUND_FONT,
              fontWeight: 800,
              fontSize: '1.7rem',
              boxShadow: `0 0 18px ${withAlpha(XMAS_COLORS.gold, 0.7)}`,
            }}
          >
            {votes}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * Cartão de Natal (TV e celular): papel creme, borda vermelha, pesponto
 * verde e azevinho no canto. `label` vai em versalete em cima.
 */
export function XmasCard({
  label,
  children,
  tone = 'paper',
  sx,
  className,
}: {
  label?: ReactNode
  children: ReactNode
  /** 'paper' = cartão creme; 'red' = cartão vermelho (a pergunta do impostor). */
  tone?: 'paper' | 'red'
  sx?: object
  className?: string
}) {
  const red = tone === 'red'
  return (
    <Box
      className={className}
      sx={{
        position: 'relative',
        borderRadius: '22px',
        textAlign: 'center',
        px: 3,
        pt: 3.5,
        pb: 2.5,
        color: red ? '#ffffff' : INK,
        background: red
          ? 'radial-gradient(ellipse at top, #ff5a66 0%, #b3182c 55%, #6e0b19 100%)'
          : `linear-gradient(170deg, #fffdf6 0%, ${PAPER} 60%, #f4e2c0 100%)`,
        border: `5px solid ${red ? XMAS_COLORS.gold : XMAS_COLORS.red}`,
        outline: `2px dashed ${red ? withAlpha('#ffffff', 0.7) : withAlpha(XMAS_COLORS.green, 0.85)}`,
        outlineOffset: '-12px',
        boxShadow: `0 8px 0 rgba(0, 0, 0, 0.35), 0 0 34px ${withAlpha(red ? XMAS_COLORS.red : XMAS_COLORS.gold, 0.35)}`,
        ...sx,
      }}
    >
      <Typography aria-hidden sx={{ position: 'absolute', top: 10, left: 16, fontSize: '1.4rem', lineHeight: 1 }}>
        🎄
      </Typography>
      <Typography aria-hidden sx={{ position: 'absolute', top: 10, right: 16, fontSize: '1.4rem', lineHeight: 1 }}>
        ⭐
      </Typography>
      {label && (
        <Typography sx={{ fontSize: '0.85em', letterSpacing: '0.2em', fontWeight: 800, color: red ? 'rgba(255, 255, 255, 0.8)' : '#9a6a4a', textTransform: 'uppercase' }}>
          {label}
        </Typography>
      )}
      {children}
    </Box>
  )
}

/** Bola de árvore com gancho, faixa dourada e reflexo. */
export function Ornament({ color = XMAS_COLORS.red, size = 60, delay = 0 }: { color?: string; size?: number | string; delay?: number }) {
  return (
    <svg viewBox="0 0 60 84" width={size} className="pt-swing" style={{ display: 'block', overflow: 'visible', animationDelay: `${delay}s` }} aria-hidden>
      <path d="M30 0 L30 12" stroke={XMAS_COLORS.gold} strokeWidth="2" />
      <rect x="23" y="11" width="14" height="8" rx="2" fill={XMAS_COLORS.gold} />
      <circle cx="30" cy="48" r="27" fill={color} />
      <path d="M4 44 Q30 56 56 44 L56 52 Q30 64 4 52 Z" fill={XMAS_COLORS.gold} opacity="0.85" />
      <ellipse cx="20" cy="36" rx="6" ry="9" fill="#ffffff" opacity="0.45" transform="rotate(25 20 36)" />
    </svg>
  )
}

/** Presente com laço. `shake` sacode (rufar); `float` flutua devagar. */
export function GiftBox({
  color = XMAS_COLORS.red,
  ribbon = XMAS_COLORS.gold,
  size = 120,
  motion,
  delay = 0,
}: {
  color?: string
  ribbon?: string
  size?: number | string
  motion?: 'shake' | 'float' | 'bounce'
  delay?: number
}) {
  const className = motion === 'shake' ? 'pt-shake' : motion === 'float' ? 'pt-float' : motion === 'bounce' ? 'pt-bounce' : undefined
  return (
    <svg viewBox="0 0 100 100" width={size} className={className} style={{ display: 'block', overflow: 'visible', animationDelay: `${delay}s` }} aria-hidden>
      <rect x="14" y="44" width="72" height="52" rx="5" fill={color} />
      <rect x="44" y="44" width="12" height="52" fill={ribbon} />
      <rect x="14" y="44" width="72" height="8" fill="#000000" opacity="0.14" />
      <rect x="8" y="30" width="84" height="18" rx="4" fill={color} />
      <rect x="8" y="30" width="84" height="18" rx="4" fill="#ffffff" opacity="0.12" />
      <rect x="44" y="30" width="12" height="18" fill={ribbon} />
      <ellipse cx="36" cy="20" rx="15" ry="8" fill={ribbon} transform="rotate(-24 36 20)" />
      <ellipse cx="64" cy="20" rx="15" ry="8" fill={ribbon} transform="rotate(24 64 20)" />
      <circle cx="50" cy="26" r="6" fill={ribbon} />
    </svg>
  )
}

/** Envelope de cartão de Natal (a pergunta chegando nos celulares). */
export function Envelope({ size = 220 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 120 84" width={size} className="pt-float" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <rect x="4" y="10" width="112" height="70" rx="8" fill="#fff4dc" stroke={XMAS_COLORS.red} strokeWidth="4" />
      <path d="M6 14 L60 52 L114 14" fill="none" stroke="#d9b98a" strokeWidth="4" strokeLinejoin="round" />
      <path d="M6 78 L46 44 M114 78 L74 44" stroke="#e8d3ad" strokeWidth="3" />
      <circle cx="60" cy="50" r="12" fill={XMAS_COLORS.red} />
      <text x="60" y="56" textAnchor="middle" fontSize="16" fontWeight="900" fill="#ffffff">
        ?
      </text>
      <rect x="88" y="18" width="20" height="24" rx="2" fill={XMAS_COLORS.green} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 2" />
      <text x="98" y="35" textAnchor="middle" fontSize="12">
        🎄
      </text>
    </svg>
  )
}

const SPARKLE_SPOTS = [
  { left: '5%', top: '10%', size: '2.4rem', delay: 0 },
  { left: '91%', top: '6%', size: '3rem', delay: -0.7 },
  { left: '2%', top: '62%', size: '1.8rem', delay: -1.3 },
  { left: '95%', top: '56%', size: '2.2rem', delay: -0.4 },
  { left: '16%', top: '90%', size: '1.6rem', delay: -1 },
  { left: '80%', top: '92%', size: '2rem', delay: -1.6 },
] as const

/** Brilhinhos dourados piscando em volta (o pai precisa ser position: relative). */
export function Sparkles({ color = XMAS_COLORS.gold }: { color?: string }) {
  return (
    <>
      {SPARKLE_SPOTS.map((spot, index) => (
        <Box
          key={index}
          aria-hidden
          className="pt-sparkle"
          sx={{
            position: 'absolute',
            left: spot.left,
            top: spot.top,
            fontSize: spot.size,
            lineHeight: 1,
            color,
            textShadow: `0 0 14px ${withAlpha(color, 0.85)}`,
            animationDelay: `${spot.delay}s`,
            pointerEvents: 'none',
          }}
        >
          ✦
        </Box>
      ))}
    </>
  )
}

/** Título de cartão de Natal: letra festiva, dourado com brilho passando. */
export function FestiveTitle({ children, size, align = 'center', color }: { children: ReactNode; size: string; align?: 'left' | 'center'; color?: string }) {
  return (
    <Box
      component="h2"
      sx={{
        m: 0,
        fontFamily: CREEPY_FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: '0.02em',
        textAlign: align,
        color: color ?? XMAS_COLORS.gold,
        filter: `drop-shadow(0 4px 0 rgba(0, 0, 0, 0.55)) drop-shadow(0 0 22px ${withAlpha(color ?? XMAS_COLORS.gold, 0.45)})`,
      }}
    >
      <span className={color ? undefined : 'pt-gold'}>{children}</span>
    </Box>
  )
}

const RAIN = ['🎁', '❄️', '⭐', '❓', '🎄', '🔔', '🦌', '🎅', '✨', '🥸']

/** Chuva de presentes, flocos e interrogações na vitória. Tela cheia, sem clique. */
export function XmasRain({ active = true, count = 36 }: { active?: boolean; count?: number }) {
  const reduced = useReducedMotion()
  if (!active || reduced || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1150, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: Math.max(1, Math.min(90, count)) }, (_, index) => {
        const style = {
          left: `${scatter(index, 51) * 100}%`,
          fontSize: `${22 + scatter(index, 52) * 30}px`,
          '--pt-dur': `${4 + scatter(index, 53) * 4}s`,
          '--pt-delay': `${-scatter(index, 54) * 8}s`,
          '--pt-drift': `${(scatter(index, 55) - 0.5) * 180}px`,
          '--pt-spin': `${(scatter(index, 56) - 0.5) * 540}deg`,
        } as CSSProperties
        return (
          <span key={index} className="pt-fall" style={style}>
            {RAIN[index % RAIN.length]}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
