import { describe, expect, it } from 'vitest'
import { seededRng } from '../../engine/helpers'
import {
  MAX_POINTS,
  MAX_STROKES,
  PALETTE,
  SEND_GAP_MS,
  appendStroke,
  botStrokes,
  compactStroke,
  countPoints,
  polylinePoints,
  readDrawing,
  sendDelay,
  simplify,
  slotFields,
  toBoardStrokes,
  type Stroke,
} from './drawing'

/** Traço "de dedo": muitos pontos colados numa reta com tremidinha. */
function fingerLine(n: number, from = [0.1, 0.2], to = [0.9, 0.6]) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return [from[0] + (to[0] - from[0]) * t + (i % 2 ? 0.0004 : 0), from[1] + (to[1] - from[1]) * t]
  })
}

describe('redução dos traços', () => {
  it('reta cheia de pontos vira poucos pontos, com 3 casas', () => {
    const stroke = compactStroke(fingerLine(200), 2)
    expect(stroke).not.toBeNull()
    expect(stroke!.c).toBe(2)
    expect(stroke!.p.length / 2).toBeLessThanOrEqual(4)
    for (const value of stroke!.p) expect(Math.round(value * 1000)).toBeCloseTo(value * 1000, 6)
    expect(stroke!.p.slice(0, 2)).toEqual([0.1, 0.2])
    expect(stroke!.p.slice(-2)).toEqual([0.9, 0.6])
  })

  it('curva mantém a forma', () => {
    const circle = Array.from({ length: 120 }, (_, i) => {
      const a = (i / 119) * Math.PI * 2
      return [0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3]
    })
    const stroke = compactStroke(circle, 0)!
    expect(stroke.p.length / 2).toBeGreaterThan(8)
    expect(stroke.p.length / 2).toBeLessThan(120)
  })

  it('toque sem arrastar vira um pontinho; lixo vira null; cor inválida vira a primeira', () => {
    expect(compactStroke([[0.5, 0.5]], 1)?.p).toEqual([0.5, 0.5, 0.5, 0.5])
    expect(compactStroke([], 1)).toBeNull()
    expect(compactStroke([[Number.NaN, 1]], 1)).toBeNull()
    expect(compactStroke([[0.2, 0.2], [0.4, 0.4]], 99)?.c).toBe(0)
    expect(compactStroke([[-3, 7], [0.5, 0.5]], 1)?.p.slice(0, 2)).toEqual([0, 1])
  })

  it('simplify não mexe em traço de 2 pontos', () => {
    expect(simplify([[0, 0], [1, 1]])).toEqual([[0, 0], [1, 1]])
  })
})

describe('teto de pontos', () => {
  it('corta o traço que não cabe e recusa quando o desenho está cheio', () => {
    const big: Stroke = { c: 0, p: Array.from({ length: (MAX_POINTS - 1) * 2 }, (_, i) => (i % 100) / 100) }
    const almost = appendStroke([], big)!
    expect(countPoints(almost)).toBe(MAX_POINTS - 1)
    // Sobra 1 ponto: não dá nem um traço.
    expect(appendStroke(almost, { c: 1, p: [0.1, 0.1, 0.2, 0.2] })).toBeNull()

    const half: Stroke = { c: 0, p: Array.from({ length: (MAX_POINTS - 3) * 2 }, () => 0.5) }
    const cut = appendStroke(appendStroke([], half)!, { c: 1, p: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4] })!
    expect(countPoints(cut)).toBe(MAX_POINTS)
    expect(cut[1].p).toEqual([0.1, 0.1, 0.2, 0.2, 0.3, 0.3])
  })

  it('teto de traços', () => {
    const many = Array.from({ length: MAX_STROKES }, () => ({ c: 0, p: [0.1, 0.1, 0.1, 0.1] }))
    expect(appendStroke(many, { c: 0, p: [0.2, 0.2, 0.2, 0.2] })).toBeNull()
  })
})

describe('leitura tolerante (o que vem da rede)', () => {
  it('lixo vira desenho vazio, sem exceção', () => {
    for (const raw of [null, undefined, 3, 'oi', {}, [null], [{ c: 1 }], [{ p: 'x' }], [{ p: [0.1, 'a'] }]]) {
      expect(readDrawing(raw)).toEqual([])
    }
  })

  it('limpa coordenadas, cor e ponto solto', () => {
    const drawing = readDrawing([
      { c: 3, p: [0.1, 0.2, 0.3, 0.4] },
      { c: 42, p: [2, -1, 0.5] }, // cor inválida, fora da tela, ímpar
      { c: 1, p: [0.5] }, // menos de um ponto
    ])
    expect(drawing).toEqual([
      { c: 3, p: [0.1, 0.2, 0.3, 0.4] },
      { c: 0, p: [1, 0, 1, 0] },
    ])
  })

  it('respeita os tetos de pontos e de traços', () => {
    const huge = Array.from({ length: 50 }, () => ({ c: 0, p: Array.from({ length: 200 }, () => 0.5) }))
    expect(countPoints(readDrawing(huge))).toBeLessThanOrEqual(MAX_POINTS + 1)
    const lots = Array.from({ length: 400 }, () => ({ c: 0, p: [0.1, 0.1, 0.2, 0.2] }))
    expect(readDrawing(lots).length).toBeLessThanOrEqual(MAX_STROKES)
  })
})

describe('desenho na tela', () => {
  it('pontos do polyline no espaço 1000×625', () => {
    expect(polylinePoints([0, 0, 1, 1, 0.5])).toBe('0,0 1000,625')
  })

  it('formato do DrawingBoard', () => {
    expect(toBoardStrokes([{ c: 1, p: [0.1, 0.2, 0.3, 0.4] }], 9)).toEqual([
      { points: [[0.1, 0.2], [0.3, 0.4]], color: PALETTE[1], width: 9 },
    ])
  })

  it('rabisco dos bots é válido e cabe no teto', () => {
    const strokes = botStrokes(seededRng(3), 5)
    expect(strokes).toHaveLength(5)
    expect(readDrawing(strokes)).toEqual(strokes)
    expect(countPoints(strokes)).toBeLessThan(MAX_POINTS)
  })

  it('freio dos envios: o 1º traço sai na hora; os seguintes, no máximo um a cada SEND_GAP_MS', () => {
    const t = 5_000_000
    expect(SEND_GAP_MS).toBeGreaterThanOrEqual(1500)
    // Nunca enviou (ou faz tempo): já.
    expect(sendDelay(0, t)).toBe(0)
    expect(sendDelay(t - SEND_GAP_MS, t)).toBe(0)
    expect(sendDelay(t - 10 * SEND_GAP_MS, t)).toBe(0)
    // Acabou de enviar: espera o resto do intervalo — conta do último envio, não do último traço.
    expect(sendDelay(t, t)).toBe(SEND_GAP_MS)
    expect(sendDelay(t - 500, t)).toBe(SEND_GAP_MS - 500)
    // Relógio do aparelho voltou no tempo: nunca segura mais que um intervalo.
    expect(sendDelay(t + 60_000, t)).toBe(SEND_GAP_MS)
  })

  it('campos do slot: desenho inteiro, "Pronto" e, só na 2ª etapa, quantos traços vieram da 1ª', () => {
    const strokes: Stroke[] = [{ c: 1, p: [0.1, 0.1, 0.2, 0.2] }]
    expect(slotFields(strokes, false, null)).toEqual({ s: strokes, done: false })
    expect(slotFields(strokes, true, null)).toEqual({ s: strokes, done: true })
    expect(slotFields(strokes, true, 0)).toEqual({ s: strokes, done: true, n1: 0 })
    expect('n1' in slotFields(strokes, false, null)).toBe(false)
  })

  it('o JSON de um desenho cheio fica pequeno', () => {
    const rng = seededRng(5)
    let strokes: Stroke[] = []
    for (let i = 0; i < 200; i += 1) {
      const points = Array.from({ length: 40 }, () => [rng(), rng()])
      const next = appendStroke(strokes, compactStroke(points, i % PALETTE.length))
      if (!next) break
      strokes = next
    }
    expect(countPoints(strokes)).toBeLessThanOrEqual(MAX_POINTS)
    expect(JSON.stringify({ s: strokes }).length).toBeLessThan(9000)
  })
})
