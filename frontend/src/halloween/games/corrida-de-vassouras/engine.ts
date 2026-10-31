import {
  addScores,
  answerDeadline,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  randomInt,
  ranking,
  shuffle,
  timeUp,
  withActed,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HInput, HalloweenEngine } from '../../engine/types'
import { WITCHES } from './content'

/**
 * 🧹 Corrida de Vassouras — cinco bruxas apostam corrida na TV.
 *
 * A cada etapa, todo mundo aposta em quem vai estar na frente no fim dela e
 * pode jogar uma maldição numa bruxa. Na 1ª etapa, também aposta em quem
 * vence a corrida. Depois, os dados decidem:
 *
 *   bet (30 s na 1ª, 20 s depois) ──► race (a TV anima) ──► payout (8 s) ──► bet da próxima etapa
 *                                                               └── alguém cruzou a chegada: payout (10 s) ──► final (over)
 *
 * Na corrida, cada bruxa anda 1–3 casas, numa ordem sorteada; a primeira a
 * chegar na casa 16 vence na hora (as que ainda não voaram ficam onde
 * estão). Se ninguém cruzou, a maldição pega no fim da etapa: a mais
 * amaldiçoada (2+ maldições, sem empate) cai da vassoura e volta 2 casas.
 *
 * Empate de casa: quem chegou por último fica na frente (como pilha de
 * camelo); quem cai da vassoura vai para trás de quem já está na casa.
 *
 * Fim garantido: na etapa 12 bate a meia-noite e vence quem estiver na
 * frente (na prática a corrida acaba antes, perto da 7ª ou 8ª etapa).
 *
 * O motor sorteia tudo no fecho das apostas e guarda a sequência em
 * `race`; a TV só anima. `step` é puro e idempotente, trata `skip` como
 * prazo vencido e nunca espera por quem está offline.
 */

export const WITCH_COUNT = WITCHES.length
export const TRACK_LENGTH = 16
export const MAX_STAGES = 12
export const FIRST_BET_SECONDS = 30
export const BET_SECONDS = 20
export const PAYOUT_SECONDS = 8
export const FINAL_PAYOUT_SECONDS = 10
export const MIN_ROLL = 1
export const MAX_ROLL = 3
export const FALL_SQUARES = 2
export const MIN_CURSES = 2
export const LEADER_PAYS = 3
export const SECOND_PAYS = 1
export const WINNER_PAYS = 5

/** Linha do tempo da corrida na TV, em ms (o motor usa para o prazo da fase). */
export const RACE_TIMING = {
  /** "Etapa N, valendo!" com as maldições à mostra. */
  intro: 1500,
  /** Cada bruxa: o dado gira (`roll`) e depois ela voa. */
  step: 1600,
  roll: 700,
  /** A mais amaldiçoada treme (`drop` ms: o susto cabe aqui) e cai da vassoura. */
  fall: 3400,
  drop: 2000,
  /** Teve maldição, mas ninguém caiu. */
  weak: 1600,
  /** Quem lidera a etapa. */
  lead: 1600,
  /** Alguém cruzou a chegada. */
  finish: 3400,
  /** Bateu a meia-noite (etapa 12). */
  midnight: 3400,
  /** Folga depois da animação, antes do pagamento. */
  tail: 600,
} as const

export type CvPhase = 'bet' | 'race' | 'payout' | 'final'

/** A aposta de um jogador numa etapa (bruxas por id; null = não escolheu). */
export type CvBet = { stage: number | null; curse: number | null }

/** Uma bruxa voando: tirou `roll` no dado e foi de `from` para `to`. */
export type CvStep = { witch: number; roll: number; from: number; to: number }

/** Tudo que aconteceu numa etapa — sorteado pelo motor, animado pela TV. */
export type CvRace = {
  /** Quando a corrida começou (ms do servidor): a TV anima a partir daqui. */
  at: number
  /** Duração da animação (sem a folga). */
  ms: number
  /** Posições no começo da etapa (índice = bruxa). */
  start: number[]
  /** Ordem de chegada no começo da etapa (a TV refaz o desempate durante a animação). */
  startArrivals: number[]
  /** Maldições recebidas por bruxa nesta etapa. */
  curses: number[]
  /** Os voos, na ordem sorteada; para em quem cruzou a chegada. */
  steps: CvStep[]
  /** Quem caiu da vassoura (2+ maldições, sem empate) e para onde voltou. */
  fell: number | null
  fallTo: number | null
  /** Posições no fim da etapa. */
  end: number[]
  /** Classificação no fim da etapa (1º → 5º). */
  order: number[]
  /** A campeã, se a corrida acabou nesta etapa. */
  finished: number | null
  /** Acabou pela meia-noite (etapa 12), não por alguém cruzar a chegada. */
  midnight: boolean
}

/** O pagamento da etapa, para as telas mostrarem quem ganhou o quê. */
export type CvPayout = {
  leader: number
  second: number
  /** Doces que cada jogador ganhou nesta etapa (só quem ganhou algo). */
  gains: Record<string, number>
  /** Quem apostou na líder (+3) e na segunda (+1). */
  onLeader: number[]
  onSecond: number[]
  /** Quem apostou na campeã (+5) — só quando a corrida acaba. */
  champions: number[]
  /** Quem amaldiçoou a bruxa que caiu (prêmio do fim, sem doce). */
  cursers: number[]
}

export type CvHistory = { round: number; leader: number; second: number; fell: number | null }

export type State = BaseState & {
  phase: CvPhase
  /** A etapa atual (1, 2, 3...). */
  round: number
  maxStages: number
  /** Casa de cada bruxa (índice = id da bruxa): 0 = largada, 16 = chegada. */
  positions: number[]
  /** Ordem de chegada na casa: maior = chegou por último = fica na frente. */
  arrivals: number[]
  /** Contador de chegadas (gera os números de `arrivals`). */
  tick: number
  /** Doces 🍬 de cada jogador. */
  scores: Record<string, number>
  acted: number[]
  /** Apostas da etapa — públicas só depois que as apostas fecham. */
  bets: Record<string, CvBet>
  /** Aposta na campeã (feita na 1ª etapa). */
  winnerBets: Record<string, number>
  race: CvRace | null
  payout: CvPayout | null
  /** A bruxa campeã (quando a corrida termina). */
  winner: number | null
  history: CvHistory[]
  /** Quantas vezes a maldição de cada jogador derrubou alguém. */
  curseHits: Record<string, number>
}

// ---------------------------------------------------------------------------
// Regras puras (exportadas para os testes e para as telas)
// ---------------------------------------------------------------------------

export function isWitch(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < WITCH_COUNT
}

/** A resposta de um celular, lida com segurança: campo inválido = não escolheu. */
export type BetDraft = { winner: number | null; stage: number | null; curse: number | null; done: boolean }

export function readBet(input: HInput | Record<string, unknown> | null | undefined): BetDraft {
  const witch = (value: unknown) => (isWitch(value) ? value : null)
  return {
    winner: witch(input?.winner),
    stage: witch(input?.stage),
    curse: witch(input?.curse),
    done: input?.done === true,
  }
}

/**
 * Classificação das bruxas, da primeira à última: mais longe primeiro; na
 * mesma casa, quem chegou por último fica na frente.
 */
export function standings(positions: readonly number[], arrivals: readonly number[]): number[] {
  return WITCHES.map((witch) => witch.id).sort(
    (a, b) => (positions[b] ?? 0) - (positions[a] ?? 0) || (arrivals[b] ?? 0) - (arrivals[a] ?? 0) || a - b,
  )
}

/** A mais amaldiçoada, se tiver 2+ maldições e ninguém empatado com ela. */
export function mostCursed(curses: readonly number[]): number | null {
  const best = Math.max(0, ...curses)
  if (best < MIN_CURSES) return null
  const top = curses.flatMap((count, witch) => (count === best ? [witch] : []))
  return top.length === 1 ? top[0] : null
}

/** O sorteio de uma etapa: a ordem dos voos e o dado de cada voo. */
export type StagePlan = { order: number[]; rolls: number[] }

export function planStage(rng: () => number): StagePlan {
  const order = shuffle(
    WITCHES.map((witch) => witch.id),
    rng,
  )
  return { order, rolls: order.map(() => randomInt(rng, MIN_ROLL, MAX_ROLL)) }
}

type Board = { positions: readonly number[]; arrivals: readonly number[]; tick: number }

/**
 * Joga uma etapa já sorteada: voos na ordem, para na primeira que cruzar a
 * chegada; senão, a maldição pega e, na última etapa, bate a meia-noite.
 */
export function applyStage(
  board: Board,
  plan: StagePlan,
  curses: readonly number[],
  round: number,
): { race: Omit<CvRace, 'at' | 'ms'>; arrivals: number[]; tick: number } {
  const positions = [...board.positions]
  const arrivals = [...board.arrivals]
  let tick = board.tick
  const steps: CvStep[] = []
  let crossed: number | null = null

  for (let index = 0; index < plan.order.length; index += 1) {
    const witch = plan.order[index]
    const roll = Math.min(MAX_ROLL, Math.max(MIN_ROLL, Math.round(plan.rolls[index] ?? MIN_ROLL)))
    const from = positions[witch]
    const to = Math.min(TRACK_LENGTH, from + roll)
    positions[witch] = to
    tick += 1
    arrivals[witch] = tick
    steps.push({ witch, roll, from, to })
    if (to >= TRACK_LENGTH) {
      crossed = witch
      break
    }
  }

  let fell: number | null = null
  let fallTo: number | null = null
  if (crossed === null) {
    fell = mostCursed(curses)
    if (fell !== null) {
      fallTo = Math.max(0, positions[fell] - FALL_SQUARES)
      positions[fell] = fallTo
      tick += 1
      // Negativo: fica atrás de quem já estava na casa (e de quem chegar depois).
      arrivals[fell] = -tick
    }
  }

  const order = standings(positions, arrivals)
  const midnight = crossed === null && round >= MAX_STAGES
  return {
    race: {
      start: [...board.positions],
      startArrivals: [...board.arrivals],
      curses: [...curses],
      steps,
      fell,
      fallTo,
      end: positions,
      order,
      finished: crossed ?? (midnight ? order[0] : null),
      midnight,
    },
    arrivals,
    tick,
  }
}

export type RaceBeat =
  | { kind: 'step'; at: number; ms: number; index: number }
  | { kind: 'intro' | 'fall' | 'weak' | 'lead' | 'finish' | 'midnight'; at: number; ms: number }

type BeatSource = Pick<CvRace, 'steps' | 'curses' | 'fell' | 'finished' | 'midnight'>

/** Os momentos da animação da TV, com início (`at`) e duração em ms. */
export function raceBeats(race: BeatSource): RaceBeat[] {
  const beats: RaceBeat[] = []
  let at = 0
  const push = (kind: Exclude<RaceBeat['kind'], 'step'>, ms: number) => {
    beats.push({ kind, at, ms })
    at += ms
  }
  push('intro', RACE_TIMING.intro)
  race.steps.forEach((_, index) => {
    beats.push({ kind: 'step', at, ms: RACE_TIMING.step, index })
    at += RACE_TIMING.step
  })
  if (race.finished !== null && !race.midnight) {
    push('finish', RACE_TIMING.finish)
    return beats
  }
  if (race.fell !== null) push('fall', RACE_TIMING.fall)
  else if (race.curses.some((count) => count > 0)) push('weak', RACE_TIMING.weak)
  if (race.midnight) push('midnight', RACE_TIMING.midnight)
  else push('lead', RACE_TIMING.lead)
  return beats
}

export function raceDuration(race: BeatSource): number {
  const beats = raceBeats(race)
  const last = beats[beats.length - 1]
  return last ? last.at + last.ms : 0
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

/** Quem já terminou de apostar (o celular manda `done` no último passo). */
export function doneIds(ctx: EngineCtx, state: State): number[] {
  return state.roster.filter((id) => inputFor(ctx, state.inputKey, id)?.done === true)
}

/** Todo mundo online terminou? Offline não segura; sem ninguém online, decide o prazo. */
function allOnlineDone(ctx: EngineCtx, state: State): boolean {
  const online = onlineRoster(ctx, state.roster)
  return online.length > 0 && online.every((id) => inputFor(ctx, state.inputKey, id)?.done === true)
}

/** As apostas válidas da etapa (vale o que cada um escolheu, mesmo sem terminar). */
export function collectBets(state: State, ctx: EngineCtx): Record<string, CvBet> {
  const bets: Record<string, CvBet> = {}
  for (const id of state.roster) {
    const input = inputFor(ctx, state.inputKey, id)
    if (!input) continue
    const { stage, curse } = readBet(input)
    if (stage !== null || curse !== null) bets[String(id)] = { stage, curse }
  }
  return bets
}

/** Aposta na campeã: só vale na 1ª etapa. */
function collectWinnerBets(state: State, ctx: EngineCtx): Record<string, number> {
  if (state.round !== 1) return state.winnerBets
  const winnerBets: Record<string, number> = {}
  for (const id of state.roster) {
    const { winner } = readBet(inputFor(ctx, state.inputKey, id))
    if (winner !== null) winnerBets[String(id)] = winner
  }
  return winnerBets
}

export function countCurses(bets: Record<string, CvBet>): number[] {
  const curses = WITCHES.map(() => 0)
  for (const bet of Object.values(bets)) {
    if (bet.curse !== null && isWitch(bet.curse)) curses[bet.curse] += 1
  }
  return curses
}

/** Abre as apostas da etapa `round`. */
function startStage(state: State, now: number, round: number): State {
  return {
    ...state,
    phase: 'bet',
    round,
    // Uma chave por etapa: aposta da etapa passada não vale nesta.
    inputKey: `bet-${round}`,
    deadline: answerDeadline(now, round === 1 ? FIRST_BET_SECONDS : BET_SECONDS),
    acted: [],
    bets: {},
    race: null,
    payout: null,
  }
}

/** Fecha as apostas e sorteia a etapa inteira; a TV anima o que ficou em `race`. */
function closeBets(state: State, ctx: EngineCtx): State {
  const bets = collectBets(state, ctx)
  const winnerBets = collectWinnerBets(state, ctx)
  const outcome = applyStage(state, planStage(ctx.rng), countCurses(bets), state.round)
  const ms = raceDuration(outcome.race)
  return {
    ...state,
    phase: 'race',
    deadline: deadlineIn(ctx.now, (ms + RACE_TIMING.tail) / 1000),
    acted: doneIds(ctx, state),
    bets,
    winnerBets,
    race: { ...outcome.race, at: ctx.now, ms },
    positions: outcome.race.end,
    arrivals: outcome.arrivals,
    tick: outcome.tick,
  }
}

function finish(state: State): State {
  return { ...state, phase: 'final', over: true, deadline: null }
}

/** Paga a etapa: líder +3, segunda +1 e, se a corrida acabou, campeã +5. */
function settle(state: State, now: number): State {
  const race = state.race
  if (!race) return finish(state) // não acontece; mas nada pode travar
  const [leader, second] = race.order
  const betOn = (witch: number) => state.roster.filter((id) => state.bets[String(id)]?.stage === witch)
  const onLeader = betOn(leader)
  const onSecond = betOn(second)
  const champions =
    race.finished === null ? [] : state.roster.filter((id) => state.winnerBets[String(id)] === race.finished)
  const cursers = race.fell === null ? [] : state.roster.filter((id) => state.bets[String(id)]?.curse === race.fell)

  const gains: Record<string, number> = {}
  const give = (ids: number[], amount: number) => {
    for (const id of ids) gains[String(id)] = (gains[String(id)] ?? 0) + amount
  }
  give(onLeader, LEADER_PAYS)
  give(onSecond, SECOND_PAYS)
  give(champions, WINNER_PAYS)

  return {
    ...state,
    phase: 'payout',
    deadline: deadlineIn(now, race.finished === null ? PAYOUT_SECONDS : FINAL_PAYOUT_SECONDS),
    scores: addScores(state.scores, gains),
    curseHits: addScores(state.curseHits, Object.fromEntries(cursers.map((id) => [id, 1]))),
    payout: { leader, second, gains, onLeader, onSecond, champions, cursers },
    winner: race.finished,
    history: [...state.history, { round: state.round, leader, second, fell: race.fell }],
  }
}

export const engine: HalloweenEngine<State> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const blank: State = {
      phase: 'bet',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      maxStages: MAX_STAGES,
      positions: WITCHES.map(() => 0),
      // Na largada a ordem é fixa; ela só desempata até a primeira bruxa voar.
      arrivals: WITCHES.map((witch) => witch.id),
      tick: WITCH_COUNT,
      scores: emptyScores(roster),
      bets: {},
      winnerBets: {},
      race: null,
      payout: null,
      winner: null,
      history: [],
      curseHits: emptyScores(roster),
    }
    return startStage(blank, ctx.now, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'bet':
        // Fecha no prazo, no "Pular" do host, ou quando todo mundo online terminou.
        if (timeUp(state, ctx) || allOnlineDone(ctx, state)) return closeBets(state, ctx)
        // Só atualiza os ✓ da TV — e só se alguém novo terminou.
        return withActed(state, doneIds(ctx, state))
      case 'race':
        return timeUp(state, ctx) ? settle(state, ctx.now) : state
      case 'payout':
        if (!timeUp(state, ctx)) return state
        if (state.winner !== null || state.round >= state.maxStages) return finish(state)
        return startStage(state, ctx.now, state.round + 1)
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.phase !== 'bet' || !state.roster.includes(playerId)) return null
    // A mesa costuma apostar em quem está na frente e amaldiçoar a líder.
    const order = standings(state.positions, state.arrivals)
    const stage = ctx.rng() < 0.6 ? order[randomInt(ctx.rng, 0, 1)] : randomInt(ctx.rng, 0, WITCH_COUNT - 1)
    const mood = ctx.rng()
    const rival = order[0] === stage ? order[1] : order[0]
    const curse = mood < 0.5 ? rival : mood < 0.75 ? randomInt(ctx.rng, 0, WITCH_COUNT - 1) : null
    const reply: Record<string, unknown> = { stage, curse, done: true }
    if (state.round === 1) reply.winner = randomInt(ctx.rng, 0, WITCH_COUNT - 1)
    return reply
  },
}

// ---------------------------------------------------------------------------
// Prêmios do fim — calculados do estado, servem para a TV e o celular
// ---------------------------------------------------------------------------

export type CvAwards = {
  ranking: RankEntry[]
  /** Quem juntou mais doces (vazio se ninguém ganhou nada). */
  kings: number[]
  topCandy: number
  /** A bruxa campeã; null se o host encerrou antes da chegada. */
  winner: number | null
  /** A bruxa na frente agora (a campeã, ou a líder quando a partida parou). */
  leader: number
  /** Quem apostou na campeã. */
  champions: number[]
  /** Quem mais derrubou bruxas com maldição. */
  curseMasters: number[]
  maxCurseHits: number
}

export function finalAwards(state: State): CvAwards {
  const order = ranking(state.scores, state.roster)
  const topCandy = order[0]?.score ?? 0
  const winner = isWitch(state.winner) ? state.winner : null
  const hits = (id: number) => state.curseHits?.[String(id)] ?? 0
  const maxCurseHits = Math.max(0, ...state.roster.map(hits))
  return {
    ranking: order,
    kings: topCandy > 0 ? order.filter((entry) => entry.score === topCandy).map((entry) => entry.id) : [],
    topCandy,
    winner,
    leader: winner ?? standings(state.positions, state.arrivals)[0],
    champions: winner === null ? [] : state.roster.filter((id) => state.winnerBets[String(id)] === winner),
    curseMasters: maxCurseHits > 0 ? state.roster.filter((id) => hits(id) === maxCurseHits) : [],
    maxCurseHits,
  }
}
