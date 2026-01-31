import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Tv as TvIcon,
} from '@mui/icons-material'
import anime from 'animejs'
import { useAuth } from '../context/useAuth'
import { changeRoomGame, endRoom, getRoom, listGames, setReady, startRoom } from '../lib/api'
import { saveLastRoom } from '../lib/roomHistory'
import type { Game, Player, Room } from '../lib/types'

type GameCard = Game & { icon: string; color: string }

const GAME_STYLES: Record<string, { icon: string; color: string }> = {
  'read-my-mind': { icon: '🧠', color: '#22d3ee' },
  'confinamento-solitario': { icon: '♠️', color: '#a855f7' },
  'concurso-de-beleza': { icon: '👑', color: '#d4a520' },
  'future-sugoroku': { icon: '🎲', color: '#22c55e' },
  'leilao-de-cem-votos': { icon: '💰', color: '#ef4444' },
  'sabado-quiz': { icon: '❓', color: '#f97316' },
}

function decorateGame(game: Game): GameCard {
  const style = GAME_STYLES[game.slug] ?? { icon: '🎮', color: '#64748b' }
  return { ...game, ...style }
}

export default function HostRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [games, setGames] = useState<GameCard[]>([])
  const [selectedGame, setSelectedGame] = useState<GameCard | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [copied, setCopied] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [tvConnected, setTvConnected] = useState(false)
  const [error, setError] = useState('')
  const [startError, setStartError] = useState('')
  const [readMyMindMode, setReadMyMindMode] = useState<'coop' | 'versus'>('coop')
  const [readyLoading, setReadyLoading] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(true)

  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (code) {
      saveLastRoom(code, 'host')
    }
  }, [code])

  useEffect(() => {
    let active = true
    if (!code) return

    async function loadInitial() {
      setLoadingRoom(true)
      setError('')
      try {
        const [gamesResponse, roomResponse] = await Promise.all([listGames(), getRoom(code)])
        if (!active) return
        const decorated = gamesResponse.map(decorateGame)
        setGames(decorated)
        setRoom(roomResponse)
        setPlayers(roomResponse.players ?? [])
        setTvConnected(Boolean(roomResponse.tv_connected))
        const current = decorated.find((game) => game.id === roomResponse.game.id || game.slug === roomResponse.game.slug)
        setSelectedGame(current ?? decorated[0] ?? null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      } finally {
        if (active) {
          setLoadingRoom(false)
        }
      }
    }

    loadInitial()
    return () => {
      active = false
    }
  }, [code])

  useEffect(() => {
    if (!code) return
    let active = true
    const interval = window.setInterval(async () => {
      try {
        const data = await getRoom(code)
        if (!active) return
        setRoom(data)
        setPlayers(data.players ?? [])
        setTvConnected(Boolean(data.tv_connected))
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao atualizar sala.')
      }
    }, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code])

  useEffect(() => {
    if (!room || !games.length) return
    const match = games.find((game) => game.id === room.game.id || game.slug === room.game.slug)
    if (match) setSelectedGame(match)
  }, [room, games])

  // Animação de entrada dos cards
  useEffect(() => {
    if (!games.length) return
    anime({
      targets: '.game-card',
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(80),
      easing: 'easeOutExpo',
      duration: 600,
    })
  }, [games])

  function handleCopyCode() {
    navigator.clipboard.writeText(code?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSelectGame(game: GameCard) {
    if (!code) return
    setSelectedGame(game)
    setStartError('')
    if (room?.status === 'live') {
      setStartError('Partida em andamento. Encerre a sala para trocar o jogo.')
      return
    }
    try {
      const updated = await changeRoomGame(code, { game_id: game.id })
      setRoom(updated)
      setPlayers(updated.players ?? [])
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Erro ao trocar o jogo.')
    }

    anime({
      targets: `.game-card[data-id="${game.id}"]`,
      scale: [1, 1.02, 1],
      duration: 300,
      easing: 'easeOutElastic(1, .5)',
    })
  }

  function handleStartGame() {
    if (selectedGame) {
      setRulesOpen(true)
    }
  }

  async function handleConfirmStart() {
    if (!code || !selectedGame) return
    setStartError('')
    try {
      setRulesOpen(false)
      if (selectedGame.slug === 'read-my-mind') {
        await startRoom(code, { mode: readMyMindMode })
        navigate(`/game/${code}/read-my-mind?view=host`)
      } else {
        await startRoom(code)
        navigate(`/game/${code}?view=host`)
      }
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Erro ao iniciar a partida.')
    }
  }

  async function handleLeaveRoom() {
    if (!code) return
    try {
      await endRoom(code)
    } catch {
      // Ignora erro de encerramento
    }
    navigate('/lobby')
  }

  const readyCount = useMemo(
    () => players.filter((p) => (p.online ?? true) && p.ready).length,
    [players],
  )
  const onlineCount = useMemo(
    () => players.filter((p) => p.online ?? true).length,
    [players],
  )
  const allReady = useMemo(
    () => players.filter((p) => p.online ?? true).every((p) => p.ready),
    [players],
  )
  const canStart = Boolean(selectedGame && allReady && onlineCount >= (selectedGame.min_players || 2))

  const hostPlayer = useMemo(() => {
    if (!user?.id) return null
    return players.find((player) => player.user?.id === user.id) ?? null
  }, [players, user?.id])

  async function handleHostReadyToggle() {
    if (!code || !hostPlayer) return
    setReadyLoading(true)
    setError('')
    try {
      const result = await setReady(code, !hostPlayer.ready)
      setPlayers((current) =>
        current.map((player) =>
          player.id === result.player_id ? { ...player, ready: result.ready } : player,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar ready do host.')
    } finally {
      setReadyLoading(false)
    }
  }

  if (isLoading || loadingRoom) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-void)',
        }}
      >
        <Typography>Carregando...</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top, rgba(220, 38, 38, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleLeaveRoom} sx={{ color: 'var(--text-muted)' }}>
              <BackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ color: 'var(--accent-red)' }}>
                SALA DO HOST
              </Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Olá, {user?.nickname}! Selecione um jogo e inicie quando todos estiverem prontos.
              </Typography>
            </Box>
          </Box>

          {/* Código da Sala */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-gold)',
              px: 3,
              py: 2,
            }}
          >
            <Box>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                CÓDIGO DA SALA
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  letterSpacing: '0.15em',
                }}
              >
                {code?.toUpperCase()}
              </Typography>
            </Box>
            <IconButton
              onClick={handleCopyCode}
              sx={{
                color: copied ? 'var(--status-ready)' : 'var(--accent-gold)',
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Box
            sx={{
              width: '100%',
              mb: 2,
              p: 2,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
            }}
          >
            <Typography sx={{ color: 'var(--accent-red)', fontSize: '0.9rem' }}>{error}</Typography>
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 3,
          }}
        >
          {/* Coluna da Esquerda - Jogos */}
          <Box sx={{ flex: 2 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              🎮 Selecionar Jogo
              {selectedGame && (
                <Chip
                  label={selectedGame.name}
                  size="small"
                  sx={{
                    bgcolor: selectedGame.color,
                    color: '#fff',
                    fontWeight: 600,
                  }}
                />
              )}
            </Typography>

            {/* Grid de Jogos */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
                gap: 2,
              }}
            >
              {games.map((game) => (
                <Box
                  key={game.id}
                  className="game-card"
                  data-id={game.id}
                  onClick={() => handleSelectGame(game)}
                  sx={{
                    background:
                      selectedGame?.id === game.id
                        ? `linear-gradient(135deg, var(--bg-card) 0%, ${game.color}22 100%)`
                        : 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${selectedGame?.id === game.id ? game.color : 'var(--border-subtle)'}`,
                    p: 2.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: 0,
                    '&:hover': {
                      borderColor: game.color,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 24px ${game.color}33`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: `${game.color}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}
                    >
                      {game.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          color: selectedGame?.id === game.id ? game.color : 'var(--text-primary)',
                          fontSize: '0.95rem',
                        }}
                      >
                        {game.name}
                      </Typography>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {game.min_players}-{game.max_players} jogadores
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{game.description}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Coluna da Direita - Jogadores e Ações */}
          <Box sx={{ flex: 1, minWidth: { lg: 320 } }}>
            {/* Ready do Host */}
            <Box
              sx={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-subtle)',
                p: 2,
                mb: 2,
              }}
            >
              <Typography sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>Seu status</Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 2 }}>
                {hostPlayer?.ready ? 'Você está pronto para iniciar.' : 'Marque ready para a partida.'}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color={hostPlayer?.ready ? 'success' : 'warning'}
                disabled={!hostPlayer || readyLoading}
                onClick={handleHostReadyToggle}
                sx={{ py: 1.2 }}
              >
                {hostPlayer?.ready ? 'PRONTO ✓' : 'MARCAR READY'}
              </Button>
            </Box>

            {/* Status da TV */}
            <Box
              sx={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${tvConnected ? 'var(--neon-cyan)' : 'var(--border-subtle)'}`,
                p: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <TvIcon sx={{ color: tvConnected ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {tvConnected ? 'TV Conectada' : 'Aguardando TV...'}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {tvConnected ? 'Pronta para exibir' : 'Conecte em /tv/' + code?.toUpperCase()}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: tvConnected ? 'var(--status-ready)' : 'var(--status-waiting)',
                  animation: tvConnected ? 'none' : 'pulse 2s infinite',
                }}
              />
            </Box>

            {/* Lista de Jogadores */}
            <Box
              sx={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-subtle)',
                p: 2,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>Jogadores</Typography>
                <Chip
                  label={`${readyCount}/${onlineCount} prontos`}
                  size="small"
                  sx={{
                    bgcolor: allReady ? 'var(--status-ready)' : 'var(--status-waiting)',
                    color: '#000',
                    fontWeight: 600,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {players.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      opacity: player.online ?? true ? 1 : 0.5,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        fontSize: '0.9rem',
                        bgcolor: player.is_host ? 'var(--accent-red)' : 'var(--accent-gold)',
                      }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {player.name}
                        {player.is_host && (
                          <Chip
                            label="HOST"
                            size="small"
                            sx={{
                              ml: 1,
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'var(--accent-red)',
                              color: '#fff',
                            }}
                          />
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {player.online === false ? 'Offline' : player.ready ? 'Pronto' : 'Aguardando...'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor:
                          player.online === false
                            ? 'var(--status-offline)'
                            : player.ready
                              ? 'var(--status-ready)'
                              : 'var(--status-waiting)',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Botões de Ação */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayIcon />}
                onClick={handleStartGame}
                disabled={!canStart}
                sx={{
                  py: 2,
                  fontSize: '1.1rem',
                  background: canStart ? 'linear-gradient(135deg, var(--accent-red) 0%, #b91c1c 100%)' : undefined,
                }}
              >
                {!selectedGame
                  ? 'Selecione um Jogo'
                  : !allReady
                    ? `Aguardando ${onlineCount - readyCount} jogador(es)`
                    : 'INICIAR JOGO'}
              </Button>

              {startError && (
                <Typography sx={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>{startError}</Typography>
              )}

              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleLeaveRoom}
                sx={{ borderWidth: 2 }}
              >
                Encerrar Sala
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Dialog de Regras */}
      <Dialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-xl)',
            border: `2px solid ${selectedGame?.color || 'var(--accent-gold)'}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Box sx={{ fontSize: '2rem' }}>{selectedGame?.icon}</Box>
          <Box>
            <Typography variant="h5" sx={{ color: selectedGame?.color }}>
              {selectedGame?.name}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Regras do Jogo</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: 'var(--text-secondary)', mb: 2 }}>{selectedGame?.description}</Typography>
          {selectedGame?.slug === 'read-my-mind' && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                mb: 2,
              }}
            >
              <Button
                variant={readMyMindMode === 'coop' ? 'contained' : 'outlined'}
                onClick={() => setReadMyMindMode('coop')}
                sx={{
                  borderWidth: 2,
                  borderColor: 'var(--status-ready)',
                  color: readMyMindMode === 'coop' ? '#000' : 'var(--status-ready)',
                  bgcolor: readMyMindMode === 'coop' ? 'var(--status-ready)' : 'transparent',
                }}
              >
                CO-OP
              </Button>
              <Button
                variant={readMyMindMode === 'versus' ? 'contained' : 'outlined'}
                onClick={() => setReadMyMindMode('versus')}
                sx={{
                  borderWidth: 2,
                  borderColor: 'var(--neon-purple)',
                  color: readMyMindMode === 'versus' ? '#000' : 'var(--neon-purple)',
                  bgcolor: readMyMindMode === 'versus' ? 'var(--neon-purple)' : 'transparent',
                }}
              >
                VERSUS
              </Button>
            </Box>
          )}
          <Box
            sx={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              p: 2,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1, color: 'var(--text-primary)' }}>Como Jogar:</Typography>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              As regras detalhadas aparecerão aqui quando o jogo for implementado.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRulesOpen(false)} color="inherit">
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmStart}
            sx={{
              bgcolor: selectedGame?.color,
              '&:hover': { bgcolor: selectedGame?.color, filter: 'brightness(1.1)' },
            }}
          >
            Começar! 🎮
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
