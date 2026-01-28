import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, listGames } from '../lib/api'
import type { Game } from '../lib/types'

export default function HostSetup() {
  const [games, setGames] = useState<Game[]>([])
  const [selected, setSelected] = useState<Game | null>(null)
  const [hostName, setHostName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    listGames()
      .then((data) => {
        if (!active) return
        setGames(data)
        setSelected(data[0] ?? null)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const statusText = useMemo(() => {
    if (loading) return 'Carregando jogos...'
    if (error) return 'Não foi possível carregar os jogos.'
    if (!games.length) return 'Nenhum jogo disponível ainda.'
    return null
  }, [loading, error, games.length])

  async function handleCreate() {
    if (!selected) return
    setError(null)
    try {
      const room = await createRoom({
        game_id: selected.id,
        host_name: hostName.trim() || undefined,
      })
      navigate(`/host/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sala.')
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Escolha o jogo e crie a sala da rodada</h2>
          <p className="lead">
            Depois disso, compartilhe o código para cadastrar a TV e os celulares entrarem.
          </p>
        </div>
        <div className="panel small">
          <label className="label">Nome do host</label>
          <input
            className="input"
            placeholder="Ex: Luana"
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
          />
          <button className="btn btn-primary" disabled={!selected} onClick={handleCreate}>
            Criar sala
          </button>
          {error && <p className="hint error">{error}</p>}
        </div>
      </div>

      {statusText ? (
        <div className="panel center">
          <p>{statusText}</p>
        </div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              className={`game-card ${selected?.id === game.id ? 'selected' : ''}`}
              onClick={() => setSelected(game)}
            >
              <div className="game-card-title">
                <h3>{game.name}</h3>
                <span className="pill">
                  {game.min_players}-{game.max_players} jogadores
                </span>
              </div>
              <p>{game.description}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
