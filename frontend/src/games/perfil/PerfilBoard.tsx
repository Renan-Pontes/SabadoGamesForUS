import { Box, Typography } from '@mui/material'
import type { Player } from '../../lib/types'
import { playerColor, playerInitials, playerLabel } from '../utils'

type PerfilBoardProps = {
  players: Player[]
  positions: Record<string, number>
  trackLength: number
  bonusSpaces?: Record<string, number>
  trapSpaces?: Record<string, number>
  accent: string
  big?: boolean
}

const PER_ROW = 10

/**
 * A pista do Perfil. Serpenteia como tabuleiro de verdade — e os peões
 * deslizam de uma casa para outra em vez de teleportar, que é o que faz
 * a mesa acompanhar a corrida.
 */
export default function PerfilBoard({
  players,
  positions,
  trackLength,
  bonusSpaces = {},
  trapSpaces = {},
  accent,
  big = false,
}: PerfilBoardProps) {
  const rows: number[][] = []
  for (let start = 0; start <= trackLength; start += PER_ROW) {
    const row = []
    for (let index = start; index < Math.min(start + PER_ROW, trackLength + 1); index += 1) {
      row.push(index)
    }
    rows.push(row)
  }

  const size = big ? 62 : 40

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: big ? 1.5 : 1 }}>
      {rows.map((row, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'flex',
            gap: big ? 1.25 : 0.75,
            // Linhas ímpares correm ao contrário: é o serpenteado do tabuleiro.
            flexDirection: rowIndex % 2 === 0 ? 'row' : 'row-reverse',
            justifyContent: 'flex-start',
          }}
        >
          {row.map((space) => {
            const bonus = bonusSpaces[String(space)]
            const trap = trapSpaces[String(space)]
            const isStart = space === 0
            const isFinish = space === trackLength
            const here = players.filter((player) => (positions[String(player.id)] ?? 0) === space)

            const borderColor = isFinish
              ? 'var(--accent-gold)'
              : bonus
                ? 'var(--status-ready)'
                : trap
                  ? 'var(--accent-red)'
                  : 'rgba(255,255,255,0.1)'

            return (
              <Box
                key={space}
                sx={{
                  position: 'relative',
                  width: size,
                  height: size,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  placeItems: 'center',
                  border: `2px solid ${borderColor}`,
                  background: isFinish
                    ? 'linear-gradient(140deg, rgba(212,165,32,0.28), rgba(10,10,15,0.9))'
                    : bonus
                      ? 'rgba(34,197,94,0.14)'
                      : trap
                        ? 'rgba(220,38,38,0.14)'
                        : 'rgba(255,255,255,0.03)',
                  boxShadow: isFinish ? '0 0 22px var(--accent-gold-glow)' : 'none',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: big ? '0.7rem' : '0.55rem',
                    color: 'var(--text-muted)',
                    opacity: 0.7,
                    position: 'absolute',
                    top: 2,
                    left: 4,
                  }}
                >
                  {isStart ? '' : space}
                </Typography>

                <Typography sx={{ fontSize: big ? '1.1rem' : '0.8rem', lineHeight: 1 }}>
                  {isFinish ? '🏁' : isStart ? '▶' : bonus ? `+${bonus}` : trap ? trap : ''}
                </Typography>

                {/* Peões de quem está nesta casa */}
                {here.length > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.25,
                    }}
                  >
                    {here.map((player) => (
                      <Box
                        key={player.id}
                        title={playerLabel(player)}
                        className="animate-pop-in"
                        sx={{
                          width: here.length > 1 ? size * 0.42 : size * 0.62,
                          height: here.length > 1 ? size * 0.42 : size * 0.62,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: here.length > 1 ? '0.5rem' : '0.7rem',
                          fontWeight: 900,
                          color: '#0a0a0f',
                          background: playerColor(player.id),
                          border: '2px solid rgba(10,10,15,0.6)',
                          boxShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 12px ${playerColor(player.id)}88`,
                        }}
                      >
                        {playerInitials(player).charAt(0)}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
        {[
          { color: 'var(--status-ready)', label: 'bônus: anda mais' },
          { color: 'var(--accent-red)', label: 'armadilha: volta' },
          { color: 'var(--accent-gold)', label: 'chegada' },
        ].map((entry) => (
          <Box key={entry.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 3,
                border: `2px solid ${entry.color}`,
              }}
            />
            <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {entry.label}
            </Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: '0.68rem', color: accent, ml: 'auto', fontWeight: 700 }}>
          {trackLength} casas até a chegada
        </Typography>
      </Box>
    </Box>
  )
}
