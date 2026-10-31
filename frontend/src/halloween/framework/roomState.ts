import type { BaseState, HCommand, HInput, HPlayer } from '../engine/types'
import type { SyncPlayer } from '../net/sync'

/**
 * Formato do `room.state` dos jogos de Halloween e as leituras que o juiz e
 * as telas fazem dele. Tudo puro: o mesmo código roda no navegador e nos
 * testes em Node.
 */
export type HalloweenRoomState<S extends BaseState = BaseState> = {
  /** Estado do motor; null/ausente = tela de configuração. */
  g?: S | null
  /** Opções escolhidas pelo host (viram `ctx.options`). */
  setup?: Record<string, unknown> | null
  /** Id do último comando do host já processado. */
  _cmd?: number
  /** Contrato de juiz: qual aparelho e até quando (ms do servidor). */
  _auth?: { d: string; u: number } | null
  /**
   * Id da partida, novo a cada "Começar". Os celulares marcam as respostas
   * com ele: resposta de outra partida (mesmo `inputKey`) não vale.
   */
  _m?: string | null
  /** Último erro do motor, para o host entender o que houve. */
  _err?: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEngineState(value: unknown): value is BaseState {
  return (
    isObject(value) &&
    typeof value.phase === 'string' &&
    typeof value.inputKey === 'string' &&
    Array.isArray(value.roster)
  )
}

/** Lê o `room.state` com tolerância: lixo vira "configuração". */
export function readRoomState<S extends BaseState = BaseState>(raw: unknown): HalloweenRoomState<S> {
  const source = isObject(raw) ? raw : {}
  const result: HalloweenRoomState<S> = { ...(source as HalloweenRoomState<S>) }
  result.g = isEngineState(source.g) ? (source.g as S) : null
  result.setup = isObject(source.setup) ? source.setup : null
  result._cmd = typeof source._cmd === 'number' ? source._cmd : 0
  const auth = source._auth
  result._auth =
    isObject(auth) && typeof auth.d === 'string' && typeof auth.u === 'number' ? { d: auth.d, u: auth.u } : null
  result._m = typeof source._m === 'string' ? source._m : null
  result._err = typeof source._err === 'string' ? source._err : null
  return result
}

/** Jogadores como o motor enxerga, na ordem de entrada na sala. */
export function toHPlayers(players: readonly SyncPlayer[]): HPlayer[] {
  return [...players]
    .sort((a, b) => String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? '')) || a.id - b.id)
    .map((player) => ({
      id: player.id,
      name: player.name || `Jogador ${player.id}`,
      isHost: Boolean(player.is_host),
      online: player.online !== false,
    }))
}

export function isInput(value: unknown): value is HInput {
  return isObject(value) && typeof value.k === 'string'
}

/**
 * As respostas deste jogador valem para a partida atual? Quem gravou com o
 * framework marca a partida (`m`); sem marca (escrita crua, testes) vale.
 */
export function isFresh(playerState: Record<string, unknown> | null | undefined, roomState: HalloweenRoomState) {
  const m = playerState?.m
  return m === undefined || m === null || m === roomState._m
}

/** `ctx.inputs` e `ctx.slots` a partir do `player.state` de cada um. */
export function collectInputs(players: readonly SyncPlayer[], roomState: HalloweenRoomState) {
  const inputs: Record<number, HInput | undefined> = {}
  const slots: Record<string, Record<number, HInput | undefined>> = {}
  for (const player of players) {
    const state = player.state
    if (!isObject(state) || !isFresh(state, roomState)) continue
    if (isInput(state.hw)) inputs[player.id] = state.hw
    if (isObject(state.hws)) {
      for (const [slot, input] of Object.entries(state.hws)) {
        if (!isInput(input)) continue
        slots[slot] = { ...(slots[slot] ?? {}), [player.id]: input }
      }
    }
  }
  return { inputs, slots }
}

/** O comando do host que o motor ainda não viu (id maior que `_cmd`), ou null. */
export function pendingCommand(players: readonly SyncPlayer[], roomState: HalloweenRoomState): HCommand | null {
  const last = roomState._cmd ?? 0
  for (const player of players) {
    if (!player.is_host || !isObject(player.state)) continue
    const cmd = player.state.cmd
    if (isObject(cmd) && typeof cmd.id === 'number' && typeof cmd.type === 'string' && cmd.id > last) {
      return cmd as HCommand
    }
  }
  return null
}

/** JSON com as chaves em ordem: o banco pode devolver as chaves embaralhadas. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item ?? null)).join(',')}]`
  if (isObject(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value ?? null)
}
