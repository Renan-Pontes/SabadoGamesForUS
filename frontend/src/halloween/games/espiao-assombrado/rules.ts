import { fuzzyMatch, levenshtein, normalizeText, typoTolerance } from '../../engine/helpers'
import { PLACES } from './content'

/**
 * Regras do "Espião Assombrado" que o motor e as telas dividem: tempos,
 * pontos, quantos espiões, o formato das cartas e como conferir o chute
 * digitado. Tudo puro — nada de relógio, sorteio ou React aqui.
 */

// ---------------------------------------------------------------------------
// Tempos (segundos)
// ---------------------------------------------------------------------------

/** Cada um olha a carta. */
export const REVEAL_SECONDS = 10
/** Votação de uma acusação (SIM/NÃO). */
export const ACCUSE_SECONDS = 30
/** Votação final, quando a conversa acaba. */
export const FINAL_VOTE_SECONDS = 30
/** Espião pego digita o lugar. */
export const LAST_CHANCE_SECONDS = 30
/** Revelação: rufar, quem era o espião, o lugar e os pontos. */
export const RESULT_SECONDS = 15
export const SCORES_SECONDS = 8
/** Depois de uma acusação rejeitada, a conversa volta com pelo menos isto (ms). */
export const RESUME_MIN_MS = 10_000

// ---------------------------------------------------------------------------
// Opções (mesmas chaves e valores do meta)
// ---------------------------------------------------------------------------

export const ROUND_CHOICES = [3, 5, 7] as const
export const DEFAULT_ROUNDS = 5
export const TALK_CHOICES = [5, 7, 9] as const
export const DEFAULT_TALK_MINUTES = 7

// ---------------------------------------------------------------------------
// Pontos (HALLOWEEN.md)
// ---------------------------------------------------------------------------

export const POINTS = {
  /** Mesa venceu: cada um que sabia o lugar. */
  table: 1,
  /** Mesa venceu: extra para quem apontou o espião (acusador ou votos finais nele). */
  sharp: 1,
  /** Espiões venceram: cada espião. */
  spy: 2,
  /** Espiões venceram: o espião que acertou o lugar (no lugar dos 2). */
  spyGuess: 3,
  /** Rodada sem espião: quem foi condenado ("inocente injustiçado"). */
  injustice: 2,
  /** Rodada sem espião e ninguém condenado: todo mundo. */
  peace: 1,
} as const

/**
 * Uma acusação passa com SIM > NÃO — o acusador já conta como SIM — e com
 * pelo menos 2 SIM: acusação que ninguém mais apoiou não condena ninguém
 * (nem quando o tempo acaba com a mesa distraída).
 */
export const ACCUSE_MIN_YES = 2

export function accusationPasses(yes: number, no: number): boolean {
  return yes >= ACCUSE_MIN_YES && yes > no
}

/** 1 espião até 8 pessoas; 2 a partir de 9. */
export function spyCountFor(players: number): number {
  return players >= 9 ? 2 : 1
}

// ---------------------------------------------------------------------------
// Cartas e o segredo da mesa
// ---------------------------------------------------------------------------

export type RoundKind = 'normal' | 'everyone' | 'nobody'

/** A carta de cada um (vai no `private` do dono). */
export type SpyCard = { spy: true } | { spy: false; place: string; icon: string; role: string }

/**
 * O segredo da rodada, em `private._mesa`. Nenhum jogador tem esse id, então
 * nenhum celular recebe isto pela prop `mine`, e a TV recebe o estado sem
 * `private`: é assim que a rodada maluca fica invisível até a revelação.
 */
export type MesaSecret = {
  kind: RoundKind
  /** Id do lugar (posição em PLACES). */
  place: number
  spies: number[]
  /** Lugares sorteados para a partida (um por rodada, sem repetir). */
  deck: number[]
}

export const MESA_KEY = '_mesa'

/** A carta, a partir do `mine` das telas (o segredo da mesa não é carta). */
export function asCard(value: unknown): SpyCard | null {
  if (!value || typeof value !== 'object' || !('spy' in value)) return null
  return value as SpyCard
}

// ---------------------------------------------------------------------------
// Desfechos de uma rodada
// ---------------------------------------------------------------------------

export type Outcome =
  /** Espião pego (acusação ou votação final) que errou ou não chutou: mesa vence. */
  | 'caught'
  /** Espião pego, mas acertou o lugar na última chance: espiões vencem. */
  | 'escaped'
  /** Espião acertou o lugar no meio da conversa: espiões vencem. */
  | 'guess-right'
  /** Espião errou o chute no meio da conversa: mesa vence. */
  | 'guess-wrong'
  /** A mesa condenou um inocente: espiões vencem. */
  | 'innocent'
  /** Votação final sem condenado (empate ou ninguém votou): espiões vencem. */
  | 'tie'
  /** Rodada maluca: todo mundo era espião (sem pontos — é para rir). */
  | 'everyone'
  /** Rodada maluca sem espião: alguém foi condenado (+2 para o injustiçado). */
  | 'nobody-convicted'
  /** Rodada maluca sem espião e ninguém condenado (+1 para todo mundo). */
  | 'nobody-free'

export type Winner = 'table' | 'spies' | 'none'

export function winnerOf(outcome: Outcome): Winner {
  switch (outcome) {
    case 'caught':
    case 'guess-wrong':
      return 'table'
    case 'escaped':
    case 'guess-right':
    case 'innocent':
    case 'tie':
      return 'spies'
    default:
      return 'none'
  }
}

// ---------------------------------------------------------------------------
// O chute digitado (sem lista de lugares: são muitos)
// ---------------------------------------------------------------------------

/** Tamanho máximo do chute (o celular também corta). */
export const GUESS_MAX = 40

/** Texto do chute limpo (espaços, tamanho) ou null se não sobra nada. */
export function cleanGuess(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, GUESS_MAX).trim()
  return normalizeText(text) ? text : null
}

/**
 * Custo extra de bater só por um pedaço ("acho que é o cemitério",
 * "hospital"). É maior que o máximo de letras erradas aceitas (2): quem bate
 * com o chute INTEIRO, mesmo com erro de digitação, vence quem só aparece
 * dentro dele — "festa de casamnto" é o Casamento, não a Festa à Fantasia.
 */
const PARTIAL_COST = typoTolerance(Number.MAX_SAFE_INTEGER) + 0.5

function lettersOf(text: string) {
  return text.replace(/ /g, '')
}

/** Menor soma de distâncias, palavra a palavra, de `needle` dentro de `hay` (só janelas que batem). */
function windowCost(hay: string[], needle: string[]): number | null {
  let best: number | null = null
  for (let start = 0; start + needle.length <= hay.length; start += 1) {
    let sum = 0
    let ok = true
    for (let i = 0; i < needle.length && ok; i += 1) {
      const a = hay[start + i]
      const b = needle[i]
      const distance = levenshtein(a, b)
      if (distance > typoTolerance(Math.max(a.length, b.length))) ok = false
      else sum += distance
    }
    if (ok && (best === null || sum < best)) best = sum
  }
  return best
}

/**
 * Quão bem o chute bate com um nome (0 = igual; 1–2 = letras erradas; 2,5 ou
 * mais = só um pedaço), ou null se não bate. Quem decide se bate é o `fuzzyMatch`
 * dos helpers (ignora acento, maiúscula, pontuação e artigos/preposições:
 * "o", "da", "no"...); o custo só serve para desempatar entre lugares
 * parecidos — "egito" é a Pirâmide, mesmo estando a 2 letras de "esgoto".
 */
export function matchCost(guess: string, answer: string): number | null {
  if (!fuzzyMatch(guess, [answer])) return null
  const g = normalizeText(guess)
  const a = normalizeText(answer)
  if (g === a) return 0
  const costs: number[] = []
  const whole = levenshtein(lettersOf(g), lettersOf(a))
  if (whole <= typoTolerance(lettersOf(a).length)) costs.push(whole)
  const gw = g.split(' ')
  const aw = a.split(' ')
  const inside = gw.length > aw.length ? windowCost(gw, aw) : aw.length > gw.length ? windowCost(aw, gw) : null
  if (inside !== null) costs.push(inside + PARTIAL_COST)
  return costs.length ? Math.min(...costs) : 1
}

/** Ids dos lugares com que o chute bate, do que bate melhor para o pior. */
export function placesMatching(guess: string): number[] {
  return rankPlaces(guess).map((entry) => entry.id)
}

function rankPlaces(guess: string): { id: number; cost: number }[] {
  const ranked: { id: number; cost: number }[] = []
  PLACES.forEach((place, id) => {
    let best: number | null = null
    for (const name of [place.name, ...place.aliases]) {
      const cost = matchCost(guess, name)
      if (cost !== null && (best === null || cost < best)) best = cost
    }
    if (best !== null) ranked.push({ id, cost: best })
  })
  return ranked.sort((a, b) => a.cost - b.cost || a.id - b.id)
}

/** Os lugares que o chute acerta melhor (mais de um = empate, chute ambíguo). */
export function bestPlaces(guess: string): number[] {
  const ranked = rankPlaces(guess)
  const top = ranked[0]?.cost
  return ranked.filter((entry) => entry.cost === top).map((entry) => entry.id)
}

/**
 * O chute acerta o lugar? Ele tem de ser, sozinho, o lugar que melhor bate
 * com o que foi digitado. Digitar vários lugares de uma vez ("cemitério
 * hospital castelo") empata entre eles e não vale.
 */
export function guessHits(guess: string, placeId: number): boolean {
  const best = bestPlaces(guess)
  return best.length === 1 && best[0] === placeId
}
