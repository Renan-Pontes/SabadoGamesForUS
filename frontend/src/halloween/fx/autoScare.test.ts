import { afterEach, describe, expect, it, vi } from 'vitest'
import { canRollRareScare, isNarrating, randomScareDecision } from './autoScare'
import type { AutoScareState } from './autoScare'

const idle: AutoScareState = { enabled: true, hidden: false, suppressed: false, showing: false, narrating: false }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('quando os sustos automáticos podem sair', () => {
  it('livre: o de 4–9 min sai e o raro pode rolar', () => {
    expect(randomScareDecision(idle)).toBe('fire')
    expect(canRollRareScare(idle)).toBe(true)
  })

  it('TV narrando: o susto espera a frase acabar (e o raro não rola)', () => {
    expect(randomScareDecision({ ...idle, narrating: true })).toBe('wait')
    expect(canRollRareScare({ ...idle, narrating: true })).toBe(false)
  })

  it('aba escondida, revelação ou outro susto na tela: espera', () => {
    for (const busy of ['hidden', 'suppressed', 'showing'] as const) {
      expect(randomScareDecision({ ...idle, [busy]: true })).toBe('wait')
      expect(canRollRareScare({ ...idle, [busy]: true })).toBe(false)
    }
  })

  it('desligado: pula o intervalo inteiro, mesmo narrando', () => {
    expect(randomScareDecision({ ...idle, enabled: false, narrating: true })).toBe('skip')
    expect(canRollRareScare({ ...idle, enabled: false })).toBe(false)
  })

  it('isNarrating lê a voz do navegador (e não quebra sem ela)', () => {
    expect(isNarrating()).toBe(false)
    vi.stubGlobal('window', { speechSynthesis: { speaking: true } })
    expect(isNarrating()).toBe(true)
    vi.stubGlobal('window', { speechSynthesis: { speaking: false } })
    expect(isNarrating()).toBe(false)
    vi.stubGlobal('window', {})
    expect(isNarrating()).toBe(false)
  })
})
