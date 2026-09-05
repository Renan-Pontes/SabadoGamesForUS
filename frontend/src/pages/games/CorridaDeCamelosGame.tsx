import { useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { camelosBetFinal, camelosBetLeg, camelosRoll, camelosTile } from '../../lib/api'
import type { CamelosFinalKind, CamelosTileKind } from '../../lib/api'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import { ActionPanel, GameCard, GameShell, PlayerRoster, ResultOverlay, StatPill } from '../../games/ui'
import { haptic, namesFor, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('corrida-de-camelos')
const TRACK_LENGTH = 16
const CAMELS = ['azul', 'verde', 'laranja', 'amarelo', 'branco'] as const
type Camel = (typeof CAMELS)[number]

const CAMEL_COLOR: Record<Camel, string> = {
  azul: '#3b82f6',
  verde: '#22c55e',
  laranja: '#f97316',
  amarelo: '#facc15',
  branco: '#f1f5f9',
}
const CAMEL_LABEL: Record<Camel, string> = {
  azul: 'Azul',
  verde: 'Verde',
  laranja: 'Laranja',
  amarelo: 'Amarelo',
  branco: 'Branco',
}

type Tile = { kind: CamelosTileKind; owner_id: number }
type LastRoll = { camel: Camel; steps: number; tile: CamelosTileKind | null }
type LastLeg = { leg: number; first: Camel; second: Camel; payouts: { player_id: number; delta: number }[] }
type LegBet = { camel: Camel; value: number }
type RaceResult = { winner_camel: Camel; loser_camel: Camel; ranking: Camel[] }
type Mode = 'roll' | 'leg' | 'tile' | 'final'

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: 'roll', label: 'ROLAR', icon: '🎲' },
  { key: 'leg', label: 'ETAPA', icon: '🎟️' },
  { key: 'tile', label: 'ARMADILHA', icon: '🌴' },
  { key: 'final', label: 'FINAL', icon: '🏁' },
]

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function isCamel(value: unknown): value is Camel {
  return typeof value === 'string' && (CAMELS as readonly string[]).includes(value)
}

/** Ficha colorida de um camelo — a mesma na pista, no ranking e nos botões. */
function CamelChip({
  camel,
  size = 'md',
  outlined = false,
}: {
  camel: Camel
  size?: 'sm' | 'md' | 'lg'
  outlined?: boolean
}) {
  const height = size === 'lg' ? 34 : size === 'md' ? 24 : 16
  return (
    <Box
      component="span"
      title={CAMEL_LABEL[camel]}
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: height * 1.7,
        height,
        borderRadius: 1,
        background: CAMEL_COLOR[camel],
        border: outlined ? '2px solid #fff' : '1px solid rgba(0,0,0,0.45)',
        color: '#0a0a0f',
        fontSize: height * 0.52,
        fontWeight: 900,
        boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
        flexShrink: 0,
      }}
    >
      {CAMEL_LABEL[camel].charAt(0)}
    </Box>
  )
}

export default function CorridaDeCamelosGame() {
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
  } = useGameRoom({ pollMs: 2000 })

  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<Mode>('roll')
  const [tileKind, setTileKind] = useState<CamelosTileKind>('oasis')
  const [finalKind, setFinalKind] = useState<CamelosFinalKind>('winner')

  const phase = typeof state.phase === 'string' ? state.phase : 'leg'
  const leg = typeof state.leg === 'number' ? state.leg : 1
  const order = readNumberArray(state, 'order')
  const turnIndex = typeof state.turn_index === 'number' ? state.turn_index : 0
  const currentId = order.length ? order[turnIndex % order.length] : null
  const stacks = asRecord<Camel[]>(state.stacks)
  const diceLeft = (Array.isArray(state.dice_left) ? state.dice_left : []).filter(isCamel)
  const legBets = asRecord<number[]>(state.leg_bets)
  const tiles = asRecord<Tile>(state.tiles)
  const coins = asRecord<number>(state.coins)
  const ranking = (Array.isArray(state.ranking) ? state.ranking : []).filter(isCamel)
  const lastRoll = (state.last_roll ?? null) as LastRoll | null
  const lastLeg = (state.last_leg ?? null) as LastLeg | null
  const result = (state.result ?? null) as RaceResult | null
  const winnerIds = readNumberArray(state, 'winner_ids')
  const finalBetsCount = typeof state.final_bets_count === 'number' ? state.final_bets_count : 0

  const myCoins = typeof meState.coins === 'number' ? meState.coins : 0
  const myLegBets = (Array.isArray(meState.leg_bets) ? meState.leg_bets : []) as LegBet[]
  const myFinalBets = asRecord<CamelosFinalKind>(meState.final_bets)
  const myTilePlaced = Boolean(meState.tile_placed)

  const isMyTurn = Boolean(me && currentId === me.id && isLive && phase === 'leg')
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }

  /** Onde uma armadilha pode ir agora: casa vazia e sem vizinha armada. */
  const tileSpaces = useMemo(
    () =>
      Array.from({ length: TRACK_LENGTH - 1 }, (_, index) => index + 2).map((space) => {
        const occupied = (stacks[String(space)] ?? []).length > 0
        const nearTile = Boolean(tiles[String(space)] || tiles[String(space - 1)] || tiles[String(space + 1)])
        return { space, allowed: !occupied && !nearTile }
      }),
    [stacks, tiles],
  )

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

  const trackCells = Array.from({ length: TRACK_LENGTH }, (_, index) => index + 1)

  return (
    <GameShell
      title="CORRIDA DE CAMELOS"
      tagline="Ninguém controla os camelos. Role a pirâmide, aposte na etapa, arme a pista e guarde sua aposta final em segredo."
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
          <StatPill label="Etapa" value={leg} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Dados na pirâmide"
            value={`${diceLeft.length}/5`}
            accent={diceLeft.length <= 1 ? 'var(--accent-red)' : ACCENT.main}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Apostas finais" value={finalBetsCount} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Vez de"
            value={phase === 'ended' ? 'Fim' : nameOf(currentId)}
            accent={isMyTurn ? 'var(--status-ready)' : ACCENT.main}
            filled={isMyTurn}
            size={isTv ? 'lg' : 'md'}
          />
          {!isTv && <StatPill label="Suas moedas" value={myCoins} accent="var(--accent-gold)" filled size="md" />}
        </Box>
      }
    >
      {/* Último lance: o momento que a mesa inteira olha */}
      {lastRoll && phase !== 'ended' && (
        <GameCard
          key={`${leg}-${diceLeft.length}-${lastRoll.camel}`}
          accent={CAMEL_COLOR[lastRoll.camel]}
          highlight
          sx={{ mb: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <CamelChip camel={lastRoll.camel} size="lg" outlined />
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.5rem', md: isTv ? '2.6rem' : '1.9rem' },
                letterSpacing: '0.06em',
                color: CAMEL_COLOR[lastRoll.camel],
                textShadow: `0 0 24px ${CAMEL_COLOR[lastRoll.camel]}66`,
              }}
            >
              {CAMEL_LABEL[lastRoll.camel].toUpperCase()} ANDOU {lastRoll.steps}
            </Typography>
            {lastRoll.tile && (
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: { xs: '0.9rem', md: '1.1rem' } }}>
                {lastRoll.tile === 'oasis' ? '🌴 caiu num oásis: +1 casa' : '🌵 pisou na miragem: −1 casa, por baixo'}
              </Typography>
            )}
          </Box>
        </GameCard>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? '1fr' : '1.4fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* A pista */}
        <GameCard
          title="A pista"
          hint="🌴 oásis +1 · 🌵 miragem −1 · linha de chegada na casa 16"
          accent={ACCENT.main}
          highlight
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(8, 1fr)', md: `repeat(${TRACK_LENGTH}, 1fr)` },
              gap: { xs: 0.5, md: 0.75 },
            }}
          >
            {trackCells.map((space) => {
              const stack = stacks[String(space)] ?? []
              const tile = tiles[String(space)]
              const isFinish = space === TRACK_LENGTH
              return (
                <Box
                  key={space}
                  sx={{
                    position: 'relative',
                    minHeight: { xs: 104, md: isTv ? 210 : 160 },
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      tile
                        ? tile.kind === 'oasis'
                          ? 'rgba(34,197,94,0.55)'
                          : 'rgba(239,68,68,0.55)'
                        : isFinish
                          ? 'rgba(212,165,32,0.6)'
                          : 'rgba(255,255,255,0.08)'
                    }`,
                    background: isFinish
                      ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.09) 0 6px, transparent 6px 12px)'
                      : tile
                        ? tile.kind === 'oasis'
                          ? 'rgba(34,197,94,0.08)'
                          : 'rgba(239,68,68,0.08)'
                        : 'rgba(255,255,255,0.025)',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 0.35,
                    p: 0.5,
                    pb: 2.6,
                    pt: 2.4,
                    transition: 'border-color 300ms ease',
                  }}
                >
                  <Typography
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      fontFamily: 'var(--font-mono)',
                      fontSize: { xs: '0.6rem', md: '0.7rem' },
                      color: isFinish ? 'var(--accent-gold)' : 'var(--text-muted)',
                    }}
                  >
                    {isFinish ? '🏁' : space}
                  </Typography>
                  {tile && (
                    <Typography
                      title={`Armadilha de ${nameOf(tile.owner_id)}`}
                      sx={{ position: 'absolute', top: 2, fontSize: { xs: '0.9rem', md: '1.2rem' }, lineHeight: 1 }}
                    >
                      {tile.kind === 'oasis' ? '🌴' : '🌵'}
                    </Typography>
                  )}
                  {stack.map((camel) => (
                    <Box
                      key={`${camel}-${space}`}
                      className="animate-pop-in"
                      sx={{
                        width: '82%',
                        height: { xs: 16, md: isTv ? 30 : 22 },
                        borderRadius: 1,
                        background: CAMEL_COLOR[camel],
                        border: lastRoll?.camel === camel ? '2px solid #fff' : '1px solid rgba(0,0,0,0.45)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: { xs: '0.5rem', md: isTv ? '0.85rem' : '0.7rem' },
                        fontWeight: 900,
                        color: '#0a0a0f',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
                      }}
                    >
                      {CAMEL_LABEL[camel].charAt(0)}
                    </Box>
                  ))}
                </Box>
              )
            })}
          </Box>
        </GameCard>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Classificação + fichas de etapa */}
          <GameCard title="Classificação" hint="Quem está em cima da pilha lidera" accent={ACCENT.main} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {ranking.map((camel, position) => {
                const tickets = legBets[camel] ?? []
                return (
                  <Box
                    key={camel}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1,
                      borderRadius: 'var(--radius-md)',
                      background: position === 0 ? `${CAMEL_COLOR[camel]}1f` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${position === 0 ? `${CAMEL_COLOR[camel]}66` : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 300ms ease',
                    }}
                  >
                    <Typography
                      sx={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', width: 28, color: 'var(--text-muted)' }}
                    >
                      {position + 1}º
                    </Typography>
                    <CamelChip camel={camel} size={isTv ? 'lg' : 'md'} />
                    <Typography sx={{ fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                      {CAMEL_LABEL[camel]}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }} title="Fichas de etapa restantes">
                      {tickets.map((value, index) => (
                        <Box
                          key={`${camel}-${index}`}
                          sx={{
                            px: 0.9,
                            py: 0.2,
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: `${CAMEL_COLOR[camel]}33`,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {value}
                        </Box>
                      ))}
                      {tickets.length === 0 && (
                        <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>sem fichas</Typography>
                      )}
                    </Box>
                    {diceLeft.includes(camel) && (
                      <Box component="span" title="Ainda não rolou nesta etapa" sx={{ fontSize: '0.9rem' }}>
                        🎲
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          </GameCard>

          {/* Fechamento da última etapa */}
          {lastLeg && (
            <GameCard
              key={`leg-${lastLeg.leg}`}
              title={`Etapa ${lastLeg.leg} paga`}
              hint={`1º ${CAMEL_LABEL[lastLeg.first]} · 2º ${CAMEL_LABEL[lastLeg.second]}`}
              accent="var(--accent-gold)"
              index={2}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {lastLeg.payouts.map((payout) => (
                  <Box
                    key={payout.player_id}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background:
                        payout.delta > 0
                          ? 'rgba(34,197,94,0.15)'
                          : payout.delta < 0
                            ? 'rgba(220,38,38,0.15)'
                            : 'rgba(255,255,255,0.05)',
                      color:
                        payout.delta > 0
                          ? 'var(--status-ready)'
                          : payout.delta < 0
                            ? 'var(--accent-red-light)'
                            : 'var(--text-muted)',
                    }}
                  >
                    {nameOf(payout.player_id)} {payout.delta > 0 ? `+${payout.delta}` : payout.delta}
                  </Box>
                ))}
              </Box>
            </GameCard>
          )}

          <GameCard title="Apostadores" accent={ACCENT.main} index={3}>
            <PlayerRoster
              players={players}
              currentUserId={me?.user?.id}
              accent={ACCENT.main}
              describe={(player) => ({
                highlight: player.id === currentId && phase !== 'ended',
                ready: winnerIds.includes(player.id),
                status:
                  player.id === currentId && phase !== 'ended'
                    ? '🎲 Na vez'
                    : winnerIds.includes(player.id)
                      ? '🏆 Mais rico'
                      : '',
                trailing: (
                  <StatPill label="Moedas" value={coins[String(player.id)] ?? 0} size="sm" accent="var(--accent-gold)" />
                ),
              })}
            />
          </GameCard>

          {/* Meu bolso: o que só eu vejo */}
          {!isTv && (
            <GameCard title="Seu bolso" hint="Apostas finais são secretas até a chegada" accent="var(--accent-gold)" index={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 90 }}>ETAPA</Typography>
                  {myLegBets.length === 0 && (
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>nenhuma ficha</Typography>
                  )}
                  {myLegBets.map((bet, index) => (
                    <Box key={`${bet.camel}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CamelChip camel={bet.camel} size="sm" />
                      <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>{bet.value}</Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 90 }}>FINAL</Typography>
                  {Object.keys(myFinalBets).length === 0 && (
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>nenhuma carta jogada</Typography>
                  )}
                  {Object.entries(myFinalBets).map(([camel, kind]) =>
                    isCamel(camel) ? (
                      <Box key={camel} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CamelChip camel={camel} size="sm" />
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          {kind === 'winner' ? '🏆 vence' : '🐌 último'}
                        </Typography>
                      </Box>
                    ) : null,
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 90 }}>ARMADILHA</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: myTilePlaced ? 'var(--status-ready)' : 'var(--text-muted)' }}>
                    {myTilePlaced ? 'colocada nesta etapa' : 'disponível'}
                  </Typography>
                </Box>
              </Box>
            </GameCard>
          )}
        </Box>
      </Box>

      {/* Controle do apostador */}
      {viewMode === 'player' && (
        <ActionPanel
          title={isMyTurn ? 'Sua vez: uma ação' : `Vez de ${nameOf(currentId)}`}
          hint={
            isMyTurn
              ? 'Rolar rende 1 moeda garantida. Apostar rende mais — se você acertar.'
              : 'Combine com a mesa, xingue os camelos, aguarde.'
          }
          accent={ACCENT.main}
          lockedReason={
            !isLive
              ? 'A corrida não está em andamento.'
              : !isMyTurn
                ? `Aguardando ${nameOf(currentId)} decidir.`
                : undefined
          }
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, mb: 1.5 }}>
            {MODES.map(({ key, label, icon }) => (
              <Button
                key={key}
                size="small"
                variant={mode === key ? 'contained' : 'outlined'}
                onClick={() => setMode(key)}
                sx={{ flexDirection: 'column', gap: 0, py: 0.8, minWidth: 0, textTransform: 'none' }}
              >
                <Box component="span" sx={{ fontSize: '1.1rem', lineHeight: 1 }}>
                  {icon}
                </Box>
                <Box component="span" sx={{ fontSize: '0.55rem', letterSpacing: '0.08em' }}>
                  {label}
                </Box>
              </Button>
            ))}
          </Box>

          {mode === 'roll' && (
            <>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={submitting || diceLeft.length === 0}
                onClick={() => act(() => camelosRoll(code), 'Não foi possível rolar.')}
                sx={{ py: 1.9, fontSize: '1.05rem' }}
              >
                🎲 Rolar a pirâmide (+1 moeda)
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ainda podem sair:</Typography>
                {diceLeft.map((camel) => (
                  <CamelChip key={camel} camel={camel} size="sm" />
                ))}
              </Box>
            </>
          )}

          {mode === 'leg' && (
            <>
              <Typography sx={{ fontSize: '0.82rem', color: 'var(--text-muted)', mb: 1 }}>
                Leva a ficha mais alta que sobrou. Líder da etapa paga a ficha, segundo paga 1, o resto custa 1.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
                {CAMELS.map((camel) => {
                  const top = (legBets[camel] ?? [])[0]
                  return (
                    <Button
                      key={camel}
                      disabled={submitting || top === undefined}
                      onClick={() => act(() => camelosBetLeg(code, camel), 'Não foi possível apostar.')}
                      sx={{
                        flexDirection: 'column',
                        gap: 0.6,
                        py: 1.2,
                        minWidth: 0,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${CAMEL_COLOR[camel]}66`,
                        background: `${CAMEL_COLOR[camel]}14`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <CamelChip camel={camel} />
                      <Box component="span" sx={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', lineHeight: 1 }}>
                        {top ?? '—'}
                      </Box>
                    </Button>
                  )
                })}
              </Box>
            </>
          )}

          {mode === 'tile' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.25 }}>
                <Button
                  variant={tileKind === 'oasis' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setTileKind('oasis')}
                  sx={{ textTransform: 'none', py: 1 }}
                >
                  🌴 Oásis (+1)
                </Button>
                <Button
                  variant={tileKind === 'miragem' ? 'contained' : 'outlined'}
                  color="error"
                  onClick={() => setTileKind('miragem')}
                  sx={{ textTransform: 'none', py: 1 }}
                >
                  🌵 Miragem (−1, por baixo)
                </Button>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', mb: 1 }}>
                {myTilePlaced
                  ? 'Você já armou nesta etapa. A armadilha volta para você na próxima.'
                  : 'Escolha a casa. Não pode ter camelo nem encostar em outra armadilha. Você ganha 1 moeda cada vez que alguém pisa.'}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.6 }}>
                {tileSpaces.map(({ space, allowed }) => (
                  <Button
                    key={space}
                    size="small"
                    variant="outlined"
                    disabled={submitting || !allowed || myTilePlaced}
                    onClick={() => act(() => camelosTile(code, space, tileKind), 'Não foi possível armar.')}
                    sx={{ minWidth: 0, py: 0.9, fontFamily: 'var(--font-mono)' }}
                  >
                    {space}
                  </Button>
                ))}
              </Box>
            </>
          )}

          {mode === 'final' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.25 }}>
                <Button
                  variant={finalKind === 'winner' ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setFinalKind('winner')}
                  sx={{ textTransform: 'none', py: 1 }}
                >
                  🏆 Vai vencer
                </Button>
                <Button
                  variant={finalKind === 'loser' ? 'contained' : 'outlined'}
                  color="secondary"
                  onClick={() => setFinalKind('loser')}
                  sx={{ textTransform: 'none', py: 1 }}
                >
                  🐌 Vai chegar último
                </Button>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', mb: 1 }}>
                Secreta até a chegada. Os primeiros a acertar ganham 8, 5, 3, 2, 1. Errou, perde 1. Uma carta por camelo.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
                {CAMELS.map((camel) => {
                  const used = myFinalBets[camel]
                  return (
                    <Button
                      key={camel}
                      disabled={submitting || Boolean(used)}
                      onClick={() => act(() => camelosBetFinal(code, camel, finalKind), 'Não foi possível apostar.')}
                      sx={{
                        flexDirection: 'column',
                        gap: 0.6,
                        py: 1.2,
                        minWidth: 0,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${CAMEL_COLOR[camel]}66`,
                        background: `${CAMEL_COLOR[camel]}14`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <CamelChip camel={camel} />
                      <Box component="span" sx={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>
                        {used ? (used === 'winner' ? 'JOGADA 🏆' : 'JOGADA 🐌') : 'APOSTAR'}
                      </Box>
                    </Button>
                  )
                })}
              </Box>
            </>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={result ? `${CAMEL_LABEL[result.winner_camel].toUpperCase()} CRUZOU A LINHA` : 'FIM DA CORRIDA'}
        subtitle={
          winnerIds.length
            ? `Mais rico da mesa: ${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => coins[String(id)] ?? 0))} moedas.`
            : 'A corrida acabou.'
        }
      />
    </GameShell>
  )
}
