import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, nameOf, ranking, type RankEntry } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { CandleTimer, CandyRain, HauntedTitle, PlayerBadge, SPOOKY_COLORS } from '../../ui'
import {
  finalAwards,
  isDouble,
  revealMoment,
  type MmReveal,
  type MmRevealItem,
  type MmState,
} from './engine'
import { meta } from './meta'
import { splitBlank } from './text'
import {
  isBigLie,
  names,
  optionColumns,
  optionFont,
  people,
  phaseTotalMs,
  speechFor,
  TRUTH_FLIP_MS,
  truthPoints,
} from './view'

/**
 * TV da "Mentira Macabra". Só desenha o estado — quem decide fase, opções e
 * pontos é o motor. Letras para 3 metros (texto ≥ 28 px, títulos ≥ 64 px),
 * vela-cronômetro sempre à vista e a revelação em capítulos: cada mentira
 * que enganou alguém (quem caiu, de quem era) e a verdade por último.
 */

const ACCENT = meta.accent
const TRUTH_GREEN = '#4ade80'
/** Na revelação de cada mentira: quem caiu aparece, depois o carimbo do autor. */
const PICKERS_AT_MS = 600
const STAMP_AT_MS = 1500
/** Na verdade: o cartão vira junto com a pancada do rufar (que dura 1,7 s). */
const TRUTH_CARD_AT_MS = TRUTH_FLIP_MS

/** Sustos de meme guardados para os momentos certos — um de cada por partida. */
type ScareBudget = { zoom: boolean; doot: boolean }

export default function Tv({ state, players, now }: HalloweenViewProps<MmState>) {
  const phase = state.over ? 'final' : state.phase
  // Susto aleatório no meio da escolha ou da revelação atropela a piada.
  useSuppressScares(phase === 'choose' || phase === 'reveal' || phase === 'final')
  // Tique-taque para escrever, coração acelerado para escolher e revelar.
  useMusic(phase === 'final' ? 'victory' : phase === 'choose' || phase === 'reveal' ? 'tension' : 'quiz')
  const budgetRef = useRef<ScareBudget>({ zoom: false, doot: false })
  usePhaseSounds(state, players, now, budgetRef)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, minWidth: 0 }}>
      <TopBar state={state} now={now} />
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'write' && <WriteBoard state={state} players={players} />}
          {state.phase === 'choose' && <ChooseBoard state={state} players={players} />}
          {state.phase === 'reveal' && state.reveal && (
            <RevealBoard state={state} reveal={state.reveal} players={players} now={now} budgetRef={budgetRef} />
          )}
          {state.phase === 'scores' && <Scoreboard state={state} players={players} />}
        </>
      )}
    </Box>
  )
}

/** Sons e narração de cada momento (uma vez por rodada + fase, nunca a cada poll). */
function usePhaseSounds(state: MmState, players: HPlayer[], now: () => number, budgetRef: RefObject<ScareBudget>) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const lastRound = isDouble(state)
  const factSpeech = speechFor(state.fact.text)
  const liar = phase === 'final' ? finalAwards(state).liars : []
  const liarName = liar.length === 1 ? nameOf(players, liar[0]) : ''

  useEffect(() => {
    const timers: number[] = []
    let cancelSpeech = () => {}
    const later = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms))
    }
    const say = (text: string, ms: number) =>
      later(ms, () => {
        cancelSpeech = speakSpooky(text)
      })

    if (phase === 'write') {
      if (lastRound) {
        // Última rodada: o esqueleto do "doot doot" anuncia que vale o dobro.
        later(300, () => {
          if (budgetRef.current.doot) return
          budgetRef.current.doot = true
          triggerScare('doot')
        })
        say(`Última rodada! Vale o dobro! ${factSpeech}`, 2600)
      } else {
        playSfx('bell', { volume: 0.6 })
        say(factSpeech, 900)
      }
    }
    if (phase === 'choose') {
      playSfx('heartbeat', { volume: 0.8 })
      say('Qual delas é a verdade?', 500)
    }
    if (phase === 'scores') playSfx('ding')
    if (phase === 'final') {
      playSfx('organ')
      if (liarName) say(`O maior mentiroso da noite é ${liarName}!`, 2500)
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      cancelSpeech()
    }
  }, [moment, phase, lastRound, factSpeech, liarName, budgetRef])

  // Tique-taque nos últimos 5 segundos para escrever e para escolher.
  const answering = !state.over && (state.phase === 'write' || state.phase === 'choose')
  const { seconds } = useCountdown(answering ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0) return
    const tick = `${moment}-${seconds}`
    if (lastTick.current === tick) return
    lastTick.current = tick
    playSfx('tick')
  }, [seconds, moment])
}

function TopBar({ state, now }: { state: MmState; now: () => number }) {
  const answering = state.phase === 'write' || state.phase === 'choose'
  // Nas fases de resposta, a vela apaga na hora prometida (a folga fica escondida).
  const deadline = state.over || state.deadline === null ? null : answering ? state.deadline - GRACE_MS : state.deadline
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, minHeight: 72 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', minWidth: 0 }}>
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}
        >
          {state.over ? 'FIM DA NOITE' : `RODADA ${state.round}/${state.totalRounds}`}
        </Typography>
        {!state.over && isDouble(state) && <DoubleChip />}
      </Box>
      {deadline !== null && <Timer deadline={deadline} total={phaseTotalMs(state)} now={now} urgent={answering} />}
    </Box>
  )
}

/** Vela que derrete até o prazo, com os segundos grandões ao lado (legíveis do sofá). */
function Timer({ deadline, total, now, urgent }: { deadline: number; total: number; now: () => number; urgent: boolean }) {
  const { seconds } = useCountdown(deadline, now)
  const hurry = urgent && seconds !== null && seconds <= 5
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
      <Typography
        className={hurry ? 'animate-urgent' : undefined}
        sx={{
          fontFamily: 'var(--font-numeric)',
          fontSize: 'clamp(3rem, 4.4vw, 4.8rem)',
          lineHeight: 1,
          minWidth: '2ch',
          textAlign: 'right',
          color: hurry ? 'var(--blood, #e0213a)' : SPOOKY_COLORS.candle,
          textShadow: hurry ? '0 0 22px rgba(224, 33, 58, 0.6)' : '0 0 18px rgba(251, 191, 36, 0.35)',
        }}
      >
        {seconds ?? ''}
      </Typography>
      <CandleTimer deadline={deadline} total={total} now={now} size={104} showSeconds={false} />
    </Box>
  )
}

function DoubleChip() {
  return (
    <Box
      className="animate-urgent"
      sx={{
        px: 2.5,
        py: 0.75,
        borderRadius: 'var(--radius-full, 999px)',
        background: 'var(--blood, #e0213a)',
        color: '#fff',
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)',
        letterSpacing: '0.06em',
        boxShadow: '0 0 30px rgba(224, 33, 58, 0.55)',
      }}
    >
      💀 VALE O DOBRO
    </Box>
  )
}

function Kicker({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(2.2rem, 3vw, 3.4rem)',
        color: ACCENT.main,
        letterSpacing: '0.05em',
        lineHeight: 1.05,
        textShadow: `0 0 22px ${ACCENT.glow}`,
      }}
    >
      {children}
    </Typography>
  )
}

const FACT_SIZES = {
  big: 'clamp(3.2rem, 4.8vw, 6rem)',
  medium: 'clamp(2.2rem, 3vw, 3.6rem)',
  small: 'clamp(1.9rem, 2.3vw, 2.8rem)',
} as const

/** O fato com a lacuna brilhando (ou, na hora da verdade, com a resposta no lugar). */
function FactLine({ text, size, answer = null }: { text: string; size: keyof typeof FACT_SIZES; answer?: string | null }) {
  const [before, after] = splitBlank(text)
  return (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: FACT_SIZES[size],
        lineHeight: 1.15,
        color: 'var(--text-primary)',
        textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
        overflowWrap: 'anywhere',
      }}
    >
      {before}
      {answer ? (
        <Box
          component="span"
          className="animate-pop-in"
          sx={{ color: TRUTH_GREEN, textTransform: 'uppercase', borderBottom: `0.1em solid ${TRUTH_GREEN}`, textShadow: '0 0 24px rgba(74, 222, 128, 0.55)' }}
        >
          {answer}
        </Box>
      ) : (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            minWidth: '4.2em',
            mx: 0.5,
            px: 0.5,
            textAlign: 'center',
            color: ACCENT.main,
            borderBottom: `0.12em solid ${ACCENT.main}`,
            textShadow: `0 0 20px ${ACCENT.glow}`,
            animation: 'mmBlank 1.6s ease-in-out infinite',
            '@keyframes mmBlank': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
          }}
        >
          ???
        </Box>
      )}
      {after}
    </Typography>
  )
}

/** Nomes da partida com ✓ de quem já respondeu (nunca o quê). */
function Badges({ state, players, label }: { state: MmState; players: HPlayer[]; label: string }) {
  const done = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box>
      <Typography sx={{ fontSize: 'clamp(1.8rem, 2.2vw, 2.4rem)', color: 'var(--text-secondary)', mb: 1.5 }}>
        {label} · {done.size}/{state.roster.length}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {state.roster.map((id) => (
          <PlayerBadge
            key={id}
            name={nameOf(players, id)}
            acted={done.has(id)}
            offline={!online.has(id) && !done.has(id)}
            highlight={done.has(id)}
            size="lg"
          />
        ))}
      </Box>
    </Box>
  )
}

function WriteBoard({ state, players }: { state: MmState; players: HPlayer[] }) {
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      <Kicker>🤥 Complete com uma mentira convincente</Kicker>
      <FactLine text={state.fact.text} size="big" />
      <Box sx={{ mt: 'auto' }}>
        <Badges state={state} players={players} label="Escrevam a mentira no celular" />
      </Box>
    </Box>
  )
}

function ChooseBoard({ state, players }: { state: MmState; players: HPlayer[] }) {
  const columns = optionColumns(state.options.length)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      {/* Com a mesa cheia (até 16 opções), o fato encolhe para tudo caber na tela. */}
      <FactLine text={state.fact.text} size={state.options.length > 9 ? 'small' : 'medium'} />
      <Kicker>🔍 Qual delas é a VERDADE?</Kicker>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${columns}, minmax(0, 1fr))` }, gap: 1.5 }}>
        {state.options.map((option, index) => (
          <Box
            key={option.id}
            className="stagger-in"
            style={{ '--stagger-index': index } as CSSProperties}
            sx={{
              display: 'grid',
              placeItems: 'center',
              minHeight: state.options.length > 9 ? 80 : 96,
              px: 2.5,
              py: 1.5,
              borderRadius: 'var(--radius-xl)',
              border: `3px solid ${ACCENT.main}`,
              background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
              boxShadow: `0 0 24px ${ACCENT.glow}`,
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: optionFont(state.options.length),
                lineHeight: 1.1,
                textTransform: 'uppercase',
                overflowWrap: 'anywhere',
              }}
            >
              {option.text}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 'auto' }}>
        <Badges state={state} players={players} label="Escolham no celular" />
      </Box>
    </Box>
  )
}

function RevealBoard({
  state,
  reveal,
  players,
  now,
  budgetRef,
}: {
  state: MmState
  reveal: MmReveal
  players: HPlayer[]
  now: () => number
  budgetRef: RefObject<ScareBudget>
}) {
  // A revelação anda pelo relógio do servidor: a TV e os celulares ficam juntos.
  const t = useServerNow(now, 200)
  const moment = revealMoment(reveal, t)
  const item = moment.item
  useRevealSounds(state, moment.index, item, players, budgetRef)
  const truth = item?.kind === 'truth' ? item : null
  // A lacuna só se completa na pancada do rufar, junto com o cartão da verdade.
  const flipped = truth !== null && moment.since >= TRUTH_FLIP_MS

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      <FactLine text={state.fact.text} size="small" answer={flipped ? truth.text : null} />
      <StepDots reveal={reveal} index={moment.index} />
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}>
        {moment.index < 0 || !item ? (
          <RevealIntro double={reveal.double} />
        ) : truth ? (
          <TruthCard key="truth" item={truth} reveal={reveal} players={players} />
        ) : (
          <LieCard key={moment.index} item={item} players={players} />
        )}
      </Box>
    </Box>
  )
}

/** Sons de cada capítulo da revelação, casados com as animações dos cartões. */
function useRevealSounds(
  state: MmState,
  index: number,
  item: MmRevealItem | null,
  players: HPlayer[],
  budgetRef: RefObject<ScareBudget>,
) {
  const key = `${state.round}-${index}`
  const kind = item?.kind ?? null
  const anyPickers = (item?.pickers.length ?? 0) > 0
  const big = item ? isBigLie(item, state.roster.length) : false
  const author = item && item.authors.length ? nameOf(players, item.authors[0]) : ''

  useEffect(() => {
    if (index < 0) {
      playSfx('creak')
      return
    }
    if (kind === 'truth') {
      // Rufar; o cartão vira na pancada; depois a festa (ou o trombone triste).
      playSfx('drumroll')
      playSfx(anyPickers ? 'win' : 'fail', { delay: TRUTH_CARD_AT_MS / 1000 + 0.7 })
      return
    }
    if (!kind) return
    playSfx('whoosh')
    playSfx('pop', { delay: PICKERS_AT_MS / 1000, volume: 0.8 })
    if (kind === 'house') {
      playSfx('ghost', { delay: STAMP_AT_MS / 1000 })
      return
    }
    if (!big) {
      playSfx('laugh', { delay: STAMP_AT_MS / 1000 })
      return
    }
    // A mentira que enganou meio mundo ganha o zoom suspeito 🤨 — uma vez por partida.
    if (budgetRef.current.zoom) {
      playSfx('boom', { delay: STAMP_AT_MS / 1000 })
      return
    }
    const timer = window.setTimeout(() => {
      if (budgetRef.current.zoom) return
      budgetRef.current.zoom = true
      triggerScare('zoom', { name: author })
    }, STAMP_AT_MS)
    return () => window.clearTimeout(timer)
  }, [key, index, kind, anyPickers, big, author, budgetRef])
}

function StepDots({ reveal, index }: { reveal: MmReveal; index: number }) {
  const lies = reveal.steps.length - 1
  const label = index < 0 ? 'HORA DA VERDADE' : index >= lies ? 'A VERDADE' : `MENTIRA ${index + 1} DE ${lies}`
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {reveal.steps.map((step, stepIndex) => {
          const current = stepIndex === index
          const done = stepIndex < index
          const isTruthStep = step.kind === 'truth'
          return (
            <Box
              key={step.id}
              sx={{
                width: current ? 26 : 18,
                height: current ? 26 : 18,
                borderRadius: '50%',
                alignSelf: 'center',
                border: `3px solid ${isTruthStep ? TRUTH_GREEN : ACCENT.main}`,
                background: current || done ? (isTruthStep ? TRUTH_GREEN : ACCENT.main) : 'transparent',
                boxShadow: current ? `0 0 18px ${isTruthStep ? TRUTH_GREEN : ACCENT.glow}` : 'none',
                transition: 'all 250ms ease',
              }}
            />
          )
        })}
      </Box>
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.2vw, 2.4rem)', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
        {label}
      </Typography>
    </Box>
  )
}

function RevealIntro({ double }: { double: boolean }) {
  return (
    <Box className="animate-pop-in" sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: 'clamp(4rem, 7vw, 7rem)', lineHeight: 1 }} className="animate-flicker">
        🕯️
      </Typography>
      <HauntedTitle size={{ xs: 64, md: 104 }} color={ACCENT.main} drip>
        Hora da verdade
      </HauntedTitle>
      <Typography sx={{ mt: 2, fontSize: 'clamp(1.9rem, 2.6vw, 2.8rem)', color: 'var(--text-secondary)' }}>
        Mentira por mentira… a verdade vem por último.
        {double ? ' E esta rodada vale o DOBRO!' : ''}
      </Typography>
    </Box>
  )
}

function LieCard({ item, players }: { item: MmRevealItem; players: HPlayer[] }) {
  const shared = item.authors.length > 1
  const stamp =
    item.kind === 'house' ? '👻 MENTIRA DA CASA' : `🤥 MENTIRA DE ${names(players, item.authors).toUpperCase()}`
  const fell = item.pickers.length === 1 ? 'caiu' : 'caíram'
  return (
    <Box
      className="animate-deal-in"
      sx={{
        width: 'min(100%, 1250px)',
        textAlign: 'center',
        px: { xs: 3, md: 6 },
        py: { xs: 3, md: 5 },
        borderRadius: 'var(--radius-xl)',
        border: `4px solid ${ACCENT.main}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.85))',
        boxShadow: `0 0 60px ${ACCENT.glow}`,
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: 'clamp(3.4rem, 6vw, 6.6rem)',
          lineHeight: 1.04,
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
          color: ACCENT.light,
        }}
      >
        “{item.text}”
      </Typography>
      <Typography
        sx={{
          mt: 2.5,
          fontSize: 'clamp(1.9rem, 2.6vw, 2.9rem)',
          fontWeight: 700,
          animation: `mmFade 450ms ease ${PICKERS_AT_MS}ms both`,
          '@keyframes mmFade': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
        }}
      >
        🤡 {people(item.pickers.length)} {fell}: {names(players, item.pickers)}
      </Typography>
      <Box
        sx={{
          mt: 3.5,
          display: 'inline-block',
          px: 3,
          py: 1,
          border: '6px solid var(--blood, #e0213a)',
          borderRadius: 2,
          color: 'var(--blood, #e0213a)',
          background: 'rgba(224, 33, 58, 0.08)',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.4rem, 3.8vw, 4.2rem)',
          lineHeight: 1.05,
          letterSpacing: '0.04em',
          textShadow: '0 0 18px rgba(224, 33, 58, 0.45)',
          animation: `mmStamp 420ms cubic-bezier(0.2, 1.4, 0.4, 1) ${STAMP_AT_MS}ms both`,
          '@keyframes mmStamp': {
            from: { opacity: 0, transform: 'rotate(-5deg) scale(2.4)' },
            to: { opacity: 1, transform: 'rotate(-5deg) scale(1)' },
          },
        }}
      >
        {stamp}
        {item.gain > 0 && (
          <Box component="span" sx={{ color: ACCENT.main, ml: 2 }}>
            +{item.gain}
            {shared ? ' CADA' : ''}
          </Box>
        )}
      </Box>
    </Box>
  )
}

function TruthCard({ item, reveal, players }: { item: MmRevealItem; reveal: MmReveal; players: HPlayer[] }) {
  const missed = reveal.missed.slice(0, 6)
  const extra = reveal.missed.length - missed.length
  return (
    <Box sx={{ width: 'min(100%, 1300px)', textAlign: 'center' }}>
      <HauntedTitle size={{ xs: 64, md: 88 }} color={SPOOKY_COLORS.toxic}>
        E a verdade é…
      </HauntedTitle>
      <Box
        sx={{
          mt: 2.5,
          px: { xs: 3, md: 6 },
          py: { xs: 2.5, md: 4 },
          borderRadius: 'var(--radius-xl)',
          border: `6px solid ${TRUTH_GREEN}`,
          background: 'rgba(20, 83, 45, 0.35)',
          boxShadow: '0 0 70px rgba(74, 222, 128, 0.45)',
          animation: `mmTruth 700ms cubic-bezier(0.2, 1.3, 0.35, 1) ${TRUTH_CARD_AT_MS}ms both`,
          '@keyframes mmTruth': {
            from: { opacity: 0, transform: 'scale(0.4) rotate(-3deg)' },
            to: { opacity: 1, transform: 'none' },
          },
        }}
      >
        <Typography
          sx={{ fontWeight: 900, fontSize: 'clamp(3.6rem, 6.6vw, 7.2rem)', lineHeight: 1.02, textTransform: 'uppercase', color: '#dcfce7', overflowWrap: 'anywhere' }}
        >
          ✅ {item.text}
        </Typography>
      </Box>
      <Typography
        sx={{
          mt: 3,
          fontSize: 'clamp(2rem, 2.8vw, 3rem)',
          fontWeight: 800,
          animation: `mmFadeTruth 500ms ease ${TRUTH_CARD_AT_MS + 800}ms both`,
          '@keyframes mmFadeTruth': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      >
        {item.pickers.length
          ? `🔍 ${item.pickers.length === 1 ? 'Achou' : 'Acharam'}: ${names(players, item.pickers)} (+${truthPoints(reveal)}${item.pickers.length > 1 ? ' cada' : ''})`
          : '💀 Ninguém achou a verdade!'}
      </Typography>
      {missed.length > 0 && (
        <Typography
          sx={{
            mt: 2,
            fontSize: 'clamp(1.8rem, 2vw, 2.2rem)',
            color: 'var(--text-muted)',
            animation: `mmFadeTruth 500ms ease ${TRUTH_CARD_AT_MS + 1800}ms both`,
          }}
        >
          Ninguém caiu em:{' '}
          {missed
            .map((lie) => `“${lie.text}” (${lie.kind === 'house' ? 'da casa' : names(players, lie.authors)})`)
            .join(' · ')}
          {extra > 0 ? ` e mais ${extra}` : ''}
        </Typography>
      )}
    </Box>
  )
}

function Scoreboard({ state, players }: { state: MmState; players: HPlayer[] }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <HauntedTitle size={{ xs: 64, md: 84 }} color={ACCENT.main} align="left">
        Placar dos mentirosos
      </HauntedTitle>
      <RankList entries={ranking(state.scores, state.roster)} players={players} gains={state.reveal?.gains ?? {}} />
    </Box>
  )
}

function RankList({ entries, players, gains }: { entries: RankEntry[]; players: HPlayer[]; gains: Record<string, number> }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: entries.length > 8 ? { xs: '1fr', lg: '1fr 1fr' } : '1fr',
        gap: 1.25,
        columnGap: 5,
        maxWidth: entries.length > 8 ? 'none' : 1100,
      }}
    >
      {entries.map((entry, index) => {
        const gain = gains[String(entry.id)] ?? 0
        return (
          <Box
            key={entry.id}
            className="stagger-in"
            style={{ '--stagger-index': index } as CSSProperties}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2.5,
              py: 1,
              borderRadius: 'var(--radius-lg)',
              background: entry.place === 1 ? `${ACCENT.main}26` : 'rgba(255, 255, 255, 0.04)',
              border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>
              {entry.place}º
            </Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', fontWeight: 700 }}>
              {nameOf(players, entry.id)}
            </Typography>
            {gain > 0 && (
              <Typography sx={{ fontSize: 'clamp(1.8rem, 2.2vw, 2.3rem)', color: ACCENT.main, fontWeight: 800 }}>+{gain}</Typography>
            )}
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '2ch', textAlign: 'right' }}>
              {entry.score}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: MmState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CandyRain active kind="mixed" count={36} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
        <AwardCard
          icon="🤥"
          title="Mestre da mentira"
          names={awards.liars.length ? names(players, awards.liars) : 'Ninguém'}
          detail={awards.liars.length ? `enganou ${people(awards.maxFooled)}` : 'que galera honesta…'}
          delay={0}
        />
        <AwardCard
          icon="🔍"
          title="Farejador da verdade"
          names={awards.sniffers.length ? names(players, awards.sniffers) : 'Ninguém'}
          detail={awards.sniffers.length ? `${awards.maxFound} ${awards.maxFound === 1 ? 'verdade' : 'verdades'}` : 'todo mundo caiu em tudo'}
          delay={500}
        />
        <AwardCard
          icon="🤡"
          title="Caiu em tudo"
          names={awards.suckers.length ? names(players, awards.suckers) : 'Ninguém'}
          detail={awards.suckers.length ? `${awards.maxFell} ${awards.maxFell === 1 ? 'mentira' : 'mentiras'}` : 'ninguém caiu em nada!'}
          delay={1000}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gains={{}} />
    </Box>
  )
}

function AwardCard({ icon, title, names: who, detail, delay }: { icon: string; title: string; names: string; detail: string; delay: number }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: 3,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${ACCENT.main}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        boxShadow: `0 0 40px ${ACCENT.glow}`,
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 2.8vw, 3.2rem)', color: ACCENT.light, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1, mt: 1, overflowWrap: 'anywhere' }}>{who}</Typography>
      <Typography sx={{ fontSize: 'clamp(1.8rem, 2vw, 2.2rem)', color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
