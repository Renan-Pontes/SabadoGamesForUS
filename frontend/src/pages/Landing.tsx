import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  InputAdornment,
} from '@mui/material'
import {
  Close as CloseIcon,
  Tv as TvIcon,
  SportsEsports as GameIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import anime from 'animejs'
import { useAuth } from '../context/useAuth'

// Símbolos de naipes para animação de fundo
const CARD_SYMBOLS = ['♠', '♥', '♦', '♣', '♤', '♡', '♢', '♧']

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, login, register, isLoading } = useAuth()
  
  // Estados dos modals
  const [loginOpen, setLoginOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  
  // Estados do formulário de login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  
  // Estados do formulário de registro
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerNickname, setRegisterNickname] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  
  // Estados dos códigos
  const [tvCode, setTvCode] = useState('')
  
  // Refs para animações
  const titleRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/lobby')
    }
  }, [isAuthenticated, isLoading, navigate])

  // Animações de entrada
  useEffect(() => {
    // Animação do título
    if (titleRef.current) {
      anime({
        targets: titleRef.current.querySelectorAll('.title-char'),
        opacity: [0, 1],
        translateY: [50, 0],
        delay: anime.stagger(50),
        easing: 'easeOutExpo',
        duration: 1000,
      })
    }

    // Animação das cartas flutuantes
    if (cardsRef.current) {
      anime({
        targets: cardsRef.current.querySelectorAll('.floating-card'),
        translateY: () => anime.random(-20, 20),
        rotate: () => anime.random(-15, 15),
        opacity: [0, 0.6],
        delay: anime.stagger(100, { from: 'center' }),
        duration: 2000,
        easing: 'easeOutElastic(1, .5)',
        complete: () => {
          // Loop de flutuação
          anime({
            targets: cardsRef.current?.querySelectorAll('.floating-card'),
            translateY: () => [anime.random(-10, 10), anime.random(-20, 20)],
            duration: () => anime.random(3000, 5000),
            easing: 'easeInOutSine',
            direction: 'alternate',
            loop: true,
          })
        },
      })
    }
  }, [])

  // Handlers
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    try {
      await login(loginEmail, loginPassword)
      setLoginOpen(false)
      navigate('/lobby')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegisterLoading(true)
    setRegisterError('')

    try {
      await register(registerEmail, registerPassword, registerNickname)
      setRegisterOpen(false)
      navigate('/lobby')
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setRegisterLoading(false)
    }
  }

  function handleTvConnect() {
    if (tvCode.trim()) {
      navigate(`/tv/${tvCode.toUpperCase()}`)
    }
  }

  // Renderizar título com animação por letra
  const renderTitle = (text: string) => {
    return text.split('').map((char, i) => (
      <span
        key={i}
        className="title-char"
        style={{
          display: 'inline-block',
          opacity: 0,
        }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ))
  }

  if (isLoading) {
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
        <Typography variant="h4" sx={{ color: 'var(--accent-gold)' }}>
          Carregando...
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: `
          radial-gradient(ellipse at top, rgba(220, 38, 38, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom, rgba(212, 165, 32, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
      }}
    >
      {/* Background de cartas flutuantes */}
      <Box
        ref={cardsRef}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {CARD_SYMBOLS.map((symbol, i) =>
          Array.from({ length: 4 }).map((_, j) => (
            <Box
              key={`${i}-${j}`}
              className="floating-card"
              sx={{
                position: 'absolute',
                fontSize: { xs: '3rem', md: '5rem' },
                color: symbol === '♥' || symbol === '♦' || symbol === '♡' || symbol === '♢'
                  ? 'var(--accent-red)'
                  : 'var(--text-muted)',
                opacity: 0,
                left: `${10 + (i * 10) + (j * 5)}%`,
                top: `${15 + (j * 20)}%`,
                filter: 'blur(1px)',
                textShadow: symbol === '♥' || symbol === '♦'
                  ? '0 0 20px var(--accent-red-glow)'
                  : 'none',
              }}
            >
              {symbol}
            </Box>
          ))
        )}
      </Box>

      {/* Conteúdo principal */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: 6,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo / Título */}
        <Box
          ref={titleRef}
          sx={{
            textAlign: 'center',
            mb: 6,
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '3rem', sm: '4rem', md: '6rem' },
              fontWeight: 400,
              background: 'linear-gradient(135deg, var(--accent-red) 0%, var(--accent-gold) 50%, var(--accent-red) 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 3s linear infinite',
              textShadow: '0 0 60px var(--accent-red-glow)',
              mb: 1,
            }}
          >
            {renderTitle('SABADO')}
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
              color: 'var(--text-primary)',
              letterSpacing: '0.3em',
            }}
          >
            {renderTitle('GAMES')}
          </Typography>
          <Typography
            sx={{
              mt: 2,
              color: 'var(--text-muted)',
              fontSize: '1.1rem',
              maxWidth: 400,
              mx: 'auto',
            }}
          >
            Party games para noites épicas com amigos
          </Typography>
        </Box>

        {/* Cards de ação */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
            maxWidth: 700,
            width: '100%',
          }}
        >
          {/* Card TV */}
          <Box
            sx={{
              flex: 1,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--border-subtle)',
              p: 4,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'var(--neon-cyan)',
                boxShadow: '0 0 30px rgba(34, 211, 238, 0.2)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <TvIcon sx={{ fontSize: 32, color: 'var(--neon-cyan)' }} />
              <Typography variant="h4" sx={{ color: 'var(--neon-cyan)' }}>
                Conectar TV
              </Typography>
            </Box>
            <Typography sx={{ mb: 3, color: 'var(--text-secondary)' }}>
              Digite o código para exibir o jogo na TV ou monitor principal.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                placeholder="CÓDIGO"
                value={tvCode}
                onChange={(e) => setTvCode(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.2rem' } }}
                onKeyDown={(e) => e.key === 'Enter' && handleTvConnect()}
              />
              <Button
                variant="contained"
                onClick={handleTvConnect}
                disabled={!tvCode.trim()}
                sx={{
                  bgcolor: 'var(--neon-cyan)',
                  color: 'var(--bg-void)',
                  '&:hover': { bgcolor: '#06b6d4' },
                  minWidth: 100,
                }}
              >
                IR
              </Button>
            </Box>
          </Box>

          {/* Card Jogar (Login/Register) */}
          <Box
            sx={{
              flex: 1,
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(220, 38, 38, 0.1) 100%)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--accent-red)',
              p: 4,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, var(--accent-red), var(--accent-gold), var(--accent-red))',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <GameIcon sx={{ fontSize: 32, color: 'var(--accent-red)' }} />
              <Typography variant="h4" sx={{ color: 'var(--accent-red)' }}>
                Jogar
              </Typography>
            </Box>
            <Typography sx={{ mb: 3, color: 'var(--text-secondary)' }}>
              Faça login para criar ou entrar em uma sala de jogos.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => setLoginOpen(true)}
                sx={{ py: 1.5 }}
              >
                Login
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() => setRegisterOpen(true)}
              >
                Criar Conta
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          textAlign: 'center',
          py: 3,
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Sabado Games · Inspirado em Alice in Borderland & Kakegurui
      </Box>

      {/* Modal de Login */}
      <Dialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--accent-red)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--accent-red)' }}>
            LOGIN
          </Typography>
          <IconButton onClick={() => setLoginOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleLogin}>
          <DialogContent sx={{ pt: 3 }}>
            {loginError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loginError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              sx={{ mb: 2 }}
              required
              autoFocus
            />
            <TextField
              fullWidth
              label="Senha"
              type={showLoginPassword ? 'text' : 'password'}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      edge="end"
                    >
                      {showLoginPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              type="submit"
              disabled={loginLoading}
              sx={{ py: 1.5 }}
            >
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </DialogActions>
        </form>
        <Box sx={{ textAlign: 'center', pb: 3 }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            Não tem conta?{' '}
            <Box
              component="span"
              sx={{
                color: 'var(--accent-gold)',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => {
                setLoginOpen(false)
                setRegisterOpen(true)
              }}
            >
              Criar agora
            </Box>
          </Typography>
        </Box>
      </Dialog>

      {/* Modal de Registro */}
      <Dialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--accent-gold)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Typography variant="h4" sx={{ color: 'var(--accent-gold)' }}>
            CRIAR CONTA
          </Typography>
          <IconButton onClick={() => setRegisterOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleRegister}>
          <DialogContent sx={{ pt: 3 }}>
            {registerError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {registerError}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Nickname"
              value={registerNickname}
              onChange={(e) => setRegisterNickname(e.target.value)}
              sx={{ mb: 2 }}
              required
              autoFocus
              helperText="Como você será chamado nos jogos"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Senha"
              type={showRegisterPassword ? 'text' : 'password'}
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      edge="end"
                    >
                      {showRegisterPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              type="submit"
              disabled={registerLoading}
              sx={{ py: 1.5 }}
            >
              {registerLoading ? 'Criando...' : 'Criar Conta'}
            </Button>
          </DialogActions>
        </form>
        <Box sx={{ textAlign: 'center', pb: 3 }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            Já tem conta?{' '}
            <Box
              component="span"
              sx={{
                color: 'var(--accent-red)',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => {
                setRegisterOpen(false)
                setLoginOpen(true)
              }}
            >
              Fazer login
            </Box>
          </Typography>
        </Box>
      </Dialog>
    </Box>
  )
}
