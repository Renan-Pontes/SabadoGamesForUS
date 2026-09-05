import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { naoParaChoose, naoParaRoll, naoParaStop } from '../../lib/api'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import { ActionPanel, GameCard, GameShell, PlayerRoster, ResultOverlay, StatPill } from '../../games/ui'
import { haptic, playerColor, playerInitials, playerLabel } from '../../games/utils'

const ACCENT = getAccent('nao-para')
const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DEFAULT_HEIGHTS: Record<string, number> = {
  '2': 3,
  '3': 5,
  '4': 7,
  '5': 9,
  '6': 11,
  '7': 13,
  '8': 11,
  '9': 9,
  '10': 7,
  '11': 5,
  '12': 3,
}
const MAX_RUNNERS = 3
const COLUMNS_TO_WIN = 3
const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

type Option = { pair: number[]; columns: number[] }
type LastEvent = {
  type: string
  player_id: number
  dice?: number[]
  lost?: Record<string, number>
  claimed?: number[]
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function Die({ value, size = 44 }: { value: number; size?: number }) {
  return (
    <Box
      component="span"
      className="animate-pop-in"
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 1.5,
        background: '#f8fafc',
        color: '#0a0a0f',
        fontSize: size * 0.9,
        lineHeight: 1,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      {DIE_FACES[value - 1] ?? value}
    </Box>
  )
}

export default function NaoParaGame() {
  const {
    code,
    viewMode,
    isTv,
    state,
    players,
    me,
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

  const phase = typeof state.phase === 'string' ? state.phase : 'rolling'
  const currentId = typeof state.current_player_id === 'number' ? state.current_player_id : null
  const heights = { ...DEFAULT_HEIGHTS, ...asRecord<number>(state.column_heights) }
  const runners = asRecord<number>(state.runners)
  const dice = (Array.isArray(state.dice) ? state.dice : []).filter(
    (value): value is number => typeof value === 'number',
  )
  const options = (Array.isArray(state.options) ? state.options : []) as Option[]
  const claimed = asRecord<number>(state.claimed)
  const markers = asRecord<Record<string, number>>(state.markers)
  const winnerId = typeof state.winner_id === 'number' ? state.winner_id : null
  const lastEvent = (state.last_event ?? null) as LastEvent | null
  const turnNumber = typeof state.turn_number === 'number' ? state.turn_number : 1

  const currentPlayer = players.find((player) => player.id === currentId) ?? null
  const isMyTurn = Boolean(me && currentId === me.id && isLive && phase !== 'ended')
  const runnerColumns = Object.keys(runners)
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }
  const claimedBy = (playerId: number) => Object.values(claimed).filter((owner) => owner === playerId).length
  /** Altura efetiva de um jogador numa coluna: corredor da vez ou marcador salvo. */
  const heightFor = (playerId: number | null, column: number) => {
    const key = String(column)
    if (runners[key] !== undefined) return runners[key]
    return playerId === null ? 0 : (markers[String(playerId)]?.[key] ?? 0)
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

  const banner = lastEvent && (lastEvent.type === 'bust' || lastEvent.type === 'stop') ? lastEvent : null

  return (
    <GameShell
      title="NÃO PARA"
      tagline="Quatro dados, dois pares, três corredores. Pare a tempo ou perca tudo que subiu na vez."
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
          <StatPill label="Rodada" value={turnNumber} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Vez de"
            value={phase === 'ended' ? 'Fim' : nameOf(currentId)}
            accent={isMyTurn ? 'var(--status-ready)' : ACCENT.main}
            filled={isMyTurn}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill
            label="Corredores"
            value={`${runnerColumns.length}/${MAX_RUNNERS}`}
            accent={runnerColumns.length === MAX_RUNNERS ? 'var(--accent-red)' : ACCENT.main}
            size={isTv ? 'lg' : 'md'}
          />
          {!isTv && me && (
            <StatPill
              label="Suas colunas"
              value={`${claimedBy(me.id)}/${COLUMNS_TO_WIN}`}
              accent="var(--accent-gold)"
              filled
              size="md"
            />
          )}
        </Box>
      }
    >
      {/* O que acabou de acontecer: estourou ou guardou */}
      {banner && (
        <GameCard
          key={`${banner.type}-${turnNumber}`}
          accent={banner.type === 'bust' ? 'var(--accent-red)' : 'var(--status-ready)'}
          highlight
          sx={{ mb: 2 }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: { xs: '1.4rem', md: isTv ? '2.4rem' : '1.8rem' },
              letterSpacing: '0.06em',
              textAlign: 'center',
              color: banner.type === 'bust' ? 'var(--accent-red)' : 'var(--status-ready)',
            }}
          >
            {banner.type === 'bust'
              ? `💥 ${nameOf(banner.player_id).toUpperCase()} ESTOUROU`
              : `✋ ${nameOf(banner.player_id).toUpperCase()} GUARDOU`}
          </Typography>
          <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: { xs: '0.85rem', md: '1rem' } }}>
            {banner.type === 'bust'
              ? `Dados ${(banner.dice ?? []).join(' · ')}: nenhum par servia. ${
                  Object.keys(banner.lost ?? {}).length
                    ? `Perdeu o avanço nas colunas ${Object.keys(banner.lost ?? {}).join(', ')}.`
                    : 'Perdeu a vez.'
                }`
              : (banner.claimed ?? []).length
                ? `Fechou a coluna ${(banner.claimed ?? []).join(' e ')}. Ninguém mais sobe ali.`
                : 'Progresso salvo. A vez passa.'}
          </Typography>
        </GameCard>
      )}

      {/* Dados na mesa */}
      {dice.length > 0 && phase !== 'ended' && (
        <Box key={`dice-${turnNumber}-${dice.join('')}`} sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
          {dice.map((value, index) => (
            <Die key={index} value={value} size={isTv ? 68 : 46} />
          ))}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? '1fr' : '1.5fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* As colunas */}
        <GameCard
          title="As colunas"
          hint="● marcador salvo · corredor da vez em destaque · 🏁 coluna fechada"
          accent={ACCENT.main}
          highlight
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(11, 1fr)',
              gap: { xs: 0.4, md: 0.8 },
              alignItems: 'end',
            }}
          >
            {COLUMNS.map((column) => {
              const key = String(column)
              const height = heights[key]
              const owner = claimed[key]
              const runner = runners[key]
              const inPlay = isMyTurn && phase === 'choosing' && options.some((option) => option.columns.includes(column))
              return (
                <Box
                  key={column}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: { xs: 0.3, md: 0.5 },
                    opacity: owner !== undefined ? 0.6 : 1,
                    transition: 'opacity 300ms ease',
                  }}
                >
                  <Typography
                    sx={{
                      textAlign: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: { xs: '0.9rem', md: isTv ? '1.6rem' : '1.2rem' },
                      color: inPlay ? ACCENT.main : 'var(--text-secondary)',
                      textShadow: inPlay ? `0 0 16px ${ACCENT.glow}` : 'none',
                    }}
                  >
                    {column}
                  </Typography>
                  {Array.from({ length: height }, (_, index) => index + 1).map((step) => {
                    const here = players.filter((player) => (markers[String(player.id)] ?? {})[key] === step)
                    const runnerHere = runner === step
                    const isTop = step === height
                    return (
                      <Box
                        key={step}
                        sx={{
                          height: { xs: 16, md: isTv ? 32 : 24 },
                          borderRadius: 0.75,
                          border: `1px solid ${
                            runnerHere ? ACCENT.main : isTop ? 'rgba(212,165,32,0.5)' : 'rgba(255,255,255,0.08)'
                          }`,
                          background: runnerHere
                            ? `${ACCENT.main}33`
                            : isTop
                              ? 'rgba(212,165,32,0.08)'
                              : 'rgba(255,255,255,0.03)',
                          boxShadow: runnerHere ? `0 0 14px ${ACCENT.glow}` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.2,
                          transition: 'all 260ms ease',
                        }}
                      >
                        {runnerHere && (
                          <Box
                            className="animate-pop-in"
                            sx={{
                              width: { xs: 12, md: isTv ? 24 : 18 },
                              height: { xs: 12, md: isTv ? 24 : 18 },
                              borderRadius: '50%',
                              background: ACCENT.main,
                              color: ACCENT.contrast,
                              fontSize: { xs: '0.45rem', md: '0.65rem' },
                              fontWeight: 900,
                              display: 'grid',
                              placeItems: 'center',
                              border: '2px solid #fff',
                            }}
                          >
                            {currentPlayer ? playerInitials(currentPlayer).charAt(0) : '•'}
                          </Box>
                        )}
                        {!runnerHere &&
                          here.map((player) => (
                            <Box
                              key={player.id}
                              title={playerLabel(player)}
                              sx={{
                                width: { xs: 8, md: isTv ? 16 : 12 },
                                height: { xs: 8, md: isTv ? 16 : 12 },
                                borderRadius: '50%',
                                background: playerColor(player.id),
                                border: me && player.id === me.id ? '1.5px solid #fff' : 'none',
                              }}
                            />
                          ))}
                        {isTop && owner !== undefined && !runnerHere && here.length === 0 && (
                          <Box component="span" sx={{ fontSize: { xs: '0.5rem', md: '0.8rem' } }}>
                            🏁
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                  {owner !== undefined && (
                    <Box
                      sx={{
                        textAlign: 'center',
                        fontSize: { xs: '0.5rem', md: '0.65rem' },
                        fontWeight: 800,
                        color: playerColor(owner),
                        letterSpacing: '0.05em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nameOf(owner)}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </GameCard>

        <GameCard title="Corredores" accent={ACCENT.main} index={1}>
          <PlayerRoster
            players={players}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => {
              const closed = claimedBy(player.id)
              const inProgress = Object.keys(markers[String(player.id)] ?? {}).length
              return {
                highlight: player.id === currentId && phase !== 'ended',
                ready: player.id === winnerId,
                status:
                  player.id === winnerId
                    ? '🏆 Venceu'
                    : player.id === currentId && phase !== 'ended'
                      ? '🎲 Na vez'
                      : `${inProgress} coluna${inProgress === 1 ? '' : 's'} em progresso`,
                trailing: (
                  <StatPill
                    label="Fechadas"
                    value={`${closed}/${COLUMNS_TO_WIN}`}
                    size="sm"
                    accent={closed >= 2 ? 'var(--accent-red)' : ACCENT.main}
                    filled={closed >= 2}
                  />
                ),
              }
            }}
          />
        </GameCard>
      </Box>

      {/* Controle: rolar, escolher, parar */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            !isMyTurn
              ? `Vez de ${nameOf(currentId)}`
              : phase === 'choosing'
                ? 'Junte os dados em dois pares'
                : runnerColumns.length
                  ? 'Mais uma ou para por aqui?'
                  : 'Sua vez: role os dados'
          }
          hint={
            phase === 'choosing'
              ? 'Cada soma sobe uma casa. Duas somas iguais sobem duas na mesma coluna.'
              : runnerColumns.length
                ? `${runnerColumns.length}/${MAX_RUNNERS} corredores nas colunas ${runnerColumns.join(', ')}. Parar guarda; rolar arrisca tudo.`
                : 'Você pode ter até três corredores por vez.'
          }
          accent={ACCENT.main}
          lockedReason={
            !isLive
              ? 'A partida não está em andamento.'
              : !isMyTurn
                ? `Aguardando ${nameOf(currentId)} decidir.`
                : undefined
          }
        >
          {phase === 'choosing' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {options.map((option, index) => {
                const grouped = option.columns.reduce<Record<number, number>>((acc, column) => {
                  acc[column] = (acc[column] ?? 0) + 1
                  return acc
                }, {})
                return (
                  <Button
                    key={index}
                    variant="outlined"
                    disabled={submitting}
                    onClick={() => act(() => naoParaChoose(code, index), 'Não foi possível escolher.')}
                    sx={{
                      justifyContent: 'space-between',
                      py: 1.4,
                      textTransform: 'none',
                      borderColor: `${ACCENT.main}66`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Box component="span" sx={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.05em' }}>
                      {option.pair.join(' + ')}
                    </Box>
                    <Box component="span" sx={{ display: 'flex', gap: 0.75 }}>
                      {Object.entries(grouped).map(([columnKey, count]) => {
                        const column = Number(columnKey)
                        const target = Math.min(heights[columnKey], heightFor(me?.id ?? null, column) + count)
                        return (
                          <Box
                            key={columnKey}
                            component="span"
                            sx={{
                              px: 1,
                              py: 0.3,
                              borderRadius: 'var(--radius-full)',
                              background: `${ACCENT.main}22`,
                              fontSize: '0.8rem',
                              fontWeight: 800,
                            }}
                          >
                            ↑{column}
                            {count > 1 ? ` ×${count}` : ''}{' '}
                            <Box component="span" sx={{ opacity: 0.7, fontWeight: 500 }}>
                              {target}/{heights[columnKey]}
                            </Box>
                          </Box>
                        )
                      })}
                    </Box>
                  </Button>
                )
              })}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                disabled={submitting}
                onClick={() => act(() => naoParaRoll(code), 'Não foi possível rolar.')}
                sx={{ py: 1.9, fontSize: '1.05rem' }}
              >
                🎲 Rolar
              </Button>
              <Button
                variant="outlined"
                color="success"
                disabled={submitting || runnerColumns.length === 0}
                onClick={() => act(() => naoParaStop(code), 'Não foi possível parar.')}
                sx={{ py: 1.9, fontSize: '1.05rem' }}
              >
                ✋ Parar
              </Button>
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerId === me.id) ? 'win' : 'lose'}
        title={winnerId !== null ? `${nameOf(winnerId).toUpperCase()} FECHOU TRÊS COLUNAS` : 'FIM DE JOGO'}
        subtitle={me && winnerId === me.id ? 'Você soube a hora de parar.' : 'Quem não para, estoura.'}
      />
    </GameShell>
  )
}
