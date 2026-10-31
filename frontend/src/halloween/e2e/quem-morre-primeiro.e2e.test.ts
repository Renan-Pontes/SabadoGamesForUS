import { describe, expect, it } from 'vitest'
import { seededRng } from '../engine/helpers'
import type { EngineCtx } from '../engine/types'
import { authorityStep } from '../framework/authority'
import { readRoomState, toHPlayers } from '../framework/roomState'
import { decideFx } from '../fx/decide'
import type { RoomFx } from '../fx/api'
import { engine, type QmpReveal, type QmpState } from '../games/quem-morre-primeiro/engine'
import { meta } from '../games/quem-morre-primeiro/meta'
import { createServerClock } from '../net/clock'
import { createStateWriter, type StateWriter } from '../net/stateWriter'
import { fetchSync, pushRoomState, type SyncFull, type SyncResponse, type Transport } from '../net/sync'
import { createGuest, E2E_API, e2eTransport, sleep, type Guest } from './backend'

/**
 * Ponta a ponta de verdade, do jeito da festa: 15 convidados entram só com o
 * apelido, o host abre uma sala do "Quem Morre Primeiro?", todo mundo entra
 * e fica pronto, o host dá start — e daí em diante quem manda é a TV-juíza
 * (`authorityStep`, anônima, com `tv=1`) e os celulares, cada um gravando a
 * própria resposta por POST state/ (pelo writer do app), inclusive o
 * "Começar" do host. Só roda com HALLOWEEN_E2E_API (ver ./backend.ts).
 *
 * Confere: o "same" barato do sync, `mine=1` escondendo o state dos outros,
 * a versão subindo a cada gravação, o placar final batendo com os votos
 * gravados e o fx do host chegando à TV.
 */

const PLAYERS = 15
const ROUNDS = 6
const TV_DEVICE = 'tv-e2e.integracao'
/** Rodada em que ninguém aperta "Pular": revelação e placar andam pelo prazo. */
const NATURAL_ROUND = 1
const NICKNAMES = [
  'Vlad', 'Mortícia', 'Cuca', 'Saci', 'Iara', 'Wandinha', 'Frank', 'Múmia',
  'Chuck', 'Samara', 'Freddy', 'Bruxa', 'Corvo', 'Zumbi', 'Zumbi',
]

type Phone = {
  guest: Guest
  playerId: number
  writer: StateWriter
  rng: () => number
  v: number | null
  view: SyncFull | null
  /** `${partida}:${inputKey}` já respondidos. */
  answered: Set<string>
}

/** Conta os POST state/ de cada celular (cada um sobe a versão da sala). */
function countingTransport(inner: Transport, counter: { statePosts: number }): Transport {
  return async <T>(path: string, init?: RequestInit) => {
    const result = await inner<T>(path, init)
    if (init?.method === 'POST' && path.endsWith('/state/')) counter.statePosts += 1
    return result
  }
}

function full(response: SyncResponse): SyncFull {
  if (response.same) throw new Error(`esperava sync completo, veio same (v=${response.v})`)
  return response
}

describe.skipIf(!E2E_API)(`ponta a ponta: ${PLAYERS} convidados contra o backend (HALLOWEEN_E2E_API)`, () => {
  it('convidados → sala → start → TV-juíza + celulares até o fim, com placar coerente', async () => {
    const anon = e2eTransport()
    const counter = { statePosts: 0 }

    // --- 15 convidados (a correria do QR code: todos ao mesmo tempo) -------
    const guests = await Promise.all(NICKNAMES.slice(0, -1).map((nick) => createGuest(nick)))
    // O apelido repetido entra depois, para o "Zumbi 2" ser determinístico.
    guests.push(await createGuest(NICKNAMES[NICKNAMES.length - 1]))
    expect(guests).toHaveLength(PLAYERS)
    expect(new Set(guests.map((g) => g.token)).size).toBe(PLAYERS)
    const zumbis = guests.slice(-2).map((g) => g.nickname)
    expect(zumbis[1]).not.toBe(zumbis[0])
    expect(zumbis[1]).toMatch(/^Zumbi \d+$/)

    // --- sala, entrada, pronto e start ----------------------------------------
    const host = guests[0]
    const created = await host.t<{ code: string }>('/rooms/', {
      method: 'POST',
      body: JSON.stringify({ game_slug: meta.slug }),
    })
    const code = created.code
    expect(code).toBeTruthy()
    const joined = await Promise.all(
      guests.slice(1).map((g) => g.t<{ player: { id: number } }>(`/rooms/${code}/join/`, { method: 'POST', body: '{}' })),
    )
    expect(joined.every((j) => typeof j.player.id === 'number')).toBe(true)
    await Promise.all(
      guests.map((g) => g.t(`/rooms/${code}/ready/`, { method: 'POST', body: JSON.stringify({ ready: true }) })),
    )
    const started = await host.t<{ status: string; state: unknown }>(`/rooms/${code}/start/`, { method: 'POST' })
    expect(started.status).toBe('live')
    expect(started.state).toEqual({})

    // --- a TV liga (anônima, tv=1) --------------------------------------------
    const clock = createServerClock()
    const rng = seededRng(2026)
    const tvSync = async (v: number | null) => {
      const sentAt = Date.now()
      const response = await fetchSync(code, { v, tv: true }, anon)
      clock.sample(response.t, sentAt, Date.now())
      return response
    }
    let tv = full(await tvSync(null))
    expect(tv.me).toBeNull()
    expect(tv.room.status).toBe('live')
    expect(tv.room.game?.slug).toBe(meta.slug)
    expect(tv.players).toHaveLength(PLAYERS)
    expect(tv.players.every((p) => p.ready)).toBe(true)
    expect(tv.players.every((p) => p.state !== null && Object.keys(p.state).length === 0)).toBe(true)
    expect(new Set(tv.players.map((p) => p.name)).size).toBe(PLAYERS)
    const firstV = tv.v

    // "same": nada mudou desde a última foto → resposta barata, mesma versão.
    const quiet = await tvSync(tv.v)
    expect(quiet).toEqual({ same: true, v: tv.v, t: expect.any(Number) })
    tv = full(await tvSync(null))
    expect(tv.room.tv_connected).toBe(true)

    // --- os celulares (mine=1) --------------------------------------------------
    const idOf = new Map(tv.players.map((p) => [p.name, p.id]))
    const phones: Phone[] = guests.map((guest, index) => {
      const playerId = idOf.get(guest.nickname)
      if (playerId === undefined) throw new Error(`${guest.nickname} não apareceu na sala`)
      return {
        guest,
        playerId,
        writer: createStateWriter(code, { transport: countingTransport(guest.t, counter), retryMs: 100 }),
        rng: seededRng(100 + index),
        v: null,
        view: null,
        answered: new Set(),
      }
    })
    expect(tv.players.find((p) => p.id === phones[0].playerId)?.is_host).toBe(true)

    let phoneFull = 0
    let phoneSame = 0
    const phoneSync = async (phone: Phone) => {
      const response = await fetchSync(code, { v: phone.v, mine: true }, phone.guest.t)
      if (response.same) {
        phoneSame += 1
        expect(response.v).toBe(phone.v)
        return
      }
      phoneFull += 1
      // mine=1: o meu state vem cheio, o dos outros vem null.
      expect(response.me).toBe(phone.playerId)
      for (const player of response.players) {
        if (player.id === phone.playerId) expect(player.state).not.toBeNull()
        else expect(player.state).toBeNull()
      }
      if (phone.v !== null) expect(response.v).toBeGreaterThan(phone.v)
      phone.v = response.v
      phone.view = response
    }

    // Um celular em silêncio também recebe "same".
    await phoneSync(phones[3])
    const before = phones[3].v
    await phoneSync(phones[3])
    expect(phones[3].v).toBe(before)
    expect(phoneSame).toBe(1)

    // --- o juiz -----------------------------------------------------------------
    const tvVersions: number[] = [tv.v]
    const pushedVersions: number[] = []
    const reveals: Record<number, QmpReveal> = {}
    let tvSame = 0
    const judgeErrors: string[] = []

    const judge = async () => {
      const result = authorityStep<QmpState>({
        engine,
        meta,
        room: tv.room,
        players: tv.players,
        full: true,
        now: clock.now(),
        device: { id: TV_DEVICE, kind: 'tv' },
        rng,
      })
      expect(result.judge).toBe(true)
      if (result.error) judgeErrors.push(result.error)
      if (!result.next) return null
      const g = result.next.g ?? null
      if (g?.phase === 'reveal' && g.reveal) reveals[g.round] = g.reveal
      const written = await pushRoomState(code, result.next as Record<string, unknown>, undefined, {
        slug: meta.slug,
        transport: anon,
      })
      // A versão sobe a cada gravação; com a sala parada, exatamente +1.
      expect(written.v).toBeGreaterThan(tv.v)
      pushedVersions.push(written.v)
      const adopt = written.v === tv.v + 1
      tv = { ...tv, v: adopt ? written.v : tv.v, room: { ...tv.room, state: result.next as Record<string, unknown> } }
      return { written, adopted: adopt }
    }

    const tvTick = async () => {
      const response = await tvSync(tv.v)
      if (response.same) tvSame += 1
      else {
        expect(response.v).toBeGreaterThan(tv.v)
        tv = response
        tvVersions.push(tv.v)
      }
      await judge()
    }
    const roomNow = () => readRoomState<QmpState>(tv.room.state)

    // Configuração: a TV assume o contrato e grava (a sala está quieta: +1).
    const claimed = await judge()
    expect(claimed?.adopted).toBe(true)
    expect(roomNow()._auth?.d).toBe(TV_DEVICE)
    expect(roomNow().g).toBeNull()

    // O host aperta "Começar": POST state/ com o comando sobe a versão.
    const vBeforeBegin = full(await tvSync(null)).v
    await phones[0].writer.write({ cmd: { id: 1, type: 'begin', options: { rounds: ROUNDS } } })
    tv = full(await tvSync(tv.v))
    expect(tv.v).toBe(vBeforeBegin + 1)
    expect(tv.players.find((p) => p.id === phones[0].playerId)?.state).toMatchObject({ cmd: { type: 'begin' } })
    const began = await judge()
    expect(began?.written.v).toBe(vBeforeBegin + 2)
    const opening = roomNow()
    expect(opening._cmd).toBe(1)
    expect(opening._m).toBeTruthy()
    expect(opening.setup).toEqual({ rounds: ROUNDS })
    expect(opening.g?.phase).toBe('vote')
    expect(opening.g?.round).toBe(1)
    expect(opening.g?.roster).toHaveLength(PLAYERS)

    // --- a partida ----------------------------------------------------------------
    const sentVotes: Record<number, Record<string, number>> = {}
    const skipped = new Set<string>()
    let cmdId = 1

    const act = async (phone: Phone, index: number) => {
      const view = phone.view
      if (!view) return
      const rs = readRoomState<QmpState>(view.room.state)
      const g = rs.g
      if (!g || g.over) return
      if (g.phase === 'vote' && g.roster.includes(phone.playerId)) {
        const key = `${rs._m}:${g.inputKey}`
        if (phone.answered.has(key)) return
        const ctx: EngineCtx = {
          players: toHPlayers(view.players),
          inputs: {},
          slots: {},
          command: null,
          now: clock.now(),
          rng: phone.rng,
          options: rs.setup ?? {},
        }
        const answer = engine.bot(g, phone.playerId, ctx)
        if (!answer) return
        phone.answered.add(key)
        sentVotes[g.round] = { ...(sentVotes[g.round] ?? {}), [String(phone.playerId)]: answer.vote as number }
        await phone.writer.write({ m: rs._m, hw: { ...answer, k: g.inputKey } })
        return
      }
      // O host aperta "Pular" na revelação e no placar (menos na rodada natural).
      const moment = `${g.round}-${g.phase}`
      if (index === 0 && (g.phase === 'reveal' || g.phase === 'scores') && g.round !== NATURAL_ROUND && !skipped.has(moment)) {
        skipped.add(moment)
        cmdId = Math.max(cmdId, rs._cmd ?? 0) + 1
        await phone.writer.write({ m: rs._m, cmd: { id: cmdId, type: 'skip' } })
      }
    }

    const matchStart = Date.now()
    while (!roomNow().g?.over) {
      if (Date.now() - matchStart > 150_000) throw new Error(`a partida não acabou: ${JSON.stringify(roomNow().g?.phase)}`)
      await tvTick()
      await Promise.all(phones.map((phone) => phoneSync(phone)))
      await Promise.all(phones.map((phone, index) => act(phone, index)))
      await sleep(120)
    }
    await tvTick()

    // --- o fim ------------------------------------------------------------------------
    expect(judgeErrors).toEqual([])
    const final = roomNow()
    const g = final.g as QmpState
    expect(g.over).toBe(true)
    expect(g.phase).toBe('final')
    expect(g.round).toBe(ROUNDS)
    expect(g.totalRounds).toBe(ROUNDS)
    expect(g.history).toHaveLength(ROUNDS)
    expect(Object.keys(reveals).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])

    // Cada voto gravado por POST state/ chegou ao juiz, rodada por rodada.
    for (let round = 1; round <= ROUNDS; round += 1) {
      expect(reveals[round].votes).toEqual(sentVotes[round])
      expect(Object.keys(reveals[round].votes)).toHaveLength(PLAYERS)
    }

    // Placar coerente: recontado aqui, à mão (sem os helpers do motor), a
    // partir dos votos que os celulares mandaram.
    const byId = (a: number, b: number) => a - b
    const expected: Record<string, number> = Object.fromEntries(g.roster.map((id) => [String(id), 0]))
    const expectedDeaths: Record<string, number> = Object.fromEntries(g.roster.map((id) => [String(id), 0]))
    for (let round = 1; round <= ROUNDS; round += 1) {
      const votes = sentVotes[round]
      const received: Record<string, number> = {}
      for (const target of Object.values(votes)) received[target] = (received[target] ?? 0) + 1
      const most = Math.max(...Object.values(received))
      const dead = Object.keys(received).filter((target) => received[target] === most).map(Number).sort(byId)
      const seers = Object.keys(votes).filter((voter) => dead.includes(votes[voter])).map(Number).sort(byId)
      expect([...reveals[round].dead].sort(byId)).toEqual(dead)
      expect([...g.history[round - 1].dead].sort(byId)).toEqual(dead)
      expect([...reveals[round].seers].sort(byId)).toEqual(seers)
      for (const id of seers) expected[String(id)] += 1
      for (const id of dead) expectedDeaths[String(id)] += 1
    }
    expect(g.scores).toEqual(expected)
    expect(g.deaths).toEqual(expectedDeaths)
    const total = Object.values(g.scores).reduce((sum, value) => sum + value, 0)
    expect(total).toBe(Object.values(reveals).reduce((sum, reveal) => sum + reveal.seers.length, 0))
    for (const id of g.roster) {
      expect(Number.isInteger(g.scores[String(id)])).toBe(true)
      expect(g.scores[String(id)]).toBeGreaterThanOrEqual(0)
      expect(g.scores[String(id)]).toBeLessThanOrEqual(ROUNDS)
    }

    // A TV (sem mine) recebe o state de todo mundo: os 15 votaram.
    expect(tv.players.every((p) => p.state && typeof p.state === 'object' && 'hw' in p.state)).toBe(true)

    // Os celulares também veem o fim (com mine=1).
    await Promise.all(phones.map((phone) => phoneSync(phone)))
    expect(phones.every((phone) => readRoomState<QmpState>(phone.view?.room.state).g?.over)).toBe(true)

    // A versão só subiu: cada gravação do juiz e cada POST state/ conta +1.
    for (let i = 1; i < tvVersions.length; i += 1) expect(tvVersions[i]).toBeGreaterThan(tvVersions[i - 1])
    for (let i = 1; i < pushedVersions.length; i += 1) expect(pushedVersions[i]).toBeGreaterThan(pushedVersions[i - 1])
    const lastV = full(await tvSync(null)).v
    expect(lastV - firstV).toBeGreaterThanOrEqual(pushedVersions.length + counter.statePosts)
    // O poll barato funcionou dos dois lados.
    expect(tvSame).toBeGreaterThan(0)
    expect(phoneSame).toBeGreaterThan(1)
    expect(phoneFull).toBeGreaterThan(PLAYERS)
    console.info(
      `[e2e] sala ${code}: v ${firstV}→${lastV}, ${pushedVersions.length} gravações do juiz, ` +
        `${counter.statePosts} POST state/, TV ${tvSame} same / ${tvVersions.length} completos, ` +
        `celulares ${phoneSame} same / ${phoneFull} completos, ${Math.round((Date.now() - matchStart) / 1000)} s de partida, ` +
        `placar ${JSON.stringify(g.scores)}`,
    )

    // --- efeitos do host chegam à TV ----------------------------------------------------
    const victim = guests[4].nickname
    const sent = await host.t<{ fx: RoomFx; v: number; t: number }>(`/rooms/${code}/fx/`, {
      method: 'POST',
      body: JSON.stringify({ scare: 'zoom', name: victim }),
    })
    expect(sent.fx).toMatchObject({ scare: 'zoom', name: victim })
    expect(sent.v).toBeGreaterThan(lastV)
    const polled = await anon<{ fx: RoomFx; t: number }>(`/rooms/${code}/fx/`)
    expect(polled.fx.id).toBe(sent.fx.id)
    expect(decideFx(polled.fx, polled.t, null).actions).toEqual([{ type: 'scare', kind: 'zoom', name: victim }])
    expect(decideFx(polled.fx, polled.t, polled.fx.id).actions).toEqual([])

    // --- "Voltar à sala": lobby, e o "same" continua barato -------------------------------
    await host.t(`/rooms/${code}/restart/`, { method: 'POST' })
    const lobby = full(await tvSync(null))
    expect(lobby.room.status).toBe('lobby')
    expect(lobby.room.state).toEqual({})
    expect(lobby.players.every((p) => p.ready)).toBe(true)
    expect((await tvSync(lobby.v)).same).toBe(true)

    // Juiz atrasado: o host trocou de jogo. O motor velho larga a sala e o
    // backend recusa a gravação com 409 (o hook para de gravar e navega).
    await host.t(`/rooms/${code}/change_game/`, { method: 'POST', body: JSON.stringify({ game_slug: 'quiz-do-terror' }) })
    const moved = full(await tvSync(lobby.v))
    expect(moved.room.game?.slug).toBe('quiz-do-terror')
    const late = authorityStep<QmpState>({
      engine,
      meta,
      room: moved.room,
      players: moved.players,
      full: true,
      now: clock.now(),
      device: { id: TV_DEVICE, kind: 'tv' },
    })
    expect(late.next).toBeNull()
    await expect(
      pushRoomState(code, { g: null }, undefined, { slug: meta.slug, transport: anon }),
    ).rejects.toMatchObject({ status: 409 })
  }, 240_000)
})
