import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakFestive, useMusic } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useServerNow } from '../../framework/clockHooks'
import { CREEPY_FONT, CandyRain, FESTIVE_ROUND_FONT, PlayerBadge, XMAS_COLORS, withAlpha } from '../../ui'
import { EVENT_INFO, STATION_INFO, type Station } from './content'
import {
  PREP_SECONDS,
  PREP_SECONDS_FIRST,
  awards,
  championTeam,
  matchDecided,
  orderReady,
  seatOf,
  tapsNeeded,
  type CozinhaState,
  type Item,
  type Kitchen,
  type Order,
  type Team,
} from './engine'
import './cozinha.css'
import {
  FINAL_COUNTDOWN_MS,
  POP_SHOW_MS,
  burnFraction,
  clockText,
  cookFraction,
  dishOf,
  finalLine,
  firstName,
  heatStatus,
  holdersOf,
  orderParts,
  patienceColor,
  patienceFraction,
  plural,
  prepLine,
  signed,
  starsText,
  tallyLine,
  type HeatStatus,
} from './view'

/**
 * TV da Cozinha da Ceia: as duas cozinhas lado a lado (ou uma só, no time
 * único), cada uma com a fila de tickets de pedido, as cinco estações, as
 * panelas chiando e a fumacinha quando algo está queimando. Só desenha o
 * estado — quem decide é o motor. Letras para 3 metros.
 */

type Props = HalloweenViewProps<CozinhaState>

export default function Tv({ state, players, now }: Props) {
  useMusic(state.over ? 'wish' : 'jingle')
  const t = useServerNow(now, 250)
  useTvSounds(state, t, now)
  // Estado de outro formato (partida velha): o motor encerra no próximo passo.
  const ours = Array.isArray(state.teams) && Array.isArray(state.kitchens) && Array.isArray(state.history)
  if (!ours) return <Notice text={state.over ? '🎄 Fim de jogo!' : '🎄 Preparando a cozinha…'} />
  if (state.over) return <FinalBoard state={state} players={players} />
  if (state.phase === 'prep') return <PrepBoard state={state} players={players} t={t} />
  if (state.phase === 'tally') return <TallyBoard state={state} t={t} />
  if (state.phase === 'cook') return <KitchenBoard state={state} players={players} t={t} />
  return <Notice text="🎄 Preparando a cozinha…" />
}

function Notice({ text }: { text: string }) {
  return (
    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 5vw, 5rem)', color: XMAS_COLORS.gold }}>{text}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som e voz: uma vez por momento, nunca a cada poll
// ---------------------------------------------------------------------------

function useTvSounds(state: CozinhaState, t: number, now: () => number) {
  const ours = Array.isArray(state.teams) && Array.isArray(state.kitchens) && Array.isArray(state.history)
  const phase = !ours ? 'other' : state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const hasEvent = phase === 'prep' && state.event !== null
  const prepText = phase === 'prep' ? prepLine(state) : ''
  const tallyText = phase === 'tally' ? tallyLine(state) : ''
  const finalText = phase === 'final' ? finalLine(state) : ''
  const tallyWinner = phase === 'tally' ? (state.history[state.history.length - 1]?.winner ?? null) : null

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let stopVoice: (() => void) | null = null
    const later = (ms: number, run: () => void) => timers.push(setTimeout(run, ms))
    if (phase === 'prep') {
      playSfx('sleigh', { volume: 0.8 })
      if (hasEvent) playSfx('boing', { delay: 0.7 })
      later(1100, () => (stopVoice = speakFestive(prepText)))
    } else if (phase === 'cook') {
      playSfx('ding')
      playSfx('whoosh', { delay: 0.15 })
    } else if (phase === 'tally') {
      const roll = playSfx('drumroll', { volume: 0.8 })
      playSfx(tallyWinner === null ? 'chime' : 'win', { delay: roll })
      later(Math.round(roll * 1000) + 700, () => (stopVoice = speakFestive(tallyText)))
    } else if (phase === 'final') {
      playSfx('win')
      playSfx('hohoho', { delay: 1 })
      later(2600, () => (stopVoice = speakFestive(finalText)))
    }
    return () => {
      timers.forEach(clearTimeout)
      stopVoice?.()
    }
  }, [moment, phase, hasEvent, prepText, tallyText, finalText, tallyWinner])

  // Entregou, esgotou, queimou: um som por acontecimento de cada cozinha.
  const popKey = phase === 'cook' ? state.kitchens.map((kitchen) => `${kitchen.pop?.n ?? 0}:${kitchen.pop?.kind ?? ''}`).join('|') : ''
  const lastPops = useRef('')
  useEffect(() => {
    const before = lastPops.current.split('|')
    lastPops.current = popKey
    if (!popKey) return
    popKey.split('|').forEach((entry, index) => {
      if (!entry || entry === before[index] || entry.startsWith('0:')) return
      const kind = entry.split(':')[1]
      if (kind === 'serve') {
        playSfx('ding', { volume: 0.9 })
        playSfx('chime', { volume: 0.7, delay: 0.15 })
      } else if (kind === 'miss') {
        playSfx('fail', { volume: 0.45 })
      } else if (kind === 'burn') {
        playSfx('buzzer', { volume: 0.45 })
        playSfx('boing', { volume: 0.6, delay: 0.3 })
      }
    })
  }, [popKey])

  // Algo começou a fumegar: um chiado curto (uma vez por panela).
  const smoking =
    phase === 'cook'
      ? state.kitchens
          .flatMap((kitchen) => kitchen.items)
          .filter((item) => item.ph === 'cook' && !item.pick && heatStatus(item, t, state.burnMs) === 'smoking')
          .map((item) => item.id)
          .sort((a, b) => a - b)
          .join(',')
      : ''
  const lastSmoke = useRef('')
  useEffect(() => {
    const before = new Set(lastSmoke.current.split(',').filter(Boolean))
    lastSmoke.current = smoking
    if (smoking.split(',').some((id) => id && !before.has(id))) playSfx('fuse', { volume: 0.35 })
  }, [smoking])

  // Tique-taque nos 10 s finais da cozinha.
  const deadline = phase === 'cook' ? state.deadline : null
  useEffect(() => {
    if (deadline === null) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = () => {
      const left = deadline - now()
      if (left <= 0) return
      if (left > FINAL_COUNTDOWN_MS) {
        timer = setTimeout(loop, left - FINAL_COUNTDOWN_MS)
        return
      }
      playSfx('tick', { volume: 0.5 + 0.5 * (1 - left / FINAL_COUNTDOWN_MS) })
      timer = setTimeout(loop, Math.max(200, (left % 1000) || 1000))
    }
    loop()
    return () => clearTimeout(timer)
  }, [deadline, now])
}

// ---------------------------------------------------------------------------
// Pecinhas
// ---------------------------------------------------------------------------

function TeamTitle({ team, size = '2.4rem' }: { team: Team; size?: string }) {
  return (
    <Typography
      noWrap
      sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: size, lineHeight: 1.05, color: team.color, textShadow: `0 0 18px ${withAlpha(team.color, 0.5)}` }}
    >
      {team.emoji} {team.name}
    </Typography>
  )
}

function Bar({ fraction, color, height = 10 }: { fraction: number; color: string; height?: number }) {
  return (
    <Box sx={{ width: '100%', height, borderRadius: 999, background: 'rgba(0, 0, 0, 0.35)', overflow: 'hidden' }}>
      <Box sx={{ width: `${Math.round(fraction * 100)}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 250ms linear, background 400ms ease' }} />
    </Box>
  )
}

function Pips({ done, total, color = XMAS_COLORS.gold }: { done: number; total: number; color?: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, index) => (
        <Box
          key={index}
          component="span"
          sx={{ width: 16, height: 16, borderRadius: '50%', border: `3px solid ${color}`, background: index < done ? color : 'transparent' }}
        />
      ))}
    </Box>
  )
}

function Smoke({ steam = false }: { steam?: boolean }) {
  return (
    <Box component="span" className={`cz-smoke${steam ? ' cz-steam' : ''}`} aria-hidden>
      <span>☁️</span>
      <span>☁️</span>
      <span>☁️</span>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Pré-rodada: times, estações e o imprevisto
// ---------------------------------------------------------------------------

function PrepBoard({ state, players, t }: { state: CozinhaState; players: HPlayer[]; t: number }) {
  const left = Math.max(0, (state.deadline ?? t) - t)
  const total = (state.round <= 1 ? PREP_SECONDS_FIRST : PREP_SECONDS) * 1000
  const event = state.event ? EVENT_INFO[state.event] : null
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 5vw, 5.2rem)', lineHeight: 1, color: XMAS_COLORS.gold, textShadow: '0 0 24px rgba(245, 194, 66, 0.5)' }}>
          <span className="cz-wobble">🧑‍🍳</span> {`Rodada ${state.round} de ${state.totalRounds}`}
        </Typography>
        <Typography sx={{ fontSize: 'clamp(1.6rem, 2vw, 2.2rem)', color: 'var(--text-secondary)', mt: 0.5 }}>
          {state.solo ? 'Todos juntos contra o relógio!' : 'Olhem o celular: cada um tem a sua estação!'}
        </Typography>
      </Box>
      {event && (
        <Box
          className="cz-boing"
          sx={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 2.5, px: 4, py: 1.5, borderRadius: 4, background: 'linear-gradient(135deg, #c21f33, #7a1020)', border: `4px solid ${XMAS_COLORS.gold}`, boxShadow: '0 0 40px rgba(232, 57, 74, 0.55)' }}
        >
          <Box sx={{ fontSize: 'clamp(3.5rem, 5vw, 5rem)', lineHeight: 1 }}>{event.emoji}</Box>
          <Box>
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', lineHeight: 1.05, color: '#fff6dc' }}>{event.title}</Typography>
            <Typography sx={{ fontSize: 'clamp(1.5rem, 1.9vw, 2rem)', color: '#ffe3a1' }}>{event.text}</Typography>
          </Box>
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: state.teams.length > 1 ? '1fr 1fr' : '1fr', gap: 3, flex: 1, minHeight: 0, alignContent: 'center' }}>
        {state.teams.map((team, index) => (
          <Box key={index} className="cz-kitchen" style={{ ['--cz-team' as string]: team.color }} sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
            <TeamTitle team={team} size="clamp(2.2rem, 3vw, 3rem)" />
            {team.wins > 0 && (
              <Typography sx={{ fontSize: '1.8rem', color: XMAS_COLORS.gold }}>{'🏆'.repeat(team.wins)} {team.wins === 1 ? 'rodada ganha' : 'rodadas ganhas'}</Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
              {team.players.map((id) => {
                const seat = seatOf(state, id)
                const player = players.find((p) => p.id === id)
                return (
                  <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <PlayerBadge name={nameOf(players, id)} playerId={id} acted={state.acted.includes(id)} offline={player ? !player.online : false} size="lg" />
                    <Typography noWrap sx={{ fontSize: 'clamp(1.5rem, 1.9vw, 2rem)', color: 'var(--text-secondary)', minWidth: 0 }}>
                      {seat.length ? seat.map((st) => `${STATION_INFO[st].emoji} ${STATION_INFO[st].name}`).join(' · ') : '🆘 reforço'}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>
      <HowItFlows />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(1.6rem, 2vw, 2.2rem)', color: 'var(--text-muted)' }}>Todo mundo apertou “Pronto”? Começa já. Senão, em</Typography>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '3rem', color: XMAS_COLORS.gold, lineHeight: 1 }}>{Math.ceil(left / 1000)}</Typography>
        <Box sx={{ width: 220 }}>
          <Bar fraction={Math.min(1, left / total)} color={XMAS_COLORS.gold} height={14} />
        </Box>
      </Box>
    </Box>
  )
}

/** O caminho de um prato, em três quadrinhos (para quem nunca jogou). */
function HowItFlows() {
  const steps = [
    { icon: '🔪🥣', title: 'Prepare', text: 'toques rápidos na tábua e na tigela' },
    { icon: '🍳🔥', title: 'Cozinhe', text: 'ponha no fogo e TIRE antes de queimar' },
    { icon: '🎁', title: 'Monte e entregue', text: 'no balcão, antes do pedido esgotar' },
  ]
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 1.5 }}>
      {steps.map((step, index) => (
        <Box key={step.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {index > 0 && <Typography sx={{ fontSize: '2.6rem', color: XMAS_COLORS.gold }}>➜</Typography>}
          <Box className="animate-deal-in" style={{ animationDelay: `${300 + index * 300}ms` }} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.25, borderRadius: 4, background: 'rgba(255, 249, 234, 0.08)', border: '2px solid rgba(245, 194, 66, 0.5)' }}>
            <Box sx={{ fontSize: '2.8rem', lineHeight: 1 }}>{step.icon}</Box>
            <Box>
              <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(1.6rem, 2vw, 2.1rem)', lineHeight: 1.05, color: XMAS_COLORS.gold }}>{step.title}</Typography>
              <Typography sx={{ fontSize: 'clamp(1.2rem, 1.45vw, 1.5rem)', color: 'var(--text-secondary)', lineHeight: 1.15 }}>{step.text}</Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// A cozinha rolando
// ---------------------------------------------------------------------------

function KitchenBoard({ state, players, t }: { state: CozinhaState; players: HPlayer[]; t: number }) {
  const left = Math.max(0, (state.deadline ?? t) - t)
  const urgent = left <= FINAL_COUNTDOWN_MS
  const event = state.event ? EVENT_INFO[state.event] : null
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.3vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.1em', lineHeight: 1 }}>
          🎄 RODADA {state.round}/{state.totalRounds}
        </Typography>
        {event && (
          <Typography noWrap sx={{ px: 2, py: 0.5, borderRadius: 999, background: 'rgba(194, 31, 51, 0.85)', border: `2px solid ${XMAS_COLORS.gold}`, fontWeight: 800, fontSize: 'clamp(1.4rem, 1.8vw, 2rem)', color: '#fff6dc', minWidth: 0 }}>
            {event.emoji} {event.title}
          </Typography>
        )}
        <Typography
          className={urgent ? 'animate-urgent' : undefined}
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3rem, 4.4vw, 4.6rem)', lineHeight: 1, color: urgent ? '#ff4d5e' : XMAS_COLORS.gold, textShadow: `0 0 20px ${urgent ? 'rgba(255, 77, 94, 0.7)' : 'rgba(245, 194, 66, 0.5)'}` }}
        >
          ⏱ {clockText(left)}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: state.teams.length > 1 ? '1fr 1fr' : '1fr', gap: 2, flex: 1, minHeight: 0 }}>
        {state.teams.map((_, index) => (
          <KitchenPanel key={index} state={state} team={index} players={players} t={t} />
        ))}
      </Box>
    </Box>
  )
}

function KitchenPanel({ state, team, players, t }: { state: CozinhaState; team: number; players: HPlayer[]; t: number }) {
  const info = state.teams[team]
  const kitchen = state.kitchens[team]
  if (!info || !kitchen) return null
  const wide = state.teams.length === 1
  const area = (st: Station) => ({ gridArea: st })
  return (
    <Box className="cz-kitchen" style={{ ['--cz-team' as string]: info.color }} sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <TeamTitle team={info} size="clamp(1.8rem, 2.3vw, 2.6rem)" />
          <Typography noWrap sx={{ fontSize: 'clamp(1.2rem, 1.4vw, 1.5rem)', color: 'var(--text-muted)' }}>
            {`🍽️ ${plural(kitchen.delivered, 'entregue')} · ⌛ ${plural(kitchen.missed, 'esgotado')} · 🔥 ${plural(kitchen.burnt, 'queimado')}`}
            {info.wins > 0 ? ` · ${'🏆'.repeat(info.wins)}` : ''}
          </Typography>
        </Box>
        <Typography key={kitchen.score} className="animate-pop-in" sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3rem, 4.2vw, 4.4rem)', lineHeight: 1, color: info.color, flexShrink: 0 }}>
          {kitchen.score}
        </Typography>
      </Box>

      {/* Fila de pedidos */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${wide ? 6 : 4}, minmax(0, 1fr))`, gap: 1.25, minHeight: 0 }}>
        {kitchen.orders.slice(0, wide ? 6 : 4).map((order) => (
          <OrderTicket key={order.id} kitchen={kitchen} order={order} t={t} />
        ))}
        {!kitchen.orders.length && (
          <Typography sx={{ gridColumn: '1 / -1', fontSize: '1.6rem', color: 'var(--text-muted)', textAlign: 'center', py: 2 }}>🔔 Pedido novo chegando…</Typography>
        )}
      </Box>
      {kitchen.orders.length > (wide ? 6 : 4) && (
        <Typography sx={{ fontSize: '1.3rem', color: 'var(--text-muted)', mt: -0.5 }}>+{kitchen.orders.length - (wide ? 6 : 4)} na fila</Typography>
      )}

      {/* Estações */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: wide ? 'repeat(5, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))',
          gridTemplateAreas: wide ? '"tabua tigela fogao forno balcao"' : '"tabua tabua tigela tigela balcao balcao" "fogao fogao fogao forno forno forno"',
          gridAutoRows: 'minmax(0, 1fr)',
        }}
      >
        {(['tabua', 'tigela', 'fogao', 'forno', 'balcao'] as const).map((st) => (
          <StationTile key={st} state={state} team={team} st={st} players={players} t={t} sx={area(st)} />
        ))}
      </Box>

      <PopBurst kitchen={kitchen} t={t} />
    </Box>
  )
}

function OrderTicket({ kitchen, order, t }: { kitchen: Kitchen; order: Order; t: number }) {
  const dish = dishOf(order.d)
  const fraction = patienceFraction(order, t)
  const ready = orderReady(kitchen, order.id)
  const parts = orderParts(kitchen, order.id)
  return (
    <Box
      className={`cz-ticket${ready ? ' cz-glow' : fraction < 0.2 ? ' cz-hurry' : ''}`}
      sx={{ p: 1, pb: 1.25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}
    >
      <Box sx={{ position: 'relative', fontSize: 'clamp(2.4rem, 3vw, 3.2rem)', lineHeight: 1 }}>
        {dish.emoji}
        {order.vip && <Box component="span" sx={{ position: 'absolute', top: -14, right: -22, fontSize: '1.7rem' }}>👵</Box>}
      </Box>
      <Typography noWrap sx={{ fontWeight: 800, fontSize: 'clamp(1.05rem, 1.25vw, 1.35rem)', lineHeight: 1.1, color: '#2a1a06', maxWidth: '100%' }}>
        {dish.name}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, fontSize: '1.35rem', lineHeight: 1 }}>
        {parts.map((part, index) => (
          <Box key={index} component="span" sx={{ opacity: part.done ? 1 : 0.85, filter: part.burnt ? 'grayscale(1)' : 'none' }}>
            {part.done ? '✅' : part.burnt ? '💨' : STATION_INFO[part.st].emoji}
          </Box>
        ))}
      </Box>
      {ready ? (
        <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: '#a3172a', lineHeight: 1 }}>🎁 MONTAR!</Typography>
      ) : (
        <Bar fraction={fraction} color={patienceColor(fraction)} height={9} />
      )}
      {order.vip && <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#a3172a', lineHeight: 1 }}>DA VÓ · ×2</Typography>}
    </Box>
  )
}

function StationTile({ state, team, st, players, t, sx }: { state: CozinhaState; team: number; st: Station; players: HPlayer[]; t: number; sx: Record<string, unknown> }) {
  const kitchen = state.kitchens[team]
  const info = STATION_INFO[st]
  const holders = holdersOf(state, team, st)
  const online = new Set(players.filter((p) => p.online).map((p) => p.id))
  const nobody = holders.length > 0 && holders.every((id) => !online.has(id))
  return (
    <Box
      sx={{
        ...sx,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 3,
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        background: 'rgba(6, 16, 31, 0.72)',
        border: `2px solid ${nobody ? '#ff4d5e' : 'var(--border-medium)'}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 'clamp(1.3rem, 1.6vw, 1.7rem)', lineHeight: 1, flexShrink: 0 }}>
          {info.emoji} {info.name}
        </Typography>
        <Typography noWrap sx={{ fontSize: 'clamp(1rem, 1.2vw, 1.3rem)', color: nobody ? '#ff8c95' : 'var(--text-muted)', minWidth: 0 }}>
          {nobody ? 'sem ninguém! 🆘' : listNames(holders.map((id) => firstName(players, id)))}
        </Typography>
      </Box>
      {st === 'fogao' || st === 'forno' ? (
        <HeatContent state={state} team={team} st={st} t={t} />
      ) : st === 'balcao' ? (
        <CounterContent kitchen={kitchen} />
      ) : (
        <PrepContent kitchen={kitchen} st={st} />
      )}
    </Box>
  )
}

function PrepContent({ kitchen, st }: { kitchen: Kitchen; st: Station }) {
  const items = kitchen.items.filter((item) => item.st === st && item.ph === 'prep')
  if (!items.length) return <Typography sx={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>— livre —</Typography>
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignContent: 'flex-start' }}>
      {items.slice(0, 6).map((item) => (
        <Box key={item.id} className="animate-pop-in" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: 2, background: 'rgba(255, 255, 255, 0.07)' }}>
          <Box component="span" sx={{ fontSize: 'clamp(2.2rem, 2.8vw, 3rem)', lineHeight: 1 }}>{dishOf(item.d).emoji}</Box>
          <Pips done={item.taps} total={tapsNeeded(st)} />
        </Box>
      ))}
      {items.length > 6 && <Typography sx={{ fontSize: '1.3rem', color: 'var(--text-muted)' }}>+{items.length - 6}</Typography>}
    </Box>
  )
}

const STATUS_LABEL: Record<HeatStatus, string> = {
  cooking: '',
  almost: 'quase!',
  ready: 'PRONTO!',
  smoking: 'TIRA!',
  burning: 'QUEIMANDO!',
  burnt: 'QUEIMOU',
}

function HeatContent({ state, team, st, t }: { state: CozinhaState; team: number; st: 'fogao' | 'forno'; t: number }) {
  const kitchen = state.kitchens[team]
  const cap = state.capacity[team]?.[st] ?? 2
  const inside = kitchen.items.filter((item) => item.st === st && (item.ph === 'cook' || item.ph === 'burnt'))
  const waiting = kitchen.items.filter((item) => item.st === st && item.ph === 'queue')
  const slots: (Item | null)[] = Array.from({ length: Math.max(cap, inside.length) }, (_, index) => inside[index] ?? null)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minHeight: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap' }}>
        {slots.map((item, index) => (
          <HeatSlot key={item ? item.id : `empty-${index}`} item={item} st={st} t={t} burnMs={state.burnMs} size={slotSize(slots.length, state.teams.length === 1)} />
        ))}
      </Box>
      {waiting.length > 0 && (
        <Typography noWrap sx={{ fontSize: 'clamp(1.1rem, 1.3vw, 1.4rem)', color: 'var(--text-secondary)' }}>
          esperando: {waiting.map((item) => dishOf(item.d).emoji).join(' ')}
        </Typography>
      )}
    </Box>
  )
}

/** Panelas menores quando o fogão tem 3 bocas ou mais (tudo numa linha). */
function slotSize(count: number, wide: boolean): string {
  if (wide) return count >= 3 ? 'clamp(80px, 5.4vw, 120px)' : 'clamp(90px, 7.4vw, 140px)'
  return count >= 3 ? 'clamp(64px, 5vw, 104px)' : 'clamp(90px, 7.4vw, 140px)'
}

function HeatSlot({ item, st, t, burnMs, size }: { item: Item | null; st: 'fogao' | 'forno'; t: number; burnMs: number; size: string }) {
  if (!item) {
    return (
      <Box sx={{ width: size, height: size, borderRadius: st === 'fogao' ? '50%' : 3, border: '3px dashed rgba(255, 255, 255, 0.18)', display: 'grid', placeItems: 'center', fontSize: '1.6rem', opacity: 0.5 }}>
        {st === 'fogao' ? '🍳' : '🔥'}
      </Box>
    )
  }
  const status = item.pick ? 'almost' : heatStatus(item, t, burnMs)
  const burnt = status === 'burnt'
  const hot = status === 'smoking' || status === 'burning'
  const fraction = status === 'cooking' || status === 'almost' ? cookFraction(item, t) : status === 'burnt' ? 0 : burnFraction(item, t, burnMs)
  const barColor = status === 'cooking' || status === 'almost' ? XMAS_COLORS.gold : status === 'ready' ? '#4fd67e' : '#ff4d5e'
  const className = burnt ? '' : hot ? 'cz-burning' : status === 'ready' ? 'cz-ready' : 'cz-sizzle'
  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box
        className={className}
        sx={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: st === 'fogao' ? '50%' : 3,
          display: 'grid',
          placeItems: 'center',
          background: burnt
            ? 'radial-gradient(circle, #2b2b2b, #0b0b0b)'
            : st === 'fogao'
              ? 'radial-gradient(circle, #4a5568 0%, #1f2937 70%, #111827 100%)'
              : 'linear-gradient(180deg, #3b1d0e, #1c0d05)',
          border: `4px solid ${burnt ? '#555' : st === 'forno' ? '#ff7a45' : '#94a3b8'}`,
          fontSize: 'clamp(2.4rem, 3.2vw, 3.4rem)',
          filter: burnt ? 'grayscale(0.9) brightness(0.6)' : 'none',
        }}
      >
        {dishOf(item.d).emoji}
        {(hot || burnt) && <Smoke />}
        {status === 'cooking' && <Smoke steam />}
      </Box>
      <Box sx={{ width: size }}>
        <Bar fraction={fraction} color={barColor} height={8} />
      </Box>
      {STATUS_LABEL[status] && (
        <Typography sx={{ fontWeight: 900, fontSize: 'clamp(1rem, 1.2vw, 1.3rem)', lineHeight: 1, color: burnt ? '#9ca3af' : hot ? '#ff4d5e' : status === 'ready' ? '#4fd67e' : XMAS_COLORS.gold }}>
          {item.pick ? 'saindo!' : STATUS_LABEL[status]}
        </Typography>
      )}
    </Box>
  )
}

function CounterContent({ kitchen }: { kitchen: Kitchen }) {
  const ready = kitchen.orders.filter((order) => orderReady(kitchen, order.id))
  const done = kitchen.items.filter((item) => item.ph === 'done' && !ready.some((order) => order.id === item.o))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {ready.length ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {ready.map((order) => (
            <Box key={order.id} className="cz-glow" sx={{ px: 1, py: 0.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 0.75, background: 'rgba(245, 194, 66, 0.15)' }}>
              <Box component="span" sx={{ fontSize: 'clamp(2.2rem, 2.8vw, 3rem)', lineHeight: 1 }}>{dishOf(order.d).emoji}</Box>
              <Pips done={order.taps} total={tapsNeeded('balcao')} />
            </Box>
          ))}
          <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: XMAS_COLORS.gold }}>MONTA!</Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>— nada pronto —</Typography>
      )}
      {done.length > 0 && (
        <Typography noWrap sx={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
          pedaços prontos: {done.map((item) => dishOf(item.d).emoji).join(' ')}
        </Typography>
      )}
    </Box>
  )
}

function PopBurst({ kitchen, t }: { kitchen: Kitchen; t: number }) {
  const pop = kitchen.pop
  if (!pop || t - pop.at > POP_SHOW_MS || t < pop.at - 1000) return null
  const dish = dishOf(pop.d)
  const look =
    pop.kind === 'serve'
      ? { text: `${signed(pop.pts)} ${dish.emoji}`, sub: pop.tip > 0 ? `entregue! gorjeta +${pop.tip}` : 'entregue!', color: '#4fd67e' }
      : pop.kind === 'miss'
        ? { text: `${signed(pop.pts)} ⌛`, sub: `${dish.name} esfriou…`, color: '#ff8c95' }
        : { text: `🔥 ${dish.emoji}`, sub: 'QUEIMOU! joga fora!', color: '#ffb347' }
  return (
    <Box
      key={pop.n}
      className="cz-pop"
      sx={{ position: 'absolute', left: '50%', top: '38%', zIndex: 5, textAlign: 'center', px: 3, py: 1.5, borderRadius: 4, background: 'rgba(6, 16, 31, 0.88)', border: `3px solid ${look.color}`, boxShadow: `0 0 30px ${withAlpha(look.color, 0.6)}` }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3rem, 4.5vw, 4.8rem)', lineHeight: 1, color: look.color }}>{look.text}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(1.3rem, 1.6vw, 1.7rem)', color: '#fff6dc' }}>{look.sub}</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim da rodada
// ---------------------------------------------------------------------------

function TallyBoard({ state, t }: { state: CozinhaState; t: number }) {
  const last = state.history[state.history.length - 1]
  const left = Math.max(0, (state.deadline ?? t) - t)
  const decided = matchDecided(state)
  if (!last) return null
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <Typography sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: 'clamp(3rem, 5vw, 5rem)', lineHeight: 1, color: XMAS_COLORS.gold }}>
        🔔 Fim da rodada {last.round}!
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${state.teams.length}, minmax(0, 1fr))`, gap: 4, width: '100%', maxWidth: 1500 }}>
        {state.teams.map((team, index) => {
          const won = last.winner === index
          return (
            <Box
              key={index}
              className={won ? 'cz-boing' : undefined}
              sx={{ position: 'relative', p: 3, borderRadius: 5, textAlign: 'center', background: withAlpha(team.color, won ? 0.22 : 0.1), border: `4px solid ${won ? XMAS_COLORS.gold : withAlpha(team.color, 0.6)}`, boxShadow: won ? '0 0 50px rgba(245, 194, 66, 0.5)' : 'none' }}
            >
              {won && <Box sx={{ position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)', fontSize: '4.4rem' }}>👑</Box>}
              <TeamTitle team={team} size="clamp(2.2rem, 3vw, 3.2rem)" />
              <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(5rem, 8vw, 8rem)', lineHeight: 1, color: team.color }}>{last.scores[index] ?? 0}</Typography>
              <Typography sx={{ fontSize: 'clamp(1.6rem, 2vw, 2.2rem)', color: 'var(--text-secondary)' }}>
                🍽️ {last.delivered[index] ?? 0} · ⌛ {last.missed[index] ?? 0} · 🔥 {last.burnt[index] ?? 0}
              </Typography>
              {state.solo ? (
                <Typography className="cz-boing" sx={{ fontSize: 'clamp(3rem, 5vw, 4.6rem)', mt: 1 }}>{starsText(last.stars)}</Typography>
              ) : (
                <Typography sx={{ fontSize: 'clamp(1.8rem, 2.3vw, 2.4rem)', color: XMAS_COLORS.gold, mt: 1, fontWeight: 800 }}>
                  {won ? 'VENCEU A RODADA!' : ' '} {team.wins > 0 ? '🏆'.repeat(team.wins) : ''}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
      {!state.solo && last.winner === null && (
        <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontSize: '3rem', color: XMAS_COLORS.gold }}>🤝 EMPATE!</Typography>
      )}
      <Typography sx={{ fontSize: 'clamp(1.6rem, 2vw, 2.2rem)', color: 'var(--text-muted)' }}>
        {decided ? 'Resultado final' : `Rodada ${state.round + 1}`} em {Math.ceil(left / 1000)} s…
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim de jogo
// ---------------------------------------------------------------------------

function FinalBoard({ state, players }: { state: CozinhaState; players: HPlayer[] }) {
  const champ = championTeam(state)
  const list = awards(state).slice(0, 5)
  const totalStars = state.history.reduce((sum, round) => sum + round.stars, 0)
  const headline: ReactNode = state.solo ? (
    <>⭐ A ceia está servida! ⭐</>
  ) : champ === null ? (
    <>🤝 Empate na cozinha!</>
  ) : (
    <>🏆 {state.teams[champ]?.name} venceram!</>
  )
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, minHeight: 0, position: 'relative' }}>
      <CandyRain kind="mixed" count={36} />
      <Typography
        className="cz-boing"
        sx={{ fontFamily: CREEPY_FONT, fontWeight: 700, fontSize: 'clamp(3.4rem, 5.6vw, 6rem)', lineHeight: 1, textAlign: 'center', color: champ !== null ? state.teams[champ].color : XMAS_COLORS.gold, textShadow: '0 0 30px rgba(245, 194, 66, 0.5)' }}
      >
        {headline}
      </Typography>
      <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {state.solo ? (
          <Typography sx={{ fontSize: 'clamp(2rem, 2.8vw, 3rem)', color: 'var(--text-secondary)' }}>
            {state.teams[0]?.total ?? 0} pontos · {totalStars} ⭐ em {state.history.length} {state.history.length === 1 ? 'rodada' : 'rodadas'}
          </Typography>
        ) : (
          state.teams.map((team, index) => (
            <Box key={index} sx={{ textAlign: 'center' }}>
              <TeamTitle team={team} size="clamp(2rem, 2.6vw, 2.8rem)" />
              <Typography sx={{ fontSize: 'clamp(1.7rem, 2.2vw, 2.3rem)', color: 'var(--text-secondary)' }}>
                {'🏆'.repeat(team.wins) || '—'} · {team.total} pts
              </Typography>
            </Box>
          ))
        )}
      </Box>
      {champ !== null && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
          {state.teams[champ].players.map((id) => (
            <PlayerBadge key={id} name={nameOf(players, id)} playerId={id} size="lg" highlight color={state.teams[champ].color} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, width: '100%', maxWidth: 1600 }}>
        {list.map((award, index) => (
          <Box
            key={award.key}
            className="animate-deal-in"
            style={{ animationDelay: `${400 + index * 250}ms` }}
            sx={{ p: 2, borderRadius: 4, textAlign: 'center', background: award.key === 'burnt' ? 'rgba(255, 122, 69, 0.14)' : 'rgba(245, 194, 66, 0.1)', border: `3px solid ${award.key === 'burnt' ? '#ff7a45' : XMAS_COLORS.gold}` }}
          >
            <Typography sx={{ fontSize: '3.2rem', lineHeight: 1 }}>{award.emoji}</Typography>
            <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(1.7rem, 2.1vw, 2.2rem)', color: XMAS_COLORS.gold, lineHeight: 1.1 }}>{award.title}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 'clamp(1.5rem, 1.9vw, 2rem)', lineHeight: 1.15, mt: 0.5 }}>
              {listNames(award.ids.slice(0, 3).map((id) => nameOf(players, id)))}
              {award.ids.length > 3 ? ' e mais' : ''}
            </Typography>
            <Typography sx={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.4rem)', color: 'var(--text-muted)' }}>{award.text}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
