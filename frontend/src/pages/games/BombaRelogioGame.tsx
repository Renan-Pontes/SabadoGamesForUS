import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { bombaPass, tickBomba } from '../../lib/api'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import { ActionPanel, GameCard, GameShell, PlayerRoster, ResultOverlay, StatPill } from '../../games/ui'
import { haptic, namesFor, playerColor, playerLabel, readNumberArray, useNow } from '../../games/utils'

const ACCENT = getAccent('bomba-relogio')
const MAX_ROUNDS = 12

type LastBoom = {
  player_id: number
  round: number
  category: string
  passes: number
  eliminated: boolean
  lives_left: number
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {}
}

export default function BombaRelogioGame() {
  const {
    code,
    viewMode,
    isTv,
    state,
    players,
    me,
    canToggleView,
    loading,
    error,
    setError,
    refresh,
    goBack,
    toggleView,
    status,
    isLive,
    isEnded,
  } = useGameRoom({ tick: tickBomba, pollMs: 1000 })

  const [submitting, setSubmitting] = useState(false)
  const now = useNow(250)

  const phase = typeof state.phase === 'string' ? state.phase : 'ticking'
  const round = typeof state.round === 'number' ? state.round : 1
  const category = typeof state.category === 'string' ? state.category : ''
  const holderId = typeof state.holder_id === 'number' ? state.holder_id : null
  const lives = asRecord<number>(state.lives)
  const maxLives = typeof state.max_lives === 'number' ? state.max_lives : 3
  const startedTs = typeof state.started_ts === 'number' ? state.started_ts : null
  const minFuse = typeof state.min_fuse === 'number' ? state.min_fuse : 25
  const maxFuse = typeof state.max_fuse === 'number' ? state.max_fuse : 70
  const passCount = typeof state.pass_count === 'number' ? state.pass_count : 0
  const aliveIds = readNumberArray(state, 'alive_ids')
  const lastBoom = (state.last_boom ?? null) as LastBoom | null
  const winnerIds = readNumberArray(state, 'winner_ids')

  const holder = players.find((player) => player.id === holderId) ?? null
  const isHolder = Boolean(me && holderId === me.id && phase === 'ticking' && isLive)
  const myLives = me ? (lives[String(me.id)] ?? maxLives) : maxLives
  const nameOf = (id: number | null) => {
    const player = players.find((candidate) => candidate.id === id)
    return player ? playerLabel(player) : '—'
  }

  // Tensao: quanto mais tempo passa, mais a bomba treme. Ninguem sabe o momento exato.
  const elapsed = startedTs !== null && phase === 'ticking' ? Math.max(0, now / 1000 - startedTs) : 0
  const heat = Math.min(1, elapsed / maxFuse)
  const armed = elapsed >= minFuse
  const shakeSeconds = Math.max(0.12, 0.9 - heat * 0.8)

  async function act(run: () => Promise<unknown>, failure: string) {
    if (!code || submitting) return
    setSubmitting(true)
    setError('')
    haptic(30)
    try {
      await run()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  const livesText = (count: number) => (count > 0 ? '❤️'.repeat(count) + '🖤'.repeat(Math.max(0, maxLives - count)) : '💀')

  return (
    <GameShell
      title="BOMBA-RELÓGIO"
      tagline="Uma categoria na TV. Fale uma palavra, passe a bomba. Ela explode quando quiser."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill label="Rodada" value={`${Math.min(round, MAX_ROUNDS)}/${MAX_ROUNDS}`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill label="Na roda" value={aliveIds.length} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
          <StatPill label="Passadas" value={passCount} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          {!isTv && <StatPill label="Suas vidas" value={livesText(myLives)} accent={myLives <= 1 ? 'var(--accent-red)' : 'var(--status-ready)'} filled={myLives <= 1} size="md" />}
        </Box>
      }
    >
      {/* A categoria e a bomba */}
      <GameCard key={`round-${round}`} accent={ACCENT.main} highlight sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 800, color: ACCENT.main, textAlign: 'center' }}>
          CATEGORIA
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '1.8rem', md: isTv ? '3.6rem' : '2.4rem' },
            lineHeight: 1.1,
            textAlign: 'center',
            color: 'var(--text-primary)',
            mb: 2,
          }}
        >
          {category.toUpperCase()}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Box
            aria-hidden
            sx={{
              fontSize: { xs: '4rem', md: isTv ? '8rem' : '5rem' },
              lineHeight: 1,
              filter: `drop-shadow(0 0 ${12 + heat * 60}px rgba(239,68,68,${0.25 + heat * 0.65}))`,
              transform: `scale(${1 + heat * 0.25})`,
              transition: 'transform 400ms ease, filter 400ms ease',
              '@keyframes bombShake': {
                '0%': { rotate: '0deg', translate: '0 0' },
                '25%': { rotate: '-6deg', translate: '-3px 1px' },
                '50%': { rotate: '5deg', translate: '3px -1px' },
                '75%': { rotate: '-4deg', translate: '-2px 0' },
                '100%': { rotate: '0deg', translate: '0 0' },
              },
              animation: phase === 'ticking' ? `bombShake ${shakeSeconds}s infinite` : 'none',
            }}
          >
            {phase === 'boom' ? '💥' : '💣'}
          </Box>

          {phase === 'ticking' && holder && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', fontWeight: 800 }}>
                A BOMBA ESTÁ COM
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: { xs: '2rem', md: isTv ? '4rem' : '2.6rem' },
                  lineHeight: 1,
                  color: playerColor(holder.id),
                  textShadow: `0 0 24px ${playerColor(holder.id)}66`,
                }}
              >
                {isHolder ? 'VOCÊ' : playerLabel(holder).toUpperCase()}
              </Typography>
              <Typography sx={{ mt: 0.75, color: armed ? 'var(--accent-red-light)' : 'var(--text-muted)', fontWeight: armed ? 800 : 500, fontSize: { xs: '0.85rem', md: isTv ? '1.2rem' : '0.9rem' } }}>
                {armed ? '⚠️ Pode explodir a qualquer momento' : `${Math.floor(elapsed)}s na mesa`}
              </Typography>
            </Box>
          )}

          {phase === 'boom' && lastBoom && (
            <Box sx={{ textAlign: 'center' }} className="animate-pop-in">
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '1.8rem', md: isTv ? '3.4rem' : '2.2rem' }, color: 'var(--accent-red)', letterSpacing: '0.06em', lineHeight: 1.1 }}>
                EXPLODIU COM {nameOf(lastBoom.player_id).toUpperCase()}
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                {lastBoom.eliminated ? 'Sem vidas. Fora da roda.' : `Perdeu uma vida. Sobra${lastBoom.lives_left === 1 ? '' : 'm'} ${lastBoom.lives_left}.`} · {lastBoom.passes} passada{lastBoom.passes === 1 ? '' : 's'}
              </Typography>
            </Box>
          )}
        </Box>
      </GameCard>

      <GameCard title="A roda" hint="A bomba passa nesta ordem" accent={ACCENT.main} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const count = lives[String(player.id)] ?? maxLives
            return {
              eliminated: count <= 0,
              highlight: player.id === holderId && phase === 'ticking',
              ready: winnerIds.includes(player.id),
              status:
                count <= 0
                  ? 'Eliminado'
                  : player.id === holderId && phase === 'ticking'
                    ? '💣 Com a bomba'
                    : winnerIds.includes(player.id)
                      ? '🏆 Sobreviveu'
                      : '',
              trailing: (
                <Box component="span" sx={{ fontSize: { xs: '0.9rem', md: isTv ? '1.3rem' : '1rem' }, letterSpacing: '0.05em' }}>
                  {livesText(count)}
                </Box>
              ),
            }
          }}
        />
      </GameCard>

      {viewMode === 'player' && (
        <ActionPanel
          title={isHolder ? 'FALE UMA PALAVRA E PASSE!' : phase === 'boom' ? 'Respira.' : `A bomba está com ${nameOf(holderId)}`}
          hint={isHolder ? `Algo da categoria "${category}". Repetiu ou travou? A mesa decide. Passe rápido.` : 'Pense na sua palavra antes de a bomba chegar.'}
          accent={ACCENT.main}
          lockedReason={
            !isLive
              ? 'A partida não está em andamento.'
              : myLives <= 0
                ? 'Você está fora da roda. Assista a explosão dos outros.'
                : phase === 'boom'
                  ? 'Explodiu. A próxima rodada começa em instantes.'
                  : !isHolder
                    ? `Aguardando ${nameOf(holderId)} passar.`
                    : undefined
          }
        >
          <Button
            fullWidth
            variant="contained"
            color="error"
            disabled={submitting || !isHolder}
            onClick={() => act(() => bombaPass(code), 'Não foi possível passar a bomba.')}
            sx={{ py: 3.2, fontSize: '1.6rem', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
          >
            💣 PASSAR
          </Button>
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || (me !== null && winnerIds.includes(me.id)) ? 'win' : 'lose'}
        title={winnerIds.length === 1 ? 'ÚLTIMO DE PÉ' : 'SOBREVIVENTES'}
        subtitle={winnerIds.length ? `${namesFor(winnerIds, players)} saiu inteiro da roda.` : 'Ninguém sobrou.'}
      />
    </GameShell>
  )
}
