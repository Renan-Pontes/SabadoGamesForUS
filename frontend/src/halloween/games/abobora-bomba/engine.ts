import {
  addScores,
  deadlineIn,
  emptyScores,
  inputFor,
  normalizeText,
  onlineRoster,
  readOption,
  shuffle,
  timeUp,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HPlayer, HalloweenEngine } from '../../engine/types'
import { THEMES } from './content'

/**
 * 🎃 Abóbora-Bomba — batata quente com pavio individual.
 *
 * O conserto do Bomba-Relógio (o povo passava sem falar): cada um tem o
 * PRÓPRIO pavio, que só queima enquanto a abóbora está na sua mão. Passou,
 * o seu pausa e o do próximo volta a queimar. Enrolar só queima o seu tempo.
 *
 *   theme (5 s) ──► play (a abóbora pula de mão em mão) ──► boom (8 s) ──► theme da próxima
 *                     │                                        └── sobrou 1 vivo ou 12 rodadas ──► final (over)
 *                     └── "⏭ Pular" do host: apaga o pavio — rodada acaba e NINGUÉM perde vida
 *
 * Tudo pelo relógio do servidor, nunca contando passos:
 * - a abóbora chega em `arrivedAt` (quando o juiz viu o passe); o pavio de
 *   quem recebe só começa a queimar 1,5 s depois (`holdStartOf`), o tempo de
 *   a notícia chegar ao celular dele;
 * - `fuseEnd = holdStart + pavio ÷ ritmo` é a hora oficial do BUM, e o
 *   `deadline` espera mais 2,5 s (`LATE_MS`) por um passe que ainda esteja
 *   na rede — passe tocado antes do fim do pavio salva, mesmo chegando depois;
 * - a abóbora vai para o próximo vivo da mesa, online ou não (`nextInLine`):
 *   celular bloqueado não é escudo. Só quem começa a rodada precisa estar
 *   online (`nextAlive`);
 * - cada posse tem a sua chave (`pass-<rodada>-<n>`): cada passe é uma
 *   resposta nova. O passe vale pelo horário do toque (`at`), limitado a
 *   [chegada + 1 s, agora], e desconta só o que queimou;
 * - passe que chega com menos de 1 s de posse ainda não vale (o juiz
 *   reavalia nos passos seguintes, já com o `at` limitado à chegada + 1 s);
 * - a abóbora esquenta: a cada 30 s de rodada o pavio de quem pega queima
 *   mais rápido (1×, 1,5×, 2×, 2,5×, 3×), para nenhuma rodada se arrastar
 *   com 15 pessoas falando rápido.
 *
 * Fim: sobrou um vivo, ou 12 rodadas — vence quem tem mais vidas e, no
 * empate, quem poupou mais pavio somando todas as rodadas.
 */

export const FIRST_THEME_SECONDS = 8
export const THEME_SECONDS = 5
export const BOOM_SECONDS = 8
export const MAX_ROUNDS = 12
/** O pavio de quem recebe só começa a queimar 1,5 s depois de a abóbora chegar. */
export const ARRIVAL_GRACE_MS = 1500
/** Passe com menos de 1 s de posse ainda não vale. */
export const MIN_HOLD_MS = 1000
/**
 * Depois do fim do pavio, o juiz ainda espera um passe atrasado na rede: a
 * TV só enxerga o passe no próximo poll (~1 s) mais a viagem de ida e volta.
 * Custa um suspense de 2,5 s só no BUM (uma vez por rodada).
 */
export const LATE_MS = 2500
/** No celular: segurar o botão por 1,2 s — o tempo de falar a palavra. */
export const HOLD_TO_PASS_MS = 1200
/** No modo digitar a palavra já custou tempo: basta um toque firme. */
export const HOLD_TO_PASS_TYPED_MS = 500
/** A cada 30 s de rodada a abóbora esquenta. */
export const HEAT_STEP_MS = 30_000
/** Ritmo do pavio em cada nível de calor. */
export const HEAT_RATES = [1, 1.5, 2, 2.5, 3] as const
export const FUSE_CHOICES = [10, 15, 20] as const
export const LIVES_CHOICES = [1, 2, 3] as const
export const DEFAULT_LIVES = 2
export const MODES = ['falar', 'digitar'] as const
export const MAX_WORD_LENGTH = 32

export type AbbPhase = 'theme' | 'play' | 'boom' | 'final'
export type AbbMode = (typeof MODES)[number]

export type AbbTheme = { id: number; text: string; icon: string }

/** O que a TV mostra quando a rodada acaba. */
export type AbbBoom = {
  /** Quem explodiu; null = o host apagou o pavio ("Pular") e ninguém perdeu vida. */
  victim: number | null
  /** Vidas que sobraram para quem explodiu. */
  livesLeft: number
  /** Ficou sem vidas: virou fantasma. */
  eliminated: boolean
  /** Quantas vezes a abóbora trocou de mão na rodada. */
  passes: number
}

/** Palavra do modo digitar (aparece na TV). */
export type AbbWord = { by: number; word: string }

export type AbbState = BaseState & {
  phase: AbbPhase
  round: number
  totalRounds: number
  mode: AbbMode
  /** Pavio cheio desta partida (ms). */
  fuseMs: number
  maxLives: number
  /** Quem já passou a abóbora nesta rodada (✓ na TV). */
  acted: number[]
  lives: Record<string, number>
  /** Pavio que sobra para cada um nesta rodada (ms, no ritmo 1×). */
  fuse: Record<string, number>
  /** Pavio poupado somando as rodadas (o desempate do fim). */
  saved: Record<string, number>
  /** Temas sorteados para a partida (ids de THEMES), um por rodada. */
  deck: number[]
  theme: AbbTheme
  /** Com quem está a abóbora (no `theme`, quem vai começar). */
  holder: number | null
  /** Quem passou por último (para a TV desenhar o pulo). */
  from: number | null
  /** Quando a rodada começou a valer (o calor conta daqui). */
  startedAt: number
  /** Quando a abóbora chegou em quem segura. */
  arrivedAt: number
  /** Hora oficial do BUM de quem segura; null fora do `play`. */
  fuseEnd: number | null
  /** Nível de calor desta posse (0..4) — ver HEAT_RATES. */
  heat: number
  /** Passes nesta rodada. */
  passes: number
  /** Modo digitar: as palavras desta rodada, na ordem. */
  words: AbbWord[]
  /** Preenchido no `boom`; null no resto. */
  boom: AbbBoom | null
  /** Uma linha por rodada jogada. */
  history: { round: number; theme: string; victim: number | null; passes: number }[]
}

/** O nome que o `index.ts` (pronto) importa. */
export type State = AbbState

// ---------------------------------------------------------------------------
// Regras pequenas (servem para o motor, a TV e o celular)
// ---------------------------------------------------------------------------

/** 15 s até 6 pessoas, 12 s até 10, 10 s com mais. */
export function autoFuseSeconds(players: number): number {
  if (players <= 6) return 15
  if (players <= 10) return 12
  return 10
}

/** Pavio da partida em segundos: a escolha do host ou o automático. */
export function fuseSecondsFor(options: Record<string, unknown> | null | undefined, players: number): number {
  const value = options?.fuse
  return typeof value === 'number' && (FUSE_CHOICES as readonly number[]).includes(value)
    ? value
    : autoFuseSeconds(players)
}

/** Duração do anúncio do tema (a primeira rodada dá mais tempo para ler). */
export function themeSecondsFor(round: number): number {
  return round <= 1 ? FIRST_THEME_SECONDS : THEME_SECONDS
}

/** Nível de calor depois de `elapsedMs` de rodada. */
export function heatAt(elapsedMs: number): number {
  return Math.max(0, Math.min(HEAT_RATES.length - 1, Math.floor(elapsedMs / HEAT_STEP_MS)))
}

/** Quantas vezes mais rápido o pavio queima neste nível de calor. */
export function heatRate(heat: number): number {
  const level = Math.max(0, Math.min(HEAT_RATES.length - 1, Math.floor(heat) || 0))
  return HEAT_RATES[level]
}

/** A partir de quando o pavio de quem segura queima. */
export function holdStartOf(state: Pick<AbbState, 'arrivedAt'>): number {
  return state.arrivedAt + ARRIVAL_GRACE_MS
}

export function livesOf(state: Pick<AbbState, 'lives'>, id: number): number {
  // `?.`: um estado que não é deste jogo (partida velha) não derruba a tela.
  return state.lives?.[String(id)] ?? 0
}

export function isAlive(state: Pick<AbbState, 'lives'>, id: number): boolean {
  return livesOf(state, id) > 0
}

/** Quem ainda tem vida, na ordem da mesa. */
export function aliveIds(state: Pick<AbbState, 'lives' | 'roster'>): number[] {
  return state.roster.filter((id) => isAlive(state, id))
}

/**
 * Pavio de alguém em `now` (ms no ritmo 1×): o de quem segura vai queimando
 * (depois da folga da chegada); o dos outros está pausado.
 */
export function fuseLeftAt(state: AbbState, id: number, now: number): number {
  const stored = state.fuse?.[String(id)] ?? 0
  if (state.phase !== 'play' || state.holder !== id) return stored
  const until = state.fuseEnd === null ? now : Math.min(now, state.fuseEnd)
  const burned = Math.max(0, until - holdStartOf(state)) * heatRate(state.heat)
  return Math.max(0, stored - burned)
}

/** Ms de verdade (no calor atual) que o pavio de alguém ainda aguenta. */
export function realMsLeft(state: AbbState, id: number, now: number): number {
  if (state.phase === 'play' && state.holder === id && state.fuseEnd !== null) {
    return Math.max(0, state.fuseEnd - now)
  }
  return fuseLeftAt(state, id, now) / heatRate(state.heat)
}

/**
 * Para quem a abóbora vai num passe: o próximo vivo na ordem da mesa, esteja
 * online ou não. Pular quem está offline faria do celular bloqueado (ou do
 * Instagram) um escudo: a pessoa nunca perderia vida e venceria a partida
 * sem jogar. Assim, a abóbora chega nela, a TV mostra o nome, a mesa grita e
 * ela volta a tempo de passar — ou o pavio queima e vem o BUM. Quem foi
 * embora de vez explode algumas vezes e vira fantasma; o prazo nunca trava.
 */
export function nextInLine(state: Pick<AbbState, 'lives' | 'roster'>, after: number | null): number | null {
  const roster = state.roster
  const start = after === null ? -1 : roster.indexOf(after)
  for (let step = 1; step <= roster.length; step += 1) {
    const id = roster[(start + step + roster.length) % roster.length]
    if (id !== after && isAlive(state, id)) return id
  }
  return null
}

/**
 * Quem começa uma rodada: o próximo vivo na ordem da mesa depois de `after`,
 * de preferência alguém online (não vale abrir a rodada com quem sumiu — a
 * abóbora chega nele depois, nos passes). Sem ninguém online, vai para um
 * vivo offline mesmo: o pavio dele queima e a rodada acaba.
 */
export function nextAlive(
  state: Pick<AbbState, 'lives' | 'roster'>,
  after: number | null,
  players: readonly HPlayer[],
): number | null {
  const roster = state.roster
  if (!roster.length) return null
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const start = after === null ? -1 : roster.indexOf(after)
  const around = roster.map((_, step) => roster[(start + 1 + step + roster.length) % roster.length])
  const candidates = around.filter((id) => id !== after && isAlive(state, id))
  const best = candidates.find((id) => online.has(id)) ?? candidates[0]
  if (best !== undefined) return best
  return after !== null && isAlive(state, after) ? after : null
}

/** A palavra digitada como vai para a TV: uma linha, sem espaço sobrando, até 32 letras. */
export function cleanWord(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH).trim()
  return normalizeText(text) ? text : ''
}

/** Chave para comparar palavras: sem acento, maiúscula, espaço nem plural com "s". */
export function wordKey(word: string): string {
  const key = normalizeText(word).replace(/ /g, '')
  return key.length > 3 && key.endsWith('s') ? key.slice(0, -1) : key
}

/** A palavra já foi dita nesta rodada? */
export function wordUsed(words: readonly AbbWord[], word: string): boolean {
  const key = wordKey(word)
  return key !== '' && words.some((entry) => wordKey(entry.word) === key)
}

/** Uma palavra serve para passar (modo digitar)? */
export function wordAccepted(words: readonly AbbWord[], raw: unknown): boolean {
  const word = cleanWord(raw)
  return word !== '' && !wordUsed(words, word)
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function themeFor(id: number): AbbTheme {
  const theme = THEMES[id] ?? THEMES[0]
  return { id, text: theme.text, icon: theme.icon }
}

/** 12 temas sem repetir, alternando Halloween e dia a dia. */
function buildDeck(rng: () => number): number[] {
  const ids = THEMES.map((_, id) => id)
  const spooky = shuffle(ids.filter((id) => THEMES[id].spooky), rng)
  const plain = shuffle(ids.filter((id) => !THEMES[id].spooky), rng)
  const deck: number[] = []
  for (let i = 0; deck.length < MAX_ROUNDS && (i < spooky.length || i < plain.length); i += 1) {
    if (i < spooky.length) deck.push(spooky[i])
    if (deck.length < MAX_ROUNDS && i < plain.length) deck.push(plain[i])
  }
  return deck
}

function isOnline(ctx: EngineCtx, id: number): boolean {
  return ctx.players.some((player) => player.id === id && player.online)
}

/** Anuncia o tema da rodada `round`: pavios cheios, ninguém queima ainda. */
function startRound(state: AbbState, now: number, round: number, starter: number | null): AbbState {
  return {
    ...state,
    phase: 'theme',
    round,
    inputKey: `theme-${round}`,
    deadline: deadlineIn(now, themeSecondsFor(round)),
    theme: themeFor(state.deck[round - 1] ?? state.deck[0] ?? 0),
    holder: starter,
    from: null,
    fuse: Object.fromEntries(state.roster.map((id) => [String(id), isAlive(state, id) ? state.fuseMs : 0])),
    startedAt: now,
    arrivedAt: now,
    fuseEnd: null,
    heat: 0,
    passes: 0,
    words: [],
    acted: [],
    boom: null,
  }
}

/** A abóbora chega em `holder` agora: nova chave, novo prazo. */
function possession(state: AbbState, holder: number, now: number): AbbState {
  const heat = heatAt(now - state.startedAt)
  const fuseEnd = now + ARRIVAL_GRACE_MS + Math.ceil((state.fuse[String(holder)] ?? 0) / heatRate(heat))
  return {
    ...state,
    holder,
    arrivedAt: now,
    heat,
    fuseEnd,
    deadline: fuseEnd + LATE_MS,
    // Uma chave por posse: cada passe é uma resposta nova.
    inputKey: `pass-${state.round}-${state.passes}`,
  }
}

/** Fim do anúncio: acende o pavio de quem começa. */
function startPlay(state: AbbState, ctx: EngineCtx): AbbState {
  const planned = state.holder
  // Quem ia começar sumiu da festa ou morreu? Começa o próximo vivo.
  const starter =
    planned !== null && isAlive(state, planned) && isOnline(ctx, planned)
      ? planned
      : nextAlive(state, planned, ctx.players)
  const playing: AbbState = { ...state, phase: 'play', startedAt: ctx.now, passes: 0 }
  if (starter === null) return endRound({ ...playing, holder: null }, ctx, false)
  return possession(playing, starter, ctx.now)
}

type Pass = { at: number; word: string | null }

/** O passe de quem segura, se ele vale agora. */
function readPass(state: AbbState, ctx: EngineCtx, holder: number, fuseEnd: number): Pass | null {
  const input = inputFor(ctx, state.inputKey, holder)
  if (!input) return null
  const earliest = state.arrivedAt + MIN_HOLD_MS
  // Chegou com menos de 1 s de posse: ainda não vale.
  if (ctx.now < earliest) return null
  const touched = typeof input.at === 'number' && Number.isFinite(input.at) ? Math.round(input.at) : ctx.now
  // Vale o horário do toque, dentro do intervalo possível.
  const at = Math.min(ctx.now, Math.max(earliest, touched))
  // Tocou depois de o pavio acabar: não salva ninguém.
  if (at >= fuseEnd) return null
  if (state.mode !== 'digitar') return { at, word: null }
  const word = cleanWord(input.word)
  if (!word || wordUsed(state.words, word)) return null
  return { at, word }
}

/** Passa a abóbora: desconta só o que queimou e entrega ao próximo vivo. */
function passPumpkin(state: AbbState, ctx: EngineCtx, holder: number, pass: Pass): AbbState {
  const key = String(holder)
  const burned = Math.max(0, Math.floor((pass.at - holdStartOf(state)) * heatRate(state.heat)))
  const fuse = { ...state.fuse, [key]: Math.max(1, (state.fuse[key] ?? 0) - burned) }
  const acted = state.acted.includes(holder)
    ? state.acted
    : state.roster.filter((id) => id === holder || state.acted.includes(id))
  const words = pass.word === null ? state.words : [...state.words, { by: holder, word: pass.word }]
  const next = nextInLine(state, holder) ?? holder
  return possession({ ...state, fuse, acted, words, from: holder, passes: state.passes + 1 }, next, ctx.now)
}

/**
 * Fim da rodada: BUM em quem segura (`exploded`) ou pavio apagado pelo
 * host. Soma o pavio poupado de quem jogou a rodada.
 */
function endRound(state: AbbState, ctx: EngineCtx, exploded: boolean): AbbState {
  const holder = state.holder
  const victim = exploded ? holder : null
  const fuse = { ...state.fuse }
  if (holder !== null) {
    fuse[String(holder)] = victim !== null ? 0 : Math.max(0, Math.floor(fuseLeftAt(state, holder, ctx.now)))
  }
  const playing = aliveIds(state)
  const lives =
    victim === null ? state.lives : { ...state.lives, [String(victim)]: Math.max(0, livesOf(state, victim) - 1) }
  const livesLeft = victim === null ? 0 : (lives[String(victim)] ?? 0)
  return {
    ...state,
    phase: 'boom',
    inputKey: `boom-${state.round}`,
    deadline: deadlineIn(ctx.now, BOOM_SECONDS),
    fuse,
    lives,
    saved: addScores(state.saved, Object.fromEntries(playing.map((id) => [id, fuse[String(id)] ?? 0]))),
    fuseEnd: null,
    boom: { victim, livesLeft, eliminated: victim !== null && livesLeft === 0, passes: state.passes },
    history: [...state.history, { round: state.round, theme: state.theme.text, victim, passes: state.passes }],
  }
}

/** Depois do BUM: acabou o jogo, ou nova rodada começando pelo próximo vivo. */
function afterBoom(state: AbbState, ctx: EngineCtx): AbbState {
  if (gameDecided(state)) {
    return { ...state, phase: 'final', over: true, deadline: null, inputKey: 'final' }
  }
  const after = state.boom?.victim ?? state.holder
  return startRound(state, ctx.now, state.round + 1, nextAlive(state, after, ctx.players))
}

function stepPlay(state: AbbState, ctx: EngineCtx): AbbState {
  // "⏭ Pular" do host: apaga o pavio, a rodada acaba e ninguém perde vida.
  if (ctx.command?.type === 'skip') return endRound(state, ctx, false)
  const holder = state.holder
  if (holder === null || state.fuseEnd === null) return endRound(state, ctx, false)
  // O passe vem antes do BUM: quem tocou a tempo se salva, mesmo chegando atrasado.
  const pass = readPass(state, ctx, holder, state.fuseEnd)
  if (pass) return passPumpkin(state, ctx, holder, pass)
  return timeUp(state, ctx) ? endRound(state, ctx, true) : state
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

/** Chance de um bot "travar" um passo pensando na palavra (queima pavio). */
const BOT_STALL = 0.5

export const engine: HalloweenEngine<AbbState> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const maxLives = readOption<number>(ctx.options, 'lives', DEFAULT_LIVES, LIVES_CHOICES)
    const mode = readOption<string>(ctx.options, 'mode', 'falar', MODES) as AbbMode
    const deck = buildDeck(ctx.rng)
    const starter = roster.length ? roster[Math.floor(ctx.rng() * roster.length)] : null
    const blank: AbbState = {
      phase: 'theme',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds: MAX_ROUNDS,
      mode,
      fuseMs: fuseSecondsFor(ctx.options, roster.length) * 1000,
      maxLives,
      lives: Object.fromEntries(roster.map((id) => [String(id), maxLives])),
      fuse: {},
      saved: emptyScores(roster),
      deck,
      theme: themeFor(deck[0] ?? 0),
      holder: starter,
      from: null,
      startedAt: ctx.now,
      arrivedAt: ctx.now,
      fuseEnd: null,
      heat: 0,
      passes: 0,
      words: [],
      boom: null,
      history: [],
    }
    return startRound(blank, ctx.now, 1, starter)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'theme':
        // Acaba no prazo ou no "Pular" do host.
        return timeUp(state, ctx) ? startPlay(state, ctx) : state
      case 'play':
        return stepPlay(state, ctx)
      case 'boom':
        return timeUp(state, ctx) ? afterBoom(state, ctx) : state
      default:
        // Estado que não é deste jogo (ex.: partida velha do provisório):
        // encerra em vez de ficar parado para sempre.
        return { ...state, over: true, deadline: null }
    }
  },

  bot(state, playerId, ctx) {
    if (state.phase !== 'play' || state.holder !== playerId || !isAlive(state, playerId)) return null
    // Pensa na palavra: às vezes demora um passo (ou vários) e queima pavio.
    if (ctx.rng() < BOT_STALL) return null
    if (state.mode === 'digitar') return { at: ctx.now, word: `palavra ${state.round}-${state.passes + 1}` }
    return { at: ctx.now }
  },
}

// ---------------------------------------------------------------------------
// Placar e fim (calculados do estado: servem para a TV e o celular)
// ---------------------------------------------------------------------------

/** O jogo acabou? Sobrou um vivo (ou nenhum), ou chegou na última rodada. */
export function gameDecided(state: AbbState): boolean {
  return aliveIds(state).length <= 1 || state.round >= state.totalRounds
}

export type AbbStanding = {
  id: number
  lives: number
  /** Pavio poupado somando as rodadas (ms). */
  saved: number
  /** Quantas vezes explodiu. */
  booms: number
  place: number
}

/** Quantas vezes cada um explodiu. */
export function boomCounts(state: AbbState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of state.history ?? []) {
    if (entry.victim !== null) counts[String(entry.victim)] = (counts[String(entry.victim)] ?? 0) + 1
  }
  return counts
}

/**
 * Classificação: mais vidas primeiro; no empate, mais pavio poupado. Quem
 * empata nas duas divide a posição (1º, 1º, 3º...).
 */
export function standings(state: AbbState): AbbStanding[] {
  const booms = boomCounts(state)
  const rows = state.roster.map((id, index) => ({
    id,
    index,
    lives: livesOf(state, id),
    saved: state.saved?.[String(id)] ?? 0,
  }))
  rows.sort((a, b) => b.lives - a.lives || b.saved - a.saved || a.index - b.index)
  return rows.map((row) => ({
    id: row.id,
    lives: row.lives,
    saved: row.saved,
    booms: booms[String(row.id)] ?? 0,
    place: rows.findIndex((other) => other.lives === row.lives && other.saved === row.saved) + 1,
  }))
}

/** Quem venceu: o último vivo, ou os primeiros da classificação (com vida). */
export function winners(state: AbbState): number[] {
  return standings(state)
    .filter((row) => row.place === 1 && row.lives > 0)
    .map((row) => row.id)
}

/** "Explodiu mais vezes" (vazio se ninguém explodiu). */
export function mostBooms(state: AbbState): { ids: number[]; count: number } {
  const counts = boomCounts(state)
  const count = Math.max(0, ...Object.values(counts))
  if (count <= 0) return { ids: [], count: 0 }
  return { ids: state.roster.filter((id) => (counts[String(id)] ?? 0) === count), count }
}
