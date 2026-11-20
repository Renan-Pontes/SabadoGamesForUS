import { describe, expect, it } from 'vitest'
import { SPEECH_GAP_MS, paceDelay, spokenLineProblems } from './spokenLines'

describe('falas da TV', () => {
  it('fala boa passa sem problema', () => {
    expect(spokenLineProblems('Hora de votar! Quem recebeu a pergunta trocada?')).toEqual([])
    expect(spokenLineProblems('Rodada 2. A categoria é Comidas de Natal.')).toEqual([])
  })

  it('pega os vícios que deixam a voz robótica', () => {
    expect(spokenLineProblems('')).toEqual(['vazia'])
    expect(spokenLineProblems('Ho ho ho! Fim da festa!').join()).toContain('limpeza')
    expect(spokenLineProblems('Brrrr! Que frio!').join()).toContain('limpeza')
    expect(spokenLineProblems('Feliz Natal 🎄').join()).toContain('emoji')
    expect(spokenLineProblems('PEGARAM o espião!').join()).toContain('caixa alta')
    expect(spokenLineProblems('E o espião era...').join()).toContain('reticências')
    expect(spokenLineProblems('Ganhou um panetone (imaginário)').join()).toContain('parênteses')
    expect(spokenLineProblems('Pegaram o espião — a mesa venceu').join()).toContain('travessão')
    expect(spokenLineProblems('Precisa de 2+ votos').join()).toContain('símbolo')
    expect(spokenLineProblems('Faltam 30 s').join()).toContain('número com unidade')
    expect(spokenLineProblems('x'.repeat(111)).join()).toContain('longa demais')
    expect(spokenLineProblems('um dois três quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete').join()).toContain('palavras demais')
  })

  it('a fala espera o intervalo mínimo depois da anterior', () => {
    expect(paceDelay(900, null, 10_000)).toBe(900)
    expect(paceDelay(900, 0, 10_000)).toBe(900)
    expect(paceDelay(500, 9_000, 10_000)).toBe(SPEECH_GAP_MS - 1000)
  })
})
