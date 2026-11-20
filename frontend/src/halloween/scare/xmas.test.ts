import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { XMAS_EFFECTS } from './bus'
import type { ConcreteScare } from './bus'
import { LIGHTS_BLINK_MS, SCARE_DURATION_MS, scareCaption, secretSantaGift } from './config'
import ScareScene from './scenes'
import { SHIVER_FRAMES } from './xmas'

// O CSS de verdade, lido do disco (no vitest, `import './x.css?raw'` vem vazio).
const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const CSS = fs.readFileSync(new URL('./xmas.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function render(kind: ConcreteScare, reduced: boolean, name?: string) {
  return renderToString(createElement(ScareScene, { kind, name, reduced, duration: SCARE_DURATION_MS[kind] }))
}

/** Todos os `@keyframes nome { ... }` do arquivo. */
function allKeyframes(css: string): Map<string, string> {
  const out = new Map<string, string>()
  let from = 0
  for (;;) {
    const start = css.indexOf('@keyframes ', from)
    if (start < 0) return out
    const name = css.slice(start + 11, css.indexOf('{', start)).trim()
    let depth = 0
    let i = css.indexOf('{', start)
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    out.set(name, css.slice(start, i + 1))
    from = i + 1
  }
}

const KEYFRAMES = allKeyframes(CSS)
const RULES_CSS = [...KEYFRAMES.values()].reduce((css, block) => css.replace(block, ''), CSS)

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

type Animation = { selector: string; name: string; durationMs: number; repeats: boolean }

/** Todas as animações (shorthand `animation:`) de todas as regras do arquivo. */
function allAnimations(): Animation[] {
  const out: Animation[] = []
  for (const [, selector, body] of RULES_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const [, value] of body.matchAll(/(?:^|;|\s)animation\s*:\s*([^;]+);/g)) {
      for (const single of splitTop(value, /,/)) {
        const tokens = splitTop(single, /\s/).map(
          (token) => token.match(/^var\(--[\w-]+,\s*(.+)\)$/)?.[1].trim() ?? token,
        )
        const name = tokens.find((token) => /^[a-z][\w-]*$/i.test(token) && !KEYWORDS.has(token)) ?? ''
        const time = tokens.find((token) => /^\d*\.?\d+m?s$/.test(token)) ?? '0ms'
        const durationMs = time.endsWith('ms') ? Number.parseFloat(time) : Number.parseFloat(time) * 1000
        const count = tokens.find((token) => /^\d*\.?\d+$/.test(token))
        const repeats = tokens.includes('infinite') || (count !== undefined && Number(count) > 1)
        out.push({ selector: selector.trim(), name, durationMs, repeats })
      }
    }
  }
  return out
}

/** Problemas de amplitude de um tremor rápido (vazio = pequeno o bastante). */
function bigMoves(frames: string): string[] {
  const problems: string[] = []
  const values = (fn: RegExp) => [...frames.matchAll(fn)].flatMap((match) => match[1].split(',').map((v) => v.trim()))
  for (const value of values(/translate[XY]?\(([^)]*)\)/g)) {
    if (Number.parseFloat(value) === 0) continue
    if (!value.endsWith('vmin')) problems.push(`translate em ${value} (use vmin)`)
    else if (Math.abs(Number.parseFloat(value)) > 1.2) problems.push(`translate ${value} > 1,2vmin`)
  }
  for (const value of values(/rotate[XYZ]?\(([^)]*)\)/g)) {
    if (Number.parseFloat(value) !== 0) problems.push(`rotate ${value}`)
  }
  return problems
}

describe('efeitos de Natal: cenas', () => {
  it.each([...XMAS_EFFECTS])('%s: versão animada com arte de Natal, calma sem nada se mexendo', (kind) => {
    const animated = render(kind, false, 'Ana')
    expect(animated).toContain('hwx-')
    const calm = render(kind, true, 'Ana')
    expect(calm).toContain('hws-calm--xmas')
    expect(calm).not.toContain('hwx-')
    expect(calm).toContain(scareCaption(kind, 'Ana').icon)
  })

  it('cada efeito tem a sua arte', () => {
    expect(render('hohoho', false)).toContain('hwx-santa-belly')
    expect(render('blizzard', false)).toContain('hwx-flake')
    expect(render('giftRain', false)).toContain('hwx-sock')
    expect(render('reindeer', false)).toContain('hwx-deer')
    expect(render('lightsParty', false)).toContain('hwx-bulb')
    expect(render('secretSanta', false)).toContain('hwx-spot')
    expect(render('elfChoir', false)).toContain('hwx-elf-mouth')
  })

  it('Papai Noel põe o nome na lista dos malcriados; sem nome, deseja Feliz Natal', () => {
    const named = render('hohoho', false, 'Beto')
    expect(named).toContain('LISTA DOS MALCRIADOS')
    expect(named).toContain('Beto')
    expect(render('hohoho', false)).toContain('FELIZ NATAL!')
  })

  it('amigo secreto revela o nome e o presente-piada', () => {
    const html = render('secretSanta', false, 'Carla')
    expect(html).toContain('Carla')
    expect(html).toContain(secretSantaGift('Carla').replace('"', '&quot;'))
    expect(render('secretSanta', false)).toContain('VOCÊ!')
  })

  it('o zoom suspeito ganhou gorro e moldura de bengala (e a versão calma de Natal)', () => {
    const html = render('zoom', false, 'Dudu')
    expect(html).toContain('hws-zoom-hat')
    expect(html).toContain('hwx-candy')
    expect(html).toContain('Dudu')
    expect(render('zoom', true, 'Dudu')).toContain('hws-calm--xmas')
  })

  it('os sustos de Halloween continuam com o cartão calmo de sempre', () => {
    expect(render('doot', true)).not.toContain('hws-calm--xmas')
  })
})

describe('efeitos de Natal: fotossensibilidade', () => {
  const animations = allAnimations()

  it('o CSS foi lido e as animações apontam para @keyframes que existem', () => {
    expect(animations.length).toBeGreaterThan(20)
    const shared = new Set(['hws-in']) // de scare.css
    for (const animation of animations) {
      expect(KEYFRAMES.has(animation.name) || shared.has(animation.name), animation.name).toBe(true)
    }
  })

  it('nada que muda brilho/cor repete mais que 3 vezes por segundo', () => {
    let checked = 0
    for (const animation of animations) {
      if (!animation.repeats) continue
      const frames = KEYFRAMES.get(animation.name) ?? ''
      if (!/opacity|background|color|filter|box-shadow|fill/.test(frames)) continue
      checked += 1
      const stops = (frames.match(/\{/g)?.length ?? 1) - 1
      const flashesPerCycle = Math.max(1, Math.floor(stops / 2))
      const perSecond = (flashesPerCycle * 1000) / animation.durationMs
      expect(perSecond, `${animation.selector} → ${animation.name}`).toBeLessThanOrEqual(3)
    }
    // O pisca-pisca está entre os conferidos.
    expect(checked).toBeGreaterThan(0)
    expect(animations.some((animation) => animation.name === 'hwx-blink' && animation.repeats)).toBe(true)
    expect(LIGHTS_BLINK_MS).toBeGreaterThanOrEqual(1000 / 3)
  })

  it('o apagão do fusível e as entradas acontecem uma vez só', () => {
    for (const name of ['hws-in', 'hwx-zap', 'hwx-frost', 'hwx-wander', 'hwx-spot-grow']) {
      for (const animation of animations.filter((a) => a.name === name)) {
        expect(animation.repeats, `${animation.selector} → ${name}`).toBe(false)
      }
    }
  })

  it('tremor rápido é pequeno (≤ 1,2vmin, sem giro): o "brrr" e a sala tremendo', () => {
    for (const animation of animations) {
      if (!animation.repeats) continue
      const frames = KEYFRAMES.get(animation.name) ?? ''
      const stops = (frames.match(/\{/g)?.length ?? 1) - 1
      if (animation.durationMs / Math.max(1, stops) >= 1000 / 6) continue
      // Trocas mais rápidas que 6/s: só em coisas pequenas (lâmpada, boca, pernas)
      // ou tremendo pouco. As que cobrem muito da tela têm de tremer pouco.
      if (['.hwx-brr-box'].includes(animation.selector)) {
        expect(bigMoves(frames), `${animation.selector} → ${animation.name}`).toEqual([])
      }
    }
    expect(bigMoves(SHIVER_FRAMES.join(' '))).toEqual([])
  })
})
