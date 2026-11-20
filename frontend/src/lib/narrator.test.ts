import { describe, expect, it } from 'vitest'
import { bestVoice, scoreVoice } from './narrator'

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
