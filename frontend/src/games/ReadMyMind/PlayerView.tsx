import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import { useNow, haptic } from '../utils'
import { Confetti } from '../ui'
import { OrnamentLives } from './decor'
import { usePhoneBuzz } from './hooks'
import { GAME_TITLE, TITLE_FONT, XMAS } from './look'
import type { GameState } from './types'
import { cardWord, cardsLeft, finalBreak, mistakeOf, nameOf, sortedHand } from './view'
import XmasCard from './XmasCard'

interface PlayerViewProps {
  roomCode: string
  playerId: string
  gameState: GameState
  onPlayCard: (cardValue: number) => void
  /** `host` mostra o mesmo jogo, mas com a navegação do host. */
  viewMode?: 'player' | 'host'
  onBack?: () => void
  onToggleView?: () => void
  error?: string
}

/** Quanto arrastar para cima (px) para a carta sair voando para a mesa. */
const SWIPE_PX = 70
const HAND_SIZE = '15px'

/**
 * Celular da Mente Natalina: a sua mão. As cartas ficam em leque embaixo,
 * em ordem crescente, com a menor na frente — é a única que faz sentido
 * jogar. Toque nela e confirme, ou arraste para cima para jogar direto.
 */
export default function PlayerView({
  roomCode,
  playerId,
  gameState,
  onPlayCard,
  viewMode = 'player',
  onBack,
  onToggleView,
  error,
}: PlayerViewProps) {
  const now = useNow(500)
  const state = gameState
  usePhoneBuzz(state, playerId)

  const [selected, setSelected] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [flying, setFlying] = useState<{ value: number; id: number } | null>(null)
  const [tip, setTip] = useState<{ text: string; id: number } | null>(null)
  const [drag, setDrag] = useState<{ value: number; startY: number; dy: number } | null>(null)
  /** Contador para as chaves da carta voando e da dica (cada uma reinicia a animação). */
  const seq = useRef(0)

  const me = state.players.find((p) => p.id === playerId)
  const isEliminated = me?.isEliminated ?? false
  const coop = state.mode === 'coop'
  const hand = sortedHand(me?.cards ?? []).filter((value) => value !== pending)
  const lowest = hand[0] ?? null
  const canPlay = state.phase === 'playing' && !isEliminated && lowest !== null
  // A seleção só vale enquanto for a menor carta da mão: some sozinha quando a rodada vira.
  const armed = canPlay && selected !== null && selected === lowest ? selected : null

  function play(value: number) {
    if (!canPlay || value !== lowest) return
    haptic([12, 40, 18])
    seq.current += 1
    setFlying({ value, id: seq.current })
    setPending(value)
    setSelected(null)
    onPlayCard(value)
    // Se o servidor recusar, a carta volta para a mão.
    window.setTimeout(() => setPending((current) => (current === value ? null : current)), 2500)
  }

  function nudge(value: number) {
    haptic(30)
    const text = lowest !== null ? `Calma! O ${lowest} vem antes do ${value} 😉` : ''
    seq.current += 1
    const id = seq.current
    setTip({ text, id })
    window.setTimeout(() => setTip((current) => (current?.id === id ? null : current)), 2200)
  }

  function onCardPointerDown(event: PointerEvent<HTMLDivElement>, value: number) {
    if (!canPlay) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ value, startY: event.clientY, dy: 0 })
  }

  function onCardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return
    setDrag({ ...drag, dy: Math.min(0, event.clientY - drag.startY) })
  }

  function onCardPointerUp(event: PointerEvent<HTMLDivElement>, value: number) {
    if (!drag || drag.value !== value) return
    const dy = event.clientY - drag.startY
    setDrag(null)
    if (value !== lowest) {
      nudge(value)
      return
    }
    if (dy <= -SWIPE_PX) play(value)
    else if (Math.abs(dy) < 12) setSelected(armed === value ? null : value)
  }

  function onCardKey(event: KeyboardEvent<HTMLDivElement>, value: number) {
    if (!canPlay || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    if (value !== lowest) nudge(value)
    else setSelected(armed === value ? null : value)
  }

  const secondsToNextRound = state.nextRoundTs ? Math.max(0, Math.ceil((state.nextRoundTs - now) / 1000)) : null

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(ellipse 120% 50% at 50% 100%, rgba(31, 157, 85, 0.35), transparent 70%), radial-gradient(ellipse 100% 40% at 50% 0%, rgba(245, 194, 66, 0.12), transparent 70%), var(--bg-veil)',
        px: 2,
        pt: 1.5,
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          component="h1"
          noWrap
          sx={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: '1.7rem', lineHeight: 1, color: XMAS.goldLight, textShadow: '0 2px 0 rgba(0,0,0,0.4)' }}
        >
          🎄 {GAME_TITLE}
        </Typography>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: 'var(--text-muted)', fontWeight: 800 }}>
            {viewMode === 'host' ? 'HOST · SALA' : 'SALA'}
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.4rem', letterSpacing: '0.14em', color: 'var(--text-secondary)', lineHeight: 1 }}>
            {roomCode}
          </Typography>
        </Box>
      </Box>

      {/* Nível, vidas, cartas */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.25 }}>
        <Chip>
          {state.phase === 'waiting' ? '🗓️ Nível 1' : `🗓️ Nível ${Math.min(state.round, state.maxRounds)}/${state.maxRounds}`}
        </Chip>
        {coop ? (
          <OrnamentLives lives={state.lives} max={state.maxLives} size={22} label={false} />
        ) : (
          <Chip>⚔️ De pé: {state.players.filter((p) => !p.isEliminated).length}</Chip>
        )}
        <Chip>🃏 Na mão: {me?.cards.length ?? 0}</Chip>
      </Box>

      {error && (
        <Box role="alert" className="animate-shake" sx={{ mt: 1.25, p: 1.25, borderRadius: 2, border: '1px solid rgba(232, 57, 74, 0.5)', background: 'rgba(232, 57, 74, 0.15)' }}>
          <Typography sx={{ color: 'var(--accent-red-light)', fontWeight: 600 }}>{error}</Typography>
        </Box>
      )}

      <TableGlimpse state={state} playerId={playerId} />

      {/* Mensagem do momento */}
      <Box sx={{ textAlign: 'center', mt: 2, px: 1 }} aria-live="polite">
        <Status
          state={state}
          isEliminated={isEliminated}
          lowest={lowest}
          handCount={hand.length}
          playerId={playerId}
          secondsToNextRound={secondsToNextRound}
        />
      </Box>

      {/* A mão, em leque */}
      <Box sx={{ flex: 1, minHeight: 250, position: 'relative', mt: 1 }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 230 }}>
          {hand.map((value, index) => {
            const n = hand.length
            const mid = (n - 1) / 2
            const spread = n <= 1 ? 0 : Math.min(58, 240 / (n - 1))
            const angle = n <= 1 ? 0 : (index - mid) * Math.min(7, 36 / (n - 1))
            const isLowest = index === 0 && canPlay
            const isArmed = armed === value
            const dragging = drag?.value === value ? drag.dy : 0
            const lift = isArmed ? -46 : isLowest ? -20 : 0
            return (
              <Box
                key={value}
                role="button"
                tabIndex={0}
                aria-label={isLowest ? `Sua menor carta, ${value}. Toque para escolher ou arraste para cima para jogar.` : `Carta ${value}`}
                aria-pressed={isArmed}
                onPointerDown={(event) => onCardPointerDown(event, value)}
                onPointerMove={onCardPointerMove}
                onPointerUp={(event) => onCardPointerUp(event, value)}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(event) => onCardKey(event, value)}
                sx={{
                  position: 'absolute',
                  left: `calc(50% + ${(index - mid) * spread}px)`,
                  bottom: 0,
                  zIndex: n - index + (isLowest ? 20 : 0),
                  transformOrigin: 'bottom center',
                  transform: `translateX(-50%) translateY(${lift + dragging + Math.abs(index - mid) ** 2 * 1.4}px) rotate(${dragging ? 0 : angle}deg) scale(${isArmed ? 1.12 : isLowest ? 1.04 : 1})`,
                  transition: drag?.value === value ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                  cursor: canPlay ? 'pointer' : 'default',
                  touchAction: 'none',
                  outline: 'none',
                  borderRadius: '10px',
                  '&:focus-visible': { boxShadow: `0 0 0 4px ${XMAS.ice}` },
                }}
              >
                <XmasCard
                  value={value}
                  size={HAND_SIZE}
                  highlight={isLowest}
                  anim="deal"
                  delay={index * 90}
                  dim={!canPlay && state.phase !== 'playing'}
                />
                {isLowest && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: -30,
                      transform: 'translateX(-50%)',
                      px: 1,
                      borderRadius: '999px',
                      background: XMAS.gold,
                      color: '#1a1204',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      animation: isArmed ? undefined : 'hop 2.4s ease-in-out infinite',
                    }}
                  >
                    {isArmed ? 'pronta!' : '⬆ a sua menor'}
                  </Box>
                )}
              </Box>
            )
          })}

          {flying && (
            <Box
              key={flying.id}
              aria-hidden
              onAnimationEnd={() => setFlying(null)}
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 20,
                zIndex: 60,
                pointerEvents: 'none',
                animation: 'rmmFly 700ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
                '@keyframes rmmFly': {
                  '0%': { transform: 'translateX(-50%) translateY(-40px) scale(1.1)', opacity: 1 },
                  '100%': { transform: 'translateX(-50%) translateY(-110vh) rotate(-25deg) scale(0.5)', opacity: 0 },
                },
              }}
            >
              <XmasCard value={flying.value} size={HAND_SIZE} highlight />
            </Box>
          )}

          {tip && (
            <Box
              key={tip.id}
              role="status"
              className="animate-pop-in"
              sx={{
                position: 'absolute',
                left: '50%',
                top: -40,
                transform: 'translateX(-50%)',
                zIndex: 70,
                px: 2,
                py: 1,
                borderRadius: 3,
                background: 'rgba(6, 16, 31, 0.92)',
                border: `2px solid ${XMAS.gold}`,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {tip.text}
            </Box>
          )}
        </Box>
      </Box>

      {/* Jogar */}
      <Box sx={{ pb: 1.5 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={armed === null}
          onClick={() => armed !== null && play(armed)}
          sx={{
            py: 1.75,
            fontSize: '1.2rem',
            fontWeight: 800,
            borderRadius: '16px',
            backgroundImage: 'none',
            bgcolor: XMAS.red,
            color: '#fff6dc',
            boxShadow: armed !== null ? `0 0 26px rgba(232, 57, 74, 0.6)` : 'none',
            '&:hover': { bgcolor: '#c21f33', backgroundImage: 'none' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' },
          }}
        >
          {armed !== null
            ? `🎄 Jogar o ${armed} na mesa`
            : canPlay
              ? 'Toque na sua menor carta (ou arraste ⬆)'
              : 'Aguarde…'}
        </Button>

        {(onBack || onToggleView) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            {onBack && (
              <Button size="small" color="inherit" startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ color: 'var(--text-secondary)' }}>
                Voltar ao lobby
              </Button>
            )}
            {onToggleView && (
              <Button size="small" color="secondary" startIcon={<SwapHorizRoundedIcon />} onClick={onToggleView}>
                {viewMode === 'host' ? 'Painel do host' : 'Voltar ao host'}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {state.phase === 'gameOver' && (state.winner === 'team' || state.winner === playerId) && <Confetti />}
    </Box>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: '999px',
        border: '1px solid rgba(245, 194, 66, 0.45)',
        background: 'rgba(6, 16, 31, 0.55)',
        fontWeight: 800,
        fontSize: '0.85rem',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  )
}

/** A mesa vista do celular: a carta do topo e quem jogou. */
function TableGlimpse({ state, playerId }: { state: GameState; playerId: string }) {
  if (state.phase !== 'playing') return null
  const played = state.playedCards
  const last = played[played.length - 1]
  const mistake = mistakeOf(state)
  const left = cardsLeft(state)
  const mine = mistake?.hidden.filter((card) => card.playerId === playerId).map((card) => card.value) ?? []
  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderRadius: '18px',
        background: `radial-gradient(ellipse at 30% 40%, #1f9655, ${XMAS.feltDark})`,
        border: `3px solid ${XMAS.wood}`,
        boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.35)',
      }}
    >
      {last ? (
        <XmasCard key={`${state.round}-${played.length}`} value={last.value} size="7px" anim="land" mistake={Boolean(mistake)} />
      ) : (
        <Box sx={{ width: 42, height: 59, borderRadius: '6px', border: '2px dashed rgba(255,246,220,0.5)', flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: 'rgba(255,246,220,0.75)' }}>NA MESA</Typography>
        {mistake ? (
          <Typography sx={{ fontWeight: 800, color: '#ffd0d4', lineHeight: 1.25 }}>
            {mistake.cutterId === playerId
              ? 'OPS! Você se adiantou 🙈'
              : mine.length
                ? `Era a sua vez! Você tinha ${mine.join(', ')} 😅`
                : `OPS! ${mistake.cutterName} se adiantou 🙈`}
            {mistake.coop ? ' · -1 enfeite' : ''}
          </Typography>
        ) : (
          <Typography noWrap sx={{ fontWeight: 800, color: '#fff6dc', fontSize: '1.05rem' }}>
            {last ? `${nameOf(state, last.playerId)} jogou ${last.value}` : 'Vazia — quem tem a menor?'}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,246,220,0.8)' }}>
          🃏 {left} {cardWord(left)} {left === 1 ? 'escondida' : 'escondidas'} na mesa toda
        </Typography>
      </Box>
    </Box>
  )
}

function Status({
  state,
  isEliminated,
  lowest,
  handCount,
  playerId,
  secondsToNextRound,
}: {
  state: GameState
  isEliminated: boolean
  lowest: number | null
  handCount: number
  playerId: string
  secondsToNextRound: number | null
}) {
  const title = (text: string, color: string = XMAS.goldLight) => (
    <Typography sx={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: '2rem', lineHeight: 1.05, color }}>{text}</Typography>
  )
  const line = (text: string) => <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.05rem', mt: 0.5 }}>{text}</Typography>

  if (state.phase === 'gameOver') {
    const won = state.winner === 'team' || state.winner === playerId
    const winnerName = state.winner && state.winner !== 'team' ? nameOf(state, state.winner) : null
    return (
      <>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>{won ? '🏆' : winnerName ? '👑' : '🫠'}</Typography>
        {title(won ? 'Feliz Natal! Vocês venceram!' : winnerName ? `${winnerName} venceu!` : 'A árvore ficou pelada!', won ? XMAS.goldLight : XMAS.candy)}
        {line(state.gameOverReason ?? 'Fim de jogo.')}
      </>
    )
  }
  if (isEliminated) {
    return (
      <>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>☃️</Typography>
        {title('Você virou boneco de neve', '#bfe6ff')}
        {line('Acompanhe o resto da partida pela TV.')}
      </>
    )
  }
  if (state.phase === 'waiting') {
    return (
      <>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }} className="animate-hop">⛄</Typography>
        {title('Quase lá!')}
        {line('Aguardando o host distribuir as cartas.')}
      </>
    )
  }
  if (state.phase === 'roundBreak') {
    const last = finalBreak(state)
    return (
      <>
        <Typography sx={{ fontSize: '3rem', lineHeight: 1 }} className="animate-pop-in">🎉</Typography>
        {title(last ? 'Os 10 níveis!' : `Nível ${state.round} completo!`)}
        {line(
          last
            ? 'Vocês leram a mente do Papai Noel!'
            : `Nível ${state.round + 1}: ${state.round + 1} cartas para cada um${secondsToNextRound !== null ? ` em ${secondsToNextRound}s` : ''}…`,
        )}
      </>
    )
  }
  if (handCount === 0 || lowest === null) {
    return (
      <>
        <Typography sx={{ fontSize: '2.6rem', lineHeight: 1 }}>🤞</Typography>
        {title('Mão vazia!', XMAS.pine)}
        {line('Agora é torcer pelo resto da mesa.')}
      </>
    )
  }
  return (
    <>
      {title(`Sua próxima: ${lowest}`)}
      {line('Jogue quando sentir que é a menor da mesa. Sem falar! 🤫')}
    </>
  )
}
