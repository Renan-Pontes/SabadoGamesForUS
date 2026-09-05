import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { palpiteAnswer, palpiteBet, tickPalpite } from '../../lib/api'
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
import { haptic, namesFor, playerColor, playerInitials, playerLabel, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('palpite-certo')
const PHASE_SECONDS: Record<string, number> = { answer: 45, bet: 45, reveal: 14 }
const CHIPS = 2

type Slot = { key: string; value: number | null; odds: number; authors: number[] }
type LastResult = {
  round: number
  question: string
  unit: string
  answer_value: number
  correct_index: number
  payouts: Record<string, number>
  slots: Slot[]
  bets: Record<string, number[]>
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat('pt-BR').format(value)
}

type MatProps = {
  slots: Slot[]
  players: Player[]
  correctIndex: number | null
  /** Fichas já cravadas (só na revelação) — jogador → casas. */
  bets: Record<string, number[]>
  /** Fichas que EU estou escolhendo agora. */
  picks: number[]
  onPick?: (index: number) => void
  big?: boolean
}

/** A mesa de apostas: uma casa por palpite, em ordem crescente, com a cota. */
function BettingMat({ slots, players, correctIndex, bets, picks, onPick, big = false }: MatProps) {
  const nameOf = (id: number) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '?'
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(auto-fill, minmax(104px, 1fr))',
          md: `repeat(${Math.max(1, slots.length)}, minmax(0, 1fr))`,
        },
        gap: { xs: 0.6, md: 1 },
      }}
    >
      {slots.map((slot, index) => {
        const isCorrect = correctIndex === index
        const myPicks = picks.filter((pick) => pick === index).length
        const chips = Object.entries(bets).flatMap(([pid, list]) =>
          list.filter((chip) => chip === index).map((_, chipIndex) => ({ pid: Number(pid), chipIndex })),
        )
        const isLower = slot.value === null
        return (
          <Box
            key={slot.key}
            onClick={onPick ? () => onPick(index) : undefined}
            role={onPick ? 'button' : undefined}
            sx={{
              cursor: onPick ? 'pointer' : 'default',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${
                isCorrect ? 'var(--accent-gold)' : myPicks ? ACCENT.main : 'rgba(255,255,255,0.1)'
              }`,
              background: isCorrect
                ? 'rgba(212,165,32,0.18)'
                : myPicks
                  ? `${ACCENT.main}22`
                  : 'rgba(255,255,255,0.03)',
              boxShadow: isCorrect ? '0 0 30px var(--accent-gold-glow)' : myPicks ? `0 0 18px ${ACCENT.glow}` : 'none',
              p: { xs: 0.75, md: 1.25 },
              minHeight: big ? 170 : 118,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              textAlign: 'center',
              transition: 'all 260ms ease',
              '&:hover': onPick ? { borderColor: ACCENT.main } : undefined,
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-mono)',
                fontSize: { xs: '0.65rem', md: big ? '0.9rem' : '0.7rem' },
                color: isCorrect ? 'var(--accent-gold)' : 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              PAGA {slot.odds}:1
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: isLower
                  ? { xs: '0.7rem', md: big ? '1rem' : '0.75rem' }
                  : { xs: '1.3rem', md: big ? '2.2rem' : '1.5rem' },
                lineHeight: 1.1,
                color: isCorrect ? 'var(--accent-gold)' : 'var(--text-primary)',
                flex: 1,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {isLower ? 'TODOS PASSARAM' : formatNumber(slot.value)}
            </Typography>
            {slot.authors.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.3 }}>
                {slot.authors.map((pid) => (
                  <Box
                    key={pid}
                    title={`Palpite de ${nameOf(pid)}`}
                    sx={{
                      px: 0.6,
                      borderRadius: 'var(--radius-full)',
                      fontSize: { xs: '0.55rem', md: big ? '0.75rem' : '0.6rem' },
                      fontWeight: 800,
                      color: '#0a0a0f',
                      background: playerColor(pid),
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nameOf(pid)}
                  </Box>
                ))}
              </Box>
            )}
            {(chips.length > 0 || myPicks > 0) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.3, mt: 0.25 }}>
                {chips.map(({ pid, chipIndex }) => {
                  const player = players.find((candidate) => candidate.id === pid)
                  return (
                    <Box
                      key={`${pid}-${chipIndex}`}
                      title={nameOf(pid)}
                      className="animate-pop-in"
                      sx={{
                        width: big ? 22 : 16,
                        height: big ? 22 : 16,
                        borderRadius: '50%',
                        background: playerColor(pid),
                        border: '2px solid rgba(0,0,0,0.5)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: big ? '0.6rem' : '0.45rem',
                        fontWeight: 900,
                        color: '#0a0a0f',
                      }}
                    >
                      {player ? playerInitials(player).charAt(0) : '?'}
                    </Box>
                  )
                })}
                {Array.from({ length: myPicks }, (_, chipIndex) => (
                  <Box
                    key={`mine-${chipIndex}`}
                    className="animate-pop-in"
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: ACCENT.main,
                      border: '2px solid #fff',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export default function PalpiteCertoGame() {
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
  } = useGameRoom({ tick: tickPalpite, pollMs: 1500 })

  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<{ round: number; value: string }>({ round: 0, value: '' })
  const [picked, setPicked] = useState<{ round: number; picks: number[] }>({ round: 0, picks: [] })

  const phase = typeof state.phase === 'string' ? state.phase : 'answer'
  const round = typeof state.round === 'number' ? state.round : 1
  const rounds = typeof state.rounds === 'number' ? state.rounds : 7
  const question = typeof state.question === 'string' ? state.question : ''
  const unit = typeof state.unit === 'string' ? state.unit : ''
  const answerValue = typeof state.answer_value === 'number' ? state.answer_value : null
  const slots = (Array.isArray(state.slots) ? state.slots : []) as Slot[]
  const correctIndex = typeof state.correct_index === 'number' ? state.correct_index : null
  const scores = asRecord<number>(state.scores)
  const answeredIds = readNumberArray(state, 'answered_ids')
  const betIds = readNumberArray(state, 'bet_ids')
  const revealBets = phase === 'reveal' || phase === 'ended' ? asRecord<number[]>(state.bets) : {}
  const lastResult = (state.last_result ?? null) as LastResult | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const myAnswer = typeof meState.answer === 'number' ? meState.answer : null
  const myBets = (Array.isArray(meState.bets) ? meState.bets : []) as number[]
  const myPoints = typeof meState.points === 'number' ? meState.points : 0

  const draftValue = draft.round === round ? draft.value : ''
  const picks = picked.round === round ? picked.picks : []

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
    const value = Number(draftValue.replace(',', '.'))
    if (!Number.isFinite(value)) {
      setError('Digite um número.')
      return
    }
    act(() => palpiteAnswer(code, value), 'Não foi possível enviar o palpite.')
  }

  const pickSlot = (index: number) => {
    haptic(8)
    setPicked({ round, picks: picks.length >= CHIPS ? [index] : [...picks, index] })
  }

  const sendBets = () => {
    if (picks.length === 0) return
    act(() => palpiteBet(code, picks), 'Não foi possível apostar.')
  }

  const phaseLabel =
    phase === 'answer'
      ? 'Chutem um número'
      : phase === 'bet'
        ? 'Apostem nos palpites'
        : phase === 'reveal'
          ? 'A resposta'
          : 'Fim'

  const showMat = phase === 'bet' || phase === 'reveal'
  const matSlots = phase === 'reveal' && lastResult ? lastResult.slots : slots
  const matCorrect = phase === 'reveal' ? (lastResult?.correct_index ?? correctIndex) : null

  return (
    <GameShell
      title="PALPITE CERTO"
      tagline="Ninguém sabe a resposta. Todo mundo chuta, e depois a mesa aposta em quem parece saber."
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
            totalSeconds={PHASE_SECONDS[phase] ?? 45}
            accent={ACCENT.main}
            size={isTv ? 200 : 140}
            frozen={phase === 'ended'}
            label={phaseLabel}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Pergunta" value={`${Math.min(round, rounds)}/${rounds}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            {phase === 'answer' && (
              <StatPill label="Palpites" value={`${answeredIds.length}/${players.length}`} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            )}
            {phase === 'bet' && (
              <StatPill label="Apostaram" value={`${betIds.length}/${players.length}`} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            )}
            {!isTv && <StatPill label="Seus pontos" value={myPoints} accent="var(--accent-gold)" filled size="md" />}
          </Box>
        </Box>
      }
    >
      {/* A pergunta */}
      <GameCard accent={ACCENT.main} highlight sx={{ mb: 2 }} key={`q-${round}`}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            color: ACCENT.main,
            fontWeight: 800,
            textAlign: 'center',
            mb: 1,
          }}
        >
          PERGUNTA {round} · RESPOSTA EM {unit.toUpperCase()}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '1.5rem', md: isTv ? '3rem' : '2rem' },
            lineHeight: 1.15,
            textAlign: 'center',
            color: 'var(--text-primary)',
          }}
        >
          {question}
        </Typography>
        {phase === 'reveal' && answerValue !== null && (
          <Typography
            className="animate-pop-in"
            sx={{
              mt: 2,
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: { xs: '2.4rem', md: isTv ? '4.5rem' : '3rem' },
              color: 'var(--accent-gold)',
              textShadow: '0 0 30px var(--accent-gold-glow)',
              lineHeight: 1,
            }}
          >
            {formatNumber(answerValue)} <Box component="span" sx={{ fontSize: '0.4em', color: 'var(--text-secondary)' }}>{unit}</Box>
          </Typography>
        )}
      </GameCard>

      {/* A mesa de apostas */}
      {showMat && (
        <GameCard
          title={phase === 'bet' ? 'A mesa' : 'Resultado'}
          hint={
            phase === 'bet'
              ? 'Vence o maior palpite que NÃO passa da resposta. Longe do meio paga mais.'
              : 'A casa dourada venceu. Quem deu o palpite ainda leva bônus.'
          }
          accent={ACCENT.main}
          highlight
          sx={{ mb: 2 }}
        >
          <BettingMat
            slots={matSlots}
            players={players}
            correctIndex={matCorrect}
            bets={phase === 'reveal' && lastResult ? lastResult.bets : revealBets}
            picks={viewMode === 'player' && phase === 'bet' ? picks : []}
            onPick={viewMode === 'player' && phase === 'bet' ? pickSlot : undefined}
            big={isTv}
          />
          {phase === 'reveal' && lastResult && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
              {players.map((player) => {
                const delta = lastResult.payouts[String(player.id)] ?? 0
                return (
                  <Box
                    key={player.id}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 'var(--radius-full)',
                      fontSize: { xs: '0.8rem', md: isTv ? '1.05rem' : '0.85rem' },
                      fontWeight: 700,
                      background: delta > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      color: delta > 0 ? 'var(--status-ready)' : 'var(--text-muted)',
                    }}
                  >
                    {playerLabel(player)} {delta > 0 ? `+${delta}` : '0'}
                  </Box>
                )
              })}
            </Box>
          )}
        </GameCard>
      )}

      <GameCard title="Apostadores" accent={ACCENT.main} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const done = phase === 'answer' ? answeredIds.includes(player.id) : phase === 'bet' ? betIds.includes(player.id) : false
            return {
              ready: done,
              highlight: winnerIds.includes(player.id),
              status:
                phase === 'answer'
                  ? done
                    ? '✓ Chutou'
                    : 'Pensando...'
                  : phase === 'bet'
                    ? done
                      ? '✓ Apostou'
                      : 'Escolhendo...'
                    : winnerIds.includes(player.id)
                      ? '🏆 Campeão'
                      : '',
              trailing: <StatPill label="Pontos" value={scores[String(player.id)] ?? 0} size="sm" accent="var(--accent-gold)" />,
            }
          }}
        />
      </GameCard>

      {/* Controle */}
      {viewMode === 'player' && phase === 'answer' && (
        <ActionPanel
          title={myAnswer === null ? 'Seu palpite' : `Palpite enviado: ${formatNumber(myAnswer)}`}
          hint={myAnswer === null ? 'Não precisa saber. Chute com convicção.' : 'Pode trocar até o tempo acabar.'}
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              value={draftValue}
              onChange={(event) => setDraft({ round, value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendAnswer()
              }}
              placeholder={unit ? `Número em ${unit}` : 'Número'}
              slotProps={{ htmlInput: { inputMode: 'decimal', style: { fontSize: '1.4rem', fontFamily: 'var(--font-display)' } } }}
            />
            <Button variant="contained" color="primary" disabled={submitting || !draftValue} onClick={sendAnswer} sx={{ px: 3 }}>
              Enviar
            </Button>
          </Box>
        </ActionPanel>
      )}

      {viewMode === 'player' && phase === 'bet' && (
        <ActionPanel
          title={myBets.length ? 'Apostas na mesa' : `Toque nas casas: ${picks.length}/${CHIPS} fichas`}
          hint={
            myBets.length
              ? `Você apostou em ${myBets.map((chip) => (matSlots[chip]?.value === null ? 'todos passaram' : formatNumber(matSlots[chip]?.value))).join(' e ')}. Pode trocar até o tempo acabar.`
              : 'As duas fichas podem ir na mesma casa. Casa mais longe do meio paga mais.'
          }
          accent={ACCENT.main}
          lockedReason={!isLive ? 'A partida não está em andamento.' : undefined}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1 }}>
            <Button variant="contained" color="primary" disabled={submitting || picks.length === 0} onClick={sendBets} sx={{ py: 1.6 }}>
              Confirmar {picks.length}/{CHIPS} fichas
            </Button>
            <Button variant="outlined" disabled={submitting || picks.length === 0} onClick={() => setPicked({ round, picks: [] })}>
              Limpar
            </Button>
          </Box>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length > 1 ? 'EMPATE NA MESA' : 'A MESA TEM UM CAMPEÃO'}
        subtitle={
          winnerIds.length
            ? `${namesFor(winnerIds, players)} com ${Math.max(...winnerIds.map((id) => scores[String(id)] ?? 0))} pontos.`
            : 'Fim de jogo.'
        }
      />
    </GameShell>
  )
}
