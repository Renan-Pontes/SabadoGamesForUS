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
  seededRng,
  shuffle,
  timeUp,
  withActed,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { BOT_ENDS, BOT_STARTS, PROMPTS } from './content'

/**
 * 💬 Resposta do Além — estilo Quiplash, simplificado: todo mundo completa a
 * MESMA frase e depois vota na resposta mais engraçada, sem saber de quem é.
 *
 *   write (60 s) ──► vote (40 s) ──► reveal ──► scores (7 s) ──► write da próxima
 *      │                               └── na última rodada ──► final (over)
 *      └── ninguém respondeu, ou só uma resposta ──► reveal direto (sem votação)
 *
 * Pontos: +1 por voto recebido; a mais votada ganha +2 (empate: +1 para cada
 * empatada — o bônus dividido, sem ponto quebrado). Respostas iguais viram
 * uma carta só, com os autores juntos ("pensaram igual!").
 *
 * Quem escreveu o quê é segredo até a revelação: fica no `private` (cada
 * autor só sabe qual carta é a dele, para o celular não deixar votar nela) e
 * só vira público na revelação. Como todo motor: `step` é puro e idempotente,
 * devolve o MESMO objeto quando nada muda, trata `skip` como prazo vencido e
 * nunca espera por quem está offline.
 */

export const WRITE_SECONDS = 60
export const VOTE_SECONDS = 40
export const SCORES_SECONDS = 7
export const ROUND_CHOICES = [3, 5, 7] as const
export const DEFAULT_ROUNDS = 5
/** Tamanho máximo da resposta (em letras/emojis, não em bytes). */
export const MAX_ANSWER_CHARS = 60
export const VOTE_POINTS = 1
/** Bônus da mais votada da rodada. */
export const TOP_BONUS = 2
/** Bônus de cada uma quando a mais votada empata. */
export const TIE_BONUS = 1

export type RdaPhase = 'write' | 'vote' | 'reveal' | 'scores' | 'final'

/** Uma resposta na votação, anônima. `id` é a posição (a letra: A, B, C…). */
export type RdaCard = { id: number; text: string }

/** O segredo de cada autor durante a votação: qual carta é a dele. */
export type RdaSecret = { card: number }

/** Uma resposta já revelada. */
export type RdaResult = {
  card: number
  text: string
  /** Quem escreveu (mais de um quando escreveram igual). */
  authors: number[]
  /** Quem votou nela. */
  voters: number[]
  /** Pontos de CADA autor com esta resposta (votos + bônus). */
  points: number
  /** Ganhou o bônus de mais votada (ou venceu por W.O.). */
  top: boolean
}

/**
 * Como a rodada terminou: `vote` (votação normal), `solo` (só uma resposta:
 * vitória por W.O., sem votação) ou `empty` (ninguém respondeu: o além
 * responde por vocês, sem pontos).
 */
export type RdaRevealKind = 'vote' | 'solo' | 'empty'

export type RdaReveal = {
  kind: RdaRevealKind
  /** Da mais votada para a menos (empate: pela letra). */
  results: RdaResult[]
  /** Quem votou em qual carta. */
  votes: Record<string, number>
  /** Pontos ganhos nesta rodada (só quem ganhou algo). */
  gained: Record<string, number>
  /** A resposta do além (só quando ninguém respondeu). */
  alem: string | null
}

/** A mais votada de uma rodada — para a "resposta da noite" no fim. */
export type RdaBest = { round: number; text: string; authors: number[]; votes: number }

export type RdaState = BaseState & {
  phase: RdaPhase
  round: number
  totalRounds: number
  /** Frases sorteadas para a partida (ids de PROMPTS), uma por rodada. */
  deck: number[]
  /**
   * Sorte fixa da partida: embaralha as cartas de cada rodada sempre do mesmo
   * jeito. Se o juiz refizer a passagem para a votação (gravação que chegou
   * mas a resposta se perdeu no Wi-Fi), as letras não mudam — e voto na "C"
   * continua sendo na mesma resposta.
   */
  seed: number
  /** A frase da rodada, já com o texto: as telas só desenham o que está aqui. */
  prompt: { id: number; text: string }
  scores: Record<string, number>
  acted: number[]
  /** Na votação: as respostas anônimas, embaralhadas. Vazio nas outras fases. */
  cards: RdaCard[]
  /** Preenchido na revelação (e mantido no placar). */
  reveal: RdaReveal | null
  best: RdaBest[]
  /** Na votação: a carta de cada autor. Some na rodada seguinte. */
  private: Record<string, RdaSecret>
}

export type State = RdaState

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

/** Caracteres que não aparecem na tela (espaço de largura zero, controle de direção...). */
function isInvisible(code: number): boolean {
  return (
    code === 0x200b ||
    code === 0x200c ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) ||
    code === 0xfeff
  )
}

/**
 * A resposta como vai para a tela: sem quebra de linha, sem caractere
 * invisível, sem espaço sobrando e com no máximo 60 letras (emoji conta 1).
 * Vazia (ou só espaços) vira '' — e '' não é resposta.
 */
export function cleanAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  // Corta antes de varrer: resposta gigante (celular adulterado) não pesa no juiz.
  for (const char of raw.slice(0, MAX_ANSWER_CHARS * 4)) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127) out += ' '
    else if (!isInvisible(code)) out += char
  }
  const flat = out.replace(/\s+/g, ' ').trim()
  if (!flat.replace(/‍/g, '').trim()) return ''
  const chars = Array.from(flat)
  return chars.length > MAX_ANSWER_CHARS ? chars.slice(0, MAX_ANSWER_CHARS).join('').trim() : flat
}

/** Quantas letras a resposta tem, do jeito que o motor conta (emoji conta 1). */
export function answerLength(text: string): number {
  return Array.from(text).length
}

/**
 * Chave para juntar respostas iguais: sem acento, sem maiúscula e sem
 * pontuação ("Pudim!" = "pudim"). Resposta só de emoji compara o próprio emoji.
 */
export function answerKey(text: string): string {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = plain.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return words || plain.replace(/\s+/g, ' ').trim()
}

/** As respostas válidas da rodada, na ordem do roster. */
export function collectAnswers(state: RdaState, ctx: EngineCtx): { id: number; text: string }[] {
  const answers: { id: number; text: string }[] = []
  for (const id of state.roster) {
    const text = cleanAnswer(inputFor(ctx, state.inputKey, id)?.text)
    if (text) answers.push({ id, text })
  }
  return answers
}

/**
 * O voto válido de cada um: carta que existe e que não é a própria. Quem
 * não escreveu também vota.
 */
export function collectVotes(state: RdaState, ctx: EngineCtx): Record<string, number> {
  const valid = new Set(state.cards.map((card) => card.id))
  const votes: Record<string, number> = {}
  for (const voter of state.roster) {
    const card = inputFor(ctx, state.inputKey, voter)?.card
    if (typeof card !== 'number' || !valid.has(card)) continue
    if (state.private?.[String(voter)]?.card === card) continue // na própria, não vale
    votes[String(voter)] = card
  }
  return votes
}

/** Todo mundo online do roster já fez a sua parte? (Offline não segura a fase.) */
function everyoneOnlineDone(ctx: EngineCtx, roster: readonly number[], done: readonly number[]): boolean {
  const online = onlineRoster(ctx, roster)
  return online.length > 0 && online.every((id) => done.includes(id))
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

/** Revelação: mais respostas, mais tempo para ler (9 a 15 s). */
export function revealSeconds(reveal: Pick<RdaReveal, 'kind' | 'results'>): number {
  if (reveal.kind === 'empty') return 10
  if (reveal.kind === 'solo') return 9
  return Math.min(15, 8 + Math.ceil(reveal.results.length / 2))
}

function promptFor(id: number): RdaState['prompt'] {
  const prompt = PROMPTS[id] ?? PROMPTS[0]
  return { id, text: prompt.text }
}

/** Abre a escrita da rodada `round`. */
function startRound(state: RdaState, now: number, round: number): RdaState {
  return {
    ...state,
    phase: 'write',
    round,
    // Uma chave por rodada e por fase: resposta da rodada passada não conta.
    inputKey: `write-${round}`,
    deadline: answerDeadline(now, WRITE_SECONDS),
    prompt: promptFor(state.deck[round - 1] ?? 0),
    acted: [],
    cards: [],
    reveal: null,
    private: {},
  }
}

/** Mostra o resultado da rodada e soma os pontos. */
function openReveal(state: RdaState, ctx: EngineCtx, reveal: RdaReveal, acted: number[]): RdaState {
  const top = reveal.results[0]
  const best =
    top && top.top && top.voters.length > 0
      ? [...(state.best ?? []), { round: state.round, text: top.text, authors: top.authors, votes: top.voters.length }]
      : (state.best ?? [])
  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, revealSeconds(reveal)),
    acted,
    cards: [],
    reveal,
    scores: addScores(state.scores, reveal.gained),
    best,
  }
}

/** Fecha a escrita: junta respostas iguais, embaralha e abre a votação (ou pula). */
function closeWriting(state: RdaState, ctx: EngineCtx): RdaState {
  const answers = collectAnswers(state, ctx)
  const writers = answers.map((answer) => answer.id)
  const groups: { text: string; authors: number[] }[] = []
  const byKey = new Map<string, { text: string; authors: number[] }>()
  for (const answer of answers) {
    const key = answerKey(answer.text)
    const group = byKey.get(key)
    if (group) {
      group.authors.push(answer.id)
    } else {
      const created = { text: answer.text, authors: [answer.id] }
      byKey.set(key, created)
      groups.push(created)
    }
  }

  if (groups.length === 0) {
    // Ninguém respondeu: o além responde por vocês (sem pontos).
    const alem = (PROMPTS[state.prompt.id] ?? PROMPTS[0]).alem
    return openReveal(state, ctx, { kind: 'empty', results: [], votes: {}, gained: {}, alem }, writers)
  }

  if (groups.length === 1) {
    // Uma resposta só: não tem o que votar. Vitória por W.O., com o bônus.
    const only = groups[0]
    const result: RdaResult = { card: 0, text: only.text, authors: only.authors, voters: [], points: TOP_BONUS, top: true }
    const gained = Object.fromEntries(only.authors.map((id) => [String(id), TOP_BONUS]))
    return openReveal(state, ctx, { kind: 'solo', results: [result], votes: {}, gained, alem: null }, writers)
  }

  // Embaralha com a sorte da partida + a rodada (não com o ctx.rng): refazer
  // esta passagem com as mesmas respostas dá exatamente as mesmas cartas.
  const order = shuffle(groups, seededRng(state.seed * 31 + state.round))
  const secrets: Record<string, RdaSecret> = {}
  order.forEach((group, card) => {
    for (const author of group.authors) secrets[String(author)] = { card }
  })
  return {
    ...state,
    phase: 'vote',
    inputKey: `vote-${state.round}`,
    deadline: answerDeadline(ctx.now, VOTE_SECONDS),
    acted: [],
    cards: order.map((group, card) => ({ id: card, text: group.text })),
    private: secrets,
  }
}

/** Fecha a votação: conta, paga os autores e dá o bônus da mais votada. */
function closeVoting(state: RdaState, ctx: EngineCtx): RdaState {
  const votes = collectVotes(state, ctx)
  const authorsOf = new Map<number, number[]>()
  for (const id of state.roster) {
    const secret = state.private?.[String(id)]
    if (!secret) continue
    authorsOf.set(secret.card, [...(authorsOf.get(secret.card) ?? []), id])
  }
  const votersOf = new Map<number, number[]>()
  for (const voter of state.roster) {
    const card = votes[String(voter)]
    if (card !== undefined) votersOf.set(card, [...(votersOf.get(card) ?? []), voter])
  }

  const most = Math.max(0, ...state.cards.map((card) => votersOf.get(card.id)?.length ?? 0))
  const tops = most > 0 ? state.cards.filter((card) => (votersOf.get(card.id)?.length ?? 0) === most) : []
  const bonus = tops.length === 1 ? TOP_BONUS : TIE_BONUS

  const results: RdaResult[] = state.cards
    .map((card) => {
      const voters = votersOf.get(card.id) ?? []
      const top = tops.includes(card)
      return {
        card: card.id,
        text: card.text,
        authors: authorsOf.get(card.id) ?? [],
        voters,
        points: voters.length * VOTE_POINTS + (top ? bonus : 0),
        top,
      }
    })
    .sort((a, b) => b.voters.length - a.voters.length || a.card - b.card)

  const gained: Record<string, number> = {}
  for (const result of results) {
    if (!result.points) continue
    for (const author of result.authors) gained[String(author)] = (gained[String(author)] ?? 0) + result.points
  }
  const voted = state.roster.filter((id) => String(id) in votes)
  return openReveal(state, ctx, { kind: 'vote', results, votes, gained, alem: null }, voted)
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<RdaState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const totalRounds = readOption<number>(ctx.options, 'rounds', DEFAULT_ROUNDS, ROUND_CHOICES)
    const deck = shuffle(
      PROMPTS.map((_, id) => id),
      ctx.rng,
    ).slice(0, totalRounds)
    const blank: RdaState = {
      phase: 'write',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds,
      deck,
      seed: Math.floor(ctx.rng() * 2 ** 31),
      prompt: promptFor(deck[0] ?? 0),
      scores: emptyScores(roster),
      cards: [],
      reveal: null,
      best: [],
      private: {},
    }
    return startRound(blank, ctx.now, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'write': {
        // Acaba no prazo, no "Pular" do host, ou quando todo mundo online respondeu.
        const writers = collectAnswers(state, ctx).map((answer) => answer.id)
        if (timeUp(state, ctx) || everyoneOnlineDone(ctx, state.roster, writers)) return closeWriting(state, ctx)
        // Só atualiza os ✓ da TV — e só se alguém novo respondeu.
        return withActed(state, writers)
      }
      case 'vote': {
        const votes = collectVotes(state, ctx)
        const voters = state.roster.filter((id) => String(id) in votes)
        if (timeUp(state, ctx) || everyoneOnlineDone(ctx, state.roster, voters)) return closeVoting(state, ctx)
        return withActed(state, voters)
      }
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        if (state.round >= state.totalRounds) return { ...state, phase: 'final', over: true, deadline: null }
        return { ...state, phase: 'scores', deadline: deadlineIn(ctx.now, SCORES_SECONDS) }
      case 'scores':
        return timeUp(state, ctx) ? startRound(state, ctx.now, state.round + 1) : state
      default:
        // Fase desconhecida (estado de outra versão): não trava — o prazo ou o "Pular" encerra.
        return timeUp(state, ctx) ? { ...state, phase: 'final', over: true, deadline: null } : state
    }
  },

  bot(state, playerId, ctx) {
    if (!state.roster.includes(playerId)) return null
    if (state.phase === 'write') {
      return { text: `${pick(BOT_STARTS, ctx.rng)} ${pick(BOT_ENDS, ctx.rng)}` }
    }
    if (state.phase === 'vote') {
      const own = state.private?.[String(playerId)]?.card
      const options = state.cards.filter((card) => card.id !== own)
      if (!options.length) return null
      // A mesa costuma ter uma favorita: parte dos bots vai nela, o resto espalha.
      return { card: ctx.rng() < 0.4 ? options[0].id : pick(options, ctx.rng).id }
    }
    return null
  },
}

// ---------------------------------------------------------------------------
// Fim da partida
// ---------------------------------------------------------------------------

export type RdaAwards = {
  /** Classificação final por pontos. */
  ranking: RankEntry[]
  /** "Alma mais engraçada": quem mais pontuou (vazio se ninguém pontuou). */
  champions: number[]
  topScore: number
  /** "Resposta da noite": a mais votada da partida (a primeira, no empate). */
  bestAnswer: RdaBest | null
}

/** Os prêmios do fim — calculados do estado, servem para a TV e o celular. */
export function finalAwards(state: RdaState): RdaAwards {
  const order = ranking(state.scores, state.roster)
  const topScore = order[0]?.score ?? 0
  let bestAnswer: RdaBest | null = null
  for (const entry of state.best ?? []) {
    if (!bestAnswer || entry.votes > bestAnswer.votes) bestAnswer = entry
  }
  return {
    ranking: order,
    champions: topScore > 0 ? order.filter((entry) => entry.score === topScore).map((entry) => entry.id) : [],
    topScore,
    bestAnswer,
  }
}
