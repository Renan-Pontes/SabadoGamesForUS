import { useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import {
  chooseSugorokuPenalty,
  moveSugoroku,
  tickSugoroku,
  unlockSugoroku,
} from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  CountdownRing,
  GameCard,
  GameShell,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import {
  haptic,
  namesFor,
  playerColor,
  playerInitials,
  playerLabel,
  playerState,
  readNumberArray,
} from '../../games/utils'

const ACCENT = getAccent('future-sugoroku')
const BOARD_SIZE = 5
const TURN_SECONDS = 60
const UNLOCK_REQUIRED = 2
const START_POINTS = 15

type Direction = 'N' | 'S' | 'E' | 'W'

const DIRECTIONS: { key: Direction; label: string; arrow: string; delta: [number, number] }[] = [
  { key: 'N', label: 'Norte', arrow: '↑', delta: [0, -1] },
  { key: 'W', label: 'Oeste', arrow: '←', delta: [-1, 0] },
  { key: 'E', label: 'Leste', arrow: '→', delta: [1, 0] },
  { key: 'S', label: 'Sul', arrow: '↓', delta: [0, 1] },
]

type PendingPenalty = { amount: number; player_ids: number[]; opener_id: number | null }

function coordKey(coord: number[]) {
  return `${coord[0] ?? 0},${coord[1] ?? 0}`
}

function positionOf(player: Player): [number, number] {
  const pos = playerState(player).position
  return Array.isArray(pos) ? [Number(pos[0]) || 0, Number(pos[1]) || 0] : [0, 0]
}

export default function SugorokuGame() {
  const {
    code,
    viewMode,
    isTv,
    state,
    deadline,
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
  } = useGameRoom({ tick: tickSugoroku, pollMs: 2000 })

  const [submitting, setSubmitting] = useState(false)

  const turn = typeof state.turn === 'number' ? state.turn : 1
  const maxTurns = typeof state.max_turns === 'number' ? state.max_turns : 15
  // A saida so chega ao cliente quando a partida acaba: ate la e uma das quinas.
  const exitCoord = Array.isArray(state.exit) ? (state.exit as number[]) : null
  const exitKey = exitCoord ? coordKey(exitCoord) : null
  const startKey = Array.isArray(state.start) ? coordKey(state.start as number[]) : '2,2'
  const cornerKeys = new Set(
    (Array.isArray(state.corners) ? (state.corners as number[][]) : []).map(coordKey),
  )
  const deadEndKeys = new Set(
    (Array.isArray(state.dead_ends) ? (state.dead_ends as number[][]) : []).map(coordKey),
  )
  const winners = readNumberArray(state, 'winners')

  const dice = (state.dice ?? {}) as Record<string, Partial<Record<Direction, number>>>
  const penalties = (state.penalties ?? {}) as Record<string, number>
  const lockedRooms = (state.locked_rooms ?? {}) as Record<string, { unlockers?: number[] }>

  const mePos = useMemo(() => (me ? positionOf(me) : [0, 0]), [me])
  const meKey = coordKey(mePos)
  const mePoints = typeof meState.points === 'number' ? meState.points : START_POINTS
  const meLocked = Boolean(meState.locked)
  const meCanBack = Boolean(meState.can_back)
  const meEliminated = Boolean(meState.eliminated)
  const meCleared = Boolean(meState.cleared)
  const meChoice = (meState.choice ?? null) as { action?: string; direction?: Direction } | null

  const activePlayers = useMemo(
    () =>
      players.filter((player) => {
        const pState = playerState(player)
        return !pState.eliminated && !pState.cleared
      }),
    [players],
  )

  /** Quem está em cada sala — o tabuleiro e as decisões dependem disso. */
  const occupants = useMemo(() => {
    const map: Record<string, Player[]> = {}
    for (const player of activePlayers) {
      const key = coordKey(positionOf(player))
      ;(map[key] ??= []).push(player)
    }
    return map
  }, [activePlayers])

  const myRoomOccupants = occupants[meKey] ?? []
  const myDice = dice[meKey] ?? {}
  const myRoomUnlockers = lockedRooms[meKey]?.unlockers ?? []
  const waitingChoice = activePlayers.filter(
    (player) => !playerState(player).choice && !playerState(player).locked,
  ).length

  /** Penalidade que eu preciso distribuir: eu abri a sala e há mais de um lá. */
  const penaltyToAssign = useMemo(() => {
    if (!me) return null
    const pending = (state.pending_penalties ?? {}) as Record<string, PendingPenalty>
    for (const [key, info] of Object.entries(pending)) {
      if (info.opener_id === me.id && (info.player_ids ?? []).length > 1) {
        return { key, ...info }
      }
    }
    return null
  }, [me, state.pending_penalties])

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

  const handleMove = (action: 'move' | 'stay' | 'back', direction?: Direction) =>
    act(() => moveSugoroku(code, { action, direction }), 'Não foi possível registrar o movimento.')

  const handleUnlock = () => act(() => unlockSugoroku(code), 'Não foi possível destrancar a sala.')

  const handlePenalty = (targetId: number) =>
    act(() => chooseSugorokuPenalty(code, targetId), 'Não foi possível aplicar a penalidade.')

  return (
    <GameShell
      title="FUTURE SUGOROKU"
      tagline="A saída é uma das quatro quinas — ninguém sabe qual. Cada passo custa 1 ponto, e os dados limitam quantos passam por cada porta."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      headerExtra={
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 5 },
          }}
        >
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={TURN_SECONDS}
            accent={ACCENT.main}
            size={isTv ? 220 : 150}
            frozen={waitingChoice === 0 && activePlayers.length > 0}
            label="Para escolher"
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill
              label="Turno"
              value={`${Math.min(turn, maxTurns)}/${maxTurns}`}
              accent={turn > maxTurns - 4 ? 'var(--accent-red)' : ACCENT.main}
              filled
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill label="No labirinto" value={activePlayers.length} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            <StatPill
              label="Faltam decidir"
              value={waitingChoice}
              accent={waitingChoice === 0 ? 'var(--status-ready)' : 'var(--status-waiting)'}
              size={isTv ? 'lg' : 'md'}
            />
            {!isTv && (
              <StatPill
                label="Seus pontos"
                value={mePoints}
                accent={mePoints <= 4 ? 'var(--accent-red)' : 'var(--status-ready)'}
                filled={mePoints <= 4}
                size="md"
              />
            )}
          </Box>
        </Box>
      }
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? '1fr' : '1.3fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* Tabuleiro */}
        <GameCard
          title="O labirinto"
          hint={`? quina · ✕ beco · ⚠️ armadilha · ${deadEndKeys.size}/4 quinas descartadas`}
          accent={ACCENT.main}
          highlight
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
              gap: { xs: 0.75, md: 1.25 },
              maxWidth: isTv ? 760 : 560,
              mx: 'auto',
            }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
              const x = index % BOARD_SIZE
              const y = Math.floor(index / BOARD_SIZE)
              const key = `${x},${y}`
              const here = occupants[key] ?? []
              const isExit = key === exitKey
              const isStart = key === startKey
              const isDeadEnd = deadEndKeys.has(key)
              const isMysteryCorner = cornerKeys.has(key) && !isExit && !isDeadEnd
              const isMine = key === meKey && !isTv
              const penalty = penalties[key]
              const roomLocked = (lockedRooms[key]?.unlockers ?? []).length > 0

              return (
                <Box
                  key={key}
                  className="stagger-in"
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  sx={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${
                      isMine
                        ? ACCENT.main
                        : isExit
                          ? 'var(--accent-gold)'
                          : isMysteryCorner
                            ? 'rgba(212,165,32,0.45)'
                            : isDeadEnd
                              ? 'rgba(220,38,38,0.5)'
                              : 'rgba(255,255,255,0.08)'
                    }`,
                    background: isExit
                      ? 'linear-gradient(150deg, rgba(212,165,32,0.24), rgba(10,10,15,0.9))'
                      : isMine
                        ? `linear-gradient(150deg, ${ACCENT.main}2e, rgba(10,10,15,0.9))`
                        : penalty
                          ? 'linear-gradient(150deg, rgba(220,38,38,0.14), rgba(10,10,15,0.9))'
                          : 'rgba(255,255,255,0.025)',
                    boxShadow: isMine
                      ? `0 0 26px ${ACCENT.glow}`
                      : isExit
                        ? '0 0 26px var(--accent-gold-glow)'
                        : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.4,
                    p: 0.5,
                    transition: 'all 320ms ease',
                  }}
                >
                  {/* Coordenada */}
                  <Typography
                    sx={{
                      position: 'absolute',
                      top: 3,
                      left: 5,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.52rem',
                      color: 'var(--text-muted)',
                      opacity: 0.6,
                    }}
                  >
                    {x},{y}
                  </Typography>

                  {/* Marcas da sala */}
                  <Box sx={{ position: 'absolute', top: 2, right: 4, display: 'flex', gap: 0.25 }}>
                    {roomLocked && <Box component="span" sx={{ fontSize: '0.7rem' }}>🔒</Box>}
                    {penalty !== undefined && (
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.58rem',
                          fontWeight: 800,
                          color: 'var(--accent-red-light)',
                        }}
                      >
                        ⚠️−{penalty}
                      </Box>
                    )}
                  </Box>

                  {(isExit || isStart || isMysteryCorner || isDeadEnd) && (
                    <Typography
                      sx={{
                        fontSize: { xs: '1.2rem', md: '1.7rem' },
                        lineHeight: 1,
                        color: isMysteryCorner ? 'var(--accent-gold)' : isDeadEnd ? 'var(--accent-red)' : undefined,
                        fontFamily: isMysteryCorner || isDeadEnd ? 'var(--font-display)' : undefined,
                        opacity: isMysteryCorner ? 0.8 : 1,
                      }}
                    >
                      {isExit ? '🚪' : isDeadEnd ? '✕' : isMysteryCorner ? '?' : '⚑'}
                    </Typography>
                  )}

                  {/* Fichas dos jogadores */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: 0.3,
                      maxWidth: '100%',
                    }}
                  >
                    {here.map((player) => (
                      <Box
                        key={player.id}
                        title={playerLabel(player)}
                        sx={{
                          width: { xs: 18, md: 24 },
                          height: { xs: 18, md: 24 },
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: { xs: '0.5rem', md: '0.6rem' },
                          fontWeight: 800,
                          color: '#0a0a0f',
                          background: playerColor(player.id),
                          border: me && player.id === me.id ? '2px solid #fff' : 'none',
                          animation: 'popIn 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                      >
                        {playerInitials(player).charAt(0)}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </GameCard>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <GameCard title="Jogadores" accent={ACCENT.main} index={1}>
            <PlayerRoster
              players={players}
              currentUserId={me?.user?.id}
              accent={ACCENT.main}
              describe={(player) => {
                const pState = playerState(player)
                const eliminated = Boolean(pState.eliminated)
                const cleared = Boolean(pState.cleared)
                const locked = Boolean(pState.locked)
                const points = typeof pState.points === 'number' ? pState.points : 0
                const [px, py] = positionOf(player)
                return {
                  eliminated,
                  highlight: cleared,
                  ready: Boolean(pState.choice),
                  status: eliminated
                    ? 'Sem pontos'
                    : cleared
                      ? '🚪 Escapou'
                      : locked
                        ? `🔒 Trancado em ${px},${py}`
                        : `Sala ${px},${py}`,
                  trailing: (
                    <StatPill
                      label="Pontos"
                      value={points}
                      size="sm"
                      accent={points <= 4 ? 'var(--accent-red)' : ACCENT.main}
                      filled={points <= 4}
                    />
                  ),
                }
              }}
            />
          </GameCard>

          {/* Capacidade das portas da minha sala */}
          {!isTv && !meEliminated && !meCleared && (
            <GameCard
              title={`Portas da sala ${mePos[0]},${mePos[1]}`}
              hint={`${myRoomOccupants.length} pessoa${myRoomOccupants.length === 1 ? '' : 's'} aqui`}
              accent={ACCENT.main}
              index={2}
            >
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 1.5 }}>
                O dado diz quantas pessoas cabem em cada porta. Se sobrar gente, quem exceder fica
                trancado e perde um ponto.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {DIRECTIONS.map(({ key, arrow, label }) => {
                  const capacity = myDice[key]
                  const available = capacity !== undefined
                  const crowded = available && capacity < myRoomOccupants.length
                  return (
                    <Box
                      key={key}
                      sx={{
                        textAlign: 'center',
                        p: 1,
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${
                          !available
                            ? 'rgba(255,255,255,0.05)'
                            : crowded
                              ? 'rgba(220,38,38,0.5)'
                              : 'rgba(34,197,94,0.4)'
                        }`,
                        background: available ? 'rgba(255,255,255,0.03)' : 'transparent',
                        opacity: available ? 1 : 0.35,
                      }}
                    >
                      <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{arrow}</Typography>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.5rem',
                          lineHeight: 1.1,
                          color: !available
                            ? 'var(--text-muted)'
                            : crowded
                              ? 'var(--accent-red-light)'
                              : 'var(--status-ready)',
                        }}
                      >
                        {available ? capacity : '—'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                        {label.toUpperCase()}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </GameCard>
          )}
        </Box>
      </Box>

      {/* Escolher quem leva a penalidade */}
      {viewMode === 'player' && penaltyToAssign && (
        <ActionPanel
          title={`Você abriu a armadilha — escolha quem perde ${penaltyToAssign.amount}`}
          hint="Você entrou primeiro nesta sala, então a penalidade é sua para distribuir."
          accent="var(--accent-red)"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {penaltyToAssign.player_ids.map((targetId) => {
              const target = players.find((player) => player.id === targetId)
              if (!target) return null
              return (
                <Button
                  key={targetId}
                  variant="outlined"
                  color="error"
                  disabled={submitting}
                  onClick={() => handlePenalty(targetId)}
                  sx={{ justifyContent: 'space-between', py: 1.4, textTransform: 'none' }}
                >
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {me && targetId === me.id ? 'Você mesmo' : playerLabel(target)}
                  </Box>
                  <Box component="span">−{penaltyToAssign.amount}</Box>
                </Button>
              )
            })}
          </Box>
        </ActionPanel>
      )}

      {/* Movimento */}
      {viewMode === 'player' && (
        <ActionPanel
          title={meLocked ? 'Você está trancado' : 'Para onde você vai?'}
          hint={
            meLocked
              ? `São necessárias ${UNLOCK_REQUIRED} pessoas nesta sala para destrancar. ${myRoomUnlockers.length}/${UNLOCK_REQUIRED} já tentaram.`
              : meChoice
                ? `Escolha registrada: ${
                    meChoice.action === 'move'
                      ? `mover ${meChoice.direction}`
                      : meChoice.action === 'back'
                        ? 'voltar'
                        : 'ficar'
                  }. Pode trocar até o turno virar.`
                : 'Cada ação custa 1 ponto. Combine com os outros para não entupir a porta.'
          }
          accent={ACCENT.main}
          lockedReason={
            meEliminated
              ? 'Seus pontos acabaram. Você ficou para trás no labirinto.'
              : meCleared
                ? '🚪 Você encontrou a saída. Boa!'
                : !isLive
                  ? 'A partida não está em andamento.'
                  : undefined
          }
        >
          {meLocked ? (
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              disabled={submitting}
              onClick={handleUnlock}
              sx={{ py: 1.75 }}
            >
              Forçar a porta ({myRoomUnlockers.length}/{UNLOCK_REQUIRED})
            </Button>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridTemplateRows: 'repeat(3, auto)',
                  gap: 1,
                  maxWidth: 320,
                  mx: 'auto',
                }}
              >
                {DIRECTIONS.map(({ key, arrow, label, delta }) => {
                  const capacity = myDice[key]
                  const available = capacity !== undefined
                  const selected = meChoice?.action === 'move' && meChoice.direction === key
                  const target: [number, number] = [mePos[0] + delta[0], mePos[1] + delta[1]]
                  const targetKey = coordKey(target)
                  const targetIsExit = exitKey !== null && targetKey === exitKey
                  const targetIsMystery = cornerKeys.has(targetKey) && !deadEndKeys.has(targetKey) && !targetIsExit
                  // Posição na cruz direcional
                  const area =
                    key === 'N' ? '1 / 2' : key === 'W' ? '2 / 1' : key === 'E' ? '2 / 3' : '3 / 2'
                  return (
                    <Button
                      key={key}
                      disabled={submitting || !available}
                      onClick={() => handleMove('move', key)}
                      sx={{
                        gridArea: area,
                        flexDirection: 'column',
                        gap: 0,
                        py: 1.2,
                        minWidth: 0,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${
                          selected
                            ? ACCENT.main
                            : targetIsExit || targetIsMystery
                              ? 'var(--accent-gold)'
                              : 'rgba(255,255,255,0.1)'
                        }`,
                        background: selected ? `${ACCENT.main}2e` : 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Box component="span" sx={{ fontSize: '1.4rem', lineHeight: 1 }}>
                        {targetIsExit ? '🚪' : targetIsMystery ? '?' : arrow}
                      </Box>
                      <Box component="span" sx={{ fontSize: '0.55rem', letterSpacing: '0.1em', opacity: 0.75 }}>
                        {available ? `${label.toUpperCase()} · ${capacity}` : 'PAREDE'}
                      </Box>
                    </Button>
                  )
                })}

                {/* Centro da cruz: ficar */}
                <Button
                  disabled={submitting}
                  onClick={() => handleMove('stay')}
                  sx={{
                    gridArea: '2 / 2',
                    flexDirection: 'column',
                    gap: 0,
                    py: 1.2,
                    minWidth: 0,
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${meChoice?.action === 'stay' ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                    background: meChoice?.action === 'stay' ? `${ACCENT.main}2e` : 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Box component="span" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>
                    ⏸
                  </Box>
                  <Box component="span" sx={{ fontSize: '0.55rem', letterSpacing: '0.1em', opacity: 0.75 }}>
                    FICAR
                  </Box>
                </Button>
              </Box>

              <Button
                variant="outlined"
                fullWidth
                disabled={submitting || !meCanBack}
                onClick={() => handleMove('back')}
                sx={{ mt: 1.5 }}
              >
                {meCanBack ? 'Voltar para a sala anterior' : 'Voltar (indisponível — fique um turno antes)'}
              </Button>
            </>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={winners.length > 0 ? 'win' : 'lose'}
        title={winners.length > 0 ? 'FUGA CONCLUÍDA' : 'NINGUÉM ESCAPOU'}
        subtitle={
          winners.length > 0
            ? `Escaparam: ${namesFor(winners, players)}`
            : 'O labirinto ficou com todo mundo.'
        }
      />
      <ResultOverlay
        open={!isTv && !isEnded && meCleared}
        tone="win"
        title="VOCÊ ESCAPOU"
        subtitle="Agora é só assistir quem ficou preso lá dentro."
      />
      <ResultOverlay
        open={!isTv && !isEnded && meEliminated}
        tone="lose"
        title="SEM PONTOS"
        subtitle="Você não tinha fôlego para mais um passo."
      />
    </GameShell>
  )
}
