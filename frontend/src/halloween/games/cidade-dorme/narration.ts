import { nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import type { Cameo } from '../../scare/cameos'
import { DAY_LINES, END_LINES, LAST_NIGHT_LINE, NIGHT_LINES, NOBODY_OUT, QUIET_LINES, ROLE_INFO, SAVED_LINES, VOTE_LINE } from './content'
import { MAX_ROUNDS, type State } from './engine'

/**
 * O roteiro da TV: o que ela fala e qual efeito toca em cada momento da
 * partida. Puro (sem som nem React) — a TV só executa, e os testes conferem
 * o texto. Um "momento" é rodada + fase: cada um toca uma vez só.
 */

/** Efeito de entrada de cada momento (a TV traduz em playSfx). */
export type Stinger =
  | 'roles'
  | 'night'
  | 'death'
  | 'saved'
  | 'quiet'
  | 'day'
  | 'vote'
  | 'caught'
  | 'innocent'
  | 'nobody'
  | 'city'
  | 'killers'
  | 'ended'

export type TvCue = {
  /** Chave do momento (rodada + fase): muda, toca de novo. */
  moment: string
  stinger: Stinger | null
  /** Narração com a voz de contador de histórias ('' = calada). */
  speech: string
  /** 'cozy' = noite (mais devagar, aconchegante); 'cheer' = o resto (animada). */
  voice: 'cozy' | 'cheer'
  /** Quando falar (ms depois da entrada): no veredito, depois do rufar. */
  speechDelayMs: number
  /** Visita de Natal do momento (só em 1–2 momentos da partida): pequena, no canto da TV. */
  scare: { kind: Extract<Cameo, 'peek' | 'penguin'>; name?: string; delayMs: number } | null
}

/** Quanto dura o rufar do veredito antes do resultado aparecer. */
export const SUSPENSE_MS = 2400

/** A voz sintetizada lê "boneco de neve sem neve" se deixar: tira emoji e sobras. */
export function speakable(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

function lineFor(lines: readonly string[], index: number): string {
  if (!lines.length) return ''
  return lines[((index % lines.length) + lines.length) % lines.length]
}

/**
 * O que a TV fala ao entrar em cada momento: uma frase curta por fase. Na
 * manhã, só quem virou boneco de neve (e o papel) ou que ninguém virou — os
 * cartõezinhos dos duendes e as bolas de neve ficam na tela.
 */
export function narration(state: State, players: readonly HPlayer[]): string {
  const name = (id: number) => nameOf(players, id)
  if (state.over) return state.final ? END_LINES[state.final.reason] : 'Fim da história. A partida foi encerrada.'
  switch (state.phase) {
    case 'roles':
      return 'Bem-vindos à Vila Dorme! Olhem seu papel no celular, em segredo.'
    case 'night':
      return state.round >= MAX_ROUNDS ? LAST_NIGHT_LINE : lineFor(NIGHT_LINES, state.round - 1)
    case 'morning': {
      const news = state.news
      if (!news) return ''
      if (news.killed === null) return lineFor(news.saved ? SAVED_LINES : QUIET_LINES, news.round - 1)
      const role = news.role ? ` ${ROLE_INFO[news.role].was}.` : ''
      return speakable(`Bom dia! ${name(news.killed)} virou boneco de neve.${role}`)
    }
    case 'day':
      return lineFor(DAY_LINES, state.round - 1)
    case 'vote':
      return VOTE_LINE
    case 'verdict': {
      const verdict = state.verdict
      if (!verdict) return ''
      if (verdict.out === null) return NOBODY_OUT[verdict.reason === 'out' ? 'few' : verdict.reason]
      const role = verdict.role ? ` ${ROLE_INFO[verdict.role].was}!` : ''
      return speakable(`${name(verdict.out)} foi de trenó pro Polo Norte.${role}`)
    }
    default:
      return ''
  }
}

/** Efeito, fala e susto de cada momento. */
export function tvCue(state: State, players: readonly HPlayer[]): TvCue {
  const phase = state.over ? 'end' : state.phase
  const moment = `${state.round}-${phase}`
  const speech = narration(state, players)
  const base: TvCue = { moment, stinger: null, speech, voice: 'cheer', speechDelayMs: 0, scare: null }
  switch (phase) {
    case 'roles':
      return { ...base, stinger: 'roles' }
    case 'night':
      return { ...base, stinger: 'night', voice: 'cozy', speechDelayMs: 1200 }
    case 'morning': {
      const news = state.news
      const stinger: Stinger = news && news.killed !== null ? 'death' : news?.saved ? 'saved' : 'quiet'
      return { ...base, stinger, speechDelayMs: stinger === 'death' ? 1500 : 600 }
    }
    case 'day':
      return { ...base, stinger: 'day', speechDelayMs: 500 }
    case 'vote':
      return { ...base, stinger: 'vote', speechDelayMs: 500 }
    case 'verdict': {
      const verdict = state.verdict
      const out = verdict?.out ?? null
      const caught = out !== null && verdict?.role === 'killer'
      const stinger: Stinger = out === null ? 'nobody' : caught ? 'caught' : 'innocent'
      return {
        ...base,
        stinger,
        speechDelayMs: SUSPENSE_MS + 400,
        // 🤨 O duende desconfiado espia o duende pego ("Hmm… Ana?").
        scare: caught && out !== null ? { kind: 'peek', name: nameOf(players, out), delayMs: SUSPENSE_MS } : null,
      }
    }
    case 'end': {
      if (!state.final) return { ...base, stinger: 'ended' }
      const killersWon = state.final.winner === 'killers'
      return {
        ...base,
        stinger: killersWon ? 'killers' : 'city',
        speechDelayMs: 900,
        // Os duendes venceram: um pinguim escorrega pelos morros — a vila passou vergonha.
        scare: killersWon ? { kind: 'penguin', delayMs: 4500 } : null,
      }
    }
    default:
      return base
  }
}
