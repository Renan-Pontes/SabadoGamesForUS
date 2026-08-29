import { useMemo, useState } from 'react'
import { Box, Button, Switch, Typography } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import { cacadaAsk, cacadaPenalty, cacadaSearch, cacadaSetup } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  GameCard,
  GameShell,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import { haptic, playerColor, playerLabel } from '../../games/utils'
import HexMap from '../../games/cacada/HexMap'
import MapLegend from '../../games/cacada/MapLegend'
import { allowedHexes, clueAllows, mapMinWidth } from '../../games/cacada/rules'
import type { CacadaState, Clue, LogEntry } from '../../games/cacada/types'
import {
  ANIMAL_LABELS,
  STRUCTURE_COLOR_LABELS,
  STRUCTURE_KIND_LABELS,
  TERRAIN_LABELS,
} from '../../games/cacada/types'

const ACCENT = getAccent('a-cacada')

export default function CacadaGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state: rawState,
    players,
    me,
    meState,
    canToggleView,
    loading,
    error,
    setError,
    goBack,
    toggleView,
    status,
    isEnded,
  } = useGameRoom({ pollMs: 2000 })

  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showMyClue, setShowMyClue] = useState(true)

  const state = rawState as unknown as CacadaState
  const board = state.map
  const myClue = (meState.clue as Clue | undefined) ?? null

  const order = useMemo(() => state.order ?? [], [state.order])
  const markers = state.markers ?? {}
  const phase = state.phase ?? 'setup'
  const pendingPenaltyId = state.pending_penalty_player_id ?? null

  // Ordena os jogadores pela ordem de turno da partida, não pela de entrada.
  const seated = useMemo(() => {
    const byId = new Map(players.map((player) => [player.id, player]))
    return order.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p))
  }, [order, players])

  const currentPlayerId = order.length ? order[(state.turn_index ?? 0) % order.length] : null
  const currentPlayer = seated.find((player) => player.id === currentPlayerId) ?? null
  const isMyTurn = Boolean(me && currentPlayerId === me.id)
  const iOwePenalty = Boolean(me && pendingPenaltyId === me.id)
  const penaltyPlayer = seated.find((player) => player.id === pendingPenaltyId) ?? null
  const winner = seated.find((player) => player.id === state.winner_id) ?? null

  const allowed = useMemo(
    () => (board && myClue && showMyClue ? allowedHexes(board, myClue) : new Set<string>()),
    [board, myClue, showMyClue],
  )

  const selectedCell = selectedHex && board ? board.hexes[selectedHex] : null
  const selectedAllowedByMe =
    selectedHex && board && myClue ? clueAllows(board, myClue, selectedHex) : false

  async function run(action: () => Promise<unknown>, failure: string) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      const room = await action()
      setRoom(room as never)
      setSelectedHex(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  if (!board) {
    return (
      <GameShell
        title="A CAÇADA"
        accent={ACCENT}
        roomCode={code}
        viewMode={viewMode}
        status={status}
        loading={loading}
        error={error || 'O mapa ainda não foi montado.'}
        onBack={goBack}
      >
        <GameCard accent={ACCENT.main}>
          <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center', py: 4 }}>
            Aguardando o host iniciar a caçada.
          </Typography>
        </GameCard>
      </GameShell>
    )
  }

  const setupPending = phase === 'setup'
  const turnLabel = setupPending
    ? 'Abertura'
    : pendingPenaltyId
      ? 'Penalidade'
      : `Vez de ${currentPlayer ? playerLabel(currentPlayer) : '—'}`

  return (
    <GameShell
      title="A CAÇADA"
      tagline="A criatura está no único hexágono que satisfaz todas as pistas da mesa."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      maxWidth={isTv ? 1400 : 900}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill
            label="Fase"
            value={setupPending ? 'ABERTURA' : phase === 'ended' ? 'FIM' : 'CAÇADA'}
            accent={ACCENT.main}
            filled
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Turno" value={turnLabel} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          <StatPill label="Na mesa" value={seated.length} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          {state.advanced && (
            <StatPill label="Modo" value="AVANÇADO" accent="var(--accent-red)" size={isTv ? 'lg' : 'md'} />
          )}
        </Box>
      }
    >
      {/* Sua pista — a informação mais importante da tela */}
      {!isTv && myClue && (
        <GameCard accent={ACCENT.main} highlight sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.24em',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                }}
              >
                SUA PISTA — SÓ VOCÊ VÊ
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: { xs: '1.35rem', md: '1.7rem' },
                  lineHeight: 1.15,
                  letterSpacing: '0.03em',
                  color: myClue.negated ? 'var(--accent-red-light)' : ACCENT.main,
                }}
              >
                {myClue.text}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Switch
                checked={showMyClue}
                onChange={(event) => setShowMyClue(event.target.checked)}
                size="small"
              />
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Destacar no mapa
              </Typography>
            </Box>
          </Box>
        </GameCard>
      )}

      {/* O tabuleiro */}
      <GameCard
        title="O MAPA"
        hint={selectedHex ? `hexágono ${selectedHex}` : 'toque num hexágono'}
        accent={ACCENT.main}
        highlight
      >
        <HexMap
          map={board}
          markers={markers}
          order={order}
          selectedHex={selectedHex}
          onSelectHex={isTv ? undefined : (key) => setSelectedHex(key === selectedHex ? null : key)}
          allowed={allowed}
          solution={state.solution ?? null}
          minWidth={isTv ? undefined : mapMinWidth(board.cols)}
        />

        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <MapLegend compact={!isTv} />
        </Box>

        {selectedCell && (
          <Box
            className="animate-pop-in"
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
              {selectedHex}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)' }}>
              {TERRAIN_LABELS[selectedCell.terrain]}
              {selectedCell.animal && ` · território do ${ANIMAL_LABELS[selectedCell.animal]}`}
              {selectedCell.structure &&
                ` · ${STRUCTURE_KIND_LABELS[selectedCell.structure.kind]} ${STRUCTURE_COLOR_LABELS[
                  selectedCell.structure.color
                ].toLowerCase()}`}
            </Typography>
          </Box>
        )}
      </GameCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <GameCard title="CAÇADORES" hint="a cor é o canto do hexágono" accent={ACCENT.main} index={1}>
          <PlayerRoster
            players={seated}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => ({
              highlight: player.id === currentPlayerId,
              ready: player.id === state.winner_id,
              status:
                player.id === state.winner_id
                  ? '🏆 Encontrou a criatura'
                  : player.id === pendingPenaltyId
                    ? 'Deve revelar um hexágono'
                    : player.id === currentPlayerId
                      ? 'Jogando agora'
                      : 'Aguardando',
              trailing: (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: playerColor(player.id),
                    border: '2px solid rgba(0,0,0,0.5)',
                  }}
                />
              ),
            })}
          />
        </GameCard>

        <GameCard title="O QUE JÁ ACONTECEU" accent={ACCENT.main} index={2}>
          <ActionFeed log={state.log ?? []} players={seated} />
        </GameCard>
      </Box>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            iOwePenalty
              ? 'Você levou um "não" — revele um hexágono'
              : setupPending
                ? 'Abertura: entregue um hexágono impossível'
                : selectedHex
                  ? `Hexágono ${selectedHex}`
                  : 'Escolha um hexágono no mapa'
          }
          hint={
            iOwePenalty || (setupPending && isMyTurn)
              ? 'Marque um hexágono que a SUA pista elimina. Todo mundo vai ver.'
              : isMyTurn
                ? 'Pergunte a alguém, ou faça uma busca e ouça a mesa inteira.'
                : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            phase === 'ended'
              ? 'A caçada acabou.'
              : pendingPenaltyId && !iOwePenalty
                ? `Aguardando ${penaltyPlayer ? playerLabel(penaltyPlayer) : 'alguém'} revelar um hexágono.`
                : !isMyTurn && !iOwePenalty
                  ? `Vez de ${currentPlayer ? playerLabel(currentPlayer) : '—'}. Observe.`
                  : !selectedHex
                    ? 'Toque num hexágono do mapa para agir.'
                    : undefined
          }
        >
          {selectedHex && (iOwePenalty || setupPending) && (
            <>
              <Button
                fullWidth
                variant="contained"
                color="error"
                disabled={submitting || selectedAllowedByMe}
                onClick={() =>
                  run(
                    () =>
                      iOwePenalty
                        ? cacadaPenalty(code, selectedHex)
                        : cacadaSetup(code, selectedHex),
                    'Não foi possível marcar o hexágono.',
                  )
                }
                sx={{ py: 1.8 }}
              >
                Marcar {selectedHex} como impossível
              </Button>
              {selectedAllowedByMe && (
                <Typography
                  sx={{ mt: 1.5, textAlign: 'center', color: 'var(--status-waiting)', fontSize: '0.85rem' }}
                >
                  Sua pista permite esse hexágono — escolha um que ela elimine.
                </Typography>
              )}
            </>
          )}

          {selectedHex && isMyTurn && !iOwePenalty && !setupPending && (
            <>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  mb: 1,
                }}
              >
                PERGUNTAR A
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
                {seated
                  .filter((player) => player.id !== me?.id)
                  .map((player) => {
                    const answered = Boolean(markers[selectedHex]?.[String(player.id)])
                    return (
                      <Button
                        key={player.id}
                        variant="outlined"
                        startIcon={<HelpOutlineRoundedIcon />}
                        disabled={submitting || answered}
                        onClick={() =>
                          run(
                            () =>
                              cacadaAsk(code, {
                                target_player_id: player.id,
                                hex: selectedHex,
                              }),
                            'Não foi possível perguntar.',
                          )
                        }
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          borderColor: playerColor(player.id),
                          color: 'var(--text-primary)',
                        }}
                      >
                        {answered ? `${playerLabel(player)} já respondeu` : playerLabel(player)}
                      </Button>
                    )
                  })}
              </Box>

              <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  startIcon={<SearchRoundedIcon />}
                  disabled={submitting || !selectedAllowedByMe}
                  onClick={() =>
                    run(() => cacadaSearch(code, selectedHex), 'Não foi possível buscar.')
                  }
                  sx={{ py: 1.8 }}
                >
                  Buscar em {selectedHex}
                </Button>
                <Typography
                  sx={{
                    mt: 1,
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: selectedAllowedByMe ? 'var(--text-muted)' : 'var(--status-waiting)',
                  }}
                >
                  {selectedAllowedByMe
                    ? 'Todos respondem em ordem. Um "não" e você paga com informação.'
                    : 'Sua própria pista elimina esse hexágono — você não pode buscar aqui.'}
                </Typography>
              </Box>
            </>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded && Boolean(winner)}
        tone="win"
        sigil="🐾"
        title="CRIATURA ENCONTRADA"
        subtitle={
          winner
            ? `${playerLabel(winner)} localizou o esconderijo em ${state.solution ?? '—'}.`
            : undefined
        }
      />
    </GameShell>
  )
}

/** Histórico das jogadas — é dele que sai metade da dedução. */
function ActionFeed({ log, players }: { log: LogEntry[]; players: Player[] }) {
  const nameOf = (id: number) => {
    const player = players.find((item) => item.id === id)
    return player ? playerLabel(player) : `#${id}`
  }

  if (!log.length) {
    return <Typography sx={{ color: 'var(--text-muted)' }}>Nenhuma jogada ainda.</Typography>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 300, overflowY: 'auto' }}>
      {[...log].reverse().map((entry, index) => (
        <Box
          key={index}
          className="stagger-in"
          style={{ '--stagger-index': Math.min(index, 8) } as React.CSSProperties}
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'baseline',
            p: 1,
            borderRadius: 'var(--radius-sm)',
            background: index === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
            fontSize: '0.85rem',
          }}
        >
          <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)', flexShrink: 0 }}>
            {entry.hex}
          </Box>
          <Box component="span" sx={{ color: 'var(--text-secondary)' }}>
            {entry.type === 'setup' && `${nameOf(entry.player_id)} abriu marcando impossível`}
            {entry.type === 'penalty' && `${nameOf(entry.player_id)} revelou um impossível`}
            {entry.type === 'ask' && (
              <>
                {nameOf(entry.asker_id)} perguntou a {nameOf(entry.target_id)} —{' '}
                <Box
                  component="span"
                  sx={{
                    fontWeight: 800,
                    color: entry.answer === 'disc' ? 'var(--status-ready)' : 'var(--accent-red-light)',
                  }}
                >
                  {entry.answer === 'disc' ? 'SIM' : 'NÃO'}
                </Box>
              </>
            )}
            {entry.type === 'search' && (
              <>
                {nameOf(entry.searcher_id)} buscou —{' '}
                <Box
                  component="span"
                  sx={{
                    fontWeight: 800,
                    color: entry.success ? 'var(--accent-gold)' : 'var(--accent-red-light)',
                  }}
                >
                  {entry.success
                    ? 'ACHOU'
                    : `parou em ${nameOf(entry.answers[entry.answers.length - 1].player_id)}`}
                </Box>
              </>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
