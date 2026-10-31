import { describe, expect, it } from 'vitest'
import { HALLOWEEN_SLUGS, HALLOWEEN_WIP, isHalloweenWip } from './slugs'

describe('jogos em construção', () => {
  it('só lista slugs que existem, sem repetir', () => {
    for (const slug of HALLOWEEN_WIP) expect(HALLOWEEN_SLUGS).toContain(slug)
    expect(new Set(HALLOWEEN_WIP).size).toBe(HALLOWEEN_WIP.length)
  })

  it('o jogo de referência já está liberado', () => {
    expect(isHalloweenWip('quem-morre-primeiro')).toBe(false)
  })

  it('não confunde slug desconhecido ou vazio com jogo em construção', () => {
    expect(isHalloweenWip('lobisomem')).toBe(false)
    expect(isHalloweenWip('')).toBe(false)
    expect(isHalloweenWip(null)).toBe(false)
    expect(isHalloweenWip(undefined)).toBe(false)
  })
})
