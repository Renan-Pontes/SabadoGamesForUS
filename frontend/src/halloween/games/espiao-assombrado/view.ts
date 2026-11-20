import type { CSSProperties } from 'react'
import type { MusicTrack, SfxName } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import type { Cameo } from '../../scare/cameos'
import type { RevealTone } from '../../ui'
import type { EspiaoState, Phase, RoundResult } from './engine'
import { winnerOf, type Outcome } from './rules'

/**
 * Auxiliares das telas do "Espião de Natal" (TV e celular): textos de cada
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

/**
 * Trilha da TV: Jingle Bells na carta e nas votações (animado), a caixinha
 * de Noite Feliz na conversa (calma, para todo mundo se ouvir) e "We Wish You
 * a Merry Christmas" no fim.
 */
export function trackFor(phase: Phase, over: boolean): MusicTrack {
  if (over) return 'wish'
  if (phase === 'talk' || phase === 'result' || phase === 'scores') return 'natal'
  return 'jingle'
}

/** Fases em que piada aleatória da TV atrapalharia (votações e revelações). */
export function holdsScares(phase: Phase, over: boolean): boolean {
  return over || phase === 'accuse' || phase === 'final_vote' || phase === 'last_chance' || phase === 'result'
}

/** O que o duende desconfiado diz quando ninguém é inocente ("Hmm… TODO MUNDO?"). */
export const EVERYONE_ZOOM_NAME = 'TODO MUNDO'

/**
 * Visita de Natal da revelação (só na TV, uma vez por partida cada —
 * repetida perde a graça): a mesa condenou um inocente = o boneco de neve
 * perde o chapéu; o espião digitou o lugar errado = o pinguim escorrega;
 * todo mundo era espião = o duende desconfiado de "TODO MUNDO".
 */
export function revealMeme(outcome: Outcome): Extract<Cameo, 'snowman' | 'penguin' | 'peek'> | null {
  switch (outcome) {
    case 'innocent':
      return 'snowman'
    case 'guess-wrong':
      return 'penguin'
    case 'everyone':
      return 'peek'
    default:
      return null
  }
}

/** Narração do começo da rodada (igual em toda rodada — inclusive nas malucas). */
export function revealNarration(round: number, spyCount: number): string {
  return spyCount === 1
    ? `Rodada ${round}. Olhem a carta no celular, sem mostrar a ninguém.`
    : `Rodada ${round}. Olhem a carta: nesta rodada são dois espiões.`
}

/** Até 3 nomes falados ("Ana, Bia e Caio"); mais que isso, a voz não lista. */
function spokenNames(players: readonly HPlayer[], ids: readonly number[]): string | null {
  return ids.length && ids.length <= 3 ? namesOf(players, ids) : null
}

/** O resultado da rodada, falado (curto; a manchete e os detalhes ficam na tela). */
export function revealSpoken(result: RoundResult, players: readonly HPlayer[]): string {
  const convicted = nameOf(players, result.convicted)
  const guesser = nameOf(players, result.guess?.by)
  switch (result.outcome) {
    case 'caught':
      return 'Pegamos o espião! A mesa venceu.'
    case 'escaped':
      return `${convicted} era espião, mas acertou o lugar. Os espiões venceram!`
    case 'guess-right':
      return `${guesser} era espião e acertou o lugar. Os espiões venceram!`
    case 'guess-wrong':
      return `${guesser} era espião e errou o lugar. A mesa venceu!`
    case 'innocent':
      return `${convicted} era inocente! Os espiões venceram.`
    case 'tie': {
      const spies = spokenNames(players, result.spies)
      if (!spies) return 'Ninguém foi condenado. Os espiões venceram.'
      return `Ninguém foi condenado. ${result.spies.length > 1 ? 'Os espiões eram' : 'O espião era'} ${spies}.`
    }
    case 'everyone':
      return 'Todo mundo era espião! Rodada maluca, sem pontos.'
    case 'nobody-convicted':
      return `Não tinha espião! ${convicted} foi condenado à toa.`
    case 'nobody-free':
      return 'Não tinha espião! Um ponto de presente para todo mundo.'
  }
}

/** A fala do fim da partida (os campeões, se forem até 3). */
export function finalSpoken(players: readonly HPlayer[], champions: readonly number[]): string {
  if (!champions.length) return 'Fim da festa! Ninguém pontuou desta vez.'
  const names = spokenNames(players, champions)
  if (!names) return 'Fim da festa! Olhem o placar na TV.'
  return `Fim da festa! ${champions.length > 1 ? 'Os campeões são' : 'Quem venceu foi'} ${names}.`
}

/**
 * O que o apresentador fala ao entrar em cada momento (uma fala por fase; ''
 * = fica quieto). Igual em rodada normal e maluca.
 */
export function spokenLine(state: EspiaoState, players: readonly HPlayer[], phase: Phase, champions: readonly number[] = []): string {
  switch (phase) {
    case 'reveal':
      return revealNarration(state.round, state.spyCount)
    case 'talk':
      return state.seg > 0 ? 'Acusação rejeitada. Voltem para a conversa.' : `${nameOf(players, state.starter, 'Qualquer um')} começa perguntando. Valendo!`
    case 'accuse':
      return `${nameOf(players, state.accusation?.by)} acusou ${nameOf(players, state.accusation?.target)}. Votem no celular!`
    case 'final_vote':
      return 'Acabou o tempo! Votem: quem é o espião?'
    case 'last_chance':
      return `${nameOf(players, state.caught)} é espião! Última chance de adivinhar o lugar.`
    case 'result':
      return state.result ? revealSpoken(state.result, players) : ''
    case 'final':
      return finalSpoken(players, champions)
    default:
      return ''
  }
}

/** Aviso falado quando falta um minuto de conversa. */
export const LAST_MINUTE_LINE = 'Falta um minuto de conversa!'

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
        sound: 'win',
        headline: '🎉 A mesa venceu',
      }
    case 'escaped':
      return {
        icon: '😎',
        title: `${convicted.toUpperCase()} ESCAPOU!`,
        subtitle: `Foi pego, mas acertou o lugar: ${place}`,
        tone: 'blood',
        sound: 'giggle',
        headline: '🕵️ Os espiões venceram',
      }
    case 'guess-right':
      return {
        icon: '✨',
        title: `${guesser.toUpperCase()} ACERTOU!`,
        subtitle: `O espião adivinhou o lugar: ${place}`,
        tone: 'pumpkin',
        sound: 'chime',
        headline: '🕵️ Os espiões venceram',
      }
    case 'guess-wrong':
      return {
        icon: '❌',
        title: 'CHUTE ERRADO!',
        subtitle: `${guesser} era espião e chutou ${guessText} — era ${place}`,
        tone: 'toxic',
        sound: 'fail',
        headline: '🎉 A mesa venceu',
      }
    case 'innocent':
      return {
        icon: '😇',
        title: `${convicted.toUpperCase()} ERA INOCENTE!`,
        subtitle: `${spyWord} ${spies}`,
        tone: 'blood',
        sound: 'boing',
        headline: '🕵️ Os espiões venceram',
      }
    case 'tie':
      return {
        icon: '🕵️',
        title: `${spyWord.toUpperCase()} ${spies.toUpperCase()}!`,
        subtitle: result.spies.length > 1 ? 'Ninguém foi condenado — saíram ilesos' : 'Ninguém foi condenado — saiu ileso',
        tone: 'blood',
        sound: 'giggle',
        headline: '🕵️ Os espiões venceram',
      }
    case 'everyone':
      return {
        icon: '🤡',
        title: 'TODO MUNDO ERA ESPIÃO!',
        subtitle: `Ninguém sabia o lugar: era ${place}`,
        tone: 'pumpkin',
        // O zoom suspeito em "TODO MUNDO" vem logo em seguida.
        sound: 'boing',
        headline: '🤡 Rodada maluca — sem pontos',
      }
    case 'nobody-convicted':
      return {
        icon: '😇',
        title: 'NÃO TINHA ESPIÃO!',
        subtitle: `${convicted} foi condenado à toa: +2 de inocente injustiçado`,
        tone: 'ghost',
        sound: 'chime',
        headline: '😇 Rodada maluca',
      }
    case 'nobody-free':
      return {
        icon: '😇',
        title: 'NÃO TINHA ESPIÃO!',
        subtitle: 'Ninguém foi condenado: +1 de presente para todo mundo',
        tone: 'ghost',
        sound: 'sleigh',
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
    if (result.convicted === meId) return { icon: '🥶', title: 'Você foi pego…', good: false }
    if (result.guess?.by === meId) return { icon: '🥶', title: 'Você errou o chute…', good: false }
    return { icon: '🥶', title: 'A mesa venceu os espiões…', good: false }
  }
  return iWasSpy ? { icon: '😎', title: 'Você venceu, espião!', good: true } : { icon: '😱', title: 'O espião venceu…', good: false }
}

/** Pontos ganhos por alguém nesta rodada. */
export function gainOf(state: EspiaoState, id: number): number {
  return state.result?.gains[String(id)] ?? 0
}
