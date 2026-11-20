import { describe, expect, it } from 'vitest'
import { bestVoice, cleanForSpeech, scoreVoice } from './narrator'

describe('texto falado pela voz do navegador', () => {
  it('tira onomatopeia que a voz soletraria', () => {
    expect(cleanForSpeech('Brrrrr! Que friaca!')).toBe('Que friaca!')
    expect(cleanForSpeech('Rô, rô, rô! Feliz Natal!')).toBe('Feliz Natal!')
    expect(cleanForSpeech('Ho ho ho! Ana tá na lista!')).toBe('Ana tá na lista!')
    expect(cleanForSpeech('kkkkk que isso')).toBe('que isso')
    expect(cleanForSpeech('Uhuuuu! Acertou!')).toBe('Acertou!')
  })

  it('tira emoji e símbolo (o Chrome lê o nome deles)', () => {
    expect(cleanForSpeech('🎁 O presente está com a Ana! ✨')).toBe('O presente está com a Ana!')
    expect(cleanForSpeech('Votem no celular! 🗳️')).toBe('Votem no celular!')
  })

  it('não mexe em palavra normal que parece onomatopeia', () => {
    expect(cleanForSpeech('Hoje o Rodrigo honrou a casa.')).toBe('Hoje o Rodrigo honrou a casa.')
    expect(cleanForSpeech('Ai, que frio!')).toBe('Ai, que frio!')
    expect(cleanForSpeech('Bravo, Brenda!')).toBe('Bravo, Brenda!')
  })

  it('sem nada para dizer, devolve vazio', () => {
    expect(cleanForSpeech('Brrrr! 🥶')).toBe('')
    expect(cleanForSpeech('🎄🎅')).toBe('')
  })
})

const voice = (name: string, lang: string) => ({ name, lang })

describe('escolha da voz da narração', () => {
  it('prefere a voz neural do Edge à do Google e às antigas do Windows', () => {
    const voices = [
      voice('Microsoft Maria - Portuguese (Brazil)', 'pt-BR'),
      voice('Google português do Brasil', 'pt-BR'),
      voice('Microsoft Francisca Online (Natural) - Portuguese (Brazil)', 'pt-BR'),
      voice('Google US English', 'en-US'),
    ]
    expect(bestVoice(voices)?.name).toContain('Francisca')
  })

  it('sem neural, fica com a do Google', () => {
    const voices = [voice('Microsoft Daniel - Portuguese (Brazil)', 'pt-BR'), voice('Google português do Brasil', 'pt-BR')]
    expect(bestVoice(voices)?.name).toBe('Google português do Brasil')
  })

  it('português do Brasil ganha de Portugal, mesmo neural', () => {
    const voices = [voice('Microsoft Raquel Online (Natural) - Portuguese (Portugal)', 'pt-PT'), voice('Luciana', 'pt_BR')]
    expect(bestVoice(voices)?.name).toBe('Luciana')
  })

  it('nenhuma em português: null', () => {
    expect(bestVoice([voice('Samantha', 'en-US')])).toBeNull()
    expect(scoreVoice(voice('Samantha', 'en-US'))).toBe(-1)
  })
})
