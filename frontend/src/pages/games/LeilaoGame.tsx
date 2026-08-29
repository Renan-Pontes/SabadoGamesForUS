import { useEffect, useMemo, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import { bidLeilao, tickLeilao } from '../../lib/api'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  CountdownRing,
  GameCard,
  GameShell,
  PlayerRail,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import { haptic, namesFor, playerLabel, playerState, readNumberArray } from '../../games/utils'

const ACCENT = getAccent('leilao-de-cem-votos')
const BID_SECONDS = 15
/** Atalhos de lance: o relógio é de 15s, ninguém digita número inteiro a tempo. */
const QUICK_RAISES = [1, 5, 10, 25]

export default function LeilaoGame() {
  const {
    code,
    viewMode,
    isTv,
    state,
    deadline,
    players,
    me,
    meState,
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
  } = useGameRoom({ tick: tickLeilao, pollMs: 1500 })

  const [bidValue, setBidValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const round = typeof state.round === 'number' ? state.round : 1
  const maxRounds = typeof state.max_rounds === 'number' ? state.max_rounds : 10
  const pot = typeof state.pot === 'number' ? state.pot : 0
  const carry = typeof state.carry === 'number' ? state.carry : 0
  const highestBid = typeof state.highest_bid === 'number' ? state.highest_bid : 0
  const highestBidderId =
    typeof state.highest_bidder_id === 'number' ? state.highest_bidder_id : null
  const lastWinnerId = typeof state.last_winner_id === 'number' ? state.last_winner_id : null
  const lastBid = typeof state.last_bid === 'number' ? state.last_bid : null
  const suddenDeath = Boolean(state.sudden_death)
  const tiePlayers = readNumberArray(state, 'tie_players')
  const winners = readNumberArray(state, 'winners')

  const mePoints = typeof meState.points === 'number' ? meState.points : 0
  const meBid = typeof meState.bid === 'number' ? meState.bid : 0
  const meSubmitted = Boolean(meState.submitted)
  const meEliminated = Boolean(meState.eliminated)
  const meIsTopBidder = Boolean(me && highestBidderId === me.id)
  const meBenched = suddenDeath && me !== null && !tiePlayers.includes(me.id)

  const highestBidder = players.find((player) => player.id === highestBidderId) ?? null
  const lastWinner = players.find((player) => player.id === lastWinnerId) ?? null

  const activePlayers = useMemo(
    () => players.filter((player) => !playerState(player).eliminated),
    [players],
  )
  const pendingCount = activePlayers.filter(
    (player) => !(suddenDeath && !tiePlayers.includes(player.id)),
  ).length

  // Lance mínimo válido: precisa superar o topo atual.
  const minBid = Math.max(highestBid + 1, meBid)
  const maxAffordable = mePoints + meBid

  // A cada rodada nova, limpa o campo.
  useEffect(() => {
    setBidValue('')
  }, [round, suddenDeath])

  async function submitBid(value: number) {
    if (!code || submitting) return
    if (!Number.isFinite(value) || value < minBid) {
      setError(`O lance precisa ser de pelo menos ${minBid} pontos.`)
      return
    }
    if (value > maxAffordable) {
      setError(`Você só consegue chegar a ${maxAffordable} pontos.`)
      return
    }
    setSubmitting(true)
    setError('')
    haptic()
    try {
      await bidLeilao(code, value)
      setBidValue('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível dar o lance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GameShell
      title="LEILÃO DE CEM VOTOS"
      tagline="Cada rodada tem um pote. Quem der o maior lance leva — e tudo que foi gasto engorda o pote seguinte."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      headerExtra={
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 5 },
          }}
        >
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={BID_SECONDS}
            accent={ACCENT.main}
            size={isTv ? 220 : 150}
            label="Para cobrir"
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill
              label={suddenDeath ? 'Morte súbita' : 'Rodada'}
              value={suddenDeath ? '∞' : `${round}/${maxRounds}`}
              accent={suddenDeath ? 'var(--accent-red)' : ACCENT.main}
              filled={suddenDeath}
              size={isTv ? 'lg' : 'md'}
            />
            <StatPill label="Em jogo" value={pendingCount} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
            {carry > 0 && (
              <StatPill
                label="Acumulado"
                value={`+${carry}`}
                accent="var(--accent-gold)"
                size={isTv ? 'lg' : 'md'}
              />
            )}
          </Box>
        </Box>
      }
    >
      {/* O palco: pote e lance a bater */}
      <GameCard accent={ACCENT.main} highlight>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' },
            alignItems: 'center',
            gap: { xs: 3, md: 4 },
            textAlign: 'center',
            py: { xs: 1, md: 2 },
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: '0.68rem',
                letterSpacing: '0.24em',
                color: 'var(--text-muted)',
                fontWeight: 800,
              }}
            >
              POTE DA RODADA
            </Typography>
            <Typography
              key={pot}
              className="animate-pop-in"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: isTv ? { xs: '4.5rem', md: '8rem' } : { xs: '3.5rem', md: '5rem' },
                lineHeight: 1,
                color: 'var(--accent-gold)',
                textShadow: '0 0 50px var(--accent-gold-glow)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pot}
            </Typography>
          </Box>

          <Box
            sx={{
              display: { xs: 'none', sm: 'block' },
              width: 1,
              height: '70%',
              background: 'rgba(255,255,255,0.1)',
              mx: 'auto',
            }}
          />

          <Box>
            <Typography
              sx={{
                fontSize: '0.68rem',
                letterSpacing: '0.24em',
                color: 'var(--text-muted)',
                fontWeight: 800,
              }}
            >
              LANCE A BATER
            </Typography>
            <Typography
              key={highestBid}
              className="animate-pop-in"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: isTv ? { xs: '4.5rem', md: '8rem' } : { xs: '3.5rem', md: '5rem' },
                lineHeight: 1,
                color: highestBid > 0 ? ACCENT.main : 'var(--text-muted)',
                textShadow: highestBid > 0 ? `0 0 50px ${ACCENT.glow}` : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {highestBid > 0 ? highestBid : '—'}
            </Typography>
            <Typography
              sx={{
                mt: 0.5,
                fontWeight: 700,
                color: highestBidder ? ACCENT.light : 'var(--text-muted)',
                minHeight: '1.5em',
              }}
            >
              {highestBidder
                ? meIsTopBidder
                  ? 'Você está na frente'
                  : `${playerLabel(highestBidder)} lidera`
                : 'Ninguém deu lance ainda'}
            </Typography>
          </Box>
        </Box>

        {suddenDeath && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent-red)',
              background: 'rgba(220, 38, 38, 0.14)',
              textAlign: 'center',
              '--pulse-color': 'rgba(220, 38, 38, 0.4)',
              animation: 'pulseGlow 2.4s ease-in-out infinite',
            }}
          >
            <Typography sx={{ color: 'var(--accent-red-light)', fontWeight: 800, letterSpacing: '0.1em' }}>
              ⚔️ MORTE SÚBITA — {namesFor(tiePlayers, players)}
            </Typography>
          </Box>
        )}

        {lastWinner && lastBid !== null && (
          <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--text-muted)' }}>
            Rodada anterior: <strong style={{ color: 'var(--status-ready)' }}>{playerLabel(lastWinner)}</strong>{' '}
            levou o pote com {lastBid} pontos.
          </Typography>
        )}
      </GameCard>

      <GameCard title="Jogadores" hint="Só você enxerga seus próprios pontos" accent={ACCENT.main} sx={{ mt: 2 }} index={1}>
        {isTv ? (
          <PlayerRail
            players={players}
            accent={ACCENT.main}
            describe={(player) => {
              const pState = playerState(player)
              const eliminated = Boolean(pState.eliminated)
              const isLeader = player.id === highestBidderId
              return {
                value: isLeader ? highestBid : undefined,
                caption: eliminated ? 'Sem pontos' : isLeader ? 'Lance mais alto' : 'Na disputa',
                eliminated,
                highlight: isLeader,
                badge: eliminated ? '💀' : isLeader ? '🔨' : undefined,
              }
            }}
          />
        ) : (
          <PlayerRoster
            players={players}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => {
              const pState = playerState(player)
              const eliminated = Boolean(pState.eliminated)
              const isSelf = Boolean(me && player.id === me.id)
              const points = typeof pState.points === 'number' ? pState.points : null
              const isLeader = player.id === highestBidderId
              return {
                eliminated,
                highlight: isLeader,
                ready: Boolean(pState.submitted),
                status: eliminated
                  ? 'Ficou sem pontos'
                  : suddenDeath && !tiePlayers.includes(player.id)
                    ? 'Fora da morte súbita'
                    : isLeader
                      ? 'Lance mais alto'
                      : 'Na disputa',
                trailing: (
                  <StatPill
                    label="Pontos"
                    value={isSelf && points !== null ? points : '•••'}
                    size="sm"
                    accent={ACCENT.main}
                    filled={isSelf}
                  />
                ),
              }
            }}
          />
        )}
      </GameCard>

      {viewMode === 'player' && (
        <ActionPanel
          title={meIsTopBidder ? `Seu lance: ${meBid} — você lidera` : 'Dê seu lance'}
          hint={`Você tem ${mePoints} pontos livres. Lance mínimo: ${minBid}. Pontos gastos não voltam.`}
          accent={ACCENT.main}
          lockedReason={
            meEliminated
              ? 'Você ficou sem pontos e está fora.'
              : meBenched
                ? 'A morte súbita é entre os dois líderes. Assista.'
                : !isLive
                  ? 'A partida não está em andamento.'
                  : undefined
          }
        >
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {QUICK_RAISES.map((raise) => {
              const target = minBid + raise - 1
              const affordable = target <= maxAffordable
              return (
                <Button
                  key={raise}
                  variant="outlined"
                  disabled={submitting || !affordable}
                  onClick={() => submitBid(target)}
                  sx={{ flex: '1 1 90px', flexDirection: 'column', py: 1.25, gap: 0 }}
                >
                  <Box component="span" sx={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)' }}>
                    {target}
                  </Box>
                  <Box component="span" sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', opacity: 0.7 }}>
                    {raise === 1 ? 'MÍNIMO' : `+${raise - 1}`}
                  </Box>
                </Button>
              )
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <TextField
              type="number"
              value={bidValue}
              onChange={(event) => setBidValue(event.target.value)}
              placeholder={String(minBid)}
              slotProps={{ htmlInput: { min: minBid, max: maxAffordable, style: { fontSize: '1.4rem' } } }}
              sx={{ flex: '1 1 140px' }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<GavelRoundedIcon />}
              onClick={() => submitBid(Number(bidValue))}
              disabled={!bidValue || submitting}
              sx={{ flex: '1 1 160px', fontSize: '1.05rem' }}
            >
              {submitting ? 'Enviando...' : 'Dar lance'}
            </Button>
          </Box>

          {meSubmitted && !meIsTopBidder && (
            <Typography sx={{ mt: 2, textAlign: 'center', color: 'var(--status-waiting)', fontWeight: 700 }}>
              Seu lance de {meBid} foi coberto. Cubra de volta ou perca o que já apostou.
            </Typography>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={isTv || winners.includes(me?.id ?? -1) ? 'win' : 'lose'}
        title="LEILÃO ENCERRADO"
        subtitle={winners.length ? `Vencedores: ${namesFor(winners, players)}` : 'Partida encerrada.'}
      />
      <ResultOverlay
        open={!isTv && !isEnded && meEliminated}
        tone="lose"
        title="VOCÊ QUEBROU"
        subtitle="Seus pontos acabaram. Fim de linha no leilão."
      />
    </GameShell>
  )
}
