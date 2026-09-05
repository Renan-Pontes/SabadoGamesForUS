import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { soUmaClue, soUmaGuess, tickSoUma } from '../../lib/api'
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
import { haptic, playerColor, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('so-uma')
const PHASE_SECONDS: Record<string, number> = { clues: 60, guess: 60, reveal: 10 }

type Judged = { player_id: number; text: string; valid: boolean; reason: string | null }
type Result = { outcome: 'correct' | 'wrong' | 'pass'; word: string; guess: string | null; judged: Judged[] }

const OUTCOME: Record<Result['outcome'], { title: string; color: string }> = {
  correct: { title: 'ACERTOU!', color: 'var(--status-ready)' },
  wrong: { title: 'ERROU. PERDE ESTA E A PRÓXIMA', color: 'var(--accent-red)' },
  pass: { title: 'PASSOU', color: 'var(--text-secondary)' },
}

export default function SoUmaGame() {
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
  } = useGameRoom({ tick: tickSoUma, pollMs: 1500 })

  const [submitting, setSubmitting] = useState(false)
  const [clueDraft, setClueDraft] = useState<{ round: number; text: string }>({ round: 0, text: '' })
  const [guessDraft, setGuessDraft] = useState('')

  const phase = typeof state.phase === 'string' ? state.phase : 'clues'
  const round = typeof state.round === 'number' ? state.round : 1
  const rounds = typeof state.rounds === 'number' ? state.rounds : 10
  const guesserId = typeof state.guesser_id === 'number' ? state.guesser_id : null
  const clueIds = readNumberArray(state, 'clue_ids')
  const shownClues = (Array.isArray(state.shown_clues) ? state.shown_clues : []) as Judged[]
  const cancelledCount = typeof state.cancelled_count === 'number' ? state.cancelled_count : 0
  const result = (state.result ?? null) as Result | null
  const score = typeof state.score === 'number' ? state.score : 0
  const rating = typeof state.rating === 'string' ? state.rating : ''
  const helpers = players.filter((player) => player.id !== guesserId)

  const myWord = typeof meState.word === 'string' ? meState.word : null
  const myClue = typeof meState.clue === 'string' ? meState.clue : null
  const isGuesser = Boolean(me && guesserId === me.id)
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }
  const clueText = clueDraft.round === round ? clueDraft.text : ''

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

  const sendClue = () => {
    const text = clueText.trim()
    if (!text) return
    act(() => soUmaClue(code, text), 'Não foi possível enviar a dica.')
  }

  const sendGuess = (passed = false) => {
    const text = guessDraft.trim()
    if (!passed && !text) return
    act(async () => {
      await soUmaGuess(code, passed ? null : text, passed)
      setGuessDraft('')
    }, 'Não foi possível responder.')
  }

  const phaseLabel = phase === 'clues' ? 'Para as dicas' : phase === 'guess' ? 'Para adivinhar' : phase === 'reveal' ? 'Próxima' : 'Fim'

  return (
    <GameShell
      title="SÓ UMA"
      tagline="Todos dão uma palavra de dica. As repetidas se cancelam. O que sobrar tem que bastar."
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
            totalSeconds={PHASE_SECONDS[phase] ?? 60}
            accent={ACCENT.main}
            size={isTv ? 190 : 130}
            frozen={phase === 'ended'}
            label={phaseLabel}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Carta" value={`${Math.min(round, rounds)}/${rounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill label="Acertos" value={score} accent="var(--status-ready)" size={isTv ? 'lg' : 'md'} />
            <StatPill label="Adivinha" value={nameOf(guesserId)} accent={isGuesser ? 'var(--status-ready)' : ACCENT.light} filled={isGuesser} size={isTv ? 'lg' : 'md'} />
            {phase === 'clues' && <StatPill label="Dicas" value={`${clueIds.length}/${helpers.length}`} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />}
          </Box>
        </Box>
      }
    >
      {/* Meu papel nesta carta */}
      {!isTv && phase !== 'ended' && (
        <GameCard key={`role-${round}`} accent={isGuesser ? 'var(--accent-gold)' : ACCENT.main} highlight sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', color: isGuesser ? 'var(--accent-gold)' : ACCENT.main }}>
            {isGuesser ? 'VOCÊ ADIVINHA NESTA CARTA' : 'A PALAVRA SECRETA'}
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '2rem', md: '2.6rem' }, textAlign: 'center', letterSpacing: '0.06em', color: isGuesser ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1.1 }}>
            {isGuesser ? '? ? ?' : (myWord ?? '...').toUpperCase()}
          </Typography>
          <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', mt: 0.5 }}>
            {isGuesser ? 'Não olhe para o celular dos outros. As dicas aparecem na TV quando todos escreverem.' : 'Uma palavra só. Se alguém der a mesma, as duas somem.'}
          </Typography>
        </GameCard>
      )}

      {/* As dicas na TV */}
      <GameCard
        title={phase === 'clues' ? 'Escrevendo as dicas' : phase === 'guess' ? 'As dicas que sobraram' : phase === 'reveal' ? 'Todas as dicas' : 'Fim'}
        hint={phase === 'guess' && cancelledCount ? `${cancelledCount} dica${cancelledCount === 1 ? '' : 's'} cancelada${cancelledCount === 1 ? '' : 's'} por repetição ou parecença` : undefined}
        accent={ACCENT.main}
        highlight
        sx={{ mb: 2 }}
      >
        {phase === 'clues' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', py: 2 }}>
            {helpers.map((player) => (
              <Box
                key={player.id}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 'var(--radius-full)',
                  border: `1px solid ${clueIds.includes(player.id) ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                  background: clueIds.includes(player.id) ? `${ACCENT.main}22` : 'transparent',
                  color: clueIds.includes(player.id) ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: { xs: '0.85rem', md: isTv ? '1.1rem' : '0.9rem' },
                }}
              >
                {clueIds.includes(player.id) ? '✓ ' : '… '}
                {playerLabel(player)}
              </Box>
            ))}
          </Box>
        )}

        {phase === 'guess' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, md: 1.5 }, justifyContent: 'center', py: 1 }}>
            {shownClues.length === 0 && (
              <Typography sx={{ color: 'var(--accent-red)', fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
                NENHUMA DICA SOBROU. BOA SORTE.
              </Typography>
            )}
            {shownClues.map((clue, index) => (
              <Box
                key={clue.player_id}
                className="stagger-in"
                style={{ '--stagger-index': index } as React.CSSProperties}
                sx={{
                  minWidth: { xs: 120, md: isTv ? 200 : 140 },
                  p: { xs: 1.5, md: 2 },
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${playerColor(clue.player_id)}66`,
                  background: `linear-gradient(160deg, ${playerColor(clue.player_id)}22, rgba(10,10,15,0.9))`,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.5rem', md: isTv ? '2.6rem' : '1.8rem' }, letterSpacing: '0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {clue.text.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: playerColor(clue.player_id), fontWeight: 700, mt: 0.5 }}>{nameOf(clue.player_id)}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {phase === 'reveal' && result && (
          <Box>
            <Typography sx={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: { xs: '1.5rem', md: isTv ? '2.6rem' : '1.9rem' }, letterSpacing: '0.06em', color: OUTCOME[result.outcome].color }}>
              {OUTCOME[result.outcome].title}
            </Typography>
            <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', mb: 2 }}>
              A palavra era <Box component="span" sx={{ color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>{result.word}</Box>
              {result.guess ? ` · ${nameOf(guesserId)} disse “${result.guess}”` : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {result.judged.map((clue) => (
                <Box
                  key={clue.player_id}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${clue.valid ? playerColor(clue.player_id) : 'rgba(220,38,38,0.4)'}`,
                    opacity: clue.valid ? 1 : 0.6,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontWeight: 800, textDecoration: clue.valid ? 'none' : 'line-through', color: clue.valid ? 'var(--text-primary)' : 'var(--accent-red-light)', fontSize: { xs: '0.95rem', md: isTv ? '1.3rem' : '1rem' } }}>
                    {clue.text}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {nameOf(clue.player_id)}{clue.reason ? ` · ${clue.reason}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </GameCard>

      <GameCard title="A mesa" accent={ACCENT.main} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            highlight: player.id === guesserId && phase !== 'ended',
            ready: phase === 'clues' ? clueIds.includes(player.id) : false,
            status: player.id === guesserId ? '🎯 Adivinha' : phase === 'clues' ? (clueIds.includes(player.id) ? '✓ Dica dada' : 'Pensando...') : '',
          })}
        />
      </GameCard>

      {/* Dica */}
      {viewMode === 'player' && !isGuesser && phase === 'clues' && (
        <ActionPanel
          title={myClue ? `Sua dica: ${myClue}` : 'Sua dica, uma palavra'}
          hint={myClue ? 'Pode trocar até todo mundo entregar.' : 'Óbvio demais e alguém dá igual. Difícil demais e ninguém entende.'}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={clueText}
              onChange={(event) => setClueDraft({ round, text: event.target.value.replace(/\s+/g, '') })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendClue()
              }}
              placeholder="Uma palavra"
              autoComplete="off"
            />
            <Button variant="contained" color="primary" disabled={submitting || !clueText.trim()} onClick={sendClue} sx={{ px: 3 }}>
              Enviar
            </Button>
          </Box>
        </ActionPanel>
      )}

      {/* Adivinhar */}
      {viewMode === 'player' && isGuesser && (phase === 'clues' || phase === 'guess') && (
        <ActionPanel
          title={phase === 'guess' ? 'Qual é a palavra?' : 'Esperando as dicas'}
          hint={phase === 'guess' ? 'Uma chance. Errar custa duas cartas; passar não custa nada.' : 'Olhe para a TV. As dicas aparecem quando todos escreverem.'}
          accent="var(--accent-gold)"
          lockedReason={!isLive ? 'A partida não está em andamento.' : phase !== 'guess' ? 'As dicas ainda estão sendo escritas.' : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1 }}>
            <TextField
              fullWidth
              value={guessDraft}
              onChange={(event) => setGuessDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendGuess(false)
              }}
              placeholder="Sua resposta"
              autoComplete="off"
            />
            <Button variant="contained" color="primary" disabled={submitting || !guessDraft.trim()} onClick={() => sendGuess(false)}>
              Responder
            </Button>
            <Button variant="outlined" color="inherit" disabled={submitting} onClick={() => sendGuess(true)}>
              Passar
            </Button>
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={score >= Math.ceil(rounds / 2) ? 'win' : 'lose'}
        title={`${score} DE ${rounds}`}
        subtitle={rating || 'Fim de jogo.'}
      />
    </GameShell>
  )
}
