import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  changeRoomGame,
  endRoom,
  getMe,
  getRoom,
  listGames,
  rollSugoroku,
  tickLeilao,
  setReadMyMindMode,
  setReady,
  startRoom,
  tickBeleza,
  tickConfinamento,
  tickReadMyMind,
  tickSugoroku,
} from '../lib/api'
import type { Game, Room } from '../lib/types'

export default function HostRoom() {
  const { code } = useParams()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [gameChangeError, setGameChangeError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [readyLoading, setReadyLoading] = useState(false)
  const [modeLoading, setModeLoading] = useState(false)
  const [modeError, setModeError] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(Date.now())

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
    const interval = window.setInterval(fetchRoom, 6000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [code])

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!code || room?.game?.slug !== 'read-my-mind' || room?.status !== 'live') return
    const interval = window.setInterval(() => {
      tickReadMyMind(code)
        .then((updated) => setRoom(updated))
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(interval)
  }, [code, room?.game?.slug, room?.status])

  useEffect(() => {
    if (!code || room?.game?.slug !== 'confinamento-solitario' || room?.status !== 'live') return
    const interval = window.setInterval(() => {
      tickConfinamento(code)
        .then((updated) => setRoom(updated))
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(interval)
  }, [code, room?.game?.slug, room?.status])

  useEffect(() => {
    if (!code || room?.game?.slug !== 'concurso-de-beleza' || room?.status !== 'live') return
    const interval = window.setInterval(() => {
      tickBeleza(code)
        .then((updated) => setRoom(updated))
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(interval)
  }, [code, room?.game?.slug, room?.status])

  useEffect(() => {
    let active = true
    listGames()
      .then((data) => {
        if (!active) return
        setGames(data)
      })
      .catch(() => {})

    getMe()
      .then((data) => {
        if (!active) return
        setCurrentUserId(data.user?.id ?? null)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (room?.game?.id) {
      setSelectedGameId(room.game.id)
    }
  }, [room?.game?.id])

  const playerCount = room?.players?.length ?? 0
  const allReady = Boolean(playerCount) && room?.players?.every((player) => player.ready)
  const myPlayer = room?.players?.find((player) => player.user?.id === currentUserId)
  const myReady = myPlayer?.ready ?? false
  const isReadMyMind = room?.game?.slug === 'read-my-mind'
  const isConfinamento = room?.game?.slug === 'confinamento-solitario'
  const isBeleza = room?.game?.slug === 'concurso-de-beleza'
  const isSugoroku = room?.game?.slug === 'future-sugoroku'
  const isLeilao = room?.game?.slug === 'leilao-de-cem-votos'
  const mode = room?.state?.mode as 'coop' | 'versus' | undefined
  const round = room?.state?.round as number | undefined
  const lives = room?.state?.lives as number | undefined
  const deadlineTs = room?.state?.deadline_ts as number | undefined
  const timeLeft = deadlineTs ? Math.max(0, Math.ceil(deadlineTs - nowTs / 1000)) : null
  const lastTarget = room?.state?.last_target as number | undefined
  const phase = room?.state?.phase as string | undefined
  const lastWinnerId = room?.state?.last_winner_id as number | undefined
  const lastWinnerIds = (room?.state?.last_winner_ids as number[] | undefined) ?? []
  const eliminations = room?.state?.eliminations as number | undefined
  const sugorokuTurn = room?.state?.turn as number | undefined
  const sugorokuMaxTurns = room?.state?.max_turns as number | undefined
  const exit = room?.state?.exit as number[] | undefined
  const sugorokuDeadline = room?.state?.deadline_ts as number | undefined
  const sugorokuTimeLeft =
    sugorokuDeadline && nowTs ? Math.max(0, Math.ceil(sugorokuDeadline - nowTs / 1000)) : null
  const leilaoRound = room?.state?.round as number | undefined
  const leilaoMaxRounds = room?.state?.max_rounds as number | undefined
  const leilaoPot = room?.state?.pot as number | undefined
  const leilaoCarry = room?.state?.carry as number | undefined
  const leilaoLastWinnerId = room?.state?.last_winner_id as number | undefined
  const leilaoLastBid = room?.state?.last_bid as number | undefined
  const leilaoDeadline = room?.state?.deadline_ts as number | undefined
  const leilaoSudden = Boolean(room?.state?.sudden_death)
  const leilaoTiePlayers = (room?.state?.tie_players as number[] | undefined) ?? []
  const leilaoTimeLeft =
    leilaoDeadline && nowTs ? Math.max(0, Math.ceil(leilaoDeadline - nowTs / 1000)) : null
  const suitLabels: Record<'hearts' | 'diamonds' | 'clubs' | 'spades', string> = {
    hearts: 'Copas',
    diamonds: 'Ouros',
    clubs: 'Paus',
    spades: 'Espadas',
  }
  const statusLabel = useMemo(() => {
    if (!room) return 'Carregando sala...'
    if (room.status === 'live') return 'Partida em andamento'
    if (room.status === 'ended') return 'Partida encerrada'
    return 'Lobby aberto'
  }, [room])

  async function handleStart() {
    if (!code) return
    setActionLoading(true)
    try {
      const updated = await startRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar a partida.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEnd() {
    if (!code) return
    setActionLoading(true)
    try {
      await endRoom(code)
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao encerrar a partida.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangeGame() {
    if (!code || !selectedGameId) return
    setGameChangeError(null)
    setActionLoading(true)
    try {
      const updated = await changeRoomGame(code, { game_id: selectedGameId })
      setRoom(updated)
    } catch (err) {
      setGameChangeError(err instanceof Error ? err.message : 'Erro ao trocar o jogo.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleModeChange(nextMode: 'coop' | 'versus') {
    if (!code) return
    setModeError(null)
    setModeLoading(true)
    try {
      const updated = await setReadMyMindMode(code, nextMode)
      setRoom(updated)
    } catch (err) {
      setModeError(err instanceof Error ? err.message : 'Erro ao definir modo.')
    } finally {
      setModeLoading(false)
    }
  }

  async function handleSugorokuRoll() {
    if (!code) return
    setActionLoading(true)
    try {
      const updated = await rollSugoroku(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rolar os dados.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSugorokuResolve() {
    if (!code) return
    setActionLoading(true)
    try {
      const updated = await tickSugoroku(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resolver a rodada.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeilaoResolve() {
    if (!code) return
    setActionLoading(true)
    try {
      const updated = await tickLeilao(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar rodada.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReadyToggle() {
    if (!code) return
    setReadyLoading(true)
    try {
      const result = await setReady(code, !myReady)
      setRoom((prev) => {
        if (!prev?.players) return prev
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === result.player_id ? { ...player, ready: result.ready } : player,
          ),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar Ready.')
    } finally {
      setReadyLoading(false)
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Sala {code?.toUpperCase()}</h2>
          <p className="lead">{statusLabel}</p>
          {(isReadMyMind || isConfinamento || isBeleza || isSugoroku || isLeilao) && (
            <div className="pill-stack">
              <span className="pill">Rodada {round ?? 1}</span>
              {mode && <span className="pill">{mode === 'coop' ? 'Co-op' : 'Versus'}</span>}
              {typeof lives === 'number' && <span className="pill">Vidas {lives}</span>}
              {timeLeft !== null && <span className="pill">Tempo {timeLeft}s</span>}
              {typeof eliminations === 'number' && <span className="pill">Eliminações {eliminations}</span>}
              {isSugoroku && (
                <span className="pill">
                  Turno {sugorokuTurn ?? 1}/{sugorokuMaxTurns ?? 15}
                </span>
              )}
              {isSugoroku && sugorokuTimeLeft !== null && <span className="pill">Tempo {sugorokuTimeLeft}s</span>}
              {isLeilao && (
                <span className="pill">
                  Rodada {leilaoRound ?? 1}/{leilaoMaxRounds ?? 10}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="panel small">
          <p className="label">Código para entrar</p>
          <div className="code-box">{code?.toUpperCase()}</div>
          <p className="hint">Aponte para a tela e peça para digitarem no celular.</p>
          {!allReady && <p className="hint">Todos precisam dar Ready antes de iniciar.</p>}
          <div className="stack">
            <button className="btn btn-ghost" onClick={handleReadyToggle} disabled={readyLoading}>
              {myReady ? 'Ready confirmado' : 'Marcar Ready (host)'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={actionLoading || room?.status === 'live' || !allReady || (isReadMyMind && !mode)}
            >
              Iniciar rodada
            </button>
            <button className="btn btn-ghost" onClick={handleEnd} disabled={actionLoading || room?.status === 'ended'}>
              Encerrar
            </button>
          </div>
          {error && <p className="hint error">{error}</p>}
        </div>
      </div>

      {isReadMyMind && (
        <div className="panel">
          <div className="panel-header">
            <h3>Modo do Read My Mind</h3>
            <span className="pill">Defina antes de iniciar</span>
          </div>
          <div className="controller-grid">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handleModeChange('coop')}
              disabled={modeLoading || mode === 'coop'}
            >
              Co-op
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => handleModeChange('versus')}
              disabled={modeLoading || mode === 'versus'}
            >
              Versus
            </button>
          </div>
          {modeError && <p className="hint error">{modeError}</p>}
        </div>
      )}

      {isConfinamento && (
        <div className="panel">
          <div className="panel-header">
            <h3>Confinamento Solitário</h3>
            <span className="pill">Nipes visíveis (exceto próprio)</span>
          </div>
          <div className="player-grid">
            {room?.players?.map((player) => (
              <div key={player.id} className="player-card">
                <div className="avatar">{player.name[0]?.toUpperCase() ?? 'J'}</div>
                <div>
                  <strong>{player.name}</strong>
                  <span>
                    {player.state?.eliminated
                      ? 'Eliminado'
                      : player.state?.suit
                        ? suitLabels[player.state.suit as keyof typeof suitLabels] ?? 'Desconhecido'
                        : 'Desconhecido'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isBeleza && (
        <div className="panel">
          <div className="panel-header">
            <h3>Concurso de Beleza</h3>
            <span className="pill">Alvo atual</span>
            {phase && <span className="pill">{phase === 'showdown' ? 'Showdown' : 'Escolha'}</span>}
          </div>
          <div className="panel">
            {typeof lastTarget === 'number' ? (
              <p className="lead">Último alvo: {lastTarget.toFixed(2)}</p>
            ) : (
              <p className="hint">Aguardando a primeira rodada.</p>
            )}
            {lastWinnerIds.length ? (
              <p className="hint">
                Últimos vencedores:{' '}
                {lastWinnerIds
                  .map((id) => room?.players?.find((p) => p.id === id)?.name ?? '—')
                  .join(', ')}
              </p>
            ) : lastWinnerId ? (
              <p className="hint">
                Último vencedor: {room?.players?.find((p) => p.id === lastWinnerId)?.name ?? '—'}
              </p>
            ) : null}
          </div>
          <div className="player-grid">
            {room?.players?.map((player) => (
              <div key={player.id} className="player-card">
                <div className="avatar">{player.name[0]?.toUpperCase() ?? 'J'}</div>
                <div>
                  <strong>{player.name}</strong>
                  <span>
                    {player.state?.eliminated ? 'Eliminado' : `Score ${(player.state?.score as number | undefined) ?? 0}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSugoroku && (
        <div className="panel">
          <div className="panel-header">
            <h3>Future Sugoroku</h3>
            <span className="pill">Controle do host</span>
          </div>
          <div className="stack">
            <button className="btn btn-primary" type="button" onClick={handleSugorokuRoll} disabled={actionLoading}>
              Rolar dados das salas
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleSugorokuResolve} disabled={actionLoading}>
              Resolver turno
            </button>
            {exit && (
              <p className="hint">
                Saída secreta em ({exit[0]}, {exit[1]}).
              </p>
            )}
          </div>
          <div className="player-grid">
            {room?.players?.map((player) => (
              <div key={player.id} className="player-card">
                <div className="avatar">{player.name[0]?.toUpperCase() ?? 'J'}</div>
                <div>
                  <strong>{player.name}</strong>
                  <span>
                    {player.state?.eliminated
                      ? 'Eliminado'
                      : player.state?.cleared
                        ? 'Saiu'
                        : `Pontos ${(player.state?.points as number | undefined) ?? 0}`}
                  </span>
                </div>
                <span className="pill">
                  ({(player.state?.position as number[] | undefined)?.[0] ?? 0},
                  {(player.state?.position as number[] | undefined)?.[1] ?? 0})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLeilao && (
        <div className="panel">
          <div className="panel-header">
            <h3>Leilão de Cem Votos</h3>
            <span className="pill">Controle do host</span>
          </div>
          <div className="stack">
            <p className="lead">
              Pote atual: {leilaoPot ?? 100} (excedente {leilaoCarry ?? 0})
            </p>
            {leilaoTimeLeft !== null && <p className="hint">Tempo: {leilaoTimeLeft}s</p>}
            {leilaoSudden && (
              <p className="hint">
                Sudden death: {leilaoTiePlayers.map((id) => room?.players?.find((p) => p.id === id)?.name ?? '—').join(', ')}
              </p>
            )}
            {leilaoLastWinnerId && (
              <p className="hint">
                Último vencedor: {room?.players?.find((p) => p.id === leilaoLastWinnerId)?.name ?? '—'} (lance{' '}
                {leilaoLastBid ?? 0})
              </p>
            )}
            <button className="btn btn-primary" type="button" onClick={handleLeilaoResolve} disabled={actionLoading}>
              Fechar rodada
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h3>Trocar jogo sem fechar a sala</h3>
          <span className="pill">Sala continua ativa</span>
        </div>
        <label className="label">Selecione o jogo</label>
        <select
          className="input"
          value={selectedGameId ?? ''}
          onChange={(event) => setSelectedGameId(Number(event.target.value))}
        >
          <option value="" disabled>
            Escolha um jogo
          </option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={handleChangeGame} disabled={actionLoading || !selectedGameId}>
          Trocar jogo
        </button>
        {gameChangeError && <p className="hint error">{gameChangeError}</p>}
      </div>

      {loading ? (
        <div className="panel center">Carregando jogadores...</div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h3>Jogadores conectados</h3>
            <span className="pill">{playerCount} ativos</span>
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
    </section>
  )
}
