import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCARE_DURATION_MS, playScareSound } from './config'
import { ANIMATRONIC_FLASHES, ANIMATRONIC_IMPACT_MS, FACE_HIT_MS } from './scaryTiming'

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
