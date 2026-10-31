import { describe, expect, it } from 'vitest'
import { FX_FRESH_MS, decideFx } from './decide'

const NOW = 1_000_000

describe('decideFx', () => {
  it('sala sem fx: guarda 0 e não faz nada', () => {
    expect(decideFx({}, NOW, null)).toEqual({ lastSeen: 0, actions: [] })
    expect(decideFx(undefined, NOW, null)).toEqual({ lastSeen: 0, actions: [] })
    expect(decideFx(null, undefined, 3)).toEqual({ lastSeen: 0, actions: [] })
  })

  it('primeira vez: susto recente dispara', () => {
    const result = decideFx({ id: 4, scare: 'zoom', name: 'Ana', at: NOW - 3000 }, NOW, null)
    expect(result).toEqual({ lastSeen: 4, actions: [{ type: 'scare', kind: 'zoom', name: 'Ana' }] })
  })

  it('primeira vez (recarregou a página): susto velho não repete', () => {
    const result = decideFx({ id: 4, scare: 'scream', at: NOW - FX_FRESH_MS - 1 }, NOW, null)
    expect(result).toEqual({ lastSeen: 4, actions: [] })
    // Sem relógio para comparar, também não arrisca.
    expect(decideFx({ id: 4, scare: 'scream' }, undefined, null).actions).toEqual([])
  })

  it('primeira vez: liga/desliga vale mesmo velho (é a última decisão do host)', () => {
    const result = decideFx({ id: 9, music: 'off', at: NOW - 3_600_000 }, NOW, null)
    expect(result.actions).toEqual([{ type: 'music', on: false }])
    expect(decideFx({ id: 9, scare: 'auto-off', at: 0 }, NOW, null).actions).toEqual([
      { type: 'randomScares', on: false },
    ])
  })

  it('mesmo id: nada (o poll repete a resposta o tempo todo)', () => {
    expect(decideFx({ id: 7, scare: 'pipe', at: NOW }, NOW, 7)).toEqual({ lastSeen: 7, actions: [] })
  })

  it('id novo: executa música e susto juntos', () => {
    const result = decideFx({ id: 8, scare: 'random', music: 'on', at: NOW - 500 }, NOW, 7)
    expect(result.lastSeen).toBe(8)
    expect(result.actions).toEqual([
      { type: 'music', on: true },
      { type: 'scare', kind: 'random' },
    ])
  })

  it('id novo sem horário: confia (acabou de mudar enquanto a TV olhava)', () => {
    expect(decideFx({ id: 8, scare: 'doot' }, NOW, 7).actions).toEqual([{ type: 'scare', kind: 'doot' }])
  })

  it('id novo mas velho (aba escondida por muito tempo): só o liga/desliga', () => {
    const result = decideFx({ id: 8, scare: 'eyes', music: 'off', at: NOW - 60_000 }, NOW, 7)
    expect(result.actions).toEqual([{ type: 'music', on: false }])
  })

  it('id menor: sala recriada, recomeça a contagem sem executar', () => {
    expect(decideFx({ id: 2, scare: 'pipe', at: NOW }, NOW, 40)).toEqual({ lastSeen: 2, actions: [] })
  })

  it('auto-on/auto-off controlam os sustos aleatórios, não assustam', () => {
    expect(decideFx({ id: 3, scare: 'auto-on', at: NOW }, NOW, 2).actions).toEqual([
      { type: 'randomScares', on: true },
    ])
  })

  it('ignora lixo: id não numérico, nome vazio, music estranho', () => {
    expect(decideFx({ id: Number.NaN, scare: 'pipe' } as never, NOW, null).actions).toEqual([])
    const result = decideFx({ id: 5, scare: 'zoom', name: '   ', music: 'loud' as never, at: NOW }, NOW, 4)
    expect(result.actions).toEqual([{ type: 'scare', kind: 'zoom' }])
  })
})
