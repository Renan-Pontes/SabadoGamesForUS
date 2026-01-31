import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Avatar, Chip } from '@mui/material'
import { getRoom, tvPing } from '../lib/api'
import type { Room } from '../lib/types'

export default function TvDisplay() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const deviceId = useMemo(() => {
    const key = 'sabado_tv_device'
    const stored = window.localStorage.getItem(key)
    if (stored) return stored
    const generated = `tv-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(key, generated)
    return generated
  }, [])

  useEffect(() => {
    if (!code) return
    let active = true

    async function poll() {
      try {
        await tvPing(code, { device_id: deviceId })
        const data = await getRoom(code)
        if (!active) return
        setRoom(data)
        if (data.status === 'live') {
          if (data.game?.slug === 'read-my-mind') {
            navigate(`/game/${code}/read-my-mind?view=tv`)
          } else {
            navigate(`/game/${code}?view=tv`)
          }
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    poll()
    const interval = window.setInterval(poll, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, deviceId, navigate])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(ellipse at center, rgba(34, 211, 238, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 4,
      }}
    >
      {/* Código da sala */}
      <Box
        sx={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '3px solid var(--neon-cyan)',
          p: 6,
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(34, 211, 238, 0.3)',
        }}
      >
        <Typography
          sx={{
            color: 'var(--text-muted)',
            fontSize: '1.2rem',
            mb: 2,
            letterSpacing: '0.2em',
          }}
        >
          CÓDIGO DA SALA
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontSize: { xs: '4rem', md: '6rem' },
            fontWeight: 700,
            color: 'var(--neon-cyan)',
            letterSpacing: '0.3em',
            textShadow: '0 0 30px rgba(34, 211, 238, 0.5)',
          }}
        >
          {code?.toUpperCase()}
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 3 }}>
          {room?.status === 'live'
            ? 'Partida em andamento'
            : room?.status === 'ended'
              ? 'Partida encerrada'
              : 'Aguardando jogadores entrarem...'}
        </Typography>
      </Box>

      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {room?.game ? room.game.name : '📺 Tela da TV'}
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', mb: 4 }}>
          {room?.game ? room.game.description : 'Aqui aparecerá o estado do jogo, placar e timer.'}
        </Typography>

        {error && (
          <Typography sx={{ color: 'var(--accent-red)', mb: 3 }}>{error}</Typography>
        )}

        {!loading && room?.players?.length ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 4,
            }}
          >
            {room.players.map((player) => (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: player.is_host ? 'var(--accent-red)' : 'var(--accent-gold)',
                  }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{player.name}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {player.ready ? 'Pronto' : 'Aguardando'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={player.ready ? 'READY' : 'LOBBY'}
                  sx={{
                    bgcolor: player.ready ? 'var(--status-ready)' : 'var(--status-waiting)',
                    color: '#000',
                    fontWeight: 600,
                  }}
                />
              </Box>
            ))}
          </Box>
        ) : (
          !loading && <Typography sx={{ color: 'var(--text-muted)', mb: 4 }}>Sem jogadores ainda.</Typography>
        )}
        <Button variant="outlined" onClick={() => navigate('/')}>Voltar ao Início</Button>
      </Box>
    </Box>
  )
}
