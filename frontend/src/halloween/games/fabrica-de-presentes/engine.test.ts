import { describe, expect, it } from 'vitest'
import { optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { HPlayer, HInput } from '../../engine/types'
import { CHAOS, PART_BY_ID, PART_IDS, type ChaosId } from './content'
import {
  FAST_BONUS,
  HOLD_MS,
  LATE_MS,
  MESS_PENALTY,
  POINTS_PER_STEP,
  awards,
  coopStars,
  engine,
  giftPoints,
  handOf,
  holderOf,
  orderAt,
  orderSeconds,
  rebalanceHands,
  splitTeams,
  timeMultipliers,
  winningTeam,
  type FpState,
  type Order,
} from './engine'
import { meta } from './meta'
import { queueTap, resetTapStores } from './view'

const NOW = 1_000_000

function start(n: number, options: Record<string, unknown> = {}, seed = n) {
  const players = makePlayers(n)
  const state = engine.init(makeCtx({ players, now: NOW, rng: seededRng(seed), options }))
  return { players, state }
}

function ctxAt(players: HPlayer[], now: number, inputs: Record<number, HInput | undefined> = {}, extra: Record<string, unknown> = {}) {
  return makeCtx({ players, now, inputs, rng: seededRng(now % 9973), ...extra })
}

/** Até a fase de montagem. Com 6+ pessoas o catálogo vem inteiro. */
function playing(n = 6, options: Record<string, unknown> = {}, seed = n) {
  const { players, state } = start(n, options, seed)
  const play = engine.step(state, ctxAt(players, state.deadline!))
  expect(play.phase).toBe('play')
  return { players, state: play, now: state.deadline! }
}

/** Troca o pedido da bancada de um time (para cenas roteirizadas). */
function withOrder(state: FpState, teamIndex: number, parts: string[], now: number, vip = false): FpState {
  const copy = JSON.parse(JSON.stringify(state)) as FpState
  const order: Order = { n: 0, to: 'Pra vó Zuleide', emoji: '👵', parts, vip }
  const team = copy.teams[teamIndex]
  team.order = order
  team.placed = 0
  team.held = []
  team.startedAt = now
  team.expiresAt = now + 30_000
  return copy
}

function who(state: FpState, teamIndex: number, part: string): number {
  const id = holderOf(state, state.teams[teamIndex], part)
  expect(id, `ninguém tem ${part}`).not.toBeNull()
  return id!
}

/**
 * Os celulares do time tocam estas peças (na ordem da lista): cada dono
 * manda a fila dele com números novos depois do que o juiz já viu.
 */
function send(state: FpState, teamIndex: number, list: { p: string; at?: number }[], key = state.inputKey): Record<number, HInput> {
  const queues: Record<number, { n: number; p: string; at?: number }[]> = {}
  for (const tap of list) {
    const id = who(state, teamIndex, tap.p)
    const queue = queues[id] ?? []
    queue.push({ n: (state.seen[String(id)] ?? 0) + queue.length + 1, ...tap })
    queues[id] = queue
  }
  return Object.fromEntries(Object.entries(queues).map(([id, taps]) => [id, { k: key, taps }]))
}

/** Uma peça que o pedido não usa. */
function wrongPart(state: FpState, parts: string[]): string {
  return state.active.find((part) => !parts.includes(part))!
}

const GIFT = ['cx-quadrada', 'pp-xadrez', 'lc-dourado']

describe('times', () => {
  it.each(Array.from({ length: 14 }, (_, i) => i + 2))('%i jogadores: todo mundo num time, times equilibrados', (n) => {
    const { state } = start(n)
    const all = state.teams.flatMap((team) => team.members)
    expect([...all].sort((a, b) => a - b)).toEqual(state.roster)
    if (n <= 3) {
      expect(state.coop).toBe(true)
      expect(state.teams).toHaveLength(1)
    } else {
      expect(state.coop).toBe(false)
      expect(state.teams.map((team) => team.id)).toEqual(['r', 'g'])
      expect(Math.abs(state.teams[0].members.length - state.teams[1].members.length)).toBeLessThanOrEqual(1)
    }
  })

  it('splitTeams embaralha mas mantém a ordem da mesa dentro de cada time', () => {
    const [red, green] = splitTeams([1, 2, 3, 4, 5, 6, 7], seededRng(3))
    expect(red.length + green.length).toBe(7)
    expect(red).toEqual([...red].sort((a, b) => a - b))
    expect(green).toEqual([...green].sort((a, b) => a - b))
  })

  it('time menor ganha tempo extra (até +30%)', () => {
    expect(timeMultipliers([4, 4])).toEqual([1, 1])
    expect(timeMultipliers([8, 7])).toEqual([1, 1.1])
    expect(timeMultipliers([2, 7])).toEqual([1.3, 1])
    expect(timeMultipliers([3])).toEqual([1])
    const order = orderAt(1, 0, PART_IDS, null)
    expect(orderSeconds(order, 1.1, null)).toBeGreaterThan(orderSeconds(order, 1, null))
    // 8 contra 7: o time de 7 já começa com o tempo extra.
    const { state } = start(15)
    const small = state.teams.find((team) => team.members.length === 7)!
    expect(small.timeMul).toBe(1.1)
  })
})

describe('peças', () => {
  it.each(Array.from({ length: 14 }, (_, i) => i + 2))('%i jogadores: cada peça da rodada está com exatamente uma pessoa de cada time', (n) => {
    for (const seed of [1, 7, 42]) {
      const { state } = start(n, {}, seed)
      for (const team of state.teams) {
        const dealt = team.members.flatMap((id) => handOf(state, id))
        expect([...dealt].sort()).toEqual([...state.active].sort())
        for (const id of team.members) {
          expect(handOf(state, id).length).toBeGreaterThan(0)
          expect(state.private[String(id)].team).toBe(team.id)
        }
        // Distribuição justa: no máximo uma peça de diferença.
        const counts = team.members.map((id) => handOf(state, id).length)
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('todo pedido usa só peças da rodada (todo pedido é montável pelo time)', () => {
    for (const n of [2, 4, 9, 15]) {
      const { state } = start(n)
      for (const chaos of [null, ...CHAOS.map((c) => c.id)] as (ChaosId | null)[]) {
        for (let index = 0; index < 60; index += 1) {
          const order = orderAt(state.seed, index, state.active, chaos)
          expect(order.parts.length).toBeGreaterThanOrEqual(2)
          expect(new Set(order.parts).size).toBe(order.parts.length)
          for (const part of order.parts) {
            expect(state.active).toContain(part)
            for (const team of state.teams) expect(holderOf(state, team, part)).not.toBeNull()
          }
        }
      }
    }
  })

  it('times pequenos jogam com menos tipos de peça (3 de cada)', () => {
    expect(start(2).state.active).toHaveLength(12)
    expect(start(4).state.active).toHaveLength(12)
    expect(start(6).state.active).toHaveLength(PART_IDS.length)
  })

  it('os dois times recebem a mesma fila de pedidos', () => {
    const { state } = playing(8)
    expect(state.teams[0].order).toEqual(state.teams[1].order)
  })

  it('ordem de montagem: caixa → papel → laço → etiqueta (e ao contrário na esteira invertida)', () => {
    const rank = (part: string) => ['caixa', 'papel', 'laco', 'etiqueta'].indexOf(PART_BY_ID[part].cat)
    for (let index = 0; index < 40; index += 1) {
      const normal = orderAt(5, index, PART_IDS, null)
      expect(normal.parts.map(rank)).toEqual([...normal.parts.map(rank)].sort((a, b) => a - b))
      expect(PART_BY_ID[normal.parts[0]].cat).toBe('caixa')
      const flipped = orderAt(5, index, PART_IDS, 'invertida')
      expect(flipped.parts).toEqual([...normal.parts].reverse())
      expect(PART_BY_ID[flipped.parts[flipped.parts.length - 1]].cat).toBe('caixa')
      expect(orderAt(5, index, PART_IDS, 'sem-laco').parts.some((part) => PART_BY_ID[part].cat === 'laco')).toBe(false)
    }
  })

  it('quem cai (offline) passa as peças para o time; quem volta de mãos vazias recebe', () => {
    const { players, state, now } = playing(8)
    const team = state.teams[0]
    const gone = team.members[0]
    const before = handOf(state, gone)
    const offline = players.map((player) => (player.id === gone ? { ...player, online: false } : player))
    const next = engine.step(state, ctxAt(offline, now + 500))
    expect(next).not.toBe(state)
    expect(handOf(next, gone)).toEqual([])
    const dealt = team.members.flatMap((id) => handOf(next, id))
    expect([...dealt].sort()).toEqual([...state.active].sort())
    for (const part of before) expect(holderOf(next, next.teams[0], part)).not.toBe(gone)
    // Idempotente: o mesmo ctx não muda mais nada.
    expect(engine.step(next, ctxAt(offline, now + 500))).toBe(next)
    // Voltou: recebe peça de quem tem mais.
    const back = engine.step(next, ctxAt(players, now + 900))
    expect(handOf(back, gone).length).toBeGreaterThan(0)
    expect(rebalanceHands(back.private, back.teams[0], new Set(players.map((p) => p.id)))).toBeNull()
  })
})

describe('montando presentes', () => {
  it('peça certa entra; peça adiantada espera e entra quando chega a vez', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, GIFT, now)
    const [box, paper, bow] = GIFT
    // O laço chega antes da hora: espera em cima da bancada.
    const s1 = engine.step(state, ctxAt(players, now + 100, send(state, 0, [{ p: bow }])))
    expect(s1.teams[0].placed).toBe(0)
    expect(s1.teams[0].held.map((held) => held.p)).toEqual([bow])
    expect(s1.teams[0].log.at(-1)?.r).toBe('wait')
    // Papel e caixa chegam no mesmo poll, fora de ordem: vale o horário do toque.
    const s2 = engine.step(s1, ctxAt(players, now + 400, send(s1, 0, [{ p: paper, at: now + 300 }, { p: box, at: now + 200 }])))
    // Os três entraram, o presente foi pro trenó e o próximo pedido está na bancada.
    expect(s2.teams[0].line.done).toBe(1)
    expect(s2.teams[0].sleigh).toBe(1)
    expect(s2.teams[0].order?.n).toBe(1)
    expect(s2.teams[0].placed).toBe(0)
    expect(s2.teams[0].held).toEqual([])
    expect(s2.teams[0].score).toBe(3 * POINTS_PER_STEP + FAST_BONUS)
    expect(s2.teams[0].flash?.kind).toBe('done')
    // Quem colocou cada peça conta no placar pessoal; o laço também.
    expect(s2.stats[String(who(state, 0, bow))][2]).toBe(1)
    // O outro time não foi afetado.
    expect(s2.teams[1].score).toBe(0)
    expect(s2.teams[1].placed).toBe(0)
  })

  it('peça adiantada que espera demais cai e vira bagunça', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, GIFT, now)
    const inputs = send(state, 0, [{ p: GIFT[2] }])
    const s1 = engine.step(state, ctxAt(players, now + 100, inputs))
    expect(engine.step(s1, ctxAt(players, now + 100 + HOLD_MS - 1, inputs))).toBe(s1)
    const s3 = engine.step(s1, ctxAt(players, now + 100 + HOLD_MS, inputs))
    expect(s3.teams[0].held).toEqual([])
    expect(s3.teams[0].line.mess).toBe(1)
    expect(s3.teams[0].score).toBe(-MESS_PENALTY)
    expect(s3.teams[0].log.some((entry) => entry.r === 'drop')).toBe(true)
  })

  it('peça errada = bagunça: o presente vai pro lixo, −5 e o pedido recomeça', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, GIFT, now)
    const box = GIFT[0]
    const s1 = engine.step(state, ctxAt(players, now + 100, send(state, 0, [{ p: box }])))
    expect(s1.teams[0].placed).toBe(1)
    const wrong = wrongPart(s1, GIFT)
    const culprit = who(s1, 0, wrong)
    const s2 = engine.step(s1, ctxAt(players, now + 200, send(s1, 0, [{ p: wrong }])))
    const team = s2.teams[0]
    expect(team.placed).toBe(0)
    expect(team.order?.n).toBe(0)
    expect(team.line.mess).toBe(1)
    expect(team.score).toBe(-MESS_PENALTY)
    expect(team.flash?.kind).toBe('mess')
    expect(team.flash?.parts).toEqual([box, wrong])
    expect(team.log.at(-1)?.r).toBe('mess')
    expect(s2.stats[String(culprit)][1]).toBe(1)
    // O pedido continua o mesmo, com o relógio dele correndo.
    expect(team.expiresAt).toBe(state.teams[0].expiresAt)
  })

  it('acabou a fita: laço vira armadilha', () => {
    const { players, now, state: base } = playing()
    const state = withOrder({ ...base, chaos: 'sem-laco' }, 0, ['cx-quadrada', 'pp-xadrez'], now)
    const s1 = engine.step(state, ctxAt(players, now + 100, send(state, 0, [{ p: 'lc-vermelho' }])))
    expect(s1.teams[0].line.mess).toBe(1)
  })

  it('peça repetida ou atrasada não pune; peça que não é minha é ignorada', () => {
    const { players, now, state: base } = playing()
    const parts = ['cx-quadrada', 'pp-xadrez']
    const [box, paper] = parts
    const state = withOrder(base, 0, parts, now)
    const s1 = engine.step(state, ctxAt(players, now + 100, send(state, 0, [{ p: box }])))
    // Dedo nervoso: a caixa de novo, com número novo.
    const s2 = engine.step(s1, ctxAt(players, now + 200, send(s1, 0, [{ p: box }])))
    expect(s2.teams[0].placed).toBe(1)
    expect(s2.teams[0].log.at(-1)?.r).toBe('dup')
    expect(s2.teams[0].score).toBe(0)
    // Fecha o presente…
    const s3 = engine.step(s2, ctxAt(players, now + 300, send(s2, 0, [{ p: paper }])))
    expect(s3.teams[0].line.done).toBe(1)
    // …e um toque atrasado do papel chega depois: o presente já foi, nada de bagunça.
    const next = withOrder(s3, 0, ['cx-redonda', 'pp-bolinhas'], now + 300)
    const s4 = engine.step(next, ctxAt(players, now + 500, send(next, 0, [{ p: paper }])))
    expect(s4.teams[0].line.mess).toBe(0)
    expect(s4.teams[0].log.at(-1)?.r).toBe('late')
    // Peça que não está na minha mão (celular desatualizado): ignorada, mas contada como vista.
    const boxer = who(s4, 0, 'cx-redonda')
    const notMine = s4.active.find((part) => !handOf(s4, boxer).includes(part))!
    const n = (s4.seen[String(boxer)] ?? 0) + 1
    const s5 = engine.step(s4, ctxAt(players, now + 600, { [boxer]: { k: s4.inputKey, taps: [{ n, p: notMine }] } }))
    expect(s5.teams[0].line.mess).toBe(0)
    expect(s5.teams[0].placed).toBe(0)
    expect(s5.seen[String(boxer)]).toBe(n)
  })

  it('toques rápidos: cada um processado exatamente uma vez, mesmo relido em vários polls', () => {
    resetTapStores()
    const { players, now, state: base } = playing(2)
    // Cooperativo com 2: um pedido inteiro na mão de uma pessoa só.
    const me = base.roster.find((id) => {
      const cats = handOf(base, id).map((part) => PART_BY_ID[part].cat)
      return cats.includes('caixa') && cats.includes('papel')
    })!
    const hand = handOf(base, me)
    const box = hand.find((part) => PART_BY_ID[part].cat === 'caixa')!
    const paper = hand.find((part) => PART_BY_ID[part].cat === 'papel')!
    const extra = hand.find((part) => part !== box && part !== paper)!
    const state = withOrder(base, 0, [box, paper], now)
    // Três toques antes de o juiz ver qualquer um: a fila leva os três.
    const key = 'TEST:1:1:1'
    queueTap(key, 0, box, now + 10)
    queueTap(key, 0, paper, now + 20)
    const queue = queueTap(key, 0, extra, now + 30)
    expect(queue.map((tap) => tap.n)).toEqual([1, 2, 3])
    const inputs = { [me]: { k: state.inputKey, taps: queue } }
    const s1 = engine.step(state, ctxAt(players, now + 100, inputs))
    expect(s1.seen[String(me)]).toBe(3)
    expect(s1.events).toBe(3)
    expect(s1.inputKey).toBe('play-1-3')
    expect(s1.teams[0].line.done).toBe(1)
    const handled = s1.teams[0].log.filter((entry) => entry.by === me).length
    expect(handled).toBe(3)
    // Relido nos polls seguintes (mesma fila, chave antiga): nada muda.
    expect(engine.step(s1, ctxAt(players, now + 150, inputs))).toBe(s1)
    expect(engine.step(s1, ctxAt(players, now + 550, inputs))).toBe(s1)
    // O celular viu seen=3: a próxima fila só leva o toque novo.
    const next = queueTap(key, s1.seen[String(me)], box, now + 600)
    expect(next.map((tap) => tap.n)).toEqual([4])
    // Fila velha (já vista) + o novo: só o 4 é processado.
    const s2 = engine.step(s1, ctxAt(players, now + 700, { [me]: { k: s1.inputKey, taps: [...queue, ...next] } }))
    expect(s2.seen[String(me)]).toBe(4)
    expect(s2.events).toBe(4)
    expect(s2.teams[0].log.filter((entry) => entry.by === me).length).toBeLessThanOrEqual(handled + 1)
  })

  it('aceita toque mandado com a chave de um instante atrás; ignora chave de outra rodada e lixo', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, GIFT, now)
    const old = engine.step(state, ctxAt(players, now + 50, send(state, 0, [{ p: GIFT[0] }], 'play-1-0')))
    expect(old.teams[0].placed).toBe(1)
    expect(old.inputKey).toBe('play-1-1')
    expect(engine.step(state, ctxAt(players, now + 50, send(state, 0, [{ p: GIFT[0] }], 'play-2-0')))).toBe(state)
    expect(engine.step(state, ctxAt(players, now + 50, send(state, 0, [{ p: GIFT[0] }], 'brief-1')))).toBe(state)
    const boxer = who(state, 0, GIFT[0])
    const garbage = engine.step(state, ctxAt(players, now + 50, { [boxer]: { k: state.inputKey, taps: [{ n: 'x', p: 1 }, null, { n: 1.5, p: GIFT[0] }, { n: 1, p: 'nao-existe' }] } }))
    expect(garbage).toBe(state)
  })

  it('pedido expira: sai da bancada (com folga para o toque na rede) e vem o próximo', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, GIFT, now)
    const end = state.teams[0].expiresAt
    const quiet = withOrder(state, 1, GIFT, now + 60_000)
    expect(engine.step(quiet, ctxAt(players, end + LATE_MS - 1))).toBe(quiet)
    const lost = engine.step(quiet, ctxAt(players, end + LATE_MS))
    expect(lost.teams[0].line.lost).toBe(1)
    expect(lost.teams[0].order?.n).toBe(1)
    expect(lost.teams[0].flash?.kind).toBe('lost')
    expect(lost.teams[0].score).toBe(0)
    // O toque que chegou em cima do laço (dentro da folga) ainda vale.
    const saved = engine.step(quiet, ctxAt(players, end + 500, send(quiet, 0, [{ p: GIFT[0] }])))
    expect(saved.teams[0].placed).toBe(1)
    expect(saved.teams[0].line.lost).toBe(0)
  })
})

describe('pontos', () => {
  const order = (parts: number, vip = false): Order => ({ n: 0, to: '', emoji: '', parts: GIFT.concat('et-te-amo').slice(0, parts), vip })

  it('10 por etapa, +10 se rápido, VIP dobra, trenó com pressa +50%', () => {
    expect(giftPoints(order(2), false, null)).toBe(2 * POINTS_PER_STEP)
    expect(giftPoints(order(4), true, null)).toBe(4 * POINTS_PER_STEP + FAST_BONUS)
    expect(giftPoints(order(3, true), true, 'vip')).toBe((3 * POINTS_PER_STEP + FAST_BONUS) * 2)
    expect(giftPoints(order(2), false, 'pressa')).toBe(30)
    expect(orderSeconds(order(2), 1, 'pressa')).toBeLessThan(orderSeconds(order(2), 1, null))
  })

  it('entrega devagar (depois da metade do tempo) não ganha bônus', () => {
    const { players, now, state: base } = playing()
    const state = withOrder(base, 0, ['cx-quadrada', 'pp-xadrez'], now)
    const slow = now + 20_000
    const s1 = engine.step(state, ctxAt(players, slow, send(state, 0, [{ p: 'cx-quadrada', at: slow }, { p: 'pp-xadrez', at: slow + 1 }])))
    expect(s1.teams[0].score).toBe(2 * POINTS_PER_STEP)
  })

  it('pedido VIP só na rodada VIP', () => {
    const vip = Array.from({ length: 9 }, (_, i) => orderAt(3, i, PART_IDS, 'vip').vip)
    expect(vip.filter(Boolean).length).toBe(3)
    expect(Array.from({ length: 9 }, (_, i) => orderAt(3, i, PART_IDS, null).vip).some(Boolean)).toBe(false)
  })

  it('vencedor, empate, estrelas e prêmios', () => {
    const { state } = start(6)
    const scored: FpState = { ...state, teams: [{ ...state.teams[0], score: 50 }, { ...state.teams[1], score: 40 }] }
    expect(winningTeam(scored)).toBe('r')
    expect(winningTeam({ ...scored, teams: [scored.teams[0], { ...scored.teams[1], score: 50 }] })).toBeNull()
    const coop = start(3).state
    expect(winningTeam(coop)).toBeNull()
    expect(coopStars({ ...coop, history: [{ round: 1, chaos: null, lines: [] }], teams: [{ ...coop.teams[0], sleigh: 9 }] })).toBe(3)
    expect(coopStars({ ...coop, history: [{ round: 1, chaos: null, lines: [] }], teams: [{ ...coop.teams[0], sleigh: 1 }] })).toBe(0)
    const [a, b] = state.roster
    const prizes = awards({ ...state, stats: { ...state.stats, [a]: [9, 2, 3, 1], [b]: [4, 5, 0, 2] } })
    expect(prizes.find((prize) => prize.key === 'relampago')?.ids).toEqual([a])
    expect(prizes.find((prize) => prize.key === 'bagunca')?.ids).toEqual([b])
    expect(prizes.find((prize) => prize.key === 'laco')?.ids).toEqual([a])
    expect(prizes.find((prize) => prize.key === 'fecha')?.ids).toEqual([b])
    expect(awards(state)).toEqual([])
  })
})

describe('rodadas', () => {
  it('brief → play → tally → brief (imprevisto, peças novas) → … → final', () => {
    const { players, state } = start(8, { rounds: 3, minutes: 2, chaos: true })
    expect(state.phase).toBe('brief')
    expect(state.chaos).toBeNull()
    const play = engine.step(state, ctxAt(players, state.deadline!))
    expect(play.roundEnd! - state.deadline!).toBe(2 * 60_000)
    const tally = engine.step(play, ctxAt(players, play.roundEnd!))
    expect(tally.phase).toBe('tally')
    expect(tally.history).toHaveLength(1)
    const brief2 = engine.step(tally, ctxAt(players, tally.deadline!))
    expect(brief2.phase).toBe('brief')
    expect(brief2.round).toBe(2)
    expect(brief2.chaos).not.toBeNull()
    expect(brief2.deals).toBe(2)
    // As peças trocam de dono a cada rodada.
    expect(brief2.roster.some((id) => handOf(brief2, id).join() !== handOf(state, id).join())).toBe(true)
    let s = brief2
    const seen: (ChaosId | null)[] = [brief2.chaos]
    for (let guard = 0; guard < 10 && !s.over; guard += 1) {
      s = engine.step(s, ctxAt(players, s.deadline!))
      if (s.phase === 'brief') seen.push(s.chaos)
    }
    expect(s.over).toBe(true)
    expect(s.phase).toBe('final')
    expect(s.history).toHaveLength(3)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('"Pular" do host encerra a rodada; sem imprevistos quando desligado', () => {
    const { players, state } = start(5, { chaos: false, rounds: 2 })
    const play = engine.step(state, ctxAt(players, state.deadline!))
    const skipped = engine.step(play, ctxAt(players, play.deadline! - 60_000, {}, { command: { id: 1, type: 'skip' } }))
    expect(skipped.phase).toBe('tally')
    const brief2 = engine.step(skipped, ctxAt(players, skipped.deadline!))
    expect(brief2.chaos).toBeNull()
    // Comando desconhecido: nada muda.
    expect(engine.step(brief2, ctxAt(players, brief2.deadline! - 1000, {}, { command: { id: 2, type: 'dance' } }))).toBe(brief2)
  })

  it('troca de turno: na metade da rodada as peças trocam de mão (uma vez)', () => {
    const { players, state } = start(8)
    const troca: FpState = { ...state, chaos: 'troca' }
    const play = engine.step(troca, ctxAt(players, troca.deadline!))
    expect(play.swapAt).not.toBeNull()
    const swapped = engine.step(play, ctxAt(players, play.swapAt!))
    expect(swapped.swapAt).toBeNull()
    expect(swapped.deals).toBe(play.deals + 1)
    for (const team of swapped.teams) {
      const dealt = team.members.flatMap((id) => handOf(swapped, id))
      expect([...dealt].sort()).toEqual([...swapped.active].sort())
    }
    expect(engine.step(swapped, ctxAt(players, play.swapAt!))).toBe(swapped)
  })

  it('estado de outro jogo: encerra em vez de travar', () => {
    const foreign = { phase: 'intro', inputKey: 'x', deadline: 5, roster: [1, 2], over: false } as unknown as FpState
    expect(engine.step(foreign, makeCtx({ now: 10 })).over).toBe(true)
  })
})

describe('simulação', () => {
  it.each([
    [4, 1],
    [4, 2],
    [8, 3],
    [8, 4],
    [15, 5],
    [15, 6],
  ])('%i jogadores (semente %i) chegam ao fim', (players, seed) => {
    const result = runSimulation(engine, { players, seed, options: { rounds: 2, minutes: 2, chaos: true } })
    expect(result.state.over).toBe(true)
    const delivered = result.state.teams.reduce((sum, team) => sum + team.sleigh, 0)
    expect(delivered).toBeGreaterThan(0)
  })

  it('com 2 e 3 jogadores (cooperativo)', () => {
    for (const players of [2, 3]) {
      const result = runSimulation(engine, { players, seed: players, options: { rounds: 2, minutes: 2 } })
      expect(result.state.over).toBe(true)
      expect(result.state.coop).toBe(true)
      expect(result.state.teams[0].sleigh).toBeGreaterThan(0)
    }
  })

  it('com gente offline e o host pulando', () => {
    const result = runSimulation(engine, { players: 9, seed: 4, offlineIds: [3, 7], skipProbability: 0.05, actProbability: 0.5 })
    expect(result.state.over).toBe(true)
  })
})

/** As regras de ouro do registry.test (valem quando o jogo for registrado). */
describe('meta da Fábrica de Presentes', () => {
  const VIBES = ['Cooperativo', 'Dedução', 'Blefe', 'Negociação', 'Corrida', 'Aposta', 'Festa', 'Estratégia']

  it('segue as regras de ouro', () => {
    expect(meta.slug).toBe('fabrica-de-presentes')
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
    expect(meta.minPlayers).toBeGreaterThanOrEqual(1)
    expect(meta.maxPlayers).toBe(15)
    for (const key of ['main', 'light', 'glow', 'contrast', 'sigil'] as const) expect(meta.accent[key].length).toBeGreaterThan(0)
    expect(meta.phonePollMs ?? 1500).toBeGreaterThanOrEqual(1000)
  })

  it('opções válidas: chaves únicas e o padrão entre as escolhas', () => {
    const keys = meta.options.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const option of meta.options) {
      expect(option.choices.length).toBeGreaterThanOrEqual(2)
      expect(option.choices.map((choice) => choice.value)).toContain(option.default)
    }
  })

  it.each([...new Set([Math.max(meta.minPlayers, 1), 8, 15])])('termina sozinho com %i jogadores e as opções padrão', (players) => {
    const result = runSimulation(engine, { players, seed: players, options: optionDefaults(meta.options) })
    expect(result.state.over).toBe(true)
  })

  it('termina com gente offline e o host pulando (opções padrão)', () => {
    const result = runSimulation(engine, { players: 9, seed: 4, offlineIds: [3, 7], skipProbability: 0.2, actProbability: 0.5, options: optionDefaults(meta.options) })
    expect(result.state.over).toBe(true)
  })
})
