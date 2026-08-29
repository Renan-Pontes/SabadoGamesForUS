import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, TextField, Alert, InputAdornment } from '@mui/material'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { useAuth } from '../context/useAuth'
import { updatePassword, updateProfile } from '../lib/api'
import { AppShell, LoadingScreen, Panel } from '../components/ui'
import { avatarColor } from '../games/utils'

const NICKNAME_MAX = 20

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
    if (!isLoading && !isAuthenticated) navigate('/')
  }, [isAuthenticated, isLoading, navigate])

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname)
  }, [user])

  async function handleSave() {
    const trimmed = nickname.trim()
    if (!trimmed) {
      setError('O apelido não pode ficar vazio.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await updateProfile({ nickname: trimmed })
      await refreshUser()
      setSuccess(true)
      window.setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSave() {
    if (!passwordCurrent || !passwordNext || !passwordConfirm) {
      setPasswordError('Preencha os três campos de senha.')
      return
    }
    if (passwordNext !== passwordConfirm) {
      setPasswordError('A nova senha e a confirmação não conferem.')
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
      window.setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (isLoading) return <LoadingScreen label="CARREGANDO PERFIL" accent="var(--neon-purple)" />

  const color = avatarColor(user?.nickname)
  const nicknameChanged = nickname.trim() !== (user?.nickname ?? '')

  return (
    <AppShell
      title="MEU PERFIL"
      subtitle="É este nome que aparece na mesa."
      accent="var(--neon-purple)"
      backdropTint="rgba(168, 85, 247, 0.16)"
      onBack={() => navigate('/lobby')}
      maxWidth={640}
    >
      {/* Cartão de identidade */}
      <Panel accent="var(--neon-purple)" highlight sx={{ p: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            height: 96,
            background: `linear-gradient(120deg, ${color}55, var(--neon-purple)44, var(--accent-red)33)`,
            position: 'relative',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              fontFamily: 'var(--font-display)',
              fontSize: '5rem',
              color: 'rgba(0,0,0,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              overflow: 'hidden',
              lineHeight: 1,
            }}
          >
            ♠♥♦♣
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: -6, px: 3, pb: 3 }}>
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '2.6rem',
              color: '#0a0a0f',
              background: `linear-gradient(140deg, ${color}, ${color}aa)`,
              border: '4px solid var(--bg-card)',
              boxShadow: `0 12px 34px rgba(0,0,0,0.5), 0 0 30px ${color}44`,
            }}
          >
            {(user?.nickname ?? 'J').charAt(0).toUpperCase()}
          </Box>

          <Typography
            sx={{
              mt: 1.5,
              fontFamily: 'var(--font-display)',
              fontSize: '1.9rem',
              letterSpacing: '0.05em',
              color: 'var(--text-primary)',
            }}
          >
            {user?.nickname || 'Jogador'}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
            {user?.email}
          </Typography>
        </Box>
      </Panel>

      {/* Apelido */}
      <Panel title="APELIDO" accent="var(--accent-gold)" sx={{ mt: 2.5 }} index={1}>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Perfil atualizado!
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Como você quer ser chamado"
          helperText={`${nickname.length}/${NICKNAME_MAX} caracteres`}
          slotProps={{
            htmlInput: { maxLength: NICKNAME_MAX },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PersonRoundedIcon sx={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<SaveRoundedIcon />}
          onClick={handleSave}
          disabled={saving || !nicknameChanged}
          sx={{ mt: 2, py: 1.5 }}
        >
          {saving ? 'Salvando...' : 'Salvar apelido'}
        </Button>
      </Panel>

      {/* Senha */}
      <Panel title="SENHA" accent="var(--neon-cyan)" sx={{ mt: 2.5 }} index={2}>
        {passwordSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Senha atualizada!
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
            autoComplete="current-password"
            value={passwordCurrent}
            onChange={(event) => setPasswordCurrent(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon sx={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            type="password"
            label="Nova senha"
            autoComplete="new-password"
            value={passwordNext}
            onChange={(event) => setPasswordNext(event.target.value)}
          />
          <TextField
            type="password"
            label="Confirmar nova senha"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            error={Boolean(passwordConfirm) && passwordConfirm !== passwordNext}
            helperText={
              passwordConfirm && passwordConfirm !== passwordNext ? 'As senhas não conferem.' : ' '
            }
          />
        </Box>

        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={handlePasswordSave}
          disabled={passwordSaving}
          sx={{ mt: 1, py: 1.5 }}
        >
          {passwordSaving ? 'Atualizando...' : 'Atualizar senha'}
        </Button>
      </Panel>

      {/* Conta */}
      <Panel title="CONTA" accent="var(--accent-red)" sx={{ mt: 2.5 }} index={3}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          onClick={() => {
            logout()
            navigate('/')
          }}
          sx={{ borderWidth: 2 }}
        >
          Sair da conta
        </Button>
      </Panel>
    </AppShell>
  )
}
