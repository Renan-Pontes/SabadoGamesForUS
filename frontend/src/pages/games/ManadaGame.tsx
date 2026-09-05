import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { manadaAnswer, tickManada } from '../../lib/api'
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

const ACCENT = getAccent('manada')
const PHASE_SECONDS: Record<string, number> = { answer: 40, reveal: 12 }

type Group = { text: string; player_ids: number[]; majority: boolean }
type LastResult = {
  round: number
  question: string
  groups: Group[]
  majority: string | null
  points: Record<string, number>
  cow_id: number | null
  cow_moved: boolean
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

export default function ManadaGame() {
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
  } = useGameRoom({ tick: tickManada, pollMs: 1500 })

  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<{ round: number; text: string }>({ round: 0, text: '' })

  const phase = typeof state.phase === 'string' ? state.phase : 'answer'
  const round = typeof state.round === 'number' ? state.round : 1
  const rounds = typeof state.rounds === 'number' ? state.rounds : 8
  const question = typeof state.question === 'string' ? state.question : ''
  const answeredIds = readNumberArray(state, 'answered_ids')
  const scores = asRecord<number>(state.scores)
  const cowId = typeof state.cow_id === 'number' ? state.cow_id : null
  const lastResult = (state.last_result ?? null) as LastResult | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const myAnswer = typeof meState.answer === 'string' ? meState.answer : null
  const draftText = draft.round === round ? draft.text : ''
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
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

  const sendAnswer = () => {
    const text = draftText.trim()
    if (!text) return
    act(() => manadaAnswer(code, text), 'Não foi possível responder.')
  }

  return (
    <GameShell
      title="MANADA"
      tagline="Não responda o que você acha. Responda o que a mesa acha. Quem fica sozinho leva a vaca."
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
            totalSeconds={PHASE_SECONDS[phase] ?? 40}
            accent={ACCENT.main}
            size={isTv ? 190 : 130}
            frozen={phase === 'ended'}
            label={phase === 'answer' ? 'Para responder' : 'Próxima'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Pergunta" value={`${Math.min(round, rounds)}/${rounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            {phase === 'answer' && <StatPill label="Responderam" value={`${answeredIds.length}/${players.length}`} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />}
            <StatPill label="Vaca rosa" value={cowId === null ? 'no pasto' : nameOf(cowId)} accent={cowId === null ? ACCENT.light : 'var(--accent-red)'} filled={cowId !== null} size={isTv ? 'lg' : 'md'} />
          </Box>
        </Box>
      }
    >
      <GameCard key={`q-${round}`} accent={ACCENT.main} highlight sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: ACCENT.main, textAlign: 'center', mb: 1 }}>
          PERGUNTA {round}
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.6rem', md: isTv ? '3.2rem' : '2.1rem' }, lineHeight: 1.15, textAlign: 'center', color: 'var(--text-primary)' }}>
          {question}
        </Typography>
      </GameCard>

      {/* Revelação: os grupos */}
      {phase === 'reveal' && lastResult && (
        <GameCard
          key={`r-${lastResult.round}`}
          title={lastResult.majority ? `A manada disse: ${lastResult.majority}` : 'Sem maioria. Rebanho dividido.'}
          hint={lastResult.cow_moved && lastResult.cow_id !== null ? `🐄 A vaca foi para ${nameOf(lastResult.cow_id)}` : undefined}
          accent="var(--accent-gold)"
          highlight
          sx={{ mb: 2 }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, md: 1.5 }, justifyContent: 'center' }}>
            {lastResult.groups.map((group, index) => {
              const lonely = group.player_ids.length === 1 && lastResult.cow_moved && group.player_ids[0] === lastResult.cow_id
              return (
                <Box
                  key={`${group.text}-${index}`}
                  className="stagger-in"
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  sx={{
                    minWidth: { xs: 130, md: isTv ? 220 : 150 },
                    p: { xs: 1.5, md: 2 },
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${group.majority ? 'var(--accent-gold)' : lonely ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)'}`,
                    background: group.majority ? 'rgba(212,165,32,0.15)' : lonely ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
                    boxShadow: group.majority ? '0 0 30px var(--accent-gold-glow)' : 'none',
                    textAlign: 'center',
                    transform: group.majority ? 'scale(1.04)' : 'none',
                  }}
                >
                  <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.3rem', md: isTv ? '2.2rem' : '1.6rem' }, color: group.majority ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1.1 }}>
                    {group.text}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--text-muted)', mt: 0.5 }}>
                    {group.player_ids.length} {group.player_ids.length === 1 ? 'PESSOA' : 'PESSOAS'}{group.majority ? ' · +1' : ''}{lonely ? ' · 🐄' : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, justifyContent: 'center', mt: 1 }}>
                    {group.player_ids.map((pid) => (
                      <Box key={pid} sx={{ px: 0.8, borderRadius: 'var(--radius-full)', fontSize: '0.65rem', fontWeight: 800, color: '#0a0a0f', background: playerColor(pid) }}>
                        {nameOf(pid)}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </GameCard>
      )}

      <GameCard title="O rebanho" accent={ACCENT.main} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            ready: phase === 'answer' ? answeredIds.includes(player.id) : false,
            highlight: winnerIds.includes(player.id),
            status:
              player.id === cowId
                ? '🐄 Com a vaca'
                : phase === 'answer'
                  ? answeredIds.includes(player.id)
                    ? '✓ Respondeu'
                    : 'Pensando...'
                  : winnerIds.includes(player.id)
                    ? '🏆 Venceu'
                    : '',
            trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent={player.id === cowId ? 'var(--accent-red)' : 'var(--accent-gold)'} />,
          })}
        />
      </GameCard>

      {viewMode === 'player' && phase === 'answer' && (
        <ActionPanel
          title={myAnswer ? `Você disse: ${myAnswer}` : 'O que a mesa vai responder?'}
          hint={myAnswer ? 'Pode trocar até o tempo acabar.' : 'A resposta certa é a mais comum. Não seja original.'}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={draftText}
              onChange={(event) => setDraft({ round, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendAnswer()
              }}
              placeholder="Sua resposta"
              autoComplete="off"
            />
            <Button variant="contained" color="primary" disabled={submitting || !draftText.trim()} onClick={sendAnswer} sx={{ px: 3 }}>
              Enviar
            </Button>
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length > 1 ? 'REBANHO EMPATADO' : 'LÍDER DA MANADA'}
        subtitle={
          winnerIds.length
            ? `${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => scores[String(id)] ?? 0))} pontos.${cowId !== null ? ` ${nameOf(cowId)} terminou com a vaca.` : ''}`
            : 'Fim de jogo.'
        }
      />
    </GameShell>
  )
}
