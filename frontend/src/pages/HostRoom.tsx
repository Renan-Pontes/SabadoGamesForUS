import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  Switch,
} from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import TvRoundedIcon from '@mui/icons-material/TvRounded'
import { useAuth } from '../context/useAuth'
import { changeRoomGame, endRoom, getRoom, listGames, setReady, setTutorial, startRoom } from '../lib/api'
import { saveLastRoom } from '../lib/roomHistory'
import { gameRoute, getGameColor, getGameMeta, PERFIL_THEMES } from '../lib/gameCatalog'
import type { Game, Player, Room } from '../lib/types'
import { AppShell, GameTile, LoadingScreen, Panel, RoomCode, TutorialOverlay } from '../components/ui'
import { hasSeenTutorial, markTutorialSeen } from '../lib/narrator'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { PlayerRoster } from '../games/ui'

export default function HostRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [error, setError] = useState('')
  const [startError, setStartError] = useState('')
  const [readMyMindMode, setReadMyMindMode] = useState<'coop' | 'versus'>('coop')
  const [cacadaAdvanced, setCacadaAdvanced] = useState(false)
  // Temas do Perfil: a mesa escolhe de onde as cartas saem.
  const [perfilThemes, setPerfilThemes] = useState<string[]>([...PERFIL_THEMES])
  const [perfilRounds, setPerfilRounds] = useState(8)
  // Tutorial narrado: o host conduz, a TV fala, os celulares acompanham.
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [narrateHere, setNarrateHere] = useState(false)
  const [readyLoading, setReadyLoading] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/')
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (code) saveLastRoom(code, 'host')
  }, [code])

  const applyRoom = useCallback((data: Room) => {
    setRoom(data)
    setPlayers(data.players ?? [])
  }, [])

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true

    async function loadInitial() {
      try {
        const [gamesResponse, roomResponse] = await Promise.all([listGames(), getRoom(roomCode)])
        if (!active) return
        setGames(gamesResponse)
        applyRoom(roomResponse)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a sala.')
      } finally {
        if (active) setLoadingRoom(false)
      }
    }

    loadInitial()
    const interval = window.setInterval(async () => {
      if (document.hidden) return
      try {
        const data = await getRoom(roomCode)
        if (!active) return
        applyRoom(data)
        setError('')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível atualizar a sala.')
      }
    }, 3000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, applyRoom])

  const selectedGame = useMemo(() => {
    if (!room) return null
    return games.find((game) => game.id === room.game.id || game.slug === room.game.slug) ?? room.game
  }, [games, room])

  const tvConnected = Boolean(room?.tv_connected)
  const isLive = room?.status === 'live'

  const onlinePlayers = useMemo(() => players.filter((p) => p.online ?? true), [players])
  const readyCount = onlinePlayers.filter((p) => p.ready).length
  const allReady = onlinePlayers.length > 0 && onlinePlayers.every((p) => p.ready)
  const minPlayers = selectedGame?.min_players ?? 2
  const enoughPlayers = onlinePlayers.length >= minPlayers
  const canStart = Boolean(selectedGame) && allReady && enoughPlayers && !starting

  const hostPlayer = useMemo(
    () => (user?.id ? (players.find((p) => p.user?.id === user.id) ?? null) : null),
    [players, user?.id],
  )

  async function handleSelectGame(game: Game) {
    if (!code) return
    setStartError('')
    if (isLive) {
      setStartError('Partida em andamento. Encerre a sala para trocar o jogo.')
      return
    }
    try {
      applyRoom(await changeRoomGame(code, { game_id: game.id }))
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Não foi possível trocar o jogo.')
    }
  }

  async function handleConfirmStart() {
    if (!code || !selectedGame) return
    setStartError('')
    setStarting(true)
    try {
      if (selectedGame.slug === 'read-my-mind') {
        await startRoom(code, { mode: readMyMindMode })
      } else if (selectedGame.slug === 'a-cacada') {
        await startRoom(code, { advanced: cacadaAdvanced })
      } else if (selectedGame.slug === 'perfil') {
        await startRoom(code, { themes: perfilThemes, rounds: perfilRounds })
      } else {
        await startRoom(code)
      }
      setRulesOpen(false)
      navigate(gameRoute(code, 'host'))
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Não foi possível iniciar a partida.')
      setRulesOpen(false)
    } finally {
      setStarting(false)
    }
  }

  async function pushTutorial(step: number | null) {
    if (!code) return
    setTutorialStep(step)
    try {
      await setTutorial(code, step === null ? { active: false } : { active: true, step })
    } catch {
      // Se a sala nao aceitar, o tutorial segue so neste aparelho.
    }
    if (step === null && selectedGame) markTutorialSeen(selectedGame.slug)
  }

  async function handleEndRoom() {
    if (!code) return
    try {
      await endRoom(code)
    } catch {
      // A sala pode já ter sido encerrada; sair do jeito que der.
    }
    navigate('/lobby')
  }

  async function handleHostReadyToggle() {
    if (!code || !hostPlayer) return
    setReadyLoading(true)
    setError('')
    try {
      const result = await setReady(code, !hostPlayer.ready)
      setPlayers((current) =>
        current.map((p) => (p.id === result.player_id ? { ...p, ready: result.ready } : p)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar seu status.')
    } finally {
      setReadyLoading(false)
    }
  }

  if (isLoading || loadingRoom) return <LoadingScreen label="ABRINDO A SALA" />

  const accent = selectedGame ? getGameColor(selectedGame.slug) : 'var(--accent-red)'
  const meta = selectedGame ? getGameMeta(selectedGame.slug) : null

  const startLabel = !selectedGame
    ? 'Escolha um jogo'
    : !enoughPlayers
      ? `Faltam ${minPlayers - onlinePlayers.length} jogador(es)`
      : !allReady
        ? `Aguardando ${onlinePlayers.length - readyCount} jogador(es)`
        : 'Iniciar partida'

  return (
    <AppShell
      title="SALA DO HOST"
      subtitle={`Olá, ${user?.nickname ?? 'host'}. Escolha o jogo e comece quando a mesa estiver pronta.`}
      accent="var(--accent-red)"
      onBack={() => navigate('/lobby')}
      error={error}
      headerRight={<RoomCode code={code ?? ''} copyable size="md" />}
    >
      {selectedGame && !hasSeenTutorial(selectedGame.slug) && tutorialStep === null && (
        <Panel accent={accent} highlight sx={{ mb: 2.5 }}>
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
                sx={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', letterSpacing: '0.06em', color: accent }}
              >
                PRIMEIRA VEZ COM {selectedGame.name.toUpperCase()}?
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                A TV narra as regras em voz alta enquanto você passa os passos daqui.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  markTutorialSeen(selectedGame.slug)
                  setTutorialStep(null)
                  setNarrateHere(false)
                }}
              >
                Já sei jogar
              </Button>
              <Button
                variant="contained"
                startIcon={<SchoolRoundedIcon />}
                onClick={() => pushTutorial(0)}
                sx={{ backgroundImage: 'none', bgcolor: accent, color: '#0a0a0f', '&:hover': { bgcolor: accent } }}
              >
                Ver tutorial
              </Button>
            </Box>
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
          title="JOGO DA MESA"
          hint={selectedGame?.name}
          accent={accent}
          highlight
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {games.map((game, index) => (
              <GameTile
                key={game.id}
                game={game}
                index={index}
                selected={game.id === selectedGame?.id}
                disabledReason={
                  onlinePlayers.length > game.max_players
                    ? `Máximo de ${game.max_players} jogadores`
                    : undefined
                }
                onSelect={handleSelectGame}
              />
            ))}
          </Box>
        </Panel>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Status da TV */}
          <Panel accent={tvConnected ? 'var(--neon-cyan)' : undefined} index={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
              <TvRoundedIcon
                sx={{ fontSize: 30, color: tvConnected ? 'var(--neon-cyan)' : 'var(--text-muted)' }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {tvConnected ? 'TV conectada' : 'TV não conectada'}
                </Typography>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {tvConnected
                    ? 'A mesa está sendo exibida.'
                    : `Abra sabadogames em /tv/${code?.toUpperCase()}`}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: tvConnected ? 'var(--status-ready)' : 'var(--status-waiting)',
                  animation: tvConnected ? 'none' : 'pulse 2s ease-in-out infinite',
                }}
              />
            </Box>
          </Panel>

          {/* Jogadores */}
          <Panel
            title="JOGADORES"
            hint={`${readyCount}/${onlinePlayers.length} prontos`}
            accent={allReady ? 'var(--status-ready)' : 'var(--status-waiting)'}
            highlight={allReady}
            index={2}
          >
            <PlayerRoster
              players={players}
              currentUserId={user?.id}
              accent={accent}
              emptyLabel="Compartilhe o código para a galera entrar."
              describe={(player) => ({
                ready: player.ready,
                status:
                  player.online === false
                    ? 'Offline'
                    : player.ready
                      ? 'Pronto'
                      : 'Ainda não confirmou',
                highlight: player.ready,
              })}
            />
          </Panel>

          {/* Ações */}
          <Panel accent="var(--accent-red)" index={3}>
            <Button
              fullWidth
              variant={hostPlayer?.ready ? 'outlined' : 'contained'}
              color={hostPlayer?.ready ? 'success' : 'warning'}
              disabled={!hostPlayer || readyLoading}
              onClick={handleHostReadyToggle}
              sx={{ py: 1.4, mb: 1.5 }}
            >
              {hostPlayer?.ready ? 'Você está pronto ✓' : 'Marcar que estou pronto'}
            </Button>

            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => setRulesOpen(true)}
              disabled={!canStart}
              sx={{ py: 1.9, fontSize: '1.05rem' }}
            >
              {startLabel}
            </Button>

            {startError && (
              <Typography
                className="animate-shake"
                sx={{ mt: 1.5, color: 'var(--accent-red-light)', fontSize: '0.85rem' }}
              >
                {startError}
              </Typography>
            )}

            <Button
              fullWidth
              variant="text"
              color="error"
              startIcon={<StopRoundedIcon />}
              onClick={handleEndRoom}
              sx={{ mt: 1.5 }}
            >
              Encerrar sala
            </Button>
          </Panel>
        </Box>
      </Box>

      {/* Regras antes de começar */}
      <Dialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 'var(--radius-xl)', border: `1px solid ${accent}` } },
        }}
      >
        <DialogContent sx={{ p: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{ fontSize: '2.6rem', lineHeight: 1 }}>{meta?.icon}</Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.8rem',
                  lineHeight: 1.1,
                  letterSpacing: '0.05em',
                  color: accent,
                }}
              >
                {selectedGame?.name}
              </Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {meta?.vibe} · {meta?.duration} · {selectedGame?.min_players}–
                {selectedGame?.max_players} jogadores
              </Typography>
            </Box>
          </Box>

          {selectedGame?.slug === 'read-my-mind' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
              {(
                [
                  { key: 'coop', label: 'CO-OP', hint: 'Sobrevivam juntos', color: 'var(--status-ready)' },
                  { key: 'versus', label: 'VERSUS', hint: 'Último de pé vence', color: 'var(--neon-purple)' },
                ] as const
              ).map((option) => (
                <Button
                  key={option.key}
                  onClick={() => setReadMyMindMode(option.key)}
                  sx={{
                    flexDirection: 'column',
                    gap: 0,
                    py: 1.4,
                    border: `2px solid ${option.color}`,
                    background:
                      readMyMindMode === option.key ? option.color : 'transparent',
                    color: readMyMindMode === option.key ? '#0a0a0f' : option.color,
                    '&:hover': {
                      background:
                        readMyMindMode === option.key ? option.color : `${option.color}22`,
                    },
                  }}
                >
                  <Box component="span" sx={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
                    {option.label}
                  </Box>
                  <Box component="span" sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', opacity: 0.85 }}>
                    {option.hint}
                  </Box>
                </Button>
              ))}
            </Box>
          )}

          {selectedGame?.slug === 'perfil' && (
            <Box sx={{ mb: 2.5 }}>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  mb: 1.25,
                }}
              >
                TEMAS EM JOGO
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {PERFIL_THEMES.map((theme) => {
                  const on = perfilThemes.includes(theme)
                  return (
                    <Button
                      key={theme}
                      onClick={() =>
                        setPerfilThemes((current) =>
                          current.includes(theme)
                            ? // Nunca deixa a mesa sem tema nenhum.
                              current.length > 1
                              ? current.filter((item) => item !== theme)
                              : current
                            : [...current, theme],
                        )
                      }
                      sx={{
                        px: 2,
                        py: 0.9,
                        textTransform: 'none',
                        borderRadius: 'var(--radius-full)',
                        border: `2px solid ${on ? accent : 'rgba(255,255,255,0.12)'}`,
                        background: on ? `${accent}26` : 'rgba(255,255,255,0.03)',
                        color: on ? accent : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {on ? '✓ ' : ''}
                      {theme}
                    </Button>
                  )
                })}
              </Box>

              <Typography
                sx={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  mb: 1.25,
                }}
              >
                RODADAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[4, 6, 8, 10, 12].map((count) => (
                  <Button
                    key={count}
                    onClick={() => setPerfilRounds(count)}
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      py: 1,
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.1rem',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${perfilRounds === count ? accent : 'rgba(255,255,255,0.12)'}`,
                      background: perfilRounds === count ? `${accent}26` : 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {count}
                  </Button>
                ))}
              </Box>
            </Box>
          )}

          {selectedGame?.slug === 'a-cacada' && (
            <Box
              onClick={() => setCacadaAdvanced((current) => !current)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setCacadaAdvanced((current) => !current)
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.75,
                mb: 2.5,
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${cacadaAdvanced ? 'var(--accent-red)' : 'rgba(255,255,255,0.12)'}`,
                background: cacadaAdvanced ? 'rgba(220, 38, 38, 0.12)' : 'rgba(255,255,255,0.03)',
                transition: 'all 220ms ease',
              }}
            >
              <Switch checked={cacadaAdvanced} size="small" />
              <Box>
                <Typography sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Modo avançado
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Inclui pistas negativas ("a criatura NÃO está a até 2 de montanha"). Bem mais
                  difícil de deduzir.
                </Typography>
              </Box>
            </Box>
          )}

          <Typography
            sx={{
              fontSize: '0.62rem',
              letterSpacing: '0.2em',
              fontWeight: 800,
              color: 'var(--text-muted)',
              mb: 1.25,
            }}
          >
            COMO JOGAR
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {meta?.howTo.map((step, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.8rem',
                    color: accent,
                    border: `1px solid ${accent}66`,
                    background: `${accent}14`,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', pt: 0.15 }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3.5, pb: 3.5, gap: 1 }}>
          <Button
            onClick={() => {
              setRulesOpen(false)
              pushTutorial(0)
            }}
            color="inherit"
            startIcon={<SchoolRoundedIcon />}
            sx={{ mr: 'auto' }}
          >
            Tutorial narrado
          </Button>
          <Button onClick={() => setRulesOpen(false)} color="inherit">
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmStart}
            disabled={starting}
            sx={{
              bgcolor: accent,
              backgroundImage: 'none',
              color: '#0a0a0f',
              '&:hover': { bgcolor: accent, backgroundImage: 'none', filter: 'brightness(1.1)' },
            }}
          >
            {starting ? 'Começando...' : 'Começar'}
          </Button>
        </DialogActions>
      </Dialog>

      {selectedGame && meta && (
        <TutorialOverlay
          open={tutorialStep !== null}
          title={selectedGame.name}
          icon={meta.icon}
          pitch={meta.pitch}
          steps={meta.howTo}
          step={tutorialStep ?? 0}
          accent={accent}
          narrate={narrateHere || !tvConnected}
          controls={{
            onNext: () => pushTutorial(Math.min((tutorialStep ?? 0) + 1, meta.howTo.length)),
            onPrev: () => pushTutorial(Math.max((tutorialStep ?? 0) - 1, 0)),
            onClose: () => pushTutorial(null),
          }}
        />
      )}
      {tutorialStep !== null && tvConnected && (
        <Box sx={{ position: 'fixed', bottom: 12, left: 0, right: 0, textAlign: 'center', zIndex: 56 }}>
          <Button size="small" variant="text" color="inherit" onClick={() => setNarrateHere((v) => !v)}>
            {narrateHere ? 'Narrar só na TV' : 'Narrar aqui também'}
          </Button>
        </Box>
      )}
    </AppShell>
  )
}
