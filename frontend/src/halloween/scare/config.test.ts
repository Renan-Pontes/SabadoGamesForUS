import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isLoudSfx } from '../audio/loud'
import { isSfxName } from '../audio/types'
import type { SfxName } from '../audio/types'
import { XMAS_EFFECTS } from './bus'
import {
  ELF_SHOUT_MS,
  GIFT_OPEN_MS,
  HOHOHO_SIGN_MS,
  JOKE_GIFTS,
  LIGHTS_BLACKOUT_MS,
  REINDEER_DROP_MS,
  SCARE_DURATION_MS,
  SECRET_SANTA_GIFT_MS,
  SECRET_SANTA_REVEAL_MS,
  playScareSound,
  santaLine,
  secretSantaGift,
} from './config'
import { ANIMATRONIC_FLASHES, ANIMATRONIC_IMPACT_MS, FACE_HIT_MS } from './scaryTiming'

type Call = [string, { delay?: number; volume?: number; loud?: boolean } | undefined]

const calls = vi.hoisted(() => ({
  sfx: [] as Call[],
  hush: [] as number[],
  spooky: [] as string[],
  festive: [] as { text: string; pitch?: number; rate?: number }[],
}))

vi.mock('../audio', () => ({
  playSfx: (name: string, options?: Call[1]) => {
    calls.sfx.push([name, options])
    return 1
  },
  hushMusic: (seconds: number) => {
    calls.hush.push(seconds)
  },
  speakSpooky: (text: string) => {
    calls.spooky.push(text)
    return () => undefined
  },
  speakFestive: (text: string, options?: { pitch?: number; rate?: number }) => {
    calls.festive.push({ text, ...options })
    return () => undefined
  },
  getSoundState: () => ({ muted: false, volume: 0.8 }),
}))

beforeEach(() => {
  calls.sfx.length = 0
  calls.hush.length = 0
  calls.spooky.length = 0
  calls.festive.length = 0
})

describe('som das cenas de susto', () => {
  it('animatrônico: estalos nos 2 clarões e o guincho a ±30 ms do bote encher a tela', () => {
    playScareSound('animatronic')
    expect(calls.hush).toEqual([SCARE_DURATION_MS.animatronic / 1000])
    const flickers = calls.sfx.filter(([name]) => name === 'flicker')
    expect(flickers.map(([, options]) => options?.delay)).toEqual(ANIMATRONIC_FLASHES.map(({ at }) => at / 1000))
    const screech = calls.sfx.find(([name]) => name === 'screech')
    expect(screech).toBeDefined()
    expect(Math.abs((screech?.[1]?.delay ?? 0) * 1000 - ANIMATRONIC_IMPACT_MS)).toBeLessThanOrEqual(30)
  })

  it('rosto: o grito sai junto com o rosto', () => {
    playScareSound('face')
    expect(calls.sfx).toEqual([['shriek', { delay: FACE_HIT_MS / 1000 }]])
  })

  it("cenas 'scream' e 'static' pedem o caminho alto; o som dos jogos não muda", () => {
    playScareSound('scream')
    expect(calls.sfx).toEqual([['scream', { loud: true }]])
    calls.sfx.length = 0
    playScareSound('static')
    expect(calls.sfx).toEqual([
      ['static', { loud: true }],
      ['scream', { delay: 1.2, volume: 0.7, loud: true }],
    ])
  })

  it('os de meme continuam no nível normal', () => {
    for (const kind of ['doot', 'zoom', 'pumpkin', 'pipe', 'skeletons', 'spider'] as const) playScareSound(kind)
    expect(calls.sfx.length).toBeGreaterThan(0)
    for (const [, options] of calls.sfx) expect(options?.loud).toBeUndefined()
  })
})

describe('som dos efeitos de Natal', () => {
  // As falas saem por window.setTimeout (no Node não há window).
  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each([...XMAS_EFFECTS])('%s: só efeitos que existem, no nível normal, dentro do tempo de tela', (kind) => {
    playScareSound(kind, 'Ana')
    expect(calls.sfx.length).toBeGreaterThan(0)
    for (const [name, options] of calls.sfx) {
      expect(isSfxName(name), name).toBe(true)
      // Nada de susto: nem o caminho alto, nem os efeitos que vão por ele.
      expect(options?.loud).toBeUndefined()
      expect(isLoudSfx(name as SfxName), name).toBe(false)
      expect(['scream', 'shriek', 'screech', 'jumpscare', 'static'], name).not.toContain(name)
      expect((options?.delay ?? 0) * 1000).toBeLessThan(SCARE_DURATION_MS[kind])
    }
  })

  it('o zoom suspeito ganhou o boing junto com o "vine boom"', () => {
    playScareSound('zoom')
    expect(calls.sfx.map(([name]) => name)).toEqual(['boom', 'boing'])
  })

  it('as falas de Natal usam a voz natural (nunca a assombrada) e saem no tempo da tela', () => {
    for (const kind of XMAS_EFFECTS) playScareSound(kind, 'Ana')
    vi.runAllTimers()
    expect(calls.spooky).toEqual([])
    const texts = calls.festive.map(({ text }) => text)
    expect(texts).toContain(santaLine('Ana'))
    expect(texts).toContain('Ana')
    // Papai Noel fala mais grave que o normal; o duende, fino.
    expect(calls.festive.find(({ text }) => text === santaLine('Ana'))?.pitch).toBeLessThan(1)
    expect(calls.festive.find(({ text }) => text === 'Feliz Natal!')?.pitch).toBeGreaterThan(1.4)
  })

  it('a fala que ainda não começou é cancelada se a cena sair antes', () => {
    const stop = playScareSound('hohoho', 'Ana')
    stop()
    vi.runAllTimers()
    expect(calls.festive).toEqual([])
  })

  it('Papai Noel ri com o efeito sintetizado e depois cita a lista dos malcriados', () => {
    playScareSound('hohoho', 'Beto')
    expect(calls.sfx.map(([name]) => name)).toContain('hohoho')
    expect(santaLine()).not.toMatch(/Rô/)
    expect(santaLine('Beto')).toContain('Beto')
    expect(santaLine('Beto')).toContain('malcriados')
  })

  it('amigo secreto: o presente-piada é sempre o mesmo para o mesmo nome e vem da lista', () => {
    expect(secretSantaGift('Ana')).toBe(secretSantaGift('  ana '))
    for (const name of ['Ana', 'Beto', 'Carla', 'Dudu', 'Zé', '']) expect(JOKE_GIFTS).toContain(secretSantaGift(name))
    expect(JOKE_GIFTS).toContain(secretSantaGift())
    // Nomes diferentes não ganham todos o mesmo presente.
    const gifts = new Set(['Ana', 'Beto', 'Carla', 'Dudu', 'Edu', 'Fê', 'Gabi', 'Hugo'].map(secretSantaGift))
    expect(gifts.size).toBeGreaterThan(2)
  })

  it('os tempos combinados cabem no tempo de tela de cada efeito', () => {
    expect(HOHOHO_SIGN_MS).toBeLessThan(SCARE_DURATION_MS.hohoho - 1000)
    expect(GIFT_OPEN_MS).toBeLessThan(SCARE_DURATION_MS.giftRain - 800)
    expect(REINDEER_DROP_MS).toBeLessThan(SCARE_DURATION_MS.reindeer - 800)
    expect(LIGHTS_BLACKOUT_MS).toBeLessThan(SCARE_DURATION_MS.lightsParty - 600)
    expect(SECRET_SANTA_REVEAL_MS).toBeLessThan(SECRET_SANTA_GIFT_MS)
    expect(SECRET_SANTA_GIFT_MS).toBeLessThan(SCARE_DURATION_MS.secretSanta - 1000)
    expect(ELF_SHOUT_MS).toBeLessThan(SCARE_DURATION_MS.elfChoir - 500)
    for (const kind of XMAS_EFFECTS) expect(SCARE_DURATION_MS[kind]).toBeLessThanOrEqual(4500)
  })
})
