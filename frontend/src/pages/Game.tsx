import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '../context/useAuth'
import { getRoom } from '../lib/api'
import type { Room } from '../lib/types'
import BelezaGame from './games/BelezaGame'
import BlefJackGame from './games/BlefJackGame'
import ConfinamentoGame from './games/ConfinamentoGame'
import LeilaoGame from './games/LeilaoGame'
import SugorokuGame from './games/SugorokuGame'

type ViewMode = 'tv' | 'host' | 'player'

export default function Game() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const [error, setError] = useState('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [gameSlug, setGameSlug] = useState<string | null>(null)

  const viewMode = (searchParams.get('view') as ViewMode) || 'player'

  useEffect(() => {
    if (!isLoading && !isAuthenticated && viewMode !== 'tv') {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, viewMode, navigate])

  useEffect(() => {
    if (!code) return
    let active = true
    async function redirectIfKnown() {
      try {
        const room: Room = await getRoom(code)
        if (!active) return
        if (room.game?.slug === 'read-my-mind') {
          const viewParam = viewMode ? `?view=${viewMode}` : ''
          navigate(`/game/${code}/read-my-mind${viewParam}`, { replace: true })
          return
        }
        setGameSlug(room.game?.slug ?? null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      } finally {
        if (active) {
          setLoadingRoom(false)
        }
      }
    }
    redirectIfKnown()
    return () => {
      active = false
    }
  }, [code, navigate, viewMode])

  if (isLoading || loadingRoom) {
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
        <CircularProgress sx={{ color: 'var(--accent-gold)' }} />
      </Box>
    )
  }

  if (gameSlug === 'confinamento-solitario') {
    return <ConfinamentoGame />
  }

  if (gameSlug === 'concurso-de-beleza') {
    return <BelezaGame />
  }

  if (gameSlug === 'future-sugoroku') {
    return <SugorokuGame />
  }

  if (gameSlug === 'leilao-de-cem-votos') {
    return <LeilaoGame />
  }

  if (gameSlug === 'blef-jack') {
    return <BlefJackGame />
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(ellipse at center, rgba(220, 38, 38, 0.2) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: '4rem',
          mb: 2,
        }}
      >
        🎮
      </Typography>
      <Typography variant="h3" sx={{ color: 'var(--accent-red)', mb: 2 }}>
        JOGO EM ANDAMENTO
      </Typography>
      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>
        Sala: {code?.toUpperCase()}
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', mb: 4, maxWidth: 400 }}>
        Aqui será renderizado o minigame selecionado.
        A tela varia de acordo com o dispositivo (TV, Host ou Player).
      </Typography>
      {error && (
        <Typography sx={{ color: 'var(--accent-red)', mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box
        sx={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '2px solid var(--border-subtle)',
          p: 4,
          mb: 4,
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          ⏱️ 00:45
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)' }}>
          Tempo restante da rodada
        </Typography>
      </Box>

      <Button
        variant="outlined"
        color="error"
        onClick={() => navigate('/lobby')}
        sx={{ borderWidth: 2 }}
      >
        Voltar ao Lobby
      </Button>
    </Box>
  )
}
