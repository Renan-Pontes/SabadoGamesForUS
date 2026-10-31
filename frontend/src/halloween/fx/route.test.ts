import { describe, expect, it } from 'vitest'
import { isTvLocation, roomCodeFromPath } from './route'

describe('rotas de TV', () => {
  it('reconhece a TV pela rota ou pelo ?view=tv', () => {
    expect(isTvLocation('/tv/ABCD', '')).toBe(true)
    expect(isTvLocation('/game/ABCD/cidade-dorme', '?view=tv')).toBe(true)
    expect(isTvLocation('/game/ABCD', '?foo=1&view=tv')).toBe(true)
    expect(isTvLocation('/game/ABCD/cidade-dorme', '?view=player')).toBe(false)
    expect(isTvLocation('/host/ABCD', '')).toBe(false)
    expect(isTvLocation('/', '')).toBe(false)
    expect(isTvLocation('/tv', '')).toBe(false)
  })

  it('extrai o código da sala em maiúsculas', () => {
    expect(roomCodeFromPath('/tv/abcd')).toBe('ABCD')
    expect(roomCodeFromPath('/game/XyZ9/quiz-do-terror')).toBe('XYZ9')
    expect(roomCodeFromPath('/host/K2')).toBe('K2')
    expect(roomCodeFromPath('/play/Q1W2')).toBe('Q1W2')
    expect(roomCodeFromPath('/lobby')).toBeNull()
    expect(roomCodeFromPath('/game/%E0%A4%A')).toBe('%E0%A4%A')
  })
})
