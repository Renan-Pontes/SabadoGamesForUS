import {
  addScores,
  answerDeadline,
  deadlineIn,
  inputFor,
  onlineRoster,
  pick,
  randomInt,
  ranking,
  sameIds,
  sample,
  shuffle,
  timeUp,
  type RankEntry,
} from '../../engine/helpers'
import type { BaseState, EngineCtx, HalloweenEngine } from '../../engine/types'
import { CORRIDORS, MONSTERS, SALVATION_LINES, type Monster } from './content'
import { revealSchedule } from './timeline'

/**
 * 🚪 Portas do Além — sobrevivência com sustos.
 *
 * Os vivos escolhem uma porta em segredo; os fantasmas votam onde o monstro
 * ataca. Quem estava atrás da porta do monstro vira fantasma — e passa a
 * votar também. Último vivo vence.
 *
 *   choose (15 s) ──► reveal (portas abrem uma a uma) ──► status (6 s) ──► choose…
 *                          └── sobrou um vivo, ou rodada 15 ──► final (over)
 *
 * Para nunca passar de ~10 minutos: da rodada 8 em diante entra um monstro a
 * mais por rodada ("o além está ficando impaciente…") e, na 15ª, o além
 * desiste — quem ainda estiver vivo divide a vitória (o "empate dos
 * últimos"). Sem esse teto a partida podia não acabar: se todos os vivos
 * entram na mesma porta, ninguém morre nunca (a salvação garante).
 *
 * Como todo motor: `step` é puro e idempotente, devolve o MESMO objeto
 * quando nada muda, trata `skip` como prazo vencido (`timeUp`) e nunca
 * espera por quem está offline (quem não escolheu cai numa porta sorteada).
 */

export const CHOOSE_SECONDS = 15
export const STATUS_SECONDS = 6
/** Teto de rodadas: na 15ª o além desiste e os vivos dividem a vitória. */
export const MAX_ROUNDS = 15
/** Desta rodada em diante, um monstro a mais por rodada. */
export const IMPATIENT_FROM = 8

export type PortasPhase = 'choose' | 'reveal' | 'status' | 'final'

/**
 * Susto de tela cheia quando a porta do monstro abre: sempre no primeiro
 * sangue e no golpe final; no meio da partida, às vezes ("surprise"), só
 * quando alguém morre — para nunca virar rotina.
 */
export type RevealScare = 'first-blood' | 'final' | 'surprise' | null

/** Chance do susto surpresa numa revelação com morte no meio da partida. */
export const SURPRISE_SCARE_CHANCE = 1 / 3

/** O que a TV revela quando as portas abrem. */
export type PortasReveal = {
  /** Começo da revelação (ms do servidor): TV e celulares seguem `revealSchedule` a partir daqui. */
  startedAt: number
  /** Ordem em que as portas abrem: seguras primeiro (vazias antes), as do monstro por último. */
  order: number[]
  /** Portas com monstro (em ordem crescente). */
  monsterDoors: number[]
  /** Quem está atrás de cada porta: porta de cada vivo (público só agora). */
  picks: Record<string, number>
  /** Vivos que não escolheram e caíram numa porta sorteada. */
  autoPicked: number[]
  /** Voto de cada fantasma (público só agora). */
  ghostVotes: Record<string, number>
  /** Quem virou fantasma nesta rodada (vazio na salvação). */
  victims: number[]
  /** Todos os vivos estavam atrás de porta com monstro: ninguém morre. */
  saved: boolean
  /** Almas que cada fantasma levou nesta rodada (só quem acertou). */
  hunters: Record<string, number>
  /** Um monstro por porta de monstro, na mesma ordem de `monsterDoors`. */
  beasts: Monster[]
  /** Frase da salvação ("o monstro tropeçou!"); vazia quando não houve. */
  salvation: string
  scare: RevealScare
  /** A partida acaba depois desta revelação. */
  last: boolean
}

/** Segredo dos fantasmas durante a escolha: quantos votos cada porta já tem. */
export type GhostSecret = { votes: number[] }

export type State = BaseState & {
  phase: PortasPhase
  round: number
  /** O teto (MAX_ROUNDS): a TV mostra "rodada 9 de no máximo 15". */
  totalRounds: number
  /** Portas desta rodada (3, 4 ou 5). */
  doors: number
  /** Monstros desta rodada. */
  monsters: number
  /** Quantos desses monstros vieram da impaciência do além. */
  extraMonsters: number
  /** Quem ainda está vivo (subconjunto do roster, na ordem do roster). */
  alive: number[]
  /** Rodada em que cada um virou fantasma. */
  diedIn: Record<string, number>
  /** Almas que cada fantasma levou na partida ("fantasma mais vingativo"). */
  souls: Record<string, number>
  acted: number[]
  /** Nome do corredor da rodada. */
  corridor: string
  /** Corredores sorteados para a partida (índices de CORRIDORS), um por rodada. */
  corridorDeck: number[]
  /** Preenchido na revelação; null na escolha. */
  reveal: PortasReveal | null
  /** Só os fantasmas recebem, na escolha: a contagem de votos por porta. */
  private: Record<string, GhostSecret>
}

// ---------------------------------------------------------------------------
// Regras puras (também usadas pelas telas)
// ---------------------------------------------------------------------------

/** Portas: 3 até 4 vivos, 4 até 8, 5 com 9 ou mais. */
export function doorsFor(alive: number): number {
  if (alive <= 4) return 3
  if (alive <= 8) return 4
  return 5
}

/** Dois monstros quando há 10 ou mais vivos. */
export function baseMonsters(alive: number): number {
  return alive >= 10 ? 2 : 1
}

export type RoundSetup = { doors: number; monsters: number; extra: number }

/**
 * Portas e monstros de uma rodada. Da rodada 8 em diante entra um monstro a
 * mais por rodada, mas sempre sobra pelo menos uma porta segura.
 */
export function roundSetup(alive: number, round: number): RoundSetup {
  const doors = doorsFor(alive)
  const base = Math.min(doors - 1, baseMonsters(alive))
  const impatience = Math.max(0, round - IMPATIENT_FROM + 1)
  const monsters = Math.min(doors - 1, base + impatience)
  return { doors, monsters, extra: monsters - base }
}

/** A porta escolhida, se for válida (inteiro de 1 a `doors`); senão null. */
export function validDoor(value: unknown, doors: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= doors ? value : null
}

/** Quem já morreu (na ordem do roster). */
export function ghostsOf(state: Pick<State, 'roster' | 'alive'>): number[] {
  const alive = new Set(state.alive)
  return state.roster.filter((id) => !alive.has(id))
}

/**
 * Portas do monstro: as mais votadas pelos fantasmas. O empate (e as portas
 * sem voto, quando faltam votos) é sorteado; sem fantasma, tudo no sorteio.
 */
export function chooseMonsterDoors(
  votes: Record<string, number>,
  doors: number,
  count: number,
  rng: () => number,
): number[] {
  const counts = new Array<number>(doors + 1).fill(0)
  for (const door of Object.values(votes)) {
    if (validDoor(door, doors) !== null) counts[door] += 1
  }
  const all = Array.from({ length: doors }, (_, index) => index + 1)
  // Embaralha antes e ordena de forma estável: empate fica na ordem sorteada.
  return shuffle(all, rng)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, Math.max(0, Math.min(count, doors)))
    .sort((a, b) => a - b)
}

/** Ordem de abertura: seguras primeiro (vazias antes das cheias), monstros por último. */
export function openingOrder(doors: number, monsterDoors: readonly number[], picks: Record<string, number>): number[] {
  const crowd = new Array<number>(doors + 1).fill(0)
  for (const door of Object.values(picks)) if (door >= 1 && door <= doors) crowd[door] += 1
  const byCrowd = (a: number, b: number) => crowd[a] - crowd[b] || a - b
  const all = Array.from({ length: doors }, (_, index) => index + 1)
  const safe = all.filter((door) => !monsterDoors.includes(door)).sort(byCrowd)
  const bad = all.filter((door) => monsterDoors.includes(door)).sort(byCrowd)
  return [...safe, ...bad]
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function corridorName(index: number | undefined): string {
  return CORRIDORS[index ?? 0] ?? CORRIDORS[0] ?? 'Corredor Escuro'
}

/** Abre a escolha da rodada `round`, com portas e monstros para quem está vivo. */
function startRound(state: State, now: number, round: number): State {
  const setup = roundSetup(state.alive.length, round)
  const deck = state.corridorDeck
  return {
    ...state,
    phase: 'choose',
    round,
    // Uma chave por rodada: porta da rodada passada não vale nesta.
    inputKey: `door-${round}`,
    deadline: answerDeadline(now, CHOOSE_SECONDS),
    doors: setup.doors,
    monsters: setup.monsters,
    extraMonsters: setup.extra,
    acted: [],
    corridor: corridorName(deck.length ? deck[(round - 1) % deck.length] : 0),
    reveal: null,
    private: {},
  }
}

/** Quem do roster já mandou uma porta válida nesta rodada. */
function validActed(state: State, ctx: EngineCtx): number[] {
  return state.roster.filter((id) => validDoor(inputFor(ctx, state.inputKey, id)?.door, state.doors) !== null)
}

/** Todo mundo online (vivo ou fantasma) já escolheu? Offline não segura. */
function everyoneChose(state: State, ctx: EngineCtx): boolean {
  const online = onlineRoster(ctx, state.roster)
  return online.length > 0 && online.every((id) => validDoor(inputFor(ctx, state.inputKey, id)?.door, state.doors) !== null)
}

/** O placar secreto dos fantasmas: votos por porta, igual para todos eles. */
function ghostSecrets(state: State, ctx: EngineCtx): Record<string, GhostSecret> {
  const ghosts = ghostsOf(state)
  if (!ghosts.length) return {}
  const votes = new Array<number>(state.doors).fill(0)
  for (const id of ghosts) {
    const door = validDoor(inputFor(ctx, state.inputKey, id)?.door, state.doors)
    if (door !== null) votes[door - 1] += 1
  }
  return Object.fromEntries(ghosts.map((id) => [String(id), { votes: [...votes] }]))
}

/** Durante a escolha: atualiza os ✓ e o placar dos fantasmas — só se mudou. */
function refreshChoose(state: State, ctx: EngineCtx): State {
  const acted = validActed(state, ctx)
  const secrets = ghostSecrets(state, ctx)
  const sameActed = sameIds(state.acted, acted)
  const sameSecrets = JSON.stringify(secrets) === JSON.stringify(state.private ?? {})
  if (sameActed && sameSecrets) return state
  return { ...state, acted: sameActed ? state.acted : acted, private: sameSecrets ? state.private : secrets }
}

/** Fecha a escolha: sorteia quem não escolheu, solta os monstros e conta os mortos. */
function openDoors(state: State, ctx: EngineCtx): State {
  const { doors, inputKey } = state

  // 1. A porta de cada vivo; quem não escolheu cai numa porta sorteada.
  const picks: Record<string, number> = {}
  const autoPicked: number[] = []
  for (const id of state.alive) {
    const door = validDoor(inputFor(ctx, inputKey, id)?.door, doors)
    if (door !== null) {
      picks[String(id)] = door
    } else {
      picks[String(id)] = randomInt(ctx.rng, 1, doors)
      autoPicked.push(id)
    }
  }

  // 2. Os fantasmas decidem onde o monstro ataca.
  const ghostVotes: Record<string, number> = {}
  for (const id of ghostsOf(state)) {
    const door = validDoor(inputFor(ctx, inputKey, id)?.door, doors)
    if (door !== null) ghostVotes[String(id)] = door
  }
  const monsterDoors = chooseMonsterDoors(ghostVotes, doors, state.monsters, ctx.rng)

  // 3. Quem estava atrás de porta com monstro morre — a não ser que fossem
  //    TODOS os vivos: aí o monstro tropeça e ninguém morre.
  const caught = state.alive.filter((id) => monsterDoors.includes(picks[String(id)]))
  const saved = caught.length > 0 && caught.length === state.alive.length
  const victims = saved ? [] : caught

  // 4. Cada fantasma leva as almas da porta em que votou.
  const hunters: Record<string, number> = {}
  for (const [ghost, door] of Object.entries(ghostVotes)) {
    const taken = victims.filter((id) => picks[String(id)] === door).length
    if (taken > 0) hunters[ghost] = taken
  }

  const alive = state.alive.filter((id) => !victims.includes(id))
  const beasts = sample(MONSTERS, monsterDoors.length, ctx.rng)
  const salvation = saved ? pick(SALVATION_LINES, ctx.rng) : ''
  const firstBlood = victims.length > 0 && Object.keys(state.diedIn).length === 0
  const finalBlow = victims.length > 0 && alive.length <= 1
  const surprise = victims.length > 0 && !firstBlood && !finalBlow && ctx.rng() < SURPRISE_SCARE_CHANCE
  const scare: RevealScare = finalBlow ? 'final' : firstBlood ? 'first-blood' : surprise ? 'surprise' : null
  const order = openingOrder(doors, monsterDoors, picks)
  const schedule = revealSchedule(order.length, monsterDoors.length, scare !== null)

  return {
    ...state,
    phase: 'reveal',
    deadline: deadlineIn(ctx.now, schedule.total / 1000),
    acted: validActed(state, ctx),
    alive,
    diedIn: { ...state.diedIn, ...Object.fromEntries(victims.map((id) => [String(id), state.round])) },
    souls: addScores(state.souls, hunters),
    private: {},
    reveal: {
      startedAt: ctx.now,
      order,
      monsterDoors,
      picks,
      autoPicked,
      ghostVotes,
      victims,
      saved,
      hunters,
      beasts,
      salvation,
      scare,
      last: alive.length <= 1 || state.round >= MAX_ROUNDS,
    },
  }
}

function finish(state: State): State {
  return { ...state, phase: 'final', over: true, deadline: null, private: {} }
}

export const engine: HalloweenEngine<State> = {
  init(ctx) {
    const roster = onlineRoster(ctx)
    const corridorDeck = shuffle(
      CORRIDORS.map((_, index) => index),
      ctx.rng,
    ).slice(0, MAX_ROUNDS)
    const blank: State = {
      phase: 'choose',
      inputKey: '',
      deadline: null,
      roster,
      over: false,
      acted: [],
      round: 0,
      totalRounds: MAX_ROUNDS,
      doors: 3,
      monsters: 1,
      extraMonsters: 0,
      alive: [...roster],
      diedIn: {},
      souls: {},
      corridor: '',
      corridorDeck,
      reveal: null,
      private: {},
    }
    return startRound(blank, ctx.now, 1)
  },

  step(state, ctx) {
    if (state.over) return state
    switch (state.phase) {
      case 'choose':
        // Acaba no prazo, no "Pular" do host, ou quando todo mundo online escolheu.
        if (timeUp(state, ctx) || everyoneChose(state, ctx)) return openDoors(state, ctx)
        // Só atualiza os ✓ da TV e o placar dos fantasmas — e só se mudou.
        return refreshChoose(state, ctx)
      case 'reveal':
        if (!timeUp(state, ctx)) return state
        if (state.reveal?.last || state.alive.length <= 1 || state.round >= MAX_ROUNDS) return finish(state)
        return { ...state, phase: 'status', deadline: deadlineIn(ctx.now, STATUS_SECONDS) }
      case 'status':
        // A rodada nova já nasce com o placar dos fantasmas zerado (e assim
        // repetir o mesmo ctx não muda nada).
        return timeUp(state, ctx) ? refreshChoose(startRound(state, ctx.now, state.round + 1), ctx) : state
      default:
        return state
    }
  },

  bot(state, playerId, ctx) {
    if (state.over || state.phase !== 'choose' || !state.roster.includes(playerId)) return null
    if (state.alive.includes(playerId)) return { door: randomInt(ctx.rng, 1, state.doors) }
    // Fantasmas costumam combinar: metade vai na "porta da moda" da rodada.
    const favorite = ((state.round * 7) % state.doors) + 1
    return { door: ctx.rng() < 0.5 ? favorite : randomInt(ctx.rng, 1, state.doors) }
  },
}

// ---------------------------------------------------------------------------
// Fim da partida (TV e celular)
// ---------------------------------------------------------------------------

export type PortasStanding = {
  /** Quem saiu vivo (um só, ou o "empate dos últimos"). */
  winners: number[]
  /** Classificação pela sobrevivência: vivos em 1º, depois quem morreu mais tarde. */
  ranking: RankEntry[]
  /** "Fantasma mais vingativo": quem levou mais almas (vazio se ninguém levou). */
  avengers: number[]
  maxSouls: number
}

/** Os prêmios do fim — calculados do estado (vale também para o "Encerrar" do host). */
export function finalStanding(state: State): PortasStanding {
  const alive = new Set(state.alive)
  const survival: Record<string, number> = {}
  for (const id of state.roster) {
    survival[String(id)] = alive.has(id) ? MAX_ROUNDS + 1 : (state.diedIn[String(id)] ?? 0)
  }
  const souls = (id: number) => state.souls[String(id)] ?? 0
  const maxSouls = Math.max(0, ...state.roster.map(souls))
  return {
    winners: state.roster.filter((id) => alive.has(id)),
    ranking: ranking(survival, state.roster),
    avengers: maxSouls > 0 ? state.roster.filter((id) => souls(id) === maxSouls) : [],
    maxSouls,
  }
}

/** Portas e monstros da próxima rodada (o placar entre rodadas mostra). */
export function nextRoundSetup(state: State): RoundSetup {
  return roundSetup(state.alive.length, state.round + 1)
}
