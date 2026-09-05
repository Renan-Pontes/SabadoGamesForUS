import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { artistaGuess, artistaStroke, artistaVote, tickArtista } from '../../lib/api'
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

const ACCENT = getAccent('artista-falso')
const PHASE_SECONDS: Record<string, number> = { draw: 40, vote: 60, guess: 40, reveal: 14 }
const VIEW_W = 1000
const VIEW_H = 625
const MAX_POINTS = 400

type Stroke = { player_id: number; color: string; points: number[][]; turn?: number }
type Result = {
  outcome: 'fake_guessed' | 'fake_escaped' | 'artists_won'
  fake_id: number
  word: string
  category: string
  votes: Record<string, number>
  tally: Record<string, number>
  guess: string | null
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function toPath(points: number[][]) {
  return points.map(([x, y]) => `${(x * VIEW_W).toFixed(1)},${(y * VIEW_H).toFixed(1)}`).join(' ')
}

type BoardProps = {
  strokes: Stroke[]
  draft?: number[][]
  draftColor?: string
  interactive?: boolean
  onDraftChange?: (points: number[][]) => void
  highlightId?: number | null
}

/** A tela compartilhada: cada traço é uma polilinha na cor de quem desenhou. */
function DrawingBoard({ strokes, draft = [], draftColor = '#fff', interactive = false, onDraftChange, highlightId }: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)
  const pointsRef = useRef<number[][]>([])

  const normalize = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)]
  }

  const handleDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return
    event.preventDefault()
    svgRef.current?.setPointerCapture(event.pointerId)
    drawing.current = true
    const point = normalize(event)
    pointsRef.current = point ? [point] : []
    onDraftChange?.(pointsRef.current)
  }

  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const point = normalize(event)
    if (!point) return
    const last = pointsRef.current[pointsRef.current.length - 1]
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.004) return
    if (pointsRef.current.length >= MAX_POINTS) return
    pointsRef.current = [...pointsRef.current, point]
    onDraftChange?.(pointsRef.current)
  }

  const handleUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    drawing.current = false
    try {
      svgRef.current?.releasePointerCapture(event.pointerId)
    } catch {
      // o ponteiro pode ja ter sido solto pelo navegador
    }
    onDraftChange?.(pointsRef.current)
  }

  return (
    <Box
      sx={{
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${interactive ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
        background: '#fbf7ee',
        overflow: 'hidden',
        aspectRatio: '16 / 10',
        touchAction: 'none',
        boxShadow: interactive ? `0 0 30px ${ACCENT.glow}` : '0 14px 34px rgba(0,0,0,0.4)',
        transition: 'border-color 260ms ease',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        {strokes.map((stroke, index) => (
          <polyline
            key={`${stroke.player_id}-${stroke.turn ?? index}`}
            points={toPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={highlightId === stroke.player_id ? 10 : 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={highlightId !== null && highlightId !== undefined && highlightId !== stroke.player_id ? 0.55 : 0.95}
          />
        ))}
        {draft.length > 0 && (
          <polyline
            points={toPath(draft)}
            fill="none"
            stroke={draftColor}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </Box>
  )
}

const OUTCOME_TEXT: Record<Result['outcome'], { title: string; subtitle: string }> = {
  fake_guessed: { title: 'O FALSO ACERTOU A PALAVRA', subtitle: 'Foi pego, chutou certo e levou a rodada.' },
  fake_escaped: { title: 'O FALSO ESCAPOU', subtitle: 'Ninguém conseguiu apontar. Rodada do artista falso.' },
  artists_won: { title: 'OS ARTISTAS VENCERAM', subtitle: 'Pego e sem ideia da palavra.' },
}

export default function ArtistaFalsoGame() {
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
  } = useGameRoom({ tick: tickArtista, pollMs: 1500 })

  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<{ turn: number; points: number[][] }>({ turn: -1, points: [] })
  const [guessDraft, setGuessDraft] = useState('')

  const phase = typeof state.phase === 'string' ? state.phase : 'draw'
  const round = typeof state.round === 'number' ? state.round : 1
  const rounds = typeof state.rounds === 'number' ? state.rounds : 3
  const category = typeof state.category === 'string' ? state.category : ''
  const colors = asRecord<string>(state.colors)
  const scores = asRecord<number>(state.scores)
  const strokes = (Array.isArray(state.strokes) ? state.strokes : []) as Stroke[]
  const strokeTurn = typeof state.stroke_turn === 'number' ? state.stroke_turn : 0
  const totalTurns = typeof state.total_turns === 'number' ? state.total_turns : players.length * 2
  const currentDrawerId = typeof state.current_drawer_id === 'number' ? state.current_drawer_id : null
  const votedIds = readNumberArray(state, 'voted_ids')
  const accusedId = typeof state.accused_id === 'number' ? state.accused_id : null
  const result = (state.result ?? null) as Result | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const myWord = typeof meState.word === 'string' ? meState.word : null
  const isFake = Boolean(meState.is_fake)
  const myVote = typeof meState.vote === 'number' ? meState.vote : null
  const myColor = me ? (colors[String(me.id)] ?? ACCENT.main) : ACCENT.main

  const currentDrawer = players.find((player) => player.id === currentDrawerId) ?? null
  const isMyStroke = Boolean(me && currentDrawerId === me.id && phase === 'draw' && isLive)
  const draftPoints = draft.turn === strokeTurn ? draft.points : []
  const nameOf = (id: number | null | undefined) => {
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

  const sendStroke = () => {
    if (draftPoints.length < 2) return
    act(async () => {
      await artistaStroke(code, draftPoints)
      setDraft({ turn: -1, points: [] })
    }, 'Não foi possível enviar o traço.')
  }

  const phaseLabel =
    phase === 'draw' ? 'Para desenhar' : phase === 'vote' ? 'Para votar' : phase === 'guess' ? 'Para chutar' : 'Próxima'

  return (
    <GameShell
      title="ARTISTA FALSO"
      tagline="Todos desenham a mesma palavra, um traço por vez. Um de vocês só sabe a categoria."
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
            label={phaseLabel}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Rodada" value={`${Math.min(round, rounds)}/${rounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill label="Categoria" value={category} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            {phase === 'draw' && (
              <StatPill label="Traço" value={`${Math.min(strokeTurn + 1, totalTurns)}/${totalTurns}`} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            )}
            {phase === 'vote' && (
              <StatPill label="Votaram" value={`${votedIds.length}/${players.length}`} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            )}
          </Box>
        </Box>
      }
    >
      {/* Meu segredo */}
      {!isTv && phase !== 'ended' && (
        <GameCard
          key={`secret-${round}`}
          accent={isFake ? 'var(--accent-red)' : ACCENT.main}
          highlight
          sx={{ mb: 2 }}
        >
          <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: isFake ? 'var(--accent-red)' : ACCENT.main, textAlign: 'center' }}>
            {isFake ? 'VOCÊ É O ARTISTA FALSO' : 'A PALAVRA SECRETA'}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: { xs: '2rem', md: '2.6rem' },
              textAlign: 'center',
              letterSpacing: '0.06em',
              color: isFake ? 'var(--accent-red)' : 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            {isFake ? category.toUpperCase() : (myWord ?? '...').toUpperCase()}
          </Typography>
          <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', mt: 0.5 }}>
            {isFake ? 'Você só sabe a categoria. Desenhe algo vago e observe os outros.' : `Categoria: ${category}. Mostre que sabe, sem entregar.`}
          </Typography>
        </GameCard>
      )}

      {/* Quem está desenhando */}
      {phase === 'draw' && currentDrawer && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, mb: 1.5 }}>
          <Box sx={{ width: isTv ? 28 : 18, height: isTv ? 28 : 18, borderRadius: '50%', background: colors[String(currentDrawer.id)] ?? '#fff', boxShadow: `0 0 16px ${colors[String(currentDrawer.id)] ?? '#fff'}` }} />
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.2rem', md: isTv ? '2.2rem' : '1.5rem' }, letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
            {isMyStroke ? 'SUA VEZ DE DESENHAR' : `${playerLabel(currentDrawer).toUpperCase()} ESTÁ DESENHANDO`}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? '1fr' : '1.6fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ maxWidth: isTv ? 1200 : '100%', mx: 'auto', width: '100%' }}>
          <DrawingBoard
            strokes={strokes}
            draft={draftPoints}
            draftColor={myColor}
            interactive={viewMode === 'player' && isMyStroke}
            onDraftChange={(points) => setDraft({ turn: strokeTurn, points })}
            highlightId={phase === 'reveal' && result ? result.fake_id : null}
          />
          {/* Paleta: quem é qual cor */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25, justifyContent: 'center' }}>
            {players.map((player) => (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6,
                  px: 1,
                  py: 0.35,
                  borderRadius: 'var(--radius-full)',
                  background: player.id === currentDrawerId ? `${colors[String(player.id)] ?? '#fff'}33` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${player.id === currentDrawerId ? (colors[String(player.id)] ?? '#fff') : 'rgba(255,255,255,0.06)'}`,
                  fontSize: { xs: '0.75rem', md: isTv ? '1rem' : '0.8rem' },
                  color: 'var(--text-primary)',
                }}
              >
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: colors[String(player.id)] ?? '#fff' }} />
                {playerLabel(player)}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Revelação */}
          {phase === 'reveal' && result && (
            <GameCard key={`result-${round}`} accent={result.outcome === 'artists_won' ? ACCENT.main : 'var(--accent-red)'} highlight>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.4rem', md: isTv ? '2.2rem' : '1.7rem' }, letterSpacing: '0.06em', color: result.outcome === 'artists_won' ? ACCENT.main : 'var(--accent-red)', textAlign: 'center' }}>
                {OUTCOME_TEXT[result.outcome].title}
              </Typography>
              <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', mb: 1.5 }}>{OUTCOME_TEXT[result.outcome].subtitle}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, textAlign: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>O FALSO ERA</Typography>
                  <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: colors[String(result.fake_id)] ?? 'var(--accent-red)' }}>{nameOf(result.fake_id)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>A PALAVRA</Typography>
                  <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent-gold)' }}>{result.word.toUpperCase()}</Typography>
                </Box>
              </Box>
              {result.guess && (
                <Typography sx={{ textAlign: 'center', mt: 1, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Chute do falso: “{result.guess}”
                </Typography>
              )}
            </GameCard>
          )}

          {/* Acusado */}
          {phase === 'guess' && accusedId !== null && (
            <GameCard accent="var(--accent-red)" highlight>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.3rem', md: '1.8rem' }, textAlign: 'center', color: 'var(--accent-red)', letterSpacing: '0.06em' }}>
                {nameOf(accusedId).toUpperCase()} FOI O MAIS VOTADO
              </Typography>
              <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Era o falso mesmo. Se chutar a palavra certa, ainda vence a rodada.
              </Typography>
            </GameCard>
          )}

          <GameCard title="Artistas" accent={ACCENT.main} index={1}>
            <PlayerRoster
              players={players}
              currentUserId={me?.user?.id}
              accent={ACCENT.main}
              describe={(player) => ({
                highlight: player.id === currentDrawerId && phase === 'draw',
                ready: phase === 'vote' ? votedIds.includes(player.id) : winnerIds.includes(player.id),
                status:
                  phase === 'draw' && player.id === currentDrawerId
                    ? '✎ Desenhando'
                    : phase === 'vote'
                      ? votedIds.includes(player.id)
                        ? '✓ Votou'
                        : 'Decidindo...'
                      : phase === 'reveal' && result
                        ? `${result.tally[String(player.id)] ?? 0} voto${(result.tally[String(player.id)] ?? 0) === 1 ? '' : 's'}`
                        : winnerIds.includes(player.id)
                          ? '🏆 Venceu'
                          : '',
                trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent="var(--accent-gold)" />,
              })}
            />
          </GameCard>
        </Box>
      </Box>

      {/* Controle: desenhar */}
      {viewMode === 'player' && phase === 'draw' && (
        <ActionPanel
          title={isMyStroke ? 'Um traço só. Sem tirar o dedo.' : `Vez de ${nameOf(currentDrawerId)}`}
          hint={isMyStroke ? 'Desenhe na tela acima. Se errar, é só desenhar de novo antes de enviar.' : 'Observe o traço e pense em quem está fingindo.'}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : !isMyStroke ? `Aguardando ${nameOf(currentDrawerId)} desenhar.` : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1 }}>
            <Button variant="contained" color="primary" disabled={submitting || draftPoints.length < 2} onClick={sendStroke} sx={{ py: 1.6 }}>
              ✎ Enviar traço
            </Button>
            <Button variant="outlined" disabled={submitting || draftPoints.length === 0} onClick={() => setDraft({ turn: -1, points: [] })}>
              Apagar
            </Button>
          </Box>
        </ActionPanel>
      )}

      {/* Controle: votar */}
      {viewMode === 'player' && phase === 'vote' && (
        <ActionPanel
          title={myVote !== null ? `Você votou em ${nameOf(myVote)}` : 'Quem é o artista falso?'}
          hint={myVote !== null ? 'Pode trocar até o tempo acabar.' : 'Olhe os traços vagos demais. Ou ousados demais.'}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
            {players
              .filter((player) => !me || player.id !== me.id)
              .map((player) => (
                <Button
                  key={player.id}
                  variant={myVote === player.id ? 'contained' : 'outlined'}
                  color={myVote === player.id ? 'error' : 'inherit'}
                  disabled={submitting}
                  onClick={() => act(() => artistaVote(code, player.id), 'Não foi possível votar.')}
                  sx={{ textTransform: 'none', justifyContent: 'flex-start', gap: 1, py: 1.3, borderColor: 'rgba(255,255,255,0.15)' }}
                >
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', background: colors[String(player.id)] ?? '#fff', flexShrink: 0 }} />
                  {playerLabel(player)}
                </Button>
              ))}
          </Box>
        </ActionPanel>
      )}

      {/* Controle: chutar */}
      {viewMode === 'player' && phase === 'guess' && (
        <ActionPanel
          title={me && accusedId === me.id ? 'Você foi pego. Qual era a palavra?' : `${nameOf(accusedId)} está chutando`}
          hint={me && accusedId === me.id ? 'Acerte e a rodada é sua mesmo assim.' : 'Torça para o chute vir errado.'}
          accent="var(--accent-red)"
          lockedReason={!isLive ? 'A partida não está em andamento.' : !(me && accusedId === me.id) ? 'Só o acusado chuta.' : undefined}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={guessDraft}
              onChange={(event) => setGuessDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && guessDraft.trim()) act(() => artistaGuess(code, guessDraft.trim()), 'Não foi possível chutar.')
              }}
              placeholder={`Algo da categoria ${category}`}
              autoFocus
            />
            <Button
              variant="contained"
              color="error"
              disabled={submitting || !guessDraft.trim()}
              onClick={() => act(() => artistaGuess(code, guessDraft.trim()), 'Não foi possível chutar.')}
              sx={{ px: 3 }}
            >
              Chutar
            </Button>
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length > 1 ? 'EMPATE NO ATELIÊ' : 'MELHOR ARTISTA DA NOITE'}
        subtitle={
          winnerIds.length
            ? `${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => scores[String(id)] ?? 0))} pontos.`
            : 'Fim de jogo.'
        }
      />
    </GameShell>
  )
}
