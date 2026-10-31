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

/** A mesa da Noite do Terror vai até 15 pessoas. */
const MAX_SEATS = 15

/** Acima disso a TV quebra a mesa em duas fileiras equilibradas (8 + 7). */
const ONE_ROW_LIMIT = 8

/**
 * A mesa se enchendo. As cadeiras vazias são desenhadas de propósito: numa
 * TV de sala, ver quantos lugares faltam é mais útil do que só a lista de
 * quem já entrou.
 *
 * Os tamanhos vêm de variáveis CSS (`--seat-w`, `--seat-gap`) calculadas pela
 * largura da tela, e a largura máxima força fileiras equilibradas: 15 pessoas
 * viram 8 + 7 numa TV de 1920 px, em vez de 13 + 2.
 */
export default function SeatGrid({
  players,
  capacity,
  variant = 'tv',
}: SeatGridProps) {
  const isTv = variant === 'tv'
  const total = Math.max(players.length, Math.min(capacity ?? players.length, MAX_SEATS))
  const emptySeats = Math.max(0, total - players.length)
  const columns = total > ONE_ROW_LIMIT ? Math.ceil(total / 2) : Math.max(total, 1)

  return (
    <Box
      sx={{
        // Pela largura e pela altura: TV de navegador costuma ser baixinha (720 px).
        '--seat-w': isTv ? 'clamp(84px, min(8.4vw, 12.6vh), 150px)' : '84px',
        '--seat-gap': isTv ? 'clamp(10px, 1.2vw, 24px)' : '12px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 'var(--seat-gap)',
        mx: 'auto',
        maxWidth: isTv
          ? `calc(${columns} * var(--seat-w) + ${columns - 1} * var(--seat-gap) + 2px)`
          : undefined,
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
              gap: 0.75,
              width: 'var(--seat-w)',
              minWidth: 0,
              opacity: online ? 1 : 0.45,
              transition: 'opacity 300ms ease',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 'calc(var(--seat-w) * 0.6)',
                height: 'calc(var(--seat-w) * 0.6)',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-numeric)',
                fontSize: 'calc(var(--seat-w) * 0.24)',
                letterSpacing: '0.04em',
                color: '#0a0612',
                background: `radial-gradient(circle at 32% 28%, ${color}, ${color}b3 70%)`,
                border: player.ready ? '3px solid var(--status-ready)' : '3px solid rgba(255,255,255,0.08)',
                boxShadow: player.ready
                  ? '0 0 26px var(--slime-glow), 0 10px 24px rgba(0,0,0,0.45)'
                  : '0 10px 24px rgba(0,0,0,0.45)',
                transition: 'all 320ms ease',
              }}
            >
              {playerInitials(player)}

              {player.is_host && (
                <Box
                  aria-label="host"
                  sx={{
                    position: 'absolute',
                    top: '-14%',
                    right: '-10%',
                    fontSize: 'calc(var(--seat-w) * 0.16)',
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
                fontSize: isTv ? 'clamp(0.95rem, 1.35vw, 1.6rem)' : '0.85rem',
                lineHeight: 1.15,
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
                fontSize: isTv ? 'clamp(0.6rem, 0.8vw, 0.95rem)' : '0.6rem',
                letterSpacing: '0.14em',
                fontWeight: 800,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                color: !online
                  ? 'var(--status-offline)'
                  : player.ready
                    ? 'var(--status-ready)'
                    : 'var(--status-waiting)',
              }}
            >
              {!online ? 'SUMIU 👻' : player.ready ? '✓ PRONTO' : 'CHEGANDO...'}
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
            gap: 0.75,
            width: 'var(--seat-w)',
          }}
        >
          <Box
            sx={{
              width: 'calc(var(--seat-w) * 0.6)',
              height: 'calc(var(--seat-w) * 0.6)',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: '2px dashed rgba(176, 107, 255, 0.35)',
              fontSize: 'calc(var(--seat-w) * 0.22)',
              filter: 'grayscale(1)',
              opacity: 0.35,
              animation: 'pulse 3s ease-in-out infinite',
              animationDelay: `${index * 220}ms`,
            }}
          >
            🎃
          </Box>
          <Typography
            sx={{
              fontSize: isTv ? 'clamp(0.6rem, 0.8vw, 0.95rem)' : '0.6rem',
              letterSpacing: '0.16em',
              fontWeight: 800,
              color: 'var(--text-muted)',
              opacity: 0.6,
            }}
          >
            VAGA
          </Typography>
        </Box>
      ))}

      {players.length === 0 && emptySeats === 0 && (
        <Typography sx={{ color: 'var(--text-muted)' }}>Ninguém entrou ainda. Que silêncio assustador...</Typography>
      )}
    </Box>
  )
}
