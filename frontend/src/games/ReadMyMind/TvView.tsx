import { Box, Typography } from '@mui/material'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import type { GameState } from './types'
import { useNow } from '../utils'
import { getAccent } from '../theme'
import { GameCard, GameShell, PlayingCard, ResultOverlay, StatPill } from '../ui'

interface TvViewProps {
  roomCode: string
  gameState: GameState
}

const ACCENT = getAccent('read-my-mind')

export default function TvView({ roomCode, gameState }: TvViewProps) {
  const now = useNow(250)
  const isCoop = gameState.mode === 'coop'
  const activePlayers = gameState.players.filter((p) => !p.isEliminated && p.connected)

  const played = gameState.playedCards
  const lastCard = played[played.length - 1]
  const lastPlayer = lastCard ? gameState.players.find((p) => p.id === lastCard.playerId) : null
  const cutPlayer = gameState.players.find((p) => p.id === gameState.lastCutPlayer)

  const secondsToNextRound = gameState.nextRoundTs
    ? Math.max(0, Math.ceil((gameState.nextRoundTs - now) / 1000))
    : null

  return (
    <GameShell
      title="READ MY MIND"
      tagline={
        isCoop
          ? 'Joguem as cartas em ordem crescente. Sem falar, sem sinais.'
          : 'Quem cortar a sequência está fora. Último de pé vence.'
      }
      accent={ACCENT}
      roomCode={roomCode}
      viewMode="tv"
      headerExtra={
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StatPill
            label="Modo"
            value={isCoop ? 'CO-OP' : 'VERSUS'}
            accent={isCoop ? 'var(--status-ready)' : 'var(--neon-purple)'}
            filled
            size="lg"
          />
          <StatPill label="Rodada" value={`${gameState.round}/${gameState.maxRounds}`} accent={ACCENT.main} size="lg" />

          {isCoop ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                px: 3,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.035)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                VIDAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {Array.from({ length: gameState.maxLives }).map((_, index) =>
                  index < gameState.lives ? (
                    <FavoriteIcon
                      key={index}
                      sx={{
                        color: 'var(--accent-red)',
                        fontSize: '2rem',
                        filter: 'drop-shadow(0 0 10px var(--accent-red-glow))',
                      }}
                    />
                  ) : (
                    <FavoriteBorderIcon
                      key={index}
                      sx={{ color: 'var(--text-muted)', fontSize: '2rem', opacity: 0.4 }}
                    />
                  ),
                )}
              </Box>
            </Box>
          ) : (
            <StatPill label="De pé" value={activePlayers.length} accent="var(--neon-purple)" size="lg" />
          )}
        </Box>
      }
    >
      {/* A mesa */}
      <GameCard
        title="A MESA"
        hint={played.length ? `${played.length} carta(s) jogada(s)` : 'nenhuma carta ainda'}
        accent={ACCENT.main}
        highlight
      >
        {gameState.phase === 'waiting' ? (
          <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', py: 6, fontSize: '1.4rem' }}>
            Aguardando o host começar...
          </Typography>
        ) : played.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '2rem', md: '3rem' },
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
              }}
            >
              QUEM TEM A CARTA MAIS BAIXA?
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', mt: 1, fontSize: '1.1rem' }}>
              A primeira carta ainda não caiu.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Última carta em destaque */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.24em',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  mb: 1.5,
                }}
              >
                {lastPlayer?.name?.toUpperCase() ?? 'ALGUÉM'} JOGOU
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <PlayingCard
                  key={`${lastCard.value}-${played.length}`}
                  faceValue={lastCard.value}
                  size="xl"
                  highlight
                />
              </Box>
            </Box>

            {/* Sequência anterior */}
            {played.length > 1 && (
              <Box>
                <Typography
                  sx={{
                    textAlign: 'center',
                    fontSize: '0.65rem',
                    letterSpacing: '0.24em',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    mb: 1.5,
                  }}
                >
                  A SEQUÊNCIA ATÉ AQUI
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  {played.slice(0, -1).map((card, index) => (
                    <PlayingCard
                      key={`${card.value}-${index}`}
                      faceValue={card.value}
                      size="sm"
                      dimmed
                      dealDelay={index * 40}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
      </GameCard>

      {/* Jogadores e cartas restantes */}
      <GameCard title="JOGADORES" hint="cartas restantes na mão" accent={ACCENT.main} sx={{ mt: 2 }} index={1}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: { xs: 2, md: 4 } }}>
          {gameState.players.map((player, index) => {
            const wasCut = gameState.lastCutPlayer === player.id
            const didCut = gameState.lastCutterPlayer === player.id
            const justPlayed = lastCard?.playerId === player.id

            return (
              <Box
                key={player.id}
                className="stagger-in"
                style={{ '--stagger-index': index } as React.CSSProperties}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  opacity: player.isEliminated ? 0.3 : 1,
                  filter: player.isEliminated ? 'grayscale(1)' : 'none',
                  transition: 'all 320ms ease',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: { xs: 56, md: 68 },
                    height: { xs: 56, md: 68 },
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: { xs: '1.3rem', md: '1.6rem' },
                    color: '#0a0a0f',
                    background: player.isHost
                      ? 'linear-gradient(140deg, var(--accent-red), var(--accent-red-dark))'
                      : `linear-gradient(140deg, ${ACCENT.main}, ${ACCENT.light})`,
                    border: justPlayed ? `3px solid ${ACCENT.main}` : '3px solid transparent',
                    boxShadow: justPlayed ? `0 0 26px ${ACCENT.main}` : '0 8px 20px rgba(0,0,0,0.45)',
                    transition: 'all 320ms ease',
                  }}
                >
                  {player.name.charAt(0).toUpperCase()}
                  {(wasCut || didCut) && (
                    <Box
                      className="animate-pop-in"
                      sx={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '0.85rem',
                        background: 'var(--bg-void)',
                        border: '1px solid rgba(255,255,255,0.18)',
                      }}
                    >
                      {wasCut ? '💀' : '⚔️'}
                    </Box>
                  )}
                </Box>

                <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' } }}>
                  {player.name}
                </Typography>

                {player.isEliminated ? (
                  <Typography
                    sx={{ fontSize: '0.6rem', letterSpacing: '0.16em', fontWeight: 800, color: 'var(--accent-red)' }}
                  >
                    ELIMINADO
                  </Typography>
                ) : player.cards.length === 0 ? (
                  <Typography
                    sx={{ fontSize: '0.6rem', letterSpacing: '0.16em', fontWeight: 800, color: 'var(--status-ready)' }}
                  >
                    ✓ MÃO VAZIA
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 0.35 }} aria-label={`${player.cards.length} cartas`}>
                    {player.cards.map((_, cardIndex) => (
                      <Box
                        key={cardIndex}
                        sx={{
                          width: 13,
                          height: 18,
                          borderRadius: '3px',
                          background: 'repeating-linear-gradient(45deg, #7f1d1d 0 3px, #991b1b 3px 6px)',
                          border: '1px solid rgba(255,255,255,0.5)',
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      </GameCard>

      {/* Cortinas */}
      <ResultOverlay
        open={Boolean(gameState.lastCutPlayer) && gameState.phase !== 'gameOver'}
        tone="danger"
        sigil="⚠️"
        title="CORTE!"
        subtitle={
          cutPlayer
            ? `${cutPlayer.name} tinha uma carta menor.`
            : 'Alguém tinha uma carta menor.'
        }
      />

      <ResultOverlay
        open={gameState.phase === 'roundBreak'}
        tone="neutral"
        sigil="🃏"
        title={`RODADA ${gameState.round + 1}`}
        subtitle={
          secondsToNextRound !== null
            ? `Novas cartas em ${secondsToNextRound}s...`
            : 'Distribuindo novas cartas...'
        }
      />

      <ResultOverlay
        open={gameState.phase === 'gameOver'}
        tone={gameState.winner ? 'win' : 'lose'}
        title={gameState.winner ? 'VITÓRIA' : 'GAME OVER'}
        subtitle={gameState.gameOverReason ?? undefined}
      />
    </GameShell>
  )
}
