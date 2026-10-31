import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { EngineCtx, HInput } from '../../engine/types'
import { CORRIDORS, IMPATIENT_LINES, MONSTERS, SALVATION_LINES } from './content'
import {
  CHOOSE_SECONDS,
  IMPATIENT_FROM,
  MAX_ROUNDS,
  STATUS_SECONDS,
  chooseMonsterDoors,
  doorsFor,
  engine,
  finalStanding,
  ghostsOf,
  nextRoundSetup,
  openingOrder,
  roundSetup,
  validDoor,
  type State,
} from './engine'
import { meta } from './meta'
import { revealSchedule } from './timeline'

const NOW = 1_000_000

/** Começa uma partida com `n` jogadores (1..n). */
function start(n = 5, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** Uma rodada 2 em que `ghosts` já morreram na rodada 1 (portas e monstros pelos vivos). */
function withGhosts(n: number, ghosts: number[], extra: Partial<State> = {}): State {
  const { state } = start(n)
  const alive = state.roster.filter((id) => !ghosts.includes(id))
  const setup = roundSetup(alive.length, 2)
  return {
    ...state,
    round: 2,
    inputKey: 'door-2',
    alive,
    diedIn: Object.fromEntries(ghosts.map((id) => [String(id), 1])),
    doors: setup.doors,
    monsters: setup.monsters,
    extraMonsters: setup.extra,
    ...extra,
  }
}

/** ctx com as portas `{ jogador: porta }` da rodada atual. */
function doorsCtx(state: State, doors: Record<number, unknown>, extra: Partial<EngineCtx> = {}): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, door] of Object.entries(doors)) inputs[Number(id)] = { k: state.inputKey, door }
  return makeCtx({ players: makePlayers(Math.max(1, ...state.roster)), now: NOW + 1000, inputs, ...extra })
}

describe('início', () => {
  it('abre a escolha da rodada 1 com prazo e folga, todo mundo vivo', () => {
    const { state } = start(5)
    expect(state.phase).toBe('choose')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(MAX_ROUNDS)
    expect(state.inputKey).toBe('door-1')
    expect(state.deadline).toBe(NOW + CHOOSE_SECONDS * 1000 + GRACE_MS)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.alive).toEqual([1, 2, 3, 4, 5])
    expect(state.doors).toBe(4)
    expect(state.monsters).toBe(1)
    expect(state.extraMonsters).toBe(0)
    expect(state.reveal).toBeNull()
    expect(state.private).toEqual({})
    expect(CORRIDORS).toContain(state.corridor)
    expect(state.over).toBe(false)
  })

  it('roster é quem está online no começo', () => {
    const ctx = makeCtx({ players: makePlayers(5, { offline: [2, 4] }), now: NOW })
    const state = engine.init(ctx)
    expect(state.roster).toEqual([1, 3, 5])
    expect(state.alive).toEqual([1, 3, 5])
  })

  it('sem opções na configuração: o padrão do meta funciona', () => {
    expect(meta.options).toEqual([])
    expect(engine.init(makeCtx({ players: makePlayers(4), options: optionDefaults(meta.options) })).phase).toBe('choose')
  })

  it('corredores sorteados sem repetir', () => {
    const { state } = start(4)
    expect(state.corridorDeck).toHaveLength(Math.min(MAX_ROUNDS, CORRIDORS.length))
    expect(new Set(state.corridorDeck).size).toBe(state.corridorDeck.length)
  })
})

describe('portas e monstros', () => {
  it('3 portas até 4 vivos, 4 até 8, 5 com 9 ou mais', () => {
    expect([1, 2, 3, 4].map(doorsFor)).toEqual([3, 3, 3, 3])
    expect([5, 6, 7, 8].map(doorsFor)).toEqual([4, 4, 4, 4])
    expect([9, 10, 12, 15].map(doorsFor)).toEqual([5, 5, 5, 5])
  })

  it('dois monstros com 10+ vivos', () => {
    expect(roundSetup(9, 1)).toEqual({ doors: 5, monsters: 1, extra: 0 })
    expect(roundSetup(10, 1)).toEqual({ doors: 5, monsters: 2, extra: 0 })
    expect(roundSetup(15, 1)).toEqual({ doors: 5, monsters: 2, extra: 0 })
    expect(start(15).state.monsters).toBe(2)
    expect(start(9).state.monsters).toBe(1)
  })

  it(`o além fica impaciente da rodada ${IMPATIENT_FROM} em diante, mas sempre sobra uma porta segura`, () => {
    expect(roundSetup(6, IMPATIENT_FROM - 1)).toEqual({ doors: 4, monsters: 1, extra: 0 })
    expect(roundSetup(6, IMPATIENT_FROM)).toEqual({ doors: 4, monsters: 2, extra: 1 })
    expect(roundSetup(6, IMPATIENT_FROM + 1)).toEqual({ doors: 4, monsters: 3, extra: 2 })
    expect(roundSetup(6, IMPATIENT_FROM + 5)).toEqual({ doors: 4, monsters: 3, extra: 2 })
    expect(roundSetup(15, IMPATIENT_FROM + 1)).toEqual({ doors: 5, monsters: 4, extra: 2 })
    expect(roundSetup(2, IMPATIENT_FROM)).toEqual({ doors: 3, monsters: 2, extra: 1 })
    expect(roundSetup(2, MAX_ROUNDS)).toEqual({ doors: 3, monsters: 2, extra: 1 })
    for (let alive = 1; alive <= 15; alive += 1) {
      for (let round = 1; round <= MAX_ROUNDS; round += 1) {
        const setup = roundSetup(alive, round)
        expect(setup.monsters).toBeGreaterThanOrEqual(1)
        expect(setup.monsters).toBeLessThan(setup.doors)
      }
    }
  })

  it('porta válida: só inteiro de 1 até o número de portas', () => {
    expect(validDoor(1, 3)).toBe(1)
    expect(validDoor(3, 3)).toBe(3)
    for (const bad of [0, 4, -1, 2.5, '2', null, undefined, NaN, 1e9, 'porta 1', {}, [2]]) {
      expect(validDoor(bad, 3)).toBeNull()
    }
  })
})

describe('escolha', () => {
  it('atualiza os ✓ sem revelar e devolve o mesmo estado quando nada muda', () => {
    const { state } = start(5)
    const ctx = doorsCtx(state, { 1: 2, 3: 4 })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('choose')
    expect(next.acted).toEqual([1, 3])
    expect(next.reveal).toBeNull()
    expect(engine.step(next, ctx)).toBe(next)
  })

  it('porta inválida, de outra rodada ou de espectador não conta como escolha', () => {
    const { state } = start(4)
    const ctx = makeCtx({
      players: makePlayers(6),
      now: NOW + 1000,
      inputs: {
        1: { k: state.inputKey, door: 99 }, // porta que não existe
        2: { k: 'door-0', door: 1 }, // outra rodada
        3: { k: state.inputKey, door: '2' }, // lixo
        4: { k: state.inputKey, door: 3 }, // vale
        5: { k: state.inputKey, door: 1 }, // espectador (entrou depois)
      },
    })
    const next = engine.step(state, ctx)
    expect(next.phase).toBe('choose')
    expect(next.acted).toEqual([4])
  })

  it('todo mundo online escolheu: revela na hora; offline não segura', () => {
    const { state } = start(4)
    expect(engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3, 4: 1 })).phase).toBe('reveal')
    const ctx = doorsCtx(state, { 1: 1, 2: 2, 3: 3 }, { players: makePlayers(4, { offline: [4] }) })
    expect(engine.step(state, ctx).phase).toBe('reveal')
  })

  it('quem entrou no meio (online, fora do roster) e fantasma caído não seguram a escolha', () => {
    const state = withGhosts(5, [5])
    // 6 entrou depois (espectador, online); o fantasma 5 caiu (offline).
    const players = makePlayers(6, { offline: [5] })
    const next = engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3, 4: 1 }, { players }))
    expect(next.phase).toBe('reveal')
    expect(Object.keys(next.reveal!.picks)).toEqual(['1', '2', '3', '4'])
  })

  it('espera o prazo (com a folga) quando falta alguém online', () => {
    const { state } = start(4)
    const ctx = doorsCtx(state, { 1: 1, 2: 2 })
    expect(engine.step(state, { ...ctx, now: state.deadline! - 1 }).phase).toBe('choose')
    expect(engine.step(state, { ...ctx, now: state.deadline! }).phase).toBe('reveal')
  })

  it('fantasmas também precisam votar para a escolha acabar antes do prazo', () => {
    const state = withGhosts(5, [4, 5])
    expect(engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3 })).phase).toBe('choose')
    expect(engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3, 4: 1, 5: 2 })).phase).toBe('reveal')
  })

  it('fantasmas veem no celular quantos votos cada porta tem; vivos não recebem nada', () => {
    const state = withGhosts(6, [5, 6])
    expect(state.doors).toBe(3)
    const next = engine.step(state, doorsCtx(state, { 1: 2, 5: 3 }))
    expect(next.private).toEqual({ 5: { votes: [0, 0, 1] }, 6: { votes: [0, 0, 1] } })
    // O voto do vivo (porta 2) não entra no placar dos fantasmas.
    const again = engine.step(next, doorsCtx(state, { 1: 2, 5: 3 }))
    expect(again).toBe(next)
    const changed = engine.step(next, doorsCtx(state, { 1: 2, 5: 3, 6: 3 }))
    expect(changed.private['5']).toEqual({ votes: [0, 0, 2] })
    expect(changed.acted).toEqual([1, 5, 6])
  })

  it('segredo: o estado público não muda com QUAL porta cada um escolheu, só com quem já escolheu', () => {
    const state = withGhosts(7, [6, 7])
    const a = engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3, 6: 1 }))
    const b = engine.step(state, doorsCtx(state, { 1: 4, 2: 4, 3: 1, 6: 3 }))
    const pub = (s: State) => JSON.stringify({ ...s, private: null })
    expect(a.acted).toEqual([1, 2, 3, 6])
    expect(pub(a)).toBe(pub(b))
    // O placar dos fantasmas (com os votos) só vai para o private deles.
    expect(a.private['6']).not.toEqual(b.private['6'])
    expect(Object.keys(a.private)).toEqual(['6', '7'])
  })

  it('a porta mais recente vale (dá para trocar)', () => {
    const state = withGhosts(4, [4])
    const first = engine.step(state, doorsCtx(state, { 1: 1 }))
    const next = engine.step(first, doorsCtx(state, { 1: 3, 2: 2, 3: 1, 4: 3 }))
    expect(next.reveal?.picks).toEqual({ 1: 3, 2: 2, 3: 1 })
    expect(next.reveal?.monsterDoors).toEqual([3])
    expect(next.reveal?.victims).toEqual([1])
  })
})

describe('revelação', () => {
  it('a porta mais votada pelos fantasmas ganha o monstro; quem estava lá vira fantasma', () => {
    const state = withGhosts(5, [4, 5])
    const next = engine.step(state, doorsCtx(state, { 1: 2, 2: 1, 3: 3, 4: 2, 5: 2 }))
    expect(next.phase).toBe('reveal')
    const reveal = next.reveal!
    expect(reveal.monsterDoors).toEqual([2])
    expect(reveal.victims).toEqual([1])
    expect(reveal.saved).toBe(false)
    expect(reveal.ghostVotes).toEqual({ 4: 2, 5: 2 })
    expect(reveal.hunters).toEqual({ 4: 1, 5: 1 })
    expect(reveal.beasts).toHaveLength(1)
    expect(MONSTERS).toContainEqual(reveal.beasts[0])
    expect(next.alive).toEqual([2, 3])
    expect(next.diedIn).toEqual({ 1: 2, 4: 1, 5: 1 })
    expect(next.souls).toEqual({ 4: 1, 5: 1 })
    expect(ghostsOf(next)).toEqual([1, 4, 5])
    expect(next.private).toEqual({})
  })

  it('cada fantasma leva as almas da porta em que votou (quem votou na porta errada, nada)', () => {
    // 10 vivos → 5 portas e 2 monstros; 3 fantasmas.
    const state = withGhosts(13, [11, 12, 13])
    expect(state.doors).toBe(5)
    expect(state.monsters).toBe(2)
    const doors = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 1, 12: 3, 13: 1 }
    const next = engine.step(state, doorsCtx(state, doors))
    const reveal = next.reveal!
    expect(reveal.monsterDoors).toEqual([1, 3])
    expect(reveal.victims).toEqual([1, 2, 3, 5, 6])
    expect(reveal.hunters).toEqual({ 11: 3, 12: 2, 13: 3 })
    expect(next.souls).toEqual({ 11: 3, 12: 2, 13: 3 })
    expect(next.alive).toEqual([4, 7, 8, 9, 10])
  })

  it('com dois monstros, as duas portas mais votadas; empate é sorteado', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 60; seed += 1) {
      // Porta 4 tem 3 votos; 1 e 2 empatam com 1 voto: a segunda é sorteada entre elas.
      const doors = chooseMonsterDoors({ 11: 4, 12: 4, 13: 4, 14: 1, 15: 2 }, 5, 2, seededRng(seed))
      expect(doors).toHaveLength(2)
      expect(doors).toContain(4)
      expect([1, 2]).toContain(doors.find((door) => door !== 4))
      seen.add(doors.join(','))
    }
    expect(seen).toEqual(new Set(['1,4', '2,4']))
  })

  it('sem fantasma (ou sem voto), as portas do monstro são sorteadas', () => {
    const seen = new Set<number>()
    for (let seed = 1; seed <= 60; seed += 1) {
      const [door] = chooseMonsterDoors({}, 3, 1, seededRng(seed))
      expect([1, 2, 3]).toContain(door)
      seen.add(door)
    }
    expect(seen.size).toBe(3)
    // Voto inválido é ignorado.
    expect(chooseMonsterDoors({ 9: 7 }, 3, 1, seededRng(3))).toHaveLength(1)
  })

  it('salvação: se TODOS os vivos estão atrás de porta com monstro, ninguém morre', () => {
    const state = withGhosts(4, [4])
    const next = engine.step(state, doorsCtx(state, { 1: 2, 2: 2, 3: 2, 4: 2 }))
    const reveal = next.reveal!
    expect(reveal.monsterDoors).toEqual([2])
    expect(reveal.saved).toBe(true)
    expect(reveal.victims).toEqual([])
    expect(SALVATION_LINES).toContain(reveal.salvation)
    expect(reveal.hunters).toEqual({})
    expect(next.alive).toEqual([1, 2, 3])
    expect(next.souls).toEqual({})
  })

  it('salvação também com dois monstros e os vivos espalhados nas duas portas', () => {
    const state = withGhosts(13, [11, 12, 13])
    const doors = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 1, 12: 3, 13: 3 }
    const next = engine.step(state, doorsCtx(state, doors))
    expect(next.reveal?.monsterDoors).toEqual([1, 3])
    expect(next.reveal?.saved).toBe(true)
    expect(next.alive).toHaveLength(10)
  })

  it('monstro numa porta vazia: ninguém morre, sem salvação', () => {
    const state = withGhosts(4, [4])
    const next = engine.step(state, doorsCtx(state, { 1: 1, 2: 1, 3: 2, 4: 3 }))
    expect(next.reveal?.monsterDoors).toEqual([3])
    expect(next.reveal?.victims).toEqual([])
    expect(next.reveal?.saved).toBe(false)
    expect(next.reveal?.salvation).toBe('')
    expect(next.alive).toEqual([1, 2, 3])
  })

  it('quem não escolheu (ou mandou lixo) cai numa porta sorteada', () => {
    const { state } = start(4)
    const next = engine.step(state, { ...doorsCtx(state, { 1: 2, 2: 0, 3: 'porta 1' }), now: state.deadline! })
    const reveal = next.reveal!
    expect(reveal.autoPicked).toEqual([2, 3, 4])
    for (const id of [1, 2, 3, 4]) expect([1, 2, 3]).toContain(reveal.picks[String(id)])
    expect(reveal.picks['1']).toBe(2)
  })

  it('fantasma não se esconde atrás de porta: o voto dele é só onde o monstro ataca', () => {
    const state = withGhosts(4, [4])
    const next = engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 2, 4: 1 }))
    expect(next.reveal?.picks).toEqual({ 1: 1, 2: 2, 3: 2 })
    expect(next.reveal?.ghostVotes).toEqual({ 4: 1 })
    expect(next.reveal?.victims).toEqual([1])
    expect(next.alive).toEqual([2, 3])
  })

  it('portas abrem: seguras primeiro (vazias antes das cheias) e as do monstro por último', () => {
    expect(openingOrder(4, [2], { 1: 1, 2: 1, 3: 3, 4: 3, 5: 3 })).toEqual([4, 1, 3, 2])
    expect(openingOrder(5, [1, 4], { 1: 1, 2: 1, 3: 4 })).toEqual([2, 3, 5, 4, 1])
    const state = withGhosts(5, [4, 5])
    const next = engine.step(state, doorsCtx(state, { 1: 2, 2: 1, 3: 1, 4: 3, 5: 3 }))
    expect(next.reveal?.order).toEqual([2, 1, 3])
  })

  it('o prazo da revelação segue a agenda das portas; susto só no primeiro sangue e no golpe final', () => {
    const { state } = start(3)
    const first = engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 3 }, { rng: seededRng(5) }))
    const reveal = first.reveal!
    const schedule = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
    expect(reveal.startedAt).toBe(NOW + 1000)
    expect(first.deadline).toBe(NOW + 1000 + schedule.total)
    // Um morreu (cada vivo numa porta) e foi o primeiro da partida.
    expect(reveal.victims).toHaveLength(1)
    expect(reveal.scare).toBe('first-blood')

    // Segunda morte, ainda com dois vivos: nem primeiro sangue nem golpe final.
    const mid = withGhosts(4, [4])
    const quiet = engine.step(mid, doorsCtx(mid, { 1: 1, 2: 2, 3: 3, 4: 1 }))
    expect(quiet.reveal?.victims).toEqual([1])
    expect([null, 'surprise']).toContain(quiet.reveal?.scare)
    expect(quiet.reveal?.last).toBe(false)

    // Golpe final: sobra um vivo.
    const end = withGhosts(4, [3, 4])
    const blow = engine.step(end, doorsCtx(end, { 1: 1, 2: 2, 3: 1, 4: 1 }))
    expect(blow.reveal?.victims).toEqual([1])
    expect(blow.reveal?.scare).toBe('final')
    expect(blow.reveal?.last).toBe(true)
  })
})

describe('susto surpresa', () => {
  it('às vezes (≈1 em 3) o monstro vem com susto de meme no meio da partida — só quando alguém morre', () => {
    const seen: Record<string, number> = {}
    for (let seed = 1; seed <= 90; seed += 1) {
      // Rodada 2: 5 vivos, o fantasma 6 manda o monstro para a porta 1, onde só está o 1.
      const mid = withGhosts(6, [6])
      const next = engine.step(mid, doorsCtx(mid, { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 1 }, { rng: seededRng(seed) }))
      const reveal = next.reveal!
      expect(reveal.victims).toEqual([1])
      seen[String(reveal.scare)] = (seen[String(reveal.scare)] ?? 0) + 1
      // Com susto, o resultado espera o susto passar (e o prazo da fase acompanha).
      const schedule = revealSchedule(reveal.order.length, reveal.monsterDoors.length, reveal.scare !== null)
      expect(next.deadline).toBe(NOW + 1000 + schedule.total)
    }
    expect(Object.keys(seen).sort()).toEqual(['null', 'surprise'])
    expect(seen.surprise).toBeGreaterThanOrEqual(15)
    expect(seen.surprise).toBeLessThanOrEqual(45)
  })

  it('monstro na porta vazia ou salvação: nunca tem susto', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const mid = withGhosts(6, [6])
      const empty = engine.step(mid, doorsCtx(mid, { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4 }, { rng: seededRng(seed) }))
      expect(empty.reveal?.victims).toEqual([])
      expect(empty.reveal?.scare).toBeNull()
      const saved = engine.step(mid, doorsCtx(mid, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 }, { rng: seededRng(seed) }))
      expect(saved.reveal?.saved).toBe(true)
      expect(saved.reveal?.scare).toBeNull()
    }
  })
})

describe('depois da revelação', () => {
  it('revelação → placar → próxima rodada, nos prazos, com portas pelos vivos', () => {
    const state = withGhosts(6, [6])
    expect(state.doors).toBe(4)
    const revealed = engine.step(state, doorsCtx(state, { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 1 }))
    expect(revealed.alive).toEqual([3, 4, 5])
    const t1 = revealed.deadline!
    expect(engine.step(revealed, makeCtx({ players: makePlayers(6), now: t1 - 1 }))).toBe(revealed)

    const status = engine.step(revealed, makeCtx({ players: makePlayers(6), now: t1 }))
    expect(status.phase).toBe('status')
    expect(status.deadline).toBe(t1 + STATUS_SECONDS * 1000)
    expect(nextRoundSetup(status)).toEqual({ doors: 3, monsters: 1, extra: 0 })

    const round3 = engine.step(status, makeCtx({ players: makePlayers(6), now: status.deadline! }))
    expect(round3.phase).toBe('choose')
    expect(round3.round).toBe(3)
    expect(round3.inputKey).toBe('door-3')
    expect(round3.doors).toBe(3)
    expect(round3.acted).toEqual([])
    expect(round3.reveal).toBeNull()
    expect(round3.corridor).not.toBe('')
  })

  it(`rodada ${IMPATIENT_FROM}: o além perde a paciência e entra um monstro a mais`, () => {
    const state = withGhosts(6, [6], { round: IMPATIENT_FROM - 1, inputKey: `door-${IMPATIENT_FROM - 1}` })
    // Ninguém morre (todos na porta 1, fantasma manda o monstro para a 4).
    const revealed = engine.step(state, doorsCtx(state, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 4 }))
    expect(revealed.alive).toHaveLength(5)
    const status = engine.step(revealed, makeCtx({ players: makePlayers(6), now: revealed.deadline! }))
    expect(nextRoundSetup(status)).toEqual({ doors: 4, monsters: 2, extra: 1 })
    const impatient = engine.step(status, makeCtx({ players: makePlayers(6), now: status.deadline! }))
    expect(impatient.round).toBe(IMPATIENT_FROM)
    expect(impatient.monsters).toBe(2)
    expect(impatient.extraMonsters).toBe(1)
    // A rodada nova já nasce com o placar dos fantasmas zerado.
    expect(impatient.private).toEqual({ 6: { votes: [0, 0, 0, 0] } })
  })

  it('sobrou um vivo: a revelação termina a partida com o vencedor', () => {
    const state = withGhosts(3, [3])
    const revealed = engine.step(state, doorsCtx(state, { 1: 1, 2: 2, 3: 2 }))
    expect(revealed.alive).toEqual([1])
    expect(revealed.reveal?.last).toBe(true)
    const final = engine.step(revealed, makeCtx({ players: makePlayers(3), now: revealed.deadline! }))
    expect(final.phase).toBe('final')
    expect(final.over).toBe(true)
    expect(final.deadline).toBeNull()
    expect(engine.step(final, makeCtx({ players: makePlayers(3), now: NOW * 2 }))).toBe(final)

    const standing = finalStanding(final)
    expect(standing.winners).toEqual([1])
    expect(standing.avengers).toEqual([3])
    expect(standing.maxSouls).toBe(1)
    expect(standing.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  })

  it(`na rodada ${MAX_ROUNDS} o além desiste: os vivos dividem a vitória`, () => {
    const state = withGhosts(5, [5], { round: MAX_ROUNDS, inputKey: `door-${MAX_ROUNDS}` })
    // Todos os vivos na mesma porta: a salvação garante que ninguém morre.
    const revealed = engine.step(state, doorsCtx(state, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }))
    expect(revealed.reveal?.saved).toBe(true)
    expect(revealed.alive).toEqual([1, 2, 3, 4])
    expect(revealed.reveal?.last).toBe(true)
    const final = engine.step(revealed, makeCtx({ players: makePlayers(5), now: revealed.deadline! }))
    expect(final.over).toBe(true)
    expect(finalStanding(final).winners).toEqual([1, 2, 3, 4])
    expect(finalStanding(final).ranking.filter((entry) => entry.place === 1)).toHaveLength(4)
  })

  it('skip pula qualquer fase; comando desconhecido não faz nada', () => {
    const { state } = start(3)
    const skip = (s: State, id: number) =>
      engine.step(s, makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id, type: 'skip' } }))
    const revealed = skip(state, 1)
    expect(revealed.phase).toBe('reveal')
    expect(revealed.reveal?.autoPicked).toEqual([1, 2, 3])
    const next = skip(revealed, 2)
    expect(['status', 'final']).toContain(next.phase)
    if (next.phase === 'status') expect(skip(next, 3).round).toBe(2)
    const other = makeCtx({ players: makePlayers(3), now: NOW + 10, command: { id: 4, type: 'xyz' } })
    expect(engine.step(state, other)).toBe(state)
  })

  it('"Encerrar" do host no meio: o fim sai do estado (vivos vencem)', () => {
    const state = withGhosts(5, [2, 4])
    const standing = finalStanding({ ...state, over: true })
    expect(standing.winners).toEqual([1, 3, 5])
    expect(standing.avengers).toEqual([])
    expect(standing.ranking.slice(0, 3).every((entry) => entry.place === 1)).toBe(true)
  })

  it('classificação pela sobrevivência: quem morreu mais tarde fica na frente', () => {
    const { state } = start(5)
    const final: State = {
      ...state,
      over: true,
      phase: 'final',
      alive: [3],
      diedIn: { 1: 4, 2: 1, 4: 4, 5: 2 },
      souls: { 2: 3, 5: 3, 1: 1 },
    }
    const standing = finalStanding(final)
    expect(standing.ranking.map((entry) => [entry.id, entry.place])).toEqual([
      [3, 1],
      [1, 2],
      [4, 2],
      [5, 4],
      [2, 5],
    ])
    expect(standing.avengers).toEqual([2, 5])
    expect(standing.maxSouls).toBe(3)
  })
})

describe('bot', () => {
  it('só age na escolha, sempre com porta válida, e só quem está na partida', () => {
    const state = withGhosts(6, [5, 6])
    const ctx = makeCtx({ players: makePlayers(6), rng: seededRng(9) })
    for (let i = 0; i < 40; i += 1) {
      for (const id of [1, 5]) {
        const reply = engine.bot(state, id, ctx)
        expect(validDoor(reply?.door, state.doors)).not.toBeNull()
      }
    }
    expect(engine.bot(state, 99, ctx)).toBeNull()
    expect(engine.bot({ ...state, phase: 'reveal' }, 1, ctx)).toBeNull()
    expect(engine.bot({ ...state, over: true }, 1, ctx)).toBeNull()
  })
})

describe('simulações', () => {
  for (const players of [2, 3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed })
        const final = result.state
        expect(final.over).toBe(true)
        expect(final.round).toBeLessThanOrEqual(MAX_ROUNDS)
        expect(final.alive.length).toBeGreaterThanOrEqual(1)
        expect(final.alive.length === 1 || final.round === MAX_ROUNDS).toBe(true)
        expect(finalStanding(final).winners).toEqual(final.alive)
        // Todo mundo que não está vivo morreu numa rodada da partida.
        for (const id of ghostsOf(final)) {
          expect(final.diedIn[String(id)]).toBeGreaterThanOrEqual(1)
          expect(final.diedIn[String(id)]).toBeLessThanOrEqual(final.round)
        }
      })
    }
  }

  it('15 pessoas e ninguém escolhendo nada: acaba em menos de 10 minutos', () => {
    for (const seed of [1, 7, 13]) {
      const result = runSimulation(engine, { players: 15, seed, actProbability: 0 })
      expect(result.state.over).toBe(true)
      expect(result.steps * 1000).toBeLessThan(10 * 60 * 1000)
    }
  })

  it('15 pessoas jogando: quase sempre alguém vence sozinho antes do teto', () => {
    let natural = 0
    for (let seed = 1; seed <= 30; seed += 1) {
      const result = runSimulation(engine, { players: 15, seed })
      expect(result.steps * 1000).toBeLessThan(10 * 60 * 1000)
      if (result.state.alive.length === 1) natural += 1
    }
    expect(natural).toBeGreaterThanOrEqual(24)
  })

  it('com gente offline (cai em porta sorteada e não segura a fase)', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7 })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
  })

  it('com gente demorando ou sem escolher', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5 })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    for (const seed of [8, 9]) {
      const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed })
      expect(result.state.over).toBe(true)
    }
  })

  it('offline e host pulando com 15', () => {
    const result = runSimulation(engine, {
      players: 15,
      seed: 11,
      offlineIds: [3, 7, 12],
      skipProbability: 0.15,
      actProbability: 0.4,
    })
    expect(result.state.over).toBe(true)
  })
})

describe('agenda da revelação', () => {
  it('portas em ordem, monstro por último, resultado depois e susto com folga', () => {
    for (const [doors, monsters] of [
      [3, 1],
      [4, 2],
      [5, 2],
      [5, 4],
    ]) {
      const plain = revealSchedule(doors, monsters, false)
      expect(plain.openAt).toHaveLength(doors)
      for (let i = 1; i < plain.openAt.length; i += 1) expect(plain.openAt[i]).toBeGreaterThan(plain.openAt[i - 1])
      expect(plain.openAt[doors - monsters]).toBe(plain.monsterAt)
      expect(plain.resultAt).toBeGreaterThan(plain.openAt[doors - 1])
      expect(plain.total).toBeGreaterThan(plain.resultAt)
      expect(plain.total).toBeLessThanOrEqual(14_000)
      const scary = revealSchedule(doors, monsters, true)
      expect(scary.resultAt).toBeGreaterThanOrEqual(scary.monsterAt + 2500)
    }
  })
})

describe('conteúdo', () => {
  it('corredores para todas as rodadas, monstros e frases curtinhas', () => {
    expect(CORRIDORS.length).toBeGreaterThanOrEqual(MAX_ROUNDS)
    expect(new Set(CORRIDORS).size).toBe(CORRIDORS.length)
    for (const corridor of CORRIDORS) expect(corridor.length).toBeLessThanOrEqual(42)
    expect(MONSTERS.length).toBeGreaterThanOrEqual(15)
    expect(new Set(MONSTERS.map((monster) => monster.name)).size).toBe(MONSTERS.length)
    for (const monster of MONSTERS) {
      expect(monster.emoji.length).toBeGreaterThan(0)
      expect(monster.name.length).toBeLessThanOrEqual(34)
    }
    for (const line of [...SALVATION_LINES, ...IMPATIENT_LINES]) {
      expect(line.length).toBeGreaterThan(5)
      expect(line.length).toBeLessThanOrEqual(48)
    }
  })
})
