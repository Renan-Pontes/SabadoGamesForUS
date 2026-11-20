import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakFestive } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useServerNow } from '../../framework/clockHooks'
import { CREEPY_FONT, CandyRain, FESTIVE_ROUND_FONT, PlayerBadge, XMAS_COLORS, withAlpha } from '../../ui'
import { GiftArt, PartIcon, Sleigh, TrashBin } from './Art'
import { CHAOS_BY_ID } from './content'
import { HOLD_MS, awards, coopStars, winningTeam, type FpState, type LogEntry, type Team } from './engine'
import { meta } from './meta'
import {
  RESULT_ICON,
  boxOf,
  clockText,
  flashActive,
  narrationFor,
  orderFraction,
  partOf,
  placedParts,
  pointsText,
  starsText,
  stepStatuses,
  teamLook,
  upcoming,
  type StepStatus,
} from './view'

/**
 * TV da Fábrica de Presentes: tela dividida, uma esteira por time. Em cada
 * metade, o pedido da vez (quem pediu e as peças na ordem), o presente sendo
 * montado na esteira, as peças adiantadas flutuando, o trenó enchendo e o
 * lixo da bagunça. Só desenha o estado — quem decide é o motor.
 */

const ACCENT = meta.accent
const GOLD = XMAS_COLORS.gold
const CREAM = '#fff6dc'
const INK = '#3a1a0a'

const TEXT = 'clamp(1.4rem, 1.7vw, 2rem)'
const TEXT_BIG = 'clamp(1.9rem, 2.4vw, 2.8rem)'
const TITLE = 'clamp(3.6rem, 6vw, 6.4rem)'

type Props = HalloweenViewProps<FpState>

export default function Tv({ state, players, now }: Props) {
  usePhaseSounds(state)
  useLineSounds(state)
  useTicks(state, now)
  const teams = state.teams ?? []
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          <TopBar state={state} now={now} />
          {state.phase === 'brief' && <BriefBoard state={state} players={players} now={now} />}
          {state.phase === 'play' && (
            <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: teams.length > 1 ? '1fr 1fr' : 'minmax(0, 1200px)', justifyContent: 'center', gap: 2.5, minHeight: 0 }}>
              {teams.map((team) => (
                <Line key={team.id} state={state} team={team} players={players} now={now} />
              ))}
            </Box>
          )}
          {state.phase === 'tally' && <TallyBoard state={state} players={players} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som: uma vez por momento; na esteira, um efeito por acontecimento
// ---------------------------------------------------------------------------

function usePhaseSounds(state: FpState) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const narration = narrationFor(state)
  useEffect(() => {
    const timers: number[] = []
    let stopVoice: (() => void) | undefined
    const say = (text: string, delayMs: number) => {
      if (text) timers.push(window.setTimeout(() => (stopVoice = speakFestive(text)), delayMs))
    }
    switch (phase) {
      case 'brief':
        playSfx('chime')
        say(narration, 900)
        break
      case 'play':
        playSfx('sleigh')
        playSfx('bell', { delay: 0.5 })
        break
      case 'tally': {
        const d = playSfx('drumroll')
        playSfx('ding', { delay: d })
        break
      }
      case 'final':
        playSfx('hohoho')
        playSfx('win', { delay: 1.4 })
        say(narration, 2800)
        break
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      stopVoice?.()
    }
  }, [moment, phase, narration])
}

type LineMemory = { done: number; mess: number; lost: number; last: string }

function useLineSounds(state: FpState) {
  const memory = useRef<Record<string, LineMemory>>({})
  useEffect(() => {
    if (state.over || state.phase !== 'play') {
      memory.current = {}
      return
    }
    let sound: 'sleigh' | 'boing' | 'whoosh' | 'pop' | null = null
    for (const team of state.teams ?? []) {
      const lastLog = team.log[team.log.length - 1]
      const now: LineMemory = {
        done: team.line.done,
        mess: team.line.mess,
        lost: team.line.lost,
        last: lastLog ? `${lastLog.at}-${lastLog.by}-${lastLog.n}` : '',
      }
      const before = memory.current[team.id]
      memory.current[team.id] = now
      if (!before) continue
      if (now.done > before.done) sound = 'sleigh'
      else if (now.mess > before.mess && sound !== 'sleigh') sound = 'boing'
      else if (now.lost > before.lost && !sound) sound = 'whoosh'
      else if (now.last !== before.last && !sound) sound = 'pop'
    }
    if (sound === 'sleigh') {
      playSfx('sleigh')
      playSfx('chime', { delay: 0.35 })
    } else if (sound) {
      playSfx(sound)
    }
  }, [state])

}

/** Tique-taque nos 5 segundos finais da rodada. */
function useTicks(state: FpState, now: () => number) {
  const t = useServerNow(now, 250)
  const playing = !state.over && state.phase === 'play' && state.deadline !== null
  const seconds = playing ? Math.ceil(((state.deadline ?? 0) - t) / 1000) : null
  const lastTick = useRef('')
  useEffect(() => {
    if (seconds === null || seconds <= 0 || seconds > 5) return
    const key = `${state.round}-${seconds}`
    if (lastTick.current === key) return
    lastTick.current = key
    playSfx('tick')
  }, [seconds, state.round])
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

function TopBar({ state, now }: { state: FpState; now: () => number }) {
  const t = useServerNow(now, 250)
  const chaos = state.chaos ? CHAOS_BY_ID[state.chaos] : null
  const playing = state.phase === 'play'
  const left = state.deadline === null ? 0 : state.deadline - t
  const urgent = playing && left <= 10_000
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <Typography sx={{ fontSize: 'clamp(2.4rem, 3.4vw, 3.6rem)', lineHeight: 1 }} className="fp-wiggle">
          🏭
        </Typography>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', lineHeight: 1, color: ACCENT.light }}>Fábrica de Presentes</Typography>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: TEXT_BIG, letterSpacing: '0.12em', color: 'var(--text-secondary)', lineHeight: 1.1 }}>
            RODADA {state.round}/{state.totalRounds}
          </Typography>
        </Box>
      </Box>
      {chaos && (
        <Box className="animate-pop-in" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1, borderRadius: 999, border: `3px solid ${GOLD}`, background: withAlpha(GOLD, 0.14) }}>
          <Typography sx={{ fontSize: TEXT_BIG, lineHeight: 1 }}>{chaos.icon}</Typography>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800, color: GOLD, lineHeight: 1.1 }}>{chaos.title}</Typography>
        </Box>
      )}
      {playing && (
        <Box
          className={urgent ? 'animate-urgent' : undefined}
          sx={{
            px: 3,
            py: 0.5,
            borderRadius: 4,
            border: `5px solid ${urgent ? XMAS_COLORS.red : ACCENT.main}`,
            background: `radial-gradient(circle at 30% 25%, ${withAlpha(urgent ? XMAS_COLORS.red : ACCENT.main, 0.4)}, rgba(6, 16, 31, 0.85) 70%)`,
            boxShadow: `0 0 26px ${withAlpha(urgent ? XMAS_COLORS.red : ACCENT.main, 0.45)}`,
          }}
        >
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 4.4vw, 4.8rem)', lineHeight: 1 }}>⏱ {clockText(left)}</Typography>
        </Box>
      )}
    </Box>
  )
}

function Panel({ color, children, sx }: { color: string; children: ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: '26px',
        border: `4px solid ${color}`,
        background: `linear-gradient(180deg, ${withAlpha(color, 0.24)}, rgba(6, 16, 31, 0.9) 38%)`,
        boxShadow: `0 0 34px ${withAlpha(color, 0.3)}`,
        p: { xs: 1.5, md: 2.25 },
        minWidth: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

const MARK: Record<StepStatus, string> = { done: '✓', next: '👉', held: '⏳', todo: '' }

/** O pedido da vez: quem pediu e as peças na ordem, com o relógio do pedido. */
function Ticket({ team, t }: { team: Team; t: number }) {
  const order = team.order
  if (!order) return null
  const statuses = stepStatuses(team)
  const frac = orderFraction(team, t)
  const hurry = frac < 0.3
  return (
    <Box
      key={order.n}
      className="animate-pop-in"
      sx={{
        position: 'relative',
        background: `linear-gradient(180deg, ${CREAM}, #f3e3bf)`,
        color: INK,
        borderRadius: '14px',
        p: { xs: 1.25, md: 1.75 },
        boxShadow: '0 10px 26px rgba(0,0,0,0.45)',
        transform: 'rotate(-1deg)',
        '& p': { color: 'inherit' },
        minWidth: 0,
      }}
    >
      {order.vip && (
        <Box sx={{ position: 'absolute', top: -18, right: -10, px: 1.5, py: 0.5, borderRadius: 999, background: GOLD, color: INK, fontWeight: 900, fontSize: TEXT, boxShadow: `0 0 18px ${withAlpha(GOLD, 0.8)}`, transform: 'rotate(8deg)' }}>
          ⭐ VIP ×2
        </Box>
      )}
      <Typography sx={{ fontWeight: 800, fontSize: TEXT_BIG, lineHeight: 1.1, wordBreak: 'break-word' }}>
        <span style={{ fontSize: '1.3em' }}>{order.emoji}</span> {order.to}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
        {order.parts.map((part, index) => {
          const status = statuses[index]
          return (
            <Box
              key={`${part}-${index}`}
              className={status === 'next' ? 'fp-next' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1,
                py: 0.5,
                borderRadius: '12px',
                background: status === 'done' ? 'rgba(31, 157, 85, 0.18)' : status === 'next' ? 'rgba(245, 194, 66, 0.35)' : status === 'held' ? 'rgba(74, 168, 255, 0.18)' : 'transparent',
                opacity: status === 'todo' ? 0.75 : 1,
              }}
            >
              <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: TEXT, minWidth: '1.2ch', opacity: 0.6 }}>{index + 1}</Typography>
              <PartIcon part={part} size="clamp(36px, 3vw, 52px)" />
              <Typography sx={{ flex: 1, fontWeight: 800, fontSize: TEXT, lineHeight: 1.1, textDecoration: status === 'done' ? 'line-through' : 'none' }}>{partOf(part).name}</Typography>
              <Typography sx={{ fontSize: TEXT, fontWeight: 900, color: status === 'done' ? '#1f7a45' : INK }}>{MARK[status]}</Typography>
            </Box>
          )
        })}
      </Box>
      <Box sx={{ mt: 1.25, height: 14, borderRadius: 999, background: 'rgba(58, 26, 10, 0.18)', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${Math.round(frac * 100)}%`,
            borderRadius: 999,
            transition: 'width 300ms linear',
            background: hurry
              ? XMAS_COLORS.red
              : 'repeating-linear-gradient(135deg, #e8394a 0 10px, #fff6dc 10px 20px)',
          }}
        />
      </Box>
    </Box>
  )
}

/** Recortes de papel voando na bagunça. */
function Scraps({ seed }: { seed: number }) {
  const colors = ['#e8394a', '#2fbf6a', '#f5c242', '#4aa8ff', '#fff6dc', '#ff8c95']
  return (
    <>
      {colors.map((color, index) => {
        const angle = ((seed % 97) + index * 61) % 360
        const dx = Math.round(Math.cos((angle * Math.PI) / 180) * 140)
        const dy = Math.round(Math.sin((angle * Math.PI) / 180) * 110 + 40)
        const vars = { '--fp-dx': `${dx}px`, '--fp-dy': `${dy}px`, '--fp-rot': `${(index % 2 ? 1 : -1) * 260}deg` } as CSSProperties
        return (
          <Box
            key={index}
            className="fp-scrap"
            style={vars}
            sx={{ position: 'absolute', left: '50%', top: '55%', width: 18, height: 12, background: color, borderRadius: '2px' }}
          />
        )
      })}
    </>
  )
}

/** A bancada: o presente na esteira, as peças adiantadas e o efeito do último acontecimento. */
function Bench({ team, t, look }: { team: Team; t: number; look: { color: string } }) {
  const order = team.order
  const flash = flashActive(team, t) ? team.flash : null
  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minHeight: 'clamp(240px, 26vh, 340px)', minWidth: 0 }}>
      {team.held.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {team.held.map((held) => {
            const secs = Math.max(0, Math.ceil((held.until - t) / 1000))
            return (
              <Box key={held.p} className="fp-bob" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, py: 0.5, borderRadius: '14px', border: `3px dashed ${secs <= 2 ? XMAS_COLORS.red : '#4aa8ff'}`, background: 'rgba(6, 16, 31, 0.7)' }}>
                <PartIcon part={held.p} size="clamp(40px, 3.4vw, 58px)" />
                <Typography sx={{ fontWeight: 900, fontSize: TEXT, color: secs <= 2 ? XMAS_COLORS.red : '#9fd2ff', lineHeight: 1 }}>⏳ {Math.min(secs, HOLD_MS / 1000)}</Typography>
              </Box>
            )
          })}
        </Box>
      )}
      {order && (
        <GiftArt
          key={`${order.n}-${team.line.mess}`}
          parts={placedParts(team)}
          box={boxOf(order.parts)}
          size="clamp(170px, 13vw, 250px)"
          className="animate-pop-in"
        />
      )}
      <Box className="fp-belt" sx={{ mt: 0.5, width: '100%', height: 24, borderRadius: '10px', backgroundColor: '#33435c', border: `3px solid ${withAlpha(look.color, 0.6)}` }} />
      {flash && (
        <Box key={flash.at} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
          {flash.kind === 'done' && (
            <>
              <Box sx={{ position: 'absolute', bottom: 24 }}>
                <GiftArt parts={flash.parts} size="clamp(170px, 13vw, 250px)" className="fp-to-sleigh" />
              </Box>
              <Typography className="fp-float-up" sx={{ position: 'relative', fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 4.4vw, 5rem)', color: GOLD, textShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 30px rgba(245,194,66,0.6)' }}>
                {pointsText(flash.points)} 🛷
              </Typography>
            </>
          )}
          {flash.kind === 'mess' && (
            <>
              <Box sx={{ position: 'absolute', bottom: 24 }}>
                <GiftArt parts={flash.parts} size="clamp(150px, 11vw, 220px)" className="fp-mess" />
              </Box>
              <Scraps seed={flash.at} />
              <Typography className="animate-shake" sx={{ position: 'relative', fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.8rem, 4vw, 4.6rem)', color: XMAS_COLORS.red, textShadow: '0 4px 0 rgba(0,0,0,0.55)', transform: 'rotate(-6deg)' }}>
                BAGUNÇA! −5
              </Typography>
            </>
          )}
          {flash.kind === 'lost' && (
            <Typography className="fp-float-up" sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.4rem, 3.4vw, 3.8rem)', color: '#9fd2ff', textShadow: '0 4px 0 rgba(0,0,0,0.55)' }}>
              💨 {flash.emoji} desistiu!
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

function Ticker({ log, players }: { log: LogEntry[]; players: HPlayer[] }) {
  const recent = log.slice(-3).reverse()
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minHeight: '4.4em' }}>
      {recent.map((entry, index) => (
        <Typography
          key={`${entry.at}-${entry.by}-${entry.n}`}
          noWrap
          className={index === 0 ? 'animate-pop-in' : undefined}
          sx={{
            fontSize: TEXT,
            fontWeight: 700,
            opacity: 1 - index * 0.28,
            color: entry.r === 'mess' || entry.r === 'drop' ? '#ff8c95' : entry.r === 'ok' ? '#8ef0ae' : 'var(--text-secondary)',
          }}
        >
          {RESULT_ICON[entry.r]} {nameOf(players, entry.by)} · {partOf(entry.p).name}
        </Typography>
      ))}
    </Box>
  )
}

/** Uma esteira (metade da tela). */
function Line({ state, team, players, now }: { state: FpState; team: Team; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now, 250)
  const look = teamLook(state, team.id)
  const next = upcoming(state, team, 2)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Panel color={look.color} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: TEXT_BIG, lineHeight: 1 }}>{look.icon}</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: TEXT_BIG, color: look.light, lineHeight: 1.05 }}>{look.name}</Typography>
          <Typography noWrap sx={{ fontSize: 'clamp(1.1rem, 1.3vw, 1.5rem)', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {team.members.map((id) => `${online.has(id) ? '' : '💤'}${nameOf(players, id)}`).join(' · ')}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 0.95 }}>{team.score}</Typography>
          <Typography sx={{ fontSize: 'clamp(1rem, 1.2vw, 1.3rem)', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>PONTOS</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 2, alignItems: 'end' }}>
        <Ticket team={team} t={t} />
        <Bench team={team} t={t} look={look} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 'auto' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 'clamp(1rem, 1.2vw, 1.3rem)', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.1em' }}>PRÓXIMOS</Typography>
          {next.map((order) => (
            <Typography key={order.n} noWrap sx={{ fontSize: 'clamp(1.2rem, 1.4vw, 1.6rem)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {order.emoji} {order.to} {order.vip ? '⭐' : ''}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box className="fp-sleigh-ride">
            <Sleigh count={team.line.done} size={110} colors={[look.color, GOLD, CREAM]} />
          </Box>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT_BIG }}>×{team.line.done}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrashBin count={team.line.mess} size={58} />
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: TEXT_BIG, color: team.line.mess ? '#ff8c95' : 'var(--text-muted)' }}>{team.line.mess}</Typography>
        </Box>
      </Box>
      <Ticker log={team.log} players={players} />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

const RULES: [string, string][] = [
  ['📋', 'O pedido do seu time aparece na TV'],
  ['📱', 'Cada peça está no celular de UMA pessoa'],
  ['📣', 'Gritem: “quem tem o laço dourado?!”'],
  ['👆', 'Toque na ordem: caixa → papel → laço → etiqueta'],
  ['💥', 'Peça errada = BAGUNÇA (−5)'],
]

function TeamRoster({ state, team, players }: { state: FpState; team: Team; players: HPlayer[] }) {
  const look = teamLook(state, team.id)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const size = team.members.length > 5 ? 'md' : 'lg'
  return (
    <Panel color={look.color} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: TEXT_BIG, color: look.light }}>
        {look.icon} {look.name}
        {team.timeMul > 1 && (
          <Box component="span" sx={{ ml: 1.5, fontSize: TEXT, color: GOLD }}>
            ⏳ +{Math.round((team.timeMul - 1) * 100)}% de tempo
          </Box>
        )}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {team.members.map((id) => (
          <PlayerBadge key={id} playerId={id} name={nameOf(players, id)} color={look.color} size={size} offline={!online.has(id)} />
        ))}
      </Box>
    </Panel>
  )
}

function BriefBoard({ state, players, now }: { state: FpState; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now, 250)
  const chaos = state.chaos ? CHAOS_BY_ID[state.chaos] : null
  const secs = state.deadline === null ? 0 : Math.max(0, Math.ceil((state.deadline - t) / 1000))
  const teams = state.teams ?? []
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box className="animate-pop-in" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap', textAlign: 'center' }}>
        <GiftArt parts={['cx-gigante', 'pp-listrado', 'lc-dourado', 'et-te-amo']} size="clamp(120px, 10vw, 180px)" className="fp-wiggle" />
        <Box>
          <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: TITLE, lineHeight: 1, color: ACCENT.light, textShadow: `0 0 30px ${ACCENT.glow}` }}>
            {state.round <= 1 ? 'A fábrica abriu!' : `Rodada ${state.round}`}
          </Typography>
          <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>📱 Peças novas nos celulares — confiram quem tem o quê!</Typography>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {state.coop ? 'Todo mundo no mesmo time, contra o relógio!' : 'Mesmos pedidos para os dois times: quem embrulha mais?'} · valendo em {secs} s
          </Typography>
        </Box>
        <GiftArt parts={['cx-redonda', 'pp-xadrez', 'lc-verde']} size="clamp(110px, 9vw, 160px)" className="fp-wiggle" />
      </Box>
      {chaos && (
        <Box className="animate-pop-in" sx={{ mx: 'auto', maxWidth: 1300, width: '100%', display: 'flex', alignItems: 'center', gap: 3, p: 2.5, borderRadius: '24px', border: `4px solid ${GOLD}`, background: `linear-gradient(90deg, ${withAlpha(GOLD, 0.22)}, rgba(6,16,31,0.85))`, boxShadow: `0 0 40px ${withAlpha(GOLD, 0.35)}` }}>
          <Typography className="fp-wiggle" sx={{ fontSize: 'clamp(4rem, 6vw, 6rem)', lineHeight: 1 }}>{chaos.icon}</Typography>
          <Box>
            <Typography sx={{ fontSize: TEXT, fontWeight: 800, letterSpacing: '0.16em', color: GOLD }}>IMPREVISTO NA FÁBRICA</Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2.4rem, 3.4vw, 3.8rem)', lineHeight: 1.05 }}>{chaos.title}</Typography>
            <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 700, color: 'var(--text-secondary)' }}>{chaos.text}</Typography>
          </Box>
        </Box>
      )}
      {state.round <= 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 1.5 }}>
          {RULES.map(([icon, text], index) => (
            <Box key={text} className="stagger-in" style={{ animationDelay: `${index * 120}ms` }} sx={{ p: 1.5, borderRadius: '18px', background: 'rgba(255,255,255,0.06)', border: '2px solid var(--border-medium)', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 'clamp(2.2rem, 3vw, 3rem)', lineHeight: 1 }}>{icon}</Typography>
              <Typography sx={{ fontSize: TEXT, fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>{text}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: teams.length > 1 ? '1fr 1fr' : 'minmax(0, 1200px)', justifyContent: 'center', gap: 2.5 }}>
        {teams.map((team) => (
          <TeamRoster key={team.id} state={state} team={team} players={players} />
        ))}
      </Box>
    </Box>
  )
}

function StatRow({ icon, label, value, color }: { icon: string; label: string; value: ReactNode; color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ fontSize: TEXT_BIG, lineHeight: 1, width: '1.4em' }}>{icon}</Typography>
      <Typography sx={{ flex: 1, fontSize: TEXT_BIG, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</Typography>
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color: color ?? 'var(--text-primary)' }}>{value}</Typography>
    </Box>
  )
}

function leaderLine(state: FpState): string {
  if (state.coop) return `Até agora: ${starsText(coopStars(state))}`
  const win = winningTeam(state)
  if (!win) return '🤝 Empatados! Tudo pode acontecer.'
  const [a, b] = state.teams
  return `${teamLook(state, win).icon} ${teamLook(state, win).name} na frente por ${Math.abs(a.score - b.score)}!`
}

function TallyBoard({ state, players }: { state: FpState; players: HPlayer[] }) {
  const teams = state.teams ?? []
  const last = state.round >= state.totalRounds
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box className="animate-pop-in" sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: TITLE, lineHeight: 1, color: ACCENT.light }}>Fim da rodada {state.round}!</Typography>
        <Typography sx={{ fontSize: TEXT_BIG, fontWeight: 800 }}>{leaderLine(state)}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: teams.length > 1 ? '1fr 1fr' : 'minmax(0, 900px)', justifyContent: 'center', gap: 2.5 }}>
        {teams.map((team, index) => {
          const look = teamLook(state, team.id)
          return (
            <Panel key={team.id} color={look.color} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box className="stagger-in" style={{ animationDelay: `${index * 200}ms` }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: TEXT_BIG, color: look.light }}>
                  {look.icon} {look.name}
                </Typography>
                <Box className="fp-sleigh-ride">
                  <Sleigh count={team.line.done} size={150} colors={[look.color, GOLD, CREAM]} />
                </Box>
              </Box>
              <StatRow icon="🛷" label="Presentes entregues" value={team.line.done} color="#8ef0ae" />
              <StatRow icon="🗑️" label="Bagunças" value={team.line.mess} color={team.line.mess ? '#ff8c95' : undefined} />
              <StatRow icon="💨" label="Pedidos perdidos" value={team.line.lost} />
              <StatRow icon="✨" label="Pontos da rodada" value={pointsText(team.line.points)} color={GOLD} />
              <Box sx={{ borderTop: '2px solid var(--border-medium)', pt: 1, mt: 0.5 }}>
                <StatRow icon="🏆" label="Total" value={team.score} />
              </Box>
              <Typography noWrap sx={{ fontSize: TEXT, color: 'var(--text-muted)' }}>{listNames(team.members.map((id) => nameOf(players, id)))}</Typography>
            </Panel>
          )
        })}
      </Box>
      <Typography sx={{ textAlign: 'center', fontSize: TEXT_BIG, fontWeight: 700, color: 'var(--text-secondary)' }}>
        {last ? '🥁 E o resultado final…' : '🔀 Próxima rodada: as peças trocam de dono!'}
      </Typography>
    </Box>
  )
}

function FinalBoard({ state, players }: { state: FpState; players: HPlayer[] }) {
  const teams = state.teams ?? []
  const coop = state.coop || teams.length < 2
  const win = coop ? null : winningTeam(state)
  const prizes = Array.isArray(state.roster) && state.stats ? awards(state) : []
  const winLook = win ? teamLook(state, win) : null
  const stars = coop && teams.length ? coopStars(state) : 0
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <CandyRain active kind="mixed" count={36} />
      <Box className="animate-pop-in" sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', lineHeight: 1 }}>{coop ? '🎄' : win ? '🏆' : '🤝'}</Typography>
        <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: TITLE, lineHeight: 1, color: winLook?.light ?? ACCENT.light, textShadow: `0 0 34px ${withAlpha(winLook?.color ?? ACCENT.main, 0.6)}` }}>
          {coop ? `${teams[0]?.sleigh ?? 0} presentes entregues!` : winLook ? `${winLook.name} venceram!` : 'Empate na fábrica!'}
        </Typography>
        {coop && <Typography sx={{ fontSize: 'clamp(3rem, 4.4vw, 4.6rem)', lineHeight: 1.2 }}>{starsText(stars)}</Typography>}
      </Box>
      {!coop && teams.length > 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
          {teams.map((team) => {
            const look = teamLook(state, team.id)
            return (
              <Panel key={team.id} color={look.color} sx={{ display: 'flex', alignItems: 'center', gap: 2, opacity: win && win !== team.id ? 0.75 : 1 }}>
                <Sleigh count={team.sleigh} size={130} colors={[look.color, GOLD, CREAM]} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: TEXT_BIG, color: look.light }}>
                    {look.icon} {look.name} {win === team.id ? '👑' : ''}
                  </Typography>
                  <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', fontWeight: 700 }}>🛷 {team.sleigh} presentes</Typography>
                </Box>
                <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(3.4rem, 4.6vw, 5rem)' }}>{team.score}</Typography>
              </Panel>
            )
          })}
        </Box>
      )}
      {prizes.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${prizes.length}, 1fr)` }, gap: 2.5 }}>
          {prizes.map((prize, index) => (
            <Box
              key={prize.key}
              className="animate-pop-in"
              style={{ animationDelay: `${300 + index * 400}ms` }}
              sx={{ p: 2.5, borderRadius: '22px', textAlign: 'center', border: `3px solid ${prize.key === 'bagunca' ? XMAS_COLORS.red : GOLD}`, background: `linear-gradient(180deg, ${withAlpha(prize.key === 'bagunca' ? XMAS_COLORS.red : GOLD, 0.18)}, rgba(6,16,31,0.85) 60%)` }}
            >
              <Typography className="fp-wiggle" sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>{prize.icon}</Typography>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: prize.key === 'bagunca' ? '#ff8c95' : GOLD, mt: 0.5 }}>{prize.title}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', lineHeight: 1.1, wordBreak: 'break-word' }}>{listNames(prize.ids.map((id) => nameOf(players, id)))}</Typography>
              <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
                {prize.count} {prize.unit}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ textAlign: 'center', fontSize: TEXT_BIG, fontWeight: 700, color: 'var(--text-secondary)', mt: 'auto' }}>🎅 O Papai Noel agradece, elfos! Feliz Natal!</Typography>
    </Box>
  )
}
