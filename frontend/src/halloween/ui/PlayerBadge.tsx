import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { withAlpha } from './color'
import { ChristmasAvatar, getAvatar, useAvatar, type AvatarId, type AvatarInfo } from '../../natal/avatars'
import './spooky.css'

type PlayerBadgeProps = {
  name: string
  /**
   * Cor da borda/brilho (padrão: a cor do avatar da pessoa). O avatar
   * continua com a cor dele, para ser o mesmo do lobby e do celular.
   */
  color?: string
  /** Id do jogador: acha o avatar sem depender do nome. */
  playerId?: number
  /** Força um avatar (padrão: o da mesa, pelo RoomAvatarsProvider; sem mesa, pelo nome). */
  avatar?: AvatarInfo | AvatarId
  /** Avatar respirando/piscando (padrão: só no tamanho 'lg', o da TV). */
  animated?: boolean
  /** Já agiu nesta fase (mostra ✓ sem revelar o quê). */
  acted?: boolean
  /** Saiu da rodada (virou boneco de neve). O nome `ghost` ficou do Halloween. */
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

const SIZES = {
  sm: { height: 30, font: '0.85rem', avatar: 24, gap: 0.75, px: 0.75 },
  md: { height: 38, font: '1rem', avatar: 32, gap: 1, px: 1 },
  lg: { height: 56, font: '1.8rem', avatar: 48, gap: 1.25, px: 1.25 },
} as const

/**
 * Nome do jogador em pílula: avatar de Natal (o mesmo do lobby e do
 * celular), ✓ de quem já agiu, ☃️ de quem saiu da rodada (avatar
 * congelado com um boneco de neve no canto).
 *
 *   <PlayerBadge name={p.name} acted={state.acted?.includes(p.id)} ghost={dead} size="lg" />
 */
export default function PlayerBadge({
  name,
  color,
  playerId,
  avatar,
  animated,
  acted = false,
  ghost = false,
  host = false,
  offline = false,
  size = 'md',
  highlight = false,
  trailing,
}: PlayerBadgeProps) {
  const fromRoom = useAvatar({ id: playerId, name })
  const look = avatar === undefined ? fromRoom : typeof avatar === 'string' ? getAvatar(avatar) : avatar
  const tint = color ?? look.color
  const s = SIZES[size]

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
          ? `linear-gradient(90deg, ${withAlpha(tint, 0.32)}, rgba(6, 16, 31, 0.85))`
          : 'rgba(6, 16, 31, 0.72)',
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
      <Box sx={{ position: 'relative', width: s.avatar, height: s.avatar, flexShrink: 0 }}>
        <ChristmasAvatar
          avatar={look}
          size={s.avatar}
          frozen={ghost}
          animated={animated ?? size === 'lg'}
          title=""
        />
        {ghost && (
          <Box
            component="span"
            aria-label="fora da rodada"
            sx={{
              position: 'absolute',
              right: '-18%',
              bottom: '-14%',
              fontSize: `${Math.round(s.avatar * 0.52)}px`,
              lineHeight: 1,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
            }}
          >
            ☃️
          </Box>
        )}
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
            background: '#4fd67e',
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
