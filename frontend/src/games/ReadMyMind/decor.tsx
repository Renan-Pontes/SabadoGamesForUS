import type { CSSProperties, ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { SnowCap } from '../../components/ui'
import { playerColor } from '../utils'
import { ADVENT_TREATS, NUMBER_FONT, ORNAMENT_COLORS, XMAS } from './look'
import type { Player } from './types'
import { scatter, seatLabel } from './view'
import { MiniBack } from './XmasCard'

/**
 * Enfeites da Mente Natalina: vidas que são bolas da árvore (e estouram),
 * calendário do Advento dos níveis, explosão de neve, mesa de feltro e o
 * assento de cada jogador. Só SVG + CSS (as TVs são fraquinhas).
 */

function asArray(sx?: SxProps<Theme>) {
  return Array.isArray(sx) ? sx : sx ? [sx] : []
}

// ---------------------------------------------------------------------------
// Vidas: bolas penduradas num festão
// ---------------------------------------------------------------------------

const STRINGS = [18, 34, 24, 40, 28]

export function OrnamentLives({ lives, max, size = 44, label = true }: { lives: number; max: number; size?: number; label?: boolean }) {
  return (
    <Box
      role="img"
      aria-label={`${lives} de ${max} ${max === 1 ? 'vida' : 'vidas'}`}
      sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {label && (
        <Typography sx={{ fontSize: size * 0.3, letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-secondary)', lineHeight: 1, mb: 0.5 }}>
          ENFEITES
        </Typography>
      )}
      {/* Festão dourado de onde as bolas pendem */}
      <Box
        aria-hidden
        sx={{
          width: '100%',
          minWidth: size * max * 1.15,
          height: size * 0.22,
          borderRadius: '0 0 50% 50% / 0 0 100% 100%',
          borderBottom: `${Math.max(2, size * 0.07)}px dotted ${XMAS.gold}`,
        }}
      />
      <Box sx={{ display: 'flex', gap: `${size * 0.18}px`, mt: `-${size * 0.08}px` }}>
        {Array.from({ length: max }, (_, index) => (
          <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size }}>
            <Box sx={{ width: 2, height: (STRINGS[index % STRINGS.length] * size) / 60, background: 'rgba(244, 248, 255, 0.55)' }} />
            {index < lives ? (
              <Ornament key={`ok-${index}`} color={ORNAMENT_COLORS[index % ORNAMENT_COLORS.length]} size={size} index={index} />
            ) : (
              <BrokenOrnament key={`lost-${index}`} color={ORNAMENT_COLORS[index % ORNAMENT_COLORS.length]} size={size} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function Ornament({ color, size, index }: { color: string; size: number; index: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        transformOrigin: 'top center',
        animation: `ornamentSwing ${2.4 + index * 0.4}s ease-in-out infinite`,
        animationDelay: `${-index * 0.6}s`,
        filter: `drop-shadow(0 0 ${size * 0.25}px ${color}88)`,
      }}
    >
      <svg width={size} height={size * 1.1} viewBox="0 0 40 44" style={{ display: 'block', overflow: 'visible' }}>
        <rect x="15" y="0" width="10" height="7" rx="1.5" fill={XMAS.gold} />
        <circle cx="20" cy="25" r="17" fill={color} />
        <path d="M4 23 Q20 31 36 23" stroke="rgba(255,255,255,0.6)" strokeWidth="2.6" fill="none" />
        <path d="M5 30 Q20 37 35 30" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" fill="none" strokeDasharray="2 3" />
        <circle cx="13" cy="18" r="4.4" fill="rgba(255,255,255,0.65)" />
      </svg>
    </Box>
  )
}

const SHARDS = Array.from({ length: 9 }, (_, i) => ({
  angle: (i / 9) * Math.PI * 2 + scatter(i, 3),
  dist: 0.9 + scatter(i, 5) * 0.9,
  spin: Math.round((scatter(i, 7) - 0.5) * 720),
  scale: 0.6 + scatter(i, 9) * 0.7,
}))

/** Bola que acabou de cair: o ganchinho fica e os cacos voam. */
function BrokenOrnament({ color, size }: { color: string; size: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width: size,
        height: size * 1.1,
        '@keyframes rmmShard': {
          '0%': { opacity: 1, transform: 'translate(-50%, -50%) rotate(0deg) scale(1)' },
          '100%': {
            opacity: 0,
            transform: 'translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--spin)) scale(0.4)',
          },
        },
        '@keyframes rmmPoof': {
          '0%': { opacity: 0.9, transform: 'translate(-50%, -50%) scale(0.4)' },
          '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(2.4)' },
        },
      }}
    >
      <svg width={size} height={size * 1.1} viewBox="0 0 40 44" style={{ display: 'block', overflow: 'visible' }}>
        <rect x="15" y="0" width="10" height="7" rx="1.5" fill={XMAS.gold} opacity="0.85" />
        <path d="M14 7 L26 7 L24 12 L21 10 L18 13 L16 10 Z" fill={color} opacity="0.75" />
        <circle cx="20" cy="25" r="17" fill="none" stroke="rgba(244, 248, 255, 0.28)" strokeWidth="1.6" strokeDasharray="3 4" />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '57%',
          width: size,
          height: size,
          borderRadius: '50%',
          border: `3px solid ${color}`,
          opacity: 0,
          animation: 'rmmPoof 700ms ease-out both',
        }}
      />
      {SHARDS.map((shard, index) => (
        <Box
          key={index}
          style={
            {
              '--dx': `${Math.cos(shard.angle) * shard.dist * size}px`,
              '--dy': `${Math.sin(shard.angle) * shard.dist * size + size * 0.6}px`,
              '--spin': `${shard.spin}deg`,
            } as CSSProperties
          }
          sx={{
            position: 'absolute',
            left: '50%',
            top: '57%',
            width: size * 0.22 * shard.scale,
            height: size * 0.3 * shard.scale,
            background: color,
            clipPath: 'polygon(50% 0, 100% 100%, 0 80%)',
            opacity: 0,
            animation: 'rmmShard 1100ms cubic-bezier(0.2, 0.7, 0.4, 1) both',
          }}
        />
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Calendário do Advento: uma porta por nível
// ---------------------------------------------------------------------------

export function AdventCalendar({
  opened,
  current,
  max,
  size = 48,
}: {
  /** Quantas portas já abriram (níveis vencidos). */
  opened: number
  /** Nível em jogo agora (porta brilhando), ou null. */
  current: number | null
  max: number
  size?: number
}) {
  return (
    <Box
      role="img"
      aria-label={`Calendário do Advento: ${opened} de ${max} níveis`}
      sx={{
        display: 'flex',
        gap: `${Math.round(size * 0.14)}px`,
        p: `${Math.round(size * 0.16)}px`,
        borderRadius: `${Math.round(size * 0.24)}px`,
        background: `linear-gradient(160deg, ${XMAS.woodLight}, ${XMAS.woodDark})`,
        border: `2px solid ${XMAS.gold}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(0,0,0,0.25)',
      }}
    >
      {Array.from({ length: max }, (_, index) => {
        const day = index + 1
        const isOpen = day <= opened
        const isCurrent = current === day && !isOpen
        return (
          <Box
            key={day}
            sx={{
              position: 'relative',
              width: size,
              height: Math.round(size * 1.18),
              borderRadius: `${Math.round(size * 0.14)}px`,
              background: `radial-gradient(circle at 50% 45%, ${XMAS.cream}, ${XMAS.creamShade})`,
              perspective: `${size * 6}px`,
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)',
              display: 'grid',
              placeItems: 'center',
              '--pulse-color': 'rgba(245, 194, 66, 0.85)',
              animation: isCurrent ? 'pulseGlow 1.6s ease-in-out infinite' : undefined,
            }}
          >
            <Box aria-hidden sx={{ fontSize: size * 0.56, lineHeight: 1 }}>
              {ADVENT_TREATS[index % ADVENT_TREATS.length]}
            </Box>
            {/* A portinha */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: `${Math.round(size * 0.14)}px`,
                transformOrigin: 'left center',
                transform: isOpen ? 'rotateY(-112deg)' : 'none',
                transition: 'transform 900ms cubic-bezier(0.3, 1.3, 0.5, 1)',
                backfaceVisibility: 'hidden',
                background:
                  day % 2
                    ? `linear-gradient(160deg, #d63445, ${XMAS.ink})`
                    : `linear-gradient(160deg, #22a35c, ${XMAS.inkGreen})`,
                border: `2px solid ${isCurrent ? XMAS.goldLight : 'rgba(255, 217, 117, 0.65)'}`,
                display: 'grid',
                placeItems: 'center',
                fontFamily: NUMBER_FONT,
                fontWeight: 700,
                fontSize: size * 0.5,
                color: '#fff6dc',
                textShadow: '0 2px 0 rgba(0,0,0,0.35)',
                boxShadow: isOpen ? 'none' : 'inset 0 -3px 0 rgba(0,0,0,0.25)',
              }}
            >
              {day}
              <Box
                sx={{
                  position: 'absolute',
                  right: '14%',
                  top: '50%',
                  width: size * 0.1,
                  height: size * 0.1,
                  borderRadius: '50%',
                  background: XMAS.goldLight,
                }}
              />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Explosão de neve (nível vencido)
// ---------------------------------------------------------------------------

const FLAKES = ['❄', '✦', '❅', '★', '❆']

export function SnowBurst({ count = 28, spread = 420, seed = 0 }: { count?: number; spread?: number; seed?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 5,
        '@keyframes rmmFlake': {
          '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
          '15%': { opacity: 1 },
          '100%': { opacity: 0, transform: 'translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--spin)) scale(1)' },
        },
      }}
    >
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + scatter(index, seed) * 0.5
        const dist = spread * (0.45 + scatter(index, seed + 1) * 0.55)
        return (
          <Box
            key={index}
            component="span"
            style={
              {
                '--dx': `${Math.cos(angle) * dist}px`,
                '--dy': `${Math.sin(angle) * dist * 0.7 + 60}px`,
                '--spin': `${Math.round((scatter(index, seed + 2) - 0.5) * 540)}deg`,
                animationDelay: `${Math.round(scatter(index, seed + 3) * 260)}ms`,
              } as CSSProperties
            }
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              fontSize: 18 + scatter(index, seed + 4) * 30,
              color: index % 5 === 3 ? XMAS.goldLight : '#ffffff',
              textShadow: '0 0 10px rgba(127, 216, 255, 0.9)',
              opacity: 0,
              animation: 'rmmFlake 1900ms cubic-bezier(0.15, 0.7, 0.35, 1) both',
            }}
          >
            {FLAKES[index % FLAKES.length]}
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// A mesa: feltro verde com borda de madeira nevada
// ---------------------------------------------------------------------------

export function FeltTable({ children, sx, round = 48 }: { children: ReactNode; sx?: SxProps<Theme>; round?: number }) {
  return (
    <Box
      sx={[
        {
          position: 'relative',
          p: { xs: 1.25, md: 2 },
          borderRadius: `${round}px`,
          background: `linear-gradient(180deg, ${XMAS.woodLight} 0%, ${XMAS.wood} 40%, ${XMAS.woodDark} 100%)`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.18)',
          overflow: 'hidden',
        },
        ...asArray(sx),
      ]}
    >
      <SnowCap height={12} />
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          borderRadius: `${Math.max(12, round - 14)}px`,
          background: [
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.08), transparent 70%)',
            'repeating-radial-gradient(circle at 30% 30%, rgba(0,0,0,0.035) 0 2px, transparent 2px 5px)',
            `radial-gradient(ellipse at 50% 40%, #1f9655 0%, ${XMAS.felt} 45%, ${XMAS.feltDark} 100%)`,
          ].join(', '),
          boxShadow: 'inset 0 0 70px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(245, 194, 66, 0.35)',
          outline: '2px dashed rgba(255, 217, 117, 0.28)',
          outlineOffset: '-14px',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Assento de cada jogador (TV)
// ---------------------------------------------------------------------------

/** Gorrinho de Papai Noel por cima do avatar. */
function SantaHat({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 40 28"
      aria-hidden
      style={{ position: 'absolute', top: -size * 0.38, left: '50%', transform: 'translateX(-38%) rotate(14deg)', overflow: 'visible' }}
    >
      <path d="M4 22 C 8 8 18 2 30 6 C 34 8 36 14 36 18 C 32 14 28 12 24 14 C 20 16 16 20 14 22 Z" fill={XMAS.red} />
      <rect x="1" y="19" width="26" height="7" rx="3.5" fill="#f4f8ff" />
      <circle cx="36" cy="19" r="4" fill="#f4f8ff" />
    </svg>
  )
}

export type SeatTone = 'normal' | 'justPlayed' | 'oops' | 'hadLower'

export function PlayerSeat({
  player,
  tone = 'normal',
  compact = false,
  revealed = [],
}: {
  player: Player
  tone?: SeatTone
  compact?: boolean
  /** Cartas menores reveladas no erro (aparecem viradas para cima). */
  revealed?: number[]
}) {
  const avatar = compact ? 46 : 62
  const out = player.isEliminated
  const ring =
    tone === 'justPlayed' ? XMAS.gold : tone === 'oops' ? XMAS.red : tone === 'hadLower' ? XMAS.ice : 'rgba(255,255,255,0.25)'
  const count = player.cards.length
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.6,
        minWidth: compact ? 92 : 120,
        maxWidth: compact ? 130 : 170,
        opacity: out ? 0.55 : player.connected ? 1 : 0.6,
        transition: 'opacity 320ms ease',
      }}
    >
      <Box sx={{ position: 'relative', mt: `${avatar * 0.3}px` }}>
        <Box
          key={tone}
          className={tone === 'oops' ? 'animate-shake' : tone === 'justPlayed' ? 'animate-pop-in' : undefined}
          sx={{
            width: avatar,
            height: avatar,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontFamily: NUMBER_FONT,
            fontWeight: 700,
            fontSize: avatar * 0.46,
            color: '#0b1a33',
            background: out
              ? 'radial-gradient(circle at 35% 30%, #ffffff, #cfe3f7)'
              : `radial-gradient(circle at 35% 30%, #ffffff55, transparent 45%), ${playerColor(Number(player.id) || 0)}`,
            border: `3px solid ${ring}`,
            boxShadow: tone === 'normal' ? '0 6px 16px rgba(0,0,0,0.45)' : `0 0 22px ${ring}, 0 6px 16px rgba(0,0,0,0.45)`,
          }}
        >
          {out ? '☃️' : player.name.charAt(0).toUpperCase()}
        </Box>
        {!out && <SantaHat size={avatar * 0.62} />}
        {tone === 'oops' && (
          <Box
            className="animate-pop-in"
            sx={{ position: 'absolute', right: -10, top: -6, fontSize: avatar * 0.42, lineHeight: 1 }}
            aria-hidden
          >
            🙈
          </Box>
        )}
      </Box>

      <Typography
        noWrap
        sx={{
          maxWidth: '100%',
          fontWeight: 800,
          fontSize: compact ? '1.15rem' : '1.45rem',
          lineHeight: 1.1,
          color: tone === 'justPlayed' ? XMAS.goldLight : 'var(--text-primary)',
        }}
      >
        {player.name}
      </Typography>

      {revealed.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {revealed.map((value) => (
            <Box
              key={value}
              className="animate-pop-in"
              sx={{
                px: 0.9,
                borderRadius: '8px',
                background: XMAS.cream,
                color: XMAS.ink,
                border: `2px solid ${XMAS.ice}`,
                fontFamily: NUMBER_FONT,
                fontWeight: 700,
                fontSize: compact ? '1.1rem' : '1.35rem',
                lineHeight: 1.3,
              }}
            >
              {value}
            </Box>
          ))}
        </Box>
      ) : out || count === 0 || !player.connected ? (
        <Typography sx={{ fontSize: compact ? '0.95rem' : '1.1rem', fontWeight: 700, color: out ? '#bfe6ff' : count === 0 ? XMAS.pine : 'var(--text-muted)' }}>
          {count === 0 && !out && player.connected ? '✓ ' : ''}
          {seatLabel(player)}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', height: compact ? 22 : 28 }} aria-label={seatLabel(player)}>
          {Array.from({ length: Math.min(count, 10) }, (_, index) => (
            <Box key={index} sx={{ ml: index ? (compact ? '-7px' : '-8px') : 0 }}>
              <MiniBack size={compact ? 14 : 18} tilt={(index - (Math.min(count, 10) - 1) / 2) * 6} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
