import { useState, useEffect } from 'react'
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
import { useAuth } from '../context/AuthContext'

// Mock de jogos disponíveis
const AVAILABLE_GAMES = [
  {
    id: 1,
    slug: 'read-my-mind',
    name: 'Read My Mind',
    description: 'Ordene cartas em silêncio. Co-op ou Versus.',
    minPlayers: 2,
    maxPlayers: 10,
    icon: '🧠',
    color: '#22d3ee',
  },
  {
    id: 2,
    slug: 'confinamento-solitario',
    name: 'Confinamento Solitário',
    description: 'Descubra seu próprio naipe olhando o dos outros.',
    minPlayers: 3,
    maxPlayers: 12,
    icon: '♠️',
    color: '#a855f7',
  },
  {
    id: 3,
    slug: 'concurso-de-beleza',
    name: 'Concurso de Beleza',
    description: 'Escolha um número. O alvo é a média × 0.8.',
    minPlayers: 3,
    maxPlayers: 12,
    icon: '👑',
    color: '#d4a520',
  },
  {
    id: 4,
    slug: 'future-sugoroku',
    name: 'Future Sugoroku',
    description: 'Role dados, escolha portas, encontre a saída.',
    minPlayers: 2,
    maxPlayers: 16,
    icon: '🎲',
    color: '#22c55e',
  },
  {
    id: 5,
    slug: 'leilao-de-cem-votos',
    name: 'Leilão de Cem Votos',
    description: 'Aposte pontos para ganhar o pote da rodada.',
    minPlayers: 2,
    maxPlayers: 12,
    icon: '💰',
    color: '#ef4444',
  },
  {
    id: 6,
    slug: 'sabado-quiz',
    name: 'Sábado Quiz',
    description: 'Perguntas rápidas para aquecer a galera.',
    minPlayers: 2,
    maxPlayers: 20,
    icon: '❓',
    color: '#f97316',
  },
]

// Mock de jogadores
const MOCK_PLAYERS = [
  { id: 1, name: 'Host', isHost: true, ready: true, online: true },
  { id: 2, name: 'Player2', isHost: false, ready: true, online: true },
  { id: 3, name: 'Player3', isHost: false, ready: false, online: true },
  { id: 4, name: 'Player4', isHost: false, ready: true, online: false },
]

export default function HostRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()

  const [selectedGame, setSelectedGame] = useState<typeof AVAILABLE_GAMES[0] | null>(null)
  const [players, setPlayers] = useState(MOCK_PLAYERS)
  const [copied, setCopied] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [tvConnected, setTvConnected] = useState(false)

  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  // Animação de entrada dos cards
  useEffect(() => {
    anime({
      targets: '.game-card',
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(80),
      easing: 'easeOutExpo',
      duration: 600,
    })
  }, [])

  // Simular TV conectando
  useEffect(() => {
    const timer = setTimeout(() => setTvConnected(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  function handleCopyCode() {
    navigator.clipboard.writeText(code?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSelectGame(game: typeof AVAILABLE_GAMES[0]) {
    setSelectedGame(game)
    
    // Animação de seleção
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

  function handleForceStart() {
    // Marca todos como ready e inicia
    setPlayers(players.map(p => ({ ...p, ready: true })))
    handleStartGame()
  }

  function handleLeaveRoom() {
    navigate('/lobby')
  }

  const readyCount = players.filter(p => p.ready && p.online).length
  const onlineCount = players.filter(p => p.online).length
  const allReady = players.filter(p => p.online).every(p => p.ready)
  const canStart = selectedGame && allReady && onlineCount >= (selectedGame.minPlayers || 2)

  if (isLoading) {
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
              {AVAILABLE_GAMES.map((game) => (
                <Box
                  key={game.id}
                  className="game-card"
                  data-id={game.id}
                  onClick={() => handleSelectGame(game)}
                  sx={{
                    background: selectedGame?.id === game.id
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
                        {game.minPlayers}-{game.maxPlayers} jogadores
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {game.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Coluna da Direita - Jogadores e Ações */}
          <Box sx={{ flex: 1, minWidth: { lg: 320 } }}>
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
                <Typography sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Jogadores
                </Typography>
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
                      opacity: player.online ? 1 : 0.5,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        fontSize: '0.9rem',
                        bgcolor: player.isHost ? 'var(--accent-red)' : 'var(--accent-gold)',
                      }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {player.name}
                        {player.isHost && (
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
                        {!player.online ? 'Offline' : player.ready ? 'Pronto' : 'Aguardando...'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: !player.online
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
                  background: canStart
                    ? 'linear-gradient(135deg, var(--accent-red) 0%, #b91c1c 100%)'
                    : undefined,
                }}
              >
                {!selectedGame
                  ? 'Selecione um Jogo'
                  : !allReady
                    ? `Aguardando ${onlineCount - readyCount} jogador(es)`
                    : 'INICIAR JOGO'}
              </Button>

              {selectedGame && !allReady && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  onClick={handleForceStart}
                  sx={{ borderWidth: 2 }}
                >
                  Forçar Início
                </Button>
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
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Regras do Jogo
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: 'var(--text-secondary)', mb: 2 }}>
            {selectedGame?.description}
          </Typography>
          <Box
            sx={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              p: 2,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1, color: 'var(--text-primary)' }}>
              Como Jogar:
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              As regras detalhadas aparecerão aqui quando o jogo for implementado.
              Por enquanto, este é um placeholder.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRulesOpen(false)} color="inherit">
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setRulesOpen(false)
              // TODO: Navegar para o jogo
              navigate(`/game/${code}`)
            }}
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
