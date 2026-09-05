import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { getRoom } from '../lib/api'
import type { Room } from '../lib/types'

/**
 * Slugs que já têm tela própria. Ao adicionar um minigame novo, registre-o
 * aqui e em `App.tsx` — o resto do roteamento é automático.
 */
const GAME_ROUTES: Record<string, string> = {
  'read-my-mind': 'read-my-mind',
  'confinamento-solitario': 'confinamento-solitario',
  'concurso-de-beleza': 'concurso-de-beleza',
  'future-sugoroku': 'future-sugoroku',
  'leilao-de-cem-votos': 'leilao-de-cem-votos',
  'blef-jack': 'blef-jack',
  'a-cacada': 'a-cacada',
  sintonia: 'sintonia',
  caveira: 'caveira',
  resistencia: 'resistencia',
  'palavra-chave': 'palavra-chave',
  'o-infiltrado': 'o-infiltrado',
  perfil: 'perfil',
  camaleao: 'camaleao',
  lobisomem: 'lobisomem',
}

/**
 * Ponte entre `/game/:code` e a tela do minigame da sala. Só existe para
 * descobrir qual jogo está rodando e redirecionar — não é uma tela de jogo.
 */
export default function Game() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [unknownGame, setUnknownGame] = useState<string | null>(null)

  const viewParam = searchParams.get('view')
  const view =
    viewParam === 'host' || viewParam === 'tv' || viewParam === 'player' ? viewParam : 'player'

  useEffect(() => {
    if (!code) return
    const roomCode = code
    let active = true

    async function redirectToGame() {
      try {
        const room: Room = await getRoom(roomCode)
        if (!active) return
        const slug = room.game?.slug
        const route = slug ? GAME_ROUTES[slug] : undefined
        if (route) {
          navigate(`/game/${roomCode}/${route}?view=${view}`, { replace: true })
          return
        }
        setUnknownGame(room.game?.name ?? slug ?? 'desconhecido')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a sala.')
      }
    }

    redirectToGame()
    return () => {
      active = false
    }
  }, [code, navigate, view])

  const message = error
    ? error
    : unknownGame
      ? `O jogo "${unknownGame}" ainda não tem tela nesta versão.`
      : null

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: `
          radial-gradient(ellipse 110% 70% at 50% -10%, rgba(220, 38, 38, 0.18) 0%, transparent 55%),
          var(--bg-void)
        `,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box className="animate-pop-in">
        {!message && (
          <>
            <CircularProgress sx={{ color: 'var(--accent-gold)', mb: 3 }} />
            <Typography
              variant="h3"
              sx={{ color: 'var(--text-primary)', letterSpacing: '0.1em', mb: 1 }}
            >
              ENTRANDO NA MESA
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              SALA {code?.toUpperCase()}
            </Typography>
          </>
        )}

        {message && (
          <>
            <Typography sx={{ fontSize: '3.5rem', mb: 1 }}>🃏</Typography>
            <Typography variant="h4" sx={{ color: 'var(--accent-red)', mb: 1.5 }}>
              {error ? 'ALGO DEU ERRADO' : 'JOGO NÃO DISPONÍVEL'}
            </Typography>
            <Typography sx={{ color: 'var(--text-secondary)', mb: 4, maxWidth: 420 }}>
              {message}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              {code && (
                <Button variant="outlined" color="secondary" onClick={() => navigate(`/host/${code}`)}>
                  Voltar à sala
                </Button>
              )}
              <Button variant="outlined" color="inherit" onClick={() => navigate('/lobby')}>
                Ir ao lobby
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}
