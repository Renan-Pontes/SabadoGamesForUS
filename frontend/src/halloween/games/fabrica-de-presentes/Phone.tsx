import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { listNames, nameOf } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useServerNow } from '../../framework/clockHooks'
import { XMAS_COLORS, withAlpha } from '../../ui'
import { GiftArt, PartIcon } from './Art'
import { CHAOS_BY_ID, type TeamLook } from './content'
import { MESS_PENALTY, awards, coopStars, teamOf, winningTeam, type FpState, type Hand, type Team } from './engine'
import {
  RESULT_TEXT,
  buzz,
  categoryLabel,
  categoryOf,
  clockText,
  partOf,
  pointsText,
  queueTap,
  recentTaps,
  starsText,
  stepStatuses,
  tapStoreKey,
  teamLook,
} from './view'
import { useWakeLock } from './wakeLock'

/**
 * Celular da Fábrica de Presentes: a sua bancada de peças. Na rodada, só os
 * botões das SUAS peças (o pedido está na TV — é para olhar e gritar), a
 * etapa que o time está montando e o que aconteceu com os seus últimos
 * toques. Toque = resposta otimista na hora; o juiz confirma depois.
 */

const GOLD = XMAS_COLORS.gold

type Props = HalloweenViewProps<FpState>

export default function Phone(props: Props) {
  const { state, me } = props
  useWakeLock(me !== null && !state.over)
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (state.phase === 'brief') return <BriefPanel {...props} />
  if (state.phase === 'play') return <PlayPanel key={`${state.round}-${state.seed}`} {...props} />
  return <TallyPanel {...props} />
}

// ---------------------------------------------------------------------------
// Pecinhas
// ---------------------------------------------------------------------------

function TeamBanner({ look, right }: { look: TeamLook; right?: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: '16px',
        background: `linear-gradient(90deg, ${look.color}, ${look.dark})`,
        color: '#ffffff',
        boxShadow: `0 6px 18px ${withAlpha(look.color, 0.35)}`,
        '& p': { color: 'inherit' },
      }}
    >
      <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{look.icon}</Typography>
      <Typography sx={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.1 }}>{look.name}</Typography>
      {right}
    </Box>
  )
}

function Card({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Box sx={{ p: 1.75, borderRadius: '18px', textAlign: 'center', border: `2px solid ${color ?? 'var(--border-medium)'}`, background: color ? withAlpha(color, 0.12) : 'rgba(255,255,255,0.04)' }}>
      {children}
    </Box>
  )
}

function lookOf(state: FpState, team: Team | null): TeamLook {
  return teamLook(state, team?.id ?? 'r')
}

function MyParts({ hand }: { hand: Hand | null }) {
  const parts = hand?.parts ?? []
  if (!parts.length) {
    return <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sem peças nesta rodada — ajude o time olhando a TV!</Typography>
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      {parts.map((part) => (
        <Box key={part} className="animate-deal-in" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, p: 0.75, borderRadius: '14px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-medium)' }}>
          <PartIcon part={part} size={44} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{partOf(part).name}</Typography>
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

function BriefPanel({ state, players, me, mine, now }: Props) {
  const t = useServerNow(now, 500)
  if (!me) return null
  const team = teamOf(state, me.id)
  const look = lookOf(state, team)
  const mates = (team?.members ?? []).filter((id) => id !== me.id)
  const chaos = state.chaos ? CHAOS_BY_ID[state.chaos] : null
  const secs = state.deadline === null ? 0 : Math.max(0, Math.ceil((state.deadline - t) / 1000))
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.1em', textAlign: 'center' }}>
        🏭 RODADA {state.round}/{state.totalRounds} · começa em {secs} s
      </Typography>
      <TeamBanner look={look} />
      <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
        {mates.length ? `Seu time: ${listNames(mates.map((id) => nameOf(players, id)))}` : 'Você é a fábrica inteira! 💪'}
      </Typography>
      {chaos && (
        <Card color={GOLD}>
          <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{chaos.icon}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: GOLD }}>{chaos.title}</Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>{chaos.text}</Typography>
        </Card>
      )}
      <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', textAlign: 'center' }}>📦 Suas peças nesta rodada</Typography>
      <MyParts hand={mine} />
      <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
        Decore! Quando o pedido da TV pedir uma peça sua, toque nela — na ordem. 📣
      </Typography>
    </Box>
  )
}

/** "Montando: ✓ Caixa · 👉 Papel · Laço" — a categoria da vez, sem dizer qual peça. */
function Progress({ team }: { team: Team | null }) {
  const order = team?.order
  if (!team || !order) return null
  const statuses = stepStatuses(team)
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
      {order.vip && <Box sx={{ px: 1, borderRadius: 999, background: GOLD, color: '#2b0d02', fontWeight: 900, fontSize: '0.85rem' }}>⭐ VIP</Box>}
      {order.parts.map((part, index) => {
        const status = statuses[index]
        return (
          <Box
            key={`${part}-${index}`}
            className={status === 'next' ? 'fp-next' : undefined}
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 999,
              fontWeight: 800,
              fontSize: '0.9rem',
              border: `2px solid ${status === 'next' ? GOLD : 'transparent'}`,
              background: status === 'done' ? 'rgba(79, 214, 126, 0.2)' : status === 'held' ? 'rgba(74, 168, 255, 0.2)' : 'rgba(255,255,255,0.06)',
              color: status === 'todo' ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
          >
            {status === 'done' ? '✓ ' : status === 'next' ? '👉 ' : status === 'held' ? '⏳ ' : ''}
            {categoryLabel(categoryOf(part))}
          </Box>
        )
      })}
    </Box>
  )
}

function PlayPanel({ code, state, me, mine, send, now }: Props) {
  const t = useServerNow(now, 500)
  const [, setVersion] = useState(0)
  const [pulse, setPulse] = useState<{ p: string; at: number } | null>(null)
  const lastTap = useRef<Record<string, number>>({})
  const meId = me?.id ?? 0
  const team = teamOf(state, meId)
  const seen = state.seen?.[String(meId)] ?? 0
  const storeKey = tapStoreKey(code, meId, state.round, state.seed)
  const myLog = (team?.log ?? []).filter((entry) => entry.by === meId)
  const lastMine = myLog[myLog.length - 1]
  const lastMineKey = lastMine ? `${lastMine.at}-${lastMine.n}-${lastMine.r}` : ''
  const lastMineBad = lastMine !== undefined && (lastMine.r === 'mess' || lastMine.r === 'drop')

  // Minha peça virou bagunça: o celular avisa na mão.
  useEffect(() => {
    if (lastMineKey && lastMineBad) buzz([200, 80, 200])
  }, [lastMineKey, lastMineBad])

  // Peças novas no meio da rodada (troca de turno ou alguém saiu).
  const partsKey = (mine?.parts ?? []).join(',')
  const [known, setKnown] = useState({ key: partsKey, at: 0 })
  if (known.key !== partsKey) setKnown({ key: partsKey, at: t })
  const newParts = known.at > 0 && t - known.at < 4000
  useEffect(() => {
    if (known.at > 0) buzz([60, 60, 60])
  }, [known.at])

  if (!me) return null
  const look = lookOf(state, team)
  const parts = mine?.parts ?? []
  const left = state.deadline === null ? 0 : state.deadline - t

  const tap = (part: string) => {
    const at = now()
    // Dedo nervoso: o mesmo botão duas vezes em 0,6 s conta uma.
    if (at - (lastTap.current[part] ?? 0) < 600) return
    lastTap.current[part] = at
    const taps = queueTap(storeKey, seen, part, at)
    send({ taps })
    buzz(25)
    setPulse({ p: part, at })
    setVersion((value) => value + 1)
  }

  const recent = recentTaps(storeKey, 3)
  const resultOf = (n: number) => {
    if (n > seen) return '📤 enviando…'
    const entry = myLog.find((item) => item.n === n)
    return entry ? RESULT_TEXT[entry.r] : '✓ visto'
  }
  const columns = parts.length > 6 ? 3 : 2

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <TeamBanner
        look={look}
        right={
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.6rem', lineHeight: 1 }}>⏱ {clockText(left)}</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.9 }}>{team?.score ?? 0} pts</Typography>
          </Box>
        }
      />
      <Typography sx={{ textAlign: 'center', fontWeight: 800, color: GOLD }}>👀 Olhe o pedido na TV e grite: quem tem?!</Typography>
      <Progress team={team} />
      {newParts && (
        <Box className="animate-pop-in" sx={{ p: 1, borderRadius: '14px', textAlign: 'center', background: withAlpha(GOLD, 0.2), border: `2px solid ${GOLD}` }}>
          <Typography sx={{ fontWeight: 900, color: GOLD }}>🔀 Peças novas na sua mão! Confira.</Typography>
        </Box>
      )}
      {parts.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
          {parts.map((part) => {
            const pressed = pulse?.p === part && t - pulse.at < 1200
            return (
              <Box
                key={`${part}-${pressed ? pulse?.at : 0}`}
                component="button"
                type="button"
                onClick={() => tap(part)}
                className={pressed ? 'fp-tap' : undefined}
                sx={{
                  appearance: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  minHeight: columns === 3 ? 104 : 124,
                  p: 1,
                  borderRadius: '18px',
                  border: `3px solid ${pressed ? GOLD : withAlpha(look.color, 0.7)}`,
                  background: pressed
                    ? `linear-gradient(180deg, ${withAlpha(GOLD, 0.35)}, ${withAlpha(look.color, 0.25)})`
                    : `linear-gradient(180deg, ${withAlpha(look.color, 0.22)}, rgba(6,16,31,0.9))`,
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: `0 4px 0 ${withAlpha(look.dark, 0.9)}`,
                  '&:active': { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${withAlpha(look.dark, 0.9)}` },
                }}
              >
                <PartIcon part={part} size={columns === 3 ? 48 : 60} />
                <Box component="span" sx={{ fontWeight: 800, fontSize: columns === 3 ? '0.85rem' : '1rem', lineHeight: 1.1, textAlign: 'center' }}>
                  {partOf(part).name}
                </Box>
              </Box>
            )
          })}
        </Box>
      ) : (
        <Card>
          <Typography sx={{ fontWeight: 700 }}>Sem peças agora 🙌 Ajude o time: leia o pedido da TV em voz alta!</Typography>
        </Card>
      )}
      {recent.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {recent.map((entry, index) => (
            <Typography key={entry.n} noWrap sx={{ fontSize: '0.95rem', fontWeight: 700, opacity: 1 - index * 0.25, color: 'var(--text-secondary)' }}>
              {partOf(entry.p).name}: {resultOf(entry.n)}
            </Typography>
          ))}
        </Box>
      )}
      <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Fora de ordem? Ela espera 5 s. Peça errada = bagunça (−{MESS_PENALTY}).
      </Typography>
    </Box>
  )
}

function myStats(state: FpState, id: number) {
  const row = state.stats?.[String(id)] ?? [0, 0, 0, 0]
  return { placed: row[0], mess: row[1], bows: row[2], closes: row[3] }
}

function TallyPanel({ state, me }: Props) {
  if (!me) return null
  const team = teamOf(state, me.id)
  const look = lookOf(state, team)
  const stats = myStats(state, me.id)
  const last = state.round >= state.totalRounds
  const others = (state.teams ?? []).filter((other) => other.id !== team?.id)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, textAlign: 'center' }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.8rem' }}>Fim da rodada {state.round}!</Typography>
      <TeamBanner look={look} right={<Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.8rem' }}>{team?.score ?? 0}</Typography>} />
      {team && (
        <Card color={look.color}>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800 }}>
            🛷 {team.line.done} entregues · 🗑️ {team.line.mess} bagunças · 💨 {team.line.lost} perdidos
          </Typography>
          <Typography sx={{ fontWeight: 800, color: GOLD }}>{pointsText(team.line.points)} pontos nesta rodada</Typography>
        </Card>
      )}
      {others.map((other) => (
        <Typography key={other.id} sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
          {teamLook(state, other.id).icon} {teamLook(state, other.id).name}: {other.score} pts
        </Typography>
      ))}
      <Card>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>Você na partida</Typography>
        <Typography sx={{ fontWeight: 800 }}>
          🧩 {stats.placed} peças · 📦 {stats.closes} fechados · 🎀 {stats.bows} laços · 🌀 {stats.mess} bagunças
        </Typography>
      </Card>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>{last ? 'Resultado final na TV! 🥁' : 'Próxima rodada: peças novas! 🔀'}</Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const teams = state.teams ?? []
  const team = teamOf(state, me.id)
  const coop = state.coop || teams.length < 2
  const win = coop ? null : winningTeam(state)
  const mineAwards = Array.isArray(state.roster) && state.stats ? awards(state).filter((award) => award.ids.includes(me.id)) : []
  const stats = myStats(state, me.id)
  const headline = coop
    ? `${teams[0]?.sleigh ?? 0} presentes entregues!`
    : win === null
      ? 'Empate na fábrica!'
      : win === team?.id
        ? 'Seu time venceu! 🏆'
        : 'Foi por pouco! 🎁'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, textAlign: 'center' }}>
      <Box className="fp-wiggle" sx={{ display: 'flex', justifyContent: 'center' }}>
        <GiftArt parts={['cx-gigante', 'pp-estrelas', 'lc-dourado', 'et-te-amo']} size={120} />
      </Box>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2.1rem', lineHeight: 1.05 }}>{headline}</Typography>
      {coop && <Typography sx={{ fontSize: '2.2rem' }}>{starsText(coopStars(state))}</Typography>}
      {!coop && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {teams.map((other) => {
            const look = teamLook(state, other.id)
            return <TeamBanner key={other.id} look={look} right={<Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.8rem' }}>{other.score}</Typography>} />
          })}
        </Box>
      )}
      {mineAwards.map((award) => (
        <Card key={award.key} color={award.key === 'bagunca' ? XMAS_COLORS.red : GOLD}>
          <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{award.icon}</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem' }}>Você ganhou: {award.title}!</Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>
            {award.count} {award.unit}
          </Typography>
        </Card>
      ))}
      <Card>
        <Typography sx={{ fontWeight: 800 }}>
          🧩 {stats.placed} peças · 📦 {stats.closes} fechados · 🌀 {stats.mess} bagunças
        </Typography>
      </Card>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
        {team ? `Valeu, ${nameOf(players, me.id)}! ` : ''}Feliz Natal! 🎄
      </Typography>
    </Box>
  )
}
