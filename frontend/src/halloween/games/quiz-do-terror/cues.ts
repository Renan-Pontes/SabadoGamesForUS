import type { MusicTrack } from '../../audio'
import { listNames, nameOf, ranking } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import { SCORES_EVERY, finalAwards, type QuizReveal, type QuizState } from './engine'

/**
 * O roteiro de som, voz e susto da TV, momento a momento. É puro (dá para
 * testar sem navegador) e a TV lê a cena UMA vez, quando o momento começa:
 * se alguém sai da sala ou troca de nome no meio do pódio, o rufar, a voz e
 * o zoom não tocam de novo.
 */

/** O que toca depois do rufar da revelação. */
export type RevealCue = 'acertos' | 'todos-acertaram' | 'ninguem-acertou' | 'ninguem-respondeu'

export function revealCue(reveal: QuizReveal | null): RevealCue {
  const answered = reveal ? Object.keys(reveal.choices).length : 0
  const hits = reveal ? Object.keys(reveal.points).length : 0
  if (answered === 0) return 'ninguem-respondeu'
  if (hits === 0) return 'ninguem-acertou'
  // Uma pessoa sozinha acertando não é "a sala inteira".
  if (hits === answered && hits > 1) return 'todos-acertaram'
  return 'acertos'
}

/**
 * Trilha que a tela do jogo pede por cima da do meta: perseguição na última
 * pergunta e também na revelação dela (sem voltar à do quiz no meio do
 * suspense). null = a trilha do meta; no fim, a moldura toca a da vitória.
 */
export function quizMusic(state: QuizState): MusicTrack | null {
  if (state.over || state.round < state.totalRounds) return null
  return state.phase === 'question' || state.phase === 'reveal' ? 'chase' : null
}

/** No primeiro placar, os olhos no escuro sussurram o nome de quem está em último. */
export const EYES_ROUND = SCORES_EVERY

/**
 * Susto aleatório da TV pode cair agora? Só nos placares — pergunta,
 * revelação e pódio são sagrados — e não no primeiro, que já tem os olhos
 * (o overlay enfileira susto sobre susto, e os dois invadiriam a próxima pergunta).
 */
export function randomScaresAllowed(state: QuizState): boolean {
  return !state.over && state.phase === 'scores' && state.round !== EYES_ROUND
}

/** Quem está em último agora (null jogando sozinho ou com todo mundo empatado). */
export function lanternOf(state: QuizState): number | null {
  const order = ranking(state.scores, state.roster)
  if (order.length < 2) return null
  const last = order[order.length - 1]
  return last.score < order[0].score ? last.id : null
}

function names(ids: number[], players: readonly HPlayer[]) {
  return listNames(ids.map((id) => nameOf(players, id)))
}

export type QuizScene = {
  /** 'question' | 'reveal' | 'scores' | 'final' (o "Encerrar" do host conta como fim). */
  phase: string
  /** É a última pergunta (ou a revelação dela). */
  last: boolean
  cue: RevealCue
  /** "Ana lidera!" no placar ('' se ninguém pontuou). */
  leaderText: string
  /** Nome que os olhos no escuro sussurram ('' fora do primeiro placar). */
  eyesOn: string
  /** Campeões no fim ('' se ninguém pontuou). */
  championText: string
  /** Quem leva o zoom suspeito no fim. */
  zoomOn: string
}

export function sceneOf(state: QuizState, players: readonly HPlayer[]): QuizScene {
  const phase = state.over ? 'final' : state.phase
  const scene: QuizScene = {
    phase,
    last: state.round >= state.totalRounds,
    cue: revealCue(state.reveal),
    leaderText: '',
    eyesOn: '',
    championText: '',
    zoomOn: '',
  }
  if (phase === 'scores') {
    const leading = ranking(state.scores, state.roster)
      .filter((entry) => entry.place === 1 && entry.score > 0)
      .map((entry) => entry.id)
    if (leading.length) scene.leaderText = `${names(leading, players)} ${leading.length > 1 ? 'lideram' : 'lidera'}!`
    const lantern = state.round === EYES_ROUND ? lanternOf(state) : null
    if (lantern !== null) scene.eyesOn = nameOf(players, lantern)
  }
  if (phase === 'final') {
    const champions = finalAwards(state).champions
    if (champions.length) {
      scene.championText = names(champions, players)
      scene.zoomOn = nameOf(players, champions[0])
    }
  }
  return scene
}
