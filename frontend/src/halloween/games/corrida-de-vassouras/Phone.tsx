import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { GRACE_MS, ranking } from '../../engine/helpers'
import type { HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { withAlpha } from '../../ui/color'
import { WITCHES, witchOf } from './content'
import {
  FALL_SQUARES,
  LEADER_PAYS,
  MIN_CURSES,
  SECOND_PAYS,
  WINNER_PAYS,
  finalAwards,
  readBet,
  standings,
  type CvBet,
  type State,
} from './engine'
import { meta } from './meta'
import { WitchTag } from './parts'
import { buzz, candies, namesOrNobody } from './view'

/**
 * Celular da Corrida de Vassouras: uma pergunta por tela.
 *
 * Nas apostas, um passo de cada vez — (1ª etapa: campeã) → quem fica na
 * frente → maldição — e cada toque já grava a resposta (`send` leva tudo o
 * que foi escolhido até ali). O passo sai da própria resposta gravada: se o
 * celular recarregar, volta no mesmo lugar. Na corrida, "olhe a TV"; no
 * pagamento, o que eu ganhei.
 */

const ACCENT = meta.accent

type PanelProps = HalloweenViewProps<State> & { meId: number }

export default function Phone(props: HalloweenViewProps<State>) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} meId={me.id} />
  if (state.phase === 'bet') return <BetPanel {...props} meId={me.id} />
  if (state.phase === 'race') return <RacePanel {...props} meId={me.id} />
  return <PayoutPanel {...props} meId={me.id} />
}

function Header({ state, meId, now, grace }: { state: State; meId: number; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>ETAPA {state.round}</Typography>
      <Typography sx={{ fontWeight: 800, color: ACCENT.light }}>🍬 {state.scores[String(meId)] ?? 0}</Typography>
      {seconds !== null && (
        <Typography
          sx={{
            fontFamily: 'var(--font-numeric)',
            fontSize: '1.8rem',
            lineHeight: 1,
            color: grace && seconds <= 5 ? 'var(--blood, #e0213a)' : ACCENT.main,
          }}
        >
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

/**
 * Ignora toques logo depois de trocar de passo: o dedo que escolheu a bruxa
 * não pode cair, sem querer, na maldição que aparece no mesmo lugar.
 */
function useTapGuard(key: string, ms = 350): () => boolean {
  const since = useRef(0)
  useEffect(() => {
    since.current = Date.now()
  }, [key])
  return useCallback(() => Date.now() - since.current >= ms, [ms])
}

type Step = 'winner' | 'stage' | 'curse' | 'done'

function BetPanel({ state, meId, myInput, send, now }: PanelProps) {
  const draft = readBet(myInput)
  const first = state.round === 1
  const step: Step = first && draft.winner === null ? 'winner' : draft.stage === null ? 'stage' : !draft.done ? 'curse' : 'done'
  const canTap = useTapGuard(step)

  // O que já foi escolhido viaja junto a cada toque (cada `send` substitui o anterior).
  const kept: Record<string, unknown> = {}
  if (draft.winner !== null) kept.winner = draft.winner
  if (draft.stage !== null) kept.stage = draft.stage
  const choose = (fields: Record<string, unknown>, last = false) => {
    if (!canTap()) return
    if (last) buzz()
    send(last ? { ...kept, ...fields, done: true } : { ...kept, ...fields })
  }

  // Da líder para a última (na largada, na ordem fixa das bruxas).
  const started = state.positions.some((position) => position > 0)
  const order = started ? standings(state.positions, state.arrivals) : WITCHES.map((witch) => witch.id)
  const where = (witch: number) => (started ? `casa ${state.positions[witch]} · ${order.indexOf(witch) + 1}º lugar` : 'na largada')
  const total = first ? 3 : 2
  const number = step === 'winner' ? 1 : step === 'stage' ? (first ? 2 : 1) : total

  return (
    <Box>
      <Header state={state} meId={meId} now={now} grace />
      {step !== 'done' && (
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', mb: 0.5 }}>
          {`PASSO ${number} DE ${total}`}
        </Typography>
      )}
      <Box key={step} className="animate-pop-in">
        {step === 'winner' && (
          <>
            <Question title="🏆 Quem vence a CORRIDA?" help={`Vale a corrida toda: acertou, +${WINNER_PAYS} 🍬 no fim.`} />
            <WitchList order={WITCHES.map((witch) => witch.id)} info={(witch) => witchOf(witch).title} onPick={(witch) => choose({ winner: witch })} />
          </>
        )}
        {step === 'stage' && (
          <>
            <Question
              title="🥇 Quem fica NA FRENTE no fim desta etapa?"
              help={`1º lugar paga ${LEADER_PAYS} 🍬 · 2º lugar paga ${SECOND_PAYS} 🍬`}
            />
            <WitchList order={order} info={where} onPick={(witch) => choose({ stage: witch })} />
          </>
        )}
        {step === 'curse' && (
          <>
            <Question
              title="🕯️ Jogue uma maldição"
              help={`A mais amaldiçoada (${MIN_CURSES}+, sem empate) cai e volta ${FALL_SQUARES} casas no fim da etapa.`}
            />
            <WitchList
              order={order}
              info={where}
              curse
              blocked={draft.stage}
              blockedNote="é a sua aposta"
              onPick={(witch) => choose({ curse: witch }, true)}
            />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => choose({ curse: null }, true)}
              sx={{
                mt: 1.25,
                minHeight: 56,
                fontWeight: 800,
                fontSize: '1.05rem',
                textTransform: 'none',
                borderWidth: 2,
                borderColor: 'var(--border-medium)',
                color: 'var(--text-primary)',
                '&:hover': { borderWidth: 2 },
              }}
            >
              🙅 Sem maldição
            </Button>
          </>
        )}
        {step === 'done' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>✅</Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1.05, mt: 1 }}>Apostas feitas!</Typography>
            <MyBets bet={{ stage: draft.stage, curse: draft.curse }} champion={draft.winner} showChampion={first} />
            <Typography sx={{ mt: 2, color: ACCENT.main, fontWeight: 700 }}>
              {/* O ✓ do juiz chega com atraso: eu já conto como feito. */}
              {`Esperando os outros (${state.acted.includes(meId) ? state.acted.length : state.acted.length + 1}/${state.roster.length})`}
            </Typography>
            <Button
              variant="text"
              onClick={() => {
                if (canTap()) send({})
              }}
              sx={{ mt: 1, color: 'var(--text-secondary)', textTransform: 'none', fontWeight: 700 }}
            >
              ↩️ Mudar apostas
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function Question({ title, help }: { title: string; help: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1.2 }}>{title}</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', mt: 0.25 }}>{help}</Typography>
    </Box>
  )
}

function WitchList({
  order,
  info,
  onPick,
  curse = false,
  blocked = null,
  blockedNote,
}: {
  order: number[]
  info: (witch: number) => string
  onPick: (witch: number) => void
  curse?: boolean
  blocked?: number | null
  blockedNote?: string
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {order.map((witch) => {
        const w = witchOf(witch)
        const off = blocked === witch
        return (
          <Button
            key={witch}
            fullWidth
            disabled={off}
            onClick={() => onPick(witch)}
            sx={{
              minHeight: 64,
              justifyContent: 'flex-start',
              gap: 1.5,
              px: 1.25,
              py: 1,
              textTransform: 'none',
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${withAlpha(w.color, curse ? 0.5 : 0.75)}`,
              background: curse
                ? 'linear-gradient(90deg, rgba(88, 28, 135, 0.5), rgba(12, 6, 20, 0.9))'
                : `linear-gradient(90deg, ${withAlpha(w.color, 0.3)}, rgba(12, 6, 20, 0.85))`,
              color: 'var(--text-primary)',
              '&:hover': { background: withAlpha(w.color, 0.35) },
              '&.Mui-disabled': { opacity: 0.45, color: 'var(--text-muted)' },
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 46,
                height: 46,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.6rem',
                lineHeight: 1,
                background: `radial-gradient(circle at 34% 30%, ${w.light}, ${w.color} 60%)`,
                border: `2px solid ${w.light}`,
              }}
            >
              {w.emoji}
            </Box>
            <Box sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1, color: w.light }}>
                {curse ? `🕯️ ${w.name}` : w.name}
              </Typography>
              <Typography noWrap sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {off ? blockedNote : info(witch)}
              </Typography>
            </Box>
          </Button>
        )
      })}
    </Box>
  )
}

/** As minhas escolhas da etapa (e a campeã), em linhas curtinhas. */
function MyBets({ bet, champion, showChampion }: { bet: CvBet | undefined; champion: number | null | undefined; showChampion: boolean }) {
  const rows: { icon: string; label: string; witch: number | null | undefined; none: string }[] = [
    { icon: '🥇', label: 'Na frente', witch: bet?.stage, none: 'não apostou 😴' },
    { icon: '🕯️', label: 'Maldição', witch: bet?.curse, none: 'nenhuma' },
  ]
  if (showChampion) rows.push({ icon: '🏆', label: 'Campeã', witch: champion, none: 'não apostou' })
  return (
    <Box sx={{ mt: 2, p: 1.5, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rows.map((row) => (
        <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: '1.05rem' }}>
          <Typography component="span" sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
            {row.icon} {row.label}
          </Typography>
          <Typography component="span" sx={{ fontWeight: 800 }}>
            {typeof row.witch === 'number' ? <WitchTag witch={row.witch} /> : row.none}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function RacePanel({ state, meId, now }: PanelProps) {
  const champion = state.winnerBets[String(meId)]
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} meId={meId} now={now} grace={false} />
      <Typography className="animate-float" sx={{ fontSize: '4rem', lineHeight: 1 }}>
        📺
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.3rem', lineHeight: 1.05, mt: 1 }}>Olhe a TV!</Typography>
      <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>As bruxas estão voando. Grite pela sua! 📣</Typography>
      <MyBets bet={state.bets[String(meId)]} champion={champion} showChampion />
    </Box>
  )
}

function PayoutPanel({ state, players, meId, now }: PanelProps) {
  const payout = state.payout
  const gain = payout?.gains[String(meId)] ?? 0
  const reasons: { key: string; text: ReactNode }[] = []
  if (payout?.onLeader.includes(meId)) {
    reasons.push({ key: 'leader', text: <>🥇 <WitchTag witch={payout.leader} /> liderou: +{LEADER_PAYS}</> })
  }
  if (payout?.onSecond.includes(meId)) {
    reasons.push({ key: 'second', text: <>🥈 <WitchTag witch={payout.second} /> ficou em 2º: +{SECOND_PAYS}</> })
  }
  if (payout?.champions.includes(meId)) {
    reasons.push({ key: 'champion', text: <>🏆 Você apostou na campeã: +{WINNER_PAYS}</> })
  }
  if (payout?.cursers.includes(meId)) {
    reasons.push({ key: 'curse', text: <>🕯️ Sua maldição derrubou <WitchTag witch={state.race?.fell} />!</> })
  }
  const place = ranking(state.scores, state.roster).find((entry) => entry.id === meId)
  const leader = ranking(state.scores, state.roster)[0]
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} meId={meId} now={now} grace={false} />
      {state.winner !== null && (
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', lineHeight: 1.1, mb: 1 }}>
          🏁 <WitchTag witch={state.winner} /> venceu a corrida!
        </Typography>
      )}
      <Typography
        className="animate-pop-in"
        sx={{ fontFamily: 'var(--font-numeric)', fontSize: '4.4rem', lineHeight: 1, color: gain ? ACCENT.main : 'var(--text-muted)' }}
      >
        {gain ? `+${gain}` : '0'} 🍬
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>{gain ? 'doces nesta etapa!' : 'Nada desta vez… 👻'}</Typography>
      {reasons.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {reasons.map((reason) => (
            <Typography key={reason.key} sx={{ fontWeight: 700 }}>
              {reason.text}
            </Typography>
          ))}
        </Box>
      )}
      <Typography sx={{ mt: 2, color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
        Você tem {candies(place?.score ?? 0)} · {place ? `${place.place}º lugar` : 'fora do placar'}
      </Typography>
      {leader && leader.score > 0 && leader.id !== meId && (
        <Typography sx={{ color: 'var(--text-muted)', mt: 0.5 }}>
          Na frente: {namesOrNobody([leader.id], players)} com {candies(leader.score)}
        </Typography>
      )}
    </Box>
  )
}

function FinalPanel({ state, players, meId }: PanelProps) {
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === meId)
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da corrida</Typography>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
        {awards.winner !== null ? (
          <>
            🏁 <WitchTag witch={awards.winner} /> venceu!
          </>
        ) : (
          <>
            Corrida encerrada — <WitchTag witch={awards.leader} /> estava na frente.
          </>
        )}
      </Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: mine.place === 1 ? ACCENT.main : 'var(--text-primary)' }}>
          Você ficou em {mine.place}º com {candies(mine.score)}
        </Typography>
      )}
      {awards.champions.includes(meId) && (
        <Typography sx={{ color: ACCENT.light, fontWeight: 700 }}>🏆 Você apostou na campeã desde a largada!</Typography>
      )}
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>🍬 Rei dos doces</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {awards.kings.length ? `${namesOrNobody(awards.kings, players)} (${candies(awards.topCandy)})` : 'Ninguém'}
        </Typography>
      </Box>
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>🕯️ Mestre das maldições</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {awards.curseMasters.length ? namesOrNobody(awards.curseMasters, players) : 'Ninguém derrubou ninguém'}
        </Typography>
      </Box>
    </Box>
  )
}
