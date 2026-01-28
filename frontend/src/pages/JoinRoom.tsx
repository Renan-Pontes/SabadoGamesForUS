import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isAuthenticated, joinRoom } from '../lib/api'

export default function JoinRoom() {
  const authed = isAuthenticated()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    if (!code) return
    setLoading(true)
    setError(null)

    try {
      const normalizedCode = code.trim()
      const payload = await joinRoom(normalizedCode, {})
      navigate(`/play/${normalizedCode}?player=${payload.player.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar na sala.')
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <section className="page narrow">
        <p className="eyebrow">Entrar pelo celular</p>
        <h2>Crie ou acesse sua conta para jogar</h2>
        <div className="panel">
          <p className="lead">Com a conta, sua pontuação fica guardada nas próximas partidas.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/login">
              Entrar
            </Link>
            <Link className="btn btn-ghost" to="/register">
              Criar conta
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Entrar pelo celular</p>
      <h2>Digite o código da TV e o seu nome</h2>
      <form className="panel" onSubmit={handleJoin}>
        <label className="label">Código</label>
        <input
          className="input"
          placeholder="EX: 1234"
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !code}>
          Entrar na sala
        </button>
        {error && <p className="hint error">{error}</p>}
      </form>
      <p className="hint">Seu nickname é usado automaticamente. Ajuste em Configurações se precisar.</p>
    </section>
  )
}
