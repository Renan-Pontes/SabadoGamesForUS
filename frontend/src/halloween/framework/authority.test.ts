import { describe, expect, it } from 'vitest'
import { inputFor, isExpired, onlineRoster, seededRng } from '../engine/helpers'
import type { BaseState, HalloweenEngine, HalloweenGameMeta } from '../engine/types'
import type { SyncPlayer } from '../net/sync'
import { engine as qmpEngine, type QmpState } from '../games/quem-morre-primeiro/engine'
import { meta as qmpMeta } from '../games/quem-morre-primeiro/meta'
import {
  HOST_GRACE_MS,
  LEASE_MS,
  RENEW_WHEN_LEFT_MS,
  authorityStep,
  canJudge,
  type AuthorityInput,
  type JudgeDevice,
} from './authority'
import { readRoomState, type HalloweenRoomState } from './roomState'

const TV: JudgeDevice = { id: 'tv-sala.a1', kind: 'tv' }
const OTHER_TV: JudgeDevice = { id: 'tv-outra.b2', kind: 'tv' }
const HOST: JudgeDevice = { id: 'ph-host.c3', kind: 'host' }

// --- Um motor mínimo para testar o framework -------------------------------

type TestState = BaseState & { skips: number; votes: Record<string, unknown>; rounds: unknown }

const testEngine: HalloweenEngine<TestState> = {
  init: (ctx) => ({
    phase: 'play',
    inputKey: 'p1',
    deadline: ctx.now + 10_000,
    roster: onlineRoster(ctx),
    over: false,
    skips: 0,
    votes: {},
    rounds: ctx.options.rounds,
  }),
  step(state, ctx) {
    if (state.over) return state
    if (ctx.command?.type === 'skip') return { ...state, skips: state.skips + 1 }
    if (isExpired(state.deadline, ctx.now)) return { ...state, over: true, deadline: null }
    const votes: Record<string, unknown> = {}
    for (const id of state.roster) {
      const input = inputFor(ctx, state.inputKey, id)
      if (input) votes[id] = input.vote
    }
    return JSON.stringify(votes) === JSON.stringify(state.votes) ? state : { ...state, votes }
  },
  bot: () => null,
}

const testMeta: Pick<HalloweenGameMeta, 'slug' | 'options' | 'minPlayers'> = {
  slug: 'teste',
  minPlayers: 2,
  options: [
    { key: 'rounds', label: 'Rodadas', choices: [{ value: 3, label: '3' }, { value: 5, label: '5' }], default: 5 },
  ],
}

function player(id: number, extra: Partial<SyncPlayer> = {}): SyncPlayer {
  return {
    id,
    name: `P${id}`,
    is_host: id === 1,
    ready: true,
    online: true,
    joined_at: `2026-10-31T20:00:${String(id).padStart(2, '0')}Z`,
    state: {},
    ...extra,
  }
}

function input(overrides: Partial<AuthorityInput<TestState>> = {}): AuthorityInput<TestState> {
  return {
    engine: testEngine,
    meta: testMeta,
    room: { status: 'live', state: {}, game: { slug: 'teste' } },
    players: [player(1), player(2), player(3)],
    full: true,
    now: 100_000,
    device: TV,
    rng: seededRng(5),
    ...overrides,
  }
}

function withState(state: HalloweenRoomState<TestState> | Record<string, unknown>, overrides: Partial<AuthorityInput<TestState>> = {}) {
  return input({ room: { status: 'live', state, game: { slug: 'teste' } }, ...overrides })
}

function hostCommand(cmd: Record<string, unknown>, others: SyncPlayer[] = [player(2), player(3)]) {
  return [player(1, { state: { cmd } }), ...others]
}

/** Estado de sala já com a partida rodando e a TV como juíza. */
function running(now = 100_000): HalloweenRoomState<TestState> {
  const begun = authorityStep(input({ now, players: hostCommand({ id: 1, type: 'begin' }) })).next
  if (!begun) throw new Error('não começou')
  return begun
}

describe('canJudge (contrato de juiz)', () => {
  const now = 50_000
  it('TV: livre, vencido, dela, ou com um celular', () => {
    expect(canJudge(null, TV, now)).toBe(true)
    expect(canJudge({ d: TV.id, u: now + 5000 }, TV, now)).toBe(true)
    expect(canJudge({ d: OTHER_TV.id, u: now + 5000 }, TV, now)).toBe(false)
    expect(canJudge({ d: OTHER_TV.id, u: now }, TV, now)).toBe(true)
    expect(canJudge({ d: HOST.id, u: now + 5000 }, TV, now)).toBe(true)
  })

  it('host: só com o contrato vencido há 6 s', () => {
    expect(canJudge({ d: HOST.id, u: now + 5000 }, HOST, now)).toBe(true)
    expect(canJudge({ d: TV.id, u: now + 5000 }, HOST, now)).toBe(false)
    expect(canJudge({ d: TV.id, u: now - HOST_GRACE_MS + 1 }, HOST, now)).toBe(false)
    expect(canJudge({ d: TV.id, u: now - HOST_GRACE_MS }, HOST, now)).toBe(true)
    expect(canJudge(null, HOST, now, null)).toBe(false)
    expect(canJudge(null, HOST, now, now - HOST_GRACE_MS + 1)).toBe(false)
    expect(canJudge(null, HOST, now, now - HOST_GRACE_MS)).toBe(true)
  })
})

describe('authorityStep', () => {
  it('não julga sala fora do ar, de outro jogo, nem sem contrato', () => {
    expect(authorityStep(input({ room: { status: 'lobby', state: {} } })).judge).toBe(false)
    expect(authorityStep(input({ room: { status: 'live', state: {}, game: { slug: 'outro' } } })).judge).toBe(false)
    const taken = { _auth: { d: OTHER_TV.id, u: 200_000 } }
    expect(authorityStep(withState(taken))).toMatchObject({ judge: false, next: null })
  })

  it('pede o sync completo antes de rodar o motor', () => {
    expect(authorityStep(input({ full: false }))).toEqual({ judge: true, needsFull: true, next: null, error: null })
  })

  it('assume o contrato, não regrava à toa e renova antes de vencer', () => {
    const first = authorityStep(input())
    expect(first.judge).toBe(true)
    expect(first.next?._auth).toEqual({ d: TV.id, u: 100_000 + LEASE_MS })
    expect(first.next?.g).toBeNull()

    const again = authorityStep(withState(first.next!, { now: 101_000 }))
    expect(again).toMatchObject({ judge: true, next: null })

    const renewAt = 100_000 + LEASE_MS - RENEW_WHEN_LEFT_MS + 1
    const renewed = authorityStep(withState(first.next!, { now: renewAt }))
    expect(renewed.next?._auth).toEqual({ d: TV.id, u: renewAt + LEASE_MS })
  })

  it('begin: guarda as opções válidas, chama init e marca a partida', () => {
    const result = authorityStep(input({ players: hostCommand({ id: 1, type: 'begin', options: { rounds: 3, lixo: 1 } }) }))
    const next = result.next!
    expect(next._cmd).toBe(1)
    expect(next.setup).toEqual({ rounds: 3 })
    expect(next.g?.rounds).toBe(3)
    expect(next.g?.roster).toEqual([1, 2, 3])
    expect(typeof next._m).toBe('string')
    expect(next._err).toBeNull()

    const fallback = authorityStep(input({ players: hostCommand({ id: 1, type: 'begin', options: { rounds: 4 } }) }))
    expect(fallback.next?.setup).toEqual({ rounds: 5 })
  })

  it('begin com pouca gente: avisa e não começa', () => {
    const players = hostCommand({ id: 1, type: 'begin' }, [player(2, { online: false })])
    const result = authorityStep(input({ players }))
    expect(result.next?.g).toBeNull()
    expect(result.next?._cmd).toBe(1)
    expect(result.next?._err).toMatch(/pelo menos 2/)
  })

  it('ignora comando de quem não é host, comando velho e begin com partida rodando', () => {
    const state = running()
    const notHost = [player(1), player(2, { state: { cmd: { id: 5, type: 'end' } } }), player(3)]
    expect(authorityStep(withState(state, { players: notHost })).next).toBeNull()

    const old = hostCommand({ id: 1, type: 'end' })
    expect(authorityStep(withState(state, { players: old })).next).toBeNull()

    const beginAgain = authorityStep(withState(state, { players: hostCommand({ id: 2, type: 'begin' }) })).next!
    expect(beginAgain._cmd).toBe(2)
    expect(beginAgain.g).toEqual(state.g)
  })

  it('skip chega ao motor uma vez só', () => {
    const state = running()
    const players = hostCommand({ id: 2, type: 'skip' })
    const skipped = authorityStep(withState(state, { players })).next!
    expect(skipped.g?.skips).toBe(1)
    expect(skipped._cmd).toBe(2)
    // Mesmo comando ainda no player.state: não repete.
    expect(authorityStep(withState(skipped, { players })).next).toBeNull()
  })

  it('end encerra; replay volta à configuração mantendo as opções', () => {
    const state = running()
    const ended = authorityStep(withState(state, { players: hostCommand({ id: 2, type: 'end' }) })).next!
    expect(ended.g?.over).toBe(true)
    expect(ended.g?.deadline).toBeNull()

    const replay = authorityStep(withState(ended, { players: hostCommand({ id: 3, type: 'replay' }) })).next!
    expect(replay.g).toBeNull()
    expect(replay.setup).toEqual(state.setup)
    expect(replay._cmd).toBe(3)
  })

  it('erro do motor não derruba nada: vira _err e o juiz segue', () => {
    const state = running()
    let broken = true
    const flaky: HalloweenEngine<TestState> = {
      ...testEngine,
      step: (s, ctx) => {
        if (broken) throw new Error('motor quebrou')
        return testEngine.step(s, ctx)
      },
    }
    const failed = authorityStep(withState(state, { engine: flaky }))
    expect(failed.error).toMatch(/motor quebrou/)
    expect(failed.next?._err).toMatch(/motor quebrou/)
    expect(failed.next?.g).toEqual(state.g)

    broken = false
    const healed = authorityStep(withState(failed.next!, { engine: flaky }))
    expect(healed.error).toBeNull()
    expect(healed.next?._err).toBeNull()
  })

  it('resposta de outra partida não vale; resposta sem marca vale', () => {
    const state = running()
    const players = [
      player(1, { state: { m: 'partida-velha', hw: { k: 'p1', vote: 'velho' } } }),
      player(2, { state: { m: state._m, hw: { k: 'p1', vote: 'novo' } } }),
      player(3, { state: { hw: { k: 'p1', vote: 'cru' } } }),
    ]
    const next = authorityStep(withState(state, { players })).next!
    expect(next.g?.votes).toEqual({ 2: 'novo', 3: 'cru' })
  })

  it('a TV toma o contrato do host; o host espera a TV sumir', () => {
    const hostHeld = { ...running(), _auth: { d: HOST.id, u: 110_000 } }
    const tvTakes = authorityStep(withState(hostHeld))
    expect(tvTakes.next?._auth?.d).toBe(TV.id)

    const tvHeld = tvTakes.next!
    expect(authorityStep(withState(tvHeld, { device: HOST })).judge).toBe(false)
    const lateNow = tvHeld._auth!.u + HOST_GRACE_MS
    const hostTakes = authorityStep(withState(tvHeld, { device: HOST, now: lateNow }))
    expect(hostTakes.judge).toBe(true)
    expect(hostTakes.next?._auth?.d).toBe(HOST.id)
  })
})

// --- Uma partida inteira de "Quem Morre Primeiro?" pelo framework -----------

/**
 * Simula o backend em memória: o juiz lê sala + jogadores, grava room.state;
 * os celulares gravam o próprio player.state (marcado com a partida), como o
 * writer faz. No meio, a TV some e o host assume; depois a TV volta.
 */
describe('partida inteira pelo juiz', () => {
  it('chega ao fim com troca de juiz no meio', () => {
    const rng = seededRng(11)
    const players: SyncPlayer[] = [1, 2, 3, 4, 5].map((id) => player(id))
    let roomState: Record<string, unknown> = {}
    let now = 1_000_000
    let tvAlive = true
    let hostFreeSince: number | null = null
    const judges = new Set<string>()

    const judge = (device: JudgeDevice, freeSince: number | null = null) => {
      const result = authorityStep<QmpState>({
        engine: qmpEngine,
        meta: qmpMeta,
        room: { status: 'live', state: roomState, game: { slug: qmpMeta.slug } },
        players,
        full: true,
        now,
        device,
        freeSince,
        rng,
      })
      expect(result.error).toBeNull()
      if (result.next) {
        roomState = JSON.parse(JSON.stringify(result.next)) as Record<string, unknown>
        judges.add(device.id)
      }
    }

    // O host aperta "Começar" com 6 rodadas.
    players[0] = { ...players[0], state: { cmd: { id: 1, type: 'begin', options: { rounds: 6 } } } }

    for (let tick = 0; tick < 2000; tick += 1) {
      const state = readRoomState<QmpState>(roomState)
      if (state.g?.over) break
      // Celulares: votam na fase de votação (em alguém aleatório), com a marca da partida.
      if (state.g?.phase === 'vote') {
        for (const p of players) {
          const hw = (p.state as { hw?: { k: string } } | null)?.hw
          if (hw?.k !== state.g.inputKey && rng() < 0.6) {
            const target = state.g.roster[Math.floor(rng() * state.g.roster.length)]
            p.state = { ...(p.state ?? {}), m: state._m, hw: { k: state.g.inputKey, vote: target } }
          }
        }
      }
      // A TV some entre os ticks 60 e 140 (40 s), e volta depois.
      tvAlive = tick < 60 || tick > 140
      if (tvAlive) judge(TV)
      const auth = readRoomState(roomState)._auth
      if (!auth && hostFreeSince === null) hostFreeSince = now
      judge(HOST, hostFreeSince)
      now += 500
    }

    const final = readRoomState<QmpState>(roomState)
    expect(final.g?.over).toBe(true)
    expect(final.g?.round).toBe(6)
    expect(final.g?.history).toHaveLength(6)
    // TV e host julgaram, e no fim o contrato voltou para a TV.
    expect(judges.has(TV.id)).toBe(true)
    expect(judges.has(HOST.id)).toBe(true)
    expect(final._auth?.d).toBe(TV.id)
    // Todo mundo votou em alguém da partida: toda rodada tem pelo menos um vidente.
    const total = Object.values(final.g?.scores ?? {}).reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThanOrEqual(6)
  })
})
