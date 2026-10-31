import { describe, expect, it } from 'vitest'
import { glowShadow, pageBackdrop, withAlpha } from './surfaces'

describe('withAlpha', () => {
  it('hex de 6 dígitos ganha o canal alfa', () => {
    expect(withAlpha('#ff7b1c', 0.2)).toBe('#ff7b1c33')
    expect(withAlpha('#FF7B1C', 1)).toBe('#FF7B1Cff')
  })

  it('hex curto é expandido antes', () => {
    expect(withAlpha('#fff', 0.4)).toBe('#ffffff66')
  })

  it('variável CSS vai por color-mix (antes virava CSS inválido)', () => {
    expect(withAlpha('var(--accent-red)', 0.22)).toBe('color-mix(in srgb, var(--accent-red) 22%, transparent)')
  })

  it('alfa fora de 0..1 é limitado', () => {
    expect(withAlpha('#000000', 2)).toBe('#000000ff')
    expect(withAlpha('#000000', -1)).toBe('#00000000')
  })
})

describe('superfícies', () => {
  it('o brilho funciona com acento em variável', () => {
    expect(glowShadow('var(--pumpkin)')).toContain('color-mix(in srgb, var(--pumpkin) 22%, transparent)')
  })

  it('o fundo de página termina no véu translúcido (o cenário aparece por trás)', () => {
    expect(pageBackdrop('rgba(0,0,0,0.1)').trim().endsWith('var(--bg-veil)')).toBe(true)
  })
})
