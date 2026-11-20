import { describe, expect, it } from 'vitest'
import { spokenLineProblems } from '../../../lib/spokenLines'
import { makePlayers } from '../../engine/testkit'
import type { HInput } from '../../engine/types'
import { CATEGORIES } from './content'
import { MAX_POINTS, type Stroke } from './drawing'
import type { RaPhase } from './engine'
import { PHASE_LINES, drawView, finalSpoken, guessSpoken, resultSpoken, revealSpoken, showSpoken } from './view'

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

describe('falas da TV', () => {
  const players = makePlayers(6)
  const reveal = { chaos: null, caught: true, accused: 1, impostors: [1], tally: [{ id: 1, count: 3, voters: [2, 3, 4] }] }

  it('uma fala curta por momento', () => {
    expect(showSpoken(2, 'Ceia de Natal')).toBe('Rodada 2. A categoria é Ceia de Natal.')
    expect(revealSpoken(reveal, players)).toBe('Vlad era impostor!')
    expect(revealSpoken({ ...reveal, caught: false, accused: 2 }, players)).toBe('Mortícia era inocente! O impostor escapou.')
    expect(revealSpoken({ ...reveal, caught: false, accused: null, impostors: [1, 3] }, players)).toBe('Empate! Os impostores escaparam.')
    expect(revealSpoken({ ...reveal, caught: false, accused: null, tally: [] }, players)).toContain('Ninguém votou')
    expect(resultSpoken({ word: 'Rena', guess: 'rena', guessRight: true })).toBe('Acertou! A palavra era Rena.')
    expect(resultSpoken({ word: null, guess: null, guessRight: false })).toBe('')
    expect(PHASE_LINES.scores).toBeUndefined()
  })

  it('toda fala possível passa nas regras da voz', () => {
    const lines = [
      ...Object.values(PHASE_LINES),
      ...CATEGORIES.map((category, index) => showSpoken(index + 1, category.name)),
      ...CATEGORIES.flatMap((category) =>
        category.words.flatMap((word) => [
          resultSpoken({ word: word.text, guess: null, guessRight: false }),
          resultSpoken({ word: word.text, guess: 'x', guessRight: false }),
        ]),
      ),
      ...(['everyone', 'nobody', null] as const).flatMap((chaos) =>
        [true, false].flatMap((caught) => [revealSpoken({ ...reveal, chaos, caught }, players), revealSpoken({ ...reveal, chaos, caught, accused: null }, players)]),
      ),
      guessSpoken('Gasparzinho'),
      finalSpoken(players, []),
      finalSpoken(players, [1, 2, 3]),
      finalSpoken(players, [1, 2, 3, 4]),
    ]
    for (const line of lines) expect(spokenLineProblems(line ?? ''), line).toEqual([])
  })
})
