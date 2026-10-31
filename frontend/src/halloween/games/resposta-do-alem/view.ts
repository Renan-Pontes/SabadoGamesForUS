import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import { BLANK } from './content'
import { MAX_ANSWER_CHARS, type RdaResult, type RdaRevealKind } from './engine'

/**
 * Auxiliares das telas do "Resposta do Além" (TV e celular). Ficam fora dos
 * `.tsx` porque a regra do react-refresh quer que eles exportem só o
 * componente.
 */

/** A mais votada sobe na TV depois disto (rufar dos tambores). */
export const WINNER_DELAY_MS = 2600
/** No W.O. não tem disputa: o suspense é curtinho. */
export const SOLO_DELAY_MS = 1500
/** A resposta do além aparece depois do susto da estática. */
export const ALEM_DELAY_MS = 2600

/**
 * Quanto a revelação segura o resultado. O celular espera o mesmo tanto
 * ("🥁 Olhe a TV!") para não estragar a surpresa de quem está vendo a TV.
 */
export function suspenseMs(kind: RdaRevealKind): number {
  if (kind === 'solo') return SOLO_DELAY_MS
  if (kind === 'empty') return ALEM_DELAY_MS
  return WINNER_DELAY_MS
}

/** Letra da carta na votação (A, B, C…): a mesma na TV e no celular. */
export function cardLetter(id: number): string {
  return String.fromCharCode(65 + (((id % 26) + 26) % 26))
}

/**
 * Os pedaços da frase em volta da lacuna. `after` é null se (por engano) a
 * frase não tiver lacuna — aí a tela desenha a frase inteira.
 */
export function promptParts(text: string): { before: string; after: string | null } {
  const index = text.indexOf(BLANK)
  if (index < 0) return { before: text, after: null }
  return { before: text.slice(0, index), after: text.slice(index + BLANK.length) }
}

/**
 * O resto da frase depois da lacuna preenchida: se a resposta já fecha com
 * pontuação ("…a conta de luz."), o ponto final da frase sai — nada de
 * "luz..". Vírgula e o resto da frase ficam como estão.
 */
export function filledAfter(after: string | null, fill: string): string | null {
  if (after === null) return null
  return /[.!?…]$/.test(fill.trim()) ? after.replace(/^\./, '') : after
}

/** Título do W.O.: uma alma só respondeu, ou várias escreveram igual. */
export function soloTitle(authors: number): string {
  return authors > 1 ? `${authors} almas escreveram igual: vitória por W.O.!` : 'Só uma alma respondeu: vitória por W.O.!'
}

/**
 * Colunas do placar na TV para caber numa tela 1080p sem rolar: entre as
 * rodadas cabem 8 linhas; no fim, com os prêmios em cima, só 5.
 */
export function rankColumns(count: number, moment: 'scores' | 'final'): number {
  const rows = moment === 'final' ? 5 : 8
  return Math.min(3, Math.max(1, Math.ceil(count / rows)))
}

/**
 * Na revelação com muitas respostas (3 fileiras), as perdedoras mostram só 2
 * linhas do texto (todo mundo já leu na votação) para a grade caber na TV.
 * null = texto inteiro.
 */
export function revealLines(count: number): number | null {
  return count > 8 ? 2 : null
}

/** Corta o que a pessoa digita no limite do motor (emoji conta 1, como lá). */
export function limitAnswer(text: string): string {
  const chars = Array.from(text)
  return chars.length > MAX_ANSWER_CHARS ? chars.slice(0, MAX_ANSWER_CHARS).join('') : text
}

/**
 * A frase para a voz de terror ler: a lacuna vira uma pausa dramática
 * ("…é ___." → "…é …").
 */
export function speakablePrompt(text: string): string {
  return text
    .split(BLANK)
    .join('…')
    .replace(/…\s*[.,!?:;]+/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nomes juntos em português: "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function namesOf(players: readonly HPlayer[], ids: readonly number[], fallback = 'Alguém'): string {
  if (!ids.length) return fallback
  return listNames(ids.map((id) => nameOf(players, id)))
}

export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? 'ponto' : 'pontos'}`
}

export function votesLabel(votes: number): string {
  return `${votes} ${votes === 1 ? 'voto' : 'votos'}`
}

/** As que ganharam o bônus (mais votadas, ou o W.O.). */
export function topResults(results: readonly RdaResult[]): RdaResult[] {
  return results.filter((result) => result.top)
}

/**
 * Grade das cartas na TV, pela quantidade (até 15): colunas e tamanho da
 * letra. Com 15 cartas fica 5×3, com letra de pelo menos 28 px (1,75rem).
 */
export function cardGrid(count: number): { columns: number; font: string } {
  if (count <= 2) return { columns: 2, font: 'clamp(2.4rem, 3.4vw, 3.8rem)' }
  if (count <= 4) return { columns: 2, font: 'clamp(2.2rem, 2.9vw, 3.2rem)' }
  if (count <= 6) return { columns: 3, font: 'clamp(2rem, 2.4vw, 2.8rem)' }
  if (count <= 8) return { columns: 4, font: 'clamp(1.85rem, 2vw, 2.5rem)' }
  if (count <= 12) return { columns: 4, font: 'clamp(1.75rem, 1.8vw, 2.2rem)' }
  return { columns: 5, font: 'clamp(1.75rem, 1.5vw, 2rem)' }
}

/** Vibra o celular. Quem não vibra (iPhone, computador) simplesmente ignora. */
export function buzz(pattern: number | number[] = 30): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Sem vibração: tudo bem.
  }
}
