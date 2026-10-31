import { describe, expect, it } from 'vitest'
import {
  SOUND_DEFAULTS,
  getSoundState,
  setMuted,
  setRandomScaresEnabled,
  setSoundRole,
  setVolume,
  subscribeSound,
} from './settings'

describe('preferências de som', () => {
  it('TV nasce com som; celular nasce mudo', () => {
    expect(SOUND_DEFAULTS.tv.muted).toBe(false)
    expect(SOUND_DEFAULTS.phone.muted).toBe(true)
    // Em Node (sem window) o papel inicial é celular e o Web Audio não existe.
    expect(getSoundState().role).toBe('phone')
    expect(getSoundState().muted).toBe(true)
    expect(getSoundState().supported).toBe(false)
  })

  it('trocar de papel carrega o padrão daquele papel', () => {
    setSoundRole('tv')
    expect(getSoundState().role).toBe('tv')
    expect(getSoundState().muted).toBe(false)
    expect(getSoundState().randomScares).toBe(true)
    setSoundRole('phone')
    expect(getSoundState().muted).toBe(true)
  })

  it('volume fica entre 0 e 1 e ignora NaN', () => {
    setVolume(3)
    expect(getSoundState().volume).toBe(1)
    setVolume(-1)
    expect(getSoundState().volume).toBe(0)
    setVolume(Number.NaN)
    expect(getSoundState().volume).toBe(0)
    setVolume(0.4)
    expect(getSoundState().volume).toBeCloseTo(0.4)
  })

  it('avisa só quando algo muda e troca a identidade do estado', () => {
    let calls = 0
    const stop = subscribeSound(() => {
      calls += 1
    })
    const before = getSoundState()
    setMuted(before.muted)
    expect(calls).toBe(0)
    setMuted(!before.muted)
    expect(calls).toBe(1)
    expect(getSoundState()).not.toBe(before)
    setRandomScaresEnabled(!getSoundState().randomScares)
    expect(calls).toBe(2)
    stop()
    setMuted(before.muted)
    expect(calls).toBe(2)
  })
})
