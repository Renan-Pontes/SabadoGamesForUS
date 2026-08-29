import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { Player } from '../../lib/types'
import { playerColor, playerInitials, playerLabel } from '../utils'

export type PlayerRowInfo = {
  /** Linha secundária: o que a pessoa está fazendo agora. */
  status?: ReactNode
  /** Valor à direita (pontos, palpite, posição). */
  trailing?: ReactNode
  eliminated?: boolean
  /** Destaca a linha (vencedor da rodada, vez do jogador). */
  highlight?: boolean
  /** Marca "pronto/enviado" com um ponto verde pulsante. */
  ready?: boolean
}

type PlayerRosterProps = {
  players: Player[]
  /** Id do usuário logado, para marcar "você". */
  currentUserId?: number | null
  accent?: string
  describe: (player: Player) => PlayerRowInfo
  emptyLabel?: string
}

/** Lista vertical de jogadores — usada nas telas de host e celular. */
export default function PlayerRoster({
  players,
  currentUserId,
  accent = 'var(--accent-gold)',
  describe,
  emptyLabel = 'Ninguém na sala ainda.',
}: PlayerRosterProps) {
  if (players.length === 0) {
    return <Typography sx={{ color: 'var(--text-muted)' }}>{emptyLabel}</Typography>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {players.map((player, index) => {
        const info = describe(player)
        const isSelf = Boolean(currentUserId && player.user?.id === currentUserId)
        const color = playerColor(player.id)

        return (
          <Box
            key={player.id}
            className="stagger-in"
            style={{ '--stagger-index': index } as React.CSSProperties}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: 'var(--radius-md)',
              background: info.highlight
                ? `linear-gradient(100deg, ${accent}22, rgba(255,255,255,0.02))`
                : 'rgba(255, 255, 255, 0.035)',
              border: `1px solid ${
                info.highlight ? accent : isSelf ? 'rgba(255,255,255,0.16)' : 'transparent'
              }`,
              opacity: info.eliminated ? 0.45 : 1,
              filter: info.eliminated ? 'grayscale(0.75)' : 'none',
              transition: 'all 280ms ease',
            }}
          >
            {/* Avatar */}
            <Box
              sx={{
                position: 'relative',
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                letterSpacing: '0.05em',
                color: '#0a0a0f',
                background: `linear-gradient(140deg, ${color}, ${color}aa)`,
                boxShadow: info.highlight ? `0 0 16px ${color}` : 'none',
              }}
            >
              {playerInitials(player)}
              {info.ready && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--status-ready)',
                    border: '2px solid var(--bg-void)',
                    '--pulse-color': 'rgba(34, 197, 94, 0.6)',
                    animation: 'pulseGlow 1.8s ease-in-out infinite',
                  }}
                />
              )}
            </Box>

            {/* Nome + status */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.98rem',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {playerLabel(player)}
                {isSelf && (
                  <Box
                    component="span"
                    sx={{
                      ml: 0.75,
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      color: accent,
                      verticalAlign: 'middle',
                    }}
                  >
                    VOCÊ
                  </Box>
                )}
                {player.is_host && (
                  <Box
                    component="span"
                    sx={{
                      ml: 0.75,
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      verticalAlign: 'middle',
                    }}
                  >
                    HOST
                  </Box>
                )}
              </Typography>
              {info.status && (
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {info.status}
                </Typography>
              )}
            </Box>

            {info.trailing && <Box sx={{ flexShrink: 0 }}>{info.trailing}</Box>}
          </Box>
        )
      })}
    </Box>
  )
}
