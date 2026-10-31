import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { Player } from '../../lib/types'
import { playerColor, playerInitials, playerLabel } from '../utils'

export type RailInfo = {
  /** Valor grande sob o nome (pontos, palpite revelado). */
  value?: ReactNode
  /** Etiqueta pequena (status curto). */
  caption?: ReactNode
  eliminated?: boolean
  highlight?: boolean
  /** Emblema no canto do avatar (💀, 👑, ✓). */
  badge?: string
}

type PlayerRailProps = {
  players: Player[]
  accent?: string
  describe: (player: Player) => RailInfo
}

/**
 * Fileira horizontal de avatares grandes — desenhada para a TV, onde a
 * pessoa está a três metros de distância e precisa bater o olho e entender.
 * Com mesa cheia (mais de 10) os avatares encolhem um pouco para caber em
 * duas fileiras.
 */
export default function PlayerRail({ players, accent = 'var(--accent-gold)', describe }: PlayerRailProps) {
  const crowded = players.length > 10

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: crowded ? { xs: 1.25, md: 2 } : { xs: 1.5, md: 3 },
      }}
    >
      {players.map((player, index) => {
        const info = describe(player)
        const color = playerColor(player.id)

        return (
          <Box
            key={player.id}
            className="stagger-in"
            style={{ '--stagger-index': index } as React.CSSProperties}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.6,
              minWidth: crowded ? 80 : 92,
              opacity: info.eliminated ? 0.32 : 1,
              filter: info.eliminated ? 'grayscale(1)' : 'none',
              transition: 'all 320ms ease',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: crowded ? { xs: 50, md: 62 } : { xs: 56, md: 72 },
                height: crowded ? { xs: 50, md: 62 } : { xs: 56, md: 72 },
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-numeric)',
                fontSize: crowded ? { xs: '1.25rem', md: '1.5rem' } : { xs: '1.35rem', md: '1.7rem' },
                letterSpacing: '0.04em',
                color: '#0a0612',
                background: `radial-gradient(circle at 32% 28%, ${color}, ${color}99 72%)`,
                border: info.highlight ? `3px solid ${accent}` : '3px solid transparent',
                boxShadow: info.highlight ? `0 0 28px ${accent}` : '0 8px 20px rgba(0,0,0,0.45)',
                transition: 'all 320ms ease',
              }}
            >
              {playerInitials(player)}
              {info.badge && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(176, 107, 255, 0.4)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.85rem',
                    animation: 'popIn 340ms cubic-bezier(0.22, 1, 0.36, 1) both',
                  }}
                >
                  {info.badge}
                </Box>
              )}
            </Box>

            <Typography
              sx={{
                fontSize: { xs: '0.8rem', md: '0.95rem' },
                fontWeight: 700,
                color: 'var(--text-primary)',
                maxWidth: crowded ? 96 : 110,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {playerLabel(player)}
            </Typography>

            {info.value !== undefined && info.value !== null && (
              <Typography
                sx={{
                  fontFamily: 'var(--font-numeric)',
                  fontSize: { xs: '1.45rem', md: '1.9rem' },
                  lineHeight: 1,
                  color: info.highlight ? accent : 'var(--text-primary)',
                  textShadow: info.highlight ? `0 0 18px ${accent}` : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {info.value}
              </Typography>
            )}

            {info.caption && (
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                {info.caption}
              </Typography>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
