import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { declareBlefJack, guessBlefJack } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  GameCard,
  GameShell,
  PlayerRoster,
  PlayingCard,
  ResultOverlay,
  StatPill,
  SUIT_ORDER,
} from '../../games/ui'
import type { SuitKey } from '../../games/ui'
import { haptic, namesFor, playerColor, playerLabel, playerState, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('blef-jack')
const MAX_DECLARED = 21

type BlefCard = { rank: number; suit: SuitKey }

type RevealEntry = {
  cards: number[]
  value: number | null
  declared: number | null
  guess_winner_id: number | null
  delta: number
  won: boolean
}

/**
 * O baralho tem 56 cartas: 14 postos × 4 naipes. O id é o índice cru,
 * então posto e naipe saem de divisão e resto.
 */
function decodeCard(cardId: number, rankCount: number): BlefCard {
  const rank = (cardId % rankCount) + 1
  const suit = SUIT_ORDER[Math.floor(cardId / rankCount) % SUIT_ORDER.length]
  return { rank, suit }
}

/** Mesma conta do servidor: ases valem 11 e caem para 1 se estourar 21. */
function handValue(cardIds: number[], rankCount: number) {
  let total = 0
  let aces = 0
  for (const cardId of cardIds) {
    const { rank } = decodeCard(cardId, rankCount)
    if (rank === 1) {
      aces += 1
      total += 11
    } else if (rank >= 10) {
      total += 10
    } else {
      total += rank
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return total
}

export default function BlefJackGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state,
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
    isLive,
    isEnded,
  } = useGameRoom({ pollMs: 2500 })

  const [submitting, setSubmitting] = useState(false)
  const [declaredDraft, setDeclaredDraft] = useState<number | null>(null)
  const [guessDraft, setGuessDraft] = useState<number | null>(null)

  const round = typeof state.round === 'number' ? state.round : 1
  const phase = typeof state.phase === 'string' ? state.phase : 'declare'
  const isDeclarePhase = phase === 'declare'
  const rankCount = typeof state.rank_count === 'number' ? state.rank_count : 14
  const winners = readNumberArray(state, 'winners')
  const lastRound = typeof state.last_round === 'number' ? state.last_round : null
  const lastWinners = readNumberArray(state, 'last_winner_ids')
  const lastBestValue = typeof state.last_best_value === 'number' ? state.last_best_value : null

  const reveal = useMemo(() => {
    const raw = state.last_reveal
    if (!raw || typeof raw !== 'object') return {} as Record<number, RevealEntry>
    return Object.entries(raw as Record<string, unknown>).reduce<Record<number, RevealEntry>>(
      (acc, [key, value]) => {
        if (value && typeof value === 'object') acc[Number(key)] = value as RevealEntry
        return acc
      },
      {},
    )
  }, [state.last_reveal])

  const meCards = Array.isArray(meState.cards) ? (meState.cards as number[]) : []
  const mePoints = typeof meState.points === 'number' ? meState.points : 0
  const meEliminated = Boolean(meState.eliminated)
  const meDeclared = typeof meState.declared_value === 'number' ? meState.declared_value : null
  const meGuess = typeof meState.guess_winner_id === 'number' ? meState.guess_winner_id : null
  const meValue = meCards.length ? handValue(meCards, rankCount) : null

  const activePlayers = useMemo(
    () => players.filter((player) => !playerState(player).eliminated),
    [players],
  )
  const pendingDeclare = activePlayers.filter(
    (player) => typeof playerState(player).declared_value !== 'number',
  ).length
  const pendingGuess = activePlayers.filter((player) => !player.has_guessed).length

  // Rascunhos são por rodada.
  useEffect(() => {
    setDeclaredDraft(null)
    setGuessDraft(null)
  }, [round])

  async function handleDeclare(value: number) {
    if (!code || submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom(await declareBlefJack(code, value))
      setDeclaredDraft(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível declarar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGuess(playerId: number) {
    if (!code || submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom(await guessBlefJack(code, playerId))
      setGuessDraft(playerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível apostar.')
    } finally {
      setSubmitting(false)
    }
  }

  const declaredOf = (player: Player) => {
    const value = playerState(player).declared_value
    return typeof value === 'number' ? value : null
  }

  return (
    <GameShell
      title="BLEF JACK"
      tagline="Você vê sua mão, ninguém mais vê. Anuncie um valor — verdadeiro ou não — e aposte em quem tem a mão mais forte."
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
          <StatPill label="Rodada" value={round} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Fase"
            value={isDeclarePhase ? 'BLEFE' : 'APOSTA'}
            accent={isDeclarePhase ? 'var(--accent-gold)' : ACCENT.main}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill
            label={isDeclarePhase ? 'Faltam declarar' : 'Faltam apostar'}
            value={isDeclarePhase ? pendingDeclare : pendingGuess}
            accent={
              (isDeclarePhase ? pendingDeclare : pendingGuess) === 0
                ? 'var(--status-ready)'
                : 'var(--status-waiting)'
            }
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Na mesa" value={activePlayers.length} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
        </Box>
      }
    >
      {/* As declarações: o que cada um jura ter */}
      <GameCard
        title="O que dizem ter"
        hint={isDeclarePhase ? 'Declarações em andamento' : 'Todos declararam — hora de apostar'}
        accent={ACCENT.main}
        highlight
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 2, md: 3 },
          }}
        >
          {players.map((player, index) => {
            const pState = playerState(player)
            const eliminated = Boolean(pState.eliminated)
            const declared = declaredOf(player)
            const isSelf = Boolean(me && player.id === me.id)
            const color = playerColor(player.id)

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
                  opacity: eliminated ? 0.3 : 1,
                  filter: eliminated ? 'grayscale(1)' : 'none',
                }}
              >
                <Box
                  sx={{
                    width: { xs: 76, md: 96 },
                    height: { xs: 76, md: 96 },
                    borderRadius: 'var(--radius-lg)',
                    display: 'grid',
                    placeItems: 'center',
                    border: `2px solid ${declared !== null ? color : 'rgba(255,255,255,0.12)'}`,
                    background:
                      declared !== null
                        ? `linear-gradient(150deg, ${color}33, rgba(10,10,15,0.9))`
                        : 'rgba(255,255,255,0.03)',
                    boxShadow: declared !== null ? `0 0 26px ${color}44` : 'none',
                    transition: 'all 320ms ease',
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontSize: { xs: '2.2rem', md: '2.9rem' },
                      lineHeight: 1,
                      color: declared !== null ? color : 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {declared !== null ? declared : '?'}
                  </Typography>
                </Box>

                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: isTv ? '1rem' : '0.85rem',
                    color: isSelf ? ACCENT.main : 'var(--text-primary)',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSelf ? 'Você' : playerLabel(player)}
                </Typography>

                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.14em',
                    fontWeight: 800,
                    color: eliminated
                      ? 'var(--accent-red)'
                      : player.has_guessed
                        ? 'var(--status-ready)'
                        : 'var(--text-muted)',
                  }}
                >
                  {eliminated
                    ? 'ELIMINADO'
                    : player.has_guessed
                      ? '✓ APOSTOU'
                      : declared !== null
                        ? 'DECLAROU'
                        : 'PENSANDO'}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </GameCard>

      {/* Sua mão */}
      {!isTv && meCards.length > 0 && (
        <GameCard
          title="Sua mão"
          hint="Só você enxerga estas cartas"
          accent={ACCENT.main}
          sx={{ mt: 2 }}
          index={1}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {meCards.map((cardId, index) => {
                const card = decodeCard(cardId, rankCount)
                return (
                  <PlayingCard
                    key={`${cardId}-${index}`}
                    rank={card.rank}
                    suit={card.suit}
                    size="lg"
                    dealDelay={index * 140}
                    tilt={index === 0 ? -4 : 4}
                  />
                )
              })}
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.22em',
                  color: 'var(--text-muted)',
                  fontWeight: 800,
                }}
              >
                VALOR REAL
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '4rem',
                  lineHeight: 1,
                  color: ACCENT.main,
                  textShadow: `0 0 34px ${ACCENT.glow}`,
                }}
              >
                {meValue}
              </Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {mePoints >= 0 ? `+${mePoints}` : mePoints} pontos
              </Typography>
            </Box>
          </Box>
        </GameCard>
      )}

      {/* Revelação da rodada anterior */}
      {lastRound !== null && Object.keys(reveal).length > 0 && (
        <GameCard
          title={`Revelação da rodada ${lastRound}`}
          hint={lastBestValue !== null ? `Melhor mão: ${lastBestValue}` : undefined}
          accent="var(--accent-gold)"
          sx={{ mt: 2 }}
          index={2}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(230px, 1fr))' },
              gap: 1.5,
            }}
          >
            {players
              .filter((player) => reveal[player.id])
              .map((player, index) => {
                const entry = reveal[player.id]
                const bluffed =
                  entry.declared !== null && entry.value !== null && entry.declared !== entry.value
                return (
                  <Box
                    key={player.id}
                    className="stagger-in"
                    style={{ '--stagger-index': index } as React.CSSProperties}
                    sx={{
                      p: 1.5,
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${entry.won ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)'}`,
                      background: entry.won
                        ? 'linear-gradient(140deg, rgba(212,165,32,0.16), transparent)'
                        : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {entry.won && '👑 '}
                        {playerLabel(player)}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.2rem',
                          color: entry.delta >= 0 ? 'var(--status-ready)' : 'var(--accent-red)',
                        }}
                      >
                        {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {entry.cards.map((cardId, cardIndex) => {
                          const card = decodeCard(cardId, rankCount)
                          return (
                            <PlayingCard
                              key={`${cardId}-${cardIndex}`}
                              rank={card.rank}
                              suit={card.suit}
                              size="sm"
                              dealDelay={cardIndex * 90}
                            />
                          )
                        })}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Tinha <strong style={{ color: 'var(--text-primary)' }}>{entry.value}</strong>
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Disse{' '}
                          <strong style={{ color: bluffed ? 'var(--accent-red-light)' : 'var(--status-ready)' }}>
                            {entry.declared ?? '—'}
                          </strong>
                        </Typography>
                        {bluffed && (
                          <Typography sx={{ fontSize: '0.65rem', color: 'var(--accent-red-light)', fontWeight: 800 }}>
                            BLEFOU
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                )
              })}
          </Box>

          {lastWinners.length > 0 && (
            <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--accent-gold)', fontWeight: 700 }}>
              🏆 Melhor mão: {namesFor(lastWinners, players)}
            </Typography>
          )}
        </GameCard>
      )}

      <GameCard title="Placar" accent={ACCENT.main} sx={{ mt: 2 }} index={3}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const pState = playerState(player)
            const eliminated = Boolean(pState.eliminated)
            const points = typeof pState.points === 'number' ? pState.points : null
            const isSelf = Boolean(me && player.id === me.id)
            const declared = declaredOf(player)
            return {
              eliminated,
              ready: Boolean(player.has_guessed),
              highlight: lastWinners.includes(player.id),
              status: eliminated
                ? 'Eliminado'
                : declared !== null
                  ? `Declarou ${declared}`
                  : 'Ainda não declarou',
              trailing: (
                <StatPill
                  label="Pontos"
                  value={isSelf && points !== null ? (points >= 0 ? `+${points}` : points) : '•••'}
                  size="sm"
                  accent={ACCENT.main}
                  filled={isSelf}
                />
              ),
            }
          }}
        />
      </GameCard>

      {/* Controles do jogador */}
      {viewMode === 'player' && (
        <ActionPanel
          title={isDeclarePhase ? 'Quanto você diz ter?' : 'Quem tem a mão mais forte?'}
          hint={
            isDeclarePhase
              ? `Sua mão vale ${meValue}. Você pode anunciar qualquer coisa — mentir faz parte.`
              : 'Acertar quem venceu vale +3. Vencer sem acertar custa −4.'
          }
          accent={ACCENT.main}
          lockedReason={
            meEliminated
              ? 'Você foi eliminado desta partida.'
              : !isLive
                ? 'A partida não está em andamento.'
                : isDeclarePhase && meDeclared !== null
                  ? `Você declarou ${meDeclared}. Aguardando os outros ${pendingDeclare > 0 ? `(${pendingDeclare} restantes)` : ''}`
                  : undefined
          }
        >
          {isDeclarePhase ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
                gap: 1,
              }}
            >
              {Array.from({ length: MAX_DECLARED }, (_, i) => i + 1).map((value) => {
                const selected = declaredDraft === value || meDeclared === value
                const truthful = value === meValue
                return (
                  <Button
                    key={value}
                    onClick={() => handleDeclare(value)}
                    disabled={submitting}
                    sx={{
                      minWidth: 0,
                      py: 1.4,
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${
                        selected ? ACCENT.main : truthful ? 'rgba(212,165,32,0.5)' : 'rgba(255,255,255,0.1)'
                      }`,
                      background: selected ? `${ACCENT.main}33` : 'rgba(255,255,255,0.03)',
                      color: selected ? ACCENT.main : 'var(--text-primary)',
                      '&:hover': { borderColor: ACCENT.main, background: `${ACCENT.main}1f` },
                    }}
                  >
                    {value}
                  </Button>
                )
              })}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activePlayers.map((player) => {
                const declared = declaredOf(player)
                const selected = guessDraft === player.id || meGuess === player.id
                const isSelf = Boolean(me && player.id === me.id)
                return (
                  <Button
                    key={player.id}
                    onClick={() => handleGuess(player.id)}
                    disabled={submitting}
                    sx={{
                      justifyContent: 'space-between',
                      py: 1.5,
                      px: 2,
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${selected ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? `${ACCENT.main}26` : 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)',
                      textTransform: 'none',
                      '&:hover': { borderColor: ACCENT.main },
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {isSelf ? 'Você mesmo' : playerLabel(player)}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.4rem',
                        color: playerColor(player.id),
                      }}
                    >
                      {declared ?? '?'}
                    </Box>
                  </Button>
                )
              })}
              {meGuess !== null && (
                <Typography
                  className="animate-pop-in"
                  sx={{ mt: 1, textAlign: 'center', color: 'var(--status-ready)', fontWeight: 700 }}
                >
                  Aposta registrada. Aguardando os outros ({pendingGuess} restantes).
                </Typography>
              )}
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone="win"
        title="FIM DE PARTIDA"
        subtitle={winners.length ? `Vencedores: ${namesFor(winners, players)}` : 'Partida encerrada.'}
      />
    </GameShell>
  )
}
