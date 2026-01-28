import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TvSetup() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    navigate(`/tv/${code.trim()}`)
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">TV</p>
      <h2>Cadastrar a TV com o código da sala</h2>
      <form className="panel" onSubmit={handleSubmit}>
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
        <button className="btn btn-primary" type="submit" disabled={!code.trim()}>
          Conectar TV
        </button>
      </form>
      <p className="hint">Digite o código criado no painel de controle.</p>
    </section>
  )
}
