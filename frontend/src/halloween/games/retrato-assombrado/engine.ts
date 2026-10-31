import {
  addScores,
  answerDeadline,
  chaosRoll,
  deadlineIn,
  emptyScores,
  fuzzyMatch,
  inputFor,
  onlineRoster,
  pick,
  ranking,
  readOption,
  sample,
  slotFor,
  tally,
  timeUp,
  topIds,
  withActed,
  type ChaosKind,
  type RankEntry,
  type TallyEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { CATEGORIES, answersFor, categoryAt, categoryLabel } from './content'
import { botStrokes, readDrawing } from './drawing'

/**
 * 🎨 Retrato Assombrado — desenho com impostor, todo mundo ao mesmo tempo.
 *
 * Todo mundo vê a categoria; só quem não é impostor vê a palavra. Todos
 * desenham juntos no celular, em duas etapas, com uma espiadinha na TV no
 * meio (a chance de o impostor copiar). Depois, a galeria e a votação.
 *
 *   show (8 s) ─► draw1 (25 s) ─► peek (10 s) ─► draw2 (20 s) ─► gallery (12 s)
 *     ─► vote (40 s) ─► reveal (10 s) ─┬─ pegaram o impostor ─► guess (30 s) ─┐
 *                                      └──────────────────────────────────────┴─► result (9 s)
 *     ─► scores (7 s) ─► show da próxima rodada   (na última: result ─► final)
 *
 * Rodadas malucas (a partir da 2ª, com a opção ligada): "todo mundo é
 * impostor" e "ninguém é impostor". Nada no estado público muda nelas antes
 * da revelação — quem é o quê mora só no `private` de cada um.
 *
 * Os desenhos NÃO passam pelo estado: cada celular grava o seu no slot
 * 'draw' e a TV desenha a galeria direto dos slots. O motor só lê o
 * "Pronto" de cada um para fechar a etapa mais cedo.
 */

export const SHOW_SECONDS = 8
export const DRAW1_SECONDS = 25
export const PEEK_SECONDS = 10
export const DRAW2_SECONDS = 20
export const GALLERY_SECONDS = 12
export const VOTE_SECONDS = 40
export const REVEAL_SECONDS = 10
export const GUESS_SECONDS = 30
export const RESULT_SECONDS = 9
export const SCORES_SECONDS = 7

export const ROUND_CHOICES = [3, 4, 5] as const
export const DEFAULT_ROUNDS = 4
/** A partir de quantos jogadores entram dois impostores. */
export const TWO_IMPOSTORS_FROM = 9
/** Rodadas malucas precisam de mesa: com menos gente, só rodada normal. */
export const CHAOS_MIN_PLAYERS = 3

/** Impostor que escapou. */
export const ESCAPE_POINTS = 2
/** Quem votou num impostor, quando a mesa pega um. */
export const CATCH_POINTS = 1
/** Impostor pego que acerta a palavra. */
export const GUESS_POINTS = 2
/** Rodada sem impostor: o mais votado leva de consolação. */
export const CONSOLATION_POINTS = 2

/** Tamanho máximo do chute digitado (o resto é cortado). */
export const MAX_GUESS_LENGTH = 40
/** Slot onde cada celular guarda o desenho. */
export const DRAW_SLOT = 'draw'

export type RaPhase =
  | 'show'
  | 'draw1'
  | 'peek'
  | 'draw2'
  | 'gallery'
  | 'vote'
  | 'reveal'
  | 'guess'
  | 'result'
  | 'scores'
  | 'final'

/** O segredo de cada um: o impostor não recebe a palavra. */
export type RaSecret = { role: 'artist' | 'impostor'; word: string | null }

/** O que a TV mostra quando a votação fecha. */
export type RaReveal = {
  /** Quem votou em quem (só votos válidos). */
  votes: Record<string, number>
  tally: TallyEntry[]
  /** Os mais votados (empatados juntos; vazio se ninguém votou). */
  top: number[]
  /** O acusado: o mais votado SEM empate (null = empate ou ninguém votou). */
  accused: number | null
  /** Os impostores de verdade desta rodada. */
  impostors: number[]
  /** Rodada maluca, revelada agora (null = rodada normal). */
  chaos: ChaosKind | null
  /** Rodada normal e o acusado era impostor. */
  caught: boolean
}

/** O fim da rodada: a palavra, o chute e quem ganhou o quê. */
export type RaOutcome = {
  /** A palavra (null na rodada em que todo mundo era impostor: não havia palavra). */
  word: string | null
  guess: string | null
  guessRight: boolean
  /** Pontos ganhos nesta rodada (só quem ganhou). */
  gains: Record<string, number>
  /** Quem (da mesa) votou num impostor. */
  hits: number[]
  /** Impostores que escaparam. */
  escaped: number[]
}

/** Linha do tempo da partida (para o fim). */
export type RaRound = {
  round: number
  categoryId: number
  word: string | null
  impostors: number[]
  chaos: ChaosKind | null
  accused: number | null
  caught: boolean
  guessRight: boolean
  hits: number[]
  escaped: number[]
}

export type State = BaseState & {
  phase: RaPhase
  round: number
  totalRounds: number
  /** Rodadas malucas ligadas na configuração. */
  chaosOn: boolean
  /** Rodadas malucas que já foram REVELADAS (no máximo uma de cada). */
  chaosUsed: ChaosKind[]
  /** Quantos impostores a mesa enfrenta — o mesmo número nas rodadas malucas, para não entregar nada. */
  impostorCount: number
  /** Categoria da rodada (pública: todo mundo vê). */
  categoryId: number
  category: string
  usedCategories: number[]
  acted: number[]
  scores: Record<string, number>
  reveal: RaReveal | null
  outcome: RaOutcome | null
  history: RaRound[]
  private: Record<string, RaSecret>
}

/** Chaves das respostas de cada etapa (mudam a cada rodada). */
export const keys = {
  show: (round: number) => `show-${round}`,
  draw1: (round: number) => `draw1-${round}`,
  draw2: (round: number) => `draw2-${round}`,
  vote: (round: number) => `vote-${round}`,
  guess: (round: number) => `guess-${round}`,
}

/** Chaves aceitas para o desenho da rodada: o da 1ª etapa vale até alguém continuar na 2ª. */
export function drawKeys(round: number): string[] {
  return [keys.draw1(round), keys.draw2(round)]
}

/** Fases em que se responde algo (com folga de 2 s no prazo). */
export const ANSWER_PHASES: readonly RaPhase[] = ['draw1', 'draw2', 'vote', 'guess']

/** Duração cheia de cada fase em segundos (sem a folga), para a vela da TV. */
export const PHASE_SECONDS: Record<RaPhase, number> = {
  show: SHOW_SECONDS,
  draw1: DRAW1_SECONDS,
  peek: PEEK_SECONDS,
  draw2: DRAW2_SECONDS,
  gallery: GALLERY_SECONDS,
  vote: VOTE_SECONDS,
  reveal: REVEAL_SECONDS,
  guess: GUESS_SECONDS,
  result: RESULT_SECONDS,
  scores: SCORES_SECONDS,
  final: 0,
}

// ---------------------------------------------------------------------------
// Segredos e leituras
// ---------------------------------------------------------------------------

/** Os impostores da rodada, lidos dos segredos (na ordem do roster). */
export function impostorsOf(state: State): number[] {
  return state.roster.filter((id) => state.private?.[String(id)]?.role === 'impostor')
}

/** A palavra da rodada: está no segredo de qualquer não-impostor (null se ninguém a tem). */
export function wordOf(state: State): string | null {
  for (const id of state.roster) {
    const word = state.private?.[String(id)]?.word
    if (typeof word === 'string' && word) return word
  }
  return null
}

/**
 * Qual rodada maluca era — sai dos próprios segredos, sem campo público:
 * todos impostores = "todo mundo"; ninguém impostor = "ninguém".
 */
export function chaosOf(roster: readonly number[], impostors: readonly number[]): ChaosKind | null {
  if (roster.length < CHAOS_MIN_PLAYERS) return null
  if (impostors.length === roster.length) return 'everyone'
  if (impostors.length === 0) return 'nobody'
  return null
}

/** Quantos impostores para esta mesa: 1 até 8 jogadores, 2 a partir de 9. */
export function impostorCountFor(players: number): number {
  return players >= TWO_IMPOSTORS_FROM ? 2 : 1
}

/** Quem apertou "Pronto" nesta etapa de desenho (na ordem do roster). */
export function doneIds(state: State, ctx: EngineCtx): number[] {
  return state.roster.filter((id) => slotFor(ctx, DRAW_SLOT, id, state.inputKey)?.done === true)
}

/** O voto válido de cada um: alvo na partida e nunca em si mesmo. */
export function collectVotes(state: State, ctx: EngineCtx): Record<string, number> {
  const votes: Record<string, number> = {}
  for (const voter of state.roster) {
    const target = inputFor(ctx, state.inputKey, voter)?.vote
    if (typeof target === 'number' && target !== voter && state.roster.includes(target)) {
      votes[String(voter)] = target
    }
  }
  return votes
}

/** O chute do acusado, limpo (null = ainda não chutou ou mandou vazio). */
export function guessOf(state: State, ctx: EngineCtx): string | null {
  const accused = state.reveal?.accused
  if (accused === null || accused === undefined) return null
  const raw = inputFor(ctx, state.inputKey, accused)?.guess
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_GUESS_LENGTH).trim()
  return text || null
}

function isOnline(ctx: EngineCtx, id: number) {
  return ctx.players.some((player) => player.id === id && player.online)
}

/** Todos os online do roster estão nesta lista? (offline não segura a fase) */
function allOnlineIn(ctx: EngineCtx, roster: readonly number[], ids: readonly number[]) {
  const online = onlineRoster(ctx, roster)
  return online.length > 0 && online.every((id) => ids.includes(id))
}

// ---------------------------------------------------------------------------
// Transições
// ---------------------------------------------------------------------------

/** Sorteia uma categoria que ainda não saiu na partida. */
function pickCategory(used: readonly number[], rng: () => number): number {
  const all = CATEGORIES.map((_, id) => id)
  const fresh = all.filter((id) => !used.includes(id))
  return pick(fresh.length ? fresh : all, rng)
}

/** Começa a rodada: categoria, palavra, impostores (ou rodada maluca) e a tela do segredo. */
function startRound(state: State, ctx: EngineCtx, round: number): State {
  const chaosAllowed = state.chaosOn && state.roster.length >= CHAOS_MIN_PLAYERS
  const chaos = chaosRoll(ctx.rng, round, chaosAllowed, state.chaosUsed)
  const categoryId = pickCategory(state.usedCategories, ctx.rng)
  const word = pick(categoryAt(categoryId).words, ctx.rng).text
  const impostors =
    chaos === 'everyone'
      ? [...state.roster]
      : chaos === 'nobody'
        ? []
        : sample(state.roster, Math.min(state.impostorCount, state.roster.length), ctx.rng)
  const secrets: Record<string, RaSecret> = {}
  for (const id of state.roster) {
    secrets[String(id)] = impostors.includes(id) ? { role: 'impostor', word: null } : { role: 'artist', word }
  }
  return {
    ...state,
    phase: 'show',
    round,
    inputKey: keys.show(round),
    deadline: deadlineIn(ctx.now, SHOW_SECONDS),
    categoryId,
    category: categoryLabel(categoryId),
    usedCategories: [...state.usedCategories, categoryId],
    acted: [],
    reveal: null,
    outcome: null,
    private: secrets,
  }
}

function startDraw(state: State, ctx: EngineCtx, stage: 1 | 2): State {
  return {
    ...state,
    phase: stage === 1 ? 'draw1' : 'draw2',
    inputKey: stage === 1 ? keys.draw1(state.round) : keys.draw2(state.round),
    deadline: answerDeadline(ctx.now, stage === 1 ? DRAW1_SECONDS : DRAW2_SECONDS),
    acted: [],
  }
}

/**
 * Fecha uma etapa de desenho. O `inputKey` continua o mesmo na espiadinha e
 * na galeria: um traço que chega atrasado (o celular ainda não viu a fase
 * nova) ainda conta como desta etapa.
 */
function endDraw(state: State, ctx: EngineCtx, done: number[]): State {
  return {
    ...state,
    phase: state.phase === 'draw1' ? 'peek' : 'gallery',
    deadline: deadlineIn(ctx.now, state.phase === 'draw1' ? PEEK_SECONDS : GALLERY_SECONDS),
    acted: done,
  }
}

function startVote(state: State, ctx: EngineCtx): State {
  return {
    ...state,
    phase: 'vote',
    inputKey: keys.vote(state.round),
    deadline: answerDeadline(ctx.now, VOTE_SECONDS),
    acted: [],
  }
}

/** Fecha a votação: conta, aponta o acusado e revela os impostores (e a rodada maluca). */
function revealVotes(state: State, ctx: EngineCtx): State {
  const votes = collectVotes(state, ctx)
  const entries = tally(votes)
  const top = topIds(entries)
  const accused = top.length === 1 ? top[0] : null
  const impostors = impostorsOf(state)
  const chaos = chaosOf(state.roster, impostors)
  const caught = chaos === null && accused !== null && impostors.includes(accused)
  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, REVEAL_SECONDS),
    acted: state.roster.filter((id) => String(id) in votes),
    reveal: { votes, tally: entries, top, accused, impostors, chaos, caught },
    chaosUsed: chaos ? [...state.chaosUsed, chaos] : state.chaosUsed,
  }
}

function startGuess(state: State, ctx: EngineCtx): State {
  return {
    ...state,
    phase: 'guess',
    inputKey: keys.guess(state.round),
    deadline: answerDeadline(ctx.now, GUESS_SECONDS),
    acted: [],
  }
}

/** Fecha a rodada: confere o chute, distribui os pontos e anota na linha do tempo. */
function finishRound(state: State, ctx: EngineCtx, guess: string | null): State {
  const reveal: RaReveal = state.reveal ?? {
    votes: {},
    tally: [],
    top: [],
    accused: null,
    impostors: impostorsOf(state),
    chaos: null,
    caught: false,
  }
  const word = wordOf(state)
  const accused = reveal.accused
  const guessRight =
    reveal.caught && guess !== null && word !== null && fuzzyMatch(guess, answersFor(state.categoryId, word))

  const gains: Record<string, number> = {}
  const give = (id: number, points: number) => {
    gains[String(id)] = (gains[String(id)] ?? 0) + points
  }
  // Da mesa (não-impostores) que votou num impostor de verdade.
  const hits =
    reveal.chaos === null
      ? state.roster.filter((id) => {
          const target = reveal.votes[String(id)]
          return !reveal.impostors.includes(id) && target !== undefined && reveal.impostors.includes(target)
        })
      : []
  let escaped: number[] = []

  if (reveal.chaos === 'nobody') {
    // Inocente injustiçado: o mais votado (todos, no empate) leva a consolação.
    for (const id of reveal.top) give(id, CONSOLATION_POINTS)
  } else if (reveal.chaos === null) {
    escaped = reveal.impostors.filter((id) => !(reveal.caught && id === accused))
    for (const id of escaped) give(id, ESCAPE_POINTS)
    if (reveal.caught) {
      for (const id of hits) give(id, CATCH_POINTS)
      if (guessRight && accused !== null) give(accused, GUESS_POINTS)
    }
  }
  // "Todo mundo era impostor": sem pontos — é para rir.

  return {
    ...state,
    phase: 'result',
    deadline: deadlineIn(ctx.now, RESULT_SECONDS),
    acted: [],
    reveal,
    outcome: { word, guess: reveal.caught ? guess : null, guessRight, gains, hits, escaped },
    scores: addScores(state.scores, gains),
    history: [
      ...state.history,
      {
        round: state.round,
        categoryId: state.categoryId,
        word,
        impostors: reveal.impostors,
        chaos: reveal.chaos,
        accused,
        caught: reveal.caught,
        guessRight,
        hits,
        escaped,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<State> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const blank: State = {
      phase: 'show',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds: readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES),
      chaosOn: readOption<boolean>(ctx.options, 'chaos', true),
      chaosUsed: [],
      impostorCount: impostorCountFor(roster.length),
      categoryId: 0,
      category: '',
      usedCategories: [],
      scores: emptyScores(roster),
      reveal: null,
      outcome: null,
      history: [],
      private: {},
    }
    return startRound(blank, ctx, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'show':
        return timeUp(state, ctx) ? startDraw(state, ctx, 1) : state

      case 'draw1':
      case 'draw2': {
        // Acaba no prazo, no "Pular" do host ou quando todo mundo online apertou "Pronto".
        const done = doneIds(state, ctx)
        if (timeUp(state, ctx) || allOnlineIn(ctx, state.roster, done)) return endDraw(state, ctx, done)
        return withActed(state, done)
      }

      case 'peek':
        return timeUp(state, ctx) ? startDraw(state, ctx, 2) : state

      case 'gallery':
        return timeUp(state, ctx) ? startVote(state, ctx) : state

      case 'vote': {
        const voted = Object.keys(collectVotes(state, ctx)).map(Number)
        const acted = state.roster.filter((id) => voted.includes(id))
        if (timeUp(state, ctx) || allOnlineIn(ctx, state.roster, acted)) return revealVotes(state, ctx)
        return withActed(state, acted)
      }

      case 'reveal': {
        if (!timeUp(state, ctx)) return state
        const accused = state.reveal?.accused ?? null
        // Impostor pego tem a última chance — se ainda estiver por aqui.
        if (state.reveal?.caught && accused !== null && isOnline(ctx, accused)) return startGuess(state, ctx)
        return finishRound(state, ctx, null)
      }

      case 'guess': {
        const guess = guessOf(state, ctx)
        const accused = state.reveal?.accused ?? null
        const gone = accused === null || !isOnline(ctx, accused)
        if (guess !== null || timeUp(state, ctx) || gone) return finishRound(state, ctx, guess)
        return state
      }

      case 'result':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null }
        return { ...state, phase: 'scores', deadline: deadlineIn(ctx.now, SCORES_SECONDS) }

      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx, state.round + 1) : state

      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || !state.roster.includes(playerId)) return null
    switch (state.phase) {
      case 'draw1':
        return { _slot: DRAW_SLOT, s: botStrokes(ctx.rng, 2 + Math.floor(ctx.rng() * 3)), done: true }
      case 'draw2': {
        // Continua o mesmo desenho: o que já foi para o slot fica.
        const before = slotFor(ctx, DRAW_SLOT, playerId, drawKeys(state.round))
        const kept = readDrawing(before?.s)
        return { _slot: DRAW_SLOT, s: [...kept, ...botStrokes(ctx.rng, 1 + Math.floor(ctx.rng() * 2))], n1: kept.length, done: true }
      }
      case 'vote': {
        const others = state.roster.filter((id) => id !== playerId)
        if (!others.length) return null
        // Os bots desconfiam certo um pouco mais que no chute puro.
        const suspects = impostorsOf(state).filter((id) => id !== playerId)
        if (suspects.length && ctx.rng() < 0.45) return { vote: pick(suspects, ctx.rng) }
        return { vote: pick(others, ctx.rng) }
      }
      case 'guess': {
        if (state.reveal?.accused !== playerId) return null
        const word = wordOf(state)
        return { guess: word && ctx.rng() < 0.4 ? word : pick(['abóbora', 'fantasma', 'sei lá'], ctx.rng) }
      }
      default:
        return null
    }
  },
}

// ---------------------------------------------------------------------------
// Prêmios do fim
// ---------------------------------------------------------------------------

export type RaAwards = {
  ranking: RankEntry[]
  /** Quem fez mais pontos (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** 🎭 Mestre do disfarce: quem mais escapou como impostor. */
  disguise: number[]
  maxEscapes: number
  /** 🦅 Olho de lince: quem mais votou certo no impostor. */
  eagle: number[]
  maxHits: number
}

function countBy(rounds: readonly RaRound[], pickIds: (round: RaRound) => number[]) {
  const counts: Record<string, number> = {}
  for (const round of rounds) {
    for (const id of pickIds(round)) counts[String(id)] = (counts[String(id)] ?? 0) + 1
  }
  return counts
}

function leaders(roster: readonly number[], counts: Record<string, number>) {
  const best = Math.max(0, ...roster.map((id) => counts[String(id)] ?? 0))
  return { ids: best > 0 ? roster.filter((id) => (counts[String(id)] ?? 0) === best) : [], best }
}

/** Os prêmios do fim — calculados do estado público, servem para a TV e o celular. */
export function finalAwards(state: State): RaAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  const escapes = leaders(state.roster, countBy(state.history, (round) => round.escaped))
  const hits = leaders(state.roster, countBy(state.history, (round) => round.hits))
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    disguise: escapes.ids,
    maxEscapes: escapes.best,
    eagle: hits.ids,
    maxHits: hits.best,
  }
}
