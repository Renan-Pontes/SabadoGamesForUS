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
  'animatronic',
  'face',
] as const

/**
 * O susto raro: o Penetra da festa. Fica fora do sorteio (nem os sustos de
 * 4–9 min nem o botão do host o escolhem) — só aparece pela chance de 1 em
 * 5000 por segundo (fx/rareScare.ts) ou se alguém pedir pelo nome.
 */
export const RARE_SCARE = 'penetra'

/**
 * Efeitos de Natal da TV: momentos de comédia, nada de susto. Ficam fora do
 * sorteio de Halloween ('random') — os jogos "Old" continuam com os deles.
 */
export const XMAS_EFFECTS = [
  'hohoho',
  'blizzard',
  'giftRain',
  'reindeer',
  'lightsParty',
  'secretSanta',
  'elfChoir',
] as const

export type XmasEffect = (typeof XMAS_EFFECTS)[number]

/** O sorteio de Natal ('festive'): os efeitos de Natal e o zoom suspeito 🤨📸 (que ganhou gorro). */
export const FESTIVE_EFFECTS = [...XMAS_EFFECTS, 'zoom'] as const

export type FestiveEffect = (typeof FESTIVE_EFFECTS)[number]

export type ConcreteScare = (typeof SCARE_KINDS)[number] | typeof RARE_SCARE | XmasEffect
/**
 * 'random' = sorteio de Halloween com peso; 'scary' = só entre os
 * assustadores de verdade; 'festive' = um efeito de Natal sorteado.
 */
export type ScareKind = 'random' | 'scary' | 'festive' | ConcreteScare

/** Pedido de susto assustador sorteado (botão "Susto" do host, "Testar susto" da TV). */
export const SCARY_RANDOM = 'scary'

/** Pedido de efeito de Natal sorteado (botão grande do painel do host, "Testar efeito" da TV). */
export const FESTIVE_RANDOM = 'festive'

export function isXmasEffect(value: unknown): value is XmasEffect {
  return typeof value === 'string' && (XMAS_EFFECTS as readonly string[]).includes(value)
}

/** Efeito de Natal (inclui o zoom, que é dos dois mundos). */
export function isFestiveEffect(value: unknown): value is FestiveEffect {
  return typeof value === 'string' && (FESTIVE_EFFECTS as readonly string[]).includes(value)
}

/** Os que assustam de verdade (som alto, sem meme). */
export const SCARY_SCARES = ['animatronic', 'face', 'scream', 'static'] as const satisfies readonly (typeof SCARE_KINDS)[number][]

/** Os de meme: o resto do sorteio. */
export const MEME_SCARES = SCARE_KINDS.filter((kind) => !(SCARY_SCARES as readonly string[]).includes(kind))

/** No 'random', a chance de sair um dos assustadores (o resto é meme). */
export const SCARY_SHARE = 2 / 3

/**
 * Sustos automáticos da TV (4–9 min): um assustador só sai se o último
 * assustador (de qualquer origem: host, jogo, teste, o raro) foi há pelo menos
 * este tempo; antes disso sai um de meme. Susto alto toda hora vira rotina e
 * a sala se acostuma — os grandes ficam para os botões do host.
 */
export const AUTO_SCARY_GAP_MS = 15 * 60_000

/** Sustos (e efeitos de Natal) que ficam melhores com o nome de alguém da sala. */
export const SCARES_WITH_NAME: readonly ConcreteScare[] = ['zoom', 'eyes', 'hohoho', 'secretSanta']

export type ScareRequest = { id: number; kind: ConcreteScare; name?: string }

type Listener = (request: ScareRequest) => void

const listeners = new Set<Listener>()
let sequence = 0
let lastKind: ConcreteScare | null = null
let lastScaryAt = Number.NEGATIVE_INFINITY
let suppressCount = 0
let showing = false
const nameSources = new Map<string, string[]>()

export function isConcreteScare(value: unknown): value is ConcreteScare {
  if (value === RARE_SCARE || isXmasEffect(value)) return true
  return typeof value === 'string' && (SCARE_KINDS as readonly string[]).includes(value)
}

function pickFrom<T extends ConcreteScare>(group: readonly T[], random: () => number, avoid: ConcreteScare | null): T {
  const pool = avoid ? group.filter((kind) => kind !== avoid) : [...group]
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/**
 * Sorteia um susto com peso: ~2/3 das vezes um assustador de verdade
 * (animatrônico, rosto, grito, estática), ~1/3 um de meme. Nunca repete o
 * último.
 */
export function pickScare(random: () => number = Math.random, avoid: ConcreteScare | null = lastKind) {
  const group: readonly (typeof SCARE_KINDS)[number][] = random() < SCARY_SHARE ? SCARY_SCARES : MEME_SCARES
  return pickFrom(group, random, avoid)
}

/** Sorteia só entre os assustadores de verdade, sem repetir o último. */
export function pickScaryScare(random: () => number = Math.random, avoid: ConcreteScare | null = lastKind) {
  return pickFrom(SCARY_SCARES, random, avoid)
}

/** Sorteia um efeito de Natal (ou o zoom suspeito), sem repetir o último. */
export function pickFestiveEffect(random: () => number = Math.random, avoid: ConcreteScare | null = lastKind) {
  return pickFrom(FESTIVE_EFFECTS, random, avoid)
}

/** Assusta de verdade (som alto): os de SCARY_SCARES e o raro. */
export function isScaryScare(kind: ConcreteScare): boolean {
  return kind === RARE_SCARE || (SCARY_SCARES as readonly string[]).includes(kind)
}

/**
 * Sorteio do agendador automático da TV: igual ao 'random', mas só de meme
 * enquanto o último assustador tiver menos de AUTO_SCARY_GAP_MS.
 */
export function pickAutoScare(
  random: () => number = Math.random,
  now: number = Date.now(),
  avoid: ConcreteScare | null = lastKind,
): ConcreteScare {
  if (now - lastScaryAt < AUTO_SCARY_GAP_MS) return pickFrom(MEME_SCARES, random, avoid)
  return pickScare(random, avoid)
}

/**
 * 'random' (ou um nome desconhecido vindo da rede) vira um susto de verdade;
 * 'scary' vira um dos assustadores; 'festive', um efeito de Natal.
 */
export function resolveScareKind(kind: unknown, random: () => number = Math.random): ConcreteScare {
  if (isConcreteScare(kind)) return kind
  if (kind === FESTIVE_RANDOM) return pickFestiveEffect(random)
  return kind === SCARY_RANDOM ? pickScaryScare(random) : pickScare(random)
}

/** Emite um susto para o overlay. Devolve o pedido (ou null se ninguém está ouvindo). */
export function emitScare(kind: unknown, options: { name?: string | null } = {}): ScareRequest | null {
  const concrete = resolveScareKind(kind)
  lastKind = concrete
  if (isScaryScare(concrete)) lastScaryAt = Date.now()
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
