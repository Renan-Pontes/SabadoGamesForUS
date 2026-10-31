import type { HCommand, HInput } from '../engine/types'
import { postPlayerState, type Transport } from './sync'

/**
 * Fila de escrita do `player.state` de quem está com o celular.
 *
 * O backend SUBSTITUI o `player.state` inteiro a cada POST. Por isso o
 * aparelho guarda uma cópia local completa, mescla cada mudança nela e
 * grava a cópia inteira — um voto não apaga o desenho do slot, e um
 * comando do host não apaga o voto. Os envios saem em fila, um por vez:
 * se três toques chegam durante um envio, o próximo POST já leva os três.
 */

/** O que cada celular guarda no próprio `player.state`. */
export type MyState = {
  /** Partida a que estas respostas pertencem (`room.state._m`). */
  m?: string | null
  /** Resposta da fase atual. */
  hw?: HInput | null
  /** Respostas persistentes nomeadas (ex.: 'draw'). */
  hws?: Record<string, HInput>
  /** Último comando do host. */
  cmd?: HCommand | null
  [extra: string]: unknown
}

export type MyStatePatch = {
  m?: string | null
  hw?: HInput | null
  /** Só os slots enviados mudam; os outros ficam. */
  hws?: Record<string, HInput>
  cmd?: HCommand | null
}

/**
 * Mescla uma mudança no estado local. Partida nova (`m` diferente) zera o
 * que sobrou da anterior — senão um voto velho com o mesmo `inputKey`
 * valeria na partida seguinte.
 */
export function mergeMyState(base: MyState, patch: MyStatePatch): MyState {
  const next: MyState = { ...base }
  if ('m' in patch && (patch.m ?? null) !== (base.m ?? null)) {
    delete next.hw
    delete next.hws
    delete next.cmd
    next.m = patch.m ?? null
  }
  if ('hw' in patch) next.hw = patch.hw ?? null
  if (patch.hws) next.hws = { ...(next.hws ?? {}), ...patch.hws }
  if ('cmd' in patch) next.cmd = patch.cmd ?? null
  return next
}

export type StateWriter = {
  /** Mescla e agenda o envio; resolve quando esta mudança estiver gravada. */
  write(patch: MyStatePatch): Promise<void>
  /** A cópia local (sempre a mais nova que este aparelho conhece). */
  current(): MyState
  /** Este aparelho já escreveu alguma coisa nesta sala? */
  hasWritten(): boolean
  /** Algo ainda não chegou ao servidor? */
  pending(): boolean
  /**
   * Adota o estado do servidor como verdade — só quando não há nada
   * pendente. Use ao abrir a tela (o backend zera tudo em start/restart).
   */
  resync(serverState: Record<string, unknown> | null | undefined): boolean
  /** Avisa a cada mudança local (para a tela redesenhar na hora). */
  subscribe(listener: () => void): () => void
}

export type StateWriterOptions = {
  transport?: Transport
  /** Espera antes de tentar de novo, multiplicada pelas falhas seguidas. */
  retryMs?: number
  /** Falhas seguidas antes de desistir (até a próxima escrita). */
  maxFailures?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Rede caiu, servidor engasgou (5xx), demora (408) ou limite (429): vale
 * tentar de novo. Recusa de verdade (sem login, fora da sala) não melhora
 * insistindo.
 */
function worthRetrying(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status !== 'number') return true
  return status >= 500 || status === 408 || status === 429
}

export function createStateWriter(code: string, options: StateWriterOptions = {}): StateWriter {
  const { transport, retryMs = 600, maxFailures = 8 } = options
  let state: MyState = {}
  let wrote = false
  let dirty = false
  let inFlight = false
  let waiters: { resolve: () => void; reject: (error: unknown) => void }[] = []
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((listener) => listener())

  async function pump() {
    if (inFlight) return
    inFlight = true
    let failures = 0
    try {
      while (dirty) {
        dirty = false
        const batch = waiters
        waiters = []
        try {
          await postPlayerState(code, state as Record<string, unknown>, transport)
          failures = 0
          batch.forEach((waiter) => waiter.resolve())
        } catch (error) {
          failures += 1
          if (failures >= maxFailures || !worthRetrying(error)) {
            // Desiste por ora; a próxima escrita leva tudo de novo (a cópia
            // local continua com estas mudanças).
            console.error('[halloween] não consegui gravar o estado do jogador', error)
            ;[...batch, ...waiters].forEach((waiter) => waiter.reject(error))
            waiters = []
            dirty = false
            break
          }
          waiters = [...batch, ...waiters]
          dirty = true
          await sleep(Math.min(retryMs * failures, 3000))
        }
      }
    } finally {
      inFlight = false
    }
  }

  return {
    write(patch) {
      state = mergeMyState(state, patch)
      wrote = true
      dirty = true
      notify()
      const done = new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }))
      void pump()
      return done
    },
    current: () => state,
    hasWritten: () => wrote,
    pending: () => dirty || inFlight,
    resync(serverState) {
      if (dirty || inFlight) return false
      const next = (serverState && typeof serverState === 'object' ? serverState : {}) as MyState
      if (JSON.stringify(next) !== JSON.stringify(state)) {
        state = { ...next }
        notify()
      }
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const writers = new Map<string, StateWriter>()

/**
 * O writer da sala (um por código, compartilhado pela página inteira — dois
 * writers do mesmo jogador apagariam as escritas um do outro).
 */
export function getStateWriter(code: string): StateWriter {
  const key = code.toUpperCase()
  let writer = writers.get(key)
  if (!writer) {
    writer = createStateWriter(key)
    writers.set(key, writer)
  }
  return writer
}

/** Mescla `patch` no meu `player.state` e grava (em fila, sem perder nada). */
export function writeMyState(code: string, patch: MyStatePatch): Promise<void> {
  return getStateWriter(code).write(patch)
}
