import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { useAuth } from '../context/useAuth'
import { useRequireAuth } from '../context/useRequireAuth'
import { friendlyError, getRoom, joinRoom, sendHeartbeat, setReady } from '../lib/api'
import { clearStayInLobby, getStayInLobby, saveLastRoom } from '../lib/roomHistory'
import { gameRoute, getGameColor, getGameMeta, gameName } from '../lib/gameCatalog'
import type { Player, Room } from '../lib/types'
import { isHalloweenSlug } from '../halloween/slugs'
import { AppShell, GiftSvg, Snowman, LoadingScreen, MIST, Panel, RoomCode, TutorialOverlay, withAlpha } from '../components/ui'
import { PlayerRoster } from '../games/ui'
import { haptic } from '../games/utils'
import { assignAvatars, ChristmasAvatar, type AvatarInfo } from '../natal/avatars'

/** Recadinho da espera (um por pessoa, sempre o mesmo: sai do id do jogador). */
const WAITING_TIPS = [
  'Enquanto isso, ajeite o gorro. 🎅',
  'Quem chegar por último lava a louça da ceia. 🍽️',
  'Proibido espiar o celular do vizinho. O Noel está vendo. 👀',
  'Aproveite para tirar a uva-passa do arroz. 🍚',
  'Pegue um panetone. Ou dois. Ninguém está contando. 🍞',
  'Calma: amigo-secreto não é aqui. 🎁',
]

export default function PlayerController() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuth()
  useRequireAuth()

  const [isReady, setIsReady] = useState(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(true)
  const [togglingReady, setTogglingReady] = useState(false)

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
        setJoinError('')
      } catch (err) {
        if (!active) return
        setJoinError(friendlyError(err, 'Não foi possível entrar na sala.'))
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
        setError(friendlyError(err, 'Não foi possível atualizar a sala.'))
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

  // Jogos novos: quem chega pelo QR já entra pronto — com 15 pessoas,
  // alguém sempre esquece de apertar o botão e trava o começo. Uma vez por
  // entrada; quem desmarcar continua desmarcado.
  const autoReadyAsked = useRef(false)
  useEffect(() => {
    if (!code || !player || autoReadyAsked.current) return
    if (!room || room.status !== 'lobby' || !isHalloweenSlug(room.game?.slug)) return
    autoReadyAsked.current = true
    if (player.ready) return
    setReady(code, true)
      .then((result) => setIsReady(result.ready))
      .catch(() => {
        autoReadyAsked.current = false
      })
  }, [code, player, room])

  async function handleReadyToggle() {
    if (!code || togglingReady) return
    setTogglingReady(true)
    haptic()
    try {
      const result = await setReady(code, !isReady)
      setIsReady(result.ready)
      setError('')
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível atualizar seu status.'))
    } finally {
      setTogglingReady(false)
    }
  }

  const players = useMemo(() => room?.players ?? [], [room?.players])
  const readyCount = players.filter((item) => item.ready).length

  if (isLoading || !isAuthenticated || joining) return <LoadingScreen label="ENTRANDO NA SALA" />

  const roomCode = (code ?? '').toUpperCase()

  // Não deu para sentar na mesa (código errado, sala apagada): diz o motivo e
  // dá a saída, em vez de uma tela de lobby vazia.
  if (joinError && !player) {
    return (
      <AppShell title="SALA NÃO ENCONTRADA" accent="var(--accent-red)" backdropTint={MIST.blood} maxWidth={560} center>
        <Panel accent="var(--accent-red)" highlight>
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box sx={{ fontSize: '3.4rem', lineHeight: 1, mb: 1 }}>🎁</Box>
            <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>
              {joinError}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem', mt: 0.75, mb: 2.5 }}>
              Sala {roomCode}. Confira o código na TV e tente de novo.
            </Typography>
            <Button fullWidth variant="contained" color="primary" size="large" onClick={() => navigate('/lobby')}>
              Digitar outro código
            </Button>
          </Box>
        </Panel>
      </AppShell>
    )
  }

  const game = room?.game
  const accent = game ? getGameColor(game.slug) : 'var(--pumpkin)'
  const meta = game ? getGameMeta(game.slug) : null
  const isLive = room?.status === 'live'
  const tutorial = (room?.state?.tutorial ?? null) as { active: boolean; step: number } | null
  const statusColor = isReady ? 'var(--status-ready)' : 'var(--status-waiting)'
  // Seu avatar de Natal sai da mesa inteira (igual à TV); só aparece quando
  // a mesa chegou, para não trocar de bichinho na frente da pessoa.
  const myAvatar = player ? assignAvatars(players).get(player.id) : undefined

  return (
    <AppShell
      title={user?.nickname || 'Jogador'}
      subtitle={game ? `Mesa de ${meta?.icon ?? ''} ${gameName(game)}` : 'Esperando o host escolher o jogo'}
      accent={accent}
      backdropTint={withAlpha(accent, 0.14)}
      maxWidth={640}
      error={error}
      headerRight={<RoomCode code={roomCode} size="sm" accent={accent} label="SALA" />}
    >
      {myAvatar && <YouAre avatar={myAvatar} name={player?.name || user?.nickname || 'Você'} />}

      {/* Status grande — é o que a pessoa checa de relance */}
      <Panel accent={statusColor} highlight snow>
        <Box sx={{ textAlign: 'center', py: 1, position: 'relative' }}>
          <Box
            sx={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 104,
              height: 104,
              borderRadius: '50%',
              mb: 1.5,
              border: `2px solid ${statusColor}`,
              background: isReady ? 'rgba(79, 214, 126, 0.1)' : 'rgba(245, 194, 66, 0.08)',
              '--pulse-color': isReady ? 'rgba(79, 214, 126, 0.4)' : 'rgba(245, 194, 66, 0.35)',
              animation: 'pulseGlow 2.6s ease-in-out infinite',
            }}
          >
            {isReady ? (
              <Box aria-hidden className="animate-hop" sx={{ lineHeight: 0 }}>
                <GiftSvg box="#e8394a" ribbon="#f5c242" size={60} />
              </Box>
            ) : (
              <Snowman size={58} glow="var(--status-waiting)" />
            )}
          </Box>

          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: { xs: '1.9rem', sm: '2.2rem' },
              lineHeight: 1.1,
              letterSpacing: '0.05em',
              color: statusColor,
            }}
          >
            {isReady ? 'VOCÊ ESTÁ PRONTO' : 'MARQUE QUE ESTÁ PRONTO'}
          </Typography>

          <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', mt: 0.5, mb: 2.5 }}>
            {isLive
              ? 'A partida já começou.'
              : isReady
                ? `Agora é com o host. ${readyCount} de ${players.length} na mesa estão prontos.`
                : `${readyCount} de ${players.length} na mesa já confirmaram.`}
          </Typography>
          {!isLive && player && (
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', mt: -1.5, mb: 2.5 }}>
              {WAITING_TIPS[player.id % WAITING_TIPS.length]}
            </Typography>
          )}

          <Button
            fullWidth
            variant={isReady ? 'outlined' : 'contained'}
            color={isReady ? 'success' : 'warning'}
            size="large"
            onClick={handleReadyToggle}
            disabled={!player || togglingReady}
            sx={{ py: 2, fontSize: '1.12rem' }}
          >
            {isReady ? 'Desmarcar' : 'Estou pronto'}
          </Button>

          {isLive && (
            <Button
              fullWidth
              variant="contained"
              color="primary"
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
          <Typography sx={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, mb: 2 }}>
            {meta.pitch}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {meta.howTo.map((step, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-numeric)',
                    fontSize: '0.95rem',
                    color: accent,
                    border: `1px solid ${withAlpha(accent, 0.4)}`,
                    background: withAlpha(accent, 0.08),
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', pt: 0.15 }}>
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
          emptyLabel="Você chegou primeiro! Pode pegar o lugar mais perto do panetone."
          describe={(item) => ({
            ready: item.ready,
            highlight: item.ready,
            status:
              item.online === false ? 'Sumiu ❄️ (offline)' : item.ready ? 'Pronto' : 'Ainda não confirmou',
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
          title={gameName(game)}
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

/** "Esse é você na TV": o seu avatar grande, para achar a si mesmo na mesa. */
function YouAre({ avatar, name }: { avatar: AvatarInfo; name: string }) {
  return (
    <Box
      className="animate-pop-in"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 2.5,
        p: 1.5,
        pr: 2,
        borderRadius: 'var(--radius-lg, 20px)',
        border: `2px solid ${withAlpha(avatar.color, 0.55)}`,
        background: `linear-gradient(100deg, ${withAlpha(avatar.color, 0.22)}, rgba(6, 16, 31, 0.6) 70%)`,
        boxShadow: `0 0 26px ${withAlpha(avatar.color, 0.25)}`,
      }}
    >
      <Box sx={{ flexShrink: 0, borderRadius: '50%', boxShadow: `0 0 0 4px ${withAlpha(avatar.color, 0.35)}, 0 10px 24px rgba(0,0,0,0.45)` }}>
        <ChristmasAvatar avatar={avatar} size={104} animated title={`Seu avatar: ${avatar.label}`} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.72rem', letterSpacing: '0.18em', fontWeight: 800, color: 'var(--text-muted)' }}>
          ESSE É VOCÊ NA TV
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: '1.7rem', sm: '2rem' },
            lineHeight: 1.05,
            letterSpacing: '0.03em',
            color: avatar.color,
            textShadow: `0 0 16px ${withAlpha(avatar.color, 0.45)}`,
          }}
        >
          {avatar.article === 'a' ? 'A' : 'O'} {avatar.label}
        </Typography>
        <Typography noWrap sx={{ color: 'var(--text-secondary)', fontSize: '0.92rem', fontWeight: 700, mt: 0.25 }}>
          {name}
        </Typography>
      </Box>
    </Box>
  )
}
