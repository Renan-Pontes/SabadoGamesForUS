/**
 * Barramento dos sustos: quem quer assustar emite, o overlay (montado uma vez
 * pela camada global) escuta. Sem React aqui — dá para testar em Node.
 */

export const SCARE_KINDS = [
  'doot',
  'zoom',
  'scream',
  'pumpkin',
  'pipe',
  'skeletons',
  'spider',
  'static',
  'bruh',
  'eyes',
] as const

export type ConcreteScare = (typeof SCARE_KINDS)[number]
export type ScareKind = 'random' | ConcreteScare

/** Sustos que ficam melhores com o nome de alguém da sala. */
export const SCARES_WITH_NAME: readonly ConcreteScare[] = ['zoom', 'eyes']

export type ScareRequest = { id: number; kind: ConcreteScare; name?: string }

type Listener = (request: ScareRequest) => void

const listeners = new Set<Listener>()
let sequence = 0
let lastKind: ConcreteScare | null = null
let suppressCount = 0
let showing = false
const nameSources = new Map<string, string[]>()

export function isConcreteScare(value: unknown): value is ConcreteScare {
  return typeof value === 'string' && (SCARE_KINDS as readonly string[]).includes(value)
}

/** Sorteia um susto, evitando repetir o último. */
export function pickScare(random: () => number = Math.random, avoid: ConcreteScare | null = lastKind) {
  const pool = avoid ? SCARE_KINDS.filter((kind) => kind !== avoid) : [...SCARE_KINDS]
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** 'random' (ou um nome desconhecido vindo da rede) vira um susto de verdade. */
export function resolveScareKind(kind: unknown, random: () => number = Math.random): ConcreteScare {
  return isConcreteScare(kind) ? kind : pickScare(random)
}

/** Emite um susto para o overlay. Devolve o pedido (ou null se ninguém está ouvindo). */
export function emitScare(kind: unknown, options: { name?: string | null } = {}): ScareRequest | null {
  const concrete = resolveScareKind(kind)
  lastKind = concrete
  let name = options.name?.trim() || undefined
  if (!name && SCARES_WITH_NAME.includes(concrete)) name = randomScareName()
  const request: ScareRequest = { id: (sequence += 1), kind: concrete, name }
  if (listeners.size === 0) return null
  for (const listener of [...listeners]) listener(request)
  return request
}

export function onScare(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// --- Supressão (revelações, votações) --------------------------------------

/** Suspende os sustos aleatórios até a função devolvida ser chamada. */
export function suppressScares(): () => void {
  suppressCount += 1
  let released = false
  return () => {
    if (released) return
    released = true
    suppressCount = Math.max(0, suppressCount - 1)
  }
}

export function isScareSuppressed(): boolean {
  return suppressCount > 0
}

// --- Susto na tela agora ----------------------------------------------------

export function setScareShowing(value: boolean) {
  showing = value
}

export function isScareShowing(): boolean {
  return showing
}

// --- Nomes dos jogadores (para o zoom suspeito e os olhos no escuro) --------

export function setScareNames(source: string, names: string[]) {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  if (clean.length) nameSources.set(source, clean)
  else nameSources.delete(source)
}

export function clearScareNames(source: string) {
  nameSources.delete(source)
}

export function scareNames(): string[] {
  return [...new Set([...nameSources.values()].flat())]
}

export function randomScareName(random: () => number = Math.random): string | undefined {
  const names = scareNames()
  if (!names.length) return undefined
  return names[Math.min(names.length - 1, Math.floor(random() * names.length))]
}
