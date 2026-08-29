import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { resistenciaMission, resistenciaPropose, resistenciaVote } from '../../lib/api'
import type { Player } from '../../lib/types'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  GameCard,
  GameShell,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import { haptic, playerColor, playerLabel } from '../../games/utils'

const ACCENT = getAccent('resistencia')
const MAX_REJECTIONS = 5

type LastVote = {
  team: number[]
  leader_id: number
  votes: Record<string, boolean>
  approved: boolean
  mission: number
}

type LastMission = {
  mission: number
  team: number[]
  fails: number
  needed: number
  success: boolean
}

export default function ResistenciaGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state,
    players,
    me,
    meState,
    canToggleView,
    loading,
    error,
    setError,
    goBack,
    toggleView,
    status,
    isEnded,
  } = useGameRoom({ pollMs: 2000 })

  const [teamDraft, setTeamDraft] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'proposal'
  const order = useMemo(() => (state.order ?? []) as number[], [state.order])
  const leaderIndex = typeof state.leader_index === 'number' ? state.leader_index : 0
  const mission = typeof state.mission === 'number' ? state.mission : 1
  const teamSizes = (state.team_sizes ?? []) as number[]
  const proposedTeam = (state.proposed_team ?? []) as number[]
  const rejections = typeof state.rejections === 'number' ? state.rejections : 0
  const results = (state.results ?? []) as boolean[]
  const votes = (state.votes ?? {}) as Record<string, boolean>
  const lastVote = state.last_vote as LastVote | null | undefined
  const lastMission = state.last_mission as LastMission | null | undefined
  const winner = typeof state.winner === 'string' ? state.winner : null

  const seated = useMemo(
    () =>
      order
        .map((id) => players.find((player) => player.id === id))
        .filter((p): p is Player => Boolean(p)),
    [order, players],
  )

  const leaderId = order.length ? order[leaderIndex % order.length] : null
  const leader = seated.find((player) => player.id === leaderId) ?? null
  const amLeader = Boolean(me && leaderId === me.id)
  const myRole = typeof meState.role === 'string' ? meState.role : null
  const amSpy = myRole === 'espiao'
  const teamSize = teamSizes[mission - 1] ?? 2
  const onMission = Boolean(me && proposedTeam.includes(me.id))
  const myVote = me ? votes[String(me.id)] : undefined
  const myCardPlayed = meState.mission_card !== null && meState.mission_card !== undefined

  // Meus aliados: só os espiões enxergam uns aos outros.
  const knownSpies = useMemo(
    () =>
      amSpy
        ? seated.filter(
            (player) =>
              (player.state as Record<string, unknown> | undefined)?.role === 'espiao',
          )
        : [],
    [amSpy, seated],
  )

  useEffect(() => {
    setTeamDraft([])
  }, [mission, rejections, phase])

  async function run(action: () => Promise<unknown>, failure: string) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom((await action()) as never)
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMember(playerId: number) {
    setTeamDraft((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : current.length < teamSize
          ? [...current, playerId]
          : current,
    )
  }

  return (
    <GameShell
      title="A RESISTÊNCIA"
      tagline="Cinco missões. Alguns de vocês querem que elas falhem — e sabem exatamente quem são os outros."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      maxWidth={isTv ? 1200 : 820}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill label="Missão" value={`${mission}/5`} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Líder"
            value={leader ? playerLabel(leader) : '—'}
            accent={ACCENT.light}
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Equipe" value={teamSize} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Recusas"
            value={`${rejections}/${MAX_REJECTIONS}`}
            accent={rejections >= 3 ? 'var(--accent-red)' : 'var(--text-muted)'}
            filled={rejections >= 3}
            size={isTv ? 'lg' : 'md'}
          />
        </Box>
      }
    >
      {/* Trilha de missões */}
      <GameCard title="AS MISSÕES" hint="3 vitórias decidem" accent={ACCENT.main} highlight>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1.5, md: 3 } }}>
          {teamSizes.map((size, index) => {
            const result = results[index]
            const isCurrent = index === mission - 1 && !isEnded
            return (
              <Box
                key={index}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}
              >
                <Box
                  sx={{
                    width: isTv ? 92 : 62,
                    height: isTv ? 92 : 62,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: isTv ? '2.4rem' : '1.6rem',
                    border: `3px solid ${
                      result === true
                        ? 'var(--status-ready)'
                        : result === false
                          ? 'var(--accent-red)'
                          : isCurrent
                            ? ACCENT.main
                            : 'rgba(255,255,255,0.12)'
                    }`,
                    background:
                      result === true
                        ? 'rgba(34,197,94,0.18)'
                        : result === false
                          ? 'rgba(220,38,38,0.2)'
                          : 'rgba(255,255,255,0.03)',
                    color:
                      result === true
                        ? 'var(--status-ready)'
                        : result === false
                          ? 'var(--accent-red)'
                          : 'var(--text-primary)',
                    boxShadow: isCurrent ? `0 0 26px ${ACCENT.glow}` : 'none',
                    animation: isCurrent ? 'pulseGlow 2.6s ease-in-out infinite' : undefined,
                    '--pulse-color': ACCENT.glow,
                  }}
                >
                  {result === true ? '✓' : result === false ? '✕' : size}
                </Box>
                <Typography
                  sx={{ fontSize: '0.6rem', letterSpacing: '0.14em', fontWeight: 800, color: 'var(--text-muted)' }}
                >
                  MISSÃO {index + 1}
                </Typography>
                {index === 3 && teamSizes.length && seated.length >= 7 && (
                  <Typography sx={{ fontSize: '0.55rem', color: 'var(--accent-red-light)', fontWeight: 800 }}>
                    2 FALHAS
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>

        {lastMission && (
          <Typography sx={{ mt: 3, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Missão {lastMission.mission}:{' '}
            <strong style={{ color: lastMission.success ? 'var(--status-ready)' : 'var(--accent-red)' }}>
              {lastMission.success ? 'cumprida' : 'sabotada'}
            </strong>
            {lastMission.fails > 0 && ` · ${lastMission.fails} sabotagem(ns) — mas ninguém sabe de quem`}
          </Typography>
        )}
      </GameCard>

      {/* Sua identidade */}
      {!isTv && myRole && (
        <GameCard accent={amSpy ? 'var(--accent-red)' : 'var(--status-ready)'} highlight sx={{ mt: 2 }} index={1}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}
            >
              SUA IDENTIDADE — SÓ VOCÊ VÊ
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.9rem', md: '2.4rem' },
                letterSpacing: '0.06em',
                color: amSpy ? 'var(--accent-red)' : 'var(--status-ready)',
              }}
            >
              {amSpy ? '✶ ESPIÃO' : '◆ RESISTÊNCIA'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
              {amSpy
                ? knownSpies.length > 1
                  ? `Seus aliados: ${knownSpies
                      .filter((player) => player.id !== me?.id)
                      .map(playerLabel)
                      .join(', ')}`
                  : 'Você está sozinho nessa.'
                : 'Você não sabe quem é espião. Ninguém da resistência sabe.'}
            </Typography>
          </Box>
        </GameCard>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <GameCard title="A MESA" accent={ACCENT.main} index={2}>
          <PlayerRoster
            players={seated}
            currentUserId={me?.user?.id}
            accent={ACCENT.main}
            describe={(player) => {
              const voted = votes[String(player.id)]
              const isOnTeam = proposedTeam.includes(player.id)
              return {
                highlight: player.id === leaderId,
                ready: phase === 'vote' ? voted !== undefined : isOnTeam,
                status:
                  player.id === leaderId
                    ? '★ Líder da missão'
                    : phase === 'vote'
                      ? voted === undefined
                        ? 'Votando...'
                        : 'Votou'
                      : isOnTeam
                        ? 'Na equipe'
                        : 'Na mesa',
                trailing: isOnTeam ? (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 'var(--radius-full)',
                      background: playerColor(player.id),
                      color: '#0a0a0f',
                      fontSize: '0.58rem',
                      fontWeight: 900,
                      letterSpacing: '0.1em',
                    }}
                  >
                    EQUIPE
                  </Box>
                ) : undefined,
              }
            }}
          />
        </GameCard>

        {lastVote && (
          <GameCard
            title={`Votação da missão ${lastVote.mission}`}
            hint={lastVote.approved ? 'aprovada' : 'recusada'}
            accent={lastVote.approved ? 'var(--status-ready)' : 'var(--accent-red)'}
            index={3}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {seated.map((player) => {
                const approved = lastVote.votes[String(player.id)]
                return (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 0.75,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      {playerLabel(player)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        letterSpacing: '0.1em',
                        color: approved ? 'var(--status-ready)' : 'var(--accent-red)',
                      }}
                    >
                      {approved === undefined ? '—' : approved ? 'APROVOU' : 'RECUSOU'}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              O voto é aberto de propósito: é a única prova que a mesa tem.
            </Typography>
          </GameCard>
        )}
      </Box>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            phase === 'proposal'
              ? amLeader
                ? `Monte a equipe (${teamDraft.length}/${teamSize})`
                : 'Aguardando a proposta do líder'
              : phase === 'vote'
                ? 'A equipe proposta serve?'
                : onMission
                  ? 'Missão: cumprir ou sabotar?'
                  : 'Missão em andamento'
          }
          hint={
            phase === 'vote'
              ? 'O voto é público. Todo mundo vai ver como você votou.'
              : phase === 'mission' && onMission && !amSpy
                ? 'Você é da resistência: só pode cumprir.'
                : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : phase === 'proposal' && !amLeader
                ? `${leader ? playerLabel(leader) : 'O líder'} está montando a equipe.`
                : phase === 'vote' && myVote !== undefined
                  ? `Você ${myVote ? 'aprovou' : 'recusou'}. Aguardando o resto da mesa.`
                  : phase === 'mission' && !onMission
                    ? 'Você não foi enviado nesta missão. Observe.'
                    : phase === 'mission' && myCardPlayed
                      ? 'Carta jogada. Aguardando a equipe.'
                      : undefined
          }
        >
          {phase === 'proposal' && amLeader && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {seated.map((player) => {
                  const selected = teamDraft.includes(player.id)
                  return (
                    <Button
                      key={player.id}
                      onClick={() => toggleMember(player.id)}
                      sx={{
                        justifyContent: 'space-between',
                        py: 1.4,
                        px: 2,
                        textTransform: 'none',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${selected ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? `${ACCENT.main}26` : 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {me && player.id === me.id ? 'Você' : playerLabel(player)}
                      </Box>
                      {selected && <CheckRoundedIcon sx={{ color: ACCENT.main }} />}
                    </Button>
                  )
                })}
              </Box>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={submitting || teamDraft.length !== teamSize}
                onClick={() =>
                  run(() => resistenciaPropose(code, teamDraft), 'Não foi possível propor a equipe.')
                }
                sx={{ py: 1.8 }}
              >
                Propor equipe
              </Button>
            </>
          )}

          {phase === 'vote' && myVote === undefined && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckRoundedIcon />}
                disabled={submitting}
                onClick={() => run(() => resistenciaVote(code, true), 'Não foi possível votar.')}
                sx={{ py: 2 }}
              >
                Aprovar
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<CloseRoundedIcon />}
                disabled={submitting}
                onClick={() => run(() => resistenciaVote(code, false), 'Não foi possível votar.')}
                sx={{ py: 2 }}
              >
                Recusar
              </Button>
            </Box>
          )}

          {phase === 'mission' && onMission && !myCardPlayed && (
            <Box sx={{ display: 'grid', gridTemplateColumns: amSpy ? '1fr 1fr' : '1fr', gap: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                disabled={submitting}
                onClick={() => run(() => resistenciaMission(code, true), 'Não foi possível jogar.')}
                sx={{ py: 2 }}
              >
                Cumprir
              </Button>
              {amSpy && (
                <Button
                  variant="contained"
                  color="error"
                  disabled={submitting}
                  onClick={() => run(() => resistenciaMission(code, false), 'Não foi possível jogar.')}
                  sx={{ py: 2 }}
                >
                  Sabotar
                </Button>
              )}
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={winner === 'resistencia' ? 'win' : 'lose'}
        sigil={winner === 'resistencia' ? '◆' : '✶'}
        title={winner === 'resistencia' ? 'A RESISTÊNCIA VENCEU' : 'OS ESPIÕES VENCERAM'}
        subtitle={
          isEnded
            ? `Espiões: ${seated
                .filter((p) => (p.state as Record<string, unknown> | undefined)?.role === 'espiao')
                .map(playerLabel)
                .join(', ') || '—'}`
            : undefined
        }
      />
    </GameShell>
  )
}
