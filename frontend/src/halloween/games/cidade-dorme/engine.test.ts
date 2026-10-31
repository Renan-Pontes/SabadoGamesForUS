import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HCommand, HInput } from '../../engine/types'
import { CITY_NOTES, EPITAPHS, KILLER_NOTES, NIGHT_LINES, NOBODY_OUT, ROLE_INFO } from './content'
import {
  MAX_ROUNDS,
  MORNING_DEATH_SECONDS,
  MORNING_MAX_SECONDS,
  MORNING_SECONDS,
  NIGHT_SECONDS,
  NOTE_MAX,
  ROLES_SECONDS,
  VERDICT_SECONDS,
  VOTE_SECONDS,
  cleanNote,
  engine,
  faroRanking,
  freshSecret,
  killerCount,
  morningSeconds,
  noteSeconds,
  roleCounts,
  roleOf,
  validNightTarget,
  voteOutcome,
  winnerOf,
  type News,
  type Role,
  type State,
} from './engine'
import { meta } from './meta'
import { narration, speakable, tvCue } from './narration'

const NOW = 1_000_000
let commandId = 0

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 6, options: Record<string, unknown> = {}, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** Fixa os papéis (o resto vira cidadão) — testes legíveis, sem depender do sorteio. */
function setRoles(state: State, roles: Record<number, Role>): State {
  const team = state.roster.filter((id) => roles[id] === 'killer')
  return {
    ...state,
    private: Object.fromEntries(state.roster.map((id) => [String(id), freshSecret(roles[id] ?? 'citizen', team)])),
  }
}

const skipCommand = (): HCommand => ({ id: ++commandId, type: 'skip' })

/** ctx com as respostas `{ id: campos }` da fase atual. */
function answers(
  state: State,
  replies: Record<number, Record<string, unknown>>,
  extra: Partial<EngineCtx> = {},
): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(replies)) inputs[Number(id)] = { ...fields, k: state.inputKey }
  return makeCtx({ players: makePlayers(Math.max(1, ...state.roster)), now: NOW + 1000, inputs, ...extra })
}

/** Pula a fase atual (com as respostas dadas, se houver). */
function skip(state: State, replies: Record<number, Record<string, unknown>> = {}): State {
  return engine.step(state, answers(state, replies, { command: skipCommand() }))
}

/** 6 jogadores: 1 assassino, 2 detetive, 3 anjo, 4–6 cidadãos — já na primeira noite. */
const SIX: Record<number, Role> = { 1: 'killer', 2: 'detective', 3: 'angel' }
/** 8 jogadores: 1 e 2 assassinos, 3 detetive, 4 anjo, 5–8 cidadãos. */
const EIGHT: Record<number, Role> = { 1: 'killer', 2: 'killer', 3: 'detective', 4: 'angel' }

function firstNight(n: number, roles: Record<number, Role>, options: Record<string, unknown> = {}): State {
  const night = skip(setRoles(start(n, options).state, roles))
  expect(night.phase).toBe('night')
  return night
}

/** Da manhã até a noite seguinte, sem ninguém sair na votação. */
function toNextNight(state: State): State {
  let next = state
  for (const phase of ['morning', 'day', 'vote', 'verdict']) {
    expect(next.phase).toBe(phase)
    next = skip(next)
  }
  return next
}

/** Sem o `private`: o que a TV e os celulares recebem como estado público. */
function publicPart(state: State): Partial<State> {
  const copy: Partial<State> = { ...state }
  delete copy.private
  return copy
}

/**
 * Papel no público só de quem já morreu (cemitério, manhã, veredito) — o
 * resto do estado público não pode ter papel nenhum antes do fim.
 */
function expectNoLeak(state: State) {
  const rest = publicPart(state)
  delete rest.graveyard
  delete rest.news
  delete rest.verdict
  expect(JSON.stringify(rest)).not.toMatch(/killer|detective|angel|citizen/)
  for (const grave of state.graveyard) expect(state.alive).not.toContain(grave.id)
  if (state.news?.role) expect(state.alive).not.toContain(state.news.killed)
  if (state.verdict?.role) expect(state.alive).not.toContain(state.verdict.out)
}

describe('início', () => {
  it('distribui os papéis pelo tamanho da mesa e os assassinos se conhecem', () => {
    const expected: Record<number, number> = { 5: 1, 7: 1, 8: 2, 11: 2, 12: 3, 15: 3 }
    for (const [n, killers] of Object.entries(expected)) {
      const { state } = start(Number(n))
      const roles = state.roster.map((id) => roleOf(state, id))
      expect(roles.filter((role) => role === 'killer')).toHaveLength(killers)
      expect(roles.filter((role) => role === 'detective')).toHaveLength(1)
      expect(roles.filter((role) => role === 'angel')).toHaveLength(1)
      expect(roles.filter((role) => role === 'citizen')).toHaveLength(Number(n) - killers - 2)
      const team = state.roster.filter((id) => roleOf(state, id) === 'killer')
      for (const id of state.roster) {
        expect(state.private[String(id)].team).toEqual(roleOf(state, id) === 'killer' ? team : undefined)
      }
    }
  })

  it('killerCount e roleCounts aguentam mesas fora do comum', () => {
    expect([0, 1, 5, 7, 8, 11, 12, 15].map(killerCount)).toEqual([0, 1, 1, 1, 2, 2, 3, 3])
    expect(roleCounts(1)).toEqual({ killer: 1, detective: 0, angel: 0, citizen: 0 })
    expect(roleCounts(3)).toEqual({ killer: 1, detective: 1, angel: 1, citizen: 0 })
    expect(roleCounts(0)).toEqual({ killer: 0, detective: 0, angel: 0, citizen: 0 })
  })

  it('mesa abaixo do mínimo (ou vazia) termina sem travar', () => {
    // 2 jogadores: 1 assassino contra 1 — os assassinos já empatam em número.
    const two = skip(start(2).state)
    expect(two.final).toMatchObject({ winner: 'killers', reason: 'outnumbered' })
    // Ninguém online no começo: sem assassino, a cidade "vence" na hora.
    const empty = engine.init(makeCtx({ players: makePlayers(3, { offline: [1, 2, 3] }), now: NOW }))
    expect(empty.roster).toEqual([])
    expect(skip(empty).final).toMatchObject({ winner: 'city' })
    // 3 jogadores ainda jogam (assassino, detetive e anjo).
    for (const seed of [1, 2, 3]) expect(runSimulation(engine, { players: 3, seed }).state.over).toBe(true)
  })

  it('abre com a fase dos papéis, prazo com folga e todo mundo vivo', () => {
    const { state } = start(6)
    expect(state.phase).toBe('roles')
    expect(state.inputKey).toBe('roles')
    expect(state.round).toBe(0)
    expect(state.deadline).toBe(NOW + ROLES_SECONDS * 1000 + GRACE_MS)
    expect(state.alive).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.over).toBe(false)
    expect(state.final).toBeNull()
  })

  it('o público não carrega nenhum papel — segredo só no private', () => {
    const { state } = start(15)
    expect(JSON.stringify(publicPart(state))).not.toMatch(/killer|detective|angel|citizen/)
  })

  it('roster é quem está online no começo', () => {
    const { state } = start(7, {}, { players: makePlayers(7, { offline: [2, 6] }) })
    expect(state.roster).toEqual([1, 3, 4, 5, 7])
    expect(Object.keys(state.private)).toEqual(['1', '3', '4', '5', '7'])
  })

  it('opções: conversa 2/3/4 min (padrão 3) e revelar papel (padrão sim)', () => {
    expect(start(6).state.dayMs).toBe(3 * 60_000)
    expect(start(6, { dayMinutes: 4 }).state.dayMs).toBe(4 * 60_000)
    expect(start(6, { dayMinutes: 9 }).state.dayMs).toBe(3 * 60_000)
    expect(start(6, { dayMinutes: '2' }).state.dayMs).toBe(3 * 60_000)
    expect(start(6, optionDefaults(meta.options)).state.dayMs).toBe(3 * 60_000)
    expect(start(6).state.revealRole).toBe(true)
    expect(start(6, { revealRole: false }).state.revealRole).toBe(false)
    expect(start(6, { revealRole: 'não' }).state.revealRole).toBe(true)
  })
})

describe('papéis → primeira noite', () => {
  it('todo mundo viu o papel: cai a noite 1 na hora', () => {
    const { state } = start(5)
    const ctx = answers(state, { 1: { ok: true }, 2: { ok: true }, 3: { ok: true } })
    const waiting = engine.step(state, ctx)
    expect(waiting.phase).toBe('roles')
    expect(waiting.acted).toEqual([1, 2, 3])
    expect(engine.step(waiting, ctx)).toBe(waiting)

    const night = engine.step(waiting, answers(state, { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }))
    expect(night.phase).toBe('night')
    expect(night.round).toBe(1)
    expect(night.inputKey).toBe('night-1')
    expect(night.deadline).toBe(NOW + 1000 + NIGHT_SECONDS * 1000 + GRACE_MS)
    expect(night.acted).toEqual([])
  })

  it('offline não segura e o prazo (com folga) também resolve', () => {
    const { state } = start(5)
    const offline = answers(state, { 1: {}, 2: {}, 3: {}, 4: {} }, { players: makePlayers(5, { offline: [5] }) })
    expect(engine.step(state, offline).phase).toBe('night')
    const late = makeCtx({ players: makePlayers(5), now: state.deadline! - 1 })
    expect(engine.step(state, late)).toBe(state)
    expect(engine.step(state, { ...late, now: state.deadline! }).phase).toBe('night')
  })
})

describe('noite', () => {
  it('os assassinos veem a escolha dos parceiros ao vivo — e só eles', () => {
    const night = firstNight(8, EIGHT)
    const one = answers(night, { 1: { target: 5 } })
    const seen = engine.step(night, one)
    expect(seen.private['1'].picks).toEqual({ 1: 5 })
    expect(seen.private['2'].picks).toEqual({ 1: 5 })
    expect(seen.private['3'].picks).toBeUndefined()
    expect(seen.acted).toEqual([1])
    expect(engine.step(seen, one)).toBe(seen)
    expect(JSON.stringify(publicPart(seen))).not.toContain('picks')

    const both = engine.step(seen, answers(night, { 1: { target: 5 }, 2: { target: 6 } }))
    expect(both.private['2'].picks).toEqual({ 1: 5, 2: 6 })
    // Mudou de ideia: vale a última escolha.
    const changed = engine.step(both, answers(night, { 1: { target: 6 }, 2: { target: 6 } }))
    expect(changed.private['1'].picks).toEqual({ 1: 6, 2: 6 })
  })

  it('morre o mais escolhido pelos assassinos; no empate, sorteia entre os empatados', () => {
    const night = firstNight(15, { 1: 'killer', 2: 'killer', 3: 'killer', 4: 'detective', 5: 'angel' })
    const majority = skip(night, { 1: { target: 9 }, 2: { target: 9 }, 3: { target: 10 } })
    expect(majority.news?.killed).toBe(9)
    expect(majority.alive).not.toContain(9)
    expect(majority.graveyard).toEqual([{ id: 9, round: 1, how: 'night', role: 'citizen' }])

    const victims = new Set<number>()
    for (let seed = 1; seed <= 24; seed += 1) {
      const ctx = answers(night, { 1: { target: 9 }, 2: { target: 10 } }, { command: skipCommand(), rng: seededRng(seed) })
      victims.add(engine.step(night, ctx).news!.killed!)
    }
    expect([...victims].sort((a, b) => a - b)).toEqual([9, 10])
  })

  it('o anjo salva a vítima: ninguém morre, a TV sabe que o anjo salvou e a vítima fica sabendo', () => {
    const night = firstNight(6, SIX)
    const morning = skip(night, { 1: { target: 4 }, 3: { target: 4 } })
    expect(morning.phase).toBe('morning')
    expect(morning.news).toMatchObject({ killed: null, saved: true, role: null })
    expect(morning.alive).toEqual([1, 2, 3, 4, 5, 6])
    expect(morning.graveyard).toEqual([])
    expect(morning.private['4'].savedAt).toBe(1)
    expect(morning.private['3'].guards).toEqual([{ round: 1, target: 4 }])
    expect(morning.private['1'].hits).toEqual([{ round: 1, target: 4 }])
  })

  it('o anjo pode se proteger, mas não repete a pessoa da noite anterior', () => {
    const night1 = firstNight(6, SIX)
    const morning1 = skip(night1, { 1: { target: 3 }, 3: { target: 3 } })
    expect(morning1.news?.saved).toBe(true)
    const night2 = toNextNight(morning1)
    expect(night2.round).toBe(2)
    expect(validNightTarget(night2, 3, 3)).toBeNull()
    expect(validNightTarget(night2, 3, 4)).toBe(4)
    // Insistiu em si mesmo: a proteção não vale e o assassino pega o anjo.
    const morning2 = skip(night2, { 1: { target: 3 }, 3: { target: 3 } })
    expect(morning2.news?.killed).toBe(3)
    expect(morning2.private['3'].guards).toEqual([{ round: 1, target: 3 }])
  })

  it('o detetive descobre em segredo se é assassino', () => {
    const night1 = firstNight(6, SIX)
    const morning1 = skip(night1, { 2: { target: 1 } })
    expect(morning1.private['2'].clues).toEqual([{ round: 1, target: 1, killer: true }])
    expect(JSON.stringify(publicPart(morning1))).not.toContain('clues')
    const morning2 = skip(toNextNight(morning1), { 2: { target: 5 } })
    expect(morning2.private['2'].clues).toEqual([
      { round: 1, target: 1, killer: true },
      { round: 2, target: 5, killer: false },
    ])
  })

  it('recados: da cidade para os assassinos (anônimos) e do assassino para a TV', () => {
    const night = firstNight(8, EIGHT)
    const morning = skip(night, {
      1: { target: 5, note: 'Durmam bem' },
      3: { target: 6, note: 'me poupa' },
      4: { target: 4, note: 'mata o Frank 😈' },
      6: { target: 1, note: '   ' },
    })
    expect(morning.news?.notes).toEqual(['Durmam bem'])
    expect(morning.news?.letters).toBe(2)
    for (const killer of ['1', '2']) {
      expect([...(morning.private[killer].inbox ?? [])].sort()).toEqual(['mata o Frank 😈', 'me poupa'].sort())
    }
    expect(morning.private['3'].inbox).toBeUndefined()
    // Quem mandou não aparece em lugar nenhum do público.
    expect(JSON.stringify(publicPart(morning))).not.toContain('me poupa')
  })

  it('recado vazio, gigante, com quebra de linha ou que não é texto', () => {
    expect(cleanNote('   ')).toBe('')
    expect(cleanNote(42)).toBe('')
    expect(cleanNote(null)).toBe('')
    expect(cleanNote('oi\n\ntudo\tbem?')).toBe('oi tudo bem?')
    expect(Array.from(cleanNote('🔪'.repeat(500)))).toHaveLength(NOTE_MAX)
    const night = firstNight(6, SIX)
    const morning = skip(night, { 1: { target: 4, note: 'A'.repeat(5000) } })
    expect(morning.news?.notes[0]).toHaveLength(NOTE_MAX)
  })

  it('cidadão aposta em quem é o assassino (faro) — escondido até o fim', () => {
    const night = firstNight(6, SIX)
    const morning = skip(night, { 4: { target: 1 }, 5: { target: 2 }, 6: { target: 6 } })
    expect(morning.private['4'].bets).toEqual([{ round: 1, target: 1 }])
    expect(morning.private['5'].bets).toEqual([{ round: 1, target: 2 }])
    expect(morning.private['6'].bets).toEqual([]) // apostar em si mesmo não vale
    expect(faroRanking(morning).map((entry) => [entry.id, entry.hits, entry.bets])).toEqual([
      [4, 1, 1],
      [5, 0, 1],
      [6, 0, 0],
    ])
  })

  it('entradas inválidas são ignoradas', () => {
    const night = firstNight(8, EIGHT)
    expect(validNightTarget(night, 1, 2)).toBeNull() // assassino não mata parceiro
    expect(validNightTarget(night, 1, 99)).toBeNull() // fora da sala
    expect(validNightTarget(night, 1, '5')).toBeNull() // lixo
    expect(validNightTarget(night, 3, 3)).toBeNull() // detetive em si mesmo
    expect(validNightTarget(night, 5, 5)).toBeNull() // cidadão em si mesmo
    expect(validNightTarget(night, 4, 4)).toBe(4) // anjo pode se proteger
    expect(validNightTarget(night, 99, 5)).toBeNull() // espectador
    const morning = skip(night, { 1: { target: 2 }, 2: { target: 'x' }, 9: { target: 5 } })
    expect(morning.news?.killed).toBeNull()
    expect(morning.alive).toHaveLength(8)
  })

  it('assassinos não escolheram ninguém: noite tranquila', () => {
    const night = firstNight(6, SIX)
    const morning = skip(night, { 2: { target: 4 } })
    expect(morning.news).toMatchObject({ killed: null, saved: false, notes: [], letters: 0 })
    expect(morning.timeline).toEqual([{ round: 1, killed: null, saved: false, voted: false, out: null }])
  })

  it('acaba quando todos os vivos online agiram — offline e fantasma não seguram', () => {
    const night1 = firstNight(6, SIX)
    const morning1 = skip(night1, { 1: { target: 6 } })
    expect(morning1.news?.killed).toBe(6)
    const night2 = toNextNight(morning1)
    const all = { 1: { target: 4 }, 2: { target: 4 }, 3: { target: 5 }, 4: { target: 1 }, 5: { target: 1 } }
    const done = engine.step(night2, answers(night2, all))
    expect(done.phase).toBe('morning')

    const missing = { ...all } as Record<number, Record<string, unknown>>
    delete missing[5]
    expect(engine.step(night2, answers(night2, missing)).phase).toBe('night')
    const offline = answers(night2, missing, { players: makePlayers(6, { offline: [5] }) })
    expect(engine.step(night2, offline).phase).toBe('morning')
    // Prazo: espera até a folga acabar.
    const late = answers(night2, missing, { now: night2.deadline! - 1 })
    expect(engine.step(night2, late).phase).toBe('night')
    expect(engine.step(night2, { ...late, now: night2.deadline! }).phase).toBe('morning')
  })

  it('fantasmas assombram alguém (só aparece na TV) e não matam ninguém', () => {
    const night1 = firstNight(6, SIX)
    const morning1 = skip(night1, { 1: { target: 6 } })
    expect(morning1.graveyard.map((grave) => grave.id)).toEqual([6])
    const night2 = toNextNight(morning1)
    const ghostActs = engine.step(night2, answers(night2, { 6: { target: 2 } }))
    expect(ghostActs.acted).toEqual([6])
    const morning2 = skip(night2, { 6: { target: 2, note: 'buuu' } })
    expect(morning2.news?.haunts).toEqual([{ id: 2, count: 1 }])
    expect(morning2.news?.killed).toBeNull()
    expect(morning2.news?.letters).toBe(0) // fantasma não manda recado
  })

  it('morto não age como vivo: assassino morto não mata', () => {
    const night1 = firstNight(8, EIGHT)
    // Dia 1: a cidade expulsa o assassino 2.
    let state = skip(skip(skip(night1)))
    expect(state.phase).toBe('vote')
    state = skip(state, { 3: { vote: 2 }, 4: { vote: 2 }, 5: { vote: 2 } })
    expect(state.verdict?.out).toBe(2)
    state = skip(state)
    expect(state.phase).toBe('night')
    const morning = skip(state, { 2: { target: 5 } })
    expect(morning.news?.killed).toBeNull()
    expect(morning.news?.haunts).toEqual([{ id: 5, count: 1 }])
  })
})

describe('manhã e dia', () => {
  it('a manhã dura mais com morte e bilhete, e vira dia no prazo', () => {
    const night = firstNight(6, SIX)
    const quiet = skip(night)
    expect(quiet.deadline).toBe(NOW + 1000 + MORNING_SECONDS * 1000)
    const dramatic = skip(night, { 1: { target: 4, note: 'Quem será o próximo?' } })
    expect(dramatic.deadline).toBe(
      NOW + 1000 + (MORNING_SECONDS + MORNING_DEATH_SECONDS + noteSeconds('Quem será o próximo?')) * 1000,
    )
    expect(engine.step(dramatic, makeCtx({ players: makePlayers(6), now: dramatic.deadline! - 1 }))).toBe(dramatic)
    const day = engine.step(dramatic, makeCtx({ players: makePlayers(6), now: dramatic.deadline! }))
    expect(day.phase).toBe('day')
    expect(day.inputKey).toBe('day-1')
    expect(day.deadline).toBe(dramatic.deadline! + 3 * 60_000)
  })

  it('a manhã dá tempo de a TV ler em voz alta bilhetes longos e as assombrações (com teto)', () => {
    const base: News = { round: 1, killed: 4, role: 'citizen', saved: false, epitaph: 'x', notes: [], haunts: [], letters: 0 }
    const long = 'Vocês nunca vão me pegar, eu durmo do lado de vocês e ronco alto toda noite 😈'
    const short = 'Oi'
    // Bilhete longo pede mais tempo que bilhete curto: a voz lenta lê ~13 letras por segundo.
    expect(noteSeconds(long)).toBeGreaterThanOrEqual(3 + Math.ceil(Array.from(long).length / 13))
    expect(noteSeconds(long)).toBeGreaterThan(noteSeconds(short))
    expect(morningSeconds({ ...base, notes: [long] })).toBe(morningSeconds(base) + noteSeconds(long))
    // Assombrações também são lidas (a voz cita até 3 nomes).
    const haunts = [1, 2, 3, 5, 6].map((id) => ({ id, count: 1 }))
    expect(morningSeconds({ ...base, haunts })).toBeGreaterThan(morningSeconds(base))
    // Três bilhetes enormes + cinco assombrações: longo, mas com teto.
    const maxed = { ...base, notes: [long, long, long], haunts }
    expect(morningSeconds(maxed)).toBe(MORNING_MAX_SECONDS)
    // A narração cita no máximo 3 assombrados (e quantos mais).
    const morning = skip(firstNight(6, SIX), { 1: { target: 4 } })
    const text = narration({ ...morning, news: { ...morning.news!, haunts } }, makePlayers(6))
    expect(text).toContain('Os fantasmas assombraram Vlad, Mortícia, Gasparzinho e mais 2.')
  })

  it('dia: "pronto para votar" de todos os vivos online abre a votação; fantasma não conta', () => {
    const morning = skip(firstNight(6, SIX), { 1: { target: 6 } })
    const day = skip(morning)
    const ready = { 1: { ready: true }, 2: { ready: true }, 3: { ready: true }, 4: { ready: true } }
    const waiting = engine.step(day, answers(day, { ...ready, 6: { ready: true } }))
    expect(waiting.phase).toBe('day')
    expect(waiting.acted).toEqual([1, 2, 3, 4])
    const vote = engine.step(waiting, answers(day, { ...ready, 5: { ready: true } }))
    expect(vote.phase).toBe('vote')
    expect(vote.inputKey).toBe('vote-1')
    expect(vote.deadline).toBe(NOW + 1000 + VOTE_SECONDS * 1000 + GRACE_MS)
    expect(vote.votes).toEqual({})
  })
})

describe('votação', () => {
  /** Até a votação do dia 1, sem ninguém morrer à noite. */
  function voteDay(n: number, roles: Record<number, Role>, options: Record<string, unknown> = {}) {
    const vote = skip(skip(skip(firstNight(n, roles, options))))
    expect(vote.phase).toBe('vote')
    return vote
  }

  it('votos aparecem ao vivo, o mais recente vale e nada muda sem voto novo', () => {
    const vote = voteDay(6, SIX)
    const ctx = answers(vote, { 2: { vote: 1 }, 3: { vote: null } })
    const live = engine.step(vote, ctx)
    expect(live.votes).toEqual({ 2: 1, 3: null })
    expect(live.acted).toEqual([2, 3])
    expect(engine.step(live, ctx)).toBe(live)
    const changed = engine.step(live, answers(vote, { 2: { vote: 4 }, 3: { vote: null } }))
    expect(changed.votes).toEqual({ 2: 4, 3: null })
  })

  it('sai o mais votado com 2+ votos e sem empate (com o papel revelado)', () => {
    const vote = voteDay(6, SIX)
    const verdict = skip(vote, { 2: { vote: 1 }, 3: { vote: 1 }, 4: { vote: 5 }, 5: { vote: null } })
    expect(verdict.phase).toBe('verdict')
    expect(verdict.deadline).toBe(NOW + 1000 + VERDICT_SECONDS * 1000)
    expect(verdict.verdict).toMatchObject({ out: 1, role: 'killer', reason: 'out', abstain: 1 })
    expect(verdict.verdict?.tally[0]).toEqual({ id: 1, count: 2, voters: [2, 3] })
    expect(verdict.alive).not.toContain(1)
    expect(verdict.timeline).toEqual([{ round: 1, killed: null, saved: false, voted: true, out: 1 }])
  })

  it('empate, voto único ou ninguém votando: ninguém sai', () => {
    const vote = voteDay(6, SIX)
    const tie = skip(vote, { 1: { vote: 4 }, 2: { vote: 4 }, 3: { vote: 5 }, 4: { vote: 5 } })
    expect(tie.verdict).toMatchObject({ out: null, reason: 'tie' })
    expect(tie.alive).toHaveLength(6)
    const few = skip(vote, { 1: { vote: 4 }, 2: { vote: 5 } })
    expect(few.verdict).toMatchObject({ out: null, reason: 'few' })
    const none = skip(vote)
    expect(none.verdict).toMatchObject({ out: null, reason: 'none', abstain: 0 })
  })

  it('"🤷 Ninguém sai" também concorre: se empata ou vence o mais votado, ninguém sai', () => {
    const vote = voteDay(8, EIGHT)
    // 2 votos no 5 contra 3 em "ninguém sai": a cidade preferiu não expulsar.
    const skipped = skip(vote, { 1: { vote: 5 }, 2: { vote: 5 }, 3: { vote: null }, 4: { vote: null }, 6: { vote: null } })
    expect(skipped.verdict).toMatchObject({ out: null, reason: 'skip', abstain: 3 })
    expect(skipped.alive).toContain(5)
    // Empate com o "ninguém sai": ninguém sai.
    const even = skip(vote, { 1: { vote: 5 }, 2: { vote: 5 }, 3: { vote: null }, 4: { vote: null } })
    expect(even.verdict).toMatchObject({ out: null, reason: 'skip' })
    // Mais votos que o "ninguém sai": sai.
    const out = skip(vote, { 1: { vote: 5 }, 2: { vote: 5 }, 3: { vote: 5 }, 4: { vote: null }, 6: { vote: null } })
    expect(out.verdict).toMatchObject({ out: 5, reason: 'out', abstain: 2 })
    // A TV usa a mesma conta para marcar quem está saindo ao vivo.
    expect(voteOutcome({ 1: 5, 2: 5, 3: null, 4: null, 6: null })).toMatchObject({ out: null, reason: 'skip' })
    expect(voteOutcome({ 1: 5, 2: 5, 3: 5, 4: null })).toMatchObject({ out: 5, reason: 'out', abstain: 1 })
    expect(voteOutcome({})).toMatchObject({ out: null, reason: 'none', abstain: 0 })
  })

  it('todo mundo votou em "ninguém sai": a TV não diz que ninguém votou', () => {
    const vote = voteDay(6, SIX)
    const all = skip(vote, { 1: { vote: null }, 2: { vote: null }, 3: { vote: null } })
    expect(all.verdict).toMatchObject({ out: null, reason: 'skip', abstain: 3 })
    expect(narration(all, makePlayers(6))).not.toMatch(/Ninguém votou/)
    expect(narration(all, makePlayers(6))).toBe(NOBODY_OUT.skip)
  })

  it('ignora voto em si mesmo, em morto, de morto, fora da sala e lixo', () => {
    const morning = skip(firstNight(6, SIX), { 1: { target: 6 } })
    const vote = skip(skip(morning))
    expect(vote.phase).toBe('vote')
    const verdict = skip(vote, {
      1: { vote: 1 }, // em si mesmo
      2: { vote: 6 }, // em morto
      6: { vote: 2 }, // de morto
      3: { vote: 99 }, // fora da sala
      4: { vote: '5' }, // lixo
      5: { nada: true }, // sem voto
    })
    expect(verdict.votes).toEqual({})
    expect(verdict.verdict).toMatchObject({ out: null, reason: 'none' })
  })

  it('revelar papel desligado: quem sai fica no mistério — até a partida acabar', () => {
    const vote = voteDay(8, EIGHT, { revealRole: false })
    const innocent = skip(vote, { 1: { vote: 5 }, 2: { vote: 5 }, 3: { vote: 5 } })
    expect(innocent.verdict).toMatchObject({ out: 5, role: null })
    expect(innocent.graveyard).toEqual([{ id: 5, round: 1, how: 'vote', role: null }])
    // A noite 2 com papel escondido também não revela.
    const morning2 = skip(skip(innocent), { 1: { target: 6 } })
    expect(morning2.news).toMatchObject({ killed: 6, role: null })
  })

  it('revelar papel desligado, mas a votação acabou com a partida: revela', () => {
    const vote = voteDay(6, SIX, { revealRole: false })
    const verdict = skip(vote, { 2: { vote: 1 }, 3: { vote: 1 } })
    expect(verdict.verdict).toMatchObject({ out: 1, role: 'killer' })
  })
})

describe('vitória e fim', () => {
  it('a cidade vence quando o último assassino sai', () => {
    const vote = skip(skip(skip(firstNight(6, SIX))))
    const verdict = skip(vote, { 2: { vote: 1 }, 3: { vote: 1 }, 4: { vote: 1 } })
    expect(winnerOf(verdict)).toBe('city')
    const end = skip(verdict)
    expect(end.phase).toBe('end')
    expect(end.over).toBe(true)
    expect(end.deadline).toBeNull()
    expect(end.final).toMatchObject({ winner: 'city', reason: 'caught' })
    expect(end.final?.roles).toEqual({ 1: 'killer', 2: 'detective', 3: 'angel', 4: 'citizen', 5: 'citizen', 6: 'citizen' })
    expect(engine.step(end, answers(end, {}, { now: NOW * 3, command: skipCommand() }))).toBe(end)
  })

  it('os assassinos vencem quando ficam em igual número com os outros (5 jogadores)', () => {
    const roles: Record<number, Role> = { 1: 'killer', 2: 'detective', 3: 'angel' }
    let state = skip(firstNight(5, roles), { 1: { target: 2 } }) // morre o detetive
    expect(state.alive).toEqual([1, 3, 4, 5])
    state = skip(skip(state))
    state = skip(state, { 1: { vote: 4 }, 3: { vote: 4 }, 5: { vote: 4 } }) // a cidade erra
    expect(state.verdict?.out).toBe(4)
    expect(winnerOf(state)).toBeNull()
    state = skip(state) // noite 2
    state = skip(state, { 1: { target: 5 } })
    expect(state.phase).toBe('morning')
    expect(state.news?.role).toBe('citizen') // a última morte revela o papel
    const end = skip(state)
    expect(end.final).toMatchObject({ winner: 'killers', reason: 'outnumbered' })
    // Acabou de manhã: o dia 2 não teve votação (a TV não diz "ninguém saiu").
    expect(end.final?.nights.map((night) => night.voted)).toEqual([true, false])
  })

  it('depois da 10ª noite sem desfecho, os assassinos fogem', () => {
    let state = firstNight(6, SIX)
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      expect(state.round).toBe(round)
      state = skip(skip(skip(skip(skip(state)))))
    }
    expect(state.phase).toBe('end')
    expect(state.final).toMatchObject({ winner: 'killers', reason: 'escaped' })
    expect(state.final?.nights).toHaveLength(MAX_ROUNDS)
  })

  it('fim: linha do tempo com os segredos de cada noite e ranking de faro', () => {
    let state = firstNight(6, SIX)
    // Noite 1: assassino em 4, anjo salva o 4, detetive olha o 1, cidadãos apostam.
    state = skip(state, { 1: { target: 4 }, 2: { target: 1 }, 3: { target: 4 }, 4: { target: 1 }, 5: { target: 2 } })
    state = skip(skip(state))
    state = skip(state, { 2: { vote: 5 }, 3: { vote: 5 } }) // 5 sai
    state = skip(state)
    // Noite 2: assassino em 6, anjo no 2, detetive no 6, cidadão 4 aposta no 1 de novo.
    state = skip(state, { 1: { target: 6 }, 2: { target: 6 }, 3: { target: 2 }, 4: { target: 1 } })
    expect(state.news?.killed).toBe(6)
    state = skip(skip(state))
    state = skip(state, { 2: { vote: 1 }, 3: { vote: 1 }, 4: { vote: 1 } })
    const end = skip(state)
    expect(end.final?.winner).toBe('city')
    expect(end.final?.nights).toEqual([
      { round: 1, killed: null, saved: true, voted: true, out: 5, target: 4, guard: 4, clue: { target: 1, killer: true } },
      { round: 2, killed: 6, saved: false, voted: true, out: 1, target: 6, guard: 2, clue: { target: 6, killer: false } },
    ])
    expect(end.final?.faro).toEqual([
      { id: 4, hits: 2, bets: 2 },
      { id: 5, hits: 0, bets: 1 },
      { id: 6, hits: 0, bets: 0 },
    ])
  })
})

describe('host e idempotência', () => {
  it('"Pular" passa por todas as fases', () => {
    let state = setRoles(start(6).state, SIX)
    const seen: string[] = [state.phase]
    for (let i = 0; i < 6; i += 1) {
      state = skip(state)
      seen.push(state.phase)
    }
    expect(seen).toEqual(['roles', 'night', 'morning', 'day', 'vote', 'verdict', 'night'])
    expect(state.round).toBe(2)
  })

  it('comando desconhecido e respostas de outra fase não mudam nada', () => {
    const night = firstNight(6, SIX)
    const ctx = makeCtx({
      players: makePlayers(6),
      now: NOW + 10,
      command: { id: ++commandId, type: 'reveal-now' },
      inputs: { 1: { k: 'night-0', target: 4 }, 2: { k: 'roles', ok: true } },
    })
    expect(engine.step(night, ctx)).toBe(night)
  })

  it('fases sem resposta esperam o prazo devolvendo o mesmo estado', () => {
    const morning = skip(firstNight(6, SIX), { 1: { target: 4 } })
    const ctx = makeCtx({ players: makePlayers(6), now: morning.deadline! - 1 })
    expect(engine.step(morning, ctx)).toBe(morning)
    const verdict = skip(skip(skip(morning)))
    expect(verdict.phase).toBe('verdict')
    expect(engine.step(verdict, { ...ctx, now: verdict.deadline! - 1 })).toBe(verdict)
  })
})

describe('bot', () => {
  it('responde só o que vale para o papel e a fase', () => {
    const night = firstNight(8, EIGHT)
    const ctx = makeCtx({ players: makePlayers(8) })
    for (let i = 0; i < 40; i += 1) {
      for (const id of night.roster) {
        const reply = engine.bot(night, id, ctx)
        expect(validNightTarget(night, id, reply?.target)).toBe(reply?.target)
        if (reply && 'note' in reply) expect([...CITY_NOTES, ...KILLER_NOTES]).toContain(reply.note)
      }
    }
    expect(engine.bot(night, 99, ctx)).toBeNull()
    const vote = { ...night, phase: 'vote' as const, inputKey: 'vote-1' }
    for (let i = 0; i < 40; i += 1) {
      const reply = engine.bot(vote, 5, ctx)
      expect(reply?.vote === null || (vote.alive.includes(reply?.vote as number) && reply?.vote !== 5)).toBe(true)
    }
    expect(engine.bot({ ...night, phase: 'morning' }, 1, ctx)).toBeNull()
    expect(engine.bot({ ...night, alive: [1, 2, 3, 4, 5, 6, 7], phase: 'vote' }, 8, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [5, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed })
        expect(result.state.over).toBe(true)
        expect(result.state.final).not.toBeNull()
        const final = result.state.final!
        expect(Object.keys(final.roles)).toHaveLength(players)
        // O vencedor bate com quem sobrou vivo.
        if (final.reason !== 'escaped') expect(winnerOf(result.state)).toBe(final.winner)
        // O público nunca carregou papel de vivo antes do fim.
        for (const state of result.history) if (!state.over) expectNoLeak(state)
      })
    }
  }

  it('as duas vitórias acontecem (a mesa não está viciada)', () => {
    const winners = new Set<string>()
    for (let seed = 1; seed <= 20; seed += 1) {
      winners.add(runSimulation(engine, { players: 8, seed }).state.final!.winner)
    }
    expect([...winners].sort()).toEqual(['city', 'killers'])
  })

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem responder', () => {
    for (const seed of [5, 6]) {
      const result = runSimulation(engine, { players: 9, actProbability: 0.05, seed })
      expect(result.state.over).toBe(true)
    }
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 12, skipProbability: 0.3, actProbability: 0.3, seed: 8 })
    expect(result.state.over).toBe(true)
  })

  it('ninguém nunca responde: termina pelos prazos (os assassinos fogem)', () => {
    const result = runSimulation(engine, { players: 6, actProbability: 0, options: { dayMinutes: 2 } })
    expect(result.state.final).toMatchObject({ winner: 'killers', reason: 'escaped' })
    expect(result.state.round).toBe(MAX_ROUNDS)
  })

  it('opções diferentes (conversa de 4 min, papel escondido)', () => {
    const result = runSimulation(engine, { players: 11, seed: 9, options: { dayMinutes: 4, revealRole: false } })
    expect(result.state.over).toBe(true)
    // Com papel escondido, só a última saída revela.
    const hidden = result.state.graveyard.slice(0, -1)
    expect(hidden.every((grave) => grave.role === null)).toBe(true)
  })
})

describe('narração', () => {
  const players = makePlayers(6)

  it('manhã com morte, papel, bilhete e assombração', () => {
    const morning = skip(firstNight(6, SIX), { 1: { target: 4, note: 'Quem será o próximo? 😈' } })
    const text = narration(morning, players)
    expect(text).toContain(`A vítima desta noite foi ${players[3].name}.`)
    expect(text).toContain('Era um cidadão.')
    expect(text).toContain('Um bilhete foi encontrado: Quem será o próximo?')
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(tvCue(morning, players)).toMatchObject({ moment: '1-morning', stinger: 'death', scare: null })
  })

  it('anjo salvou, noite tranquila e veredito com zoom no assassino pego', () => {
    const night = firstNight(6, SIX)
    expect(tvCue(night, players).speech).toBe(NIGHT_LINES[0])
    const saved = skip(night, { 1: { target: 4 }, 3: { target: 4 } })
    expect(tvCue(saved, players).stinger).toBe('saved')
    const vote = skip(skip(skip(night)))
    const caught = skip(vote, { 2: { vote: 1 }, 3: { vote: 1 } })
    const cue = tvCue(caught, players)
    expect(cue.stinger).toBe('caught')
    expect(cue.scare).toMatchObject({ kind: 'zoom', name: players[0].name })
    expect(cue.speech).toBe(`A cidade expulsou ${players[0].name}. Era assassino!`)
    const end = skip(caught)
    expect(tvCue(end, players)).toMatchObject({ moment: '1-end', stinger: 'city', scare: null })
    // "Encerrar" do host: over sem final.
    expect(tvCue({ ...vote, over: true }, players).stinger).toBe('ended')
  })

  it('speakable tira emoji e espaço sobrando', () => {
    expect(speakable('Me poupa 🙏 , por favor 👻')).toBe('Me poupa, por favor')
  })
})

describe('conteúdo', () => {
  it('papéis completos, epitáfios e recados no tamanho certo', () => {
    for (const info of Object.values(ROLE_INFO)) {
      expect(info.name.length).toBeGreaterThan(2)
      expect(info.mission.split(/\s+/).length).toBeLessThanOrEqual(18)
      expect(info.night.length).toBeGreaterThan(5)
    }
    expect(EPITAPHS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(EPITAPHS).size).toBe(EPITAPHS.length)
    for (const epitaph of EPITAPHS) expect(epitaph.length).toBeLessThanOrEqual(45)
    for (const note of [...CITY_NOTES, ...KILLER_NOTES]) expect(cleanNote(note)).toBe(note)
    expect(NIGHT_LINES.length).toBeGreaterThanOrEqual(6)
  })
})

