import { seededRng } from './helpers'
import type { BaseState, EngineCtx, HCommand, HInput, HPlayer, HalloweenEngine } from './types'

/**
 * Kit de testes dos motores: jogadores de mentira, um ctx pronto e uma
 * simulação de partida inteira dirigida só pelo `bot` do motor.
 *
 * A simulação faz o papel do framework: guarda as respostas como o servidor
 * guardaria, passa o estado por JSON (como o banco faz), avança o relógio e
 * confere as regras do contrato a cada passo — idempotência, roster fixo,
 * campos obrigatórios. Quando algo quebra, a mensagem diz o passo e a fase.
 */

const SPOOKY_NAMES = [
  'Vlad', 'Mortícia', 'Gasparzinho', 'Cuca', 'Saci', 'Wandinha', 'Frank',
  'Múmia', 'Iara', 'Chuck', 'Samara', 'Freddy', 'Lobisomem', 'Bruxa', 'Zé do Caixão',
  'Fantasma', 'Corvo', 'Abóbora', 'Caveira', 'Morcego',
]

/** `n` jogadores com ids 1..n; o primeiro é o host. */
export function makePlayers(n: number, options: { offline?: readonly number[] } = {}): HPlayer[] {
  const offline = new Set(options.offline ?? [])
  return Array.from({ length: n }, (_, index) => {
    const id = index + 1
    return {
      id,
      name: SPOOKY_NAMES[index] ?? `Assombração ${id}`,
      isHost: index === 0,
      online: !offline.has(id),
    }
  })
}

/** Um ctx completo com valores padrão; sobrescreva o que o teste precisa. */
export function makeCtx(partial: Partial<EngineCtx> = {}): EngineCtx {
  return {
    players: makePlayers(4),
    inputs: {},
    slots: {},
    command: null,
    now: 1_000_000,
    rng: seededRng(1),
    options: {},
    ...partial,
  }
}

export type SimulationOptions = {
  /** Quantidade de jogadores (ids 1..n) ou a lista pronta. Padrão: 4. */
  players?: number | HPlayer[]
  seed?: number
  options?: Record<string, unknown>
  /** Desiste (com erro) se não chegar em `over` nesta quantidade de passos. */
  maxSteps?: number
  /** Chance de cada bot agir a cada passo (padrão 1: responde na hora). */
  actProbability?: number
  /** Jogadores offline do começo ao fim: nunca respondem. */
  offlineIds?: readonly number[]
  /** Chance de o host mandar 'skip' a cada passo (padrão 0). */
  skipProbability?: number
  /** Quanto o relógio anda por passo (padrão 1000 ms). */
  stepMs?: number
  /** Relógio inicial (ms do servidor). */
  startAt?: number
}

export type SimulationResult<S extends BaseState> = {
  state: S
  steps: number
  /** Cada estado diferente pelo qual a partida passou, começando pelo do init. */
  history: S[]
}

function fail(step: number, state: BaseState | null, message: string): never {
  const where = state ? ` (passo ${step}, fase "${state.phase}")` : ` (passo ${step})`
  throw new Error(`${message}${where}`)
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** Primeiro valor que não sobrevive a JSON (NaN, função, undefined em lista...). */
function jsonIssue(value: unknown, path = 'state'): string | null {
  if (value === null) return null
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return null
    case 'number':
      return Number.isFinite(value) ? null : `${path} é ${value} (vira null no JSON)`
    case 'undefined':
      return null
    case 'object': {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          if (value[i] === undefined) return `${path}[${i}] é undefined (vira null no JSON)`
          const issue = jsonIssue(value[i], `${path}[${i}]`)
          if (issue) return issue
        }
        return null
      }
      const proto = Object.getPrototypeOf(value)
      if (proto !== Object.prototype && proto !== null) {
        return `${path} não é um objeto simples (Map, Set, Date e classes não viram JSON)`
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const issue = jsonIssue(child, `${path}.${key}`)
        if (issue) return issue
      }
      return null
    }
    default:
      return `${path} é ${typeof value} (não vira JSON)`
  }
}

function checkShape(state: BaseState, step: number, roster: readonly number[] | null) {
  if (!state || typeof state !== 'object') fail(step, null, 'o motor devolveu algo que não é um estado')
  if (typeof state.phase !== 'string') fail(step, state, 'state.phase precisa ser texto')
  if (typeof state.inputKey !== 'string') fail(step, state, 'state.inputKey precisa ser texto')
  if (state.deadline !== null && typeof state.deadline !== 'number') {
    fail(step, state, 'state.deadline precisa ser número ou null (nunca undefined)')
  }
  if (typeof state.over !== 'boolean') fail(step, state, 'state.over precisa ser true/false')
  if (!Array.isArray(state.roster) || state.roster.some((id) => typeof id !== 'number')) {
    fail(step, state, 'state.roster precisa ser uma lista de ids')
  }
  if (roster && (state.roster.length !== roster.length || state.roster.some((id, i) => id !== roster[i]))) {
    fail(step, state, 'state.roster mudou no meio da partida (ele é fixo desde o init)')
  }
  const issue = jsonIssue(state)
  if (issue) fail(step, state, issue)
}

/**
 * Joga uma partida inteira só com bots e o relógio andando.
 *
 * A cada passo: os bots online respondem a fase (cada um uma vez por
 * `inputKey`), o host às vezes manda 'skip', o motor dá um `step` e o
 * relógio anda `stepMs`. Falha com mensagem clara se `step`/`init`/`bot`
 * lançar exceção, se `step` não for idempotente (repetir o step com o mesmo
 * ctx — sem o comando, que o framework entrega uma vez só — não pode mudar
 * nada) ou se a partida não chegar em `over` dentro de `maxSteps`.
 */
export function runSimulation<S extends BaseState>(
  engine: HalloweenEngine<S>,
  options: SimulationOptions = {},
): SimulationResult<S> {
  const {
    seed = 1,
    maxSteps = 20_000,
    actProbability = 1,
    skipProbability = 0,
    stepMs = 1000,
    startAt = 1_000_000,
  } = options
  const offline = new Set(options.offlineIds ?? [])
  const basePlayers = typeof options.players === 'number' || options.players === undefined
    ? makePlayers(options.players ?? 4)
    : options.players
  const players = basePlayers.map((player) => ({ ...player, online: player.online && !offline.has(player.id) }))
  const host = players.find((player) => player.isHost) ?? players[0]
  const rng = seededRng(seed)
  // Sorte separada para os bots e o host, para não mexer na sequência do motor.
  const tableRng = seededRng(seed * 7919 + 17)

  // O "servidor": o que cada jogador gravou por último.
  const inputs: Record<number, HInput | undefined> = {}
  const slots: Record<string, Record<number, HInput | undefined>> = {}
  let now = startAt
  let commandId = 0

  const ctxFor = (command: HCommand | null): EngineCtx => ({
    players,
    inputs: { ...inputs },
    slots: Object.fromEntries(Object.entries(slots).map(([name, bySlot]) => [name, { ...bySlot }])),
    command,
    now,
    rng,
    options: { ...(options.options ?? {}) },
  })

  let state: S
  try {
    state = engine.init(ctxFor(null))
  } catch (error) {
    fail(0, null, `init lançou exceção: ${errorText(error)}`)
  }
  checkShape(state, 0, null)
  const roster = [...state.roster]
  state = JSON.parse(JSON.stringify(state)) as S
  const history: S[] = [state]

  for (let step = 1; step <= maxSteps; step += 1) {
    if (state.over) return { state, steps: step - 1, history }

    // 1. Bots respondem (uma vez por inputKey), como os celulares fariam.
    for (const player of players) {
      if (!player.online || !state.roster.includes(player.id)) continue
      if (tableRng() >= actProbability) continue
      const answeredInput = inputs[player.id]?.k === state.inputKey
      const answeredSlot = Object.values(slots).some((bySlot) => bySlot[player.id]?.k === state.inputKey)
      if (answeredInput || answeredSlot) continue
      let reply: Record<string, unknown> | null
      try {
        reply = engine.bot(state, player.id, { ...ctxFor(null), rng: tableRng })
      } catch (error) {
        fail(step, state, `bot do jogador ${player.id} lançou exceção: ${errorText(error)}`)
      }
      if (!reply) continue
      const { _slot, ...fields } = reply
      const input: HInput = { ...fields, k: state.inputKey }
      if (typeof _slot === 'string') {
        slots[_slot] = { ...(slots[_slot] ?? {}), [player.id]: input }
      } else {
        inputs[player.id] = input
      }
    }

    // 2. O host às vezes pula a fase.
    const command: HCommand | null =
      skipProbability > 0 && tableRng() < skipProbability
        ? { id: ++commandId, type: 'skip', by: host?.id }
        : null

    // 3. O juiz roda o motor — e roda de novo para provar a idempotência.
    const ctx = ctxFor(command)
    let next: S
    try {
      next = engine.step(state, ctx)
    } catch (error) {
      fail(step, state, `step lançou exceção: ${errorText(error)}`)
    }
    checkShape(next, step, roster)

    let again: S
    try {
      again = engine.step(next, { ...ctx, command: null })
    } catch (error) {
      fail(step, next, `step lançou exceção ao repetir o mesmo ctx: ${errorText(error)}`)
    }
    if (JSON.stringify(again) !== JSON.stringify(next)) {
      fail(step, next, 'step não é idempotente: repetir com o mesmo ctx mudou o estado de novo')
    }
    if (again !== next) {
      fail(step, next, 'step devolveu um objeto novo sem mudar nada (devolva o MESMO estado)')
    }

    if (next !== state) {
      state = JSON.parse(JSON.stringify(next)) as S
      history.push(state)
    }
    now += stepMs
  }

  if (state.over) return { state, steps: maxSteps, history }
  return fail(maxSteps, state, `a partida não chegou em over em ${maxSteps} passos`)
}
