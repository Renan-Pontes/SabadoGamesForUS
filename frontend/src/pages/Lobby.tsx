import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, IconButton, Tooltip } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { useAuth } from '../context/useAuth'
import { useRequireAuth } from '../context/useRequireAuth'
import { createRoom, friendlyError, getRoom, listGames } from '../lib/api'
import { clearLastRoom, loadLastRoom } from '../lib/roomHistory'
import { gameRoute, getGameMeta } from '../lib/gameCatalog'
import type { Game } from '../lib/types'
import { HALLOWEEN_SLUGS } from '../halloween/slugs'
import { AppShell, Brand, GameShelves, LoadingScreen, MIST, Panel } from '../components/ui'
import { avatarColor } from '../games/utils'

type ResumeInfo = {
  code: string
  view: 'host' | 'player'
  status: 'lobby' | 'live' | 'ended'
  gameName?: string
}

/** Jogo que já vem escolhido: o primeiro da Noite do Terror que o servidor tiver. */
function defaultGame(games: Game[]) {
  for (const slug of HALLOWEEN_SLUGS) {
    const found = games.find((game) => game.slug === slug)
    if (found) return found
  }
  return games[0] ?? null
}

export default function Lobby() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated, user, logout } = useAuth()
  useRequireAuth()

  const [joinCode, setJoinCode] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [gamesLoading, setGamesLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function fetchGames() {
      try {
        const data = await listGames()
        if (!active) return
        setGames(data)
        setSelectedGameId((current) => current ?? defaultGame(data)?.id ?? null)
      } catch (err) {
        if (!active) return
        setError(friendlyError(err, 'Não foi possível carregar os jogos.'))
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
      setError(friendlyError(err, 'Não foi possível criar a sala.'))
      setCreating(false)
    }
  }

  function handleJoinRoom() {
    const code = joinCode.replace(/[^0-9a-z]/gi, '').toUpperCase()
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

  function handleLogout() {
    // Convidado não tem senha: sair é perder a conta (e o lugar na mesa).
    if (
      user?.isGuest &&
      !window.confirm('Sair mesmo? Você entrou só com apelido — essa conta não tem como voltar.')
    ) {
      return
    }
    logout()
    navigate('/', { replace: true })
  }

  if (isLoading || !isAuthenticated) return <LoadingScreen label="ABRINDO O LOBBY" />

  const nickname = user?.nickname || 'Jogador'
  const color = avatarColor(nickname)
  const selectedMeta = selectedGame ? getGameMeta(selectedGame.slug) : null

  return (
    <AppShell
      headerLeft={<Brand size="md" />}
      backdropTint={MIST.witch}
      error={error}
      headerRight={
        <>
          <Button
            onClick={() => navigate('/profile')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 0.8,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(16, 9, 28, 0.6)',
              textTransform: 'none',
              maxWidth: 220,
              '&:hover': { borderColor: 'var(--pumpkin)', background: 'rgba(255,255,255,0.06)' },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-numeric)',
                fontSize: '1.05rem',
                color: '#0a0612',
                background: `radial-gradient(circle at 32% 28%, ${color}, ${color}b3 70%)`,
              }}
            >
              {nickname.charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ textAlign: 'left', minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  lineHeight: 1.2,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nickname}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', lineHeight: 1, color: 'var(--text-muted)' }}>
                {user?.isGuest ? 'Convidado · ver perfil' : 'Ver perfil'}
              </Typography>
            </Box>
          </Button>
          <Tooltip title="Sair">
            <IconButton
              onClick={handleLogout}
              aria-label="Sair"
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
        <Panel accent="var(--pumpkin)" highlight sx={{ mb: 2.5 }}>
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
                  fontSize: '1.4rem',
                  letterSpacing: '0.05em',
                  color: 'var(--pumpkin)',
                }}
              >
                SUA MESA AINDA ESTÁ ASSOMBRADA
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Sala {resumeInfo.code.toUpperCase()}
                {resumeInfo.gameName ? ` · ${resumeInfo.gameName}` : ''} ·{' '}
                {resumeInfo.status === 'live' ? 'partida em andamento' : 'esperando no lobby'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
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
        {/* Catálogo — no celular vem depois das ações, que é o que se usa na festa */}
        <Panel
          title="ESCOLHA O JOGO"
          hint={gamesLoading ? 'carregando...' : `${games.length} disponíveis`}
          accent="var(--neon-purple)"
          sx={{ order: { xs: 2, lg: 1 } }}
        >
          {gamesLoading ? (
            <Typography sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}>
              Desenterrando os jogos da mesa...
            </Typography>
          ) : games.length === 0 ? (
            <Typography sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}>
              Nenhum jogo cadastrado no servidor.
            </Typography>
          ) : (
            <GameShelves
              games={games}
              selectedId={selectedGameId}
              onSelect={(game) => setSelectedGameId(game.id)}
            />
          )}
        </Panel>

        {/* Ações */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, order: { xs: 1, lg: 2 } }}>
          <Panel accent="var(--pumpkin)" highlight web index={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <AddRoundedIcon sx={{ fontSize: 26, color: 'var(--pumpkin)' }} />
              <Typography
                component="h2"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  letterSpacing: '0.05em',
                  color: 'var(--pumpkin)',
                }}
              >
                ABRIR SALA
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.92rem', mb: 2.5 }}>
              {selectedGame ? (
                <>
                  Você vai abrir uma mesa de{' '}
                  <Box component="strong" sx={{ color: 'var(--text-primary)' }}>
                    {selectedMeta?.icon} {selectedGame.name}
                  </Box>
                  . Dá pra trocar o jogo depois.
                </>
              ) : (
                'Escolha um jogo no catálogo para abrir a mesa.'
              )}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              onClick={handleCreateRoom}
              disabled={gamesLoading || creating || !selectedGame}
              sx={{ py: 1.8, fontSize: '1.05rem' }}
            >
              {creating ? 'Acendendo as velas...' : '🕯️ Criar nova sala'}
            </Button>
          </Panel>

          <Panel accent="var(--neon-purple)" index={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <LoginRoundedIcon sx={{ fontSize: 26, color: 'var(--neon-purple)' }} />
              <Typography
                component="h2"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  letterSpacing: '0.05em',
                  color: 'var(--neon-purple)',
                }}
              >
                ENTRAR COM CÓDIGO
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.92rem', mb: 2 }}>
              O código está na TV, bem grandão. Ou escaneie o QR de lá.
            </Typography>
            <TextField
              fullWidth
              placeholder="CÓDIGO"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase())}
              onKeyDown={(event) => event.key === 'Enter' && handleJoinRoom()}
              sx={{ mb: 1.5 }}
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  inputMode: 'numeric',
                  enterKeyHint: 'go',
                  style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.24em' },
                  'aria-label': 'Código da sala',
                },
              }}
            />
            <Button
              fullWidth
              variant="contained"
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
