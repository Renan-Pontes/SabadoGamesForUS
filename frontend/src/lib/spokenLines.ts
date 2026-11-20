import { cleanForSpeech } from './narrator'

/**
 * Regras das falas da TV (a voz do navegador lendo para a sala).
 *
 * A voz só fala o que ajuda a sala a seguir o jogo sem olhar a TV: de quem é
 * a vez, a pergunta ou o tema que todo mundo precisa ouvir, a troca de fase
 * e o resultado. Piada, reação e comemoração ficam no efeito sonoro e na
 * tela. Frase curta (até umas 14 palavras), português falado, sem sigla,
 * emoji, onomatopeia, reticências, parênteses ou palavra em CAIXA ALTA.
 */

/** Intervalo mínimo entre o começo de duas falas da TV. */
export const SPEECH_GAP_MS = 6000

/**
 * Quanto esperar para falar: o atraso pedido, mas nunca antes de
 * `gapMs` depois do começo da última fala (duas falas coladas cansam e
 * uma corta a outra).
 */
export function paceDelay(wantedMs: number, lastStartedAt: number | null, now: number, gapMs = SPEECH_GAP_MS): number {
  if (lastStartedAt === null) return wantedMs
  return Math.max(wantedMs, lastStartedAt + gapMs - now)
}

export type SpokenLineLimits = {
  /** Máximo de letras (padrão 110). */
  maxChars?: number
  /** Máximo de palavras (padrão 16; a pergunta lida em voz alta pede mais). */
  maxWords?: number
}

/**
 * O que há de errado numa fala (lista vazia = boa para a voz). Usado nos
 * testes de cada jogo para conferir todas as falas possíveis.
 */
export function spokenLineProblems(line: string, limits: SpokenLineLimits = {}): string[] {
  const { maxChars = 110, maxWords = 16 } = limits
  const problems: string[] = []
  const text = line.trim()
  if (!text) return ['vazia']
  if (text.length > maxChars) problems.push(`longa demais (${text.length} letras)`)
  const words = text.split(/\s+/).length
  if (words > maxWords) problems.push(`palavras demais (${words})`)
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push('emoji')
  if (/(?<!\p{L})\p{Lu}{3,}(?!\p{L})/u.test(text)) problems.push('palavra em caixa alta')
  if (/\.\.|…/.test(text)) problems.push('reticências')
  if (/[()[\]{}]/.test(text)) problems.push('parênteses')
  if (/[—–]/.test(text)) problems.push('travessão')
  if (/[+%&@#*/=<>~^|\\_×]/.test(text)) problems.push('símbolo')
  if (/\d\s*(?:s|min|x|pts?|h)(?!\p{L})/iu.test(text)) problems.push('número com unidade')
  if (cleanForSpeech(text) !== text) problems.push(`a limpeza da voz mudaria: "${cleanForSpeech(text)}"`)
  return problems
}
