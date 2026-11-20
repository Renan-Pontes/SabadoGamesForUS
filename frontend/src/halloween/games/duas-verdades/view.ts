import type { CSSProperties } from 'react'
import type { SfxName } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import { PROMPTS } from './content'
import { MAX_FACT_CHARS, revealSeconds, type DvCard, type DvPhase, type DvReveal, type DvSecret, type EntryProblem } from './engine'

/**
 * Auxiliares das telas do "Duas Verdades, Uma Mentira" (TV e celular). Ficam
 * fora dos `.tsx` porque a regra do react-refresh quer que eles exportem só
 * o componente.
 */

/** Rufar dos tambores antes do carimbo "MENTIRA!". O celular espera o mesmo tanto. */
export const DRUM_MS = 2400
/** O holofote "A vez da Ana!" ocupa a TV no começo de cada vez. */
export const SPOTLIGHT_MS = 2600

/** Letra da carta na mesa (A, B, C): a mesma na TV e no celular. */
export function cardLetter(id: number): string {
  return String.fromCharCode(65 + (((id % 26) + 26) % 26))
}

/** Nomes juntos em português: "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function namesOf(players: readonly HPlayer[], ids: readonly number[], fallback = 'Ninguém'): string {
  if (!ids.length) return fallback
  return listNames(ids.map((id) => nameOf(players, id)))
}

export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? 'ponto' : 'pontos'}`
}

export function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? 'pessoa' : 'pessoas'}`
}

/** Corta o que a pessoa digita no limite do motor (emoji conta 1, como lá). */
export function limitFact(text: string): string {
  const chars = Array.from(text)
  return chars.length > MAX_FACT_CHARS ? chars.slice(0, MAX_FACT_CHARS).join('') : text
}

/** O aviso do celular quando as cartinhas ainda não valem. */
export function problemText(problem: EntryProblem | null): string {
  if (problem === 'missing') return 'Escreva as três frases ✍️'
  if (problem === 'duplicate') return 'Tem duas frases iguais 👀'
  if (problem === 'no-lie') return 'Marque qual delas é a mentira 🤥'
  return 'Tudo pronto!'
}

/** Ideias do celular em páginas (o botão "🔀 outras ideias" passa a página). */
export const PROMPTS_PER_PAGE = 6

export function promptPage(page: number): string[] {
  const pages = Math.ceil(PROMPTS.length / PROMPTS_PER_PAGE)
  const index = ((page % pages) + pages) % pages
  return PROMPTS.slice(index * PROMPTS_PER_PAGE, index * PROMPTS_PER_PAGE + PROMPTS_PER_PAGE)
}

/**
 * Começa a frase com a ideia. Cartinha vazia (ou só com outra ideia, sem nada
 * completado) troca de ideia; com texto da pessoa, a ideia vai no fim — nada
 * do que ela escreveu some.
 */
export function applyPrompt(current: string, prompt: string): string {
  const base = current.trim()
  if (!base || PROMPTS.includes(base)) return limitFact(`${prompt} `)
  return limitFact(`${base} ${prompt} `)
}

/** Qual carta da mesa é a mentira do autor (só o celular do autor sabe). */
export function myLieCard(mine: DvSecret | null | undefined, cards: readonly DvCard[]): number | null {
  if (!mine || !Array.isArray(mine.facts)) return null
  const lie = mine.facts[mine.lie]
  const card = cards.find((candidate) => candidate.text === lie)
  return card ? card.id : null
}

/** Momento do começo da revelação (pelo prazo, como o motor contou). */
export function revealStartedAt(deadline: number | null, reveal: Pick<DvReveal, 'outcome'>): number {
  return (deadline ?? 0) - revealSeconds(reveal.outcome) * 1000
}

/** A TV segura os efeitos aleatórios na votação e na revelação. */
export function holdsScares(phase: DvPhase, over: boolean): boolean {
  return !over && (phase === 'vote' || phase === 'reveal')
}

export type OutcomeCopy = { icon: string; title: string; subtitle: string; tone: 'blood' | 'pumpkin' | 'toxic' | 'ghost'; sound: SfxName }

/** Variação fixa pela vez (nada de sorteio no render). */
function variant<T>(items: readonly T[], turn: number): T {
  return items[((turn % items.length) + items.length) % items.length]
}

/** A manchete da revelação. */
export function outcomeCopy(reveal: Pick<DvReveal, 'outcome' | 'right' | 'fooled'>, author: string, turn: number): OutcomeCopy {
  switch (reveal.outcome) {
    case 'fooled-all':
      return {
        icon: '🤥',
        title: 'ENGANOU TODO MUNDO!',
        subtitle: variant(
          [
            `${author} mente melhor que o Papai Noel no shopping`,
            `${author} merece um Oscar… ou carvão na meia`,
            `Nem a rena do nariz vermelho farejou essa, ${author}`,
            `${author} enrolou a mesa mais que papel de presente`,
          ],
          turn,
        ),
        tone: 'blood',
        sound: 'boing',
      }
    case 'all-right':
      return {
        icon: '😅',
        title: 'Mentiroso de carteirinha… só que não!',
        subtitle: variant(
          [
            `A mesa inteira farejou a lorota de ${author}`,
            `${author}, essa mentira tava mais fácil que achar panetone em dezembro`,
            `Todo mundo acertou! ${author} precisa treinar a cara de paisagem`,
          ],
          turn,
        ),
        tone: 'toxic',
        sound: 'fail',
      }
    case 'no-votes':
      return {
        icon: '😴',
        title: 'Ninguém votou…',
        subtitle: 'A mesa dormiu depois da ceia. Sem pontos nesta vez.',
        tone: 'ghost',
        sound: 'fail',
      }
    default: {
      const fooled = reveal.fooled.length
      return {
        icon: '🎁',
        title: fooled === 1 ? '1 caiu na conversa!' : `${fooled} caíram na conversa!`,
        subtitle: `${peopleLabel(reveal.right.length)} ${reveal.right.length === 1 ? 'acertou' : 'acertaram'} a mentira de ${author}`,
        tone: 'pumpkin',
        sound: 'ding',
      }
    }
  }
}

/** O que o narrador fala quando a vez começa. */
export function turnNarration(author: string, cards: readonly DvCard[], turn: number): string {
  const opener = variant([`A vez de ${author}!`, `Agora é ${author} na cadeira da lareira!`, `Puxa a cadeira, ${author}!`], turn)
  const lines = cards.map((card) => `${cardLetter(card.id)}: ${card.text}.`).join(' ')
  return `${opener} ${lines} Qual é a mentira?`
}

/** O que o narrador fala depois do carimbo. */
export function revealNarration(reveal: Pick<DvReveal, 'outcome' | 'right' | 'fooled'>, author: string, lieText: string, turn: number): string {
  const copy = outcomeCopy(reveal, author, turn)
  const title = copy.title.replace(/…/g, ',').replace(/!/g, '.').toLowerCase()
  return `A mentira era: ${lieText}. ${title} ${copy.subtitle}.`
}

export const WRITE_NARRATION =
  'Hora de mentir! Escrevam no celular três frases sobre vocês: duas verdades e uma mentira. E capricha, que mentira boa parece verdade!'

/** Colunas do placar na TV: até 8 linhas por coluna. */
export function rankColumns(count: number): number {
  return Math.min(2, Math.max(1, Math.ceil(count / 8)))
}

/** Letra das frases na TV, pelo tamanho da maior (cabem 3 cartas sem rolar). */
export function cardFont(cards: readonly DvCard[]): string {
  const longest = Math.max(0, ...cards.map((card) => Array.from(card.text).length))
  if (longest <= 40) return 'clamp(2.4rem, 3.4vw, 3.6rem)'
  if (longest <= 60) return 'clamp(2.1rem, 2.8vw, 3rem)'
  return 'clamp(1.9rem, 2.4vw, 2.6rem)'
}

/** Vibra o celular. Quem não vibra (iPhone, computador) simplesmente ignora. */
export function buzz(pattern: number | number[] = 30): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Sem vibração: tudo bem.
  }
}

/** Rascunho das cartinhas guardado no aparelho (sobrevive a recarregar a página). */
export type Draft = { facts: string[]; lie: number | null }

/** Um rascunho por partida (a `seed` muda no "Jogar de novo"). */
export function draftKey(code: string, me: number, seed: number): string {
  return `dv-draft-${code}-${me}-${seed}`
}

/** Entrada escalonada de listas (classe global `stagger-in`). */
export function stagger(index: number): CSSProperties {
  return { '--stagger-index': index } as CSSProperties
}

export function loadDraft(key: string): Draft | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Draft>
    if (!Array.isArray(parsed.facts) || parsed.facts.length !== 3) return null
    return {
      facts: parsed.facts.map((fact) => (typeof fact === 'string' ? limitFact(fact) : '')),
      lie: typeof parsed.lie === 'number' && parsed.lie >= 0 && parsed.lie < 3 ? parsed.lie : null,
    }
  } catch {
    return null
  }
}

export function saveDraft(key: string, draft: Draft): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Sem armazenamento (aba anônima): o rascunho só vive na tela.
  }
}
