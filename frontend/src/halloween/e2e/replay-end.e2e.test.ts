import { describe, expect, it } from 'vitest'
import { authorityStep } from '../framework/authority'
import { readRoomState } from '../framework/roomState'
import { engine, type QmpState } from '../games/quem-morre-primeiro/engine'
import { meta } from '../games/quem-morre-primeiro/meta'
import { createServerClock } from '../net/clock'
import { createStateWriter } from '../net/stateWriter'
import { fetchSync, pushRoomState, type SyncFull, type Transport } from '../net/sync'
import { E2E_API, e2eTransport, sleep } from './backend'

/**
 * Ponta a ponta contra um backend de verdade (só roda com a variável; ver
 * ./backend.ts):
 *
 *   HALLOWEEN_E2E_API=http://127.0.0.1:8765 npx vitest run src/halloween/e2e
 *
 * Quatro convidados, uma TV-juíza (authorityStep + sync, sem login) e os
 * celulares gravando pelo writer: uma partida inteira de "Quem Morre
 * Primeiro?" com "Pular", depois "Jogar de novo" (voto velho não vale),
 * "Encerrar" e "Voltar à sala".
 */
const transport = (token?: string): Transport => e2eTransport(token)

describe.skipIf(!E2E_API)('ponta a ponta: jogar de novo, encerrar e voltar à sala (HALLOWEEN_E2E_API)', () => {
  it('partida inteira, jogar de novo, encerrar e voltar à sala', async () => {
    const anon = transport()
    const people: { token: string; t: Transport }[] = []
    for (const name of ['Vlad', 'Cuca', 'Saci', 'Iara']) {
      const { token } = await anon<{ token: string }>('/auth/guest/', { method: 'POST', body: JSON.stringify({ nickname: name }) })
      people.push({ token, t: transport(token) })
    }
    const { code } = await people[0].t<{ code: string }>('/rooms/', { method: 'POST', body: JSON.stringify({ game_slug: meta.slug }) })
    for (const person of people.slice(1)) await person.t(`/rooms/${code}/join/`, { method: 'POST', body: '{}' })
    for (const person of people) {
      await person.t(`/rooms/${code}/ready/`, { method: 'POST', body: JSON.stringify({ ready: true }) })
    }
    await people[0].t(`/rooms/${code}/start/`, { method: 'POST' })

    const clock = createServerClock()
    const writers = people.map((person) => createStateWriter(code, { transport: person.t, retryMs: 50 }))
    let tv: SyncFull | null = null
    let cmdId = 0

    const tvTick = async () => {
      const sentAt = Date.now()
      const res = await fetchSync(code, { v: tv?.v ?? null, tv: true }, anon)
      clock.sample(res.t, sentAt, Date.now())
      if (!res.same) tv = res
      if (!tv) return
      const result = authorityStep<QmpState>({
        engine,
        meta,
        room: tv.room,
        players: tv.players,
        full: true,
        now: clock.now(),
        device: { id: 'tv-e2e.1', kind: 'tv' },
      })
      expect(result.error).toBeNull()
      if (result.next) {
        await pushRoomState(code, result.next as Record<string, unknown>, undefined, { slug: meta.slug, transport: anon })
        tv = { ...tv, room: { ...tv.room, state: result.next as Record<string, unknown> } }
      }
    }
    const roomNow = () => readRoomState<QmpState>(tv?.room.state)

    // Os celulares veem só o próprio state (mine=1) e agem pelo writer.
    const phonesTick = async (act: (index: number, rs: ReturnType<typeof roomNow>) => void) => {
      for (let index = 0; index < people.length; index += 1) {
        const res = await fetchSync(code, { mine: true }, people[index].t)
        if (res.same) continue
        expect(res.players.filter((p) => p.id !== res.me).every((p) => p.state === null)).toBe(true)
        act(index, readRoomState<QmpState>(res.room.state))
      }
    }

    // Configuração → o host aperta "Começar".
    await tvTick()
    void writers[0].write({ cmd: { id: ++cmdId, type: 'begin', options: { rounds: 6 } } })
    const skipped = new Set<string>()
    for (let loop = 0; loop < 400 && !roomNow().g?.over; loop += 1) {
      await sleep(200)
      await tvTick()
      await phonesTick((index, rs) => {
        const g = rs.g
        if (!g) return
        const mine = writers[index].current()
        if (g.phase === 'vote' && (mine.hw?.k !== g.inputKey || mine.m !== rs._m)) {
          void writers[index].write({ m: rs._m, hw: { k: g.inputKey, vote: g.roster[(g.round + index) % 2] } })
        }
        const moment = `${g.round}-${g.phase}`
        if (index === 0 && (g.phase === 'reveal' || g.phase === 'scores') && !skipped.has(moment)) {
          skipped.add(moment)
          cmdId = Math.max(cmdId, rs._cmd ?? 0) + 1
          void writers[0].write({ m: rs._m, cmd: { id: cmdId, type: 'skip' } })
        }
      })
    }
    const final = roomNow()
    expect(final.g?.over).toBe(true)
    expect(final.g?.round).toBe(6)
    expect(final.g?.history).toHaveLength(6)

    // Jogar de novo: um voto velho com a chave da 1ª rodada não pode valer.
    const oldMatch = final._m
    await writers[1].write({ m: oldMatch, hw: { k: 'vote-1', vote: final.g!.roster[0] } })
    await writers[0].write({ m: oldMatch, cmd: { id: ++cmdId, type: 'replay' } })
    for (let i = 0; i < 20 && roomNow().g; i += 1) await sleep(150).then(tvTick)
    expect(roomNow().g).toBeNull()
    expect(roomNow().setup).toEqual({ rounds: 6 })
    await writers[0].write({ m: oldMatch, cmd: { id: ++cmdId, type: 'begin', options: { rounds: 6 } } })
    for (let i = 0; i < 20 && !roomNow().g; i += 1) await sleep(150).then(tvTick)
    await sleep(300).then(tvTick)
    const second = roomNow()
    expect(second.g?.round).toBe(1)
    expect(second._m).not.toBe(oldMatch)
    expect(second.g?.acted).toEqual([])

    // Encerrar e voltar à sala.
    await writers[0].write({ m: second._m, cmd: { id: ++cmdId, type: 'end' } })
    for (let i = 0; i < 20 && !roomNow().g?.over; i += 1) await sleep(150).then(tvTick)
    expect(roomNow().g?.over).toBe(true)
    await people[0].t(`/rooms/${code}/restart/`, { method: 'POST' })
    const lobby = await fetchSync(code, {}, anon)
    expect(!lobby.same && lobby.room.status).toBe('lobby')
    const again = await fetchSync(code, { v: lobby.v }, anon)
    expect(again.same).toBe(true)
  }, 180_000)
})
