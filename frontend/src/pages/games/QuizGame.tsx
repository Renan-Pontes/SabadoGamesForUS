import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { quizAnswer, tickQuiz } from '../../lib/api'
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
import { haptic, namesFor, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('quiz-da-mesa')
const PHASE_SECONDS: Record<string, number> = { question: 20, reveal: 8 }
const OPTION_STYLE = [
  { color: '#ef4444', shape: '▲' },
  { color: '#3b82f6', shape: '◆' },
  { color: '#facc15', shape: '●' },
  { color: '#22c55e', shape: '■' },
]

type Question = { text: string; options: string[] }
type LastResult = {
  round: number
  text: string
  options: string[]
  correct: number
  distribution: number[]
  points: Record<string, number>
  choices: Record<string, number>
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

export default function QuizGame() {
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
  } = useGameRoom({ tick: tickQuiz, pollMs: 1000 })

  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'question'
  const round = typeof state.round === 'number' ? state.round : 1
  const rounds = typeof state.rounds === 'number' ? state.rounds : 10
  const question = (state.question ?? null) as Question | null
  const answeredIds = readNumberArray(state, 'answered_ids')
  const scores = asRecord<number>(state.scores)
  const streaks = asRecord<number>(state.streaks)
  const lastResult = (state.last_result ?? null) as LastResult | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const myChoice = typeof meState.choice === 'number' ? meState.choice : null
  const myPoints = typeof meState.points === 'number' ? meState.points : 0
  const revealing = phase === 'reveal' && lastResult !== null
  const options = revealing ? lastResult.options : question?.options ?? []
  const text = revealing ? lastResult.text : question?.text ?? ''
  const maxCount = revealing ? Math.max(1, ...lastResult.distribution) : 1

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

  const canAnswer = viewMode === 'player' && phase === 'question' && isLive && myChoice === null

  return (
    <GameShell
      title="QUIZ DA MESA"
      tagline="Quatro opções, vinte segundos. Acertar rápido vale mais."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      headerExtra={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 5 } }}>
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={PHASE_SECONDS[phase] ?? 20}
            accent={ACCENT.main}
            size={isTv ? 190 : 130}
            frozen={phase === 'ended'}
            label={phase === 'question' ? 'Para responder' : 'Próxima'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Pergunta" value={`${Math.min(round, rounds)}/${rounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            {phase === 'question' && <StatPill label="Responderam" value={`${answeredIds.length}/${players.length}`} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />}
            {!isTv && <StatPill label="Seus pontos" value={myPoints} accent="var(--accent-gold)" filled size="md" />}
          </Box>
        </Box>
      }
    >
      <GameCard key={`q-${round}-${phase}`} accent={ACCENT.main} highlight sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: ACCENT.main, textAlign: 'center', mb: 1 }}>
          PERGUNTA {round}
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.5rem', md: isTv ? '3rem' : '2rem' }, lineHeight: 1.15, textAlign: 'center', color: 'var(--text-primary)', mb: 2.5 }}>
          {text}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1, md: 1.5 } }}>
          {options.map((option, index) => {
            const style = OPTION_STYLE[index] ?? OPTION_STYLE[0]
            const isCorrect = revealing && lastResult.correct === index
            const isMine = revealing ? lastResult.choices[String(me?.id ?? -1)] === index : myChoice === index
            const count = revealing ? lastResult.distribution[index] ?? 0 : 0
            const dimmed = revealing && !isCorrect
            return (
              <Box
                key={`${index}-${option}`}
                component={canAnswer ? 'button' : 'div'}
                onClick={canAnswer ? () => act(() => quizAnswer(code, index), 'Não foi possível responder.') : undefined}
                disabled={canAnswer ? submitting : undefined}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left',
                  width: '100%',
                  border: `2px solid ${isCorrect ? 'var(--accent-gold)' : isMine ? '#fff' : `${style.color}88`}`,
                  borderRadius: 'var(--radius-lg)',
                  background: `linear-gradient(160deg, ${style.color}${dimmed ? '22' : '55'}, rgba(10,10,15,0.9))`,
                  color: 'var(--text-primary)',
                  p: { xs: 1.5, md: isTv ? 2.5 : 1.75 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: canAnswer ? 'pointer' : 'default',
                  opacity: dimmed ? 0.55 : 1,
                  boxShadow: isCorrect ? '0 0 30px var(--accent-gold-glow)' : 'none',
                  transition: 'all 260ms ease',
                  fontFamily: 'inherit',
                  '&:hover': canAnswer ? { transform: 'translateY(-2px)', borderColor: style.color } : undefined,
                }}
              >
                {/* Barra de distribuição na revelação */}
                {revealing && (
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(count / maxCount) * 100}%`, background: `${style.color}33`, transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
                )}
                <Box sx={{ position: 'relative', width: { xs: 36, md: isTv ? 56 : 42 }, height: { xs: 36, md: isTv ? 56 : 42 }, borderRadius: 'var(--radius-md)', background: style.color, color: '#0a0a0f', display: 'grid', placeItems: 'center', fontSize: { xs: '1.1rem', md: isTv ? '1.8rem' : '1.3rem' }, flexShrink: 0 }}>
                  {style.shape}
                </Box>
                <Typography sx={{ position: 'relative', flex: 1, fontWeight: 700, fontSize: { xs: '1rem', md: isTv ? '1.7rem' : '1.15rem' } }}>
                  {option}
                </Typography>
                {revealing && (
                  <Typography sx={{ position: 'relative', fontFamily: 'var(--font-display)', fontSize: { xs: '1.2rem', md: isTv ? '2rem' : '1.4rem' }, color: isCorrect ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                    {isCorrect ? '✓ ' : ''}{count}
                  </Typography>
                )}
                {!revealing && isMine && (
                  <Typography sx={{ position: 'relative', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', color: '#fff' }}>SUA</Typography>
                )}
              </Box>
            )
          })}
        </Box>

        {revealing && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
            {players.map((player) => {
              const delta = lastResult.points[String(player.id)] ?? 0
              return (
                <Box key={player.id} className="animate-pop-in" sx={{ px: 1.25, py: 0.5, borderRadius: 'var(--radius-full)', fontSize: { xs: '0.8rem', md: isTv ? '1.05rem' : '0.85rem' }, fontWeight: 700, background: delta > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: delta > 0 ? 'var(--status-ready)' : 'var(--text-muted)' }}>
                  {playerLabel(player)} {delta > 0 ? `+${delta}` : '0'}
                </Box>
              )
            })}
          </Box>
        )}
      </GameCard>

      <GameCard title="Placar" accent={ACCENT.main} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const streak = streaks[String(player.id)] ?? 0
            return {
              ready: phase === 'question' ? answeredIds.includes(player.id) : false,
              highlight: winnerIds.includes(player.id),
              status:
                phase === 'question'
                  ? answeredIds.includes(player.id)
                    ? '✓ Respondeu'
                    : 'Pensando...'
                  : winnerIds.includes(player.id)
                    ? '🏆 Venceu'
                    : streak >= 2
                      ? `🔥 ${streak} seguidas`
                      : '',
              trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent="var(--accent-gold)" />,
            }
          }}
        />
      </GameCard>

      {viewMode === 'player' && phase === 'question' && (
        <ActionPanel
          title={myChoice === null ? 'Toque na resposta acima' : 'Resposta enviada'}
          hint={myChoice === null ? 'Sem trocar depois. Rápido vale mais.' : `Você marcou ${OPTION_STYLE[myChoice]?.shape ?? ''} ${options[myChoice] ?? ''}. Agora é esperar.`}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : myChoice !== null ? 'Aguardando os outros.' : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
            {OPTION_STYLE.map((style, index) => (
              <Button
                key={index}
                disabled={submitting || myChoice !== null || index >= options.length}
                onClick={() => act(() => quizAnswer(code, index), 'Não foi possível responder.')}
                sx={{ py: 1.6, minWidth: 0, background: `${style.color}33`, border: `2px solid ${style.color}`, color: 'var(--text-primary)', fontSize: '1.3rem' }}
              >
                {style.shape}
              </Button>
            ))}
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length > 1 ? 'EMPATE NO QUIZ' : 'CÉREBRO DA MESA'}
        subtitle={winnerIds.length ? `${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => scores[String(id)] ?? 0))} pontos.` : 'Fim de jogo.'}
      />
    </GameShell>
  )
}
