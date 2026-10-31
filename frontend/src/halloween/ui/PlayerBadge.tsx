import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { withAlpha } from './color'
import './spooky.css'

type PlayerBadgeProps = {
  name: string
  /** Cor do jogador (padrão: sai do nome, sempre a mesma). */
  color?: string
  /** Já agiu nesta fase (mostra ✓ sem revelar o quê). */
  acted?: boolean
  /** Morreu / virou fantasma. */
  ghost?: boolean
  host?: boolean
  offline?: boolean
  /** 'lg' para a TV (legível a 3 m). */
  size?: 'sm' | 'md' | 'lg'
  /** Destaque (ex.: a vez dessa pessoa). */
  highlight?: boolean
  /** Algo à direita (pontos, voto...). */
  trailing?: ReactNode
}

const COLORS = ['#ff7a18', '#a855f7', '#84cc16', '#f43f5e', '#22d3ee', '#fbbf24', '#e879f9', '#34d399', '#fb923c', '#60a5fa']

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973
  return COLORS[hash % COLORS.length]
}

const SIZES = {
  sm: { height: 30, font: '0.85rem', avatar: 22, gap: 0.75, px: 0.75 },
  md: { height: 38, font: '1rem', avatar: 28, gap: 1, px: 1 },
  lg: { height: 56, font: '1.8rem', avatar: 42, gap: 1.25, px: 1.25 },
} as const

/**
 * Nome do jogador em pílula: cor, ✓ de quem já agiu, 👻 de quem morreu.
 *
 *   <PlayerBadge name={p.name} acted={state.acted?.includes(p.id)} ghost={dead} size="lg" />
 */
export default function PlayerBadge({
  name,
  color,
  acted = false,
  ghost = false,
  host = false,
  offline = false,
  size = 'md',
  highlight = false,
  trailing,
}: PlayerBadgeProps) {
  const tint = color ?? colorFor(name)
  const s = SIZES[size]
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Box
      className={ghost ? 'hw-float' : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        maxWidth: '100%',
        height: s.height,
        pl: `${(s.height - s.avatar) / 2}px`,
        pr: s.px * 1.5,
        borderRadius: 999,
        border: `2px ${offline ? 'dashed' : 'solid'} ${withAlpha(tint, highlight ? 0.95 : 0.5)}`,
        background: highlight
          ? `linear-gradient(90deg, ${withAlpha(tint, 0.32)}, rgba(12, 6, 20, 0.85))`
          : 'rgba(12, 6, 20, 0.72)',
        boxShadow: highlight ? `0 0 18px ${withAlpha(tint, 0.45)}` : 'none',
        opacity: ghost ? 0.55 : offline ? 0.5 : 1,
        filter: ghost ? 'grayscale(0.7)' : 'none',
        color: 'var(--text-primary)',
        fontSize: s.font,
        fontWeight: 700,
        lineHeight: 1,
        transition: 'opacity 300ms ease, border-color 300ms ease',
      }}
    >
      <Box
        sx={{
          width: s.avatar,
          height: s.avatar,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: ghost ? 'rgba(224, 242, 254, 0.2)' : tint,
          color: '#0b0614',
          fontSize: `calc(${s.font} * 0.8)`,
          fontWeight: 800,
        }}
      >
        {ghost ? '👻' : initial}
      </Box>
      <Box
        component="span"
        sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </Box>
      {host && (
        <Box component="span" aria-label="host" sx={{ flexShrink: 0 }}>
          👑
        </Box>
      )}
      {offline && (
        <Box component="span" aria-label="offline" sx={{ flexShrink: 0 }}>
          💤
        </Box>
      )}
      {acted && (
        <Box
          component="span"
          aria-label="já agiu"
          className="animate-pop-in"
          sx={{
            flexShrink: 0,
            width: `calc(${s.font} * 1.1)`,
            height: `calc(${s.font} * 1.1)`,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: '#22c55e',
            color: '#04160b',
            fontSize: `calc(${s.font} * 0.75)`,
            fontWeight: 900,
          }}
        >
          ✓
        </Box>
      )}
      {trailing && (
        <Box component="span" sx={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
          {trailing}
        </Box>
      )}
    </Box>
  )
}
