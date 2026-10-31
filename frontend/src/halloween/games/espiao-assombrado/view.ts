import type { CSSProperties } from 'react'
import type { MusicTrack, SfxName } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import type { RevealTone } from '../../ui'
import type { EspiaoState, Phase, RoundResult } from './engine'
import { winnerOf, type Outcome } from './rules'

/**
 * Auxiliares das telas do "Espião Assombrado" (TV e celular): textos de cada
 * desfecho, relógio "m:ss", trilha por fase e vibração. Ficam fora dos .tsx
 * porque o react-refresh pede que esses arquivos exportem só o componente.
 */

/** "6:05" (arredonda para cima, como o relógio de prazo). */
export function clock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–:––'
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function spiesLabel(count: number): string {
  return count === 1 ? '1 espião' : `${count} espiões`
}

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

/** Trilha da TV: tensão na conversa, perseguição nas votações, vitória no fim. */
export function trackFor(phase: Phase, over: boolean): MusicTrack {
  if (over) return 'victory'
  if (phase === 'accuse' || phase === 'final_vote' || phase === 'last_chance') return 'chase'
  return 'tension'
}

/** Fases em que susto aleatório atrapalharia (votações e revelações). */
export function holdsScares(phase: Phase, over: boolean): boolean {
  return over || phase === 'accuse' || phase === 'final_vote' || phase === 'last_chance' || phase === 'result'
}

/**
 * Susto de meme da revelação (só na TV, uma vez por partida cada — repetido
 * perde a graça): a mesa condenou um inocente = "bruh"; o espião digitou o
 * lugar errado = cano de metal caindo; todo mundo era espião = doot doot.
 */
export function revealMeme(outcome: Outcome): 'bruh' | 'pipe' | 'doot' | null {
  switch (outcome) {
    case 'innocent':
      return 'bruh'
    case 'guess-wrong':
      return 'pipe'
    case 'everyone':
      return 'doot'
    default:
      return null
  }
}

/** Narração do começo da rodada (igual em toda rodada — inclusive nas malucas). */
export function revealNarration(round: number, spyCount: number): string {
  return `Rodada ${round}. Olhem a carta, escondido. ${spyCount === 1 ? 'Um de vocês é o espião.' : 'Dois de vocês são espiões.'}`
}

export type RevealCopy = {
  icon: string
  /** Manchete da revelação (BigReveal). */
  title: string
  subtitle: string
  tone: RevealTone
  /** Som depois do rufar. */
  sound: SfxName
  /** Quem venceu, curtinho (placa da TV). */
  headline: string
}

/** O que a TV mostra na revelação de cada desfecho. */
export function revealCopy(result: RoundResult, players: readonly HPlayer[]): RevealCopy {
  const spies = namesOf(players, result.spies)
  const spyWord = result.spies.length > 1 ? 'Os espiões eram' : 'O espião era'
  const convicted = nameOf(players, result.convicted)
  const guesser = nameOf(players, result.guess?.by)
  const place = `${result.place.icon} ${result.place.name}`
  const guessText = result.guess ? `“${result.guess.text}”` : ''
  switch (result.outcome) {
    case 'caught':
      return {
        icon: '🎯',
        title: 'PEGAMOS O ESPIÃO!',
        subtitle: result.guess ? `${convicted} chutou ${guessText} — era ${place}` : `${convicted} não adivinhou o lugar a tempo`,
        tone: 'toxic',
        sound: 'scream',
        headline: '🎉 A mesa venceu',
      }
    case 'escaped':
      return {
        icon: '😈',
        title: `${convicted.toUpperCase()} ESCAPOU!`,
        subtitle: `Foi pego, mas acertou o lugar: ${place}`,
        tone: 'blood',
        sound: 'laugh',
        headline: '🕵️ Os espiões venceram',
      }
    case 'guess-right':
      return {
        icon: '🔮',
        title: `${guesser.toUpperCase()} ACERTOU!`,
        subtitle: `O espião adivinhou o lugar: ${place}`,
        tone: 'witch',
        sound: 'laugh',
        headline: '🕵️ Os espiões venceram',
      }
    case 'guess-wrong':
      return {
        icon: '❌',
        title: 'CHUTE ERRADO!',
        subtitle: `${guesser} era espião e chutou ${guessText} — era ${place}`,
        tone: 'toxic',
        sound: 'scream',
        headline: '🎉 A mesa venceu',
      }
    case 'innocent':
      return {
        icon: '😇',
        title: `${convicted.toUpperCase()} ERA INOCENTE!`,
        subtitle: `${spyWord} ${spies}`,
        tone: 'blood',
        sound: 'laugh',
        headline: '🕵️ Os espiões venceram',
      }
    case 'tie':
      return {
        icon: '🕵️',
        title: `${spyWord.toUpperCase()} ${spies.toUpperCase()}!`,
        subtitle: result.spies.length > 1 ? 'Ninguém foi condenado — saíram ilesos' : 'Ninguém foi condenado — saiu ileso',
        tone: 'blood',
        sound: 'laugh',
        headline: '🕵️ Os espiões venceram',
      }
    case 'everyone':
      return {
        icon: '🤡',
        title: 'TODO MUNDO ERA ESPIÃO!',
        subtitle: `Ninguém sabia o lugar: era ${place}`,
        tone: 'pumpkin',
        // O "doot doot" vem do susto do esqueleto, logo em seguida.
        sound: 'reveal',
        headline: '🤡 Rodada maluca — sem pontos',
      }
    case 'nobody-convicted':
      return {
        icon: '😇',
        title: 'NÃO TINHA ESPIÃO!',
        subtitle: `${convicted} foi condenado à toa: +2 de inocente injustiçado`,
        tone: 'ghost',
        sound: 'ghost',
        headline: '😇 Rodada maluca',
      }
    case 'nobody-free':
      return {
        icon: '😇',
        title: 'NÃO TINHA ESPIÃO!',
        subtitle: 'Ninguém foi condenado: +1 para todo mundo',
        tone: 'ghost',
        sound: 'ghost',
        headline: '😇 Rodada maluca',
      }
  }
}

export type MyOutcome = { icon: string; title: string; good: boolean | null }

/** O desfecho do ponto de vista de quem segura o celular. */
export function myOutcome(result: RoundResult, meId: number): MyOutcome {
  const winner = winnerOf(result.outcome)
  const iWasSpy = result.spies.includes(meId)
  if (result.outcome === 'everyone') return { icon: '🤡', title: 'Todo mundo era espião!', good: null }
  if (winner === 'none') {
    if (result.convicted === meId) return { icon: '😇', title: 'Inocente injustiçado!', good: true }
    return { icon: '😇', title: 'Não tinha espião!', good: null }
  }
  if (winner === 'table') {
    if (!iWasSpy) return { icon: '🎉', title: 'A mesa venceu!', good: true }
    if (result.convicted === meId) return { icon: '💀', title: 'Você foi pego…', good: false }
    if (result.guess?.by === meId) return { icon: '💀', title: 'Você errou o chute…', good: false }
    return { icon: '💀', title: 'A mesa venceu os espiões…', good: false }
  }
  return iWasSpy ? { icon: '😈', title: 'Você venceu, espião!', good: true } : { icon: '😱', title: 'O espião venceu…', good: false }
}

/** Pontos ganhos por alguém nesta rodada. */
export function gainOf(state: EspiaoState, id: number): number {
  return state.result?.gains[String(id)] ?? 0
}
