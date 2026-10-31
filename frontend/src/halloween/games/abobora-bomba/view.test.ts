import { describe, expect, it } from 'vitest'
import { STAGE_ASPECT, heartsText, heatLabel, savedText, seatPosition, secondsOf, towardCenter } from './view'

describe('mesa da TV', () => {
  // Palco típico numa TV 1080p: ~1850 × 800 px.
  const HEIGHT = 800
  const WIDTH = HEIGHT * STAGE_ASPECT
  const px = (point: { x: number; y: number }) => ({ x: (point.x / 100) * WIDTH, y: (point.y / 100) * HEIGHT })

  it('o primeiro assento é o do meio de cima e a ordem segue no sentido horário', () => {
    expect(seatPosition(0, 6)).toEqual({ x: 50, y: 10 })
    const right = seatPosition(1, 4)
    const bottom = seatPosition(2, 4)
    expect(right.x).toBeGreaterThan(50)
    expect(bottom.y).toBeGreaterThan(50)
    expect(seatPosition(1, 2).y).toBeCloseTo(90)
  })

  it.each([2, 3, 5, 8, 10, 12, 15])('com %i pessoas os assentos ficam dentro do palco e sem amontoar', (count) => {
    const seats = Array.from({ length: count }, (_, index) => seatPosition(index, count))
    for (const seat of seats) {
      expect(seat.x).toBeGreaterThanOrEqual(6)
      expect(seat.x).toBeLessThanOrEqual(94)
      expect(seat.y).toBeGreaterThanOrEqual(9)
      expect(seat.y).toBeLessThanOrEqual(91)
    }
    let closest = Infinity
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const a = px(seats[i])
        const b = px(seats[j])
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
      }
    }
    expect(closest).toBeGreaterThanOrEqual(220)
  })

  it('a abóbora pousa entre o assento e o centro', () => {
    expect(towardCenter({ x: 50, y: 10 }, 0.5)).toEqual({ x: 50, y: 30 })
    expect(towardCenter({ x: 10, y: 50 }, 0.25)).toEqual({ x: 20, y: 50 })
  })
})

describe('textos', () => {
  it('corações, segundos, calor e pavio poupado', () => {
    expect(heartsText(2, 3)).toBe('❤️❤️🖤')
    expect(heartsText(0, 2)).toBe('👻')
    expect(secondsOf(0)).toBe(0)
    expect(secondsOf(200)).toBe(1)
    expect(secondsOf(5000)).toBe(5)
    expect(secondsOf(-30)).toBe(0)
    expect(heatLabel(1)).toBe('1,5×')
    expect(heatLabel(2)).toBe('2×')
    expect(savedText(34_400)).toBe('34 s')
  })
})
