import { useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { camaleaoClue, camaleaoGuess, camaleaoVote, tickCamaleao } from '../../lib/api'
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

const ACCENT = getAccent('camaleao')
const PHASE_SECONDS: Record<string, number> = { clues: 45, vote: 120, guess: 30, reveal: 14 }

type Last = {
  chameleon_id: number
  secret_word: string
  outcome: 'escapou' | 'pego_mas_acertou' | 'pego'
  guess: string | null
  clues: Record<string, string>
  vote_counts: Record<string, number>
}

export default function CamaleaoGame() {
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
  } = useGameRoom({ tick: tickCamaleao, pollMs: 2000 })

  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'clues'
  const round = typeof state.round === 'number' ? state.round : 1
  const maxRounds = typeof state.max_rounds === 'number' ? state.max_rounds : 1
  const topic = (state.topic ?? { title: '', words: [] }) as { title: string; words: string[] }
  const clueOrder = (state.clue_order ?? []) as number[]
  const clueTurn = typeof state.clue_turn === 'number' ? state.clue_turn : 0
  const clues = (state.clues ?? {}) as Record<string, string>
  const scores = (state.scores ?? {}) as Record<string, number>
  const votesCast = typeof state.votes_cast === 'number' ? state.votes_cast : 0
  const winners = readNumberArray(state, 'winners')
  const last = state.last as Last | null | undefined
  const revealedChameleon = typeof state.chameleon_id === 'number' ? state.chameleon_id : null
  const secretIndex = typeof state.secret_index === 'number' ? state.secret_index : null

  const secretWord = typeof meState.secret_word === 'string' ? meState.secret_word : null
  const amChameleon = Boolean(meState.is_chameleon)
  const myVote = typeof meState.vote === 'number' ? meState.vote : null
  const currentGiver = clueOrder[clueTurn] ?? null
  const isMyClueTurn = Boolean(me && currentGiver === me.id)
  const isReveal = phase === 'reveal'
  const giverPlayer = players.find((p) => p.id === currentGiver) ?? null

  useEffect(() => {
    setDraft('')
  }, [round, phase])

  async function run(action: () => Promise<unknown>, failure: string) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom((await action()) as never)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  const phaseLabel =
    phase === 'clues' ? 'DICAS' : phase === 'vote' ? 'VOTAÇÃO' : phase === 'guess' ? 'CHUTE' : phase === 'reveal' ? 'REVELAÇÃO' : 'FIM'

  return (
    <GameShell
      title="CAMALEÃO"
      tagline="Todos sabem a palavra secreta, menos o camaleão. Cada um diz uma palavra — descubram quem está fingindo."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      maxWidth={isTv ? 1300 : 860}
      headerExtra={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 4 } }}>
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={PHASE_SECONDS[phase] ?? 60}
            accent={ACCENT.main}
            size={isTv ? 180 : 130}
            label={phase === 'clues' ? 'Para a dica' : phase === 'vote' ? 'Para votar' : phase === 'guess' ? 'Para chutar' : 'Próxima rodada'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Rodada" value={`${round}/${maxRounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill label="Fase" value={phaseLabel} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            {phase === 'clues' && (
              <StatPill label="Falando" value={giverPlayer ? playerLabel(giverPlayer) : '—'} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            )}
            {phase === 'vote' && (
              <StatPill label="Votaram" value={`${votesCast}/${players.length}`} accent="var(--accent-gold)" size={isTv ? 'lg' : 'md'} />
            )}
          </Box>
        </Box>
      }
    >
      {/* Seu papel */}
      {!isTv && (
        <GameCard accent={amChameleon ? 'var(--accent-red)' : ACCENT.main} highlight sx={{ mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}>
              SÓ VOCÊ VÊ ISTO
            </Typography>
            {amChameleon ? (
              <>
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '2rem', md: '2.8rem' }, color: 'var(--accent-red)', letterSpacing: '0.06em' }}>
                  🦎 VOCÊ É O CAMALEÃO
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                  Você não sabe a palavra. Ouça as dicas dos outros e finja que sabe.
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 1 }}>A palavra secreta é</Typography>
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '2.4rem', md: '3.2rem' }, color: ACCENT.main, letterSpacing: '0.06em', textShadow: `0 0 30px ${ACCENT.glow}` }}>
                  {secretWord ?? '—'}
                </Typography>
              </>
            )}
          </Box>
        </GameCard>
      )}

      {/* A grade */}
      <GameCard title={topic.title.toUpperCase()} hint="16 palavras · uma é a secreta" accent={ACCENT.main} highlight>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: { xs: 0.75, md: 1.25 } }}>
          {topic.words.map((word, index) => {
            const isSecret = (isReveal || isEnded) && secretIndex === index
            const isMine = !isTv && !amChameleon && secretWord === word && !isReveal
            return (
              <Box
                key={index}
                className="stagger-in"
                style={{ '--stagger-index': index % 8 } as React.CSSProperties}
                sx={{
                  p: { xs: 1, md: 1.5 },
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${isSecret ? 'var(--accent-gold)' : isMine ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                  background: isSecret ? 'rgba(212,165,32,0.2)' : isMine ? `${ACCENT.main}1f` : 'rgba(255,255,255,0.04)',
                  boxShadow: isSecret ? '0 0 26px var(--accent-gold-glow)' : 'none',
                }}
              >
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: isTv ? { xs: '1rem', md: '1.5rem' } : { xs: '0.8rem', md: '1rem' }, letterSpacing: '0.04em', color: isSecret ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                  {word}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </GameCard>

      {/* As dicas */}
      <GameCard title="AS DICAS" hint={phase === 'clues' ? 'na ordem da mesa' : 'todas na mesa'} accent={ACCENT.main} sx={{ mt: 2 }} index={1}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
          {clueOrder.map((pid, index) => {
            const player = players.find((p) => p.id === pid)
            const clue = clues[String(pid)]
            const isCurrent = index === clueTurn && phase === 'clues'
            const wasChameleon = (isReveal || isEnded) && (last?.chameleon_id ?? revealedChameleon) === pid
            return (
              <Box
                key={pid}
                sx={{
                  minWidth: 120,
                  p: 1.5,
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${wasChameleon ? 'var(--accent-red)' : isCurrent ? ACCENT.main : `${playerColor(pid)}55`}`,
                  background: wasChameleon ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.03)',
                  boxShadow: isCurrent ? `0 0 22px ${ACCENT.glow}` : 'none',
                  animation: isCurrent ? 'pulseGlow 2s ease-in-out infinite' : undefined,
                  '--pulse-color': ACCENT.glow,
                }}
              >
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: playerColor(pid) }}>
                  {player ? playerLabel(player) : `#${pid}`}
                  {wasChameleon && ' 🦎'}
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: isTv ? '1.6rem' : '1.2rem', color: clue ? 'var(--text-primary)' : 'var(--text-muted)', mt: 0.5 }}>
                  {clue ?? (isCurrent ? '···' : '—')}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </GameCard>

      {/* Placar */}
      <GameCard title="PLACAR" accent={ACCENT.main} sx={{ mt: 2 }} index={2}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            highlight: phase === 'clues' && player.id === currentGiver,
            status: phase === 'vote' ? 'Votando...' : phase === 'clues' && player.id === currentGiver ? 'Dando a dica' : 'Na mesa',
            trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent={ACCENT.main} />,
          })}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            phase === 'clues'
              ? isMyClueTurn
                ? 'Sua vez: diga uma palavra'
                : `Vez de ${giverPlayer ? playerLabel(giverPlayer) : '—'}`
              : phase === 'vote'
                ? 'Quem é o camaleão?'
                : phase === 'guess'
                  ? amChameleon
                    ? 'Você foi pego — qual era a palavra?'
                    : 'O camaleão está chutando'
                  : 'Aguarde'
          }
          hint={
            phase === 'clues' && isMyClueTurn
              ? amChameleon
                ? 'Você não sabe a palavra. Use o tema e as dicas anteriores para blefar.'
                : 'Relacionada à secreta, mas não tão óbvia que entregue o jogo ao camaleão.'
              : phase === 'vote'
                ? 'Quem deu a dica mais vaga? Quem hesitou?'
                : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : isReveal
                ? 'Revelação em andamento.'
                : phase === 'clues' && !isMyClueTurn
                  ? 'Aguarde a sua vez de falar.'
                  : phase === 'vote' && myVote !== null
                    ? 'Voto registrado. Aguardando os outros.'
                    : phase === 'guess' && !amChameleon
                      ? 'O camaleão tem uma chance de acertar a palavra.'
                      : undefined
          }
        >
          {phase === 'clues' && isMyClueTurn && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField fullWidth value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Uma palavra" slotProps={{ htmlInput: { maxLength: 30 } }} onKeyDown={(e) => e.key === 'Enter' && draft.trim() && run(() => camaleaoClue(code, draft), 'Não deu para enviar.')} />
              <Button variant="contained" color="secondary" disabled={submitting || !draft.trim()} onClick={() => run(() => camaleaoClue(code, draft), 'Não deu para enviar.')} sx={{ px: 3 }}>
                Falar
              </Button>
            </Box>
          )}

          {phase === 'vote' && myVote === null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {players.filter((p) => p.id !== me?.id).map((player) => (
                <Button key={player.id} variant="outlined" disabled={submitting} onClick={() => run(() => camaleaoVote(code, player.id), 'Não deu para votar.')} sx={{ justifyContent: 'space-between', textTransform: 'none', borderColor: playerColor(player.id), py: 1.3 }}>
                  <span>{playerLabel(player)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>disse "{clues[String(player.id)] ?? '—'}"</span>
                </Button>
              ))}
            </Box>
          )}

          {phase === 'guess' && amChameleon && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {topic.words.map((word) => (
                <Button key={word} variant="outlined" disabled={submitting} onClick={() => run(() => camaleaoGuess(code, word), 'Não deu para chutar.')} sx={{ textTransform: 'none', fontSize: '0.85rem' }}>
                  {word}
                </Button>
              ))}
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isReveal && Boolean(last)}
        tone={last?.outcome === 'pego' ? 'win' : 'danger'}
        sigil="🦎"
        title={last?.outcome === 'escapou' ? 'O CAMALEÃO ESCAPOU' : last?.outcome === 'pego_mas_acertou' ? 'PEGO, MAS ACERTOU' : 'CAMALEÃO PEGO'}
        subtitle={last ? `${playerLabel(players.find((p) => p.id === last.chameleon_id) ?? players[0])} era o camaleão. A palavra era "${last.secret_word}".` : undefined}
      />
      <ResultOverlay open={isEnded} tone="win" sigil="🦎" title="FIM DE PARTIDA" subtitle={winners.length ? `Vencedores: ${namesFor(winners, players)}` : undefined} />
    </GameShell>
  )
}
