import { Box, Button, Typography } from '@mui/material'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown } from '../../framework/clockHooks'
import { finalAwards, type QmpState } from './engine'
import { meta } from './meta'

/**
 * Celular do "Quem Morre Primeiro?": uma ação clara por tela. Na votação,
 * um botão grande por pessoa; depois, o que aconteceu comigo.
 */

const ACCENT = meta.accent

export default function Phone(props: HalloweenViewProps<QmpState>) {
  const { state, me } = props
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (state.phase === 'vote') return <VotePanel {...props} />
  if (state.phase === 'reveal') return <RevealPanel {...props} />
  return <ScorePanel {...props} />
}

function Header({ state, now, grace }: { state: QmpState; now: () => number; grace: boolean }) {
  const { seconds } = useCountdown(state.deadline, now, grace ? GRACE_MS : 0)
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
        RODADA {state.round}/{state.totalRounds}
      </Typography>
      {seconds !== null && (
        <Typography
          sx={{
            fontFamily: 'var(--font-numeric)',
            fontSize: '1.8rem',
            lineHeight: 1,
            color: seconds <= 5 ? 'var(--blood, #e0213a)' : ACCENT.main,
          }}
        >
          ⏳ {seconds}
        </Typography>
      )}
    </Box>
  )
}

function VotePanel({ state, players, me, myInput, send, now }: HalloweenViewProps<QmpState>) {
  const chosen = typeof myInput?.vote === 'number' ? myInput.vote : null
  return (
    <Box>
      <Header state={state} now={now} grace />
      <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.25, mb: 2 }}>{state.question.text}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {state.roster.map((id) => {
          const selected = chosen === id
          return (
            <Button
              key={id}
              variant={selected ? 'contained' : 'outlined'}
              onClick={() => send({ vote: id })}
              sx={{
                minHeight: 56,
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                lineHeight: 1.15,
                borderWidth: 2,
                borderColor: selected ? ACCENT.main : 'var(--border-medium)',
                color: selected ? ACCENT.contrast : 'var(--text-primary)',
                background: selected ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
                '&:hover': { background: selected ? ACCENT.light : `${ACCENT.main}22`, borderWidth: 2 },
              }}
            >
              {nameOf(players, id)}
              {id === me?.id ? ' (eu)' : ''}
            </Button>
          )
        })}
      </Box>
      <Typography sx={{ mt: 2, textAlign: 'center', color: chosen !== null ? ACCENT.main : 'var(--text-secondary)', fontWeight: 600 }}>
        {chosen !== null
          ? `✓ Voto em ${nameOf(players, chosen)}. Dá para trocar até o fim. (${state.acted.length}/${state.roster.length} votaram)`
          : 'Toque em quem você acha que morre primeiro.'}
      </Typography>
    </Box>
  )
}

function RevealPanel({ state, players, me, now }: HalloweenViewProps<QmpState>) {
  const reveal = state.reveal
  if (!reveal || !me) return null
  const myVote = reveal.votes[String(me.id)]
  const iDied = reveal.dead.includes(me.id)
  const gotIt = reveal.seers.includes(me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>{iDied ? '⚰️' : reveal.dead.length ? '💀' : '👻'}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.05, mt: 1, color: iDied ? 'var(--blood, #e0213a)' : 'var(--text-primary)' }}>
        {iDied
          ? 'Você morreu!'
          : reveal.dead.length
            ? `${names(reveal.dead, players)} ${reveal.dead.length > 1 ? 'morreram' : 'morreu'}`
            : 'Ninguém morreu'}
      </Typography>
      {reveal.dead.length > 0 && (
        <Typography sx={{ fontStyle: 'italic', color: 'var(--text-secondary)', mt: 1 }}>“{state.question.epitaph}”</Typography>
      )}
      <Box sx={{ mt: 3, p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${gotIt ? ACCENT.main : 'var(--border-medium)'}` }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
          {myVote === undefined ? 'Você não votou 😴' : `Você votou em ${nameOf(players, myVote)}`}
        </Typography>
        {myVote !== undefined && (
          <Typography sx={{ color: gotIt ? ACCENT.main : 'var(--text-muted)', fontWeight: 800, fontSize: '1.3rem', mt: 0.5 }}>
            {gotIt ? '+1 🔮 Vidente!' : 'A galera pensou diferente.'}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function ScorePanel({ state, players, me, now }: HalloweenViewProps<QmpState>) {
  if (!me) return null
  const mine = finalAwards(state).ranking.find((entry) => entry.id === me.id)
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Header state={state} now={now} grace={false} />
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem' }}>Placar</Typography>
      <Typography sx={{ fontSize: '4rem', fontFamily: 'var(--font-numeric)', lineHeight: 1, color: ACCENT.main }}>
        {mine?.score ?? 0}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>
        {mine ? `${mine.place}º lugar` : 'fora do placar'} · 💀 {state.deaths[String(me.id)] ?? 0}{' '}
        {(state.deaths[String(me.id)] ?? 0) === 1 ? 'lápide' : 'lápides'}
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mt: 2 }}>Olhe a TV — {nameOf(players, finalAwards(state).ranking[0]?.id)} lidera.</Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: HalloweenViewProps<QmpState>) {
  if (!me) return null
  const awards = finalAwards(state)
  const mine = awards.ranking.find((entry) => entry.id === me.id)
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>Fim da noite</Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º com {mine.score} {mine.score === 1 ? 'ponto' : 'pontos'}
        </Typography>
      )}
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: `2px solid ${ACCENT.main}` }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>🔮 Vidente da noite</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {awards.seers.length ? names(awards.seers, players) : 'Ninguém'}
        </Typography>
      </Box>
      <Box sx={{ p: 2, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)' }}>
        <Typography sx={{ color: 'var(--text-muted)' }}>⚰️ Morreu mais vezes</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
          {awards.mostDead.length ? `${names(awards.mostDead, players)} (${awards.maxDeaths})` : 'Ninguém'}
        </Typography>
      </Box>
    </Box>
  )
}

function names(ids: number[], players: HPlayer[]) {
  return listNames(ids.map((id) => nameOf(players, id)))
}
