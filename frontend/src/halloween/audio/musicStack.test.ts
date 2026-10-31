import { describe, expect, it } from 'vitest'
import { createMusicStack } from './musicStack'

/** Pilha com o fim de lote controlado à mão (no app é uma microtask). */
function setup() {
  let pending: (() => void)[] = []
  const stack = createMusicStack<string>((fn) => pending.push(fn))
  const endBatch = () => {
    const run = pending
    pending = []
    for (const fn of run) fn()
  }
  let notifications = 0
  stack.subscribe(() => {
    notifications += 1
  })
  return { stack, endBatch, notifications: () => notifications }
}

describe('pilha de trilhas', () => {
  it('sem pedido nenhum, não há trilha pedida', () => {
    const { stack } = setup()
    expect(stack.top()).toEqual({ track: null, requested: false })
  })

  it('o último montado vence e, ao desmontar, volta o anterior', () => {
    const { stack, endBatch } = setup()
    stack.set('jogo', 'tension')
    endBatch()
    stack.set('revelacao', 'victory')
    endBatch()
    expect(stack.top().track).toBe('victory')
    stack.remove('revelacao')
    expect(stack.top().track).toBe('tension')
    stack.remove('jogo')
    expect(stack.top()).toEqual({ track: null, requested: false })
  })

  it('null é silêncio enquanto estiver no topo', () => {
    const { stack, endBatch } = setup()
    stack.set('jogo', 'party')
    endBatch()
    stack.set('pausa', null)
    expect(stack.top()).toEqual({ track: null, requested: true })
    stack.remove('pausa')
    expect(stack.top().track).toBe('party')
  })

  it('trocar a trilha de um pedido antigo não passa na frente do mais novo', () => {
    const { stack, endBatch } = setup()
    stack.set('jogo', 'night')
    endBatch()
    stack.set('overlay', 'victory')
    endBatch()
    stack.set('jogo', 'day')
    expect(stack.top().track).toBe('victory')
    stack.remove('overlay')
    expect(stack.top().track).toBe('day')
  })

  it('montados no mesmo commit: o filho (efeito que roda primeiro) vence o pai', () => {
    const { stack, endBatch } = setup()
    // React roda os efeitos do filho antes dos do pai.
    stack.set('filho-jogo', 'chase')
    stack.set('pai-moldura', 'tension')
    endBatch()
    expect(stack.top().track).toBe('chase')
    // StrictMode: desmonta e monta de novo dentro do mesmo lote.
    stack.remove('filho-jogo')
    stack.remove('pai-moldura')
    stack.set('filho-jogo', 'chase')
    stack.set('pai-moldura', 'tension')
    endBatch()
    expect(stack.top().track).toBe('chase')
    // Um pedido de um commit posterior vence os dois.
    stack.set('susto', 'night')
    endBatch()
    expect(stack.top().track).toBe('night')
  })

  it('avisa só quando o topo muda de verdade e ignora ids desconhecidos', () => {
    const { stack, endBatch, notifications } = setup()
    stack.set('a', 'lobby')
    endBatch()
    expect(notifications()).toBe(1)
    stack.set('a', 'lobby')
    stack.remove('nao-existe')
    expect(notifications()).toBe(1)
    stack.set('a', 'quiz')
    expect(notifications()).toBe(2)
    expect(stack.size()).toBe(1)
  })
})
