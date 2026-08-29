import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getRoom } from '../lib/api'
import { saveLastRoom, setStayInLobby } from '../lib/roomHistory'
import type { Player, Room } from '../lib/types'
import { playerState } from './utils'

export type ViewMode = 'tv' | 'host' | 'player'

type UseGameRoomOptions = {
  /**
   * Endpoint de tick do jogo. Avança o relógio no servidor.
   * Host e TV chamam a cada poll; jogadores só chamam quando o prazo já
   * venceu — assim a partida não trava se o host fechar a aba.
   */
  tick?: (code: string) => Promise<Room>
  /** Intervalo do poll em ms. Use valores baixos em jogos de relógio curto. */
  pollMs?: number
}

/**
 * Toda a fiação comum dos minigames: guarda de autenticação, poll da sala,
 * identificação do jogador local e navegação.
 *
 * Antes isso estava copiado em cada arquivo de jogo, com pequenas divergências
 * entre eles. Agora existe num lugar só.
 */
export function useGameRoom({ tick, pollMs = 2500 }: UseGameRoomOptions = {}) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()

  const viewParam = searchParams.get('view')
  const viewMode: ViewMode =
    viewParam === 'tv' || viewParam === 'host' || viewParam === 'player' ? viewParam : 'player'
  const isTv = viewMode === 'tv'

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Mantém o tick acessível ao loop de poll sem reiniciá-lo a cada render.
  const tickRef = useRef(tick)
  tickRef.current = tick
  const inFlight = useRef(false)
  const deadlineRef = useRef<number | null>(null)

  // Sem login não dá pra jogar — a TV é a única tela anônima.
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isTv) {
      navigate('/')
    }
  }, [authLoading, isAuthenticated, isTv, navigate])

  useEffect(() => {
    if (!code || isTv) return
    saveLastRoom(code, viewMode === 'host' ? 'host' : 'player')
  }, [code, isTv, viewMode])

  const fetchRoom = useCallback(async () => {
    if (!code || inFlight.current) return
    inFlight.current = true
    try {
      const runTick = tickRef.current
      // Host e TV são os relógios da sala. O jogador só cutuca o servidor
      // quando o prazo já passou, para destravar rodadas órfãs.
      const deadlinePassed =
        deadlineRef.current !== null && deadlineRef.current <= Date.now() / 1000

      if (runTick && (viewMode !== 'player' || deadlinePassed)) {
        await runTick(code).catch(() => undefined)
      }

      // `retrieve` também renova o last_seen_at do jogador, então é sempre
      // a última chamada do ciclo.
      const data = await getRoom(code)
      setRoom(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a sala.')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [code, viewMode])

  useEffect(() => {
    if (!code) return
    let cancelled = false

    const run = () => {
      if (cancelled || document.hidden) return
      void fetchRoom()
    }

    run()
    const interval = window.setInterval(run, pollMs)
    // Voltar para a aba deve mostrar o estado atual na hora.
    const onVisible = () => {
      if (!document.hidden) run()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, fetchRoom, pollMs])

  const state = useMemo(() => (room?.state ?? {}) as Record<string, unknown>, [room])
  const players = useMemo(() => room?.players ?? [], [room?.players])

  // Guarda o prazo atual para o auto-tick do jogador.
  const deadline = typeof state.deadline_ts === 'number' ? state.deadline_ts : null
  deadlineRef.current = deadline

  const me = useMemo<Player | null>(() => {
    if (!players.length || !user?.id) return null
    return players.find((player) => player.user?.id === user.id) ?? null
  }, [players, user?.id])

  const meState = useMemo(() => playerState(me), [me])
  const isHost = Boolean(me?.is_host)

  const goBack = useCallback(() => {
    if (!code) return
    setStayInLobby(code, true)
    navigate(isHost ? `/host/${code}` : `/play/${code}`)
  }, [code, isHost, navigate])

  const toggleView = useCallback(() => {
    if (!code) return
    navigate(`/game/${code}?view=${viewMode === 'host' ? 'player' : 'host'}`)
  }, [code, navigate, viewMode])

  return {
    code,
    viewMode,
    isTv,
    room,
    setRoom,
    /** Estado global da sala (JSON do backend). */
    state,
    deadline,
    players,
    me,
    meState,
    isHost,
    /** Só o host pode alternar entre a visão de host e a de jogador. */
    canToggleView: !isTv && isHost,
    loading: authLoading || loading,
    error,
    setError,
    refresh: fetchRoom,
    goBack,
    toggleView,
    status: room?.status,
    isLive: room?.status === 'live',
    isEnded: room?.status === 'ended',
  }
}
