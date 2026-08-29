import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { getRoom, tvPing } from '../lib/api'
import { gameRoute, getGameColor, getGameMeta } from '../lib/gameCatalog'
import type { Room } from '../lib/types'
import { Brand, LoadingScreen, Panel, RoomCode, SeatGrid } from '../components/ui'
import { pageBackdrop } from '../components/ui/surfaces'

const TV_DEVICE_KEY = 'sabado_tv_device'

export default function TvDisplay() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Identidade estável desta TV, para o backend saber que ela está viva.
  const deviceId = useMemo(() => {
    const stored = window.localStorage.getItem(TV_DEVICE_KEY)
    if (stored) return stored
    const generated = `tv-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(TV_DEVICE_KEY, generated)
    return generated
  }, [])

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true

    async function poll() {
      if (document.hidden) return
      try {
        await tvPing(roomCode, { device_id: deviceId })
        const data = await getRoom(roomCode)
        if (!active) return
        setRoom(data)
        setError('')
        if (data.status === 'live') {
          navigate(gameRoute(roomCode, 'tv'))
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a sala.')
      } finally {
        if (active) setLoading(false)
      }
    }

    poll()
    const interval = window.setInterval(poll, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code, deviceId, navigate])

  if (loading) return <LoadingScreen label="CONECTANDO À SALA" accent="var(--neon-cyan)" />

  const players = room?.players ?? []
  const game = room?.game
  const accent = game ? getGameColor(game.slug) : 'var(--neon-cyan)'
  const meta = game ? getGameMeta(game.slug) : null
  const readyCount = players.filter((player) => player.ready).length
  const everyoneReady = players.length > 0 && readyCount === players.length

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: pageBackdrop(`${accent}22`, 'rgba(34, 211, 238, 0.10)'),
        px: { xs: 3, md: 6 },
        py: { xs: 3, md: 5 },
      }}
    >
      {/* Cabeçalho: marca à esquerda, jogo à direita */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 3,
          mb: { xs: 3, md: 5 },
        }}
      >
        <Brand size="sm" />
        {game && (
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              sx={{
                fontSize: '0.62rem',
                letterSpacing: '0.24em',
                fontWeight: 800,
                color: 'var(--text-muted)',
              }}
            >
              JOGO DA NOITE
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.4rem', md: '2rem' },
                lineHeight: 1.1,
                letterSpacing: '0.05em',
                color: accent,
              }}
            >
              {meta?.icon} {game.name}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Miolo: código gigante + como jogar */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: { xs: 4, md: 6 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              color: 'var(--text-secondary)',
              fontSize: { xs: '1rem', md: '1.35rem' },
              mb: 2.5,
            }}
          >
            Entre em{' '}
            <Box component="span" sx={{ color: accent, fontWeight: 700 }}>
              sabadogames
            </Box>{' '}
            e digite o código
          </Typography>

          <Box
            className="animate-pop-in"
            sx={{ '--pulse-color': `${accent}55`, animation: 'pulseGlow 3.5s ease-in-out infinite', borderRadius: 'var(--radius-xl)', display: 'inline-block' }}
          >
            <RoomCode code={code ?? ''} size="hero" accent={accent} label="CÓDIGO DA SALA" />
          </Box>

          <Typography
            sx={{
              mt: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              letterSpacing: '0.2em',
              color: everyoneReady ? 'var(--status-ready)' : 'var(--text-muted)',
              animation: everyoneReady ? 'none' : 'pulse 2.4s ease-in-out infinite',
            }}
          >
            {room?.status === 'ended'
              ? 'PARTIDA ENCERRADA'
              : everyoneReady
                ? 'TODOS PRONTOS — AGUARDANDO O HOST'
                : 'AGUARDANDO JOGADORES'}
          </Typography>

          {error && (
            <Typography sx={{ mt: 2, color: 'var(--accent-red-light)' }}>{error}</Typography>
          )}
        </Box>

        {/* Regras do jogo escolhido, para quem chegou agora */}
        {meta && game && (
          <Panel title="COMO JOGAR" hint={`${meta.duration} · ${meta.vibe}`} accent={accent} highlight>
            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1.05rem', mb: 2.5 }}>
              {meta.pitch}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {meta.howTo.map((step, index) => (
                <Box
                  key={index}
                  className="stagger-in"
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.95rem',
                      color: accent,
                      border: `1px solid ${accent}66`,
                      background: `${accent}14`,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: '1rem', pt: 0.35 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Panel>
        )}
      </Box>

      {/* Rodapé: a mesa se enchendo */}
      <Box sx={{ mt: { xs: 4, md: 6 }, pt: 3, borderTop: '1px solid var(--border-subtle)' }}>
        <Typography
          sx={{
            textAlign: 'center',
            fontSize: '0.65rem',
            letterSpacing: '0.24em',
            fontWeight: 800,
            color: 'var(--text-muted)',
            mb: 2.5,
          }}
        >
          NA MESA · {readyCount}/{players.length} PRONTOS
        </Typography>
        <SeatGrid players={players} capacity={game?.min_players} variant="tv" />
      </Box>
    </Box>
  )
}
