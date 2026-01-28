import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerAccount, setToken } from '../lib/api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await registerAccount({
        email,
        password,
        nickname: nickname.trim(),
      })
      setToken(result.token)
      navigate('/host')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Conta</p>
      <h2>Crie sua conta para jogar</h2>
      <form className="panel" onSubmit={handleSubmit}>
        <label className="label">E-mail</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ex: ana@email.com"
        />
        <label className="label">Nickname</label>
        <input
          className="input"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Ex: Aninha"
        />
        <label className="label">Senha</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••"
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading || !email || !password || !nickname}
        >
          Criar conta
        </button>
        {error && <p className="hint error">{error}</p>}
      </form>
      <p className="hint">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </section>
  )
}
