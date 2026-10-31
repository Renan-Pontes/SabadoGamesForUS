import type {
  BaseState,
  EngineCtx,
  HInput,
  HPlayer,
  HalloweenOption,
  HalloweenOptionValue,
} from './types'

/**
 * Ferramentas pequenas e puras para escrever motores de jogo.
 *
 * Nada aqui lê relógio, Math.random ou rede: tudo que varia chega por
 * parâmetro (ctx.now, ctx.rng). É isso que deixa o motor testável e
 * idempotente — a mesma entrada dá sempre a mesma saída.
 */

// ---------------------------------------------------------------------------
// Texto e chutes digitados
// ---------------------------------------------------------------------------

/** Palavras que não ajudam a identificar nada ("o cemitério" = "cemitério"). */
const STOP_WORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'd',
  'no', 'na', 'nos', 'nas', 'em', 'num', 'numa',
  'e', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas',
  'por', 'para', 'pra', 'pro', 'com',
  'the', 'of',
])

/**
 * Minúsculas, sem acento, sem pontuação e sem artigos/preposições comuns.
 * "A Mansão do Drácula!" → "mansao dracula".
 */
export function normalizeText(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .join(' ')
}

/** Distância de edição (inserir, apagar ou trocar uma letra custa 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/** Quantas letras erradas aceitar: 1 até 5 letras, 2 acima (e 0 em palavrinha de 1–2). */
export function typoTolerance(letters: number): number {
  if (letters <= 2) return 0
  if (letters <= 5) return 1
  return 2
}

function lettersOf(text: string) {
  return text.replace(/ /g, '')
}

function wordsClose(a: string, b: string) {
  return levenshtein(a, b) <= typoTolerance(Math.max(a.length, b.length))
}

/** Alguma janela de `hay` bate, palavra a palavra, com `needle`? */
function containsWords(hay: string[], needle: string[]) {
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    if (needle.every((word, index) => wordsClose(hay[start + index], word))) return true
  }
  return false
}

/**
 * O chute digitado acerta alguma das respostas aceitas?
 *
 * Tolera acento, maiúscula, artigo e erro de digitação (1 letra em palavras
 * de até 5, 2 acima disso). Em nomes compostos, vale o chute que contém a
 * resposta inteira ("acho que é o cemitério") e o pedaço que cobre pelo
 * menos metade das letras ("hospital psiquiátrico" para "hospital
 * psiquiátrico abandonado") — "hospital" sozinho não basta.
 */
export function fuzzyMatch(guess: string, answers: readonly string[]): boolean {
  const g = normalizeText(guess)
  if (!g) return false
  const guessWords = g.split(' ')
  const guessLetters = lettersOf(g)

  for (const answer of answers) {
    const a = normalizeText(answer)
    if (!a) continue
    if (g === a) return true

    const answerLetters = lettersOf(a)
    if (levenshtein(guessLetters, answerLetters) <= typoTolerance(answerLetters.length)) return true

    const answerWords = a.split(' ')
    if (guessWords.length > answerWords.length && containsWords(guessWords, answerWords)) return true
    if (
      answerWords.length > guessWords.length &&
      guessLetters.length * 2 >= answerLetters.length &&
      guessWords.some((word) => word.length >= 4) &&
      containsWords(answerWords, guessWords)
    ) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Sorte (sempre pelo rng do ctx)
// ---------------------------------------------------------------------------

/** Gerador determinístico (mulberry32): mesma semente, mesma sequência. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inteiro entre min e max, inclusive. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Cópia embaralhada (Fisher–Yates); não mexe na lista original. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Um item ao acaso. Lista vazia é bug do motor, então lança erro. */
export function pick<T>(items: readonly T[], rng: () => number): T {
  if (!items.length) throw new Error('pick() recebeu uma lista vazia')
  return items[Math.floor(rng() * items.length)]
}

/** `count` itens distintos ao acaso (ou todos, se a lista for menor). */
export function sample<T>(items: readonly T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, Math.max(0, count))
}

// ---------------------------------------------------------------------------
// Respostas e quem está jogando
// ---------------------------------------------------------------------------

/** Resposta do jogador para esta chave; respostas de outra fase não contam. */
export function inputFor(ctx: EngineCtx, key: string, playerId: number): HInput | undefined {
  const input = ctx.inputs[playerId]
  return input && input.k === key ? input : undefined
}

/**
 * Resposta num slot persistente (ex.: 'draw'). Com `keys`, só vale se foi
 * enviada numa dessas fases — evita aproveitar o desenho da rodada passada.
 */
export function slotFor(
  ctx: EngineCtx,
  slot: string,
  playerId: number,
  keys?: string | readonly string[],
): HInput | undefined {
  const input = ctx.slots[slot]?.[playerId]
  if (!input) return undefined
  if (keys === undefined) return input
  const accepted = typeof keys === 'string' ? [keys] : keys
  return accepted.includes(input.k) ? input : undefined
}

/** Ids do `roster` que já responderam esta chave (na ordem do roster). */
export function actedIds(ctx: EngineCtx, key: string, roster: readonly number[]): number[] {
  return roster.filter((id) => inputFor(ctx, key, id) !== undefined)
}

/**
 * Quem está online: sem `roster`, todos da sala (ordem de entrada) — é o
 * roster do `init`; com `roster`, só os online dele.
 */
export function onlineRoster(ctx: EngineCtx, roster?: readonly number[]): number[] {
  if (!roster) return ctx.players.filter((player) => player.online).map((player) => player.id)
  const online = new Set(ctx.players.filter((player) => player.online).map((player) => player.id))
  return roster.filter((id) => online.has(id))
}

/**
 * Todo mundo online do roster já respondeu? Offline não segura a fase.
 * Sem ninguém online, devolve false: aí quem decide é o prazo.
 */
export function allOnlineActed(ctx: EngineCtx, key: string, roster: readonly number[]): boolean {
  const online = onlineRoster(ctx, roster)
  return online.length > 0 && online.every((id) => inputFor(ctx, key, id) !== undefined)
}

/** Mesmos ids, na mesma ordem. */
export function sameIds(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  return left.length === right.length && left.every((id, index) => id === right[index])
}

/** Atualiza `acted` só se mudou — devolve o MESMO estado quando não mudou. */
export function withActed<S extends BaseState>(state: S, acted: number[]): S {
  return sameIds(state.acted, acted) ? state : { ...state, acted }
}

/** `acted` recalculado a partir das respostas da chave atual. */
export function refreshActed<S extends BaseState>(
  state: S,
  ctx: EngineCtx,
  key: string = state.inputKey,
  roster: readonly number[] = state.roster,
): S {
  return withActed(state, actedIds(ctx, key, roster))
}

/** Lista de nomes em português: "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/** Nome para mostrar na tela. */
export function nameOf(players: readonly HPlayer[], id: number | null | undefined, fallback = 'Alguém'): string {
  if (id === null || id === undefined) return fallback
  return players.find((player) => player.id === id)?.name || fallback
}

// ---------------------------------------------------------------------------
// Votos e pontos
// ---------------------------------------------------------------------------

export type TallyEntry = { id: number; count: number; voters: number[] }

/**
 * Conta votos `{ eleitor: alvo }`. Sai do mais votado para o menos; no
 * empate, pelo menor id (estável entre a TV e os testes).
 */
export function tally(votes: Record<number, number | null | undefined>): TallyEntry[] {
  const byTarget = new Map<number, number[]>()
  for (const [voter, target] of Object.entries(votes)) {
    if (typeof target !== 'number') continue
    const voters = byTarget.get(target) ?? []
    voters.push(Number(voter))
    byTarget.set(target, voters)
  }
  return [...byTarget.entries()]
    .map(([id, voters]) => ({ id, count: voters.length, voters }))
    .sort((a, b) => b.count - a.count || a.id - b.id)
}

/** Todos os empatados no topo (lista vazia se ninguém recebeu voto). */
export function topIds(entries: readonly TallyEntry[]): number[] {
  const best = entries[0]?.count ?? 0
  if (best <= 0) return []
  return entries.filter((entry) => entry.count === best).map((entry) => entry.id)
}

/** O mais votado sem empate, ou null. */
export function topUnique(entries: readonly TallyEntry[]): number | null {
  const top = topIds(entries)
  return top.length === 1 ? top[0] : null
}

/** Placar zerado para estes jogadores. */
export function emptyScores(ids: readonly number[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [String(id), 0]))
}

/** Soma pontos sem mexer no placar original. */
export function addScores(
  scores: Record<string, number> | undefined,
  deltas: Record<string | number, number>,
): Record<string, number> {
  const next = { ...(scores ?? {}) }
  for (const [id, delta] of Object.entries(deltas)) {
    if (!delta) continue
    next[id] = (next[id] ?? 0) + delta
  }
  return next
}

export type RankEntry = { id: number; score: number; place: number }

/** Classificação com empate dividindo a posição (1º, 1º, 3º...). */
export function ranking(scores: Record<string, number> | undefined, ids: readonly number[]): RankEntry[] {
  const sorted = ids
    .map((id) => ({ id, score: scores?.[String(id)] ?? 0 }))
    .sort((a, b) => b.score - a.score || ids.indexOf(a.id) - ids.indexOf(b.id))
  return sorted.map((entry) => ({
    ...entry,
    place: sorted.findIndex((other) => other.score === entry.score) + 1,
  }))
}

// ---------------------------------------------------------------------------
// Prazos
// ---------------------------------------------------------------------------

/**
 * Folga das fases de resposta: os celulares veem o estado com até ~2 s de
 * atraso, e a resposta leva mais um tempinho para chegar ao juiz.
 */
export const GRACE_MS = 2000

/** Prazo daqui a `seconds` (fases sem resposta: revelação, placar...). */
export function deadlineIn(now: number, seconds: number): number {
  return now + Math.round(seconds * 1000)
}

/**
 * Prazo de uma fase de resposta: `seconds` mais a folga. Nas telas, mostre
 * o tempo com `secondsLeft(deadline, now, GRACE_MS)` — o relógio zera na
 * hora prometida e quem respondeu em cima do laço ainda conta.
 */
export function answerDeadline(now: number, seconds: number): number {
  return deadlineIn(now, seconds) + GRACE_MS
}

export function isExpired(deadline: number | null | undefined, now: number): boolean {
  return typeof deadline === 'number' && now >= deadline
}

/** Prazo vencido ou o host mandou pular — todo motor trata `skip` assim. */
export function timeUp(state: BaseState, ctx: EngineCtx): boolean {
  return ctx.command?.type === 'skip' || isExpired(state.deadline, ctx.now)
}

/** Milissegundos até o prazo (descontando a folga, se pedida), ou null. */
export function msLeft(deadline: number | null | undefined, now: number, graceMs = 0): number | null {
  if (typeof deadline !== 'number') return null
  return Math.max(0, deadline - graceMs - now)
}

/** Segundos inteiros até o prazo, arredondados para cima, ou null. */
export function secondsLeft(deadline: number | null | undefined, now: number, graceMs = 0): number | null {
  const ms = msLeft(deadline, now, graceMs)
  return ms === null ? null : Math.ceil(ms / 1000)
}

// ---------------------------------------------------------------------------
// Opções da configuração
// ---------------------------------------------------------------------------

/** Os valores padrão de todas as opções do meta. */
export function optionDefaults(options: readonly HalloweenOption[]): Record<string, HalloweenOptionValue> {
  return Object.fromEntries(options.map((option) => [option.key, option.default]))
}

/** Só aceita escolhas que existem no meta; o resto volta ao padrão. */
export function sanitizeOptions(
  options: readonly HalloweenOption[],
  chosen: Record<string, unknown> | null | undefined,
): Record<string, HalloweenOptionValue> {
  return Object.fromEntries(
    options.map((option) => {
      const value = chosen?.[option.key]
      const valid = option.choices.some((choice) => choice.value === value)
      return [option.key, valid ? (value as HalloweenOptionValue) : option.default]
    }),
  )
}

/** Lê uma opção com segurança: tipo errado ou valor fora da lista vira `fallback`. */
export function readOption<T extends HalloweenOptionValue>(
  options: Record<string, unknown> | null | undefined,
  key: string,
  fallback: T,
  allowed?: readonly T[],
): T {
  const value = options?.[key]
  if (typeof value !== typeof fallback) return fallback
  if (allowed && !allowed.includes(value as T)) return fallback
  return value as T
}

// ---------------------------------------------------------------------------
// Rodadas malucas
// ---------------------------------------------------------------------------

export type ChaosKind = 'everyone' | 'nobody'

/** Chance de uma rodada maluca, por rodada elegível. */
export const CHAOS_CHANCE = 0.18

/**
 * Sorteia uma rodada maluca: só a partir da 2ª rodada, com ~18% de chance e
 * no máximo uma de cada tipo por partida (`used` = as que já saíram).
 */
export function chaosRoll<K extends string = ChaosKind>(
  rng: () => number,
  round: number,
  enabled: boolean,
  used: readonly K[],
  options: { chance?: number; fromRound?: number; kinds?: readonly K[] } = {},
): K | null {
  const kinds = options.kinds ?? (['everyone', 'nobody'] as unknown as readonly K[])
  if (!enabled || round < (options.fromRound ?? 2)) return null
  const available = kinds.filter((kind) => !used.includes(kind))
  if (!available.length) return null
  if (rng() >= (options.chance ?? CHAOS_CHANCE)) return null
  return pick(available, rng)
}
