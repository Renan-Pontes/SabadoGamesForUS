import { describe, expect, it } from 'vitest'
import { rankingColumns, tvDoorWidth, visibleNames } from './view'

/**
 * Orçamento de tela da TV. Sem navegador nos testes, as contas são as do
 * desenho: na revelação da 1ª rodada com 15 pessoas cabem, um embaixo do
 * outro, o cabeçalho, a porta, até 4 linhas de nomes e a legenda de 2 linhas
 * ("💀 Ana, Bia, Caio… viraram fantasmas!") — a frase mais importante da
 * rodada não pode cair para fora da tela.
 */

/** Altura (px) da revelação mais cheia: tudo menos a porta, nas fontes mínimas da TV. */
function revealHeight(viewport: { width: number; height: number }) {
  const vw = viewport.width / 100
  const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value))
  const frame = 16 + 45 + 16 + 16 // moldura: topo, cabeçalho, respiro, rodapé
  const topBar = clamp(28.8, 2.4 * vw, 41.6) + 4 + clamp(35.2, 3 * vw, 54.4) * 1.1
  const name = clamp(28, 1.6 * vw, 32) * 1.2
  const door = tvDoorWidth(5, { width: viewport.width - 260, height: viewport.height }) * 1.6
  const corridor = 24 + door + 8 + 4 * name + 34
  const caption = 2 * clamp(64, 4.6 * vw, 83.2) * 1.05 + 8
  return frame + topBar + 20 + corridor + 16 + caption
}

describe('orçamento de tela da TV', () => {
  it.each([
    [1920, 1080],
    [1536, 864],
  ])('na TV %ix%i a revelação mais cheia cabe sem rolar', (width, height) => {
    expect(revealHeight({ width, height })).toBeLessThanOrEqual(height)
  })

  it('a porta nunca passa de 27% da altura da TV', () => {
    for (const [width, height] of [
      [1920, 1080],
      [1536, 864],
      [1280, 720],
    ]) {
      for (const doors of [3, 4, 5]) {
        expect(tvDoorWidth(doors, { width: width - 260, height }) * 1.6).toBeLessThanOrEqual(height * 0.27 + 1)
      }
    }
  })

  it('embaixo de cada porta: no máximo 4 linhas (3 nomes e "+N" quando lota)', () => {
    expect(visibleNames([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 })
    expect(visibleNames([1, 2, 3, 4])).toEqual({ shown: [1, 2, 3, 4], more: 0 })
    expect(visibleNames([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], more: 2 })
    expect(visibleNames([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ shown: [1, 2, 3], more: 5 })
  })

  it('o ranking final de 15 pessoas cabe em 3 colunas de 5 linhas', () => {
    expect(rankingColumns(4)).toBe(1)
    expect(rankingColumns(6)).toBe(1)
    expect(rankingColumns(7)).toBe(2)
    expect(rankingColumns(10)).toBe(2)
    expect(rankingColumns(11)).toBe(3)
    expect(rankingColumns(15)).toBe(3)
  })
})
