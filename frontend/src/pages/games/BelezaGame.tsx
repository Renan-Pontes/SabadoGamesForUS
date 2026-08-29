import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Slider, TextField, Typography } from '@mui/material'
import { submitBelezaGuess, tickBeleza } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  CountdownRing,
  GameCard,
  GameShell,
  PlayerRail,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import {
  haptic,
  namesFor,
  playerColor,
  playerLabel,
  playerState,
  readNumberArray,
} from '../../games/utils'

const ACCENT = getAccent('concurso-de-beleza')
const GUESS_SECONDS = 120
const SHOWDOWN_SECONDS = 30
const ELIMINATION_THRESHOLD = -10

/** As regras que entram em vigor conforme gente vai sendo eliminada. */
const RULES = [
  { at: 1, text: 'Números repetidos são anulados — quem repetir não concorre.' },
  { at: 2, text: 'Quem acertar o alvo exato dobra a penalidade dos outros.' },
  { at: 3, text: 'Se alguém escolher 0, quem escolher 100 vence a rodada.' },
]

export default function BelezaGame() {
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
  } = useGameRoom({ tick: tickBeleza, pollMs: 2500 })

  const [guessValue, setGuessValue] = useState(50)
  const [submittedValue, setSubmittedValue] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const round = typeof state.round === 'number' ? state.round : 1
  const phase = typeof state.phase === 'string' ? state.phase : 'guess'
  const isShowdown = phase === 'showdown'
  const lastTarget = typeof state.last_target === 'number' ? state.last_target : null
  const lastMean = typeof state.last_mean === 'number' ? state.last_mean : null
  const lastWinners = readNumberArray(state, 'last_winner_ids')
  const winners = readNumberArray(state, 'winners')
  const eliminations = typeof state.eliminations === 'number' ? state.eliminations : 0
  const noLossStreak = typeof state.no_loss_streak === 'number' ? state.no_loss_streak : 0

  const lastGuesses = useMemo(() => {
    const raw = state.last_guesses
    if (!raw || typeof raw !== 'object') return {} as Record<number, number>
    return Object.entries(raw as Record<string, unknown>).reduce<Record<number, number>>(
      (acc, [key, value]) => {
        if (typeof value === 'number') acc[Number(key)] = value
        return acc
      },
      {},
    )
  }, [state.last_guesses])

  const meEliminated = Boolean(meState.eliminated)
  const meScore = typeof meState.score === 'number' ? meState.score : 0

  const activePlayers = useMemo(
    () => players.filter((player) => !playerState(player).eliminated),
    [players],
  )
  const activeRules = RULES.filter((rule) => eliminations >= rule.at)

  // Cada rodada começa com o palpite em branco.
  useEffect(() => {
    setSubmittedValue(null)
  }, [round])

  async function handleGuess() {
    if (!code || submitting) return
    const value = Math.round(guessValue)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError('Escolha um número entre 0 e 100.')
      return
    }
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom(await submitBelezaGuess(code, value))
      setSubmittedValue(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o palpite.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GameShell
      title="CONCURSO DE BELEZA"
      tagline="Escolha de 0 a 100. O alvo é 80% da média de todos. Quem chegar mais perto vence — o resto perde ponto."
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
            totalSeconds={isShowdown ? SHOWDOWN_SECONDS : GUESS_SECONDS}
            accent={isShowdown ? 'var(--neon-cyan)' : ACCENT.main}
            size={isTv ? 220 : 150}
            label={isShowdown ? 'Revelação' : 'Para escolher'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Rodada" value={round} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill
              label="Fase"
              value={isShowdown ? 'REVELA' : 'ESCOLHA'}
              accent={isShowdown ? 'var(--neon-cyan)' : ACCENT.main}
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill
              label="Em jogo"
              value={activePlayers.length}
              accent={ACCENT.main}
              size={isTv ? 'lg' : 'md'}
            />
            {noLossStreak > 0 && (
              <StatPill
                label="Empates seguidos"
                value={`${noLossStreak}/5`}
                accent="var(--status-ready)"
                size={isTv ? 'lg' : 'md'}
              />
            )}
          </Box>
        </Box>
      }
    >
      {/* Régua 0-100 com o alvo e os palpites da rodada anterior */}
      <GameCard
        title={isShowdown ? `Resultado da rodada ${round}` : `Rodada ${round - 1}`}
        hint={lastMean !== null ? `Média ${lastMean.toFixed(1)} × 0,8` : 'Ainda sem resultado'}
        accent={ACCENT.main}
        highlight={isShowdown}
      >
        {lastTarget === null ? (
          <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center', py: 3 }}>
            A primeira rodada ainda não foi revelada. Escolham seus números.
          </Typography>
        ) : (
          <>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.24em',
                  color: 'var(--text-muted)',
                  fontWeight: 800,
                }}
              >
                ALVO
              </Typography>
              <Typography
                key={lastTarget}
                className="animate-pop-in"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: isTv ? { xs: '4rem', md: '7rem' } : { xs: '3rem', md: '4.5rem' },
                  lineHeight: 1,
                  color: ACCENT.main,
                  textShadow: `0 0 48px ${ACCENT.glow}`,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {lastTarget.toFixed(2)}
              </Typography>
              {lastWinners.length > 0 && (
                <Typography sx={{ mt: 0.5, color: 'var(--status-ready)', fontWeight: 700 }}>
                  🏆 {namesFor(lastWinners, players)}
                </Typography>
              )}
            </Box>

            <GuessScale
              target={lastTarget}
              guesses={lastGuesses}
              players={players}
              winners={lastWinners}
              big={isTv}
            />
          </>
        )}
      </GameCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: activeRules.length ? '1.4fr 1fr' : '1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <GameCard title="Placar" hint={`Eliminação em ${ELIMINATION_THRESHOLD}`} accent={ACCENT.main} index={1}>
          {isTv ? (
            <PlayerRail
              players={players}
              accent={ACCENT.main}
              describe={(player) => {
                const pState = playerState(player)
                const score = typeof pState.score === 'number' ? pState.score : 0
                const eliminated = Boolean(pState.eliminated)
                return {
                  value: score,
                  caption: eliminated ? 'Eliminado' : `${ELIMINATION_THRESHOLD - score} para cair`,
                  eliminated,
                  highlight: lastWinners.includes(player.id),
                  badge: eliminated ? '💀' : lastWinners.includes(player.id) ? '🏆' : undefined,
                }
              }}
            />
          ) : (
            <PlayerRoster
              players={players}
              currentUserId={me?.user?.id}
              accent={ACCENT.main}
              describe={(player) => {
                const pState = playerState(player)
                const score = typeof pState.score === 'number' ? pState.score : 0
                const eliminated = Boolean(pState.eliminated)
                const guess = lastGuesses[player.id]
                return {
                  eliminated,
                  highlight: lastWinners.includes(player.id),
                  status: eliminated
                    ? 'Eliminado'
                    : guess !== undefined
                      ? `Escolheu ${guess} na última rodada`
                      : 'Em jogo',
                  trailing: (
                    <StatPill
                      label="Pontos"
                      value={score}
                      size="sm"
                      accent={score <= -7 ? 'var(--accent-red)' : ACCENT.main}
                      filled={score <= -7}
                    />
                  ),
                }
              }}
            />
          )}
        </GameCard>

        {activeRules.length > 0 && (
          <GameCard
            title="Regras liberadas"
            hint={`${eliminations} eliminação${eliminations === 1 ? '' : 'ões'}`}
            accent="var(--accent-red)"
            index={2}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {activeRules.map((rule) => (
                <Box
                  key={rule.at}
                  sx={{
                    display: 'flex',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.28)',
                  }}
                >
                  <Typography sx={{ color: 'var(--accent-red-light)', fontWeight: 800 }}>
                    {rule.at}
                  </Typography>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    {rule.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </GameCard>
        )}
      </Box>

      {viewMode === 'player' && (
        <ActionPanel
          title={submittedValue !== null ? `Você escolheu ${submittedValue}` : 'Escolha seu número'}
          hint="O alvo é 80% da média de todos os números. Pense no que os outros vão pensar."
          accent={ACCENT.main}
          lockedReason={
            meEliminated
              ? `Você foi eliminado com ${meScore} pontos.`
              : !isLive
                ? 'A partida não está em andamento.'
                : isShowdown
                  ? 'Revelação em andamento. Aguarde a próxima rodada.'
                  : undefined
          }
        >
          <Box sx={{ px: 1 }}>
            <Slider
              value={guessValue}
              onChange={(_, value) => setGuessValue(value as number)}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 50, label: '50' },
                { value: 100, label: '100' },
              ]}
              sx={{
                color: ACCENT.main,
                '& .MuiSlider-thumb': {
                  width: 26,
                  height: 26,
                  boxShadow: `0 0 18px ${ACCENT.glow}`,
                },
                '& .MuiSlider-markLabel': { color: 'var(--text-muted)', fontSize: '0.7rem' },
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mt: 1,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <TextField
              type="number"
              value={guessValue}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) setGuessValue(Math.min(100, Math.max(0, next)))
              }}
              slotProps={{ htmlInput: { min: 0, max: 100, style: { textAlign: 'center', fontSize: '2rem' } } }}
              sx={{ width: 150 }}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={handleGuess}
              disabled={submitting}
              sx={{ px: 4, py: 1.75, fontSize: '1.05rem' }}
            >
              {submitting ? 'Enviando...' : submittedValue !== null ? 'Trocar número' : 'Confirmar'}
            </Button>
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={winners.includes(me?.id ?? -1) || isTv ? 'win' : 'lose'}
        title="FIM DE PARTIDA"
        subtitle={
          winners.length ? `Vencedores: ${namesFor(winners, players)}` : 'Ninguém sobreviveu ao concurso.'
        }
      />
      <ResultOverlay
        open={!isTv && !isEnded && meEliminated}
        tone="lose"
        title="VOCÊ FOI ELIMINADO"
        subtitle={`Seus pontos chegaram a ${meScore}.`}
      />
    </GameShell>
  )
}

/**
 * Régua de 0 a 100 com o alvo marcado e cada palpite no seu lugar.
 * É a forma mais direta de mostrar quem chegou perto e quem viajou.
 */
function GuessScale({
  target,
  guesses,
  players,
  winners,
  big,
}: {
  target: number
  guesses: Record<number, number>
  players: Player[]
  winners: number[]
  big: boolean
}) {
  const entries = Object.entries(guesses).map(([id, value]) => ({ id: Number(id), value }))
  const height = big ? 96 : 76

  return (
    <Box sx={{ position: 'relative', height, mx: { xs: 1, md: 3 }, mt: 2, mb: 3 }}>
      {/* Trilho */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 22,
          height: 4,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #1e3a8a, #a855f7, #dc2626)',
          opacity: 0.5,
        }}
      />

      {/* Marcador do alvo */}
      <Box
        sx={{
          position: 'absolute',
          left: `${Math.min(100, Math.max(0, target))}%`,
          bottom: 8,
          transform: 'translateX(-50%)',
          width: 3,
          height: 34,
          background: 'var(--accent-gold)',
          boxShadow: '0 0 16px var(--accent-gold-glow)',
          borderRadius: 2,
        }}
      />

      {/* Palpites */}
      {entries.map(({ id, value }, index) => {
        const player = players.find((item) => item.id === id)
        const isWinner = winners.includes(id)
        const color = playerColor(id)
        return (
          <Box
            key={id}
            className="stagger-in"
            style={{ '--stagger-index': index } as React.CSSProperties}
            sx={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, value))}%`,
              bottom: 28,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: isWinner ? 2 : 1,
            }}
          >
            <Typography
              sx={{
                fontSize: big ? '0.72rem' : '0.62rem',
                fontWeight: 700,
                color: isWinner ? 'var(--accent-gold)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                mb: 0.25,
              }}
            >
              {player ? playerLabel(player) : `#${id}`}
            </Typography>
            <Box
              sx={{
                px: 0.9,
                py: 0.2,
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-display)',
                fontSize: big ? '1.1rem' : '0.9rem',
                color: '#0a0a0f',
                background: color,
                border: isWinner ? '2px solid var(--accent-gold)' : '2px solid transparent',
                boxShadow: isWinner ? '0 0 20px var(--accent-gold-glow)' : 'none',
              }}
            >
              {value}
            </Box>
          </Box>
        )
      })}

      {/* Escala */}
      {[0, 25, 50, 75, 100].map((mark) => (
        <Typography
          key={mark}
          sx={{
            position: 'absolute',
            left: `${mark}%`,
            bottom: 0,
            transform: 'translateX(-50%)',
            fontSize: '0.62rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          {mark}
        </Typography>
      ))}
    </Box>
  )
}
