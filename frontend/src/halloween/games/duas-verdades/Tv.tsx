import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakFestive } from '../../audio'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { BigReveal, FESTIVE_ROUND_FONT, PlayerBadge, XMAS_COLORS, withAlpha } from '../../ui'
import { FestiveTitle, Fireplace, LieStamp, SantaHat, Sparkles, Stocking, XmasRain } from './Decor'
import { MIN_TALK_SECONDS, finalAwards, votersOf, type DvCard, type DvPhase, type DvState } from './engine'
import { meta } from './meta'
import {
  DRUM_MS,
  SPOTLIGHT_MS,
  WRITE_NARRATION,
  cardFont,
  cardLetter,
  holdsScares,
  namesOf,
  outcomeCopy,
  pointsLabel,
  rankColumns,
  revealNarration,
  revealStartedAt,
  stagger,
  turnNarration,
} from './view'

/**
 * TV do "Duas Verdades, Uma Mentira" — o cantinho da lareira. Só desenha o
 * estado (quem decide fase e pontos é o motor) e nunca recebe segredo: qual
 * frase é a mentira só aparece na revelação. Letras para 3 metros (texto
 * ≥ 28 px), meias penduradas na lareira enquanto todo mundo escreve, a
 * cadeira do contador de histórias na vez de cada um e o carimbo "MENTIRA!".
 */

const ACCENT = meta.accent
const RED = XMAS_COLORS.red
const GREEN = XMAS_COLORS.pine
const PAPER_INK = '#2b1608'

const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
const TEXT_BIG = 'clamp(2rem, 3vw, 3.2rem)'
const TITLE = 'clamp(3.6rem, 6vw, 6.4rem)'
const PANEL_BG = 'var(--bg-veil-strong, rgba(6, 16, 31, 0.82))'
const STOCKING_COLORS = [RED, XMAS_COLORS.green, XMAS_COLORS.gold, XMAS_COLORS.ice, '#ff8fd0', '#b49cff', ACCENT.main]

type Props = HalloweenViewProps<DvState>

export default function Tv({ state, players, now }: Props) {
  // Piada aleatória no meio da votação ou da revelação estraga o momento.
  useSuppressScares(holdsScares(state.phase, state.over))
  usePhaseSounds(state, players, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <TopBar state={state} now={now} />
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'write' && <WriteBoard state={state} players={players} />}
          {state.phase === 'vote' && <VoteBoard state={state} players={players} now={now} />}
          {state.phase === 'reveal' && <RevealBoard state={state} players={players} now={now} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som: uma vez por momento (vez + fase), nunca a cada poll
// ---------------------------------------------------------------------------

function usePhaseSounds(state: DvState, players: HPlayer[], now: () => number) {
  const phase: DvPhase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const author = nameOf(players, state.author)
  const reveal = state.reveal
  const lieText = reveal ? (state.cards[reveal.lieCard]?.text ?? '') : ''
  const narration =
    phase === 'write'
      ? WRITE_NARRATION
      : phase === 'vote'
        ? turnNarration(author, state.cards, state.round)
        : phase === 'reveal' && reveal
          ? revealNarration(reveal, author, lieText, state.round)
          : ''
  const outcome = reveal?.outcome ?? null
  const champions = finalAwards(state).champions
  const finalLine = champions.length
    ? `Ho ho ho! Fim das histórias! ${namesOf(players, champions)} ${champions.length > 1 ? 'são os campeões' : 'é o campeão'} da lareira!`
    : 'Ho ho ho! Fim das histórias! Ninguém pontuou… quem diria, uma mesa sincera!'

  useEffect(() => {
    const timers: number[] = []
    let stopVoice: (() => void) | undefined
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
    const say = (text: string, ms: number) => {
      if (text) later(ms, () => (stopVoice = speakFestive(text)))
    }
    switch (phase) {
      case 'write':
        playSfx('sleigh')
        say(narration, 900)
        break
      case 'vote':
        playSfx('chime')
        say(narration, 1300)
        break
      case 'reveal':
        playSfx('drumroll')
        later(DRUM_MS, () => {
          playSfx('boing')
          if (outcome === 'fooled-all') {
            // Ninguém acertou: o duende desconfiado 🤨 espia o mentiroso ("Hmm… Ana?").
            later(900, () => triggerScare('peek', { name: author }))
          } else if (outcome === 'all-right' || outcome === 'no-votes') {
            playSfx('fail', { delay: 0.5 })
          } else {
            playSfx('ding', { delay: 0.5 })
          }
        })
        say(narration, DRUM_MS + (outcome === 'fooled-all' ? 4200 : 1300))
        break
      case 'final':
        playSfx('sleigh')
        playSfx('win', { delay: 1.2 })
        say(finalLine, 2600)
        break
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      stopVoice?.()
    }
  }, [moment, phase, narration, outcome, author, finalLine])

  // Tique-taque no fim dos prazos de resposta.
  const answering = phase === 'write' || phase === 'vote'
  const { seconds } = useCountdown(answering ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (seconds === null || seconds <= 0 || seconds > (phase === 'write' ? 10 : 5)) return
    const key = `${moment}-${seconds}`
    if (lastTick.current === key) return
    lastTick.current = key
    playSfx('tick')
  }, [seconds, moment, phase])
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function TopBar({ state, now }: { state: DvState; now: () => number }) {
  const answering = !state.over && (state.phase === 'write' || state.phase === 'vote')
  const label = state.over
    ? '🎄 FIM DAS HISTÓRIAS'
    : state.phase === 'write'
      ? '✍️ HORA DE ESCREVER'
      : `🔥 VEZ ${state.round}/${state.totalRounds}`
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1.1 }}>
        {label}
      </Typography>
      {answering && <Countdown deadline={state.deadline} now={now} />}
    </Box>
  )
}

/** Relógio em forma de bola de árvore (com a tampinha dourada). */
function Countdown({ deadline, now }: { deadline: number | null; now: () => number }) {
  const { seconds } = useCountdown(deadline, now, GRACE_MS)
  if (seconds === null) return null
  const urgent = seconds <= 5
  const ring = urgent ? RED : ACCENT.main
  const text = seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : String(seconds)
  return (
    <Box className={urgent ? 'animate-urgent' : undefined} sx={{ position: 'relative', flexShrink: 0, pt: '16px' }}>
      <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 30, height: 20, borderRadius: '5px 5px 2px 2px', background: XMAS_COLORS.gold }} />
      <Box
        sx={{
          width: 'clamp(104px, 8.5vw, 140px)',
          height: 'clamp(104px, 8.5vw, 140px)',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          border: `6px solid ${ring}`,
          boxShadow: `0 0 30px ${withAlpha(ring, 0.5)}, inset -14px -18px 30px rgba(0, 0, 0, 0.35)`,
          background: `radial-gradient(circle at 32% 28%, ${withAlpha(ring, 0.42)}, ${PANEL_BG} 70%)`,
        }}
      >
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: text.length > 2 ? 'clamp(2.2rem, 3vw, 3.2rem)' : 'clamp(3.2rem, 4.4vw, 4.6rem)', lineHeight: 1 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  )
}

function Tip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
      <span aria-hidden style={{ display: 'inline-block', width: '1.5em' }}>
        {icon}
      </span>
      {children}
    </Typography>
  )
}

/** Os nomes da mesa em pílulas (✓ = já votou, sem dizer em quê). */
function Table({ players, ids, acted, size = 'lg' }: { players: HPlayer[]; ids: number[]; acted?: (id: number) => boolean; size?: 'md' | 'lg' }) {
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
      {ids.map((id, index) => (
        <Box key={id} className="stagger-in" style={stagger(index)}>
          <PlayerBadge name={nameOf(players, id)} size={size} acted={acted?.(id)} offline={!online.has(id)} />
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Escrita: as meias penduradas na lareira
// ---------------------------------------------------------------------------

function WriteBoard({ state, players }: { state: DvState; players: HPlayer[] }) {
  const done = new Set(state.acted)
  const many = state.roster.length > 10
  return (
    <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Sparkles />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 4, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <FestiveTitle size={TITLE} align="left">
            Hora de mentir! 🤞
          </FestiveTitle>
          <Tip icon="✍️">No celular, escreva 3 frases sobre você.</Tip>
          <Tip icon="🤥">Duas verdades e uma mentira — e marque qual é a mentira.</Tip>
          <Tip icon="🎭">Mentira boa parece verdade. Verdade estranha parece mentira!</Tip>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800, color: ACCENT.light, mt: 1 }}>
            🎁 {done.size}/{state.roster.length} já encheram a meia
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Fireplace width="min(100%, 560px)" />
        </Box>
      </Box>
      {/* O varal de meias: uma por jogador; ganha um presente quando a pessoa manda as cartinhas. */}
      <Box
        sx={{
          mt: 'auto',
          pt: 3,
          borderTop: `14px solid #6b3a1e`,
          borderRadius: '6px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: many ? 2 : 3.5,
          rowGap: 2,
        }}
      >
        {state.roster.map((id, index) => {
          const filled = done.has(id)
          const offline = !players.find((player) => player.id === id)?.online
          return (
            <Box key={id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: many ? 150 : 180, opacity: offline ? 0.5 : 1 }}>
              <Stocking color={STOCKING_COLORS[index % STOCKING_COLORS.length]} filled={filled} size={many ? 64 : 80} delay={-(index % 5) * 0.5} />
              <Typography noWrap sx={{ mt: 0.75, maxWidth: '100%', fontSize: TEXT, fontWeight: 800, color: filled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {filled ? '✓ ' : offline ? '💤 ' : ''}
                {nameOf(players, id)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// A vez de alguém: a cadeira do contador de histórias e as 3 cartinhas
// ---------------------------------------------------------------------------

/** O contador de histórias da vez, com gorro e a lareira atrás. */
function Storyteller({ name, caption }: { name: string; caption: ReactNode }) {
  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1, minWidth: 0 }}>
      <Box className="dv-wiggle" sx={{ width: 'clamp(70px, 6vw, 100px)' }}>
        <SantaHat size="100%" />
      </Box>
      <Typography
        sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.2rem, 5vw, 5.4rem)', lineHeight: 1, color: ACCENT.main, textShadow: `0 0 30px ${ACCENT.glow}`, wordBreak: 'break-word', maxWidth: '100%' }}
      >
        {name}
      </Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>{caption}</Typography>
      <Box sx={{ mt: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Fireplace width="min(100%, 340px)" />
      </Box>
    </Box>
  )
}

type CardLook = 'open' | 'lie' | 'truth'

/** Uma cartinha na mesa: papel creme, selo vermelho com a letra. */
function LetterCard({ card, font, look = 'open', shake = false, footer, index }: { card: DvCard; font: string; look?: CardLook; shake?: boolean; footer?: ReactNode; index: number }) {
  const truth = look === 'truth'
  const lie = look === 'lie'
  return (
    <Box className="stagger-in" style={stagger(index)} sx={{ position: 'relative' }}>
      <Box
        className={shake ? 'dv-shake' : undefined}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          px: 3,
          py: 2,
          minHeight: 'clamp(110px, 12vh, 150px)',
          borderRadius: 'var(--radius-xl)',
          color: PAPER_INK,
          background: lie ? 'linear-gradient(160deg, #fff1ec 0%, #ffd9d2 100%)' : 'linear-gradient(160deg, #fffaf0 0%, #fff6dc 60%, #f6e7c8 100%)',
          border: `4px solid ${lie ? RED : truth ? GREEN : withAlpha(ACCENT.main, 0.9)}`,
          boxShadow: lie ? `0 0 46px ${withAlpha(RED, 0.65)}` : `0 8px 26px rgba(0, 0, 0, 0.35)`,
          opacity: truth ? 0.72 : 1,
          transition: 'opacity 400ms ease, box-shadow 400ms ease',
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: 'clamp(64px, 5.4vw, 86px)',
            height: 'clamp(64px, 5.4vw, 86px)',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: `radial-gradient(circle at 35% 30%, #ff6b78, ${XMAS_COLORS.red} 60%, #9e1424)`,
            border: `4px solid ${XMAS_COLORS.gold}`,
            color: '#fff6dc',
            fontFamily: FESTIVE_ROUND_FONT,
            fontWeight: 700,
            fontSize: 'clamp(2.4rem, 3.4vw, 3.6rem)',
            lineHeight: 1,
          }}
        >
          {cardLetter(card.id)}
        </Box>
        {/* color: inherit — sem isso a regra global de <p> pintava o texto de azul-claro no cartão creme. */}
        <Typography sx={{ flex: 1, minWidth: 0, color: 'inherit', fontSize: font, fontWeight: 800, lineHeight: 1.18, overflowWrap: 'anywhere', textDecoration: lie ? 'line-through' : 'none', textDecorationColor: withAlpha(RED, 0.6) }}>
          {card.text}
        </Typography>
        {truth && (
          <Typography sx={{ flexShrink: 0, fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT, color: '#147a3e' }}>✓ VERDADE</Typography>
        )}
        {lie && <LieStamp />}
      </Box>
      {footer}
    </Box>
  )
}

function VoteBoard({ state, players, now }: { state: DvState; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now)
  const author = nameOf(players, state.author)
  const voters = votersOf(state)
  const voted = new Set(state.acted)
  const startedAt = state.turnStart ?? t
  const spotlight = t - startedAt < SPOTLIGHT_MS
  const allVoted = voters.length > 0 && voters.every((id) => voted.has(id))
  const waitLeft = Math.max(0, Math.ceil((startedAt + MIN_TALK_SECONDS * 1000 - t) / 1000))
  const font = cardFont(state.cards)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <BigReveal open={spotlight} icon="🎤" title={`A vez de ${author}!`} subtitle="Duas verdades, uma mentira…" tone="pumpkin" sound={null} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 25%) 1fr' }, gap: { xs: 2, md: 4 }, alignItems: 'center' }}>
        <Storyteller name={author} caption="🤞 conta três coisas sobre si…" />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>Qual é a mentira? Conversem e votem no celular! 🗳️</Typography>
          {state.cards.map((card, index) => (
            <LetterCard key={card.id} card={card} font={font} index={index} />
          ))}
        </Box>
      </Box>
      <Box sx={{ mt: 'auto' }}>
        <Typography sx={{ fontSize: TEXT, color: allVoted ? ACCENT.light : 'var(--text-secondary)', fontWeight: allVoted ? 800 : 400, mb: 1 }}>
          {allVoted
            ? waitLeft > 0
              ? `Todo mundo votou! Mais ${waitLeft}s de papo… ${author}, defenda-se! 😏`
              : 'Todo mundo votou! Revelando…'
            : `${voted.size}/${voters.length} votaram · ${author} não vota (só disfarça 😐)`}
        </Typography>
        <Table players={players} ids={voters} acted={(id) => voted.has(id)} size={voters.length > 10 ? 'md' : 'lg'} />
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Revelação: rufar, carimbo e quem caiu
// ---------------------------------------------------------------------------

function RevealBoard({ state, players, now }: { state: DvState; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now)
  const reveal = state.reveal
  if (!reveal) return null
  const author = nameOf(players, reveal.author)
  const elapsed = t - revealStartedAt(state.deadline, reveal)
  const drumming = elapsed < DRUM_MS
  const copy = outcomeCopy(reveal, author, state.round)
  const font = cardFont(state.cards)
  const votersFor = (card: number) => state.roster.filter((id) => reveal.votes[String(id)] === card)
  const gains = Object.entries(reveal.gained)
    .map(([id, points]) => ({ id: Number(id), points }))
    .sort((a, b) => b.points - a.points || a.id - b.id)
  const headColor = copy.tone === 'blood' ? RED : copy.tone === 'toxic' ? GREEN : copy.tone === 'ghost' ? 'var(--text-secondary)' : ACCENT.main

  return (
    <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {drumming ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <Typography aria-hidden className="dv-bounce" sx={{ fontSize: 'clamp(4rem, 6vw, 6rem)', lineHeight: 1 }}>
            🥁
          </Typography>
          <FestiveTitle size={TITLE}>E a mentira de {author} é…</FestiveTitle>
          <Typography aria-hidden className="dv-bounce" sx={{ fontSize: 'clamp(4rem, 6vw, 6rem)', lineHeight: 1, animationDelay: '-0.6s' }}>
            🥁
          </Typography>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            key={`${state.round}-head`}
            className="dv-boing"
            sx={{
              fontFamily: FESTIVE_ROUND_FONT,
              fontWeight: 700,
              fontSize: reveal.outcome === 'fooled-all' ? 'clamp(4rem, 7vw, 7.4rem)' : 'clamp(3rem, 4.8vw, 5rem)',
              lineHeight: 1.02,
              color: headColor,
              textShadow: `0 5px 0 rgba(0, 0, 0, 0.5), 0 0 34px ${withAlpha(copy.tone === 'blood' ? RED : ACCENT.main, 0.45)}`,
            }}
          >
            {copy.title} {copy.icon}
          </Typography>
          <Typography className="animate-pop-in" sx={{ fontSize: TEXT_BIG, fontWeight: 700, mt: 0.5 }}>
            {copy.subtitle}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {state.cards.map((card, index) => {
          const lie = card.id === reveal.lieCard
          const ids = votersFor(card.id)
          return (
            <LetterCard
              key={card.id}
              card={card}
              font={font}
              index={index}
              shake={drumming}
              look={drumming ? 'open' : lie ? 'lie' : 'truth'}
              footer={
                !drumming && (
                  <Typography className="animate-pop-in" noWrap sx={{ mt: 0.5, ml: 2, fontSize: TEXT, color: lie ? GREEN : 'var(--text-secondary)', fontWeight: 700 }}>
                    {ids.length ? `${lie ? '🎯' : '🤦'} ${namesOf(players, ids)}` : lie ? '🎯 ninguém achou' : '— ninguém caiu nesta'}
                  </Typography>
                )
              }
            />
          )
        })}
      </Box>

      {!drumming && gains.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 'auto' }}>
          {gains.map((gain, index) => {
            const isAuthor = gain.id === reveal.author
            return (
              <Box
                key={gain.id}
                className="stagger-in"
                style={stagger(index)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 'var(--radius-full)',
                  background: withAlpha(isAuthor ? RED : ACCENT.main, 0.18),
                  border: `2px solid ${isAuthor ? RED : ACCENT.main}`,
                  fontSize: TEXT,
                  fontWeight: 800,
                }}
              >
                {isAuthor ? '🤥' : '🎯'} +{gain.points} {nameOf(players, gain.id)}
                {isAuthor ? ` (enganou ${gain.points})` : ''}
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

const MEDALS = ['🥇', '🥈', '🥉']

function RankList({ state, players }: { state: DvState; players: HPlayer[] }) {
  const { ranking } = finalAwards(state)
  const columns = rankColumns(ranking.length)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 1, columnGap: 5, maxWidth: columns > 1 ? 'none' : 1100, width: '100%', mx: 'auto' }}>
      {ranking.map((entry, index) => {
        const first = entry.place === 1 && entry.score > 0
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
              py: 0.75,
              borderRadius: 'var(--radius-lg)',
              background: first ? withAlpha(ACCENT.main, 0.16) : 'rgba(255, 255, 255, 0.05)',
              border: `2px solid ${first ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT, color: 'var(--text-muted)', minWidth: '2.2ch' }}>
              {MEDALS[entry.place - 1] ?? `${entry.place}º`}
            </Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: TEXT, fontWeight: 700 }}>
              {nameOf(players, entry.id)} {first ? '🎅' : ''}
            </Typography>
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', minWidth: '2ch', textAlign: 'right' }}>{entry.score}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: DvState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  if (!state.queue.length) {
    return (
      <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2 }}>
        <Sparkles />
        <Typography sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>🤐</Typography>
        <FestiveTitle size={TITLE}>Ninguém escreveu as cartinhas…</FestiveTitle>
        <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700 }}>A mesa mais sincera do Natal! Bora de novo?</Typography>
        <Fireplace width="min(70%, 520px)" />
      </Box>
    )
  }
  const best = awards.bestLie
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <XmasRain active count={36} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Campeão da lareira"
          names={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? pointsLabel(awards.topScore) : 'a mesa ficou no zero'}
          delay={0}
          color={XMAS_COLORS.gold}
        />
        <AwardCard
          icon="🤥"
          title="Mentiroso de ouro"
          names={awards.liars.length ? namesOf(players, awards.liars) : 'Ninguém enganou ninguém'}
          detail={awards.liars.length ? `enganou ${awards.maxFooled} ${awards.maxFooled === 1 ? 'vez' : 'vezes'}` : 'mesa de detetives!'}
          delay={500}
          color={RED}
        />
        <AwardCard
          icon="🦌"
          title="Nariz de Rena"
          names={awards.detectives.length ? namesOf(players, awards.detectives) : 'Ninguém farejou'}
          detail={awards.detectives.length ? `${awards.maxRight} ${awards.maxRight === 1 ? 'mentira achada' : 'mentiras achadas'}` : 'os mentirosos agradecem'}
          delay={1000}
          color={GREEN}
        />
      </Box>
      {best && (
        <Box className="animate-pop-in" sx={{ textAlign: 'center', px: 3, py: 1.5, borderRadius: 'var(--radius-xl)', border: `3px dashed ${ACCENT.main}`, background: withAlpha(ACCENT.main, 0.1) }}>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>🎭 Mentira da noite</Typography>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800, overflowWrap: 'anywhere' }}>“{best.lie}”</Typography>
          <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700 }}>
            {nameOf(players, best.author)} enganou {best.fooled} de {best.voters}
          </Typography>
        </Box>
      )}
      <RankList state={state} players={players} />
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
        p: 2.5,
        pt: 3.5,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${color}`,
        background: `linear-gradient(180deg, ${withAlpha(color, 0.16)}, ${PANEL_BG} 60%)`,
        boxShadow: `0 0 40px ${withAlpha(color, 0.4)}`,
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: color, opacity: 0.85 }} />
      <Typography className="dv-bounce" sx={{ fontSize: 'clamp(3rem, 4vw, 4.2rem)', lineHeight: 1 }}>
        {icon}
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.1rem, 2.8vw, 3rem)', color, mt: 1 }}>{title}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.1rem, 2.8vw, 3.2rem)', lineHeight: 1.1, mt: 0.5, wordBreak: 'break-word' }}>{names}</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
