import { Box, Typography } from '@mui/material'
import type { Player } from '../../lib/types'
import { playerColor, playerInitials, playerLabel } from '../../games/utils'

type SeatGridProps = {
  players: Player[]
  /** Quantas cadeiras desenhar no total; as vagas aparecem vazias. */
  capacity?: number
  /** `tv` aumenta tudo para leitura à distância. */
  variant?: 'tv' | 'compact'
}

/**
 * A mesa se enchendo. As cadeiras vazias são desenhadas de propósito: numa
 * TV de sala, ver quantos lugares faltam é mais útil do que só a lista de
 * quem já entrou.
 */
export default function SeatGrid({
  players,
  capacity,
  variant = 'tv',
}: SeatGridProps) {
  const isTv = variant === 'tv'
  const total = Math.max(players.length, Math.min(capacity ?? players.length, 12))
  const emptySeats = Math.max(0, total - players.length)

  const avatarSize = isTv ? { xs: 64, md: 88 } : { xs: 48, md: 56 }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: { xs: 2, md: 3 },
      }}
    >
      {players.map((player, index) => {
        const color = playerColor(player.id)
        const online = player.online ?? true

        return (
          <Box
            key={player.id}
            className="stagger-in"
            style={{ '--stagger-index': index } as React.CSSProperties}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.9,
              width: isTv ? 130 : 96,
              opacity: online ? 1 : 0.4,
              transition: 'opacity 300ms ease',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: avatarSize,
                height: avatarSize,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: isTv ? { xs: '1.4rem', md: '1.9rem' } : '1.1rem',
                color: '#0a0a0f',
                background: `linear-gradient(140deg, ${color}, ${color}aa)`,
                border: player.ready ? '3px solid var(--status-ready)' : '3px solid transparent',
                boxShadow: player.ready
                  ? '0 0 26px rgba(34, 197, 94, 0.5)'
                  : '0 10px 24px rgba(0,0,0,0.45)',
                transition: 'all 320ms ease',
              }}
            >
              {playerInitials(player)}

              {player.is_host && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -4,
                    fontSize: isTv ? '1.1rem' : '0.9rem',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                  }}
                >
                  👑
                </Box>
              )}
            </Box>

            <Typography
              sx={{
                fontWeight: 700,
                fontSize: isTv ? { xs: '0.9rem', md: '1.05rem' } : '0.85rem',
                color: 'var(--text-primary)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {playerLabel(player)}
            </Typography>

            <Typography
              sx={{
                fontSize: '0.6rem',
                letterSpacing: '0.16em',
                fontWeight: 800,
                color: !online
                  ? 'var(--status-offline)'
                  : player.ready
                    ? 'var(--status-ready)'
                    : 'var(--status-waiting)',
              }}
            >
              {!online ? 'OFFLINE' : player.ready ? '✓ PRONTO' : 'AGUARDANDO'}
            </Typography>
          </Box>
        )
      })}

      {/* Cadeiras vazias */}
      {Array.from({ length: emptySeats }).map((_, index) => (
        <Box
          key={`empty-${index}`}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.9,
            width: isTv ? 130 : 96,
          }}
        >
          <Box
            sx={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: '2px dashed rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.16)',
              fontSize: isTv ? '1.8rem' : '1.2rem',
              animation: 'pulse 3s ease-in-out infinite',
              animationDelay: `${index * 220}ms`,
            }}
          >
            +
          </Box>
          <Typography
            sx={{
              fontSize: '0.6rem',
              letterSpacing: '0.16em',
              fontWeight: 800,
              color: 'var(--text-muted)',
              opacity: 0.5,
            }}
          >
            LIVRE
          </Typography>
        </Box>
      ))}

      {players.length === 0 && emptySeats === 0 && (
        <Typography sx={{ color: 'var(--text-muted)' }}>Ninguém entrou ainda.</Typography>
      )}
    </Box>
  )
}
