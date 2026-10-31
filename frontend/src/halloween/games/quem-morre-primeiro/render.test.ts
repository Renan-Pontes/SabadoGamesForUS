import { describe, expect, it } from 'vitest'
import { renderAllPhases } from '../../engine/renderSmoke'
import { engine } from './engine'
import Phone from './Phone'
import Tv from './Tv'

describe('telas do Quem Morre Primeiro? em todas as fases', () => {
  it.each([3, 8, 15])('desenha TV e celulares com %i jogadores', (players) => {
    const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { rounds: 6 } })
    expect(result.phases).toEqual(expect.arrayContaining(['vote', 'reveal', 'scores', 'final']))
    expect(result.renders).toBeGreaterThan(0)
  })
})
