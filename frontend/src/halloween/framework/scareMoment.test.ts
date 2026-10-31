import { describe, expect, it } from 'vitest'
import { MOMENT_SCARES, momentIsForMe, momentScare, nextMoment } from './scareMoment'
import { scareMoment as espiaoMoment } from '../games/espiao-assombrado'
import { scareMoment as cidadeMoment } from '../games/cidade-dorme'
import { scareMoment as aboboraMoment } from '../games/abobora-bomba'
import { scareMoment as portasMoment } from '../games/portas-do-alem'
import type { State as EspiaoState } from '../games/espiao-assombrado/engine'
import type { State as CidadeState } from '../games/cidade-dorme/engine'
import type { State as AboboraState } from '../games/abobora-bomba/engine'
import type { State as PortasState } from '../games/portas-do-alem/engine'

describe('susto do momento (TV e celulares juntos)', () => {
  it('a primeira foto só registra: quem chega no meio não leva susto atrasado', () => {
    const seen = { keys: new Set<string>(), primed: false }
    expect(nextMoment(seen, { key: 'result-1' }, 'm1')).toBeNull()
    expect(nextMoment(seen, { key: 'result-1' }, 'm1')).toBeNull()
    expect(nextMoment(seen, null, 'm1')).toBeNull()
    expect(nextMoment(seen, { key: 'result-2' }, 'm1')?.key).toBe('m1:result-2')
    // Uma vez só por chave; outra partida (outro _m) conta de novo.
    expect(nextMoment(seen, { key: 'result-2' }, 'm1')).toBeNull()
    expect(nextMoment(seen, { key: 'result-2' }, 'm2')?.key).toBe('m2:result-2')
  })

  it('o mesmo susto em todo aparelho para a mesma chave, e o vídeo pesa mais', () => {
    expect(momentScare('m1:result-3')).toBe(momentScare('m1:result-3'))
    const counts = new Map<string, number>()
    for (let i = 0; i < 600; i += 1) {
      const kind = momentScare(`m${i}:x`)
      expect(MOMENT_SCARES).toContain(kind)
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
    expect(counts.get('video') ?? 0).toBeGreaterThan(600 * 0.35)
  })

  it('quem assusta: TV (se o jogo deixa) e os celulares escolhidos', () => {
    expect(momentIsForMe({ key: 'a' }, true, null)).toBe(true)
    expect(momentIsForMe({ key: 'a', tv: false }, true, null)).toBe(false)
    expect(momentIsForMe({ key: 'a' }, false, 7)).toBe(true)
    expect(momentIsForMe({ key: 'a', phones: [3] }, false, 7)).toBe(false)
    expect(momentIsForMe({ key: 'a', phones: [3] }, false, 3)).toBe(true)
    expect(momentIsForMe({ key: 'a', phones: [3] }, false, null)).toBe(false)
  })

  it('espião: susto quando o espião é revelado (e sempre na última rodada)', () => {
    const base = { phase: 'result', round: 2, totalRounds: 5 } as unknown as EspiaoState
    expect(espiaoMoment({ ...base, result: { outcome: 'caught' } } as EspiaoState)?.key).toBe('result-2')
    expect(espiaoMoment({ ...base, result: { outcome: 'tie' } } as EspiaoState)).toBeNull()
    expect(espiaoMoment({ ...base, round: 5, result: { outcome: 'tie' } } as EspiaoState)?.key).toBe('result-5')
    expect(espiaoMoment({ ...base, phase: 'talk', result: null } as unknown as EspiaoState)).toBeNull()
  })

  it('cidade dorme: susto para todos só no amanhecer com morto', () => {
    const morning = { phase: 'morning', round: 1, news: { killed: 4 } } as unknown as CidadeState
    expect(cidadeMoment(morning)).toMatchObject({ key: 'morning-1' })
    expect(cidadeMoment({ ...morning, news: { killed: null } } as unknown as CidadeState)).toBeNull()
  })

  it('abóbora: explode no celular de quem segura; fantasma novo assusta todo mundo', () => {
    const boom = { phase: 'boom', round: 3, boom: { victim: 9, eliminated: false } } as unknown as AboboraState
    expect(aboboraMoment(boom)).toMatchObject({ key: 'boom-3', phones: [9], tv: false })
    const ghost = { ...boom, boom: { victim: 9, eliminated: true } } as unknown as AboboraState
    expect(aboboraMoment(ghost)).toMatchObject({ phones: undefined, tv: true })
    expect(aboboraMoment({ ...boom, boom: { victim: null } } as unknown as AboboraState)).toBeNull()
  })

  it('portas: o celular de quem o monstro pegou, na hora da porta', () => {
    const reveal = {
      phase: 'reveal',
      round: 2,
      reveal: { victims: [5], order: [1, 2, 3], monsterDoors: [2], scare: null },
    } as unknown as PortasState
    const moment = portasMoment(reveal)
    expect(moment).toMatchObject({ key: 'reveal-2', phones: [5], tv: false })
    expect(moment?.delayMs).toBeGreaterThan(0)
  })
})
