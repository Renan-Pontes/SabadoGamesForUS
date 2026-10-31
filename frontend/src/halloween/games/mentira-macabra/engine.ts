import {
  addScores,
  answerDeadline,
  deadlineIn,
  emptyScores,
  inputFor,
  onlineRoster,
  pick,
  ranking,
  readOption,
  shuffle,
  timeUp,
  withActed,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { FACTS, factById, type Fact } from './content'
import { cleanLie, isTruth, lieKey, similarLies } from './text'

/**
 * 🤥 Mentira Macabra — estilo Fibbage.
 *
 * A TV mostra um fato verdadeiro e bizarro com uma lacuna. Cada um inventa
 * uma mentira para completar; depois todo mundo tenta achar a verdade no
 * meio das mentiras. Achou a verdade: +2. Cada pessoa que caiu na sua
 * mentira: +1. A última rodada vale o dobro.
 *
 *   write (45 s) ──► choose (30 s) ──► reveal (proporcional) ──► scores (8 s) ──► write…
 *                                          └── na última rodada ──► final (over)
 *
 * Segredos: quem escreveu cada opção fica em `private` (cada um só vê a
 * própria mentira) até a revelação, quando vira o campo público `reveal`. A
 * verdade nunca vai marcada no estado antes disso: o motor a reconhece pelo
 * conteúdo (`content.ts`), que o celular também usa para recusar na hora a
 * mentira igual à verdade.
 *
 * Como todo motor: `step` é puro e idempotente, devolve o MESMO objeto
 * quando nada muda, trata `skip` como prazo vencido (`timeUp`) e nunca
 * espera por quem está offline.
 */

export const WRITE_SECONDS = 45
export const CHOOSE_SECONDS = 30
export const SCORES_SECONDS = 8
export const ROUND_CHOICES = [4, 6, 8] as const
export const DEFAULT_ROUNDS = 6
/** Mentiras mínimas na tela: com pouca gente (ou gente calada), a casa completa. */
export const MIN_LIES = 4
export const TRUTH_POINTS = 2
export const FOOL_POINTS = 1

/** Revelação: abertura, uma mentira por vez e a verdade por último. */
export const REVEAL_INTRO_MS = 2000
export const REVEAL_STEP_MS = 3600
/** Com muitas mentiras para mostrar, cada uma fica menos tempo na tela. */
export const REVEAL_FAST_STEP_MS = 2800
export const REVEAL_FAST_FROM = 7
export const REVEAL_TRUTH_MS = 7500

export type MmPhase = 'write' | 'choose' | 'reveal' | 'scores' | 'final'

/** Uma opção da escolha: só o texto (sem autor, sem dizer se é verdade). */
export type MmOption = { id: number; text: string }

/** O segredo de cada um durante a escolha: a própria mentira e qual opção ela virou. */
export type MmSecret = { lie: string; own: number }

export type MmItemKind = 'lie' | 'house' | 'truth'

/** Uma opção já desmascarada. */
export type MmRevealItem = {
  id: number
  text: string
  /** 'lie' = de alguém da mesa; 'house' = mentira da casa; 'truth' = a verdade. */
  kind: MmItemKind
  /** Quem escreveu (mentiras iguais têm vários autores). */
  authors: number[]
  /** Quem escolheu esta opção. */
  pickers: number[]
  /** Pontos que CADA autor ganhou com ela (já dividido entre os autores). */
  gain: number
}

export type MmReveal = {
  /** Na ordem da TV: mentiras que enganaram alguém (da que menos enganou à que mais) e a verdade por último. */
  steps: MmRevealItem[]
  /** Mentiras em que ninguém caiu (aparecem juntas, com a verdade). */
  missed: MmRevealItem[]
  /** Início da revelação (ms do servidor) e tempo de cada mentira: TV e celulares andam juntos. */
  at: number
  stepMs: number
  /** Pontos de cada um nesta rodada. */
  gains: Record<string, number>
  /** Rodada valendo o dobro. */
  double: boolean
}

export type MmState = BaseState & {
  phase: MmPhase
  round: number
  totalRounds: number
  /** Fatos sorteados para a partida (ids de FACTS), um por rodada. */
  deck: number[]
  /** O fato da rodada, só com o texto da lacuna: a TV desenha daqui. */
  fact: { id: number; text: string }
  /** Opções da escolha (mentiras únicas + verdade, embaralhadas). Vazia na escrita. */
  options: MmOption[]
  acted: number[]
  scores: Record<string, number>
  /** Totais da partida, para os prêmios: quantos cada um enganou… */
  fooled: Record<string, number>
  /** …quantas verdades achou… */
  found: Record<string, number>
  /** …e em quantas mentiras caiu. */
  fell: Record<string, number>
  /** Preenchido na revelação (e no placar seguinte); null antes. */
  reveal: MmReveal | null
  private: Record<string, MmSecret>
}

/** O nome que o `index.ts` importa. */
export type State = MmState

/** A rodada vale o dobro (a última). */
export function isDouble(state: Pick<MmState, 'round' | 'totalRounds'>): boolean {
  return state.round >= state.totalRounds
}

function factFor(id: number): MmState['fact'] {
  const safe = FACTS[id] ? id : 0
  return { id: safe, text: factById(safe).text }
}

/** Abre a escrita da rodada `round`. */
function startRound(state: MmState, now: number, round: number): MmState {
  return {
    ...state,
    phase: 'write',
    round,
    // Uma chave por fase de resposta: a mentira da rodada passada não vale nesta.
    inputKey: `lie-${round}`,
    deadline: answerDeadline(now, WRITE_SECONDS),
    fact: factFor(state.deck[round - 1] ?? 0),
    options: [],
    acted: [],
    reveal: null,
    private: {},
  }
}

/** Ids do roster que estão em `done` (na ordem do roster). */
function idsIn(roster: readonly number[], done: Record<string, unknown>): number[] {
  return roster.filter((id) => String(id) in done)
}

/** Todo mundo online já fez a sua parte? Offline não segura; sem ninguém online, decide o prazo. */
function everyoneOnlineDone(ctx: EngineCtx, roster: readonly number[], done: Record<string, unknown>): boolean {
  const online = onlineRoster(ctx, roster)
  return online.length > 0 && online.every((id) => String(id) in done)
}

/**
 * As mentiras válidas da rodada: texto limpo, com pelo menos uma letra ou
 * número, e que não seja a verdade (nem parecida com ela).
 */
export function collectLies(state: MmState, ctx: EngineCtx): Record<string, string> {
  const fact = factById(state.fact.id)
  const lies: Record<string, string> = {}
  for (const id of state.roster) {
    const text = cleanLie(inputFor(ctx, state.inputKey, id)?.lie)
    if (text && lieKey(text) && !isTruth(text, fact)) lies[String(id)] = text
  }
  return lies
}

/** As escolhas válidas: uma opção que existe e que não é a própria mentira. */
export function collectPicks(state: MmState, ctx: EngineCtx): Record<string, number> {
  const picks: Record<string, number> = {}
  for (const id of state.roster) {
    const choice = inputFor(ctx, state.inputKey, id)?.pick
    if (typeof choice !== 'number') continue
    if (!state.options.some((option) => option.id === choice)) continue
    if (state.private?.[String(id)]?.own === choice) continue
    picks[String(id)] = choice
  }
  return picks
}

/** Qual opção é a verdade (o motor reconhece pelo conteúdo; nunca fica marcada no estado). */
export function truthOptionId(options: readonly MmOption[], fact: Fact): number | null {
  const exact = options.find((option) => option.text === fact.answer)
  if (exact) return exact.id
  return options.find((option) => isTruth(option.text, fact))?.id ?? null
}

/**
 * Fecha a escrita: junta as mentiras iguais numa opção só, completa com as
 * mentiras da casa quando falta, põe a verdade e embaralha tudo. Quem
 * escreveu o quê vai para o `private` de cada autor.
 */
function openChoice(state: MmState, ctx: EngineCtx, lies: Record<string, string>): MmState {
  const fact = factById(state.fact.id)
  const groups: { key: string; text: string; authors: number[] }[] = []
  for (const id of state.roster) {
    const text = lies[String(id)]
    if (!text) continue
    const key = lieKey(text)
    const group = groups.find((entry) => entry.key === key)
    if (group) group.authors.push(id)
    else groups.push({ key, text, authors: [id] })
  }
  // Mentira da casa igual (ou quase) à de alguém da mesa fica de fora: nada de opção repetida.
  const spare = fact.house.filter((text) => !groups.some((group) => similarLies(text, group.text)))
  const house = shuffle(spare, ctx.rng).slice(0, Math.max(0, MIN_LIES - groups.length))
  const entries = shuffle(
    [
      ...groups.map((group) => ({ text: group.text, authors: group.authors })),
      ...house.map((text) => ({ text, authors: [] as number[] })),
      { text: fact.answer, authors: [] as number[] },
    ],
    ctx.rng,
  )
  const secrets: Record<string, MmSecret> = {}
  entries.forEach((entry, index) => {
    for (const author of entry.authors) secrets[String(author)] = { lie: lies[String(author)], own: index }
  })
  return {
    ...state,
    phase: 'choose',
    inputKey: `pick-${state.round}`,
    deadline: answerDeadline(ctx.now, CHOOSE_SECONDS),
    options: entries.map((entry, index) => ({ id: index, text: entry.text })),
    acted: [],
    private: secrets,
  }
}

/**
 * Quando começa o capítulo da verdade na TV (depois de todas as mentiras): o
 * rufar. A verdade em si só aparece na pancada — ver `truthShownAt` (view.ts).
 */
export function truthAt(reveal: Pick<MmReveal, 'at' | 'steps' | 'stepMs'>): number {
  return reveal.at + REVEAL_INTRO_MS + Math.max(0, reveal.steps.length - 1) * reveal.stepMs
}

/** Fim da revelação: o prazo da fase, proporcional ao número de mentiras mostradas. */
export function revealEnd(reveal: Pick<MmReveal, 'at' | 'steps' | 'stepMs'>): number {
  return truthAt(reveal) + REVEAL_TRUTH_MS
}

export type RevealMoment = {
  /** -1 = abertura; senão, o passo de `steps` na tela (o último é a verdade). */
  index: number
  item: MmRevealItem | null
  /** Há quanto tempo (ms) este passo está na tela. */
  since: number
}

/** O que a TV mostra agora na revelação (os celulares usam o mesmo relógio). */
export function revealMoment(reveal: MmReveal, now: number): RevealMoment {
  const elapsed = now - reveal.at - REVEAL_INTRO_MS
  if (elapsed < 0 || !reveal.steps.length) return { index: -1, item: null, since: Math.max(0, now - reveal.at) }
  const index = Math.min(reveal.steps.length - 1, Math.floor(elapsed / reveal.stepMs))
  return { index, item: reveal.steps[index], since: elapsed - index * reveal.stepMs }
}

/** Fecha a escolha: desmascara cada opção, paga quem achou a verdade e quem enganou. */
function revealRound(state: MmState, ctx: EngineCtx, picks: Record<string, number>): MmState {
  const fact = factById(state.fact.id)
  const mult = isDouble(state) ? 2 : 1
  const truthId = truthOptionId(state.options, fact)
  const items: MmRevealItem[] = state.options.map((option) => {
    const authors = state.roster.filter((id) => state.private?.[String(id)]?.own === option.id)
    const pickers = state.roster.filter((id) => picks[String(id)] === option.id)
    const kind: MmItemKind = option.id === truthId ? 'truth' : authors.length ? 'lie' : 'house'
    // Mentiras iguais dividem o crédito (arredondando para cima: enganou, pontuou).
    const gain = kind === 'lie' && pickers.length ? Math.ceil((pickers.length * FOOL_POINTS * mult) / authors.length) : 0
    return { id: option.id, text: option.text, kind, authors, pickers, gain }
  })
  // A verdade sempre fecha a revelação (se sumiu do estado, a TV mostra mesmo assim).
  const truth = items.find((item) => item.kind === 'truth') ?? {
    id: -1,
    text: fact.answer,
    kind: 'truth' as const,
    authors: [],
    pickers: [],
    gain: 0,
  }
  const lies = items.filter((item) => item.kind !== 'truth')
  const fooling = lies
    .filter((item) => item.pickers.length > 0)
    .sort((a, b) => a.pickers.length - b.pickers.length || a.id - b.id)

  const gains: Record<string, number> = {}
  const fooled: Record<string, number> = {}
  const fell: Record<string, number> = {}
  const add = (bucket: Record<string, number>, id: number, amount: number) => {
    if (amount) bucket[String(id)] = (bucket[String(id)] ?? 0) + amount
  }
  for (const id of truth.pickers) add(gains, id, TRUTH_POINTS * mult)
  for (const item of lies) {
    for (const author of item.authors) {
      add(gains, author, item.gain)
      add(fooled, author, item.pickers.length)
    }
    for (const picker of item.pickers) add(fell, picker, 1)
  }

  const reveal: MmReveal = {
    steps: [...fooling, truth],
    missed: lies.filter((item) => item.pickers.length === 0),
    at: ctx.now,
    stepMs: fooling.length >= REVEAL_FAST_FROM ? REVEAL_FAST_STEP_MS : REVEAL_STEP_MS,
    gains,
    double: mult > 1,
  }
  return {
    ...state,
    phase: 'reveal',
    deadline: revealEnd(reveal),
    acted: idsIn(state.roster, picks),
    reveal,
    scores: addScores(state.scores, gains),
    fooled: addScores(state.fooled, fooled),
    found: addScores(state.found, Object.fromEntries(truth.pickers.map((id) => [id, 1]))),
    fell: addScores(state.fell, fell),
  }
}

/** Mentiras dos bots (repetem entre si de propósito: testa as mentiras iguais). */
const BOT_LIES = [
  'Zé do Caixão',
  'um gato preto',
  'abacaxi',
  'a sogra',
  'pudim de sangue',
  'Wandinha',
  'o vizinho',
  'chulé de bruxa',
  'dentadura',
  'Saci',
  'meia furada',
  'mil morcegos',
]

export const engine: HalloweenEngine<MmState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const deck = shuffle(
      FACTS.map((_, id) => id),
      ctx.rng,
    ).slice(0, totalRounds)
    const blank: MmState = {
      phase: 'write',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds,
      deck,
      fact: factFor(deck[0] ?? 0),
      options: [],
      scores: emptyScores(roster),
      fooled: emptyScores(roster),
      found: emptyScores(roster),
      fell: emptyScores(roster),
      reveal: null,
      private: {},
    }
    return startRound(blank, ctx.now, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'write': {
        const lies = collectLies(state, ctx)
        // Acaba no prazo, no "Pular" do host, ou quando todo mundo online mentiu.
        if (timeUp(state, ctx) || everyoneOnlineDone(ctx, state.roster, lies)) return openChoice(state, ctx, lies)
        // Só atualiza os ✓ da TV — e só se mudou.
        return withActed(state, idsIn(state.roster, lies))
      }
      case 'choose': {
        const picks = collectPicks(state, ctx)
        if (timeUp(state, ctx) || everyoneOnlineDone(ctx, state.roster, picks)) return revealRound(state, ctx, picks)
        return withActed(state, idsIn(state.roster, picks))
      }
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null }
        return { ...state, phase: 'scores', deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx.now, state.round + 1) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (!state.roster.includes(playerId)) return null
    if (state.phase === 'write') {
      const fact = factById(state.fact.id)
      const roll = ctx.rng()
      // De vez em quando o bot "mente" a verdade (o motor ignora) ou repete a mentira da casa.
      if (roll < 0.08) return { lie: fact.answer }
      if (roll < 0.2) return { lie: fact.house[0] }
      return { lie: pick(BOT_LIES, ctx.rng) }
    }
    if (state.phase === 'choose') {
      const own = state.private?.[String(playerId)]?.own
      const allowed = state.options.filter((option) => option.id !== own)
      if (!allowed.length) return null
      const truth = truthOptionId(state.options, factById(state.fact.id))
      if (truth !== null && truth !== own && ctx.rng() < 0.35) return { pick: truth }
      return { pick: pick(allowed, ctx.rng).id }
    }
    return null
  },
}

export type MmAwards = {
  /** Classificação final por pontos. */
  ranking: RankEntry[]
  /** "Mestre da mentira": quem enganou mais gente (vazio se ninguém enganou). */
  liars: number[]
  maxFooled: number
  /** "Farejador da verdade": quem achou mais verdades. */
  sniffers: number[]
  maxFound: number
  /** "Caiu em tudo": quem mais caiu em mentira. */
  suckers: number[]
  maxFell: number
}

function leaders(state: MmState, totals: Record<string, number> | undefined) {
  const max = Math.max(0, ...state.roster.map((id) => totals?.[String(id)] ?? 0))
  return { ids: max > 0 ? state.roster.filter((id) => (totals?.[String(id)] ?? 0) === max) : [], max }
}

/** Os prêmios do fim — calculados do estado, servem para a TV e o celular. */
export function finalAwards(state: MmState): MmAwards {
  const liars = leaders(state, state.fooled)
  const sniffers = leaders(state, state.found)
  const suckers = leaders(state, state.fell)
  return {
    ranking: ranking(state.scores, state.roster),
    liars: liars.ids,
    maxFooled: liars.max,
    sniffers: sniffers.ids,
    maxFound: sniffers.max,
    suckers: suckers.ids,
    maxFell: suckers.max,
  }
}
