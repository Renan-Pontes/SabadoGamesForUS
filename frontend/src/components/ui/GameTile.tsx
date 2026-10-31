import { Box, Typography } from '@mui/material'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import type { Game } from '../../lib/types'
import { getGameColor, getGameMeta } from '../../lib/gameCatalog'
import { isHalloweenSlug } from '../../halloween/slugs'
import Cobweb from './Cobweb'
import { withAlpha } from './surfaces'

type GameTileProps = {
  game: Game
  selected?: boolean
  /** Marca o jogo como indisponível para o número atual de jogadores. */
  disabledReason?: string
  index?: number
  /** Versão grande, da prateleira de destaque. */
  featured?: boolean
  onSelect?: (game: Game) => void
}

/**
 * Card do catálogo de jogos, usado no lobby e na sala do host.
 *
 * Os jogos da Noite do Terror ganham teia no canto, selo "NOVO" e um brilho
 * de abóbora; os antigos ficam com a moldura simples, na paleta nova.
 */
export default function GameTile({
  game,
  selected = false,
  disabledReason,
  index = 0,
  featured = false,
  onSelect,
}: GameTileProps) {
  const meta = getGameMeta(game.slug)
  const color = getGameColor(game.slug)
  const spooky = isHalloweenSlug(game.slug)
  const interactive = Boolean(onSelect) && !disabledReason
  // Jogo sem ficha no catálogo do front: a descrição do servidor diz mais
  // do que o texto genérico de reserva.
  const pitch = meta.duration === '—' && game.description ? game.description : meta.pitch

  return (
    <Box
      className="stagger-in"
      style={{ '--stagger-index': index } as React.CSSProperties}
      onClick={interactive ? () => onSelect?.(game) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={disabledReason ? true : undefined}
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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${selected ? color : spooky ? withAlpha(color, 0.38) : 'rgba(72, 48, 108, 0.7)'}`,
        background: selected
          ? `linear-gradient(155deg, ${withAlpha(color, 0.2)} 0%, rgba(12, 7, 22, 0.94) 70%)`
          : spooky
            ? `radial-gradient(ellipse 90% 70% at 0% 0%, ${withAlpha(color, 0.14)}, transparent 60%), linear-gradient(160deg, rgba(34, 19, 58, 0.92) 0%, rgba(12, 7, 22, 0.94) 100%)`
            : 'linear-gradient(160deg, rgba(31, 18, 54, 0.88) 0%, rgba(12, 7, 22, 0.92) 100%)',
        boxShadow: selected
          ? `0 18px 44px rgba(0,0,0,0.5), 0 0 34px ${withAlpha(color, 0.3)}`
          : '0 14px 34px rgba(0,0,0,0.42)',
        p: featured ? { xs: 2.25, md: 2.75 } : 2.5,
        opacity: disabledReason ? 0.5 : 1,
        transition: 'all 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        ...(interactive && {
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: color,
            boxShadow: `0 22px 50px rgba(0,0,0,0.5), 0 0 34px ${withAlpha(color, 0.3)}`,
          },
          '&:hover .tile-icon': { animation: 'wobble 1.2s ease-in-out infinite' },
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

      {spooky && <Cobweb corner="top-right" size={featured ? 78 : 64} opacity={0.15} />}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5, position: 'relative' }}>
        <Box
          className="tile-icon"
          sx={{
            width: featured ? 56 : 46,
            height: featured ? 56 : 46,
            flexShrink: 0,
            borderRadius: 'var(--radius-lg)',
            display: 'grid',
            placeItems: 'center',
            fontSize: featured ? '2rem' : '1.6rem',
            background: withAlpha(color, 0.13),
            border: `1px solid ${withAlpha(color, 0.3)}`,
            boxShadow: spooky ? `0 0 18px ${withAlpha(color, 0.25)}` : 'none',
          }}
        >
          {meta.icon}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, pr: spooky ? 1.5 : 0 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: featured ? '1.35rem' : '1.2rem',
              lineHeight: 1.12,
              letterSpacing: '0.04em',
              color: selected ? color : 'var(--text-primary)',
              // Só quebra palavra que não cabe nem sozinha na linha.
              overflowWrap: 'break-word',
            }}
          >
            {game.name}
          </Typography>
          {/* Selo na linha do clima, e não ao lado do título: lá ele espremia
              o nome até quebrar letra por letra. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
            <Typography
              sx={{
                fontSize: '0.6rem',
                letterSpacing: '0.16em',
                fontWeight: 800,
                color,
                opacity: 0.9,
              }}
            >
              {meta.vibe.toUpperCase()}
            </Typography>
            {selected ? (
              <Box
                component="span"
                className="animate-pop-in"
                sx={{
                  px: 0.75,
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.55rem',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  lineHeight: 1.6,
                  color: '#0a0612',
                  background: color,
                }}
              >
                ✓ ESCOLHIDO
              </Box>
            ) : (
              spooky && (
                <Box
                  component="span"
                  sx={{
                    px: 0.75,
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.55rem',
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    lineHeight: 1.6,
                    color: '#1a0b02',
                    background: 'linear-gradient(120deg, var(--pumpkin-light), var(--pumpkin))',
                  }}
                >
                  NOVO
                </Box>
              )
            )}
          </Box>
        </Box>
      </Box>

      <Typography
        sx={{
          color: 'var(--text-secondary)',
          fontSize: featured ? '0.92rem' : '0.87rem',
          flex: 1,
          mb: 1.75,
          position: 'relative',
        }}
      >
        {pitch}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          pt: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
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
