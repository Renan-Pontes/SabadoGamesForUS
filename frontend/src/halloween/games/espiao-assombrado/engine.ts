import {
  addScores,
  answerDeadline,
  chaosRoll,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  pick,
  ranking,
  readOption,
  sameIds,
  sample,
  shuffle,
  tally,
  timeUp,
  topUnique,
  withActed,
  type ChaosKind,
  type RankEntry,
  type TallyEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HInput, HalloweenEngine } from '../../engine/types'
import { PLACES } from './content'
import {
  ACCUSE_SECONDS,
  DEFAULT_ROUNDS,
  DEFAULT_TALK_MINUTES,
  FINAL_VOTE_SECONDS,
  LAST_CHANCE_SECONDS,
  MESA_KEY,
  POINTS,
  RESULT_SECONDS,
  RESUME_MIN_MS,
  REVEAL_SECONDS,
  ROUND_CHOICES,
  SCORES_SECONDS,
  TALK_CHOICES,
  accusationPasses,
  asCard,
  cleanGuess,
  guessHits,
  spyCountFor,
  winnerOf,
  type MesaSecret,
  type Outcome,
  type RoundKind,
  type SpyCard,
  type Winner,
} from './rules'

/**
 * 🕵️ Espião Assombrado — o favorito da mesa.
 *
 * Todo mundo recebe o lugar e um papel, menos o espião. A mesa conversa,
 * acusa (a maioria decide) e, no fim do tempo, aponta um suspeito. O espião
 * pode DIGITAR o lugar a qualquer momento (sem lista: são 40+ lugares).
 *
 *   reveal (10 s) ─► talk (5/7/9 min) ─┬─ chute do espião ─────────────────► result
 *                      ▲               ├─ acusação ─► accuse (30 s) ─┬─ não passou ─┘ (volta à conversa)
 *                      │               │                             └─ passou ──┐
 *                      │               └─ tempo ─► final_vote (30 s) ─ condenou ─┤
 *                      │                                                         ├─ espião ─► last_chance (30 s) ─► result
 *                      └──── scores (8 s) ◄── result (15 s) ◄── inocente/empate ─┘
 *                                                └── na última rodada ──► final (over)
 *
 * O lugar, os papéis e o tipo da rodada (normal, "todo mundo é espião",
 * "ninguém é espião") moram só no `private`: o de cada um na sua carta, o da
 * mesa em `private._mesa`. Nada disso aparece em campo público antes da
 * revelação. Como todo motor: `step` é puro e idempotente, devolve o MESMO
 * objeto quando nada muda, trata `skip` como prazo vencido e nunca espera
 * por quem está offline.
 */

export type Phase = 'reveal' | 'talk' | 'accuse' | 'final_vote' | 'last_chance' | 'result' | 'scores' | 'final'

/** Acusação em votação. Os votos são contados às claras, mas quem votou o quê fica em segredo. */
export type Accusation = { by: number; target: number; yes: number; no: number }

/** Condenação de um espião, guardada até o fim da última chance (para o bônus). */
export type Verdict = {
  target: number
  via: 'accusation' | 'final'
  /** Quem apontou o condenado: o acusador, ou quem votou nele na votação final. */
  pointers: number[]
}

export type GuessRecord = { by: number; text: string; right: boolean }

/** O que a TV revela no fim da rodada. */
export type RoundResult = {
  outcome: Outcome
  winner: Winner
  kind: RoundKind
  place: { name: string; icon: string }
  spies: number[]
  /** Quem a mesa condenou (null = ninguém). */
  convicted: number | null
  via: 'accusation' | 'final' | null
  /** Quem levou o bônus de acusação certeira. */
  sharp: number[]
  guess: GuessRecord | null
  /** A votação final aberta (vazia se a rodada acabou antes). */
  finalTally: TallyEntry[]
  /** Papel de cada um que sabia o lugar. */
  roles: Record<string, string>
  /** Pontos ganhos nesta rodada (só quem ganhou). */
  gains: Record<string, number>
}

export type HistoryEntry = {
  round: number
  place: string
  icon: string
  kind: RoundKind
  outcome: Outcome
  spies: number[]
}

export type EspiaoState = BaseState & {
  phase: Phase
  round: number
  totalRounds: number
  /** Duração da conversa (opção), em ms. */
  talkMs: number
  /** Rodadas malucas ligadas (é a opção, não o tipo da rodada). */
  chaosOn: boolean
  /** Quantos espiões a mesa deve procurar (1 até 8 pessoas, 2 a partir de 9) — o mesmo em toda rodada. */
  spyCount: number
  /** Quem começa perguntando. */
  starter: number | null
  /** Trecho da conversa: sobe a cada acusação rejeitada (a chave das respostas muda junto). */
  seg: number
  /** Quem já gastou a acusação desta rodada. */
  accusers: number[]
  accusation: Accusation | null
  /** Quanto faltava de conversa quando a acusação pausou o relógio (ms). */
  pausedLeft: number | null
  /** A última acusação rejeitada desta rodada (a TV mostra embaixo da vela). */
  rejected: Accusation | null
  /** Espião pego, na última chance. */
  caught: number | null
  verdict: Verdict | null
  finalTally: TallyEntry[]
  result: RoundResult | null
  scores: Record<string, number>
  /** Rodadas vencidas como espião (prêmio "Mestre do disfarce"). */
  spyWins: Record<string, number>
  /** Acusações certeiras (prêmio "Faro fino"). */
  sharpCount: Record<string, number>
  acted: number[]
  history: HistoryEntry[]
  private: Record<string, SpyCard | MesaSecret>
}

export type State = EspiaoState

// ---------------------------------------------------------------------------
// Chaves de resposta: uma por trecho, para nenhuma resposta velha valer de novo
// ---------------------------------------------------------------------------

export const talkKey = (round: number, seg: number) => `talk-${round}-${seg}`
export const accuseKey = (round: number, seg: number) => `acc-${round}-${seg}`
export const finalKey = (round: number) => `final-${round}`
export const lastKey = (round: number) => `last-${round}`

const EMPTY_MESA: MesaSecret = { kind: 'normal', place: 0, spies: [], deck: [] }

/** O segredo da rodada (só o motor e o fim da rodada usam). */
export function mesaOf(state: EspiaoState): MesaSecret {
  const mesa = state.private?.[MESA_KEY]
  return mesa && 'kind' in mesa ? mesa : EMPTY_MESA
}

/** A carta de um jogador. */
export function cardOf(state: EspiaoState, id: number): SpyCard | null {
  return asCard(state.private?.[String(id)])
}

// ---------------------------------------------------------------------------
// Rodada
// ---------------------------------------------------------------------------

/** Distribui as cartas da rodada `round` e abre a fase de olhar a carta. */
function startRound(state: EspiaoState, ctx: EngineCtx, round: number, deck: number[]): EspiaoState {
  const placeId = deck[round - 1] ?? (round - 1) % PLACES.length
  const place = PLACES[placeId] ?? PLACES[0]
  // Rodadas malucas já usadas saem do histórico (público só depois da revelação).
  const used = state.history.map((entry) => entry.kind).filter((kind): kind is ChaosKind => kind !== 'normal')
  const kind: RoundKind = chaosRoll<ChaosKind>(ctx.rng, round, state.chaosOn, used) ?? 'normal'

  // Espião sai de quem está online agora (espião offline deixaria a rodada sem graça).
  const online = onlineRoster(ctx, state.roster)
  const pool = online.length ? online : state.roster
  const drawn =
    kind === 'everyone' ? [...state.roster] : kind === 'nobody' ? [] : sample(pool, state.spyCount, ctx.rng)
  const spies = state.roster.filter((id) => drawn.includes(id))

  const roles = shuffle(place.roles, ctx.rng)
  const secrets: Record<string, SpyCard | MesaSecret> = {}
  let dealt = 0
  for (const id of state.roster) {
    if (spies.includes(id)) {
      secrets[String(id)] = { spy: true }
    } else {
      secrets[String(id)] = { spy: false, place: place.name, icon: place.icon, role: roles[dealt % roles.length] }
      dealt += 1
    }
  }
  secrets[MESA_KEY] = { kind, place: placeId, spies, deck }

  return {
    ...state,
    phase: 'reveal',
    round,
    inputKey: `reveal-${round}`,
    deadline: deadlineIn(ctx.now, REVEAL_SECONDS),
    starter: pool.length ? pick(pool, ctx.rng) : null,
    seg: 0,
    accusers: [],
    accusation: null,
    pausedLeft: null,
    rejected: null,
    caught: null,
    verdict: null,
    finalTally: [],
    result: null,
    acted: [],
    private: secrets,
  }
}

function startTalk(state: EspiaoState, now: number, ms: number): EspiaoState {
  return {
    ...state,
    phase: 'talk',
    inputKey: talkKey(state.round, state.seg),
    deadline: now + Math.max(0, Math.round(ms)),
    acted: [],
    accusation: null,
    pausedLeft: null,
  }
}

// ---------------------------------------------------------------------------
// Conversa: chute do espião e acusações
// ---------------------------------------------------------------------------

/** Horário do toque (o celular manda `at`); sem ele, fica para depois. */
function sentAt(input: HInput): number {
  return typeof input.at === 'number' && Number.isFinite(input.at) ? input.at : Number.MAX_SAFE_INTEGER
}

/** Quem agiu primeiro: pelo horário do toque e, no empate, pela ordem da mesa (sort estável). */
function earliest<T extends { at: number }>(acts: T[]): T | null {
  return [...acts].sort((a, b) => a.at - b.at)[0] ?? null
}

/**
 * O primeiro chute válido de um espião nesta rodada (texto limpo).
 *
 * Vale chute com a chave de QUALQUER trecho da conversa desta rodada: chute
 * processado sempre encerra a rodada, então um que ainda está lá chegou
 * atrasado — o celular ainda mostrava a conversa quando o espião chutou
 * (no último segundo, ou antes de ver uma acusação abrir). Na votação
 * final e na acusação ele ainda vale.
 */
function pendingGuess(state: EspiaoState, ctx: EngineCtx) {
  const { spies } = mesaOf(state)
  const acts: { by: number; text: string; at: number }[] = []
  for (const id of state.roster) {
    if (!spies.includes(id)) continue
    const input = ctx.inputs[id]
    if (!input || !isTalkKeyOf(state, input.k)) continue
    const text = cleanGuess(input.guess)
    if (text) acts.push({ by: id, text, at: sentAt(input) })
  }
  return earliest(acts)
}

/** A chave é de um trecho da conversa desta rodada (talk-R-0 até talk-R-seg)? */
function isTalkKeyOf(state: EspiaoState, key: unknown): boolean {
  for (let seg = 0; seg <= state.seg; seg += 1) if (key === talkKey(state.round, seg)) return true
  return false
}

/** A primeira acusação válida: alvo na mesa, nunca a si mesmo, uma por pessoa por rodada. */
function firstAccusation(state: EspiaoState, ctx: EngineCtx) {
  const acts: { by: number; target: number; at: number }[] = []
  for (const id of state.roster) {
    if (state.accusers.includes(id)) continue
    const input = inputFor(ctx, state.inputKey, id)
    const target = input?.accuse
    if (!input || typeof target !== 'number' || target === id || !state.roster.includes(target)) continue
    acts.push({ by: id, target, at: sentAt(input) })
  }
  return earliest(acts)
}

function stepTalk(state: EspiaoState, ctx: EngineCtx): EspiaoState {
  // O chute vem antes de tudo: o espião "parou o jogo".
  const guess = pendingGuess(state, ctx)
  if (guess) return resolveGuess(state, ctx, guess.by, guess.text, 'talk')
  const accusation = firstAccusation(state, ctx)
  if (accusation) return openAccusation(state, ctx, accusation.by, accusation.target)
  if (timeUp(state, ctx)) return openFinalVote(state, ctx)
  return state
}

/** Abre a votação de uma acusação e pausa o relógio da conversa. */
function openAccusation(state: EspiaoState, ctx: EngineCtx, by: number, target: number): EspiaoState {
  return {
    ...state,
    phase: 'accuse',
    inputKey: accuseKey(state.round, state.seg),
    deadline: answerDeadline(ctx.now, ACCUSE_SECONDS),
    accusers: [...state.accusers, by],
    // O acusador já entra votando SIM.
    accusation: { by, target, yes: 1, no: 0 },
    pausedLeft: Math.max(0, (state.deadline ?? ctx.now) - ctx.now),
    acted: [by],
  }
}

// ---------------------------------------------------------------------------
// Acusação: todos menos o acusado votam SIM/NÃO
// ---------------------------------------------------------------------------

/** Votos da acusação: o acusador conta SIM; o acusado não vota. */
export function countAccusation(state: EspiaoState, ctx: EngineCtx, accusation: Accusation) {
  let yes = 1
  let no = 0
  const voted = new Set<number>()
  for (const id of state.roster) {
    if (id === accusation.target || id === accusation.by) continue
    const vote = inputFor(ctx, state.inputKey, id)?.yes
    if (typeof vote !== 'boolean') continue
    voted.add(id)
    if (vote) yes += 1
    else no += 1
  }
  const voters = state.roster.filter((id) => id !== accusation.target && id !== accusation.by)
  const online = onlineRoster(ctx, voters)
  return {
    yes,
    no,
    acted: state.roster.filter((id) => id === accusation.by || voted.has(id)),
    everyone: online.length > 0 && online.every((id) => voted.has(id)),
  }
}

function stepAccuse(state: EspiaoState, ctx: EngineCtx): EspiaoState {
  const accusation = state.accusation
  if (!accusation) return backToTalk(state, ctx, null)
  // Chute que o espião mandou antes de a acusação aparecer no celular dele: vale.
  const late = pendingGuess(state, ctx)
  if (late) return resolveGuess(state, ctx, late.by, late.text, 'talk')

  const count = countAccusation(state, ctx, accusation)
  if (timeUp(state, ctx) || count.everyone) {
    const closed = { ...accusation, yes: count.yes, no: count.no }
    if (accusationPasses(count.yes, count.no)) {
      return convict({ ...state, accusation: closed, acted: count.acted }, ctx, {
        target: accusation.target,
        via: 'accusation',
        pointers: [accusation.by],
      })
    }
    return backToTalk(state, ctx, closed)
  }
  if (accusation.yes === count.yes && accusation.no === count.no && sameIds(state.acted, count.acted)) return state
  return { ...state, accusation: { ...accusation, yes: count.yes, no: count.no }, acted: count.acted }
}

/** Acusação rejeitada: a conversa volta de onde parou (com uma folguinha). */
function backToTalk(state: EspiaoState, ctx: EngineCtx, rejected: Accusation | null): EspiaoState {
  const left = Math.max(state.pausedLeft ?? 0, RESUME_MIN_MS)
  return startTalk({ ...state, seg: state.seg + 1, rejected: rejected ?? state.rejected }, ctx.now, left)
}

// ---------------------------------------------------------------------------
// Votação final, condenação e última chance
// ---------------------------------------------------------------------------

function openFinalVote(state: EspiaoState, ctx: EngineCtx): EspiaoState {
  return {
    ...state,
    phase: 'final_vote',
    inputKey: finalKey(state.round),
    deadline: answerDeadline(ctx.now, FINAL_VOTE_SECONDS),
    acted: [],
    accusation: null,
    pausedLeft: null,
  }
}

/** Voto válido de cada um na votação final: alvo na mesa e nunca em si mesmo. */
export function collectFinalVotes(state: EspiaoState, ctx: EngineCtx): Record<string, number> {
  const votes: Record<string, number> = {}
  for (const voter of state.roster) {
    const target = inputFor(ctx, state.inputKey, voter)?.vote
    if (typeof target === 'number' && target !== voter && state.roster.includes(target)) votes[String(voter)] = target
  }
  return votes
}

function stepFinalVote(state: EspiaoState, ctx: EngineCtx): EspiaoState {
  // Chute no último segundo da conversa que chegou ao juiz já na votação: vale.
  const late = pendingGuess(state, ctx)
  if (late) return resolveGuess(state, ctx, late.by, late.text, 'talk')
  const votes = collectFinalVotes(state, ctx)
  const acted = state.roster.filter((id) => votes[String(id)] !== undefined)
  const online = onlineRoster(ctx, state.roster)
  const everyone = online.length > 0 && online.every((id) => votes[String(id)] !== undefined)
  if (!timeUp(state, ctx) && !everyone) return withActed(state, acted)

  const entries = tally(votes)
  const target = topUnique(entries)
  const closed: EspiaoState = { ...state, acted, finalTally: entries }
  if (target === null) {
    const kind = mesaOf(state).kind
    return finish(closed, ctx, { outcome: kind === 'everyone' ? 'everyone' : kind === 'nobody' ? 'nobody-free' : 'tie' })
  }
  const pointers = entries.find((entry) => entry.id === target)?.voters ?? []
  return convict(closed, ctx, { target, via: 'final', pointers })
}

/** A mesa condenou alguém: espião vai para a última chance; o resto já é revelação. */
function convict(state: EspiaoState, ctx: EngineCtx, verdict: Verdict): EspiaoState {
  const mesa = mesaOf(state)
  if (mesa.kind === 'everyone') return finish(state, ctx, { outcome: 'everyone', verdict })
  if (mesa.kind === 'nobody') return finish(state, ctx, { outcome: 'nobody-convicted', verdict })
  if (!mesa.spies.includes(verdict.target)) return finish(state, ctx, { outcome: 'innocent', verdict })
  return {
    ...state,
    phase: 'last_chance',
    inputKey: lastKey(state.round),
    deadline: answerDeadline(ctx.now, LAST_CHANCE_SECONDS),
    caught: verdict.target,
    verdict,
    accusation: null,
    pausedLeft: null,
    acted: [],
  }
}

function stepLastChance(state: EspiaoState, ctx: EngineCtx): EspiaoState {
  const caught = state.caught
  if (caught !== null) {
    const text = cleanGuess(inputFor(ctx, state.inputKey, caught)?.guess)
    if (text) return resolveGuess(state, ctx, caught, text, 'last')
  }
  return timeUp(state, ctx) ? finish(state, ctx, { outcome: 'caught' }) : state
}

/** O espião chutou o lugar (no meio da conversa ou na última chance). */
function resolveGuess(state: EspiaoState, ctx: EngineCtx, by: number, text: string, when: 'talk' | 'last'): EspiaoState {
  const mesa = mesaOf(state)
  const guess: GuessRecord = { by, text, right: guessHits(text, mesa.place) }
  if (mesa.kind === 'everyone') return finish(state, ctx, { outcome: 'everyone', guess })
  if (when === 'talk') return finish(state, ctx, { outcome: guess.right ? 'guess-right' : 'guess-wrong', guess })
  return finish(state, ctx, { outcome: guess.right ? 'escaped' : 'caught', guess })
}

// ---------------------------------------------------------------------------
// Fim da rodada: pontos e revelação
// ---------------------------------------------------------------------------

type Ending = { outcome: Outcome; guess?: GuessRecord; verdict?: Verdict }

/** Pontos de cada desfecho (HALLOWEEN.md) e quem levou o bônus de acusação certeira. */
export function scoreRound(
  outcome: Outcome,
  roster: readonly number[],
  spies: readonly number[],
  extra: { guess?: GuessRecord | null; verdict?: Verdict | null },
): { gains: Record<string, number>; sharp: number[] } {
  const gains: Record<string, number> = {}
  const give = (ids: readonly number[], points: number) => {
    for (const id of ids) gains[String(id)] = points
  }
  const table = roster.filter((id) => !spies.includes(id))
  const spiesHere = roster.filter((id) => spies.includes(id))
  let sharp: number[] = []
  switch (outcome) {
    case 'caught':
      give(table, POINTS.table)
      // Quem apontou o espião certo (e sabia o lugar) leva +1.
      sharp = table.filter((id) => extra.verdict?.pointers.includes(id))
      for (const id of sharp) gains[String(id)] += POINTS.sharp
      break
    case 'guess-wrong':
      give(table, POINTS.table)
      break
    case 'escaped':
    case 'guess-right':
      give(spiesHere, POINTS.spy)
      if (extra.guess && spiesHere.includes(extra.guess.by)) gains[String(extra.guess.by)] = POINTS.spyGuess
      break
    case 'innocent':
    case 'tie':
      give(spiesHere, POINTS.spy)
      break
    case 'nobody-convicted':
      if (extra.verdict && roster.includes(extra.verdict.target)) give([extra.verdict.target], POINTS.injustice)
      break
    case 'nobody-free':
      give(roster, POINTS.peace)
      break
    case 'everyone':
      // Sem pontos: é para rir.
      break
  }
  return { gains, sharp }
}

function finish(state: EspiaoState, ctx: EngineCtx, ending: Ending): EspiaoState {
  const mesa = mesaOf(state)
  const place = PLACES[mesa.place] ?? PLACES[0]
  const verdict = ending.verdict ?? state.verdict
  const guess = ending.guess ?? null
  const winner = winnerOf(ending.outcome)
  const { gains, sharp } = scoreRound(ending.outcome, state.roster, mesa.spies, { guess, verdict })
  const spiesHere = state.roster.filter((id) => mesa.spies.includes(id))

  const roles: Record<string, string> = {}
  for (const id of state.roster) {
    const card = cardOf(state, id)
    if (card && !card.spy) roles[String(id)] = card.role
  }

  const one = (ids: readonly number[]) => Object.fromEntries(ids.map((id) => [String(id), 1]))
  return {
    ...state,
    phase: 'result',
    inputKey: `result-${state.round}`,
    deadline: deadlineIn(ctx.now, RESULT_SECONDS),
    acted: [],
    accusation: null,
    pausedLeft: null,
    result: {
      outcome: ending.outcome,
      winner,
      kind: mesa.kind,
      place: { name: place.name, icon: place.icon },
      spies: spiesHere,
      convicted: verdict?.target ?? null,
      via: verdict?.via ?? null,
      sharp,
      guess,
      finalTally: state.finalTally,
      roles,
      gains,
    },
    scores: addScores(state.scores, gains),
    spyWins: winner === 'spies' ? addScores(state.spyWins, one(spiesHere)) : state.spyWins,
    sharpCount: sharp.length ? addScores(state.sharpCount, one(sharp)) : state.sharpCount,
    history: [
      ...state.history,
      { round: state.round, place: place.name, icon: place.icon, kind: mesa.kind, outcome: ending.outcome, spies: spiesHere },
    ],
  }
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<EspiaoState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const talkMinutes = readOption<number>(ctx.options, 'talkMinutes', DEFAULT_TALK_MINUTES, TALK_CHOICES)
    const chaosOn = readOption<boolean>(ctx.options, 'chaos', true)
    // Um lugar por rodada, sem repetir na partida.
    const deck = shuffle(
      PLACES.map((_, id) => id),
      ctx.rng,
    ).slice(0, totalRounds)
    const blank: EspiaoState = {
      phase: 'reveal',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds,
      talkMs: talkMinutes * 60_000,
      chaosOn,
      spyCount: spyCountFor(roster.length),
      starter: null,
      seg: 0,
      accusers: [],
      accusation: null,
      pausedLeft: null,
      rejected: null,
      caught: null,
      verdict: null,
      finalTally: [],
      result: null,
      scores: emptyScores(roster),
      spyWins: emptyScores(roster),
      sharpCount: emptyScores(roster),
      history: [],
      private: {},
    }
    return startRound(blank, ctx, 1, deck)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'reveal':
        return timeUp(state, ctx) ? startTalk(state, ctx.now, state.talkMs) : state
      case 'talk':
        return stepTalk(state, ctx)
      case 'accuse':
        return stepAccuse(state, ctx)
      case 'final_vote':
        return stepFinalVote(state, ctx)
      case 'last_chance':
        return stepLastChance(state, ctx)
      case 'result':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null }
        return { ...state, phase: 'scores', inputKey: `scores-${state.round}`, deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx, state.round + 1, mesaOf(state).deck) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || !state.roster.includes(playerId)) return null
    const mesa = mesaOf(state)
    const isSpy = mesa.spies.includes(playerId)
    const others = state.roster.filter((id) => id !== playerId)
    switch (state.phase) {
      case 'talk': {
        // Por segundo de conversa: ~1 chute a cada 4 rodadas por espião e
        // ~1 acusação por rodada somando a mesa toda (cada um acusa uma vez).
        const seconds = Math.max(1, state.talkMs / 1000)
        if (isSpy && ctx.rng() < 0.25 / seconds) return { guess: botGuess(mesa, ctx.rng), at: ctx.now }
        if (others.length && !state.accusers.includes(playerId) && ctx.rng() < 1 / (state.roster.length * seconds)) {
          return { accuse: suspectFor(mesa, playerId, others, ctx.rng), at: ctx.now }
        }
        return null
      }
      case 'accuse': {
        const accusation = state.accusation
        if (!accusation || playerId === accusation.target || playerId === accusation.by) return null
        const guilty = mesa.spies.includes(accusation.target)
        return { yes: ctx.rng() < (guilty && !isSpy ? 0.75 : 0.35) }
      }
      case 'final_vote':
        return others.length ? { vote: suspectFor(mesa, playerId, others, ctx.rng) } : null
      case 'last_chance':
        return playerId === state.caught ? { guess: botGuess(mesa, ctx.rng) } : null
      default:
        return null
    }
  },
}

/** Quem sabe o lugar desconfia do espião certo metade das vezes; o espião aponta qualquer um. */
function suspectFor(mesa: MesaSecret, playerId: number, others: number[], rng: () => number): number {
  const spies = mesa.spies.filter((id) => id !== playerId && others.includes(id))
  if (!mesa.spies.includes(playerId) && spies.length && rng() < 0.5) return pick(spies, rng)
  return pick(others, rng)
}

/** Chute de bot: às vezes o lugar certo (com erro de digitação), às vezes outro qualquer. */
function botGuess(mesa: MesaSecret, rng: () => number): string {
  const right = PLACES[mesa.place]
  if (right && rng() < 0.45) return rng() < 0.3 ? right.name.toLowerCase().slice(0, -1) : right.name
  return pick(PLACES, rng).name
}

// ---------------------------------------------------------------------------
// Prêmios do fim (TV e celular)
// ---------------------------------------------------------------------------

export type EspiaoAwards = {
  ranking: RankEntry[]
  /** Quem fez mais pontos (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** 🕵️ Mestre do disfarce: mais rodadas vencidas como espião. */
  masterSpies: number[]
  maxSpyWins: number
  /** 🔎 Faro fino: mais acusações certeiras. */
  detectives: number[]
  maxSharp: number
}

function leaders(record: Record<string, number>, roster: readonly number[]) {
  const max = Math.max(0, ...roster.map((id) => record[String(id)] ?? 0))
  return { max, ids: max > 0 ? roster.filter((id) => (record[String(id)] ?? 0) === max) : [] }
}

export function finalAwards(state: EspiaoState): EspiaoAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const spy = leaders(state.spyWins ?? {}, state.roster)
  const sharp = leaders(state.sharpCount ?? {}, state.roster)
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    masterSpies: spy.ids,
    maxSpyWins: spy.max,
    detectives: sharp.ids,
    maxSharp: sharp.max,
  }
}
