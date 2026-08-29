import { useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import { perfilGuess, perfilNext, tickPerfil } from '../../lib/api'
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
import { haptic, namesFor, playerLabel, readNumberArray, useNow } from '../../games/utils'
import PerfilBoard from '../../games/perfil/PerfilBoard'

const ACCENT = getAccent('perfil')
const CLUE_SECONDS = 20
const REVEAL_SECONDS = 12

type LastRound = {
  round: number
  tema: string
  resposta: string
  clues_used: number
  total_clues: number
  winner_id: number | null
  points: number
  guess: string | null
  position: number | null
  effect: { kind: 'bonus' | 'trap'; spaces: number } | null
}

export default function PerfilGame() {
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
  } = useGameRoom({ tick: tickPerfil, pollMs: 1800 })

  const [guessDraft, setGuessDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const now = useNow(500)

  const phase = typeof state.phase === 'string' ? state.phase : 'reading'
  const round = typeof state.round === 'number' ? state.round : 1
  const maxRounds = typeof state.max_rounds === 'number' ? state.max_rounds : 8
  const clues = (state.clues ?? []) as string[]
  const totalClues = typeof state.total_clues === 'number' ? state.total_clues : 8
  const pointsNow = typeof state.points_now === 'number' ? state.points_now : 1
  const tema = typeof state.tema === 'string' ? state.tema : null
  const answer = typeof state.answer === 'string' ? state.answer : null
  const scores = (state.scores ?? {}) as Record<string, number>
  const winners = readNumberArray(state, 'winners')
  const last = state.last as LastRound | null | undefined
  const positions = (state.positions ?? {}) as Record<string, number>
  const trackLength = typeof state.track_length === 'number' ? state.track_length : 30
  const bonusSpaces = (state.bonus_spaces ?? {}) as Record<string, number>
  const trapSpaces = (state.trap_spaces ?? {}) as Record<string, number>
  const isReveal = phase === 'reveal'

  const lockedUntil = typeof meState.locked_until === 'number' ? meState.locked_until : null
  const lockedFor = lockedUntil ? Math.ceil(lockedUntil - now / 1000) : 0
  const isLocked = lockedFor > 0

  useEffect(() => {
    setGuessDraft('')
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

  async function handleGuess() {
    const guess = guessDraft.trim()
    if (!guess) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom((await perfilGuess(code, guess)) as never)
      setGuessDraft('')
    } catch (err) {
      // Um erro aqui é quase sempre "não é essa" — o servidor já aplicou o
      // bloqueio, então mostro a mensagem dele sem drama.
      setError(err instanceof Error ? err.message : 'Palpite recusado.')
      setGuessDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GameShell
      title="PERFIL"
      tagline="As dicas caem uma a uma. Quanto antes você acertar, mais vale."
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
            totalSeconds={isReveal ? REVEAL_SECONDS : CLUE_SECONDS}
            accent={ACCENT.main}
            size={isTv ? 190 : 140}
            label={isReveal ? 'Próxima carta' : 'Próxima dica'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill
              label="Rodada"
              value={`${round}/${maxRounds}`}
              accent={ACCENT.main}
              filled
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill label="Tema" value={tema ?? '—'} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            <StatPill
              label="Vale agora"
              value={isReveal ? '—' : pointsNow}
              accent="var(--accent-gold)"
              filled={!isReveal}
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill
              label="Dicas"
              value={`${clues.length}/${totalClues}`}
              accent={ACCENT.main}
              size={isTv ? 'lg' : 'md'}
            />
          </Box>
        </Box>
      }
    >
      {/* A carta */}
      <GameCard
        title={isReveal ? 'A RESPOSTA ERA' : `QUEM OU O QUE É? · ${tema ?? ''}`}
        hint={isReveal ? undefined : 'as dicas ficam cada vez mais generosas'}
        accent={ACCENT.main}
        highlight
      >
        {isReveal && (answer || last) ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography
              className="animate-pop-in"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: isTv ? { xs: '3rem', md: '5rem' } : { xs: '2.2rem', md: '3.2rem' },
                lineHeight: 1.1,
                letterSpacing: '0.04em',
                color: 'var(--accent-gold)',
                textShadow: '0 0 44px var(--accent-gold-glow)',
              }}
            >
              {answer ?? last?.resposta}
            </Typography>
            {last && (
              <Typography sx={{ color: 'var(--text-secondary)', mt: 1.5, fontSize: '1.05rem' }}>
                {last.winner_id
                  ? `${playerLabel(players.find((p) => p.id === last.winner_id) ?? players[0])} acertou com ${last.clues_used} dica(s) e levou ${last.points} pontos.`
                  : 'Ninguém acertou desta vez.'}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {clues.map((clue, index) => {
              const isLatest = index === clues.length - 1
              return (
                <Box
                  key={index}
                  className={isLatest ? 'animate-pop-in' : undefined}
                  sx={{
                    display: 'flex',
                    gap: 1.75,
                    alignItems: 'flex-start',
                    p: isTv ? 2 : 1.5,
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isLatest ? ACCENT.main : 'rgba(255,255,255,0.07)'}`,
                    background: isLatest ? `${ACCENT.main}1a` : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Box
                    sx={{
                      width: isTv ? 40 : 30,
                      height: isTv ? 40 : 30,
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: isTv ? '1.2rem' : '0.9rem',
                      color: ACCENT.main,
                      border: `1px solid ${ACCENT.main}66`,
                      background: `${ACCENT.main}14`,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: isTv ? { xs: '1.2rem', md: '1.6rem' } : '1rem',
                      color: isLatest ? 'var(--text-primary)' : 'var(--text-secondary)',
                      pt: isTv ? 0.4 : 0.2,
                    }}
                  >
                    {clue}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </GameCard>

      {/* O tabuleiro: a corrida de verdade */}
      <GameCard
        title="O TABULEIRO"
        hint="quem cruzar a chegada primeiro vence"
        accent={ACCENT.main}
        sx={{ mt: 2 }}
        index={1}
      >
        <PerfilBoard
          players={players}
          positions={positions}
          trackLength={trackLength}
          bonusSpaces={bonusSpaces}
          trapSpaces={trapSpaces}
          accent={ACCENT.main}
          big={isTv}
        />
        {isReveal && last?.effect && (
          <Typography
            className="animate-pop-in"
            sx={{
              mt: 2,
              textAlign: 'center',
              fontWeight: 800,
              color: last.effect.kind === 'bonus' ? 'var(--status-ready)' : 'var(--accent-red)',
            }}
          >
            {last.effect.kind === 'bonus'
              ? `Casa de bônus! Andou mais ${last.effect.spaces}.`
              : `Armadilha! Voltou ${Math.abs(last.effect.spaces)} casas.`}
          </Typography>
        )}
      </GameCard>

      <GameCard title="PLACAR" accent={ACCENT.main} sx={{ mt: 2 }} index={2}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const pState = (player.state ?? {}) as Record<string, unknown>
            const locked =
              typeof pState.locked_until === 'number' && pState.locked_until > now / 1000
            return {
              highlight: last?.winner_id === player.id && isReveal,
              status: locked
                ? '⏳ Travado por erro'
                : `${scores[String(player.id)] ?? 0} ponto(s) somados`,
              trailing: (
                <StatPill
                  label="Casa"
                  value={`${positions[String(player.id)] ?? 0}/${trackLength}`}
                  size="sm"
                  accent={ACCENT.main}
                  filled={(positions[String(player.id)] ?? 0) > trackLength * 0.7}
                />
              ),
            }
          }}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={isReveal ? 'Próxima carta chegando' : `Chute agora e leve ${pointsNow} pontos`}
          hint={
            isReveal
              ? undefined
              : 'Qualquer um pode chutar a qualquer momento. Errar trava você por alguns segundos.'
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : isReveal
                ? 'Aguarde a próxima carta.'
                : isLocked
                  ? `Você errou. Volta em ${lockedFor}s.`
                  : undefined
          }
        >
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              fullWidth
              value={guessDraft}
              onChange={(event) => setGuessDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleGuess()}
              placeholder="Sua resposta"
              slotProps={{ htmlInput: { maxLength: 120 } }}
              sx={{ flex: '1 1 200px' }}
            />
            <Button
              variant="contained"
              color="secondary"
              disabled={submitting || !guessDraft.trim()}
              onClick={handleGuess}
              sx={{ px: 4 }}
            >
              Chutar
            </Button>
          </Box>
        </ActionPanel>
      )}

      {/* O host pode acelerar quando a mesa já desistiu de pensar */}
      {viewMode !== 'tv' && !isReveal && !isEnded && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<SkipNextRoundedIcon />}
            disabled={submitting || clues.length >= totalClues}
            onClick={() => run(() => perfilNext(code), 'Não foi possível adiantar.')}
          >
            Próxima dica
          </Button>
        </Box>
      )}

      <ResultOverlay
        open={isEnded}
        tone="win"
        sigil="?"
        title="FIM DE PARTIDA"
        subtitle={winners.length ? `Vencedores: ${namesFor(winners, players)}` : undefined}
      />
    </GameShell>
  )
}
