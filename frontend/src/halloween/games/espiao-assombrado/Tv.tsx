import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { BLOODY_FONT, BigReveal, CandleTimer, CandyRain, HauntedTitle, PlayerBadge, SPOOKY_COLORS, withAlpha } from '../../ui'
import { finalAwards, type EspiaoState, type Phase } from './engine'
import { meta } from './meta'
import { RESULT_SECONDS } from './rules'
import { clock, holdsScares, namesOf, revealCopy, revealMeme, revealNarration, spiesLabel, stagger, trackFor } from './view'

/**
 * TV do "Espião Assombrado". Só desenha o estado — quem decide fase, votos e
 * pontos é o motor — e nunca recebe segredo: o lugar, os papéis e quem é
 * espião só aparecem na revelação. Letras para 3 metros (texto ≥ 28 px,
 * títulos ≥ 64 px), vela gigante como cronômetro da conversa.
 */

const ACCENT = meta.accent
/** O rufar antes da revelação; depois, a manchete fica na tela um tempinho. */
const DRUM_MS = 1900
const BIG_MS = 4300

const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
const TEXT_BIG = 'clamp(2rem, 3vw, 3.2rem)'
const TITLE = 'clamp(4rem, 6.5vw, 7rem)'

export default function Tv({ state, players, now }: HalloweenViewProps<EspiaoState>) {
  // Susto de meme no meio da votação ou da revelação estraga a piada.
  useSuppressScares(holdsScares(state.phase, state.over))
  useMusic(trackFor(state.phase, state.over))
  usePhaseSounds(state, players, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, minWidth: 0 }}>
      <TopBar state={state} now={now} />
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'reveal' && <RevealBoard state={state} />}
          {state.phase === 'talk' && <TalkBoard state={state} players={players} now={now} />}
          {state.phase === 'accuse' && <AccuseBoard state={state} players={players} />}
          {state.phase === 'final_vote' && <FinalVoteBoard state={state} players={players} />}
          {state.phase === 'last_chance' && <LastChanceBoard state={state} players={players} />}
          {state.phase === 'result' && <ResultBoard state={state} players={players} now={now} />}
          {state.phase === 'scores' && <Scoreboard state={state} players={players} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som: uma vez por momento (rodada + fase + trecho), nunca a cada poll
// ---------------------------------------------------------------------------

function usePhaseSounds(state: EspiaoState, players: HPlayer[], now: () => number) {
  const phase: Phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}-${state.seg}`
  const targetName = nameOf(players, state.accusation?.target)
  const narration = narrationFor(state, players, phase)
  const meme = state.result ? revealMeme(state.result.outcome) : null
  const resumed = state.seg > 0
  const newMatch = state.round === 1 && phase === 'reveal'
  const firstAccusation = useRef(true)
  /** Memes da revelação que já saíram nesta partida (cada um uma vez só). */
  const memesUsed = useRef(new Set<string>())

  useEffect(() => {
    const timers: number[] = []
    let stopVoice: (() => void) | undefined
    const say = (text: string, delayMs: number) => {
      if (text) timers.push(window.setTimeout(() => (stopVoice = speakSpooky(text)), delayMs))
    }
    switch (phase) {
      case 'reveal':
        // "Jogar de novo": partida nova, sustos de meme novos.
        if (newMatch) {
          firstAccusation.current = true
          memesUsed.current.clear()
        }
        playSfx('whisper')
        say(narration, 700)
        break
      case 'talk':
        // Começo da conversa: sino. Volta depois de acusação rejeitada: buzina.
        playSfx(resumed ? 'buzzer' : 'bell', { volume: 0.7 })
        say(narration, 500)
        break
      case 'accuse':
        // A primeira acusação da noite ganha o zoom suspeito 🤨📸 no acusado.
        if (firstAccusation.current) {
          firstAccusation.current = false
          triggerScare('zoom', { name: targetName })
          say(narration, 2300)
        } else {
          playSfx('gong')
          say(narration, 600)
        }
        break
      case 'final_vote':
        playSfx('gong')
        say(narration, 600)
        break
      case 'last_chance':
        playSfx('thunder')
        playSfx('heartbeat', { delay: 1.2 })
        say(narration, 900)
        break
      case 'result':
        playSfx('drumroll')
        say(narration, DRUM_MS + 900)
        // Meme da revelação: doot doot 💀🎺, "bruh" ou o cano caindo — uma vez por partida cada.
        if (meme && !memesUsed.current.has(meme)) {
          timers.push(
            window.setTimeout(() => {
              memesUsed.current.add(meme)
              triggerScare(meme)
            }, DRUM_MS + 2600),
          )
        }
        break
      case 'scores':
        playSfx('ding')
        break
      case 'final':
        playSfx('organ')
        playSfx('win', { delay: 2.4 })
        break
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      stopVoice?.()
    }
  }, [moment, phase, narration, targetName, meme, resumed, newMatch])

  // Último minuto da conversa e tique-taque no fim de cada prazo.
  const answering = phase === 'accuse' || phase === 'final_vote' || phase === 'last_chance'
  const { seconds } = useCountdown(phase === 'talk' || answering ? state.deadline : null, now, answering ? GRACE_MS : 0)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (seconds === null || seconds <= 0) return
    const key = `${moment}-${seconds}`
    if (lastTick.current === key) return
    if (phase === 'talk' && seconds === 60) {
      lastTick.current = key
      playSfx('clang')
      speakSpooky('Último minuto!')
      return
    }
    // Última chance: o coração da sala bate junto.
    if (phase === 'last_chance' && seconds > 5 && seconds % 3 === 0) {
      lastTick.current = key
      playSfx('heartbeat', { volume: 0.8 })
      return
    }
    if (seconds > (phase === 'talk' ? 10 : 5)) return
    lastTick.current = key
    playSfx('tick')
  }, [seconds, moment, phase])
}

/** O que a voz grave da TV fala em cada momento (igual em rodada normal e maluca). */
function narrationFor(state: EspiaoState, players: HPlayer[], phase: Phase): string {
  switch (phase) {
    case 'reveal':
      return revealNarration(state.round, state.spyCount)
    case 'talk':
      return state.seg > 0 ? 'Acusação rejeitada. A conversa continua!' : `${nameOf(players, state.starter)} começa perguntando.`
    case 'accuse':
      return `${nameOf(players, state.accusation?.by)} acusa ${nameOf(players, state.accusation?.target)}! Votem.`
    case 'final_vote':
      return 'Acabou o tempo! Quem é o espião?'
    case 'last_chance':
      return `${nameOf(players, state.caught)} é espião! Última chance de adivinhar o lugar.`
    case 'result':
      return state.result ? revealCopy(state.result, players).title.toLowerCase() : ''
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function TopBar({ state, now }: { state: EspiaoState; now: () => number }) {
  const answering = state.phase === 'accuse' || state.phase === 'final_vote' || state.phase === 'last_chance'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1.1 }}>
          {state.over ? 'FIM DA NOITE' : `RODADA ${state.round}/${state.totalRounds}`}
        </Typography>
        {!state.over && (
          <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700 }}>🕵️ {spiesLabel(state.spyCount)} na mesa</Typography>
        )}
      </Box>
      {!state.over && state.phase !== 'talk' && (
        <Countdown deadline={state.deadline} now={now} graceMs={answering ? GRACE_MS : 0} urgentCanPulse={answering} />
      )}
    </Box>
  )
}

function Countdown({ deadline, now, graceMs, urgentCanPulse }: { deadline: number | null; now: () => number; graceMs: number; urgentCanPulse: boolean }) {
  const { seconds } = useCountdown(deadline, now, graceMs)
  if (seconds === null) return null
  const urgent = urgentCanPulse && seconds <= 5
  return (
    <Box
      className={urgent ? 'animate-urgent' : undefined}
      sx={{
        width: 'clamp(110px, 9vw, 150px)',
        height: 'clamp(110px, 9vw, 150px)',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: `6px solid ${urgent ? SPOOKY_COLORS.blood : ACCENT.main}`,
        boxShadow: `0 0 30px ${urgent ? withAlpha(SPOOKY_COLORS.blood, 0.55) : ACCENT.glow}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3.4rem, 4.6vw, 5rem)', lineHeight: 1 }}>{seconds}</Typography>
    </Box>
  )
}

/** Os nomes da mesa em pílulas grandes (✓ = já agiu, sem dizer o quê). */
function Table({ players, ids, acted, trailing }: { players: HPlayer[]; ids: number[]; acted?: (id: number) => boolean; trailing?: (id: number) => ReactNode }) {
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
      {ids.map((id, index) => (
        <Box key={id} className="stagger-in" style={stagger(index)}>
          <PlayerBadge name={nameOf(players, id)} size="lg" acted={acted?.(id)} offline={!online.has(id)} trailing={trailing?.(id)} />
        </Box>
      ))}
    </Box>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{children}</Typography>
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function RevealBoard({ state }: { state: EspiaoState }) {
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 3 }}>
      <Box aria-hidden className="animate-ghost" sx={{ fontSize: 'clamp(7rem, 12vw, 11rem)', lineHeight: 1, filter: `drop-shadow(0 0 40px ${ACCENT.glow})` }}>
        🕵️
      </Box>
      <HauntedTitle drip size={TITLE} color={ACCENT.main}>
        Olhem a carta!
      </HauntedTitle>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>Vire o celular escondido 🤫</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', maxWidth: 1100 }}>
        {state.spyCount === 1
          ? 'Um de vocês é o espião — e não faz ideia de onde vocês estão…'
          : 'Dois de vocês são espiões — e nem eles sabem um do outro…'}
      </Typography>
    </Box>
  )
}

function TalkBoard({ state, players, now }: { state: EspiaoState; players: HPlayer[]; now: () => number }) {
  const { ms } = useCountdown(state.deadline, now)
  const lastMinute = ms !== null && ms <= 60_000
  const rejected = state.rejected
  return (
    <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <CandleTimer deadline={state.deadline} total={state.talkMs} now={now} size={340} showSeconds={false} urgentAt={60_000 / Math.max(60_000, state.talkMs)} />
        <Typography
          className={lastMinute ? 'animate-urgent' : undefined}
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(4.5rem, 7vw, 7.5rem)',
            lineHeight: 1,
            mt: 1,
            color: lastMinute ? SPOOKY_COLORS.blood : SPOOKY_COLORS.candle,
            textShadow: `0 0 24px ${lastMinute ? withAlpha(SPOOKY_COLORS.blood, 0.6) : withAlpha(SPOOKY_COLORS.candle, 0.4)}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clock(ms)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Box>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>🎤 Quem começa perguntando</Typography>
          <Typography
            sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1, color: ACCENT.main, textShadow: `0 0 28px ${ACCENT.glow}`, wordBreak: 'break-word' }}
          >
            {nameOf(players, state.starter, 'Qualquer um')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Tip>❓ Pergunte a alguém sobre o lugar — sem entregar.</Tip>
          <Tip>🫵 Desconfiou? Acuse pelo celular: a maioria decide.</Tip>
          <Tip>🔮 O espião pode digitar o lugar a qualquer hora.</Tip>
        </Box>
        {rejected && (
          <Typography className="animate-pop-in" sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>
            ❌ {nameOf(players, rejected.by)} acusou {nameOf(players, rejected.target)} — {rejected.yes} SIM × {rejected.no} NÃO: rejeitada
          </Typography>
        )}
        <Table players={players} ids={state.roster} trailing={(id) => (state.accusers.includes(id) ? '🫵' : null)} />
      </Box>
    </Box>
  )
}

function AccuseBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const accusation = state.accusation
  if (!accusation) return null
  const voters = state.roster.filter((id) => id !== accusation.target)
  const voted = new Set(state.acted)
  const target = nameOf(players, accusation.target)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Box className="animate-pop-in" sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontFamily: BLOODY_FONT, fontSize: 'clamp(2.4rem, 3.6vw, 3.8rem)', color: SPOOKY_COLORS.blood, letterSpacing: '0.04em' }}>
          ACUSAÇÃO!
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 'clamp(2.6rem, 4vw, 4.4rem)', fontWeight: 800 }}>{nameOf(players, accusation.by)}</Typography>
          <Typography aria-hidden sx={{ fontSize: 'clamp(3rem, 5vw, 5.2rem)', lineHeight: 1 }}>
            👉
          </Typography>
          <Typography
            className="hw-knock"
            sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4.5rem, 8vw, 8.5rem)', lineHeight: 1, color: ACCENT.main, textShadow: `0 0 34px ${ACCENT.glow}` }}
          >
            {target}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700, mt: 1 }}>{target} é o espião? Votem no celular!</Typography>
      </Box>

      <VoteBars yes={accusation.yes} no={accusation.no} total={voters.length} />

      <Box>
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mb: 1 }}>
          {voted.size}/{voters.length} votaram · quem acusou já conta SIM · passa com mais SIM que NÃO (mínimo 2 SIM)
        </Typography>
        <Table players={players} ids={voters} acted={(id) => voted.has(id)} />
      </Box>

      <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>⏸ Conversa pausada — faltam {clock(state.pausedLeft)}</Typography>
    </Box>
  )
}

function VoteBars({ yes, no, total }: { yes: number; no: number; total: number }) {
  const rows = [
    { label: '👍 SIM', count: yes, color: '#22c55e' },
    { label: '👎 NÃO', count: no, color: SPOOKY_COLORS.blood },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 1400, width: '100%', mx: 'auto' }}>
      {rows.map((row) => (
        <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ width: '6.5ch', fontSize: TEXT_BIG, fontWeight: 800, flexShrink: 0 }}>{row.label}</Typography>
          <Box sx={{ flex: 1, height: 'clamp(40px, 4.5vw, 64px)', borderRadius: 3, background: 'rgba(255, 255, 255, 0.07)', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${(row.count / Math.max(1, total)) * 100}%`,
                minWidth: row.count > 0 ? 18 : 0,
                background: `linear-gradient(90deg, ${withAlpha(row.color, 0.75)}, ${row.color})`,
                boxShadow: `0 0 24px ${withAlpha(row.color, 0.5)}`,
                transition: 'width 450ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </Box>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2.6rem, 3.6vw, 3.8rem)', minWidth: '2ch', textAlign: 'right' }}>{row.count}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function FinalVoteBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const voted = new Set(state.acted)
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <HauntedTitle drip size={TITLE} color={SPOOKY_COLORS.blood} align="left">
        Acabou o tempo!
      </HauntedTitle>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>Votem no celular: quem é o espião? 🕵️</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
        O mais votado é condenado. Empate? O espião escapa! · {voted.size}/{state.roster.length} votaram
      </Typography>
      <Box sx={{ mt: 'auto' }}>
        <Table players={players} ids={state.roster} acted={(id) => voted.has(id)} />
      </Box>
    </Box>
  )
}

function LastChanceBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const caught = nameOf(players, state.caught)
  const top = state.verdict?.via === 'final' ? state.finalTally.slice(0, 4) : []
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2 }}>
      <Typography className="hw-pulse" sx={{ fontFamily: BLOODY_FONT, fontSize: 'clamp(5rem, 10vw, 10rem)', lineHeight: 1, color: SPOOKY_COLORS.blood, textShadow: `0 0 40px ${withAlpha(SPOOKY_COLORS.blood, 0.6)}` }}>
        PEGO!
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}>
        {caught} é espião! 🕵️
      </Typography>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700 }}>Última chance: tem 30 segundos para digitar o lugar…</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>Acertou, os espiões vencem. 🤐 Ninguém sopra!</Typography>
      {top.length > 0 && (
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>
          Votação: {top.map((entry) => `${nameOf(players, entry.id)} ${entry.count}`).join(' · ')}
        </Typography>
      )}
    </Box>
  )
}

function ResultBoard({ state, players, now }: { state: EspiaoState; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now)
  const result = state.result
  if (!result) return null
  const elapsed = t - ((state.deadline ?? t) - RESULT_SECONDS * 1000)
  const copy = revealCopy(result, players)

  if (elapsed < DRUM_MS) {
    return (
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box>
          <Typography className="hw-pulse" sx={{ fontSize: 'clamp(8rem, 14vw, 13rem)', lineHeight: 1 }}>
            🥁
          </Typography>
          <HauntedTitle size={TITLE} color={ACCENT.main}>
            E o espião era…
          </HauntedTitle>
        </Box>
      </Box>
    )
  }

  const spiesText =
    result.kind === 'everyone' ? 'TODO MUNDO 🤡' : result.kind === 'nobody' ? 'NINGUÉM 😇' : namesOf(players, result.spies)
  const gains = Object.entries(result.gains)
    .map(([id, points]) => ({ id: Number(id), points }))
    .sort((a, b) => b.points - a.points || a.id - b.id)
  const winnerColor = result.winner === 'table' ? SPOOKY_COLORS.toxic : result.winner === 'spies' ? SPOOKY_COLORS.blood : SPOOKY_COLORS.pumpkin

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <BigReveal open={elapsed < DRUM_MS + BIG_MS} icon={copy.icon} title={copy.title} subtitle={copy.subtitle} tone={copy.tone} sound={copy.sound} />
      <Typography className="animate-pop-in" sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1, color: winnerColor, textShadow: `0 0 30px ${withAlpha(winnerColor, 0.45)}` }}>
        {copy.headline}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'auto 1fr' }, gap: { xs: 2, md: 5 }, alignItems: 'center' }}>
        <Box className="hw-rise" sx={{ textAlign: 'center', px: 4, py: 3, borderRadius: 'var(--radius-xl)', border: `3px solid ${ACCENT.main}`, background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))', boxShadow: `0 0 40px ${ACCENT.glow}` }}>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>O LUGAR ERA</Typography>
          <Typography sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1.1 }}>{result.place.icon}</Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.6rem)', lineHeight: 1, color: ACCENT.light }}>{result.place.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>
            🕵️ {result.kind === 'normal' && result.spies.length > 1 ? 'Espiões' : 'Espião'}: <span style={{ color: SPOOKY_COLORS.blood }}>{spiesText}</span>
          </Typography>
          <Typography sx={{ fontSize: TEXT_BIG, color: 'var(--text-secondary)' }}>{copy.subtitle}</Typography>
          {result.guess && (
            <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
              🔮 {nameOf(players, result.guess.by)} chutou “{result.guess.text}” {result.guess.right ? '✅' : '❌'}
            </Typography>
          )}
          {result.finalTally.length > 0 && (
            <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
              🗳️ Votação final: {result.finalTally.slice(0, 5).map((entry) => `${nameOf(players, entry.id)} ${entry.count}`).join(' · ')}
            </Typography>
          )}
          {gains.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 1 }}>
              {gains.map((gain, index) => (
                <Box
                  key={gain.id}
                  className="stagger-in"
                  style={stagger(index)}
                  sx={{ px: 2, py: 0.75, borderRadius: 'var(--radius-full)', background: withAlpha(ACCENT.main, 0.18), border: `2px solid ${ACCENT.main}`, fontSize: TEXT, fontWeight: 800 }}
                >
                  +{gain.points} {nameOf(players, gain.id)}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <RolesGrid state={state} players={players} />
    </Box>
  )
}

/** Quem era quem: o papel de cada um (e o espião) — é a hora de rir das perguntas. */
function RolesGrid({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const result = state.result
  if (!result) return null
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 1, columnGap: 4, mt: 'auto' }}>
      {state.roster.map((id) => {
        const spy = result.spies.includes(id)
        return (
          <Typography key={id} noWrap sx={{ fontSize: TEXT, color: spy ? SPOOKY_COLORS.blood : 'var(--text-secondary)' }}>
            <b style={{ color: spy ? SPOOKY_COLORS.blood : 'var(--text-primary)' }}>{nameOf(players, id)}</b> · {spy ? '🕵️ espião' : (result.roles[String(id)] ?? '—')}
          </Typography>
        )
      })}
    </Box>
  )
}

function Scoreboard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const { ranking } = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, color: ACCENT.main, lineHeight: 1 }}>Placar da mesa</Typography>
      <RankList entries={ranking} players={players} gains={state.result?.gains ?? {}} />
    </Box>
  )
}

function RankList({ entries, players, gains }: { entries: { id: number; score: number; place: number }[]; players: HPlayer[]; gains: Record<string, number> }) {
  const wide = entries.length > 8
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: wide ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 1.25, columnGap: 5, maxWidth: wide ? 'none' : 1100 }}>
      {entries.map((entry, index) => {
        const gained = gains[String(entry.id)] ?? 0
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
              background: entry.place === 1 ? withAlpha(ACCENT.main, 0.16) : 'rgba(255, 255, 255, 0.04)',
              border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-muted)', minWidth: '2.2ch' }}>{entry.place}º</Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', fontWeight: 700 }}>
              {nameOf(players, entry.id)}
            </Typography>
            {gained > 0 && <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 800 }}>+{gained}</Typography>}
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '2ch', textAlign: 'right' }}>{entry.score}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CandyRain active kind="mixed" count={30} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Campeão da noite"
          names={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? `${awards.topScore} ${awards.topScore === 1 ? 'ponto' : 'pontos'}` : 'a mesa ficou no zero'}
          delay={0}
        />
        <AwardCard
          icon="🕵️"
          title="Mestre do disfarce"
          names={awards.masterSpies.length ? namesOf(players, awards.masterSpies) : 'Nenhum espião escapou'}
          detail={awards.masterSpies.length ? `${awards.maxSpyWins} ${awards.maxSpyWins === 1 ? 'vitória' : 'vitórias'} como espião` : 'mesa afiada!'}
          delay={500}
        />
        <AwardCard
          icon="🔎"
          title="Faro fino"
          names={awards.detectives.length ? namesOf(players, awards.detectives) : 'Ninguém acertou'}
          detail={awards.detectives.length ? `${awards.maxSharp} ${awards.maxSharp === 1 ? 'acusação certeira' : 'acusações certeiras'}` : 'os espiões agradecem'}
          delay={1000}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gains={{}} />
      {state.history.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 'auto' }}>
          {state.history.map((entry) => (
            <Typography key={entry.round} sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
              {entry.round}. {entry.icon} {entry.place} {entry.kind === 'everyone' ? '🤡' : entry.kind === 'nobody' ? '😇' : ''}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  )
}

function AwardCard({ icon, title, names, detail, delay }: { icon: string; title: string; names: string; detail: string; delay: number }) {
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
      }}
    >
      <Typography sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color: ACCENT.light, mt: 1 }}>{title}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1, mt: 1, wordBreak: 'break-word' }}>{names}</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
