import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import type { Player } from '../../lib/types'
import { withAlpha } from '../../components/ui/surfaces'
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

/** A partir daqui a lista vira grade (onde houver largura) e as linhas encolhem. */
const GRID_FROM = 7
const DENSE_FROM = 9

/**
 * Lista de jogadores — usada nas telas de host, celular e TV.
 *
 * Com mesa cheia (até 15 na Noite do Terror) uma coluna só passava da altura
 * da TV: a partir de 7 pessoas a lista vira grade de colunas de ~230 px. No
 * celular continua uma coluna (não cabe duas), só que mais compacta.
 */
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

  const grid = players.length >= GRID_FROM
  const dense = players.length >= DENSE_FROM
  const avatar = dense ? 34 : 40

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: grid ? 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' : '1fr',
        gap: dense ? 0.75 : 1,
      }}
    >
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
              gap: dense ? 1.1 : 1.5,
              p: dense ? 0.9 : 1.25,
              minWidth: 0,
              borderRadius: 'var(--radius-md)',
              background: info.highlight
                ? `linear-gradient(100deg, ${withAlpha(accent, 0.14)}, rgba(255,255,255,0.02))`
                : 'rgba(243, 238, 255, 0.04)',
              border: `1px solid ${
                info.highlight ? accent : isSelf ? 'rgba(255,255,255,0.18)' : 'transparent'
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
                width: avatar,
                height: avatar,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-numeric)',
                fontSize: dense ? '0.98rem' : '1.1rem',
                letterSpacing: '0.04em',
                color: '#0a0612',
                background: `radial-gradient(circle at 32% 28%, ${color}, ${color}b3 70%)`,
                boxShadow: info.highlight ? `0 0 16px ${color}` : 'none',
              }}
            >
              {info.eliminated ? '💀' : playerInitials(player)}
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
                    '--pulse-color': 'rgba(140, 240, 69, 0.6)',
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
                  fontSize: dense ? '0.94rem' : '0.98rem',
                  lineHeight: 1.25,
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
                <Typography
                  sx={{
                    fontSize: dense ? '0.74rem' : '0.78rem',
                    lineHeight: 1.3,
                    color: 'var(--text-muted)',
                  }}
                >
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
