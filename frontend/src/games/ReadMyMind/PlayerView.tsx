import { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import type { GameState } from './types'
import { useNow, haptic } from '../utils'
import { getAccent } from '../theme'
import { ActionPanel, GameCard, GameShell, PlayingCard, ResultOverlay, StatPill } from '../ui'

interface PlayerViewProps {
  roomCode: string
  playerId: string
  gameState: GameState
  onPlayCard: (cardValue: number) => void
  /** `host` mostra o mesmo jogo, mas com a navegação do host. */
  viewMode?: 'player' | 'host'
  onBack?: () => void
  onToggleView?: () => void
  error?: string
}

const ACCENT = getAccent('read-my-mind')

export default function PlayerView({
  roomCode,
  playerId,
  gameState,
  onPlayCard,
  viewMode = 'player',
  onBack,
  onToggleView,
  error,
}: PlayerViewProps) {
  const now = useNow(250)
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const player = gameState.players.find((p) => p.id === playerId)
  const myCards = player?.cards ?? []
  const isEliminated = player?.isEliminated ?? false
  const isCoop = gameState.mode === 'coop'

  const played = gameState.playedCards
  const lastCard = played[played.length - 1]
  const lastPlayer = lastCard ? gameState.players.find((p) => p.id === lastCard.playerId) : null

  const wasCut = gameState.lastCutPlayer === playerId
  const didCut = gameState.lastCutterPlayer === playerId
  const iWon = gameState.winner === playerId || gameState.winner === 'team'

  const secondsToNextRound = gameState.nextRoundTs
    ? Math.max(0, Math.ceil((gameState.nextRoundTs - now) / 1000))
    : null

  // A seleção só vale enquanto a carta continuar na mão: assim ela se
  // desfaz sozinha quando a rodada vira ou quando a carta é jogada, sem
  // precisar de um efeito para limpar estado.
  const selected = selectedCard !== null && myCards.includes(selectedCard) ? selectedCard : null

  function handlePlay() {
    if (selected === null || playing) return
    setPlaying(true)
    haptic([12, 40, 18])
    onPlayCard(selected)
    setSelectedCard(null)
    // O estado real chega no próximo poll; liberar o botão logo evita travar
    // a jogada se a resposta demorar.
    window.setTimeout(() => setPlaying(false), 400)
  }

  const lockedReason = isEliminated
    ? 'Você foi eliminado. Acompanhe pela TV.'
    : gameState.phase === 'waiting'
      ? 'Aguardando o host começar.'
      : gameState.phase === 'roundBreak'
        ? `Rodada ${gameState.round + 1} chegando${secondsToNextRound !== null ? ` em ${secondsToNextRound}s` : ''}...`
        : gameState.phase === 'gameOver'
          ? 'A partida acabou.'
          : myCards.length === 0
            ? 'Você jogou todas as suas cartas. Agora é torcer.'
            : undefined

  return (
    <GameShell
      title="READ MY MIND"
      tagline={
        isCoop
          ? 'Joguem em ordem crescente. Sem falar, sem sinais.'
          : 'Quem cortar a sequência é eliminado.'
      }
      accent={ACCENT}
      roomCode={roomCode}
      viewMode={viewMode}
      onBack={onBack}
      onToggleView={onToggleView}
      error={error}
      maxWidth={720}
      headerExtra={
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill
            label="Modo"
            value={isCoop ? 'CO-OP' : 'VERSUS'}
            accent={isCoop ? 'var(--status-ready)' : 'var(--neon-purple)'}
            filled
          />
          <StatPill label="Rodada" value={`${gameState.round}/${gameState.maxRounds}`} accent={ACCENT.main} />
          <StatPill label="Na mão" value={myCards.length} accent={ACCENT.main} />

          {isCoop && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                px: 1.75,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.035)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                VIDAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                {Array.from({ length: gameState.maxLives }).map((_, index) =>
                  index < gameState.lives ? (
                    <FavoriteIcon key={index} sx={{ color: 'var(--accent-red)', fontSize: '1.2rem' }} />
                  ) : (
                    <FavoriteBorderIcon
                      key={index}
                      sx={{ color: 'var(--text-muted)', fontSize: '1.2rem', opacity: 0.4 }}
                    />
                  ),
                )}
              </Box>
            </Box>
          )}
        </Box>
      }
    >
      {/* A mesa */}
      <GameCard
        title="NA MESA"
        hint={lastPlayer ? `último: ${lastPlayer.name}` : 'nada ainda'}
        accent={ACCENT.main}
        highlight
      >
        {lastCard ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
            <PlayingCard key={`${lastCard.value}-${played.length}`} faceValue={lastCard.value} size="lg" highlight />
            {played.length > 1 && (
              <Box sx={{ maxWidth: 260 }}>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    letterSpacing: '0.2em',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    mb: 1,
                  }}
                >
                  ANTES DISSO
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {played.slice(0, -1).map((card, index) => (
                    <PlayingCard
                      key={`${card.value}-${index}`}
                      faceValue={card.value}
                      size="xs"
                      dimmed
                      dealDelay={index * 30}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', py: 3 }}>
            A mesa está vazia. Quem tem a carta mais baixa?
          </Typography>
        )}
      </GameCard>

      {/* Minha mão */}
      <ActionPanel
        title={selected !== null ? `Jogar a carta ${selected}?` : 'Sua mão'}
        hint="Jogue quando tiver certeza de que a sua é a menor carta ainda na mesa."
        accent={ACCENT.main}
        lockedReason={lockedReason}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 1.25,
            mb: 2.5,
            minHeight: 130,
            alignItems: 'center',
          }}
        >
          {myCards.map((card, index) => {
            const isSelected = selected === card
            return (
              <Box
                key={card}
                onClick={() => setSelectedCard(isSelected ? null : card)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedCard(isSelected ? null : card)
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  transform: isSelected ? 'translateY(-14px)' : 'none',
                  transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': { transform: 'translateY(-8px)' },
                }}
              >
                <PlayingCard
                  faceValue={card}
                  size="md"
                  highlight={isSelected}
                  dealDelay={index * 90}
                  tilt={(index - (myCards.length - 1) / 2) * 3}
                />
              </Box>
            )
          })}
        </Box>

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handlePlay}
          disabled={selected === null || playing}
          sx={{ py: 2, fontSize: '1.15rem' }}
        >
          {selected !== null ? `Jogar ${selected}` : 'Escolha uma carta'}
        </Button>
      </ActionPanel>

      {/* Cortinas */}
      <ResultOverlay
        open={(wasCut || didCut) && gameState.phase === 'playing'}
        tone={wasCut ? 'lose' : 'danger'}
        sigil={wasCut ? '😱' : '⚔️'}
        title={wasCut ? 'VOCÊ FOI CORTADO' : 'VOCÊ CORTOU ALGUÉM'}
        subtitle={
          isCoop
            ? 'A equipe perdeu uma vida.'
            : wasCut
              ? 'Alguém jogou depois de você com uma carta menor.'
              : 'Você jogou uma carta maior do que a de alguém.'
        }
      />

      <ResultOverlay
        open={gameState.phase === 'gameOver'}
        tone={iWon ? 'win' : 'lose'}
        title={iWon ? 'VITÓRIA' : 'GAME OVER'}
        subtitle={gameState.gameOverReason ?? undefined}
      />

      <ResultOverlay
        open={isEliminated && gameState.phase !== 'gameOver'}
        tone="lose"
        title="VOCÊ FOI ELIMINADO"
        subtitle="Acompanhe o resto da partida pela TV."
      />
    </GameShell>
  )
}
