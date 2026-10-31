import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import {
  DAY_LINES,
  DEATH_INTROS,
  END_LINES,
  LAST_NIGHT_LINE,
  NIGHT_LINES,
  NOBODY_OUT,
  QUIET_LINES,
  ROLE_INFO,
  SAVED_LINES,
  VOTE_LINE,
} from './content'
import { MAX_ROUNDS, MAX_SPOKEN_HAUNTS, type State } from './engine'

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
  /** Narração com a voz de terror ('' = calada). */
  speech: string
  /** Quando falar (ms depois da entrada): no veredito, depois do rufar. */
  speechDelayMs: number
  /** Susto de meme do momento (só em 1–2 momentos dramáticos da partida). */
  scare: { kind: 'zoom' | 'static'; name?: string; delayMs: number } | null
}

/** Quanto dura o rufar do veredito antes do resultado aparecer. */
export const SUSPENSE_MS = 2400

/** A voz sintetizada lê "carinha com chifres" se deixar: tira emoji e sobras. */
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

/** Termina a frase com pontuação (o bilhete pode vir sem). */
function sentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

/** O que a TV fala ao entrar em cada momento. */
export function narration(state: State, players: readonly HPlayer[]): string {
  const name = (id: number) => nameOf(players, id)
  if (state.over) return state.final ? END_LINES[state.final.reason] : 'Fim da noite. A partida foi encerrada.'
  switch (state.phase) {
    case 'roles':
      return 'Bem-vindos à Cidade Dorme. Olhem o papel de vocês, em segredo.'
    case 'night':
      return state.round >= MAX_ROUNDS ? LAST_NIGHT_LINE : lineFor(NIGHT_LINES, state.round - 1)
    case 'morning': {
      const news = state.news
      if (!news) return ''
      const parts: string[] = []
      if (news.killed !== null) {
        parts.push(`${lineFor(DEATH_INTROS, news.round - 1)} A vítima desta noite foi ${name(news.killed)}.`)
        if (news.role) parts.push(`${ROLE_INFO[news.role].was}.`)
      } else {
        parts.push(lineFor(news.saved ? SAVED_LINES : QUIET_LINES, news.round - 1))
      }
      for (const note of news.notes) {
        const spoken = speakable(note)
        parts.push(spoken ? `Um bilhete foi encontrado: ${sentence(spoken)}` : 'Um bilhete foi encontrado, só com figurinhas.')
      }
      if (news.haunts.length) {
        // Até 3 nomes: a lista inteira com 10 fantasmas atropelaria o dia.
        const spoken = news.haunts.slice(0, MAX_SPOKEN_HAUNTS).map((haunt) => name(haunt.id))
        const more = news.haunts.length - spoken.length
        const list = more > 0 ? `${spoken.join(', ')} e mais ${more}` : listNames(spoken)
        parts.push(`Os fantasmas assombraram ${list}.`)
      }
      return speakable(parts.join(' '))
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
      return speakable(`A cidade expulsou ${name(verdict.out)}.${role}`)
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
  const base: TvCue = { moment, stinger: null, speech, speechDelayMs: 0, scare: null }
  switch (phase) {
    case 'roles':
      return { ...base, stinger: 'roles' }
    case 'night':
      return { ...base, stinger: 'night', speechDelayMs: 1200 }
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
        // 🤨📸 Zoom suspeito no assassino pego — o meme do momento.
        scare: caught && out !== null ? { kind: 'zoom', name: nameOf(players, out), delayMs: SUSPENSE_MS } : null,
      }
    }
    case 'end': {
      if (!state.final) return { ...base, stinger: 'ended' }
      const killersWon = state.final.winner === 'killers'
      return {
        ...base,
        stinger: killersWon ? 'killers' : 'city',
        speechDelayMs: 900,
        // Os assassinos venceram: a TV "perde o sinal" — ELE ESTÁ AQUI.
        scare: killersWon ? { kind: 'static', delayMs: 4500 } : null,
      }
    }
    default:
      return base
  }
}
