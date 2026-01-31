import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Avatar,
  IconButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { useAuth } from '../context/useAuth'
import { updatePassword, updateProfile } from '../lib/api'

export default function Profile() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user, logout, refreshUser } = useAuth()
  
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [passwordCurrent, setPasswordCurrent] = useState('')
  const [passwordNext, setPasswordNext] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (user?.nickname) {
      setNickname(user.nickname)
    }
  }, [user])

  async function handleSave() {
    if (!nickname.trim()) {
      setError('Nickname não pode estar vazio')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      await updateProfile({ nickname })
      await refreshUser()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSave() {
    if (!passwordCurrent || !passwordNext || !passwordConfirm) {
      setPasswordError('Preencha todos os campos de senha')
      return
    }
    if (passwordNext !== passwordConfirm) {
      setPasswordError('As novas senhas não conferem')
      return
    }

    setPasswordSaving(true)
    setPasswordError('')
    setPasswordSuccess(false)

    try {
      await updatePassword({
        current_password: passwordCurrent,
        new_password: passwordNext,
        confirm_password: passwordConfirm,
      })
      setPasswordSuccess(true)
      setPasswordCurrent('')
      setPasswordNext('')
      setPasswordConfirm('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erro ao atualizar senha')
    } finally {
      setPasswordSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/')
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
        <Typography>Carregando...</Typography>
      </Box>
    )
  }

  // Gerar cor do avatar baseado no nickname
  const avatarColor = user?.nickname
    ? `hsl(${user.nickname.charCodeAt(0) * 10}, 70%, 50%)`
    : 'var(--accent-gold)'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
          var(--bg-void)
        `,
        p: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 4,
          }}
        >
          <IconButton
            onClick={() => navigate('/lobby')}
            sx={{ color: 'var(--text-muted)' }}
          >
            <BackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ color: 'var(--neon-purple)' }}>
            MEU PERFIL
          </Typography>
        </Box>

        {/* Card do Perfil */}
        <Box
          sx={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          {/* Banner */}
          <Box
            sx={{
              height: 100,
              background: `linear-gradient(135deg, var(--accent-red) 0%, var(--neon-purple) 100%)`,
              position: 'relative',
            }}
          />

          {/* Avatar */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mt: -6,
              px: 4,
              pb: 4,
            }}
          >
            <Avatar
              sx={{
                width: 96,
                height: 96,
                fontSize: '2.5rem',
                fontFamily: 'var(--font-display)',
                bgcolor: avatarColor,
                border: '4px solid var(--bg-card)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {user?.nickname?.charAt(0).toUpperCase() || 'J'}
            </Avatar>

            <Typography
              variant="h5"
              sx={{ mt: 2, color: 'var(--text-primary)' }}
            >
              {user?.nickname || 'Jogador'}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {user?.email}
            </Typography>
          </Box>

          {/* Formulário */}
          <Box sx={{ px: 4, pb: 4 }}>
            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                Perfil atualizado com sucesso!
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography
                sx={{
                  mb: 1,
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                NICKNAME
              </Typography>
              <TextField
                fullWidth
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Como você quer ser chamado"
                inputProps={{ maxLength: 20 }}
                helperText={`${nickname.length}/20 caracteres`}
                InputProps={{
                  startAdornment: (
                    <PersonIcon sx={{ mr: 1, color: 'var(--text-muted)' }} />
                  ),
                }}
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || nickname === user?.nickname}
              sx={{ py: 1.5 }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </Box>
        </Box>

        {/* Alterar senha */}
        <Box
          sx={{
            mt: 3,
            p: 3,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--border-subtle)',
          }}
        >
          <Typography
            sx={{
              mb: 2,
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ALTERAR SENHA
          </Typography>
          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Senha atualizada com sucesso!
            </Alert>
          )}
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              type="password"
              label="Senha atual"
              value={passwordCurrent}
              onChange={(e) => setPasswordCurrent(e.target.value)}
            />
            <TextField
              type="password"
              label="Nova senha"
              value={passwordNext}
              onChange={(e) => setPasswordNext(e.target.value)}
            />
            <TextField
              type="password"
              label="Confirmar nova senha"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            sx={{ mt: 2, py: 1.5 }}
            onClick={handlePasswordSave}
            disabled={passwordSaving}
          >
            {passwordSaving ? 'Atualizando...' : 'Atualizar Senha'}
          </Button>
        </Box>

        {/* Ações */}
        <Box
          sx={{
            mt: 3,
            p: 3,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Typography
            sx={{
              mb: 2,
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            CONTA
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={handleLogout}
            sx={{ borderWidth: 2 }}
          >
            Sair da Conta
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
