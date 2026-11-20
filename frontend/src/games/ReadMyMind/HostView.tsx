import { Box, Typography, Button } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import type { GameMode, GameState } from './types'
import { GameCard, GameShell, StatPill } from '../ui'
import { AdventCalendar, OrnamentLives } from './decor'
import { GAME_TITLE, NUMBER_FONT, TITLE_FONT, XMAS, XMAS_ACCENT } from './look'
import { cardsLeft, doorsOpen, mistakeIndexes, mistakeLine, mistakeOf, seatLabel } from './view'
import XmasCard, { MiniBack } from './XmasCard'

interface HostViewProps {
  roomCode: string
  gameState: GameState
  onStartGame: (mode: GameMode) => void
  onNextRound: () => void
  onEndGame: () => void
  onRestartGame: () => void
  onChangeGame?: () => void
  /** Alterna para a tela de jogo do host. */
  onPlayAsHost?: () => void
  onBack?: () => void
}

const ACCENT = XMAS_ACCENT

const MODES: { key: GameMode; label: string; icon: string; hint: string; color: string }[] = [
  {
    key: 'coop',
    label: 'CO-OP',
    icon: '🤝',
    hint: 'A família contra o baralho: 3 enfeites na árvore, 10 portinhas do Advento.',
    color: XMAS.pine,
  },
  {
    key: 'versus',
    label: 'VERSUS',
    icon: '⚔️',
    hint: 'Quem se adiantar vira boneco de neve. O último de pé vence.',
    color: XMAS.candy,
  },
]

/**
 * Painel do host da Mente Natalina: escolher o modo, acompanhar a mesa e
 * controlar o ritmo. O host também joga, então as mãos dos outros nunca
 * aparecem aqui — só quantas cartas cada um tem.
 */
export default function HostView({
  roomCode,
  gameState,
  onStartGame,
  onNextRound,
  onEndGame,
  onRestartGame,
  onChangeGame,
  onPlayAsHost,
  onBack,
}: HostViewProps) {
  const isCoop = gameState.mode === 'coop'
  const notStarted = gameState.phase === 'waiting'
  const isOver = gameState.phase === 'gameOver'
  const activePlayers = gameState.players.filter((p) => !p.isEliminated && p.connected)
  const played = gameState.playedCards
  const lastCard = played[played.length - 1]
  const mistakes = mistakeIndexes(played)
  const mistake = mistakeOf(gameState)
  const left = cardsLeft(gameState)

  return (
    <GameShell
      title={GAME_TITLE.toUpperCase()}
      tagline="Painel do host: acompanhe a mesa da ceia e controle o ritmo da partida."
      accent={ACCENT}
      roomCode={roomCode}
      viewMode="host"
      onBack={onBack}
      headerExtra={
        !notStarted ? (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <StatPill label="Modo" value={isCoop ? 'CO-OP' : 'VERSUS'} accent={isCoop ? XMAS.pine : XMAS.candy} filled />
            <StatPill label="Em jogo" value={activePlayers.length} accent={ACCENT.main} />
            <StatPill label="Escondidas" value={left} accent={ACCENT.main} />
            <AdventCalendar
              opened={doorsOpen(gameState)}
              current={gameState.phase === 'playing' ? gameState.round : null}
              max={gameState.maxRounds}
              size={24}
            />
            {isCoop && <OrnamentLives lives={gameState.lives} max={gameState.maxLives} size={24} label={false} />}
          </Box>
        ) : undefined
      }
    >
      {/* Antes de começar: escolher o modo */}
      {notStarted && (
        <GameCard title="ESCOLHA O MODO" accent={ACCENT.main} highlight>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {MODES.map((mode) => (
              <Box
                key={mode.key}
                onClick={() => onStartGame(mode.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onStartGame(mode.key)
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  p: 3,
                  textAlign: 'center',
                  borderRadius: '20px',
                  border: `2px solid ${mode.color}`,
                  background: `radial-gradient(ellipse at 50% 0%, ${mode.color}33, transparent 70%), linear-gradient(165deg, rgba(16, 34, 62, 0.9), rgba(6, 16, 31, 0.95))`,
                  transition: 'transform 220ms ease, box-shadow 220ms ease',
                  '&:hover': { transform: 'translateY(-4px) rotate(-0.5deg)', boxShadow: `0 0 30px ${mode.color}55` },
                  '&:focus-visible': { outline: `3px solid ${XMAS.ice}`, outlineOffset: 3 },
                }}
              >
                <Typography sx={{ fontSize: '2.4rem', lineHeight: 1 }}>{mode.icon}</Typography>
                <Typography sx={{ fontFamily: NUMBER_FONT, fontWeight: 700, fontSize: '2rem', letterSpacing: '0.08em', color: mode.color }}>
                  {mode.label}
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', mt: 0.5 }}>{mode.hint}</Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  sx={{
                    mt: 2,
                    bgcolor: mode.color,
                    backgroundImage: 'none',
                    color: '#0a0a0f',
                    fontWeight: 800,
                    '&:hover': { bgcolor: mode.color, backgroundImage: 'none', filter: 'brightness(1.1)' },
                  }}
                >
                  Distribuir as cartas
                </Button>
              </Box>
            ))}
          </Box>
        </GameCard>
      )}

      {/* Durante a partida */}
      {!notStarted && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <GameCard
            title="A MESA"
            hint={
              gameState.phase === 'roundBreak'
                ? `nível ${gameState.round} completo 🎉`
                : played.length
                  ? `${played.length} carta(s)`
                  : 'vazia'
            }
            accent={ACCENT.main}
            highlight
          >
            <Box
              sx={{
                p: 2,
                borderRadius: '18px',
                background: `radial-gradient(ellipse at 50% 40%, #1f9655, ${XMAS.feltDark})`,
                border: `4px solid ${XMAS.wood}`,
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
              }}
            >
              {lastCard ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, alignItems: 'center' }}>
                  {played.slice(0, -1).map((card, index) => (
                    <XmasCard key={`${gameState.round}-${index}`} value={card.value} size="7px" dim mistake={mistakes.has(index)} />
                  ))}
                  <XmasCard
                    key={`last-${gameState.round}-${played.length}`}
                    value={lastCard.value}
                    size="13px"
                    highlight={!mistakes.has(played.length - 1)}
                    mistake={mistakes.has(played.length - 1)}
                    anim="land"
                  />
                </Box>
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#fff6dc', py: 4, fontWeight: 700 }}>
                  {gameState.phase === 'roundBreak' ? '🎉 Nível vencido! Novas cartas já já.' : 'Nenhuma carta na mesa ainda.'}
                </Typography>
              )}
            </Box>
            {mistake && gameState.phase === 'playing' && (
              <Typography sx={{ mt: 1.5, textAlign: 'center', color: '#ffd0d4', fontWeight: 700 }}>🙈 {mistakeLine(mistake)}</Typography>
            )}
          </GameCard>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <GameCard title="JOGADORES" hint="cartas na mão (os números ficam secretos)" accent={ACCENT.main} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {gameState.players.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.035)',
                      opacity: player.isEliminated ? 0.5 : 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {player.isEliminated ? '☃️ ' : ''}
                        {player.name}
                        {player.isHost && (
                          <Box
                            component="span"
                            sx={{ ml: 0.75, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--text-muted)' }}
                          >
                            HOST
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {seatLabel(player)}

                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Box sx={{ display: 'flex' }}>
                        {Array.from({ length: Math.min(player.cards.length, 6) }, (_, index) => (
                          <Box key={index} sx={{ ml: index ? '-6px' : 0 }}>
                            <MiniBack size={12} />
                          </Box>
                        ))}
                      </Box>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: player.isEliminated
                            ? 'var(--accent-red)'
                            : !player.connected
                              ? 'var(--status-offline)'
                              : 'var(--status-ready)',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </GameCard>

            <GameCard title="CONTROLES" accent="var(--accent-gold)" index={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {!isOver && (
                  <Button fullWidth variant="outlined" color="secondary" startIcon={<SkipNextRoundedIcon />} onClick={onNextRound}>
                    Forçar próxima rodada
                  </Button>
                )}

                {onPlayAsHost && (
                  <Button fullWidth variant="contained" color="secondary" startIcon={<SwapHorizRoundedIcon />} onClick={onPlayAsHost}>
                    Jogar como host (ver minha mão)
                  </Button>
                )}

                <Button fullWidth variant="outlined" startIcon={<ReplayRoundedIcon />} onClick={onRestartGame}>
                  Reiniciar partida
                </Button>

                {onChangeGame && (
                  <Button fullWidth variant="outlined" color="inherit" onClick={onChangeGame}>
                    Trocar de jogo
                  </Button>
                )}

                <Button fullWidth variant="text" color="error" startIcon={<StopRoundedIcon />} onClick={onEndGame}>
                  Encerrar
                </Button>
              </Box>
            </GameCard>
          </Box>
        </Box>
      )}

      {/* Resultado, sem cobrir os controles do host */}
      {isOver && (
        <GameCard accent={gameState.winner ? 'var(--accent-gold)' : 'var(--accent-red)'} highlight sx={{ mt: 2 }} index={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '3rem', lineHeight: 1, mb: 1 }}>
              {gameState.winner ? (gameState.winner === 'team' ? '🎄' : '👑') : '🫠'}
            </Typography>
            <Typography
              sx={{
                fontFamily: TITLE_FONT,
                fontWeight: 700,
                fontSize: '2.6rem',
                color: gameState.winner ? 'var(--accent-gold)' : 'var(--accent-red)',
              }}
            >
              {gameState.winner ? 'Feliz Natal, vitória!' : 'A árvore ficou pelada'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>{gameState.gameOverReason}</Typography>
          </Box>
        </GameCard>
      )}
    </GameShell>
  )
}
