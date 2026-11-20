import { describe, expect, it } from 'vitest'
import {
  STAGE_ASPECT,
  boomLine,
  finalLine,
  heartsText,
  heatLabel,
  moodFor,
  savedText,
  seatPosition,
  secondsOf,
  shakeLevel,
  themeLine,
  towardCenter,
} from './view'

describe('presente e falas do Natal', () => {
  it('o presente treme mais quando o pavio está no fim', () => {
    expect(shakeLevel(false, 1000)).toBe(0)
    expect(shakeLevel(true, 9000)).toBe(1)
    expect(shakeLevel(true, 4000)).toBe(2)
    expect(shakeLevel(true, 1000)).toBe(3)
    expect([moodFor(1), moodFor(2), moodFor(3)]).toEqual(['happy', 'nervous', 'panic'])
  })

  it('as falas usam o nome e mudam a cada rodada', () => {
    expect(themeLine(1, 'Frutas')).toBe('Ho ho ho! O tema é: Frutas!')
    expect(themeLine(2, 'Frutas')).not.toBe(themeLine(1, 'Frutas'))
    expect(boomLine(1, 'Ana', false)).toContain('Ana')
    expect(boomLine(2, 'Ana', false)).not.toBe(boomLine(1, 'Ana', false))
    expect(boomLine(1, 'Bia', true)).toBe('Bia virou boneco de neve!')
    expect(finalLine('Caio', 1)).toContain('Caio sobreviveu')
    expect(finalLine('Ana e Bia', 2)).toContain('sobreviveram')
    expect(finalLine('', 0)).toContain('venceu todo mundo')
  })
})

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

  it('o presente pousa entre o assento e o centro', () => {
    expect(towardCenter({ x: 50, y: 10 }, 0.5)).toEqual({ x: 50, y: 30 })
    expect(towardCenter({ x: 10, y: 50 }, 0.25)).toEqual({ x: 20, y: 50 })
  })
})

describe('textos', () => {
  it('corações, segundos, calor e pavio poupado', () => {
    expect(heartsText(2, 3)).toBe('❤️❤️🤍')
    expect(heartsText(0, 2)).toBe('☃️')
    expect(secondsOf(0)).toBe(0)
    expect(secondsOf(200)).toBe(1)
    expect(secondsOf(5000)).toBe(5)
    expect(secondsOf(-30)).toBe(0)
    expect(heatLabel(1)).toBe('1,5×')
    expect(heatLabel(2)).toBe('2×')
    expect(savedText(34_400)).toBe('34 s')
  })
})
