import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import TvRoundedIcon from '@mui/icons-material/TvRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import VisibilityRounded from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded'
import { useAuth } from '../context/useAuth'
import { roomCodeFromPath, safeNextPath } from '../context/useRequireAuth'
import { friendlyError } from '../lib/api'
import { Brand, Ghost, LoadingScreen, MIST, Panel, pageBackdrop } from '../components/ui'

const NICKNAME_MAX = 20
/** Último apelido usado neste aparelho: quem voltar à festa só aperta "Entrar". */
const LAST_NICKNAME_KEY = 'sabado_last_nickname'

function readLastNickname() {
  try {
    return window.localStorage.getItem(LAST_NICKNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLastNickname(nickname: string) {
  try {
    window.localStorage.setItem(LAST_NICKNAME_KEY, nickname)
  } catch {
    // Sem armazenamento (aba anônima): só não lembra da próxima vez.
  }
}

/** Código de sala digitado: só letras e números, em caixa alta. */
function cleanCode(value: string) {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 6)
}

export default function Landing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading, login, register, loginAsGuest } = useAuth()

  // `?next=/play/1234`: quem escaneou o QR da TV volta direto para a sala.
  const next = safeNextPath(searchParams.get('next'))
  const invitedCode = roomCodeFromPath(next)

  const [nickname, setNickname] = useState(readLastNickname)
  const [roomCode, setRoomCode] = useState('')
  const [guestError, setGuestError] = useState('')
  const [guestSubmitting, setGuestSubmitting] = useState(false)

  const [mode, setMode] = useState<'login' | 'register' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registerNickname, setRegisterNickname] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tvCode, setTvCode] = useState('')

  // Para onde ir depois de entrar. Fica num ref porque quem navega é o efeito
  // abaixo, quando a sessão aparece — um caminho só, sem corrida entre dois
  // `navigate`.
  const destinationRef = useRef<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(destinationRef.current ?? next ?? '/lobby', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, next])

  async function handleGuestSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) {
      setGuestError('Escreva um apelido. Até fantasma tem nome. 👻')
      return
    }
    const code = cleanCode(roomCode)
    // Convite (QR) manda; senão, o código digitado; senão, de onde a pessoa veio.
    destinationRef.current = invitedCode && next ? next : code ? `/play/${code}` : (next ?? '/lobby')
    setGuestSubmitting(true)
    setGuestError('')
    try {
      await loginAsGuest(trimmed)
      saveLastNickname(trimmed)
    } catch (err) {
      destinationRef.current = null
      setGuestError(friendlyError(err, 'Não deu para entrar agora. Tente de novo.'))
      setGuestSubmitting(false)
    }
  }

  function openAccountDialog(nextMode: 'login' | 'register') {
    setFormError('')
    setMode(nextMode)
  }

  async function handleAccountSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    destinationRef.current = next ?? '/lobby'
    try {
      if (mode === 'register') {
        await register(email, password, registerNickname)
      } else {
        await login(email, password)
      }
      setMode(null)
    } catch (err) {
      destinationRef.current = null
      setFormError(
        friendlyError(err, mode === 'register' ? 'Não foi possível criar a conta.' : 'Não foi possível entrar.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleTvConnect() {
    const code = cleanCode(tvCode)
    if (code) navigate(`/tv/${code}`)
  }

  if (isLoading) return <LoadingScreen label="ABRINDO O PORTÃO DO CEMITÉRIO" />

  const guestLabel = guestSubmitting
    ? 'Abrindo o portão...'
    : invitedCode
      ? `Entrar na sala ${invitedCode}`
      : 'Entrar na festa'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: pageBackdrop(MIST.pumpkin, MIST.witch),
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: { xs: 4, md: 6 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ mb: { xs: 3.5, md: 5 }, textAlign: 'center' }}>
          <Brand
            size="hero"
            animated
            tagline="Jogos de festa na TV, com o celular de controle. Hoje é noite de Halloween."
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: invitedCode ? '1fr' : '1.25fr 1fr' },
            gap: 2.5,
            maxWidth: invitedCode ? 480 : 820,
            width: '100%',
            alignItems: 'start',
          }}
        >
          {/* Entrada rápida: só o apelido */}
          <Panel accent="var(--pumpkin)" highlight web index={0}>
            <Box component="form" onSubmit={handleGuestSubmit} noValidate sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                <Box sx={{ width: 44, flexShrink: 0, mt: -0.5 }}>
                  <Ghost size={40} glow="var(--pumpkin)" />
                </Box>
                <Typography
                  component="h2"
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: { xs: '1.75rem', md: '2rem' },
                    lineHeight: 1.05,
                    letterSpacing: '0.05em',
                    color: 'var(--pumpkin)',
                  }}
                >
                  {invitedCode ? 'FALTA SÓ O APELIDO' : 'ENTRAR SÓ COM APELIDO'}
                </Typography>
              </Box>

              <Typography sx={{ color: 'var(--text-secondary)', mb: 2.25, fontSize: '0.95rem' }}>
                {invitedCode ? (
                  <>
                    Você foi chamado para a sala{' '}
                    <Box component="strong" sx={{ color: 'var(--pumpkin-light)', fontFamily: 'var(--font-numeric)', fontSize: '1.15em', letterSpacing: '0.08em' }}>
                      {invitedCode}
                    </Box>
                    . Diga como a galera vai te chamar.
                  </>
                ) : (
                  'Sem e-mail, sem senha. Digite como a galera te chama e pronto.'
                )}
              </Typography>

              {guestError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {guestError}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Seu apelido"
                placeholder="Ex.: Drácula da Silva"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoFocus
                autoComplete="nickname"
                slotProps={{
                  htmlInput: {
                    maxLength: NICKNAME_MAX,
                    enterKeyHint: 'go',
                    autoCapitalize: 'words',
                    style: { fontSize: '1.15rem' },
                  },
                }}
                helperText={`${nickname.length}/${NICKNAME_MAX}`}
              />

              {!invitedCode && (
                <TextField
                  fullWidth
                  label="Código da sala (se tiver)"
                  placeholder="1234"
                  value={roomCode}
                  onChange={(event) => setRoomCode(cleanCode(event.target.value))}
                  sx={{ mt: 1.5 }}
                  slotProps={{
                    htmlInput: {
                      maxLength: 6,
                      inputMode: 'numeric',
                      enterKeyHint: 'go',
                      style: { letterSpacing: '0.3em', fontSize: '1.15rem' },
                      'aria-label': 'Código da sala (opcional)',
                    },
                  }}
                />
              )}

              <Button
                fullWidth
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={guestSubmitting}
                sx={{ mt: 2.25, py: 1.75, fontSize: '1.12rem' }}
              >
                🎃&nbsp;&nbsp;{guestLabel}
              </Button>
            </Box>

            <Box
              sx={{
                mt: 2.25,
                pt: 1.75,
                borderTop: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Já tem conta?</Typography>
              <Button
                size="small"
                variant="text"
                color="secondary"
                startIcon={<MailOutlineRoundedIcon />}
                onClick={() => openAccountDialog('login')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Entrar com e-mail
              </Button>
            </Box>
          </Panel>

          {/* TV: não precisa de conta. Some quando a pessoa veio pelo QR. */}
          {!invitedCode && (
            <Panel accent="var(--neon-cyan)" index={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                <TvRoundedIcon sx={{ fontSize: 30, color: 'var(--neon-cyan)' }} />
                <Typography
                  component="h2"
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.6rem',
                    letterSpacing: '0.05em',
                    color: 'var(--neon-cyan)',
                  }}
                >
                  CONECTAR TV
                </Typography>
              </Box>
              <Typography sx={{ color: 'var(--text-secondary)', mb: 2.5, fontSize: '0.92rem' }}>
                Abra este site no navegador da TV e digite o código da sala. A TV não precisa de conta — ela só
                assombra.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.25 }}>
                <TextField
                  fullWidth
                  placeholder="CÓDIGO"
                  value={tvCode}
                  onChange={(event) => setTvCode(cleanCode(event.target.value))}
                  onKeyDown={(event) => event.key === 'Enter' && handleTvConnect()}
                  slotProps={{
                    htmlInput: {
                      maxLength: 6,
                      style: { textAlign: 'center', fontSize: '1.3rem', letterSpacing: '0.2em' },
                      inputMode: 'numeric',
                      'aria-label': 'Código da sala para a TV',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  color="info"
                  onClick={handleTvConnect}
                  disabled={!tvCode.trim()}
                  sx={{ minWidth: 88 }}
                >
                  Ir
                </Button>
              </Box>
            </Panel>
          )}
        </Box>

        {!invitedCode && (
          <Typography sx={{ mt: 3, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', maxWidth: 520 }}>
            Na TV aparece um QR code: escaneie com a câmera e você cai direto na sala.
          </Typography>
        )}
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
        Sábado Games · Noite do Terror 2026 🦇
      </Box>

      {/* Conta com e-mail: entrar e criar conta no mesmo formulário */}
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 'var(--radius-xl)',
              border: `1px solid ${mode === 'register' ? 'var(--neon-purple)' : 'var(--pumpkin)'}`,
            },
          },
        }}
      >
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.9rem',
                letterSpacing: '0.05em',
                color: mode === 'register' ? 'var(--neon-purple)' : 'var(--pumpkin)',
              }}
            >
              {mode === 'register' ? 'CRIAR CONTA' : 'ENTRAR'}
            </Typography>
            <IconButton onClick={() => setMode(null)} size="small" aria-label="Fechar">
              <CloseRoundedIcon />
            </IconButton>
          </Box>

          <form onSubmit={handleAccountSubmit}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}

            {mode === 'register' && (
              <TextField
                fullWidth
                label="Apelido"
                value={registerNickname}
                onChange={(event) => setRegisterNickname(event.target.value)}
                sx={{ mb: 2 }}
                required
                autoFocus
                helperText="É assim que você aparece na mesa"
                slotProps={{ htmlInput: { maxLength: NICKNAME_MAX } }}
              />
            )}

            <TextField
              fullWidth
              label="E-mail"
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
              onClick={() => openAccountDialog(mode === 'register' ? 'login' : 'register')}
              sx={{
                background: 'none',
                border: 'none',
                p: 0,
                font: 'inherit',
                cursor: 'pointer',
                color: mode === 'register' ? 'var(--pumpkin)' : 'var(--neon-purple)',
                textDecoration: 'underline',
              }}
            >
              {mode === 'register' ? 'Entrar' : 'Criar agora'}
            </Box>
          </Typography>
          <Typography sx={{ mt: 1.25, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Na festa não precisa: o apelido basta.
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
