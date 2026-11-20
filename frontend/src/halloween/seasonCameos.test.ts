import { describe, expect, it } from 'vitest'
import { FESTIVE_EFFECTS, SCARE_KINDS, RARE_SCARE } from './scare/bus'
import { isCameo } from './scare/cameos'

/**
 * Natal sem susto: os jogos da temporada só chamam visitas de Natal
 * (pequenas, nos cantos) — nunca os efeitos de tela cheia ('blizzard',
 * 'hohoho'...), o zoom 🤨📸 com "vine boom" ou os sustos de Halloween.
 */

type Fs = {
  readFileSync: (path: URL, encoding: 'utf8') => string
  readdirSync: (path: URL, options: { recursive: true }) => string[]
}
const fs = (await import(/* @vite-ignore */ String('node:fs'))) as Fs

const SEASON_FOLDERS = [
  './games/espiao-assombrado/',
  './games/pergunta-trocada/',
  './games/duas-verdades/',
  './games/abobora-bomba/',
  './games/retrato-assombrado/',
  './games/cidade-dorme/',
  '../games/ReadMyMind/',
]

/** Os arquivos de código (sem testes) de cada pasta de jogo da temporada. */
function seasonSources(): { file: string; code: string }[] {
  const out: { file: string; code: string }[] = []
  for (const folder of SEASON_FOLDERS) {
    const base = new URL(folder, import.meta.url)
    for (const entry of fs.readdirSync(base, { recursive: true })) {
      const file = String(entry).replace(/\\/g, '/')
      if (!/\.(ts|tsx)$/.test(file) || /\.test\.tsx?$/.test(file)) continue
      out.push({ file: folder + file, code: fs.readFileSync(new URL(file, base), 'utf8') })
    }
  }
  return out
}

const LOUD = [...FESTIVE_EFFECTS, ...SCARE_KINDS, RARE_SCARE, 'random', 'scary', 'festive']

describe('jogos da temporada de Natal: só visitas, nada de susto', () => {
  const sources = seasonSources()

  it('achou os arquivos dos jogos', () => {
    expect(sources.length).toBeGreaterThan(20)
    expect(sources.some(({ code }) => code.includes('triggerScare('))).toBe(true)
  })

  it('nenhum triggerScare com efeito alto, zoom ou susto de Halloween', () => {
    const pattern = new RegExp(`triggerScare\\(\\s*['"\`](${LOUD.join('|')})['"\`]`)
    for (const { file, code } of sources) expect(code, file).not.toMatch(pattern)
  })

  it('todo triggerScare com nome escrito chama uma visita de Natal', () => {
    let checked = 0
    for (const { file, code } of sources) {
      for (const [, kind] of code.matchAll(/triggerScare\(\s*['"`](\w+)['"`]/g)) {
        checked += 1
        expect(isCameo(kind), `${file}: ${kind}`).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(3)
  })

  it('nem pelos caminhos indiretos (piada da revelação, deixa da narração)', () => {
    const pattern = new RegExp(`(?:return|kind:|\\?|:)\\s*['"\`](${LOUD.join('|')})['"\`]`)
    for (const { file, code } of sources) {
      for (const line of code.split('\n')) {
        if (!/scare|meme|effect|visit|Cameo/i.test(line)) continue
        expect(line, file).not.toMatch(pattern)
      }
    }
  })
})
