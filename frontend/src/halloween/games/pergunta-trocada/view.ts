import type { CSSProperties } from 'react'
import type { MusicTrack, SfxName } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import type { Cameo } from '../../scare/cameos'
import type { RevealTone } from '../../ui'
import { KIND_HINT, type AnswerKind } from './content'
import { CONSOLATION_POINTS, ESCAPE_POINTS, GROUP_POINTS, SHARP_BONUS, type Phase, type PtResult, type State } from './engine'

/**
 * Auxiliares das telas da "Pergunta Trocada" (TV e celular): textos de cada
 * desfecho, narração, trilha por fase, tempos da revelação e vibração. Ficam
 * fora dos .tsx porque o react-refresh pede que esses arquivos exportem só
 * o componente.
 */

/** Linha do tempo da revelação na TV (ms desde o começo do `result`). */
export const REVEAL_TIMING = {
  /** Até aqui: o mais votado na mesa (com o duende desconfiado 🤨 no canto). */
  zoomEnd: 2600,
  /** Até aqui: o rufar "E o impostor era…". */
  drumEnd: 4600,
  /** Até aqui: a manchete em tela cheia (BigReveal). */
  bigEnd: 8600,
} as const

export function namesOf(players: readonly HPlayer[], ids: readonly number[]): string {
  return listNames(ids.map((id) => nameOf(players, id)))
}

/** Entrada escalonada de listas (classe global `stagger-in`). */
export function stagger(index: number): CSSProperties {
  return { '--stagger-index': index } as CSSProperties
}

/** Vibra o celular, se der (desktop e iPhone não vibram — tudo bem). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
  } catch {
    // Sem vibração.
  }
}

/** "1:05" (arredonda para cima, como o relógio de prazo). */
export function clock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–:––'
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? 'ponto' : 'pontos'}`
}

/** Dica do tipo de resposta, com o teclado certo no celular. */
export function kindHint(kind: AnswerKind) {
  const hint = KIND_HINT[kind] ?? KIND_HINT.curta
  return { ...hint, inputMode: kind === 'numero' ? ('numeric' as const) : ('text' as const) }
}

/** A resposta de alguém, como a TV escreve (quem não respondeu fica de bico fechado). */
export function answerText(answers: Record<string, string> | undefined, id: number): string | null {
  const text = answers?.[String(id)]
  return typeof text === 'string' && text ? text : null
}

/** Grade das cartas da mesa: colunas por quantidade de gente (até 15 cabem na TV). */
export function tableColumns(count: number): number {
  if (count <= 4) return 2
  if (count <= 9) return 3
  if (count <= 12) return 4
  return 5
}

/**
 * Trilha da TV: Jingle Bells na hora de responder e votar (animado), a
 * caixinha de Noite Feliz na conversa (calma, para todo mundo se ouvir) e
 * "We Wish You a Merry Christmas" no fim.
 */
export function trackFor(phase: Phase, over: boolean): MusicTrack {
  if (over) return 'wish'
  if (phase === 'talk' || phase === 'answers' || phase === 'scores') return 'natal'
  return 'jingle'
}

/** Fases em que efeito aleatório da TV atrapalharia (respostas, votação e revelação). */
export function holdsScares(phase: Phase, over: boolean): boolean {
  return over || phase === 'answers' || phase === 'vote' || phase === 'result'
}

/**
 * O que o apresentador fala ao entrar em cada momento (uma fala por fase; ''
 * = fica quieto). Igual em rodada normal e sem impostor. As respostas na mesa
 * não têm fala: é a hora de a sala ler em silêncio. O resultado fala
 * `revealSpoken`; o fim, `finalSpoken`.
 */
export function narrationFor(state: Pick<State, 'phase' | 'round' | 'totalRounds' | 'realQuestion' | 'over'>): string {
  if (state.over) return ''
  switch (state.phase) {
    case 'question': {
      const opener = state.round === state.totalRounds && state.round > 1 ? 'Última rodada!' : `Rodada ${state.round}.`
      return `${opener} Respondam a pergunta no celular.`
    }
    case 'talk':
      return state.realQuestion ? `A pergunta de verdade era: ${state.realQuestion}` : ''
    case 'vote':
      return 'Hora de votar! Quem recebeu a pergunta trocada?'
    default:
      return ''
  }
}

/** O resultado da rodada, falado (curto; a manchete e os pontos ficam na tela). */
export function revealSpoken(result: PtResult, players: readonly HPlayer[]): string {
  const impostor = nameOf(players, result.impostor)
  const accused = nameOf(players, result.accused)
  if (result.impostor === null) return 'Não tinha impostor! Todo mundo recebeu a mesma pergunta.'
  if (result.caught) return `Pegaram! O impostor era ${impostor}.`
  if (result.accused !== null) return `${accused} era inocente! O impostor era ${impostor}.`
  return `O impostor era ${impostor}, e escapou!`
}

/** A fala do fim da partida (os campeões, se forem até 3). */
export function finalSpoken(players: readonly HPlayer[], champions: readonly number[]): string {
  if (!champions.length) return 'Fim da festa! Ninguém pontuou desta vez.'
  if (champions.length > 3) return 'Fim da festa! Olhem o placar na TV.'
  return `Fim da festa! ${champions.length > 1 ? 'Os campeões são' : 'Quem venceu foi'} ${namesOf(players, champions)}.`
}

export type RevealCopy = {
  icon: string
  /** Manchete da revelação (BigReveal). */
  title: string
  subtitle: string
  tone: RevealTone
  /** Som da manchete. */
  sound: SfxName
  /** Quem venceu, curtinho (placa da TV). */
  headline: string
}

/** O que a TV mostra na revelação de cada desfecho. */
export function revealCopy(result: PtResult, players: readonly HPlayer[]): RevealCopy {
  const impostor = nameOf(players, result.impostor)
  const accused = nameOf(players, result.accused)
  if (result.impostor === null) {
    return {
      icon: '😇',
      title: 'NÃO TINHA IMPOSTOR!',
      subtitle: result.top.length
        ? `Todo mundo recebeu a mesma pergunta. ${namesOf(players, result.top)} leva +${CONSOLATION_POINTS} de consolação`
        : 'Todo mundo recebeu a mesma pergunta — e ninguém votou!',
      tone: 'ghost',
      sound: 'chime',
      headline: '😇 Rodada sem impostor',
    }
  }
  if (result.caught) {
    return {
      icon: '🎯',
      title: `PEGARAM ${impostor.toUpperCase()}!`,
      subtitle: `${impostor} recebeu outra pergunta. A mesa ganha +${GROUP_POINTS} (e +${GROUP_POINTS + SHARP_BONUS} quem votou nele)`,
      tone: 'toxic',
      sound: 'win',
      headline: '🎉 A mesa venceu',
    }
  }
  if (result.accused !== null) {
    return {
      icon: '😇',
      title: `${accused.toUpperCase()} ERA INOCENTE!`,
      subtitle: `O impostor era ${impostor} — e escapou: +${ESCAPE_POINTS}`,
      tone: 'blood',
      sound: 'boing',
      headline: '🥸 O impostor escapou',
    }
  }
  return {
    icon: '🥸',
    title: `ERA ${impostor.toUpperCase()}!`,
    subtitle: result.top.length ? `Deu empate na votação: ${impostor} escapou e leva +${ESCAPE_POINTS}` : `Ninguém votou: ${impostor} escapou e leva +${ESCAPE_POINTS}`,
    tone: 'pumpkin',
    sound: 'giggle',
    headline: '🥸 O impostor escapou',
  }
}

/**
 * Visita de Natal depois da manchete: inocente condenado = o boneco de neve
 * perde o chapéu; sem impostor = um presente desce de paraquedas.
 */
export function revealMeme(result: PtResult): Extract<Cameo, 'snowman' | 'parachuteGift'> | null {
  if (result.impostor === null) return 'parachuteGift'
  if (!result.caught && result.accused !== null) return 'snowman'
  return null
}

export type MyOutcome = { icon: string; title: string; good: boolean | null }

/** O desfecho do ponto de vista de quem segura o celular. */
export function myOutcome(result: PtResult, meId: number): MyOutcome {
  if (result.impostor === null) {
    if (result.top.includes(meId)) return { icon: '😇', title: 'Inocente injustiçado!', good: true }
    return { icon: '😇', title: 'Não tinha impostor!', good: null }
  }
  if (result.impostor === meId) {
    return result.caught ? { icon: '🥶', title: 'Pegaram você…', good: false } : { icon: '😎', title: 'Você escapou!', good: true }
  }
  if (result.caught) {
    return result.sharp.includes(meId)
      ? { icon: '🎯', title: 'Você votou certo!', good: true }
      : { icon: '🎉', title: 'A mesa pegou o impostor!', good: true }
  }
  return { icon: '😱', title: 'O impostor escapou…', good: false }
}

/** Pontos ganhos por alguém nesta rodada. */
export function gainOf(state: Pick<State, 'result'>, id: number): number {
  return state.result?.gains[String(id)] ?? 0
}
