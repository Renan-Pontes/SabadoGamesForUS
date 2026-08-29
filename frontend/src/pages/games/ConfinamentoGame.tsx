import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { submitConfinamentoGuess, tickConfinamento } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  CountdownRing,
  GameCard,
  GameShell,
  PlayerRoster,
  PlayingCard,
  ResultOverlay,
  StatPill,
  SUITS,
  SUIT_ORDER,
} from '../../games/ui'
import type { SuitKey } from '../../games/ui'
import { haptic, namesFor, playerLabel, playerState, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('confinamento-solitario')
const TURN_SECONDS = 120

export default function ConfinamentoGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state,
    deadline,
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
  } = useGameRoom({ tick: tickConfinamento, pollMs: 2500 })

  const [submitting, setSubmitting] = useState(false)
  const [pendingGuess, setPendingGuess] = useState<SuitKey | null>(null)

  const round = typeof state.round === 'number' ? state.round : 1
  const winners = readNumberArray(state, 'winners')
  const lastEliminated = readNumberArray(state, 'last_round_eliminated_ids')
  const lastSurvivors = readNumberArray(state, 'last_round_survivor_ids')
  const lastRoundTs = typeof state.last_round_ts === 'number' ? state.last_round_ts : null

  const meEliminated = Boolean(meState.eliminated)
  const meGuessed = Boolean(me?.has_guessed)

  const activePlayers = useMemo(
    () => players.filter((player) => !playerState(player).eliminated),
    [players],
  )
  const allGuessed = activePlayers.length > 0 && activePlayers.every((player) => player.has_guessed)
  const pendingCount = activePlayers.filter((player) => !player.has_guessed).length

  // O palpite local só vale para a rodada atual.
  useEffect(() => {
    setPendingGuess(null)
  }, [round, status])

  async function handleGuess(suit: SuitKey) {
    if (!code || !me || submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom(await submitConfinamentoGuess(code, suit))
      setPendingGuess(suit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o palpite.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * O que aparece na carta de cada jogador depende de quem está olhando:
   * na TV mostramos o palpite público, nas telas de mão mostramos o naipe
   * real dos outros — e o seu fica virado para baixo.
   */
  function cardFor(player: Player) {
    const pState = playerState(player)
    const isSelf = Boolean(me && player.id === me.id)

    if (isTv) {
      const guess = player.public_guess as SuitKey | null | undefined
      return { suit: guess ?? undefined, faceDown: !guess, caption: guess ? 'Palpite' : 'Sem palpite' }
    }
    if (isSelf) {
      return { suit: undefined, faceDown: true, caption: 'Seu naipe' }
    }
    const suit = typeof pState.suit === 'string' ? (pState.suit as SuitKey) : undefined
    return { suit, faceDown: !suit, caption: suit ? SUITS[suit].label : 'Oculto' }
  }

  return (
    <GameShell
      title="CONFINAMENTO SOLITÁRIO"
      tagline="Você enxerga o naipe de todo mundo, menos o seu. Errou, saiu. A partida acaba quando o Valete cai."
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
            frozen={allGuessed}
            label="Tempo da rodada"
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Rodada" value={round} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill
              label="Na mesa"
              value={activePlayers.length}
              accent={ACCENT.main}
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill
              label="Faltam votar"
              value={pendingCount}
              accent={pendingCount === 0 ? 'var(--status-ready)' : 'var(--status-waiting)'}
              size={isTv ? 'lg' : 'md'}
            />
          </Box>
        </Box>
      }
    >
      {/* A mesa: uma carta por jogador */}
      <GameCard
        title={isTv ? 'A mesa' : 'O que você enxerga'}
        hint={isTv ? 'Palpites revelados' : 'Sua carta está virada para baixo'}
        accent={ACCENT.main}
        highlight
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 2, md: 3.5 },
            py: 1,
          }}
        >
          {players.map((player, index) => {
            const pState = playerState(player)
            const eliminated = Boolean(pState.eliminated)
            const info = cardFor(player)
            const isSelf = Boolean(me && player.id === me.id)

            return (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  opacity: eliminated ? 0.3 : 1,
                  filter: eliminated ? 'grayscale(1)' : 'none',
                  transition: 'all 320ms ease',
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  {/* Sem posto: neste jogo só o naipe importa. */}
                  <PlayingCard
                    suit={info.suit}
                    faceDown={info.faceDown}
                    size={isTv ? 'lg' : 'md'}
                    dealDelay={index * 70}
                    highlight={isSelf}
                    tilt={(index % 2 === 0 ? -1 : 1) * 2}
                  />
                  {eliminated && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '2.4rem',
                      }}
                    >
                      💀
                    </Box>
                  )}
                </Box>

                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: isTv ? '1.05rem' : '0.9rem',
                    color: isSelf ? ACCENT.main : 'var(--text-primary)',
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSelf ? 'Você' : playerLabel(player)}
                </Typography>

                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: eliminated
                      ? 'var(--accent-red)'
                      : player.has_guessed
                        ? 'var(--status-ready)'
                        : 'var(--text-muted)',
                  }}
                >
                  {eliminated ? 'Eliminado' : player.has_guessed ? '✓ Votou' : info.caption}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </GameCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: lastRoundTs ? '1fr 1fr' : '1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <GameCard title="Jogadores" accent={ACCENT.main} index={1}>
          <PlayerRoster
            players={players}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => {
              const pState = playerState(player)
              const eliminated = Boolean(pState.eliminated)
              return {
                eliminated,
                ready: !eliminated && Boolean(player.has_guessed),
                status: eliminated
                  ? 'Fora da partida'
                  : player.has_guessed
                    ? 'Palpite enviado'
                    : 'Pensando...',
                highlight: lastSurvivors.includes(player.id) && !eliminated,
              }
            }}
          />
        </GameCard>

        {lastRoundTs && (lastEliminated.length > 0 || lastSurvivors.length > 0) && (
          <GameCard title={`Resultado da rodada ${round - 1}`} accent={ACCENT.main} index={2}>
            {lastEliminated.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    letterSpacing: '0.18em',
                    color: 'var(--accent-red)',
                    fontWeight: 800,
                  }}
                >
                  💀 ELIMINADOS
                </Typography>
                <Typography sx={{ color: 'var(--text-primary)' }}>
                  {namesFor(lastEliminated, players)}
                </Typography>
              </Box>
            )}
            {lastSurvivors.length > 0 && (
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    letterSpacing: '0.18em',
                    color: 'var(--status-ready)',
                    fontWeight: 800,
                  }}
                >
                  ✓ SOBREVIVERAM
                </Typography>
                <Typography sx={{ color: 'var(--text-primary)' }}>
                  {namesFor(lastSurvivors, players)}
                </Typography>
              </Box>
            )}
          </GameCard>
        )}
      </Box>

      {/* Controles do jogador */}
      {viewMode === 'player' && (
        <ActionPanel
          title="Qual é o seu naipe?"
          hint="Olhe o naipe dos outros e deduza o seu. Um erro e você está fora."
          accent={ACCENT.main}
          lockedReason={
            meEliminated
              ? 'Você foi eliminado desta partida.'
              : !isLive
                ? 'A partida não está em andamento.'
                : undefined
          }
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {SUIT_ORDER.map((suitKey) => {
              const suit = SUITS[suitKey]
              const selected = pendingGuess === suitKey
              const color = suit.red ? 'var(--accent-red-light)' : 'var(--text-primary)'
              return (
                <Button
                  key={suitKey}
                  onClick={() => handleGuess(suitKey)}
                  disabled={submitting}
                  sx={{
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 2,
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${selected ? ACCENT.main : 'rgba(255,255,255,0.12)'}`,
                    background: selected
                      ? `linear-gradient(150deg, ${ACCENT.main}33, transparent)`
                      : 'rgba(255,255,255,0.03)',
                    boxShadow: selected ? `0 0 26px ${ACCENT.glow}` : 'none',
                    color,
                    '&:hover': {
                      borderColor: ACCENT.main,
                      background: `linear-gradient(150deg, ${ACCENT.main}22, transparent)`,
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                  <Box component="span" sx={{ fontSize: '2.4rem', lineHeight: 1 }}>
                    {suit.symbol}
                  </Box>
                  <Box
                    component="span"
                    sx={{ fontSize: '0.7rem', letterSpacing: '0.14em', fontWeight: 800 }}
                  >
                    {suit.label}
                  </Box>
                </Button>
              )
            })}
          </Box>

          {(pendingGuess || meGuessed) && (
            <Typography
              className="animate-pop-in"
              sx={{ mt: 2, textAlign: 'center', color: 'var(--status-ready)', fontWeight: 700 }}
            >
              {pendingGuess
                ? `Palpite enviado: ${SUITS[pendingGuess].symbol} ${SUITS[pendingGuess].label}. Aguardando os outros...`
                : 'Palpite registrado. Aguardando os outros...'}
            </Typography>
          )}
        </ActionPanel>
      )}

      {/* Aviso do Valete */}
      {!isTv && me?.is_valete && (
        <GameCard accent={ACCENT.main} highlight sx={{ mt: 2 }} index={3}>
          <Typography
            sx={{
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: ACCENT.main,
              letterSpacing: '0.1em',
            }}
          >
            ♥ VOCÊ É O VALETE DE COPAS
          </Typography>
          <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', mt: 0.5 }}>
            Se você cair, todos os outros vencem. Sobreviva sozinho até o fim.
          </Typography>
        </GameCard>
      )}

      {/* Cortinas de resultado */}
      <ResultOverlay
        open={isEnded && winners.length > 0}
        tone="win"
        title="FIM DE PARTIDA"
        subtitle={`Vencedores: ${namesFor(winners, players)}`}
      />
      <ResultOverlay
        open={!isTv && !isEnded && meEliminated}
        tone="lose"
        title="VOCÊ FOI ELIMINADO"
        subtitle="Assista ao resto da partida — o Valete ainda está em jogo."
      />
    </GameShell>
  )
}
