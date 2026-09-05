import { useEffect, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { lobisomemNight, lobisomemOpenVote, lobisomemVote, tickLobisomem } from '../../lib/api'
import type { LobisomemNightPayload } from '../../lib/api'
import { useGameRoom } from '../../games/useGameRoom'
import { getAccent } from '../../games/theme'
import {
  ActionPanel,
  CountdownRing,
  GameCard,
  GameShell,
  PlayerRoster,
  ResultOverlay,
  StatPill,
} from '../../games/ui'
import { haptic, playerColor, playerLabel } from '../../games/utils'

const ACCENT = getAccent('lobisomem')
const PHASE_SECONDS: Record<string, number> = { night: 40, day: 300, vote: 60 }

const ROLE_ICONS: Record<string, string> = {
  lobisomem: '🐺',
  lacaio: '🐾',
  vidente: '🔮',
  ladrao: '🗝',
  encrenqueira: '🌀',
  insone: '🌙',
  aldeao: '🏠',
}

const ROLE_HINTS: Record<string, string> = {
  lobisomem: 'Você é lobisomem. Descubra quem é o outro — e não seja pego.',
  lacaio: 'Você conhece os lobisomens e vence com eles. Eles não sabem quem você é.',
  vidente: 'Espie a carta de um jogador, ou duas do centro.',
  ladrao: 'Troque sua carta pela de alguém — e veja o que virou.',
  encrenqueira: 'Troque as cartas de dois OUTROS jogadores, sem olhar.',
  insone: 'No fim da noite, veja se a sua carta ainda é a mesma.',
  aldeao: 'Você não faz nada à noite. De dia, encontre os lobisomens.',
}

type NightInfo =
  | { kind: 'wolves'; partners: number[] }
  | { kind: 'lone_wolf'; center_index: number | null; role: string | null }
  | { kind: 'minion'; wolves: number[] }
  | { kind: 'seer_player'; target_id: number; role: string }
  | { kind: 'seer_center'; cards: Record<string, string> }
  | { kind: 'robber'; target_id: number; new_role: string }
  | { kind: 'troublemaker'; swapped: number[] }
  | { kind: 'insomniac'; role: string }
  | { kind: 'slept' }

type Result = {
  dead: number[]
  vote_counts: Record<string, number>
  votes: Record<string, number | null>
  village_wins: boolean
  winners: number[]
  final_roles: Record<string, string>
  original_roles: Record<string, string>
  center: string[]
}

export default function LobisomemGame() {
  const {
    code,
    viewMode,
    isTv,
    setRoom,
    state,
    deadline,
    players,
    me,
    meState,
    isHost,
    canToggleView,
    loading,
    error,
    setError,
    goBack,
    toggleView,
    status,
    isEnded,
  } = useGameRoom({ tick: tickLobisomem, pollMs: 2000 })

  const [submitting, setSubmitting] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [centerPicked, setCenterPicked] = useState<number[]>([])

  const phase = typeof state.phase === 'string' ? state.phase : 'night'
  const nightRole = typeof state.current_night_role === 'string' ? state.current_night_role : null
  const nightRoles = (state.night_roles ?? []) as string[]
  const nightStep = typeof state.night_step === 'number' ? state.night_step : 0
  const labels = (state.role_labels ?? {}) as Record<string, string>
  const votesCast = typeof state.votes_cast === 'number' ? state.votes_cast : 0
  const result = (state.result ?? null) as Result | null
  const centerCount = typeof state.center_count === 'number' ? state.center_count : 3

  const myRole = typeof meState.role === 'string' ? meState.role : null
  const nightDone = Boolean(meState.night_done)
  const nightInfo = (meState.night_info ?? null) as NightInfo | null
  const myVote = meState.vote
  const hasVoted = myVote !== null && myVote !== undefined
  const isMyNightTurn = phase === 'night' && myRole === nightRole && !nightDone
  const others = players.filter((p) => p.id !== me?.id)

  useEffect(() => {
    setPicked([])
    setCenterPicked([])
  }, [phase, nightStep])

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

  const act = (payload: LobisomemNightPayload) =>
    run(() => lobisomemNight(code, payload), 'Não foi possível agir.')

  const nameOf = (id: number) => playerLabel(players.find((p) => p.id === id) ?? players[0])
  const roleLabel = (role: string | null | undefined) => (role ? `${ROLE_ICONS[role] ?? ''} ${labels[role] ?? role}` : '—')

  /** O que você aprendeu à noite, em uma frase. */
  function describeNight(info: NightInfo | null) {
    if (!info) return null
    switch (info.kind) {
      case 'wolves':
        return `Seu parceiro lobisomem: ${info.partners.map(nameOf).join(', ')}.`
      case 'lone_wolf':
        return info.role
          ? `Você é o único lobisomem. A carta ${(info.center_index ?? 0) + 1} do centro é ${roleLabel(info.role)}.`
          : 'Você é o único lobisomem entre os jogadores.'
      case 'minion':
        return info.wolves.length ? `Os lobisomens são: ${info.wolves.map(nameOf).join(', ')}.` : 'Não há lobisomem entre os jogadores — cuidado, você pode vencer sozinho.'
      case 'seer_player':
        return `${nameOf(info.target_id)} é ${roleLabel(info.role)}.`
      case 'seer_center':
        return `Centro: ${Object.entries(info.cards).map(([i, r]) => `carta ${Number(i) + 1} = ${roleLabel(r)}`).join(' · ')}.`
      case 'robber':
        return `Você roubou ${nameOf(info.target_id)} e agora é ${roleLabel(info.new_role)}.`
      case 'troublemaker':
        return `Você trocou as cartas de ${info.swapped.map(nameOf).join(' e ')}.`
      case 'insomniac':
        return `Ao acordar, sua carta é ${roleLabel(info.role)}.`
      case 'slept':
        return 'Você dormiu no ponto e não agiu.'
    }
  }

  const phaseLabel = phase === 'night' ? 'NOITE' : phase === 'day' ? 'DIA' : phase === 'vote' ? 'VOTAÇÃO' : 'AMANHECER'

  return (
    <GameShell
      title="LOBISOMEM"
      tagline="Uma noite só. De manhã, ninguém tem certeza nem da própria carta."
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 4 } }}>
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={PHASE_SECONDS[phase] ?? 60}
            accent={ACCENT.main}
            size={isTv ? 180 : 130}
            label={phase === 'night' ? 'Para agir' : phase === 'day' ? 'Para discutir' : 'Para votar'}
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Fase" value={phaseLabel} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            {phase === 'night' && (
              <StatPill label="Acordado" value={nightRole ? (labels[nightRole] ?? nightRole).toUpperCase() : '—'} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            )}
            {phase === 'vote' && (
              <StatPill label="Votaram" value={`${votesCast}/${players.length}`} accent="var(--accent-gold)" size={isTv ? 'lg' : 'md'} />
            )}
            <StatPill label="No centro" value={centerCount} accent={ACCENT.main} size={isTv ? 'lg' : 'md'} />
          </Box>
        </Box>
      }
    >
      {/* Sua carta */}
      {!isTv && myRole && (
        <GameCard accent={myRole === 'lobisomem' || myRole === 'lacaio' ? 'var(--accent-red)' : ACCENT.main} highlight sx={{ mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}>
              A CARTA QUE VOCÊ RECEBEU — SÓ VOCÊ VÊ
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '2.2rem', md: '3rem' }, letterSpacing: '0.06em', color: myRole === 'lobisomem' || myRole === 'lacaio' ? 'var(--accent-red)' : ACCENT.main }}>
              {roleLabel(myRole)}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>{ROLE_HINTS[myRole]}</Typography>
            {nightInfo && (
              <Typography className="animate-pop-in" sx={{ mt: 1.5, p: 1.5, borderRadius: 'var(--radius-md)', background: `${ACCENT.main}18`, color: 'var(--text-primary)', fontWeight: 700 }}>
                🌙 {describeNight(nightInfo)}
              </Typography>
            )}
            {phase !== 'night' && (
              <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Lembre: sua carta pode ter sido trocada durante a noite.
              </Typography>
            )}
          </Box>
        </GameCard>
      )}

      {/* A noite, passo a passo */}
      <GameCard title={phase === 'night' ? 'A NOITE' : 'A MESA'} hint={phase === 'night' ? `passo ${Math.min(nightStep + 1, nightRoles.length)}/${nightRoles.length}` : undefined} accent={ACCENT.main} highlight>
        {phase === 'night' ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
            {nightRoles.map((role, index) => {
              const done = index < nightStep
              const current = index === nightStep
              return (
                <Box key={role} sx={{ px: 2, py: 1.25, borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: 110, border: `2px solid ${current ? ACCENT.main : done ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'}`, background: current ? `${ACCENT.main}22` : 'rgba(255,255,255,0.03)', opacity: done ? 0.45 : 1, boxShadow: current ? `0 0 24px ${ACCENT.glow}` : 'none' }}>
                  <Typography sx={{ fontSize: isTv ? '2rem' : '1.4rem', lineHeight: 1 }}>{ROLE_ICONS[role]}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', color: current ? ACCENT.main : 'var(--text-muted)', mt: 0.5 }}>
                    {(labels[role] ?? role).toUpperCase()}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        ) : phase === 'ended' && result ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(200px, 1fr))' }, gap: 1.5 }}>
            {players.map((player) => {
              const original = result.original_roles[String(player.id)]
              const final = result.final_roles[String(player.id)]
              const died = result.dead.includes(player.id)
              const won = result.winners.includes(player.id)
              return (
                <Box key={player.id} sx={{ p: 1.5, borderRadius: 'var(--radius-md)', border: `2px solid ${died ? 'var(--accent-red)' : won ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'}`, background: died ? 'rgba(220,38,38,0.12)' : won ? 'rgba(212,165,32,0.12)' : 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontWeight: 800, color: playerColor(player.id) }}>
                    {playerLabel(player)} {died && '💀'} {won && '🏆'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {original !== final ? `Recebeu ${roleLabel(original)} → acordou ${roleLabel(final)}` : `${roleLabel(final)}`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {result.vote_counts[String(player.id)] ?? 0} voto(s) · votou em {result.votes[String(player.id)] ? nameOf(result.votes[String(player.id)] as number) : 'ninguém'}
                  </Typography>
                </Box>
              )
            })}
            <Box sx={{ p: 1.5, borderRadius: 'var(--radius-md)', border: '2px dashed rgba(255,255,255,0.15)' }}>
              <Typography sx={{ fontWeight: 800, color: 'var(--text-muted)' }}>Centro</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{result.center.map(roleLabel).join(' · ')}</Typography>
            </Box>
          </Box>
        ) : (
          <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: isTv ? '1.4rem' : '1rem', py: 2 }}>
            {phase === 'day' ? 'Conversem. Quem é lobisomem? Quem trocou de carta?' : 'Votação secreta em andamento.'}
          </Typography>
        )}
      </GameCard>

      <GameCard title="JOGADORES" accent={ACCENT.main} sx={{ mt: 2 }} index={1}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            highlight: result?.dead.includes(player.id) ?? false,
            status: phase === 'vote' ? 'Votando...' : phase === 'night' ? 'Dormindo' : 'Na mesa',
          })}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            isMyNightTurn
              ? `${roleLabel(myRole)} — sua vez de agir`
              : phase === 'day'
                ? 'Discussão'
                : phase === 'vote'
                  ? 'Quem deve morrer?'
                  : 'Aguarde'
          }
          hint={isMyNightTurn ? ROLE_HINTS[myRole ?? ''] : phase === 'vote' ? 'Voto secreto. Só morre quem tiver pelo menos dois votos.' : undefined}
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : phase === 'night' && !isMyNightTurn
                ? nightDone
                  ? 'Você já agiu. Aguarde os outros.'
                  : `É a vez de ${nightRole ? (labels[nightRole] ?? nightRole) : '—'}. Fique quieto.`
                : phase === 'day' && !isHost
                  ? 'Conversem em voz alta. O host abre a votação quando a mesa decidir.'
                  : phase === 'vote' && hasVoted
                    ? 'Voto registrado. Aguardando os outros.'
                    : undefined
          }
        >
          {/* Ações noturnas */}
          {isMyNightTurn && (myRole === 'lobisomem' || myRole === 'lacaio' || myRole === 'insone') && (
            <Button fullWidth variant="contained" color="secondary" disabled={submitting} onClick={() => act({})} sx={{ py: 1.8 }}>
              {myRole === 'lobisomem' ? 'Abrir os olhos' : myRole === 'lacaio' ? 'Ver os lobisomens' : 'Ver minha carta'}
            </Button>
          )}
          {isMyNightTurn && myRole === 'lobisomem' && (
            <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Se você for o único lobisomem, poderá espiar uma carta do centro.
            </Typography>
          )}
          {isMyNightTurn && myRole === 'lobisomem' && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              {[0, 1, 2].map((i) => (
                <Button key={i} variant="outlined" disabled={submitting} onClick={() => act({ center_index: i })} sx={{ flex: 1 }}>
                  Centro {i + 1}
                </Button>
              ))}
            </Box>
          )}

          {isMyNightTurn && myRole === 'vidente' && (
            <>
              <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-muted)', mb: 1 }}>ESPIAR UM JOGADOR</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {others.map((p) => (
                  <Button key={p.id} variant="outlined" disabled={submitting} onClick={() => act({ target_player_id: p.id })} sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: playerColor(p.id) }}>
                    {playerLabel(p)}
                  </Button>
                ))}
              </Box>
              <Typography sx={{ fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-muted)', mb: 1 }}>OU DUAS CARTAS DO CENTRO</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[0, 1, 2].map((i) => {
                  const on = centerPicked.includes(i)
                  return (
                    <Button key={i} variant={on ? 'contained' : 'outlined'} color="secondary" disabled={submitting} onClick={() => setCenterPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < 2 ? [...cur, i] : cur))} sx={{ flex: 1 }}>
                      Carta {i + 1}
                    </Button>
                  )
                })}
              </Box>
              <Button fullWidth variant="contained" color="secondary" disabled={submitting || centerPicked.length !== 2} onClick={() => act({ center_indexes: centerPicked })} sx={{ mt: 1.5 }}>
                Ver as duas
              </Button>
            </>
          )}

          {isMyNightTurn && myRole === 'ladrao' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {others.map((p) => (
                <Button key={p.id} variant="outlined" disabled={submitting} onClick={() => act({ target_player_id: p.id })} sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: playerColor(p.id) }}>
                  Roubar a carta de {playerLabel(p)}
                </Button>
              ))}
            </Box>
          )}

          {isMyNightTurn && myRole === 'encrenqueira' && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                {others.map((p) => {
                  const on = picked.includes(p.id)
                  return (
                    <Button key={p.id} variant={on ? 'contained' : 'outlined'} color="secondary" disabled={submitting} onClick={() => setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.length < 2 ? [...cur, p.id] : cur))} sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
                      {playerLabel(p)}
                    </Button>
                  )
                })}
              </Box>
              <Button fullWidth variant="contained" color="secondary" disabled={submitting || picked.length !== 2} onClick={() => act({ first_player_id: picked[0], second_player_id: picked[1] })}>
                Trocar as cartas dos dois
              </Button>
            </>
          )}

          {isMyNightTurn && myRole === 'aldeao' && (
            <Button fullWidth variant="outlined" color="inherit" disabled={submitting} onClick={() => act({})}>
              Continuar dormindo
            </Button>
          )}

          {/* Dia: o host abre a votação */}
          {phase === 'day' && isHost && (
            <Button fullWidth variant="contained" color="primary" disabled={submitting} onClick={() => run(() => lobisomemOpenVote(code), 'Não foi possível abrir a votação.')} sx={{ py: 1.8 }}>
              Encerrar a discussão e votar
            </Button>
          )}

          {/* Voto */}
          {phase === 'vote' && !hasVoted && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {others.map((p) => (
                <Button key={p.id} variant="outlined" color="error" disabled={submitting} onClick={() => run(() => lobisomemVote(code, p.id), 'Não foi possível votar.')} sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1.3 }}>
                  {playerLabel(p)}
                </Button>
              ))}
              <Button variant="text" color="inherit" disabled={submitting} onClick={() => run(() => lobisomemVote(code, null), 'Não foi possível votar.')}>
                Ninguém
              </Button>
            </Box>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded && Boolean(result)}
        tone={result ? (me && result.winners.includes(me.id) ? 'win' : isTv ? 'neutral' : 'lose') : 'neutral'}
        sigil={result?.village_wins ? '🏠' : '🐺'}
        title={result?.village_wins ? 'A ALDEIA VENCEU' : 'OS LOBISOMENS VENCERAM'}
        subtitle={result ? (result.dead.length ? `Morreu: ${result.dead.map(nameOf).join(', ')}.` : 'Ninguém morreu.') : undefined}
      />
    </GameShell>
  )
}
