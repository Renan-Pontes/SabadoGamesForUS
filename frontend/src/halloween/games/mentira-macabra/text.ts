import { fuzzyMatch, levenshtein, normalizeText, typoTolerance } from '../../engine/helpers'
import { BLANK, type Fact } from './content'

/**
 * Texto das mentiras: limpeza do que foi digitado e a comparação tolerante
 * com a verdade. Usado pelo motor (que decide) e pelo celular (que recusa na
 * hora "Isso é verdade!") — os dois precisam concordar, por isso moram aqui.
 */

/** Tamanho máximo de uma mentira (cabe numa linha da TV). */
export const MAX_LIE_CHARS = 40

/**
 * Limpa o texto digitado: sem caractere de controle, espaços simples, sem
 * aspas em volta nem pontuação sobrando no fim ("“Pedro.”" = "Pedro") e com
 * no máximo MAX_LIE_CHARS letras (cortando por letra, sem partir emoji ao
 * meio). A TV já põe as aspas dela.
 */
export function cleanLie(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const flat = raw.normalize('NFC').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat)
    .slice(0, MAX_LIE_CHARS)
    .join('')
    .replace(/^[\s"'“”‘’«»]+/u, '')
    .replace(/[\s.,;:!?…"'“”‘’«»]+$/u, '')
    .trim()
}

/** Só os algarismos ("7 dias" → "7"). */
function digitsOf(key: string): string {
  return key.replace(/\D/g, '')
}

/** Sem espaço nenhum ("7 dias" → "7dias"). */
function compact(key: string): string {
  return key.replace(/ /g, '')
}

/**
 * Chave para comparar mentiras entre si: sem acento, maiúscula, artigo nem
 * pontuação, e com números juntos ("1.897" = "1897"). Mentiras com a mesma
 * chave viram uma opção só. Chave vazia = não é mentira que preste.
 */
export function lieKey(text: string): string {
  return normalizeText(text).replace(/(\d) (?=\d)/g, '$1')
}

/**
 * A "mentira" é, na verdade, a verdade? Compara com a resposta e as variações
 * aceitas sem ligar para acento, maiúscula, artigo, espaço ("7dias") ou letra
 * trocada. O número em si nunca perdoa: "1898" é mentira para "1897" e "30 de
 * outubro" para "31 de outubro" — mas "7 diass" ainda é "7 dias". Fatos
 * `exact` (número por extenso) só valem igualzinhos. Se a verdade é só um
 * número, qualquer texto com esse número é a verdade ("27 anos" para "27") —
 * assim ninguém mente a verdade com um errinho de propósito.
 */
export function isTruth(text: string, fact: Pick<Fact, 'answer' | 'accept' | 'exact'>): boolean {
  const key = lieKey(text)
  if (!key) return false
  const answerKey = lieKey(fact.answer)
  if (/^\d+$/.test(answerKey) && digitsOf(key) === answerKey) return true
  for (const answer of [fact.answer, ...fact.accept]) {
    const target = lieKey(answer)
    if (!target) continue
    if (key === target || compact(key) === compact(target)) return true
    if (/\d/.test(target)) {
      // Com número: o número tem de ser o mesmo; aí perdoa letra trocada ("7 diass"),
      // mas não palavra a mais ("7 meses" não é "7").
      const letters = compact(target)
      if (digitsOf(key) === digitsOf(target) && levenshtein(compact(key), letters) <= typoTolerance(letters.length)) return true
      continue
    }
    // Número por extenso não perdoa letra trocada ("seis dias" ≠ "sete dias").
    if (fact.exact) continue
    if (fuzzyMatch(text, [answer])) return true
  }
  return false
}

/** Duas mentiras parecidas demais para ficarem lado a lado ("Steve" e "Stive")? */
export function similarLies(a: string, b: string): boolean {
  return lieKey(a) === lieKey(b) || isTruth(a, { answer: b, accept: [] }) || isTruth(b, { answer: a, accept: [] })
}

/** Pedaços do fato em volta da lacuna: [antes, depois]. */
export function splitBlank(text: string): [string, string] {
  const at = text.indexOf(BLANK)
  if (at < 0) return [text, '']
  return [text.slice(0, at), text.slice(at + BLANK.length)]
}

/** O fato completo, com `answer` no lugar da lacuna. */
export function fillBlank(text: string, answer: string): string {
  const [before, after] = splitBlank(text)
  return `${before}${answer}${after}`
}
