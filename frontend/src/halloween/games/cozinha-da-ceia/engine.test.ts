import { describe, expect, it } from 'vitest'
import { optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { DISHES, PAVE_INDEX, STATIONS, type Station } from './content'
import {
  AFTER_ORDER_GAP_MS,
  BURN_MS,
  COOK_MS,
  EARLY_TAKE_MS,
  LATE_MS,
  MISS_PENALTY,
  TALLY_SECONDS,
  awards,
  championTeam,
  engine,
  maxOpenOrders,
  orderReady,
  patienceOf,
  seatTeam,
  splitTeams,
  tipFor,
  type CozinhaState,
  type Item,
  type Order,
} from './engine'
import { meta } from './meta'

const T0 = 1_000_000

function ctxFor(players: number, now: number, inputs: Record<number, HInput | undefined> = {}, extra: Partial<EngineCtx> = {}): EngineCtx {
  return makeCtx({ players: makePlayers(players), now, inputs, rng: seededRng(5), ...extra })
}

/** Partida em `cook`, logo na largada. */
function cooking(players = 4, options: Record<string, unknown> = {}): CozinhaState {
  const init = engine.init(ctxFor(players, T0, {}, { options }))
  const next = engine.step(init, ctxFor(players, init.deadline!, {}, { options }))
  expect(next.phase).toBe('cook')
  return next
}

/** Troca a cozinha do time 0 por uma montada à mão. */
function withKitchen(state: CozinhaState, orders: Order[], items: Item[], team = 0): CozinhaState {
  const kitchens = state.kitchens.map((kitchen, index) =>
    index === team ? { ...kitchen, orders, items, nextAt: Number.MAX_SAFE_INTEGER } : { ...kitchen, nextAt: Number.MAX_SAFE_INTEGER },
  )
  return { ...state, kitchens }
}

function order(id: number, d: number, born: number, extra: Partial<Order> = {}): Order {
  return { id, d, born, exp: born + 60_000, pts: DISHES[d].points, vip: false, taps: 0, ...extra }
}

function item(id: number, o: number, d: number, st: Station, extra: Partial<Item> = {}): Item {
  const heat = st === 'fogao' || st === 'forno'
  return { id, o, d, c: 0, s: 0, st, ph: heat ? 'queue' : 'prep', taps: 0, t0: 0, end: 0, by: null, pick: false, ...extra }
}

const dishIndex = (id: string) => DISHES.findIndex((dish) => dish.id === id)
const RABANADA = dishIndex('rabanada')
const LENTILHA = dishIndex('lentilha')
const PERU = dishIndex('peru')

/** Um jogador do time 0. */
function memberOf(state: CozinhaState, team = 0): number {
  return state.teams[team].players[0]
}

function acts(state: CozinhaState, list: { n: number; a: string; i: number; at?: number }[], key = state.inputKey): HInput {
  return { k: key, acts: list }
}

describe('times e estações', () => {
  it.each(Array.from({ length: 14 }, (_, index) => index + 2))('divide %i pessoas', (n) => {
    const roster = Array.from({ length: n }, (_, index) => index + 1)
    const teams = splitTeams(roster, seededRng(n))
    if (n <= 3) {
      expect(teams).toEqual([roster])
    } else {
      expect(teams).toHaveLength(2)
      expect(Math.abs(teams[0].length - teams[1].length)).toBeLessThanOrEqual(1)
      expect([...teams[0], ...teams[1]].sort((a, b) => a - b)).toEqual(roster)
    }
    // O engine monta os mesmos times, com o time menor um pouco mais paciente.
    const state = engine.init(ctxFor(n, T0))
    expect(state.solo).toBe(n <= 3)
    expect(state.teams.flatMap((team) => team.players).sort((a, b) => a - b)).toEqual(roster)
    for (const id of roster) expect(state.teamOf[String(id)]).toBeTypeOf('number')
    if (!state.solo && state.teams[0].players.length !== state.teams[1].players.length) {
      const [small, big] = [...state.teams].sort((a, b) => a.players.length - b.players.length)
      expect(small.slack).toBeGreaterThan(1)
      expect(big.slack).toBe(1)
    }
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('time de %i cobre as cinco estações', (n) => {
    const players = Array.from({ length: n }, (_, index) => index + 10)
    for (const round of [1, 2, 3]) {
      const seat = seatTeam(players, round)
      for (const id of players) expect(seat[String(id)].length).toBeGreaterThanOrEqual(1)
      for (const st of STATIONS) expect(players.some((id) => seat[String(id)].includes(st))).toBe(true)
      const total = players.reduce((sum, id) => sum + seat[String(id)].length, 0)
      expect(total).toBe(Math.max(5, n))
    }
    // Gira a cada rodada.
    if (n > 1) expect(seatTeam(players, 1)[String(players[0])]).not.toEqual(seatTeam(players, 2)[String(players[0])])
  })

  it('fogão e forno ganham lugar com reforço; quem está offline não ganha estação', () => {
    const state = engine.init(ctxFor(15, T0))
    // 15 → times de 8 e 7: 3 e 2 de reforço → fogão com 2 pessoas.
    expect(state.capacity[0].fogao).toBe(3)
    const offline = engine.init(makeCtx({ players: makePlayers(6, { offline: [] }), now: T0, rng: seededRng(2) }))
    const gone = offline.teams[0].players[0]
    const players = makePlayers(6, { offline: [gone] })
    const tally: CozinhaState = { ...offline, phase: 'tally', deadline: T0, history: [] }
    const prep = engine.step(tally, makeCtx({ players, now: T0 + 1, rng: seededRng(2) }))
    expect(prep.phase).toBe('prep')
    expect(prep.seat[String(gone)]).toBeUndefined()
  })
})

describe('pré-rodada', () => {
  it('começa a cozinha quando todo mundo aperta "pronto" (ou no prazo)', () => {
    const init = engine.init(ctxFor(4, T0))
    expect(init.phase).toBe('prep')
    expect(init.event).toBeNull()
    const some = engine.step(init, ctxFor(4, T0 + 1000, { 1: { k: init.inputKey, ready: true } }))
    expect(some.phase).toBe('prep')
    expect(some.acted).toEqual([1])
    const all = Object.fromEntries([1, 2, 3, 4].map((id) => [id, { k: init.inputKey, ready: true }]))
    const go = engine.step(some, ctxFor(4, T0 + 2000, all))
    expect(go.phase).toBe('cook')
    expect(go.deadline).toBe(T0 + 2000 + 3 * 60_000)
    // Um pedido para cada time logo na largada.
    expect(go.kitchens.map((kitchen) => kitchen.orders.length)).toEqual([1, 1])
    // Os dois times recebem o mesmo prato.
    expect(go.kitchens[0].orders[0].d).toBe(go.kitchens[1].orders[0].d)
  })
})

describe('toques rápidos (a fila numerada)', () => {
  it('cada toque vale exatamente uma vez, mesmo repetido no pacote', () => {
    const base = cooking(4)
    const p = memberOf(base)
    let state = withKitchen(base, [order(900, RABANADA, T0)], [item(901, 900, RABANADA, 'tabua')])
    const now = state.cookStart + 1000
    // Dois toques chegando juntos.
    state = engine.step(state, ctxFor(4, now, { [p]: acts(state, [{ n: 1, a: 'tap', i: 901 }, { n: 2, a: 'tap', i: 901 }]) }))
    expect(state.kitchens[0].items[0].taps).toBe(2)
    expect(state.seen[String(p)]).toBe(2)
    // O mesmo pacote de novo (o poll seguinte): nada muda, mesmo objeto.
    const again = engine.step(state, ctxFor(4, now + 400, { [p]: acts(state, [{ n: 1, a: 'tap', i: 901 }, { n: 2, a: 'tap', i: 901 }], 'ck-1-0') }))
    expect(again).toBe(state)
    // Pacote com o 1, o 2 e o 3 (o celular ainda não viu o juiz): só o 3 conta.
    const third = engine.step(again, ctxFor(4, now + 800, { [p]: acts(state, [1, 2, 3].map((n) => ({ n, a: 'tap', i: 901 })), 'ck-1-0') }))
    expect(third.seen[String(p)]).toBe(3)
    // 3 toques na tábua: o pão vai para o fogão.
    const bread = third.kitchens[0].items[0]
    expect(bread).toMatchObject({ st: 'fogao', ph: 'queue', taps: 0, s: 1 })
    expect(third.stats[String(p)].prep).toBe(3)
    expect(third.inputKey).not.toBe(state.inputKey)
    // Toque a mais (sobrou na fila) não estraga nada.
    const extra = engine.step(third, ctxFor(4, now + 1200, { [p]: acts(third, [{ n: 4, a: 'tap', i: 901 }]) }))
    expect(extra.kitchens[0].items[0]).toMatchObject({ st: 'fogao', ph: 'queue' })
    expect(extra.seen[String(p)]).toBe(4)
  })

  it('aceita chave velha da mesma rodada e ignora outra rodada ou outro time', () => {
    const base = cooking(4)
    const p = memberOf(base)
    const rival = base.teams[1].players[0]
    const state = withKitchen(base, [order(900, RABANADA, T0)], [item(901, 900, RABANADA, 'tabua')])
    const now = state.cookStart + 1000
    const stale = engine.step(state, ctxFor(4, now, { [p]: { k: 'ck-1-0', acts: [{ n: 1, a: 'tap', i: 901 }] } }))
    expect(stale.kitchens[0].items[0].taps).toBe(1)
    const otherRound = engine.step(state, ctxFor(4, now, { [p]: { k: 'ck-2-5', acts: [{ n: 1, a: 'tap', i: 901 }] } }))
    expect(otherRound).toBe(state)
    // O rival toca no item da nossa cozinha: o número é consumido, mas nada acontece aqui.
    const sabotage = engine.step(state, ctxFor(4, now, { [rival]: { k: state.inputKey, acts: [{ n: 1, a: 'tap', i: 901 }] } }))
    expect(sabotage.kitchens[0].items[0].taps).toBe(0)
    // Lixo no pacote não derruba o motor.
    const junk = engine.step(state, ctxFor(4, now, { [p]: { k: state.inputKey, acts: [null, 'x', { n: 'a' }, { n: 1, a: 'voar', i: 1 }] } }))
    expect(junk).toBe(state)
  })

  it('dois do mesmo time tocando o mesmo item somam os toques', () => {
    const base = cooking(8)
    const [a, b] = base.teams[0].players
    const state = withKitchen(base, [order(900, RABANADA, T0)], [item(901, 900, RABANADA, 'tabua')])
    const now = state.cookStart + 1000
    const next = engine.step(state, ctxFor(8, now, {
      [a]: acts(state, [{ n: 1, a: 'tap', i: 901 }, { n: 2, a: 'tap', i: 901 }]),
      [b]: acts(state, [{ n: 1, a: 'tap', i: 901 }]),
    }))
    expect(next.kitchens[0].items[0]).toMatchObject({ st: 'fogao', ph: 'queue' })
  })
})

describe('fogo: pronto, tirar e queimar', () => {
  function onStove(at: number) {
    const base = cooking(4)
    const p = memberOf(base)
    const state = withKitchen(base, [order(900, LENTILHA, T0, { exp: at + 600_000 })], [item(901, 900, LENTILHA, 'fogao')])
    const lit = engine.step(state, ctxFor(4, at, { [p]: acts(state, [{ n: 1, a: 'cook', i: 901, at }]) }))
    const pan = lit.kitchens[0].items[0]
    expect(pan).toMatchObject({ ph: 'cook', t0: at, end: at + COOK_MS.fogao, by: p })
    return { state: lit, p, end: pan.end }
  }

  it('tirar cedo demais não vale; nos 3 s finais sai sozinho quando fica pronto', () => {
    const at = cooking(4).cookStart + 1000
    const { state, p, end } = onStove(at)
    const early = engine.step(state, ctxFor(4, end - EARLY_TAKE_MS - 1000, { [p]: acts(state, [{ n: 2, a: 'take', i: 901, at: end - EARLY_TAKE_MS - 1000 }]) }))
    expect(early.kitchens[0].items[0]).toMatchObject({ ph: 'cook', pick: false })
    const soon = engine.step(early, ctxFor(4, end - 1000, { [p]: acts(early, [{ n: 3, a: 'take', i: 901, at: end - 1000 }]) }))
    expect(soon.kitchens[0].items[0]).toMatchObject({ ph: 'cook', pick: true })
    const ready = engine.step(soon, ctxFor(4, end))
    // Lentilha: um passo só — vai pronta para o balcão.
    expect(ready.kitchens[0].items[0]).toMatchObject({ ph: 'done', st: 'balcao' })
    expect(orderReady(ready.kitchens[0], 900)).toBe(true)
  })

  it('esquecida no fogo: queima 10 s depois de pronta (oficial com a folga da rede)', () => {
    const at = cooking(4).cookStart + 1000
    const { state, p, end } = onStove(at)
    const smoking = engine.step(state, ctxFor(4, end + BURN_MS + LATE_MS - 1))
    expect(smoking.kitchens[0].items[0].ph).toBe('cook')
    const burnt = engine.step(smoking, ctxFor(4, end + BURN_MS + LATE_MS))
    expect(burnt.kitchens[0].items[0].ph).toBe('burnt')
    expect(burnt.kitchens[0].burnt).toBe(1)
    expect(burnt.kitchens[0].pop).toMatchObject({ kind: 'burn', d: LENTILHA })
    expect(burnt.stats[String(p)].burnt).toBe(1)
    // Lixo: o componente recomeça do primeiro passo e o fogão libera.
    const trashed = engine.step(burnt, ctxFor(4, end + BURN_MS + LATE_MS + 500, { [p]: acts(burnt, [{ n: 2, a: 'trash', i: 901 }]) }))
    expect(trashed.kitchens[0].items[0]).toMatchObject({ ph: 'queue', st: 'fogao', s: 0 })
  })

  it('"tirar" tocado antes de queimar salva, mesmo chegando atrasado; tocado depois, queimou', () => {
    const at = cooking(4).cookStart + 1000
    const { state, p, end } = onStove(at)
    const late = end + BURN_MS + 1000
    const saved = engine.step(state, ctxFor(4, late, { [p]: acts(state, [{ n: 2, a: 'take', i: 901, at: end + BURN_MS - 300 }]) }))
    expect(saved.kitchens[0].items[0].ph).toBe('done')
    const tooLate = engine.step(state, ctxFor(4, late, { [p]: acts(state, [{ n: 2, a: 'take', i: 901, at: end + BURN_MS + 200 }]) }))
    expect(tooLate.kitchens[0].items[0].ph).toBe('burnt')
  })

  it('fogão tem 2 bocas; com "faltou gás", só 1', () => {
    const base = cooking(4)
    const p = memberOf(base)
    const items = [1, 2, 3].map((k) => item(900 + k, 900, LENTILHA, 'fogao', { c: 0 }))
    const state = withKitchen(base, [order(900, LENTILHA, T0)], items)
    const now = state.cookStart + 1000
    const all = engine.step(state, ctxFor(4, now, { [p]: acts(state, items.map((it, k) => ({ n: k + 1, a: 'cook', i: it.id }))) }))
    expect(all.kitchens[0].items.filter((it) => it.ph === 'cook')).toHaveLength(2)
    const gas = { ...state, event: 'gas' as const, capacity: state.capacity.map((cap) => ({ ...cap, fogao: 1 })) }
    const one = engine.step(gas, ctxFor(4, now, { [p]: acts(gas, items.map((it, k) => ({ n: k + 1, a: 'cook', i: it.id }))) }))
    expect(one.kitchens[0].items.filter((it) => it.ph === 'cook')).toHaveLength(1)
  })
})

describe('pedidos: entrega, gorjeta e esgotar', () => {
  it('balcão monta com 2 toques só o prato completo; pontos + gorjeta', () => {
    const base = cooking(4)
    const p = memberOf(base)
    const born = base.cookStart
    const peru = order(900, PERU, born, { exp: born + 80_000 })
    const raw = item(901, 900, PERU, 'forno', { s: 1, ph: 'cook', t0: born + 4000, end: born + 19_000 })
    let state = withKitchen(base, [peru], [raw])
    const now = born + 20_000
    // Ainda no forno: montar não vale.
    state = engine.step(state, ctxFor(4, now, { [p]: acts(state, [{ n: 1, a: 'serve', i: 900 }]) }))
    expect(state.kitchens[0].orders[0].taps).toBe(0)
    state = engine.step(state, ctxFor(4, now + 100, { [p]: acts(state, [{ n: 2, a: 'take', i: 901, at: now + 100 }]) }))
    expect(orderReady(state.kitchens[0], 900)).toBe(true)
    state = engine.step(state, ctxFor(4, now + 200, { [p]: acts(state, [{ n: 3, a: 'serve', i: 900, at: now + 200 }, { n: 4, a: 'serve', i: 900, at: now + 200 }]) }))
    const kitchen = state.kitchens[0]
    const tip = tipFor(peru, now + 200, false)
    expect(tip).toBeGreaterThan(0)
    expect(kitchen.score).toBe(DISHES[PERU].points + tip)
    expect(kitchen.delivered).toBe(1)
    expect(kitchen.orders).toHaveLength(0)
    expect(kitchen.items).toHaveLength(0)
    expect(kitchen.pop).toMatchObject({ kind: 'serve', d: PERU, tip })
    expect(state.stats[String(p)].serve).toBe(1)
    expect(state.served.peru).toBe(1)
    // Gorjeta em dobro no imprevisto do Papai Noel.
    expect(tipFor(peru, now + 200, true)).toBe(tip * 2)
  })

  it('pedido esgotado: some com os itens e tira 10 pontos', () => {
    const base = cooking(4)
    const born = base.cookStart
    const late = order(900, RABANADA, born, { exp: born + 30_000 })
    const state = withKitchen(base, [late], [item(901, 900, RABANADA, 'tabua')])
    const still = engine.step(state, ctxFor(4, born + 30_000 + LATE_MS - 1))
    expect(still.kitchens[0].orders).toHaveLength(1)
    const gone = engine.step(still, ctxFor(4, born + 30_000 + LATE_MS))
    expect(gone.kitchens[0]).toMatchObject({ score: -MISS_PENALTY, missed: 1, orders: [], items: [] })
    expect(gone.kitchens[0].pop).toMatchObject({ kind: 'miss' })
  })

  it('novos pedidos chegam até o limite, que cresce com a rodada', () => {
    const state = cooking(8)
    expect(maxOpenOrders(state, 0)).toBe(2)
    expect(maxOpenOrders(state, 100_000)).toBe(4)
    expect(maxOpenOrders({ ...state, event: 'lotada' }, 0)).toBe(3)
    let current = state
    for (let t = 0; t <= 60_000; t += 1000) current = engine.step(current, ctxFor(8, state.cookStart + t))
    expect(current.kitchens[0].orders.length).toBeGreaterThanOrEqual(2)
    expect(current.kitchens[0].orders.length).toBeLessThanOrEqual(maxOpenOrders(current, 60_000))
    // Mesmo baralho para os dois times.
    expect(current.kitchens[0].orders.map((o) => o.d)).toEqual(current.kitchens[1].orders.map((o) => o.d))
    expect(AFTER_ORDER_GAP_MS).toBeGreaterThan(0)
  })

  it('paciência cobre os passos; time menor e a vó mexem nela', () => {
    expect(patienceOf(PERU, COOK_MS)).toBeGreaterThan(patienceOf(LENTILHA, COOK_MS))
    expect(patienceOf(PERU, COOK_MS)).toBeGreaterThanOrEqual(70_000)
    // 5 pessoas: 3 contra 2.
    const five = cooking(5)
    const small = five.teams.findIndex((team) => team.players.length === 2)
    const big = 1 - small
    const span = (k: number) => five.kitchens[k].orders[0].exp - five.kitchens[k].orders[0].born
    expect(span(small)).toBeGreaterThan(span(big))
  })

  it('"a vó chegou": o primeiro pedido é um pavê VIP de pontos dobrados', () => {
    const base = engine.init(ctxFor(4, T0))
    const tally: CozinhaState = { ...base, phase: 'tally', round: 1, deadline: T0 }
    // Sorteia rodadas até cair o imprevisto da vó.
    let prep: CozinhaState | null = null
    for (let seed = 1; seed < 200 && !prep; seed += 1) {
      const next = engine.step(tally, ctxFor(4, T0 + 1, {}, { rng: seededRng(seed) }))
      if (next.event === 'vo') prep = next
    }
    expect(prep).not.toBeNull()
    const cook = engine.step(prep!, ctxFor(4, prep!.deadline!))
    const first = cook.kitchens[0].orders[0]
    expect(first).toMatchObject({ d: PAVE_INDEX, vip: true, pts: DISHES[PAVE_INDEX].points * 2 })
  })
})

describe('rodadas e fim', () => {
  it('fim da rodada: placar, vitória e a próxima pré-rodada (com imprevisto)', () => {
    const base = cooking(4)
    const scored = { ...base, kitchens: base.kitchens.map((kitchen, index) => ({ ...kitchen, score: index === 0 ? 120 : 80 })) }
    const tally = engine.step(scored, ctxFor(4, base.deadline!))
    expect(tally.phase).toBe('tally')
    expect(tally.history[0]).toMatchObject({ round: 1, scores: [120, 80], winner: 0 })
    expect(tally.teams[0]).toMatchObject({ wins: 1, total: 120 })
    expect(tally.kitchens[0].orders).toEqual([])
    const prep = engine.step(tally, ctxFor(4, tally.deadline!))
    expect(prep).toMatchObject({ phase: 'prep', round: 2 })
    expect(prep.event).not.toBeNull()
    expect(TALLY_SECONDS).toBeGreaterThan(5)
  })

  it('melhor de 3: quem ganha duas leva; empate de rodada não dá vitória', () => {
    const base = cooking(4)
    const tie = engine.step(base, ctxFor(4, base.deadline!))
    expect(tie.history[0].winner).toBeNull()
    const twoWins = { ...tie, round: 2, teams: tie.teams.map((team, index) => ({ ...team, wins: index === 1 ? 2 : 0 })) }
    const end = engine.step(twoWins, ctxFor(4, tie.deadline!))
    expect(end).toMatchObject({ over: true, phase: 'final' })
    expect(championTeam(end)).toBe(1)
  })

  it('"Pular" do host: encerra a cozinha na hora', () => {
    const base = cooking(4)
    const skipped = engine.step(base, ctxFor(4, base.cookStart + 5000, {}, { command: { id: 1, type: 'skip' } }))
    expect(skipped.phase).toBe('tally')
  })

  it('time único (2–3 pessoas): joga todas as rodadas e ganha estrelas', () => {
    const result = runSimulation(engine, { players: 3, seed: 3, options: { minutes: 2, rounds: 3 } })
    expect(result.state.solo).toBe(true)
    expect(result.state.history).toHaveLength(3)
    expect(result.state.history.every((round) => round.winner === null)).toBe(true)
    expect(championTeam(result.state)).toBeNull()
  })

  it('estado de outro jogo: encerra em vez de travar', () => {
    const foreign = { phase: 'vote', inputKey: 'x', deadline: 5, roster: [1, 2], over: false } as unknown as CozinhaState
    expect(engine.step(foreign, ctxFor(2, 10)).over).toBe(true)
  })
})

describe('simulações com bots', () => {
  it.each([2, 4, 8, 15])('partida inteira com %i pessoas chega ao fim (e alguém cozinha)', (players) => {
    for (const seed of [1, 2]) {
      const result = runSimulation(engine, { players, seed, options: { minutes: 2, rounds: 3, chaos: true }, stepMs: 700 })
      expect(result.state.over).toBe(true)
      const delivered = result.state.history.reduce((sum, round) => sum + round.delivered.reduce((a, b) => a + b, 0), 0)
      expect(delivered).toBeGreaterThan(0)
      expect(awards(result.state).length).toBeGreaterThan(0)
    }
  }, 60_000)

  it('com gente offline, bots lentos e o host pulando', () => {
    const result = runSimulation(engine, {
      players: 9,
      seed: 4,
      offlineIds: [3, 7],
      skipProbability: 0.02,
      actProbability: 0.5,
      options: { minutes: 2, rounds: 5 },
    })
    expect(result.state.over).toBe(true)
  }, 60_000)

  it('prêmios: chef, realeza do prato favorito e "queimou o peru"', () => {
    const result = runSimulation(engine, { players: 8, seed: 9, options: { minutes: 3, rounds: 1 }, actProbability: 0.6 })
    const list = awards(result.state)
    const keys = list.map((award) => award.key)
    expect(keys).toContain('chef')
    expect(keys).toContain('royal')
    for (const award of list) {
      expect(award.ids.length).toBeGreaterThan(0)
      expect(award.value).toBeGreaterThan(0)
    }
  }, 60_000)
})

describe('meta (as regras de ouro do registry.test)', () => {
  const VIBES = ['Cooperativo', 'Dedução', 'Blefe', 'Negociação', 'Corrida', 'Aposta', 'Festa', 'Estratégia']

  it('segue as regras de ouro', () => {
    expect(meta.slug).toBe('cozinha-da-ceia')
    expect(meta.name.length).toBeGreaterThan(2)
    expect(meta.icon.length).toBeGreaterThan(0)
    expect(meta.tagline.length).toBeGreaterThan(5)
    expect(meta.pitch.length).toBeGreaterThan(10)
    expect(VIBES).toContain(meta.vibe)
    expect(meta.howTo.length).toBeGreaterThanOrEqual(3)
    expect(meta.howTo.length).toBeLessThanOrEqual(5)
    for (const step of meta.howTo) {
      const words = step.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word))
      expect(words.length, `passo longo demais: "${step}"`).toBeLessThanOrEqual(15)
    }
    expect(meta.minPlayers).toBe(2)
    expect(meta.maxPlayers).toBe(15)
    for (const key of ['main', 'light', 'glow', 'contrast', 'sigil'] as const) {
      expect(meta.accent[key].length).toBeGreaterThan(0)
    }
    expect(meta.phonePollMs).toBeGreaterThanOrEqual(1000)
  })

  it('opções válidas: chaves únicas e o padrão entre as escolhas', () => {
    const optionKeys = meta.options.map((option) => option.key)
    expect(new Set(optionKeys).size).toBe(optionKeys.length)
    for (const option of meta.options) {
      expect(option.choices.length).toBeGreaterThanOrEqual(2)
      expect(option.choices.map((choice) => choice.value)).toContain(option.default)
    }
  })

  it('como o registry.test: termina sozinho com 2, 8 e 15 e com offline + pulo', () => {
    for (const players of [2, 8, 15]) {
      expect(runSimulation(engine, { players, seed: players, options: optionDefaults(meta.options) }).state.over).toBe(true)
    }
    const result = runSimulation(engine, {
      players: 9,
      seed: 4,
      offlineIds: [3, 7],
      skipProbability: 0.2,
      actProbability: 0.5,
      options: optionDefaults(meta.options),
    })
    expect(result.state.over).toBe(true)
  }, 60_000)
})
