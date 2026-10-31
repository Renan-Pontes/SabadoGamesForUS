import { describe, expect, it } from 'vitest'
import { GRACE_MS, optionDefaults, seededRng } from '../../engine/helpers'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import { PLACES } from './content'
import {
  accuseKey,
  cardOf,
  collectFinalVotes,
  engine,
  finalAwards,
  finalKey,
  lastKey,
  mesaOf,
  talkKey,
} from './engine'
import { meta } from './meta'
import {
  ACCUSE_SECONDS,
  FINAL_VOTE_SECONDS,
  GUESS_MAX,
  LAST_CHANCE_SECONDS,
  RESULT_SECONDS,
  RESUME_MIN_MS,
  REVEAL_SECONDS,
  SCORES_SECONDS,
  type RoundKind,
} from './rules'
import { NOW, accuse, ctxAt, placeName, publicJson, skip, start, talking, type Fields } from './testing'

const SEVEN_MIN = 7 * 60_000

describe('início', () => {
  it('abre a rodada 1 mostrando as cartas, com prazo', () => {
    const { state } = start(5)
    expect(state.phase).toBe('reveal')
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(3)
    expect(state.deadline).toBe(NOW + REVEAL_SECONDS * 1000)
    expect(state.roster).toEqual([1, 2, 3, 4, 5])
    expect(state.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(state.spyCount).toBe(1)
    expect(state.roster).toContain(state.starter)
    expect(state.over).toBe(false)
  })

  it('opções: rodadas 3/5/7 (padrão 5), conversa 5/7/9 min (padrão 7), malucas sim/não', () => {
    expect(start(4, {}).state.totalRounds).toBe(5)
    expect(start(4, { rounds: 7 }).state.totalRounds).toBe(7)
    expect(start(4, { rounds: 4 }).state.totalRounds).toBe(5)
    expect(start(4, {}).state.talkMs).toBe(SEVEN_MIN)
    expect(start(4, { talkMinutes: 5 }).state.talkMs).toBe(5 * 60_000)
    expect(start(4, { talkMinutes: 6 }).state.talkMs).toBe(SEVEN_MIN)
    expect(start(4, { chaos: false }).state.chaosOn).toBe(false)
    expect(start(4, { chaos: 'sim' }).state.chaosOn).toBe(true)
    const defaults = start(4, optionDefaults(meta.options)).state
    expect([defaults.totalRounds, defaults.talkMs, defaults.chaosOn]).toEqual([5, SEVEN_MIN, true])
  })

  it('roster é quem está online; espião sai de quem está online', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const ctx = makeCtx({ players: makePlayers(6, { offline: [2, 4] }), now: NOW, rng: seededRng(seed) })
      const state = engine.init(ctx)
      expect(state.roster).toEqual([1, 3, 5, 6])
      expect(mesaOf(state).spies).toHaveLength(1)
    }
  })

  it('1 espião até 8 jogadores, 2 a partir de 9; cada um recebe a carta certa', () => {
    for (const [n, count] of [[3, 1], [8, 1], [9, 2], [15, 2]] as const) {
      const { state } = start(n)
      const mesa = mesaOf(state)
      expect(state.spyCount).toBe(count)
      expect(mesa.kind).toBe('normal')
      expect(mesa.spies).toHaveLength(count)
      const place = PLACES[mesa.place]
      for (const id of state.roster) {
        const card = cardOf(state, id)
        if (mesa.spies.includes(id)) {
          expect(card).toEqual({ spy: true })
        } else {
          expect(card).toMatchObject({ spy: false, place: place.name, icon: place.icon })
          expect(place.roles).toContain(card?.spy === false ? card.role : '')
        }
      }
    }
  })

  it('lugares sem repetir na partida', () => {
    const { state } = start(4, { rounds: 7 })
    expect(new Set(mesaOf(state).deck).size).toBe(7)
  })

  it('o lugar, os papéis e o espião ficam fora do estado público', () => {
    const { state } = start(8)
    const json = publicJson(state)
    expect(json).not.toContain(placeName(state))
    for (const role of PLACES[mesaOf(state).place].roles) expect(json).not.toContain(role)
    expect(json).not.toContain('spies')
    expect(json).not.toContain('"spy"')
  })
})

describe('conversa', () => {
  it('cartas → conversa no prazo (ou no pular); conversa → votação final no fim do tempo', () => {
    const { state } = start(4)
    expect(engine.step(state, ctxAt(state, state.deadline! - 1))).toBe(state)
    const talk = engine.step(state, ctxAt(state, state.deadline!))
    expect(talk.phase).toBe('talk')
    expect(talk.inputKey).toBe(talkKey(1, 0))
    expect(talk.deadline).toBe(state.deadline! + talk.talkMs)
    expect(engine.step(state, ctxAt(state, NOW + 5, {}, { command: skip() })).phase).toBe('talk')

    expect(engine.step(talk, ctxAt(talk, talk.deadline! - 1))).toBe(talk)
    const final = engine.step(talk, ctxAt(talk, talk.deadline!))
    expect(final.phase).toBe('final_vote')
    expect(final.inputKey).toBe(finalKey(1))
    expect(final.deadline).toBe(talk.deadline! + FINAL_VOTE_SECONDS * 1000 + GRACE_MS)
    // "Pular" na conversa = acabou o tempo.
    expect(engine.step(talk, ctxAt(talk, NOW + 20_000, {}, { command: skip() })).phase).toBe('final_vote')
    // Comando desconhecido não faz nada.
    expect(engine.step(talk, ctxAt(talk, NOW + 20_000, {}, { command: { id: 9, type: 'xyz' } }))).toBe(talk)
  })

  it('acusação pausa o relógio e abre a votação', () => {
    const talk = talking(5, [1])
    const now = talk.deadline! - 200_000
    const acc = engine.step(talk, ctxAt(talk, now, { 3: { accuse: 1, at: now } }))
    expect(acc.phase).toBe('accuse')
    expect(acc.inputKey).toBe(accuseKey(1, 0))
    expect(acc.accusation).toEqual({ by: 3, target: 1, yes: 1, no: 0 })
    expect(acc.accusers).toEqual([3])
    expect(acc.pausedLeft).toBe(200_000)
    expect(acc.deadline).toBe(now + ACCUSE_SECONDS * 1000 + GRACE_MS)
    expect(acc.acted).toEqual([3])
  })

  it('ignora acusação inválida: a si mesmo, fora da mesa, lixo, espectador e de outra fase', () => {
    const talk = talking(4, [1])
    const ctx = makeCtx({
      players: makePlayers(6),
      now: NOW + 30_000,
      inputs: {
        1: { k: talk.inputKey, accuse: 1 },
        2: { k: talk.inputKey, accuse: 99 },
        3: { k: talk.inputKey, accuse: '1' },
        4: { k: 'talk-0-0', accuse: 1 },
        5: { k: talk.inputKey, accuse: 1 }, // entrou depois: fora do roster
      },
    })
    expect(engine.step(talk, ctx)).toBe(talk)
  })

  it('duas acusações juntas: vale a do toque mais cedo (empate: ordem da mesa)', () => {
    const talk = talking(5, [1])
    const now = NOW + 60_000
    const first = engine.step(talk, ctxAt(talk, now, { 2: { accuse: 1, at: now - 100 }, 4: { accuse: 3, at: now - 900 } }))
    expect(first.accusation).toMatchObject({ by: 4, target: 3 })
    const tie = engine.step(talk, ctxAt(talk, now, { 4: { accuse: 3 }, 2: { accuse: 1 } }))
    expect(tie.accusation).toMatchObject({ by: 2, target: 1 })
  })
})

describe('acusação', () => {
  it('conta SIM/NÃO ao vivo sem dizer quem votou o quê e devolve o mesmo estado sem novidade', () => {
    const acc = accuse(talking(6, [1]), 2, 1)
    const ctx = ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: false } })
    const live = engine.step(acc, ctx)
    expect(live.phase).toBe('accuse')
    expect(live.accusation).toEqual({ by: 2, target: 1, yes: 2, no: 1 })
    expect(live.acted).toEqual([2, 3, 4])
    expect(engine.step(live, ctx)).toBe(live)
  })

  it('o acusado não vota e o voto do acusador é sempre SIM', () => {
    const acc = accuse(talking(4, [1]), 2, 1)
    const live = engine.step(acc, ctxAt(acc, NOW + 70_000, { 1: { yes: false }, 2: { yes: false }, 3: { yes: 'talvez' } }))
    expect(live.accusation).toEqual({ by: 2, target: 1, yes: 1, no: 0 })
    expect(live.acted).toEqual([2])
  })

  it('passou (SIM > NÃO) contra o espião: última chance para ele', () => {
    const acc = accuse(talking(5, [1]), 2, 1)
    const caught = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: true }, 5: { yes: false } }))
    expect(caught.phase).toBe('last_chance')
    expect(caught.caught).toBe(1)
    expect(caught.inputKey).toBe(lastKey(1))
    expect(caught.deadline).toBe(NOW + 70_000 + LAST_CHANCE_SECONDS * 1000 + GRACE_MS)
    expect(caught.verdict).toEqual({ target: 1, via: 'accusation', pointers: [2] })
    expect(caught.accusation).toBeNull()
  })

  it('não passou: a conversa volta com o tempo que faltava e a acusação velha não vale de novo', () => {
    const talk = talking(5, [1])
    const accusedAt = talk.deadline! - 200_000
    const acc = accuse(talk, 2, 3, accusedAt)
    const back = engine.step(acc, ctxAt(acc, accusedAt + 9000, { 1: { yes: false }, 3: { yes: true }, 4: { yes: false }, 5: { yes: false } }))
    expect(back.phase).toBe('talk')
    expect(back.seg).toBe(1)
    expect(back.inputKey).toBe(talkKey(1, 1))
    expect(back.deadline).toBe(accusedAt + 9000 + 200_000)
    expect(back.rejected).toEqual({ by: 2, target: 3, yes: 1, no: 3 })
    expect(back.accusers).toEqual([2])
    expect(back.pausedLeft).toBeNull()
    // A resposta antiga (outra chave) e uma nova acusação do 2 não valem.
    expect(engine.step(back, ctxAt(back, accusedAt + 10_000, { 2: { accuse: 3 } }, { key: talkKey(1, 0) }))).toBe(back)
    expect(engine.step(back, ctxAt(back, accusedAt + 10_000, { 2: { accuse: 4 } }))).toBe(back)
    // Outra pessoa pode acusar.
    expect(engine.step(back, ctxAt(back, accusedAt + 10_000, { 4: { accuse: 1 } })).phase).toBe('accuse')
  })

  it('empate não passa; acusação sem apoio de mais ninguém também não', () => {
    // 5 na mesa: o 2 acusa o 1; votam 3, 4 e 5. SIM 2 (acusador + 3) × NÃO 2.
    const acc = accuse(talking(5, [1]), 2, 1)
    const tie = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: false }, 5: { yes: false } }))
    expect(tie.phase).toBe('talk')
    expect(tie.rejected).toEqual({ by: 2, target: 1, yes: 2, no: 2 })
    // 1 × 0 no prazo: só o acusador apoiou.
    const lonely = accuse(talking(4, [1]), 2, 1)
    const closed = engine.step(lonely, ctxAt(lonely, lonely.deadline!))
    expect(closed.phase).toBe('talk')
    expect(closed.rejected).toMatchObject({ yes: 1, no: 0 })
    // 2 × 1 passa.
    const enough = accuse(talking(4, [1]), 2, 1)
    expect(engine.step(enough, ctxAt(enough, NOW + 70_000, { 3: { yes: false }, 4: { yes: true } })).phase).toBe('last_chance')
  })

  it('a conversa volta com pelo menos alguns segundos', () => {
    const talk = talking(4, [1])
    const acc = accuse(talk, 2, 3, talk.deadline! - 1000)
    const back = engine.step(acc, ctxAt(acc, talk.deadline! + 5000, {}, { command: skip() }))
    expect(back.phase).toBe('talk')
    expect(back.deadline).toBe(talk.deadline! + 5000 + RESUME_MIN_MS)
  })

  it('offline não segura a votação; o pular fecha com os votos que tem', () => {
    const talk = talking(5, [1])
    const acc = accuse(talk, 2, 1)
    const players = makePlayers(5, { offline: [5] })
    const done = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: true } }, { players }))
    expect(done.phase).toBe('last_chance')
    const skipped = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true } }, { command: skip() }))
    expect(skipped.phase).toBe('last_chance')
  })

  it('condenou um inocente: espiões vencem (+2)', () => {
    const acc = accuse(talking(5, [1]), 2, 3)
    const result = engine.step(acc, ctxAt(acc, NOW + 70_000, { 1: { yes: true }, 4: { yes: true }, 5: { yes: true } }))
    expect(result.phase).toBe('result')
    expect(result.result).toMatchObject({ outcome: 'innocent', winner: 'spies', convicted: 3, via: 'accusation', spies: [1] })
    expect(result.result?.gains).toEqual({ 1: 2 })
    expect(result.scores).toEqual({ 1: 2, 2: 0, 3: 0, 4: 0, 5: 0 })
    expect(result.spyWins).toMatchObject({ 1: 1 })
  })

  it('chute que o espião mandou antes de ver a acusação ainda vale', () => {
    const talk = talking(5, [1])
    const acc = accuse(talk, 2, 3)
    const late = engine.step(acc, ctxAt(acc, NOW + 61_000, { 1: { guess: placeName(talk) } }, { key: talkKey(1, 0) }))
    expect(late.phase).toBe('result')
    expect(late.result?.outcome).toBe('guess-right')
  })

  it('chute de antes da acusação que só chegou depois que a conversa voltou ainda vale', () => {
    const talk = talking(5, [1])
    const acc = accuse(talk, 2, 3)
    const back = engine.step(acc, ctxAt(acc, NOW + 70_000, {}, { command: skip() }))
    expect(back).toMatchObject({ phase: 'talk', seg: 1 })
    const late = engine.step(back, ctxAt(back, NOW + 71_000, { 1: { guess: placeName(talk) } }, { key: talkKey(1, 0) }))
    expect(late.result).toMatchObject({ outcome: 'guess-right', guess: { by: 1, right: true } })
  })
})

describe('chute do espião na conversa', () => {
  it('acertou: espião +3 (o outro espião +2)', () => {
    const talk = talking(10, [1, 6])
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 6: { guess: `o ${placeName(talk).toUpperCase()}` } }))
    expect(result.phase).toBe('result')
    expect(result.result).toMatchObject({ outcome: 'guess-right', winner: 'spies', spies: [1, 6] })
    expect(result.result?.guess).toMatchObject({ by: 6, right: true })
    expect(result.result?.gains).toEqual({ 1: 2, 6: 3 })
    expect(result.spyWins).toMatchObject({ 1: 1, 6: 1 })
  })

  it('errou: a mesa vence (+1 para quem sabia o lugar), sem bônus', () => {
    const talk = talking(4, [2])
    const wrong = PLACES.find((place) => place.name !== placeName(talk))!.name
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 2: { guess: wrong } }))
    expect(result.result).toMatchObject({ outcome: 'guess-wrong', winner: 'table', sharp: [] })
    expect(result.result?.gains).toEqual({ 1: 1, 3: 1, 4: 1 })
  })

  it('quem não é espião não chuta; chute vazio não vale; chute gigante é cortado', () => {
    const talk = talking(4, [2])
    expect(engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { guess: placeName(talk) } }))).toBe(talk)
    expect(engine.step(talk, ctxAt(talk, NOW + 30_000, { 2: { guess: '   ' } }))).toBe(talk)
    expect(engine.step(talk, ctxAt(talk, NOW + 30_000, { 2: { guess: 42 } }))).toBe(talk)
    const huge = engine.step(talk, ctxAt(talk, NOW + 30_000, { 2: { guess: 'z'.repeat(10_000) } }))
    expect(huge.phase).toBe('result')
    expect(huge.result?.guess?.text.length).toBe(GUESS_MAX)
    expect(huge.result?.outcome).toBe('guess-wrong')
  })

  it('o chute vale mais que uma acusação que chegou junto', () => {
    const talk = talking(4, [2])
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { accuse: 2, at: 1 }, 2: { guess: placeName(talk), at: 99 } }))
    expect(result.result?.outcome).toBe('guess-right')
  })
})

describe('votação final', () => {
  function finalVote(n: number, spies: number[], kind: RoundKind = 'normal') {
    const talk = talking(n, spies, kind)
    const vote = engine.step(talk, ctxAt(talk, talk.deadline!))
    expect(vote.phase).toBe('final_vote')
    return vote
  }

  it('ignora voto em si mesmo, fora da mesa e lixo', () => {
    const vote = finalVote(4, [1])
    const ctx = ctxAt(vote, vote.deadline! - 10_000, { 1: { vote: 1 }, 2: { vote: 99 }, 3: { vote: '1' }, 4: { vote: 1 } })
    expect(collectFinalVotes(vote, ctx)).toEqual({ 4: 1 })
    const waiting = engine.step(vote, ctx)
    expect(waiting.phase).toBe('final_vote')
    expect(waiting.acted).toEqual([4])
    expect(engine.step(waiting, ctx)).toBe(waiting)
  })

  it('o mais votado é o espião: última chance; errou → mesa +1 e quem votou nele +1', () => {
    const vote = finalVote(5, [1])
    const caught = engine.step(vote, ctxAt(vote, vote.deadline! - 1000, { 1: { vote: 2 }, 2: { vote: 1 }, 3: { vote: 1 }, 4: { vote: 5 }, 5: { vote: 1 } }))
    expect(caught.phase).toBe('last_chance')
    expect(caught.verdict).toEqual({ target: 1, via: 'final', pointers: [2, 3, 5] })
    expect(caught.finalTally[0]).toEqual({ id: 1, count: 3, voters: [2, 3, 5] })
    const wrong = PLACES.find((place) => place.name !== placeName(vote))!.name
    const result = engine.step(caught, ctxAt(caught, caught.deadline! - 5000, { 1: { guess: wrong } }))
    expect(result.result).toMatchObject({ outcome: 'caught', winner: 'table', convicted: 1, via: 'final', sharp: [2, 3, 5] })
    expect(result.result?.gains).toEqual({ 2: 2, 3: 2, 4: 1, 5: 2 })
    expect(result.sharpCount).toMatchObject({ 2: 1, 3: 1, 4: 0, 5: 1 })
  })

  it('empate ou ninguém votou: o espião escapa (+2)', () => {
    const vote = finalVote(4, [3])
    const tie = engine.step(vote, ctxAt(vote, vote.deadline!, { 1: { vote: 2 }, 2: { vote: 1 } }))
    expect(tie.result).toMatchObject({ outcome: 'tie', winner: 'spies', convicted: null })
    expect(tie.result?.gains).toEqual({ 3: 2 })
    const nobody = engine.step(vote, ctxAt(vote, vote.deadline!))
    expect(nobody.result?.outcome).toBe('tie')
    expect(nobody.result?.finalTally).toEqual([])
  })

  it('chute mandado no último segundo da conversa (chegou já na votação final) ainda vale', () => {
    const vote = finalVote(5, [1])
    // O celular do espião ainda mostrava a conversa: a resposta vem com a chave dela.
    const right = engine.step(vote, ctxAt(vote, vote.deadline! - 29_000, { 1: { guess: placeName(vote) }, 2: { vote: 3 } }, { key: talkKey(1, 0) }))
    expect(right.phase).toBe('result')
    expect(right.result).toMatchObject({ outcome: 'guess-right', guess: { by: 1, right: true } })
    expect(right.result?.gains).toEqual({ 1: 3 })
    const wrong = engine.step(vote, ctxAt(vote, vote.deadline! - 29_000, { 1: { guess: 'banana' } }, { key: talkKey(1, 0) }))
    expect(wrong.result?.outcome).toBe('guess-wrong')
    // Quem não é espião continua sem chute; chave de outra rodada não vale.
    expect(engine.step(vote, ctxAt(vote, vote.deadline! - 29_000, { 2: { guess: placeName(vote) } }, { key: talkKey(1, 0) }))).toBe(vote)
    expect(engine.step(vote, ctxAt(vote, vote.deadline! - 29_000, { 1: { guess: placeName(vote) } }, { key: talkKey(2, 0) }))).toBe(vote)
  })

  it('todo mundo online votou: fecha na hora; offline não segura', () => {
    const vote = finalVote(4, [1])
    const players = makePlayers(4, { offline: [4] })
    const done = engine.step(vote, ctxAt(vote, NOW + 1, { 1: { vote: 2 }, 2: { vote: 3 }, 3: { vote: 2 } }, { players }))
    expect(done.phase).toBe('result')
    expect(done.result).toMatchObject({ outcome: 'innocent', convicted: 2 })
  })
})

describe('última chance', () => {
  /** Acusação aprovada por todo mundo contra `target` (o acusador é o primeiro que não é espião). */
  function lastChance(n: number, spies: number[], target: number) {
    const talk = talking(n, spies)
    const accuser = talk.roster.find((id) => !spies.includes(id) && id !== target)!
    const acc = accuse(talk, accuser, target)
    const voters: Record<number, Fields> = {}
    for (const id of acc.roster) if (id !== target && id !== accuser) voters[id] = { yes: true }
    const caught = engine.step(acc, ctxAt(acc, NOW + 70_000, voters))
    expect(caught.phase).toBe('last_chance')
    return caught
  }

  it('acertou o lugar: escapa (+3), o outro espião +2', () => {
    const caught = lastChance(10, [1, 7], 7)
    const result = engine.step(caught, ctxAt(caught, NOW + 75_000, { 7: { guess: placeName(caught).toLowerCase() } }))
    expect(result.result).toMatchObject({ outcome: 'escaped', winner: 'spies', convicted: 7 })
    expect(result.result?.gains).toEqual({ 1: 2, 7: 3 })
  })

  it('errou: mesa vence e o acusador ganha o bônus', () => {
    const caught = lastChance(5, [1], 1)
    const result = engine.step(caught, ctxAt(caught, NOW + 75_000, { 1: { guess: 'banana' } }))
    expect(result.result).toMatchObject({ outcome: 'caught', winner: 'table', sharp: [2], guess: { by: 1, text: 'banana', right: false } })
    expect(result.result?.gains).toEqual({ 2: 2, 3: 1, 4: 1, 5: 1 })
  })

  it('só o espião pego chuta; vazio não vale; no prazo (ou no pular) a mesa vence', () => {
    const caught = lastChance(5, [1], 1)
    const others = ctxAt(caught, NOW + 75_000, { 2: { guess: placeName(caught) }, 1: { guess: ' ' } })
    expect(engine.step(caught, others)).toBe(caught)
    expect(engine.step(caught, ctxAt(caught, caught.deadline! - 1))).toBe(caught)
    expect(engine.step(caught, ctxAt(caught, caught.deadline!)).result?.outcome).toBe('caught')
    expect(engine.step(caught, ctxAt(caught, NOW + 75_000, {}, { command: skip() })).result?.outcome).toBe('caught')
  })
})

describe('rodadas malucas', () => {
  it('todo mundo é espião: todas as cartas dizem espião; qualquer desfecho revela, sem pontos', () => {
    // Acusação aprovada
    const acc = accuse(talking(5, [1, 2, 3, 4, 5], 'everyone'), 2, 4)
    const approved = engine.step(acc, ctxAt(acc, NOW + 70_000, { 1: { yes: true }, 3: { yes: true }, 5: { yes: true } }))
    expect(approved.result).toMatchObject({ outcome: 'everyone', winner: 'none', kind: 'everyone', convicted: 4, spies: [1, 2, 3, 4, 5] })
    expect(approved.result?.gains).toEqual({})
    // Chute (certo ou errado)
    const talk = talking(5, [1, 2, 3, 4, 5], 'everyone')
    const guessed = engine.step(talk, ctxAt(talk, NOW + 30_000, { 3: { guess: placeName(talk) } }))
    expect(guessed.result).toMatchObject({ outcome: 'everyone', guess: { by: 3, right: true } })
    expect(guessed.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    // Votação final (até no empate)
    const final = engine.step(talk, ctxAt(talk, talk.deadline!))
    const tie = engine.step(final, ctxAt(final, final.deadline!))
    expect(tie.result?.outcome).toBe('everyone')
  })

  it('ninguém é espião: condenado ganha +2; sem condenado, +1 para todo mundo; ninguém chuta', () => {
    const talk = talking(4, [], 'nobody')
    for (const id of talk.roster) expect(cardOf(talk, id)?.spy).toBe(false)
    expect(engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { guess: placeName(talk) } }))).toBe(talk)

    const acc = accuse(talk, 1, 2)
    const convicted = engine.step(acc, ctxAt(acc, NOW + 70_000, { 3: { yes: true }, 4: { yes: true } }))
    expect(convicted.result).toMatchObject({ outcome: 'nobody-convicted', winner: 'none', convicted: 2, spies: [] })
    expect(convicted.result?.gains).toEqual({ 2: 2 })

    const vote = engine.step(talk, ctxAt(talk, talk.deadline!))
    const free = engine.step(vote, ctxAt(vote, vote.deadline!, { 1: { vote: 2 }, 2: { vote: 1 } }))
    expect(free.result?.outcome).toBe('nobody-free')
    expect(free.result?.gains).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 })

    const unique = engine.step(vote, ctxAt(vote, vote.deadline!, { 1: { vote: 3 }, 2: { vote: 3 }, 4: { vote: 1 } }))
    expect(unique.result).toMatchObject({ outcome: 'nobody-convicted', convicted: 3, via: 'final' })
    expect(unique.result?.gains).toEqual({ 3: 2 })
  })

  /** Joga a rodada 1 pulando tudo e abre a 2 com o sorteio dado. */
  function round2(rng: () => number, options: Fields = { rounds: 3 }) {
    let { state } = start(6, options)
    for (let i = 1; i < 20 && !(state.round === 2 && state.phase === 'reveal'); i += 1) {
      const isLast = state.phase === 'scores'
      state = engine.step(state, ctxAt(state, NOW + i * 1000, {}, { command: skip(i), ...(isLast ? { rng } : {}) }))
    }
    expect(state.round).toBe(2)
    return state
  }

  /** Sorteio com os primeiros números escolhidos (o resto vem de uma semente). */
  function rngFrom(first: number[]) {
    const rest = seededRng(5)
    let index = 0
    return () => (index < first.length ? first[index++] : rest())
  }

  it('saem a partir da 2ª rodada, pelo chaosRoll, e não aparecem no estado público', () => {
    expect(mesaOf(round2(rngFrom([0, 0]))).kind).toBe('everyone')
    expect(mesaOf(round2(rngFrom([0, 0.99]))).kind).toBe('nobody')
    expect(mesaOf(round2(rngFrom([0.5]))).kind).toBe('normal')
    expect(mesaOf(round2(rngFrom([0, 0]), { rounds: 3, chaos: false })).kind).toBe('normal')

    // Rodada maluca e normal têm a mesma cara para as telas.
    const crazy = round2(rngFrom([0, 0]))
    const normal = round2(rngFrom([0.5]))
    expect(Object.keys(JSON.parse(publicJson(crazy))).sort()).toEqual(Object.keys(JSON.parse(publicJson(normal))).sort())
    expect(crazy.spyCount).toBe(normal.spyCount)
    for (const word of ['everyone', 'nobody', placeName(crazy)]) expect(publicJson(crazy)).not.toContain(word)
    for (const id of crazy.roster) expect(cardOf(crazy, id)).toEqual({ spy: true })
  })

  it('no máximo uma de cada por partida', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const result = runSimulation(engine, { players: 5, seed, options: { rounds: 7, talkMinutes: 5 }, skipProbability: 0.5, actProbability: 0 })
      const kinds = result.state.history.map((entry) => entry.kind)
      expect(kinds[0]).toBe('normal')
      expect(kinds.filter((kind) => kind === 'everyone').length).toBeLessThanOrEqual(1)
      expect(kinds.filter((kind) => kind === 'nobody').length).toBeLessThanOrEqual(1)
    }
  })
})

describe('depois da rodada', () => {
  it('resultado → placar → próxima rodada; a última vai para o fim', () => {
    const talk = talking(4, [1], 'normal', { rounds: 3 })
    const result = engine.step(talk, ctxAt(talk, NOW + 30_000, { 1: { guess: 'banana' } }))
    expect(result.deadline).toBe(NOW + 30_000 + RESULT_SECONDS * 1000)
    expect(engine.step(result, ctxAt(result, result.deadline! - 1))).toBe(result)
    const scores = engine.step(result, ctxAt(result, result.deadline!))
    expect(scores.phase).toBe('scores')
    expect(scores.deadline).toBe(result.deadline! + SCORES_SECONDS * 1000)
    const next = engine.step(scores, ctxAt(scores, scores.deadline!))
    expect(next).toMatchObject({ phase: 'reveal', round: 2, seg: 0, accusers: [], result: null, rejected: null, caught: null })
    expect(mesaOf(next).place).not.toBe(mesaOf(talk).place)

    const last = { ...result, round: 3 }
    const final = engine.step(last, ctxAt(last, last.deadline!))
    expect(final).toMatchObject({ phase: 'final', over: true, deadline: null })
    expect(engine.step(final, ctxAt(final, NOW * 2))).toBe(final)
  })

  it('pular funciona em toda fase', () => {
    let { state } = start(5, { rounds: 3 })
    const seen = new Set<string>()
    for (let i = 1; i <= 40 && !state.over; i += 1) {
      seen.add(state.phase)
      const next = engine.step(state, ctxAt(state, NOW + 1000, {}, { command: skip(i) }))
      expect(next, `pular em ${state.phase}`).not.toBe(state)
      state = next
    }
    expect(state.over).toBe(true)
    expect([...seen]).toEqual(expect.arrayContaining(['reveal', 'talk', 'final_vote', 'result', 'scores']))
  })

  it('prêmios do fim', () => {
    const state = {
      ...start(4).state,
      over: true,
      scores: { 1: 5, 2: 5, 3: 1, 4: 0 },
      spyWins: { 1: 0, 2: 2, 3: 0, 4: 0 },
      sharpCount: { 1: 0, 2: 0, 3: 0, 4: 0 },
    }
    const awards = finalAwards(state)
    expect(awards.champions).toEqual([1, 2])
    expect(awards.topScore).toBe(5)
    expect(awards.masterSpies).toEqual([2])
    expect(awards.maxSpyWins).toBe(2)
    expect(awards.detectives).toEqual([])
    expect(awards.ranking.map((entry) => entry.place)).toEqual([1, 1, 3, 4])
  })
})

describe('bot', () => {
  it('responde só o que a fase pede e nunca em si mesmo', () => {
    const talk = talking(6, [1])
    const ctx = makeCtx({ players: makePlayers(6), rng: seededRng(3) })
    for (let i = 0; i < 300; i += 1) {
      const reply = engine.bot(talk, 2, ctx)
      if (reply?.accuse !== undefined) {
        expect(reply.accuse).not.toBe(2)
        expect(talk.roster).toContain(reply.accuse)
      }
      expect(reply?.guess).toBeUndefined() // 2 não é espião
    }
    const vote = engine.step(talk, ctxAt(talk, talk.deadline!))
    for (let i = 0; i < 50; i += 1) {
      const reply = engine.bot(vote, 3, ctx)
      expect(reply?.vote).not.toBe(3)
      expect(vote.roster).toContain(reply?.vote)
    }
    expect(engine.bot(vote, 99, ctx)).toBeNull()
    expect(engine.bot({ ...vote, phase: 'result' }, 3, ctx)).toBeNull()
    const acc = accuse(talking(6, [1]), 2, 1)
    expect(engine.bot(acc, 1, ctx)).toBeNull()
    expect(engine.bot(acc, 2, ctx)).toBeNull()
    expect(typeof engine.bot(acc, 3, ctx)?.yes).toBe('boolean')
  })
})

describe('simulações', () => {
  for (const players of [3, 8, 15]) {
    for (const seed of [1, 2, 3, 42]) {
      it(`${players} jogadores, semente ${seed}`, () => {
        const result = runSimulation(engine, { players, seed, options: { rounds: 5 } })
        expect(result.state.over).toBe(true)
        expect(result.state.round).toBe(5)
        expect(result.state.history).toHaveLength(5)
      })
    }
  }

  it('com gente offline', () => {
    const result = runSimulation(engine, { players: 10, offlineIds: [2, 5, 9], seed: 7, options: { rounds: 3 } })
    expect(result.state.over).toBe(true)
    expect(result.state.roster).toEqual([1, 3, 4, 6, 7, 8, 10])
    expect(result.state.spyCount).toBe(1)
  })

  it('com gente demorando ou sem responder', () => {
    const result = runSimulation(engine, { players: 8, actProbability: 0.05, seed: 5, options: { rounds: 3 } })
    expect(result.state.over).toBe(true)
  })

  it('com o host pulando fases', () => {
    const result = runSimulation(engine, { players: 6, skipProbability: 0.3, actProbability: 0.3, seed: 8, options: { rounds: 7 } })
    expect(result.state.over).toBe(true)
    expect(result.state.round).toBe(7)
  })

  it('ninguém nunca responde: termina pelos prazos, espião escapa toda rodada', () => {
    const result = runSimulation(engine, { players: 4, actProbability: 0, options: { rounds: 3, talkMinutes: 5 } })
    expect(result.state.over).toBe(true)
    expect(result.state.history.every((entry) => ['tie', 'everyone', 'nobody-free'].includes(entry.outcome))).toBe(true)
  })

  it('várias partidas passam por todas as fases e desfechos', () => {
    const phases = new Set<string>()
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 12; seed += 1) {
      const result = runSimulation(engine, { players: 6 + (seed % 5), seed, options: { rounds: 7, talkMinutes: 5 } })
      for (const state of result.history) phases.add(state.phase)
      for (const entry of result.state.history) outcomes.add(entry.outcome)
    }
    expect([...phases].sort()).toEqual(['accuse', 'final', 'final_vote', 'last_chance', 'result', 'reveal', 'scores', 'talk'])
    expect([...outcomes]).toEqual(expect.arrayContaining(['caught', 'escaped', 'guess-right', 'guess-wrong', 'innocent']))
  })

  it('segredo nunca vaza para o estado público antes da revelação', () => {
    for (const seed of [1, 2, 3]) {
      const result = runSimulation(engine, { players: 9, seed, options: { rounds: 5 } })
      for (const state of result.history) {
        if (!['reveal', 'talk', 'accuse', 'final_vote', 'last_chance'].includes(state.phase)) continue
        const json = publicJson(state)
        expect(state.result).toBeNull()
        expect(json).not.toContain(`"${placeName(state)}"`)
        for (const role of PLACES[mesaOf(state).place].roles) expect(json).not.toContain(`"${role}"`)
        // O tipo da rodada só aparece no histórico, depois de revelado.
        expect(state.history.every((entry) => entry.round < state.round)).toBe(true)
      }
    }
  })
})
