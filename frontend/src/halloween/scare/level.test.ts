import { afterEach, describe, expect, it } from 'vitest'
import {
  AUTO_SCARY_GAP_MS,
  MEME_SCARES,
  SCARY_SCARES,
  applyScareLevel,
  autoScaryGapMs,
  emitScare,
  onScare,
  shouldDoubleTap,
} from './bus'
import type { ScareRequest } from './bus'
import { SCARE_DURATION_MS } from './config'
import { NIGHTMARE, getScareLevel, hasScareConsent, parseConsent, resetScareConsentForTests } from './level'
import { APAGAO_HIT_MS, APAGAO_OFF_MS, RASTEJANTE_LUNGE_MS, RASTEJANTE_STEPS } from './scaryTiming'

const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const CSS = fs.readFileSync(new URL('./scary.css', import.meta.url), 'utf8')

afterEach(() => resetScareConsentForTests(null))

describe('aviso de entrada e nível dos sustos', () => {
  it('sem resposta ao aviso, não há consentimento (o palco não mostra nada)', () => {
    expect(hasScareConsent()).toBe(false)
    expect(getScareLevel()).toBeNull()
  })

  it('lê só escolhas válidas do armazenamento', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent('lixo')).toBeNull()
    expect(parseConsent('{"level":"talvez"}')).toBeNull()
    expect(parseConsent('{"level":"leve","at":5}')).toEqual({ level: 'leve', at: 5 })
  })

  it('modo leve: todo assustador vira meme; meme continua meme', () => {
    for (const kind of SCARY_SCARES) expect(MEME_SCARES).toContain(applyScareLevel(kind, 'leve'))
    expect(applyScareLevel('doot', 'leve')).toBe('doot')
    expect(applyScareLevel('apagao', 'pesadelo')).toBe('apagao')
    expect(applyScareLevel('apagao', null)).toBe('apagao')
  })

  it('modo leve vale também para o susto pedido pelo nome (host, jogo)', () => {
    resetScareConsentForTests({ level: 'leve', at: 0 })
    const got: ScareRequest[] = []
    const off = onScare((request) => got.push(request))
    emitScare('animatronic')
    emitScare('scary')
    off()
    for (const request of got) expect(MEME_SCARES).toContain(request.kind)
  })

  it('pesadelo: assustador automático de 6 em 6 min (normal: 15)', () => {
    expect(autoScaryGapMs('pesadelo')).toBe(NIGHTMARE.scaryGapMs)
    expect(autoScaryGapMs(null)).toBe(AUTO_SCARY_GAP_MS)
    expect(autoScaryGapMs('leve')).toBe(AUTO_SCARY_GAP_MS)
    expect(NIGHTMARE.randomMinMs).toBeLessThan(NIGHTMARE.randomMaxMs)
  })

  it('segundo bote: só no pesadelo, só depois de assustador, nunca depois do rosto nem em cadeia', () => {
    const always = () => 0
    expect(shouldDoubleTap({ id: 1, kind: 'apagao' }, 'pesadelo', always)).toBe(true)
    expect(shouldDoubleTap({ id: 1, kind: 'apagao' }, 'leve', always)).toBe(false)
    expect(shouldDoubleTap({ id: 1, kind: 'face' }, 'pesadelo', always)).toBe(false)
    expect(shouldDoubleTap({ id: 1, kind: 'doot' }, 'pesadelo', always)).toBe(false)
    expect(shouldDoubleTap({ id: -3, kind: 'animatronic' }, 'pesadelo', always)).toBe(false)
    expect(shouldDoubleTap({ id: 1, kind: 'animatronic' }, 'pesadelo', () => 0.99)).toBe(false)
  })
})

describe('sustos de tensão', () => {
  it('apagão: a TV desliga, quase 3 s de escuro e o rosto ainda tem tempo de tela', () => {
    expect(APAGAO_OFF_MS).toBeLessThan(APAGAO_HIT_MS)
    expect(APAGAO_HIT_MS - APAGAO_OFF_MS).toBeGreaterThanOrEqual(2500)
    expect(SCARE_DURATION_MS.apagao - APAGAO_HIT_MS).toBeGreaterThanOrEqual(1200)
  })

  it('rastejante: os pulos do CSS batem com os tempos do TS, ≤ 3 por segundo, e o bote cabe na cena', () => {
    const start = CSS.indexOf('@keyframes hws-crawl-steps {')
    const body = CSS.slice(start, CSS.indexOf('\n}', start))
    const jumps = [...body.matchAll(/,\s*([\d.]+)%\s*\{/g)].map((match) => Number(match[1])).filter((p) => p > 0)
    const fromTs = RASTEJANTE_STEPS.map((at) => Math.round((at / RASTEJANTE_LUNGE_MS) * 100))
    // Cada bloco "a%, b%" segura até o próximo: os inícios são 0 e os passos.
    const starts = [...body.matchAll(/^\s*([\d.]+)%,/gm)].map((match) => Number(match[1])).filter((p) => p > 0)
    expect(starts).toEqual(fromTs)
    expect(jumps.length).toBeGreaterThan(0)
    for (let i = 1; i < RASTEJANTE_STEPS.length; i += 1) {
      expect(RASTEJANTE_STEPS[i] - RASTEJANTE_STEPS[i - 1]).toBeGreaterThanOrEqual(300)
    }
    expect(RASTEJANTE_STEPS[RASTEJANTE_STEPS.length - 1]).toBeLessThan(RASTEJANTE_LUNGE_MS)
    expect(SCARE_DURATION_MS.rastejante - RASTEJANTE_LUNGE_MS).toBeGreaterThanOrEqual(1000)
  })
})
