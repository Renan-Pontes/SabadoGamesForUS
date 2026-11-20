import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakFestive, useMusic } from '../../audio'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { BigReveal, FESTIVE_ROUND_FONT, XMAS_COLORS, withAlpha } from '../../ui'
import { Envelope, FestiveTitle, GiftBox, Ornament, PlaceCard, Sparkles, Tablecloth, XmasCard, XmasRain } from './Decor'
import { ANSWER_PHASES, RESULT_SECONDS, finalAwards, type Phase, type State } from './engine'
import { meta } from './meta'
import {
  REVEAL_TIMING,
  answerText,
  holdsScares,
  kindHint,
  namesOf,
  narrationFor,
  pointsLabel,
  revealCopy,
  revealMeme,
  stagger,
  tableColumns,
  trackFor,
} from './view'

/**
 * TV da "Pergunta Trocada" — a MESA da festa: tudo acontece em cima de uma
 * toalha xadrez de Natal, com uma plaquinha de lugar para cada um. Só desenha
 * o estado (quem decide é o motor) e nunca recebe segredo: as respostas
 * aparecem juntas depois que todo mundo respondeu, a pergunta de verdade
 * entra de mola ("boing") depois, e o impostor só na revelação — com o zoom
 * suspeito 🤨📸 no mais votado antes. Letras para 3 metros.
 */

const ACCENT = meta.accent
const RED = XMAS_COLORS.red
const GREEN = XMAS_COLORS.pine

const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
const TEXT_BIG = 'clamp(2rem, 3vw, 3.2rem)'
const TITLE = 'clamp(4rem, 6.5vw, 7rem)'
const QUESTION = 'clamp(2.4rem, 3.7vw, 4.2rem)'
const PANEL_BG = 'var(--bg-veil-strong, rgba(6, 16, 31, 0.82))'

type Props = HalloweenViewProps<State>

export default function Tv({ state, players, now }: Props) {
  useSuppressScares(holdsScares(state.phase, state.over))
  useMusic(trackFor(state.phase, state.over))
  usePhaseSounds(state, players, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <TopBar state={state} now={now} />
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'question' && <QuestionBoard state={state} players={players} />}
          {state.phase === 'answers' && <AnswersBoard state={state} players={players} />}
          {state.phase === 'talk' && <TalkBoard state={state} players={players} />}
          {state.phase === 'vote' && <VoteBoard state={state} players={players} />}
          {state.phase === 'result' && <ResultBoard state={state} players={players} now={now} />}
          {state.phase === 'scores' && <Scoreboard state={state} players={players} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som: uma vez por momento (rodada + fase), nunca a cada poll
// ---------------------------------------------------------------------------

function usePhaseSounds(state: State, players: HPlayer[], now: () => number) {
  const phase: Phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const narration = narrationFor(state)
  const result = phase === 'result' ? state.result : null
  const accusedName = result && result.accused !== null ? nameOf(players, result.accused) : null
  const headline = result ? revealCopy(result, players).title.toLowerCase() : ''
  const meme = result ? revealMeme(result) : null

  useEffect(() => {
    const timers: number[] = []
    let stopVoice: (() => void) | undefined
    const later = (fn: () => void, delayMs: number) => timers.push(window.setTimeout(fn, delayMs))
    const say = (text: string, delayMs: number) => {
      if (text) later(() => (stopVoice = speakFestive(text)), delayMs)
    }
    switch (phase) {
      case 'question':
        playSfx('sleigh')
        say(narration, 900)
        break
      case 'answers':
        playSfx('whoosh')
        playSfx('pop', { delay: 0.5 })
        say(narration, 1200)
        break
      case 'talk':
        // A pergunta de verdade entra de mola.
        playSfx('boing')
        say(narration, 900)
        break
      case 'vote':
        playSfx('gong')
        say(narration, 700)
        break
      case 'result':
        // 1) zoom suspeito no mais votado; 2) rufar; 3) a manchete (o BigReveal toca o som dela).
        if (accusedName) {
          later(() => triggerScare('zoom', { name: accusedName }), 300)
        } else {
          playSfx('buzzer')
        }
        later(() => playSfx('drumroll'), REVEAL_TIMING.zoomEnd)
        say(headline, REVEAL_TIMING.drumEnd + 700)
        if (meme) later(() => triggerScare(meme), REVEAL_TIMING.bigEnd + 300)
        break
      case 'scores':
        playSfx('ding')
        break
      case 'final':
        playSfx('sleigh')
        playSfx('win', { delay: 1.2 })
        say(narration, 2600)
        break
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      stopVoice?.()
    }
  }, [moment, phase, narration, accusedName, headline, meme])

  // Tique-taque no fim de cada prazo de resposta.
  const answering = ANSWER_PHASES.includes(phase)
  const { seconds } = useCountdown(answering ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (seconds === null || seconds <= 0 || seconds > 5) return
    const key = `${moment}-${seconds}`
    if (lastTick.current === key) return
    lastTick.current = key
    playSfx('tick')
  }, [seconds, moment])
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  question: '✍️ Respondendo',
  answers: '📜 As respostas',
  talk: '🗣️ Conversa',
  vote: '🗳️ Votação',
  result: '🥁 Revelação',
  scores: '🏆 Placar',
}

function TopBar({ state, now }: { state: State; now: () => number }) {
  const answering = ANSWER_PHASES.includes(state.phase)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1.1 }}>
          {state.over ? '🎄 FIM DA FESTA' : `🎄 RODADA ${state.round}/${state.totalRounds}`}
        </Typography>
        {!state.over && <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700 }}>{PHASE_LABEL[state.phase] ?? ''}</Typography>}
      </Box>
      {!state.over && state.phase !== 'result' && <Countdown deadline={state.deadline} now={now} graceMs={answering ? GRACE_MS : 0} urgentCanPulse={answering || state.phase === 'talk'} />}
    </Box>
  )
}

/** Relógio em forma de bola de árvore (com a tampinha dourada). */
function Countdown({ deadline, now, graceMs, urgentCanPulse }: { deadline: number | null; now: () => number; graceMs: number; urgentCanPulse: boolean }) {
  const { seconds } = useCountdown(deadline, now, graceMs)
  if (seconds === null) return null
  const urgent = urgentCanPulse && seconds <= 5
  const ring = urgent ? RED : ACCENT.main
  return (
    <Box className={urgent ? 'animate-urgent' : undefined} sx={{ position: 'relative', flexShrink: 0, pt: '18px' }}>
      <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 34, height: 22, borderRadius: '5px 5px 2px 2px', background: XMAS_COLORS.gold, boxShadow: `0 0 12px ${withAlpha(XMAS_COLORS.gold, 0.6)}` }} />
      <Box
        sx={{
          width: 'clamp(110px, 9vw, 150px)',
          height: 'clamp(110px, 9vw, 150px)',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          border: `6px solid ${ring}`,
          boxShadow: `0 0 30px ${withAlpha(ring, 0.5)}, inset -14px -18px 30px rgba(0, 0, 0, 0.35), inset 12px 12px 24px ${withAlpha('#ffffff', 0.12)}`,
          background: `radial-gradient(circle at 32% 28%, ${withAlpha(ring, 0.42)}, ${PANEL_BG} 70%)`,
        }}
      >
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3.4rem, 4.6vw, 5rem)', lineHeight: 1 }}>{seconds}</Typography>
      </Box>
    </Box>
  )
}

/** Uma linha de dica com ícone. */
function Tip({ icon, children, color }: { icon: string; children: ReactNode; color?: string }) {
  return (
    <Typography sx={{ fontSize: TEXT, color: color ?? 'var(--text-secondary)', lineHeight: 1.3, fontWeight: 600 }}>
      <span aria-hidden style={{ display: 'inline-block', width: '1.5em' }}>
        {icon}
      </span>
      {children}
    </Typography>
  )
}

type CardExtra = {
  acted?: boolean
  highlight?: boolean
  impostor?: boolean
  votes?: number
  pending?: string
}

/** A mesa: uma plaquinha por pessoa, em cima da toalha. */
function TableOfAnswers({
  state,
  players,
  extra,
  flip = true,
  answers = true,
}: {
  state: State
  players: HPlayer[]
  extra?: (id: number) => CardExtra
  flip?: boolean
  /** false = respostas ainda escondidas (só o nome e o ✓). */
  answers?: boolean
}) {
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const count = state.roster.length
  const compact = count > 9
  return (
    <Tablecloth>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${tableColumns(count)}, minmax(0, 1fr))`, columnGap: compact ? 2.5 : 3.5, rowGap: compact ? 3 : 4, pt: 1 }}>
        {state.roster.map((id, index) => {
          const more = extra?.(id) ?? {}
          return (
            <PlaceCard
              key={`${state.round}-${id}`}
              name={nameOf(players, id)}
              answer={answers ? answerText(state.answers, id) : null}
              index={index}
              flip={flip}
              compact={compact}
              offline={!online.has(id)}
              {...more}
            />
          )
        })}
      </Box>
    </Tablecloth>
  )
}

/** O cartão com a pergunta de verdade (entra de mola na conversa). */
function RealQuestionCard({ question, boing = false, small = false }: { question: string; boing?: boolean; small?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box className={boing ? 'pt-boing' : undefined} sx={{ maxWidth: 1500, width: '100%' }}>
        <XmasCard label="A pergunta da mesa era" sx={{ fontSize: TEXT, py: small ? 1.5 : 2.5 }}>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: small ? TEXT_BIG : QUESTION, lineHeight: 1.12, color: '#b0182c', mt: 0.5 }}>{question}</Typography>
        </XmasCard>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function QuestionBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const hint = kindHint(state.kind)
  const acted = new Set(state.acted)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box className="animate-pop-in" sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 3, md: 6 }, flexWrap: 'wrap', textAlign: 'center' }}>
        <Sparkles />
        <Envelope size="clamp(150px, 15vw, 230px)" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          <FestiveTitle size={TITLE}>Pergunta no celular!</FestiveTitle>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>
            Todo mundo recebeu a mesma pergunta… <span style={{ color: ACCENT.main }}>ou quase todo mundo</span> 🤫
          </Typography>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {hint.icon} {hint.label} · {acted.size}/{state.roster.length} responderam
          </Typography>
        </Box>
      </Box>
      <TableOfAnswers
        state={state}
        players={players}
        flip={false}
        answers={false}
        extra={(id) => ({ acted: acted.has(id), pending: acted.has(id) ? '✓ respondeu' : '✍️ escrevendo…' })}
      />
    </Box>
  )
}

function AnswersBoard({ state, players }: { state: State; players: HPlayer[] }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box className="animate-pop-in" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
        <GiftBox size="clamp(90px, 8vw, 130px)" motion="shake" />
        <Box sx={{ textAlign: 'center' }}>
          <FestiveTitle size={TITLE}>As respostas!</FestiveTitle>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>
            Qual era a pergunta? <span className="pt-wiggle">🤔</span> Alguma resposta não combina…
          </Typography>
        </Box>
        <GiftBox size="clamp(90px, 8vw, 130px)" color={XMAS_COLORS.green} ribbon={XMAS_COLORS.snow} motion="shake" delay={-0.2} />
      </Box>
      <TableOfAnswers state={state} players={players} />
    </Box>
  )
}

function TalkBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const ready = new Set(state.acted)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <RealQuestionCard key={`q-${state.round}`} question={state.realQuestion ?? '…'} boing />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
        <Tip icon="🗣️" color="var(--text-primary)">
          Conversem! Quem respondeu <b style={{ color: ACCENT.main }}>outra pergunta</b>? <span className="pt-wiggle">🤨</span>
        </Tip>
        <Tip icon="🗳️">
          {ready.size}/{state.roster.length} prontos para votar
        </Tip>
      </Box>
      <TableOfAnswers state={state} players={players} flip={false} extra={(id) => ({ acted: ready.has(id) })} />
    </Box>
  )
}

function VoteBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const voted = new Set(state.acted)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box className="animate-pop-in" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap', textAlign: 'center' }}>
        <Ornament color={RED} size={64} />
        <FestiveTitle size={TITLE}>Votem no celular!</FestiveTitle>
        <Ornament color={GREEN} size={64} delay={-1} />
      </Box>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800, textAlign: 'center' }}>
        Quem recebeu a pergunta trocada? 🥸 · {voted.size}/{state.roster.length} votaram
      </Typography>
      {state.realQuestion && <RealQuestionCard question={state.realQuestion} small />}
      <TableOfAnswers state={state} players={players} flip={false} extra={(id) => ({ acted: voted.has(id) })} />
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)', textAlign: 'center' }}>O mais votado é o acusado. Empate? O impostor escapa!</Typography>
    </Box>
  )
}

function ResultBoard({ state, players, now }: { state: State; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now)
  const result = state.result
  if (!result) return null
  const elapsed = t - ((state.deadline ?? t) - RESULT_SECONDS * 1000)
  const votesFor = (id: number) => result.tally.find((entry) => entry.id === id)?.count ?? 0

  // 1) A mesa apontou: votos na plaquinha e o mais votado pulsando (o zoom 🤨📸 vem por cima).
  if (elapsed < REVEAL_TIMING.zoomEnd) {
    const accused = result.accused
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box className="animate-pop-in" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: TEXT_BIG, color: 'var(--text-secondary)', fontWeight: 800 }}>A mesa apontou…</Typography>
          <Typography className="pt-boing" sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1.05, color: accused === null ? RED : ACCENT.main, textShadow: `0 0 30px ${ACCENT.glow}` }}>
            {accused !== null ? `${nameOf(players, accused)} 🤨` : result.top.length ? 'EMPATE! 😬' : 'Ninguém votou! 😶'}
          </Typography>
        </Box>
        <TableOfAnswers state={state} players={players} flip={false} extra={(id) => ({ votes: votesFor(id), highlight: result.top.includes(id) })} />
      </Box>
    )
  }

  // 2) O rufar.
  if (elapsed < REVEAL_TIMING.drumEnd) {
    return (
      <Box sx={{ position: 'relative', flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Sparkles />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            <Typography aria-hidden className="pt-bounce" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
              🥁
            </Typography>
            <GiftBox size="clamp(160px, 16vw, 240px)" motion="shake" />
            <Typography aria-hidden className="pt-bounce" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
              🥁
            </Typography>
          </Box>
          <FestiveTitle size={TITLE}>E o impostor era…</FestiveTitle>
        </Box>
      </Box>
    )
  }

  // 3) A manchete em tela cheia e, embaixo, o quadro da rodada.
  const copy = revealCopy(result, players)
  const winnerColor = result.impostor === null ? XMAS_COLORS.gold : result.caught ? GREEN : RED
  const gains = Object.entries(result.gains)
    .map(([id, points]) => ({ id: Number(id), points }))
    .sort((a, b) => b.points - a.points || a.id - b.id)
  const impostorAnswer = result.impostor === null ? null : answerText(state.answers, result.impostor)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <BigReveal open={elapsed < REVEAL_TIMING.bigEnd} icon={copy.icon} title={copy.title} subtitle={copy.subtitle} tone={copy.tone} sound={copy.sound} />
      <Typography className="animate-pop-in" sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.2rem, 5vw, 5.4rem)', lineHeight: 1, color: winnerColor, textShadow: `0 0 30px ${withAlpha(winnerColor, 0.45)}`, textAlign: 'center' }}>
        {copy.headline}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: result.oddQuestion ? '1fr 1fr' : '1fr' }, gap: 3, alignItems: 'stretch' }}>
        <XmasCard label="A pergunta da mesa" sx={{ fontSize: TEXT }}>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT_BIG, lineHeight: 1.15, color: '#b0182c', mt: 0.5 }}>{result.realQuestion}</Typography>
        </XmasCard>
        {result.oddQuestion ? (
          <XmasCard tone="red" label={`A pergunta de ${nameOf(players, result.impostor)} 🥸`} className="animate-pop-in" sx={{ fontSize: TEXT }}>
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT_BIG, lineHeight: 1.15, mt: 0.5 }}>{result.oddQuestion}</Typography>
            <Typography sx={{ fontSize: TEXT, fontWeight: 800, mt: 1, color: XMAS_COLORS.gold }}>Respondeu: “{impostorAnswer ?? '🤐 nada'}”</Typography>
          </XmasCard>
        ) : (
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800, textAlign: 'center' }}>😇 Ninguém recebeu pergunta trocada: era tudo coisa da cabeça de vocês!</Typography>
        )}
      </Box>
      {gains.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: 'center' }}>
          {gains.map((gain, index) => (
            <Box
              key={gain.id}
              className="stagger-in"
              style={stagger(index)}
              sx={{ px: 2, py: 0.75, borderRadius: 'var(--radius-full)', background: withAlpha(ACCENT.main, 0.18), border: `2px solid ${ACCENT.main}`, fontSize: TEXT, fontWeight: 800 }}
            >
              🎁 +{gain.points} {nameOf(players, gain.id)}
            </Box>
          ))}
        </Box>
      )}
      <TableOfAnswers state={state} players={players} flip={false} extra={(id) => ({ votes: votesFor(id), impostor: id === result.impostor })} />
    </Box>
  )
}

function Scoreboard({ state, players }: { state: State; players: HPlayer[] }) {
  const { ranking } = finalAwards(state)
  const last = state.round + 1 >= state.totalRounds
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <FestiveTitle size={TITLE} align="left">
          Placar da mesa
        </FestiveTitle>
        <Ornament color={RED} size={64} />
        <Ornament color={GREEN} size={50} delay={-1} />
      </Box>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', fontWeight: 700 }}>
        {last ? '🎁 Agora vem a última rodada!' : '🎄 Próxima pergunta já vem — cara de paisagem! 😐'}
      </Typography>
      <RankList entries={ranking} players={players} gains={state.result?.gains ?? {}} />
    </Box>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function RankList({ entries, players, gains }: { entries: { id: number; score: number; place: number }[]; players: HPlayer[]; gains: Record<string, number> }) {
  const wide = entries.length > 8
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: wide ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 1.25, columnGap: 5, maxWidth: wide ? 'none' : 1100, width: '100%', mx: 'auto' }}>
      {entries.map((entry, index) => {
        const gained = gains[String(entry.id)] ?? 0
        const first = entry.place === 1
        return (
          <Box
            key={entry.id}
            className="stagger-in"
            style={stagger(index)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2.5,
              py: 1,
              borderRadius: 'var(--radius-lg)',
              background: first ? withAlpha(ACCENT.main, 0.16) : 'rgba(255, 255, 255, 0.05)',
              border: `2px solid ${first ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>
              {MEDALS[entry.place - 1] ?? `${entry.place}º`}
            </Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', fontWeight: 700 }}>
              {nameOf(players, entry.id)} {first ? '🎅' : ''}
            </Typography>
            {gained > 0 && <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 800 }}>+{gained}</Typography>}
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '2ch', textAlign: 'right' }}>{entry.score}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const awards = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <XmasRain active count={36} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Campeão da festa"
          names={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? pointsLabel(awards.topScore) : 'a mesa ficou no zero'}
          delay={0}
          color={XMAS_COLORS.gold}
        />
        <AwardCard
          icon="🥸"
          title="Cara de pau"
          names={awards.bluffers.length ? namesOf(players, awards.bluffers) : 'Nenhum impostor escapou'}
          detail={awards.bluffers.length ? `escapou ${awards.maxEscapes} ${awards.maxEscapes === 1 ? 'vez' : 'vezes'} como impostor` : 'mesa afiada!'}
          delay={500}
          color={RED}
        />
        <AwardCard
          icon="🦌"
          title="Nariz de Rena"
          names={awards.sniffers.length ? namesOf(players, awards.sniffers) : 'Ninguém farejou'}
          detail={awards.sniffers.length ? `${awards.maxSharp} ${awards.maxSharp === 1 ? 'voto certeiro' : 'votos certeiros'}` : 'os impostores agradecem'}
          delay={1000}
          color={GREEN}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gains={{}} />
      {state.history.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 'auto' }}>
          {state.history.map((entry) => (
            <Typography key={entry.round} noWrap sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
              {entry.round}. {entry.impostor === null ? '😇 sem impostor' : `${entry.caught ? '🎯' : '🥸'} ${nameOf(players, entry.impostor)}`} — “{entry.realQuestion}”
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  )
}

function AwardCard({ icon, title, names, detail, delay, color }: { icon: string; title: string; names: string; detail: string; delay: number; color: string }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        position: 'relative',
        p: 3,
        pt: 4,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${color}`,
        background: `linear-gradient(180deg, ${withAlpha(color, 0.16)}, ${PANEL_BG} 60%)`,
        boxShadow: `0 0 40px ${withAlpha(color, 0.4)}`,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: color, opacity: 0.85 }} />
      <Typography className="pt-bounce" sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>
        {icon}
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color, mt: 1 }}>{title}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1, mt: 1, wordBreak: 'break-word' }}>{names}</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
