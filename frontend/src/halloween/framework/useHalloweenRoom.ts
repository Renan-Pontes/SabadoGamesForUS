import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { optionDefaults } from '../engine/helpers'
import type {
  BaseState,
  HInput,
  HPlayer,
  HalloweenEngine,
  HalloweenGameMeta,
  HalloweenView,
} from '../engine/types'
import { serverClock } from '../net/clock'
import { fetchSync, pushRoomState, type SyncPlayer, type SyncRoom } from '../net/sync'
import { getStateWriter } from '../net/stateWriter'
import { authorityStep, canJudge, type JudgeKind } from './authority'
import { judgeDeviceId } from './device'
import { isFresh, isInput, readRoomState, toHPlayers, type HalloweenRoomState } from './roomState'

/**
 * A sala de um jogo de Halloween, vista por um aparelho.
 *
 * Faz o poll do sync (barato quando nada mudou), mantém o relógio do
 * servidor e, se este aparelho for o juiz (a TV, ou o host quando a TV
 * some), roda o motor e grava o `room.state` novo. Os celulares só leem e
 * gravam o próprio `player.state` pela fila do writer.
 *
 * Nada aqui pode derrubar a tela: erro de rede vira aviso e nova tentativa,
 * erro do motor vira console.error e o juiz segue tentando no próximo passo.
 */

/** Intervalos de poll (ms). */
export const TV_POLL_MS = 1000
export const PHONE_POLL_MS = 1500
/** Relógio local do juiz: vence prazos entre um poll e outro. */
export const JUDGE_TICK_MS = 400
/** Intervalo mínimo entre duas gravações do juiz. */
const MIN_WRITE_GAP_MS = 250
/** Depois de um 409 (a sala trocou de jogo), o juiz espera isto antes de gravar de novo. */
const WRONG_GAME_PAUSE_MS = 3000

type Snapshot = {
  v: number
  /** O sync veio sem `mine` (com o estado de todos os jogadores)? */
  full: boolean
  me: number | null
  room: SyncRoom
  players: SyncPlayer[]
}

export type HalloweenRoomGame<S extends BaseState> = {
  meta: HalloweenGameMeta
  engine: HalloweenEngine<S>
}

export type HalloweenRoomApi<S extends BaseState> = {
  /** Ainda sem a primeira resposta do servidor. */
  loading: boolean
  /** Problema de rede persistente (a tela continua tentando). */
  error: string | null
  room: SyncRoom | null
  players: HPlayer[]
  me: HPlayer | null
  isHost: boolean
  /** Este aparelho está rodando o motor agora. */
  isJudge: boolean
  roomState: HalloweenRoomState<S>
  /** Estado da partida SEM `private` (null = configuração). */
  game: S | null
  options: Record<string, unknown>
  myInput: HInput | null
  /** Meu segredo (`g.private[meu id]`). */
  mine: unknown
  /** Slots de todos (TV) ou só os meus (celular). */
  slots: Record<string, Record<number, HInput | undefined>>
  now: () => number
  send: (fields: Record<string, unknown>) => void
  sendSlot: (slot: string, fields: Record<string, unknown>) => void
  command: (type: string, extra?: Record<string, unknown>) => void
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function vibrate(pattern: number) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Sem vibração (desktop, iOS): tudo bem.
  }
}

const noop = () => undefined

export function useHalloweenRoom<S extends BaseState>(
  code: string,
  view: HalloweenView,
  game: HalloweenRoomGame<S> | null,
): HalloweenRoomApi<S> {
  const writer = useMemo(() => getStateWriter(code), [code])
  const myState = useSyncExternalStore(writer.subscribe, writer.current)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isJudge, setIsJudge] = useState(false)

  const engine = game?.engine ?? null
  const meta = game?.meta ?? null

  // A máquina inteira (poll, juiz, gravação) vive dentro deste efeito: o
  // estado mutável fica em variáveis do fechamento, e o React só recebe
  // fotos prontas pelo setSnap.
  useEffect(() => {
    if (!code) return
    let stopped = false
    let snapshot: Snapshot | null = null
    let polling = false
    let writing = false
    let lastWriteAt = 0
    /** Até quando (relógio local) o juiz não grava: o backend disse que o jogo mudou. */
    let pauseWritesUntil = 0
    /** Versão da nossa última gravação: respostas mais velhas que ela são ignoradas. */
    let minV = 0
    let wantFull = view === 'tv'
    let judging = false
    let freeSince: number | null = null
    let resynced = false
    let failures = 0
    let lastEngineError: string | null = null
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    const deviceId = judgeDeviceId(view)

    const publish = () => {
      if (!stopped && snapshot) setSnap(snapshot)
    }

    const myKind = (): JudgeKind | null => {
      if (view === 'tv') return 'tv'
      if (!snapshot || snapshot.me === null) return null
      const mePlayer = snapshot.players.find((player) => player.id === snapshot?.me)
      return mePlayer?.is_host ? 'host' : null
    }

    const setJudging = (value: boolean) => {
      if (judging === value) return
      judging = value
      if (!stopped) setIsJudge(value)
    }

    const pollInterval = () => {
      if (view === 'tv' || judging) return TV_POLL_MS
      return meta?.phonePollMs ?? PHONE_POLL_MS
    }

    const write = async (next: HalloweenRoomState<S>) => {
      if (!snapshot) return
      writing = true
      const before = snapshot
      const sentAt = Date.now()
      try {
        const result = await pushRoomState(code, next as Record<string, unknown>, undefined, { slug: meta?.slug })
        if (stopped) return
        lastWriteAt = Date.now()
        serverClock.sample(result.t, sentAt, lastWriteAt)
        minV = Math.max(minV, result.v)
        const current: Snapshot = snapshot ?? before
        if (current.v < result.v) {
          // Só o juiz grava room.state, então o que gravamos é o mais novo.
          // Se a versão subiu exatamente 1, ninguém mais mexeu na sala e a
          // foto pode adotar a versão nova (o próximo poll vem "same").
          const adoptVersion = current === before && result.v === before.v + 1
          snapshot = {
            ...current,
            v: adoptVersion ? result.v : current.v,
            room: { ...current.room, state: next as Record<string, unknown> },
          }
          publish()
        }
      } catch (err) {
        if ((err as { status?: unknown } | null)?.status === 409) {
          // 409: a sala trocou de jogo (ou saiu do Halloween). Nada de
          // insistir: para de gravar um pouco e busca a sala agora — a foto
          // nova faz o juiz largar o jogo velho e a tela navegar sozinha.
          console.warn('[halloween] a sala trocou de jogo; este juiz para de gravar')
          pauseWritesUntil = Date.now() + WRONG_GAME_PAUSE_MS
          void loop()
        } else {
          console.error('[halloween] o juiz não conseguiu gravar a sala; tento de novo', err)
        }
      } finally {
        writing = false
      }
    }

    const judgeTick = () => {
      if (stopped || !snapshot || !engine || !meta || writing) return
      if (Date.now() < pauseWritesUntil) return
      if (typeof document !== 'undefined' && document.hidden) return
      const kind = myKind()
      if (!kind || !serverClock.ready()) {
        setJudging(false)
        return
      }
      if (Date.now() - lastWriteAt < MIN_WRITE_GAP_MS) return
      let result
      try {
        result = authorityStep({
          engine,
          meta,
          room: snapshot.room,
          players: snapshot.players,
          full: snapshot.full,
          now: serverClock.now(),
          device: { id: deviceId, kind },
          freeSince,
        })
      } catch (err) {
        // authorityStep já protege o motor; isto seria bug do framework.
        console.error('[halloween] falha no juiz', err)
        return
      }
      if (result.needsFull) wantFull = true
      if (!result.judge) wantFull = view === 'tv'
      setJudging(result.judge && !result.needsFull)
      if (result.error && result.error !== lastEngineError) {
        console.error(`[halloween] erro no motor de ${meta.slug}: ${result.error}`)
      }
      lastEngineError = result.error
      if (result.next) void write(result.next)
    }

    const onSnapshot = () => {
      if (!snapshot) return
      // A primeira foto desta tela acerta a cópia local do writer: o backend
      // zera o player.state em start/restart.
      if (!resynced && snapshot.me !== null && view !== 'tv') {
        const mine = snapshot.players.find((player) => player.id === snapshot?.me)
        if (mine && writer.resync(mine.state)) resynced = true
      }
      // O host acompanha o contrato de juiz mesmo sem julgar, para assumir
      // se a TV sumir.
      if (myKind() === 'host') {
        const auth = readRoomState(snapshot.room.state)._auth
        if (auth) freeSince = null
        else if (freeSince === null && serverClock.ready()) freeSince = serverClock.now()
        const kind: JudgeKind = 'host'
        if (canJudge(auth, { id: deviceId, kind }, serverClock.now(), freeSince)) wantFull = true
        else if (!judging) wantFull = false
      }
      publish()
    }

    const poll = async () => {
      if (stopped || polling) return
      polling = true
      try {
        const full = view === 'tv' || judging || wantFull
        // Trocando de "só o meu" para "todos", a versão que temos não serve.
        const knownV = snapshot && (snapshot.full || !full) ? snapshot.v : null
        const sentAt = Date.now()
        const response = await fetchSync(code, { v: knownV, mine: !full, tv: view === 'tv' })
        if (stopped) return
        serverClock.sample(response.t, sentAt, Date.now())
        if (!response.same && response.v >= minV) {
          snapshot = { v: response.v, full, me: response.me, room: response.room, players: response.players ?? [] }
          onSnapshot()
        }
        failures = 0
        setError(null)
      } catch (err) {
        failures += 1
        // Uma falha solta é normal no Wi-Fi da festa; só avisa se insistir.
        if (!snapshot || failures >= 3) setError(errorText(err) || 'Sem conexão com o servidor.')
      } finally {
        polling = false
      }
      judgeTick()
    }

    // Um laço só: se a aba voltar a aparecer no meio de um poll, o laço que
    // está rodando agenda o próximo — senão nasceriam dois laços em paralelo.
    let looping = false
    const loop = async () => {
      if (stopped || looping) return
      looping = true
      clearTimeout(pollTimer)
      try {
        if (typeof document === 'undefined' || !document.hidden) await poll()
      } finally {
        looping = false
      }
      if (!stopped) pollTimer = setTimeout(loop, pollInterval())
    }

    // Voltou para a aba: estado atual na hora, sem esperar o próximo ciclo.
    const onVisible = () => {
      if (!document.hidden) void loop()
    }

    void loop()
    const judgeTimer = setInterval(judgeTick, JUDGE_TICK_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(pollTimer)
      clearInterval(judgeTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, view, engine, meta, writer])

  // --- O que as telas veem -------------------------------------------------

  const roomState = useMemo(() => readRoomState<S>(snap?.room.state), [snap])
  const players = useMemo(() => toHPlayers(snap?.players ?? []), [snap])
  const meId = view === 'tv' ? null : (snap?.me ?? null)
  const me = useMemo(() => players.find((player) => player.id === meId) ?? null, [players, meId])
  const isHost = Boolean(me?.isHost)
  const rawGame = roomState.g ?? null

  const publicGame = useMemo(() => {
    if (!rawGame) return null
    const copy = { ...rawGame }
    delete copy.private
    return copy
  }, [rawGame])

  const options = useMemo(
    () => ({ ...(meta ? optionDefaults(meta.options) : {}), ...(roomState.setup ?? {}) }),
    [meta, roomState.setup],
  )

  const mine = rawGame && meId !== null ? (rawGame.private?.[String(meId)] ?? null) : null

  const fresh = isFresh(myState, roomState)
  const myInput =
    rawGame && fresh && isInput(myState.hw) && myState.hw.k === rawGame.inputKey ? myState.hw : null

  const slots = useMemo(() => {
    if (view === 'tv') {
      const all: Record<string, Record<number, HInput | undefined>> = {}
      for (const player of snap?.players ?? []) {
        const state = player.state
        if (!state || !isFresh(state, roomState) || typeof state.hws !== 'object' || !state.hws) continue
        for (const [slot, input] of Object.entries(state.hws as Record<string, unknown>)) {
          if (isInput(input)) all[slot] = { ...(all[slot] ?? {}), [player.id]: input }
        }
      }
      return all
    }
    const own: Record<string, Record<number, HInput | undefined>> = {}
    if (meId !== null && fresh && myState.hws) {
      for (const [slot, input] of Object.entries(myState.hws)) {
        if (isInput(input)) own[slot] = { [meId]: input }
      }
    }
    return own
  }, [view, snap, roomState, meId, fresh, myState])

  const inputKey = rawGame?.inputKey ?? null
  const matchId = roomState._m ?? null
  const lastCommand = roomState._cmd ?? 0

  const send = useCallback(
    (fields: Record<string, unknown>) => {
      if (meId === null || inputKey === null) return
      vibrate(15)
      writer.write({ m: matchId, hw: { ...fields, k: inputKey } }).catch(noop)
    },
    [writer, meId, inputKey, matchId],
  )

  const sendSlot = useCallback(
    (slot: string, fields: Record<string, unknown>) => {
      if (meId === null || inputKey === null) return
      writer.write({ m: matchId, hws: { [slot]: { ...fields, k: inputKey } } }).catch(noop)
    },
    [writer, meId, inputKey, matchId],
  )

  const command = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (meId === null) return
      vibrate(15)
      const id = Math.max(writer.current().cmd?.id ?? 0, lastCommand) + 1
      writer.write({ m: matchId, cmd: { ...extra, id, type } }).catch(noop)
    },
    [writer, meId, lastCommand, matchId],
  )

  const now = useCallback(() => serverClock.now(), [])

  return {
    loading: snap === null,
    error,
    room: snap?.room ?? null,
    players,
    me,
    isHost,
    isJudge,
    roomState,
    game: publicGame as S | null,
    options,
    myInput,
    mine,
    slots,
    now,
    send,
    sendSlot,
    command,
  }
}
