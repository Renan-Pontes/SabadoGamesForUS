import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerAccount, setToken } from '../lib/api'

const features = [
  {
    title: 'TV como palco',
    description: 'A tela grande mostra o ritmo da noite com placar, timer e destaques.',
  },
  {
    title: 'Celular como controle',
    description: 'Cada pessoa joga no próprio celular, sem instalar nada complicado.',
  },
  {
    title: 'Rodadas rápidas',
    description: 'Jogos curtos para manter a energia lá no alto durante o sábado.',
  },
]

export default function Home() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await registerAccount({
        email,
        password,
        nickname,
      })
      setToken(result.token)
      setOpen(false)
      navigate('/host')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page hero">
      <div className="hero-text">
        <p className="eyebrow">Sabado Games</p>
        <h1>
          Transforme a TV da sala
          <span>em um painel de jogos para todo mundo.</span>
        </h1>
        <p className="lead">
          Escolha um jogo, crie a sala e deixe que cada jogador controle a partida pelo celular.
          Perfeito para festas, encontro de amigos e qualquer noite de sábado.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/tv">
            Cadastrar TV
          </Link>
          <Link className="btn btn-ghost" to="/host">
            Controle do jogo
          </Link>
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>
            Criar conta
          </button>
          <Link className="btn btn-ghost" to="/join">
            Entrar pelo celular
          </Link>
        </div>
      </div>
      <div className="hero-card">
        <div className="hero-card-top">
          <span>Ao vivo</span>
          <span className="dot" />
        </div>
        <div className="hero-score">
          <div>
            <p>Equipe A</p>
            <strong>320</strong>
          </div>
          <div>
            <p>Equipe B</p>
            <strong>290</strong>
          </div>
        </div>
        <div className="hero-card-bottom">
          <span>Próxima rodada em</span>
          <strong>00:45</strong>
        </div>
      </div>
      <div className="feature-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>

      {open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Criar conta</h3>
              <button className="icon-button" type="button" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <form className="modal-body" onSubmit={handleRegister}>
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
          </div>
        </div>
      ) : null}
    </section>
  )
}
