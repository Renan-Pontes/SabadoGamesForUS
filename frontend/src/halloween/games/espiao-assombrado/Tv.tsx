import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakFestive, useMusic } from '../../audio'
import { GRACE_MS, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { BigReveal, CandleTimer, FESTIVE_ROUND_FONT, PlayerBadge, XMAS_COLORS, withAlpha } from '../../ui'
import { FestiveTitle, GiftBox, Ornament, SantaHat, Sparkles, SpyMascot, XmasRain } from './Decor'
import { finalAwards, type EspiaoState, type Phase } from './engine'
import { meta } from './meta'
import { RESULT_SECONDS } from './rules'
import { EVERYONE_ZOOM_NAME, clock, holdsScares, namesOf, revealCopy, revealMeme, revealNarration, spiesLabel, stagger, trackFor } from './view'

/**
 * TV do "Espião de Natal" — a mesa da festa. Só desenha o estado — quem
 * decide fase, votos e pontos é o motor — e nunca recebe segredo: o lugar, os
 * papéis e quem é espião só aparecem na revelação. Letras para 3 metros
 * (texto ≥ 28 px, títulos ≥ 64 px), vela de Natal gigante como cronômetro da
 * conversa, presente sacudindo no rufar e o zoom suspeito 🤨📸 com "boing".
 */

const ACCENT = meta.accent
const RED = XMAS_COLORS.red
const GREEN = XMAS_COLORS.pine
/** O rufar antes da revelação; depois, a manchete fica na tela um tempinho. */
const DRUM_MS = 1900
const BIG_MS = 4300

const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
const TEXT_BIG = 'clamp(2rem, 3vw, 3.2rem)'
const TITLE = 'clamp(4rem, 6.5vw, 7rem)'
const PANEL_BG = 'var(--bg-veil-strong, rgba(6, 16, 31, 0.82))'

export default function Tv({ state, players, now }: HalloweenViewProps<EspiaoState>) {
  // Piada aleatória no meio da votação ou da revelação estraga o momento.
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
  /** Piadas da revelação que já saíram nesta partida (cada uma uma vez só). */
  const memesUsed = useRef(new Set<string>())

  useEffect(() => {
    const timers: number[] = []
    let stopVoice: (() => void) | undefined
    const say = (text: string, delayMs: number) => {
      if (text) timers.push(window.setTimeout(() => (stopVoice = speakFestive(text)), delayMs))
    }
    switch (phase) {
      case 'reveal':
        // "Jogar de novo": partida nova, piadas novas.
        if (newMatch) {
          firstAccusation.current = true
          memesUsed.current.clear()
        }
        playSfx('sleigh')
        say(narration, 900)
        break
      case 'talk':
        // Começo da conversa: brilho mágico. Volta depois de acusação rejeitada: buzina.
        playSfx(resumed ? 'buzzer' : 'chime', { volume: 0.8 })
        say(narration, 600)
        break
      case 'accuse':
        // A primeira acusação da noite ganha o zoom suspeito 🤨📸 no acusado — com boing.
        if (firstAccusation.current) {
          firstAccusation.current = false
          triggerScare('zoom', { name: targetName })
          playSfx('boing', { delay: 0.25 })
          say(narration, 2400)
        } else {
          playSfx('boing')
          playSfx('gong', { delay: 0.5, volume: 0.6 })
          say(narration, 900)
        }
        break
      case 'final_vote':
        playSfx('gong')
        say(narration, 700)
        break
      case 'last_chance': {
        const d = playSfx('boing')
        playSfx('drumroll', { delay: d, volume: 0.7 })
        say(narration, 1100)
        break
      }
      case 'result':
        playSfx('drumroll')
        say(narration, DRUM_MS + 900)
        // Piada da revelação: zoom em "TODO MUNDO", "bruh" ou o cano caindo — uma vez por partida cada.
        if (meme && !memesUsed.current.has(meme)) {
          timers.push(
            window.setTimeout(() => {
              memesUsed.current.add(meme)
              if (meme === 'zoom') {
                triggerScare('zoom', { name: EVERYONE_ZOOM_NAME })
                playSfx('boing', { delay: 0.25 })
              } else {
                triggerScare(meme)
              }
            }, DRUM_MS + 2600),
          )
        }
        break
      case 'scores':
        playSfx('ding')
        break
      case 'final':
        playSfx('sleigh')
        playSfx('win', { delay: 1.2 })
        say('Ho ho ho! Fim da festa! Palmas pro campeão — e pros espiões, um pedaço de carvão!', 2600)
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
      playSfx('sleigh')
      speakFestive('Último minuto! Corre que o peru tá queimando!')
      return
    }
    // Última chance: guizo a cada 3 segundos, para o espião suar.
    if (phase === 'last_chance' && seconds > 5 && seconds % 3 === 0) {
      lastTick.current = key
      playSfx('tick', { volume: 0.8 })
      return
    }
    if (seconds > (phase === 'talk' ? 10 : 5)) return
    lastTick.current = key
    playSfx('tick')
  }, [seconds, moment, phase])
}

/** O que o apresentador da festa fala em cada momento (igual em rodada normal e maluca). */
function narrationFor(state: EspiaoState, players: HPlayer[], phase: Phase): string {
  switch (phase) {
    case 'reveal':
      return revealNarration(state.round, state.spyCount)
    case 'talk':
      return state.seg > 0
        ? 'Acusação rejeitada! Todo mundo de volta pra conversa — e nada de briga na ceia.'
        : `${nameOf(players, state.starter)} começa perguntando. Valendo!`
    case 'accuse':
      return `${nameOf(players, state.accusation?.by)} acusa ${nameOf(players, state.accusation?.target)}! Vai pra lista dos malcriados? Votem!`
    case 'final_vote':
      return 'Acabou o tempo! Quem é o penetra da festa?'
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
          {state.over ? '🎄 FIM DA NOITE' : `🎄 RODADA ${state.round}/${state.totalRounds}`}
        </Typography>
        {!state.over && (
          <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 700 }}>🕵️ {spiesLabel(state.spyCount)} infiltrado{state.spyCount > 1 ? 's' : ''} na festa</Typography>
        )}
      </Box>
      {!state.over && state.phase !== 'talk' && (
        <Countdown deadline={state.deadline} now={now} graceMs={answering ? GRACE_MS : 0} urgentCanPulse={answering} />
      )}
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

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function RevealBoard({ state }: { state: EspiaoState }) {
  return (
    <Box className="animate-pop-in" sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 3 }}>
      <Sparkles />
      {/* Enfeites pendurados nos cantos */}
      <Box sx={{ position: 'absolute', top: 0, left: '6%', display: 'flex', gap: 3 }}>
        <Ornament color={RED} size={70} swing />
        <Ornament color={GREEN} size={54} swing delay={-0.9} />
      </Box>
      <Box sx={{ position: 'absolute', top: 0, right: '6%', display: 'flex', gap: 3 }}>
        <Ornament color={XMAS_COLORS.ice} size={54} swing delay={-1.4} />
        <Ornament color={XMAS_COLORS.gold} size={70} swing delay={-0.4} />
      </Box>
      <SpyMascot size="clamp(7rem, 12vw, 11rem)" />
      <FestiveTitle size={TITLE}>Olhem a carta!</FestiveTitle>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>Abra o celular escondidinho 🤫</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', maxWidth: 1100 }}>
        {state.spyCount === 1
          ? 'Um de vocês é o espião — penetra na festa, e não faz ideia de onde vocês estão…'
          : 'Dois de vocês são espiões — e nem eles sabem um do outro…'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-end', mt: 1 }}>
        <GiftBox color={RED} size={86} bounce />
        <GiftBox color={XMAS_COLORS.green} ribbon={XMAS_COLORS.snow} size={110} bounce delay={-0.5} />
        <GiftBox color={XMAS_COLORS.ice} ribbon={RED} size={76} bounce delay={-1} />
      </Box>
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
            fontFamily: FESTIVE_ROUND_FONT,
            fontWeight: 700,
            fontSize: 'clamp(4.5rem, 7vw, 7.5rem)',
            lineHeight: 1,
            mt: 1,
            color: lastMinute ? RED : XMAS_COLORS.gold,
            textShadow: `0 0 24px ${lastMinute ? withAlpha(RED, 0.6) : withAlpha(XMAS_COLORS.gold, 0.4)}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clock(ms)}
        </Typography>
        {lastMinute && (
          <Typography className="animate-pop-in" sx={{ fontSize: TEXT, fontWeight: 800, color: RED }}>
            🔥 Último minuto!
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <Box>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>🎤 Quem começa perguntando</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <Typography
              sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1, color: ACCENT.main, textShadow: `0 0 28px ${ACCENT.glow}`, wordBreak: 'break-word', minWidth: 0 }}
            >
              {nameOf(players, state.starter, 'Qualquer um')}
            </Typography>
            <Box className="ep-wiggle" sx={{ width: 'clamp(60px, 6vw, 96px)', flexShrink: 0, mb: 1 }}>
              <SantaHat size="100%" />
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Tip icon="❓">Pergunte a alguém sobre o lugar — sem entregar.</Tip>
          <Tip icon="🫵">Desconfiou? Acuse pelo celular: a maioria decide.</Tip>
          <Tip icon="✨">O espião pode chutar o lugar a qualquer hora.</Tip>
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
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.4rem, 3.6vw, 3.8rem)', color: RED, letterSpacing: '0.08em', textShadow: `0 0 22px ${withAlpha(RED, 0.5)}` }}>
          🚨 ACUSAÇÃO! 🚨
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 'clamp(2.6rem, 4vw, 4.4rem)', fontWeight: 800 }}>{nameOf(players, accusation.by)}</Typography>
          <Typography aria-hidden sx={{ fontSize: 'clamp(3rem, 5vw, 5.2rem)', lineHeight: 1 }}>
            👉
          </Typography>
          <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Typography
              key={`${state.round}-${state.seg}-${accusation.target}`}
              className="ep-boing"
              sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4.5rem, 8vw, 8.5rem)', lineHeight: 1, color: ACCENT.main, textShadow: `0 0 34px ${ACCENT.glow}` }}
            >
              {target}
            </Typography>
            <Typography aria-hidden className="ep-wiggle" sx={{ fontSize: 'clamp(3.4rem, 5.6vw, 6rem)', lineHeight: 1 }}>
              🤨
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700, mt: 1 }}>{target} é o espião? Votem no celular!</Typography>
        <Typography sx={{ fontSize: TEXT, color: XMAS_COLORS.candy, fontWeight: 700 }}>📜 Vai pra lista dos malcriados do Papai Noel?</Typography>
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

/** Barras de voto listradas como bengala doce. */
function VoteBars({ yes, no, total }: { yes: number; no: number; total: number }) {
  const rows = [
    { label: '👍 SIM', count: yes, color: GREEN },
    { label: '👎 NÃO', count: no, color: RED },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 1400, width: '100%', mx: 'auto' }}>
      {rows.map((row) => (
        <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ width: '6.5ch', fontSize: TEXT_BIG, fontWeight: 800, flexShrink: 0 }}>{row.label}</Typography>
          <Box sx={{ flex: 1, height: 'clamp(40px, 4.5vw, 64px)', borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', border: '2px solid rgba(255, 255, 255, 0.14)', overflow: 'hidden' }}>
            <Box
              className="ep-candy-bar"
              sx={{
                height: '100%',
                width: `${(row.count / Math.max(1, total)) * 100}%`,
                minWidth: row.count > 0 ? 24 : 0,
                borderRadius: 999,
                backgroundColor: row.color,
                boxShadow: `0 0 24px ${withAlpha(row.color, 0.55)}`,
                transition: 'width 450ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </Box>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.6rem, 3.6vw, 3.8rem)', minWidth: '2ch', textAlign: 'right' }}>{row.count}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function FinalVoteBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const voted = new Set(state.acted)
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <FestiveTitle size={TITLE} align="left" color={RED}>
          Acabou o tempo!
        </FestiveTitle>
        <Box className="ep-swing" sx={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', lineHeight: 1 }} aria-hidden>
          🔔
        </Box>
      </Box>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>Votem no celular: quem é o penetra da festa? 🕵️</Typography>
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
    <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2 }}>
      <Sparkles color={RED} />
      <Typography
        className="ep-boing"
        sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(5rem, 10vw, 10rem)', lineHeight: 1, color: RED, textShadow: `0 6px 0 rgba(0,0,0,0.5), 0 0 40px ${withAlpha(RED, 0.6)}` }}
      >
        PEGO! 📸
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}>
        {caught} é espião! 🕵️
      </Typography>
      <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700 }}>Pego com a mão no panetone! Última chance: 30 segundos para digitar o lugar…</Typography>
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
      <Box sx={{ position: 'relative', flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Sparkles />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            <Typography aria-hidden className="ep-bounce" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
              🥁
            </Typography>
            <GiftBox size="clamp(160px, 16vw, 240px)" shake />
            <Typography aria-hidden className="ep-bounce" sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1 }}>
              🥁
            </Typography>
          </Box>
          <FestiveTitle size={TITLE}>E o espião era…</FestiveTitle>
        </Box>
      </Box>
    )
  }

  const spiesText =
    result.kind === 'everyone' ? 'TODO MUNDO 🤡' : result.kind === 'nobody' ? 'NINGUÉM 😇' : namesOf(players, result.spies)
  const gains = Object.entries(result.gains)
    .map(([id, points]) => ({ id: Number(id), points }))
    .sort((a, b) => b.points - a.points || a.id - b.id)
  const winnerColor = result.winner === 'table' ? GREEN : result.winner === 'spies' ? RED : XMAS_COLORS.gold

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <BigReveal open={elapsed < DRUM_MS + BIG_MS} icon={copy.icon} title={copy.title} subtitle={copy.subtitle} tone={copy.tone} sound={copy.sound} />
      <Typography className="animate-pop-in" sx={{ fontFamily: 'var(--font-display)', fontSize: TITLE, lineHeight: 1, color: winnerColor, textShadow: `0 0 30px ${withAlpha(winnerColor, 0.45)}` }}>
        {copy.headline}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'auto 1fr' }, gap: { xs: 2, md: 5 }, alignItems: 'center' }}>
        <PlaceTag icon={result.place.icon} name={result.place.name} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>
            🕵️ {result.kind === 'normal' && result.spies.length > 1 ? 'Espiões' : 'Espião'}: <span style={{ color: RED }}>{spiesText}</span>
          </Typography>
          <Typography sx={{ fontSize: TEXT_BIG, color: 'var(--text-secondary)' }}>{copy.subtitle}</Typography>
          {result.guess && (
            <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
              ✨ {nameOf(players, result.guess.by)} chutou “{result.guess.text}” {result.guess.right ? '✅' : '❌'}
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
                  🎁 +{gain.points} {nameOf(players, gain.id)}
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

/** Etiqueta de presente com o lugar da rodada (furo, barbante e tudo). */
function PlaceTag({ icon, name }: { icon: string; name: string }) {
  return (
    <Box className="animate-pop-in" sx={{ position: 'relative', justifySelf: 'center', pt: 4 }}>
      <Box aria-hidden sx={{ position: 'absolute', top: 0, left: '50%', width: 4, height: 44, ml: '-2px', background: RED, borderRadius: 2 }} />
      <Box
        sx={{
          position: 'relative',
          textAlign: 'center',
          px: 5,
          pt: 4,
          pb: 3,
          minWidth: 320,
          color: '#2b1608',
          background: `linear-gradient(160deg, #fffaf0 0%, ${XMAS_COLORS.snow} 55%, #f6e7c8 100%)`,
          border: `5px solid ${RED}`,
          outline: `3px dashed ${withAlpha(XMAS_COLORS.green, 0.9)}`,
          outlineOffset: '-14px',
          borderRadius: '28px 28px 22px 22px',
          clipPath: 'polygon(14% 0, 86% 0, 100% 12%, 100% 100%, 0 100%, 0 12%)',
          boxShadow: `0 0 44px ${ACCENT.glow}`,
        }}
      >
        <Box aria-hidden sx={{ position: 'absolute', top: 14, left: '50%', width: 22, height: 22, ml: '-11px', borderRadius: '50%', background: '#06101f', border: `3px solid ${XMAS_COLORS.gold}` }} />
        <Typography sx={{ fontSize: TEXT, color: '#7a2a1a', letterSpacing: '0.12em', fontWeight: 800, mt: 1 }}>O LUGAR ERA</Typography>
        <Typography sx={{ fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1.1 }}>{icon}</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.8rem, 4.4vw, 4.6rem)', lineHeight: 1, color: '#b0182c' }}>{name}</Typography>
      </Box>
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
          <Typography key={id} noWrap sx={{ fontSize: TEXT, color: spy ? RED : 'var(--text-secondary)' }}>
            <b style={{ color: spy ? RED : 'var(--text-primary)' }}>{nameOf(players, id)}</b> · {spy ? '🕵️ espião' : (result.roles[String(id)] ?? '—')}
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <FestiveTitle size={TITLE} align="left">
          Placar da mesa
        </FestiveTitle>
        <Ornament color={RED} size={64} swing />
        <Ornament color={GREEN} size={50} swing delay={-1} />
      </Box>
      <RankList entries={ranking} players={players} gains={state.result?.gains ?? {}} />
    </Box>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function RankList({ entries, players, gains }: { entries: { id: number; score: number; place: number }[]; players: HPlayer[]; gains: Record<string, number> }) {
  const wide = entries.length > 8
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: wide ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 1.25, columnGap: 5, maxWidth: wide ? 'none' : 1100 }}>
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

function FinalBoard({ state, players }: { state: EspiaoState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <XmasRain active count={36} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title="Campeão da noite"
          names={awards.champions.length ? namesOf(players, awards.champions) : 'Ninguém pontuou'}
          detail={awards.champions.length ? `${awards.topScore} ${awards.topScore === 1 ? 'ponto' : 'pontos'}` : 'a mesa ficou no zero'}
          delay={0}
          color={XMAS_COLORS.gold}
        />
        <AwardCard
          icon="🕵️"
          title="Mestre do disfarce"
          names={awards.masterSpies.length ? namesOf(players, awards.masterSpies) : 'Nenhum espião escapou'}
          detail={awards.masterSpies.length ? `${awards.maxSpyWins} ${awards.maxSpyWins === 1 ? 'vitória' : 'vitórias'} como espião` : 'mesa afiada!'}
          delay={500}
          color={RED}
        />
        <AwardCard
          icon="🦌"
          title="Nariz de Rudolph"
          names={awards.detectives.length ? namesOf(players, awards.detectives) : 'Ninguém farejou'}
          detail={awards.detectives.length ? `${awards.maxSharp} ${awards.maxSharp === 1 ? 'acusação certeira' : 'acusações certeiras'}` : 'os espiões agradecem'}
          delay={1000}
          color={GREEN}
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
      {/* Fita de presente cruzando o cartão */}
      <Box aria-hidden sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: color, opacity: 0.85 }} />
      <Typography className="ep-bounce" sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1, display: 'inline-block' }}>
        {icon}
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color, mt: 1 }}>{title}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.1, mt: 1, wordBreak: 'break-word' }}>{names}</Typography>
      <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
