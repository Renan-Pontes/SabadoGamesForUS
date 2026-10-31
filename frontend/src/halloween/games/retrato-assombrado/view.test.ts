import { describe, expect, it } from 'vitest'
import type { HInput } from '../../engine/types'
import { MAX_POINTS, type Stroke } from './drawing'
import type { RaPhase } from './engine'
import { drawView } from './view'

const A: Stroke = { c: 0, p: [0.1, 0.1, 0.2, 0.2] }
const B: Stroke = { c: 1, p: [0.3, 0.3, 0.4, 0.4] }
const C: Stroke = { c: 2, p: [0.5, 0.5, 0.6, 0.6] }
const D: Stroke = { c: 3, p: [0.7, 0.7, 0.8, 0.8] }

/** Como o celular enxerga a fase (rodada 2). */
function at(phase: RaPhase) {
  const inputKey = phase === 'draw2' || phase === 'gallery' ? 'draw2-2' : 'draw1-2'
  return { phase, round: 2, inputKey }
}

describe('prancheta do celular (drawView)', () => {
  it('etapa 1 sem nada enviado: desenha, nada travado', () => {
    const view = drawView(at('draw1'), null, null)
    expect(view).toMatchObject({ stage: 1, strokes: [], sent: [], n1: null, done: false, canDraw: true, full: false })
  })

  it('o que espera o próximo envio aparece na tela na hora', () => {
    const slot: HInput = { k: 'draw1-2', s: [A] }
    const view = drawView(at('draw1'), slot, [A, B])
    expect(view.sent).toEqual([A])
    expect(view.strokes).toEqual([A, B])
  })

  it('etapa 2: só trava o que já foi enviado na 1ª — traço novo ainda na fila continua desfazível', () => {
    // Ainda não enviou nada na 2ª: o slot é o da 1ª etapa (2 traços).
    const first: HInput = { k: 'draw1-2', s: [A, B], done: true }
    expect(drawView(at('draw2'), first, null).n1).toBe(2)
    expect(drawView(at('draw2'), first, [A, B, C]).n1).toBe(2)
    // Já enviou na 2ª: vale o n1 gravado, mesmo com mais traços na fila.
    const second: HInput = { k: 'draw2-2', s: [A, B, C], n1: 2 }
    expect(drawView(at('draw2'), second, [A, B, C, D]).n1).toBe(2)
    expect(drawView(at('gallery'), second, null).n1).toBe(2)
  })

  it('"Pronto" só vale para a etapa atual', () => {
    const doneFirst: HInput = { k: 'draw1-2', s: [A], done: true }
    expect(drawView(at('draw1'), doneFirst, null)).toMatchObject({ done: true, canDraw: false })
    // O "Pronto" da 1ª etapa não fecha a 2ª.
    expect(drawView(at('draw2'), doneFirst, null)).toMatchObject({ done: false, canDraw: true })
    expect(drawView(at('draw1'), { k: 'draw1-2', s: [A], done: 'sim' }, null).done).toBe(false)
  })

  it('espiadinha e galeria: só olhar', () => {
    const slot: HInput = { k: 'draw1-2', s: [A] }
    expect(drawView(at('peek'), slot, null)).toMatchObject({ stage: 0, canDraw: false, n1: null, strokes: [A] })
    expect(drawView(at('gallery'), { k: 'draw2-2', s: [A, B], n1: 1 }, null)).toMatchObject({ stage: 0, canDraw: false })
  })

  it('desenho de outra rodada não aparece', () => {
    expect(drawView(at('draw1'), { k: 'draw2-1', s: [A, B] }, null).strokes).toEqual([])
  })

  it('tinta acabou', () => {
    const big: Stroke = { c: 0, p: Array.from({ length: (MAX_POINTS - 1) * 2 }, () => 0.5) }
    expect(drawView(at('draw1'), null, [big]).full).toBe(true)
    expect(drawView(at('draw1'), null, [A]).full).toBe(false)
  })
})
