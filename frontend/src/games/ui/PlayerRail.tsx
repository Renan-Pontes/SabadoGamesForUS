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
 */
export default function PlayerRail({ players, accent = 'var(--accent-gold)', describe }: PlayerRailProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: { xs: 1.5, md: 3 },
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
              minWidth: 92,
              opacity: info.eliminated ? 0.32 : 1,
              filter: info.eliminated ? 'grayscale(1)' : 'none',
              transition: 'all 320ms ease',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: { xs: 56, md: 72 },
                height: { xs: 56, md: 72 },
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                color: '#0a0a0f',
                background: `linear-gradient(140deg, ${color}, ${color}99)`,
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
                    background: 'var(--bg-void)',
                    border: '1px solid rgba(255,255,255,0.18)',
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
                fontSize: { xs: '0.78rem', md: '0.88rem' },
                fontWeight: 700,
                color: 'var(--text-primary)',
                maxWidth: 110,
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
                  fontFamily: 'var(--font-display)',
                  fontSize: { xs: '1.3rem', md: '1.7rem' },
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
