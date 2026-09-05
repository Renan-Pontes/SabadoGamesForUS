import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded'
import { useAuth } from '../context/useAuth'
import { getRoom, joinRoom, sendHeartbeat, setReady } from '../lib/api'
import { clearStayInLobby, getStayInLobby, saveLastRoom } from '../lib/roomHistory'
import { gameRoute, getGameColor, getGameMeta } from '../lib/gameCatalog'
import type { Player, Room } from '../lib/types'
import { AppShell, LoadingScreen, Panel, RoomCode, TutorialOverlay } from '../components/ui'
import { PlayerRoster } from '../games/ui'
import { haptic } from '../games/utils'

export default function PlayerController() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()

  const [isReady, setIsReady] = useState(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(true)
  const [togglingReady, setTogglingReady] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/')
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (code) saveLastRoom(code, 'player')
  }, [code])

  // Entrar na sala
  useEffect(() => {
    if (!code || !isAuthenticated) return
    const roomCode = code
    let active = true
    async function join() {
      try {
        const result = await joinRoom(roomCode, {})
        if (!active) return
        setPlayer(result.player)
        setIsReady(result.player.ready)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível entrar na sala.')
      } finally {
        if (active) setJoining(false)
      }
    }
    join()
    return () => {
      active = false
    }
  }, [code, isAuthenticated])

  // Acompanhar a sala e seguir para o jogo quando o host começar
  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true

    async function pollRoom() {
      if (document.hidden) return
      try {
        const data = await getRoom(roomCode)
        if (!active) return
        setRoom(data)
        setError('')
        if (data.status === 'live') {
          if (!getStayInLobby(roomCode)) navigate(gameRoute(roomCode, 'player'))
        } else if (getStayInLobby(roomCode)) {
          clearStayInLobby(roomCode)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível atualizar a sala.')
      }
    }

    pollRoom()
    const interval = window.setInterval(pollRoom, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, navigate])

  // Presença: sem isso o host vê você como offline.
  useEffect(() => {
    if (!code || !player) return
    const roomCode = code
    const playerId = player.id
    const interval = window.setInterval(() => {
      sendHeartbeat(roomCode, playerId).catch(() => undefined)
    }, 10000)
    return () => window.clearInterval(interval)
  }, [code, player])

  async function handleReadyToggle() {
    if (!code || togglingReady) return
    setTogglingReady(true)
    haptic()
    try {
      const result = await setReady(code, !isReady)
      setIsReady(result.ready)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar seu status.')
    } finally {
      setTogglingReady(false)
    }
  }

  const players = useMemo(() => room?.players ?? [], [room?.players])
  const readyCount = players.filter((item) => item.ready).length

  if (isLoading || joining) return <LoadingScreen label="ENTRANDO NA SALA" />

  const game = room?.game
  const accent = game ? getGameColor(game.slug) : 'var(--accent-gold)'
  const meta = game ? getGameMeta(game.slug) : null
  const isLive = room?.status === 'live'
  const tutorial = (room?.state?.tutorial ?? null) as { active: boolean; step: number } | null

  return (
    <AppShell
      title={user?.nickname || 'Jogador'}
      subtitle={game ? `Mesa de ${game.name}` : 'Aguardando o host escolher o jogo'}
      accent={accent}
      backdropTint={`${accent}1f`}
      maxWidth={640}
      error={error}
      headerRight={<RoomCode code={code ?? ''} size="sm" accent={accent} label="SALA" />}
    >
      {/* Status grande — é o que a pessoa checa de relance */}
      <Panel accent={isReady ? 'var(--status-ready)' : 'var(--status-waiting)'} highlight>
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Box
            sx={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 84,
              height: 84,
              borderRadius: '50%',
              mb: 1.5,
              color: isReady ? 'var(--status-ready)' : 'var(--status-waiting)',
              border: `2px solid ${isReady ? 'var(--status-ready)' : 'var(--status-waiting)'}`,
              background: isReady ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.1)',
              '--pulse-color': isReady ? 'rgba(34,197,94,0.45)' : 'rgba(234,179,8,0.4)',
              animation: 'pulseGlow 2.6s ease-in-out infinite',
            }}
          >
            {isReady ? (
              <CheckCircleRoundedIcon sx={{ fontSize: 44 }} />
            ) : (
              <HourglassTopRoundedIcon sx={{ fontSize: 40 }} />
            )}
          </Box>

          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.9rem',
              lineHeight: 1.1,
              letterSpacing: '0.06em',
              color: isReady ? 'var(--status-ready)' : 'var(--status-waiting)',
            }}
          >
            {isReady ? 'VOCÊ ESTÁ PRONTO' : 'MARQUE QUE ESTÁ PRONTO'}
          </Typography>

          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem', mt: 0.5, mb: 2.5 }}>
            {isLive
              ? 'A partida já começou.'
              : `${readyCount} de ${players.length} na mesa já confirmaram.`}
          </Typography>

          <Button
            fullWidth
            variant={isReady ? 'outlined' : 'contained'}
            color={isReady ? 'success' : 'warning'}
            size="large"
            onClick={handleReadyToggle}
            disabled={!player || togglingReady}
            sx={{ py: 2, fontSize: '1.1rem' }}
          >
            {isReady ? 'Desmarcar' : 'Estou pronto'}
          </Button>

          {isLive && (
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              onClick={() => {
                if (!code) return
                clearStayInLobby(code)
                navigate(gameRoute(code, 'player'))
              }}
              sx={{ mt: 1.5, py: 1.8 }}
            >
              Voltar ao jogo
            </Button>
          )}
        </Box>
      </Panel>

      {/* O que vai acontecer */}
      {meta && game && (
        <Panel title="COMO JOGAR" hint={`${meta.duration} · ${meta.vibe}`} accent={accent} sx={{ mt: 2.5 }} index={1}>
          <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.92rem', mb: 2 }}>
            {meta.pitch}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {meta.howTo.map((step, index) => (
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
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.88rem', pt: 0.15 }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </Panel>
      )}

      <Panel title="NA MESA" hint={`${readyCount}/${players.length} prontos`} accent={accent} sx={{ mt: 2.5 }} index={2}>
        <PlayerRoster
          players={players}
          currentUserId={user?.id}
          accent={accent}
          emptyLabel="Você é o primeiro a chegar."
          describe={(item) => ({
            ready: item.ready,
            highlight: item.ready,
            status:
              item.online === false ? 'Offline' : item.ready ? 'Pronto' : 'Ainda não confirmou',
          })}
        />
      </Panel>

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button variant="text" color="error" size="small" onClick={() => navigate('/lobby')}>
          Sair da sala
        </Button>
      </Box>

      {meta && game && (
        <TutorialOverlay
          open={Boolean(tutorial?.active)}
          title={game.name}
          icon={meta.icon}
          pitch={meta.pitch}
          steps={meta.howTo}
          step={tutorial?.step ?? 0}
          accent={accent}
          narrate={false}
        />
      )}
    </AppShell>
  )
}
