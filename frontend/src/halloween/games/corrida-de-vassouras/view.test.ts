import { describe, expect, it } from 'vitest'
import { isLoudSfx } from '../../audio'
import { RACE_TIMING, applyStage, raceBeats, standings, type CvRace, type RaceBeat } from './engine'
import { isFirstFall, namesOrNobody, raceCue, raceFrame, randomScaresAllowed, shortNames } from './view'
import { makePlayers } from '../../engine/testkit'

/** Etapa 3: bruxa 1 leva 3 maldições e cai no fim; ninguém cruza a chegada. */
function race(): CvRace {
  const board = { positions: [4, 6, 2, 3, 6], arrivals: [1, 2, 3, 4, 5], tick: 5 }
  const outcome = applyStage(board, { order: [1, 2, 0, 3, 4], rolls: [2, 1, 3, 2, 1] }, [0, 3, 1, 0, 0], 3)
  const base: CvRace = { ...outcome.race, at: 0, ms: 0 }
  return { ...base, ms: raceBeats(base).reduce((end, beat) => Math.max(end, beat.at + beat.ms), 0) }
}

describe('quadro da corrida na TV', () => {
  it('começa na largada da etapa, sem dado', () => {
    const r = race()
    const frame = raceFrame(r, 0, 3)
    expect(frame.positions).toEqual(r.start)
    expect(frame.beat?.kind).toBe('intro')
    expect(frame.die).toBeNull()
    expect(frame.caption).toBe('Etapa 3: valendo!')
  })

  it('o dado gira, depois cai no número e a bruxa voa', () => {
    const r = race()
    const firstStep = raceBeats(r).find((beat) => beat.kind === 'step')!
    const rolling = raceFrame(r, firstStep.at + 100, 3)
    expect(rolling.die?.rolling).toBe(true)
    expect(rolling.die?.witch).toBe(1)
    expect(rolling.positions[1]).toBe(6)
    expect(rolling.active).toBe(1)
    const landed = raceFrame(r, firstStep.at + RACE_TIMING.roll + 1, 3)
    expect(landed.die).toEqual({ witch: 1, value: 2, rolling: false })
    expect(landed.positions[1]).toBe(8)
    expect(landed.caption).toContain('Matinta')
  })

  it('a amaldiçoada treme, depois cai 2 casas e vai para trás de quem está na casa', () => {
    const r = race()
    const fall = raceBeats(r).find((beat) => beat.kind === 'fall')!
    const before = raceFrame(r, fall.at + 100, 3)
    expect(before.shaking).toBe(true)
    expect(before.fallen).toBe(false)
    expect(before.positions[1]).toBe(8)
    const after = raceFrame(r, fall.at + RACE_TIMING.drop + 1, 3)
    expect(after.fallen).toBe(true)
    expect(after.positions[1]).toBe(6)
    expect(after.caption).toContain('3')
    // A mesma classificação que o motor calculou.
    expect(standings(after.positions, after.arrivals)).toEqual(r.order)
  })

  it('no fim da animação, mostra exatamente o fim da etapa', () => {
    const r = race()
    const frame = raceFrame(r, r.ms + 10_000, 3)
    expect(frame.done).toBe(true)
    expect(frame.positions).toEqual(r.end)
    expect(frame.beat?.kind).toBe('lead')
    expect(standings(frame.positions, frame.arrivals)).toEqual(r.order)
  })

  it('maldição que não derruba: a fala diz o porquê (1 só não basta; empate anula)', () => {
    const board = { positions: [0, 0, 0, 0, 0], arrivals: [0, 1, 2, 3, 4], tick: 5 }
    const plan = { order: [0, 1, 2, 3, 4], rolls: [1, 1, 1, 1, 1] }
    const captionAt = (curses: number[], round: number) => {
      const outcome = applyStage(board, plan, curses, round)
      const r: CvRace = { ...outcome.race, at: 0, ms: 0 }
      const weak = raceBeats(r).find((beat) => beat.kind === 'weak')!
      return raceFrame(r, weak.at + 10, round).caption
    }
    for (let round = 1; round <= 8; round += 1) {
      // Uma maldição só: não foi empate, faltou a segunda.
      const single = captionAt([1, 0, 0, 0, 0], round)
      expect(single).not.toMatch(/empate|embolaram|anularam/i)
      expect(single).toContain('2')
      // Duas bruxas com 2 maldições: aí sim é empate.
      expect(captionAt([2, 2, 0, 0, 0], round)).toMatch(/empate|embolaram|anularam/i)
    }
  })

  it('relógio antes da largada não quebra', () => {
    const frame = raceFrame(race(), -9999, 3)
    expect(frame.beat?.kind).toBe('intro')
  })

  it('a ordem ao vivo bate com o motor em toda etapa sorteada', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const order = [0, 1, 2, 3, 4].sort((a, b) => ((a * 7 + seed) % 5) - ((b * 7 + seed) % 5))
      const board = { positions: [seed % 7, (seed * 3) % 9, 5, (seed * 5) % 11, 2], arrivals: [-3, 4, 2, 9, 1], tick: 9 }
      const outcome = applyStage(board, { order, rolls: order.map((_, i) => 1 + ((seed + i) % 3)) }, [seed % 3, 2, 0, 0, 1], 5)
      const r: CvRace = { ...outcome.race, at: 0, ms: 0 }
      const end = raceBeats(r).reduce((total, beat) => Math.max(total, beat.at + beat.ms), 0)
      const frame = raceFrame(r, end, 5)
      expect(frame.positions).toEqual(r.end)
      expect(standings(frame.positions, frame.arrivals)).toEqual(r.order)
    }
  })
})

describe('sons da corrida', () => {
  const KINDS: RaceBeat['kind'][] = ['intro', 'step', 'fall', 'weak', 'lead', 'finish', 'midnight']

  it('nenhum som do caminho alto: com 15 pessoas alguém cai em ~3 de 4 etapas', () => {
    // O grito ('scream') toca MUITO mais alto e cala a música: numa queda a
    // cada etapa, a sala ficaria surda. O susto de meme é o cano, só na 1ª.
    for (const kind of KINDS) {
      for (const roll of [1, 2, 3]) {
        for (const firstFall of [true, false]) {
          const cue = raceCue(kind, { roll, firstFall, witch: 'Cuca' })
          expect(cue.sfx.filter((sound) => isLoudSfx(sound.name))).toEqual([])
        }
      }
    }
  })

  it('o susto do cano só na 1ª queda da partida; as outras quedas fazem barulho de vassoura', () => {
    expect(raceCue('fall', { roll: 0, firstFall: true, witch: 'Cuca' }).scare).toBe('pipe')
    const later = raceCue('fall', { roll: 0, firstFall: false, witch: 'Cuca' })
    expect(later.scare).toBeNull()
    expect(later.sfx.length).toBeGreaterThan(0)
    for (const kind of KINDS.filter((kind) => kind !== 'fall')) {
      expect(raceCue(kind, { roll: 3, firstFall: true, witch: 'Cuca' }).scare).toBeNull()
    }
  })

  it('narra só a chegada e a meia-noite, com o nome da bruxa', () => {
    expect(raceCue('finish', { roll: 0, firstFall: false, witch: 'Cuca' }).speak).toContain('Cuca')
    expect(raceCue('midnight', { roll: 0, firstFall: false, witch: 'Matinta' }).speak).toContain('Matinta')
    for (const kind of ['intro', 'step', 'fall', 'weak', 'lead'] as const) {
      expect(raceCue(kind, { roll: 2, firstFall: false, witch: 'Cuca' }).speak).toBeNull()
    }
  })
})

describe('sustos aleatórios da festa', () => {
  it('seguros nas apostas, na corrida e no placar da campeã; liberados no placar entre etapas e no fim', () => {
    expect(randomScaresAllowed({ over: false, phase: 'bet', winner: null })).toBe(false)
    expect(randomScaresAllowed({ over: false, phase: 'race', winner: null })).toBe(false)
    expect(randomScaresAllowed({ over: false, phase: 'payout', winner: 2 })).toBe(false)
    expect(randomScaresAllowed({ over: false, phase: 'payout', winner: null })).toBe(true)
    expect(randomScaresAllowed({ over: true, phase: 'race', winner: null })).toBe(true)
  })
})

describe('ajudantes', () => {
  it('primeira queda da partida', () => {
    expect(isFirstFall([], 1)).toBe(true)
    expect(isFirstFall([{ round: 1, fell: null }, { round: 2, fell: null }], 3)).toBe(true)
    expect(isFirstFall([{ round: 1, fell: 2 }], 3)).toBe(false)
  })

  it('nomes em português ou "ninguém"', () => {
    const players = makePlayers(3)
    expect(namesOrNobody([], players)).toBe('ninguém')
    expect(namesOrNobody([1, 2, 3], players)).toBe('Vlad, Mortícia e Gasparzinho')
  })

  it('lista curta para a TV: no máximo 6 nomes e "mais N"', () => {
    const players = makePlayers(15)
    expect(shortNames([1, 2], players)).toBe('Vlad e Mortícia')
    expect(shortNames([], players, 'ninguém apostou nela')).toBe('ninguém apostou nela')
    expect(shortNames([1, 2, 3, 4, 5, 6, 7, 8, 9], players)).toBe('Vlad, Mortícia, Gasparzinho, Cuca, Saci, Wandinha e mais 3')
    expect(shortNames([1, 2, 3, 4, 5], players, 'ninguém', 4)).toBe('Vlad, Mortícia, Gasparzinho, Cuca e mais 1')
  })
})
