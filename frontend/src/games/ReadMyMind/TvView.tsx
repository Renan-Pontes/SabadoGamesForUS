import { Box, Typography } from '@mui/material'
import { useMusic } from '../../halloween/audio'
import { useNow } from '../utils'
import { Confetti } from '../ui'
import { AdventCalendar, FeltTable, OrnamentLives, PlayerSeat, SnowBurst, type SeatTone } from './decor'
import { useFreshFor, useTableSounds } from './hooks'
import { ADVENT_TREATS, GAME_TITLE, NUMBER_FONT, TITLE_FONT, XMAS } from './look'
import type { GameState } from './types'
import {
  cardWord,
  cardsLeft,
  doorsOpen,
  finalBreak,
  mistakeIndexes,
  mistakeLine,
  mistakeOf,
  nameOf,
  pileTilt,
  type Mistake,
} from './view'
import XmasCard from './XmasCard'

interface TvViewProps {
  roomCode: string
  gameState: GameState
}

/** Tamanho-base das cartas da mesa: a carta do topo fica com ~1/4 da altura da TV. */
const PILE_SIZE = 'clamp(15px, 3.1vh, 40px)'
const REVEAL_SIZE = 'clamp(11px, 2vh, 26px)'
const MISTAKE_SHOW_MS = 7500
/** O relógio de inatividade só aparece no fim (o servidor tira vida aos 60 s). */
const TIMER_FROM_S = 20

/**
 * TV da Mente Natalina: a mesa de feltro da ceia. No centro, a pilha onde
 * as cartas caem; em cima, o calendário do Advento (níveis) e as bolas da
 * árvore (vidas); embaixo, cada jogador com as cartas viradas que ainda tem.
 * Letras para 3 metros: números das cartas enormes, frases de 28 px para cima.
 */
export default function TvView({ roomCode, gameState }: TvViewProps) {
  const now = useNow(250)
  const state = gameState
  const over = state.phase === 'gameOver'

  useMusic(over ? (state.winner ? 'wish' : null) : state.phase === 'waiting' ? 'jingle' : 'natal')
  useTableSounds(state)

  const mistake = mistakeOf(state)
  const mistakeFresh = useFreshFor(mistake?.key ?? null, MISTAKE_SHOW_MS, now)
  const played = state.playedCards
  const last = played[played.length - 1]
  const hiddenBy = new Map<string, number[]>()
  for (const card of mistake?.hidden ?? []) hiddenBy.set(card.playerId, [...(hiddenBy.get(card.playerId) ?? []), card.value])

  const compact = state.players.length > 8

  return (
    <Box
      sx={{
        height: '100vh',
        minHeight: 560,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.5, lg: 2 },
        px: { xs: 2, lg: 4 },
        py: { xs: 1.5, lg: 2.5 },
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(245, 194, 66, 0.14), transparent 60%), var(--bg-veil)',
      }}
    >
      <TopBar state={state} roomCode={roomCode} />

      <FeltTable sx={{ flex: 1, minHeight: 0 }}>
        {state.phase === 'waiting' && <WaitingCenter />}
        {state.phase === 'playing' && (
          <PlayCenter state={state} now={now} mistakeFresh={mistakeFresh} />
        )}
        {state.phase === 'roundBreak' && <LevelDoneCenter state={state} now={now} />}
        {over && <FinalCenter state={state} />}
        {state.phase === 'playing' && mistake && mistakeFresh && <MistakeMoment mistake={mistake} state={state} />}
      </FeltTable>

      {/* Os jogadores em volta da mesa */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
          columnGap: compact ? 1.5 : 3,
          rowGap: 0.5,
          flexShrink: 0,
        }}
      >
        {state.players.map((player) => {
          const revealed = state.phase === 'playing' ? (hiddenBy.get(player.id) ?? []) : []
          const tone: SeatTone =
            state.phase !== 'playing'
              ? 'normal'
              : mistake && mistake.cutterId === player.id
                ? 'oops'
                : revealed.length
                  ? 'hadLower'
                  : !mistake && last?.playerId === player.id
                    ? 'justPlayed'
                    : 'normal'
          return <PlayerSeat key={player.id} player={player} tone={tone} compact={compact} revealed={revealed} />
        })}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Barra de cima: título, calendário do Advento, vidas
// ---------------------------------------------------------------------------

function TopBar({ state, roomCode }: { state: GameState; roomCode: string }) {
  const coop = state.mode === 'coop'
  const standing = state.players.filter((p) => !p.isEliminated).length
  const current = state.phase === 'playing' ? state.round : null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexShrink: 0 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            fontFamily: TITLE_FONT,
            fontWeight: 700,
            fontSize: 'clamp(2.4rem, 4.4vw, 4.6rem)',
            lineHeight: 0.95,
            backgroundImage: `linear-gradient(100deg, ${XMAS.goldLight}, #fff6dc 40%, ${XMAS.candy} 75%, ${XMAS.goldLight})`,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmer 7s linear infinite',
            filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.45)) drop-shadow(0 0 18px rgba(245, 194, 66, 0.35))',
            whiteSpace: 'nowrap',
          }}
        >
          {/* O emoji fica fora do recorte em gradiente (senão vira um borrão dourado). */}
          <Box component="span" sx={{ WebkitTextFillColor: 'initial', mr: 1.5, fontSize: '0.8em' }} aria-hidden>
            🎄
          </Box>
          {GAME_TITLE}
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: 'clamp(1.2rem, 1.6vw, 1.75rem)', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {coop ? '🤝 Co-op · cartas em ordem crescente, sem falar nada' : '⚔️ Versus · quem se adiantar vira boneco de neve'}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
        <Typography sx={{ fontSize: 'clamp(1rem, 1.2vw, 1.35rem)', letterSpacing: '0.24em', fontWeight: 800, color: XMAS.goldLight, lineHeight: 1 }}>
          {state.phase === 'waiting' ? 'CALENDÁRIO DO ADVENTO' : `NÍVEL ${Math.min(state.round, state.maxRounds)} DE ${state.maxRounds}`}
        </Typography>
        <AdventCalendar opened={doorsOpen(state)} current={current} max={state.maxRounds} size={44} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        {coop ? (
          <OrnamentLives lives={state.lives} max={state.maxLives} size={48} />
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-secondary)' }}>DE PÉ</Typography>
            <Typography sx={{ fontFamily: NUMBER_FONT, fontWeight: 700, fontSize: '3.4rem', lineHeight: 1, color: XMAS.goldLight }}>
              {standing}
            </Typography>
          </Box>
        )}
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '0.9rem', letterSpacing: '0.24em', color: 'var(--text-muted)', fontWeight: 700 }}>SALA</Typography>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '2.2rem', letterSpacing: '0.14em', color: 'var(--text-secondary)', lineHeight: 1 }}>
            {roomCode}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Centro da mesa, por fase
// ---------------------------------------------------------------------------

const centerSx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: 2,
  p: 3,
} as const

const bigLine = { fontSize: 'clamp(1.75rem, 2.4vw, 2.8rem)', fontWeight: 700, color: '#fff6dc', textShadow: '0 2px 0 rgba(0,0,0,0.4)' } as const

function WaitingCenter() {
  return (
    <Box sx={centerSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {[-14, 0, 14].map((tilt, index) => (
          <Box key={tilt} sx={{ animation: 'hop 2.4s ease-in-out infinite', animationDelay: `${index * 0.3}s` }}>
            <XmasCard faceDown size="clamp(12px, 2.2vh, 28px)" tilt={tilt} />
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: 'clamp(2.6rem, 4vw, 4.4rem)', color: XMAS.goldLight, lineHeight: 1 }}>
        A mesa da ceia está posta
      </Typography>
      <Typography sx={bigLine}>Aguardando o host distribuir as cartas…</Typography>
      <Typography sx={{ ...bigLine, fontSize: 'clamp(1.5rem, 1.9vw, 2.2rem)', color: 'var(--text-secondary)' }}>
        🤫 Regra de ouro: ninguém fala o número. Só sintonia!
      </Typography>
    </Box>
  )
}

function PlayCenter({ state, now, mistakeFresh }: { state: GameState; now: number; mistakeFresh: boolean }) {
  const played = state.playedCards
  const last = played[played.length - 1]
  const left = cardsLeft(state)
  const mistakes = mistakeIndexes(played)
  const pile = played.slice(-7)
  const offset = played.length - pile.length
  const secondsLeft =
    state.deadlineTs !== undefined ? Math.max(0, Math.ceil((state.deadlineTs - now) / 1000)) : null
  const showTimer = secondsLeft !== null && secondsLeft <= TIMER_FROM_S && left > 0

  return (
    <Box sx={{ ...centerSx, flexDirection: 'row', gap: { xs: 3, lg: 6 }, opacity: mistakeFresh ? 0.25 : 1, transition: 'opacity 400ms ease' }}>
      {/* Esquerda: quem jogou, quanto falta */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5, minWidth: 0 }}>
        {last ? (
          <>
            <Typography sx={{ fontSize: 'clamp(1.3rem, 1.6vw, 1.9rem)', letterSpacing: '0.18em', fontWeight: 800, color: 'var(--text-secondary)' }}>
              ÚLTIMA CARTA DE
            </Typography>
            <Typography
              key={`${state.round}-${played.length}`}
              className="animate-pop-in"
              noWrap
              sx={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: 'clamp(2.6rem, 4vw, 4.6rem)', lineHeight: 1, color: XMAS.goldLight, maxWidth: '100%' }}
            >
              {nameOf(state, last.playerId)}
            </Typography>
          </>
        ) : (
          <Typography sx={{ fontFamily: TITLE_FONT, fontWeight: 700, fontSize: 'clamp(2.4rem, 3.6vw, 4.2rem)', lineHeight: 1.05, color: XMAS.goldLight, textAlign: 'right' }}>
            Quem tem a menor carta? 🤫
          </Typography>
        )}
        <Typography sx={{ ...bigLine, textAlign: 'right' }}>
          🃏 {left} {cardWord(left)} {left === 1 ? 'ainda escondida' : 'ainda escondidas'}
        </Typography>
        {showTimer && secondsLeft !== null && (
          <Typography
            className="animate-urgent"
            sx={{ ...bigLine, color: secondsLeft <= 10 ? XMAS.candy : XMAS.goldLight, textAlign: 'right' }}
          >
            ⏳ Alguém joga! {secondsLeft}s
          </Typography>
        )}
      </Box>

      {/* Centro: a pilha */}
      <Box sx={{ position: 'relative', fontSize: PILE_SIZE, width: '9em', height: '11em', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {pile.length === 0 ? (
          <Box
            sx={{
              width: '6em',
              height: '8.4em',
              borderRadius: '0.55em',
              border: '0.12em dashed rgba(255, 246, 220, 0.5)',
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255, 246, 220, 0.75)',
              fontSize: '1em',
              fontWeight: 700,
              textAlign: 'center',
              p: '0.5em',
            }}
          >
            <span>
              a 1ª carta
              <br />
              cai aqui
            </span>
          </Box>
        ) : (
          pile.map((card, index) => {
            const absolute = offset + index
            const top = index === pile.length - 1
            const at = pileTilt(card.value, absolute)
            return (
              <Box
                key={`${state.round}-${absolute}`}
                sx={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${at.x}em), calc(-50% + ${at.y}em))` }}
              >
                <XmasCard
                  value={card.value}
                  size={PILE_SIZE}
                  tilt={top ? 0 : at.rotate}
                  anim={top ? 'land' : 'none'}
                  highlight={top && !mistakes.has(absolute)}
                  mistake={mistakes.has(absolute)}
                  dim={!top}
                />
              </Box>
            )
          })
        )}
      </Box>

      {/* Direita: a sequência até aqui */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
        <Typography sx={{ fontSize: 'clamp(1.3rem, 1.6vw, 1.9rem)', letterSpacing: '0.18em', fontWeight: 800, color: 'var(--text-secondary)' }}>
          {played.length ? `NA MESA · ${played.length}` : `NÍVEL ${state.round}`}
        </Typography>
        {played.length ? (
          <Sequence state={state} mistakes={mistakes} />
        ) : (
          <Typography sx={{ ...bigLine, textAlign: 'left' }}>
            {state.round} {cardWord(state.round)} para cada um.
            <br />
            Respirem fundo… 🎶
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function Sequence({ state, mistakes }: { state: GameState; mistakes: Set<number> }) {
  const played = state.playedCards
  const shown = played.slice(-24)
  const offset = played.length - shown.length
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: 520 }}>
      {offset > 0 && <Typography sx={{ ...bigLine, fontSize: '1.6rem', color: 'var(--text-muted)' }}>…</Typography>}
      {shown.map((card, index) => {
        const wrong = mistakes.has(offset + index)
        const newest = offset + index === played.length - 1
        return (
          <Box
            key={`${state.round}-${offset + index}`}
            className={newest ? 'animate-pop-in' : undefined}
            sx={{
              minWidth: '2.4em',
              px: 0.75,
              borderRadius: '10px',
              textAlign: 'center',
              fontFamily: NUMBER_FONT,
              fontWeight: 700,
              fontSize: 'clamp(1.4rem, 1.7vw, 2rem)',
              lineHeight: 1.35,
              background: wrong ? 'rgba(232, 57, 74, 0.25)' : newest ? XMAS.goldLight : XMAS.cream,
              color: wrong ? '#ffd0d4' : XMAS.ink,
              border: `2px solid ${wrong ? XMAS.red : 'transparent'}`,
              textDecoration: wrong ? 'line-through' : 'none',
              boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
            }}
          >
            {card.value}
          </Box>
        )
      })}
    </Box>
  )
}

/** O erro: a carta adiantada contra as menores que estavam escondidas. */
function MistakeMoment({ mistake, state }: { mistake: Mistake; state: GameState }) {
  const hidden = mistake.hidden.slice(0, 6)
  const cutterOut = state.players.find((p) => p.id === mistake.cutterId)?.isEliminated ?? false
  const victimOut = mistake.victimId ? (state.players.find((p) => p.id === mistake.victimId)?.isEliminated ?? false) : false
  const footer = mistake.coop
    ? '💔 Caiu um enfeite da árvore'
    : cutterOut && victimOut && mistake.victimName && mistake.victimId !== mistake.cutterId
      ? `☃️ ${mistake.cutterName} e ${mistake.victimName} viraram boneco de neve`
      : cutterOut
        ? `☃️ ${mistake.cutterName} virou boneco de neve`
        : '☃️ Alguém virou boneco de neve'
  return (
    <Box
      sx={{
        ...centerSx,
        zIndex: 6,
        gap: 2.5,
        background: 'radial-gradient(ellipse at center, rgba(6, 16, 31, 0.78), rgba(6, 16, 31, 0.92))',
        animation: 'fadeIn 300ms ease both',
      }}
    >
      <Typography
        className="animate-shake"
        sx={{
          fontFamily: NUMBER_FONT,
          fontWeight: 700,
          fontSize: 'clamp(4rem, 8vw, 8rem)',
          lineHeight: 0.9,
          color: XMAS.candy,
          textShadow: `0 6px 0 ${XMAS.ink}, 0 0 40px rgba(232, 57, 74, 0.7)`,
        }}
      >
        OPS!{' '}
        <Box component="span" aria-hidden sx={{ textShadow: 'none' }}>
          🙈
        </Box>
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, lg: 4 }, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <XmasCard value={mistake.card} size={REVEAL_SIZE} mistake anim="land" tilt={-6} />
          <Typography noWrap sx={{ ...bigLine, fontSize: 'clamp(1.4rem, 1.8vw, 2.1rem)', maxWidth: 260 }}>
            {mistake.cutterName}
          </Typography>
        </Box>
        {hidden.length > 0 && (
          <Typography sx={{ fontFamily: NUMBER_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 5vw, 5.4rem)', color: XMAS.goldLight, lineHeight: 1 }}>
            {'>'}
          </Typography>
        )}
        {hidden.map((card, index) => (
          <Box key={`${card.playerId}-${card.value}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <XmasCard value={card.value} size={REVEAL_SIZE} anim="flip" delay={700 + index * 260} highlight tilt={index % 2 ? 4 : -3} />
            <Typography noWrap sx={{ ...bigLine, fontSize: 'clamp(1.4rem, 1.8vw, 2.1rem)', maxWidth: 220, color: XMAS.ice }}>
              {card.name}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography sx={{ ...bigLine, maxWidth: '80%' }}>{mistakeLine(mistake)}</Typography>
      <Typography sx={{ ...bigLine, color: XMAS.candy }}>{footer}</Typography>
    </Box>
  )
}

function LevelDoneCenter({ state, now }: { state: GameState; now: number }) {
  const last = finalBreak(state)
  const next = state.round + 1
  const seconds = state.nextRoundTs ? Math.max(0, Math.ceil((state.nextRoundTs - now) / 1000)) : null
  return (
    <Box sx={centerSx}>
      <SnowBurst key={state.round} seed={state.round} count={32} spread={520} />
      <Typography sx={{ fontSize: 'clamp(4rem, 7vw, 7rem)', lineHeight: 1 }} className="animate-pop-in">
        {last ? '🏆' : '🎉'}
      </Typography>
      <Typography
        className="animate-pop-in"
        sx={{
          fontFamily: TITLE_FONT,
          fontWeight: 700,
          fontSize: 'clamp(3.2rem, 6vw, 6.4rem)',
          lineHeight: 1,
          color: XMAS.goldLight,
          textShadow: '0 4px 0 rgba(0,0,0,0.45), 0 0 30px rgba(245, 194, 66, 0.55)',
        }}
      >
        {last ? 'Os 10 níveis!' : `Nível ${state.round} completo!`}
      </Typography>
      <Typography sx={bigLine}>
        {last
          ? 'Vocês leram a mente do Papai Noel. Preparando a festa…'
          : `Portinha ${state.round} do calendário aberta: ${ADVENT_TREATS[(state.round - 1) % ADVENT_TREATS.length]}`}
      </Typography>
      {!last && (
        <>
          <Box sx={{ display: 'flex', mt: 1 }}>
            {Array.from({ length: Math.min(next, 10) }, (_, index) => (
              <Box key={index} sx={{ ml: index ? '-1.4em' : 0, fontSize: 'clamp(8px, 1.3vh, 16px)' }}>
                <XmasCard faceDown size="1em" anim="deal" delay={index * 120} tilt={(index - (Math.min(next, 10) - 1) / 2) * 6} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ ...bigLine, color: XMAS.ice }}>
            Nível {next}: {next} {cardWord(next)} para cada um{seconds !== null ? ` · em ${seconds}s` : '…'}
          </Typography>
        </>
      )}
    </Box>
  )
}

function FinalCenter({ state }: { state: GameState }) {
  const coop = state.mode === 'coop'
  const won = Boolean(state.winner)
  const winnerName = state.winner && state.winner !== 'team' ? nameOf(state, state.winner) : null
  const reached = Math.min(state.round, state.maxRounds)
  return (
    <Box sx={centerSx}>
      {won && <Confetti />}
      {won && <SnowBurst seed={99} count={36} spread={600} />}
      <Typography className="animate-pop-in" sx={{ fontSize: 'clamp(4.4rem, 8vw, 8rem)', lineHeight: 1 }}>
        {won ? (winnerName ? '👑' : '🎄') : '🫠'}
      </Typography>
      <Typography
        className="animate-pop-in"
        sx={{
          fontFamily: TITLE_FONT,
          fontWeight: 700,
          fontSize: 'clamp(3.4rem, 6.4vw, 7rem)',
          lineHeight: 1,
          color: won ? XMAS.goldLight : XMAS.candy,
          textShadow: '0 4px 0 rgba(0,0,0,0.45), 0 0 34px rgba(245, 194, 66, 0.5)',
        }}
      >
        {won ? (winnerName ? `${winnerName} venceu!` : 'Feliz Natal!') : coop ? 'A árvore ficou pelada!' : 'Fim de jogo'}
      </Typography>
      <Typography sx={bigLine}>
        {won
          ? winnerName
            ? 'Leu a mente de todo mundo — e ainda sobrou rabanada.'
            : 'Os 10 níveis em sintonia total. Vocês são uma família de telepatas!'
          : coop
            ? `Acabaram os enfeites no nível ${reached}. Ano que vem tem revanche!`
            : (state.gameOverReason ?? 'Partida encerrada.')}
      </Typography>
      {coop && (
        <AdventCalendar opened={doorsOpen(state)} current={null} max={state.maxRounds} size={52} />
      )}
    </Box>
  )
}
