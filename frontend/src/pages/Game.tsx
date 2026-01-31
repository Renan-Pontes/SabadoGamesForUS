import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { getRoom } from '../lib/api'
import type { Room } from '../lib/types'

const GAME_ROUTES: Record<string, string> = {
  'read-my-mind': 'read-my-mind',
  'confinamento-solitario': 'confinamento-solitario',
  'concurso-de-beleza': 'concurso-de-beleza',
  'future-sugoroku': 'future-sugoroku',
  'leilao-de-cem-votos': 'leilao-de-cem-votos',
  'blef-jack': 'blef-jack',
}

export default function Game() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const viewParam = searchParams.get('view')
  const view =
    viewParam === 'host' || viewParam === 'tv' || viewParam === 'player'
      ? viewParam
      : 'player'

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true
    async function redirectIfKnown() {
      try {
        const room: Room = await getRoom(roomCode)
        if (!active) return
        const slug = room.game?.slug
        if (!slug) return
        const route = GAME_ROUTES[slug]
        if (route) {
          navigate(`/game/${roomCode}/${route}?view=${view}`, { replace: true })
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      }
    }
    redirectIfKnown()
    return () => {
      active = false
    }
  }, [code, navigate, view])


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
