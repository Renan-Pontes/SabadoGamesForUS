import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getRoom } from '../lib/api'
import type { Room } from '../lib/types'

export default function TvRoom() {
  const { code } = useParams()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    let active = true
    const fetchRoom = () => {
      setLoading(true)
      getRoom(code)
        .then((data) => {
          if (!active) return
          setRoom(data)
        })
        .catch((err) => {
          if (!active) return
          setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
        })
        .finally(() => {
          if (!active) return
          setLoading(false)
        })
    }

    fetchRoom()
    const interval = window.setInterval(fetchRoom, 5000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code])

  const statusLabel = useMemo(() => {
    if (!room) return 'Carregando sala...'
    if (room.status === 'live') return 'Partida em andamento'
    if (room.status === 'ended') return 'Partida encerrada'
    return 'Lobby aberto'
  }, [room])

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">TV</p>
          <h2>Sala {code?.toUpperCase()}</h2>
          <p className="lead">{statusLabel}</p>
          {room?.game && <p className="hint">Jogo: {room.game.name}</p>}
        </div>
        <div className="panel small">
          <p className="label">Código da sala</p>
          <div className="code-box">{code?.toUpperCase()}</div>
          <p className="hint">Jogadores entram pelo celular com esse código.</p>
        </div>
      </div>

      {loading ? (
        <div className="panel center">Carregando jogadores...</div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h3>Jogadores conectados</h3>
            <span className="pill">{room?.players?.length ?? 0} ativos</span>
          </div>
          {room?.players?.length ? (
            <div className="player-grid">
              {room.players.map((player) => (
                <div key={player.id} className="player-card">
                  <div className="avatar">{player.name[0]?.toUpperCase() ?? 'J'}</div>
                  <div>
                    <strong>{player.name}</strong>
                    <span>{player.is_host ? 'Host' : 'Jogador'}</span>
                  </div>
                  <span className={`ready-dot ${player.ready ? 'on' : 'off'}`}>
                    {player.ready ? 'Ready' : 'Aguardando'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">Aguardando jogadores entrarem pela sala.</p>
          )}
        </div>
      )}

      {error && <p className="hint error">{error}</p>}
    </section>
  )
}
