import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getMe,
  getRoom,
  isAuthenticated,
  playReadMyMindCard,
  sendHeartbeat,
  setReady,
  moveSugoroku,
  chooseSugorokuPenalty,
  submitBelezaGuess,
  submitConfinamentoGuess,
  bidLeilao,
  tickBeleza,
  tickConfinamento,
  tickReadMyMind,
  unlockSugoroku,
} from '../lib/api'
import type { Room } from '../lib/types'

export default function PlayerRoom() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const playerId = Number(searchParams.get('player'))
  const authed = isAuthenticated()
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [readyLoading, setReadyLoading] = useState(false)
  const [playLoading, setPlayLoading] = useState(false)
  const [nowTs, setNowTs] = useState(Date.now())
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [guessSent, setGuessSent] = useState(false)
  const [lastRound, setLastRound] = useState<number | null>(null)
  const [belezaValue, setBelezaValue] = useState('')
  const [leilaoValue, setLeilaoValue] = useState('')

  useEffect(() => {
    if (!code || !authed) return
    let active = true
    getRoom(code)
      .then((data) => {
        if (!active) return
        setRoom(data)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar sala.')
      })

    return () => {
      active = false
    }
  }, [code, authed])

  useEffect(() => {
    if (!authed) return
    let active = true
    getMe()
      .then((data) => {
        if (!active) return
        setCurrentUserId(data.user?.id ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [authed])

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

  const currentPlayer = room?.players?.find(
    (player) => player.id === playerId || (currentUserId && player.user?.id === currentUserId),
  )
  const heartbeatPlayerId = currentPlayer?.id

  useEffect(() => {
    if (!code || !heartbeatPlayerId || !authed) return
    const interval = window.setInterval(() => {
      sendHeartbeat(code, heartbeatPlayerId).catch(() => {})
    }, 8000)
    return () => window.clearInterval(interval)
  }, [code, heartbeatPlayerId, authed])

  const statusText = useMemo(() => {
    if (!room) return 'Carregando...'
    if (room.status === 'live') return 'Rodada em andamento!'
    if (room.status === 'ended') return 'A rodada terminou.'
    return 'Aguardando o host iniciar.'
  }, [room])

  const isReady = currentPlayer?.ready ?? false
  const isReadMyMind = room?.game?.slug === 'read-my-mind'
  const isConfinamento = room?.game?.slug === 'confinamento-solitario'
  const isBeleza = room?.game?.slug === 'concurso-de-beleza'
  const isSugoroku = room?.game?.slug === 'future-sugoroku'
  const isLeilao = room?.game?.slug === 'leilao-de-cem-votos'
  const hand = (currentPlayer?.state?.hand as number[] | undefined) ?? []
  const eliminated = Boolean(currentPlayer?.state?.eliminated)
  const round = room?.state?.round as number | undefined
  const lives = room?.state?.lives as number | undefined
  const deadlineTs = room?.state?.deadline_ts as number | undefined
  const timeLeft = deadlineTs ? Math.max(0, Math.ceil(deadlineTs - nowTs / 1000)) : null
  const winners = (room?.state?.winners as number[] | undefined) ?? []
  const myScore = (currentPlayer?.state?.score as number | undefined) ?? 0
  const lastTarget = room?.state?.last_target as number | undefined
  const phase = room?.state?.phase as string | undefined
  const lastWinnerId = room?.state?.last_winner_id as number | undefined
  const lastWinnerIds = (room?.state?.last_winner_ids as number[] | undefined) ?? []
  const eliminations = room?.state?.eliminations as number | undefined
  const sugorokuTurn = room?.state?.turn as number | undefined
  const sugorokuMaxTurns = room?.state?.max_turns as number | undefined
  const position = (currentPlayer?.state?.position as number[] | undefined) ?? [0, 0]
  const points = (currentPlayer?.state?.points as number | undefined) ?? 0
  const locked = Boolean(currentPlayer?.state?.locked)
  const canBack = Boolean(currentPlayer?.state?.can_back)
  const diceForRoom = (room?.state?.dice as Record<string, Record<string, number>> | undefined)?.[
    `${position[0]},${position[1]}`
  ]
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
  const currentBid = (currentPlayer?.state?.bid as number | undefined) ?? 0
  const leilaoDeadline = room?.state?.deadline_ts as number | undefined
  const leilaoSudden = Boolean(room?.state?.sudden_death)
  const leilaoTiePlayers = (room?.state?.tie_players as number[] | undefined) ?? []
  const leilaoTimeLeft =
    leilaoDeadline && nowTs ? Math.max(0, Math.ceil(leilaoDeadline - nowTs / 1000)) : null
  const canBidLeilao = !leilaoSudden || (currentPlayer && leilaoTiePlayers.includes(currentPlayer.id))
  const pendingPenalties = room?.state?.pending_penalties as
    | Record<string, { amount: number; player_ids: number[] }>
    | undefined
  const penaltyKey = `${position[0]},${position[1]}`
  const penaltyInfo = pendingPenalties?.[penaltyKey]
  const penaltyOpener = penaltyInfo?.opener_id as number | undefined
  const suitLabels: Record<'hearts' | 'diamonds' | 'clubs' | 'spades', string> = {
    hearts: 'Copas',
    diamonds: 'Ouros',
    clubs: 'Paus',
    spades: 'Espadas',
  }

  useEffect(() => {
    if (round && round !== lastRound) {
      setGuessSent(false)
      setBelezaValue('')
      setLeilaoValue('')
      setLastRound(round)
    }
  }, [round, lastRound])

  async function handleReadyToggle() {
    if (!code) return
    setReadyLoading(true)
    try {
      const result = await setReady(code, !isReady)
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
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o Ready.')
    } finally {
      setReadyLoading(false)
    }
  }

  async function handlePlay(card: number) {
    if (!code) return
    setPlayLoading(true)
    setError(null)
    try {
      const updated = await playReadMyMindCard(code, card)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível jogar a carta.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleConfinamentoGuess(guess: 'hearts' | 'diamonds' | 'clubs' | 'spades') {
    if (!code) return
    setPlayLoading(true)
    setError(null)
    try {
      const updated = await submitConfinamentoGuess(code, guess)
      setRoom(updated)
      setGuessSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o palpite.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleBelezaSubmit() {
    if (!code) return
    if (belezaValue.trim() === '') return
    const value = Number(belezaValue)
    if (Number.isNaN(value)) return
    setPlayLoading(true)
    setError(null)
    try {
      const updated = await submitBelezaGuess(code, value)
      setRoom(updated)
      setGuessSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o número.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleSugorokuMove(direction: 'N' | 'S' | 'E' | 'W') {
    if (!code) return
    setPlayLoading(true)
    setError(null)
    try {
      await moveSugoroku(code, { action: 'move', direction })
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mover.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleSugorokuStay() {
    if (!code) return
    setPlayLoading(true)
    setError(null)
    try {
      await moveSugoroku(code, { action: 'stay' })
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aguardar.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleSugorokuBack() {
    if (!code) return
    setPlayLoading(true)
    setError(null)
    try {
      await moveSugoroku(code, { action: 'back' })
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível voltar.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleSugorokuUnlock() {
    if (!code) return
    setPlayLoading(true)
    try {
      await unlockSugoroku(code)
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar a pulseira.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handlePenaltyChoice(targetId: number) {
    if (!code) return
    setPlayLoading(true)
    try {
      await chooseSugorokuPenalty(code, targetId)
      const updated = await getRoom(code)
      setRoom(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aplicar a penalidade.')
    } finally {
      setPlayLoading(false)
    }
  }

  async function handleLeilaoBid() {
    if (!code) return
    const value = Number(leilaoValue)
    if (Number.isNaN(value) || value < 0) return
    setPlayLoading(true)
    setError(null)
    try {
      await bidLeilao(code, value)
      const updated = await getRoom(code)
      setRoom(updated)
      setGuessSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o lance.')
    } finally {
      setPlayLoading(false)
    }
  }

  if (!authed) {
    return (
      <section className="page narrow">
        <p className="eyebrow">Jogador</p>
        <h2>Faça login para continuar</h2>
        <div className="panel">
          <p className="lead">Entre na conta usada para entrar na sala.</p>
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
      <p className="eyebrow">Jogador</p>
      <h2>Sala {code?.toUpperCase()}</h2>
      <div className="panel">
        <p className="lead">{statusText}</p>
        {room?.status === 'live' ? (
          isReadMyMind ? (
            <div className="controller">
              <div className="panel-header">
                <h3>Suas cartas</h3>
                <span className="pill">Rodada {round ?? 1}</span>
                {typeof lives === 'number' && <span className="pill">Vidas {lives}</span>}
                {timeLeft !== null && <span className="pill">Tempo {timeLeft}s</span>}
              </div>
              {eliminated ? (
                <p className="hint">Você foi eliminado nesta rodada.</p>
              ) : (
                <div className="card-grid">
                  {hand.length ? (
                    hand
                      .slice()
                      .sort((a, b) => a - b)
                      .map((card) => (
                        <button
                          key={card}
                          className="card-btn"
                          type="button"
                          onClick={() => handlePlay(card)}
                          disabled={playLoading}
                        >
                          {card}
                        </button>
                      ))
                  ) : (
                    <p className="hint">Aguardando próxima rodada.</p>
                  )}
                </div>
              )}
            </div>
          ) : isConfinamento ? (
            <div className="controller">
              <div className="panel-header">
                <h3>Confinamento Solitário</h3>
                <span className="pill">Rodada {round ?? 1}</span>
                {timeLeft !== null && <span className="pill">Tempo {timeLeft}s</span>}
              </div>
              <div className="panel">
                <h4>Nipes dos outros jogadores</h4>
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
              <div className="panel">
                <h4>Qual é o seu nipe?</h4>
                {eliminated ? (
                  <p className="hint">Você foi eliminado nesta rodada.</p>
                ) : winners.length ? (
                  <p className="hint">Partida encerrada. {winners.includes(currentPlayer?.id ?? -1) ? 'Você venceu!' : 'Fim de jogo.'}</p>
                ) : (
                  <div className="controller-grid">
                    {(['hearts', 'diamonds', 'clubs', 'spades'] as const).map((suit) => (
                      <button
                        key={suit}
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => handleConfinamentoGuess(suit)}
                        disabled={playLoading || guessSent}
                      >
                        {suitLabels[suit]}
                      </button>
                    ))}
                  </div>
                )}
                {guessSent && !eliminated && <p className="hint">Palpite enviado. Aguarde o resultado.</p>}
              </div>
            </div>
          ) : isBeleza ? (
            <div className="controller">
              <div className="panel-header">
                <h3>Concurso de Beleza</h3>
                <span className="pill">Rodada {round ?? 1}</span>
                {typeof eliminations === 'number' && <span className="pill">Eliminações {eliminations}</span>}
                {phase && <span className="pill">{phase === 'showdown' ? 'Showdown' : 'Escolha'}</span>}
              </div>
              <div className="panel">
                <p className="lead">Seu placar: {myScore}</p>
                {typeof lastTarget === 'number' && (
                  <p className="hint">Alvo anterior: {lastTarget.toFixed(2)}</p>
                )}
                {lastWinnerIds.length ? (
                  <p className="hint">
                    Vencedores anteriores:{' '}
                    {lastWinnerIds
                      .map((id) => room?.players?.find((p) => p.id === id)?.name ?? '—')
                      .join(', ')}
                  </p>
                ) : lastWinnerId ? (
                  <p className="hint">
                    Vencedor anterior: {room?.players?.find((p) => p.id === lastWinnerId)?.name ?? '—'}
                  </p>
                ) : null}
              </div>
              <div className="panel">
                <h4>Escolha um número (0 a 100)</h4>
                {phase === 'showdown' ? (
                  <p className="hint">Showdown em andamento. Aguarde a próxima rodada.</p>
                ) : eliminated ? (
                  <p className="hint">Você foi eliminado.</p>
                ) : (
                  <div className="stack">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={belezaValue}
                      onChange={(event) => setBelezaValue(event.target.value)}
                      placeholder="Ex: 42"
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleBelezaSubmit}
                      disabled={playLoading || guessSent || phase === 'showdown'}
                    >
                      Enviar número
                    </button>
                    {guessSent && <p className="hint">Número enviado. Aguarde os outros jogadores.</p>}
                  </div>
                )}
              </div>
            </div>
          ) : isSugoroku ? (
            <div className="controller">
              <div className="panel-header">
                <h3>Future Sugoroku</h3>
                <span className="pill">
                  Turno {sugorokuTurn ?? 1}/{sugorokuMaxTurns ?? 15}
                </span>
              </div>
              <div className="panel">
                <p className="lead">Pontos: {points}</p>
                <p className="hint">
                  Sala atual: ({position[0]}, {position[1]})
                </p>
                {sugorokuTimeLeft !== null && <p className="hint">Tempo: {sugorokuTimeLeft}s</p>}
                {exit && (
                  <p className="hint">
                    Saída oculta. Encontre até o turno {sugorokuMaxTurns ?? 15}.
                  </p>
                )}
              </div>
              {locked && (
                <div className="panel">
                  <p className="lead">Sala bloqueada. Use a pulseira com outro jogador.</p>
                  <button className="btn btn-primary" type="button" onClick={handleSugorokuUnlock} disabled={playLoading}>
                    Usar pulseira
                  </button>
                </div>
              )}
              <div className="panel">
                <h4>Escolha a próxima sala</h4>
                {diceForRoom ? (
                  <div className="controller-grid">
                    {(['N', 'S', 'E', 'W'] as const).map((dir) => (
                      <button
                        key={dir}
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => handleSugorokuMove(dir)}
                        disabled={!diceForRoom[dir] || playLoading || locked}
                      >
                        {dir} ({diceForRoom[dir] ?? 0})
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hint">Aguardando o dado da sala.</p>
                )}
                <div className="hero-actions">
                  <button className="btn btn-ghost" type="button" onClick={handleSugorokuStay} disabled={playLoading}>
                    Ficar
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={handleSugorokuBack} disabled={!canBack || playLoading}>
                    Voltar
                  </button>
                </div>
              </div>
              {penaltyInfo && penaltyInfo.player_ids?.length > 1 && penaltyOpener === currentPlayer?.id && (
                <div className="panel">
                  <h4>Penalidade da sala</h4>
                  <p className="hint">
                    Escolha quem perde {penaltyInfo.amount} ponto(s).
                  </p>
                  <div className="controller-grid">
                    {penaltyInfo.player_ids.map((id) => {
                      const target = room?.players?.find((p) => p.id === id)
                      return (
                        <button
                          key={id}
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => handlePenaltyChoice(id)}
                          disabled={playLoading}
                        >
                          {target?.name ?? `Jogador ${id}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : isLeilao ? (
            <div className="controller">
              <div className="panel-header">
                <h3>Leilão de Cem Votos</h3>
                <span className="pill">
                  Rodada {leilaoRound ?? 1}/{leilaoMaxRounds ?? 10}
                </span>
              </div>
              <div className="panel">
                <p className="lead">Pontos secretos: {points}</p>
                <p className="hint">
                  Pote atual: {leilaoPot ?? 100} (excedente {leilaoCarry ?? 0})
                </p>
                <p className="hint">Lance atual: {currentBid}</p>
                {leilaoTimeLeft !== null && <p className="hint">Tempo: {leilaoTimeLeft}s</p>}
                {leilaoSudden && (
                  <p className="hint">
                    Sudden death entre{' '}
                    {leilaoTiePlayers
                      .map((id) => room?.players?.find((p) => p.id === id)?.name ?? '—')
                      .join(', ')}
                  </p>
                )}
                {leilaoLastWinnerId && (
                  <p className="hint">
                    Último vencedor: {room?.players?.find((p) => p.id === leilaoLastWinnerId)?.name ?? '—'} (lance{' '}
                    {leilaoLastBid ?? 0})
                  </p>
                )}
              </div>
              <div className="panel">
                <h4>Seu lance</h4>
                <div className="stack">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={leilaoValue}
                    onChange={(event) => setLeilaoValue(event.target.value)}
                    placeholder="Ex: 20"
                  />
                  <button className="btn btn-primary" type="button" onClick={handleLeilaoBid} disabled={playLoading || !canBidLeilao}>
                    Enviar lance
                  </button>
                  {guessSent && <p className="hint">Lance enviado. Você pode atualizar até o fechamento.</p>}
                  {!canBidLeilao && <p className="hint">Sudden death: apenas os empatados podem apostar.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="controller">
              <button className="btn btn-primary">Ação principal</button>
              <div className="controller-grid">
                <button className="btn btn-ghost">A</button>
                <button className="btn btn-ghost">B</button>
                <button className="btn btn-ghost">C</button>
              </div>
            </div>
          )
        ) : (
          <div className="stack">
            <button className="btn btn-primary" type="button" onClick={handleReadyToggle} disabled={readyLoading}>
              {isReady ? 'Pronto!' : 'Marcar Ready'}
            </button>
            <p className="hint">Deixe a tela aberta. Quando começar, os botões aparecem aqui.</p>
          </div>
        )}
        {error && <p className="hint error">{error}</p>}
      </div>
    </section>
  )
}
