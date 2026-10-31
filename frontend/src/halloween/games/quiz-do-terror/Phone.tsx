import { useEffect, type ReactNode } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { CATEGORIES } from './content'
import { REVEAL_SECONDS, SCORES_EVERY, finalAwards, pointsBreakdown, scoreRows, type QuizState } from './engine'
import { SUSPENSE_MS, buzz, formatPoints, formatSeconds, lookOf, medalFor } from './look'
import { meta } from './meta'

/**
 * Celular do "Quiz do Terror": uma ação clara por tela. Na pergunta, quatro
 * botões gigantes (cor + símbolo + texto, na mesma ordem da TV); um toque
 * trava a resposta. Na revelação, o meu resultado — nunca o de outra pessoa.
 */

const ACCENT = meta.accent
const GREEN = '#4ade80'
const RED = 'var(--blood, #e0213a)'

export default function Phone(props: HalloweenViewProps<QuizState>) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (state.phase === 'question') return <AnswerPanel {...props} />
  if (state.phase === 'reveal') return <ResultPanel {...props} />
  return <ScorePanel {...props} />
}

function Header({ state, now, grace }: { state: QuizState; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  const category = CATEGORIES[state.question.category] ?? CATEGORIES.halloween
  const scores = state.phase === 'scores'
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.2 }}>
          {scores ? 'PLACAR' : 'PERGUNTA'} {state.round}/{state.totalRounds}
        </Typography>
        {!scores && (
          <Typography noWrap sx={{ color: ACCENT.light, fontSize: '0.9rem' }}>
            {category.icon} {category.label}
          </Typography>
        )}
      </Box>
      {seconds !== null && (
        <Typography
          sx={{
            fontFamily: 'var(--font-numeric)',
            fontSize: '1.8rem',
            lineHeight: 1,
            flexShrink: 0,
            color: grace && seconds <= 5 ? RED : ACCENT.main,
          }}
        >
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

/** A alternativa que eu mandei nesta pergunta (null se ainda não respondi). */
function myChoice(state: QuizState, choice: unknown): number | null {
  return typeof choice === 'number' && Number.isInteger(choice) && choice >= 0 && choice < state.question.options.length
    ? choice
    : null
}

// ---------------------------------------------------------------------------
// Pergunta: quatro botões gigantes; um toque trava
// ---------------------------------------------------------------------------

function AnswerPanel({ state, me, myInput, send, now }: HalloweenViewProps<QuizState>) {
  const chosen = myChoice(state, myInput?.choice)
  if (chosen !== null) return <LockedPanel state={state} me={me} chosen={chosen} now={now} />

  const answer = (index: number) => {
    // O horário do toque vai junto: é ele que vale para a rapidez, não a hora em que chega na TV.
    send({ choice: index, at: now() })
    buzz(40)
  }

  return (
    <Box>
      <Header state={state} now={now} grace />
      <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.25, mb: 2, overflowWrap: 'anywhere' }}>
        {state.question.text}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        {state.question.options.map((text, index) => {
          const look = lookOf(index)
          return (
            <ButtonBase
              key={`${state.inputKey}-${index}`}
              onClick={() => answer(index)}
              aria-label={`${look.name}: ${text}`}
              sx={{
                minHeight: 128,
                p: 1.25,
                borderRadius: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 0.75,
                background: look.color,
                color: look.ink,
                boxShadow: `0 6px 0 ${look.deep}`,
                touchAction: 'manipulation',
                transition: 'transform 80ms ease, box-shadow 80ms ease',
                '&:active': { transform: 'translateY(4px)', boxShadow: `0 2px 0 ${look.deep}` },
              }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: '2.4rem', lineHeight: 1 }}>
                {look.symbol}
              </Box>
              <Box component="span" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.15, textAlign: 'center', overflowWrap: 'anywhere' }}>
                {text}
              </Box>
            </ButtonBase>
          )
        })}
      </Box>
      <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
        Um toque só — acertar rápido vale mais! ⚡
      </Typography>
    </Box>
  )
}

function LockedPanel({ state, me, chosen, now }: { state: QuizState; me: HPlayer | null; chosen: number; now: () => number }) {
  const look = lookOf(chosen)
  // Conto a minha resposta mesmo antes de a TV confirmar o ✓.
  const done = new Set(state.acted)
  if (me) done.add(me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace />
      <Box
        className="animate-pop-in"
        aria-label={look.name}
        sx={{
          mx: 'auto',
          mt: 1,
          width: 132,
          height: 132,
          borderRadius: '28px',
          background: look.color,
          color: look.ink,
          display: 'grid',
          placeItems: 'center',
          fontSize: '4.4rem',
          lineHeight: 1,
          boxShadow: `0 8px 0 ${look.deep}`,
        }}
      >
        {look.symbol}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', mt: 2, overflowWrap: 'anywhere' }}>{state.question.options[chosen]}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', color: ACCENT.main, mt: 1.5, lineHeight: 1.1 }}>
        Resposta travada 🔒
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.1rem', mt: 1 }}>
        Esperando os outros ({Math.min(done.size, state.roster.length)}/{state.roster.length})
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>Olhe a TV 👀</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Revelação: o meu resultado (depois do rufar da TV)
// ---------------------------------------------------------------------------

function ResultPanel({ state, players, me, now }: HalloweenViewProps<QuizState>) {
  const current = useServerNow(now)
  const reveal = state.reveal
  const key = me ? String(me.id) : ''
  const picked = reveal ? reveal.choices[key] : undefined
  const gained = reveal?.points[key] ?? 0
  const outcome = picked === undefined ? 'none' : gained > 0 ? 'hit' : 'miss'
  // A TV segura a resposta certa durante o rufar; o celular espera junto.
  const openedAt = (state.deadline ?? 0) - REVEAL_SECONDS * 1000
  const suspense = current < openedAt + SUSPENSE_MS

  useEffect(() => {
    if (suspense) return
    if (outcome === 'hit') buzz([40, 60, 40])
    if (outcome === 'miss') buzz(250)
  }, [suspense, outcome, state.round])

  if (!reveal || !me) return null
  const right = lookOf(reveal.correct)
  const rightText = state.question.options[reveal.correct] ?? '—'
  const mine = scoreRows(state).find((row) => row.id === me.id)
  const streak = state.streaks[key] ?? 0

  if (suspense) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Header state={state} now={now} grace={false} />
        <Typography className="animate-urgent" sx={{ fontSize: '4rem', lineHeight: 1, mt: 3 }}>
          🥁
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', mt: 2 }}>Olhe a TV…</Typography>
        {picked !== undefined && (
          <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>
            Você foi no {lookOf(picked).symbol} {state.question.options[picked]}
          </Typography>
        )}
      </Box>
    )
  }

  const parts = pointsBreakdown(gained, streak)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Box
        className="animate-pop-in"
        sx={{
          mx: 'auto',
          width: 116,
          height: 116,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: '4rem',
          lineHeight: 1,
          background: outcome === 'hit' ? 'rgba(74, 222, 128, 0.18)' : outcome === 'miss' ? 'rgba(224, 33, 58, 0.18)' : 'rgba(255,255,255,0.06)',
          border: `4px solid ${outcome === 'hit' ? GREEN : outcome === 'miss' ? RED : 'var(--border-medium)'}`,
        }}
      >
        {outcome === 'hit' ? '✓' : outcome === 'miss' ? '✗' : '😴'}
      </Box>
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.4rem',
          lineHeight: 1.05,
          mt: 1.5,
          color: outcome === 'hit' ? GREEN : outcome === 'miss' ? RED : 'var(--text-primary)',
        }}
      >
        {outcome === 'hit' ? 'Acertou!' : outcome === 'miss' ? 'Errou!' : 'Não respondeu'}
      </Typography>

      {outcome === 'hit' ? (
        <>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '3.4rem', lineHeight: 1, color: ACCENT.main, mt: 1 }}>
            +{formatPoints(gained)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', mt: 1.5 }}>
            <Chip>{formatPoints(parts.base)} acerto</Chip>
            {parts.speed > 0 && <Chip>+{formatPoints(parts.speed)} rapidez</Chip>}
            {parts.streak > 0 && <Chip>+{formatPoints(parts.streak)} 🔥 sequência</Chip>}
          </Box>
          {typeof reveal.times[key] === 'number' && (
            <Typography sx={{ color: 'var(--text-secondary)', mt: 1 }}>
              Respondeu em {formatSeconds(reveal.times[key])}
              {reveal.fastest.includes(me.id) ? ' — o mais rápido! ⚡' : ''}
            </Typography>
          )}
        </>
      ) : (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 'var(--radius-lg)', border: `2px solid ${right.color}`, background: 'rgba(255,255,255,0.04)' }}>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>A certa era</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
            <Box
              aria-label={right.name}
              sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '10px', background: right.color, color: right.ink, display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}
            >
              {right.symbol}
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', overflowWrap: 'anywhere' }}>{rightText}</Typography>
          </Box>
        </Box>
      )}

      <Typography sx={{ mt: 2.5, fontWeight: 700, fontSize: '1.1rem' }}>
        {mine ? `Você está em ${mine.place}º · ${formatPoints(mine.score)} pts` : 'Fora do placar'}
      </Typography>
      {streak >= 2 && <Typography sx={{ color: '#fb923c', fontWeight: 800 }}>🔥 {streak} acertos seguidos!</Typography>}
      {outcome !== 'hit' && (
        <Typography sx={{ color: 'var(--text-muted)', mt: 0.5 }}>{tease(players, me, state.round, outcome === 'none')}</Typography>
      )}
    </Box>
  )
}

const TEASES = [
  'Os fantasmas estão rindo de você 👻',
  'Nem o Saci erraria essa 🦶',
  'A próxima é sua! 💪',
  'Até o Zé do Caixão sabia ⚰️',
  'O Drácula ficou com vergonha alheia 🧛',
]

/** Para quem não respondeu: não "errou", cochilou. */
const SLEEPY = [
  'Cochilou? A próxima vem aí! 😴',
  'O fantasma comeu sua resposta 👻',
  'Toque antes da vela apagar! 🕯️',
]

/** Provocação leve para quem errou (ou cochilou): muda a cada pergunta, sem sorteio na tela. */
function tease(players: HPlayer[], me: HPlayer, round: number, asleep: boolean) {
  const seat = Math.max(0, players.findIndex((player) => player.id === me.id))
  const lines = asleep ? SLEEPY : TEASES
  return lines[(seat + round) % lines.length]
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ px: 1.25, py: 0.4, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-medium)', fontWeight: 700, fontSize: '0.95rem' }}
    >
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Placar e fim
// ---------------------------------------------------------------------------

function ScorePanel({ state, players, me, now }: HalloweenViewProps<QuizState>) {
  if (!me) return null
  const rows = scoreRows(state)
  const mine = rows.find((row) => row.id === me.id)
  const leading = rows.filter((row) => row.place === 1 && row.score > 0).map((row) => row.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem' }}>Placar do Além</Typography>
      <Typography sx={{ fontSize: '4.4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main, mt: 1 }}>
        {mine ? `${mine.place}º` : '—'}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>{formatPoints(mine?.score ?? 0)} pontos</Typography>
      {mine && state.round > SCORES_EVERY && mine.moved !== 0 && (
        <Typography sx={{ fontWeight: 800, mt: 1, color: mine.moved > 0 ? GREEN : RED }}>
          {mine.moved > 0 ? `▲ subiu ${mine.moved}` : `▼ caiu ${-mine.moved}`} {Math.abs(mine.moved) === 1 ? 'posição' : 'posições'}
        </Typography>
      )}
      {mine && mine.gained > 0 && (
        <Typography sx={{ color: ACCENT.light, fontWeight: 700, mt: 0.5 }}>+{formatPoints(mine.gained)} nas últimas perguntas</Typography>
      )}
      {mine && mine.streak >= 2 && <Typography sx={{ color: '#fb923c', fontWeight: 800, mt: 0.5 }}>🔥 {mine.streak} acertos seguidos</Typography>}
      <Typography sx={{ color: 'var(--text-muted)', mt: 2.5 }}>
        {leading.length ? `Olhe a TV — ${names(leading, players)} ${leading.length > 1 ? 'lideram' : 'lidera'}.` : 'Olhe a TV — ninguém pontuou ainda.'}
      </Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: HalloweenViewProps<QuizState>) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  const key = String(me.id)
  const champion = awards.champions.includes(me.id)
  const hits = state.hits[key] ?? 0
  const best = state.bestStreaks[key] ?? 0
  const medal = mine && mine.score > 0 ? medalFor(mine.place) : ''
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim do quiz!</Typography>
      <Typography sx={{ fontSize: '4.5rem', lineHeight: 1 }}>{medal || (hits > 0 ? '🎃' : '💀')}</Typography>
      {champion && (
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: ACCENT.main, lineHeight: 1.1 }}>
          Você é o Cérebro do Além! 🧠
        </Typography>
      )}
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {formatPoints(mine.score)} {mine.score === 1 ? 'ponto' : 'pontos'}
        </Typography>
      )}
      <Typography sx={{ color: 'var(--text-secondary)' }}>
        {hits} {hits === 1 ? 'acerto' : 'acertos'}
        {best >= 2 ? ` · 🔥 melhor sequência: ${best}` : ''}
      </Typography>
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>🧠 Cérebro do Além</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', overflowWrap: 'anywhere' }}>
          {awards.champions.length ? names(awards.champions, players) : 'Ninguém — os fantasmas venceram'}
        </Typography>
      </Box>
      {awards.fastest.ids.length > 0 && (
        <Typography sx={{ color: 'var(--text-secondary)' }}>⚡ Dedo mais rápido: {names(awards.fastest.ids, players)}</Typography>
      )}
    </Box>
  )
}

function names(ids: number[], players: HPlayer[]) {
  return listNames(ids.map((id) => nameOf(players, id)))
}
