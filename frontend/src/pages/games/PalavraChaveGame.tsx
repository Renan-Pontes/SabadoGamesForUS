import { useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { palavraChaveClue, palavraChaveGuess, palavraChavePass } from '../../lib/api'
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
import { haptic } from '../../games/utils'

const ACCENT = getAccent('palavra-chave')

type Team = 'azul' | 'vermelho'
type Owner = Team | 'neutro' | 'assassino'
type Cell = { word: string; revealed: boolean; owner: Owner | null }

const TEAM_COLORS: Record<Team, string> = { azul: '#60a5fa', vermelho: '#f87171' }
const TEAM_LABELS: Record<Team, string> = { azul: 'AZUL', vermelho: 'VERMELHO' }
const OWNER_COLORS: Record<Owner, string> = {
  azul: '#2563eb',
  vermelho: '#dc2626',
  neutro: '#78716c',
  assassino: '#0a0a0f',
}

export default function PalavraChaveGame() {
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

  const [clueWord, setClueWord] = useState('')
  const [clueCount, setClueCount] = useState(2)
  const [submitting, setSubmitting] = useState(false)

  const phase = typeof state.phase === 'string' ? state.phase : 'clue'
  const board = (state.board ?? []) as Cell[]
  const turnTeam = (typeof state.turn_team === 'string' ? state.turn_team : 'azul') as Team
  const clue = state.clue as { word: string; count: number; team: Team } | null | undefined
  const guessesLeft = typeof state.guesses_left === 'number' ? state.guesses_left : 0
  const remaining = (state.remaining ?? {}) as Record<Team, number>
  const winner = (typeof state.winner === 'string' ? state.winner : null) as Team | null
  const lossReason = typeof state.loss_reason === 'string' ? state.loss_reason : null

  const myTeam = (typeof meState.team === 'string' ? meState.team : null) as Team | null
  const amSpymaster = Boolean(meState.is_spymaster)
  const myKey = (meState.key ?? null) as Owner[] | null
  const myTurn = myTeam === turnTeam

  useEffect(() => {
    setClueWord('')
    setClueCount(2)
  }, [turnTeam, phase])

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

  const canGuess = phase === 'guess' && myTurn && !amSpymaster && !isEnded

  /**
   * A cor de uma célula: a mesa só vê o que já foi virado, mas o
   * espião-mestre vê o gabarito inteiro por baixo.
   */
  function cellOwner(cell: Cell, index: number): Owner | null {
    if (cell.revealed) return cell.owner
    if (amSpymaster && myKey) return myKey[index]
    return null
  }

  return (
    <GameShell
      title="PALAVRA-CHAVE"
      tagline="Uma palavra e um número. O time tem que descobrir o resto — sem encostar no assassino."
      accent={ACCENT}
      roomCode={code}
      viewMode={viewMode}
      status={status}
      loading={loading}
      error={error}
      onBack={goBack}
      onToggleView={canToggleView ? toggleView : undefined}
      maxWidth={isTv ? 1300 : 900}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill
            label="Vez do time"
            value={TEAM_LABELS[turnTeam]}
            accent={TEAM_COLORS[turnTeam]}
            filled
            size={isTv ? 'lg' : 'md'}
          />
          <StatPill label="Azul" value={remaining.azul ?? 0} accent={TEAM_COLORS.azul} size={isTv ? 'lg' : 'md'} />
          <StatPill
            label="Vermelho"
            value={remaining.vermelho ?? 0}
            accent={TEAM_COLORS.vermelho}
            size={isTv ? 'lg' : 'md'}
          />
          {phase === 'guess' && guessesLeft < 25 && (
            <StatPill label="Palpites" value={guessesLeft} accent="var(--accent-gold)" size={isTv ? 'lg' : 'md'} />
          )}
        </Box>
      }
    >
      {/* A dica */}
      <GameCard accent={TEAM_COLORS[turnTeam]} highlight>
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Typography
            sx={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}
          >
            {phase === 'clue' ? `AGUARDANDO A DICA DO TIME ${TEAM_LABELS[turnTeam]}` : 'A DICA'}
          </Typography>
          <Typography
            key={clue?.word ?? 'none'}
            className={clue ? 'animate-pop-in' : undefined}
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: isTv ? { xs: '3rem', md: '5rem' } : { xs: '2.2rem', md: '3rem' },
              lineHeight: 1.05,
              letterSpacing: '0.06em',
              color: clue ? TEAM_COLORS[turnTeam] : 'var(--text-muted)',
              textShadow: clue ? `0 0 34px ${TEAM_COLORS[turnTeam]}66` : 'none',
            }}
          >
            {clue ? `${clue.word} · ${clue.count}` : '···'}
          </Typography>
        </Box>
      </GameCard>

      {/* A grade */}
      <GameCard
        title="A GRADE"
        hint={amSpymaster ? 'você vê o gabarito' : '25 palavras'}
        accent={ACCENT.main}
        sx={{ mt: 2 }}
        index={1}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: { xs: 0.75, md: 1.25 },
          }}
        >
          {board.map((cell, index) => {
            const owner = cellOwner(cell, index)
            const clickable = canGuess && !cell.revealed
            const isHiddenKey = !cell.revealed && amSpymaster && owner

            return (
              <Box
                key={index}
                className="stagger-in"
                style={{ '--stagger-index': index % 10 } as React.CSSProperties}
                onClick={
                  clickable
                    ? () => run(() => palavraChaveGuess(code, index), 'Não foi possível arriscar.')
                    : undefined
                }
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                sx={{
                  aspectRatio: isTv ? '1.9' : '1.5',
                  display: 'grid',
                  placeItems: 'center',
                  p: 0.5,
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  cursor: clickable ? 'pointer' : 'default',
                  border: `2px solid ${
                    cell.revealed
                      ? OWNER_COLORS[owner ?? 'neutro']
                      : isHiddenKey
                        ? `${OWNER_COLORS[owner]}aa`
                        : 'rgba(255,255,255,0.1)'
                  }`,
                  background: cell.revealed
                    ? owner === 'assassino'
                      ? 'repeating-linear-gradient(45deg, #0a0a0f 0 6px, #1a1a24 6px 12px)'
                      : `${OWNER_COLORS[owner ?? 'neutro']}`
                    : isHiddenKey
                      ? `${OWNER_COLORS[owner]}2e`
                      : 'rgba(255,255,255,0.04)',
                  opacity: cell.revealed ? 0.85 : 1,
                  transition: 'all 260ms ease',
                  ...(clickable && {
                    '&:hover': { borderColor: ACCENT.main, transform: 'translateY(-3px)' },
                  }),
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: isTv ? { xs: '1rem', md: '1.5rem' } : { xs: '0.65rem', md: '0.9rem' },
                    letterSpacing: '0.04em',
                    lineHeight: 1.1,
                    color: cell.revealed ? '#fff' : 'var(--text-primary)',
                    textDecoration: cell.revealed ? 'line-through' : 'none',
                    wordBreak: 'break-word',
                  }}
                >
                  {cell.revealed && owner === 'assassino' ? '☠' : cell.word}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </GameCard>

      <GameCard title="OS TIMES" accent={ACCENT.main} sx={{ mt: 2 }} index={2}>
        <PlayerRoster
          players={players}
          currentUserId={me?.user?.id}
          accent={ACCENT.main}
          describe={(player) => {
            const pState = (player.state ?? {}) as Record<string, unknown>
            const team = pState.team as Team | undefined
            const spymaster = Boolean(pState.is_spymaster)
            return {
              highlight: team === turnTeam,
              status: spymaster ? '🕵 Espião-mestre' : 'Agente',
              trailing: team ? (
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 'var(--radius-full)',
                    background: TEAM_COLORS[team],
                    color: '#0a0a0f',
                    fontSize: '0.58rem',
                    fontWeight: 900,
                    letterSpacing: '0.1em',
                  }}
                >
                  {TEAM_LABELS[team]}
                </Box>
              ) : undefined,
            }
          }}
        />
      </GameCard>

      {/* Controles */}
      {viewMode === 'player' && (
        <ActionPanel
          title={
            amSpymaster
              ? myTurn && phase === 'clue'
                ? 'Sua dica'
                : 'Você é o espião-mestre'
              : canGuess
                ? 'Toque nas palavras da grade'
                : 'Aguarde sua vez'
          }
          hint={
            amSpymaster && myTurn && phase === 'clue'
              ? 'Uma palavra só, e um número de quantas ela cobre. Nada que esteja na mesa.'
              : canGuess
                ? `Vocês têm ${guessesLeft} palpite(s). Parar antes de errar também é jogada.`
                : undefined
          }
          accent={TEAM_COLORS[myTeam ?? 'azul']}
          lockedReason={
            isEnded
              ? 'A partida acabou.'
              : !myTeam
                ? 'Você não está em nenhum time.'
                : !myTurn
                  ? `Vez do time ${TEAM_LABELS[turnTeam]}. Fique quieto.`
                  : amSpymaster && phase === 'guess'
                    ? 'Seu time está adivinhando. Nem uma palavra.'
                    : !amSpymaster && phase === 'clue'
                      ? 'Aguardando a dica do seu espião-mestre.'
                      : undefined
          }
        >
          {amSpymaster && myTurn && phase === 'clue' && (
            <>
              <TextField
                fullWidth
                value={clueWord}
                onChange={(event) => setClueWord(event.target.value)}
                placeholder="Sua dica"
                slotProps={{ htmlInput: { maxLength: 24 } }}
                sx={{ mb: 2 }}
              />
              <Typography
                sx={{ fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-muted)', mb: 1 }}
              >
                QUANTAS PALAVRAS
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, mb: 2 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((count) => (
                  <Button
                    key={count}
                    onClick={() => setClueCount(count)}
                    sx={{
                      minWidth: 0,
                      py: 1.2,
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.2rem',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${clueCount === count ? ACCENT.main : 'rgba(255,255,255,0.1)'}`,
                      background: clueCount === count ? `${ACCENT.main}33` : 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {count === 0 ? '∞' : count}
                  </Button>
                ))}
              </Box>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={submitting || !clueWord.trim()}
                onClick={() =>
                  run(() => palavraChaveClue(code, clueWord, clueCount), 'Não foi possível dar a dica.')
                }
                sx={{ py: 1.8 }}
              >
                Dar a dica
              </Button>
            </>
          )}

          {canGuess && (
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              disabled={submitting}
              onClick={() => run(() => palavraChavePass(code), 'Não foi possível encerrar.')}
            >
              Parar por aqui
            </Button>
          )}
        </ActionPanel>
      )}

      <ResultOverlay
        open={isEnded && Boolean(winner)}
        tone={winner === myTeam || isTv ? 'win' : 'lose'}
        sigil="▦"
        title={winner ? `TIME ${TEAM_LABELS[winner]} VENCEU` : 'FIM DE PARTIDA'}
        subtitle={
          lossReason === 'assassino'
            ? 'O outro time encostou no assassino.'
            : 'Todas as palavras do time foram encontradas.'
        }
      />
    </GameShell>
  )
}
