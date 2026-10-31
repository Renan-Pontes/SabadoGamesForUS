import {
  actedIds,
  allOnlineActed,
  answerDeadline,
  deadlineIn,
  inputFor,
  onlineRoster,
  pick,
  readOption,
  refreshActed,
  sameIds,
  shuffle,
  tally,
  timeUp,
  topIds,
  topUnique,
  type TallyEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { CITY_NOTES, EPITAPHS, KILLER_NOTES } from './content'

/**
 * 🔪 Cidade Dorme — dedução social em que ninguém fecha o olho.
 *
 * Toda noite TODO MUNDO mexe no celular ao mesmo tempo (a tela é igual para
 * todos, só o título muda): o assassino escolhe quem morre, o detetive
 * investiga, o anjo protege, o cidadão aposta em quem é o assassino e os
 * mortos assombram. De manhã a TV narra o estrago; de dia a cidade conversa
 * e vota em quem sai.
 *
 *   roles (20 s) ─► night (60 s) ─► morning (10–26 s) ─► day (2–4 min) ─► vote (45 s) ─► verdict (10 s)
 *                     ▲                  └─ assassinos empataram em número ─► end            │
 *                     └───────────────────── próxima noite ◄── ninguém venceu ◄──────────────┘
 *                                                               └─ alguém venceu (ou 10ª noite) ─► end
 *
 * Os papéis, os recados e as descobertas moram no `private` de cada um — o
 * público só ganha o que a cidade inteira pode saber (quem morreu, os votos,
 * o bilhete do assassino). No fim, tudo é revelado em `final`.
 *
 * Como todo motor: `step` é puro e idempotente, devolve o MESMO objeto quando
 * nada muda, trata `skip` como prazo vencido (`timeUp`) e nunca espera por
 * quem está offline.
 */

/** Ver o papel: acaba antes quando todo mundo toca "Entendi". */
export const ROLES_SECONDS = 20
export const NIGHT_SECONDS = 60
export const VOTE_SECONDS = 45
export const VERDICT_SECONDS = 10
/**
 * Manhã: base + extra se alguém morreu + o tempo de a voz lenta ler cada
 * bilhete e as assombrações — com teto, para a cidade não cochilar.
 */
export const MORNING_SECONDS = 10
export const MORNING_DEATH_SECONDS = 4
/** Por bilhete: "Um bilhete foi encontrado:" + ~1 s a cada 12 letras do bilhete. */
export const MORNING_NOTE_SECONDS = 3
export const MORNING_NOTE_CHARS_PER_SECOND = 12
/** A voz cita até 3 assombrados ("A, B, C e mais 2"). */
export const MAX_SPOKEN_HAUNTS = 3
export const MORNING_MAX_SECONDS = 40
export const DAY_CHOICES = [2, 3, 4] as const
export const DEFAULT_DAY_MINUTES = 3
/** Votos mínimos para alguém sair da cidade (e sem empate). */
export const MIN_VOTES = 2
/** Trava de segurança: depois da 10ª noite os assassinos fogem (vitória deles). */
export const MAX_ROUNDS = 10
/** Tamanho máximo de um recado (em caracteres). */
export const NOTE_MAX = 80
/** No máximo 3 bilhetes para a cidade por noite (são no máximo 3 assassinos). */
export const MAX_CITY_NOTES = 3

export type Role = 'killer' | 'detective' | 'angel' | 'citizen'
export type Team = 'city' | 'killers'
export type Phase = 'roles' | 'night' | 'morning' | 'day' | 'vote' | 'verdict' | 'end'
export type EndReason = 'caught' | 'outnumbered' | 'escaped'

/** Uma escolha de noite guardada para a linha do tempo do fim. */
export type Mark = { round: number; target: number }
export type Clue = { round: number; target: number; killer: boolean }

/**
 * O segredo de cada um. Só os campos do próprio papel existem:
 * assassino (team, picks, inbox, hits), detetive (clues), anjo (guards),
 * cidadão (bets). `savedAt` aparece em quem o anjo salvou.
 */
export type Secret = {
  role: Role
  /** Assassinos: todos os assassinos da partida (eles se conhecem). */
  team?: number[]
  /** Assassinos: a escolha ao vivo de cada assassino vivo nesta noite. */
  picks?: Record<string, number>
  /** Assassinos: os recados anônimos que chegaram na última noite. */
  inbox?: string[]
  /** Assassinos: quem o grupo escolheu em cada noite. */
  hits?: Mark[]
  /** Detetive: o que descobriu, noite a noite. */
  clues?: Clue[]
  /** Anjo: quem protegeu em cada noite. */
  guards?: Mark[]
  /** Cidadão: em quem apostou em cada noite (faro). */
  bets?: Mark[]
  /** Noite em que fui atacado e o anjo me salvou. */
  savedAt?: number
}

/** Uma cova do cemitério da cidade (o papel só aparece se for revelado). */
export type Grave = { id: number; round: number; how: 'night' | 'vote'; role: Role | null }

/** O que a cidade fica sabendo de manhã. */
export type News = {
  round: number
  /** Quem morreu (null = ninguém). */
  killed: number | null
  /** Papel do morto, se a opção revela (ou se a partida acabou). */
  role: Role | null
  /** Os assassinos atacaram, mas o anjo protegeu a vítima. */
  saved: boolean
  epitaph: string
  /** Bilhetes anônimos dos assassinos para a cidade. */
  notes: string[]
  /** Quem os fantasmas assombraram (sem dizer qual fantasma). */
  haunts: { id: number; count: number }[]
  /** Quantos recados anônimos chegaram aos assassinos. */
  letters: number
}

/**
 * Por que ninguém saiu (ou 'out'): empate no topo, ninguém com 2 votos,
 * ninguém votou, ou o "🤷 Ninguém sai" empatou/venceu o mais votado.
 */
export type VerdictReason = 'out' | 'tie' | 'few' | 'none' | 'skip'

export type Verdict = {
  round: number
  /** Quem saiu da cidade (null = ninguém). */
  out: number | null
  role: Role | null
  tally: TallyEntry[]
  reason: VerdictReason
  /** Quantos votaram em "ninguém". */
  abstain: number
}

/**
 * Linha do tempo pública: o que a cidade viu em cada rodada. `voted` é false
 * quando a partida acabou de manhã (não teve votação naquele dia).
 */
export type DayLog = { round: number; killed: number | null; saved: boolean; voted: boolean; out: number | null }

/** Linha do tempo do fim, com os segredos de cada noite. */
export type NightRecap = DayLog & {
  /** Quem os assassinos escolheram. */
  target: number | null
  /** Quem o anjo protegeu. */
  guard: number | null
  /** Quem o detetive investigou e o resultado. */
  clue: { target: number; killer: boolean } | null
}

export type FaroEntry = { id: number; hits: number; bets: number }

export type Final = {
  winner: Team
  reason: EndReason
  /** Todos os papéis, revelados. */
  roles: Record<string, Role>
  nights: NightRecap[]
  /** Ranking de "melhor faro": apostas certas dos cidadãos. */
  faro: FaroEntry[]
}

export type State = BaseState & {
  phase: Phase
  round: number
  /** Quando a fase começou (ms do servidor) — para as animações da TV. */
  since: number
  acted: number[]
  alive: number[]
  /** Tempo de conversa de dia, em ms. */
  dayMs: number
  revealRole: boolean
  graveyard: Grave[]
  news: News | null
  /** Votos ao vivo (público, como numa votação de verdade). null = "ninguém". */
  votes: Record<string, number | null>
  verdict: Verdict | null
  timeline: DayLog[]
  /** Preenchido só no fim natural (o "Encerrar" do host não passa pelo motor). */
  final: Final | null
  private: Record<string, Secret>
}

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

/** Assassinos por tamanho de mesa: 1 até 7, 2 até 11, 3 a partir de 12. */
export function killerCount(players: number): number {
  if (players <= 0) return 0
  if (players >= 12) return 3
  if (players >= 8) return 2
  return 1
}

/** Quantos de cada papel (mesas pequenas demais perdem anjo/detetive). */
export function roleCounts(players: number): Record<Role, number> {
  const n = Math.max(0, players)
  const killer = Math.min(killerCount(n), n)
  const detective = n > killer ? 1 : 0
  const angel = n > killer + detective ? 1 : 0
  return { killer, detective, angel, citizen: n - killer - detective - angel }
}

/** O segredo do começo da partida para cada papel (os testes fixam papéis com ele). */
export function freshSecret(role: Role, team: number[]): Secret {
  switch (role) {
    case 'killer':
      return { role, team, picks: {}, inbox: [], hits: [] }
    case 'detective':
      return { role, clues: [] }
    case 'angel':
      return { role, guards: [] }
    default:
      return { role, bets: [] }
  }
}

function dealRoles(roster: readonly number[], rng: () => number): Record<string, Secret> {
  const counts = roleCounts(roster.length)
  const deck: Role[] = (['killer', 'detective', 'angel', 'citizen'] as const).flatMap((role) =>
    Array.from({ length: counts[role] }, () => role),
  )
  const order = shuffle(roster, rng)
  const roleById = new Map(order.map((id, index) => [id, deck[index] ?? 'citizen']))
  const team = roster.filter((id) => roleById.get(id) === 'killer')
  return Object.fromEntries(roster.map((id) => [String(id), freshSecret(roleById.get(id) ?? 'citizen', team)]))
}

export function secretOf(state: State, id: number): Secret | undefined {
  return state.private?.[String(id)]
}

export function roleOf(state: State, id: number): Role {
  return secretOf(state, id)?.role ?? 'citizen'
}

export function isKiller(state: State, id: number): boolean {
  return roleOf(state, id) === 'killer'
}

/** Quem o anjo protegeu na noite anterior (não pode repetir). */
export function blockedGuard(secret: Secret | null | undefined, round: number): number | null {
  return secret?.guards?.find((mark) => mark.round === round - 1)?.target ?? null
}

/** Alguém venceu com estes vivos? Cidade: sem assassino. Assassinos: tantos quanto os outros. */
export function winnerOf(state: State, alive: readonly number[] = state.alive): Team | null {
  const killers = alive.filter((id) => isKiller(state, id)).length
  if (killers === 0) return 'city'
  return killers >= alive.length - killers ? 'killers' : null
}

// ---------------------------------------------------------------------------
// Entradas (o que chega dos celulares)
// ---------------------------------------------------------------------------

/** Recado limpo: só texto, sem quebra de linha nem controle, até NOTE_MAX caracteres. */
export function cleanNote(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // Caractere de controle (quebra de linha, tab, \0...) vira espaço.
  const printable = Array.from(raw, (char) => {
    const code = char.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f ? ' ' : char
  }).join('')
  const text = printable.replace(/\s+/g, ' ').trim()
  return Array.from(text).slice(0, NOTE_MAX).join('').trim()
}

/**
 * O alvo da noite vale para quem mandou? Precisa estar vivo. Assassino não
 * mata parceiro; detetive e cidadão escolhem outra pessoa; o anjo pode se
 * proteger, mas não repete a pessoa da noite anterior; fantasma assombra
 * qualquer vivo.
 */
export function validNightTarget(state: State, actor: number, target: unknown): number | null {
  if (typeof target !== 'number' || !state.alive.includes(target)) return null
  if (!state.roster.includes(actor)) return null
  if (!state.alive.includes(actor)) return target
  switch (roleOf(state, actor)) {
    case 'killer':
      return isKiller(state, target) ? null : target
    case 'angel':
      return target === blockedGuard(secretOf(state, actor), state.round) ? null : target
    default:
      return target === actor ? null : target
  }
}

/** Escolha válida de cada assassino vivo, ao vivo (só eles veem). */
export function killerPicks(state: State, ctx: EngineCtx): Record<string, number> {
  const picks: Record<string, number> = {}
  for (const id of state.alive) {
    if (!isKiller(state, id)) continue
    const target = validNightTarget(state, id, inputFor(ctx, state.inputKey, id)?.target)
    if (target !== null) picks[String(id)] = target
  }
  return picks
}

/** Votos válidos do dia: só os vivos votam, em outro vivo ou em "ninguém" (null). */
export function collectVotes(state: State, ctx: EngineCtx): Record<string, number | null> {
  const votes: Record<string, number | null> = {}
  for (const voter of state.alive) {
    const input = inputFor(ctx, state.inputKey, voter)
    if (!input || !('vote' in input)) continue
    const target = input.vote
    if (target === null) votes[String(voter)] = null
    else if (typeof target === 'number' && target !== voter && state.alive.includes(target)) {
      votes[String(voter)] = target
    }
  }
  return votes
}

function sameRecord<T>(a: Record<string, T> | undefined, b: Record<string, T>): boolean {
  const left = a ?? {}
  const keys = Object.keys(b)
  return Object.keys(left).length === keys.length && keys.every((key) => key in left && left[key] === b[key])
}

/**
 * O resultado de uma votação — o motor fecha com ele e a TV marca, ao vivo,
 * quem está saindo. Sai o mais votado com pelo menos MIN_VOTES votos, sem
 * empate e com MAIS votos que o "🤷 Ninguém sai" (que também concorre:
 * 2 votos no Pedro contra 10 em "ninguém sai" não expulsa o Pedro).
 */
export function voteOutcome(votes: Record<string, number | null>): {
  tally: TallyEntry[]
  out: number | null
  reason: VerdictReason
  abstain: number
} {
  const entries = tally(votes)
  const abstain = Object.values(votes).filter((vote) => vote === null).length
  const best = entries[0]?.count ?? 0
  const leader = topUnique(entries)
  const result = (out: number | null, reason: VerdictReason) => ({ tally: entries, out, reason, abstain })
  if (!entries.length && !abstain) return result(null, 'none')
  if (abstain >= best) return result(null, 'skip')
  if (best < MIN_VOTES) return result(null, 'few')
  if (leader === null) return result(null, 'tie')
  return result(leader, 'out')
}

/** Quanto a voz lenta da TV leva para ler um bilhete (com a abertura "Um bilhete foi encontrado"). */
export function noteSeconds(note: string): number {
  return MORNING_NOTE_SECONDS + Math.ceil(Array.from(note).length / MORNING_NOTE_CHARS_PER_SECOND)
}

/** Quanto dura a manhã: mais tempo quando tem morte, bilhete e assombração para ler. */
export function morningSeconds(news: News): number {
  const notes = news.notes.slice(0, MAX_CITY_NOTES).reduce((total, note) => total + noteSeconds(note), 0)
  const haunts = news.haunts.length ? 2 + Math.min(MAX_SPOKEN_HAUNTS, news.haunts.length) : 0
  const total = MORNING_SECONDS + (news.killed !== null ? MORNING_DEATH_SECONDS : 0) + notes + haunts
  return Math.min(MORNING_MAX_SECONDS, total)
}

/** Fases em que o prazo tem a folga de 2 s (respostas que contam até o fim). */
export function hasGrace(phase: Phase): boolean {
  return phase === 'roles' || phase === 'night' || phase === 'vote'
}

/** Duração total da fase atual (a vela cheia), em ms. */
export function phaseTotalMs(state: State): number {
  switch (state.phase) {
    case 'roles':
      return ROLES_SECONDS * 1000
    case 'night':
      return NIGHT_SECONDS * 1000
    case 'morning':
      return (state.news ? morningSeconds(state.news) : MORNING_SECONDS) * 1000
    case 'day':
      return state.dayMs
    case 'vote':
      return VOTE_SECONDS * 1000
    case 'verdict':
      return VERDICT_SECONDS * 1000
    default:
      return 0
  }
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function startNight(state: State, now: number, round: number): State {
  return {
    ...state,
    phase: 'night',
    round,
    since: now,
    // Uma chave por noite: escolha da noite passada não vale nesta.
    inputKey: `night-${round}`,
    deadline: answerDeadline(now, NIGHT_SECONDS),
    acted: [],
    votes: {},
    verdict: null,
  }
}

/** Durante a noite: ✓ de quem já agiu e a escolha ao vivo dos assassinos — só se mudou. */
function refreshNight(state: State, ctx: EngineCtx): State {
  const acted = actedIds(ctx, state.inputKey, state.roster)
  const picks = killerPicks(state, ctx)
  const killers = state.alive.filter((id) => isKiller(state, id))
  const actedSame = sameIds(state.acted, acted)
  const picksSame = killers.every((id) => sameRecord(secretOf(state, id)?.picks, picks))
  if (actedSame && picksSame) return state
  const next = actedSame ? state : { ...state, acted }
  if (picksSame) return next
  const secrets = { ...state.private }
  for (const id of killers) {
    const secret = secrets[String(id)]
    if (secret) secrets[String(id)] = { ...secret, picks }
  }
  return { ...next, private: secrets }
}

/** Fecha a noite: quem morre, quem foi salvo, o que o detetive descobriu, recados e assombrações. */
function resolveNight(state: State, ctx: EngineCtx): State {
  const { round, alive, roster, inputKey } = state
  const input = (id: number) => inputFor(ctx, inputKey, id)
  const choice = (id: number) => validNightTarget(state, id, input(id)?.target)
  const roleIs = (role: Role) => (id: number) => roleOf(state, id) === role

  // 🔪 A vítima: a mais escolhida pelos assassinos vivos; empate sorteia.
  const leaders = topIds(tally(killerPicks(state, ctx)))
  const victim = leaders.length === 0 ? null : leaders.length === 1 ? leaders[0] : pick(leaders, ctx.rng)

  // 😇 O anjo protege; 🔎 o detetive investiga.
  const angel = alive.find(roleIs('angel'))
  const guard = angel === undefined ? null : choice(angel)
  const saved = victim !== null && guard === victim
  const killed = victim !== null && !saved ? victim : null
  const detective = alive.find(roleIs('detective'))
  const probe = detective === undefined ? null : choice(detective)

  // 📨 Recados: quem não é assassino escreve para os assassinos; o assassino,
  // para a cidade. Embaralhados — a ordem não pode entregar quem mandou.
  const toKillers: string[] = []
  const toCity: string[] = []
  for (const id of alive) {
    const note = cleanNote(input(id)?.note)
    if (!note) continue
    if (isKiller(state, id)) toCity.push(note)
    else toKillers.push(note)
  }
  const inbox = shuffle(toKillers, ctx.rng)
  const notes = shuffle(toCity, ctx.rng).slice(0, MAX_CITY_NOTES)

  // 👻 Fantasmas assombram (só aparece na TV, sem dizer qual fantasma).
  const hauntVotes: Record<number, number> = {}
  for (const ghost of roster) {
    if (alive.includes(ghost)) continue
    const target = choice(ghost)
    if (target !== null) hauntVotes[ghost] = target
  }
  const haunts = tally(hauntVotes).map(({ id, count }) => ({ id, count }))

  // Os segredos de cada um, noite a noite.
  const secrets: Record<string, Secret> = { ...state.private }
  for (const id of roster) {
    const key = String(id)
    const secret = secrets[key]
    if (!secret) continue
    let next = secret
    if (secret.role === 'killer') {
      next = {
        ...next,
        picks: {},
        inbox: alive.includes(id) ? inbox : [],
        hits: victim !== null ? [...(secret.hits ?? []), { round, target: victim }] : (secret.hits ?? []),
      }
    } else if (id === detective && probe !== null) {
      next = { ...next, clues: [...(secret.clues ?? []), { round, target: probe, killer: isKiller(state, probe) }] }
    } else if (id === angel && guard !== null) {
      next = { ...next, guards: [...(secret.guards ?? []), { round, target: guard }] }
    } else if (secret.role === 'citizen' && alive.includes(id)) {
      const bet = choice(id)
      if (bet !== null) next = { ...next, bets: [...(secret.bets ?? []), { round, target: bet }] }
    }
    if (saved && id === victim) next = { ...next, savedAt: round }
    if (next !== secret) secrets[key] = next
  }

  const nextAlive = killed === null ? alive : alive.filter((id) => id !== killed)
  // Papel revelado se a opção pede — ou se esta morte acabou com a partida.
  const revealed = killed !== null && (state.revealRole || winnerOf(state, nextAlive) !== null)
  const role = revealed && killed !== null ? roleOf(state, killed) : null
  const news: News = {
    round,
    killed,
    role,
    saved,
    epitaph: killed !== null ? pick(EPITAPHS, ctx.rng) : '',
    notes,
    haunts,
    letters: toKillers.length,
  }

  return {
    ...state,
    phase: 'morning',
    since: ctx.now,
    deadline: deadlineIn(ctx.now, morningSeconds(news)),
    acted: actedIds(ctx, inputKey, roster),
    alive: nextAlive,
    graveyard: killed === null ? state.graveyard : [...state.graveyard, { id: killed, round, how: 'night', role }],
    news,
    timeline: [...state.timeline, { round, killed, saved, voted: false, out: null }],
    private: secrets,
  }
}

function startDay(state: State, now: number): State {
  return {
    ...state,
    phase: 'day',
    since: now,
    inputKey: `day-${state.round}`,
    deadline: deadlineIn(now, state.dayMs / 1000),
    acted: [],
  }
}

function startVote(state: State, now: number): State {
  return {
    ...state,
    phase: 'vote',
    since: now,
    inputKey: `vote-${state.round}`,
    deadline: answerDeadline(now, VOTE_SECONDS),
    acted: [],
    votes: {},
  }
}

/** Durante a votação: votos ao vivo e ✓ — só se mudou. */
function refreshVotes(state: State, ctx: EngineCtx): State {
  const votes = collectVotes(state, ctx)
  const acted = actedIds(ctx, state.inputKey, state.alive)
  if (sameRecord(state.votes, votes) && sameIds(state.acted, acted)) return state
  return { ...state, votes, acted }
}

/** Fecha a votação: sai o mais votado com pelo menos 2 votos, sem empate e vencendo o "ninguém sai". */
function resolveVote(state: State, ctx: EngineCtx): State {
  const votes = collectVotes(state, ctx)
  const { tally: entries, out, reason, abstain } = voteOutcome(votes)
  const nextAlive = out === null ? state.alive : state.alive.filter((id) => id !== out)
  const revealed = out !== null && (state.revealRole || winnerOf(state, nextAlive) !== null)
  const role = revealed && out !== null ? roleOf(state, out) : null
  return {
    ...state,
    phase: 'verdict',
    since: ctx.now,
    deadline: deadlineIn(ctx.now, VERDICT_SECONDS),
    acted: actedIds(ctx, state.inputKey, state.alive),
    votes,
    alive: nextAlive,
    graveyard: out === null ? state.graveyard : [...state.graveyard, { id: out, round: state.round, how: 'vote', role }],
    verdict: {
      round: state.round,
      out,
      role,
      tally: entries,
      reason,
      abstain,
    },
    timeline: state.timeline.map((day) => (day.round === state.round ? { ...day, voted: true, out } : day)),
  }
}

/** A linha do tempo do fim: o público de cada rodada + os segredos de cada noite. */
export function nightRecap(state: State): NightRecap[] {
  const killer = state.roster.find((id) => isKiller(state, id))
  const angel = state.roster.find((id) => roleOf(state, id) === 'angel')
  const detective = state.roster.find((id) => roleOf(state, id) === 'detective')
  const hits = killer === undefined ? [] : (secretOf(state, killer)?.hits ?? [])
  const guards = angel === undefined ? [] : (secretOf(state, angel)?.guards ?? [])
  const clues = detective === undefined ? [] : (secretOf(state, detective)?.clues ?? [])
  return state.timeline.map((day) => {
    const clue = clues.find((entry) => entry.round === day.round)
    return {
      ...day,
      target: hits.find((mark) => mark.round === day.round)?.target ?? null,
      guard: guards.find((mark) => mark.round === day.round)?.target ?? null,
      clue: clue ? { target: clue.target, killer: clue.killer } : null,
    }
  })
}

/**
 * "Melhor faro": apostas certas de cada cidadão. Mesmo número de acertos:
 * quem errou menos (2 de 2 vence 2 de 4); sem acerto, ordem da mesa.
 */
export function faroRanking(state: State): FaroEntry[] {
  return state.roster
    .filter((id) => roleOf(state, id) === 'citizen')
    .map((id) => {
      const bets = secretOf(state, id)?.bets ?? []
      return { id, bets: bets.length, hits: bets.filter((bet) => isKiller(state, bet.target)).length }
    })
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        (a.hits > 0 ? a.bets - b.bets : 0) ||
        state.roster.indexOf(a.id) - state.roster.indexOf(b.id),
    )
}

function finish(state: State, now: number, winner: Team, reason: EndReason): State {
  return {
    ...state,
    phase: 'end',
    over: true,
    deadline: null,
    since: now,
    acted: [],
    final: {
      winner,
      reason,
      roles: Object.fromEntries(state.roster.map((id) => [String(id), roleOf(state, id)])),
      nights: nightRecap(state),
      faro: faroRanking(state),
    },
  }
}

/** Fim de uma rodada (ou dos papéis): alguém venceu? senão, cai a noite. */
function nextNightOrEnd(state: State, now: number): State {
  const winner = winnerOf(state)
  if (winner) return finish(state, now, winner, winner === 'city' ? 'caught' : 'outnumbered')
  if (state.round >= MAX_ROUNDS) return finish(state, now, 'killers', 'escaped')
  return startNight(state, now, state.round + 1)
}

// ---------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------

export const engine: HalloweenEngine<State> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const dayMinutes = readOption<number>(ctx.options, 'dayMinutes', DEFAULT_DAY_MINUTES, DAY_CHOICES)
    const revealRole = readOption<boolean>(ctx.options, 'revealRole', true)
    return {
      phase: 'roles',
      inputKey: 'roles',
      deadline: answerDeadline(ctx.now, ROLES_SECONDS),
      roster,
      over: false,
      acted: [],
      round: 0,
      since: ctx.now,
      alive: [...roster],
      dayMs: dayMinutes * 60_000,
      revealRole,
      graveyard: [],
      news: null,
      votes: {},
      verdict: null,
      timeline: [],
      final: null,
      private: dealRoles(roster, ctx.rng),
    }
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'roles':
        // Todo mundo viu o papel (ou o prazo/"Pular"): cai a primeira noite.
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.roster)) {
          return nextNightOrEnd(state, ctx.now)
        }
        return refreshActed(state, ctx)
      case 'night':
        // Acaba quando todos os VIVOS online agiram — fantasma não segura a noite.
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.alive)) return resolveNight(state, ctx)
        return refreshNight(state, ctx)
      case 'morning': {
        if (!timeUp(state, ctx)) return state
        const winner = winnerOf(state)
        if (winner) return finish(state, ctx.now, winner, winner === 'city' ? 'caught' : 'outnumbered')
        return startDay(state, ctx.now)
      }
      case 'day':
        // "✋ Pronto para votar" de todos os vivos online também encerra a conversa.
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.alive)) return startVote(state, ctx.now)
        return refreshActed(state, ctx, state.inputKey, state.alive)
      case 'vote':
        if (timeUp(state, ctx) || allOnlineActed(ctx, state.inputKey, state.alive)) return resolveVote(state, ctx)
        return refreshVotes(state, ctx)
      case 'verdict':
        return timeUp(state, ctx) ? nextNightOrEnd(state, ctx.now) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || !state.roster.includes(playerId)) return null
    const alive = state.alive.includes(playerId)
    switch (state.phase) {
      case 'roles':
        return { ok: true }
      case 'night':
        return nightBot(state, playerId, ctx.rng)
      case 'day':
        return alive ? { ready: true } : null
      case 'vote':
        return alive ? voteBot(state, playerId, ctx.rng) : null
      default:
        return null
    }
  },
}

/** Bot da noite: escolhe um alvo válido; assassinos tendem a seguir o parceiro. */
function nightBot(state: State, id: number, rng: () => number): Record<string, unknown> | null {
  const options = state.alive.filter((target) => validNightTarget(state, id, target) !== null)
  if (!options.length) return null
  if (!state.alive.includes(id)) return rng() < 0.6 ? { target: pick(options, rng) } : null
  const secret = secretOf(state, id)
  let target = pick(options, rng)
  if (secret?.role === 'killer') {
    const partner = Object.values(secret.picks ?? {}).find((value) => options.includes(value))
    if (partner !== undefined && rng() < 0.7) target = partner
  }
  const reply: Record<string, unknown> = { target }
  if (rng() < 0.3) reply.note = pick(secret?.role === 'killer' ? KILLER_NOTES : CITY_NOTES, rng)
  return reply
}

/**
 * Bot da votação: parte da mesa segue o "suspeito do dia" (para alguém
 * juntar 2 votos), parte fareja o assassino de verdade, parte vota em
 * qualquer um ou em ninguém. Assassinos votam num inocente.
 */
function voteBot(state: State, id: number, rng: () => number): Record<string, unknown> {
  const options = state.alive.filter((target) => target !== id)
  if (!options.length) return { vote: null }
  const roll = rng()
  if (roll < 0.08) return { vote: null }
  const innocents = options.filter((target) => !isKiller(state, target))
  if (isKiller(state, id)) return { vote: pick(innocents.length ? innocents : options, rng) }
  const killers = options.filter((target) => isKiller(state, target))
  if (roll < 0.35 && killers.length) return { vote: pick(killers, rng) }
  const suspect = state.alive[(state.round * 7) % state.alive.length]
  if (roll < 0.8 && suspect !== id) return { vote: suspect }
  return { vote: pick(options, rng) }
}
