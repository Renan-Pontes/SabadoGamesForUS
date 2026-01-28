import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, getMe, isAuthenticated, updateProfile } from '../lib/api'

export default function Settings() {
  const authed = isAuthenticated()
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!authed) return
    let active = true
    getMe()
      .then((data) => {
        if (!active) return
        setEmail(data.user.email ?? '')
        setNickname(data.user.profile?.nickname ?? '')
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar perfil.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [authed])

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await updateProfile({ nickname: nickname.trim() })
      setNickname(result.profile.nickname)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o nickname.')
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    clearToken()
    navigate('/')
  }

  if (!authed) {
    return (
      <section className="page narrow">
        <p className="eyebrow">Configurações</p>
        <h2>Faça login para editar seu nickname</h2>
        <div className="panel">
          <p className="lead">Entre na conta para atualizar seu perfil.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Configurações</p>
      <h2>Seu perfil de jogador</h2>
      <form className="panel" onSubmit={handleSave}>
        <label className="label">E-mail</label>
        <input className="input" value={email} readOnly />
        <label className="label">Nickname</label>
        <input
          className="input"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Ex: Aninha"
        />
        <button className="btn btn-primary" type="submit" disabled={saving || loading || !nickname.trim()}>
          Salvar nickname
        </button>
        {error && <p className="hint error">{error}</p>}
      </form>
      <button className="btn btn-ghost" type="button" onClick={handleLogout}>
        Sair da conta
      </button>
    </section>
  )
}
