import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, IconButton, Tooltip } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { useAuth } from '../context/useAuth'
import { createRoom, getRoom, listGames } from '../lib/api'
import { clearLastRoom, loadLastRoom } from '../lib/roomHistory'
import { gameRoute } from '../lib/gameCatalog'
import type { Game } from '../lib/types'
import { AppShell, Brand, GameTile, LoadingScreen, Panel } from '../components/ui'

type ResumeInfo = {
  code: string
  view: 'host' | 'player'
  status: 'lobby' | 'live' | 'ended'
  gameName?: string
}

export default function Lobby() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user, logout } = useAuth()

  const [joinCode, setJoinCode] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    let active = true
    async function fetchGames() {
      try {
        const data = await listGames()
        if (!active) return
        setGames(data)
        setSelectedGameId((current) => current ?? data[0]?.id ?? null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os jogos.')
      } finally {
        if (active) setGamesLoading(false)
      }
    }
    fetchGames()
    return () => {
      active = false
    }
  }, [])

  // Sala anterior ainda viva? Oferece voltar em vez de obrigar a redigitar o código.
  useEffect(() => {
    if (!isAuthenticated) return
    const saved = loadLastRoom()
    if (!saved) {
      setResumeInfo(null)
      return
    }
    let active = true
    async function fetchResume() {
      setResumeLoading(true)
      try {
        const room = await getRoom(saved!.code)
        if (!active) return
        if (room.status === 'ended') {
          clearLastRoom()
          setResumeInfo(null)
          return
        }
        setResumeInfo({
          code: saved!.code,
          view: saved!.view,
          status: room.status,
          gameName: room.game?.name,
        })
      } catch {
        if (!active) return
        clearLastRoom()
        setResumeInfo(null)
      } finally {
        if (active) setResumeLoading(false)
      }
    }
    fetchResume()
    return () => {
      active = false
    }
  }, [isAuthenticated])

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  )

  async function handleCreateRoom() {
    if (!selectedGame) {
      setError('Escolha um jogo para abrir a sala.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const room = await createRoom({ game_id: selectedGame.id, host_name: user?.nickname })
      navigate(`/host/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a sala.')
      setCreating(false)
    }
  }

  function handleJoinRoom() {
    const code = joinCode.trim().toUpperCase()
    if (code) navigate(`/play/${code}`)
  }

  function handleResumeRoom() {
    if (!resumeInfo) return
    const code = resumeInfo.code.toUpperCase()
    if (resumeInfo.status === 'live') {
      navigate(gameRoute(code, resumeInfo.view))
      return
    }
    navigate(resumeInfo.view === 'host' ? `/host/${code}` : `/play/${code}`)
  }

  if (isLoading) return <LoadingScreen label="ABRINDO O LOBBY" />

  return (
    <AppShell
      headerLeft={<Brand size="md" />}
      error={error}
      headerRight={
        <>
          <Button
            onClick={() => navigate('/profile')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.75,
              py: 0.9,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              textTransform: 'none',
              '&:hover': { borderColor: 'var(--accent-gold)', background: 'rgba(255,255,255,0.06)' },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                color: '#0a0a0f',
                background: 'linear-gradient(140deg, var(--accent-gold), var(--accent-gold-light))',
              }}
            >
              {(user?.nickname ?? 'J').charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ textAlign: 'left' }}>
              <Typography
                sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2, color: 'var(--text-primary)' }}
              >
                {user?.nickname || 'Jogador'}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', lineHeight: 1, color: 'var(--text-muted)' }}>
                Ver perfil
              </Typography>
            </Box>
          </Button>
          <Tooltip title="Sair da conta">
            <IconButton
              onClick={() => {
                logout()
                navigate('/')
              }}
              aria-label="Sair da conta"
              sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--accent-red)' } }}
            >
              <LogoutRoundedIcon />
            </IconButton>
          </Tooltip>
        </>
      }
    >
      {/* Retomar sala anterior */}
      {resumeInfo && (
        <Panel accent="var(--accent-gold)" highlight sx={{ mb: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.35rem',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-gold)',
                }}
              >
                VOCÊ TEM UMA MESA ABERTA
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Sala {resumeInfo.code.toUpperCase()}
                {resumeInfo.gameName ? ` · ${resumeInfo.gameName}` : ''} ·{' '}
                {resumeInfo.status === 'live' ? 'partida em andamento' : 'aguardando no lobby'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={handleResumeRoom}
              disabled={resumeLoading}
              sx={{ flexShrink: 0 }}
            >
              {resumeLoading ? 'Carregando...' : 'Voltar ao jogo'}
            </Button>
          </Box>
        </Panel>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Catálogo */}
        <Panel
          title="ESCOLHA O JOGO"
          hint={gamesLoading ? 'carregando...' : `${games.length} disponíveis`}
          accent="var(--accent-red)"
        >
          {gamesLoading ? (
            <Typography sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}>
              Buscando os jogos da mesa...
            </Typography>
          ) : games.length === 0 ? (
            <Typography sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}>
              Nenhum jogo cadastrado no servidor.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              {games.map((game, index) => (
                <GameTile
                  key={game.id}
                  game={game}
                  index={index}
                  selected={game.id === selectedGameId}
                  onSelect={() => setSelectedGameId(game.id)}
                />
              ))}
            </Box>
          )}
        </Panel>

        {/* Ações */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Panel accent="var(--accent-red)" highlight index={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <AddRoundedIcon sx={{ fontSize: 26, color: 'var(--accent-red)' }} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.4rem',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-red)',
                }}
              >
                ABRIR SALA
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mb: 2.5 }}>
              {selectedGame
                ? `Você vai abrir uma mesa de ${selectedGame.name}. Dá pra trocar o jogo depois.`
                : 'Escolha um jogo ao lado para abrir a mesa.'}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              onClick={handleCreateRoom}
              disabled={gamesLoading || creating || !selectedGame}
              sx={{ py: 1.8 }}
            >
              {creating ? 'Criando...' : 'Criar nova sala'}
            </Button>
          </Panel>

          <Panel accent="var(--accent-gold)" index={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <LoginRoundedIcon sx={{ fontSize: 26, color: 'var(--accent-gold)' }} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.4rem',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-gold)',
                }}
              >
                ENTRAR
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mb: 2 }}>
              Recebeu um código? Sente na mesa de alguém.
            </Typography>
            <TextField
              fullWidth
              placeholder="CÓDIGO"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === 'Enter' && handleJoinRoom()}
              sx={{ mb: 1.5 }}
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  inputMode: 'numeric',
                  style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.24em' },
                  'aria-label': 'Código da sala',
                },
              }}
            />
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              size="large"
              onClick={handleJoinRoom}
              disabled={!joinCode.trim()}
              sx={{ py: 1.6 }}
            >
              Entrar na sala
            </Button>
          </Panel>
        </Box>
      </Box>
    </AppShell>
  )
}
