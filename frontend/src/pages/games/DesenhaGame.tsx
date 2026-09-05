import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { desenhaChoose, desenhaClear, desenhaGuess, desenhaStroke, tickDesenha } from '../../lib/api'
import type { DrawStroke } from '../../lib/api'
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
import DrawingBoard from '../../games/ui/DrawingBoard'
import { haptic, namesFor, playerColor, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('desenha-e-adivinha')
const PHASE_SECONDS: Record<string, number> = { choose: 15, draw: 75, reveal: 7 }
const PALETTE = ['#111111', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#f97316', '#ffffff']
const WIDTHS = [4, 8, 16]

type Guess = { player_id: number; text: string | null; correct: boolean }
type LastResult = { word: string; drawer_id: number; solved: Record<string, number>; reason: string }

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : `${Date.now()}`
}

export default function DesenhaGame() {
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
  } = useGameRoom({ tick: tickDesenha, pollMs: 1000 })

  const [submitting, setSubmitting] = useState(false)
  const [color, setColor] = useState(PALETTE[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const [draft, setDraft] = useState<number[][]>([])
  const [pending, setPending] = useState<DrawStroke[]>([])
  const [guessDraft, setGuessDraft] = useState('')

  const phase = typeof state.phase === 'string' ? state.phase : 'choose'
  const turn = typeof state.turn === 'number' ? state.turn : 0
  const totalTurns = typeof state.total_turns === 'number' ? state.total_turns : players.length * 2
  const drawerId = typeof state.drawer_id === 'number' ? state.drawer_id : null
  const serverStrokes = (Array.isArray(state.strokes) ? state.strokes : []) as DrawStroke[]
  const guesses = (Array.isArray(state.guesses) ? state.guesses : []) as Guess[]
  const solved = asRecord<number>(state.solved)
  const scores = asRecord<number>(state.scores)
  const mask = (Array.isArray(state.mask) ? state.mask : []) as string[]
  const lastResult = (state.last_result ?? null) as LastResult | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const myWord = typeof meState.word === 'string' ? meState.word : null
  const myOptions = (Array.isArray(meState.options) ? meState.options : []) as string[]
  const isDrawer = Boolean(me && drawerId === me.id)
  const canDraw = isDrawer && phase === 'draw' && isLive && viewMode === 'player'
  const iSolved = Boolean(me && solved[String(me.id)] !== undefined)
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }

  // Traços meus que o servidor ainda não devolveu continuam na tela.
  const serverIds = new Set(serverStrokes.map((stroke) => stroke.id))
  const strokes = [...serverStrokes, ...pending.filter((stroke) => !serverIds.has(stroke.id))]

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

  // Cada traço vai sozinho, sem esperar: desenhar não pode travar no "submitting".
  const sendStroke = (points: number[][]) => {
    if (!code || points.length === 0) return
    const stroke: DrawStroke = { id: newId(), points, color, width }
    setPending((current) => [...current, stroke])
    setDraft([])
    desenhaStroke(code, stroke)
      .then(() => refresh())
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível enviar o traço.'))
  }

  const sendGuess = () => {
    const text = guessDraft.trim()
    if (!text) return
    act(async () => {
      await desenhaGuess(code, text)
      setGuessDraft('')
    }, 'Não foi possível chutar.')
  }

  const phaseLabel = phase === 'choose' ? 'Escolhendo' : phase === 'draw' ? 'Para desenhar' : phase === 'reveal' ? 'Próximo' : 'Fim'

  return (
    <GameShell
      title="DESENHA E ADIVINHA"
      tagline="Um desenha no celular. O desenho aparece na TV. A mesa grita palpites."
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
            totalSeconds={PHASE_SECONDS[phase] ?? 75}
            accent={ACCENT.main}
            size={isTv ? 190 : 130}
            frozen={phase === 'ended'}
            label={phaseLabel}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Desenho" value={`${Math.min(turn + 1, totalTurns)}/${totalTurns}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill label="Desenhando" value={phase === 'ended' ? 'Fim' : nameOf(drawerId)} accent={isDrawer ? 'var(--status-ready)' : ACCENT.light} filled={isDrawer} size={isTv ? 'lg' : 'md'} />
            {phase === 'draw' && (
              <StatPill label="Acertaram" value={`${Object.keys(solved).length}/${Math.max(0, players.length - 1)}`} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            )}
          </Box>
        </Box>
      }
    >
      {/* A palavra (mascarada para a mesa, inteira para quem desenha) */}
      {(phase === 'draw' || phase === 'reveal') && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 0.4, md: 0.7 }, flexWrap: 'wrap', mb: 2 }}>
          {(phase === 'reveal' && lastResult ? lastResult.word.split('') : isDrawer && myWord ? myWord.split('') : mask).map((ch, index) => {
            const isSpace = ch === ' '
            const isHidden = ch === '_'
            return (
              <Box
                key={index}
                className={phase === 'reveal' ? 'animate-pop-in' : undefined}
                sx={{
                  width: isSpace ? 14 : { xs: 26, md: isTv ? 54 : 34 },
                  height: { xs: 36, md: isTv ? 70 : 46 },
                  borderBottom: isSpace ? 'none' : `3px solid ${phase === 'reveal' ? 'var(--accent-gold)' : isHidden ? 'rgba(255,255,255,0.3)' : ACCENT.main}`,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: { xs: '1.3rem', md: isTv ? '2.8rem' : '1.8rem' },
                  color: phase === 'reveal' ? 'var(--accent-gold)' : isDrawer ? 'var(--status-ready)' : ACCENT.main,
                  textTransform: 'uppercase',
                }}
              >
                {isHidden ? '' : ch}
              </Box>
            )
          })}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTv ? 'minmax(0, 2fr) minmax(280px, 0.8fr)' : '1.6fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box>
          {/* Quem desenha escolhe a palavra */}
          {phase === 'choose' && (
            <GameCard accent={ACCENT.main} highlight sx={{ mb: 2 }}>
              <Typography sx={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: { xs: '1.4rem', md: isTv ? '2.4rem' : '1.8rem' }, letterSpacing: '0.06em', color: ACCENT.main }}>
                {isDrawer ? 'ESCOLHA O QUE DESENHAR' : `${nameOf(drawerId).toUpperCase()} ESTÁ ESCOLHENDO`}
              </Typography>
              {isDrawer && viewMode === 'player' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1, mt: 2 }}>
                  {myOptions.map((option, index) => (
                    <Button key={option} variant="outlined" disabled={submitting} onClick={() => act(() => desenhaChoose(code, index), 'Não foi possível escolher.')} sx={{ py: 1.6, textTransform: 'none', fontSize: '1.05rem', borderColor: `${ACCENT.main}66` }}>
                      {option}
                    </Button>
                  ))}
                </Box>
              )}
            </GameCard>
          )}

          <DrawingBoard
            strokes={strokes}
            draft={draft}
            draftColor={color}
            draftWidth={width}
            interactive={canDraw}
            accent={ACCENT.main}
            onDraftChange={setDraft}
            onStrokeEnd={sendStroke}
          />

          {/* Ferramentas de quem desenha */}
          {canDraw && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, flexWrap: 'wrap', justifyContent: 'center' }}>
              {PALETTE.map((swatch) => (
                <Box
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: swatch,
                    border: `3px solid ${color === swatch ? ACCENT.main : 'rgba(255,255,255,0.2)'}`,
                    cursor: 'pointer',
                    transform: color === swatch ? 'scale(1.15)' : 'none',
                    transition: 'transform 160ms ease',
                  }}
                />
              ))}
              <Box sx={{ width: 1, height: 26, background: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
              {WIDTHS.map((option) => (
                <Box
                  key={option}
                  onClick={() => setWidth(option)}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    border: `2px solid ${width === option ? ACCENT.main : 'rgba(255,255,255,0.2)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <Box sx={{ width: option + 2, height: option + 2, borderRadius: '50%', background: '#fff' }} />
                </Box>
              ))}
              <Button size="small" variant="outlined" color="error" disabled={submitting} onClick={() => act(async () => { await desenhaClear(code); setPending([]) }, 'Não foi possível apagar.')} sx={{ ml: 0.5, textTransform: 'none' }}>
                Apagar tudo
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Revelação */}
          {phase === 'reveal' && lastResult && (
            <GameCard key={`result-${turn}`} accent="var(--accent-gold)" highlight>
              <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--accent-gold)', textAlign: 'center' }}>ERA</Typography>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.8rem', md: '2.4rem' }, textAlign: 'center', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>
                {lastResult.word}
              </Typography>
              <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', mt: 0.5 }}>
                {Object.keys(lastResult.solved).length
                  ? `Acertaram: ${namesFor(Object.keys(lastResult.solved).map(Number), players)}`
                  : lastResult.reason === 'timeout'
                    ? 'Ninguém acertou. O tempo acabou.'
                    : 'Ninguém acertou.'}
              </Typography>
            </GameCard>
          )}

          {/* Palpites da mesa */}
          <GameCard title="Palpites" hint={phase === 'draw' ? 'Acertos aparecem sem a palavra' : undefined} accent={ACCENT.main} index={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 80 }}>
              {guesses.length === 0 && (
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ninguém chutou ainda.</Typography>
              )}
              {guesses.slice(-8).reverse().map((entry, index) => (
                <Box
                  key={`${entry.player_id}-${index}`}
                  className={index === 0 ? 'animate-pop-in' : undefined}
                  sx={{
                    display: 'flex',
                    gap: 0.75,
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    borderRadius: 'var(--radius-md)',
                    background: entry.correct ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    fontSize: { xs: '0.85rem', md: isTv ? '1.1rem' : '0.9rem' },
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: playerColor(entry.player_id), flexShrink: 0 }} />
                  <Box component="span" sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>{nameOf(entry.player_id)}</Box>
                  <Box component="span" sx={{ color: entry.correct ? 'var(--status-ready)' : 'var(--text-secondary)', fontWeight: entry.correct ? 800 : 400 }}>
                    {entry.correct ? '✓ acertou!' : entry.text}
                  </Box>
                </Box>
              ))}
            </Box>
          </GameCard>

          <GameCard title="Placar" accent={ACCENT.main} index={2}>
            <PlayerRoster
              players={players}
              currentUserId={me?.user?.id}
              accent={ACCENT.main}
              describe={(player) => ({
                highlight: player.id === drawerId && phase !== 'ended',
                ready: solved[String(player.id)] !== undefined,
                status:
                  player.id === drawerId && phase !== 'ended'
                    ? '✏️ Desenhando'
                    : solved[String(player.id)] !== undefined
                      ? `✓ +${solved[String(player.id)]}`
                      : winnerIds.includes(player.id)
                        ? '🏆 Venceu'
                        : '',
                trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent="var(--accent-gold)" />,
              })}
            />
          </GameCard>
        </Box>
      </Box>

      {/* Palpite */}
      {viewMode === 'player' && !isDrawer && phase === 'draw' && (
        <ActionPanel
          title={iSolved ? 'Você acertou!' : 'O que é isso?'}
          hint={iSolved ? 'Agora é só assistir os outros sofrerem.' : `${mask.filter((ch) => ch !== ' ').length} letras. Quanto mais rápido, mais pontos.`}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : iSolved ? 'Palpite certo registrado.' : undefined}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={guessDraft}
              onChange={(event) => setGuessDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendGuess()
              }}
              placeholder="Seu palpite"
              autoComplete="off"
            />
            <Button variant="contained" color="primary" disabled={submitting || !guessDraft.trim()} onClick={sendGuess} sx={{ px: 3 }}>
              Chutar
            </Button>
          </Box>
        </ActionPanel>
      )}

      {viewMode === 'player' && isDrawer && phase === 'draw' && (
        <ActionPanel
          title={`Desenhe: ${myWord ?? '...'}`}
          hint="Sem letras, sem números. Cada traço vai para a TV assim que você levanta o dedo."
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            {Object.keys(solved).length} de {Math.max(0, players.length - 1)} já acertaram.
          </Typography>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length > 1 ? 'EMPATE NO ATELIÊ' : 'ARTISTA DA NOITE'}
        subtitle={winnerIds.length ? `${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => scores[String(id)] ?? 0))} pontos.` : 'Fim de jogo.'}
      />
    </GameShell>
  )
}
