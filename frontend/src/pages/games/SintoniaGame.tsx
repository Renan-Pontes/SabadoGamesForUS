import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Slider, TextField, Typography } from '@mui/material'
import { sintoniaClue, sintoniaGuess, tickSintonia } from '../../lib/api'
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
import { haptic, namesFor, playerColor, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('sintonia')
const CLUE_SECONDS = 90
const GUESS_SECONDS = 90
const REVEAL_SECONDS = 15

/** Faixas de pontuação em volta do alvo, da mais generosa para a mais estreita. */
const BANDS = [
  { half: 15, points: 2, color: 'rgba(34, 211, 238, 0.18)' },
  { half: 8, points: 3, color: 'rgba(34, 211, 238, 0.32)' },
  { half: 3, points: 4, color: 'rgba(251, 191, 36, 0.55)' },
]

type RoundResult = { player_id: number; guess: number | null; points: number }

export default function SintoniaGame() {
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
    isEnded,
  } = useGameRoom({ tick: tickSintonia, pollMs: 2000 })

  const [clueDraft, setClueDraft] = useState('')
  const [guessDraft, setGuessDraft] = useState(50)
  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'clue'
  const round = typeof state.round === 'number' ? state.round : 1
  const maxRounds = typeof state.max_rounds === 'number' ? state.max_rounds : 1
  const psychicId = typeof state.psychic_id === 'number' ? state.psychic_id : null
  const clue = typeof state.clue === 'string' ? state.clue : null
  const target = typeof state.target === 'number' ? state.target : null
  // O alvo e privado do vidente: vem no estado dele, nao no da sala.
  const myTarget = typeof meState.psychic_target === 'number' ? meState.psychic_target : null
  const spectrum = (state.spectrum ?? { left: '', right: '' }) as { left: string; right: string }
  const scores = (state.scores ?? {}) as Record<string, number>
  const winners = readNumberArray(state, 'winners')
  const last = state.last as
    | { target: number; clue: string; results: RoundResult[]; psychic_points: number }
    | null
    | undefined

  const psychic = players.find((player) => player.id === psychicId) ?? null
  const amPsychic = Boolean(me && psychicId === me.id)
  const myGuess = typeof meState.guess === 'number' ? meState.guess : null
  const isReveal = phase === 'reveal'

  const guessers = useMemo(
    () => players.filter((player) => player.id !== psychicId),
    [players, psychicId],
  )
  const pending = guessers.filter((player) => {
    const guess = (player.state as Record<string, unknown> | undefined)?.guess
    return typeof guess !== 'number'
  }).length

  // Rodada nova zera os rascunhos.
  useEffect(() => {
    setClueDraft('')
    setGuessDraft(50)
  }, [round])

  async function run(action: () => Promise<unknown>, failure: string) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom((await action()) as never)
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  const revealTarget = isReveal ? (target ?? last?.target ?? null) : null
  const results = isReveal ? (last?.results ?? []) : []

  return (
    <GameShell
      title="SINTONIA"
      tagline="O vidente vê um alvo escondido no espectro e tem uma pista só para descrevê-lo."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      maxWidth={isTv ? 1200 : 820}
      headerExtra={
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 4 },
          }}
        >
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={
              phase === 'clue' ? CLUE_SECONDS : phase === 'guess' ? GUESS_SECONDS : REVEAL_SECONDS
            }
            accent={ACCENT.main}
            size={isTv ? 190 : 140}
            label={phase === 'clue' ? 'Para a pista' : phase === 'guess' ? 'Para palpitar' : 'Revelação'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill
              label="Rodada"
              value={`${round}/${maxRounds}`}
              accent={ACCENT.main}
              filled
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill
              label="Vidente"
              value={psychic ? playerLabel(psychic) : '—'}
              accent={ACCENT.light}
              size={isTv ? 'lg' : 'md'}
            />
            {phase === 'guess' && (
              <StatPill
                label="Faltam"
                value={pending}
                accent={pending === 0 ? 'var(--status-ready)' : 'var(--status-waiting)'}
                size={isTv ? 'lg' : 'md'}
              />
            )}
          </Box>
        </Box>
      }
    >
      {/* O espectro */}
      <GameCard
        title="O ESPECTRO"
        hint={isReveal ? 'alvo revelado' : phase === 'clue' ? 'aguardando a pista' : 'palpitem'}
        accent={ACCENT.main}
        highlight
      >
        <Spectrum
          left={spectrum.left}
          right={spectrum.right}
          target={revealTarget}
          myTarget={amPsychic && !isReveal ? myTarget : null}
          results={results}
          players={players}
          big={isTv}
        />

        {/* A pista */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography
            sx={{
              fontSize: '0.62rem',
              letterSpacing: '0.24em',
              fontWeight: 800,
              color: 'var(--text-muted)',
            }}
          >
            A PISTA
          </Typography>
          <Typography
            key={clue ?? 'none'}
            className={clue ? 'animate-pop-in' : undefined}
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: isTv ? { xs: '2.5rem', md: '4rem' } : { xs: '1.9rem', md: '2.6rem' },
              lineHeight: 1.1,
              letterSpacing: '0.04em',
              color: clue ? ACCENT.main : 'var(--text-muted)',
              textShadow: clue ? `0 0 34px ${ACCENT.glow}` : 'none',
            }}
          >
            {clue ?? '???'}
          </Typography>
        </Box>
      </GameCard>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <GameCard title="PLACAR" accent={ACCENT.main} index={1}>
          <PlayerRoster
            players={players}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => {
              const guess = (player.state as Record<string, unknown> | undefined)?.guess
              const isPsychic = player.id === psychicId
              return {
                highlight: isPsychic,
                ready: !isPsychic && typeof guess === 'number',
                status: isPsychic
                  ? '◐ Vidente da rodada'
                  : phase === 'guess'
                    ? typeof guess === 'number'
                      ? 'Palpite enviado'
                      : 'Pensando...'
                    : 'Na mesa',
                trailing: (
                  <StatPill
                    label="Pontos"
                    value={scores[String(player.id)] ?? 0}
                    size="sm"
                    accent={ACCENT.main}
                  />
                ),
              }
            }}
          />
        </GameCard>

        {isReveal && last && (
          <GameCard title="RESULTADO DA RODADA" hint={`alvo ${last.target}`} accent="var(--accent-gold)" index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {last.results.map((result) => {
                const player = players.find((item) => item.id === result.player_id)
                return (
                  <Box
                    key={result.player_id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>
                      {player ? playerLabel(player) : `#${result.player_id}`}
                    </Typography>
                    <Typography sx={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {result.guess ?? '—'}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.3rem',
                        color: result.points > 0 ? 'var(--status-ready)' : 'var(--text-muted)',
                      }}
                    >
                      +{result.points}
                    </Typography>
                  </Box>
                )
              })}
              {psychic && (
                <Typography sx={{ mt: 1, textAlign: 'center', color: ACCENT.main, fontWeight: 700 }}>
                  {playerLabel(psychic)} levou +{last.psychic_points} pela média da mesa.
                </Typography>
              )}
            </Box>
          </GameCard>
        )}
      </Box>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            amPsychic
              ? phase === 'clue'
                ? 'Você é o vidente — descreva o alvo'
                : 'Sua pista está na mesa'
              : phase === 'guess'
                ? 'Onde está o alvo?'
                : 'Aguarde a pista'
          }
          hint={
            amPsychic && phase === 'clue'
              ? 'O alvo está marcado no espectro acima. Uma palavra ou frase curta, nada de números.'
              : !amPsychic && phase === 'guess'
                ? 'Discutam em voz alta, mas cada um manda o próprio palpite.'
                : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : isReveal
                ? 'Revelação em andamento. Próxima rodada já vem.'
                : amPsychic && phase === 'guess'
                  ? 'Agora é com a mesa. Não pode ajudar.'
                  : !amPsychic && phase === 'clue'
                    ? `Aguardando a pista de ${psychic ? playerLabel(psychic) : 'alguém'}.`
                    : !amPsychic && myGuess !== null
                      ? `Palpite ${myGuess} enviado. Aguardando os outros (${pending}).`
                      : undefined
          }
        >
          {amPsychic && phase === 'clue' && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                fullWidth
                value={clueDraft}
                onChange={(event) => setClueDraft(event.target.value)}
                placeholder="Sua pista"
                slotProps={{ htmlInput: { maxLength: 80 } }}
                sx={{ flex: '1 1 200px' }}
              />
              <Button
                variant="contained"
                color="secondary"
                disabled={submitting || !clueDraft.trim()}
                onClick={() => run(() => sintoniaClue(code, clueDraft), 'Não foi possível enviar a pista.')}
                sx={{ px: 4 }}
              >
                Enviar
              </Button>
            </Box>
          )}

          {!amPsychic && phase === 'guess' && myGuess === null && (
            <>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={guessDraft}
                  onChange={(_, value) => setGuessDraft(value as number)}
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: spectrum.left },
                    { value: 100, label: spectrum.right },
                  ]}
                  sx={{
                    color: ACCENT.main,
                    '& .MuiSlider-thumb': { width: 28, height: 28, boxShadow: `0 0 20px ${ACCENT.glow}` },
                    '& .MuiSlider-markLabel': { color: 'var(--text-muted)', fontSize: '0.7rem' },
                  }}
                />
              </Box>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                disabled={submitting}
                onClick={() => run(() => sintoniaGuess(code, guessDraft), 'Não foi possível palpitar.')}
                sx={{ py: 1.8, mt: 1 }}
              >
                Apontar {guessDraft}
              </Button>
            </>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone="win"
        sigil="◐"
        title="FIM DE PARTIDA"
        subtitle={winners.length ? `Melhor sintonia: ${namesFor(winners, players)}` : undefined}
      />
    </GameShell>
  )
}

/**
 * A régua do espectro. O alvo aparece com as faixas de pontuação em volta —
 * é o que faz a mesa entender na hora quem chegou perto e quem viajou.
 */
function Spectrum({
  left,
  right,
  target,
  myTarget,
  results,
  players,
  big,
}: {
  left: string
  right: string
  target: number | null
  myTarget: number | null
  results: RoundResult[]
  players: Player[]
  big: boolean
}) {
  const shown = target ?? myTarget
  const height = big ? 120 : 92

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 1.5,
          gap: 2,
        }}
      >
        {[left, right].map((label, index) => (
          <Typography
            key={index}
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: big ? { xs: '1.4rem', md: '2rem' } : '1.2rem',
              letterSpacing: '0.05em',
              color: index === 0 ? ACCENT.main : ACCENT.light,
              textAlign: index === 0 ? 'left' : 'right',
              flex: 1,
            }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      <Box sx={{ position: 'relative', height }}>
        {/* Trilho */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 26,
            height: big ? 22 : 16,
            borderRadius: 'var(--radius-full)',
            background: `linear-gradient(90deg, ${ACCENT.main}, ${ACCENT.light})`,
            opacity: 0.28,
            overflow: 'hidden',
          }}
        />

        {/* Faixas de pontuação em volta do alvo */}
        {shown !== null &&
          BANDS.map((band) => (
            <Box
              key={band.points}
              className="animate-pop-in"
              sx={{
                position: 'absolute',
                bottom: 26,
                height: big ? 22 : 16,
                left: `${Math.max(0, shown - band.half)}%`,
                width: `${Math.min(100, shown + band.half) - Math.max(0, shown - band.half)}%`,
                background: band.color,
                borderRadius: 'var(--radius-sm)',
              }}
            />
          ))}

        {/* Agulha do alvo */}
        {shown !== null && (
          <Box
            sx={{
              position: 'absolute',
              left: `${shown}%`,
              bottom: 20,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: big ? '1.6rem' : '1.2rem',
                color: 'var(--accent-gold)',
                lineHeight: 1,
              }}
            >
              {shown}
            </Typography>
            <Box
              sx={{
                width: 3,
                height: big ? 40 : 30,
                background: 'var(--accent-gold)',
                boxShadow: '0 0 16px var(--accent-gold-glow)',
                borderRadius: 2,
              }}
            />
          </Box>
        )}

        {/* Palpites */}
        {results.map((result, index) =>
          result.guess === null ? null : (
            <Box
              key={result.player_id}
              className="stagger-in"
              style={{ '--stagger-index': index } as React.CSSProperties}
              sx={{
                position: 'absolute',
                left: `${result.guess}%`,
                bottom: big ? 56 : 46,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
              >
                {players.find((p) => p.id === result.player_id)?.name ?? ''}
              </Typography>
              <Box
                sx={{
                  px: 0.8,
                  py: 0.1,
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-display)',
                  fontSize: big ? '1rem' : '0.85rem',
                  color: '#0a0a0f',
                  background: playerColor(result.player_id),
                }}
              >
                {result.guess}
              </Box>
            </Box>
          ),
        )}

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

      {myTarget !== null && (
        <Typography
          sx={{ mt: 1, textAlign: 'center', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.85rem' }}
        >
          Só você está vendo esse alvo.
        </Typography>
      )}
    </Box>
  )
}
