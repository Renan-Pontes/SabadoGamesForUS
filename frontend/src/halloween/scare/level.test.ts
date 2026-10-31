import { afterEach, describe, expect, it } from 'vitest'
import { AUTO_SCARY_GAP_MS, shouldDoubleTap } from './bus'
import { SCARE_DURATION_MS } from './config'
import { NIGHTMARE, acceptScareWarning, hasScareConsent, parseConsent, resetScareConsentForTests } from './level'
import { APAGAO_HIT_MS, APAGAO_OFF_MS, RASTEJANTE_LUNGE_MS, RASTEJANTE_STEPS } from './scaryTiming'

const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const CSS = fs.readFileSync(new URL('./scary.css', import.meta.url), 'utf8')

afterEach(() => resetScareConsentForTests(null))

describe('aviso de entrada e modo pesadelo', () => {
  it('sem passar pelo aviso, nada de susto; "Entendi" libera', () => {
    expect(hasScareConsent()).toBe(false)
    acceptScareWarning(5)
    expect(hasScareConsent()).toBe(true)
  })

  it('lê o aceite guardado com tolerância', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent('lixo')).toBeNull()
    expect(parseConsent('null')).toBeNull()
    expect(parseConsent('{"at":5}')).toEqual({ at: 5 })
    // Quem aceitou numa versão anterior (com o campo velho) continua aceito.
    expect(parseConsent('{"level":"pesadelo","at":7}')).toEqual({ at: 7 })
  })

  it('sempre pesadelo: assustador automático de 6 em 6 min, sustos a cada 3–6 min', () => {
    expect(AUTO_SCARY_GAP_MS).toBe(NIGHTMARE.scaryGapMs)
    expect(NIGHTMARE.scaryGapMs).toBe(6 * 60_000)
    expect(NIGHTMARE.randomMinMs).toBeLessThan(NIGHTMARE.randomMaxMs)
  })

  it('segundo bote: só depois de assustador, nunca depois do rosto nem em cadeia', () => {
    const always = () => 0
    expect(shouldDoubleTap({ id: 1, kind: 'apagao' }, always)).toBe(true)
    expect(shouldDoubleTap({ id: 1, kind: 'video' }, always)).toBe(true)
    expect(shouldDoubleTap({ id: 1, kind: 'face' }, always)).toBe(false)
    expect(shouldDoubleTap({ id: 1, kind: 'doot' }, always)).toBe(false)
    expect(shouldDoubleTap({ id: -3, kind: 'animatronic' }, always)).toBe(false)
    expect(shouldDoubleTap({ id: 1, kind: 'animatronic' }, () => 0.99)).toBe(false)
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
