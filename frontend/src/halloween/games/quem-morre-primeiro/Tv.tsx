import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx } from '../../audio'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { useSuppressScares } from '../../scare'
import { finalAwards, type QmpState } from './engine'
import { meta } from './meta'

/**
 * TV do "Quem Morre Primeiro?". Só desenha o estado — quem decide a fase,
 * os votos e os pontos é o motor. Letras pensadas para 3 metros: texto de
 * pelo menos 28 px, títulos de 64 px para cima, cronômetro sempre à vista.
 */

const ACCENT = meta.accent
/** A lápide sobe um pouco depois das barras, para dar o suspense. */
const TOMBSTONE_DELAY_MS = 2400

export default function Tv({ state, players, now }: HalloweenViewProps<QmpState>) {
  // Susto de meme no meio da revelação estraga a piada: segura até passar.
  useSuppressScares(state.phase === 'reveal' || state.over)
  usePhaseSounds(state, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}
        >
          {state.over ? 'FIM DA NOITE' : `RODADA ${state.round}/${state.totalRounds}`}
        </Typography>
        {!state.over && (
          <Countdown deadline={state.deadline} now={now} graceMs={state.phase === 'vote' ? GRACE_MS : 0} />
        )}
      </Box>

      {state.phase === 'vote' && <VoteBoard state={state} players={players} />}
      {state.phase === 'reveal' && <RevealBoard state={state} players={players} />}
      {state.phase === 'scores' && <Scoreboard state={state} players={players} />}
      {state.over && <FinalBoard state={state} players={players} />}
    </Box>
  )
}

/** Sons de cada momento: tique-taque no fim da votação, rufar e grito na revelação. */
function usePhaseSounds(state: QmpState, now: () => number) {
  // O som toca uma vez por momento (rodada + fase), não a cada poll.
  const moment = `${state.round}-${state.phase}`
  const phase = state.phase
  const hasDead = (state.reveal?.dead.length ?? 0) > 0
  useEffect(() => {
    if (phase === 'vote') playSfx('bell', { volume: 0.6 })
    if (phase === 'scores') playSfx('ding')
    if (phase === 'final') playSfx('organ')
    if (phase !== 'reveal') return
    playSfx('drumroll')
    const timer = setTimeout(() => {
      playSfx(hasDead ? 'scream' : 'laugh')
      if (hasDead) playSfx('thunder', { volume: 0.7 })
    }, TOMBSTONE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [moment, phase, hasDead])

  // Tique-taque nos últimos 5 segundos da votação.
  const { seconds } = useCountdown(state.phase === 'vote' ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    playSfx('tick')
  }, [seconds])
}

function Countdown({ deadline, now, graceMs }: { deadline: number | null; now: () => number; graceMs: number }) {
  const { seconds } = useCountdown(deadline, now, graceMs)
  if (seconds === null) return null
  // Vermelho e pulsando só quando é para correr (fase de resposta).
  const urgent = graceMs > 0 && seconds <= 5
  return (
    <Box
      className={urgent ? 'animate-urgent' : undefined}
      sx={{
        width: 'clamp(110px, 9vw, 150px)',
        height: 'clamp(110px, 9vw, 150px)',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: `6px solid ${urgent ? 'var(--blood, #e0213a)' : ACCENT.main}`,
        boxShadow: `0 0 30px ${urgent ? 'rgba(224, 33, 58, 0.55)' : ACCENT.glow}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3.4rem, 4.6vw, 5rem)', lineHeight: 1 }}>
        {seconds}
      </Typography>
    </Box>
  )
}

function QuestionTitle({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: small ? 'clamp(1.8rem, 2.4vw, 2.6rem)' : 'clamp(2.2rem, 3vw, 3.4rem)',
          color: ACCENT.main,
          letterSpacing: '0.06em',
          lineHeight: 1,
        }}
      >
        🎬 Num filme de terror…
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: small ? 'clamp(2.2rem, 3.2vw, 3.4rem)' : 'clamp(3.4rem, 5.4vw, 6.2rem)',
          lineHeight: 1.08,
          color: 'var(--text-primary)',
          mt: 1,
          textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
        }}
      >
        {text}
      </Typography>
    </Box>
  )
}

function VoteBoard({ state, players }: { state: QmpState; players: HPlayer[] }) {
  const voted = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 5 } }}>
      <QuestionTitle text={state.question.text} />
      <Box sx={{ mt: 'auto' }}>
        <Typography sx={{ fontSize: 'clamp(1.7rem, 2.2vw, 2.3rem)', color: 'var(--text-secondary)', mb: 1.5 }}>
          Votem no celular · {voted.size}/{state.roster.length} já votaram
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {state.roster.map((id) => {
            const done = voted.has(id)
            const away = !online.has(id)
            return (
              <Box
                key={id}
                sx={{
                  px: 2.5,
                  py: 1,
                  borderRadius: 'var(--radius-full)',
                  border: `3px solid ${done ? ACCENT.main : 'var(--border-medium)'}`,
                  background: done ? `${ACCENT.main}22` : 'transparent',
                  color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 'clamp(1.7rem, 2.1vw, 2.2rem)',
                  fontWeight: 700,
                  opacity: away && !done ? 0.5 : 1,
                  transition: 'all 250ms ease',
                }}
              >
                {done ? '✓ ' : away ? '💤 ' : ''}
                {nameOf(players, id)}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

function RevealBoard({ state, players }: { state: QmpState; players: HPlayer[] }) {
  const reveal = state.reveal
  if (!reveal) return null
  const best = reveal.tally[0]?.count ?? 0
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <QuestionTitle text={state.question.text} small />
      {reveal.tally.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 5vw, 5.5rem)', lineHeight: 1.1 }}>
            👻 Ninguém votou…
            <br />
            os fantasmas ficaram com preguiça.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' },
            gap: 4,
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {reveal.tally.slice(0, 8).map((entry, index) => {
              const isDead = reveal.dead.includes(entry.id)
              return (
                <Box key={entry.id} className="stagger-in" style={{ animationDelay: `${index * 160}ms` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography
                      noWrap
                      sx={{
                        width: '30%',
                        fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)',
                        fontWeight: 700,
                        color: isDead ? ACCENT.main : 'var(--text-primary)',
                      }}
                    >
                      {isDead ? '💀 ' : ''}
                      {nameOf(players, entry.id)}
                    </Typography>
                    <Box sx={{ flex: 1, height: 'clamp(28px, 3vw, 40px)', background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(entry.count / Math.max(1, best)) * 100}%`,
                          background: isDead
                            ? `linear-gradient(90deg, ${ACCENT.main}, ${ACCENT.light})`
                            : 'linear-gradient(90deg, #5b4a7a, #8c7fa8)',
                          borderRadius: 2,
                          transformOrigin: 'left',
                          animation: 'qmpGrow 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
                          animationDelay: `${index * 160}ms`,
                          '@keyframes qmpGrow': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '1.6ch', textAlign: 'right' }}>
                      {entry.count}
                    </Typography>
                  </Box>
                  <Typography noWrap sx={{ pl: '30%', ml: 2, fontSize: 'clamp(1.2rem, 1.5vw, 1.6rem)', color: 'var(--text-muted)' }}>
                    {entry.voters.map((voter) => nameOf(players, voter)).join(', ')}
                  </Typography>
                </Box>
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {reveal.dead.slice(0, 3).map((id) => (
              <Tombstone
                key={id}
                name={nameOf(players, id)}
                epitaph={state.question.epitaph}
                votes={best}
                compact={reveal.dead.length > 1}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

function Tombstone({ name, epitaph, votes, compact }: { name: string; epitaph: string; votes: number; compact: boolean }) {
  return (
    <Box
      sx={{
        width: compact ? 'clamp(220px, 17vw, 300px)' : 'clamp(320px, 30vw, 520px)',
        textAlign: 'center',
        animation: `qmpRise 900ms cubic-bezier(0.22, 1, 0.36, 1) ${TOMBSTONE_DELAY_MS}ms both`,
        '@keyframes qmpRise': {
          from: { opacity: 0, transform: 'translateY(60px) scale(0.9)' },
          to: { opacity: 1, transform: 'none' },
        },
      }}
    >
      <Box
        sx={{
          px: compact ? 2 : 3,
          pt: compact ? 3 : 5,
          pb: compact ? 2.5 : 4,
          borderRadius: '48% 48% 14px 14px / 34% 34% 14px 14px',
          background: 'linear-gradient(180deg, #6b6480 0%, #3c3550 70%, #2a2438 100%)',
          border: '4px solid #8c84a3',
          boxShadow: `0 18px 50px rgba(0, 0, 0, 0.6), 0 0 40px ${ACCENT.glow}`,
          color: '#f3eeff',
        }}
      >
        <Typography sx={{ fontFamily: 'var(--font-horror)', fontSize: compact ? '1.3rem' : 'clamp(1.6rem, 2.2vw, 2.4rem)', color: '#d9d2ea' }}>
          AQUI JAZ
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: compact ? 'clamp(2.2rem, 2.8vw, 3rem)' : 'clamp(3.2rem, 4.6vw, 5.2rem)',
            lineHeight: 1,
            my: 1.5,
            wordBreak: 'break-word',
          }}
        >
          {name}
        </Typography>
        <Typography sx={{ fontStyle: 'italic', fontSize: compact ? '1.5rem' : 'clamp(1.7rem, 2.2vw, 2.4rem)', lineHeight: 1.2 }}>
          “{epitaph}”
        </Typography>
        <Typography sx={{ mt: 1.5, fontSize: compact ? '1.3rem' : '1.7rem', color: '#d9d2ea' }}>
          💀 {votes} {votes === 1 ? 'voto' : 'votos'}
        </Typography>
      </Box>
      {/* Montinho de terra com grama de gosma */}
      <Box sx={{ height: 18, mx: -2, borderRadius: '50% 50% 0 0', background: `linear-gradient(180deg, ${ACCENT.main}, #2d4a12)` }} />
    </Box>
  )
}

function Scoreboard({ state, players }: { state: QmpState; players: HPlayer[] }) {
  const { ranking } = finalAwards(state)
  const gained = new Set(state.reveal?.seers ?? [])
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.4rem, 5vw, 5.4rem)', color: ACCENT.main, lineHeight: 1 }}>
        Placar dos videntes
      </Typography>
      <RankList entries={ranking} players={players} gained={gained} deaths={state.deaths} />
    </Box>
  )
}

function RankList({
  entries,
  players,
  gained,
  deaths,
}: {
  entries: { id: number; score: number; place: number }[]
  players: HPlayer[]
  gained: Set<number>
  deaths: Record<string, number>
}) {
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
      {entries.map((entry, index) => (
        <Box
          key={entry.id}
          className="stagger-in"
          style={{ animationDelay: `${index * 70}ms` }}
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
          {gained.has(entry.id) && (
            <Typography sx={{ fontSize: 'clamp(1.4rem, 1.8vw, 1.9rem)', color: ACCENT.main, fontWeight: 800 }}>+1</Typography>
          )}
          <Typography sx={{ fontSize: 'clamp(1.4rem, 1.8vw, 1.9rem)', color: 'var(--text-muted)', minWidth: '3ch' }}>
            💀{deaths[String(entry.id)] ?? 0}
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(2rem, 2.8vw, 3rem)', minWidth: '2ch', textAlign: 'right' }}>
            {entry.score}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function FinalBoard({ state, players }: { state: QmpState; players: HPlayer[] }) {
  const awards = finalAwards(state)
  const names = (ids: number[]) => listNames(ids.map((id) => nameOf(players, id)))
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <AwardCard
          icon="🔮"
          title="Vidente da noite"
          names={awards.seers.length ? names(awards.seers) : 'Ninguém acertou nada'}
          detail={awards.seers.length ? `${awards.topScore} ${awards.topScore === 1 ? 'ponto' : 'pontos'}` : 'a galera é imprevisível'}
          delay={0}
        />
        <AwardCard
          icon="⚰️"
          title="Morreu mais vezes"
          names={awards.mostDead.length ? names(awards.mostDead) : 'Todo mundo sobreviveu'}
          detail={awards.mostDead.length ? `${awards.maxDeaths} ${awards.maxDeaths === 1 ? 'lápide' : 'lápides'}` : 'milagre!'}
          delay={600}
        />
      </Box>
      <RankList entries={awards.ranking} players={players} gained={new Set()} deaths={state.deaths} />
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
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color: ACCENT.light, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.4rem, 3.4vw, 3.8rem)', lineHeight: 1.1, mt: 1 }}>{names}</Typography>
      <Typography sx={{ fontSize: 'clamp(1.6rem, 2vw, 2.2rem)', color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
