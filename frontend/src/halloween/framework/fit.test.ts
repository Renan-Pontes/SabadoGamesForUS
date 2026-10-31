import { describe, expect, it } from 'vitest'
import { MIN_TV_SCALE, fitScale } from './fit'

describe('fitScale (a TV encolhe para caber)', () => {
  it('não mexe no que já cabe', () => {
    expect(fitScale(900, 700)).toBe(1)
    expect(fitScale(900, 900)).toBe(1)
    expect(fitScale(900, 900.8)).toBe(1)
  })

  it('encolhe na medida exata quando sobra', () => {
    expect(fitScale(800, 1000)).toBeCloseTo(0.8)
    expect(fitScale(864 - 110, 1030)).toBeCloseTo(754 / 1030)
  })

  it('nunca passa do mínimo', () => {
    expect(fitScale(300, 3000)).toBe(MIN_TV_SCALE)
    expect(fitScale(300, 3000, 0.7)).toBe(0.7)
  })

  it('ignora medidas inválidas (ainda sem layout)', () => {
    expect(fitScale(0, 500)).toBe(1)
    expect(fitScale(Number.NaN, 500)).toBe(1)
    expect(fitScale(500, Number.NaN)).toBe(1)
  })
})
