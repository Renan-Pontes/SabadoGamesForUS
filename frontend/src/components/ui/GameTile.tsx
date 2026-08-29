import { Box, Typography } from '@mui/material'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import type { Game } from '../../lib/types'
import { getGameColor, getGameMeta } from '../../lib/gameCatalog'

type GameTileProps = {
  game: Game
  selected?: boolean
  /** Marca o jogo como indisponível para o número atual de jogadores. */
  disabledReason?: string
  index?: number
  onSelect?: (game: Game) => void
}

/** Card do catálogo de jogos, usado no lobby e na sala do host. */
export default function GameTile({
  game,
  selected = false,
  disabledReason,
  index = 0,
  onSelect,
}: GameTileProps) {
  const meta = getGameMeta(game.slug)
  const color = getGameColor(game.slug)
  const interactive = Boolean(onSelect) && !disabledReason

  return (
    <Box
      className="stagger-in"
      style={{ '--stagger-index': index } as React.CSSProperties}
      onClick={interactive ? () => onSelect?.(game) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect?.(game)
              }
            }
          : undefined
      }
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${selected ? color : 'rgba(42, 42, 58, 0.9)'}`,
        background: selected
          ? `linear-gradient(155deg, ${color}26 0%, rgba(10, 10, 15, 0.95) 70%)`
          : 'linear-gradient(160deg, rgba(26, 26, 36, 0.92) 0%, rgba(10, 10, 15, 0.94) 100%)',
        boxShadow: selected
          ? `0 18px 44px rgba(0,0,0,0.5), 0 0 34px ${color}3d`
          : '0 14px 34px rgba(0,0,0,0.4)',
        p: 2.5,
        opacity: disabledReason ? 0.5 : 1,
        transition: 'all 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        ...(interactive && {
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: color,
            boxShadow: `0 22px 50px rgba(0,0,0,0.5), 0 0 34px ${color}3d`,
          },
        }),
      }}
    >
      {/* Filete do jogo */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: selected ? 1 : 0.35,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 'var(--radius-lg)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.6rem',
            background: `${color}1f`,
            border: `1px solid ${color}44`,
          }}
        >
          {meta.icon}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.15rem',
              lineHeight: 1.15,
              letterSpacing: '0.04em',
              color: selected ? color : 'var(--text-primary)',
            }}
          >
            {game.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.6rem',
              letterSpacing: '0.16em',
              fontWeight: 800,
              color,
              opacity: 0.85,
            }}
          >
            {meta.vibe.toUpperCase()}
          </Typography>
        </Box>

        {selected && (
          <Box
            className="animate-pop-in"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 'var(--radius-full)',
              background: color,
              color: '#0a0a0f',
              fontSize: '0.55rem',
              fontWeight: 900,
              letterSpacing: '0.12em',
              flexShrink: 0,
            }}
          >
            ESCOLHIDO
          </Box>
        )}
      </Box>

      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.87rem', flex: 1, mb: 1.75 }}>
        {meta.pitch}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          pt: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--text-muted)',
          fontSize: '0.72rem',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleAltRoundedIcon sx={{ fontSize: '0.95rem' }} />
          {game.min_players}–{game.max_players}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ScheduleRoundedIcon sx={{ fontSize: '0.95rem' }} />
          {meta.duration}
        </Box>
      </Box>

      {disabledReason && (
        <Typography
          sx={{
            mt: 1.25,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--status-waiting)',
          }}
        >
          {disabledReason}
        </Typography>
      )}
    </Box>
  )
}
