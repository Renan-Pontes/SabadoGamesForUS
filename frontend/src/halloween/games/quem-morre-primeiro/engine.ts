import {
  actedIds,
  addScores,
  allOnlineActed,
  answerDeadline,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  pick,
  ranking,
  readOption,
  refreshActed,
  shuffle,
  tally,
  timeUp,
  topIds,
  type RankEntry,
  type TallyEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { QUESTIONS } from './content'

/**
 * ⚰️ Quem Morre Primeiro? — o jogo de referência da Noite do Terror.
 *
 * A TV pergunta "quem da galera...?", todo mundo vota em alguém, o mais
 * votado ganha uma lápide e quem votou nele ganha ponto.
 *
 *   vote (25 s) ──► reveal (11 s) ──► scores (7 s) ──► vote da próxima rodada
 *                         └── na última rodada ──► final (over)
 *
 * Como todo motor: `step` é puro e idempotente, devolve o MESMO objeto
 * quando nada muda, trata `skip` como prazo vencido (`timeUp`) e nunca
 * espera por quem está offline.
 */

export const VOTE_SECONDS = 25
export const REVEAL_SECONDS = 11
export const SCORES_SECONDS = 7
export const ROUND_CHOICES = [6, 8, 10] as const
export const DEFAULT_ROUNDS = 8

export type QmpPhase = 'vote' | 'reveal' | 'scores' | 'final'

/** O que a TV revela no fim de cada votação. */
export type QmpReveal = {
  /** Votos por pessoa, do mais votado ao menos (só quem recebeu voto). */
  tally: TallyEntry[]
  /** Quem levou a lápide: o mais votado (no empate, todos os empatados). */
  dead: number[]
  /** Quem votou em quem (público depois da votação: é a graça do jogo). */
  votes: Record<string, number>
  /** Quem votou num dos mortos e ganhou o ponto. */
  seers: number[]
}

export type QmpState = BaseState & {
  phase: QmpPhase
  round: number
  totalRounds: number
  /** Perguntas sorteadas para a partida (ids de QUESTIONS), uma por rodada. */
  deck: number[]
  /** A pergunta da rodada, já com o texto: a TV só desenha o que está aqui. */
  question: { id: number; text: string; epitaph: string }
  scores: Record<string, number>
  /** Quantas lápides cada um ganhou. */
  deaths: Record<string, number>
  acted: number[]
  /** Preenchido na revelação; null durante a votação. */
  reveal: QmpReveal | null
  /** Linha do tempo: quem morreu em cada pergunta. */
  history: { question: number; dead: number[] }[]
}

function questionFor(id: number): QmpState['question'] {
  const question = QUESTIONS[id] ?? QUESTIONS[0]
  return { id, text: question.text, epitaph: question.epitaph }
}

/** Abre a votação da rodada `round`. */
function startRound(state: QmpState, now: number, round: number): QmpState {
  return {
    ...state,
    phase: 'vote',
    round,
    // Uma chave por rodada: voto da rodada passada não conta nesta.
    inputKey: `vote-${round}`,
    deadline: answerDeadline(now, VOTE_SECONDS),
    question: questionFor(state.deck[round - 1] ?? 0),
    acted: [],
    reveal: null,
  }
}

/** O voto válido de cada um: alvo precisa estar na partida. */
export function collectVotes(state: QmpState, ctx: EngineCtx): Record<string, number> {
  const votes: Record<string, number> = {}
  for (const voter of state.roster) {
    const target = inputFor(ctx, state.inputKey, voter)?.vote
    if (typeof target === 'number' && state.roster.includes(target)) votes[String(voter)] = target
  }
  return votes
}

/** Fecha a votação: conta, enterra o mais votado e paga quem acertou. */
function revealVotes(state: QmpState, ctx: EngineCtx): QmpState {
  const votes = collectVotes(state, ctx)
  const entries = tally(votes)
  const dead = topIds(entries)
  const seers = Object.entries(votes)
    .filter(([, target]) => dead.includes(target))
    .map(([voter]) => Number(voter))
  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, REVEAL_SECONDS),
    acted: actedIds(ctx, state.inputKey, state.roster),
    reveal: { tally: entries, dead, votes, seers },
    scores: addScores(state.scores, Object.fromEntries(seers.map((id) => [id, 1]))),
    deaths: addScores(state.deaths, Object.fromEntries(dead.map((id) => [id, 1]))),
    history: [...state.history, { question: state.question.id, dead }],
  }
}

export const engine: HalloweenEngine<QmpState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const deck = shuffle(
      QUESTIONS.map((_, id) => id),
      ctx.rng,
    ).slice(0, totalRounds)
    const blank: QmpState = {
      phase: 'vote',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds,
      deck,
      question: questionFor(deck[0] ?? 0),
      scores: emptyScores(roster),
      deaths: emptyScores(roster),
      reveal: null,
      history: [],
    }
    return startRound(blank, ctx.now, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'vote':
        // Acaba no prazo, no "Pular" do host, ou quando todo mundo online votou.
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster)) {
          return revealVotes(state, ctx)
        }
        // Só atualiza os ✓ da TV — e só se alguém novo votou.
        return refreshActed(state, ctx)
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) {
          return { ...state, phase: 'final', over: true, deadline: null }
        }
        return { ...state, phase: 'scores', deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx.now, state.round + 1) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.phase !== 'vote' || !state.roster.includes(playerId)) return null
    // A galera costuma concordar: metade dos bots vai no "favorito" da
    // pergunta, o resto vota em qualquer um (inclusive em si mesmo).
    const favorite = state.roster[state.question.id % state.roster.length]
    return { vote: ctx.rng() < 0.5 ? favorite : pick(state.roster, ctx.rng) }
  },
}

export type QmpAwards = {
  /** Classificação final por pontos. */
  ranking: RankEntry[]
  /** "Vidente da noite": quem mais pontuou (vazio se ninguém pontuou). */
  seers: number[]
  topScore: number
  /** "Quem morreu mais vezes" (vazio se ninguém morreu). */
  mostDead: number[]
  maxDeaths: number
}

/** Os prêmios do fim — calculados do estado, servem para a TV e o celular. */
export function finalAwards(state: QmpState): QmpAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const maxDeaths = Math.max(0, ...state.roster.map((id) => state.deaths[String(id)] ?? 0))
  return {
    ranking: order,
    seers: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    mostDead: maxDeaths > 0 ? state.roster.filter((id) => (state.deaths[String(id)] ?? 0) === maxDeaths) : [],
    maxDeaths,
  }
}
