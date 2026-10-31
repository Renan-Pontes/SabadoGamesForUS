import { optionDefaults, sanitizeOptions } from '../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine, HalloweenGameMeta } from '../engine/types'
import type { SyncPlayer } from '../net/sync'
import {
  collectInputs,
  pendingCommand,
  readRoomState,
  stableStringify,
  toHPlayers,
  type HalloweenRoomState,
} from './roomState'

/**
 * A decisão do juiz, sem React e sem rede: recebe o que o aparelho sabe da
 * sala e devolve o `room.state` que ele deve gravar (ou null se nada mudou).
 * O hook chama isto a cada poll e num relógio local; o teste ponta a ponta
 * em Node chama direto, contra o backend local.
 */

/** Duração do contrato de juiz. */
export const LEASE_MS = 9000
/** Renova quando faltar menos que isto. */
export const RENEW_WHEN_LEFT_MS = 5000
/** O host só assume com o contrato vencido há este tempo (dá chance à TV). */
export const HOST_GRACE_MS = 6000

export type JudgeKind = 'tv' | 'host'
export type JudgeDevice = { id: string; kind: JudgeKind }

/** Aparelhos de TV têm id começando com "tv-" (a TV sempre tem preferência). */
export function isTvDevice(deviceId: string): boolean {
  return deviceId.startsWith('tv-')
}

/**
 * Este aparelho pode ser o juiz agora?
 * - TV: quando o contrato está livre, vencido, é dela, ou está com um celular.
 * - Host: quando o contrato é dele, ou venceu há `HOST_GRACE_MS` (sem
 *   contrato nenhum, conta desde `freeSince`, quando ele viu a vaga).
 */
export function canJudge(
  auth: HalloweenRoomState['_auth'],
  device: JudgeDevice,
  now: number,
  freeSince: number | null = null,
): boolean {
  if (auth && auth.d === device.id) return true
  if (device.kind === 'tv') return !auth || now >= auth.u || !isTvDevice(auth.d)
  if (auth) return now >= auth.u + HOST_GRACE_MS
  return freeSince !== null && now >= freeSince + HOST_GRACE_MS
}

export type AuthorityInput<S extends BaseState> = {
  engine: HalloweenEngine<S>
  meta: Pick<HalloweenGameMeta, 'slug' | 'options' | 'minPlayers'>
  room: { status: string; state: unknown; game?: { slug: string } | null }
  players: readonly SyncPlayer[]
  /** Os `state` de todos os jogadores vieram (sync sem `mine`)? */
  full: boolean
  /** Agora, em ms do servidor. */
  now: number
  device: JudgeDevice
  /** Desde quando (ms do servidor) este aparelho vê a sala sem contrato. */
  freeSince?: number | null
  rng?: () => number
}

export type AuthorityResult<S extends BaseState> = {
  /** Este aparelho é (ou acabou de virar) o juiz. */
  judge: boolean
  /** Pode julgar, mas precisa do sync completo antes (estava com `mine=1`). */
  needsFull: boolean
  /** O `room.state` a gravar; null = nada mudou. */
  next: HalloweenRoomState<S> | null
  /** Erro do motor neste passo (já registrado em `next._err`). */
  error: string | null
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

const IDLE = { judge: false, needsFull: false, next: null, error: null } as const

export function authorityStep<S extends BaseState>(input: AuthorityInput<S>): AuthorityResult<S> {
  const { engine, meta, room, players, now, device } = input
  if (room.status !== 'live') return IDLE
  // Tela velha de outro jogo: quem julga é a tela do jogo certo.
  if (room.game?.slug && room.game.slug !== meta.slug) return IDLE

  const current = readRoomState<S>(room.state)
  if (!canJudge(current._auth, device, now, input.freeSince ?? null)) return IDLE
  // Sem o estado de todo mundo, rodar o motor seria contar todo mundo como "não respondeu".
  if (!input.full) return { judge: true, needsFull: true, next: null, error: null }

  const rng = input.rng ?? Math.random
  const next: HalloweenRoomState<S> = { ...current }
  let error: string | null = null

  const auth = current._auth
  if (!auth || auth.d !== device.id || auth.u - now < RENEW_WHEN_LEFT_MS) {
    next._auth = { d: device.id, u: now + LEASE_MS }
  }

  const hPlayers = toHPlayers(players)
  const { inputs, slots } = collectInputs(players, current)
  const options = { ...optionDefaults(meta.options), ...(current.setup ?? {}) }
  const ctx: EngineCtx = { players: hPlayers, inputs, slots, command: null, now, rng, options }
  const g = current.g ?? null
  const command = pendingCommand(players, current)

  const run = (label: string, fn: () => S) => {
    try {
      const result = fn()
      next.g = result
      next._err = null
    } catch (err) {
      error = `${label}: ${message(err)}`
      next._err = error
    }
  }

  if (command) {
    // O comando é consumido aconteça o que acontecer: um comando que faz o
    // motor lançar erro não pode travar a sala repetindo para sempre.
    next._cmd = command.id
    switch (command.type) {
      case 'begin': {
        if (g) break
        const chosen = sanitizeOptions(meta.options, command.options as Record<string, unknown> | undefined)
        next.setup = chosen
        const online = hPlayers.filter((player) => player.online).length
        if (online < meta.minPlayers) {
          error = `Precisa de pelo menos ${meta.minPlayers} pessoas online (tem ${online}).`
          next._err = error
          break
        }
        run('init', () => engine.init({ ...ctx, options: chosen }))
        if (!error) next._m = `${now.toString(36)}${Math.floor(rng() * 1e8).toString(36)}`
        break
      }
      case 'replay':
        // Volta à configuração; as opções ficam para o host só apertar "Começar".
        next.g = null
        next._err = null
        break
      case 'end':
        if (g && !g.over) next.g = { ...g, over: true, deadline: null }
        break
      default:
        if (g && !g.over) run('step', () => engine.step(g, { ...ctx, command }))
    }
  } else if (g && !g.over) {
    run('step', () => engine.step(g, ctx))
  }

  const changed = stableStringify(next) !== stableStringify(current)
  return { judge: true, needsFull: false, next: changed ? next : null, error }
}
