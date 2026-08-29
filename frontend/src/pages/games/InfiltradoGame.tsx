import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  infiltradoAccuse,
  infiltradoSpyGuess,
  infiltradoVote,
  tickInfiltrado,
} from '../../lib/api'
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
import { haptic, playerLabel } from '../../games/utils'

const ACCENT = getAccent('o-infiltrado')
const ROUND_SECONDS = 8 * 60

type Accusation = {
  accuser_id: number
  accused_id: number
  votes: Record<string, boolean>
}

export default function InfiltradoGame() {
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
    canToggleView,
    loading,
    error,
    setError,
    goBack,
    toggleView,
    status,
    isEnded,
  } = useGameRoom({ tick: tickInfiltrado, pollMs: 2500 })

  const [submitting, setSubmitting] = useState(false)
  const [guessOpen, setGuessOpen] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'playing'
  const locations = (state.locations ?? []) as string[]
  const accusation = (state.accusation ?? null) as Accusation | null
  const winner = typeof state.winner === 'string' ? state.winner : null
  const reason = typeof state.reason === 'string' ? state.reason : null
  const revealedLocation = typeof state.location === 'string' ? state.location : null

  const amSpy = Boolean(meState.is_spy)
  const myLocation = typeof meState.location === 'string' ? meState.location : null
  const myRole = typeof meState.role === 'string' ? meState.role : null

  const accused = players.find((player) => player.id === accusation?.accused_id) ?? null
  const accuser = players.find((player) => player.id === accusation?.accuser_id) ?? null
  const myVote = me && accusation ? accusation.votes[String(me.id)] : undefined
  const amAccused = Boolean(me && accusation?.accused_id === me.id)

  async function run(action: () => Promise<unknown>, failure: string) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    haptic()
    try {
      setRoom((await action()) as never)
      setGuessOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : failure)
    } finally {
      setSubmitting(false)
    }
  }

  const outcomeText =
    reason === 'tempo_esgotado'
      ? 'O tempo acabou e o infiltrado não foi desmascarado.'
      : reason === 'infiltrado_desmascarado'
        ? 'A mesa apontou o infiltrado por unanimidade.'
        : reason === 'acusacao_errada'
          ? 'A mesa acusou a pessoa errada.'
          : reason === 'chute_do_infiltrado'
            ? winner === 'infiltrado'
              ? 'O infiltrado adivinhou o local.'
              : 'O infiltrado chutou o local errado.'
            : undefined

  return (
    <GameShell
      title="O INFILTRADO"
      tagline="Todos sabem onde estão, menos um. Perguntem uns aos outros sem entregar o lugar."
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
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 4 },
          }}
        >
          <CountdownRing
            deadlineTs={deadline}
            totalSeconds={ROUND_SECONDS}
            accent={ACCENT.main}
            size={isTv ? 200 : 150}
            label="Até o infiltrado escapar"
          />
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <StatPill label="Na mesa" value={players.length} accent={ACCENT.main} filled size={isTv ? 'lg' : 'md'} />
            <StatPill label="Locais" value={locations.length} accent={ACCENT.light} size={isTv ? 'lg' : 'md'} />
            <StatPill
              label="Situação"
              value={phase === 'voting' ? 'VOTAÇÃO' : phase === 'ended' ? 'FIM' : 'EM JOGO'}
              accent={phase === 'voting' ? 'var(--accent-red)' : ACCENT.main}
              size={isTv ? 'lg' : 'md'}
            />
          </Box>
        </Box>
      }
    >
      {/* O papel — a informação central do celular */}
      {!isTv && (
        <GameCard accent={amSpy ? 'var(--accent-red)' : ACCENT.main} highlight>
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography
              sx={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}
            >
              SÓ VOCÊ VÊ ISTO
            </Typography>
            {amSpy ? (
              <>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: { xs: '2.2rem', md: '3rem' },
                    letterSpacing: '0.08em',
                    color: 'var(--accent-red)',
                    textShadow: '0 0 30px rgba(220,38,38,0.5)',
                  }}
                >
                  ◉ VOCÊ É O INFILTRADO
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                  Você não sabe onde está. Finja que sabe, descubra o local e não se entregue.
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: { xs: '2.2rem', md: '3rem' },
                    letterSpacing: '0.05em',
                    color: ACCENT.main,
                    lineHeight: 1.1,
                  }}
                >
                  {myLocation}
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                  Você é: <strong style={{ color: ACCENT.light }}>{myRole}</strong>
                </Typography>
              </>
            )}
          </Box>
        </GameCard>
      )}

      {/* Locais possíveis: é daqui que o infiltrado chuta */}
      <GameCard
        title="LOCAIS POSSÍVEIS"
        hint={isEnded && revealedLocation ? `era ${revealedLocation}` : 'um deles é o certo'}
        accent={ACCENT.main}
        sx={{ mt: 2 }}
        index={1}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {locations.map((location) => {
            const isTheOne = isEnded && location === revealedLocation
            const isMine = location === myLocation
            return (
              <Box
                key={location}
                sx={{
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 'var(--radius-md)',
                  fontSize: isTv ? '0.95rem' : '0.8rem',
                  fontWeight: isMine || isTheOne ? 800 : 500,
                  border: `1px solid ${isTheOne ? 'var(--accent-gold)' : isMine ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                  background: isTheOne
                    ? 'rgba(212,165,32,0.2)'
                    : isMine
                      ? `${ACCENT.main}22`
                      : 'rgba(255,255,255,0.03)',
                  color: isTheOne
                    ? 'var(--accent-gold)'
                    : isMine
                      ? ACCENT.main
                      : 'var(--text-secondary)',
                }}
              >
                {location}
              </Box>
            )
          })}
        </Box>
      </GameCard>

      {/* Votação em curso */}
      {accusation && phase === 'voting' && (
        <GameCard accent="var(--accent-red)" highlight sx={{ mt: 2 }} index={2}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.6rem', md: '2.2rem' },
                color: 'var(--accent-red)',
                letterSpacing: '0.05em',
              }}
            >
              {accuser ? playerLabel(accuser) : 'Alguém'} acusa {accused ? playerLabel(accused) : '—'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
              A acusação só vale se a mesa inteira concordar. Um voto contra e o jogo continua.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {players
                .filter((player) => player.id !== accusation.accused_id)
                .map((player) => {
                  const vote = accusation.votes[String(player.id)]
                  return (
                    <Box
                      key={player.id}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: `1px solid ${
                          vote === undefined
                            ? 'rgba(255,255,255,0.12)'
                            : vote
                              ? 'var(--status-ready)'
                              : 'var(--accent-red)'
                        }`,
                        color:
                          vote === undefined
                            ? 'var(--text-muted)'
                            : vote
                              ? 'var(--status-ready)'
                              : 'var(--accent-red)',
                      }}
                    >
                      {playerLabel(player)} {vote === undefined ? '···' : vote ? '✓' : '✕'}
                    </Box>
                  )
                })}
            </Box>
          </Box>
        </GameCard>
      )}

      <GameCard title="A MESA" accent={ACCENT.main} sx={{ mt: 2 }} index={3}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => ({
            highlight: accusation?.accused_id === player.id,
            status:
              accusation?.accused_id === player.id
                ? '⚠ Acusado'
                : accusation?.accuser_id === player.id
                  ? 'Acusou'
                  : 'Fazendo perguntas',
          })}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            phase === 'voting'
              ? amAccused
                ? 'Você está sendo acusado'
                : 'Concorda com a acusação?'
              : guessOpen
                ? 'Onde você está?'
                : 'Acuse alguém ou continue perguntando'
          }
          hint={
            phase === 'playing' && !guessOpen
              ? amSpy
                ? 'Você pode chutar o local a qualquer momento — mas errar entrega o jogo à mesa.'
                : 'Acusar exige unanimidade. Se errar, o infiltrado vence na hora.'
              : undefined
          }
          accent={ACCENT.main}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : phase === 'voting' && amAccused
                ? 'Você não vota na própria acusação.'
                : phase === 'voting' && myVote !== undefined
                  ? `Você ${myVote ? 'concordou' : 'discordou'}. Aguardando o resto.`
                  : undefined
          }
        >
          {/* Votação */}
          {phase === 'voting' && !amAccused && myVote === undefined && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<CheckRoundedIcon />}
                disabled={submitting}
                onClick={() => run(() => infiltradoVote(code, true), 'Não foi possível votar.')}
                sx={{ py: 2 }}
              >
                É ele
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<CloseRoundedIcon />}
                disabled={submitting}
                onClick={() => run(() => infiltradoVote(code, false), 'Não foi possível votar.')}
                sx={{ py: 2 }}
              >
                Não acho
              </Button>
            </Box>
          )}

          {/* Chute do infiltrado */}
          {phase === 'playing' && guessOpen && amSpy && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {locations.map((location) => (
                <Button
                  key={location}
                  variant="outlined"
                  disabled={submitting}
                  onClick={() =>
                    run(() => infiltradoSpyGuess(code, location), 'Não foi possível chutar.')
                  }
                  sx={{ textTransform: 'none', fontSize: '0.8rem', py: 0.9 }}
                >
                  {location}
                </Button>
              ))}
              <Button variant="text" color="inherit" onClick={() => setGuessOpen(false)} fullWidth>
                Cancelar
              </Button>
            </Box>
          )}

          {/* Acusar / abrir chute */}
          {phase === 'playing' && !guessOpen && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {players
                  .filter((player) => player.id !== me?.id)
                  .map((player) => (
                    <Button
                      key={player.id}
                      variant="outlined"
                      color="error"
                      disabled={submitting}
                      onClick={() =>
                        run(() => infiltradoAccuse(code, player.id), 'Não foi possível acusar.')
                      }
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 1.3 }}
                    >
                      Acusar {playerLabel(player)}
                    </Button>
                  ))}
              </Box>

              {amSpy && (
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  onClick={() => setGuessOpen(true)}
                  sx={{ mt: 2, py: 1.8 }}
                >
                  Chutar o local
                </Button>
              )}
            </>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded}
        tone={winner === 'infiltrado' ? (amSpy ? 'win' : 'lose') : amSpy ? 'lose' : 'win'}
        sigil="◉"
        title={winner === 'infiltrado' ? 'O INFILTRADO ESCAPOU' : 'INFILTRADO DESMASCARADO'}
        subtitle={outcomeText}
      />
    </GameShell>
  )
}
