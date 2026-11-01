import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCARE_DURATION_MS, playScareSound } from './config'
import {
  ANIMATRONIC_FLASHES,
  ANIMATRONIC_IMPACT_MS,
  APAGAO_BREATH_MS,
  APAGAO_HIT_MS,
  FACE_HIT_MS,
  RASTEJANTE_LUNGE_MS,
  RASTEJANTE_STEPS,
} from './scaryTiming'

type Call = [string, { delay?: number; volume?: number; loud?: boolean } | undefined]

const calls = vi.hoisted(() => ({ sfx: [] as Call[], hush: [] as number[] }))

vi.mock('../audio', () => ({
  playSfx: (name: string, options?: Call[1]) => {
    calls.sfx.push([name, options])
    return 1
  },
  hushMusic: (seconds: number) => {
    calls.hush.push(seconds)
  },
  speakSpooky: () => () => undefined,
  getSoundState: () => ({ muted: false, volume: 0.8 }),
}))

beforeEach(() => {
  calls.sfx.length = 0
  calls.hush.length = 0
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
    expect(calls.sfx).toEqual([
      ['shriek', { delay: FACE_HIT_MS / 1000 }],
      ['slam', { delay: FACE_HIT_MS / 1000 }],
    ])
  })

  it('apagão: silêncio, respiração, e o grito com o impacto no bote', () => {
    playScareSound('apagao')
    expect(calls.hush).toEqual([SCARE_DURATION_MS.apagao / 1000])
    const at = (name: string) => calls.sfx.find(([n]) => n === name)?.[1]?.delay
    expect(at('breath')).toBe(APAGAO_BREATH_MS / 1000)
    expect(at('shriek')).toBe(APAGAO_HIT_MS / 1000)
    expect(at('slam')).toBe(APAGAO_HIT_MS / 1000)
  })

  it('rastejante: um estalo por pulo e o guincho no bote', () => {
    playScareSound('rastejante')
    const crawls = calls.sfx.filter(([name]) => name === 'crawl').map(([, options]) => options?.delay)
    expect(crawls).toEqual(RASTEJANTE_STEPS.map((ms) => ms / 1000))
    const screech = calls.sfx.find(([name]) => name === 'screech')?.[1]?.delay ?? 0
    expect(Math.abs(screech * 1000 - RASTEJANTE_LUNGE_MS)).toBeLessThanOrEqual(30)
  })

  it("cenas 'scream' e 'static' pedem o caminho alto; o som dos jogos não muda", () => {
    playScareSound('scream')
    expect(calls.sfx).toEqual([
      ['scream', { loud: true }],
      ['slam', { volume: 0.7 }],
    ])
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
