import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'
import { friendlyError, getRoom, tvPing } from '../lib/api'
import { gameRoute, getGameColor, getGameMeta } from '../lib/gameCatalog'
import type { Room } from '../lib/types'
import { useMusic } from '../halloween/audio'
import { useWakeLock } from '../halloween/framework/wakeLock'
import {
  Brand,
  LoadingScreen,
  MIST,
  Panel,
  RoomCode,
  SeatGrid,
  TutorialOverlay,
  pageBackdrop,
  withAlpha,
} from '../components/ui'

const TV_DEVICE_KEY = 'sabado_tv_device'

/** Identidade estável desta TV, para o backend saber que ela está viva. */
function readDeviceId() {
  try {
    const stored = window.localStorage.getItem(TV_DEVICE_KEY)
    if (stored) return stored
    const generated = `tv-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(TV_DEVICE_KEY, generated)
    return generated
  } catch {
    return `tv-${Math.random().toString(36).slice(2, 8)}`
  }
}

/**
 * O lobby na TV da sala. Tudo é medido pela altura da tela também (vh): TV
 * de navegador costuma ter viewport baixinho (960×540, 1280×720), e ninguém
 * rola a página de uma TV.
 *
 * Ordem de leitura de longe: QR + código (como entrar), regras do jogo
 * escolhido (o que vai acontecer) e a mesa se enchendo (quem já chegou).
 */
export default function TvDisplay() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deviceId] = useState(readDeviceId)

  // Trilha do lobby: a camada de som decide quando pode tocar (a TV precisa
  // de um clique para destravar o áudio — o aviso é dela).
  useMusic('lobby')
  // A TV fica no lobby entre um jogo e outro: notebook ligado nela não pode
  // entrar no descanso de tela.
  useWakeLock(true)

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
        setError(friendlyError(err, 'Não foi possível carregar a sala.'))
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

  const roomCode = (code ?? '').toUpperCase()
  const joinUrl = useMemo(() => `${window.location.origin}/play/${roomCode}`, [roomCode])

  if (loading) return <LoadingScreen label="CONECTANDO À SALA" accent="var(--neon-cyan)" />

  const players = room?.players ?? []
  const game = room?.game
  const accent = game ? getGameColor(game.slug) : 'var(--pumpkin)'
  const meta = game ? getGameMeta(game.slug) : null
  const readyCount = players.filter((player) => player.ready).length
  const everyoneReady = players.length > 0 && readyCount === players.length
  const tutorial = (room?.state?.tutorial ?? null) as { active: boolean; step: number } | null
  // Sempre uma cadeira vazia a mais (até o máximo do jogo): convida quem falta.
  const capacity = game
    ? Math.min(game.max_players, Math.max(game.min_players, players.length + 1))
    : players.length
  const rulesLength = meta ? meta.pitch.length + meta.howTo.join(' ').length : 0
  // Regras longas (jogos antigos) encolhem para caber sem rolar.
  const stepSize = rulesLength > 420 ? 'clamp(0.95rem, 2vh, 1.4rem)' : 'clamp(1.05rem, 2.45vh, 1.75rem)'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(8px, 1.8vh, 26px)',
        background: pageBackdrop(withAlpha(accent, 0.14), MIST.pumpkin),
        px: 'clamp(16px, 3vw, 64px)',
        py: 'clamp(10px, 2vh, 32px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cabeçalho: marca à esquerda, jogo à direita */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 3,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Marca menor em TV baixinha: o espaço é do QR e da mesa */}
        <Box sx={{ pl: { md: 4 }, display: 'none', '@media (min-height: 860px)': { display: 'block' } }}>
          <Brand size="md" />
        </Box>
        <Box sx={{ pl: { md: 4 }, '@media (min-height: 860px)': { display: 'none' } }}>
          <Brand size="sm" />
        </Box>
        {game && (
          <Box sx={{ textAlign: 'right', pr: { md: 6 }, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 'clamp(0.7rem, 1.5vh, 1rem)',
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
                fontSize: 'clamp(1.5rem, 5vh, 3.6rem)',
                lineHeight: 1.05,
                letterSpacing: '0.04em',
                color: accent,
                filter: `drop-shadow(0 0 18px ${withAlpha(accent, 0.45)})`,
              }}
            >
              {meta?.icon} {game.name}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Miolo: como entrar + como jogar */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
          // TV baixinha (960×540): as regras viram só o resumo, então o QR e o
          // código ganham mais largura para ficarem lado a lado.
          '@media (min-width: 900px) and (max-height: 620px)': {
            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
          },
          gap: 'clamp(16px, 3vw, 56px)',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(16px, 2.6vw, 48px)',
            flexWrap: 'wrap',
          }}
        >
          {/* QR: escaneou, digitou o apelido, está na sala */}
          <Box sx={{ textAlign: 'center' }}>
            <Box
              className="animate-pop-in"
              sx={{
                width: 'clamp(150px, min(31vh, 26vw), 380px)',
                aspectRatio: '1 / 1',
                p: 'clamp(6px, 1.1vh, 14px)',
                borderRadius: 'var(--radius-xl)',
                background: '#fff7ed',
                border: '4px solid var(--pumpkin)',
                boxShadow: '0 0 0 6px rgba(20, 11, 34, 0.9), 0 0 60px rgba(255, 123, 28, 0.45)',
                mx: 'auto',
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={512}
                level="M"
                marginSize={1}
                fgColor="#140b22"
                bgColor="#fff7ed"
                title={`Entrar na sala ${roomCode}`}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </Box>
            <Typography
              sx={{
                mt: 'clamp(6px, 1.4vh, 18px)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.1rem, 2.8vh, 2.3rem)',
                '@media (max-height: 620px)': { fontSize: '0.9rem' },
                lineHeight: 1,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                color: 'var(--pumpkin)',
                textShadow: '0 0 20px rgba(255, 123, 28, 0.5)',
              }}
            >
              📱 ESCANEIE PARA ENTRAR
            </Typography>
          </Box>

          {/* Código gigante, para quem prefere digitar */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                color: 'var(--text-secondary)',
                fontSize: 'clamp(0.95rem, 2.4vh, 1.7rem)',
                mb: 'clamp(6px, 1.2vh, 16px)',
              }}
            >
              ou entre em{' '}
              <Box component="span" sx={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {window.location.host}
              </Box>
            </Typography>
            <Box
              sx={{
                '--pulse-color': withAlpha(accent, 0.33),
                animation: 'pulseGlow 3.5s ease-in-out infinite',
                borderRadius: 'var(--radius-xl)',
                display: 'inline-block',
              }}
            >
              <RoomCode code={roomCode} size="hero" accent="var(--pumpkin)" label="CÓDIGO DA SALA" />
            </Box>

            <Typography
              sx={{
                mt: 'clamp(8px, 1.8vh, 24px)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(0.75rem, 1.7vh, 1.15rem)',
                letterSpacing: '0.18em',
                color: room?.status === 'ended' ? 'var(--accent-red-light)' : everyoneReady ? 'var(--status-ready)' : 'var(--text-muted)',
                animation: everyoneReady ? 'none' : 'pulse 2.4s ease-in-out infinite',
              }}
            >
              {room?.status === 'ended'
                ? 'PARTIDA ENCERRADA'
                : everyoneReady
                  ? 'TODOS PRONTOS — O HOST JÁ PODE COMEÇAR'
                  : 'ESPERANDO A GALERA CHEGAR...'}
            </Typography>

            {error && (
              <Typography sx={{ mt: 1.5, color: 'var(--accent-red-light)', fontSize: 'clamp(0.9rem, 2vh, 1.3rem)' }}>
                {error}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Regras do jogo escolhido, para quem chegou agora */}
        {meta && game && (
          <Panel accent={accent} highlight sx={{ p: 'clamp(12px, 2.2vh, 30px)' }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.4rem, 4vh, 3rem)',
                lineHeight: 1,
                letterSpacing: '0.05em',
                color: accent,
                mb: 'clamp(4px, 0.8vh, 10px)',
              }}
            >
              COMO JOGAR
            </Typography>
            <Typography
              sx={{
                color: 'var(--text-primary)',
                fontSize: 'clamp(1.05rem, 2.5vh, 1.9rem)',
                lineHeight: 1.22,
                fontWeight: 600,
                mb: 'clamp(6px, 1.5vh, 20px)',
              }}
            >
              {meta.pitch}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(5px, 1vh, 14px)',
                '@media (max-height: 620px)': { display: 'none' },
              }}
            >
              {meta.howTo.map((step, index) => (
                <Box
                  key={index}
                  className="stagger-in"
                  style={{ '--stagger-index': index } as React.CSSProperties}
                  sx={{ display: 'flex', gap: 'clamp(8px, 1.2vw, 18px)', alignItems: 'flex-start' }}
                >
                  <Box
                    sx={{
                      width: 'clamp(26px, 4vh, 44px)',
                      height: 'clamp(26px, 4vh, 44px)',
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-numeric)',
                      fontSize: 'clamp(1rem, 2.6vh, 1.7rem)',
                      color: '#0a0612',
                      background: accent,
                      boxShadow: `0 0 16px ${withAlpha(accent, 0.45)}`,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography sx={{ color: 'var(--text-secondary)', fontSize: stepSize, lineHeight: 1.25, pt: '0.1em' }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography
              sx={{
                mt: 'clamp(6px, 1.4vh, 18px)',
                color: 'var(--text-muted)',
                fontSize: 'clamp(0.8rem, 1.7vh, 1.15rem)',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              {meta.duration} · {game.min_players}–{game.max_players} pessoas · {meta.vibe}
            </Typography>
          </Panel>
        )}
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
          narrate
          big
        />
      )}

      {/* Rodapé: a mesa se enchendo */}
      <Box
        sx={{
          pt: 'clamp(6px, 1.4vh, 20px)',
          borderTop: '1px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Typography
          sx={{
            textAlign: 'center',
            fontSize: 'clamp(0.75rem, 1.8vh, 1.2rem)',
            letterSpacing: '0.22em',
            fontWeight: 800,
            color: 'var(--text-muted)',
            mb: 'clamp(6px, 1.3vh, 16px)',
          }}
        >
          NA MESA ·{' '}
          <Box component="span" sx={{ color: 'var(--text-primary)' }}>
            {players.length}
          </Box>{' '}
          {players.length === 1 ? 'ALMA' : 'ALMAS'} · {readyCount} {readyCount === 1 ? 'PRONTA' : 'PRONTAS'}
        </Typography>
        <SeatGrid players={players} capacity={capacity} variant="tv" />
      </Box>
    </Box>
  )
}
