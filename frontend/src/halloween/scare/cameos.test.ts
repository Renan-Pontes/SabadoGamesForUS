import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isLoudSfx } from '../audio/loud'
import { isSfxName } from '../audio/types'
import { seasonFxKind } from '../fx/decide'
import { FESTIVE_EFFECTS, FESTIVE_RANDOM, SCARE_KINDS, RARE_SCARE, emitScare, onScare, setScareNames, clearScareNames } from './bus'
import { CameoScene } from './CameoOverlay'
import { playCameoSound } from './cameoSound'
import {
  CAMEOS,
  CAMEO_INFO,
  CAMEO_MAX_VOLUME,
  CAMEO_RANDOM,
  CAMEO_SOFT_SFX,
  HOST_CAMEO_BUTTONS,
  RANDOM_CAMEOS,
  cameoBubble,
  isCameo,
  isCameoRequest,
  onCameo,
  pickCameo,
  resolveCameo,
} from './cameos'
import type { Cameo, CameoRequest } from './cameos'

const calls = vi.hoisted(() => ({
  sfx: [] as [string, { delay?: number; volume?: number; loud?: boolean } | undefined][],
  speech: [] as string[],
}))

vi.mock('../audio', () => ({
  playSfx: (name: string, options?: { delay?: number; volume?: number; loud?: boolean }) => {
    calls.sfx.push([name, options])
    return 1
  },
  speakFestive: (text: string) => {
    calls.speech.push(text)
    return () => undefined
  },
  speakSpooky: (text: string) => {
    calls.speech.push(text)
    return () => undefined
  },
  hushMusic: () => undefined,
}))

beforeEach(() => {
  calls.sfx.length = 0
  calls.speech.length = 0
})

// O CSS de verdade, lido do disco (no vitest, `import './x.css?raw'` vem vazio).
const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const CSS = fs.readFileSync(new URL('./cameos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function keyframes(css: string): Map<string, string> {
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

const KEYFRAMES = keyframes(CSS)

function render(kind: Cameo, reduced: boolean, name?: string) {
  return renderToString(createElement(CameoScene, { kind, name, reduced, duration: CAMEO_INFO[kind].durationMs }))
}

describe('visitas de Natal: o registro', () => {
  it('cerca de 8 visitas (mais o desconfiado), cada uma com nome, ícone e frase', () => {
    expect(CAMEOS.length).toBeGreaterThanOrEqual(8)
    for (const kind of CAMEOS) {
      const info = CAMEO_INFO[kind]
      expect(info.label, kind).toBeTruthy()
      expect(info.icon, kind).toBeTruthy()
      expect(info.caption, kind).toBeTruthy()
      expect(isCameo(kind)).toBe(true)
    }
  })

  it('duram de 4 a 10 s (entram, fazem a graça e saem devagar)', () => {
    for (const kind of CAMEOS) {
      expect(CAMEO_INFO[kind].durationMs, kind).toBeGreaterThanOrEqual(4000)
      expect(CAMEO_INFO[kind].durationMs, kind).toBeLessThanOrEqual(10_000)
    }
  })

  it('não se confundem com os efeitos de tela cheia nem com os sustos', () => {
    for (const kind of CAMEOS) {
      expect(SCARE_KINDS as readonly string[], kind).not.toContain(kind)
      expect(FESTIVE_EFFECTS as readonly string[], kind).not.toContain(kind)
      expect(kind).not.toBe(RARE_SCARE)
    }
    for (const kind of [...SCARE_KINDS, ...FESTIVE_EFFECTS, RARE_SCARE, 'random', 'scary']) {
      expect(isCameoRequest(kind), kind).toBe(false)
    }
    expect(isCameoRequest(CAMEO_RANDOM)).toBe(true)
    expect(isCameoRequest(FESTIVE_RANDOM)).toBe(true)
  })
})

describe('visitas de Natal: o sorteio', () => {
  it('nunca repete a última e nunca sorteia o desconfiado', () => {
    let previous: Cameo | null = null
    const seen = new Set<Cameo>()
    for (let i = 0; i < 400; i += 1) {
      const kind = pickCameo(Math.random, previous)
      expect(kind).not.toBe(previous)
      expect(kind).not.toBe('peek')
      seen.add(kind)
      previous = kind
    }
    expect([...seen].sort()).toEqual([...RANDOM_CAMEOS].sort())
    expect(RANDOM_CAMEOS).not.toContain('peek')
    expect(RANDOM_CAMEOS).toContain(pickCameo(() => 0.999999, null))
  })

  it('pedido pelo nome fica; "cameo", "festive" e lixo viram sorteio', () => {
    expect(resolveCameo('cookie')).toBe('cookie')
    expect(resolveCameo('peek')).toBe('peek')
    for (const kind of [CAMEO_RANDOM, FESTIVE_RANDOM, 'blizzard', 42]) {
      expect(RANDOM_CAMEOS).toContain(resolveCameo(kind))
    }
  })

  it('o host nunca dispara efeito alto no Natal: tudo vira visita', () => {
    for (const kind of [...FESTIVE_EFFECTS, ...SCARE_KINDS, RARE_SCARE, 'random', 'scary']) {
      expect(isCameoRequest(seasonFxKind(kind, false)), kind).toBe(true)
    }
    expect(seasonFxKind('cookie', false)).toBe('cookie')
    expect(seasonFxKind('peek', false)).toBe('peek')
    // No Halloween (sustos ligados) o pedido passa como veio.
    expect(seasonFxKind('scream', true)).toBe('scream')
  })
})

describe('visitas de Natal: o barramento', () => {
  it('triggerScare("cameo" | "festive" | visita) vai para o palco das visitas, não para a tela cheia', () => {
    const cameos: CameoRequest[] = []
    const scares: unknown[] = []
    const stopCameo = onCameo((request) => cameos.push(request))
    const stopScare = onScare((request) => scares.push(request))
    expect(emitScare(CAMEO_RANDOM)).toBeNull()
    emitScare(FESTIVE_RANDOM)
    emitScare('penguin')
    emitScare('peek', { name: 'Ana' })
    stopCameo()
    stopScare()
    expect(scares).toEqual([])
    expect(cameos).toHaveLength(4)
    for (const request of cameos) expect(isCameo(request.kind)).toBe(true)
    expect(cameos[2].kind).toBe('penguin')
    expect(cameos[3]).toMatchObject({ kind: 'peek', name: 'Ana' })
    // Só o desconfiado leva nome.
    expect(cameos[2].name).toBeUndefined()
  })

  it('o desconfiado sem nome pega alguém da sala; sem ninguém, "alguém aqui"', () => {
    const cameos: CameoRequest[] = []
    const stop = onCameo((request) => cameos.push(request))
    setScareNames('teste', ['Beto'])
    emitScare('peek')
    clearScareNames('teste')
    emitScare('peek')
    stop()
    expect(cameos[0].name).toBe('Beto')
    expect(cameoBubble('peek', cameos[0].name)).toBe('Hmm… Beto?')
    expect(cameoBubble('peek', cameos[1].name)).toBe('Hmm… alguém aqui?')
    expect(cameoBubble('cookie', 'Ana')).toBeNull()
  })
})

describe('visitas de Natal: o som', () => {
  it.each([...CAMEOS])('%s: só som suave, baixinho, dentro do tempo de tela e sem fala', (kind) => {
    playCameoSound(kind)
    expect(calls.sfx.length).toBeGreaterThan(0)
    expect(calls.speech).toEqual([])
    for (const [name, options] of calls.sfx) {
      expect(isSfxName(name), name).toBe(true)
      expect(CAMEO_SOFT_SFX, name).toContain(name)
      expect(isLoudSfx(name as never), name).toBe(false)
      expect(['boom', 'buzzer', 'scream', 'shriek', 'screech', 'jumpscare', 'static', 'explosion'], name).not.toContain(name)
      expect(options?.loud).toBeUndefined()
      expect(options?.volume ?? 1, name).toBeLessThanOrEqual(CAMEO_MAX_VOLUME)
      expect((options?.delay ?? 0) * 1000).toBeLessThan(CAMEO_INFO[kind].durationMs)
    }
  })

  it('o teto de volume é 0,5', () => {
    expect(CAMEO_MAX_VOLUME).toBeLessThanOrEqual(0.5)
  })
})

describe('visitas de Natal: a cena', () => {
  it.each([...CAMEOS])('%s: arte pequena num canto ou no fundo; calma = cartão parado', (kind) => {
    const animated = render(kind, false, 'Ana')
    expect(animated).toContain(`hwc-root--${CAMEO_INFO[kind].layer}`)
    expect(animated).toContain('<svg')
    // Nunca a tela cheia dos sustos.
    expect(animated).not.toContain('hws-')
    expect(animated).not.toContain('hwx-')
    const calm = render(kind, true, 'Ana')
    expect(calm).toContain('hwc-calm')
    expect(calm).not.toContain('<svg')
    expect(calm).toContain(CAMEO_INFO[kind].icon)
  })

  it('o desconfiado mostra o balãozinho com o nome', () => {
    expect(render('peek', false, 'Dudu')).toContain('Hmm… Dudu?')
    expect(render('peek', true, 'Dudu')).toContain('Hmm… Dudu?')
  })

  it('cada visita tem a sua arte', () => {
    expect(render('cookie', false)).toContain('hwc-cookie-arm')
    expect(render('santaSleigh', false)).toContain('hwc-santa-gift')
    expect(render('snowman', false)).toContain('hwc-snow-hat')
    expect(render('penguin', false)).toContain('hwc-penguin')
    expect(render('shootingStar', false)).toContain('hwc-star-trail')
    expect(render('parachuteGift', false)).toContain('hwc-canopy')
    expect(render('reindeerHop', false)).toContain('hwc-hop')
    expect(render('chimneyElf', false)).toContain('hwc-confetti')
    expect(render('peek', false)).toContain('hwc-brow')
  })
})

describe('visitas de Natal: leve para a TV e sem susto', () => {
  it('as animações só mexem em transform e opacity', () => {
    expect(KEYFRAMES.size).toBeGreaterThan(10)
    for (const [name, block] of KEYFRAMES) {
      const props = [...block.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1])
      for (const prop of props) expect(['transform', 'opacity'], `${name}: ${prop}`).toContain(prop)
    }
  })

  it('toda animação aponta para um @keyframes que existe', () => {
    // 'none' é a rede de segurança do "reduzir movimento".
    const names = [...CSS.matchAll(/animation\s*:\s*([a-z][\w-]*)/g)].map((match) => match[1]).filter((name) => name !== 'none')
    expect(names.length).toBeGreaterThan(10)
    for (const name of names) expect(KEYFRAMES.has(name), name).toBe(true)
  })

  it('nada pisca: o que repete sem parar não mexe na opacidade mais que 3 vezes por segundo', () => {
    for (const [, selector, body] of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const match = /animation\s*:\s*([a-z][\w-]*)\s+(\d+)ms[^;]*infinite/.exec(body)
      if (!match) continue
      const frames = KEYFRAMES.get(match[1]) ?? ''
      if (!frames.includes('opacity')) continue
      expect(1000 / Number(match[2]), selector.trim()).toBeLessThanOrEqual(3)
    }
  })

  it('pequenas: nenhuma arte passa de 20vmin de largura', () => {
    for (const [, selector, body] of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const width = /(?:^|;|\s)width\s*:\s*([\d.]+)vmin/.exec(body)
      if (width) expect(Number(width[1]), selector.trim()).toBeLessThanOrEqual(20)
    }
  })
})

describe('painel do host', () => {
  it('oferece só visitas de Natal (nada de efeito de tela cheia nem zoom)', () => {
    expect(HOST_CAMEO_BUTTONS.map((button) => button.kind)).toEqual([...CAMEOS])
    for (const button of HOST_CAMEO_BUTTONS) {
      expect(isCameo(button.kind)).toBe(true)
      expect(FESTIVE_EFFECTS as readonly string[]).not.toContain(button.kind)
      expect(button.done('Ana')).toBeTruthy()
    }
    expect(HOST_CAMEO_BUTTONS.find((button) => button.kind === 'peek')?.named).toBe(true)
    expect(HOST_CAMEO_BUTTONS.find((button) => button.kind === 'peek')?.done('Ana')).toContain('Ana')
  })

  it('a tela do host não lista mais os efeitos altos', () => {
    const host = fs.readFileSync(new URL('../../pages/HostRoom.tsx', import.meta.url), 'utf8')
    expect(host).toContain('HOST_CAMEO_BUTTONS')
    expect(host).toContain('CAMEO_RANDOM')
    expect(host).not.toContain('FESTIVE_RANDOM')
    for (const loud of FESTIVE_EFFECTS) {
      expect(host, loud).not.toMatch(new RegExp(`['"\`]${loud}['"\`]`))
    }
  })
})
