import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogContent,
  IconButton,
  Alert,
  InputAdornment,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import TvRoundedIcon from '@mui/icons-material/TvRounded'
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded'
import VisibilityRounded from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded'
import { useAuth } from '../context/useAuth'
import { Brand, LoadingScreen, Panel } from '../components/ui'
import { pageBackdrop } from '../components/ui/surfaces'

/** Naipes soltos ao fundo, com posições fixas para não brigarem com o conteúdo. */
const FLOATING_SUITS = [
  { symbol: '♠', top: '12%', left: '6%', size: '7rem', color: 'rgba(245,245,245,0.05)', delay: '0s' },
  { symbol: '♥', top: '22%', right: '9%', size: '9rem', color: 'rgba(220,38,38,0.07)', delay: '-3s' },
  { symbol: '♦', bottom: '18%', left: '13%', size: '6rem', color: 'rgba(251,191,36,0.07)', delay: '-6s' },
  { symbol: '♣', bottom: '10%', right: '16%', size: '8rem', color: 'rgba(34,211,238,0.06)', delay: '-9s' },
  { symbol: '♥', top: '58%', left: '3%', size: '5rem', color: 'rgba(239,68,68,0.05)', delay: '-4.5s' },
  { symbol: '♠', top: '6%', right: '32%', size: '4.5rem', color: 'rgba(245,245,245,0.04)', delay: '-7.5s' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, login, register, isLoading } = useAuth()

  const [mode, setMode] = useState<'login' | 'register' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tvCode, setTvCode] = useState('')

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/lobby')
    }
  }, [isAuthenticated, isLoading, navigate])

  // Trocar entre entrar e criar conta limpa o erro, não os dados já digitados.
  useEffect(() => {
    setFormError('')
  }, [mode])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      if (mode === 'register') {
        await register(email, password, nickname)
      } else {
        await login(email, password)
      }
      setMode(null)
      navigate('/lobby')
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : mode === 'register'
            ? 'Não foi possível criar a conta.'
            : 'Não foi possível entrar.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleTvConnect() {
    const code = tvCode.trim().toUpperCase()
    if (code) navigate(`/tv/${code}`)
  }

  if (isLoading) return <LoadingScreen label="ABRINDO A MESA" />

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: pageBackdrop('rgba(220, 38, 38, 0.16)', 'rgba(212, 165, 32, 0.12)'),
      }}
    >
      {/* Naipes de fundo */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {FLOATING_SUITS.map((suit, index) => (
          <Box
            key={index}
            component="span"
            sx={{
              position: 'absolute',
              top: suit.top,
              left: suit.left,
              right: suit.right,
              bottom: suit.bottom,
              fontFamily: 'var(--font-display)',
              fontSize: suit.size,
              lineHeight: 1,
              color: suit.color,
              animation: 'float 9s ease-in-out infinite',
              animationDelay: suit.delay,
            }}
          >
            {suit.symbol}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, md: 4 },
          py: 6,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ mb: { xs: 5, md: 7 } }}>
          <Brand size="hero" animated tagline="Party games para noites em que a amizade é opcional." />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2.5,
            maxWidth: 760,
            width: '100%',
          }}
        >
          {/* Jogar */}
          <Panel accent="var(--accent-red)" highlight index={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <SportsEsportsRoundedIcon sx={{ fontSize: 30, color: 'var(--accent-red)' }} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-red)',
                }}
              >
                JOGAR
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', mb: 3, fontSize: '0.92rem' }}>
              Entre para criar uma sala ou sentar numa mesa que já existe.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => setMode('login')}
                sx={{ py: 1.6 }}
              >
                Entrar
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() => setMode('register')}
              >
                Criar conta
              </Button>
            </Box>
          </Panel>

          {/* TV */}
          <Panel accent="var(--neon-cyan)" index={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <TvRoundedIcon sx={{ fontSize: 30, color: 'var(--neon-cyan)' }} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem',
                  letterSpacing: '0.06em',
                  color: 'var(--neon-cyan)',
                }}
              >
                CONECTAR TV
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-secondary)', mb: 3, fontSize: '0.92rem' }}>
              Abra esta tela na TV da sala. Não precisa de conta.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <TextField
                fullWidth
                placeholder="CÓDIGO"
                value={tvCode}
                onChange={(event) => setTvCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === 'Enter' && handleTvConnect()}
                slotProps={{
                  htmlInput: {
                    maxLength: 6,
                    style: { textAlign: 'center', fontSize: '1.3rem', letterSpacing: '0.2em' },
                    inputMode: 'numeric',
                    'aria-label': 'Código da sala',
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleTvConnect}
                disabled={!tvCode.trim()}
                sx={{
                  minWidth: 88,
                  bgcolor: 'var(--neon-cyan)',
                  backgroundImage: 'none',
                  color: 'var(--bg-void)',
                  boxShadow: '0 6px 20px rgba(34, 211, 238, 0.3)',
                  '&:hover': { bgcolor: '#06b6d4', backgroundImage: 'none' },
                }}
              >
                Ir
              </Button>
            </Box>
          </Panel>
        </Box>
      </Box>

      <Box
        sx={{
          textAlign: 'center',
          py: 3,
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Sabado Games · inspirado em Alice in Borderland &amp; Kakegurui
      </Box>

      {/* Um formulário só para entrar e criar conta */}
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 'var(--radius-xl)',
              border: `1px solid ${mode === 'register' ? 'var(--accent-gold)' : 'var(--accent-red)'}`,
            },
          },
        }}
      >
        <DialogContent sx={{ p: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.9rem',
                letterSpacing: '0.06em',
                color: mode === 'register' ? 'var(--accent-gold)' : 'var(--accent-red)',
              }}
            >
              {mode === 'register' ? 'CRIAR CONTA' : 'ENTRAR'}
            </Typography>
            <IconButton onClick={() => setMode(null)} size="small" aria-label="Fechar">
              <CloseRoundedIcon />
            </IconButton>
          </Box>

          <form onSubmit={handleSubmit}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}

            {mode === 'register' && (
              <TextField
                fullWidth
                label="Apelido"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                sx={{ mb: 2 }}
                required
                autoFocus
                helperText="É assim que você aparece na mesa"
              />
            )}

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              sx={{ mb: 2 }}
              required
              autoFocus={mode === 'login'}
              autoComplete="email"
            />

            <TextField
              fullWidth
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((current) => !current)}
                        edge="end"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              fullWidth
              variant="contained"
              color={mode === 'register' ? 'secondary' : 'primary'}
              type="submit"
              disabled={submitting}
              sx={{ mt: 3, py: 1.6 }}
            >
              {submitting
                ? mode === 'register'
                  ? 'Criando...'
                  : 'Entrando...'
                : mode === 'register'
                  ? 'Criar conta'
                  : 'Entrar'}
            </Button>
          </form>

          <Typography sx={{ mt: 2.5, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {mode === 'register' ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <Box
              component="button"
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              sx={{
                background: 'none',
                border: 'none',
                p: 0,
                font: 'inherit',
                cursor: 'pointer',
                color: mode === 'register' ? 'var(--accent-red)' : 'var(--accent-gold)',
                textDecoration: 'underline',
              }}
            >
              {mode === 'register' ? 'Entrar' : 'Criar agora'}
            </Box>
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
