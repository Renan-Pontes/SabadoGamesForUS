import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { caveiraBid, caveiraFlip, caveiraPass, caveiraPlace } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  GameCard,
  GameShell,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import { haptic, playerColor, playerLabel } from '../../games/utils'

const ACCENT = getAccent('caveira')
const WINS_NEEDED = 2

type Flip = {
  player_id: number
  target: number
  revealed: { player_id: number; card: 'rosa' | 'caveira' }[]
  own_done: boolean
}

export default function CaveiraGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state,
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
  } = useGameRoom({ pollMs: 2000 })

  const [bidDraft, setBidDraft] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'placing'
  const order = (state.order ?? []) as number[]
  const turnIndex = typeof state.turn_index === 'number' ? state.turn_index : 0
  const eliminated = (state.eliminated ?? []) as number[]
  const stackSizes = (state.stack_sizes ?? {}) as Record<string, number>
  const handSizes = (state.hand_sizes ?? {}) as Record<string, number>
  const wins = (state.wins ?? {}) as Record<string, number>
  const highestBid = typeof state.highest_bid === 'number' ? state.highest_bid : 0
  const highestBidderId =
    typeof state.highest_bidder_id === 'number' ? state.highest_bidder_id : null
  const passed = (state.passed ?? []) as number[]
  const flip = (state.flip ?? null) as Flip | null
  const winnerId = typeof state.winner_id === 'number' ? state.winner_id : null

  const active = order.filter((id) => !eliminated.includes(id))
  const currentId = active.length ? active[turnIndex % active.length] : null
  const seated = order
    .map((id) => players.find((player) => player.id === id))
    .filter((p): p is Player => Boolean(p))
  const currentPlayer = seated.find((player) => player.id === currentId) ?? null
  const winner = seated.find((player) => player.id === winnerId) ?? null

  const isMyTurn = Boolean(me && currentId === me.id)
  const myHand = (meState.hand ?? []) as ('rosa' | 'caveira')[]
  const myStack = (meState.stack ?? []) as string[]
  const iAmFlipper = Boolean(me && flip?.player_id === me.id)
  const totalOnTable = Object.values(stackSizes).reduce((sum, value) => sum + value, 0)

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

  /** Alvos ainda com carta por virar na aposta em curso. */
  const flipTargets = seated.filter((player) => {
    if (!flip || player.id === flip.player_id) return false
    const stack = stackSizes[String(player.id)] ?? 0
    const already = flip.revealed.filter((entry) => entry.player_id === player.id).length
    return already < stack
  })

  const phaseLabel =
    phase === 'placing'
      ? 'EMPILHANDO'
      : phase === 'bidding'
        ? 'LEILÃO'
        : phase === 'flipping'
          ? 'VIRANDO'
          : 'FIM'

  return (
    <GameShell
      title="CAVEIRA"
      tagline="Três rosas e uma caveira. Aposte quantas cartas consegue virar sem se estragar."
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
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill label="Fase" value={phaseLabel} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Na vez"
            value={currentPlayer ? playerLabel(currentPlayer) : '—'}
            accent={ACCENT.light}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Na mesa" value={totalOnTable} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          {highestBid > 0 && (
            <StatPill
              label="Maior lance"
              value={highestBid}
              accent="var(--accent-gold)"
              filled
              size={isTv ? 'lg' : 'md'}
            />
          )}
        </Box>
      }
    >
      {/* As pilhas */}
      <GameCard
        title="A MESA"
        hint={flip ? `virando ${flip.revealed.length}/${flip.target}` : 'cartas viradas para baixo'}
        accent={ACCENT.main}
        highlight
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 2, md: 4 },
          }}
        >
          {seated.map((player, index) => {
            const stack = stackSizes[String(player.id)] ?? 0
            const isOut = eliminated.includes(player.id)
            const revealedHere = flip?.revealed.filter((e) => e.player_id === player.id) ?? []
            const color = playerColor(player.id)

            return (
              <Box
                key={player.id}
                className="stagger-in"
                style={{ '--stagger-index': index } as React.CSSProperties}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  opacity: isOut ? 0.3 : 1,
                  filter: isOut ? 'grayscale(1)' : 'none',
                }}
              >
                {/* Pilha: cartas empilhadas com leve deslocamento */}
                <Box sx={{ position: 'relative', width: 58, height: 78 + stack * 5 }}>
                  {Array.from({ length: Math.max(stack, revealedHere.length) }).map((_, cardIndex) => {
                    const revealed = revealedHere[revealedHere.length - 1 - cardIndex]
                    return (
                      <Box
                        key={cardIndex}
                        sx={{
                          position: 'absolute',
                          bottom: cardIndex * 5,
                          left: 0,
                          width: 58,
                          height: 78,
                          borderRadius: 'var(--radius-md)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '1.7rem',
                          border: `2px solid ${revealed ? (revealed.card === 'caveira' ? 'var(--accent-red)' : '#f472b6') : color}`,
                          background: revealed
                            ? revealed.card === 'caveira'
                              ? 'rgba(220,38,38,0.22)'
                              : 'rgba(244,114,182,0.18)'
                            : 'repeating-linear-gradient(45deg, #1a1a24 0 5px, #12121a 5px 10px)',
                          boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                          animation: revealed ? 'flipIn 320ms ease both' : undefined,
                        }}
                      >
                        {revealed ? (revealed.card === 'caveira' ? '☠' : '🌹') : ''}
                      </Box>
                    )
                  })}
                  {stack === 0 && revealedHere.length === 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        width: 58,
                        height: 78,
                        borderRadius: 'var(--radius-md)',
                        border: '2px dashed rgba(255,255,255,0.12)',
                      }}
                    />
                  )}
                </Box>

                <Typography sx={{ fontWeight: 700, fontSize: isTv ? '1rem' : '0.85rem' }}>
                  {me && player.id === me.id ? 'Você' : playerLabel(player)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {Array.from({ length: wins[String(player.id)] ?? 0 }).map((_, i) => (
                    <Box component="span" key={i} sx={{ fontSize: '0.8rem' }}>
                      🏆
                    </Box>
                  ))}
                  <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                    {isOut ? 'FORA' : `${handSizes[String(player.id)] ?? 0} CARTAS`}
                  </Typography>
                </Box>
                {highestBidderId === player.id && (
                  <Typography sx={{ fontSize: '0.62rem', color: 'var(--accent-gold)', fontWeight: 800 }}>
                    APOSTOU {highestBid}
                  </Typography>
                )}
                {passed.includes(player.id) && (
                  <Typography sx={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                    PASSOU
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </GameCard>

      <GameCard title="JOGADORES" hint={`${WINS_NEEDED} apostas cumpridas vencem`} accent={ACCENT.main} sx={{ mt: 2 }} index={1}>
        <PlayerRoster
          players={seated}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            eliminated: eliminated.includes(player.id),
            highlight: player.id === currentId,
            status: eliminated.includes(player.id)
              ? 'Sem cartas'
              : player.id === currentId
                ? 'Jogando agora'
                : passed.includes(player.id)
                  ? 'Passou o lance'
                  : `${stackSizes[String(player.id)] ?? 0} na pilha`,
            trailing: (
              <StatPill
                label="Vitórias"
                value={`${wins[String(player.id)] ?? 0}/${WINS_NEEDED}`}
                size="sm"
                accent={ACCENT.main}
              />
            ),
          })}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            iAmFlipper
              ? `Vire ${flip?.target} carta(s) — ${flip?.revealed.length ?? 0} viradas`
              : phase === 'placing'
                ? 'Empilhe uma carta ou abra o leilão'
                : phase === 'bidding'
                  ? `Cubra ${highestBid} ou passe`
                  : 'Aguarde'
          }
          hint={
            iAmFlipper && !flip?.own_done
              ? 'Comece pela sua própria pilha — é a regra, e é a única que você conhece.'
              : phase === 'placing' && isMyTurn
                ? 'Ninguém vê o que você empilha.'
                : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : me && eliminated.includes(me.id)
                ? 'Você ficou sem cartas.'
                : flip && !iAmFlipper
                  ? `${seated.find((p) => p.id === flip.player_id)?.name ?? 'Alguém'} está virando as cartas.`
                  : !isMyTurn && !iAmFlipper
                    ? `Vez de ${currentPlayer ? playerLabel(currentPlayer) : '—'}.`
                    : undefined
          }
        >
          {/* Empilhar */}
          {phase === 'placing' && isMyTurn && (
            <>
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mb: 2 }}>
                {(['rosa', 'caveira'] as const).map((card) => {
                  const count = myHand.filter((item) => item === card).length
                  return (
                    <Button
                      key={card}
                      disabled={submitting || count === 0}
                      onClick={() => run(() => caveiraPlace(code, card), 'Não foi possível empilhar.')}
                      sx={{
                        flexDirection: 'column',
                        gap: 0.25,
                        py: 2,
                        px: 3,
                        borderRadius: 'var(--radius-lg)',
                        border: `2px solid ${card === 'caveira' ? 'var(--accent-red)' : '#f472b6'}`,
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Box component="span" sx={{ fontSize: '2.2rem', lineHeight: 1 }}>
                        {card === 'caveira' ? '☠' : '🌹'}
                      </Box>
                      <Box component="span" sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 800 }}>
                        {card.toUpperCase()} ({count})
                      </Box>
                    </Button>
                  )
                })}
              </Box>

              {myStack.length > 0 && (
                <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, textAlign: 'center' }}>
                    Ou abra o leilão apostando quantas cartas vira sem achar caveira.
                  </Typography>
                  <BidRow
                    max={totalOnTable}
                    min={1}
                    value={bidDraft}
                    onChange={setBidDraft}
                    disabled={submitting}
                    onSubmit={() => run(() => caveiraBid(code, bidDraft), 'Não foi possível apostar.')}
                    label="Abrir leilão com"
                  />
                </Box>
              )}
            </>
          )}

          {/* Leilão */}
          {phase === 'bidding' && isMyTurn && (
            <>
              <BidRow
                max={totalOnTable}
                min={highestBid + 1}
                value={Math.max(bidDraft, highestBid + 1)}
                onChange={setBidDraft}
                disabled={submitting}
                onSubmit={() =>
                  run(
                    () => caveiraBid(code, Math.max(bidDraft, highestBid + 1)),
                    'Não foi possível cobrir.',
                  )
                }
                label="Cobrir com"
              />
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                disabled={submitting}
                onClick={() => run(() => caveiraPass(code), 'Não foi possível passar.')}
                sx={{ mt: 1.5 }}
              >
                Passar
              </Button>
            </>
          )}

          {/* Virar */}
          {iAmFlipper && (
            <>
              {!flip?.own_done ? (
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  disabled={submitting}
                  onClick={() => run(() => caveiraFlip(code), 'Não foi possível virar.')}
                  sx={{ py: 1.8 }}
                >
                  Virar a minha pilha
                </Button>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {flipTargets.map((player) => (
                    <Button
                      key={player.id}
                      variant="outlined"
                      disabled={submitting}
                      onClick={() =>
                        run(() => caveiraFlip(code, player.id), 'Não foi possível virar.')
                      }
                      sx={{
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        borderColor: playerColor(player.id),
                      }}
                    >
                      Virar a pilha de {playerLabel(player)}
                    </Button>
                  ))}
                  {flipTargets.length === 0 && (
                    <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      Não há mais pilhas para virar.
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </ActionPanel>
      )}

      {/* Sua mão */}
      {!isTv && myHand.length > 0 && (
        <GameCard title="SUA MÃO" hint="só você vê" accent={ACCENT.main} sx={{ mt: 2 }} index={2}>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            {myHand.map((card, index) => (
              <Box
                key={index}
                sx={{
                  width: 56,
                  height: 76,
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '2rem',
                  border: `2px solid ${card === 'caveira' ? 'var(--accent-red)' : '#f472b6'}`,
                  background: 'rgba(255,255,255,0.03)',
                  animation: 'dealIn 420ms ease both',
                  animationDelay: `${index * 70}ms`,
                }}
              >
                {card === 'caveira' ? '☠' : '🌹'}
              </Box>
            ))}
          </Box>
        </GameCard>
      )}

      <ResultOverlay
        open={isEnded && Boolean(winner)}
        tone="win"
        sigil="☠"
        title="APOSTA CUMPRIDA"
        subtitle={winner ? `${playerLabel(winner)} venceu a mesa.` : undefined}
      />
      <ResultOverlay
        open={!isTv && !isEnded && Boolean(me && eliminated.includes(me.id))}
        tone="lose"
        title="SEM CARTAS"
        subtitle="Você perdeu todas as cartas e está fora da mesa."
      />
    </GameShell>
  )
}

/** Seletor de lance: os passos importam mais que o número exato. */
function BidRow({
  min,
  max,
  value,
  onChange,
  onSubmit,
  disabled,
  label,
}: {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  onSubmit: () => void
  disabled: boolean
  label: string
}) {
  const clamped = Math.min(Math.max(value, min), Math.max(min, max))

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        variant="outlined"
        disabled={disabled || clamped <= min}
        onClick={() => onChange(clamped - 1)}
        sx={{ minWidth: 52 }}
      >
        −
      </Button>
      <Typography
        sx={{
          flex: '1 1 60px',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          color: 'var(--accent-gold)',
        }}
      >
        {clamped}
      </Typography>
      <Button
        variant="outlined"
        disabled={disabled || clamped >= max}
        onClick={() => onChange(clamped + 1)}
        sx={{ minWidth: 52 }}
      >
        +
      </Button>
      <Button
        variant="contained"
        color="secondary"
        disabled={disabled || max < min}
        onClick={onSubmit}
        sx={{ flex: '1 1 140px' }}
      >
        {label} {clamped}
      </Button>
    </Box>
  )
}
