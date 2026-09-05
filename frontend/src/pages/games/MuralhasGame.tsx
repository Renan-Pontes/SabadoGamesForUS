import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { muralhasMove, muralhasWall } from '../../lib/api'
import type { WallOrientation } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import { ActionPanel, GameCard, GameShell, PlayerRoster, ResultOverlay, StatPill } from '../../games/ui'
import { haptic, playerColor, playerInitials, playerLabel } from '../../games/utils'

const ACCENT = getAccent('muralhas')
const SIZE = 9
const CELL = 44
const GAP = 10
const BOARD = SIZE * CELL + (SIZE - 1) * GAP
const SEAT_LABEL = ['Vai para o norte ↑', 'Vai para o sul ↓', 'Vai para o leste →', 'Vai para o oeste ←']

type Wall = { r: number; c: number; o: WallOrientation; owner_id: number }
type Goal = { axis: 'row' | 'col'; value: number }
type Mode = 'move' | 'wall'

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function pos(index: number) {
  return index * (CELL + GAP)
}

type BoardProps = {
  pawns: Record<string, number[]>
  goals: Record<string, Goal>
  walls: Wall[]
  legalMoves: number[][]
  legalWalls: (number | string)[][]
  players: Player[]
  me: Player | null
  mode: Mode
  orientation: WallOrientation
  interactive: boolean
  lastMove: { type: string; player_id: number; to?: number[]; wall?: (number | string)[] } | null
  onMove: (row: number, col: number) => void
  onWall: (row: number, col: number, orientation: WallOrientation) => void
}

/** O tabuleiro em SVG: casas, metas coloridas, muralhas e peões. */
function Board({ pawns, goals, walls, legalMoves, legalWalls, players, me, mode, orientation, interactive, lastMove, onMove, onWall }: BoardProps) {
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => [Math.floor(index / SIZE), index % SIZE])
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`))
  const ghostWalls = interactive && mode === 'wall' ? legalWalls.filter((wall) => wall[2] === orientation) : []
  const wallRect = (r: number, c: number, o: string) =>
    o === 'h'
      ? { x: pos(c), y: pos(r + 1) - GAP, width: CELL * 2 + GAP, height: GAP }
      : { x: pos(c + 1) - GAP, y: pos(r), width: GAP, height: CELL * 2 + GAP }

  return (
    <svg viewBox={`-6 -6 ${BOARD + 12} ${BOARD + 12}`} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'manipulation' }}>
      {/* Metas: uma faixa na cor de cada jogador na borda que ele precisa alcançar */}
      {Object.entries(goals).map(([pid, goal]) => {
        const color = playerColor(Number(pid))
        const common = { fill: color, opacity: 0.55, rx: 2 }
        if (goal.axis === 'row') {
          const y = goal.value === 0 ? -6 : BOARD + 1
          return <rect key={pid} x={0} y={y} width={BOARD} height={5} {...common} />
        }
        const x = goal.value === 0 ? -6 : BOARD + 1
        return <rect key={pid} x={x} y={0} width={5} height={BOARD} {...common} />
      })}

      {/* Casas */}
      {cells.map(([r, c]) => {
        const key = `${r},${c}`
        const legal = interactive && mode === 'move' && legalSet.has(key)
        return (
          <rect
            key={key}
            x={pos(c)}
            y={pos(r)}
            width={CELL}
            height={CELL}
            rx={6}
            fill={legal ? `${ACCENT.main}55` : 'rgba(255,255,255,0.06)'}
            stroke={legal ? ACCENT.main : 'rgba(255,255,255,0.08)'}
            strokeWidth={legal ? 2 : 1}
            style={{ cursor: legal ? 'pointer' : 'default', transition: 'fill 200ms ease' }}
            onClick={legal ? () => onMove(r, c) : undefined}
          />
        )
      })}

      {/* Muralhas colocadas */}
      {walls.map((wall) => {
        const rect = wallRect(wall.r, wall.c, wall.o)
        const recent = lastMove?.type === 'wall' && lastMove.wall?.[0] === wall.r && lastMove.wall?.[1] === wall.c && lastMove.wall?.[2] === wall.o
        return (
          <rect
            key={`${wall.r}-${wall.c}-${wall.o}`}
            {...rect}
            rx={3}
            fill={playerColor(wall.owner_id)}
            stroke={recent ? '#fff' : 'rgba(0,0,0,0.5)'}
            strokeWidth={recent ? 2 : 1}
            style={{ filter: `drop-shadow(0 0 6px ${playerColor(wall.owner_id)}88)` }}
          />
        )
      })}

      {/* Muralhas possíveis (só no celular, no modo muralha) */}
      {ghostWalls.map((wall) => {
        const [r, c, o] = wall as [number, number, WallOrientation]
        const rect = wallRect(r, c, o)
        return (
          <rect
            key={`ghost-${r}-${c}-${o}`}
            {...rect}
            rx={3}
            fill={ACCENT.main}
            opacity={0.22}
            style={{ cursor: 'pointer' }}
            onClick={() => onWall(r, c, o)}
          >
            <title>Muralha em {r},{c}</title>
          </rect>
        )
      })}

      {/* Peões */}
      {Object.entries(pawns).map(([pid, [r, c]]) => {
        const player = players.find((candidate) => candidate.id === Number(pid))
        const mine = me?.id === Number(pid)
        const recent = lastMove?.type === 'move' && lastMove.player_id === Number(pid)
        return (
          <g key={pid} style={{ transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)', transform: `translate(${pos(c) + CELL / 2}px, ${pos(r) + CELL / 2}px)` }}>
            <circle r={CELL * 0.36} fill={playerColor(Number(pid))} stroke={mine || recent ? '#fff' : 'rgba(0,0,0,0.6)'} strokeWidth={mine ? 3 : 2} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={CELL * 0.36} fontWeight={900} fill="#0a0a0f" fontFamily="var(--font-display)">
              {player ? playerInitials(player).charAt(0) : '?'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function MuralhasGame() {
  const {
    code,
    viewMode,
    isTv,
    state,
    players,
    me,
    meState,
    canToggleView,
    loading,
    error,
    setError,
    refresh,
    goBack,
    toggleView,
    status,
    isLive,
    isEnded,
  } = useGameRoom({ pollMs: 1500 })

  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<Mode>('move')
  const [orientation, setOrientation] = useState<WallOrientation>('h')

  const phase = typeof state.phase === 'string' ? state.phase : 'playing'
  const currentId = typeof state.current_player_id === 'number' ? state.current_player_id : null
  const pawns = asRecord<number[]>(state.pawns)
  const goals = asRecord<Goal>(state.goals)
  const wallsLeft = asRecord<number>(state.walls_left)
  const seats = asRecord<number>(state.seats)
  const walls = (Array.isArray(state.walls) ? state.walls : []) as Wall[]
  const legalMoves = (Array.isArray(state.legal_moves) ? state.legal_moves : []) as number[][]
  const legalWalls = (Array.isArray(state.legal_walls) ? state.legal_walls : []) as (number | string)[][]
  const winnerId = typeof state.winner_id === 'number' ? state.winner_id : null
  const moveCount = typeof state.move_count === 'number' ? state.move_count : 0
  const lastMove = (state.last_move ?? null) as BoardProps['lastMove']
  const mySeat = typeof meState.seat === 'number' ? meState.seat : null

  const isMyTurn = Boolean(me && currentId === me.id && isLive && phase === 'playing')
  const myWalls = me ? (wallsLeft[String(me.id)] ?? 0) : 0
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }

  async function act(run: () => Promise<unknown>, failure: string) {
    if (!code || submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      await run()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  const effectiveMode: Mode = myWalls > 0 ? mode : 'move'

  return (
    <GameShell
      title="MURALHAS"
      tagline="Chegue à borda oposta. A cada vez, ande uma casa ou levante uma muralha no caminho de alguém."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill
            label="Vez de"
            value={phase === 'ended' ? 'Fim' : nameOf(currentId)}
            accent={isMyTurn ? 'var(--status-ready)' : ACCENT.main}
            filled={isMyTurn}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Jogadas" value={moveCount} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          {!isTv && <StatPill label="Suas muralhas" value={myWalls} accent={myWalls <= 2 ? 'var(--accent-red)' : ACCENT.main} filled size="md" />}
        </Box>
      }
    >
      {!isTv && mySeat !== null && phase !== 'ended' && (
        <Typography sx={{ textAlign: 'center', color: me ? playerColor(me.id) : ACCENT.main, fontWeight: 800, letterSpacing: '0.1em', fontSize: '0.8rem', mb: 1.5 }}>
          {SEAT_LABEL[mySeat]?.toUpperCase()} · SUA META É A FAIXA DA SUA COR
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? 'minmax(0, 1.4fr) minmax(280px, 0.6fr)' : '1.3fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <GameCard title="O tabuleiro" hint="Faixa colorida na borda = meta daquele jogador" accent={ACCENT.main} highlight>
          <Box sx={{ maxWidth: isTv ? 720 : 560, mx: 'auto', aspectRatio: '1' }}>
            <Board
              pawns={pawns}
              goals={goals}
              walls={walls}
              legalMoves={legalMoves}
              legalWalls={legalWalls}
              players={players}
              me={me}
              mode={effectiveMode}
              orientation={orientation}
              interactive={viewMode === 'player' && isMyTurn && !submitting}
              lastMove={lastMove}
              onMove={(row, col) => act(() => muralhasMove(code, row, col), 'Não foi possível mover.')}
              onWall={(row, col, o) => act(() => muralhasWall(code, row, col, o), 'Não foi possível colocar a muralha.')}
            />
          </Box>
        </GameCard>

        <GameCard title="Jogadores" accent={ACCENT.main} index={1}>
          <PlayerRoster
            players={players}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => ({
              highlight: player.id === currentId && phase !== 'ended',
              ready: player.id === winnerId,
              status:
                player.id === winnerId
                  ? '🏁 Chegou'
                  : player.id === currentId && phase !== 'ended'
                    ? '● Na vez'
                    : SEAT_LABEL[seats[String(player.id)] ?? 0] ?? '',
              trailing: (
                <StatPill
                  label="Muralhas"
                  value={wallsLeft[String(player.id)] ?? 0}
                  size="sm"
                  accent={playerColor(player.id)}
                />
              ),
            })}
          />
        </GameCard>
      </Box>

      {viewMode === 'player' && (
        <ActionPanel
          title={isMyTurn ? (effectiveMode === 'move' ? 'Toque numa casa iluminada' : 'Toque onde a muralha entra') : `Vez de ${nameOf(currentId)}`}
          hint={
            isMyTurn
              ? effectiveMode === 'move'
                ? 'Peão na frente? Dá para pular. Muralha atrás dele? Pule na diagonal.'
                : 'Só aparecem as posições legais: nada de cruzar outra muralha ou fechar um caminho.'
              : 'Pense no seu próximo passo enquanto espera.'
          }
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : !isMyTurn ? `Aguardando ${nameOf(currentId)} jogar.` : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: myWalls > 0 ? '1fr 1fr' : '1fr', gap: 1 }}>
            <Button variant={effectiveMode === 'move' ? 'contained' : 'outlined'} color="primary" onClick={() => setMode('move')} sx={{ py: 1.4 }}>
              ● Mover peão
            </Button>
            {myWalls > 0 && (
              <Button variant={effectiveMode === 'wall' ? 'contained' : 'outlined'} color="secondary" onClick={() => setMode('wall')} sx={{ py: 1.4 }}>
                🧱 Muralha ({myWalls})
              </Button>
            )}
          </Box>
          {effectiveMode === 'wall' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
              <Button size="small" variant={orientation === 'h' ? 'contained' : 'outlined'} onClick={() => setOrientation('h')} sx={{ textTransform: 'none' }}>
                ━ Horizontal
              </Button>
              <Button size="small" variant={orientation === 'v' ? 'contained' : 'outlined'} onClick={() => setOrientation('v')} sx={{ textTransform: 'none' }}>
                ┃ Vertical
              </Button>
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerId === me.id) ? 'win' : 'lose'}
        title={winnerId !== null ? `${nameOf(winnerId).toUpperCase()} ATRAVESSOU` : 'FIM DE JOGO'}
        subtitle={`${moveCount} jogadas. ${walls.length} muralhas no tabuleiro.`}
      />
    </GameShell>
  )
}
