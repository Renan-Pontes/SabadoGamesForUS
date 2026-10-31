import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AUTO_SCARY_GAP_MS,
  MEME_SCARES,
  RARE_SCARE,
  SCARE_KINDS,
  SCARY_RANDOM,
  SCARY_SCARES,
  SCARY_SHARE,
  emitScare,
  isConcreteScare,
  isScaryScare,
  onScare,
  pickAutoScare,
  pickScare,
  pickScaryScare,
  resolveScareKind,
} from './bus'
import type { ConcreteScare, ScareRequest } from './bus'
import { SCARE_DURATION_MS, scareCaption } from './config'
import ScareScene, { STATIC_GRAY_MIN, STATIC_GRAY_RANGE } from './scenes'
import {
  ANIMATRONIC_FLASHES,
  ANIMATRONIC_IMPACT_MS,
  ANIMATRONIC_RUSH_MS,
  FACE_HIT_MS,
  MAX_FLASHES_PER_SCARE,
  MIN_FLASH_GAP_MS,
  SCREECH_AT_MS,
} from './scaryTiming'

// O CSS de verdade, lido do disco (no vitest, `import './x.css?raw'` vem vazio).
const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const readCss = (file: string) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const CSS = `${readCss('./scary.css')}\n${readCss('./scare.css')}`

/** Corpos de todas as regras cujo seletor (ou um da lista) é exatamente `selector`. */
function ruleBodies(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:^|[}\\s,])${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'gm')
  return [...css.matchAll(pattern)].map((match) => match[1])
}

/** Divide por vírgulas que não estão dentro de parênteses. */
function splitTop(value: string, separator: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth === 0 && separator.test(char)) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

const KEYWORDS = new Set([
  'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'infinite', 'alternate',
  'alternate-reverse', 'normal', 'reverse', 'both', 'forwards', 'backwards', 'none', 'running', 'paused',
])

type ParsedAnimation = { name: string; durationMs: number; repeats: boolean }

/** As animações declaradas nas regras de `selector` (shorthand `animation:`). */
function animationsOf(selector: string): ParsedAnimation[] {
  const out: ParsedAnimation[] = []
  for (const body of ruleBodies(CSS, selector)) {
    for (const [, value] of body.matchAll(/(?:^|;|\s)animation\s*:\s*([^;]+);/g)) {
      for (const single of splitTop(value, /,/)) {
        // var(--x, 10) vale o valor padrão (o CSS do tremor do grito usa assim).
        const tokens = splitTop(single, /\s/).map((token) => token.match(/^var\(--[\w-]+,\s*(.+)\)$/)?.[1].trim() ?? token)
        const name = tokens.find((token) => /^[a-z][\w-]*$/i.test(token) && !KEYWORDS.has(token)) ?? ''
        const time = tokens.find((token) => /^\d*\.?\d+m?s$/.test(token)) ?? '0ms'
        const durationMs = time.endsWith('ms') ? Number.parseFloat(time) : Number.parseFloat(time) * 1000
        const count = tokens.find((token) => /^\d*\.?\d+$/.test(token))
        const repeats = tokens.includes('infinite') || (count !== undefined && Number(count) > 1)
        out.push({ name, durationMs, repeats })
      }
    }
  }
  return out
}

/** O bloco `@keyframes name { ... }` inteiro. */
function keyframesBody(name: string): string {
  const start = CSS.indexOf(`@keyframes ${name} {`)
  if (start < 0) throw new Error(`@keyframes ${name} não existe`)
  let depth = 0
  for (let i = CSS.indexOf('{', start); i < CSS.length; i += 1) {
    if (CSS[i] === '{') depth += 1
    else if (CSS[i] === '}') {
      depth -= 1
      if (depth === 0) return CSS.slice(start, i + 1)
    }
  }
  throw new Error(`@keyframes ${name} sem fim`)
}

/** Problemas de amplitude de um tremor rápido (vazio = pequeno o bastante). */
function bigMoves(keyframes: string): string[] {
  const problems: string[] = []
  const values = (fn: RegExp) => [...keyframes.matchAll(fn)].flatMap((match) => match[1].split(',').map((v) => v.trim()))
  for (const value of values(/translate[XY]?\(([^)]*)\)/g)) {
    if (Number.parseFloat(value) === 0) continue
    if (!value.endsWith('vmin')) problems.push(`translate em ${value} (use vmin)`)
    else if (Math.abs(Number.parseFloat(value)) > 1.2) problems.push(`translate ${value} > 1,2vmin`)
  }
  for (const value of values(/rotate[XYZ]?\(([^)]*)\)/g)) {
    if (Number.parseFloat(value) !== 0) problems.push(`rotate ${value}`)
  }
  for (const value of values(/skew[XY]?\(([^)]*)\)/g)) {
    if (Math.abs(Number.parseFloat(value)) > 3) problems.push(`skew ${value} > 3deg`)
  }
  for (const value of values(/scale[XY]?\(([^)]*)\)/g)) {
    if (Math.abs(Number.parseFloat(value) - 1) > 0.03 + 1e-9) problems.push(`scale ${value} fora de 1 ± 3%`)
  }
  return problems
}

/** sRGB (0–255) → luminância relativa (0–1). */
function luminance(gray: number) {
  const c = gray / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Gerador semeado (mulberry32): o mesmo sorteio em toda execução do teste. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

function render(kind: ConcreteScare, reduced: boolean) {
  return renderToString(createElement(ScareScene, { kind, reduced, duration: SCARE_DURATION_MS[kind] }))
}

function count(html: string, needle: string) {
  return html.split(needle).length - 1
}

describe('sustos de verdade no barramento', () => {
  it('animatrônico e rosto são tipos válidos, com tempo de tela e legenda em pt-BR', () => {
    for (const kind of ['animatronic', 'face'] as const) {
      expect(SCARE_KINDS).toContain(kind)
      expect(isConcreteScare(kind)).toBe(true)
      expect(resolveScareKind(kind)).toBe(kind)
      expect(SCARE_DURATION_MS[kind]).toBeGreaterThanOrEqual(2000)
      expect(SCARE_DURATION_MS[kind]).toBeLessThanOrEqual(2400)
    }
    expect(scareCaption('animatronic')).toEqual({ icon: '🤖', text: 'ELE AINDA FUNCIONA' })
    expect(scareCaption('face')).toEqual({ icon: '👁️', text: 'NÃO OLHA' })
  })

  it('os grupos cobrem todos os sustos sorteáveis, sem sobrar nem repetir', () => {
    expect([...SCARY_SCARES].sort()).toEqual(['animatronic', 'face', 'scream', 'static'])
    expect([...SCARY_SCARES, ...MEME_SCARES].sort()).toEqual([...SCARE_KINDS].sort())
  })

  it("'random' sai assustador ~2/3 das vezes, meme ~1/3, e nunca repete o último", () => {
    const random = seeded(31102026)
    const seen = new Map<ConcreteScare, number>()
    let previous: ConcreteScare | null = null
    let scary = 0
    const draws = 30000
    for (let i = 0; i < draws; i += 1) {
      const kind = pickScare(random, previous)
      expect(kind).not.toBe(previous)
      if ((SCARY_SCARES as readonly string[]).includes(kind)) scary += 1
      seen.set(kind, (seen.get(kind) ?? 0) + 1)
      previous = kind
    }
    expect(scary / draws).toBeGreaterThan(SCARY_SHARE - 0.02)
    expect(scary / draws).toBeLessThan(SCARY_SHARE + 0.02)
    // Todo mundo aparece (inclusive os de meme).
    for (const kind of SCARE_KINDS) expect(seen.get(kind) ?? 0).toBeGreaterThan(draws * 0.02)
  })

  it("'scary' só sorteia os assustadores, sem repetir o último", () => {
    const random = seeded(7)
    let previous: ConcreteScare | null = null
    for (let i = 0; i < 2000; i += 1) {
      const kind = pickScaryScare(random, previous)
      expect(SCARY_SCARES).toContain(kind)
      expect(kind).not.toBe(previous)
      previous = kind
      expect(SCARY_SCARES).toContain(resolveScareKind(SCARY_RANDOM, random))
    }
  })

  it('automático: assustador só se o último foi há 15 min ou mais; antes disso, só meme', () => {
    expect(isScaryScare('animatronic')).toBe(true)
    expect(isScaryScare(RARE_SCARE)).toBe(true)
    expect(isScaryScare('doot')).toBe(false)
    emitScare('face') // (sem ouvinte: só registra quando foi o último assustador)
    const t0 = Date.now()
    const random = seeded(2026)
    for (let i = 0; i < 1000; i += 1) {
      expect(MEME_SCARES).toContain(pickAutoScare(random, t0 + AUTO_SCARY_GAP_MS - 1000))
    }
    let scary = 0
    const draws = 6000
    for (let i = 0; i < draws; i += 1) {
      if (isScaryScare(pickAutoScare(random, t0 + AUTO_SCARY_GAP_MS + 1000))) scary += 1
    }
    expect(scary / draws).toBeGreaterThan(SCARY_SHARE - 0.04)
    expect(scary / draws).toBeLessThan(SCARY_SHARE + 0.04)
    // Um meme não zera o relógio; um assustador zera.
    emitScare('doot')
    expect(MEME_SCARES).toContain(pickAutoScare(random, Date.now()))
  })

  it("emitScare('scary') chega no overlay como um susto assustador", () => {
    const received: ScareRequest[] = []
    cleanups.push(onScare((request) => received.push(request)))
    for (let i = 0; i < 20; i += 1) emitScare(SCARY_RANDOM)
    expect(received).toHaveLength(20)
    for (const request of received) expect(SCARY_SCARES).toContain(request.kind)
    for (let i = 1; i < received.length; i += 1) expect(received[i].kind).not.toBe(received[i - 1].kind)
  })
})

describe('segurança das cenas', () => {
  it('animatrônico: no máximo 2 clarões, ≥ 400 ms de escuro entre eles, todos antes do bote', () => {
    expect(ANIMATRONIC_FLASHES.length).toBeLessThanOrEqual(MAX_FLASHES_PER_SCARE)
    for (let i = 1; i < ANIMATRONIC_FLASHES.length; i += 1) {
      const before = ANIMATRONIC_FLASHES[i - 1]
      expect(ANIMATRONIC_FLASHES[i].at - (before.at + before.ms)).toBeGreaterThanOrEqual(MIN_FLASH_GAP_MS)
    }
    const lastFlash = ANIMATRONIC_FLASHES[ANIMATRONIC_FLASHES.length - 1]
    expect(lastFlash.at + lastFlash.ms).toBeLessThan(ANIMATRONIC_RUSH_MS)
    // O bote cabe na cena, com tempo de ver a mandíbula batendo antes de sumir.
    expect(SCARE_DURATION_MS.animatronic - ANIMATRONIC_RUSH_MS).toBeGreaterThanOrEqual(1000)
  })

  it('rosto: meio segundo de silêncio antes, e tempo de tela depois', () => {
    expect(FACE_HIT_MS).toBe(500)
    expect(SCARE_DURATION_MS.face - FACE_HIT_MS).toBeGreaterThanOrEqual(1200)
  })

  it('versão animada: desenha a criatura, os 2 clarões e o rosto', () => {
    const animatronic = render('animatronic', false)
    expect(count(animatronic, 'class="hws-anim-light"')).toBe(ANIMATRONIC_FLASHES.length)
    expect(animatronic).toContain('hws-anim-jaw')
    expect(animatronic).toContain('hws-anim-eyes')
    expect(animatronic).toContain('--hws-rush:1000ms')
    const face = render('face', false)
    expect(face).toContain('hws-face-burst')
    expect(face).toContain('hws-face-mouth')
    expect(face).toContain('--hws-hit:500ms')
  })

  it('fotossensibilidade: nada que cobre a tela treme rápido com amplitude grande', () => {
    // Tremer a tela inteira a 11–15 Hz faz as bordas claras/escuras piscarem: medido quadro a
    // quadro, o tremor antigo piscava em 28% (animatrônico), 68% (rosto), 27% (grito) e 66%
    // (Penetra) de um campo de visão de 10° — o limite é 25%. Regra: o que repete mais rápido
    // que ~6 trocas/s (≤ 3 clarões/s) tem de ser pequeno: ≤ 1,2vmin, sem giro, skew ≤ 3°, escala ±3%.
    const containers = [
      '.hws-anim-stage',
      '.hws-face-stage',
      '.hws-face-jitter',
      '.hws-shaker',
      '.hws-penetra-face',
      '.hws-penetra-img',
    ]
    for (const selector of containers) {
      expect(ruleBodies(CSS, selector).length, `${selector} sumiu do CSS`).toBeGreaterThan(0)
      for (const animation of animationsOf(selector)) {
        if (!animation.repeats) continue
        const keyframes = keyframesBody(animation.name)
        const stops = (keyframes.match(/\{/g)?.length ?? 1) - 1
        const msPerChange = animation.durationMs / Math.max(1, stops)
        if (msPerChange >= 1000 / 6) continue
        expect(bigMoves(keyframes), `${selector} → ${animation.name}`).toEqual([])
      }
    }
    // Os palcos que ocupam a tela inteira não tremem mais.
    expect(animationsOf('.hws-anim-stage')).toEqual([])
    expect(animationsOf('.hws-face-stage')).toEqual([])
  })

  it('fotossensibilidade: o chiado troca 25×/s, então cada ponto varia menos de 0,1 de luminância', () => {
    expect(STATIC_GRAY_MIN).toBeGreaterThanOrEqual(0)
    expect(STATIC_GRAY_MIN + STATIC_GRAY_RANGE).toBeLessThanOrEqual(255)
    expect(luminance(STATIC_GRAY_MIN + STATIC_GRAY_RANGE) - luminance(STATIC_GRAY_MIN)).toBeLessThan(0.1)
  })

  it('animatrônico: o bote enche a tela em ~10 ms e o guincho cai a ±30 ms desse impacto', () => {
    expect(ANIMATRONIC_IMPACT_MS).toBeGreaterThanOrEqual(ANIMATRONIC_RUSH_MS)
    expect(Math.abs(SCREECH_AT_MS - ANIMATRONIC_IMPACT_MS)).toBeLessThanOrEqual(30)
    // O 1º passo do hws-anim-rush já leva a criatura ao close (escala ≥ 3,1 = mais de 100vh
    // partindo de 32,5vh), em até 60 ms — antes, o bote levava 182 ms e o guincho chegava antes.
    const [rush] = animationsOf('.hws-anim-rush')
    expect(rush.name).toBe('hws-anim-rush')
    const stops = [...keyframesBody('hws-anim-rush').matchAll(/([\d.]+)%\s*\{[^}]*scale\(([\d.]+)\)/g)].map(
      (match) => ({ at: Number(match[1]), scale: Number(match[2]) }),
    )
    const close = stops.find((stop) => stop.scale >= 3.1)
    expect(close).toBeDefined()
    expect(((close?.at ?? 100) / 100) * rush.durationMs).toBeLessThanOrEqual(60)
  })

  it('reduzir movimento: versão calma, sem criatura, sem clarão e sem tremor', () => {
    for (const kind of ['animatronic', 'face'] as const) {
      const html = render(kind, true)
      expect(html).toContain('hws-calm')
      expect(html).toContain(scareCaption(kind).text)
      for (const moving of ['hws-anim-', 'hws-face-', 'hws-vhs-', 'hws-scary']) expect(html).not.toContain(moving)
    }
  })
})
