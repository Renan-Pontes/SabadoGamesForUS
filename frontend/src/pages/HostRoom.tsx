import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/useAuth'
import { useRequireAuth } from '../context/useRequireAuth'
import {
  changeRoomGame,
  endRoom,
  friendlyError,
  getRoom,
  listGames,
  sendHeartbeat,
  setReady,
  setTutorial,
  startRoom,
} from '../lib/api'
import { saveLastRoom } from '../lib/roomHistory'
import { gameRoute, getGameColor, getGameMeta, PERFIL_THEMES } from '../lib/gameCatalog'
import type { Game, Player, Room } from '../lib/types'
import { isHalloweenSlug } from '../halloween/slugs'
import { RANDOM_SCARES_OFF, RANDOM_SCARES_ON, sendRoomFx } from '../halloween/fx/api'
import type { RoomFxRequest } from '../halloween/fx/api'
import {
  AppShell,
  GameShelves,
  LoadingScreen,
  MIST,
  Panel,
  RoomCode,
  TutorialOverlay,
  withAlpha,
} from '../components/ui'
import { hasSeenTutorial, markTutorialSeen } from '../lib/narrator'
import { PlayerRoster } from '../games/ui'
import { haptic, playerLabel } from '../games/utils'

export default function HostRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isLoading, isAuthenticated, user } = useAuth()
  useRequireAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
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
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [starting, setStarting] = useState(false)

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
        setError(friendlyError(err, 'Não foi possível carregar a sala.'))
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
        setError(friendlyError(err, 'Não foi possível atualizar a sala.'))
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
  const spooky = isHalloweenSlug(selectedGame?.slug)

  const onlinePlayers = useMemo(() => players.filter((p) => p.online ?? true), [players])

  const hostPlayer = useMemo(
    () => (user?.id ? (players.find((p) => p.user?.id === user.id) ?? null) : null),
    [players, user?.id],
  )
  const hostPlayerId = hostPlayer?.id ?? null
  const hostReady = Boolean(hostPlayer?.ready)

  // Presença do host: sem batimento ele aparece offline para a mesa.
  useEffect(() => {
    if (!code || !hostPlayerId) return
    const roomCode = code
    const beat = () => sendHeartbeat(roomCode, hostPlayerId).catch(() => undefined)
    beat()
    const interval = window.setInterval(beat, 10000)
    return () => window.clearInterval(interval)
  }, [code, hostPlayerId])

  // O host não precisa apertar "estou pronto": quem abre a sala está pronto.
  const hostReadyAsked = useRef(false)
  useEffect(() => {
    if (!code || !hostPlayerId || hostReady || room?.status !== 'lobby' || hostReadyAsked.current) return
    hostReadyAsked.current = true
    setReady(code, true)
      .then((result) =>
        setPlayers((current) => current.map((p) => (p.id === result.player_id ? { ...p, ready: result.ready } : p))),
      )
      .catch(() => {
        hostReadyAsked.current = false
      })
  }, [code, hostPlayerId, hostReady, room?.status])

  const others = onlinePlayers.filter((p) => p.id !== hostPlayerId)
  const readyCount = onlinePlayers.filter((p) => p.ready).length
  const notReady = others.filter((p) => !p.ready)
  const minPlayers = selectedGame?.min_players ?? 2
  const enoughPlayers = onlinePlayers.length >= minPlayers
  // Nos jogos de Halloween o próprio jogo tem a tela de "quem joga"; aqui só
  // cobra o mínimo de gente. Nos antigos, todo mundo precisa estar pronto.
  const canStart = Boolean(selectedGame) && enoughPlayers && !starting && (spooky || notReady.length === 0)

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
      setStartError(friendlyError(err, 'Não foi possível trocar o jogo.'))
    }
  }

  async function handleConfirmStart() {
    if (!code || !selectedGame) return
    setStartError('')
    setStarting(true)
    try {
      // O servidor exige todo mundo pronto — inclusive o host.
      if (hostPlayer && !hostPlayer.ready) await setReady(code, true)
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
      const message = friendlyError(err, 'Não foi possível iniciar a partida.')
      const stragglers = players.filter((p) => !p.ready && p.id !== hostPlayerId).map(playerLabel)
      setStartError(
        /pronto/i.test(message) && stragglers.length
          ? `Falta marcar "Estou pronto": ${stragglers.join(', ')}.`
          : message,
      )
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

  if (isLoading || !isAuthenticated || loadingRoom) return <LoadingScreen label="ABRINDO A SALA" />

  const roomCode = (code ?? '').toUpperCase()
  const accent = selectedGame ? getGameColor(selectedGame.slug) : 'var(--pumpkin)'
  const meta = selectedGame ? getGameMeta(selectedGame.slug) : null
  const origin = window.location.origin
  const tvUrl = `${origin}/tv/${roomCode}`
  const playUrl = `${origin}/play/${roomCode}`

  const startLabel = !selectedGame
    ? 'Escolha um jogo'
    : !enoughPlayers
      ? `Faltam ${minPlayers - onlinePlayers.length} jogador(es)`
      : !spooky && notReady.length > 0
        ? `Esperando ${notReady.length} ficar(em) pronto(s)`
        : 'Começar a partida'

  return (
    <AppShell
      title="SALA DO HOST"
      subtitle={`Olá, ${user?.nickname ?? 'host'}. Escolha o jogo e comece quando a mesa estiver pronta.`}
      accent="var(--pumpkin)"
      backdropTint={MIST.pumpkin}
      onBack={() => navigate('/lobby')}
      error={error}
      headerRight={<RoomCode code={roomCode} copyable size="md" />}
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
                sx={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.05em', color: accent }}
              >
                PRIMEIRA VEZ COM {selectedGame.name.toUpperCase()}?
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                A TV narra as regras em voz alta enquanto você passa os passos daqui.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
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
                sx={{ backgroundImage: 'none', bgcolor: accent, color: '#0a0612', '&:hover': { bgcolor: accent } }}
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
          gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Catálogo — no celular vai para o fim: o host usa mais o "começar" */}
        <Panel
          title="JOGO DA MESA"
          hint={selectedGame?.name}
          accent={accent}
          highlight
          sx={{ order: { xs: 2, lg: 1 } }}
        >
          <GameShelves
            games={games}
            selectedId={selectedGame?.id ?? null}
            disabledReason={(game) =>
              onlinePlayers.length > game.max_players
                ? `Máximo de ${game.max_players} jogadores`
                : undefined
            }
            onSelect={handleSelectGame}
          />
        </Panel>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, order: { xs: 1, lg: 2 } }}>
          {/* Status da TV */}
          <Panel accent={tvConnected ? 'var(--neon-cyan)' : 'var(--status-waiting)'} index={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
              <TvRoundedIcon
                sx={{ fontSize: 30, color: tvConnected ? 'var(--neon-cyan)' : 'var(--text-muted)' }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {tvConnected ? 'TV conectada 📺' : 'TV ainda não apareceu'}
                </Typography>
                <Typography
                  sx={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {tvConnected ? 'A mesa está na tela da sala.' : `Abra na TV: ${window.location.host}/tv/${roomCode}`}
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
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.75 }}>
              <Button
                size="small"
                variant="outlined"
                color="info"
                startIcon={<OpenInNewRoundedIcon />}
                href={tvUrl}
                target="_blank"
                rel="noopener"
                sx={{ minWidth: 0, px: 1.25, py: 0.9, textTransform: 'none', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
              >
                Abrir a TV
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<QrCode2RoundedIcon />}
                onClick={() => setQrOpen(true)}
                sx={{ minWidth: 0, px: 1.25, py: 0.9, textTransform: 'none', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
              >
                QR da sala
              </Button>
            </Box>
          </Panel>

          {/* Começar */}
          <Panel accent="var(--pumpkin)" highlight={canStart} web index={2}>
            {selectedGame && (
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mb: 1.5 }}>
                Jogo:{' '}
                <Box component="strong" sx={{ color: 'var(--text-primary)' }}>
                  {meta?.icon} {selectedGame.name}
                </Box>{' '}
                · {selectedGame.min_players}–{selectedGame.max_players} pessoas
              </Typography>
            )}

            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => setRulesOpen(true)}
              disabled={!canStart}
              sx={{ py: 1.9, fontSize: '1.08rem' }}
            >
              {startLabel}
            </Button>

            {spooky && notReady.length > 0 && enoughPlayers && (
              <Typography sx={{ mt: 1.25, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {notReady.length === 1 ? 'Uma pessoa ainda não marcou' : `${notReady.length} pessoas ainda não marcaram`}{' '}
                "pronto" — tudo bem: quem estiver online entra na partida.
              </Typography>
            )}

            {startError && (
              <Typography
                role="alert"
                className="animate-shake"
                sx={{ mt: 1.5, color: 'var(--accent-red-light)', fontSize: '0.88rem', fontWeight: 600 }}
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

          {/* Jogadores */}
          <Panel
            title="JOGADORES"
            hint={`${readyCount}/${onlinePlayers.length} prontos`}
            accent={notReady.length === 0 && others.length > 0 ? 'var(--status-ready)' : 'var(--status-waiting)'}
            highlight={notReady.length === 0 && others.length > 0}
            index={3}
          >
            <PlayerRoster
              players={players}
              currentUserId={user?.id}
              accent={accent}
              emptyLabel="Mostre o QR da TV para a galera entrar."
              describe={(player) => ({
                ready: player.ready,
                status:
                  player.online === false
                    ? 'Sumiu 👻 (offline)'
                    : player.ready
                      ? 'Pronto'
                      : 'Ainda não confirmou',
                highlight: player.ready,
              })}
            />
          </Panel>

          {/* Sustos e música na TV */}
          {code && <TvFxPanel code={roomCode} players={players} tvConnected={tvConnected} />}
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
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{ fontSize: '2.6rem', lineHeight: 1 }}>{meta?.icon}</Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.9rem',
                  lineHeight: 1.1,
                  letterSpacing: '0.04em',
                  color: accent,
                }}
              >
                {selectedGame?.name}
              </Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {meta?.vibe} · {meta?.duration} · {selectedGame?.min_players}–
                {selectedGame?.max_players} jogadores
              </Typography>
            </Box>
          </Box>

          {selectedGame?.slug === 'read-my-mind' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
              {(
                [
                  { key: 'coop', label: 'CO-OP', hint: 'Sobrevivam juntos', color: '#8cf045' },
                  { key: 'versus', label: 'VERSUS', hint: 'Último de pé vence', color: '#b06bff' },
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
                    color: readMyMindMode === option.key ? '#0a0612' : option.color,
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
                        background: on ? withAlpha(accent, 0.15) : 'rgba(255,255,255,0.03)',
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
                      fontFamily: 'var(--font-numeric)',
                      fontSize: '1.2rem',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${perfilRounds === count ? accent : 'rgba(255,255,255,0.12)'}`,
                      background: perfilRounds === count ? withAlpha(accent, 0.15) : 'rgba(255,255,255,0.03)',
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
                background: cacadaAdvanced ? 'rgba(224, 33, 58, 0.12)' : 'rgba(255,255,255,0.03)',
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

          {spooky && (
            <Typography sx={{ mb: 2, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              🎃 As opções (rodadas, tempo...) aparecem na TV e no seu celular logo depois de começar.
            </Typography>
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
                    fontFamily: 'var(--font-numeric)',
                    fontSize: '0.9rem',
                    color: accent,
                    border: `1px solid ${withAlpha(accent, 0.4)}`,
                    background: withAlpha(accent, 0.08),
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.92rem', pt: 0.15 }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2.5, sm: 3.5 }, pb: 3, gap: 1, flexWrap: 'wrap' }}>
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
              color: '#0a0612',
              '&:hover': { bgcolor: accent, backgroundImage: 'none', filter: 'brightness(1.1)' },
            }}
          >
            {starting ? 'Começando...' : 'Começar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR para quem não está vendo a TV */}
      <Dialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 'var(--radius-xl)', border: '1px solid var(--pumpkin)' } } }}
      >
        <DialogContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--pumpkin)', mb: 0.5 }}>
            ESCANEIE PARA ENTRAR
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mb: 2 }}>
            Câmera do celular no QR, apelido, pronto.
          </Typography>
          <Box
            sx={{
              display: 'inline-block',
              p: 1.5,
              borderRadius: 'var(--radius-lg)',
              background: '#fff7ed',
              boxShadow: '0 0 40px rgba(255, 123, 28, 0.35)',
              width: 'min(260px, 70vw)',
            }}
          >
            <QRCodeSVG value={playUrl} size={240} level="M" fgColor="#140b22" bgColor="#fff7ed" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </Box>
          <Typography sx={{ mt: 2, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {playUrl.replace(/^https?:\/\//, '')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setQrOpen(false)} color="inherit" fullWidth>
            Fechar
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

// ---------------------------------------------------------------------------
// Efeitos da TV: o host assusta a sala pelo celular
// ---------------------------------------------------------------------------

type ScareButton = {
  kind: string
  label: string
  icon: string
  /** O susto usa o nome de alguém da mesa (sorteado na hora). */
  named?: boolean
  done: (name?: string) => string
}

const SCARES: ScareButton[] = [
  { kind: 'doot', label: 'Doot doot', icon: '🎺', done: () => '🎺 O esqueleto do trompete vai tocar!' },
  {
    kind: 'zoom',
    label: 'Zoom suspeito',
    icon: '🤨',
    named: true,
    done: (name) => (name ? `🤨 A TV está desconfiada de ${name}...` : '🤨 Zoom suspeito enviado!'),
  },
  { kind: 'scream', label: 'Grito', icon: '😱', done: () => '😱 Grito a caminho da TV!' },
  { kind: 'skeletons', label: 'Esqueletos', icon: '💀', done: () => '💀 Os esqueletos vão dançar!' },
  { kind: 'spider', label: 'Aranha', icon: '🕷️', done: () => '🕷️ Aranha descendo na TV!' },
  {
    kind: 'eyes',
    label: 'Olhos no escuro',
    icon: '👀',
    named: true,
    done: (name) => (name ? `👀 Os olhos chamam ${name}...` : '👀 Olhos no escuro enviados!'),
  },
]

/** Os sustos de verdade (som bem alto na TV): destaque em vermelho, acima dos de meme. */
const SCARY_BUTTONS: ScareButton[] = [
  {
    kind: 'animatronic',
    label: 'Animatrônico',
    icon: '🤖',
    done: () => '🤖 Ele ainda funciona... olhe a cara da galera!',
  },
  { kind: 'face', label: 'Rosto', icon: '👁️', done: () => '👁️ Não olha... o rosto está indo para a TV!' },
]

/** Espera entre sustos: cada um dura uns 2 s na TV, e evita rajada de cliques. */
const FX_COOLDOWN_MS = 2500
const MUSIC_KEY_PREFIX = 'sabado_tv_music_'
const RANDOM_SCARES_KEY_PREFIX = 'sabado_tv_scares_'

/** Liga/desliga lembrado por sala (a TV nasce com os dois ligados). */
function readToggle(prefix: string, code: string) {
  try {
    return window.localStorage.getItem(`${prefix}${code}`) !== 'off'
  } catch {
    return true
  }
}

function saveToggle(prefix: string, code: string, on: boolean) {
  try {
    window.localStorage.setItem(`${prefix}${code}`, on ? 'on' : 'off')
  } catch {
    // Sem armazenamento: o botão só esquece o estado ao recarregar.
  }
}

/** Alguém da mesa para estrelar o susto — de preferência quem está online. */
function pickVictim(players: Player[]) {
  const pool = players.filter((p) => p.online !== false)
  const list = pool.length ? pool : players
  if (!list.length) return undefined
  return playerLabel(list[Math.floor(Math.random() * list.length)])
}

function TvFxPanel({ code, players, tvConnected }: { code: string; players: Player[]; tvConnected: boolean }) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [musicOn, setMusicOn] = useState(() => readToggle(MUSIC_KEY_PREFIX, code))
  const [randomScaresOn, setRandomScaresOn] = useState(() => readToggle(RANDOM_SCARES_KEY_PREFIX, code))
  const cooldownRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(cooldownRef.current), [])

  async function send(payload: RoomFxRequest, okText: string, onDone?: () => void) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    haptic(25)
    try {
      await sendRoomFx(code, payload)
      onDone?.()
      setFeedback({ ok: true, text: okText })
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err, 'A TV não ouviu. Tente de novo.') })
    } finally {
      cooldownRef.current = window.setTimeout(() => setBusy(false), FX_COOLDOWN_MS)
    }
  }

  function scare(button: ScareButton) {
    const name = button.named ? pickVictim(players) : undefined
    send(name ? { scare: button.kind, name } : { scare: button.kind }, button.done(name))
  }

  function toggleMusic() {
    const next = !musicOn
    send({ music: next ? 'on' : 'off' }, next ? '🎵 Música ligada na TV.' : '🔇 Música desligada na TV.', () => {
      setMusicOn(next)
      saveToggle(MUSIC_KEY_PREFIX, code, next)
    })
  }

  function toggleRandomScares() {
    const next = !randomScaresOn
    send(
      { scare: next ? RANDOM_SCARES_ON : RANDOM_SCARES_OFF },
      next ? '👻 Sustos aleatórios ligados na TV.' : '🤫 Sustos aleatórios desligados na TV.',
      () => {
        setRandomScaresOn(next)
        saveToggle(RANDOM_SCARES_KEY_PREFIX, code, next)
      },
    )
  }

  return (
    <Panel title="EFEITOS DA TV" icon="👻" accent="var(--neon-purple)" index={4}>
      <Button
        fullWidth
        variant="contained"
        color="secondary"
        size="large"
        disabled={busy}
        onClick={() =>
          send({ scare: 'random' }, '😱 Susto a caminho! Olhe a cara da galera.')
        }
        sx={{ py: 1.7, fontSize: '1.08rem' }}
      >
        😱&nbsp;&nbsp;Assustar a TV
      </Button>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mt: 1.5 }}>
        {SCARY_BUTTONS.map((button) => (
          <Button
            key={button.kind}
            variant="outlined"
            color="error"
            disabled={busy}
            onClick={() => scare(button)}
            aria-label={button.label}
            sx={{
              gap: 1,
              py: 1.1,
              minWidth: 0,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.92rem',
              borderWidth: 2,
              '&:hover': { borderWidth: 2 },
            }}
          >
            <Box component="span" sx={{ fontSize: '1.4rem', lineHeight: 1 }}>
              {button.icon}
            </Box>
            {button.label}
          </Button>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mt: 1 }}>
        {SCARES.map((button) => (
          <Button
            key={button.kind}
            variant="outlined"
            color="secondary"
            disabled={busy}
            onClick={() => scare(button)}
            aria-label={button.label}
            sx={{
              flexDirection: 'column',
              gap: 0.25,
              px: 0.5,
              py: 1,
              minWidth: 0,
              textTransform: 'none',
              lineHeight: 1.1,
            }}
          >
            <Box component="span" sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
              {button.icon}
            </Box>
            <Box component="span" sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {button.label}
            </Box>
          </Button>
        ))}
      </Box>

      <Button
        fullWidth
        variant="outlined"
        color={musicOn ? 'success' : 'inherit'}
        disabled={busy}
        onClick={toggleMusic}
        sx={{ mt: 1.5, py: 1.2, justifyContent: 'space-between', textTransform: 'none', fontSize: '0.95rem' }}
      >
        <span>🎵 Música da TV: {musicOn ? 'ligada' : 'desligada'}</span>
        <Box component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em' }}>
          {musicOn ? 'DESLIGAR' : 'LIGAR'}
        </Box>
      </Button>

      <Button
        fullWidth
        variant="outlined"
        color={randomScaresOn ? 'success' : 'inherit'}
        disabled={busy}
        onClick={toggleRandomScares}
        sx={{ mt: 1, py: 1.2, justifyContent: 'space-between', textTransform: 'none', fontSize: '0.95rem' }}
      >
        <span>👻 Sustos aleatórios: {randomScaresOn ? 'ligados' : 'desligados'}</span>
        <Box component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em' }}>
          {randomScaresOn ? 'DESLIGAR' : 'LIGAR'}
        </Box>
      </Button>

      <Typography
        role="status"
        sx={{
          mt: 1.5,
          minHeight: '1.4em',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: feedback ? (feedback.ok ? 'var(--status-ready)' : 'var(--accent-red-light)') : 'var(--text-muted)',
        }}
      >
        {feedback?.text ??
          (tvConnected
            ? 'Os sustos e a música tocam na TV.'
            : 'A TV ainda não está aberta: os efeitos só aparecem quando ela conectar.')}
      </Typography>
    </Panel>
  )
}
