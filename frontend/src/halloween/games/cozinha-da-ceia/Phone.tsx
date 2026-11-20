import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useServerNow } from '../../framework/clockHooks'
import { useWakeLock } from '../../framework/wakeLock'
import { FESTIVE_ROUND_FONT, XMAS_COLORS, withAlpha } from '../../ui'
import { EVENT_INFO, STATION_INFO, type Station } from './content'
import {
  awards,
  championTeam,
  isHeat,
  orderReady,
  seatOf,
  stepOf,
  tapsNeeded,
  teamOf,
  type ActKind,
  type CozinhaState,
  type Item,
  type Kitchen,
  type Order,
  type Team,
} from './engine'
import './cozinha.css'
import {
  clockText,
  cookFraction,
  burnFraction,
  dishOf,
  enqueue,
  freeSlots,
  heatStatus,
  livePending,
  orderParts,
  patienceColor,
  patienceFraction,
  pendingCount,
  phoneStations,
  shownTaps,
  starsText,
  stationAttention,
  stepLabel,
  type PendingAct,
} from './view'

/**
 * Celular da Cozinha da Ceia: as suas mãos. Cada aba é uma estação sua; os
 * botões são grandes e respondem na hora (o toque entra numa fila e o juiz
 * confirma em seguida). A TV mostra a cozinha inteira — olhe para ela e
 * fale com o time.
 */

type Props = HalloweenViewProps<CozinhaState>

export default function Phone(props: Props) {
  const { state, me } = props
  useWakeLock(me !== null && !state.over)
  if (!me) return null
  // Estado de outro formato (partida velha): o motor encerra no próximo passo.
  const ours = Array.isArray(state.teams) && Array.isArray(state.kitchens) && Array.isArray(state.history)
  if (!ours) return <Card><Typography sx={{ fontWeight: 700 }}>{state.over ? '🎄 Fim de jogo!' : 'Preparando a cozinha… 🎄'}</Typography></Card>
  if (state.over) return <FinalPanel {...props} me={me} />
  const team = teamOf(state, me.id)
  if (team === null || !state.teams[team]) {
    return <Card><Typography sx={{ fontWeight: 700 }}>Partida rolando — olhe a TV! 🎄</Typography></Card>
  }
  if (state.phase === 'prep') return <PrepPanel {...props} me={me} team={team} />
  if (state.phase === 'tally') return <TallyPanel {...props} me={me} team={team} />
  if (state.phase === 'cook') return <CookPanel key={state.round} {...props} me={me} team={team} />
  return null
}

// ---------------------------------------------------------------------------
// Pecinhas
// ---------------------------------------------------------------------------

function Card({ children, color, glow = false }: { children: ReactNode; color?: string; glow?: boolean }) {
  return (
    <Box
      className={glow ? 'your-turn' : undefined}
      sx={{
        p: 1.75,
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${color ?? 'var(--border-medium)'}`,
        background: color ? withAlpha(color, 0.12) : 'rgba(255, 255, 255, 0.04)',
      }}
    >
      {children}
    </Box>
  )
}

function TeamHeader({ team, right }: { team: Team; right?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.5, py: 0.75, borderRadius: 999, background: withAlpha(team.color, 0.18), border: `2px solid ${team.color}` }}>
      <Typography noWrap sx={{ fontWeight: 800, color: team.color, minWidth: 0 }}>
        {team.emoji} {team.name}
      </Typography>
      {right}
    </Box>
  )
}

function Bar({ fraction, color, height = 8 }: { fraction: number; color: string; height?: number }) {
  return (
    <Box sx={{ width: '100%', height, borderRadius: 999, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
      <Box sx={{ width: `${Math.round(fraction * 100)}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 250ms linear' }} />
    </Box>
  )
}

function Pips({ done, total }: { done: number; total: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '5px' }}>
      {Array.from({ length: total }, (_, index) => (
        <Box key={index} component="span" sx={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', background: index < done ? 'currentColor' : 'transparent' }} />
      ))}
    </Box>
  )
}

/** Botão grandão de cozinha (afunda no toque). */
function BigButton({
  onClick,
  disabled = false,
  color,
  className,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  color: string
  className?: string
  children: ReactNode
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`cz-press${className ? ` ${className}` : ''}`}
      sx={{
        width: '100%',
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: 'var(--radius-lg)',
        border: `3px solid ${disabled ? 'var(--border-medium)' : color}`,
        background: disabled ? 'rgba(255, 255, 255, 0.04)' : `linear-gradient(160deg, ${withAlpha(color, 0.38)}, ${withAlpha(color, 0.16)})`,
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        font: 'inherit',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Pré-rodada
// ---------------------------------------------------------------------------

function PrepPanel({ state, players, me, team, myInput, send, now }: Props & { me: HPlayer; team: number }) {
  const t = useServerNow(now, 500)
  const info = state.teams[team]
  const seat = seatOf(state, me.id)
  const ready = Boolean(myInput?.ready) || state.acted.includes(me.id)
  const event = state.event ? EVENT_INFO[state.event] : null
  const mates = info.players.filter((id) => id !== me.id)
  const left = Math.max(0, Math.ceil(((state.deadline ?? t) - t) / 1000))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TeamHeader team={info} right={<Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>Rodada {state.round}/{state.totalRounds}</Typography>} />
      {event && (
        <Card color="#e8394a">
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>{event.emoji} {event.title}</Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>{event.text}</Typography>
        </Card>
      )}
      <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.85rem' }}>
        {seat.length > 1 ? 'SUAS ESTAÇÕES' : seat.length ? 'SUA ESTAÇÃO' : 'VOCÊ É REFORÇO'}
      </Typography>
      {(seat.length ? seat : (['balcao'] as Station[])).map((st) => (
        <Card key={st} color={info.color} glow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box className="cz-wobble" sx={{ fontSize: '2.8rem', lineHeight: 1 }}>{STATION_INFO[st].emoji}</Box>
            <Box>
              <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.7rem', lineHeight: 1.05 }}>
                {seat.length ? STATION_INFO[st].name : 'Ajuda onde precisar!'}
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)' }}>
                {seat.length ? STATION_INFO[st].hint : 'Você pode mexer em todas as estações do time.'}
              </Typography>
            </Box>
          </Box>
        </Card>
      ))}
      {mates.length > 0 && (
        <Typography sx={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          Seu time: {listNames(mates.map((id) => nameOf(players, id)))}
        </Typography>
      )}
      <BigButton onClick={() => send({ ready: true })} disabled={ready} color={XMAS_COLORS.green}>
        <Box sx={{ fontSize: '2rem' }}>{ready ? '✅' : '👍'}</Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>{ready ? 'Pronto! Esperando o time…' : 'Entendi, tô pronto!'}</Typography>
      </BigButton>
      <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Cozinha abre em {left} s</Typography>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Cozinhando
// ---------------------------------------------------------------------------

function CookPanel({ state, players, me, team, send, now }: Props & { me: HPlayer; team: number }) {
  const t = useServerNow(now, 250)
  const info = state.teams[team]
  const kitchen = state.kitchens[team]
  const seen = state.seen?.[String(me.id)] ?? 0

  // A fila de toques: a ref é a verdade nos cliques (dois toques no mesmo
  // quadro não se perdem); o estado é o que a tela desenha.
  const queueRef = useRef<PendingAct[]>([])
  const lastN = useRef(0)
  const [queue, setQueue] = useState<PendingAct[]>([])
  const pending = livePending(queue, seen, state.round)

  const act = useCallback(
    (a: ActKind, i: number) => {
      const { act: next, queue: list } = enqueue(queueRef.current, seen, lastN.current, state.round, a, i, now())
      lastN.current = next.n
      queueRef.current = list
      setQueue(list)
      send({ acts: list.map(({ n, a: kind, i: id, at }) => ({ n, a: kind, i: id, at })) })
    },
    [seen, state.round, now, send],
  )

  const stations = phoneStations(state, me.id, players, team)
  const [picked, setPicked] = useState<Station | null>(null)
  const current = stations.find((entry) => entry.st === picked) ?? stations[0]
  const left = Math.max(0, (state.deadline ?? t) - t)
  if (!kitchen || !current) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <TeamHeader
        team={info}
        right={
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.5rem', lineHeight: 1, color: left <= 10_000 ? '#ff4d5e' : XMAS_COLORS.gold, flexShrink: 0 }}>
            {kitchen.score} pts · ⏱ {clockText(left)}
          </Typography>
        }
      />
      <OrderStrip kitchen={kitchen} t={t} />
      {stations.length > 1 && (
        // Folga em cima e à direita: o contador da aba não é cortado pela rolagem.
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pt: 1.25, pr: 1, pb: 0.25, mt: -0.75 }}>
          {stations.map(({ st, cover }) => {
            const attention = stationAttention(kitchen, st, t, state.burnMs)
            const on = st === current.st
            return (
              <Box
                key={st}
                component="button"
                type="button"
                onClick={() => setPicked(st)}
                className={`cz-press${attention.urgent && !on ? ' animate-urgent' : ''}`}
                sx={{
                  position: 'relative',
                  flex: '1 0 auto',
                  minWidth: 64,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${on ? info.color : attention.urgent ? '#ff4d5e' : 'var(--border-medium)'}`,
                  background: on ? withAlpha(info.color, 0.25) : 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-primary)',
                  font: 'inherit',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {cover ? '🆘 ' : ''}
                {STATION_INFO[st].emoji} {STATION_INFO[st].name}
                {attention.count > 0 && (
                  <Box component="span" sx={{ position: 'absolute', top: -8, right: -6, minWidth: 22, height: 22, px: 0.5, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: '0.8rem', background: attention.urgent ? '#ff4d5e' : XMAS_COLORS.gold, color: '#1f1402' }}>
                    {attention.count}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ fontSize: '2.2rem', lineHeight: 1 }}>{STATION_INFO[current.st].emoji}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1 }}>
            {STATION_INFO[current.st].name}
            {current.cover ? ' (cobrindo)' : ''}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{STATION_INFO[current.st].hint}</Typography>
        </Box>
      </Box>
      {current.st === 'balcao' ? (
        <CounterStation kitchen={kitchen} t={t} pending={pending} onAct={act} />
      ) : isHeat(current.st) ? (
        <HeatStation state={state} team={team} st={current.st} t={t} pending={pending} onAct={act} />
      ) : (
        <PrepStation kitchen={kitchen} st={current.st} t={t} pending={pending} onAct={act} />
      )}
      {pending.length > 0 && (
        <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ⏳ {pending.length} {pending.length === 1 ? 'toque a caminho' : 'toques a caminho'} da TV…
        </Typography>
      )}
    </Box>
  )
}

function orderOf(kitchen: Kitchen, id: number): Order | undefined {
  return kitchen.orders.find((order) => order.id === id)
}

function secondsLeft(order: Order | undefined, t: number): string {
  if (!order) return ''
  return `${Math.max(0, Math.ceil((order.exp - t) / 1000))} s`
}

/** Os pedidos da cozinha em miniatura (para saber o que é urgente). */
function OrderStrip({ kitchen, t }: { kitchen: Kitchen; t: number }) {
  if (!kitchen.orders.length) return <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>🔔 Pedido novo chegando…</Typography>
  return (
    // Folga em volta: o brilho do pedido pronto não é cortado pela rolagem.
    <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', p: '6px', m: '-6px' }}>
      {kitchen.orders.map((order) => {
        const fraction = patienceFraction(order, t)
        const ready = orderReady(kitchen, order.id)
        return (
          <Box key={order.id} className={ready ? 'cz-glow' : undefined} sx={{ flex: '0 0 auto', width: 58, p: 0.5, borderRadius: 2, textAlign: 'center', background: 'rgba(255, 249, 234, 0.92)' }}>
            <Box sx={{ fontSize: '1.6rem', lineHeight: 1.1 }}>{dishOf(order.d).emoji}</Box>
            <Bar fraction={fraction} color={patienceColor(fraction)} height={6} />
          </Box>
        )
      })}
    </Box>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Typography sx={{ textAlign: 'center', fontSize: '2rem' }}>🧑‍🍳</Typography>
      <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>{text}</Typography>
    </Card>
  )
}

type StationProps = { t: number; pending: PendingAct[]; onAct: (a: ActKind, i: number) => void }

function PrepStation({ kitchen, st, t, pending, onAct }: StationProps & { kitchen: Kitchen; st: Station }) {
  const items = kitchen.items
    .filter((item) => item.st === st && item.ph === 'prep')
    .sort((a, b) => (orderOf(kitchen, a.o)?.exp ?? 0) - (orderOf(kitchen, b.o)?.exp ?? 0) || a.id - b.id)
  if (!items.length) return <Empty text="Nada aqui agora. Pergunte ao time o que falta!" />
  const need = tapsNeeded(st)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item) => {
        const shown = shownTaps(item, pending)
        const done = shown >= need
        const order = orderOf(kitchen, item.o)
        const fraction = order ? patienceFraction(order, t) : 1
        return (
          <BigButton key={item.id} onClick={() => onAct('tap', item.id)} disabled={done} color={XMAS_COLORS.gold}>
            <Box key={shown} className={shown > 0 ? 'cz-chop' : undefined} sx={{ fontSize: '2.3rem', lineHeight: 1 }}>{dishOf(item.d).emoji}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>{done ? '✓ Foi! Já já sai daqui' : `${STATION_INFO[st].emoji} ${stepLabel(item)}`}</Typography>
              <Typography noWrap sx={{ color: fraction < 0.25 ? '#ff8c95' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                {dishOf(item.d).name} · ⏳ {secondsLeft(order, t)}
              </Typography>
            </Box>
            <Box sx={{ color: XMAS_COLORS.gold }}>
              <Pips done={shown} total={need} />
            </Box>
          </BigButton>
        )
      })}
    </Box>
  )
}

function HeatStation({ state, team, st, t, pending, onAct }: StationProps & { state: CozinhaState; team: number; st: Station }) {
  const kitchen = state.kitchens[team]
  const cap = state.capacity[team]?.[st as 'fogao' | 'forno'] ?? 2
  const inside = kitchen.items.filter((item) => item.st === st && (item.ph === 'cook' || item.ph === 'burnt'))
  const waiting = kitchen.items
    .filter((item) => item.st === st && item.ph === 'queue')
    .sort((a, b) => (orderOf(kitchen, a.o)?.exp ?? 0) - (orderOf(kitchen, b.o)?.exp ?? 0) || a.id - b.id)
  const free = freeSlots(state, team, st, pending)
  const word = st === 'forno' ? 'forno' : 'fogo'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
        {st === 'fogao' ? '🍳 Bocas' : '🔥 Lugares'}: {inside.length}/{cap} ocupad{inside.length === 1 ? 'a' : 'as'}
      </Typography>
      {inside.map((item) => (
        <HeatCard key={item.id} item={item} burnMs={state.burnMs} t={t} pending={pending} onAct={onAct} />
      ))}
      {waiting.length > 0 && (
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.85rem', mt: 0.5 }}>ESPERANDO {st === 'forno' ? 'O FORNO' : 'O FOGO'}</Typography>
      )}
      {waiting.map((item) => {
        const sending = pendingCount(pending, 'cook', item.id) > 0
        const full = !sending && free <= 0
        const step = stepOf(item)
        return (
          <BigButton key={item.id} onClick={() => onAct('cook', item.id)} disabled={sending || full} color="#ff7a45">
            <Box sx={{ fontSize: '2.3rem', lineHeight: 1 }}>{dishOf(item.d).emoji}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>
                {sending ? `Indo pro ${word}…` : full ? `${st === 'forno' ? 'Forno' : 'Fogão'} cheio!` : `Pôr no ${word}: ${step ? `${step.verb.toLowerCase()} ${step.what}` : ''}`}
              </Typography>
              <Typography noWrap sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {dishOf(item.d).name} · ⏳ {secondsLeft(orderOf(kitchen, item.o), t)}
              </Typography>
            </Box>
            <Box sx={{ fontSize: '1.6rem' }}>{full ? '⛔' : '🔥'}</Box>
          </BigButton>
        )
      })}
      {!inside.length && !waiting.length && <Empty text={`Nada no ${st === 'forno' ? 'forno' : 'fogão'}. Peça para o time mandar!`} />}
    </Box>
  )
}

function HeatCard({ item, burnMs, t, pending, onAct }: StationProps & { item: Item; burnMs: number }) {
  const status = heatStatus(item, t, burnMs)
  const dish = dishOf(item.d)
  if (status === 'burnt') {
    const sending = pendingCount(pending, 'trash', item.id) > 0
    return (
      <BigButton onClick={() => onAct('trash', item.id)} disabled={sending} color="#9ca3af">
        <Box sx={{ fontSize: '2.3rem', lineHeight: 1, filter: 'grayscale(1) brightness(0.6)' }}>{dish.emoji}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>{sending ? 'Jogando fora…' : '💨 Queimou! Jogar fora'}</Typography>
          <Typography noWrap sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{dish.name} volta para o começo</Typography>
        </Box>
        <Box sx={{ fontSize: '1.8rem' }}>🗑️</Box>
      </BigButton>
    )
  }
  const taking = item.pick || pendingCount(pending, 'take', item.id) > 0
  const cooking = status === 'cooking'
  const hot = status === 'smoking' || status === 'burning'
  const fraction = cooking || status === 'almost' ? cookFraction(item, t) : burnFraction(item, t, burnMs)
  const color = hot ? '#ff4d5e' : status === 'ready' ? '#4fd67e' : XMAS_COLORS.gold
  const label = taking
    ? 'Saindo do fogo…'
    : cooking
      ? `Cozinhando… ${Math.max(0, Math.ceil((item.end - t) / 1000))} s`
      : status === 'almost'
        ? 'Quase! Pode tirar ✋'
        : hot
          ? 'TIRA JÁ! Tá queimando!'
          : 'PRONTO! Tirar!'
  return (
    <BigButton
      onClick={() => onAct('take', item.id)}
      disabled={taking || cooking}
      color={color}
      className={taking || cooking ? undefined : hot ? 'cz-burning' : status === 'ready' ? 'cz-ready' : undefined}
    >
      <Box className={cooking ? 'cz-sizzle' : undefined} sx={{ fontSize: '2.3rem', lineHeight: 1 }}>{dish.emoji}</Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1.1, color: taking || cooking ? undefined : color }}>{label}</Typography>
        <Bar fraction={fraction} color={color} />
        <Typography noWrap sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{dish.name}</Typography>
      </Box>
      <Box sx={{ fontSize: '1.6rem' }}>{hot ? '🔥' : status === 'ready' ? '✋' : '⏲️'}</Box>
    </BigButton>
  )
}

function CounterStation({ kitchen, t, pending, onAct }: StationProps & { kitchen: Kitchen }) {
  const orders = [...kitchen.orders].sort((a, b) => Number(orderReady(kitchen, b.id)) - Number(orderReady(kitchen, a.id)) || a.exp - b.exp)
  if (!orders.length) return <Empty text="Sem pedidos agora. Respira! 😮‍💨" />
  const need = tapsNeeded('balcao')
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {orders.map((order) => {
        const dish = dishOf(order.d)
        const ready = orderReady(kitchen, order.id)
        const fraction = patienceFraction(order, t)
        const shown = Math.min(need, order.taps + pendingCount(pending, 'serve', order.id))
        const parts = orderParts(kitchen, order.id)
        const missing = parts.filter((part) => !part.done)
        return (
          <BigButton key={order.id} onClick={() => onAct('serve', order.id)} disabled={!ready || shown >= need} color={ready ? XMAS_COLORS.gold : '#7f93b3'} className={ready && shown < need ? 'cz-glow' : undefined}>
            <Box key={shown} className={shown > 0 ? 'cz-chop' : undefined} sx={{ fontSize: '2.3rem', lineHeight: 1 }}>{dish.emoji}</Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.1 }}>
                {ready ? (shown >= need ? '✓ Entregando!' : `🎁 Montar ${dish.name}`) : `${dish.name}${order.vip ? ' 👵' : ''}`}
              </Typography>
              {!ready && (
                <Typography noWrap sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  falta: {missing.map((part) => (part.burnt ? '💨' : STATION_INFO[part.st].emoji)).join(' ')}
                </Typography>
              )}
              <Bar fraction={fraction} color={patienceColor(fraction)} />
            </Box>
            {ready ? (
              <Box sx={{ color: XMAS_COLORS.gold }}>
                <Pips done={shown} total={need} />
              </Box>
            ) : (
              <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>{secondsLeft(order, t)}</Typography>
            )}
          </BigButton>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim da rodada e fim de jogo
// ---------------------------------------------------------------------------

function TallyPanel({ state, team }: Props & { me: HPlayer; team: number }) {
  const info = state.teams[team]
  const last = state.history[state.history.length - 1]
  if (!last) return null
  const won = last.winner === team
  const tie = !state.solo && last.winner === null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TeamHeader team={info} right={<Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>Rodada {last.round}</Typography>} />
      <Card color={won ? XMAS_COLORS.gold : info.color} glow={won}>
        <Typography className="cz-boing" sx={{ textAlign: 'center', fontSize: '3rem', lineHeight: 1 }}>
          {state.solo ? starsText(last.stars) : won ? '🏆' : tie ? '🤝' : '🥄'}
        </Typography>
        <Typography sx={{ textAlign: 'center', fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '1.7rem' }}>
          {state.solo ? `${last.scores[0] ?? 0} pontos!` : won ? 'Seu time venceu a rodada!' : tie ? 'Empate!' : 'O outro time levou essa…'}
        </Typography>
        <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Vocês: {last.scores[team] ?? 0} pts · 🍽️ {last.delivered[team] ?? 0} · ⌛ {last.missed[team] ?? 0} · 🔥 {last.burnt[team] ?? 0}
        </Typography>
      </Card>
      <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)' }}>Olhe a TV! 📺</Typography>
    </Box>
  )
}

function FinalPanel({ state, me }: Props & { me: HPlayer }) {
  const team = teamOf(state, me.id)
  const info = team === null ? null : state.teams[team]
  const champ = championTeam(state)
  const mine = awards(state).filter((award) => award.ids.includes(me.id))
  const stats = state.stats?.[String(me.id)]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ textAlign: 'center', fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: '2rem' }}>🎄 Fim da ceia!</Typography>
      {info && (
        <Card color={champ === team ? XMAS_COLORS.gold : info.color} glow={champ === team}>
          <Typography sx={{ textAlign: 'center', fontSize: '2.6rem', lineHeight: 1 }}>{state.solo ? '⭐' : champ === team ? '🏆' : champ === null ? '🤝' : '🥈'}</Typography>
          <Typography sx={{ textAlign: 'center', fontWeight: 800, fontSize: '1.3rem' }}>
            {state.solo ? `Vocês fizeram ${info.total} pontos!` : champ === team ? 'Seu time venceu a ceia!' : champ === null ? 'Empate na cozinha!' : 'Foi por pouco! Ano que vem tem mais.'}
          </Typography>
        </Card>
      )}
      {mine.map((award) => (
        <Card key={award.key} color={XMAS_COLORS.gold}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>{award.emoji} {award.title}</Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>{award.text}</Typography>
        </Card>
      ))}
      {stats && (
        <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Você: 👆 {stats.prep} toques · 🔥 {stats.heat} no fogo · 🎁 {stats.serve} entregas{stats.burnt ? ` · 💨 ${stats.burnt} queimad${stats.burnt === 1 ? 'o' : 'os'}` : ''}
        </Typography>
      )}
    </Box>
  )
}
